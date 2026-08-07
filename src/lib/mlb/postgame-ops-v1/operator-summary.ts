/**
 * Operator summary for MLB Postgame Ops — artifact-driven.
 */
import type { MlbPostgameFailure, MlbPostgameReport } from "./types";

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n}%`;
}

function fmtNum(n: number | null, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function formatMlbPostgameOpsOperatorSummary(
  report: Pick<
    MlbPostgameReport,
    | "dateKst"
    | "dryRun"
    | "assessOnly"
    | "lifecycle"
    | "resultsStatus"
    | "allResearch"
    | "engineGoodPicks"
    | "dailyLearningPlain"
    | "researchQuestions"
    | "nextAction"
    | "failure"
  >,
): string {
  const lines: string[] = [];
  lines.push("========================================");
  lines.push("YANG EDGE MLB POSTGAME");
  lines.push(report.dateKst);
  if (report.dryRun || report.assessOnly) {
    lines.push("(dry-run / read-only)");
  }
  lines.push("========================================");
  lines.push("");

  if (report.failure?.reason === "NO_PREGAME_SNAPSHOT") {
    lines.push("NO_PREGAME_SNAPSHOT");
    lines.push("");
    lines.push("Research Accuracy 생성 금지");
    lines.push("Good Pick 생성 금지");
    lines.push("Recommendation Record 생성 금지");
    lines.push("사후 Prediction 생성 금지");
    lines.push("");
    lines.push("Lifecycle");
    lines.push("NO_PREGAME_SNAPSHOT");
    lines.push("");
    lines.push("NEXT ACTION");
    lines.push(report.failure.nextAction);
    lines.push("");
    lines.push("========================================");
    return lines.join("\n");
  }

  const rs = report.resultsStatus;
  lines.push("RESULTS");
  if (rs) {
    lines.push(`${rs.final} / ${rs.games} FINAL`);
    if (!rs.allFinal) {
      lines.push(`NOT_FINAL ${rs.notFinal}`);
    }
  } else {
    lines.push("—");
  }
  lines.push("");

  lines.push("ALL RESEARCH PREDICTIONS");
  const ar = report.allResearch;
  if (ar) {
    lines.push(`Correct      ${ar.correct}`);
    lines.push(`Incorrect    ${ar.incorrect}`);
    lines.push(`Accuracy     ${fmtPct(ar.accuracyPercent)}`);
    lines.push(`Brier        ${fmtNum(ar.brier)}`);
    lines.push(`LogLoss      ${fmtNum(ar.logLoss)}`);
  } else {
    lines.push("— (not graded)");
  }
  lines.push("");

  const eg = report.engineGoodPicks;
  lines.push("ENGINE GOOD PICKS");
  lines.push(`Record       ${eg.recordStatus}`);
  lines.push(`Total        ${eg.total}`);
  lines.push(`Correct      ${eg.correct}`);
  lines.push(`Incorrect    ${eg.incorrect}`);
  lines.push(`Accuracy     ${fmtPct(eg.accuracyPercent)}`);
  lines.push("");

  if (eg.rows.length === 0) {
    lines.push("ENGINE 추천 기록 없음");
    lines.push("");
  } else {
    eg.rows.forEach((row, i) => {
      lines.push(`${i + 1}. ${row.pick ?? "—"}`);
      lines.push(`   Result: ${row.finalScore ?? "—"}`);
      lines.push(`   Grade: ${row.grade}`);
      if (row.researchOnly) lines.push("   RESEARCH ONLY");
      if (row.primaryReviewCandidate) {
        lines.push(`   Review: ${row.primaryReviewCandidate}`);
      }
      lines.push("");
    });
  }

  lines.push("TOP SUCCESS CANDIDATE");
  lines.push(eg.topSuccessCandidate ?? "— (표본 부족 또는 해당 없음)");
  lines.push("");
  lines.push("TOP FAILURE CANDIDATE");
  lines.push(eg.topFailureCandidate ?? "— (표본 부족 또는 해당 없음)");
  lines.push("");

  lines.push("DAILY LEARNING");
  lines.push(report.dailyLearningPlain ?? "—");
  if (report.researchQuestions[0]) {
    lines.push(`Research Question: ${report.researchQuestions[0]}`);
  }
  lines.push("");
  lines.push("Lifecycle");
  lines.push(report.lifecycle);
  lines.push("");
  lines.push("NEXT ACTION");
  lines.push(report.nextAction);
  lines.push("");
  lines.push("========================================");
  return lines.join("\n");
}

export function formatMlbPostgameOpsFailureBlock(
  failure: MlbPostgameFailure,
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
