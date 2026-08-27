/**
 * 2026-08-28 Daily Scope Lock CANDIDATE.
 *
 *   npx tsx --env-file=.env.local scripts/lock-2026-08-28-daily-scope-v1.ts
 *
 * Candidate only. No FINAL SEAL. No Prediction / Engine / Result.
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
  SEALED_2026_08_26,
  STRUCTURED_REL,
} from "./intake-2026-08-28-batch-2228-operator-pregame-observations";
import {
  FROZEN_FORMAL_OBSERVED_AT,
  OPERATOR_REVIEW_ITEMS,
  SLATE_RECOVERY_REL,
  runSlateRecovery,
} from "./audit-2026-08-28-scope-slate-recovery-v1";
import { FIXTURES_CAPTURE_REL } from "./capture-2026-08-28-football-fixtures-v1";

export const LOCK_REL = "data/audits/2026-08-28-daily-scope-lock-v1.json";
export const LOCK_STATUS = "CANDIDATE";
export const SCOPE_LOCK_STATUS = "CANDIDATE_COMPLETE";
export const SOURCE_OBS_REL = STRUCTURED_REL;
export { DATE_KST, FROZEN_FORMAL_OBSERVED_AT };

export function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

type ObservedRow = {
  sport: string;
  displayedStartKst: string;
  rawHomeLabel: string;
  rawAwayLabel: string;
  rawLeagueLabel: string;
  teamLabelStatus?: string;
  identityStatus?: string;
  scheduleJoinStatus?: string;
  scopeAccountingState?: string;
  pregameEligibilityStatus?: string;
  scheduledStartAt?: string | null;
  gamePk?: number | null;
  markets: Array<{ rowIds: number[] }>;
};

function marketIds(row: ObservedRow): number[] {
  return row.markets.flatMap((m) => m.rowIds);
}

export async function lockDailyScopeCandidate(cwd = process.cwd()) {
  if (FORMAL_OBSERVED_AT !== FROZEN_FORMAL_OBSERVED_AT) {
    throw new Error("FORMAL_OBSERVED_AT_MUTATED");
  }
  for (const sealed of SEALED_2026_08_26) {
    const sha = sha256File(path.join(cwd, sealed.rel));
    if (sha !== sealed.sha256) {
      throw new Error(`SEALED_2026_08_26_MUTATED: ${sealed.rel}`);
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
    };
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
    summary?: {
      basketballOddsFixtures?: number;
      footballOddsFixtures?: number;
      mlbOddsMatchups?: number;
    };
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
  const footballCount = obs.footballOddsFixtures.length;
  const basketballCount = obs.basketballOddsFixtures.length;
  const mlbCount = obs.mlbOddsGames.length;
  const scopeTotal = rows.length;
  if (scopeTotal !== 36) throw new Error(`SCOPE_TOTAL_NOT_36:${scopeTotal}`);
  if (footballCount !== 14) throw new Error(`FOOTBALL_COUNT:${footballCount}`);
  if (basketballCount !== 15) throw new Error(`BASKETBALL_COUNT:${basketballCount}`);
  if (mlbCount !== 7) throw new Error(`MLB_COUNT:${mlbCount}`);

  const accountedStates = rows.map((r) => r.scopeAccountingState ?? "");
  if (accountedStates.some((s) => !s)) {
    throw new Error("SCOPE_ACCOUNTING_STATE_MISSING");
  }
  const accountedFor = accountedStates.length;
  if (accountedFor !== scopeTotal) {
    throw new Error("ACCOUNTED_FOR_MISMATCH");
  }
  const keys = rows.map(
    (r) =>
      `${r.sport}|${r.displayedStartKst}|${r.rawHomeLabel}|${r.rawAwayLabel}|${marketIds(r).join(",")}`,
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error("DUPLICATE_DENOMINATOR");
  }

  const panama = obs.basketballOddsFixtures.find((r) =>
    marketIds(r).includes(7023),
  );
  const mexico = obs.basketballOddsFixtures.find((r) =>
    marketIds(r).includes(7019),
  );
  if (!panama || panama.rawHomeLabel !== "파나마" || panama.rawAwayLabel !== "캐나다") {
    throw new Error("PANAMA_CANADA_LABELS_NOT_OWNER_CONFIRMED");
  }
  if (
    !mexico ||
    mexico.rawHomeLabel !== "멕시코" ||
    mexico.rawAwayLabel !== "콜롬비아"
  ) {
    throw new Error("MEXICO_COLOMBIA_LABELS_NOT_OWNER_CONFIRMED");
  }
  if (
    panama.teamLabelStatus !== "OWNER_EXPLICIT_CONFIRMATION" ||
    mexico.teamLabelStatus !== "OWNER_EXPLICIT_CONFIRMATION"
  ) {
    throw new Error("OWNER_EXPLICIT_CONFIRMATION_MISSING");
  }
  for (const label of [
    panama.rawHomeLabel,
    panama.rawAwayLabel,
    mexico.rawHomeLabel,
    mexico.rawAwayLabel,
  ]) {
    if (label === "FIELD_REVIEW_REQUIRED") {
      throw new Error("FIELD_REVIEW_REQUIRED_REMAINS_ON_OWNER_LABELS");
    }
  }
  for (const row of obs.basketballOddsFixtures) {
    if (row.scopeAccountingState !== "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED") {
      throw new Error("BASKETBALL_NOT_PROVIDER_UNSUPPORTED");
    }
    if (row.identityStatus === "MATCHED") {
      throw new Error("BASKETBALL_SCHEDULE_MATCH_FABRICATED");
    }
    if (row.pregameEligibilityStatus === "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE") {
      throw new Error("BASKETBALL_PREGAME_WITHOUT_AUTHORITATIVE_START");
    }
  }

  const scheduleMatched = rows.filter(
    (r) => r.scopeAccountingState === "SCHEDULE_MATCHED",
  ).length;
  const providerUnsupported = rows.filter(
    (r) => r.scopeAccountingState === "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED",
  ).length;
  const identityReview = rows.filter(
    (r) => r.scopeAccountingState === "IDENTITY_REVIEW_REQUIRED",
  ).length;
  if (scheduleMatched + providerUnsupported + identityReview !== scopeTotal) {
    throw new Error("ACCOUNTING_STATES_DO_NOT_COVER_SCOPE");
  }

  const sourceOperatorObservationHash = sha256File(obsAbs);
  const mlbScheduleRel = mlbScheduleArtifactRel(DATE_KST);
  const footballScheduleRel = footballScheduleV1Rel(DATE_KST);
  const scopeLockedAt = new Date().toISOString();
  const networkCallsThisRun = (slate.providerCalls ?? []).reduce(
    (n, c) => n + (c.callCountThisRun ?? 0),
    0,
  );

  const nextSlate = {
    ...JSON.parse(readFileSync(slateAbs, "utf8")),
    dailyScopeLockCreated: true,
    dailyScopeLockRel: LOCK_REL,
    dailyScopeLockStatus: SCOPE_LOCK_STATUS,
    status: "SCOPE_LOCK_CANDIDATE_COMPLETE",
  };
  await writeFile(slateAbs, `${JSON.stringify(nextSlate, null, 2)}\n`, "utf8");

  const nextCurrent = {
    ...JSON.parse(readFileSync(recoveryAbs, "utf8")),
    dailyScopeLocked: false,
    dailyScopeLockCandidateCreated: true,
    dailyScopeLockRel: LOCK_REL,
    dailyScopeLockStatus: SCOPE_LOCK_STATUS,
    status: "SCOPE_LOCK_CANDIDATE_COMPLETE",
    nextRecommendedStep:
      "OWNER review then 2026-08-28 Scope FINAL SEAL, then B1. Do not start B1.",
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
    ownerSealedAt: null,
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
      mlbSha256: sha256File(path.join(cwd, mlbScheduleRel)),
      footballCapture: FIXTURES_CAPTURE_REL,
      footballCaptureSha256: sha256File(path.join(cwd, FIXTURES_CAPTURE_REL)),
      footballSchedule: footballScheduleRel,
      footballScheduleSha256: sha256File(path.join(cwd, footballScheduleRel)),
      basketball: null,
    },
    sports: ["FOOTBALL", "BASKETBALL", "MLB"],
    observedScope: {
      FOOTBALL: footballCount,
      BASKETBALL: basketballCount,
      MLB: mlbCount,
      footballByLeague: {
        UEL: obs.footballOddsFixtures.filter((r) => r.rawLeagueLabel === "UEL")
          .length,
        라리가: obs.footballOddsFixtures.filter(
          (r) => r.rawLeagueLabel === "라리가",
        ).length,
      },
      total: scopeTotal,
    },
    officialDenominator: scopeTotal,
    scopeTotal,
    accountedFor,
    rowsAccountedFor: accountedFor,
    supportedScheduleMatchedCount: scheduleMatched,
    providerUnsupportedCount: providerUnsupported,
    identityReviewCount: identityReview,
    ownerConfirmedCount: OPERATOR_REVIEW_ITEMS.filter(
      (i) => i.reviewState === "OWNER_EXPLICIT_CONFIRMATION",
    ).length,
    bySportReconciliation: {
      FOOTBALL: {
        observed: footballCount,
        scheduleMatched: obs.footballOddsFixtures.filter(
          (r) => r.scopeAccountingState === "SCHEDULE_MATCHED",
        ).length,
        identityReviewRequired: obs.footballOddsFixtures.filter(
          (r) => r.scopeAccountingState === "IDENTITY_REVIEW_REQUIRED",
        ).length,
        pregameEligible: obs.footballOddsFixtures.filter(
          (r) =>
            r.pregameEligibilityStatus ===
            "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE",
        ).length,
      },
      MLB: {
        observed: mlbCount,
        scheduleMatched: obs.mlbOddsGames.filter(
          (r) => r.scopeAccountingState === "SCHEDULE_MATCHED",
        ).length,
        unresolved: obs.mlbOddsGames.filter(
          (r) => r.identityStatus !== "MATCHED",
        ).length,
        pregameEligible: obs.mlbOddsGames.filter(
          (r) =>
            r.pregameEligibilityStatus ===
            "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE",
        ).length,
      },
      BASKETBALL: {
        observed: basketballCount,
        scheduleMatched: 0,
        providerUnsupported: basketballCount,
        ownerConfirmed: obs.basketballOddsFixtures.filter(
          (r) => r.teamLabelStatus === "OWNER_EXPLICIT_CONFIRMATION",
        ).length,
        pregameEligible: 0,
        pregameEligibilityUnresolved: basketballCount,
        droppedFromDenominator: 0,
      },
    },
    ownerConfirmedBasketballMatchups: [
      {
        displayedStartKst: "10:40",
        rawHomeLabel: "파나마",
        rawAwayLabel: "캐나다",
        marketIds: [7023, 7024, 7025, 7026],
      },
      {
        displayedStartKst: "11:10",
        rawHomeLabel: "멕시코",
        rawAwayLabel: "콜롬비아",
        marketIds: [7019, 7020, 7021, 7022],
      },
    ],
    operatorReviewItems: OPERATOR_REVIEW_ITEMS,
    pregameEligibleObservedMatchups: slate.pregameEligibleObservedMatchups,
    postStartObservedMatchups: slate.postStartObservedMatchups,
    pregameEligibilityUnresolved: slate.pregameEligibilityUnresolved,
    providerCallCount: slate.providerCallCount,
    providerCallsThisRun: networkCallsThisRun,
    nextCalendarDateVisibleExcludedFromDenominator: 0,
    scopeShrinkAfterLockForbidden: true,
    note: "CANDIDATE only. Official denominator is the explicit 36-matchup operator-observed slate plus supported-sport schedule reconciliation. Provider-unsupported basketball rows remain in the denominator. UEL competition alias and La Liga team aliases are OWNER-approved exact aliases only. No credit/seal until OWNER review. Not a Prediction input.",
    nextRecommendedStep:
      "OWNER review then 2026-08-28 Scope FINAL SEAL, then B1. Do not start B1.",
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
