/**
 * Operator summary for NPB Daily Ops — evidence only.
 */
import { shortDateLabel } from "@/lib/npb/daily-evidence-continuity-v0";
import type { NpbDailyOpsFailure, NpbDailyOpsReport } from "./types";

export function formatNpbDailyOpsOperatorSummary(
  report: Pick<
    NpbDailyOpsReport,
    | "dateKst"
    | "dryRun"
    | "assessOnly"
    | "day"
    | "nextAction"
    | "nextActionUi"
    | "failure"
    | "recentDays"
    | "warnings"
  >,
): string {
  const d = report.day;
  const lines: string[] = [];
  lines.push("=== NPB DAILY OPS ===");
  lines.push("");
  lines.push(`Date: ${report.dateKst}`);
  lines.push(`Games: ${d.schedule.total || d.schedule.ready}`);
  if (report.dryRun || report.assessOnly) {
    lines.push("(dry-run / assess-only)");
  }
  lines.push("");
  lines.push(
    `Schedule      ${d.schedule.readiness === "READY" ? "READY" : d.schedule.display}`,
  );
  lines.push(
    `Starter       ${d.starter.ready}/${d.starter.total}${
      d.starter.detail === "MANUAL_VERIFIED" ? " MANUAL_VERIFIED" : ""
    }`,
  );
  lines.push(
    `Odds          ${d.odds.ready}/${d.odds.total}${
      d.odds.detail === "MANUAL_VERIFIED" ? " MANUAL_VERIFIED" : ""
    }`,
  );
  lines.push(`Lineup        ${d.lineup.ready === 0 ? "NOT_RELEASED" : d.lineup.display}`);
  lines.push("");
  lines.push("Pregame Evidence");
  lines.push(d.evidence.status);
  lines.push(`Hash: ${d.evidence.hashShort ?? "—"}`);
  lines.push("");
  lines.push("Prediction");
  lines.push("NOT AVAILABLE");
  lines.push("");
  lines.push("Lifecycle");
  lines.push(d.lifecycle);
  lines.push("");

  if (d.continuity.alert) {
    lines.push("CONTINUITY ALERT");
    lines.push(d.continuity.alert);
    lines.push(d.continuity.plainLanguage);
    lines.push("");
  }

  for (const w of report.warnings) {
    lines.push(`Warning: ${w}`);
  }
  if (report.warnings.length) lines.push("");

  if (report.failure) {
    lines.push("DAILY OPS FAILED");
    lines.push(`Stage: ${report.failure.stage}`);
    lines.push(`Reason: ${report.failure.reason}`);
    lines.push("NEXT ACTION");
    lines.push(report.failure.nextAction);
    if (report.failure.uiPath) {
      lines.push("UI:");
      lines.push(report.failure.uiPath);
    }
  } else {
    lines.push("NEXT ACTION");
    lines.push(report.nextAction);
    if (report.nextActionUi) {
      lines.push("UI:");
      lines.push(report.nextActionUi);
    }
  }
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

export function formatNpbDailyOpsFailureBlock(
  failure: NpbDailyOpsFailure,
): string {
  const lines = [
    "DAILY OPS FAILED",
    "",
    "Stage:",
    failure.stage,
    "",
    "Reason:",
    failure.reason,
    "",
    "Next Action:",
    failure.nextAction,
  ];
  if (failure.uiPath) {
    lines.push("", "UI:", failure.uiPath);
  }
  return lines.join("\n");
}
