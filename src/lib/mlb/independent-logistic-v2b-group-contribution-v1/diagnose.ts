/**
 * TRAIN-only leave-one-group-out contribution diagnostic for frozen v2-B.
 * Rolling folds stay inside TRAIN. Validation and Holdout are membership-only.
 * Does not create v2-C, select features, or recalculate Validation metrics.
 */
import path from "node:path";
import { MLB_INDEPENDENT_ENGINE_ADMISSION } from "../independent-model-v1";
import type {
  IndependentJoinArtifactV1,
  IndependentJoinRowV1,
} from "../independent-join-v1";
import type { IndependentSplitArtifactV1 } from "../independent-split-v1";
import {
  MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1,
  verifySealedSplitForTrainingV1,
} from "../independent-logistic-v1/train";
import {
  MLB_INDEPENDENT_LOGISTIC_ARMIJO_V1,
  MLB_INDEPENDENT_LOGISTIC_BACKTRACK_V1,
  MLB_INDEPENDENT_LOGISTIC_GRAD_TOL_V1,
  MLB_INDEPENDENT_LOGISTIC_INITIAL_STEP_V1,
  MLB_INDEPENDENT_LOGISTIC_LAMBDA_V1,
  MLB_INDEPENDENT_LOGISTIC_MAX_ITERS_V1,
  MLB_INDEPENDENT_LOGISTIC_MIN_STEP_V1,
  MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
  fitFullBatchLogisticV1,
  predictLogisticProbability,
} from "../independent-logistic-v1/logistic";
import { evaluateProbabilitiesV1 } from "../independent-logistic-v1/metrics";
import { rocAucMannWhitney } from "../independent-logistic-v2a-diagnostic-v1";
import {
  IndependentLogisticError,
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B,
  MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B,
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B,
  MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B,
  orderedLogisticMissingIndicatorNamesV2b,
  orderedLogisticModelFeatureNamesV2b,
} from "../independent-logistic-v2b/spec";
import {
  fitTrainPreprocessorV2b,
  transformMatrixV2b,
  transformRowV2b,
  type LogisticPreprocessorV2b,
  type LogisticTrainRowV2b,
} from "../independent-logistic-v2b/preprocess";
import {
  ROLLING_FOLDS_V2B,
  TRAIN_TEMPORAL_WINDOWS_V2B,
  independentLogisticV2bRollingPath,
  independentLogisticV2bRollingRel,
} from "../independent-logistic-v2b/train";

export const MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_GCV1 =
  "f601594dcac1ae266424cf1a1503ecc1228099c2b1e090c634d54868f379c24e";
export const MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_GCV1 =
  MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_V1;
export const MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_GCV1 =
  "6f9e0875d453fe52de8d56fef0a25427270989123df568020c8e1d0fdd417127";

export const MLB_INDEPENDENT_V2B_GROUP_CONTRIB_SCHEMA_V1 =
  "mlb-independent-logistic-v2b-train-group-contribution-diagnostic-v1" as const;
export const MLB_INDEPENDENT_V2B_GROUP_CONTRIB_BUILDER_V1 =
  "mlb-independent-logistic-v2b-group-contribution-v1" as const;

export const REPLAY_TOLERANCE_GCV1 = 1e-12;

export const FROZEN_V2B_VALIDATION_PROVENANCE_GCV1 = {
  source: "sealed-v2b-audit-copied-not-recalculated",
  n: 483,
  rocAuc: 0.5471445721145601,
  logLoss: 0.6923976944705145,
  brierScore: 0.2495718525450235,
  accuracy: 0.5631469979296067,
} as const;

export const COLLINEARITY_WARNING_GCV1 =
  "Group removal retrains coefficients, so the measured change includes redistribution among correlated features. This is not causal importance.";

export const SEMANTIC_FEATURE_GROUPS_V2B: Record<
  string,
  readonly string[]
> = {
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
  HEAD_TO_HEAD: [
    "headToHeadGamesBefore",
    "headToHeadHomeWinsBefore",
    "headToHeadAwayWinsBefore",
  ],
  MISSING_INDICATORS: orderedLogisticMissingIndicatorNamesV2b(),
};

export const LEAVE_ONE_GROUP_OUT_V2B = [
  "RATE_STRENGTH",
  "RECENT_FORM",
  "SEASON_RUN_QUALITY",
  "HEAD_TO_HEAD",
  "MISSING_INDICATORS",
] as const;

export type LeaveOneGroupV2b = (typeof LEAVE_ONE_GROUP_OUT_V2B)[number];

export const VARIANT_EXPECTED_DIM_V2B: Record<
  "BASELINE" | LeaveOneGroupV2b,
  number
> = {
  BASELINE: 45,
  RATE_STRENGTH: 39,
  RECENT_FORM: 35,
  SEASON_RUN_QUALITY: 41,
  HEAD_TO_HEAD: 42,
  MISSING_INDICATORS: 23,
};

export type GroupContributionMetricsV1 = {
  fitN: number;
  evalN: number;
  rocAuc: number;
  logLoss: number;
  brierScore: number;
  accuracy: number;
  actualHomeRate: number;
  meanPredictedProbability: number;
  signedProbabilityBias: number;
  absoluteProbabilityBias: number;
  predictedHomeClassRate: number;
  preprocessorFitSampleCount: number;
  modelDimensions: number;
};

export type SealedV2bRollingFoldV1 = {
  id: string;
  v2b: {
    fitN: number;
    evalN: number;
    actualHomeRate: number;
    rocAuc: number;
    accuracy: number;
    logLoss: number;
    brierScore: number;
    meanProbability: number;
    meanProbabilityBias: number;
    predictedHomeClassRate: number;
  };
};

export type SealedV2bRollingArtifactV1 = {
  folds: SealedV2bRollingFoldV1[];
};

export function independentLogisticV2bGroupContribDiagnosticRel(): string {
  return "data/research/mlb/independent-model-v1/diagnostics/2024-logistic-v2b-train-group-contribution-diagnostic-v1.json";
}
export function independentLogisticV2bGroupContribDiagnosticPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentLogisticV2bGroupContribDiagnosticRel());
}
export function independentLogisticV2bGroupContribAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-logistic-v2b-train-group-contribution-audit-v1.json";
}
export function independentLogisticV2bGroupContribAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentLogisticV2bGroupContribAuditRel());
}

export function dateInInclusiveWindow(
  officialDate: string,
  start: string,
  end: string,
): boolean {
  return officialDate >= start && officialDate <= end;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}

function medianOf(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function compareTrainOrder(
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

export function assertSemanticGroupCoverageV2b(): {
  GROUP_FEATURE_COUNT: 45;
  GROUP_OVERLAP: 0;
  GROUP_MISSING: 0;
} {
  const all = orderedLogisticModelFeatureNamesV2b();
  const seen = new Set<string>();
  let count = 0;
  for (const [group, names] of Object.entries(SEMANTIC_FEATURE_GROUPS_V2B)) {
    if (group === "STREAK_REST") {
      throw new IndependentLogisticError(
        "STREAK_REST_GROUP_PRESENT",
        "STREAK_REST must stay absent from v2-B groups",
      );
    }
    for (const name of names) {
      if (seen.has(name)) {
        throw new IndependentLogisticError("GROUP_OVERLAP", `${name} in ${group}`);
      }
      seen.add(name);
      count += 1;
    }
  }
  if (count !== 45 || seen.size !== 45 || all.length !== 45) {
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
  for (const removed of MLB_INDEPENDENT_LOGISTIC_REMOVED_STREAK_REST_V2B) {
    if (seen.has(removed) || all.includes(removed)) {
      throw new IndependentLogisticError(
        "STREAK_REST_FEATURE_IN_V2B_GROUPS",
        removed,
      );
    }
  }
  return {
    GROUP_FEATURE_COUNT: 45,
    GROUP_OVERLAP: 0,
    GROUP_MISSING: 0,
  };
}

export function remainingFeatureNamesAfterRemovingGroup(
  group: LeaveOneGroupV2b | null,
): string[] {
  const all = orderedLogisticModelFeatureNamesV2b();
  if (group == null) return [...all];
  const drop = new Set(SEMANTIC_FEATURE_GROUPS_V2B[group]);
  if (drop.size !== SEMANTIC_FEATURE_GROUPS_V2B[group]!.length) {
    throw new IndependentLogisticError("GROUP_INTERNAL_DUP", group);
  }
  const remaining = all.filter((name) => !drop.has(name));
  const expected =
    group === null
      ? VARIANT_EXPECTED_DIM_V2B.BASELINE
      : VARIANT_EXPECTED_DIM_V2B[group];
  if (remaining.length !== expected) {
    throw new IndependentLogisticError(
      "VARIANT_DIM_MISMATCH",
      `${group} remaining=${remaining.length} expected=${expected}`,
    );
  }
  const extraDropped = all.filter(
    (name) => !remaining.includes(name) && !drop.has(name),
  );
  if (extraDropped.length !== 0) {
    throw new IndependentLogisticError(
      "UNINTENDED_REMOVED_FEATURE",
      extraDropped.join(","),
    );
  }
  return remaining;
}

export function preprocessorFingerprintV2b(
  prep: LogisticPreprocessorV2b,
): string {
  return JSON.stringify({
    fitSampleCount: prep.fitSampleCount,
    medianByFeature: prep.medianByFeature,
    meanByFeature: prep.meanByFeature,
    scaleByFeature: prep.scaleByFeature,
    zeroVarianceFeatureNames: prep.zeroVarianceFeatureNames,
  });
}

function keepIndices(remaining: string[]): number[] {
  const all = orderedLogisticModelFeatureNamesV2b();
  const idx = new Map(all.map((name, i) => [name, i]));
  return remaining.map((name) => {
    const i = idx.get(name);
    if (i == null) {
      throw new IndependentLogisticError("FEATURE_NOT_IN_V2B", name);
    }
    return i;
  });
}

function selectColumns(
  X: Float64Array,
  n: number,
  fullDim: number,
  keep: number[],
): Float64Array {
  const dim = keep.length;
  const out = new Float64Array(n * dim);
  for (let i = 0; i < n; i += 1) {
    const src = i * fullDim;
    const dst = i * dim;
    for (let k = 0; k < dim; k += 1) {
      out[dst + k] = X[src + keep[k]!]!;
    }
  }
  return out;
}

function metricsFromScored(
  fitN: number,
  rows: Array<{ target: 0 | 1; probability: number }>,
  preprocessorFitSampleCount: number,
  modelDimensions: number,
): GroupContributionMetricsV1 {
  const y = rows.map((r) => r.target);
  const p = rows.map((r) => r.probability);
  const m = evaluateProbabilitiesV1(y, p);
  const rocAuc = rocAucMannWhitney(y, p);
  const signed = m.meanPredictedProbability - m.actualHomeRate;
  return {
    fitN,
    evalN: rows.length,
    rocAuc,
    logLoss: m.logLoss,
    brierScore: m.brierScore,
    accuracy: m.accuracy,
    actualHomeRate: m.actualHomeRate,
    meanPredictedProbability: m.meanPredictedProbability,
    signedProbabilityBias: signed,
    absoluteProbabilityBias: Math.abs(signed),
    predictedHomeClassRate: m.predictedHomeRate,
    preprocessorFitSampleCount,
    modelDimensions,
  };
}

export function fitVariantOnFold(
  fitRows: LogisticTrainRowV2b[],
  evalRows: LogisticTrainRowV2b[],
  remainingNames: string[],
): {
  metrics: GroupContributionMetricsV1;
  preprocessor: LogisticPreprocessorV2b;
  intercept: number;
  coefficients: number[];
} {
  if (fitRows.length === 0 || evalRows.length === 0) {
    throw new IndependentLogisticError(
      "EMPTY_FOLD",
      `fit=${fitRows.length} eval=${evalRows.length}`,
    );
  }
  const prep = fitTrainPreprocessorV2b(fitRows);
  if (prep.fitSampleCount !== fitRows.length) {
    throw new IndependentLogisticError(
      "PREPROCESSOR_FIT_COUNT",
      `${prep.fitSampleCount} != ${fitRows.length}`,
    );
  }
  const dim = remainingNames.length;
  const keep = keepIndices(remainingNames);
  const fitted = transformMatrixV2b(fitRows, prep);
  const X =
    dim === MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B
      ? fitted.X
      : selectColumns(
          fitted.X,
          fitRows.length,
          MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B,
          keep,
        );
  const fit = fitFullBatchLogisticV1(X, fitted.y, dim);
  const scored = evalRows.map((row) => {
    const full = transformRowV2b(row.feature, prep);
    const x =
      dim === MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2B
        ? full
        : keep.map((j) => full[j]!);
    return {
      target: row.target,
      probability: predictLogisticProbability(x, fit.weights, fit.intercept),
    };
  });
  return {
    metrics: metricsFromScored(
      fitRows.length,
      scored,
      prep.fitSampleCount,
      dim,
    ),
    preprocessor: prep,
    intercept: fit.intercept,
    coefficients: fit.weights,
  };
}

export function labeledTrainRowsOnly(
  join: IndependentJoinArtifactV1,
  trainGamePks: number[],
): LogisticTrainRowV2b[] {
  const allowed = new Set(trainGamePks);
  const found: IndependentJoinRowV1[] = [];
  for (const row of join.rows) {
    if (!allowed.has(row.identity.gamePk)) continue;
    found.push(row);
  }
  if (found.length !== trainGamePks.length) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `train found=${found.length} expected=${trainGamePks.length}`,
    );
  }
  const rows: LogisticTrainRowV2b[] = found.map((row) => {
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
      feature: row.feature,
    };
  });
  rows.sort(compareTrainOrder);
  return rows;
}

function membershipCountOnly(
  join: IndependentJoinArtifactV1,
  pks: number[],
  label: string,
): number {
  const identityPks = new Set(join.rows.map((row) => row.identity.gamePk));
  for (const pk of pks) {
    if (!identityPks.has(pk)) {
      throw new IndependentLogisticError(
        "MEMBERSHIP_PK_MISSING",
        `${label} ${pk}`,
      );
    }
  }
  return pks.length;
}

function rowsInWindows(
  rows: LogisticTrainRowV2b[],
  windowIds: readonly string[],
): LogisticTrainRowV2b[] {
  const windows = TRAIN_TEMPORAL_WINDOWS_V2B.filter((w) =>
    windowIds.includes(w.id),
  );
  return rows.filter((r) =>
    windows.some((w) => dateInInclusiveWindow(r.officialDate, w.start, w.end)),
  );
}

function withinTol(a: number, b: number, tol = REPLAY_TOLERANCE_GCV1): boolean {
  return Math.abs(a - b) <= tol;
}

export function replayBaselineAgainstSealed(
  actual: GroupContributionMetricsV1,
  sealed: SealedV2bRollingFoldV1["v2b"],
): boolean {
  return (
    actual.fitN === sealed.fitN &&
    actual.evalN === sealed.evalN &&
    withinTol(actual.rocAuc, sealed.rocAuc) &&
    withinTol(actual.logLoss, sealed.logLoss) &&
    withinTol(actual.brierScore, sealed.brierScore) &&
    withinTol(actual.accuracy, sealed.accuracy) &&
    withinTol(actual.actualHomeRate, sealed.actualHomeRate) &&
    withinTol(actual.meanPredictedProbability, sealed.meanProbability) &&
    withinTol(actual.signedProbabilityBias, sealed.meanProbabilityBias) &&
    withinTol(actual.predictedHomeClassRate, sealed.predictedHomeClassRate)
  );
}

function signOf(delta: number): -1 | 0 | 1 {
  if (delta > 0) return 1;
  if (delta < 0) return -1;
  return 0;
}

function effectConsistent(deltas: number[]): "YES" | "NO" {
  if (deltas.length === 0) return "NO";
  const first = signOf(deltas[0]!);
  return deltas.every((d) => signOf(d) === first) ? "YES" : "NO";
}

export function diagnoseV2bTrainGroupContributionV1(input: {
  join: IndependentJoinArtifactV1;
  split: IndependentSplitArtifactV1;
  sourceJoinHash: string;
  sealedRolling: SealedV2bRollingArtifactV1;
  sealedV2bModelCoreHash: string;
  generatedAt?: string;
}): { diagnostic: Record<string, unknown>; audit: Record<string, unknown> } {
  const coverage = assertSemanticGroupCoverageV2b();
  verifySealedSplitForTrainingV1(input.join, input.split, input.sourceJoinHash);
  if (
    input.sealedV2bModelCoreHash !==
    MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_GCV1
  ) {
    throw new IndependentLogisticError(
      "V2B_MODEL_CORE_HASH_PIN_MISMATCH",
      input.sealedV2bModelCoreHash,
    );
  }
  if (
    input.split.splitManifestHash !==
    MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_GCV1
  ) {
    throw new IndependentLogisticError(
      "SEALED_SPLIT_MANIFEST_HASH_MISMATCH",
      input.split.splitManifestHash,
    );
  }

  const validationMembershipCount = membershipCountOnly(
    input.join,
    input.split.validationGamePks,
    "validation",
  );
  const holdoutMembershipCount = membershipCountOnly(
    input.join,
    input.split.holdoutGamePks,
    "holdout",
  );
  if (validationMembershipCount !== 483 || holdoutMembershipCount !== 483) {
    throw new IndependentLogisticError(
      "MEMBERSHIP_COUNT",
      `val=${validationMembershipCount} hold=${holdoutMembershipCount}`,
    );
  }

  const trainRows = labeledTrainRowsOnly(input.join, input.split.trainGamePks);
  if (trainRows.length !== 1463) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `train=${trainRows.length}`,
    );
  }

  const windowCounts = TRAIN_TEMPORAL_WINDOWS_V2B.map((w) => {
    const n = trainRows.filter((r) =>
      dateInInclusiveWindow(r.officialDate, w.start, w.end),
    ).length;
    if (n !== w.expectedN) {
      throw new IndependentLogisticError(
        "TRAIN_WINDOW_COUNT_MISMATCH",
        `${w.id} n=${n} expected=${w.expectedN}`,
      );
    }
    return { id: w.id, start: w.start, end: w.end, n };
  });
  const assigned = windowCounts.reduce((s, w) => s + w.n, 0);
  if (assigned !== 1463) {
    throw new IndependentLogisticError("TRAIN_WINDOW_COVERAGE", `${assigned}`);
  }

  const baselineNames = remainingFeatureNamesAfterRemovingGroup(null);
  const variantNames = Object.fromEntries(
    LEAVE_ONE_GROUP_OUT_V2B.map((group) => [
      group,
      remainingFeatureNamesAfterRemovingGroup(group),
    ]),
  ) as Record<LeaveOneGroupV2b, string[]>;

  const sealedById = new Map(
    input.sealedRolling.folds.map((fold) => [fold.id, fold]),
  );
  const replay: Record<string, "PASS"> = {};
  const folds = ROLLING_FOLDS_V2B.map((fold) => {
    const fitRows = rowsInWindows(trainRows, fold.fit);
    const evalRows = rowsInWindows(trainRows, [fold.eval]);
    const baseline = fitVariantOnFold(fitRows, evalRows, baselineNames);
    if (baseline.metrics.preprocessorFitSampleCount !== fitRows.length) {
      throw new IndependentLogisticError(
        "EVAL_WINDOW_USED_FOR_PREPROCESSING",
        `${fold.id} prep=${baseline.metrics.preprocessorFitSampleCount} fit=${fitRows.length}`,
      );
    }
    const sealed = sealedById.get(fold.id);
    if (!sealed) {
      throw new IndependentLogisticError("SEALED_ROLLING_FOLD_MISSING", fold.id);
    }
    if (!replayBaselineAgainstSealed(baseline.metrics, sealed.v2b)) {
      throw new IndependentLogisticError(
        "V2B_ROLLING_REPLAY_FAIL",
        JSON.stringify({
          id: fold.id,
          actual: baseline.metrics,
          sealed: sealed.v2b,
        }),
      );
    }
    replay[fold.id] = "PASS";

    const variants = LEAVE_ONE_GROUP_OUT_V2B.map((group) => {
      const fitted = fitVariantOnFold(fitRows, evalRows, variantNames[group]);
      if (fitted.metrics.preprocessorFitSampleCount !== fitRows.length) {
        throw new IndependentLogisticError(
          "EVAL_WINDOW_USED_FOR_PREPROCESSING",
          `${fold.id} ${group}`,
        );
      }
      if (fitted.metrics.modelDimensions !== VARIANT_EXPECTED_DIM_V2B[group]) {
        throw new IndependentLogisticError(
          "VARIANT_DIM_MISMATCH",
          `${fold.id} ${group} dim=${fitted.metrics.modelDimensions}`,
        );
      }
      return {
        group,
        removedFeatureCount: SEMANTIC_FEATURE_GROUPS_V2B[group]!.length,
        remainingFeatureNames: variantNames[group],
        metrics: fitted.metrics,
        minusGroupAucMinusBaselineAuc:
          fitted.metrics.rocAuc - baseline.metrics.rocAuc,
        minusGroupLogLossMinusBaselineLogLoss:
          fitted.metrics.logLoss - baseline.metrics.logLoss,
        minusGroupBrierMinusBaselineBrier:
          fitted.metrics.brierScore - baseline.metrics.brierScore,
        minusGroupAbsBiasMinusBaselineAbsBias:
          fitted.metrics.absoluteProbabilityBias -
          baseline.metrics.absoluteProbabilityBias,
      };
    });

    return {
      id: fold.id,
      fitWindows: [...fold.fit],
      evalWindow: fold.eval,
      fitN: fitRows.length,
      evalN: evalRows.length,
      baseline: {
        group: "BASELINE",
        remainingFeatureNames: baselineNames,
        metrics: baseline.metrics,
      },
      variants,
    };
  });

  const groupAggregates = Object.fromEntries(
    LEAVE_ONE_GROUP_OUT_V2B.map((group) => {
      const perFold = folds.map((fold) => {
        const v = fold.variants.find((item) => item.group === group);
        if (!v) {
          throw new IndependentLogisticError("VARIANT_MISSING", group);
        }
        return v;
      });
      const auc = perFold.map((v) => v.minusGroupAucMinusBaselineAuc);
      const logLoss = perFold.map((v) => v.minusGroupLogLossMinusBaselineLogLoss);
      const brier = perFold.map((v) => v.minusGroupBrierMinusBaselineBrier);
      return [
        group,
        {
          group,
          removedFeatureCount: SEMANTIC_FEATURE_GROUPS_V2B[group]!.length,
          remainingDimensions: VARIANT_EXPECTED_DIM_V2B[group],
          meanAucDelta: mean(auc),
          medianAucDelta: medianOf(auc),
          meanLogLossDelta: mean(logLoss),
          medianLogLossDelta: medianOf(logLoss),
          meanBrierDelta: mean(brier),
          medianBrierDelta: medianOf(brier),
          foldsWhereRemovalLowersAuc: auc.filter((d) => d < 0).length,
          foldsWhereRemovalRaisesAuc: auc.filter((d) => d > 0).length,
          foldsWhereRemovalWorsensLogLoss: logLoss.filter((d) => d > 0).length,
          foldsWhereRemovalImprovesLogLoss: logLoss.filter((d) => d < 0).length,
          foldsWhereRemovalWorsensBrier: brier.filter((d) => d > 0).length,
          foldsWhereRemovalImprovesBrier: brier.filter((d) => d < 0).length,
          AUC_REMOVAL_EFFECT_CONSISTENT: effectConsistent(auc),
          LOGLOSS_REMOVAL_EFFECT_CONSISTENT: effectConsistent(logLoss),
          BRIER_REMOVAL_EFFECT_CONSISTENT: effectConsistent(brier),
          helpfulAucFoldCount: auc.filter((d) => d < 0).length,
          helpfulLogLossFoldCount: logLoss.filter((d) => d > 0).length,
          helpfulBrierFoldCount: brier.filter((d) => d > 0).length,
          foldDeltas: perFold.map((v, i) => ({
            foldId: folds[i]!.id,
            minusGroupAucMinusBaselineAuc: v.minusGroupAucMinusBaselineAuc,
            minusGroupLogLossMinusBaselineLogLoss:
              v.minusGroupLogLossMinusBaselineLogLoss,
            minusGroupBrierMinusBaselineBrier:
              v.minusGroupBrierMinusBaselineBrier,
            minusGroupAbsBiasMinusBaselineAbsBias:
              v.minusGroupAbsBiasMinusBaselineAbsBias,
          })),
        },
      ];
    }),
  );

  const aggregateList = LEAVE_ONE_GROUP_OUT_V2B.map(
    (group) => groupAggregates[group] as {
      group: string;
      meanAucDelta: number;
      meanLogLossDelta: number;
      meanBrierDelta: number;
    },
  );
  const rankingByAucCost = [...aggregateList].sort(
    (a, b) => a.meanAucDelta - b.meanAucDelta,
  );
  const rankingByLogLossCost = [...aggregateList].sort(
    (a, b) => b.meanLogLossDelta - a.meanLogLossDelta,
  );
  const rankingByBrierCost = [...aggregateList].sort(
    (a, b) => b.meanBrierDelta - a.meanBrierDelta,
  );

  const diagnostic = {
    schemaVersion: MLB_INDEPENDENT_V2B_GROUP_CONTRIB_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_V2B_GROUP_CONTRIB_BUILDER_V1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    modelCandidate: false,
    newModelCreated: false,
    featureSelectionPerformed: false,
    validationNewAnalysisPerformed: false,
    holdoutEvaluated: false,
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
    recommendationChanged: false,
    sourceJoinArtifactHash: input.sourceJoinHash,
    sourceSplitManifestHash: input.split.splitManifestHash,
    v1BaselineModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B,
    v2aBaselineModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B,
    v2bBaselineModelCoreHash:
      MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_GCV1,
    trainingSampleCount: 1463,
    validationMembershipCount,
    holdoutMembershipCount,
    VALIDATION_FEATURE_ROWS_READ: 0,
    VALIDATION_LABEL_ROWS_READ: 0,
    VALIDATION_TRANSFORMED_ROWS: 0,
    VALIDATION_PROBABILITIES_CREATED: 0,
    VALIDATION_EVALUATED: false,
    HOLDOUT_FEATURE_ROWS_READ: 0,
    HOLDOUT_LABEL_ROWS_READ: 0,
    HOLDOUT_TRANSFORMED_ROWS: 0,
    HOLDOUT_PROBABILITIES_CREATED: 0,
    HOLDOUT_EVALUATED: false,
    VALIDATION_HAS_BEEN_USED_FOR_MODEL_RESEARCH: true,
    VALIDATION_NEW_ANALYSIS_PERFORMED: false,
    LATE_ONLY_FEATURE_ADDED: false,
    T3H_COMPATIBILITY_CHANGED: false,
    frozenV2bValidationProvenance: FROZEN_V2B_VALIDATION_PROVENANCE_GCV1,
    groupCoverage: coverage,
    groupDefinitions: SEMANTIC_FEATURE_GROUPS_V2B,
    streakRestAbsent: true,
    variantExpectedDimensions: VARIANT_EXPECTED_DIM_V2B,
    hyperparameters: {
      lambda: MLB_INDEPENDENT_LOGISTIC_LAMBDA_V1,
      threshold: MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
      intercept: true,
      interceptRegularized: false,
      initialWeights: 0,
      initialIntercept: 0,
      optimizer: "FULL_BATCH_GRADIENT_DESCENT_BACKTRACKING",
      initialStep: MLB_INDEPENDENT_LOGISTIC_INITIAL_STEP_V1,
      backtrackFactor: MLB_INDEPENDENT_LOGISTIC_BACKTRACK_V1,
      armijoConstant: MLB_INDEPENDENT_LOGISTIC_ARMIJO_V1,
      maxIterations: MLB_INDEPENDENT_LOGISTIC_MAX_ITERS_V1,
      gradientTolerance: MLB_INDEPENDENT_LOGISTIC_GRAD_TOL_V1,
      minimumStep: MLB_INDEPENDENT_LOGISTIC_MIN_STEP_V1,
    },
    windowCounts,
    V2B_ROLLING_FOLD_1_REPLAY: replay.FOLD_1,
    V2B_ROLLING_FOLD_2_REPLAY: replay.FOLD_2,
    V2B_ROLLING_FOLD_3_REPLAY: replay.FOLD_3,
    folds,
    groupAggregates,
    rollingGroupContributionDiagnostic: {
      mostCostlyGroupToRemoveByMeanAucDelta: rankingByAucCost.map((g) => ({
        group: g.group,
        meanAucDelta: g.meanAucDelta,
      })),
      mostCostlyGroupToRemoveByMeanLogLossDelta: rankingByLogLossCost.map(
        (g) => ({
          group: g.group,
          meanLogLossDelta: g.meanLogLossDelta,
        }),
      ),
      mostCostlyGroupToRemoveByMeanBrierDelta: rankingByBrierCost.map((g) => ({
        group: g.group,
        meanBrierDelta: g.meanBrierDelta,
      })),
      mostBeneficialGroupToRemoveByMeanAucDelta: [...rankingByAucCost]
        .reverse()
        .map((g) => ({
          group: g.group,
          meanAucDelta: g.meanAucDelta,
        })),
      mostBeneficialGroupToRemoveByMeanLogLossDelta: [...rankingByLogLossCost]
        .reverse()
        .map((g) => ({
          group: g.group,
          meanLogLossDelta: g.meanLogLossDelta,
        })),
      mostBeneficialGroupToRemoveByMeanBrierDelta: [...rankingByBrierCost]
        .reverse()
        .map((g) => ({
          group: g.group,
          meanBrierDelta: g.meanBrierDelta,
        })),
    },
    collinearityWarning: COLLINEARITY_WARNING_GCV1,
    specialCaseNotes: {
      MISSING_INDICATORS:
        "Removing all 22 missing indicators is a temporary TRAIN rolling comparator only. It is not approval to remove them from the official model.",
      HEAD_TO_HEAD:
        "H2H contains structural redundancy (games = home wins + away wins). Only the complete group leave-one-group-out diagnostic is reported. No internal H2H feature selection.",
      RECENT_FORM:
        "This diagnostic tests the entire RECENT_FORM group. Individual last-5 features are not removed.",
    },
    interpretationNote:
      "Evidence only. This diagnostic does not select features, does not propose a v2-C specification, and does not authorize dropping any group. If removing a group makes TRAIN rolling metrics worse, the group appears helpful in that fold; if removing it makes metrics better, the group may be noisy. Coefficients are retrained after removal, so this is not causal importance. No new Validation analysis was performed.",
  };

  const audit = {
    generatedAt: diagnostic.generatedAt,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    modelCandidate: false,
    newModelCreated: false,
    featureSelectionPerformed: false,
    validationNewAnalysisPerformed: false,
    holdoutEvaluated: false,
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
    recommendationChanged: false,
    sourceJoinArtifactHash: input.sourceJoinHash,
    sourceSplitManifestHash: input.split.splitManifestHash,
    v1BaselineModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2B,
    v2aBaselineModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_V2B,
    v2bBaselineModelCoreHash:
      MLB_INDEPENDENT_2024_SEALED_V2B_MODEL_CORE_HASH_GCV1,
    trainingSampleCount: 1463,
    validationMembershipCount,
    holdoutMembershipCount,
    VALIDATION_FEATURE_ROWS_READ: 0,
    VALIDATION_LABEL_ROWS_READ: 0,
    VALIDATION_TRANSFORMED_ROWS: 0,
    VALIDATION_PROBABILITIES_CREATED: 0,
    VALIDATION_EVALUATED: false,
    HOLDOUT_FEATURE_ROWS_READ: 0,
    HOLDOUT_LABEL_ROWS_READ: 0,
    HOLDOUT_TRANSFORMED_ROWS: 0,
    HOLDOUT_PROBABILITIES_CREATED: 0,
    HOLDOUT_EVALUATED: false,
    VALIDATION_HAS_BEEN_USED_FOR_MODEL_RESEARCH: true,
    VALIDATION_NEW_ANALYSIS_PERFORMED: false,
    LATE_ONLY_FEATURE_ADDED: false,
    T3H_COMPATIBILITY_CHANGED: false,
    groupCoverage: coverage,
    variantExpectedDimensions: VARIANT_EXPECTED_DIM_V2B,
    V2B_ROLLING_FOLD_1_REPLAY: replay.FOLD_1,
    V2B_ROLLING_FOLD_2_REPLAY: replay.FOLD_2,
    V2B_ROLLING_FOLD_3_REPLAY: replay.FOLD_3,
    groupAggregates,
    rollingGroupContributionDiagnostic:
      diagnostic.rollingGroupContributionDiagnostic,
    collinearityWarning: COLLINEARITY_WARNING_GCV1,
    sealedRollingRel: independentLogisticV2bRollingRel(),
  };

  return { diagnostic, audit };
}

export { independentLogisticV2bRollingPath, independentLogisticV2bRollingRel };
