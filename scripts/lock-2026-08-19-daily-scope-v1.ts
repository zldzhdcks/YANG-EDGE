/**
 * Lock 2026-08-19 Daily Mandatory operating scope BEFORE schedule providers.
 *
 *   npx tsx scripts/lock-2026-08-19-daily-scope-v1.ts
 *
 * Refuses to change scopeLockedAt if the lock already exists.
 * Does not call providers, builders, Engine, or Prediction.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const DATE_KST = "2026-08-19";
export const LOCK_REL = "data/audits/2026-08-19-daily-scope-lock-v1.json";
export const SOURCE_OBS_REL =
  "data/operator-observations/structured/2026-08-18/batch-2253-next-pregame-v0.json";
export const MLB_OBSERVED = 15;
export const FOOTBALL_OBSERVED = 6;
export const TOTAL_OBSERVED = 21;

export function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

export async function lockDailyScope(cwd = process.cwd()) {
  const lockAbs = path.join(cwd, LOCK_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);
  if (!existsSync(obsAbs)) {
    throw new Error(`SOURCE_OBSERVATION_MISSING: ${SOURCE_OBS_REL}`);
  }
  const sourceOperatorObservationHash = sha256File(obsAbs);
  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    slateDateKst?: string;
    summary?: {
      mlbOddsMatchups?: number;
      footballOddsFixtures?: number;
    };
  };
  if (obs.slateDateKst !== DATE_KST) {
    throw new Error(
      `SOURCE_DATE_MISMATCH: slateDateKst=${obs.slateDateKst} expected=${DATE_KST}`,
    );
  }
  if (obs.summary?.mlbOddsMatchups !== MLB_OBSERVED) {
    throw new Error(`MLB_OBSERVED_MISMATCH: ${obs.summary?.mlbOddsMatchups}`);
  }
  if (obs.summary?.footballOddsFixtures !== FOOTBALL_OBSERVED) {
    throw new Error(
      `FOOTBALL_OBSERVED_MISMATCH: ${obs.summary?.footballOddsFixtures}`,
    );
  }

  if (existsSync(lockAbs)) {
    const existing = JSON.parse(readFileSync(lockAbs, "utf8")) as {
      scopeLockedAt?: string;
      observedScope?: { MLB?: number; FOOTBALL?: number };
    };
    if (!existing.scopeLockedAt) {
      throw new Error("SCOPE_LOCK_MISSING_LOCKED_AT");
    }
    if (
      existing.observedScope?.MLB !== MLB_OBSERVED ||
      existing.observedScope?.FOOTBALL !== FOOTBALL_OBSERVED
    ) {
      throw new Error("SCOPE_SHRINK_AFTER_LOCK_FORBIDDEN");
    }
    return { wrote: false, lock: existing, sourceOperatorObservationHash };
  }

  const scopeLockedAt = new Date().toISOString();
  const lock = {
    schemaVersion: "yang-edge-daily-scope-lock-v1",
    dateKst: DATE_KST,
    scopeLockedAt,
    sourceOperatorObservationRel: SOURCE_OBS_REL,
    sourceOperatorObservationHash,
    sports: ["MLB", "FOOTBALL"] as const,
    observedScope: {
      MLB: MLB_OBSERVED,
      FOOTBALL: FOOTBALL_OBSERVED,
      total: TOTAL_OBSERVED,
    },
    scopeShrinkAfterLockForbidden: true,
    researchOnly: true,
    prediction: "NONE",
    engine: "NONE",
    recommendation: "NONE",
    predictionInput: false,
    note: "Daily operating scope locked from operator screenshot intake before schedule providers. Screenshot received date 2026-08-18 is not the operating date. This artifact is audit evidence, not a Prediction input.",
  };

  await mkdir(path.dirname(lockAbs), { recursive: true });
  await writeFile(lockAbs, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  return { wrote: true, lock, sourceOperatorObservationHash };
}

async function main() {
  const result = await lockDailyScope();
  console.log(
    result.wrote
      ? `wrote ${LOCK_REL} scopeLockedAt=${result.lock.scopeLockedAt}`
      : `exists ${LOCK_REL} scopeLockedAt unchanged`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
