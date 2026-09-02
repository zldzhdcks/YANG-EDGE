/**
 * TRAIN-only median imputation + TRAIN-only standardization.
 * Missing indicators stay 0/1 and are not scaled.
 */
import type { MlbIndependentFeatureRowV1 } from "../independent-model-v1";
import { IndependentLogisticError } from "./spec";
import {
  MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V1,
  MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V1,
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V1,
  orderedLogisticBaseFeatureNamesV1,
  orderedLogisticMissingIndicatorNamesV1,
  orderedLogisticModelFeatureNamesV1,
} from "./spec";
import { MLB_INDEPENDENT_LOGISTIC_ZERO_STD_V1 } from "./logistic";

export type LogisticTrainRowV1 = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  target: 0 | 1;
  feature: MlbIndependentFeatureRowV1;
};

export type LogisticPreprocessorV1 = {
  fitPartition: "TRAIN";
  fitSampleCount: number;
  orderedBaseFeatureNames: string[];
  orderedMissingIndicatorNames: string[];
  orderedModelFeatureNames: string[];
  medianByFeature: Record<string, number>;
  meanByFeature: Record<string, number>;
  scaleByFeature: Record<string, number>;
  zeroVarianceFeatureNames: string[];
};

function readFeatureField(
  feature: MlbIndependentFeatureRowV1,
  name: string,
): number | null {
  if (name.startsWith("home.") || name.startsWith("away.")) {
    const [side, field] = name.split(".") as ["home" | "away", string];
    const value = (feature[side] as Record<string, number | null>)[field];
    if (value === null) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new IndependentLogisticError(
        "FEATURE_NONFINITE",
        `${name}=${value} gamePk=${feature.identity.gamePk}`,
      );
    }
    return value;
  }
  const value = (feature as unknown as Record<string, unknown>)[name];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new IndependentLogisticError(
      "FEATURE_NONFINITE",
      `${name}=${value} gamePk=${feature.identity.gamePk}`,
    );
  }
  return value;
}

export function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function extractRawBaseAndMissing(
  feature: MlbIndependentFeatureRowV1,
): { base: Array<number | null>; missing: number[] } {
  const names = orderedLogisticBaseFeatureNamesV1();
  const missingNames = orderedLogisticMissingIndicatorNamesV1();
  const base: Array<number | null> = names.map((name) =>
    readFeatureField(feature, name),
  );
  const missingNameSet = new Set(missingNames);
  const missing: number[] = [];
  for (let i = 0; i < names.length; i += 1) {
    const indicator = `${names[i]}.missing`;
    if (!missingNameSet.has(indicator)) continue;
    missing.push(base[i] == null ? 1 : 0);
  }
  if (missing.length !== MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V1) {
    throw new IndependentLogisticError(
      "FEATURE_SPEC_INVALID",
      `missing indicators ${missing.length}`,
    );
  }
  return { base, missing };
}

export function fitTrainPreprocessorV1(
  trainRows: LogisticTrainRowV1[],
): LogisticPreprocessorV1 {
  if (trainRows.length === 0) {
    throw new IndependentLogisticError("EMPTY_TRAIN", "TRAIN rows empty");
  }
  const orderedBaseFeatureNames = orderedLogisticBaseFeatureNamesV1();
  const orderedMissingIndicatorNames = orderedLogisticMissingIndicatorNamesV1();
  const orderedModelFeatureNames = orderedLogisticModelFeatureNamesV1();
  const columns: Array<Array<number | null>> = orderedBaseFeatureNames.map(
    () => [],
  );
  for (const row of trainRows) {
    const { base } = extractRawBaseAndMissing(row.feature);
    for (let j = 0; j < orderedBaseFeatureNames.length; j += 1) {
      columns[j]!.push(base[j]!);
    }
  }

  const medianByFeature: Record<string, number> = {};
  for (let j = 0; j < orderedBaseFeatureNames.length; j += 1) {
    const observed = columns[j]!.filter((v): v is number => v != null);
    medianByFeature[orderedBaseFeatureNames[j]!] = medianOf(observed);
  }

  const imputed: number[][] = trainRows.map((_, i) =>
    orderedBaseFeatureNames.map((name, j) => {
      const raw = columns[j]![i]!;
      return raw == null ? medianByFeature[name]! : raw;
    }),
  );

  const meanByFeature: Record<string, number> = {};
  const scaleByFeature: Record<string, number> = {};
  const zeroVarianceFeatureNames: string[] = [];
  const n = trainRows.length;
  for (let j = 0; j < orderedBaseFeatureNames.length; j += 1) {
    const name = orderedBaseFeatureNames[j]!;
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += imputed[i]![j]!;
    const mean = sum / n;
    let varSum = 0;
    for (let i = 0; i < n; i += 1) {
      const d = imputed[i]![j]! - mean;
      varSum += d * d;
    }
    const std = Math.sqrt(varSum / n);
    meanByFeature[name] = mean;
    if (Math.abs(std) < MLB_INDEPENDENT_LOGISTIC_ZERO_STD_V1) {
      scaleByFeature[name] = 1;
      zeroVarianceFeatureNames.push(name);
    } else {
      scaleByFeature[name] = std;
    }
  }

  return {
    fitPartition: "TRAIN",
    fitSampleCount: n,
    orderedBaseFeatureNames,
    orderedMissingIndicatorNames,
    orderedModelFeatureNames,
    medianByFeature,
    meanByFeature,
    scaleByFeature,
    zeroVarianceFeatureNames,
  };
}

export function transformRowV1(
  feature: MlbIndependentFeatureRowV1,
  prep: LogisticPreprocessorV1,
): number[] {
  const { base, missing } = extractRawBaseAndMissing(feature);
  const out = new Array<number>(MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V1);
  for (let j = 0; j < MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V1; j += 1) {
    const name = prep.orderedBaseFeatureNames[j]!;
    const raw = base[j];
    const filled = raw == null ? prep.medianByFeature[name]! : raw;
    out[j] = (filled - prep.meanByFeature[name]!) / prep.scaleByFeature[name]!;
    if (!Number.isFinite(out[j]!)) {
      throw new IndependentLogisticError(
        "TRANSFORM_NONFINITE",
        `${name}=${out[j]}`,
      );
    }
  }
  for (let j = 0; j < MLB_INDEPENDENT_LOGISTIC_MISSING_DIM_V1; j += 1) {
    out[MLB_INDEPENDENT_LOGISTIC_BASE_DIM_V1 + j] = missing[j]!;
  }
  return out;
}

export function transformMatrixV1(
  rows: LogisticTrainRowV1[],
  prep: LogisticPreprocessorV1,
): { X: Float64Array; y: Float64Array } {
  const n = rows.length;
  const dim = MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V1;
  const X = new Float64Array(n * dim);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const vec = transformRowV1(rows[i]!.feature, prep);
    X.set(vec, i * dim);
    y[i] = rows[i]!.target;
  }
  return { X, y };
}
