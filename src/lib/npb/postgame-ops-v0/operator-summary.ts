/**
 * Operator summary for NPB Postgame Ops — no prediction grades.
 */
import { shortDateLabel } from "@/lib/npb/daily-evidence-continuity-v0";
import type { NpbPostgameOpsFailure, NpbPostgameOpsReport } from "./types";

export function formatNpbPostgameOpsOperatorSummary(
  report: Pick<
    NpbPostgameOpsReport,
    | "dateKst"
    | "dryRun"
    | "assessOnly"
    | "day"
    | "results"
    | "immutableAudit"
    | "nextAction"
    | "failure"
    | "recentDays"
  >,
): string {
  const d = report.day;
  const lines: string[] = [];
  lines.push("=== NPB POSTGAME OPS ===");
  lines.push("");
  lines.push(`Date: ${report.dateKst}`);
  if (report.dryRun || report.assessOnly) {
    lines.push("(dry-run / assess-only)");
  }
  lines.push("");

  if (report.failure?.reason === "NO_PREGAME_EVIDENCE") {
    lines.push("NO_PREGAME_EVIDENCE");
    lines.push("사후 Pregame Snapshot 생성 금지");
    lines.push("Prediction Grade 생성 금지");
    lines.push("");
    lines.push("Lifecycle");
    lines.push(d.lifecycle);
    lines.push("");
    lines.push("NEXT ACTION");
    lines.push(report.failure.nextAction);
    lines.push("");
    return lines.join("\n");
  }

  const games = report.results?.summary.games ?? d.results.total;
  const final = report.results?.summary.FINAL ?? d.results.finalCount;
  lines.push(`Games: ${games}`);
  lines.push(`Final: ${final}`);
  lines.push("");

  lines.push("Market Baseline:");
  if (d.marketBaseline) {
    lines.push(`${d.marketBaseline.won} Won`);
    lines.push(`${d.marketBaseline.lost} Lost`);
    lines.push(
      d.marketBaseline.winRatePercent == null
        ? "—"
        : `${d.marketBaseline.winRatePercent.toFixed(1)}%`,
    );
  } else {
    lines.push("— (no results)");
  }
  lines.push("");

  lines.push("Prediction:");
  lines.push("NOT AVAILABLE");
  lines.push("Accuracy:");
  lines.push("N/A");
  lines.push("");

  lines.push("Pregame Hash:");
  lines.push(d.evidence.hashShort ?? "—");
  lines.push("Mutation:");
  lines.push(report.immutableAudit.predictionUnchanged ? "NONE" : "CHANGED");
  lines.push("");

  lines.push("Lifecycle:");
  lines.push(d.lifecycle);
  lines.push("");

  if (d.continuity.alert) {
    lines.push("CONTINUITY ALERT");
    lines.push(d.continuity.alert);
    lines.push("");
  }

  lines.push("NEXT ACTION");
  lines.push(report.nextAction);
  lines.push("");
  lines.push("--- Recent NPB dates ---");
  for (const r of report.recentDays) {
    lines.push(
      `${r.shortDate || shortDateLabel(r.dateKst)}  ${r.lifecycle}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function formatNpbPostgameOpsFailureBlock(
  failure: NpbPostgameOpsFailure,
): string {
  return [
    "POSTGAME OPS FAILED",
    "",
    "Stage:",
    failure.stage,
    "",
    "Reason:",
    failure.reason,
    "",
    "Next Action:",
    failure.nextAction,
  ].join("\n");
}
