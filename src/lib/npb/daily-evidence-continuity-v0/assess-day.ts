/**
 * Read-only NPB Daily Evidence Continuity assessment.
 * Never mutates Pregame Snapshot / Engine / picks.
 */
import { loadNpbScheduleGames } from "@/lib/npb/manual-starter-intake-v0/join-schedule";
import { loadNpbStarterResearchOverlay } from "@/lib/npb/manual-starter-intake-v0";
import { loadNpbMarketOddsConfirmation } from "@/lib/npb/manual-market-odds-v0";
import { loadNpbPregameEvidenceSnapshot } from "@/lib/npb/pregame-evidence-snapshot-v0";
import { loadNpbOfficialResultsV0 } from "@/lib/npb/official-result-intake-v0";
import {
  assessNpbPregameEvidenceContinuity,
  earliestFirstPitch,
} from "./continuity-guard";
import {
  NPB_DAILY_EVIDENCE_CONTINUITY_SCHEMA,
  NPB_PREGAME_EVIDENCE_MISSING,
  type NpbDailyEvidenceDayAssessment,
  type NpbDailyLifecycleStatus,
  type NpbEvidenceCoverageLine,
  type NpbEvidenceItemReadiness,
  type NpbMarketBaselineV0,
} from "./types";

function readinessOf(ready: number, total: number): NpbEvidenceItemReadiness {
  if (total <= 0) return "MISSING";
  if (ready <= 0) return "MISSING";
  if (ready >= total) return "READY";
  return "PARTIAL";
}

function markLine(input: {
  label: string;
  ready: number;
  total: number;
  displayOverride?: string;
  detail?: string | null;
}): NpbEvidenceCoverageLine {
  const readiness = readinessOf(input.ready, input.total);
  const mark =
    readiness === "READY" ? "✓" : readiness === "PARTIAL" ? "◐" : "⚠";
  const display =
    input.displayOverride ??
    `${mark} ${input.ready}/${Math.max(input.total, 0)}`;
  return {
    label: input.label,
    readiness,
    ready: input.ready,
    total: input.total,
    display,
    detail: input.detail ?? null,
  };
}

function buildMarketBaseline(
  results: Awaited<ReturnType<typeof loadNpbOfficialResultsV0>>,
): NpbMarketBaselineV0 | null {
  if (!results) return null;
  const won = results.summary.marketFavoriteWon;
  const lost = results.summary.marketFavoriteLost;
  const notApplicable = results.summary.marketFavoriteNotApplicable;
  const decided = won + lost;
  const winRatePercent =
    decided > 0 ? Math.round((won / decided) * 1000) / 10 : null;
  const rateText =
    winRatePercent == null ? "—" : `${winRatePercent.toFixed(1)}%`;
  return {
    kind: "MARKET_BASELINE",
    won,
    lost,
    notApplicable,
    decided,
    winRatePercent,
    display: `${won} Won · ${lost} Lost · ${rateText}`,
  };
}

function resolveLifecycle(input: {
  hasAnyInput: boolean;
  scheduleGames: number;
  snapshotExists: boolean;
  snapshotVerified: boolean;
  snapshotOpsFailure: boolean;
  continuityAlert: string | null;
  resultsComplete: boolean;
  resultsPresent: boolean;
  pastOrApproachingFirstPitch: boolean;
}): NpbDailyLifecycleStatus {
  if (input.continuityAlert === NPB_PREGAME_EVIDENCE_MISSING) {
    return "NO_PREGAME_EVIDENCE";
  }
  if (input.snapshotOpsFailure) {
    return "OPS_FAILURE";
  }
  if (!input.hasAnyInput && !input.snapshotExists) {
    return "NOT_STARTED";
  }
  if (!input.snapshotExists) {
    return "COLLECTING";
  }
  if (input.resultsComplete) {
    return "COMPLETED";
  }
  if (input.resultsPresent || input.pastOrApproachingFirstPitch) {
    return "AWAITING_RESULT";
  }
  if (input.snapshotVerified || input.snapshotExists) {
    return "PREGAME_EVIDENCE_READY";
  }
  return "COLLECTING";
}

function nextActionFor(lifecycle: NpbDailyLifecycleStatus): string {
  switch (lifecycle) {
    case "NOT_STARTED":
      return "SEED_NPB_SCHEDULE_AND_INTAKE";
    case "COLLECTING":
      return "FREEZE_PREGAME_EVIDENCE_BEFORE_FIRST_PITCH";
    case "PREGAME_EVIDENCE_READY":
      return "WAIT_FOR_OFFICIAL_RESULT";
    case "AWAITING_RESULT":
      return "COLLECT_OFFICIAL_RESULT_INTAKE";
    case "COMPLETED":
      return "NONE_DAY_COMPLETE";
    case "NO_PREGAME_EVIDENCE":
      return "OPS_ALERT_NPB_PREGAME_EVIDENCE_MISSING";
    case "OPS_FAILURE":
      return "INSPECT_NPB_EVIDENCE_ARTIFACTS";
    default:
      return "REVIEW_NPB_DAILY_OPS";
  }
}

export async function assessNpbDailyEvidenceDay(input: {
  dateKst: string;
  cwd?: string;
  asOf?: string;
}): Promise<NpbDailyEvidenceDayAssessment> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const asOf = input.asOf ?? new Date().toISOString();

  const schedule = await loadNpbScheduleGames({ dateKst, cwd });
  const matched = schedule.games.filter((g) => g.joinStatus === "MATCHED");
  const gameCount = matched.length;

  const starter = await loadNpbStarterResearchOverlay({ dateKst, cwd });
  const oddsDoc = await loadNpbMarketOddsConfirmation({ dateKst, cwd });
  const snapshot = await loadNpbPregameEvidenceSnapshot({ dateKst, cwd });
  const results = await loadNpbOfficialResultsV0({ dateKst, cwd });

  const starterReady = starter.availableStarters;
  const starterTotal =
    starter.totalStarterSlots || (gameCount > 0 ? gameCount * 2 : 0);
  const oddsReady =
    oddsDoc?.summary.preGameVerifiedGames ??
    oddsDoc?.summary.moneylineVerified ??
    0;
  const oddsTotal = gameCount || oddsReady;

  const scheduleLine = markLine({
    label: "Schedule",
    ready: gameCount,
    total: gameCount,
    displayOverride:
      gameCount > 0
        ? `✓ ${gameCount}/${gameCount}`
        : schedule.exists
          ? "⚠ 0/0"
          : "⚠ MISSING",
    detail: schedule.exists ? schedule.pathRel : null,
  });

  const starterLine = markLine({
    label: "Starter",
    ready: starterReady,
    total: starterTotal,
    detail: starterReady > 0 ? "MANUAL_VERIFIED" : null,
  });
  if (starterReady > 0 && starterReady >= starterTotal && starterTotal > 0) {
    starterLine.display = `✓ ${starterReady}/${starterTotal}`;
  }

  const oddsLine = markLine({
    label: "Odds",
    ready: oddsReady,
    total: oddsTotal,
    detail: oddsReady > 0 ? "MANUAL_VERIFIED" : null,
  });

  const lineupTotal = gameCount;
  const lineupReleased =
    snapshot?.summary.lineupReleased ??
    snapshot?.games.filter((g) => g.lineup.status !== "NOT_RELEASED").length ??
    0;
  const lineupLine = markLine({
    label: "Lineup",
    ready: lineupReleased,
    total: lineupTotal,
    displayOverride:
      lineupReleased === 0
        ? "⚠ NOT RELEASED"
        : undefined,
    detail: "Lineup not backfilled postgame",
  });

  const snapshotExists = snapshot != null;
  const hash = snapshot?.predictionHashSha256 ?? null;
  const snapshotVerified =
    snapshot?.snapshotStatus === "PRE_GAME_SNAPSHOT_VERIFIED" ||
    snapshot?.snapshotKind === "PREGAME_EVIDENCE";
  const snapshotOpsFailure =
    snapshot?.snapshotStatus === "BLOCKED_AFTER_START" ||
    snapshot?.snapshotStatus === "FAILED" ||
    (snapshot != null && snapshot.snapshotKind !== "PREGAME_EVIDENCE");

  const evidenceDisplay = snapshotExists
    ? snapshotVerified
      ? "✓ FROZEN"
      : `◐ ${snapshot!.snapshotStatus}`
    : "⚠ MISSING";

  const resultsPresent = results != null;
  const resultsTotal = results?.summary.games ?? gameCount;
  const finalCount = results?.summary.FINAL ?? 0;
  const resolvedCount =
    (results?.summary.FINAL ?? 0) +
    (results?.summary.CANCELLED ?? 0) +
    (results?.summary.POSTPONED ?? 0);
  const resultsComplete =
    resultsPresent &&
    resultsTotal > 0 &&
    resolvedCount >= resultsTotal &&
    (results?.summary.joinMatched ?? 0) >= resultsTotal;

  const resultsDisplay = resultsPresent
    ? finalCount >= resultsTotal && resultsTotal > 0
      ? `✓ ${finalCount}/${resultsTotal} FINAL`
      : `◐ ${finalCount}/${resultsTotal} FINAL`
    : "⚠ MISSING";

  const earliest = earliestFirstPitch(
    matched.map((g) => g.firstPitchAt).concat(
      snapshot?.games.map((g) => g.firstPitchAt) ?? [],
    ),
  );

  const continuity = assessNpbPregameEvidenceContinuity({
    scheduleExists: schedule.exists,
    gameCount,
    snapshotExists,
    earliestFirstPitchAt: earliest,
    asOf,
  });

  const hasAnyInput =
    schedule.exists ||
    starterReady > 0 ||
    oddsReady > 0 ||
    snapshotExists ||
    resultsPresent;

  const lifecycle = resolveLifecycle({
    hasAnyInput,
    scheduleGames: gameCount,
    snapshotExists,
    snapshotVerified: Boolean(snapshotVerified && snapshotExists),
    snapshotOpsFailure: Boolean(snapshotOpsFailure),
    continuityAlert: continuity.alert,
    resultsComplete,
    resultsPresent,
    pastOrApproachingFirstPitch: continuity.pastOrApproachingFirstPitch,
  });

  const marketBaseline = buildMarketBaseline(results);
  const nextAction = nextActionFor(lifecycle);

  return {
    schemaVersion: NPB_DAILY_EVIDENCE_CONTINUITY_SCHEMA,
    dateKst,
    lifecycle,
    schedule: scheduleLine,
    starter: starterLine,
    odds: oddsLine,
    lineup: lineupLine,
    evidence: {
      frozen: snapshotExists,
      status: snapshot?.snapshotStatus ?? "NOT_FROZEN",
      hashSha256: hash,
      hashShort: hash ? `${hash.slice(0, 8)}…` : null,
      display: evidenceDisplay,
    },
    results: {
      present: resultsPresent,
      finalCount,
      total: resultsTotal,
      display: resultsDisplay,
    },
    marketBaseline,
    prediction: {
      engine: "NOT_AVAILABLE",
      accuracy: "N/A",
      goodPicks: "N/A",
      note: "NPB Prediction Engine not available — evidence accumulation only.",
    },
    continuity,
    nextAction,
    line: [
      lifecycle,
      evidenceDisplay,
      resultsDisplay,
      continuity.alert,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export async function assessRecentNpbDailyEvidenceDays(input: {
  dates: string[];
  cwd?: string;
  asOf?: string;
}): Promise<NpbDailyEvidenceDayAssessment[]> {
  const out: NpbDailyEvidenceDayAssessment[] = [];
  for (const dateKst of input.dates) {
    out.push(
      await assessNpbDailyEvidenceDay({
        dateKst,
        cwd: input.cwd,
        asOf: input.asOf,
      }),
    );
  }
  return out;
}
