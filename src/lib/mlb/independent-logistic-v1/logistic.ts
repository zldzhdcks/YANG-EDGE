/**
 * Numerically stable logistic helpers and full-batch GD with backtracking.
 * Deterministic. No shuffle. No random init.
 */
import { IndependentLogisticError } from "./spec";

export const MLB_INDEPENDENT_LOGISTIC_LAMBDA_V1 = 0.01;
export const MLB_INDEPENDENT_LOGISTIC_THRESHOLD_V1 = 0.5;
export const MLB_INDEPENDENT_LOGISTIC_INITIAL_STEP_V1 = 1;
export const MLB_INDEPENDENT_LOGISTIC_BACKTRACK_V1 = 0.5;
export const MLB_INDEPENDENT_LOGISTIC_ARMIJO_V1 = 1e-4;
export const MLB_INDEPENDENT_LOGISTIC_MAX_ITERS_V1 = 5000;
export const MLB_INDEPENDENT_LOGISTIC_GRAD_TOL_V1 = 1e-6;
export const MLB_INDEPENDENT_LOGISTIC_MIN_STEP_V1 = 1e-12;
export const MLB_INDEPENDENT_LOGISTIC_PROB_CLIP_V1 = 1e-15;
export const MLB_INDEPENDENT_LOGISTIC_ZERO_STD_V1 = 1e-12;

export function stableSigmoid(z: number): number {
  if (!Number.isFinite(z)) {
    throw new IndependentLogisticError("SIGMOID_NONFINITE", `z=${z}`);
  }
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

export function clipProbabilityForLoss(p: number): number {
  const lo = MLB_INDEPENDENT_LOGISTIC_PROB_CLIP_V1;
  if (p < lo) return lo;
  if (p > 1 - lo) return 1 - lo;
  return p;
}

function assertFiniteNumber(value: number, code: string, label: string): void {
  if (!Number.isFinite(value)) {
    throw new IndependentLogisticError(code, `${label}=${value}`);
  }
}

export function logisticMeanBce(
  scores: Float64Array,
  y: Float64Array,
): number {
  const n = y.length;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const z = scores[i]!;
    const yi = y[i]!;
    const maxz = z > 0 ? z : 0;
    const loss = maxz - z * yi + Math.log1p(Math.exp(-Math.abs(z)));
    assertFiniteNumber(loss, "LOSS_NONFINITE", `row ${i}`);
    sum += loss;
  }
  return sum / n;
}

export function logisticObjective(
  weights: Float64Array,
  intercept: number,
  X: Float64Array,
  y: Float64Array,
  dim: number,
  lambda: number,
): { objective: number; meanBce: number; weightL2: number } {
  const n = y.length;
  const scores = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let z = intercept;
    const row = i * dim;
    for (let j = 0; j < dim; j += 1) {
      z += weights[j]! * X[row + j]!;
    }
    assertFiniteNumber(z, "SCORE_NONFINITE", `row ${i}`);
    scores[i] = z;
  }
  const meanBce = logisticMeanBce(scores, y);
  let weightL2 = 0;
  for (let j = 0; j < dim; j += 1) {
    weightL2 += weights[j]! * weights[j]!;
  }
  const objective = meanBce + 0.5 * lambda * weightL2;
  assertFiniteNumber(objective, "LOSS_NONFINITE", "objective");
  return { objective, meanBce, weightL2: Math.sqrt(weightL2) };
}

export type LogisticFitResultV1 = {
  weights: number[];
  intercept: number;
  iterations: number;
  converged: boolean;
  initialObjective: number;
  finalObjective: number;
  finalGradientNorm: number;
  weightL2Norm: number;
};

export function fitFullBatchLogisticV1(
  X: Float64Array,
  y: Float64Array,
  dim: number,
  options?: {
    lambda?: number;
    maxIterations?: number;
    gradientTolerance?: number;
  },
): LogisticFitResultV1 {
  const n = y.length;
  if (n === 0) {
    throw new IndependentLogisticError("EMPTY_TRAIN", "no TRAIN rows");
  }
  if (X.length !== n * dim) {
    throw new IndependentLogisticError(
      "MATRIX_SHAPE_MISMATCH",
      `X length ${X.length} != ${n}*${dim}`,
    );
  }
  const lambda = options?.lambda ?? MLB_INDEPENDENT_LOGISTIC_LAMBDA_V1;
  const maxIterations =
    options?.maxIterations ?? MLB_INDEPENDENT_LOGISTIC_MAX_ITERS_V1;
  const gradTol =
    options?.gradientTolerance ?? MLB_INDEPENDENT_LOGISTIC_GRAD_TOL_V1;
  const weights = new Float64Array(dim);
  let intercept = 0;
  const initial = logisticObjective(weights, intercept, X, y, dim, lambda);
  let lastObjective = initial.objective;
  let lastGradNorm = Number.POSITIVE_INFINITY;
  let lastWeightL2 = initial.weightL2;
  let converged = false;
  let iterations = 0;

  const gradW = new Float64Array(dim);
  const probs = new Float64Array(n);

  for (let iter = 0; iter < maxIterations; iter += 1) {
    iterations = iter + 1;
    gradW.fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i += 1) {
      let z = intercept;
      const row = i * dim;
      for (let j = 0; j < dim; j += 1) {
        z += weights[j]! * X[row + j]!;
      }
      const p = stableSigmoid(z);
      assertFiniteNumber(p, "PROBABILITY_NONFINITE", `row ${i}`);
      probs[i] = p;
      const residual = p - y[i]!;
      gradB += residual;
      for (let j = 0; j < dim; j += 1) {
        gradW[j] += residual * X[row + j]!;
      }
    }
    gradB /= n;
    let gradNormSq = gradB * gradB;
    for (let j = 0; j < dim; j += 1) {
      gradW[j] = gradW[j]! / n + lambda * weights[j]!;
      assertFiniteNumber(gradW[j]!, "GRADIENT_NONFINITE", `w${j}`);
      gradNormSq += gradW[j]! * gradW[j]!;
    }
    assertFiniteNumber(gradB, "GRADIENT_NONFINITE", "intercept");
    lastGradNorm = Math.sqrt(gradNormSq);
    const current = logisticObjective(weights, intercept, X, y, dim, lambda);
    lastObjective = current.objective;
    lastWeightL2 = current.weightL2;
    if (lastGradNorm < gradTol) {
      converged = true;
      break;
    }

    let step = MLB_INDEPENDENT_LOGISTIC_INITIAL_STEP_V1;
    let accepted = false;
    const trialW = new Float64Array(dim);
    while (step >= MLB_INDEPENDENT_LOGISTIC_MIN_STEP_V1) {
      for (let j = 0; j < dim; j += 1) {
        trialW[j] = weights[j]! - step * gradW[j]!;
        if (!Number.isFinite(trialW[j]!)) {
          throw new IndependentLogisticError(
            "WEIGHT_NONFINITE",
            `w${j}=${trialW[j]}`,
          );
        }
      }
      const trialB = intercept - step * gradB;
      if (!Number.isFinite(trialB)) {
        throw new IndependentLogisticError(
          "WEIGHT_NONFINITE",
          `intercept=${trialB}`,
        );
      }
      const trial = logisticObjective(trialW, trialB, X, y, dim, lambda);
      const armijo =
        current.objective -
        MLB_INDEPENDENT_LOGISTIC_ARMIJO_V1 * step * gradNormSq;
      if (trial.objective <= armijo) {
        weights.set(trialW);
        intercept = trialB;
        lastObjective = trial.objective;
        lastWeightL2 = trial.weightL2;
        accepted = true;
        break;
      }
      step *= MLB_INDEPENDENT_LOGISTIC_BACKTRACK_V1;
    }
    if (!accepted) {
      throw new IndependentLogisticError(
        "OPTIMIZER_NO_FINITE_STEP",
        `iter=${iterations} gradNorm=${lastGradNorm}`,
      );
    }
  }

  return {
    weights: Array.from(weights),
    intercept,
    iterations,
    converged,
    initialObjective: initial.objective,
    finalObjective: lastObjective,
    finalGradientNorm: lastGradNorm,
    weightL2Norm: lastWeightL2,
  };
}

export function predictLogisticProbability(
  x: ArrayLike<number>,
  weights: ArrayLike<number>,
  intercept: number,
): number {
  let z = intercept;
  for (let j = 0; j < weights.length; j += 1) {
    z += weights[j]! * x[j]!;
  }
  return stableSigmoid(z);
}
