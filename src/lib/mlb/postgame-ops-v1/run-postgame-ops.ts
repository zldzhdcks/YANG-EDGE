/**
 * MLB Postgame Ops One-Command v1
 * Reuses official results → grade → review → feedback → learning tracker
 * + Korean Market Baseline + PASS tracking.
 * Never mutates Prediction Snapshot, Recommendation Record, or Korean Market Observation.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { buildMlbOfficialResultsV1 } from "@/lib/mlb/build-mlb-official-results";
import { buildMlbPredictionReviewsV1 } from "@/lib/mlb/build-mlb-prediction-reviews-v1";
import { gradeMlbPredictionsV1 } from "@/lib/mlb/grade-mlb-predictions-v1";
import { loadGoodPickFeedbackV1 } from "@/lib/mlb/good-pick-feedback-v1";
import { loadGoodPickLearningTrackerV1 } from "@/lib/mlb/good-pick-learning-tracker-v1";
import { auditSchedule } from "@/lib/mlb/daily-pregame-v0/audit-artifacts";
import {
  engineRecommendationRecordRel,
} from "@/lib/mlb/recommendation-provenance-v1";
import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import { mlbOfficialResultsRel } from "@/lib/mlb/mlb-prediction-review-paths";
import { mlbKoreanMarketOddsObservationRel } from "@/lib/mlb/korean-market-odds-observation-v0/paths";
import { gradeEngineRecommendationRecord } from "./grade-engine-record";
import { loadMlbKoreanMarketBaseline } from "./korean-market-baseline";
import { loadMlbPassTracking } from "./pass-tracking";
import { preflightMlbPostgameOps } from "./preflight";
import { formatMlbPostgameOpsOperatorSummary } from "./operator-summary";
import type {
  AllResearchScorecard,
  MlbPostgameImmutableAudit,
  MlbPostgameLifecycleStatus,
  MlbPostgameReport,
  MlbPostgameResultsStatus,
  MlbPostgameStageName,
} from "./types";
import { MLB_POSTGAME_OPS_SCHEMA } from "./types";

export type MlbPostgameOpsOptions = {
  dateKst: string;
  cwd?: string;
  /** Skip provider result fetch; read existing results artifact only. */
  dryRun?: boolean;
  /** Alias for dry-run assess path (tests). */
  assessOnly?: boolean;
  /** When true, do not write grade/review artifacts (read existing). */
  readOnly?: boolean;
};

function sha256File(abs: string): string | null {
  try {
    return createHash("sha256").update(readFileSync(abs)).digest("hex");
  } catch {
    return null;
  }
}

function mtimeMs(abs: string): number | null {
  try {
    return statSync(abs).mtimeMs;
  } catch {
    return null;
  }
}

function readPredictionFieldHash(abs: string): string | null {
  try {
    const doc = asRecord(JSON.parse(readFileSync(abs, "utf8")));
    return asString(asRecord(doc?.meta)?.predictionHashSha256);
  } catch {
    return null;
  }
}

function readKoreanFieldHash(abs: string): string | null {
  try {
    const doc = asRecord(JSON.parse(readFileSync(abs, "utf8")));
    return asString(doc?.koreanMarketOddsHash);
  } catch {
    return null;
  }
}

function snapshotImmutableAudit(input: {
  dateKst: string;
  cwd: string;
}): {
  before: MlbPostgameImmutableAudit;
  finish: () => MlbPostgameImmutableAudit;
} {
  const predRel = `data/predictions/mlb/${input.dateKst}.json`;
  const recRel = engineRecommendationRecordRel(input.dateKst);
  const korRel = mlbKoreanMarketOddsObservationRel(input.dateKst);
  const predAbs = path.join(input.cwd, predRel);
  const recAbs = path.join(input.cwd, recRel);
  const korAbs = path.join(input.cwd, korRel);
  const hasRec = existsSync(recAbs);
  const hasKor = existsSync(korAbs);

  const before: MlbPostgameImmutableAudit = {
    predictionRel: predRel,
    predictionHashBefore: sha256File(predAbs),
    predictionHashAfter: null,
    predictionFieldHashBefore: readPredictionFieldHash(predAbs),
    predictionFieldHashAfter: null,
    predictionMtimeBefore: mtimeMs(predAbs),
    predictionMtimeAfter: null,
    predictionUnchanged: false,
    recommendationRel: hasRec ? recRel : null,
    recommendationHashBefore: hasRec ? sha256File(recAbs) : null,
    recommendationHashAfter: null,
    recommendationMtimeBefore: hasRec ? mtimeMs(recAbs) : null,
    recommendationMtimeAfter: null,
    recommendationUnchanged: !hasRec,
    koreanMarketRel: hasKor ? korRel : null,
    koreanMarketHashBefore: hasKor ? sha256File(korAbs) : null,
    koreanMarketHashAfter: null,
    koreanMarketFieldHashBefore: hasKor ? readKoreanFieldHash(korAbs) : null,
    koreanMarketFieldHashAfter: null,
    koreanMarketMtimeBefore: hasKor ? mtimeMs(korAbs) : null,
    koreanMarketMtimeAfter: null,
    koreanMarketUnchanged: !hasKor,
  };

  return {
    before,
    finish: () => {
      const predictionHashAfter = sha256File(predAbs);
      const predictionMtimeAfter = mtimeMs(predAbs);
      const predictionFieldHashAfter = readPredictionFieldHash(predAbs);
      const recommendationHashAfter = hasRec ? sha256File(recAbs) : null;
      const recommendationMtimeAfter = hasRec ? mtimeMs(recAbs) : null;
      const koreanMarketHashAfter = hasKor ? sha256File(korAbs) : null;
      const koreanMarketMtimeAfter = hasKor ? mtimeMs(korAbs) : null;
      const koreanMarketFieldHashAfter = hasKor
        ? readKoreanFieldHash(korAbs)
        : null;
      return {
        ...before,
        predictionHashAfter,
        predictionMtimeAfter,
        predictionFieldHashAfter,
        predictionUnchanged:
          before.predictionHashBefore === predictionHashAfter &&
          before.predictionFieldHashBefore === predictionFieldHashAfter &&
          before.predictionMtimeBefore === predictionMtimeAfter,
        recommendationHashAfter,
        recommendationMtimeAfter,
        recommendationUnchanged: !hasRec
          ? true
          : before.recommendationHashBefore === recommendationHashAfter &&
            before.recommendationMtimeBefore === recommendationMtimeAfter,
        koreanMarketHashAfter,
        koreanMarketMtimeAfter,
        koreanMarketFieldHashAfter,
        koreanMarketUnchanged: !hasKor
          ? true
          : before.koreanMarketHashBefore === koreanMarketHashAfter &&
            before.koreanMarketFieldHashBefore === koreanMarketFieldHashAfter &&
            before.koreanMarketMtimeBefore === koreanMarketMtimeAfter,
      };
    },
  };
}

function resultsStatusFromDoc(
  doc: { games: Array<{ status: string }> },
  scheduleGames: number,
): MlbPostgameResultsStatus {
  const games = Math.max(doc.games.length, scheduleGames);
  const final = doc.games.filter((g) => g.status === "FINAL").length;
  const notFinal = doc.games.filter((g) => g.status !== "FINAL").length;
  const missing = Math.max(0, scheduleGames - doc.games.length);
  const allFinal = games > 0 && final === games && missing === 0 && notFinal === 0;
  let postgameStatus: MlbPostgameResultsStatus["postgameStatus"] =
    "AWAITING_RESULTS";
  if (allFinal) postgameStatus = "ALL_FINAL";
  else if (final > 0) postgameStatus = "PARTIAL_RESULTS";
  return {
    games,
    final,
    notFinal,
    missing,
    allFinal,
    postgameStatus,
  };
}

function emptyResultsStatus(scheduleGames: number): MlbPostgameResultsStatus {
  return {
    games: scheduleGames,
    final: 0,
    notFinal: 0,
    missing: scheduleGames,
    allFinal: false,
    postgameStatus: "AWAITING_RESULTS",
  };
}

function allResearchFromGraded(
  graded: Record<string, unknown> | null,
  feedbackAll: AllResearchScorecard | null,
): AllResearchScorecard | null {
  if (feedbackAll) return feedbackAll;
  if (!graded) return null;
  const summary = asRecord(graded.summary) ?? {};
  const researchAccuracy = asRecord(summary.researchAccuracy);
  return {
    totalGames: asNumber(summary.totalGames) ?? 0,
    graded:
      asNumber(summary.researchGraded) ?? asNumber(summary.graded) ?? 0,
    correct:
      asNumber(summary.researchCorrect) ?? asNumber(summary.correct) ?? 0,
    incorrect:
      asNumber(summary.researchIncorrect) ??
      asNumber(summary.incorrect) ??
      0,
    pending: asNumber(summary.pending) ?? 0,
    accuracyPercent: asNumber(researchAccuracy?.percent) ?? null,
    brier: asNumber(summary.researchMeanBrier),
    logLoss: asNumber(summary.researchMeanLogLoss),
  };
}

function resolveLifecycle(input: {
  preflightOk: boolean;
  noSnapshot: boolean;
  results: MlbPostgameResultsStatus | null;
  enginePending: number;
  engineGraded: number;
  researchGraded: number;
}): MlbPostgameLifecycleStatus {
  if (input.noSnapshot) return "NO_PREGAME_SNAPSHOT";
  if (!input.preflightOk) return "OPS_FAILURE";
  if (!input.results || input.results.games === 0) return "AWAITING_RESULT";
  if (!input.results.allFinal || input.enginePending > 0) {
    return "AWAITING_RESULT";
  }
  if (input.engineGraded > 0 || input.researchGraded > 0) {
    return "COMPLETED";
  }
  return "REVIEW_READY";
}

function emptyEngineCard(
  recordStatus: "SEALED" | "ABSENT" | "NOT_ELIGIBLE",
  recordPath: string | null,
): MlbPostgameReport["engineGoodPicks"] {
  return {
    recordStatus,
    recordPath,
    total: 0,
    correct: 0,
    incorrect: 0,
    pending: 0,
    accuracyPercent: null,
    rows: [],
    topSuccessCandidate: null,
    topFailureCandidate: null,
  };
}

/**
 * Close one MLB research day: Result → Grade → Review → Feedback → Tracker
 * + Korean Market Baseline + PASS tracking.
 */
export async function runMlbPostgameOpsV1(
  options: MlbPostgameOpsOptions,
): Promise<MlbPostgameReport> {
  const dateKst = options.dateKst;
  const cwd = options.cwd ?? process.cwd();
  const dryRun = Boolean(options.dryRun) || Boolean(options.assessOnly);
  const assessOnly = Boolean(options.assessOnly);
  const readOnly = Boolean(options.readOnly) || dryRun || assessOnly;
  const stagesRun: MlbPostgameStageName[] = ["PREFLIGHT"];

  const audit = snapshotImmutableAudit({ dateKst, cwd });
  const preflight = await preflightMlbPostgameOps({ dateKst, cwd });
  const schedule = await auditSchedule(dateKst, cwd);

  if (!preflight.ok) {
    const immutableAudit = audit.finish();
    const koreanMarketBaseline = await loadMlbKoreanMarketBaseline({
      dateKst,
      cwd,
      results: null,
    });
    const passTracking = await loadMlbPassTracking({
      dateKst,
      cwd,
      results: null,
    });
    const reportBase = {
      schemaVersion: MLB_POSTGAME_OPS_SCHEMA,
      dateKst,
      dryRun,
      assessOnly,
      generatedAt: new Date().toISOString(),
      opsSuccess: false,
      lifecycle: preflight.lifecycle,
      failure: preflight.failure,
      provenance: preflight.provenance,
      resultsStatus: null,
      allResearch: null,
      engineGoodPicks: emptyEngineCard(
        preflight.recommendationRecord,
        preflight.recommendationRecordPath,
      ),
      passTracking,
      koreanMarketBaseline,
      dailyLearningPlain: null,
      researchQuestions: [] as string[],
      trackerLine: null,
      immutableAudit,
      stagesRun,
      nextAction: preflight.failure?.nextAction ?? "STOP",
    };
    return {
      ...reportBase,
      operatorSummaryText: formatMlbPostgameOpsOperatorSummary(reportBase),
    };
  }

  stagesRun.push("OFFICIAL_RESULTS");
  let resultsDoc: Awaited<
    ReturnType<typeof buildMlbOfficialResultsV1>
  >["document"] | null = null;

  if (!readOnly) {
    const built = await buildMlbOfficialResultsV1({ dateKst, cwd });
    resultsDoc = built.document;
  } else {
    try {
      const raw = readFileSync(
        path.join(cwd, mlbOfficialResultsRel(dateKst)),
        "utf8",
      );
      resultsDoc = JSON.parse(raw) as NonNullable<typeof resultsDoc>;
    } catch {
      resultsDoc = null;
    }
  }

  stagesRun.push("FINAL_STATUS_VERIFY");
  const resultsStatus = resultsDoc
    ? resultsStatusFromDoc(resultsDoc, schedule.totalGames)
    : emptyResultsStatus(schedule.totalGames);

  stagesRun.push("KOREAN_MARKET_BASELINE");
  const koreanMarketBaseline = await loadMlbKoreanMarketBaseline({
    dateKst,
    cwd,
    results: resultsDoc,
  });

  stagesRun.push("PASS_TRACKING");
  const passTracking = await loadMlbPassTracking({
    dateKst,
    cwd,
    results: resultsDoc,
  });

  if (!resultsDoc) {
    const engineGoodPicks = await gradeEngineRecommendationRecord({
      dateKst,
      cwd,
      generatedBeforeGame: preflight.provenance.generatedBeforeGame,
    });
    const immutableAudit = audit.finish();
    let failure: MlbPostgameReport["failure"] = null;
    let opsSuccess = true;
    if (!immutableAudit.predictionUnchanged) {
      opsSuccess = false;
      failure = {
        stage: "PREFLIGHT",
        reason: "PREDICTION_MUTATION_DETECTED",
        nextAction: "STOP — Prediction Snapshot must remain immutable",
      };
    } else if (!immutableAudit.recommendationUnchanged) {
      opsSuccess = false;
      failure = {
        stage: "GRADE_ENGINE_RECORD",
        reason: "RECOMMENDATION_RECORD_MUTATION_DETECTED",
        nextAction: "STOP — Recommendation Record must remain immutable",
      };
    } else if (!immutableAudit.koreanMarketUnchanged) {
      opsSuccess = false;
      failure = {
        stage: "KOREAN_MARKET_BASELINE",
        reason: "KOREAN_MARKET_MUTATION_DETECTED",
        nextAction: "STOP — Korean Market Observation must remain immutable",
      };
    }

    const reportBase = {
      schemaVersion: MLB_POSTGAME_OPS_SCHEMA,
      dateKst,
      dryRun,
      assessOnly,
      generatedAt: new Date().toISOString(),
      opsSuccess,
      lifecycle: (opsSuccess
        ? "AWAITING_RESULT"
        : "OPS_FAILURE") as MlbPostgameLifecycleStatus,
      failure,
      provenance: preflight.provenance,
      resultsStatus,
      allResearch: null,
      engineGoodPicks,
      passTracking,
      koreanMarketBaseline,
      dailyLearningPlain:
        "Official results artifact 없음 — AWAITING_RESULTS. Prediction/Record/Korean Market 미수정.",
      researchQuestions: [
        "경기 종료 후 Official Result가 들어오면 Good Pick 표본을 닫을 수 있는가?",
      ],
      trackerLine: null,
      immutableAudit,
      stagesRun: [...stagesRun, "OPERATOR_SUMMARY"] as MlbPostgameStageName[],
      nextAction: opsSuccess
        ? "AWAIT_OFFICIAL_RESULTS"
        : failure?.nextAction ?? "STOP",
    };
    return {
      ...reportBase,
      operatorSummaryText: formatMlbPostgameOpsOperatorSummary(reportBase),
    };
  }

  // Partial results: still allow grade of FINAL games, but do not pretend day is complete.
  let gradedDoc: Record<string, unknown> | null = null;
  if (!readOnly) {
    stagesRun.push("GRADE_RESEARCH");
    const graded = await gradeMlbPredictionsV1({
      dateKst,
      cwd,
      results: resultsDoc,
    });
    gradedDoc = graded.document as unknown as Record<string, unknown>;
    stagesRun.push("DAILY_REVIEW");
    await buildMlbPredictionReviewsV1({
      dateKst,
      cwd,
      graded: graded.document,
    });
  } else {
    stagesRun.push("GRADE_RESEARCH");
    stagesRun.push("DAILY_REVIEW");
    try {
      gradedDoc = JSON.parse(
        readFileSync(
          path.join(
            cwd,
            "data",
            "research",
            "mlb",
            `${dateKst}-graded-predictions-v1.json`,
          ),
          "utf8",
        ),
      ) as Record<string, unknown>;
    } catch {
      gradedDoc = null;
    }
  }

  stagesRun.push("GOOD_PICK_FEEDBACK");
  const feedback = await loadGoodPickFeedbackV1({ dateKst, cwd });

  stagesRun.push("GRADE_ENGINE_RECORD");
  const engineGoodPicks = await gradeEngineRecommendationRecord({
    dateKst,
    cwd,
    generatedBeforeGame: preflight.provenance.generatedBeforeGame,
    feedbackGames: feedback.games,
  });

  stagesRun.push("LEARNING_TRACKER");
  const tracker = await loadGoodPickLearningTrackerV1({
    dates: [dateKst],
    cwd,
  });
  const trackerDay = tracker.days.find((d) => d.dateKst === dateKst);
  const trackerLine = trackerDay?.line ?? null;

  const allResearch = allResearchFromGraded(
    gradedDoc,
    feedback.allResearch
      ? {
          totalGames: feedback.allResearch.totalGames,
          graded: feedback.allResearch.graded,
          correct: feedback.allResearch.correct,
          incorrect: feedback.allResearch.incorrect,
          pending: 0,
          accuracyPercent: feedback.allResearch.accuracyPercent,
          brier: feedback.allResearch.brier,
          logLoss: feedback.allResearch.logLoss,
        }
      : null,
  );

  const lifecycle = resolveLifecycle({
    preflightOk: true,
    noSnapshot: false,
    results: resultsStatus,
    enginePending: engineGoodPicks.pending,
    engineGraded: engineGoodPicks.correct + engineGoodPicks.incorrect,
    researchGraded: allResearch?.graded ?? 0,
  });

  let nextAction = "REVIEW_WITH_OPERATOR";
  if (lifecycle === "AWAITING_RESULT") {
    nextAction =
      resultsStatus.final === 0
        ? "AWAIT_OFFICIAL_RESULTS"
        : "AWAIT_REMAINING_FINAL_RESULTS";
  } else if (lifecycle === "COMPLETED" || lifecycle === "REVIEW_READY") {
    nextAction = "SUCCESS_FAILURE_REVIEW";
  }

  stagesRun.push("OPERATOR_SUMMARY");
  const immutableAudit = audit.finish();

  if (!immutableAudit.predictionUnchanged) {
    const reportFail = {
      schemaVersion: MLB_POSTGAME_OPS_SCHEMA,
      dateKst,
      dryRun,
      assessOnly,
      generatedAt: new Date().toISOString(),
      opsSuccess: false,
      lifecycle: "OPS_FAILURE" as const,
      failure: {
        stage: "PREFLIGHT" as const,
        reason: "PREDICTION_MUTATION_DETECTED",
        nextAction: "STOP — Prediction Snapshot must remain immutable",
      },
      provenance: preflight.provenance,
      resultsStatus,
      allResearch,
      engineGoodPicks,
      passTracking,
      koreanMarketBaseline,
      dailyLearningPlain: feedback.dailyLearning?.plain ?? null,
      researchQuestions: feedback.dailyLearning?.researchQuestions ?? [],
      trackerLine,
      immutableAudit,
      stagesRun,
      nextAction: "STOP — Prediction Snapshot must remain immutable",
    };
    return {
      ...reportFail,
      operatorSummaryText: formatMlbPostgameOpsOperatorSummary(reportFail),
    };
  }
  if (!immutableAudit.recommendationUnchanged) {
    const reportFail = {
      schemaVersion: MLB_POSTGAME_OPS_SCHEMA,
      dateKst,
      dryRun,
      assessOnly,
      generatedAt: new Date().toISOString(),
      opsSuccess: false,
      lifecycle: "OPS_FAILURE" as const,
      failure: {
        stage: "GRADE_ENGINE_RECORD" as const,
        reason: "RECOMMENDATION_RECORD_MUTATION_DETECTED",
        nextAction: "STOP — Recommendation Record must remain immutable",
      },
      provenance: preflight.provenance,
      resultsStatus,
      allResearch,
      engineGoodPicks,
      passTracking,
      koreanMarketBaseline,
      dailyLearningPlain: feedback.dailyLearning?.plain ?? null,
      researchQuestions: feedback.dailyLearning?.researchQuestions ?? [],
      trackerLine,
      immutableAudit,
      stagesRun,
      nextAction: "STOP — Recommendation Record must remain immutable",
    };
    return {
      ...reportFail,
      operatorSummaryText: formatMlbPostgameOpsOperatorSummary(reportFail),
    };
  }
  if (!immutableAudit.koreanMarketUnchanged) {
    const reportFail = {
      schemaVersion: MLB_POSTGAME_OPS_SCHEMA,
      dateKst,
      dryRun,
      assessOnly,
      generatedAt: new Date().toISOString(),
      opsSuccess: false,
      lifecycle: "OPS_FAILURE" as const,
      failure: {
        stage: "KOREAN_MARKET_BASELINE" as const,
        reason: "KOREAN_MARKET_MUTATION_DETECTED",
        nextAction: "STOP — Korean Market Observation must remain immutable",
      },
      provenance: preflight.provenance,
      resultsStatus,
      allResearch,
      engineGoodPicks,
      passTracking,
      koreanMarketBaseline,
      dailyLearningPlain: feedback.dailyLearning?.plain ?? null,
      researchQuestions: feedback.dailyLearning?.researchQuestions ?? [],
      trackerLine,
      immutableAudit,
      stagesRun,
      nextAction: "STOP — Korean Market Observation must remain immutable",
    };
    return {
      ...reportFail,
      operatorSummaryText: formatMlbPostgameOpsOperatorSummary(reportFail),
    };
  }

  const reportBase = {
    schemaVersion: MLB_POSTGAME_OPS_SCHEMA,
    dateKst,
    dryRun,
    assessOnly,
    generatedAt: new Date().toISOString(),
    opsSuccess: true,
    lifecycle,
    failure: null,
    provenance: preflight.provenance,
    resultsStatus,
    allResearch,
    engineGoodPicks,
    passTracking,
    koreanMarketBaseline,
    dailyLearningPlain: feedback.dailyLearning?.plain ?? null,
    researchQuestions: feedback.dailyLearning?.researchQuestions ?? [],
    trackerLine,
    immutableAudit,
    stagesRun,
    nextAction,
  };

  return {
    ...reportBase,
    operatorSummaryText: formatMlbPostgameOpsOperatorSummary(reportBase),
  };
}
