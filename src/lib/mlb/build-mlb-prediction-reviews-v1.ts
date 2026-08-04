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
  const factors: MlbSuccessReviewGame["possibleFactors"] = [];

  if (graded.predictionProbability != null && graded.predictionProbability >= 0.55) {
    factors.push({
      factor: "MODEL_PROBABILITY",
      assessment: "POSSIBLE_SUPPORT",
      evidence: `model probability ${(graded.predictionProbability * 100).toFixed(1)}% aligned with pick`,
    });
  } else {
    factors.push({
      factor: "MODEL_PROBABILITY",
      assessment: "INSUFFICIENT_EVIDENCE",
      evidence: "probability was not strongly directional",
    });
  }

  if (inputWarnings.length === 0) {
    factors.push({
      factor: "INPUT_QUALITY",
      assessment: "CONSISTENT_WITH_HYPOTHESIS",
      evidence: "no input warnings on this game",
    });
  } else {
    factors.push({
      factor: "INPUT_QUALITY",
      assessment: "CONFOUNDED",
      evidence: `input warnings present: ${inputWarnings.join(", ")}`,
    });
  }

  const pitcherDirection = asString(pred?.pitcherDirection);
  if (pitcherDirection) {
    factors.push({
      factor: "STARTER_SIGNAL",
      assessment: "POSSIBLE_SUPPORT",
      evidence: `pitcherDirection=${pitcherDirection}`,
    });
  }

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
    possibleFactors: factors,
    counterInterpretation:
      "A correct pick does not validate any single input variable; outcome may reflect variance or unmodeled game flow.",
    reviewConfidence: inputWarnings.length === 0 ? "MEDIUM" : "LOW",
    observationOnly: graded.researchGrade?.observationOnly === true,
  };
}

function buildFailureGame(
  graded: MlbGradedPredictionsDocument["games"][number],
  pred: PredictionRow | undefined,
  manifest: Record<string, unknown> | null,
): MlbFailureReviewGame {
  const causes: MlbFailureCause[] = [];
  const inputWarnings = graded.inputWarnings;

  if (inputWarnings.length > 0) {
    causes.push({
      category: "DATA_QUALITY",
      assessment: "POSSIBLE",
      evidence: inputWarnings.join("; "),
    });
  }

  const pitcherDirection = asString(pred?.pitcherDirection);
  if (pitcherDirection && pitcherDirection !== "NEUTRAL") {
    causes.push({
      category: "STARTER",
      assessment: "WEAK_SUPPORT",
      evidence: `pre-game pitcherDirection=${pitcherDirection} did not match outcome`,
    });
  }

  causes.push({
    category: "BULLPEN",
    assessment: "POSSIBLE",
    evidence: "bullpen usage and leverage not verified in this review pass",
  });

  if (graded.predictionProbability != null && graded.predictionProbability >= 0.6) {
    causes.push({
      category: "MODEL_OVERCONFIDENCE",
      assessment: "POSSIBLE",
      evidence: `model showed ${(graded.predictionProbability * 100).toFixed(1)}% on losing side`,
    });
  }

  const scoreText =
    graded.homeScore != null && graded.awayScore != null
      ? `${graded.awayScore}-${graded.homeScore} (away-home)`
      : "final score unavailable";

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
    unexpectedOutcome: `Pick ${graded.pick ?? "?"} lost; final ${scoreText}`,
    possibleCauses: causes,
    dataQualityRisk:
      inputWarnings.length > 0
        ? "Pre-game inputs carried warnings; failure may reflect data gaps."
        : "No major input warnings; data quality risk appears lower.",
    modelJudgmentRisk:
      "Model side selection did not match final winner; review model features separately.",
    volatilityRisk:
      "Single-game MLB outcomes are high variance; one miss is not conclusive.",
    devilsAdvocate:
      "The pick may have been reasonable pre-game; late-inning bullpen or sequencing variance could explain the loss without invalidating the model.",
    alternativeHypothesis:
      "Actual winner may have been driven by bullpen leverage or small-sample hitting noise rather than starter or odds signals.",
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

  return [
    `MLB Daily Review — ${dateKst}`,
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
    `Primary failure candidates: ${failureText}`,
    `Conclusion: ${reviewStatus === "RESEARCH_INVALID" ? "RESEARCH_INVALID" : "DATA_ACCUMULATION_CONTINUES"}`,
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
    games: successGames,
  };

  const failureHashBody = {
    schemaVersion: MLB_FAILURE_REVIEW_SCHEMA,
    dateKst: input.dateKst,
    gradedArtifact: `${input.dateKst}-graded-predictions-v1.json`,
    gradedHash: successHashBody.gradedHash,
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

  const failurePatterns = [
    ...new Set(
      failureGames.flatMap((g) =>
        g.possibleCauses.map((c) => c.category.toLowerCase()),
      ),
    ),
  ];

  const successPatterns = [
    ...new Set(
      successGames.flatMap((g) =>
        g.possibleFactors
          .filter((f) => f.assessment !== "INSUFFICIENT_EVIDENCE")
          .map((f) => f.factor.toLowerCase()),
      ),
    ),
  ];

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

  const dailyHashBody = {
    schemaVersion: MLB_DAILY_REVIEW_SUMMARY_SCHEMA,
    dateKst: input.dateKst,
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
