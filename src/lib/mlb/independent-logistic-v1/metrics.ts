/**
 * TRAIN / VALIDATION evaluation metrics. HOLDOUT is never evaluated here.
 */
import {
  clipProbabilityForLoss,
  MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
} from "./logistic";

export type LogisticConfusionV1 = {
  TP: number;
  TN: number;
  FP: number;
  FN: number;
};

export type LogisticMetricsV1 = {
  sampleCount: number;
  accuracy: number;
  logLoss: number;
  brierScore: number;
  confusion: LogisticConfusionV1;
  actualHomeRate: number;
  predictedHomeRate: number;
  meanPredictedProbability: number;
  minimumProbability: number;
  maximumProbability: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function evaluateProbabilitiesV1(
  y: ArrayLike<number>,
  probabilities: ArrayLike<number>,
  threshold = MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1,
): LogisticMetricsV1 {
  const n = y.length;
  let TP = 0;
  let TN = 0;
  let FP = 0;
  let FN = 0;
  let logSum = 0;
  let brierSum = 0;
  let probSum = 0;
  let minP = Number.POSITIVE_INFINITY;
  let maxP = Number.NEGATIVE_INFINITY;
  const probs: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const yi = y[i]!;
    const p = probabilities[i]!;
    const clipped = clipProbabilityForLoss(p);
    logSum += -(yi * Math.log(clipped) + (1 - yi) * Math.log(1 - clipped));
    brierSum += (p - yi) * (p - yi);
    probSum += p;
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
    probs.push(p);
    const pred = p >= threshold ? 1 : 0;
    if (pred === 1 && yi === 1) TP += 1;
    else if (pred === 0 && yi === 0) TN += 1;
    else if (pred === 1 && yi === 0) FP += 1;
    else FN += 1;
  }
  probs.sort((a, b) => a - b);
  return {
    sampleCount: n,
    accuracy: n === 0 ? 0 : (TP + TN) / n,
    logLoss: n === 0 ? 0 : logSum / n,
    brierScore: n === 0 ? 0 : brierSum / n,
    confusion: { TP, TN, FP, FN },
    actualHomeRate: n === 0 ? 0 : (TP + FN) / n,
    predictedHomeRate: n === 0 ? 0 : (TP + FP) / n,
    meanPredictedProbability: n === 0 ? 0 : probSum / n,
    minimumProbability: n === 0 ? 0 : minP,
    maximumProbability: n === 0 ? 0 : maxP,
    p10: quantile(probs, 0.1),
    p25: quantile(probs, 0.25),
    median: quantile(probs, 0.5),
    p75: quantile(probs, 0.75),
    p90: quantile(probs, 0.9),
  };
}

export function constantBaselineMetricsV1(
  y: ArrayLike<number>,
  baselineProbability: number,
): LogisticMetricsV1 {
  const probs = Array.from({ length: y.length }, () => baselineProbability);
  return evaluateProbabilitiesV1(y, probs);
}
