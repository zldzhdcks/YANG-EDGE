/**
 * Frozen v2-A Validation calibration + discrimination + residual-shift diagnostic.
 * Consumes sealed artifacts only. Does not train, fit, calibrate, or open Holdout.
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
  MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
  predictLogisticProbability,
  stableSigmoid,
} from "../independent-logistic-v1/logistic";
import { evaluateProbabilitiesV1 } from "../independent-logistic-v1/metrics";
import {
  IndependentLogisticError,
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A,
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A,
  orderedLogisticBaseFeatureNamesV2a,
  orderedLogisticMissingIndicatorNamesV2a,
  orderedLogisticModelFeatureNamesV2a,
} from "../independent-logistic-v2a/spec";
import {
  extractRawBaseAndMissingV2a,
  transformRowV2a,
  type LogisticPreprocessorV2a,
} from "../independent-logistic-v2a/preprocess";

export const MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH =
  "bef2104957768a40cbfecbeb3ff99946dce80a7155ab93a29248cc6fab576c9b";
export const MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V2A_DIAG =
  "a72b8586971ee81a04e119c7d860f226abb503b5cc2341bb370d49d2fb47e71d";

export const MLB_INDEPENDENT_V2A_CALIB_DIAG_SCHEMA_V1 =
  "mlb-independent-logistic-v2a-calibration-discrimination-diagnostic-v1" as const;
export const MLB_INDEPENDENT_V2A_CALIB_DIAG_BUILDER_V1 =
  "mlb-independent-logistic-v2a-diagnostic-v1" as const;

export const LOGIT_RECONCILE_TOLERANCE_V2A_DIAG = 1e-12;
export const PROB_REPLAY_TOLERANCE_V2A_DIAG = 1e-12;
export const CALIBRATION_OFFSET_TOLERANCE_V2A_DIAG = 1e-12;
export const BASELINE_TRAIN_HOME_RATE_V2A_DIAG = 776 / 1463;

export const SEMANTIC_FEATURE_GROUPS_V2A: Record<string, readonly string[]> = {
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
  MISSING_INDICATORS: orderedLogisticMissingIndicatorNamesV2a(),
};

export const FIXED_CALIBRATION_BINS_V2A = [
  { id: "B00_40", lo: 0, hi: 0.4, rightClosed: false },
  { id: "B40_45", lo: 0.4, hi: 0.45, rightClosed: false },
  { id: "B45_50", lo: 0.45, hi: 0.5, rightClosed: false },
  { id: "B50_55", lo: 0.5, hi: 0.55, rightClosed: false },
  { id: "B55_60", lo: 0.55, hi: 0.6, rightClosed: false },
  { id: "B60_65", lo: 0.6, hi: 0.65, rightClosed: false },
  { id: "B65_70", lo: 0.65, hi: 0.7, rightClosed: false },
  { id: "B70_100", lo: 0.7, hi: 1, rightClosed: true },
] as const;

const VALIDATION_DATE_BINS = [
  { id: "BIN_1", start: "2024-07-20", end: "2024-07-26" },
  { id: "BIN_2", start: "2024-07-27", end: "2024-08-02" },
  { id: "BIN_3", start: "2024-08-03", end: "2024-08-09" },
  { id: "BIN_4", start: "2024-08-10", end: "2024-08-16" },
  { id: "BIN_5", start: "2024-08-17", end: "2024-08-24" },
] as const;

export type FrozenV2aModelV1 = {
  modelCoreHash: string;
  sourceJoinArtifactHash: string;
  sourceSplitManifestHash: string;
  v1BaselineModelCoreHash: string;
  modelPrototype: boolean;
  modelCandidate: boolean;
  engineApproved: boolean;
  holdoutEvaluated: boolean;
  experimentType: string;
  trainingSampleCount: number;
  validationSampleCount: number;
  holdoutSampleCount: number;
  intercept: number;
  coefficients: number[];
  preprocessing: LogisticPreprocessorV2a;
  featureSpec: {
    baseDimensions: number;
    missingIndicators: number;
    modelDimensions: number;
  };
};

export type FrozenEvalRowV2aDiag = {
  gamePk: number;
  officialDate?: string;
  target: 0 | 1;
  probability: number;
};

export function independentLogisticV2aCalibDiagnosticRel(): string {
  return "data/research/mlb/independent-model-v1/diagnostics/2024-logistic-v2a-calibration-discrimination-diagnostic-v1.json";
}
export function independentLogisticV2aCalibDiagnosticPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentLogisticV2aCalibDiagnosticRel());
}
export function independentLogisticV2aCalibAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-logistic-v2a-calibration-discrimination-audit-v1.json";
}
export function independentLogisticV2aCalibAuditPath(cwd = process.cwd()): string {
  return path.join(cwd, independentLogisticV2aCalibAuditRel());
}
export function sealedV2aModelRel(): string {
  return "data/research/mlb/independent-model-v1/model/2024-logistic-regression-season-volume-ablation-v2a.json";
}
export function sealedV2aModelPath(cwd = process.cwd()): string {
  return path.join(cwd, sealedV2aModelRel());
}
export function sealedV2aEvalRel(): string {
  return "data/research/mlb/independent-model-v1/evaluations/2024-logistic-regression-season-volume-ablation-v2a-train-validation.json";
}
export function sealedV2aEvalPath(cwd = process.cwd()): string {
  return path.join(cwd, sealedV2aEvalRel());
}

export function assertSemanticGroupCoverageV2a(): void {
  const all = orderedLogisticModelFeatureNamesV2a();
  const seen = new Set<string>();
  let count = 0;
  for (const [group, names] of Object.entries(SEMANTIC_FEATURE_GROUPS_V2A)) {
    for (const name of names) {
      if (seen.has(name)) {
        throw new IndependentLogisticError("GROUP_OVERLAP", `${name} in ${group}`);
      }
      seen.add(name);
      count += 1;
    }
  }
  if (count !== 51 || seen.size !== 51 || all.length !== 51) {
    throw new IndependentLogisticError(
      "GROUP_COVERAGE_MISMATCH",
      `${count} seen=${seen.size} all=${all.length}`,
    );
  }
  for (const name of all) {
    if (!seen.has(name)) {
      throw new IndependentLogisticError("GROUP_MISSING_FEATURE", name);
    }
  }
}

export function rocAucMannWhitney(y: ArrayLike<number>, scores: ArrayLike<number>): number {
  const n = y.length;
  if (n === 0 || scores.length !== n) {
    throw new IndependentLogisticError("AUC_LENGTH_MISMATCH", `${n}`);
  }
  let nPos = 0;
  for (let i = 0; i < n; i += 1) if (y[i] === 1) nPos += 1;
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;
  const indexed = Array.from({ length: n }, (_, i) => ({
    s: scores[i]!,
    i,
  }));
  indexed.sort((a, b) => (a.s !== b.s ? a.s - b.s : a.i - b.i));
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1]!.s === indexed[i]!.s) j += 1;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[indexed[k]!.i] = avgRank;
    i = j + 1;
  }
  let sumPos = 0;
  for (let k = 0; k < n; k += 1) {
    if (y[k] === 1) sumPos += ranks[k]!;
  }
  const u = sumPos - (nPos * (nPos + 1)) / 2;
  return u / (nPos * nNeg);
}

export function empiricalBaseRateLogit(p: number): number {
  if (!(p > 0) || !(p < 1)) {
    throw new IndependentLogisticError("BASE_RATE_LOGIT_INVALID", `${p}`);
  }
  return Math.log(p / (1 - p));
}

export function calibrationOffsetForMeanProbability(
  logits: number[],
  actualHomeRate: number,
): number {
  if (logits.length === 0) {
    throw new IndependentLogisticError("EMPTY_LOGITS", "calibration offset");
  }
  const meanSig = (alpha: number): number => {
    let s = 0;
    for (const z of logits) s += stableSigmoid(z + alpha);
    return s / logits.length;
  };
  let lo = -10;
  let hi = 10;
  for (let iter = 0; iter < 200; iter += 1) {
    const mid = (lo + hi) / 2;
    const m = meanSig(mid);
    if (Math.abs(m - actualHomeRate) < CALIBRATION_OFFSET_TOLERANCE_V2A_DIAG) {
      return mid;
    }
    if (m > actualHomeRate) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function assignFixedCalibrationBinIndex(p: number): number {
  const bins = FIXED_CALIBRATION_BINS_V2A;
  for (let i = 0; i < bins.length; i += 1) {
    const b = bins[i]!;
    if (b.rightClosed) {
      if (p >= b.lo && p <= b.hi) return i;
    } else if (p >= b.lo && p < b.hi) {
      return i;
    }
  }
  throw new IndependentLogisticError("CALIBRATION_BIN_MISS", `${p}`);
}

export function fixedBinCalibrationTable(
  y: ArrayLike<number>,
  probabilities: ArrayLike<number>,
): {
  bins: Array<{
    id: string;
    lo: number;
    hi: number;
    n: number;
    meanPredictedProbability: number | null;
    actualHomeRate: number | null;
    calibrationGap: number | null;
  }>;
  ece: number;
  reliability: number;
  resolution: number;
  uncertainty: number;
} {
  const n = y.length;
  const bins = FIXED_CALIBRATION_BINS_V2A.map((b) => ({
    id: b.id,
    lo: b.lo,
    hi: b.hi,
    n: 0,
    sumP: 0,
    sumY: 0,
  }));
  let overallY = 0;
  for (let i = 0; i < n; i += 1) {
    const p = probabilities[i]!;
    const yi = y[i]!;
    overallY += yi;
    const idx = assignFixedCalibrationBinIndex(p);
    bins[idx]!.n += 1;
    bins[idx]!.sumP += p;
    bins[idx]!.sumY += yi;
  }
  const actualOverall = n === 0 ? 0 : overallY / n;
  let ece = 0;
  let reliability = 0;
  let resolution = 0;
  const out = bins.map((b) => {
    if (b.n === 0) {
      return {
        id: b.id,
        lo: b.lo,
        hi: b.hi,
        n: 0,
        meanPredictedProbability: null,
        actualHomeRate: null,
        calibrationGap: null,
      };
    }
    const meanP = b.sumP / b.n;
    const actual = b.sumY / b.n;
    const gap = meanP - actual;
    const w = b.n / n;
    ece += w * Math.abs(gap);
    reliability += w * (meanP - actual) * (meanP - actual);
    resolution += w * (actual - actualOverall) * (actual - actualOverall);
    return {
      id: b.id,
      lo: b.lo,
      hi: b.hi,
      n: b.n,
      meanPredictedProbability: meanP,
      actualHomeRate: actual,
      calibrationGap: gap,
    };
  });
  return {
    bins: out,
    ece,
    reliability,
    resolution,
    uncertainty: actualOverall * (1 - actualOverall),
  };
}

export function pearsonCorrelationDiag(xs: number[], ys: number[]): number {
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

type DiagRow = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  target: 0 | 1;
  x: number[];
  logit: number;
  probability: number;
  rawBase: Array<number | null>;
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

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function buildPartitionRows(
  join: IndependentJoinArtifactV1,
  pks: number[],
  model: FrozenV2aModelV1,
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
    const x = transformRowV2a(row.feature, prep);
    const extracted = extractRawBaseAndMissingV2a(row.feature);
    let logit = intercept;
    for (let j = 0; j < weights.length; j += 1) logit += weights[j]! * x[j]!;
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
    };
  });
}

function classSeparation(rows: DiagRow[]): {
  meanPHome: number;
  meanPAway: number;
  medianPHome: number;
  medianPAway: number;
  meanDifference: number;
  overlapNote: string;
} {
  const home = rows.filter((r) => r.target === 1).map((r) => r.probability);
  const away = rows.filter((r) => r.target === 0).map((r) => r.probability);
  const meanPHome = mean(home);
  const meanPAway = mean(away);
  const meanDifference = meanPHome - meanPAway;
  return {
    meanPHome,
    meanPAway,
    medianPHome: medianOf(home),
    medianPAway: medianOf(away),
    meanDifference,
    overlapNote: `HOME mean p minus AWAY mean p = ${meanDifference}. Distributions may still overlap around the 0.5 threshold; this is descriptive only.`,
  };
}

function classSeparationFromEval(rows: FrozenEvalRowV2aDiag[]): {
  meanPHome: number;
  meanPAway: number;
  meanDifference: number;
} {
  const home = rows.filter((r) => r.target === 1).map((r) => r.probability);
  const away = rows.filter((r) => r.target === 0).map((r) => r.probability);
  const meanPHome = mean(home);
  const meanPAway = mean(away);
  return { meanPHome, meanPAway, meanDifference: meanPHome - meanPAway };
}

export function diagnoseV2aCalibrationDiscriminationV1(input: {
  join: IndependentJoinArtifactV1;
  split: IndependentSplitArtifactV1;
  model: FrozenV2aModelV1;
  evaluation: { modelCoreHash: string; train: FrozenEvalRowV2aDiag[]; validation: FrozenEvalRowV2aDiag[] };
  v1Evaluation: { modelCoreHash: string; validation: FrozenEvalRowV2aDiag[] };
  sourceJoinHash: string;
  generatedAt?: string;
}): { diagnostic: Record<string, unknown>; audit: Record<string, unknown> } {
  assertSemanticGroupCoverageV2a();
  const { join, split, model, evaluation, v1Evaluation, sourceJoinHash } = input;
  if (model.modelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH) {
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
  if (v1Evaluation.modelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A) {
    throw new IndependentLogisticError(
      "V1_MODEL_CORE_HASH_PIN_MISMATCH",
      v1Evaluation.modelCoreHash,
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
    model.modelCandidate !== false ||
    model.engineApproved !== false ||
    model.holdoutEvaluated !== false ||
    model.experimentType !== "SEASON_VOLUME_ABLATION" ||
    model.featureSpec.baseDimensions !== 29 ||
    model.featureSpec.missingIndicators !== 22 ||
    model.featureSpec.modelDimensions !== 51 ||
    model.coefficients.length !== MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A
  ) {
    throw new IndependentLogisticError("SEALED_MODEL_FLAGS_INVALID", "v2a");
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
    split.splitManifestHash !== MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V2A_DIAG ||
    model.sourceSplitManifestHash !==
      MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V2A_DIAG
  ) {
    throw new IndependentLogisticError(
      "SPLIT_MANIFEST_HASH_MISMATCH",
      recomputedSplit,
    );
  }
  if (split.holdoutGamePks.length !== 483 || model.holdoutSampleCount !== 483) {
    throw new IndependentLogisticError("HOLDOUT_SEAL_INVALID", "holdout");
  }
  const identityPks = new Set(join.rows.map((r) => r.identity.gamePk));
  for (const pk of split.holdoutGamePks) {
    if (!identityPks.has(pk)) {
      throw new IndependentLogisticError("HOLDOUT_MEMBERSHIP_MISSING", `${pk}`);
    }
  }

  const names = orderedLogisticModelFeatureNamesV2a();
  const baseNames = orderedLogisticBaseFeatureNamesV2a();
  const missingNames = orderedLogisticMissingIndicatorNamesV2a();
  const trainRows = buildPartitionRows(join, split.trainGamePks, model);
  const valRows = buildPartitionRows(join, split.validationGamePks, model);
  if (trainRows.length !== 1463 || valRows.length !== 483) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `train=${trainRows.length} val=${valRows.length}`,
    );
  }

  const evalTrainByPk = new Map(evaluation.train.map((r) => [r.gamePk, r]));
  const evalValByPk = new Map(evaluation.validation.map((r) => [r.gamePk, r]));
  for (const row of trainRows) {
    const persisted = evalTrainByPk.get(row.gamePk);
    if (
      !persisted ||
      Math.abs(persisted.probability - row.probability) > PROB_REPLAY_TOLERANCE_V2A_DIAG
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
      Math.abs(persisted.probability - row.probability) > PROB_REPLAY_TOLERANCE_V2A_DIAG
    ) {
      throw new IndependentLogisticError(
        "VALIDATION_PROBABILITY_REPLAY_MISMATCH",
        `gamePk ${row.gamePk}`,
      );
    }
  }

  const dim = names.length;
  const trainMeans = new Array<number>(dim).fill(0);
  const valMeans = new Array<number>(dim).fill(0);
  for (const row of trainRows) {
    for (let j = 0; j < dim; j += 1) trainMeans[j]! += row.x[j]!;
  }
  for (const row of valRows) {
    for (let j = 0; j < dim; j += 1) valMeans[j]! += row.x[j]!;
  }
  for (let j = 0; j < dim; j += 1) {
    trainMeans[j]! /= trainRows.length;
    valMeans[j]! /= valRows.length;
  }
  const featureDrift = names.map((featureName, j) => {
    const coefficient = model.coefficients[j]!;
    const trainMean = trainMeans[j]!;
    const validationMean = valMeans[j]!;
    const deltaMean = validationMean - trainMean;
    const shiftContribution = coefficient * deltaMean;
    return {
      featureName,
      coefficient,
      trainMean,
      validationMean,
      deltaMean,
      trainMeanLogitContribution: coefficient * trainMean,
      validationMeanLogitContribution: coefficient * validationMean,
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
  const trainMeanLogit = mean(trainRows.map((r) => r.logit));
  const validationMeanLogit = mean(valRows.map((r) => r.logit));
  const trainMeanLogitFromFeatureMeans =
    model.intercept +
    featureDrift.reduce((s, r) => s + r.trainMeanLogitContribution, 0);
  const validationMeanLogitFromFeatureMeans =
    model.intercept +
    featureDrift.reduce((s, r) => s + r.validationMeanLogitContribution, 0);
  if (Math.abs(trainMeanLogitFromFeatureMeans - trainMeanLogit) > LOGIT_RECONCILE_TOLERANCE_V2A_DIAG) {
    throw new IndependentLogisticError("LOGIT_RECONCILIATION_FAIL", "train");
  }
  if (Math.abs(validationMeanLogitFromFeatureMeans - validationMeanLogit) > LOGIT_RECONCILE_TOLERANCE_V2A_DIAG) {
    throw new IndependentLogisticError("LOGIT_RECONCILIATION_FAIL", "validation");
  }
  const residualLogitShift = validationMeanLogit - trainMeanLogit;
  const sumFeatureShift = featureDrift.reduce((s, r) => s + r.shiftContribution, 0);
  if (Math.abs(residualLogitShift - sumFeatureShift) > LOGIT_RECONCILE_TOLERANCE_V2A_DIAG) {
    throw new IndependentLogisticError(
      "V2A_RESIDUAL_LOGIT_SHIFT_RECONCILIATION_FAIL",
      `${residualLogitShift} vs ${sumFeatureShift}`,
    );
  }

  const groupContributions = Object.entries(SEMANTIC_FEATURE_GROUPS_V2A).map(
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
          Math.abs(residualLogitShift) < 1e-18
            ? 0
            : shiftContribution / residualLogitShift,
      };
    },
  );
  const largestResidualShiftGroup = [...groupContributions].sort(
    (a, b) => b.absShiftContribution - a.absShiftContribution,
  )[0]!.group;

  const trainMetrics = evaluateProbabilitiesV1(
    trainRows.map((r) => r.target),
    trainRows.map((r) => r.probability),
    MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
  );
  const valMetrics = evaluateProbabilitiesV1(
    valRows.map((r) => r.target),
    valRows.map((r) => r.probability),
    MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
  );
  const baselineVal = evaluateProbabilitiesV1(
    valRows.map((r) => r.target),
    valRows.map(() => BASELINE_TRAIN_HOME_RATE_V2A_DIAG),
    MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
  );

  const trainActual = trainMetrics.actualHomeRate;
  const valActual = valMetrics.actualHomeRate;
  const trainBias = trainMetrics.meanPredictedProbability - trainActual;
  const valBias = valMetrics.meanPredictedProbability - valActual;
  const trainEmpLogit = empiricalBaseRateLogit(trainActual);
  const valEmpLogit = empiricalBaseRateLogit(valActual);
  const trainCalibOffset = calibrationOffsetForMeanProbability(
    trainRows.map((r) => r.logit),
    trainActual,
  );
  const valCalibOffset = calibrationOffsetForMeanProbability(
    valRows.map((r) => r.logit),
    valActual,
  );

  const valCalib = fixedBinCalibrationTable(
    valRows.map((r) => r.target),
    valRows.map((r) => r.probability),
  );
  const trainAuc = rocAucMannWhitney(
    trainRows.map((r) => r.target),
    trainRows.map((r) => r.probability),
  );
  const valAuc = rocAucMannWhitney(
    valRows.map((r) => r.target),
    valRows.map((r) => r.probability),
  );
  const trainSep = classSeparation(trainRows);
  const valSep = classSeparation(valRows);

  const v1Val = v1Evaluation.validation;
  const v1Auc = rocAucMannWhitney(
    v1Val.map((r) => r.target),
    v1Val.map((r) => r.probability),
  );
  const v1Calib = fixedBinCalibrationTable(
    v1Val.map((r) => r.target),
    v1Val.map((r) => r.probability),
  );
  const v1Sep = classSeparationFromEval(v1Val);
  const v1ValMetrics = evaluateProbabilitiesV1(
    v1Val.map((r) => r.target),
    v1Val.map((r) => r.probability),
  );

  const dateBins = VALIDATION_DATE_BINS.map((bin) => {
    const subset = valRows.filter(
      (r) => r.officialDate >= bin.start && r.officialDate <= bin.end,
    );
    const metrics = evaluateProbabilitiesV1(
      subset.map((r) => r.target),
      subset.map((r) => r.probability),
    );
    return {
      id: bin.id,
      start: bin.start,
      end: bin.end,
      n: subset.length,
      actualHomeRate: metrics.actualHomeRate,
      meanPredictedProbability: metrics.meanPredictedProbability,
      meanProbabilityBias: metrics.meanPredictedProbability - metrics.actualHomeRate,
      meanLogit: mean(subset.map((r) => r.logit)),
      predictedHomeClassRate: metrics.predictedHomeRate,
      rocAuc: rocAucMannWhitney(
        subset.map((r) => r.target),
        subset.map((r) => r.probability),
      ),
      logLoss: metrics.logLoss,
      brierScore: metrics.brierScore,
    };
  });

  const missingShift = missingNames.map((name) => {
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
  const missingIndicatorTotalShift = missingShift.reduce(
    (s, r) => s + r.shiftContribution,
    0,
  );

  const trainImputedCols = baseNames.map((_, j) => {
    const median = model.preprocessing.medianByFeature[baseNames[j]!]!;
    return trainRows.map((r) => (r.rawBase[j] == null ? median : r.rawBase[j]!));
  });
  const corrPairs: Array<{ featureA: string; featureB: string; correlation: number }> =
    [];
  for (let i = 0; i < baseNames.length; i += 1) {
    for (let k = i + 1; k < baseNames.length; k += 1) {
      corrPairs.push({
        featureA: baseNames[i]!,
        featureB: baseNames[k]!,
        correlation: pearsonCorrelationDiag(
          trainImputedCols[i]!,
          trainImputedCols[k]!,
        ),
      });
    }
  }
  corrPairs.sort((a, b) => {
    const d = Math.abs(b.correlation) - Math.abs(a.correlation);
    if (d !== 0) return d;
    return `${a.featureA}:${a.featureB}` < `${b.featureA}:${b.featureB}` ? -1 : 1;
  });
  const highCorrelationPairCount = corrPairs.filter(
    (p) => Math.abs(p.correlation) >= 0.9,
  ).length;

  const allowed = new Set([...split.trainGamePks, ...split.validationGamePks]);
  const identityRows: IndependentJoinRowV1[] = [];
  for (const row of join.rows) {
    if (allowed.has(row.identity.gamePk)) identityRows.push(row);
  }
  let h2hViol = 0;
  let homeLast5 = 0;
  let awayLast5 = 0;
  for (const row of identityRows) {
    if (
      row.feature.headToHeadGamesBefore !==
      row.feature.headToHeadHomeWinsBefore + row.feature.headToHeadAwayWinsBefore
    ) {
      h2hViol += 1;
    }
    const hg = row.feature.home.gamesPlayedBefore;
    const h5w = row.feature.home.last5WinsBefore;
    const h5l = row.feature.home.last5LossesBefore;
    if (h5w != null && h5l != null && h5w + h5l !== Math.min(5, hg)) homeLast5 += 1;
    const ag = row.feature.away.gamesPlayedBefore;
    const a5w = row.feature.away.last5WinsBefore;
    const a5l = row.feature.away.last5LossesBefore;
    if (a5w != null && a5l != null && a5w + a5l !== Math.min(5, ag)) awayLast5 += 1;
  }

  const partitionSummary = (rows: DiagRow[], metrics: typeof trainMetrics, meanLogit: number) => ({
    n: rows.length,
    actualHomeRate: metrics.actualHomeRate,
    meanProbability: metrics.meanPredictedProbability,
    medianProbability: metrics.median,
    min: metrics.minimumProbability,
    p10: metrics.p10,
    p25: metrics.p25,
    p50: metrics.median,
    p75: metrics.p75,
    p90: metrics.p90,
    max: metrics.maximumProbability,
    meanLogit,
    predictedHomeClassRate: metrics.predictedHomeRate,
  });

  const evidenceSummary = {
    residualLogitShift,
    largestResidualShiftGroup,
    validationMeanProbabilityBias: valBias,
    validationCalibrationOffsetNeeded: valCalibOffset,
    validationRocAuc: valAuc,
    validationMeanPHome: valSep.meanPHome,
    validationMeanPAway: valSep.meanPAway,
    validationClassSeparation: valSep.meanDifference,
    validationFixedBinECE: valCalib.ece,
    v2aValidationLogLoss: valMetrics.logLoss,
    baselineValidationLogLoss: baselineVal.logLoss,
    v2aValidationBrier: valMetrics.brierScore,
    baselineValidationBrier: baselineVal.brierScore,
    targetBaseRateShift: valActual - trainActual,
    modelMeanLogitShift: residualLogitShift,
    note: "No automatic CALIBRATION_DOMINANT / DISCRIMINATION_DOMINANT classification. Evidence only. Calibration offset is diagnostic and was not applied.",
  };

  const diagnostic = {
    schemaVersion: MLB_INDEPENDENT_V2A_CALIB_DIAG_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_V2A_CALIB_DIAG_BUILDER_V1,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    modelPrototype: true,
    modelCandidate: false,
    engineApproved: false,
    holdoutEvaluated: false,
    modelCoreHash: model.modelCoreHash,
    v1BaselineModelCoreHash: model.v1BaselineModelCoreHash,
    sourceJoinArtifactHash: sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    trainingSampleCount: 1463,
    validationSampleCount: 483,
    holdoutMembershipCount: 483,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    holdoutTransformedRows: 0,
    holdoutLogitsCreated: 0,
    holdoutProbabilitiesCreated: 0,
    trainProbabilityReplayMatch: "PASS" as const,
    validationProbabilityReplayMatch: "PASS" as const,
    residualLogitShiftReconciliation: "PASS" as const,
    intercept: model.intercept,
    trainSummary: partitionSummary(trainRows, trainMetrics, trainMeanLogit),
    validationSummary: partitionSummary(valRows, valMetrics, validationMeanLogit),
    residualLogitShift,
    sumFeatureShiftContributions: sumFeatureShift,
    trainMeanLogit,
    validationMeanLogit,
    trainMeanLogitFromFeatureMeans,
    validationMeanLogitFromFeatureMeans,
    featureDrift,
    residualDriftTop15: driftRanked.slice(0, 15).map((r, i) => ({
      rank: i + 1,
      feature: r.featureName,
      coefficient: r.coefficient,
      trainMean: r.trainMean,
      validationMean: r.validationMean,
      deltaMean: r.deltaMean,
      shiftContribution: r.shiftContribution,
    })),
    semanticGroupContributions: groupContributions,
    largestResidualShiftGroup,
    calibrationInTheLarge: {
      trainActualHomeRate: trainActual,
      trainMeanPredictedProbability: trainMetrics.meanPredictedProbability,
      trainMeanProbabilityBias: trainBias,
      trainAbsoluteMeanProbabilityBias: Math.abs(trainBias),
      validationActualHomeRate: valActual,
      validationMeanPredictedProbability: valMetrics.meanPredictedProbability,
      validationMeanProbabilityBias: valBias,
      validationAbsoluteMeanProbabilityBias: Math.abs(valBias),
    },
    empiricalBaseRateLogit: {
      train: trainEmpLogit,
      validation: valEmpLogit,
      validationMinusTrain: valEmpLogit - trainEmpLogit,
      trainMeanModelLogit: trainMeanLogit,
      validationMeanModelLogit: validationMeanLogit,
      trainMeanLogitMinusEmpirical: trainMeanLogit - trainEmpLogit,
      validationMeanLogitMinusEmpirical: validationMeanLogit - valEmpLogit,
    },
    targetBaseRateShift: {
      trainActualHomeRate: trainActual,
      validationActualHomeRate: valActual,
      difference: valActual - trainActual,
      empiricalLogitDifference: valEmpLogit - trainEmpLogit,
      modelMeanLogitShift: residualLogitShift,
      note: "True HOME prior moved down; frozen v2-A mean logit still moved slightly up.",
    },
    calibrationOffsetDiagnostic: {
      trainCalibrationOffsetNeeded: trainCalibOffset,
      validationCalibrationOffsetNeeded: valCalibOffset,
      applied: false,
      note: "Diagnostic bisection only. Offset was not applied to probabilities, intercept, or model core.",
    },
    validationFixedBinCalibration: valCalib.bins,
    validationFixedBinECE: valCalib.ece,
    validationBrierDecomposition: {
      uncertainty: valCalib.uncertainty,
      reliability: valCalib.reliability,
      resolution: valCalib.resolution,
      reconstructed:
        valCalib.reliability - valCalib.resolution + valCalib.uncertainty,
      rawBrier: valMetrics.brierScore,
    },
    trainRocAuc: trainAuc,
    validationRocAuc: valAuc,
    constantBaselineRocAuc: 0.5,
    trainClassSeparation: trainSep,
    validationClassSeparation: valSep,
    constantBaseline: {
      p: BASELINE_TRAIN_HOME_RATE_V2A_DIAG,
      validationLogLoss: baselineVal.logLoss,
      validationBrier: baselineVal.brierScore,
      rocAuc: 0.5,
    },
    v1Comparison: {
      v1ModelCoreHash: v1Evaluation.modelCoreHash,
      v1ValidationRocAuc: v1Auc,
      v2aValidationRocAuc: valAuc,
      v1ValidationFixedBinECE: v1Calib.ece,
      v2aValidationFixedBinECE: valCalib.ece,
      v1ClassSeparationMeanDifference: v1Sep.meanDifference,
      v2aClassSeparationMeanDifference: valSep.meanDifference,
      v1ValidationLogLoss: v1ValMetrics.logLoss,
      v2aValidationLogLoss: valMetrics.logLoss,
      v1ValidationBrier: v1ValMetrics.brierScore,
      v2aValidationBrier: valMetrics.brierScore,
      v1ValidationMeanProbability: v1ValMetrics.meanPredictedProbability,
      v2aValidationMeanProbability: valMetrics.meanPredictedProbability,
    },
    validationChronologicalBins: dateBins,
    missingnessShift: missingShift,
    missingIndicatorTotalShiftContribution: missingIndicatorTotalShift,
    trainTopCorrelations: corrPairs.slice(0, 20),
    highCorrelationPairCount,
    structuralRedundancy: {
      headToHeadGamesEqualsWinsPlusWinsViolations: h2hViol,
      homeLast5SumViolations: homeLast5,
      awayLast5SumViolations: awayLast5,
      note: "gamesPlayedBefore is not in v2-A X; it is read from sealed Feature rows only to audit last5 identity.",
    },
    evidenceSummary,
  };

  const audit = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    modelCandidate: false,
    holdoutEvaluated: false,
    trainingFunctionCalled: false,
    preprocessorFitCalled: false,
    optimizerCalled: false,
    modelCoreChanged: false,
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
    modelCoreHash: model.modelCoreHash,
    v1BaselineModelCoreHash: model.v1BaselineModelCoreHash,
    sourceJoinArtifactHash: sourceJoinHash,
    sourceSplitManifestHash: split.splitManifestHash,
    holdoutMembershipCount: 483,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    holdoutTransformedRows: 0,
    holdoutLogitsCreated: 0,
    holdoutProbabilitiesCreated: 0,
    trainProbabilityReplayMatch: true,
    validationProbabilityReplayMatch: true,
    residualLogitShiftReconciliation: true,
    residualLogitShift,
    validationMeanProbabilityBias: valBias,
    validationCalibrationOffsetNeeded: valCalibOffset,
    validationRocAuc: valAuc,
    validationFixedBinECE: valCalib.ece,
    evidenceSummary,
  };

  return { diagnostic, audit };
}
