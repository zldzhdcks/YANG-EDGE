/**
 * Frozen Prototype v1 Validation shift diagnostic.
 * Consumes sealed model / eval / join / split. Does not train, fit, or open Holdout.
 */
import path from "node:path";
import { MLB_INDEPENDENT_ENGINE_ADMISSION } from "../independent-model-v1";
import type {
  IndependentJoinArtifactV1,
  IndependentJoinRowV1,
} from "../independent-join-v1";
import {
  hashIndependentSplitManifestV1,
  MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
  type IndependentSplitArtifactV1,
} from "../independent-split-v1";
import {
  IndependentLogisticError,
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V1,
  orderedLogisticBaseFeatureNamesV1,
  orderedLogisticMissingIndicatorNamesV1,
  orderedLogisticModelFeatureNamesV1,
} from "../independent-logistic-v1/spec";
import {
  extractRawBaseAndMissing,
  type LogisticPreprocessorV1,
  transformRowV1,
} from "../independent-logistic-v1/preprocess";
import {
  MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
  predictLogisticProbability,
  stableSigmoid,
} from "../independent-logistic-v1/logistic";
import { evaluateProbabilitiesV1 } from "../independent-logistic-v1/metrics";

export const MLB_INDEPENDENT_2024_SEALED_LOGISTIC_CORE_HASH_V1 =
  "7cb5253c824de514c25b1715e6f339b0f35c6942fa25c178423a415ec820430e";

export const MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1 =
  "a72b8586971ee81a04e119c7d860f226abb503b5cc2341bb370d49d2fb47e71d";

export const MLB_INDEPENDENT_LOGISTIC_DIAGNOSTIC_SCHEMA_V1 =
  "mlb-independent-logistic-validation-shift-diagnostic-v1" as const;
export const MLB_INDEPENDENT_LOGISTIC_DIAGNOSTIC_BUILDER_V1 =
  "mlb-independent-logistic-diagnostic-v1" as const;

export const LOGIT_RECONCILE_TOLERANCE_V1 = 1e-12;
export const PROB_REPLAY_TOLERANCE_V1 = 1e-12;

export const SEMANTIC_FEATURE_GROUPS_V1: Record<string, readonly string[]> = {
  SEASON_VOLUME: [
    "home.gamesPlayedBefore",
    "home.winsBefore",
    "home.lossesBefore",
    "away.gamesPlayedBefore",
    "away.winsBefore",
    "away.lossesBefore",
  ],
  RATE_STRENGTH: [
    "home.winRateBefore",
    "home.homeWinRateBefore",
    "home.awayWinRateBefore",
    "away.winRateBefore",
    "away.homeWinRateBefore",
    "away.awayWinRateBefore",
  ],
  RECENT_FORM: [
    "home.last5WinsBefore",
    "home.last5LossesBefore",
    "home.last5WinRateBefore",
    "home.last5RunsScoredAverageBefore",
    "home.last5RunsAllowedAverageBefore",
    "away.last5WinsBefore",
    "away.last5LossesBefore",
    "away.last5WinRateBefore",
    "away.last5RunsScoredAverageBefore",
    "away.last5RunsAllowedAverageBefore",
  ],
  SEASON_RUN_QUALITY: [
    "home.runsScoredAverageBefore",
    "home.runsAllowedAverageBefore",
    "away.runsScoredAverageBefore",
    "away.runsAllowedAverageBefore",
  ],
  STREAK_REST: [
    "home.currentWinStreakBefore",
    "home.currentLossStreakBefore",
    "home.restDaysBefore",
    "away.currentWinStreakBefore",
    "away.currentLossStreakBefore",
    "away.restDaysBefore",
  ],
  HEAD_TO_HEAD: [
    "headToHeadGamesBefore",
    "headToHeadHomeWinsBefore",
    "headToHeadAwayWinsBefore",
  ],
  MISSING_INDICATORS: orderedLogisticMissingIndicatorNamesV1(),
};

const VALIDATION_BINS = [
  { id: "BIN_1", start: "2024-07-20", end: "2024-07-26" },
  { id: "BIN_2", start: "2024-07-27", end: "2024-08-02" },
  { id: "BIN_3", start: "2024-08-03", end: "2024-08-09" },
  { id: "BIN_4", start: "2024-08-10", end: "2024-08-16" },
  { id: "BIN_5", start: "2024-08-17", end: "2024-08-24" },
] as const;

export type FrozenPrototypeModelV1 = {
  modelCoreHash: string;
  sourceJoinArtifactHash: string;
  sourceSplitManifestHash: string;
  trainingSampleCount: number;
  validationSampleCount: number;
  holdoutSampleCount: number;
  holdoutEvaluated: boolean;
  modelPrototype: boolean;
  engineApproved: boolean;
  intercept: number;
  coefficients: number[];
  preprocessing: LogisticPreprocessorV1;
};

export type FrozenEvalRowV1 = {
  gamePk: number;
  probability: number;
};

export type FrozenPrototypeEvalV1 = {
  modelCoreHash: string;
  train: FrozenEvalRowV1[];
  validation: FrozenEvalRowV1[];
};

export type FeatureDriftRowV1 = {
  featureName: string;
  coefficient: number;
  trainMean: number;
  validationMean: number;
  deltaMean: number;
  trainMeanLogitContribution: number;
  validationMeanLogitContribution: number;
  shiftContribution: number;
  absShiftContribution: number;
};

export type DiagnosticClassificationV1 =
  | "SEASON_VOLUME_DOMINANT"
  | "MISSINGNESS_DOMINANT"
  | "OTHER_FEATURES_DOMINANT"
  | "MULTI_FACTOR_SHIFT"
  | "NO_CLEAR_DOMINANT_DRIVER";

export function independentLogisticDiagnosticRel(): string {
  return "data/research/mlb/independent-model-v1/diagnostics/2024-logistic-validation-shift-diagnostic-v1.json";
}
export function independentLogisticDiagnosticPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticDiagnosticRel());
}
export function independentLogisticDiagnosticAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-logistic-validation-shift-audit-v1.json";
}
export function independentLogisticDiagnosticAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentLogisticDiagnosticAuditRel());
}
export function sealedLogisticModelRel(): string {
  return "data/research/mlb/independent-model-v1/model/2024-logistic-regression-prototype-v1.json";
}
export function sealedLogisticModelPath(cwd = process.cwd()): string {
  return path.join(cwd, sealedLogisticModelRel());
}
export function sealedLogisticEvalRel(): string {
  return "data/research/mlb/independent-model-v1/evaluations/2024-logistic-regression-train-validation-v1.json";
}
export function sealedLogisticEvalPath(cwd = process.cwd()): string {
  return path.join(cwd, sealedLogisticEvalRel());
}
export function sealedLogisticPrototypeAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-logistic-regression-prototype-audit-v1.json";
}
export function sealedLogisticPrototypeAuditPath(cwd = process.cwd()): string {
  return path.join(cwd, sealedLogisticPrototypeAuditRel());
}

export function assertSemanticGroupCoverageV1(): void {
  const all = orderedLogisticModelFeatureNamesV1();
  const seen = new Set<string>();
  for (const [group, names] of Object.entries(SEMANTIC_FEATURE_GROUPS_V1)) {
    for (const name of names) {
      if (seen.has(name)) {
        throw new IndependentLogisticError(
          "GROUP_OVERLAP",
          `${name} in ${group}`,
        );
      }
      seen.add(name);
    }
  }
  if (seen.size !== all.length) {
    throw new IndependentLogisticError(
      "GROUP_COVERAGE_MISMATCH",
      `${seen.size} != ${all.length}`,
    );
  }
  for (const name of all) {
    if (!seen.has(name)) {
      throw new IndependentLogisticError("GROUP_MISSING_FEATURE", name);
    }
  }
}

export function pearsonCorrelationV1(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length === 0) {
    throw new IndependentLogisticError(
      "PEARSON_LENGTH_MISMATCH",
      `${xs.length} vs ${ys.length}`,
    );
  }
  const n = xs.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += xs[i]!;
    my += ys[i]!;
  }
  mx /= n;
  my /= n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx <= 0 || dy <= 0) return 0;
  return num / Math.sqrt(dx * dy);
}

export function meanLogitFromMeansV1(
  intercept: number,
  coefficients: number[],
  means: number[],
): number {
  if (coefficients.length !== means.length) {
    throw new IndependentLogisticError(
      "MEAN_LOGIT_DIM_MISMATCH",
      `${coefficients.length} vs ${means.length}`,
    );
  }
  let z = intercept;
  for (let j = 0; j < coefficients.length; j += 1) {
    z += coefficients[j]! * means[j]!;
  }
  return z;
}

export function featureShiftContributionsV1(
  coefficients: number[],
  trainMeans: number[],
  validationMeans: number[],
): FeatureDriftRowV1[] {
  if (
    coefficients.length !== trainMeans.length ||
    coefficients.length !== validationMeans.length
  ) {
    throw new IndependentLogisticError("SHIFT_DIM_MISMATCH", "means");
  }
  return coefficients.map((coefficient, j) => {
    const trainMean = trainMeans[j]!;
    const validationMean = validationMeans[j]!;
    const deltaMean = validationMean - trainMean;
    const trainMeanLogitContribution = coefficient * trainMean;
    const validationMeanLogitContribution = coefficient * validationMean;
    const shiftContribution = coefficient * deltaMean;
    return {
      featureName: `f${j}`,
      coefficient,
      trainMean,
      validationMean,
      deltaMean,
      trainMeanLogitContribution,
      validationMeanLogitContribution,
      shiftContribution,
      absShiftContribution: Math.abs(shiftContribution),
    };
  });
}

export type StructuralRedundancyAuditV1 = {
  homeGamesEqualsWinsPlusLossesViolations: number;
  awayGamesEqualsWinsPlusLossesViolations: number;
  headToHeadGamesEqualsWinsPlusWinsViolations: number;
  homeLast5SumViolations: number;
  awayLast5SumViolations: number;
};

export function auditStructuralIdentitiesV1(
  rows: IndependentJoinRowV1[],
): StructuralRedundancyAuditV1 {
  let homeGl = 0;
  let awayGl = 0;
  let h2h = 0;
  let homeLast5 = 0;
  let awayLast5 = 0;
  for (const row of rows) {
    const hg = row.feature.home.gamesPlayedBefore;
    const hw = row.feature.home.winsBefore;
    const hl = row.feature.home.lossesBefore;
    if (hg !== hw + hl) homeGl += 1;
    const ag = row.feature.away.gamesPlayedBefore;
    const aw = row.feature.away.winsBefore;
    const al = row.feature.away.lossesBefore;
    if (ag !== aw + al) awayGl += 1;
    if (
      row.feature.headToHeadGamesBefore !==
      row.feature.headToHeadHomeWinsBefore + row.feature.headToHeadAwayWinsBefore
    ) {
      h2h += 1;
    }
    const h5w = row.feature.home.last5WinsBefore;
    const h5l = row.feature.home.last5LossesBefore;
    if (h5w != null && h5l != null) {
      if (h5w + h5l !== Math.min(5, hg)) homeLast5 += 1;
    }
    const a5w = row.feature.away.last5WinsBefore;
    const a5l = row.feature.away.last5LossesBefore;
    if (a5w != null && a5l != null) {
      if (a5w + a5l !== Math.min(5, ag)) awayLast5 += 1;
    }
  }
  return {
    homeGamesEqualsWinsPlusLossesViolations: homeGl,
    awayGamesEqualsWinsPlusLossesViolations: awayGl,
    headToHeadGamesEqualsWinsPlusWinsViolations: h2h,
    homeLast5SumViolations: homeLast5,
    awayLast5SumViolations: awayLast5,
  };
}

export function classifyValidationShiftV1(
  groupAbsShares: Array<{ group: string; absShiftContribution: number }>,
  totalLogitShift: number,
): DiagnosticClassificationV1 {
  const sumAbs = groupAbsShares.reduce((s, g) => s + g.absShiftContribution, 0);
  if (Math.abs(totalLogitShift) < 1e-12 || sumAbs === 0) {
    return "NO_CLEAR_DOMINANT_DRIVER";
  }
  const ranked = [...groupAbsShares].sort(
    (a, b) => b.absShiftContribution - a.absShiftContribution,
  );
  const top = ranked[0]!;
  const topShare = top.absShiftContribution / sumAbs;
  if (topShare >= 0.5) {
    if (top.group === "SEASON_VOLUME") return "SEASON_VOLUME_DOMINANT";
    if (top.group === "MISSING_INDICATORS") return "MISSINGNESS_DOMINANT";
    return "OTHER_FEATURES_DOMINANT";
  }
  return "MULTI_FACTOR_SHIFT";
}

type DiagRow = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  target: 0 | 1;
  x: number[];
  logit: number;
  probability: number;
  rawBase: Array<number | null>;
  missing: number[];
};

function compareIdentity(
  a: { officialDate: string; commenceTimeUtc: string; gamePk: number },
  b: { officialDate: string; commenceTimeUtc: string; gamePk: number },
): number {
  if (a.officialDate !== b.officialDate) {
    return a.officialDate < b.officialDate ? -1 : 1;
  }
  if (a.commenceTimeUtc !== b.commenceTimeUtc) {
    return a.commenceTimeUtc < b.commenceTimeUtc ? -1 : 1;
  }
  return a.gamePk - b.gamePk;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}

function buildPartitionRows(
  join: IndependentJoinArtifactV1,
  pks: number[],
  model: FrozenPrototypeModelV1,
): DiagRow[] {
  const allowed = new Set(pks);
  const found: IndependentJoinRowV1[] = [];
  for (const row of join.rows) {
    if (!allowed.has(row.identity.gamePk)) continue;
    found.push(row);
  }
  if (found.length !== pks.length) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `${found.length} != ${pks.length}`,
    );
  }
  found.sort((a, b) => compareIdentity(a.identity, b.identity));
  const prep = model.preprocessing;
  const weights = model.coefficients;
  const intercept = model.intercept;
  return found.map((row) => {
    const x = transformRowV1(row.feature, prep);
    const extracted = extractRawBaseAndMissing(row.feature);
    let logit = intercept;
    for (let j = 0; j < weights.length; j += 1) {
      logit += weights[j]! * x[j]!;
    }
    const target = row.label.target;
    if (target !== 0 && target !== 1) {
      throw new IndependentLogisticError(
        "LABEL_TARGET_INVALID",
        `gamePk ${row.identity.gamePk}`,
      );
    }
    return {
      gamePk: row.identity.gamePk,
      officialDate: row.identity.officialDate,
      commenceTimeUtc: row.identity.commenceTimeUtc,
      target,
      x,
      logit,
      probability: predictLogisticProbability(x, weights, intercept),
      rawBase: extracted.base,
      missing: extracted.missing,
    };
  });
}

function columnMeans(rows: DiagRow[], dim: number): number[] {
  const sums = new Array<number>(dim).fill(0);
  for (const row of rows) {
    for (let j = 0; j < dim; j += 1) sums[j]! += row.x[j]!;
  }
  return sums.map((s) => s / rows.length);
}

export function diagnoseLogisticValidationShiftV1(input: {
  join: IndependentJoinArtifactV1;
  split: IndependentSplitArtifactV1;
  model: FrozenPrototypeModelV1;
  evaluation: FrozenPrototypeEvalV1;
  sourceJoinHash: string;
  generatedAt?: string;
}): {
  diagnostic: Record<string, unknown>;
  audit: Record<string, unknown>;
} {
  assertSemanticGroupCoverageV1();
  const { join, split, model, evaluation, sourceJoinHash } = input;
  if (model.modelCoreHash !== MLB_INDEPENDENT_2024_SEALED_LOGISTIC_CORE_HASH_V1) {
    throw new IndependentLogisticError(
      "MODEL_CORE_HASH_PIN_MISMATCH",
      model.modelCoreHash,
    );
  }
  if (evaluation.modelCoreHash !== model.modelCoreHash) {
    throw new IndependentLogisticError(
      "EVALUATION_MODEL_CORE_HASH_MISMATCH",
      evaluation.modelCoreHash,
    );
  }
  if (sourceJoinHash !== MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1) {
    throw new IndependentLogisticError(
      "SEALED_JOIN_ARTIFACT_HASH_MISMATCH",
      sourceJoinHash,
    );
  }
  if (model.sourceJoinArtifactHash !== MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1) {
    throw new IndependentLogisticError(
      "MODEL_JOIN_HASH_MISMATCH",
      model.sourceJoinArtifactHash,
    );
  }
  if (
    model.modelPrototype !== true ||
    model.engineApproved !== false ||
    model.holdoutEvaluated !== false ||
    model.trainingSampleCount !== 1463 ||
    model.validationSampleCount !== 483 ||
    model.holdoutSampleCount !== 483
  ) {
    throw new IndependentLogisticError("SEALED_MODEL_FLAGS_INVALID", "prototype");
  }
  const recomputedSplit = hashIndependentSplitManifestV1({
    sourceJoinArtifactHash: split.sourceJoinArtifactHash,
    boundaries: split.boundaries,
    trainGamePks: split.trainGamePks,
    validationGamePks: split.validationGamePks,
    holdoutGamePks: split.holdoutGamePks,
  });
  if (
    recomputedSplit !== split.splitManifestHash ||
    split.splitManifestHash !== MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1 ||
    model.sourceSplitManifestHash !==
      MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1
  ) {
    throw new IndependentLogisticError(
      "SPLIT_MANIFEST_HASH_MISMATCH",
      recomputedSplit,
    );
  }
  if (split.holdoutGamePks.length !== 483) {
    throw new IndependentLogisticError(
      "HOLDOUT_SEAL_INVALID",
      `${split.holdoutGamePks.length}`,
    );
  }
  const identityPks = new Set(join.rows.map((r) => r.identity.gamePk));
  for (const pk of split.holdoutGamePks) {
    if (!identityPks.has(pk)) {
      throw new IndependentLogisticError("HOLDOUT_MEMBERSHIP_MISSING", `${pk}`);
    }
  }

  const names = orderedLogisticModelFeatureNamesV1();
  const baseNames = orderedLogisticBaseFeatureNamesV1();
  const missingNames = orderedLogisticMissingIndicatorNamesV1();
  if (model.coefficients.length !== MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V1) {
    throw new IndependentLogisticError(
      "COEFFICIENT_COUNT",
      `${model.coefficients.length}`,
    );
  }

  const trainRows = buildPartitionRows(join, split.trainGamePks, model);
  const valRows = buildPartitionRows(join, split.validationGamePks, model);
  if (trainRows.length !== 1463 || valRows.length !== 483) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `train=${trainRows.length} val=${valRows.length}`,
    );
  }

  const trainMeans = columnMeans(trainRows, names.length);
  const valMeans = columnMeans(valRows, names.length);
  const featureDrift: FeatureDriftRowV1[] = names.map((featureName, j) => {
    const coefficient = model.coefficients[j]!;
    const trainMean = trainMeans[j]!;
    const validationMean = valMeans[j]!;
    const deltaMean = validationMean - trainMean;
    const trainMeanLogitContribution = coefficient * trainMean;
    const validationMeanLogitContribution = coefficient * validationMean;
    const shiftContribution = coefficient * deltaMean;
    return {
      featureName,
      coefficient,
      trainMean,
      validationMean,
      deltaMean,
      trainMeanLogitContribution,
      validationMeanLogitContribution,
      shiftContribution,
      absShiftContribution: Math.abs(shiftContribution),
    };
  });
  const driftRanked = [...featureDrift].sort((a, b) => {
    if (b.absShiftContribution !== a.absShiftContribution) {
      return b.absShiftContribution - a.absShiftContribution;
    }
    return a.featureName < b.featureName ? -1 : 1;
  });

  const trainMeanLogitFromMeans = meanLogitFromMeansV1(
    model.intercept,
    model.coefficients,
    trainMeans,
  );
  const valMeanLogitFromMeans = meanLogitFromMeansV1(
    model.intercept,
    model.coefficients,
    valMeans,
  );
  const trainMeanLogitDirect = mean(trainRows.map((r) => r.logit));
  const valMeanLogitDirect = mean(valRows.map((r) => r.logit));
  if (
    Math.abs(trainMeanLogitFromMeans - trainMeanLogitDirect) >
    LOGIT_RECONCILE_TOLERANCE_V1
  ) {
    throw new IndependentLogisticError(
      "LOGIT_RECONCILIATION_FAIL",
      "train mean logit",
    );
  }
  if (
    Math.abs(valMeanLogitFromMeans - valMeanLogitDirect) >
    LOGIT_RECONCILE_TOLERANCE_V1
  ) {
    throw new IndependentLogisticError(
      "LOGIT_RECONCILIATION_FAIL",
      "validation mean logit",
    );
  }
  const logitShift = valMeanLogitDirect - trainMeanLogitDirect;
  const sumFeatureShift = featureDrift.reduce(
    (s, r) => s + r.shiftContribution,
    0,
  );
  if (Math.abs(logitShift - sumFeatureShift) > LOGIT_RECONCILE_TOLERANCE_V1) {
    throw new IndependentLogisticError(
      "LOGIT_SHIFT_RECONCILIATION_FAIL",
      `${logitShift} vs ${sumFeatureShift}`,
    );
  }

  const evalTrainByPk = new Map(evaluation.train.map((r) => [r.gamePk, r]));
  const evalValByPk = new Map(evaluation.validation.map((r) => [r.gamePk, r]));
  for (const row of trainRows) {
    const persisted = evalTrainByPk.get(row.gamePk);
    if (
      !persisted ||
      Math.abs(persisted.probability - row.probability) > PROB_REPLAY_TOLERANCE_V1
    ) {
      throw new IndependentLogisticError(
        "TRAIN_PROBABILITY_REPLAY_MISMATCH",
        `gamePk ${row.gamePk}`,
      );
    }
  }
  for (const row of valRows) {
    const persisted = evalValByPk.get(row.gamePk);
    if (
      !persisted ||
      Math.abs(persisted.probability - row.probability) > PROB_REPLAY_TOLERANCE_V1
    ) {
      throw new IndependentLogisticError(
        "VALIDATION_PROBABILITY_REPLAY_MISMATCH",
        `gamePk ${row.gamePk}`,
      );
    }
  }

  const trainMeanProbability = mean(trainRows.map((r) => r.probability));
  const validationMeanProbability = mean(valRows.map((r) => r.probability));
  const sigmoidMeanTrainLogit = stableSigmoid(trainMeanLogitDirect);
  const sigmoidMeanValLogit = stableSigmoid(valMeanLogitDirect);

  const rawBaseDrift = baseNames.map((name, j) => {
    const median = model.preprocessing.medianByFeature[name]!;
    const scale = model.preprocessing.scaleByFeature[name]!;
    const trainImputed = trainRows.map((r) =>
      r.rawBase[j] == null ? median : r.rawBase[j]!,
    );
    const valImputed = valRows.map((r) =>
      r.rawBase[j] == null ? median : r.rawBase[j]!,
    );
    const trainRawMean = mean(trainImputed);
    const validationRawMean = mean(valImputed);
    const validationStandardizedMean =
      (validationRawMean - model.preprocessing.meanByFeature[name]!) / scale;
    return {
      featureName: name,
      trainMedian: median,
      trainScale: scale,
      trainRawImputedMean: trainRawMean,
      validationRawImputedMean: validationRawMean,
      validationStandardizedMean,
      absStandardizedMeanDrift: Math.abs(
        validationStandardizedMean - trainMeans[j]!,
      ),
    };
  });

  const groupContributions = Object.entries(SEMANTIC_FEATURE_GROUPS_V1).map(
    ([group, groupNames]) => {
      const nameSet = new Set(groupNames);
      const rows = featureDrift.filter((r) => nameSet.has(r.featureName));
      const trainMeanContribution = rows.reduce(
        (s, r) => s + r.trainMeanLogitContribution,
        0,
      );
      const validationMeanContribution = rows.reduce(
        (s, r) => s + r.validationMeanLogitContribution,
        0,
      );
      const shiftContribution = rows.reduce((s, r) => s + r.shiftContribution, 0);
      return {
        group,
        featureCount: groupNames.length,
        trainMeanContribution,
        validationMeanContribution,
        shiftContribution,
        absShiftContribution: Math.abs(shiftContribution),
        shareOfNetShiftDescriptive:
          Math.abs(logitShift) < 1e-18 ? 0 : shiftContribution / logitShift,
      };
    },
  );

  const seasonVolumeNames = SEMANTIC_FEATURE_GROUPS_V1.SEASON_VOLUME;
  const seasonVolumeDetail = seasonVolumeNames.map((name) => {
    const idx = names.indexOf(name);
    const baseIdx = baseNames.indexOf(name);
    const drift = featureDrift[idx]!;
    const raw = rawBaseDrift[baseIdx]!;
    return {
      featureName: name,
      trainRawMean: raw.trainRawImputedMean,
      validationRawMean: raw.validationRawImputedMean,
      validationStandardizedMean: raw.validationStandardizedMean,
      coefficient: drift.coefficient,
      shiftContribution: drift.shiftContribution,
    };
  });
  const seasonVolumeTotalShift = seasonVolumeDetail.reduce(
    (s, r) => s + r.shiftContribution,
    0,
  );

  const missingShiftRows = missingNames.map((name) => {
    const idx = names.indexOf(name);
    const drift = featureDrift[idx]!;
    return {
      featureName: name,
      trainMissingRate: trainMeans[idx]!,
      validationMissingRate: valMeans[idx]!,
      coefficient: drift.coefficient,
      shiftContribution: drift.shiftContribution,
    };
  });
  const missingIndicatorTotalShift = missingShiftRows.reduce(
    (s, r) => s + r.shiftContribution,
    0,
  );

  const joinByPk = new Map<number, IndependentJoinRowV1>();
  const allowed = new Set([...split.trainGamePks, ...split.validationGamePks]);
  for (const row of join.rows) {
    if (allowed.has(row.identity.gamePk)) {
      joinByPk.set(row.identity.gamePk, row);
    }
  }
  const identityRows = [...trainRows, ...valRows].map(
    (diag) => joinByPk.get(diag.gamePk)!,
  );
  const structural = auditStructuralIdentitiesV1(identityRows);

  const trainImputedCols: number[][] = baseNames.map((_, j) => {
    const median = model.preprocessing.medianByFeature[baseNames[j]!]!;
    return trainRows.map((r) =>
      r.rawBase[j] == null ? median : r.rawBase[j]!,
    );
  });
  const corrPairs: Array<{
    featureA: string;
    featureB: string;
    correlation: number;
  }> = [];
  for (let i = 0; i < baseNames.length; i += 1) {
    for (let k = i + 1; k < baseNames.length; k += 1) {
      corrPairs.push({
        featureA: baseNames[i]!,
        featureB: baseNames[k]!,
        correlation: pearsonCorrelationV1(
          trainImputedCols[i]!,
          trainImputedCols[k]!,
        ),
      });
    }
  }
  corrPairs.sort((a, b) => {
    const d = Math.abs(b.correlation) - Math.abs(a.correlation);
    if (d !== 0) return d;
    return `${a.featureA}:${a.featureB}` < `${b.featureA}:${b.featureB}`
      ? -1
      : 1;
  });
  const topCorrelations = corrPairs.slice(0, 20);
  const highCorrelationPairCount = corrPairs.filter(
    (p) => Math.abs(p.correlation) >= 0.9,
  ).length;

  const coefficientRanked = [...featureDrift]
    .map((r) => ({
      featureName: r.featureName,
      coefficient: r.coefficient,
      absCoefficient: Math.abs(r.coefficient),
    }))
    .sort((a, b) => {
      if (b.absCoefficient !== a.absCoefficient) {
        return b.absCoefficient - a.absCoefficient;
      }
      return a.featureName < b.featureName ? -1 : 1;
    });

  const trainHomeRate = mean(trainRows.map((r) => r.target));
  const valHomeRate = mean(valRows.map((r) => r.target));

  const bins = VALIDATION_BINS.map((bin) => {
    const subset = valRows.filter(
      (r) => r.officialDate >= bin.start && r.officialDate <= bin.end,
    );
    const metrics = evaluateProbabilitiesV1(
      subset.map((r) => r.target),
      subset.map((r) => r.probability),
      MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
    );
    return {
      id: bin.id,
      start: bin.start,
      end: bin.end,
      n: subset.length,
      actualHomeRate: metrics.actualHomeRate,
      meanPredictedProbability: metrics.meanPredictedProbability,
      predictedHomeClassRate: metrics.predictedHomeRate,
      accuracy: metrics.accuracy,
      logLoss: metrics.logLoss,
      brierScore: metrics.brierScore,
      meanLogit: mean(subset.map((r) => r.logit)),
    };
  });

  const dominantPositiveShiftFeatures = driftRanked
    .filter((r) => r.shiftContribution > 0)
    .slice(0, 5)
    .map((r) => r.featureName);
  const dominantNegativeShiftFeatures = [...featureDrift]
    .filter((r) => r.shiftContribution < 0)
    .sort((a, b) => {
      if (a.shiftContribution !== b.shiftContribution) {
        return a.shiftContribution - b.shiftContribution;
      }
      return a.featureName < b.featureName ? -1 : 1;
    })
    .slice(0, 5)
    .map((r) => r.featureName);
  const dominantPositiveShiftGroups = groupContributions
    .filter((g) => g.shiftContribution > 0)
    .sort((a, b) => b.shiftContribution - a.shiftContribution)
    .map((g) => g.group);
  const dominantNegativeShiftGroups = groupContributions
    .filter((g) => g.shiftContribution < 0)
    .sort((a, b) => a.shiftContribution - b.shiftContribution)
    .map((g) => g.group);

  const diagnosticClassification = classifyValidationShiftV1(
    groupContributions.map((g) => ({
      group: g.group,
      absShiftContribution: g.absShiftContribution,
    })),
    logitShift,
  );

  const conclusionEvidence = {
    dominantPositiveShiftFeatures,
    dominantNegativeShiftFeatures,
    dominantPositiveShiftGroups,
    dominantNegativeShiftGroups,
    seasonVolumeShiftContribution: seasonVolumeTotalShift,
    missingIndicatorShiftContribution: missingIndicatorTotalShift,
    totalLogitShift: logitShift,
    seasonVolumeShareOfNetShift:
      Math.abs(logitShift) < 1e-18 ? 0 : seasonVolumeTotalShift / logitShift,
    structuralRedundancyPresent:
      structural.homeGamesEqualsWinsPlusLossesViolations +
        structural.awayGamesEqualsWinsPlusLossesViolations +
        structural.headToHeadGamesEqualsWinsPlusWinsViolations +
        structural.homeLast5SumViolations +
        structural.awayLast5SumViolations ===
      0,
    highCorrelationPairCount,
    coefficientNote:
      "Large absolute coefficient is not causal importance. Features may be correlated or contractually redundant.",
    classificationRule:
      "Descriptive only: a group is dominant if it accounts for >= 50% of the sum of absolute group shift contributions. Not an Engine decision and not a feature-removal rule.",
    diagnosticClassification,
  };

  const diagnostic = {
    schemaVersion: MLB_INDEPENDENT_LOGISTIC_DIAGNOSTIC_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_LOGISTIC_DIAGNOSTIC_BUILDER_V1,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    modelPrototype: true,
    engineApproved: false,
    holdoutEvaluated: false,
    modelCoreHash: model.modelCoreHash,
    sourceJoinArtifactHash: sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutMembershipCount: 483,
    holdoutFeatureRowsReadForDiagnostic: 0,
    holdoutLabelRowsReadForDiagnostic: 0,
    holdoutProbabilitiesCreated: 0,
    intercept: model.intercept,
    trainMeanLogit: trainMeanLogitDirect,
    validationMeanLogit: valMeanLogitDirect,
    trainMeanLogitFromFeatureMeans: trainMeanLogitFromMeans,
    validationMeanLogitFromFeatureMeans: valMeanLogitFromMeans,
    logitShift,
    sumFeatureShiftContributions: sumFeatureShift,
    logitShiftReconciliation: "PASS" as const,
    trainProbabilityReplayMatch: "PASS" as const,
    validationProbabilityReplayMatch: "PASS" as const,
    trainMeanProbability,
    validationMeanProbability,
    sigmoidOfTrainMeanLogit: sigmoidMeanTrainLogit,
    sigmoidOfValidationMeanLogit: sigmoidMeanValLogit,
    trainActualHomeRate: trainHomeRate,
    validationActualHomeRate: valHomeRate,
    actualHomeRateShift: valHomeRate - trainHomeRate,
    predictedMeanProbabilityShift:
      validationMeanProbability - trainMeanProbability,
    featureDrift,
    driftCoefficientTop15: driftRanked.slice(0, 15).map((r, i) => ({
      rank: i + 1,
      feature: r.featureName,
      coefficient: r.coefficient,
      trainMean: r.trainMean,
      validationMean: r.validationMean,
      deltaMean: r.deltaMean,
      shiftContribution: r.shiftContribution,
    })),
    semanticGroupContributions: groupContributions,
    seasonVolumeDetail,
    seasonVolumeTotalShiftContribution: seasonVolumeTotalShift,
    missingnessShift: missingShiftRows,
    missingIndicatorTotalShiftContribution: missingIndicatorTotalShift,
    rawBaseFeatureDrift: rawBaseDrift,
    structuralRedundancy: structural,
    trainTopCorrelations: topCorrelations,
    highCorrelationPairCount,
    coefficientTop15: coefficientRanked.slice(0, 15),
    coefficientNote:
      "Large absolute coefficient is not causal importance. Features may be correlated or contractually redundant.",
    validationChronologicalBins: bins,
    conclusionEvidence,
    diagnosticClassification,
  };

  const audit = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    modelCoreHash: model.modelCoreHash,
    sourceJoinArtifactHash: sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutMembershipCount: 483,
    holdoutFeatureRowsReadForDiagnostic: 0,
    holdoutLabelRowsReadForDiagnostic: 0,
    holdoutProbabilitiesCreated: 0,
    holdoutEvaluated: false,
    trainingFunctionCalled: false,
    optimizerCalled: false,
    modelCoreChanged: false,
    trainProbabilityReplayMatch: true,
    validationProbabilityReplayMatch: true,
    logitShiftReconciliation: true,
    logitShift,
    predictedMeanProbabilityShift:
      validationMeanProbability - trainMeanProbability,
    actualHomeRateShift: valHomeRate - trainHomeRate,
    diagnosticClassification,
    seasonVolumeTotalShiftContribution: seasonVolumeTotalShift,
    missingIndicatorTotalShiftContribution: missingIndicatorTotalShift,
    highCorrelationPairCount,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
  };

  return { diagnostic, audit };
}
