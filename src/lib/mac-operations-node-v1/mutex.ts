import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";
import {
  MAC_OPS_LOCK_HEARTBEAT_INTERVAL_MS,
  MAC_OPS_LOCK_REL,
  MAC_OPS_LOCK_TTL_MS,
  MAC_OPS_NODE_VERSION,
  MAC_OPS_RECOVERY_LOCK_REL,
  MAC_OPS_RECOVERY_LOCK_TTL_MS,
  type MacOpsLeaseRefreshOutcome,
  type MacOpsLockOutcome,
  type MacOpsLockRecord,
} from "./types";

export type MacOpsLockTestHooks = {
  afterInitialRead?: (record: MacOpsLockRecord | null) => Promise<void>;
  beforeRecoveryGuardAttempt?: () => Promise<void>;
  afterRecoveryGuardAcquired?: () => Promise<void>;
  beforeUnlinkStale?: (record: MacOpsLockRecord) => Promise<void>;
  afterUnlinkStale?: () => Promise<void>;
  beforeMainExclusiveCreate?: () => Promise<void>;
  afterRecoveryGuardReleased?: () => Promise<void>;
  beforeLeaseRefreshWrite?: (record: MacOpsLockRecord) => Promise<void>;
  afterStaleGuardRenamed?: () => Promise<void>;
};

type RecoveryGuardHandle = {
  acquired: boolean;
  release: () => Promise<void>;
};

type RecoveryGuardRecord = {
  version: typeof MAC_OPS_NODE_VERSION;
  kind: "recovery-guard";
  guardId: string;
  pid: number;
  startedAt: string;
  expiresAt: string;
};

const RECOVERY_GUARD_RETRY = 3;

export function macOpsLockPath(cwd: string): string {
  return path.join(cwd, MAC_OPS_LOCK_REL);
}

export function macOpsRecoveryLockPath(cwd: string): string {
  return path.join(cwd, MAC_OPS_RECOVERY_LOCK_REL);
}

export async function writeMacOpsJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  const tmp = `${filePath}.${process.pid}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await rename(tmp, filePath);
  } catch {
    await unlink(filePath).catch(() => undefined);
    await rename(tmp, filePath);
  }
}

function isLockRecord(v: unknown): v is MacOpsLockRecord {
  if (typeof v !== "object" || v == null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.version === MAC_OPS_NODE_VERSION &&
    typeof o.pid === "number" &&
    typeof o.startedAt === "string" &&
    typeof o.expiresAt === "string" &&
    typeof o.runId === "string"
  );
}

function isRecoveryGuardRecord(v: unknown): v is RecoveryGuardRecord {
  if (typeof v !== "object" || v == null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.version === MAC_OPS_NODE_VERSION &&
    o.kind === "recovery-guard" &&
    typeof o.guardId === "string" &&
    typeof o.pid === "number" &&
    typeof o.startedAt === "string" &&
    typeof o.expiresAt === "string"
  );
}

export async function readMacOpsLock(
  cwd: string,
): Promise<MacOpsLockRecord | null> {
  try {
    const raw = await readFile(macOpsLockPath(cwd), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isLockRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readRecoveryGuard(
  cwd: string,
): Promise<RecoveryGuardRecord | null> {
  try {
    const raw = await readFile(macOpsRecoveryLockPath(cwd), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isRecoveryGuardRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isMacOpsLockExpired(
  record: MacOpsLockRecord,
  now: Date,
): boolean {
  const exp = Date.parse(record.expiresAt);
  return !Number.isFinite(exp) || now.getTime() >= exp;
}

function isRecoveryGuardExpired(
  record: RecoveryGuardRecord,
  now: Date,
): boolean {
  const exp = Date.parse(record.expiresAt);
  return !Number.isFinite(exp) || now.getTime() >= exp;
}

function buildMainLockRecord(input: {
  runId: string;
  now: Date;
  ttlMs: number;
}): MacOpsLockRecord {
  return {
    version: MAC_OPS_NODE_VERSION,
    pid: process.pid,
    startedAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + input.ttlMs).toISOString(),
    runId: input.runId,
    hostname: hostname(),
  };
}

async function exclusiveCreateJson(
  filePath: string,
  value: unknown,
): Promise<boolean> {
  try {
    const fh = await open(filePath, "wx");
    try {
      await fh.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    } finally {
      await fh.close();
    }
    return true;
  } catch {
    return false;
  }
}

async function overwriteJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function tryAcquireRecoveryGuard(input: {
  cwd: string;
  now: Date;
  hooks?: MacOpsLockTestHooks;
}): Promise<RecoveryGuardHandle> {
  const filePath = macOpsRecoveryLockPath(input.cwd);
  await mkdir(path.dirname(filePath), { recursive: true });
  await input.hooks?.beforeRecoveryGuardAttempt?.();

  const guardId = randomBytes(8).toString("hex");
  const record: RecoveryGuardRecord = {
    version: MAC_OPS_NODE_VERSION,
    kind: "recovery-guard",
    guardId,
    pid: process.pid,
    startedAt: input.now.toISOString(),
    expiresAt: new Date(
      input.now.getTime() + MAC_OPS_RECOVERY_LOCK_TTL_MS,
    ).toISOString(),
  };

  const notAcquired: RecoveryGuardHandle = {
    acquired: false,
    release: async () => undefined,
  };

  const release = async (): Promise<void> => {
    const current = await readRecoveryGuard(input.cwd);
    if (current && current.guardId === guardId) {
      await unlink(filePath).catch(() => undefined);
    }
    await input.hooks?.afterRecoveryGuardReleased?.();
  };

  if (await exclusiveCreateJson(filePath, record)) {
    return { acquired: true, release };
  }

  const existing = await readRecoveryGuard(input.cwd);
  if (!existing) {
    if (await exclusiveCreateJson(filePath, record)) {
      return { acquired: true, release };
    }
    return notAcquired;
  }

  if (!isRecoveryGuardExpired(existing, input.now)) {
    return notAcquired;
  }

  const reclaimPath = `${filePath}.reclaim.${guardId}`;
  try {
    await rename(filePath, reclaimPath);
  } catch {
    return notAcquired;
  }

  try {
    await input.hooks?.afterStaleGuardRenamed?.();
    if (await exclusiveCreateJson(filePath, record)) {
      await unlink(reclaimPath).catch(() => undefined);
      return { acquired: true, release };
    }
    await unlink(reclaimPath).catch(() => undefined);
    return notAcquired;
  } catch {
    await unlink(reclaimPath).catch(() => undefined);
    return notAcquired;
  }
}

export async function inspectMacOpsLock(input: {
  cwd: string;
  now?: Date;
}): Promise<MacOpsLockOutcome> {
  const now = input.now ?? new Date();
  const existing = await readMacOpsLock(input.cwd);
  if (!existing) return "LOCK_AVAILABLE";
  if (isMacOpsLockExpired(existing, now)) return "LOCK_AVAILABLE";
  return "LOCK_HELD";
}

export async function acquireMacOpsLock(input: {
  cwd: string;
  runId: string;
  now?: Date;
  ttlMs?: number;
  hooks?: MacOpsLockTestHooks;
}): Promise<{
  outcome: Extract<
    MacOpsLockOutcome,
    "LOCK_ACQUIRED" | "LOCK_ALREADY_HELD" | "LOCK_STALE_RECOVERED"
  >;
  record: MacOpsLockRecord | null;
}> {
  const now = input.now ?? new Date();
  const ttl = input.ttlMs ?? MAC_OPS_LOCK_TTL_MS;
  const filePath = macOpsLockPath(input.cwd);
  await mkdir(path.dirname(filePath), { recursive: true });
  const record = buildMainLockRecord({ runId: input.runId, now, ttlMs: ttl });

  if (await exclusiveCreateJson(filePath, record)) {
    return { outcome: "LOCK_ACQUIRED", record };
  }

  const existing = await readMacOpsLock(input.cwd);
  await input.hooks?.afterInitialRead?.(existing);
  if (existing && !isMacOpsLockExpired(existing, now)) {
    return { outcome: "LOCK_ALREADY_HELD", record: existing };
  }

  for (let attempt = 0; attempt < RECOVERY_GUARD_RETRY; attempt++) {
    const recovered = await recoverStaleMainLock({
      cwd: input.cwd,
      filePath,
      record,
      now,
      hooks: input.hooks,
    });
    if (recovered) return recovered;

    const latest = await readMacOpsLock(input.cwd);
    if (latest && !isMacOpsLockExpired(latest, now)) {
      return { outcome: "LOCK_ALREADY_HELD", record: latest };
    }
  }

  const raced = await readMacOpsLock(input.cwd);
  return { outcome: "LOCK_ALREADY_HELD", record: raced };
}

async function recoverStaleMainLock(input: {
  cwd: string;
  filePath: string;
  record: MacOpsLockRecord;
  now: Date;
  hooks?: MacOpsLockTestHooks;
}): Promise<{
  outcome: Extract<
    MacOpsLockOutcome,
    "LOCK_ALREADY_HELD" | "LOCK_STALE_RECOVERED"
  >;
  record: MacOpsLockRecord | null;
} | null> {
  const guard = await tryAcquireRecoveryGuard({
    cwd: input.cwd,
    now: input.now,
    hooks: input.hooks,
  });
  if (!guard.acquired) return null;

  try {
    await input.hooks?.afterRecoveryGuardAcquired?.();
    const latest = await readMacOpsLock(input.cwd);

    if (!latest) {
      await input.hooks?.beforeMainExclusiveCreate?.();
      if (await exclusiveCreateJson(input.filePath, input.record)) {
        return { outcome: "LOCK_STALE_RECOVERED", record: input.record };
      }
      const raced = await readMacOpsLock(input.cwd);
      return { outcome: "LOCK_ALREADY_HELD", record: raced };
    }

    if (!isMacOpsLockExpired(latest, input.now)) {
      return { outcome: "LOCK_ALREADY_HELD", record: latest };
    }

    await input.hooks?.beforeUnlinkStale?.(latest);
    await unlink(input.filePath).catch(() => undefined);
    await input.hooks?.afterUnlinkStale?.();
    await input.hooks?.beforeMainExclusiveCreate?.();
    if (await exclusiveCreateJson(input.filePath, input.record)) {
      return { outcome: "LOCK_STALE_RECOVERED", record: input.record };
    }
    const raced = await readMacOpsLock(input.cwd);
    return { outcome: "LOCK_ALREADY_HELD", record: raced };
  } finally {
    await guard.release();
  }
}

export async function refreshMacOpsLockLease(input: {
  cwd: string;
  runId: string;
  now?: Date;
  ttlMs?: number;
  hooks?: MacOpsLockTestHooks;
}): Promise<{
  outcome: MacOpsLeaseRefreshOutcome;
  record: MacOpsLockRecord | null;
}> {
  const now = input.now ?? new Date();
  const ttl = input.ttlMs ?? MAC_OPS_LOCK_TTL_MS;
  const filePath = macOpsLockPath(input.cwd);

  const existingBeforeGuard = await readMacOpsLock(input.cwd);
  if (!existingBeforeGuard) {
    return { outcome: "LEASE_MISSING", record: null };
  }

  const guard = await tryAcquireRecoveryGuard({
    cwd: input.cwd,
    now,
    hooks: input.hooks,
  });
  if (!guard.acquired) {
    const latest = await readMacOpsLock(input.cwd);
    if (!latest) return { outcome: "LEASE_MISSING", record: null };
    return { outcome: "LEASE_SERIALIZATION_BUSY", record: latest };
  }

  try {
    await input.hooks?.afterRecoveryGuardAcquired?.();
    const latest = await readMacOpsLock(input.cwd);
    if (!latest) {
      return { outcome: "LEASE_MISSING", record: null };
    }
    if (latest.runId !== input.runId || latest.pid !== process.pid) {
      return { outcome: "LEASE_NOT_OWNER", record: latest };
    }
    const refreshed: MacOpsLockRecord = {
      ...latest,
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
    };
    await input.hooks?.beforeLeaseRefreshWrite?.(refreshed);
    await overwriteJson(filePath, refreshed);
    return { outcome: "LEASE_REFRESHED", record: refreshed };
  } finally {
    await guard.release();
  }
}

export function startMacOpsLockHeartbeat(input: {
  cwd: string;
  runId: string;
  ttlMs?: number;
  intervalMs?: number;
  now?: () => Date;
  hooks?: MacOpsLockTestHooks;
}): { stop: () => void } {
  const intervalMs = input.intervalMs ?? MAC_OPS_LOCK_HEARTBEAT_INTERVAL_MS;
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    void refreshMacOpsLockLease({
      cwd: input.cwd,
      runId: input.runId,
      now: input.now?.() ?? new Date(),
      ttlMs: input.ttlMs,
      hooks: input.hooks,
    });
  }, intervalMs);
  timer.unref?.();
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
  };
}

export async function releaseMacOpsLock(input: {
  cwd: string;
  runId: string;
  now?: Date;
  hooks?: MacOpsLockTestHooks;
}): Promise<MacOpsLockOutcome> {
  const now = input.now ?? new Date();
  const filePath = macOpsLockPath(input.cwd);

  const guard = await tryAcquireRecoveryGuard({
    cwd: input.cwd,
    now,
    hooks: input.hooks,
  });
  if (!guard.acquired) {
    return "LOCK_SERIALIZATION_BUSY";
  }
  try {
    await input.hooks?.afterRecoveryGuardAcquired?.();
    const existing = await readMacOpsLock(input.cwd);
    if (!existing) return "LOCK_AVAILABLE";
    if (existing.runId !== input.runId || existing.pid !== process.pid) {
      return "LOCK_HELD";
    }
    await unlink(filePath).catch(() => undefined);
    return "LOCK_RELEASED";
  } finally {
    await guard.release();
  }
}
