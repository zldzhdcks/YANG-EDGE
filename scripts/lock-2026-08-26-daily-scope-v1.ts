/**
 * 2026-08-26 Daily Mandatory operating scope — sealed COMPLETE/LOCKED.
 *
 *   npx tsx scripts/lock-2026-08-26-daily-scope-v1.ts
 *
 * Refuses to change scopeLockedAt or shrink the denominator.
 * Does not call providers, builders, Engine, or Prediction.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  BASEBALL_OBSERVED,
  FOOTBALL_OBSERVED,
  KBO_OBSERVED,
  NPB_OBSERVED,
  SLATE_DATE_KST,
  STRUCTURED_REL,
  TOTAL_OBSERVED,
  VOLLEYBALL_OBSERVED,
} from "./intake-2026-08-26-batch-1047-operator-pregame-observations";

export const DATE_KST = SLATE_DATE_KST;
export const LOCK_REL = "data/audits/2026-08-26-daily-scope-lock-v1.json";
export const SOURCE_OBS_REL = STRUCTURED_REL;
export const FROZEN_SCOPE_LOCKED_AT = "2026-08-26T02:10:52.046Z";
export const FROZEN_OBS_HASH =
  "c2e84faeca92dd382b2d3130e69d04a0149fa17ce2b10e5082168225b614e346";
export const LOCK_STATUS = "LOCKED";
export const SCOPE_LOCK_STATUS = "COMPLETE";
export { VOLLEYBALL_OBSERVED, NPB_OBSERVED, KBO_OBSERVED, BASEBALL_OBSERVED };
export { FOOTBALL_OBSERVED, TOTAL_OBSERVED };

export function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

export async function lockDailyScope(cwd = process.cwd()) {
  const lockAbs = path.join(cwd, LOCK_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);
  if (!existsSync(obsAbs)) {
    throw new Error(`SOURCE_OBSERVATION_MISSING: ${SOURCE_OBS_REL}`);
  }
  if (!existsSync(lockAbs)) {
    throw new Error("SCOPE_LOCK_MISSING");
  }
  const sourceOperatorObservationHash = sha256File(obsAbs);
  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    slateDateKst?: string;
    researchOnly?: boolean;
    predictionInput?: boolean;
    summary?: {
      volleyballOddsFixtures?: number;
      npbOddsGames?: number;
      kboOddsGames?: number;
      footballOddsFixtures?: number;
    };
    nextCalendarDateVisibleFixtures?: unknown[];
    reviewRequired?: Array<{ gamesInventedFromGap?: number }>;
  };
  if (obs.slateDateKst !== DATE_KST) {
    throw new Error(
      `SOURCE_DATE_MISMATCH: slateDateKst=${obs.slateDateKst} expected=${DATE_KST}`,
    );
  }
  if (obs.summary?.volleyballOddsFixtures !== VOLLEYBALL_OBSERVED) {
    throw new Error(
      `VOLLEYBALL_OBSERVED_MISMATCH: ${obs.summary?.volleyballOddsFixtures}`,
    );
  }
  if (obs.summary?.npbOddsGames !== NPB_OBSERVED) {
    throw new Error(`NPB_OBSERVED_MISMATCH: ${obs.summary?.npbOddsGames}`);
  }
  if (obs.summary?.kboOddsGames !== KBO_OBSERVED) {
    throw new Error(`KBO_OBSERVED_MISMATCH: ${obs.summary?.kboOddsGames}`);
  }
  if (obs.summary?.footballOddsFixtures !== FOOTBALL_OBSERVED) {
    throw new Error(
      `FOOTBALL_OBSERVED_MISMATCH: ${obs.summary?.footballOddsFixtures}`,
    );
  }
  if (obs.researchOnly !== true) {
    throw new Error("RESEARCH_ONLY_REQUIRED");
  }
  if (obs.predictionInput !== false) {
    throw new Error("PREDICTION_INPUT_MUST_BE_FALSE");
  }
  if (sourceOperatorObservationHash !== FROZEN_OBS_HASH) {
    throw new Error("SOURCE_OBSERVATION_HASH_CHANGED");
  }

  const existing = JSON.parse(readFileSync(lockAbs, "utf8")) as {
    lockStatus?: string;
    scopeLockStatus?: string;
    scopeLockedAt?: string;
    sourceOperatorObservationHash?: string;
    officialDenominator?: number;
    observedScope?: {
      total?: number;
      VOLLEYBALL?: number;
      BASEBALL?: number;
      FOOTBALL?: number;
      MLB?: number;
    };
    nextCalendarDateVisibleExcludedFromDenominator?: number;
    marketIdGap6647_6655?: {
      status?: string;
      numericContinuityRequired?: boolean;
      gamesInferredFromGap?: number;
    };
    scopeShrinkAfterLockForbidden?: boolean;
    researchOnly?: boolean;
    predictionInput?: boolean;
  };
  if (existing.scopeLockedAt !== FROZEN_SCOPE_LOCKED_AT) {
    throw new Error("SCOPE_LOCKED_AT_MUTATION_FORBIDDEN");
  }
  if (
    existing.lockStatus !== LOCK_STATUS ||
    existing.scopeLockStatus !== SCOPE_LOCK_STATUS
  ) {
    throw new Error("SCOPE_LOCK_NOT_COMPLETE");
  }
  if (existing.sourceOperatorObservationHash !== FROZEN_OBS_HASH) {
    throw new Error("LOCK_OBSERVATION_HASH_MISMATCH");
  }
  if (
    existing.observedScope?.total !== TOTAL_OBSERVED ||
    existing.officialDenominator !== TOTAL_OBSERVED ||
    existing.observedScope?.VOLLEYBALL !== VOLLEYBALL_OBSERVED ||
    existing.observedScope?.BASEBALL !== BASEBALL_OBSERVED ||
    existing.observedScope?.FOOTBALL !== FOOTBALL_OBSERVED ||
    existing.observedScope?.MLB !== 0
  ) {
    throw new Error("SCOPE_SHRINK_AFTER_LOCK_FORBIDDEN");
  }
  if (existing.nextCalendarDateVisibleExcludedFromDenominator !== 9) {
    throw new Error("NEXT_DATE_MUST_STAY_OUTSIDE_DENOMINATOR");
  }
  if (
    existing.marketIdGap6647_6655?.status !==
      "RESOLVED_BY_OWNER_CLARIFICATION" ||
    existing.marketIdGap6647_6655?.numericContinuityRequired !== false ||
    existing.marketIdGap6647_6655?.gamesInferredFromGap !== 0
  ) {
    throw new Error("MARKET_ID_GAP_NOT_OWNER_RESOLVED");
  }
  if (existing.scopeShrinkAfterLockForbidden !== true) {
    throw new Error("SCOPE_SHRINK_FLAG_REQUIRED");
  }
  if (existing.researchOnly !== true || existing.predictionInput !== false) {
    throw new Error("RESEARCH_ONLY_PREDICTION_INPUT_REQUIRED");
  }
  if ((obs.reviewRequired?.[0]?.gamesInventedFromGap ?? 1) !== 0) {
    throw new Error("GAP_MUST_NOT_INVENT_GAMES");
  }

  return { wrote: false, lock: existing, sourceOperatorObservationHash };
}

async function main() {
  const result = await lockDailyScope();
  console.log(
    `sealed ${LOCK_REL} lockStatus=${String(result.lock.lockStatus)} scopeLockedAt=${String(result.lock.scopeLockedAt)} wrote=${result.wrote}`,
  );
}

const isDirectRun =
  !!process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
