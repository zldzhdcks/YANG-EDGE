/**
 * Frozen v2-A temporal signal-stability diagnostic.
 * Consumes sealed artifacts only. Does not train, select features, calibrate, or open Holdout.
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
import { predictLogisticProbability } from "../independent-logistic-v1/logistic";
import {
  IndependentLogisticError,
  MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A,
  MLB_INDEPENDENT_LOGISTIC_MODEL_DIM_V2A,
  orderedLogisticBaseFeatureNamesV2a,
  orderedLogisticModelFeatureNamesV2a,
} from "../independent-logistic-v2a/spec";
import { transformRowV2a } from "../independent-logistic-v2a/preprocess";
import {
  SEMANTIC_FEATURE_GROUPS_V2A,
  assertSemanticGroupCoverageV2a,
  pearsonCorrelationDiag,
  rocAucMannWhitney,
  type FrozenEvalRowV2aDiag,
  type FrozenV2aModelV1,
} from "../independent-logistic-v2a-diagnostic-v1";

export const MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_STAB =
  "bef2104957768a40cbfecbeb3ff99946dce80a7155ab93a29248cc6fab576c9b";
export const MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_STAB =
  "a72b8586971ee81a04e119c7d860f226abb503b5cc2341bb370d49d2fb47e71d";

export const MLB_INDEPENDENT_V2A_SIGNAL_STAB_SCHEMA_V1 =
  "mlb-independent-logistic-v2a-signal-stability-diagnostic-v1" as const;
export const MLB_INDEPENDENT_V2A_SIGNAL_STAB_BUILDER_V1 =
  "mlb-independent-logistic-v2a-signal-stability-v1" as const;

export const PROB_REPLAY_TOLERANCE_STAB = 1e-12;
export const DIRECTION_NEUTRAL_TOLERANCE_STAB = 1e-12;
export const POOLED_STD_EPS_STAB = 1e-12;

export const TRAIN_TEMPORAL_WINDOWS_V2A = [
  { id: "TRAIN_T1", start: "2024-03-20", end: "2024-04-30" },
  { id: "TRAIN_T2", start: "2024-05-01", end: "2024-05-31" },
  { id: "TRAIN_T3", start: "2024-06-01", end: "2024-06-30" },
  { id: "TRAIN_T4", start: "2024-07-01", end: "2024-07-19" },
] as const;

export const VALIDATION_TEMPORAL_WINDOWS_V2A = [
  { id: "VAL_V1", start: "2024-07-20", end: "2024-07-26" },
  { id: "VAL_V2", start: "2024-07-27", end: "2024-08-02" },
  { id: "VAL_V3", start: "2024-08-03", end: "2024-08-09" },
  { id: "VAL_V4", start: "2024-08-10", end: "2024-08-16" },
  { id: "VAL_V5", start: "2024-08-17", end: "2024-08-24" },
] as const;

export type SignalDirectionV2a = "HOME" | "AWAY" | "NEUTRAL";

export function independentLogisticV2aSignalStabDiagnosticRel(): string {
  return "data/research/mlb/independent-model-v1/diagnostics/2024-logistic-v2a-signal-stability-diagnostic-v1.json";
}
export function independentLogisticV2aSignalStabDiagnosticPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentLogisticV2aSignalStabDiagnosticRel());
}
export function independentLogisticV2aSignalStabAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-logistic-v2a-signal-stability-audit-v1.json";
}
export function independentLogisticV2aSignalStabAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentLogisticV2aSignalStabAuditRel());
}
export function sealedV2aModelRelStab(): string {
  return "data/research/mlb/independent-model-v1/model/2024-logistic-regression-season-volume-ablation-v2a.json";
}
export function sealedV2aModelPathStab(cwd = process.cwd()): string {
  return path.join(cwd, sealedV2aModelRelStab());
}
export function sealedV2aEvalRelStab(): string {
  return "data/research/mlb/independent-model-v1/evaluations/2024-logistic-regression-season-volume-ablation-v2a-train-validation.json";
}
export function sealedV2aEvalPathStab(cwd = process.cwd()): string {
  return path.join(cwd, sealedV2aEvalRelStab());
}

export function dateInInclusiveWindow(
  officialDate: string,
  start: string,
  end: string,
): boolean {
  return officialDate >= start && officialDate <= end;
}

export function signalDirectionFromAuc(
  auc: number | null,
): SignalDirectionV2a | null {
  if (auc == null) return null;
  if (auc > 0.5 + DIRECTION_NEUTRAL_TOLERANCE_STAB) return "HOME";
  if (auc < 0.5 - DIRECTION_NEUTRAL_TOLERANCE_STAB) return "AWAY";
  return "NEUTRAL";
}

export function directionsMatch(
  a: SignalDirectionV2a | null,
  b: SignalDirectionV2a | null,
): boolean {
  return (
    (a === "HOME" && b === "HOME") || (a === "AWAY" && b === "AWAY")
  );
}

export function directionsFlip(
  a: SignalDirectionV2a | null,
  b: SignalDirectionV2a | null,
): boolean {
  return (
    (a === "HOME" && b === "AWAY") || (a === "AWAY" && b === "HOME")
  );
}

export function singleFeatureRocAuc(
  y: ArrayLike<number>,
  scores: ArrayLike<number>,
): number | null {
  const n = y.length;
  if (n === 0 || scores.length !== n) {
    throw new IndependentLogisticError("AUC_LENGTH_MISMATCH", `${n}`);
  }
  let nPos = 0;
  for (let i = 0; i < n; i += 1) if (y[i] === 1) nPos += 1;
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return null;
  return rocAucMannWhitney(y, scores);
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

function sampleVariance(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  let s = 0;
  for (const v of xs) {
    const d = v - m;
    s += d * d;
  }
  return s / (xs.length - 1);
}

export function cohensDFromClasses(
  home: number[],
  away: number[],
): {
  cohensD: number | null;
  pooledStd: number;
  meanHome: number | null;
  meanAway: number | null;
  reason: string | null;
} {
  const nH = home.length;
  const nA = away.length;
  if (nH === 0 || nA === 0) {
    return {
      cohensD: null,
      pooledStd: 0,
      meanHome: nH === 0 ? null : mean(home),
      meanAway: nA === 0 ? null : mean(away),
      reason: "ONE_CLASS_WINDOW",
    };
  }
  const meanHome = mean(home);
  const meanAway = mean(away);
  const meanDifference = meanHome - meanAway;
  const vH = sampleVariance(home, meanHome);
  const vA = sampleVariance(away, meanAway);
  const df = nH + nA - 2;
  const pooledStd =
    df <= 0 ? 0 : Math.sqrt(((nH - 1) * vH + (nA - 1) * vA) / df);
  if (pooledStd < POOLED_STD_EPS_STAB) {
    if (Math.abs(meanDifference) < POOLED_STD_EPS_STAB) {
      return { cohensD: 0, pooledStd, meanHome, meanAway, reason: null };
    }
    return {
      cohensD: null,
      pooledStd,
      meanHome,
      meanAway,
      reason: "ZERO_POOLED_STD_UNEQUAL_MEANS",
    };
  }
  return {
    cohensD: meanDifference / pooledStd,
    pooledStd,
    meanHome,
    meanAway,
    reason: null,
  };
}

export function averageRanks(xs: number[]): number[] {
  const n = xs.length;
  const indexed = Array.from({ length: n }, (_, i) => ({ v: xs[i]!, i }));
  indexed.sort((a, b) => (a.v !== b.v ? a.v - b.v : a.i - b.i));
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1]!.v === indexed[i]!.v) j += 1;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[indexed[k]!.i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

export function spearmanCorrelationDiag(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length === 0) {
    throw new IndependentLogisticError(
      "SPEARMAN_LENGTH_MISMATCH",
      `${xs.length} vs ${ys.length}`,
    );
  }
  return pearsonCorrelationDiag(averageRanks(xs), averageRanks(ys));
}

function allEqual(xs: number[]): boolean {
  if (xs.length === 0) return true;
  const first = xs[0]!;
  for (let i = 1; i < xs.length; i += 1) {
    if (Math.abs(xs[i]! - first) > POOLED_STD_EPS_STAB) return false;
  }
  return true;
}

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

type StabRow = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  target: 0 | 1;
  x: number[];
  probability: number;
};

function buildPartitionRows(
  join: IndependentJoinArtifactV1,
  pks: number[],
  model: FrozenV2aModelV1,
): StabRow[] {
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
      probability: predictLogisticProbability(x, weights, intercept),
    };
  });
}

function assignWindowId(
  officialDate: string,
  windows: readonly { id: string; start: string; end: string }[],
): string {
  for (const w of windows) {
    if (dateInInclusiveWindow(officialDate, w.start, w.end)) return w.id;
  }
  throw new IndependentLogisticError("DATE_OUTSIDE_FIXED_WINDOWS", officialDate);
}

function windowCounts(
  rows: StabRow[],
  windows: readonly { id: string; start: string; end: string }[],
): Array<{
  id: string;
  start: string;
  end: string;
  n: number;
  homeCount: number;
  awayCount: number;
}> {
  return windows.map((w) => {
    const subset = rows.filter((r) =>
      dateInInclusiveWindow(r.officialDate, w.start, w.end),
    );
    const homeCount = subset.filter((r) => r.target === 1).length;
    return {
      id: w.id,
      start: w.start,
      end: w.end,
      n: subset.length,
      homeCount,
      awayCount: subset.length - homeCount,
    };
  });
}

type PartitionSignal = {
  nHome: number;
  nAway: number;
  meanXHome: number | null;
  meanXAway: number | null;
  meanDifference: number | null;
  medianXHome: number | null;
  medianXAway: number | null;
  pooledStd: number;
  cohensD: number | null;
  cohensDReason: string | null;
  singleFeatureRocAuc: number | null;
  aucAdvantage: number | null;
  absAucAdvantage: number | null;
  signalDirection: SignalDirectionV2a | null;
  oneClassReason: string | null;
};

function partitionSignal(rows: StabRow[], j: number): PartitionSignal {
  const home: number[] = [];
  const away: number[] = [];
  const y: number[] = [];
  const scores: number[] = [];
  for (const row of rows) {
    const v = row.x[j]!;
    y.push(row.target);
    scores.push(v);
    if (row.target === 1) home.push(v);
    else away.push(v);
  }
  const d = cohensDFromClasses(home, away);
  const auc = singleFeatureRocAuc(y, scores);
  const oneClass = home.length === 0 || away.length === 0;
  const aucAdvantage = auc == null ? null : auc - 0.5;
  return {
    nHome: home.length,
    nAway: away.length,
    meanXHome: d.meanHome,
    meanXAway: d.meanAway,
    meanDifference:
      d.meanHome == null || d.meanAway == null
        ? null
        : d.meanHome - d.meanAway,
    medianXHome: home.length === 0 ? null : medianOf(home),
    medianXAway: away.length === 0 ? null : medianOf(away),
    pooledStd: d.pooledStd,
    cohensD: d.cohensD,
    cohensDReason: d.reason,
    singleFeatureRocAuc: auc,
    aucAdvantage,
    absAucAdvantage: aucAdvantage == null ? null : Math.abs(aucAdvantage),
    signalDirection: signalDirectionFromAuc(auc),
    oneClassReason: oneClass ? "ONE_CLASS_WINDOW" : null,
  };
}

function medianAbs(xs: number[]): number {
  return medianOf(xs.map((v) => Math.abs(v)));
}

function sortDescThenName<T>(
  items: T[],
  value: (item: T) => number,
  name: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const dv = value(b) - value(a);
    if (dv !== 0) return dv;
    const na = name(a);
    const nb = name(b);
    return na < nb ? -1 : na > nb ? 1 : 0;
  });
}

export function diagnoseV2aSignalStabilityV1(input: {
  join: IndependentJoinArtifactV1;
  split: IndependentSplitArtifactV1;
  model: FrozenV2aModelV1;
  evaluation: {
    modelCoreHash: string;
    train: FrozenEvalRowV2aDiag[];
    validation: FrozenEvalRowV2aDiag[];
  };
  sourceJoinHash: string;
  generatedAt?: string;
}): { diagnostic: Record<string, unknown>; audit: Record<string, unknown> } {
  assertSemanticGroupCoverageV2a();
  const { join, split, model, evaluation, sourceJoinHash } = input;
  if (model.modelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V2A_MODEL_CORE_HASH_STAB) {
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
  if (model.v1BaselineModelCoreHash !== MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A) {
    throw new IndependentLogisticError(
      "V1_MODEL_CORE_HASH_PIN_MISMATCH",
      model.v1BaselineModelCoreHash,
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
    split.splitManifestHash !== MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_STAB ||
    model.sourceSplitManifestHash !==
      MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_HASH_STAB
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
  if (names.length !== 51) {
    throw new IndependentLogisticError("FEATURE_COUNT_INVALID", `${names.length}`);
  }

  const trainRows = buildPartitionRows(join, split.trainGamePks, model);
  const valRows = buildPartitionRows(join, split.validationGamePks, model);
  if (trainRows.length !== 1463 || valRows.length !== 483) {
    throw new IndependentLogisticError(
      "PARTITION_ROW_COUNT",
      `train=${trainRows.length} val=${valRows.length}`,
    );
  }
  for (const row of trainRows) {
    assignWindowId(row.officialDate, TRAIN_TEMPORAL_WINDOWS_V2A);
  }
  for (const row of valRows) {
    assignWindowId(row.officialDate, VALIDATION_TEMPORAL_WINDOWS_V2A);
  }

  const evalTrainByPk = new Map(evaluation.train.map((r) => [r.gamePk, r]));
  const evalValByPk = new Map(evaluation.validation.map((r) => [r.gamePk, r]));
  for (const row of trainRows) {
    const persisted = evalTrainByPk.get(row.gamePk);
    if (
      !persisted ||
      Math.abs(persisted.probability - row.probability) > PROB_REPLAY_TOLERANCE_STAB
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
      Math.abs(persisted.probability - row.probability) > PROB_REPLAY_TOLERANCE_STAB
    ) {
      throw new IndependentLogisticError(
        "VALIDATION_PROBABILITY_REPLAY_MISMATCH",
        `gamePk ${row.gamePk}`,
      );
    }
  }

  const trainModelAuc = rocAucMannWhitney(
    trainRows.map((r) => r.target),
    trainRows.map((r) => r.probability),
  );
  const validationModelAuc = rocAucMannWhitney(
    valRows.map((r) => r.target),
    valRows.map((r) => r.probability),
  );

  const trainWindowCounts = windowCounts(trainRows, TRAIN_TEMPORAL_WINDOWS_V2A);
  const validationWindowCounts = windowCounts(
    valRows,
    VALIDATION_TEMPORAL_WINDOWS_V2A,
  );

  const featureSignals = names.map((featureName, j) => {
    const coefficient = model.coefficients[j]!;
    const train = partitionSignal(trainRows, j);
    const validation = partitionSignal(valRows, j);
    const trainSep =
      train.meanDifference == null ? 0 : coefficient * train.meanDifference;
    const valSep =
      validation.meanDifference == null
        ? 0
        : coefficient * validation.meanDifference;
    const trainDir = train.signalDirection;
    const valDir = validation.signalDirection;
    const trainWindows = TRAIN_TEMPORAL_WINDOWS_V2A.map((w) => {
      const subset = trainRows.filter((r) =>
        dateInInclusiveWindow(r.officialDate, w.start, w.end),
      );
      return { id: w.id, ...partitionSignal(subset, j) };
    });
    const validationWindows = VALIDATION_TEMPORAL_WINDOWS_V2A.map((w) => {
      const subset = valRows.filter((r) =>
        dateInInclusiveWindow(r.officialDate, w.start, w.end),
      );
      return { id: w.id, ...partitionSignal(subset, j) };
    });
    const trainWindowDirs = trainWindows.map((w) => w.signalDirection);
    const valWindowDirs = validationWindows.map((w) => w.signalDirection);
    const trainNonNeutral = trainWindowDirs.filter(
      (d) => d === "HOME" || d === "AWAY",
    );
    const valNonNeutral = valWindowDirs.filter(
      (d) => d === "HOME" || d === "AWAY",
    );
    return {
      featureName,
      coefficient,
      isMissingIndicator: featureName.endsWith(".missing"),
      train,
      validation,
      trainCoefficientAlignedSeparation: trainSep,
      validationCoefficientAlignedSeparation: valSep,
      coefficientAlignedInTrain: trainSep > DIRECTION_NEUTRAL_TOLERANCE_STAB,
      coefficientAlignedInValidation: valSep > DIRECTION_NEUTRAL_TOLERANCE_STAB,
      trainAlignedButValidationMisaligned:
        trainSep > DIRECTION_NEUTRAL_TOLERANCE_STAB &&
        valSep < -DIRECTION_NEUTRAL_TOLERANCE_STAB,
      transfer: {
        trainAuc: train.singleFeatureRocAuc,
        validationAuc: validation.singleFeatureRocAuc,
        trainAucAdvantage: train.aucAdvantage,
        validationAucAdvantage: validation.aucAdvantage,
        aucAdvantageDelta:
          train.aucAdvantage == null || validation.aucAdvantage == null
            ? null
            : validation.aucAdvantage - train.aucAdvantage,
        absoluteSignalChange:
          train.absAucAdvantage == null || validation.absAucAdvantage == null
            ? null
            : validation.absAucAdvantage - train.absAucAdvantage,
        degradation:
          train.absAucAdvantage == null || validation.absAucAdvantage == null
            ? null
            : train.absAucAdvantage - validation.absAucAdvantage,
        directionMatch: directionsMatch(trainDir, valDir),
        directionFlip: directionsFlip(trainDir, valDir),
        trainCohensD: train.cohensD,
        validationCohensD: validation.cohensD,
        cohensDDelta:
          train.cohensD == null || validation.cohensD == null
            ? null
            : validation.cohensD - train.cohensD,
      },
      trainWindows,
      validationWindows,
      trainTemporalStability: {
        fullTrainDirection: trainDir,
        T1Direction: trainWindows[0]!.signalDirection,
        T2Direction: trainWindows[1]!.signalDirection,
        T3Direction: trainWindows[2]!.signalDirection,
        T4Direction: trainWindows[3]!.signalDirection,
        numberOfNonNeutralTrainWindows: trainNonNeutral.length,
        numberOfTrainWindowsMatchingFullTrainDirection: trainWindowDirs.filter(
          (d) => directionsMatch(d, trainDir),
        ).length,
        numberOfTrainDirectionFlips: trainWindowDirs.filter((d) =>
          directionsFlip(d, trainDir),
        ).length,
      },
      validationTemporalStability: {
        fullValidationDirection: valDir,
        numberOfNonNeutralValidationWindows: valNonNeutral.length,
        numberMatchingFullTrainDirection: valWindowDirs.filter((d) =>
          directionsMatch(d, trainDir),
        ).length,
        numberMatchingFullValidationDirection: valWindowDirs.filter((d) =>
          directionsMatch(d, valDir),
        ).length,
        numberOfValidationDirectionFlips: valWindowDirs.filter((d) =>
          directionsFlip(d, valDir),
        ).length,
      },
      validationConstant: allEqual(valRows.map((r) => r.x[j]!)),
    };
  });

  const trainPositiveDirectionCount = featureSignals.filter(
    (f) => f.train.signalDirection === "HOME",
  ).length;
  const trainNegativeDirectionCount = featureSignals.filter(
    (f) => f.train.signalDirection === "AWAY",
  ).length;
  const trainNeutralCount = featureSignals.filter(
    (f) => f.train.signalDirection === "NEUTRAL",
  ).length;
  const validationPositiveDirectionCount = featureSignals.filter(
    (f) => f.validation.signalDirection === "HOME",
  ).length;
  const validationNegativeDirectionCount = featureSignals.filter(
    (f) => f.validation.signalDirection === "AWAY",
  ).length;
  const validationNeutralCount = featureSignals.filter(
    (f) => f.validation.signalDirection === "NEUTRAL",
  ).length;
  const trainToValidationDirectionMatchCount = featureSignals.filter(
    (f) => f.transfer.directionMatch,
  ).length;
  const trainToValidationDirectionFlipCount = featureSignals.filter(
    (f) => f.transfer.directionFlip,
  ).length;
  const validationConstantFeatureCount = featureSignals.filter(
    (f) => f.validationConstant,
  ).length;
  const trainAlignedValidationMisalignedCount = featureSignals.filter(
    (f) => f.trainAlignedButValidationMisaligned,
  ).length;

  const trainAdvantages = featureSignals.map((f) => f.train.aucAdvantage ?? 0);
  const valAdvantages = featureSignals.map(
    (f) => f.validation.aucAdvantage ?? 0,
  );
  const featureSignalTransferPearson = pearsonCorrelationDiag(
    trainAdvantages,
    valAdvantages,
  );
  const featureSignalTransferSpearman = spearmanCorrelationDiag(
    trainAdvantages,
    valAdvantages,
  );

  const compact = (f: (typeof featureSignals)[number]) => ({
    feature: f.featureName,
    trainAuc: f.train.singleFeatureRocAuc,
    validationAuc: f.validation.singleFeatureRocAuc,
    directionMatch: f.transfer.directionMatch,
    directionFlip: f.transfer.directionFlip,
    trainCohensD: f.train.cohensD,
    validationCohensD: f.validation.cohensD,
    coefficient: f.coefficient,
    trainDirection: f.train.signalDirection,
    validationDirection: f.validation.signalDirection,
  });

  const topTrainSignals = sortDescThenName(
    featureSignals,
    (f) => f.train.absAucAdvantage ?? 0,
    (f) => f.featureName,
  )
    .slice(0, 15)
    .map(compact);

  const topValidationSignals = sortDescThenName(
    featureSignals,
    (f) => f.validation.absAucAdvantage ?? 0,
    (f) => f.featureName,
  )
    .slice(0, 15)
    .map(compact);

  const largestSignalDegradations = sortDescThenName(
    featureSignals,
    (f) => f.transfer.degradation ?? Number.NEGATIVE_INFINITY,
    (f) => f.featureName,
  )
    .slice(0, 15)
    .map((f) => ({
      feature: f.featureName,
      trainAuc: f.train.singleFeatureRocAuc,
      validationAuc: f.validation.singleFeatureRocAuc,
      trainAbsAdvantage: f.train.absAucAdvantage,
      validationAbsAdvantage: f.validation.absAucAdvantage,
      degradation: f.transfer.degradation,
    }));

  const directionFlipFeatures = featureSignals
    .filter((f) => {
      const t = f.train.aucAdvantage;
      const v = f.validation.aucAdvantage;
      return t != null && v != null && t * v < 0;
    })
    .map((f) => ({
      feature: f.featureName,
      coefficient: f.coefficient,
      trainAuc: f.train.singleFeatureRocAuc,
      validationAuc: f.validation.singleFeatureRocAuc,
      trainCohensD: f.train.cohensD,
      validationCohensD: f.validation.cohensD,
      trainTemporalDirections: {
        full: f.trainTemporalStability.fullTrainDirection,
        T1: f.trainTemporalStability.T1Direction,
        T2: f.trainTemporalStability.T2Direction,
        T3: f.trainTemporalStability.T3Direction,
        T4: f.trainTemporalStability.T4Direction,
      },
      validationTemporalDirections: {
        full: f.validationTemporalStability.fullValidationDirection,
        V1: f.validationWindows[0]!.signalDirection,
        V2: f.validationWindows[1]!.signalDirection,
        V3: f.validationWindows[2]!.signalDirection,
        V4: f.validationWindows[3]!.signalDirection,
        V5: f.validationWindows[4]!.signalDirection,
      },
    }));

  const trainAlignedValidationMisaligned = sortDescThenName(
    featureSignals.filter((f) => f.trainAlignedButValidationMisaligned),
    (f) => Math.abs(f.validationCoefficientAlignedSeparation),
    (f) => f.featureName,
  ).map((f) => ({
    feature: f.featureName,
    coefficient: f.coefficient,
    trainCoefficientAlignedSeparation: f.trainCoefficientAlignedSeparation,
    validationCoefficientAlignedSeparation:
      f.validationCoefficientAlignedSeparation,
    trainAuc: f.train.singleFeatureRocAuc,
    validationAuc: f.validation.singleFeatureRocAuc,
  }));

  const largestStableValidationSignals = sortDescThenName(
    featureSignals.filter((f) => f.transfer.directionMatch),
    (f) => f.validation.absAucAdvantage ?? 0,
    (f) => f.featureName,
  )
    .slice(0, 15)
    .map(compact);

  const missingIndicatorStability = featureSignals
    .filter((f) => f.isMissingIndicator)
    .map((f) => ({
      featureName: f.featureName,
      trainMissingRate: mean(trainRows.map((r) => r.x[names.indexOf(f.featureName)]!)),
      validationMissingRate: mean(
        valRows.map((r) => r.x[names.indexOf(f.featureName)]!),
      ),
      trainUnivariateAuc: f.train.singleFeatureRocAuc,
      validationUnivariateAuc: f.validation.singleFeatureRocAuc,
      coefficient: f.coefficient,
      trainCoefficientAlignedSeparation: f.trainCoefficientAlignedSeparation,
      validationCoefficientAlignedSeparation:
        f.validationCoefficientAlignedSeparation,
      validationConstant: f.validationConstant,
    }));
  const validationMissingRateZeroCount = missingIndicatorStability.filter(
    (m) => Math.abs(m.validationMissingRate) < POOLED_STD_EPS_STAB,
  ).length;

  const dimBase = baseNames.length;
  const trainBaseCols = baseNames.map((_, j) => trainRows.map((r) => r.x[j]!));
  const corrPairs: Array<{
    featureA: string;
    featureB: string;
    correlation: number;
  }> = [];
  for (let i = 0; i < dimBase; i += 1) {
    for (let k = i + 1; k < dimBase; k += 1) {
      corrPairs.push({
        featureA: baseNames[i]!,
        featureB: baseNames[k]!,
        correlation: pearsonCorrelationDiag(trainBaseCols[i]!, trainBaseCols[k]!),
      });
    }
  }
  const trainTopCorrelations = sortDescThenName(
    corrPairs,
    (p) => Math.abs(p.correlation),
    (p) => `${p.featureA}|${p.featureB}`,
  ).slice(0, 20);
  const highCorrelationPairCount = corrPairs.filter(
    (p) => Math.abs(p.correlation) >= 0.9,
  ).length;

  const semanticGroupSignalSummary = Object.entries(SEMANTIC_FEATURE_GROUPS_V2A).map(
    ([group, groupNames]) => {
      const nameSet = new Set(groupNames);
      const rows = featureSignals.filter((f) => nameSet.has(f.featureName));
      const trainAbs = rows
        .map((f) => f.train.absAucAdvantage)
        .filter((v): v is number => v != null);
      const valAbs = rows
        .map((f) => f.validation.absAucAdvantage)
        .filter((v): v is number => v != null);
      const trainSigned = rows
        .map((f) => f.train.aucAdvantage)
        .filter((v): v is number => v != null);
      const valSigned = rows
        .map((f) => f.validation.aucAdvantage)
        .filter((v): v is number => v != null);
      return {
        group,
        featureCount: groupNames.length,
        medianAbsTrainAucAdvantage: medianAbs(trainAbs),
        medianAbsValidationAucAdvantage: medianAbs(valAbs),
        meanSignedTrainAucAdvantage: mean(trainSigned),
        meanSignedValidationAucAdvantage: mean(valSigned),
        directionFlipCount: rows.filter((f) => f.transfer.directionFlip).length,
        trainAlignedValidationMisalignedCount: rows.filter(
          (f) => f.trainAlignedButValidationMisaligned,
        ).length,
      };
    },
  );

  const diagnostic: Record<string, unknown> = {
    schemaVersion: MLB_INDEPENDENT_V2A_SIGNAL_STAB_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_V2A_SIGNAL_STAB_BUILDER_V1,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    modelPrototype: true,
    modelCandidate: false,
    engineApproved: false,
    holdoutEvaluated: false,
    modelCoreHash: model.modelCoreHash,
    v1BaselineModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A,
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
    featureCount: 51,
    trainProbabilityReplayMatch: "PASS",
    validationProbabilityReplayMatch: "PASS",
    trainModelAuc,
    validationModelAuc,
    VALIDATION_HAS_BEEN_USED_FOR_MODEL_RESEARCH: true,
    validationReuseNote:
      "This 483-game Validation partition has been used for v1 evaluation, v1 shift diagnosis, v2-A ablation evaluation, v2-A calibration/discrimination diagnosis, and this signal-stability diagnosis. Future v2-B choices are increasingly exposed to Validation selection pressure. Holdout remains unbiased only if it stays completely sealed.",
    productTimingNote:
      "Current v2-A SAFE_A historical features are EARLY-compatible inputs. This diagnostic does not change Product Timing and does not introduce late-only features.",
    trainTemporalWindows: trainWindowCounts,
    validationTemporalWindows: validationWindowCounts,
    featureSignals,
    globalSignalTransfer: {
      featureCount: 51,
      trainPositiveDirectionCount,
      trainNegativeDirectionCount,
      trainNeutralCount,
      validationPositiveDirectionCount,
      validationNegativeDirectionCount,
      validationNeutralCount,
      trainToValidationDirectionMatchCount,
      trainToValidationDirectionFlipCount,
      validationConstantFeatureCount,
      trainAlignedValidationMisalignedCount,
      featureSignalTransferPearson,
      featureSignalTransferSpearman,
    },
    topTrainSignals,
    topValidationSignals,
    largestSignalDegradations,
    directionFlipFeatures,
    trainAlignedValidationMisaligned,
    largestStableValidationSignals,
    missingIndicatorStability,
    validationMissingRateZeroCount,
    trainTopCorrelations,
    highCorrelationPairCount,
    semanticGroupSignalSummary,
    evidenceSummary: {
      trainModelAuc,
      validationModelAuc,
      featureSignalTransferPearson,
      featureSignalTransferSpearman,
      trainToValidationDirectionMatchCount,
      trainToValidationDirectionFlipCount,
      trainAlignedValidationMisalignedCount,
      topTrainSignals,
      topValidationSignals,
      largestSignalDegradations,
      directionFlipFeatures,
      largestStableValidationSignals,
      largestResidualCorrelationPairs: trainTopCorrelations,
      semanticGroupSignalSummary,
      note: "No automatic feature-selection lists. Univariate feature AUC is not a model. Coefficient misalignment is diagnostic only because of multicollinearity.",
    },
  };

  const audit: Record<string, unknown> = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    modelCandidate: false,
    holdoutEvaluated: false,
    trainingFunctionCalled: false,
    preprocessorFitCalled: false,
    optimizerCalled: false,
    modelCoreChanged: false,
    featureChanged: false,
    calibrationApplied: false,
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
    modelCoreHash: model.modelCoreHash,
    v1BaselineModelCoreHash: MLB_INDEPENDENT_2024_SEALED_V1_MODEL_CORE_HASH_V2A,
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
    VALIDATION_HAS_BEEN_USED_FOR_MODEL_RESEARCH: true,
    trainModelAuc,
    validationModelAuc,
    featureSignalTransferPearson,
    featureSignalTransferSpearman,
    trainToValidationDirectionMatchCount,
    trainToValidationDirectionFlipCount,
    trainAlignedValidationMisalignedCount,
  };

  return { diagnostic, audit };
}
