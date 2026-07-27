import {
  mapMissingReasonLabels,
  mapResearchMissingReasonLabels,
  mapSelectionReasonLabels,
  riskDisplayLabel,
} from "./edge-pick-labels";
import {
  DATASET_KEYS,
  type CollectionStatus,
  type DatasetKey,
  missingReasonForDataset,
  REQUIRED_DATASET_KEYS,
  selectionReasonForDataset,
} from "./dataset-presence";
import { hasPositivePredictedSideEdge } from "./edge-score-semantics";
import { gameStartMs, upcomingExclusionReason } from "./game-upcoming";

export type TodayEdgePickRisk = "LOW" | "MEDIUM" | "HIGH";
export type TodayEdgePickTier = "EDGE_PICK" | "RESEARCH_CANDIDATE";
export type TodayEdgeSelectionMode =
  | "STRICT_ONLY"
  | "MIXED"
  | "RESEARCH_CANDIDATES_ONLY"
  | "EMPTY";

export type TodayEdgePickPredictionInput = {
  gameId: string;
  dateKst: string;
  startTimeKst: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  baselinePick: string;
  confidence: number;
  modelProbability: number | null;
  edgeScore: number | null;
  valueEdge: number | null;
  dataAvailability: number | null;
  baselineStatus: string;
  snapshotIntegrity: string;
  pitcherDirection: string | null;
  integrityWarnings: string[];
  missingFactors: string[];
  predictedAt: string;
  resultStatus: string;
};

export type TodayEdgePickCandidateInput = {
  prediction: TodayEdgePickPredictionInput;
  datasets: Record<DatasetKey, CollectionStatus>;
  hasStarterIdentity: boolean;
};

export type TodayEdgePickRow = {
  gameId: string;
  league: string;
  home: string;
  away: string;
  startTimeKst: string;
  prediction: string;
  confidence: number;
  modelProbability: number | null;
  valueEdge: number | null;
  risk: TodayEdgePickRisk;
  riskLabel: string;
  pickTier: TodayEdgePickTier;
  rank: 1 | 2 | 3;
  todayEdgeRank: 1 | 2 | 3;
  selectionReasons: string[];
  selectionReasonLabels: string[];
  missingReasons: string[];
  missingReasonLabels: string[];
  generatedAt: string;
};

export type TodayEdgePickExcludedRow = {
  gameId: string;
  home: string;
  away: string;
  reasons: string[];
};

export type SelectTodayEdgePicksResult = {
  picks: TodayEdgePickRow[];
  excluded: TodayEdgePickExcludedRow[];
  candidateCount: number;
  strictSelectedCount: number;
  researchCandidateCount: number;
  selectionMode: TodayEdgeSelectionMode;
  strictExclusionCounts: Record<string, number>;
};

const HIGH_CONFIDENCE_THRESHOLD = 55;
const RISK_RANK: Record<TodayEdgePickRisk, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

export function deriveRisk(pred: TodayEdgePickPredictionInput): TodayEdgePickRisk {
  if (pred.baselineStatus === "MARKET_CONFLICT") return "HIGH";
  if (pred.pitcherDirection === "CONFLICTS_BASELINE") return "HIGH";
  if (pred.dataAvailability != null && pred.dataAvailability < 0.7) return "HIGH";
  if (
    pred.integrityWarnings.some((w) =>
      w.includes("CONFLICTS_BASELINE"),
    )
  ) {
    return "HIGH";
  }

  if (pred.pitcherDirection === "MIXED") return "MEDIUM";
  if (pred.integrityWarnings.length > 0) return "MEDIUM";
  if (pred.missingFactors.length > 0) return "MEDIUM";
  if (pred.snapshotIntegrity !== "VERIFIED") return "MEDIUM";

  return "LOW";
}

function isResearchNotReady(
  datasets: Record<DatasetKey, CollectionStatus>,
): boolean {
  return REQUIRED_DATASET_KEYS.some(
    (key) => datasets[key] === "NOT_COLLECTED",
  );
}

function hasRequiredDatasetMissing(
  datasets: Record<DatasetKey, CollectionStatus>,
): boolean {
  return REQUIRED_DATASET_KEYS.some(
    (key) => datasets[key] === "NOT_COLLECTED",
  );
}

function countCompleteDatasets(
  datasets: Record<DatasetKey, CollectionStatus>,
): number {
  return DATASET_KEYS.filter((key) => datasets[key] === "COMPLETE").length;
}

function predictionQualityScore(pred: TodayEdgePickPredictionInput): number {
  let score = 0;
  if (pred.baselineStatus === "BASELINE_CANDIDATE") score += 100;
  if (pred.snapshotIntegrity === "VERIFIED") score += 10;
  if (pred.dataAvailability != null) score += pred.dataAvailability * 10;
  return score;
}

function hasValidBaselinePick(pred: TodayEdgePickPredictionInput): boolean {
  const pick = pred.baselinePick.trim();
  return pick !== "" && pick !== "?";
}

function buildSelectionReasons(
  pred: TodayEdgePickPredictionInput,
  datasets: Record<DatasetKey, CollectionStatus>,
  risk: TodayEdgePickRisk,
): string[] {
  const reasons: string[] = [];

  for (const key of DATASET_KEYS) {
    const reason = selectionReasonForDataset(key, datasets[key]);
    if (reason) reasons.push(reason);
  }

  if (risk === "LOW") reasons.push("LOW_RISK");
  if (pred.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    reasons.push("HIGH_CONFIDENCE");
  }
  if (pred.valueEdge != null && pred.valueEdge > 0) {
    reasons.push("VALUE_EDGE_POSITIVE");
  }
  if (pred.snapshotIntegrity === "VERIFIED") {
    reasons.push("PREDICTION_SNAPSHOT_VERIFIED");
  }
  if (pred.baselineStatus === "BASELINE_CANDIDATE") {
    reasons.push("BASELINE_CANDIDATE");
  }

  return [...new Set(reasons)];
}

function buildStrictMissingReasons(
  datasets: Record<DatasetKey, CollectionStatus>,
): string[] {
  const reasons: string[] = [];
  for (const key of DATASET_KEYS) {
    const reason = missingReasonForDataset(key, datasets[key]);
    if (reason) reasons.push(reason);
  }
  return reasons;
}

function buildResearchMissingReasons(
  pred: TodayEdgePickPredictionInput,
  datasets: Record<DatasetKey, CollectionStatus>,
): string[] {
  const reasons: string[] = [];

  if (pred.baselineStatus !== "BASELINE_CANDIDATE") {
    reasons.push("BASELINE_NOT_MET");
  }

  if (
    datasets.bullpen === "NOT_COLLECTED" ||
    datasets.bullpen === "PARTIAL"
  ) {
    reasons.push("BULLPEN_PENDING");
  }

  const partialKeys: DatasetKey[] = [
    "lineup",
    "weather",
    "odds",
    "injury",
    "travel",
  ];
  let partialCount = 0;
  for (const key of partialKeys) {
    const status = datasets[key];
    if (status === "NOT_COLLECTED" || status === "PARTIAL") {
      partialCount += 1;
      const reason = missingReasonForDataset(key, status);
      if (reason) reasons.push(reason);
    }
  }

  if (partialCount >= 2 && !reasons.includes("RESEARCH_PARTIAL")) {
    reasons.push("RESEARCH_PARTIAL");
  }

  if (
    pred.edgeScore != null &&
    !hasPositivePredictedSideEdge({
      homeSideEdgeScore: pred.edgeScore,
      baselinePick: pred.baselinePick,
      homeTeam: pred.homeTeam,
      awayTeam: pred.awayTeam,
    })
  ) {
    reasons.push("EDGE_NO_POSITIVE");
  }

  return [...new Set(reasons)];
}

function buildStrictExclusionReasons(
  pred: TodayEdgePickPredictionInput,
  datasets: Record<DatasetKey, CollectionStatus>,
  risk: TodayEdgePickRisk,
  nowMs?: number,
): string[] {
  const reasons: string[] = [];

  const upcomingReason = upcomingExclusionReason({
    dateKst: pred.dateKst,
    startTimeKst: pred.startTimeKst,
    resultStatus: pred.resultStatus,
    nowMs,
  });
  if (upcomingReason) reasons.push(upcomingReason);

  if (risk === "HIGH") reasons.push("RISK_HIGH");
  if (hasRequiredDatasetMissing(datasets)) {
    reasons.push("REQUIRED_DATASET_MISSING");
  }
  if (isResearchNotReady(datasets)) reasons.push("RESEARCH_NOT_READY");
  if (pred.baselineStatus !== "BASELINE_CANDIDATE") {
    reasons.push("NOT_BASELINE_CANDIDATE");
  }
  if (
    pred.edgeScore != null &&
    !hasPositivePredictedSideEdge({
      homeSideEdgeScore: pred.edgeScore,
      baselinePick: pred.baselinePick,
      homeTeam: pred.homeTeam,
      awayTeam: pred.awayTeam,
    })
  ) {
    reasons.push("EDGE_NOT_POSITIVE");
  }
  if (pred.valueEdge != null && pred.valueEdge <= 0) {
    reasons.push("VALUE_EDGE_NOT_POSITIVE");
  }

  return reasons;
}

function buildResearchExclusionReasons(
  pred: TodayEdgePickPredictionInput,
  candidate: TodayEdgePickCandidateInput,
  risk: TodayEdgePickRisk,
  nowMs?: number,
): string[] {
  const reasons: string[] = [];

  const upcomingReason = upcomingExclusionReason({
    dateKst: pred.dateKst,
    startTimeKst: pred.startTimeKst,
    resultStatus: pred.resultStatus,
    nowMs,
  });
  if (upcomingReason) reasons.push(upcomingReason);

  if (pred.resultStatus.toLowerCase() !== "pending") {
    reasons.push("PREDICTION_NOT_PENDING");
  }

  if (risk === "HIGH") reasons.push("RISK_HIGH");
  if (!hasValidBaselinePick(pred)) reasons.push("BASELINE_PICK_MISSING");
  if (pred.modelProbability == null) reasons.push("MODEL_PROBABILITY_MISSING");
  if (!Number.isFinite(pred.confidence)) reasons.push("CONFIDENCE_MISSING");
  if (!candidate.hasStarterIdentity) reasons.push("STARTER_IDENTITY_MISSING");

  return reasons;
}

function compareStrictCandidates(
  a: TodayEdgePickCandidateInput,
  b: TodayEdgePickCandidateInput,
): number {
  const pa = a.prediction;
  const pb = b.prediction;
  const ra = deriveRisk(pa);
  const rb = deriveRisk(pb);

  if (pb.confidence !== pa.confidence) {
    return pb.confidence - pa.confidence;
  }
  if (RISK_RANK[ra] !== RISK_RANK[rb]) {
    return RISK_RANK[ra] - RISK_RANK[rb];
  }
  const qualityDiff =
    predictionQualityScore(pb) - predictionQualityScore(pa);
  if (qualityDiff !== 0) return qualityDiff;

  const completeDiff =
    countCompleteDatasets(b.datasets) - countCompleteDatasets(a.datasets);
  if (completeDiff !== 0) return completeDiff;

  const valueA = pa.valueEdge ?? Number.NEGATIVE_INFINITY;
  const valueB = pb.valueEdge ?? Number.NEGATIVE_INFINITY;
  if (valueB !== valueA) return valueB - valueA;

  const timeDiff = pa.predictedAt.localeCompare(pb.predictedAt);
  if (timeDiff !== 0) return timeDiff;

  return pa.gameId.localeCompare(pb.gameId);
}

function compareResearchCandidates(
  a: TodayEdgePickCandidateInput,
  b: TodayEdgePickCandidateInput,
): number {
  const pa = a.prediction;
  const pb = b.prediction;
  const ra = deriveRisk(pa);
  const rb = deriveRisk(pb);

  if (pb.confidence !== pa.confidence) {
    return pb.confidence - pa.confidence;
  }

  const modelA = pa.modelProbability ?? Number.NEGATIVE_INFINITY;
  const modelB = pb.modelProbability ?? Number.NEGATIVE_INFINITY;
  if (modelB !== modelA) return modelB - modelA;

  if (RISK_RANK[ra] !== RISK_RANK[rb]) {
    return RISK_RANK[ra] - RISK_RANK[rb];
  }

  const edgeA =
    predictedSortEdge(a.prediction) ?? Number.NEGATIVE_INFINITY;
  const edgeB =
    predictedSortEdge(b.prediction) ?? Number.NEGATIVE_INFINITY;
  if (edgeB !== edgeA) return edgeB - edgeA;

  const valueA = pa.valueEdge ?? Number.NEGATIVE_INFINITY;
  const valueB = pb.valueEdge ?? Number.NEGATIVE_INFINITY;
  if (valueB !== valueA) return valueB - valueA;

  const completeDiff =
    countCompleteDatasets(b.datasets) - countCompleteDatasets(a.datasets);
  if (completeDiff !== 0) return completeDiff;

  const startA =
    gameStartMs(pa.dateKst, pa.startTimeKst) ?? Number.POSITIVE_INFINITY;
  const startB =
    gameStartMs(pb.dateKst, pb.startTimeKst) ?? Number.POSITIVE_INFINITY;
  if (startA !== startB) return startA - startB;

  return pa.gameId.localeCompare(pb.gameId);
}

function predictedSortEdge(
  pred: TodayEdgePickPredictionInput,
): number | null {
  if (pred.edgeScore == null) return null;
  const side =
    pred.baselinePick === pred.homeTeam
      ? "home"
      : pred.baselinePick === pred.awayTeam
        ? "away"
        : null;
  if (side === "home") return pred.edgeScore;
  if (side === "away") return -pred.edgeScore;
  return null;
}

function incrementCounts(
  counts: Record<string, number>,
  reasons: string[],
): void {
  for (const reason of reasons) {
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
}

function toPickRow(
  candidate: TodayEdgePickCandidateInput,
  rank: 1 | 2 | 3,
  pickTier: TodayEdgePickTier,
  generatedAt: string,
): TodayEdgePickRow {
  const { prediction, datasets } = candidate;
  const risk = deriveRisk(prediction);
  const selectionReasons =
    pickTier === "EDGE_PICK"
      ? buildSelectionReasons(prediction, datasets, risk)
      : [];
  const missingReasons =
    pickTier === "EDGE_PICK"
      ? buildStrictMissingReasons(datasets)
      : buildResearchMissingReasons(prediction, datasets);
  const missingLabels =
    pickTier === "EDGE_PICK"
      ? mapMissingReasonLabels(missingReasons)
      : mapResearchMissingReasonLabels(missingReasons);

  return {
    gameId: prediction.gameId,
    league: prediction.league,
    home: prediction.homeTeam,
    away: prediction.awayTeam,
    startTimeKst: prediction.startTimeKst,
    prediction: prediction.baselinePick,
    confidence: prediction.confidence,
    modelProbability: prediction.modelProbability,
    valueEdge: prediction.valueEdge,
    risk,
    riskLabel: riskDisplayLabel(risk),
    pickTier,
    rank,
    todayEdgeRank: rank,
    selectionReasons,
    selectionReasonLabels: mapSelectionReasonLabels(selectionReasons),
    missingReasons,
    missingReasonLabels: missingLabels,
    generatedAt,
  };
}

export function selectTodayEdgePicks(
  candidates: TodayEdgePickCandidateInput[],
  generatedAt: string,
  maxPicks = 3,
  nowMs?: number,
): SelectTodayEdgePicksResult {
  const excluded: TodayEdgePickExcludedRow[] = [];
  const strictEligible: TodayEdgePickCandidateInput[] = [];
  const researchEligible: TodayEdgePickCandidateInput[] = [];
  const strictExclusionCounts: Record<string, number> = {};
  const effectiveNow = nowMs ?? Date.now();

  for (const candidate of candidates) {
    const { prediction, datasets } = candidate;
    const risk = deriveRisk(prediction);
    const strictReasons = buildStrictExclusionReasons(
      prediction,
      datasets,
      risk,
      effectiveNow,
    );

    if (strictReasons.length === 0) {
      strictEligible.push(candidate);
      continue;
    }

    incrementCounts(strictExclusionCounts, strictReasons);

    const researchReasons = buildResearchExclusionReasons(
      prediction,
      candidate,
      risk,
      effectiveNow,
    );

    if (researchReasons.length === 0) {
      researchEligible.push(candidate);
      continue;
    }

    excluded.push({
      gameId: prediction.gameId,
      home: prediction.homeTeam,
      away: prediction.awayTeam,
      reasons: [...new Set([...strictReasons, ...researchReasons])],
    });
  }

  strictEligible.sort(compareStrictCandidates);
  researchEligible.sort(compareResearchCandidates);

  const picks: TodayEdgePickRow[] = [];
  const usedGameIds = new Set<string>();

  for (const candidate of strictEligible) {
    if (picks.length >= maxPicks) break;
    usedGameIds.add(candidate.prediction.gameId);
    picks.push(
      toPickRow(
        candidate,
        (picks.length + 1) as 1 | 2 | 3,
        "EDGE_PICK",
        generatedAt,
      ),
    );
  }

  const strictSelectedCount = picks.length;

  for (const candidate of researchEligible) {
    if (picks.length >= maxPicks) break;
    if (usedGameIds.has(candidate.prediction.gameId)) continue;
    picks.push(
      toPickRow(
        candidate,
        (picks.length + 1) as 1 | 2 | 3,
        "RESEARCH_CANDIDATE",
        generatedAt,
      ),
    );
  }

  const researchCandidateCount = picks.length - strictSelectedCount;

  let selectionMode: TodayEdgeSelectionMode = "EMPTY";
  if (picks.length > 0) {
    if (strictSelectedCount > 0 && researchCandidateCount > 0) {
      selectionMode = "MIXED";
    } else if (strictSelectedCount > 0) {
      selectionMode = "STRICT_ONLY";
    } else {
      selectionMode = "RESEARCH_CANDIDATES_ONLY";
    }
  }

  excluded.sort((a, b) => a.gameId.localeCompare(b.gameId));

  return {
    picks,
    excluded,
    candidateCount: candidates.length,
    strictSelectedCount,
    researchCandidateCount,
    selectionMode,
    strictExclusionCounts,
  };
}
