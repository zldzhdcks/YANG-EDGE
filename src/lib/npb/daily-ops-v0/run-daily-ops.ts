/**
 * NPB Daily Ops One-Command v0
 * Reuses schedule / starter / odds / evidence freeze / continuity assess.
 * Never creates Prediction Engine picks / confidence / model probability.
 */
import {
  assessNpbDailyEvidenceDay,
  discoverNpbOpsDates,
  loadNpbDailyOpsView,
  NPB_PREGAME_EVIDENCE_MISSING,
  shortDateLabel,
} from "@/lib/npb/daily-evidence-continuity-v0";
import {
  freezeNpbPregameEvidenceSnapshot,
  loadNpbPregameEvidenceSnapshot,
} from "@/lib/npb/pregame-evidence-snapshot-v0";
import { formatNpbDailyOpsOperatorSummary } from "./operator-summary";
import {
  NPB_DAILY_OPS_SCHEMA,
  type NpbDailyOpsFailure,
  type NpbDailyOpsReport,
  type NpbDailyOpsStageName,
} from "./types";

export type NpbDailyOpsOptions = {
  dateKst: string;
  cwd?: string;
  asOf?: string;
  /** Read-only: no freeze write. */
  dryRun?: boolean;
  /** Alias: skip freeze attempt. */
  assessOnly?: boolean;
  /** Attempt freeze when schedule exists and snapshot absent (default true unless dry/assess). */
  attemptFreeze?: boolean;
};

function starterUi(dateKst: string): string {
  return `/internal/research/npb/starter?date=${encodeURIComponent(dateKst)}`;
}

function oddsUi(dateKst: string): string {
  return `/internal/research/npb/odds?date=${encodeURIComponent(dateKst)}`;
}

export function resolveNpbDailyOpsNextAction(input: {
  day: NpbDailyOpsReport["day"];
}): { nextAction: string; nextActionUi: string | null; failure: NpbDailyOpsFailure | null } {
  const { day } = input;
  const dateKst = day.dateKst;

  if (day.continuity.alert === NPB_PREGAME_EVIDENCE_MISSING) {
    return {
      nextAction:
        "NPB_PREGAME_EVIDENCE_MISSING — freeze before first pitch (사후 Snapshot 금지)",
      nextActionUi: null,
      failure: {
        stage: "CONTINUITY_GUARD",
        reason: NPB_PREGAME_EVIDENCE_MISSING,
        nextAction:
          "FREEZE_PREGAME_EVIDENCE_BEFORE_FIRST_PITCH — post-start freeze blocked",
        uiPath: null,
      },
    };
  }

  if (day.lifecycle === "OPS_FAILURE") {
    return {
      nextAction: "INSPECT NPB EVIDENCE ARTIFACTS",
      nextActionUi: null,
      failure: {
        stage: "PREGAME_EVIDENCE",
        reason: "OPS_FAILURE",
        nextAction: "INSPECT NPB EVIDENCE ARTIFACTS",
        uiPath: null,
      },
    };
  }

  if (day.schedule.readiness === "MISSING" || day.schedule.ready === 0) {
    return {
      nextAction: "SEED NPB SCHEDULE",
      nextActionUi: null,
      failure: null,
    };
  }

  if (!day.evidence.frozen) {
    if (day.starter.ready === 0) {
      return {
        nextAction: "OPEN NPB STARTER INPUT",
        nextActionUi: starterUi(dateKst),
        failure: null,
      };
    }
    if (day.odds.ready === 0) {
      return {
        nextAction: "OPEN NPB ODDS INPUT",
        nextActionUi: oddsUi(dateKst),
        failure: null,
      };
    }
    return {
      nextAction: "FREEZE PREGAME EVIDENCE",
      nextActionUi: null,
      failure: null,
    };
  }

  if (day.lifecycle === "COMPLETED") {
    return {
      nextAction: "NONE — DAY COMPLETE",
      nextActionUi: null,
      failure: null,
    };
  }

  if (
    day.lifecycle === "AWAITING_RESULT" ||
    day.lifecycle === "PREGAME_EVIDENCE_READY"
  ) {
    return {
      nextAction: "AWAIT POSTGAME RESULT",
      nextActionUi: null,
      failure: null,
    };
  }

  return {
    nextAction: day.nextAction,
    nextActionUi: null,
    failure: null,
  };
}

export async function runNpbDailyOpsV0(
  options: NpbDailyOpsOptions,
): Promise<NpbDailyOpsReport> {
  const cwd = options.cwd ?? process.cwd();
  const dateKst = options.dateKst;
  const asOf = options.asOf ?? new Date().toISOString();
  const dryRun = Boolean(options.dryRun);
  const assessOnly = Boolean(options.assessOnly);
  const attemptFreeze =
    options.attemptFreeze !== false && !dryRun && !assessOnly;

  const stagesRun: NpbDailyOpsStageName[] = [
    "SCHEDULE",
    "STARTER",
    "ODDS",
    "LINEUP",
    "PREGAME_EVIDENCE",
    "CONTINUITY_GUARD",
    "OPERATOR_SUMMARY",
  ];
  const warnings: string[] = [];

  let freeze: NpbDailyOpsReport["freeze"] = null;
  const existing = await loadNpbPregameEvidenceSnapshot({ dateKst, cwd });

  if (attemptFreeze && !existing) {
    freeze = await freezeNpbPregameEvidenceSnapshot({
      dateKst,
      cwd,
      asOf,
    });
    if (freeze.wrote) {
      warnings.push("Pregame Evidence Snapshot frozen (seal-once).");
    } else if (freeze.snapshotStatus === "BLOCKED_AFTER_START") {
      warnings.push("Freeze blocked after first pitch — 사후 Snapshot 금지.");
    } else if (freeze.errors.includes("SCHEDULE_MISSING")) {
      warnings.push("Schedule missing — cannot freeze.");
    } else if (freeze.errors.length) {
      warnings.push(`Freeze not written: ${freeze.errors.join(", ")}`);
    }
    if (!freeze.wrote && freeze.document == null) {
      // still allow assess; starter/odds gaps are not hard blockers anymore
    }
  }

  const day = await assessNpbDailyEvidenceDay({ dateKst, cwd, asOf });
  const dates = await discoverNpbOpsDates({
    focusDateKst: dateKst,
    cwd,
    neighborSpan: 1,
  });
  const view = await loadNpbDailyOpsView({ dateKst, cwd, asOf });
  // Prefer discovered order from view (includes focus neighbors + artifacts)
  const recentDays = view.recentDays.length
    ? view.recentDays
    : dates.map((d) => ({
        dateKst: d,
        shortDate: shortDateLabel(d),
        lifecycle: "NOT_STARTED" as const,
      }));

  if (day.starter.ready === 0 && day.schedule.ready > 0) {
    warnings.push(
      `Starter missing — open ${starterUi(dateKst)} (freeze may still record nulls).`,
    );
  }
  if (day.odds.ready === 0 && day.schedule.ready > 0) {
    warnings.push(
      `Odds missing — open ${oddsUi(dateKst)} (freeze may still record nulls).`,
    );
  }

  const resolved = resolveNpbDailyOpsNextAction({ day });
  const opsSuccess =
    resolved.failure == null &&
    day.lifecycle !== "NO_PREGAME_EVIDENCE" &&
    day.lifecycle !== "OPS_FAILURE";

  const report: NpbDailyOpsReport = {
    schemaVersion: NPB_DAILY_OPS_SCHEMA,
    dateKst,
    dryRun,
    assessOnly,
    generatedAt: new Date().toISOString(),
    opsSuccess,
    stagesRun,
    day,
    recentDays,
    freeze,
    nextAction: resolved.nextAction,
    nextActionUi: resolved.nextActionUi,
    failure: resolved.failure,
    warnings,
    operatorSummaryText: "",
  };
  report.operatorSummaryText = formatNpbDailyOpsOperatorSummary(report);
  return report;
}
