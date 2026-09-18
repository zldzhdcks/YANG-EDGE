import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";
import {
  MAC_OPS_LOCK_REL,
  MAC_OPS_LOCK_TTL_MS,
  MAC_OPS_NODE_VERSION,
  type MacOpsLockOutcome,
  type MacOpsLockRecord,
} from "./types";

export function macOpsLockPath(cwd: string): string {
  return path.join(cwd, MAC_OPS_LOCK_REL);
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

export function isMacOpsLockExpired(
  record: MacOpsLockRecord,
  now: Date,
): boolean {
  const exp = Date.parse(record.expiresAt);
  return !Number.isFinite(exp) || now.getTime() >= exp;
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

  const record: MacOpsLockRecord = {
    version: MAC_OPS_NODE_VERSION,
    pid: process.pid,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    runId: input.runId,
    hostname: hostname(),
  };

  const tryExclusive = async (): Promise<boolean> => {
    try {
      const fh = await open(filePath, "wx");
      await fh.writeFile(`${JSON.stringify(record, null, 2)}\n`, "utf8");
      await fh.close();
      return true;
    } catch {
      return false;
    }
  };

  if (await tryExclusive()) {
    return { outcome: "LOCK_ACQUIRED", record };
  }

  const existing = await readMacOpsLock(input.cwd);
  if (existing && !isMacOpsLockExpired(existing, now)) {
    return { outcome: "LOCK_ALREADY_HELD", record: existing };
  }

  await unlink(filePath).catch(() => undefined);
  if (await tryExclusive()) {
    return { outcome: "LOCK_STALE_RECOVERED", record };
  }
  const raced = await readMacOpsLock(input.cwd);
  return { outcome: "LOCK_ALREADY_HELD", record: raced };
}

export async function releaseMacOpsLock(input: {
  cwd: string;
  runId: string;
}): Promise<MacOpsLockOutcome> {
  const existing = await readMacOpsLock(input.cwd);
  if (!existing) return "LOCK_AVAILABLE";
  if (existing.runId !== input.runId || existing.pid !== process.pid) {
    return "LOCK_HELD";
  }
  await unlink(macOpsLockPath(input.cwd)).catch(() => undefined);
  return "LOCK_RELEASED";
}
