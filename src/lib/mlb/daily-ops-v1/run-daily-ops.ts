/**
 * MLB Daily Ops One-Command v1
 * Reuses daily-pregame-v0 orchestrator + recommendation provenance.
 * Does not change Engine / Prediction formula / weights / datasets.
 */
import {
  runMlbDailyPregameV0,
  type DailyPregameOptions,
  type DailyStageName,
} from "@/lib/mlb/daily-pregame-v0";
import { DAILY_PREDICTION_SNAPSHOT_MISSING } from "@/lib/mlb/prediction-continuity-guard-v1";
import { assessSlateRecommendationProvenance } from "@/lib/mlb/recommendation-provenance-v1";
import {
  assessMlbDailyOpsDay,
  assessRecentMlbDailyOpsDays,
} from "./assess-day";
import {
  formatMlbDailyOpsFailureBlock,
  formatMlbDailyOpsOperatorSummary,
} from "./operator-summary";
import type {
  MlbDailyOpsFailure,
  MlbDailyOpsReport,
  MlbDailyOpsStageName,
} from "./types";
import { MLB_DAILY_OPS_SCHEMA } from "./types";

export type MlbDailyOpsOptions = {
  dateKst: string;
  dryRun?: boolean;
  noProvider?: boolean;
  /** When true (default for real runs), seal ENGINE delivery record if absent. */
  sealDeliveryRecord?: boolean;
  recentDates?: string[];
  cwd?: string;
  gameIds?: string[];
  skipLineup?: boolean;
  observationOnly?: boolean;
  useMarketPrior?: boolean;
  stopAfter?: DailyStageName;
  resumeFrom?: DailyStageName;
  writePrediction?: boolean;
  asOf?: string;
  enforcePregameGates?: boolean;
  /** Skip spawning collectors; assess + provenance only (tests / dashboard). */
  assessOnly?: boolean;
};

function mapFailureFromPregame(input: {
  overall: string;
  blockingIssues: string[];
  nextAction: string | null;
  snapshotVerified: boolean;
}): MlbDailyOpsFailure | null {
  if (input.snapshotVerified) return null;

  if (
    input.overall === "DAILY_PREDICTION_SNAPSHOT_MISSING" ||
    input.blockingIssues.includes(DAILY_PREDICTION_SNAPSHOT_MISSING)
  ) {
    return {
      stage: "PREDICTION_V0",
      reason: DAILY_PREDICTION_SNAPSHOT_MISSING,
      nextAction:
        input.nextAction ?? "RUN_PREDICTION_V0_BEFORE_FIRST_PITCH",
    };
  }
  if (input.overall === "BLOCKED_AFTER_START") {
    return {
      stage: "PREDICTION_V0",
      reason: "BLOCKED_AFTER_START",
      nextAction:
        input.nextAction ?? "WAIT_NEXT_SLATE_BEFORE_COMMENCE — 사후 Snapshot 금지",
    };
  }
  if (input.overall === "BLOCKED_MISSING_SCHEDULE") {
    return {
      stage: "SCHEDULE",
      reason: "BLOCKED_MISSING_SCHEDULE",
      nextAction: input.nextAction ?? "RUN_SCHEDULE_COLLECTION",
    };
  }
  if (input.blockingIssues.includes("SNAPSHOT_VERIFY_FAILED")) {
    return {
      stage: "SNAPSHOT_VERIFY",
      reason: "SNAPSHOT_VERIFY_FAILED",
      nextAction: input.nextAction ?? "FIX_SNAPSHOT_VERIFY",
    };
  }
  if (input.overall === "FAILED") {
    return {
      stage: "ORCHESTRATOR",
      reason: "FAILED",
      nextAction: input.nextAction ?? "INSPECT_PREGAME_REPORT",
    };
  }
  if (!input.snapshotVerified) {
    return {
      stage: "PROVENANCE_VERIFY",
      reason: "PRE_GAME_SNAPSHOT_NOT_VERIFIED",
      nextAction:
        input.nextAction ?? "ENSURE_PREGAME_SNAPSHOT_BEFORE_FIRST_PITCH",
    };
  }
  return null;
}

/**
 * One-command MLB pregame research cycle.
 * Ops success requires: Snapshot exists + generatedBeforeGame + Verify PASS.
 */
export async function runMlbDailyOpsV1(
  options: MlbDailyOpsOptions,
): Promise<MlbDailyOpsReport> {
  const dateKst = options.dateKst;
  const cwd = options.cwd ?? process.cwd();
  const dryRun = Boolean(options.dryRun);
  const noProvider = Boolean(options.noProvider) || dryRun;
  const assessOnly = Boolean(options.assessOnly);
  const sealDelivery =
    options.sealDeliveryRecord !== false && !dryRun && !assessOnly;

  const recentDates =
    options.recentDates ??
    [
      // Inclusive window around target — gaps stay visible
      addDays(dateKst, -2),
      addDays(dateKst, -1),
      dateKst,
    ].filter((d, i, arr) => arr.indexOf(d) === i);

  let pregame: Awaited<ReturnType<typeof runMlbDailyPregameV0>> | null = null;
  let providerCalls = 0;
  let writesPerformed = 0;

  if (!assessOnly) {
    const pregameOpts: DailyPregameOptions = {
      dateKst,
      dryRun,
      noProvider,
      cwd,
      gameIds: options.gameIds,
      skipLineup: options.skipLineup,
      observationOnly: options.observationOnly,
      useMarketPrior: options.useMarketPrior,
      stopAfter: options.stopAfter,
      resumeFrom: options.resumeFrom,
      writePrediction:
        options.writePrediction !== undefined
          ? options.writePrediction
          : !dryRun,
      asOf: options.asOf,
      enforcePregameGates: options.enforcePregameGates,
    };
    pregame = await runMlbDailyPregameV0(pregameOpts);
    providerCalls = pregame.providerCalls;
    writesPerformed = pregame.writesPerformed;
  }

  // Provenance verify (always)
  const provenance = await assessSlateRecommendationProvenance({
    dateKst,
    cwd,
  });

  // Seal ENGINE recommendation delivery via Daily Picks path (immutable)
  const day = await assessMlbDailyOpsDay({
    dateKst,
    cwd,
    sealDeliveryRecord: sealDelivery,
  });

  const recentDays = await assessRecentMlbDailyOpsDays({
    dates: recentDates,
    cwd,
  });

  let failure: MlbDailyOpsFailure | null = null;
  if (!day.snapshotVerified) {
    if (pregame) {
      failure = mapFailureFromPregame({
        overall: pregame.overall,
        blockingIssues: pregame.blockingIssues,
        nextAction: pregame.nextAction,
        snapshotVerified: day.snapshotVerified,
      });
    } else if (day.provenanceStatus === "NO_PREGAME_SNAPSHOT") {
      failure = {
        stage: "PREDICTION_V0",
        reason: DAILY_PREDICTION_SNAPSHOT_MISSING,
        nextAction: "RUN_PREDICTION_V0_BEFORE_FIRST_PITCH",
      };
    } else {
      failure = {
        stage: "PROVENANCE_VERIFY" as MlbDailyOpsStageName,
        reason: day.provenanceStatus,
        nextAction: day.nextAction,
      };
    }
  }

  // Pipeline can look SUCCESS but still fail ops without verified snapshot
  const opsSuccess = day.snapshotVerified === true;

  const operatorSummaryText = formatMlbDailyOpsOperatorSummary({
    day,
    failure: opsSuccess ? null : failure,
    dryRun: dryRun || assessOnly,
  });

  return {
    schemaVersion: MLB_DAILY_OPS_SCHEMA,
    dateKst,
    dryRun: dryRun || assessOnly,
    noProvider,
    generatedAt: new Date().toISOString(),
    opsSuccess,
    lifecycle: day.lifecycle,
    pregameOverall: pregame?.overall ?? null,
    failure: opsSuccess ? null : failure,
    day,
    recentDays,
    operatorSummaryText,
    pregame,
    provenance,
    writesPerformed,
    providerCalls,
  };
}

function addDays(dateKst: string, delta: number): string {
  const [y, m, d] = dateKst.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export { formatMlbDailyOpsFailureBlock, formatMlbDailyOpsOperatorSummary };
