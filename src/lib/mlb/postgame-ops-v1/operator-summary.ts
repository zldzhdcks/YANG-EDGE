/**
 * Operator summary for MLB Postgame Ops — artifact-driven.
 * Readiness (AWAITING) vs Complete formats. No Engine mutation.
 */
import type { MlbPostgameFailure, MlbPostgameReport } from "./types";

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? `${n}%` : `${n}%`;
}

function shortHash(h: string | null | undefined): string {
  if (!h) return "—";
  return `${h.slice(0, 8)}…`;
}

function formatImmutabilityBlock(report: Pick<MlbPostgameReport, "immutableAudit" | "provenance">): string[] {
  const a = report.immutableAudit;
  const lines: string[] = [];
  lines.push("IMMUTABILITY AUDIT");
  lines.push("");
  lines.push("Prediction Snapshot");
  lines.push(
    `Before: ${shortHash(a.predictionFieldHashBefore ?? a.predictionHashBefore)}`,
  );
  lines.push(
    `After:  ${shortHash(a.predictionFieldHashAfter ?? a.predictionHashAfter)}`,
  );
  lines.push(`Mutation: ${a.predictionUnchanged ? "NONE" : "CHANGED"}`);
  lines.push("");
  lines.push("Recommendation Record");
  lines.push(`SEALED: ${a.recommendationRel ? "YES" : "NO"}`);
  lines.push(`Mutation: ${a.recommendationUnchanged ? "NONE" : "CHANGED"}`);
  lines.push("");
  lines.push("Korean Market Observation");
  lines.push(
    `Hash: ${shortHash(a.koreanMarketFieldHashAfter ?? a.koreanMarketFieldHashBefore)}`,
  );
  lines.push(`Mutation: ${a.koreanMarketUnchanged ? "NONE" : "CHANGED"}`);
  return lines;
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
    | "passTracking"
    | "koreanMarketBaseline"
    | "dailyLearningPlain"
    | "researchQuestions"
    | "nextAction"
    | "failure"
    | "immutableAudit"
    | "provenance"
  >,
): string {
  const lines: string[] = [];

  if (report.failure?.reason === "NO_PREGAME_SNAPSHOT") {
    lines.push("========================================");
    lines.push("YANG EDGE MLB POSTGAME");
    lines.push(report.dateKst);
    lines.push("========================================");
    lines.push("");
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
  const awaiting =
    report.lifecycle === "AWAITING_RESULT" ||
    report.lifecycle === "PREGAME_READY" ||
    (rs != null && !rs.allFinal) ||
    rs == null;

  if (awaiting && report.lifecycle !== "COMPLETED" && report.lifecycle !== "REVIEW_READY") {
    lines.push("=== MLB POSTGAME OPS ===");
    lines.push("");
    lines.push(`Date              ${report.dateKst}`);
    if (report.dryRun || report.assessOnly) {
      lines.push("(dry-run / assess-only — no provider result fetch)");
    }
    const games = rs?.games ?? 0;
    const final = rs?.final ?? 0;
    lines.push(`Games             ${games || "—"}`);
    lines.push(`Final             ${final}/${games || "—"}`);
    if (rs && rs.notFinal > 0) {
      lines.push(`Pending           ${rs.notFinal + rs.missing}`);
    } else if (rs && rs.missing > 0) {
      lines.push(`Pending           ${rs.missing}`);
    }
    lines.push("");
    lines.push("Prediction");
    lines.push("✓ FROZEN");
    lines.push(
      `Hash              ${shortHash(report.provenance?.predictionHash ?? report.immutableAudit.predictionFieldHashBefore)}`,
    );
    lines.push("");
    lines.push("Recommendation");
    lines.push(
      report.engineGoodPicks.recordStatus === "SEALED" ? "✓ SEALED" : `· ${report.engineGoodPicks.recordStatus}`,
    );
    lines.push(`Good Picks        ${report.engineGoodPicks.total}`);
    lines.push(
      `PASS              ${report.passTracking?.totalPass ?? "—"}`,
    );
    lines.push("");
    lines.push("Korean Market");
    if (report.koreanMarketBaseline?.available) {
      lines.push(
        `✓ ${report.koreanMarketBaseline.preGameObservations}/${report.koreanMarketBaseline.scheduleGames} PRE-GAME OBSERVATIONS`,
      );
    } else {
      lines.push("✗ MISSING");
    }
    lines.push("");
    lines.push("Postgame");
    lines.push(rs?.postgameStatus ?? "AWAITING_RESULTS");
    lines.push("");
    lines.push(...formatImmutabilityBlock(report));
    lines.push("");
    lines.push("NEXT ACTION");
    lines.push(report.nextAction === "AWAIT_OFFICIAL_RESULTS" || report.nextAction === "AWAIT_REMAINING_FINAL_RESULTS"
      ? "RUN AFTER FINAL RESULTS"
      : report.nextAction);
    lines.push("");
    return lines.join("\n");
  }

  // Complete / review-ready
  lines.push("=== MLB POSTGAME COMPLETE ===");
  lines.push("");
  lines.push(`Date              ${report.dateKst}`);
  if (report.dryRun || report.assessOnly) {
    lines.push("(dry-run / assess-only)");
  }
  if (rs) {
    lines.push(`Games             ${rs.final}/${rs.games} FINAL`);
  }
  lines.push("");
  lines.push("Good Picks");
  lines.push(`Hits              ${report.engineGoodPicks.correct}`);
  lines.push(`Misses            ${report.engineGoodPicks.incorrect}`);
  lines.push(
    `Accuracy          ${
      report.engineGoodPicks.accuracyPercent == null
        ? "—"
        : fmtPct(report.engineGoodPicks.accuracyPercent)
    }`,
  );
  lines.push("");
  lines.push("Korean Market");
  if (report.koreanMarketBaseline?.available) {
    lines.push(`Favorite Won      ${report.koreanMarketBaseline.favoriteWon}`);
    lines.push(`Favorite Lost     ${report.koreanMarketBaseline.favoriteLost}`);
    lines.push(
      `Accuracy          ${
        report.koreanMarketBaseline.accuracyPercent == null
          ? "—"
          : `${report.koreanMarketBaseline.accuracyPercent.toFixed(1)}%`
      }`,
    );
  } else {
    lines.push("—");
  }
  lines.push("");
  lines.push("PASS");
  lines.push(
    `Tracked           ${report.passTracking ? `${report.passTracking.tracked}/${report.passTracking.totalPass}` : "—"}`,
  );
  lines.push("");
  lines.push("Snapshot");
  lines.push(
    report.immutableAudit.predictionUnchanged
      ? "✓ IMMUTABLE"
      : "✗ MUTATED",
  );
  lines.push("");
  lines.push("Recommendation");
  lines.push(
    report.immutableAudit.recommendationUnchanged
      ? "✓ SEALED / IMMUTABLE"
      : "✗ MUTATED",
  );
  lines.push("");
  lines.push(...formatImmutabilityBlock(report));
  lines.push("");
  lines.push("Lifecycle");
  lines.push(report.lifecycle);
  lines.push("");
  lines.push("NEXT ACTION");
  lines.push(
    report.lifecycle === "COMPLETED" || report.lifecycle === "REVIEW_READY"
      ? "SUCCESS_FAILURE_REVIEW"
      : report.nextAction,
  );
  lines.push("");
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
