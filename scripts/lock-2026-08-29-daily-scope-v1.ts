/**
 * 2026-08-29 Daily Scope Lock — FINAL SEAL after cross-date correction.
 *
 *   npx tsx --env-file=.env.local scripts/lock-2026-08-29-daily-scope-v1.ts
 *
 * Official denominator is target-date Scope only.
 * Cross-date observations remain in structured evidence and are excluded here.
 * No Prediction / Engine / Result.
 * Does not call providers when schedule artifacts already exist.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { footballScheduleV1Rel } from "../src/lib/football/core/paths";
import { mlbScheduleArtifactRel } from "../src/lib/mlb/build-mlb-schedule-artifact";
import {
  DATE_KST,
  FORMAL_OBSERVED_AT,
  RECOVERY_AUDIT_REL,
  REQUIRED_BASE_COMMIT,
  SEALED_2026_08_28,
  STRUCTURED_REL,
} from "./intake-2026-08-29-batch-2130-operator-pregame-observations";
import {
  FROZEN_FORMAL_OBSERVED_AT,
  OPERATOR_REVIEW_ITEMS,
  SLATE_RECOVERY_REL,
  runSlateRecovery,
} from "./audit-2026-08-29-scope-slate-recovery-v1";
import { FIXTURES_CAPTURE_REL } from "./capture-2026-08-29-football-fixtures-v1";

export const LOCK_REL = "data/audits/2026-08-29-daily-scope-lock-v1.json";
export const LOCK_STATUS = "LOCKED";
export const SCOPE_LOCK_STATUS = "COMPLETE";
export const SOURCE_OBS_REL = STRUCTURED_REL;
export { DATE_KST, FROZEN_FORMAL_OBSERVED_AT };

export function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

type ObservedRow = {
  sport: string;
  displayedStartKst: string;
  displayedDateKst?: string;
  rawHomeLabel: string;
  rawAwayLabel: string;
  rawLeagueLabel: string;
  teamLabelStatus?: string;
  identityStatus?: string;
  scheduleJoinStatus?: string;
  scopeAccountingState?: string;
  scopeMembership?: string;
  pregameEligibilityStatus?: string;
  scheduledStartAt?: string | null;
  gamePk?: number | null;
  markets: Array<{ rowIds: number[] }>;
};

function marketIds(row: ObservedRow): number[] {
  return row.markets.flatMap((m) => m.rowIds);
}

function footballByLeague(rows: ObservedRow[]) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.rawLeagueLabel] = (out[row.rawLeagueLabel] ?? 0) + 1;
  }
  return out;
}

export async function lockDailyScopeCandidate(cwd = process.cwd()) {
  if (FORMAL_OBSERVED_AT !== FROZEN_FORMAL_OBSERVED_AT) {
    throw new Error("FORMAL_OBSERVED_AT_MUTATED");
  }
  for (const sealed of SEALED_2026_08_28) {
    const sha = sha256File(path.join(cwd, sealed.rel));
    if (sha !== sealed.sha256) {
      throw new Error(`SEALED_2026_08_28_MUTATED: ${sealed.rel}`);
    }
  }

  const recovery = await runSlateRecovery(cwd);
  const slate = recovery.slate as {
    scopeLockReady?: boolean;
    status?: string;
    fuzzyMatchingUsed?: boolean;
    predictionCreated?: number;
    predictionCalls?: number;
    resultCalls?: number;
    engineCalls?: number;
    providerCallCount?: number;
    providerCalls?: Array<{ callCountThisRun?: number }>;
    bySport?: {
      FOOTBALL?: { matched?: number; unresolved?: number };
      MLB?: { matched?: number; unresolved?: number };
      BASKETBALL?: { matched?: number; operatorObserved?: number };
    };
    scopeAccounting?: {
      scopeTotal?: number;
      accountedFor?: number;
      scheduleMatched?: number;
      providerUnsupported?: number;
      identityReviewRequired?: number;
      competitionReviewRequired?: number;
      excludedCrossDate?: number;
    };
    officialScopeTotal?: number;
    excludedCrossDateCount?: number;
    operatorOwnerExplicitConfirmation?: number;
    pregameEligibleObservedMatchups?: number;
    postStartObservedMatchups?: number;
    pregameEligibilityUnresolved?: number;
    statusReason?: string;
  };
  if (slate.scopeLockReady !== true) {
    throw new Error("SCOPE_LOCK_CANDIDATE_NOT_READY");
  }
  if (slate.fuzzyMatchingUsed === true) {
    throw new Error("FUZZY_MATCHING_FORBIDDEN");
  }

  const obsAbs = path.join(cwd, STRUCTURED_REL);
  const slateAbs = path.join(cwd, SLATE_RECOVERY_REL);
  const recoveryAbs = path.join(cwd, RECOVERY_AUDIT_REL);
  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    slateDateKst?: string;
    formalObservedAt?: string;
    researchOnly?: boolean;
    predictionInput?: boolean;
    engineInput?: boolean;
    marketBenchmarkOnly?: boolean;
    footballOddsFixtures: ObservedRow[];
    basketballOddsFixtures: ObservedRow[];
    mlbOddsGames: ObservedRow[];
  };
  if (obs.slateDateKst !== DATE_KST) {
    throw new Error(`SOURCE_DATE_MISMATCH: ${obs.slateDateKst}`);
  }
  if (obs.formalObservedAt !== FROZEN_FORMAL_OBSERVED_AT) {
    throw new Error("FORMAL_OBSERVED_AT_MUTATED");
  }
  if (obs.researchOnly !== true) throw new Error("RESEARCH_ONLY_REQUIRED");
  if (obs.predictionInput !== false) throw new Error("PREDICTION_INPUT_MUST_BE_FALSE");
  if (obs.engineInput !== false) throw new Error("ENGINE_INPUT_MUST_BE_FALSE");
  if (obs.marketBenchmarkOnly !== true) {
    throw new Error("MARKET_BENCHMARK_ONLY_REQUIRED");
  }

  const rows = [
    ...obs.mlbOddsGames,
    ...obs.footballOddsFixtures,
    ...obs.basketballOddsFixtures,
  ];
  const observedBatchCount = rows.length;
  const officialRows = rows.filter(
    (r) => r.scopeMembership === "IN_TARGET_DATE_SCOPE",
  );
  const excludedRows = rows.filter(
    (r) => r.scopeMembership === "EXCLUDED_NON_TARGET_DATE",
  );
  const footballOfficial = obs.footballOddsFixtures.filter(
    (r) => r.scopeMembership === "IN_TARGET_DATE_SCOPE",
  );
  const basketballOfficial = obs.basketballOddsFixtures.filter(
    (r) => r.scopeMembership === "IN_TARGET_DATE_SCOPE",
  );
  const mlbOfficial = obs.mlbOddsGames.filter(
    (r) => r.scopeMembership === "IN_TARGET_DATE_SCOPE",
  );
  const footballCount = footballOfficial.length;
  const basketballCount = basketballOfficial.length;
  const mlbCount = mlbOfficial.length;
  const scopeTotal = officialRows.length;
  if (scopeTotal < 1) throw new Error("SCOPE_TOTAL_EMPTY");
  if (officialRows.length + excludedRows.length !== observedBatchCount) {
    throw new Error("SCOPE_MEMBERSHIP_DOES_NOT_COVER_OBSERVED_BATCH");
  }

  const accountedStates = officialRows.map((r) => r.scopeAccountingState ?? "");
  if (accountedStates.some((s) => !s)) {
    throw new Error("SCOPE_ACCOUNTING_STATE_MISSING");
  }
  const accountedFor = accountedStates.length;
  if (accountedFor !== scopeTotal) {
    throw new Error("ACCOUNTED_FOR_MISMATCH");
  }
  const keys = rows.map(
    (r) =>
      `${r.sport}|${r.displayedDateKst ?? ""}|${r.displayedStartKst}|${r.rawHomeLabel}|${r.rawAwayLabel}|${marketIds(r).join(",")}`,
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error("DUPLICATE_DENOMINATOR");
  }

  for (const row of excludedRows) {
    if (row.displayedDateKst === DATE_KST) {
      throw new Error("EXCLUDED_ROW_HAS_TARGET_DATE");
    }
    if (row.scopeAccountingState !== "EXCLUDED_NON_TARGET_DATE") {
      throw new Error("CROSS_DATE_NOT_EXCLUDED");
    }
  }

  for (const row of obs.basketballOddsFixtures) {
    if (row.scopeMembership === "EXCLUDED_NON_TARGET_DATE") {
      if (row.scopeAccountingState !== "EXCLUDED_NON_TARGET_DATE") {
        throw new Error("CROSS_DATE_BASKETBALL_NOT_EXCLUDED");
      }
      continue;
    }
    if (row.scopeAccountingState !== "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED") {
      throw new Error("BASKETBALL_NOT_PROVIDER_UNSUPPORTED");
    }
    if (row.identityStatus === "MATCHED") {
      throw new Error("BASKETBALL_SCHEDULE_MATCH_FABRICATED");
    }
    if (row.pregameEligibilityStatus === "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE") {
      throw new Error("BASKETBALL_PREGAME_WITHOUT_AUTHORITATIVE_START");
    }
    if (row.rawHomeLabel === "FIELD_REVIEW_REQUIRED") {
      throw new Error("FIELD_REVIEW_REQUIRED_TEAM_LABEL");
    }
  }

  const scheduleMatched = officialRows.filter(
    (r) => r.scopeAccountingState === "SCHEDULE_MATCHED",
  ).length;
  const providerUnsupported = officialRows.filter(
    (r) => r.scopeAccountingState === "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED",
  ).length;
  const identityReview = officialRows.filter(
    (r) => r.scopeAccountingState === "IDENTITY_REVIEW_REQUIRED",
  ).length;
  const competitionReview = officialRows.filter(
    (r) => r.scopeAccountingState === "COMPETITION_REVIEW_REQUIRED",
  ).length;
  if (
    scheduleMatched + providerUnsupported + identityReview + competitionReview !==
    scopeTotal
  ) {
    throw new Error("ACCOUNTING_STATES_DO_NOT_COVER_SCOPE");
  }

  const sourceOperatorObservationHash = sha256File(obsAbs);
  const mlbScheduleRel = mlbScheduleArtifactRel(DATE_KST);
  const footballScheduleRel = footballScheduleV1Rel(DATE_KST);
  const lockAbsPreview = path.join(cwd, LOCK_REL);
  let scopeLockedAt = new Date().toISOString();
  let ownerSealedAt = scopeLockedAt;
  if (existsSync(lockAbsPreview)) {
    const existing = JSON.parse(readFileSync(lockAbsPreview, "utf8")) as {
      lockStatus?: string;
      scopeLockStatus?: string;
      scopeLockedAt?: string;
      ownerSealedAt?: string | null;
    };
    if (
      existing.lockStatus === LOCK_STATUS &&
      existing.scopeLockStatus === SCOPE_LOCK_STATUS &&
      existing.scopeLockedAt &&
      existing.ownerSealedAt
    ) {
      scopeLockedAt = existing.scopeLockedAt;
      ownerSealedAt = existing.ownerSealedAt;
    }
  }
  const networkCallsThisRun = (slate.providerCalls ?? []).reduce(
    (n, c) => n + (c.callCountThisRun ?? 0),
    0,
  );

  const nextSlate = {
    ...JSON.parse(readFileSync(slateAbs, "utf8")),
    dailyScopeLockCreated: true,
    dailyScopeLockRel: LOCK_REL,
    dailyScopeLockStatus: SCOPE_LOCK_STATUS,
    status: "SCOPE_LOCK_COMPLETE",
  };
  await writeFile(slateAbs, `${JSON.stringify(nextSlate, null, 2)}\n`, "utf8");

  const nextCurrent = {
    ...JSON.parse(readFileSync(recoveryAbs, "utf8")),
    dailyScopeLocked: true,
    dailyScopeLockCandidateCreated: true,
    dailyScopeLockRel: LOCK_REL,
    dailyScopeLockStatus: SCOPE_LOCK_STATUS,
    status: "SCOPE_LOCK_COMPLETE",
    nextRecommendedStep: "B1 schedule/identity on sealed 2026-08-29 Scope.",
  };
  await writeFile(
    recoveryAbs,
    `${JSON.stringify(nextCurrent, null, 2)}\n`,
    "utf8",
  );

  const scheduleRecoveryHash = sha256File(slateAbs);
  const currentStateHash = sha256File(recoveryAbs);

  const lock = {
    schemaVersion: "yang-edge-daily-scope-lock-v1",
    dateKst: DATE_KST,
    lockStatus: LOCK_STATUS,
    scopeLockStatus: SCOPE_LOCK_STATUS,
    scopeStatus: SCOPE_LOCK_STATUS,
    scopeLockedAt,
    ownerSealedAt,
    creditSeal: false,
    researchOnly: true,
    marketBenchmarkOnly: true,
    prediction: "NONE",
    engine: "NONE",
    recommendation: "NONE",
    predictionInput: false,
    engineInput: false,
    engineAdmission: "PROHIBITED",
    predictionCreated: 0,
    predictionCalls: 0,
    resultCalls: 0,
    engineModified: false,
    weightsModified: false,
    fuzzyMatchingUsed: false,
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    formalObservedAtChanged: false,
    baseCommit: REQUIRED_BASE_COMMIT,
    sourceOperatorObservationRel: SOURCE_OBS_REL,
    sourceOperatorObservationHash,
    scheduleRecoveryRel: SLATE_RECOVERY_REL,
    scheduleRecoveryHash,
    currentStateRecoveryRel: RECOVERY_AUDIT_REL,
    currentStateRecoveryHash: currentStateHash,
    scheduleArtifacts: {
      mlb: mlbScheduleRel,
      mlbSha256: existsSync(path.join(cwd, mlbScheduleRel))
        ? sha256File(path.join(cwd, mlbScheduleRel))
        : null,
      footballCapture: FIXTURES_CAPTURE_REL,
      footballCaptureSha256: existsSync(path.join(cwd, FIXTURES_CAPTURE_REL))
        ? sha256File(path.join(cwd, FIXTURES_CAPTURE_REL))
        : null,
      footballSchedule: footballScheduleRel,
      footballScheduleSha256: existsSync(path.join(cwd, footballScheduleRel))
        ? sha256File(path.join(cwd, footballScheduleRel))
        : null,
      basketball: null,
    },
    sports: ["FOOTBALL", "BASKETBALL", "MLB"],
    observedBatchCount,
    officialTargetDateScopeCount: scopeTotal,
    observedScope: {
      FOOTBALL: footballCount,
      BASKETBALL: basketballCount,
      MLB: mlbCount,
      footballByLeague: footballByLeague(footballOfficial),
      basketballObservedBatch: obs.basketballOddsFixtures.length,
      total: scopeTotal,
    },
    officialDenominator: scopeTotal,
    scopeTotal,
    accountedFor,
    rowsAccountedFor: accountedFor,
    supportedScheduleMatchedCount: scheduleMatched,
    providerUnsupportedCount: providerUnsupported,
    identityReviewCount: identityReview,
    competitionReviewCount: competitionReview,
    ownerConfirmedCount: 0,
    bySportReconciliation: {
      FOOTBALL: {
        observed: footballCount,
        scheduleMatched: obs.footballOddsFixtures.filter(
          (r) => r.scopeAccountingState === "SCHEDULE_MATCHED",
        ).length,
        identityReviewRequired: obs.footballOddsFixtures.filter(
          (r) => r.scopeAccountingState === "IDENTITY_REVIEW_REQUIRED",
        ).length,
        competitionReviewRequired: obs.footballOddsFixtures.filter(
          (r) => r.scopeAccountingState === "COMPETITION_REVIEW_REQUIRED",
        ).length,
        pregameEligible: obs.footballOddsFixtures.filter(
          (r) =>
            r.pregameEligibilityStatus ===
            "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE",
        ).length,
      },
      MLB: {
        observed: mlbCount,
        scheduleMatched: mlbOfficial.filter(
          (r) => r.scopeAccountingState === "SCHEDULE_MATCHED",
        ).length,
        unresolved: mlbOfficial.filter(
          (r) => r.identityStatus !== "MATCHED",
        ).length,
        pregameEligible: mlbOfficial.filter(
          (r) =>
            r.pregameEligibilityStatus ===
            "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE",
        ).length,
      },
      BASKETBALL: {
        observed: basketballCount,
        observedBatch: obs.basketballOddsFixtures.length,
        scheduleMatched: 0,
        providerUnsupported: basketballCount,
        ownerConfirmed: 0,
        pregameEligible: 0,
        pregameEligibilityUnresolved: basketballCount,
        droppedFromDenominator: 0,
        excludedCrossDateCount: excludedRows.length,
        offDateDisplayedMatchups: excludedRows.length,
      },
    },
    excludedCrossDateCount: excludedRows.length,
    excludedCrossDateRows: excludedRows.map((r) => ({
      displayedDateKst: r.displayedDateKst,
      displayedStartKst: r.displayedStartKst,
      rawMatchup: `${r.rawHomeLabel} : ${r.rawAwayLabel}`,
      rawHomeLabel: r.rawHomeLabel,
      rawAwayLabel: r.rawAwayLabel,
      sport: r.sport,
      marketIds: marketIds(r),
      scopeMembership: r.scopeMembership,
      scopeAccountingState: r.scopeAccountingState,
    })),
    operatorReviewItems: OPERATOR_REVIEW_ITEMS,
    pregameEligibleObservedMatchups: slate.pregameEligibleObservedMatchups,
    postStartObservedMatchups: slate.postStartObservedMatchups,
    pregameEligibilityUnresolved: slate.pregameEligibilityUnresolved,
    providerCallCount: slate.providerCallCount,
    providerCallsThisRun: networkCallsThisRun,
    previousCalendarDateVisibleInDenominator: 0,
    previousCalendarDateVisibleExcludedFromDenominator: excludedRows.length,
    nextCalendarDateVisibleExcludedFromDenominator: 0,
    scopeShrinkAfterLockForbidden: true,
    note: "FINAL SEAL. Official 2026-08-29 Daily Scope denominator is target-date rows only. One 08.28 leftover basketball matchup (요르단M : 필리핀M, IDs 7121-7124) remains in structured operator observations with scopeMembership=EXCLUDED_NON_TARGET_DATE and is excluded from this denominator. Sealed 2026-08-28 artifacts were not reopened. Provider-unsupported target-date basketball rows remain in the official denominator. Football truncated/unregistered competition labels remain COMPETITION_REVIEW_REQUIRED. La Liga team aliases remain IDENTITY_REVIEW_REQUIRED. Not a Prediction input.",
    nextRecommendedStep: "B1 schedule/identity on sealed 2026-08-29 Scope.",
  };

  const lockAbs = path.join(cwd, LOCK_REL);
  await writeFile(lockAbs, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

  return {
    lock,
    lockSha256: sha256File(lockAbs),
    sourceOperatorObservationHash,
    scheduleRecoveryHash,
    currentStateRecoveryHash: currentStateHash,
  };
}

async function main() {
  const result = await lockDailyScopeCandidate();
  console.log(`wrote ${LOCK_REL}`);
  console.log(
    JSON.stringify(
      {
        scopeStatus: result.lock.scopeStatus,
        scopeTotal: result.lock.scopeTotal,
        accountedFor: result.lock.accountedFor,
        lockSha256: result.lockSha256,
      },
      null,
      2,
    ),
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
