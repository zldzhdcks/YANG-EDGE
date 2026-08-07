/**
 * Human operator summary for MLB Daily Ops — artifact-driven, no hardcoding.
 */
import type { MlbDailyOpsDayAssessment, MlbDailyOpsFailure } from "./types";

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`;
}

function fmtProb(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export function formatMlbDailyOpsOperatorSummary(input: {
  day: MlbDailyOpsDayAssessment;
  failure?: MlbDailyOpsFailure | null;
  dryRun?: boolean;
}): string {
  const { day, failure, dryRun } = input;
  const lines: string[] = [];
  lines.push("========================================");
  lines.push("YANG EDGE MLB DAILY OPS");
  lines.push(day.dateKst);
  if (dryRun) lines.push("(dry-run / read-only)");
  lines.push("========================================");
  lines.push("");
  lines.push(`Games             ${day.games}`);
  lines.push("");
  lines.push(
    `Starter           ${day.starter.ready}/${day.starter.total}`,
  );
  lines.push(`Odds              ${day.odds.ready}/${day.odds.total}`);
  lines.push(
    `Lineup            ${day.lineup.ready}/${day.lineup.total}`,
  );
  lines.push("");
  lines.push(
    `Research Ready    ${day.researchReadyPercent != null ? `${day.researchReadyPercent}%` : "—"}`,
  );
  lines.push("");
  lines.push("Prediction");
  if (day.snapshotVerified) {
    lines.push("✓ FROZEN BEFORE GAME");
  } else if (day.provenanceStatus === "NO_PREGAME_SNAPSHOT") {
    lines.push("✗ NO_PREGAME_SNAPSHOT");
  } else if (day.provenanceStatus === "SNAPSHOT_AFTER_START") {
    lines.push("✗ SNAPSHOT AFTER START (사후 생성 금지)");
  } else {
    lines.push(`✗ ${day.provenanceStatus}`);
  }
  lines.push("");
  lines.push("Snapshot Hash");
  lines.push(day.predictionHashShort ?? day.predictionHash ?? "—");
  lines.push("");
  lines.push(`Strong Pick       ${day.strongPickCount}`);
  lines.push(`Good Pick         ${day.goodPickCount}`);
  lines.push("");

  if (day.enginePicks.length === 0) {
    lines.push("오늘 YANG EDGE 추천 없음");
    lines.push("");
  } else {
    for (const p of day.enginePicks) {
      lines.push(`${p.rank}. ${p.team}`);
      lines.push(
        `   ${fmtProb(p.probability)} / Confidence ${p.confidence ?? "—"}`,
      );
      if (p.researchOnly) lines.push("   RESEARCH ONLY");
      lines.push("");
    }
  }

  lines.push("Recommendation Record");
  if (day.recommendationRecord === "SEALED") {
    lines.push("✓ SEALED");
  } else if (day.recommendationRecord === "NOT_ELIGIBLE") {
    lines.push("— NOT ELIGIBLE (ENGINE_SNAPSHOT 이전 / 재구성)");
  } else {
    lines.push("✗ ABSENT");
  }
  lines.push("");

  if (failure) {
    lines.push("DAILY OPS FAILED");
    lines.push(`Stage: ${failure.stage}`);
    lines.push(`Reason: ${failure.reason}`);
    lines.push(`Next Action: ${failure.nextAction}`);
  } else {
    lines.push("NEXT ACTION");
    lines.push(day.nextAction);
  }
  lines.push("");
  lines.push("========================================");
  return lines.join("\n");
}

export function formatMlbDailyOpsFailureBlock(
  failure: MlbDailyOpsFailure,
): string {
  return [
    "DAILY OPS FAILED",
    "",
    `Stage:`,
    failure.stage,
    "",
    `Reason:`,
    failure.reason,
    "",
    `Next Action:`,
    failure.nextAction,
  ].join("\n");
}

export function formatCoveragePct(n: number | null): string {
  return fmtPct(n);
}
