import { readFile } from "node:fs/promises";
import { writeJsonAtomic } from "./build-mlb-schedule-artifact";
import {
  MLB_DAILY_REVIEW_SUMMARY_SCHEMA,
  MLB_FAILURE_REVIEW_SCHEMA,
  MLB_SUCCESS_REVIEW_SCHEMA,
  type DailyReviewStatus,
  type LeakageAuditStatus,
  type MlbGradedPredictionsDocument,
  type ReviewAssessment,
} from "./mlb-prediction-review-types";
import {
  absFromRel,
  mlbDailyReviewSummaryRel,
  mlbFailureReviewRel,
  mlbGradedPredictionsRel,
  mlbOfficialResultsRel,
  mlbPredictionSnapshotRel,
  mlbSuccessReviewRel,
} from "./mlb-prediction-review-paths";
import { sha256 } from "./mlb-review-hash";
import { asRecord, asString } from "./mlb-review-utils";
import {
  auditV0MetaHashes,
  detectPredictionContract,
  verifyPredictionHash,
  type HashValidationMethod,
} from "./prediction-contract-v1";
import {
  isInvalidForPregame,
  loadPredictionValidityV0,
} from "./prediction-validity-v0";
import {
  buildFailureCausesV2,
  buildFailureCategoryTable,
  buildPredictionConfidenceHistogram,
  buildWhyCorrect,
  classifyFailureCategories,
  classifySuccessCategories,
  countCategories,
  formatFailureCategoryTableText,
  scoreDiffText,
  type FailureCategoryTableRow,
  type MlbReviewFailureCategory,
  type MlbReviewSuccessCategory,
  type PredictionConfidenceHistogram,
  type WhyCorrectItem,
} from "./review-classify-v2";

type PredictionRow = Record<string, unknown>;

export type MlbSuccessReviewGame = {
  gamePk: number | null;
  gameId: string;
  pick: string | null;
  pickSide: "HOME" | "AWAY" | null;
  actualWinner: "HOME" | "AWAY" | "DRAW" | null;
  homeScore: number | null;
  awayScore: number | null;
  predictionProbability: number | null;
  inputStatus: string;
  baselineStatus: string | null;
  starterStatus: string;
  oddsStatus: string;
  lineupStatus: string;
  inputWarnings: string[];
  successCategories: MlbReviewSuccessCategory[];
  /** Review v2: why the pick appears correct (research-only) */
  whyCorrect: WhyCorrectItem[];
  possibleFactors: Array<{
    factor: string;
    assessment: ReviewAssessment;
    evidence: string;
  }>;
  counterInterpretation: string;
  reviewConfidence: "LOW" | "MEDIUM" | "HIGH";
  observationOnly?: boolean;
};

export type MlbSuccessReviewDocument = {
  schemaVersion: typeof MLB_SUCCESS_REVIEW_SCHEMA;
  dateKst: string;
  generatedAt: string;
  gradedArtifact: string;
  gradedHash: string;
  reviewHash: string;
  reviewLayerVersion: "mlb-research-review-v2";
  games: MlbSuccessReviewGame[];
};

export type MlbFailureCause = {
  category: string;
  assessment: ReviewAssessment;
  evidence: string;
};

export type MlbFailureReviewGame = {
  gamePk: number | null;
  gameId: string;
  pick: string | null;
  pickSide: "HOME" | "AWAY" | null;
  actualWinner: "HOME" | "AWAY" | "DRAW" | null;
  homeScore: number | null;
  awayScore: number | null;
  predictionProbability: number | null;
  inputStatus: string;
  inputWarnings: string[];
  starterCompleteness: string;
  oddsAvailability: string;
  lineupCutoffStatus: string;
  unexpectedOutcome: string;
  /** Review v2 primary auto tags */
  failureCategories: MlbReviewFailureCategory[];
  possibleCauses: MlbFailureCause[];
  dataQualityRisk: string;
  modelJudgmentRisk: string;
  volatilityRisk: string;
  devilsAdvocate: string;
  alternativeHypothesis: string;
  conclusion: ReviewAssessment;
  observationOnly?: boolean;
};

export type MlbFailureReviewDocument = {
  schemaVersion: typeof MLB_FAILURE_REVIEW_SCHEMA;
  dateKst: string;
  generatedAt: string;
  gradedArtifact: string;
  gradedHash: string;
  reviewHash: string;
  reviewLayerVersion: "mlb-research-review-v2";
  games: MlbFailureReviewGame[];
};

export type LeakageAuditResult = {
  status: LeakageAuditStatus;
  checks: Array<{
    id: string;
    status: LeakageAuditStatus;
    detail: string;
  }>;
  predictionHashVerified: boolean;
  hashValidationMethod?: HashValidationMethod;
  predictionContract?: "LEGACY_V1" | "RESEARCH_BASELINE_V0" | "UNKNOWN";
  inputHash: string | null;
};

export type MlbDailyReviewSummaryDocument = {
  schemaVersion: typeof MLB_DAILY_REVIEW_SUMMARY_SCHEMA;
  dateKst: string;
  generatedAt: string;
  reviewHash: string;
  reviewLayerVersion: "mlb-research-review-v2";
  artifacts: {
    prediction: string;
    result: string;
    graded: string;
    successReview: string;
    failureReview: string;
  };
  hashes: {
    predictionHash: string;
    resultHash: string;
    gradedHash: string;
    inputHash: string | null;
    successReviewHash: string;
    failureReviewHash: string;
  };
  gradeCounts: MlbGradedPredictionsDocument["summary"];
  officialPerformance?: {
    eligiblePredictions: number;
    officialSampleCount: number;
    officialGraded: number;
    officialCorrect: number;
    officialIncorrect: number;
    officialAccuracy: string | number | null;
  };
  researchPerformance?: {
    researchCandidates: number;
    researchGraded: number;
    researchCorrect: number;
    researchIncorrect: number;
    researchAccuracy: string | number | null;
    researchBrier: number | null;
    researchLogLoss: number | null;
    modelVersion: string | null;
  };
  blockedPolicy?: {
    blockedGames: number;
    blockedCounterfactualCorrect: number;
    blockedCounterfactualIncorrect: number;
  };
  failureCategoryCount: Record<string, number>;
  successCategoryCount: Record<string, number>;
  /** Per-game Failure Category table (Acceptance appendix) */
  failureCategoryTable: FailureCategoryTableRow[];
  predictionConfidenceHistogram: PredictionConfidenceHistogram;
  leakageAudit: LeakageAuditResult;
  reviewStatus: DailyReviewStatus;
  successPatterns: string[];
  failurePatterns: string[];
  dataQualityWarnings: string[];
  assistantSummary: string;
};

function readInputManifestStatus(
  manifest: Record<string, unknown> | null,
  key: "starter" | "odds" | "lineup",
): string {
  const inputs = asRecord(manifest?.inputs);
  const row = asRecord(inputs?.[key]);
  if (!row) return "UNKNOWN";
  return asString(row.status) ?? asString(row.datasetStatus) ?? "UNKNOWN";
}

function buildSuccessGame(
  graded: MlbGradedPredictionsDocument["games"][number],
  pred: PredictionRow | undefined,
  manifest: Record<string, unknown> | null,
): MlbSuccessReviewGame {
  const inputWarnings = graded.inputWarnings;
  const successCategories = classifySuccessCategories(graded, pred);
  const whyCorrect = buildWhyCorrect(graded, pred, successCategories);

  const factors: MlbSuccessReviewGame["possibleFactors"] = whyCorrect.map(
    (w) => ({
      factor: w.category,
      assessment: w.assessment,
      evidence: w.evidence,
    }),
  );

  const m =
    graded.homeScore != null && graded.awayScore != null
      ? Math.abs(graded.homeScore - graded.awayScore)
      : null;

  return {
    gamePk: graded.gamePk,
    gameId: graded.gameId,
    pick: graded.pickTeam,
    pickSide: graded.pick,
    actualWinner: graded.actualWinner,
    homeScore: graded.homeScore,
    awayScore: graded.awayScore,
    predictionProbability: graded.predictionProbability,
    inputStatus: graded.inputStatus,
    baselineStatus: graded.baselineStatus,
    starterStatus: readInputManifestStatus(manifest, "starter"),
    oddsStatus: readInputManifestStatus(manifest, "odds"),
    lineupStatus: readInputManifestStatus(manifest, "lineup"),
    inputWarnings,
    successCategories,
    whyCorrect,
    possibleFactors: factors,
    counterInterpretation:
      m === 1
        ? "One-run win: correct side does not prove model skill; variance dominates."
        : m != null && m >= 5
          ? "Blowout win: stronger outcome signal, still not causal proof for any single feature."
          : "A correct pick does not validate any single input variable; outcome may reflect variance or unmodeled game flow.",
    reviewConfidence:
      successCategories.includes("MODEL_ALIGNMENT") &&
      inputWarnings.filter((w) => !/^BULLPEN_WEIGHT_DISABLED/i.test(w)).length ===
        0
        ? "MEDIUM"
        : "LOW",
    observationOnly: graded.researchGrade?.observationOnly === true,
  };
}

function buildFailureGame(
  graded: MlbGradedPredictionsDocument["games"][number],
  pred: PredictionRow | undefined,
  manifest: Record<string, unknown> | null,
): MlbFailureReviewGame {
  const inputWarnings = graded.inputWarnings;
  const failureCategories = classifyFailureCategories(graded, pred);
  const causes = buildFailureCausesV2(graded, pred, failureCategories);
  const scoreText = scoreDiffText(graded.homeScore, graded.awayScore);
  const m =
    graded.homeScore != null && graded.awayScore != null
      ? Math.abs(graded.homeScore - graded.awayScore)
      : null;

  const primary = failureCategories[0] ?? "UNKNOWN";
  const categoryNarrative = failureCategories.join(", ");

  return {
    gamePk: graded.gamePk,
    gameId: graded.gameId,
    pick: graded.pickTeam,
    pickSide: graded.pick,
    actualWinner: graded.actualWinner,
    homeScore: graded.homeScore,
    awayScore: graded.awayScore,
    predictionProbability: graded.predictionProbability,
    inputStatus: graded.inputStatus,
    inputWarnings,
    starterCompleteness: readInputManifestStatus(manifest, "starter"),
    oddsAvailability: readInputManifestStatus(manifest, "odds"),
    lineupCutoffStatus: readInputManifestStatus(manifest, "lineup"),
    unexpectedOutcome: `Pick ${graded.pick ?? "?"} lost; final ${scoreText}; tags=[${categoryNarrative}]`,
    failureCategories,
    possibleCauses: causes,
    dataQualityRisk: inputWarnings.some(
      (w) => !/^BULLPEN_WEIGHT_DISABLED/i.test(w),
    )
      ? `Input gaps may have contributed (${inputWarnings.filter((w) => !/^BULLPEN_WEIGHT_DISABLED/i.test(w)).join(", ")}).`
      : "No major non-bullpen input warnings; look at outcome shape and market/starter tags.",
    modelJudgmentRisk:
      graded.predictionProbability != null && graded.predictionProbability >= 0.58
        ? `Higher pick-side probability (${(graded.predictionProbability * 100).toFixed(1)}%) still missed — review calibration.`
        : "Pick-side probability was not strongly directional; miss is less informative for model judgment.",
    volatilityRisk:
      m === 1
        ? "One-run final — treat as high-volatility miss."
        : m != null && m >= 5
          ? "Blowout miss — check market/starter misread rather than pure coin-flip."
          : "Single-game MLB outcomes are high variance; one miss is not conclusive.",
    devilsAdvocate:
      primary === "ONE_RUN_GAME"
        ? "A one-run loss can occur with a reasonable pre-game pick; do not overfit."
        : primary === "BLOWOUT"
          ? "A blowout may reflect unmodeled team/news factors rather than a stable feature failure."
          : primary === "LINEUP"
            ? "Missing lineup may have changed the true matchup; the model never saw confirmed bats."
            : "The pick may have been reasonable pre-game; late leverage or sequencing could explain the loss.",
    alternativeHypothesis:
      failureCategories.includes("MARKET")
        ? "Market may have already priced the true favorite; model edge was noise."
        : failureCategories.includes("STARTER")
          ? "Starter signal may have been incomplete or wrong-sided versus actual outing."
          : failureCategories.includes("BULLPEN")
            ? "Late bullpen leverage / sequencing may dominate final winner more than starter/odds."
            : "Actual winner may reflect small-sample offense or defensive variance.",
    conclusion: "INVESTIGATE_MORE",
    observationOnly: graded.researchGrade?.observationOnly === true,
  };
}

function runLeakageAudit(input: {
  predictionRaw: string;
  prediction: Record<string, unknown>;
  resultGeneratedAt: string | null;
}): LeakageAuditResult {
  const checks: LeakageAuditResult["checks"] = [];
  const meta = asRecord(input.prediction.meta);
  const manifest = asRecord(meta?.inputManifest);
  const predictedAt = asString(meta?.predictedAt) ?? asString(
    (Array.isArray(input.prediction.predictions)
      ? (input.prediction.predictions[0] as Record<string, unknown> | undefined)
      : undefined)?.predictedAt,
  );
  const cutoffTime = asString(manifest?.cutoffTime);
  const contract = detectPredictionContract(input.prediction);
  const hashVerify = verifyPredictionHash(input.prediction);

  let status: LeakageAuditStatus = "PASS";

  if (contract === "UNKNOWN") {
    checks.push({
      id: "prediction_contract",
      status: "FAIL",
      detail: "UNSUPPORTED_PREDICTION_CONTRACT",
    });
    status = "FAIL";
  } else if (!hashVerify.verified) {
    checks.push({
      id: "prediction_hash",
      status: "FAIL",
      detail: hashVerify.detail,
    });
    status = "FAIL";
  } else {
    checks.push({
      id: "prediction_hash",
      status: "PASS",
      detail: `${hashVerify.method}: ${hashVerify.detail}`,
    });
  }

  if (contract === "RESEARCH_BASELINE_V0") {
    const metaAudit = auditV0MetaHashes(input.prediction);
    for (const w of metaAudit.warnings) {
      checks.push({
        id: "v0_meta_hash_format",
        status: "WARN",
        detail: w,
      });
      if (status === "PASS") status = "WARN";
    }
    // Missing legacy inputManifest object is NOT a failure for v0
    checks.push({
      id: "input_manifest_object",
      status: "PASS",
      detail:
        "v0 uses inputManifestHash; absence of legacy inputManifest object is not leakage",
    });
  }

  if (predictedAt && cutoffTime && predictedAt > cutoffTime) {
    checks.push({
      id: "predicted_after_slate_cutoff",
      status: "WARN",
      detail: `predictedAt (${predictedAt}) is after slate cutoffTime (${cutoffTime}); per-game ELIGIBLE inputs validated separately`,
    });
    if (status === "PASS") status = "WARN";
  } else if (cutoffTime) {
    checks.push({
      id: "predicted_before_slate_cutoff",
      status: "PASS",
      detail: "predictedAt is on or before slate cutoff",
    });
  } else if (contract === "RESEARCH_BASELINE_V0") {
    checks.push({
      id: "predicted_before_slate_cutoff",
      status: "PASS",
      detail:
        "legacy slate cutoffTime not present on v0 meta; commence-time leakage checked separately when available",
    });
  } else {
    checks.push({
      id: "predicted_before_slate_cutoff",
      status: "PASS",
      detail: "predictedAt is on or before slate cutoff",
    });
  }

  const manifestWarnings = Array.isArray(manifest?.warnings)
    ? manifest!.warnings.map((w) => String(w))
    : [];
  const postGameLeak = manifestWarnings.some((w) =>
    /POST_GAME|after cutoff|BLOCKED/i.test(w),
  );
  if (postGameLeak) {
    checks.push({
      id: "input_manifest_warnings",
      status: "WARN",
      detail: "input manifest contains post-game or blocked warnings",
    });
    if (status === "PASS") status = "WARN";
  } else {
    checks.push({
      id: "input_manifest_warnings",
      status: "PASS",
      detail: "no post-game leakage warnings in manifest",
    });
  }

  if (
    input.resultGeneratedAt &&
    predictedAt &&
    input.resultGeneratedAt < predictedAt
  ) {
    checks.push({
      id: "result_before_prediction",
      status: "WARN",
      detail:
        "result artifact timestamp predates prediction (clock skew or stale result file)",
    });
    if (status === "PASS") status = "WARN";
  }

  return {
    status,
    checks,
    predictionHashVerified: hashVerify.verified,
    hashValidationMethod: hashVerify.method,
    predictionContract: contract,
    inputHash:
      asString(manifest?.inputHash) ?? asString(meta?.inputManifestHash),
  };
}

function resolveReviewStatus(input: {
  graded: MlbGradedPredictionsDocument;
  leakage: LeakageAuditStatus;
  contract: ReturnType<typeof detectPredictionContract>;
  invalidForPregame?: boolean;
}): DailyReviewStatus {
  if (input.invalidForPregame) return "PREDICTION_INVALID_FOR_PREGAME";
  if (input.contract === "UNKNOWN") return "RESEARCH_INVALID";
  if (input.leakage === "FAIL") return "RESEARCH_INVALID";

  const s = input.graded.summary;
  const researchGradable =
    (s.researchCandidates ?? 0) > 0
      ? (s.researchCandidates ?? 0)
      : s.eligiblePredictions + s.limitedInputPredictions;
  const pending = s.pending;

  if (researchGradable === 0 && s.graded === 0) {
    return s.blocked === s.totalGames ? "PARTIAL_REVIEW" : "AWAITING_RESULTS";
  }
  if (pending >= researchGradable && s.graded === 0) return "AWAITING_RESULTS";
  if (pending > 0) return "PARTIAL_REVIEW";
  return "VALID_REVIEW";
}

function buildAssistantSummary(
  dateKst: string,
  graded: MlbGradedPredictionsDocument,
  reviewStatus: DailyReviewStatus,
  failurePatterns: string[],
  failureCategoryCount: Record<string, number>,
  successCategoryCount: Record<string, number>,
  failureCategoryTable: FailureCategoryTableRow[],
): string {
  const s = graded.summary;
  const officialAcc =
    s.officialAccuracy?.status === "N/A" || s.officialSampleCount === 0
      ? "N/A"
      : s.officialAccuracy?.percent != null
        ? `${s.officialAccuracy.percent}%`
        : "N/A";
  const researchAcc =
    s.researchAccuracy?.status === "OK" && s.researchAccuracy.percent != null
      ? `${s.researchAccuracy.percent}%`
      : s.researchGraded && s.researchGraded > 0
        ? `${(((s.researchCorrect ?? 0) / s.researchGraded) * 100).toFixed(1)}%`
        : "N/A";
  const failureText =
    failurePatterns.length > 0
      ? failurePatterns.join(", ")
      : "none identified";
  const failCountText = Object.entries(failureCategoryCount)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const successCountText = Object.entries(successCategoryCount)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return [
    `MLB Daily Review — ${dateKst} (research-review-v2)`,
    `Prediction contract: ${s.predictionContract ?? "UNKNOWN"}`,
    `Eligible predictions (official): ${s.eligiblePredictions}`,
    `Official sample: ${s.officialSampleCount ?? 0}`,
    `Official Accuracy: ${officialAcc}`,
    `Research candidates: ${s.researchCandidates ?? 0}`,
    `Research graded: ${s.researchGraded ?? 0}`,
    `Research correct/incorrect: ${s.researchCorrect ?? 0}/${s.researchIncorrect ?? 0}`,
    `Research Accuracy: ${researchAcc}`,
    `Research Brier: ${s.researchMeanBrier ?? "null"}`,
    `Research LogLoss: ${s.researchMeanLogLoss ?? "null"}`,
    `Blocked games: ${s.blocked}`,
    `Failure categories: ${failCountText || "none"}`,
    `Success categories: ${successCountText || "none"}`,
    `Primary failure candidates: ${failureText}`,
    `Conclusion: ${reviewStatus === "RESEARCH_INVALID" ? "RESEARCH_INVALID" : "DATA_ACCUMULATION_CONTINUES"}`,
    "",
    formatFailureCategoryTableText(failureCategoryTable),
  ].join("\n");
}

export async function buildMlbPredictionReviewsV1(input: {
  dateKst: string;
  cwd?: string;
  graded?: MlbGradedPredictionsDocument;
}): Promise<{
  success: MlbSuccessReviewDocument;
  failure: MlbFailureReviewDocument;
  daily: MlbDailyReviewSummaryDocument;
  paths: {
    success: string;
    failure: string;
    daily: string;
  };
}> {
  const cwd = input.cwd ?? process.cwd();
  const gradedRel = mlbGradedPredictionsRel(input.dateKst);

  let graded = input.graded;
  if (!graded) {
    const raw = await readFile(absFromRel(gradedRel, cwd), "utf8");
    graded = JSON.parse(raw) as MlbGradedPredictionsDocument;
  }

  const predictionRel = mlbPredictionSnapshotRel(input.dateKst);
  const predictionRaw = await readFile(absFromRel(predictionRel, cwd), "utf8");
  const prediction = JSON.parse(predictionRaw) as Record<string, unknown>;
  const predById = new Map<string, PredictionRow>(
    (Array.isArray(prediction.predictions) ? prediction.predictions : []).map(
      (p) => {
        const row = p as PredictionRow;
        return [asString(row.gameId) ?? "", row];
      },
    ),
  );
  const manifest = asRecord(asRecord(prediction.meta)?.inputManifest);

  const resultRel = mlbOfficialResultsRel(input.dateKst);
  const resultDoc = JSON.parse(
    await readFile(absFromRel(resultRel, cwd), "utf8"),
  ) as { generatedAt?: string; resultHash?: string };

  const successGames = graded.games
    .filter((g) => g.grade === "CORRECT")
    .map((g) => buildSuccessGame(g, predById.get(g.gameId), manifest));

  const failureGames = graded.games
    .filter((g) => g.grade === "INCORRECT")
    .map((g) => buildFailureGame(g, predById.get(g.gameId), manifest));

  const failurePatterns = [
    ...new Set(failureGames.flatMap((g) => g.failureCategories)),
  ];

  const successPatterns = [
    ...new Set(successGames.flatMap((g) => g.successCategories)),
  ];

  const failureCategoryCount = countCategories(
    failureGames.map((g) => g.failureCategories),
  );
  const successCategoryCount = countCategories(
    successGames.map((g) => g.successCategories),
  );

  const failureCategoryTable = buildFailureCategoryTable(
    failureGames.map((g) => {
      const pred = predById.get(g.gameId);
      return {
        gameId: g.gameId,
        gamePk: g.gamePk,
        homeTeam: asString(pred?.homeTeam),
        awayTeam: asString(pred?.awayTeam),
        failureCategories: g.failureCategories,
      };
    }),
  );

  const predictionConfidenceHistogram = buildPredictionConfidenceHistogram(
    (Array.isArray(prediction.predictions) ? prediction.predictions : []).map(
      (p) => {
        const row = p as PredictionRow;
        const c = row.confidence;
        return typeof c === "number" ? c : null;
      },
    ),
  );

  const dataQualityWarnings = [
    ...new Set(
      graded.games.flatMap((g) => g.inputWarnings).filter(Boolean),
    ),
  ];

  const leakageAudit = runLeakageAudit({
    predictionRaw,
    prediction,
    resultGeneratedAt: asString(resultDoc.generatedAt),
  });

  const validity = await loadPredictionValidityV0({
    dateKst: input.dateKst,
    cwd,
  });
  const reviewStatus = resolveReviewStatus({
    graded,
    leakage: leakageAudit.status,
    contract:
      leakageAudit.predictionContract ?? detectPredictionContract(prediction),
    invalidForPregame: isInvalidForPregame(validity),
  });

  const blockedCf = graded.games.filter((g) => g.blockedCounterfactual);
  const blockedCorrect = blockedCf.filter(
    (g) => g.blockedCounterfactual?.result === "CORRECT",
  ).length;
  const blockedIncorrect = blockedCf.filter(
    (g) => g.blockedCounterfactual?.result === "INCORRECT",
  ).length;

  const successHashBody = {
    schemaVersion: MLB_SUCCESS_REVIEW_SCHEMA,
    dateKst: input.dateKst,
    gradedArtifact: `${input.dateKst}-graded-predictions-v1.json`,
    gradedHash: sha256({
      schemaVersion: graded.schemaVersion,
      dateKst: graded.dateKst,
      predictionHash: graded.predictionHash,
      resultHash: graded.resultHash,
      games: graded.games,
    }),
    reviewLayerVersion: "mlb-research-review-v2" as const,
    games: successGames,
  };

  const failureHashBody = {
    schemaVersion: MLB_FAILURE_REVIEW_SCHEMA,
    dateKst: input.dateKst,
    gradedArtifact: `${input.dateKst}-graded-predictions-v1.json`,
    gradedHash: successHashBody.gradedHash,
    reviewLayerVersion: "mlb-research-review-v2" as const,
    games: failureGames,
  };

  const success: MlbSuccessReviewDocument = {
    ...successHashBody,
    generatedAt: new Date().toISOString(),
    reviewHash: sha256(successHashBody),
    games: successGames,
  };

  const failure: MlbFailureReviewDocument = {
    ...failureHashBody,
    generatedAt: new Date().toISOString(),
    reviewHash: sha256(failureHashBody),
    games: failureGames,
  };

  const dailyHashBody = {
    schemaVersion: MLB_DAILY_REVIEW_SUMMARY_SCHEMA,
    dateKst: input.dateKst,
    reviewLayerVersion: "mlb-research-review-v2" as const,
    artifacts: {
      prediction: predictionRel,
      result: resultRel,
      graded: gradedRel,
      successReview: mlbSuccessReviewRel(input.dateKst),
      failureReview: mlbFailureReviewRel(input.dateKst),
    },
    hashes: {
      predictionHash: graded.predictionHash,
      resultHash: graded.resultHash,
      gradedHash: successHashBody.gradedHash,
      inputHash: leakageAudit.inputHash,
      successReviewHash: success.reviewHash,
      failureReviewHash: failure.reviewHash,
    },
    gradeCounts: graded.summary,
    officialPerformance: {
      eligiblePredictions: graded.summary.eligiblePredictions,
      officialSampleCount: graded.summary.officialSampleCount ?? 0,
      officialGraded: graded.summary.officialGraded ?? 0,
      officialCorrect: graded.summary.officialCorrect ?? 0,
      officialIncorrect: graded.summary.officialIncorrect ?? 0,
      officialAccuracy:
        graded.summary.officialAccuracy?.status === "N/A" ||
        (graded.summary.officialSampleCount ?? 0) === 0
          ? "N/A"
          : (graded.summary.officialAccuracy?.percent ?? null),
    },
    researchPerformance: {
      researchCandidates: graded.summary.researchCandidates ?? 0,
      researchGraded: graded.summary.researchGraded ?? 0,
      researchCorrect: graded.summary.researchCorrect ?? 0,
      researchIncorrect: graded.summary.researchIncorrect ?? 0,
      researchAccuracy:
        graded.summary.researchAccuracy?.percent ??
        (graded.summary.researchGraded
          ? graded.summary.researchCorrect! / graded.summary.researchGraded
          : null),
      researchBrier: graded.summary.researchMeanBrier ?? null,
      researchLogLoss: graded.summary.researchMeanLogLoss ?? null,
      modelVersion: graded.summary.modelVersion ?? null,
    },
    blockedPolicy: {
      blockedGames: graded.summary.blocked,
      blockedCounterfactualCorrect: blockedCorrect,
      blockedCounterfactualIncorrect: blockedIncorrect,
    },
    failureCategoryCount,
    successCategoryCount,
    failureCategoryTable,
    predictionConfidenceHistogram,
    leakageAudit,
    reviewStatus,
    successPatterns,
    failurePatterns,
    dataQualityWarnings,
  };

  const daily: MlbDailyReviewSummaryDocument = {
    ...dailyHashBody,
    generatedAt: new Date().toISOString(),
    reviewHash: sha256(dailyHashBody),
    assistantSummary: buildAssistantSummary(
      input.dateKst,
      graded,
      reviewStatus,
      failurePatterns,
      failureCategoryCount,
      successCategoryCount,
      failureCategoryTable,
    ),
  };

  const successRel = mlbSuccessReviewRel(input.dateKst);
  const failureRel = mlbFailureReviewRel(input.dateKst);
  const dailyRel = mlbDailyReviewSummaryRel(input.dateKst);

  await writeJsonAtomic(absFromRel(successRel, cwd), success);
  await writeJsonAtomic(absFromRel(failureRel, cwd), failure);
  await writeJsonAtomic(absFromRel(dailyRel, cwd), daily);

  return {
    success,
    failure,
    daily,
    paths: { success: successRel, failure: failureRel, daily: dailyRel },
  };
}
