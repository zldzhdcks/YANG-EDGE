/**
 * Per-game stage locks with TTL. Never permanent solely because file exists.
 */

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_LOCK_TTL_MS } from "./windows";
import type { LockRecord, PregameSchedulerStage, SchedulerLeague } from "./types";

export function lockFilePath(input: {
  cwd: string;
  league: SchedulerLeague;
  dateKst: string;
  gameId: string;
}): string {
  const safeId = input.gameId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(
    input.cwd,
    "data",
    "scheduler",
    "locks",
    input.league.toLowerCase(),
    input.dateKst,
    `${safeId}.json`,
  );
}

async function writeAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

export type AcquireLockResult =
  | { ok: true; record: LockRecord }
  | {
      ok: false;
      reason: "SKIPPED_DUPLICATE_RUN";
      existing: LockRecord;
      staleWarning?: string;
    };

export async function readLock(
  filePath: string,
): Promise<LockRecord | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as LockRecord;
  } catch {
    return null;
  }
}

export function isLockExpired(record: LockRecord, now: Date): boolean {
  const exp = Date.parse(record.expiresAt);
  return Number.isNaN(exp) || now.getTime() >= exp;
}

export async function acquireLock(input: {
  cwd: string;
  league: SchedulerLeague;
  dateKst: string;
  gameId: string;
  stage: PregameSchedulerStage;
  lockKey: string;
  schedulerRunId: string;
  now?: Date;
  ttlMs?: number;
}): Promise<AcquireLockResult> {
  const now = input.now ?? new Date();
  const filePath = lockFilePath(input);
  const existing = await readLock(filePath);
  let staleWarning: string | undefined;

  if (existing && existing.status === "RUNNING") {
    if (!isLockExpired(existing, now)) {
      if (
        existing.lockKey === input.lockKey ||
        (existing.gameId === input.gameId && existing.stage === input.stage)
      ) {
        return {
          ok: false,
          reason: "SKIPPED_DUPLICATE_RUN",
          existing,
        };
      }
      // Different stage still RUNNING on same game file — treat as conflict
      return {
        ok: false,
        reason: "SKIPPED_DUPLICATE_RUN",
        existing,
      };
    }
    staleWarning = `STALE_LOCK_EXPIRED: ${existing.lockKey} expiredAt=${existing.expiresAt}`;
  }

  const ttl =
    input.ttlMs ??
    DEFAULT_LOCK_TTL_MS[input.stage] ??
    10 * 60_000;
  const record: LockRecord = {
    lockKey: input.lockKey,
    schedulerRunId: input.schedulerRunId,
    processId: process.pid,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
    stage: input.stage,
    status: "RUNNING",
    league: input.league,
    dateKst: input.dateKst,
    gameId: input.gameId,
  };
  await writeAtomic(filePath, record);
  if (staleWarning) {
    return { ok: true, record };
  }
  return { ok: true, record };
}

/** In-memory lock for dry-run / unit tests. */
export class MemoryLockStore {
  private locks = new Map<string, LockRecord>();

  acquire(input: {
    lockKey: string;
    league: SchedulerLeague;
    dateKst: string;
    gameId: string;
    stage: PregameSchedulerStage;
    schedulerRunId: string;
    now?: Date;
    ttlMs?: number;
  }): AcquireLockResult {
    const now = input.now ?? new Date();
    const mapKey = `${input.league}:${input.dateKst}:${input.gameId}`;
    const existing = this.locks.get(mapKey);
    if (existing && !isLockExpired(existing, now)) {
      if (
        existing.lockKey === input.lockKey ||
        existing.stage === input.stage
      ) {
        return {
          ok: false,
          reason: "SKIPPED_DUPLICATE_RUN",
          existing,
        };
      }
      return {
        ok: false,
        reason: "SKIPPED_DUPLICATE_RUN",
        existing,
      };
    }
    const ttl = input.ttlMs ?? DEFAULT_LOCK_TTL_MS[input.stage] ?? 10 * 60_000;
    const record: LockRecord = {
      lockKey: input.lockKey,
      schedulerRunId: input.schedulerRunId,
      processId: process.pid,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
      stage: input.stage,
      status: "RUNNING",
      league: input.league,
      dateKst: input.dateKst,
      gameId: input.gameId,
    };
    this.locks.set(mapKey, record);
    const staleWarning =
      existing && isLockExpired(existing, now)
        ? `STALE_LOCK_EXPIRED: ${existing.lockKey}`
        : undefined;
    if (staleWarning) {
      return { ok: true, record };
    }
    return { ok: true, record };
  }

  release(league: SchedulerLeague, dateKst: string, gameId: string): void {
    this.locks.delete(`${league}:${dateKst}:${gameId}`);
  }
}

export async function releaseLock(input: {
  cwd: string;
  league: SchedulerLeague;
  dateKst: string;
  gameId: string;
}): Promise<void> {
  const filePath = lockFilePath(input);
  try {
    await unlink(filePath);
  } catch {
    // ignore missing
  }
}
