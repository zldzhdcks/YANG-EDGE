import {
  EARLY_SAMPLE_THRESHOLD,
  SMALL_SAMPLE_THRESHOLD,
} from "@/lib/mlb/good-pick-learning-tracker-v1/types";
import {
  assignCalibrationBucket,
  CALIBRATION_BUCKETS,
  logLossHomeAway,
} from "@/lib/mlb/scorecard-v0/metrics";
import { SCORECARD_V0_CONFIG } from "@/lib/mlb/scorecard-v0/config";
import type {
  CalibrationBucketMetric,
  CalibrationDimension,
  CountAccuracy,
  ExpectedLineupCoverage,
  InputCompletenessDimension,
  MarketBenchmarkDimension,
  MlbResearchScorecardRowV1,
  ObservationTiming,
  RecommendationSelectionDimension,
  ReviewTagFrequency,
  ReviewTagProvenance,
  ScorecardSampleStatus,
  StarterAvailability,
} from "./types";

const MIN_CAL = SCORECARD_V0_CONFIG.minCalibrationSamples;
const REGISTRY_EVALUABLE_N = 100;

export function scorecardSampleStatus(n: number): ScorecardSampleStatus {
  if (n <= 0) return "NO_SAMPLE";
  if (n < SMALL_SAMPLE_THRESHOLD) return "INSUFFICIENT_SAMPLE";
  if (n < EARLY_SAMPLE_THRESHOLD) return "EARLY_SAMPLE";
  if (n < REGISTRY_EVALUABLE_N) return "DATA_COLLECTION";
  return "DATA_ACCUMULATION_CONTINUES";
}

function accuracyPercent(correct: number, incorrect: number): number | null {
  const n = correct + incorrect;
  if (n === 0) return null;
  return Math.round((correct / n) * 1000) / 10;
}

function countAccuracy(correct: number, incorrect: number): CountAccuracy {
  const n = correct + incorrect;
  return {
    n,
    correct,
    incorrect,
    accuracyPercent: accuracyPercent(correct, incorrect),
    sampleStatus: scorecardSampleStatus(n),
  };
}

export function isGradedResearchRow(row: MlbResearchScorecardRowV1): boolean {
  if (row.resultStatus !== "FINAL") return false;
  if (row.predictionStatus === "BLOCKED") return false;
  if (row.predictionStatus === "MISSING") return false;
  return row.predictionCorrect === true || row.predictionCorrect === false;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function selectedUnit(row: MlbResearchScorecardRowV1): number | null {
  const p = row.selectedPickProbability;
  if (p == null || !Number.isFinite(p)) return null;
  return p > 1 ? p / 100 : p;
}

export function reviewTagProvenance(tag: string): ReviewTagProvenance {
  const t = tag.toUpperCase();
  if (t === "ONE_RUN_GAME" || t === "BLOWOUT" || t === "EXTRA_INNINGS") {
    return "OUTCOME_DERIVED";
  }
  if (t === "LINEUP" || t === "STARTER" || t === "MARKET") {
    return "PREEXISTING_WARNING";
  }
  if (t === "BULLPEN") return "UNKNOWN";
  return "POSTGAME_DESCRIPTIVE";
}

export function aggregateCalibration(
  rows: MlbResearchScorecardRowV1[],
): CalibrationDimension {
  const graded = rows.filter(isGradedResearchRow);
  let correct = 0;
  let incorrect = 0;
  let homeC = 0;
  let homeI = 0;
  let awayC = 0;
  let awayI = 0;
  const briers: number[] = [];
  const logLosses: number[] = [];
  const bucketAcc = new Map<
    string,
    { n: number; pred: number[]; wins: number }
  >();

  for (const row of graded) {
    if (row.predictionCorrect) correct += 1;
    else incorrect += 1;
    if (row.selectedPickSide === "HOME") {
      if (row.predictionCorrect) homeC += 1;
      else homeI += 1;
    } else if (row.selectedPickSide === "AWAY") {
      if (row.predictionCorrect) awayC += 1;
      else awayI += 1;
    }
    const p = selectedUnit(row);
    if (p != null && row.predictionCorrect != null && row.selectedPickSide) {
      const y = row.predictionCorrect ? 1 : 0;
      briers.push((p - y) ** 2);
      const winner: "HOME" | "AWAY" = row.predictionCorrect
        ? row.selectedPickSide
        : row.selectedPickSide === "HOME"
          ? "AWAY"
          : "HOME";
      const homeP = row.selectedPickSide === "HOME" ? p : 1 - p;
      const awayP = 1 - homeP;
      logLosses.push(logLossHomeAway(homeP, awayP, winner));
      const bucket = assignCalibrationBucket(p);
      if (bucket) {
        const slot = bucketAcc.get(bucket) ?? { n: 0, pred: [], wins: 0 };
        slot.n += 1;
        slot.pred.push(p);
        if (row.predictionCorrect) slot.wins += 1;
        bucketAcc.set(bucket, slot);
      }
    }
  }

  const probabilityBuckets: CalibrationBucketMetric[] = CALIBRATION_BUCKETS.map(
    (b) => {
      const slot = bucketAcc.get(b.id);
      if (!slot || slot.n === 0) {
        return {
          bucket: b.id,
          n: 0,
          predictedAverage: null,
          actualWinRate: null,
          status: "EMPTY",
        };
      }
      if (slot.n < MIN_CAL) {
        return {
          bucket: b.id,
          n: slot.n,
          predictedAverage: null,
          actualWinRate: null,
          status: "INSUFFICIENT_SAMPLE",
        };
      }
      return {
        bucket: b.id,
        n: slot.n,
        predictedAverage: mean(slot.pred),
        actualWinRate: slot.wins / slot.n,
        status: "OK",
      };
    },
  );

  const n = correct + incorrect;
  return {
    dimension: "CALIBRATION",
    gradedN: n,
    correct,
    incorrect,
    accuracyPercent: accuracyPercent(correct, incorrect),
    meanBrier: mean(briers),
    meanLogLoss: mean(logLosses),
    home: countAccuracy(homeC, homeI),
    away: countAccuracy(awayC, awayI),
    probabilityBuckets,
    sampleStatus: scorecardSampleStatus(n),
    note: "Graded research predictions only. BLOCKED and AWAITING excluded. Selected-pick probability via resolveSelectedPickProbability. No VERIFIED conclusion.",
  };
}

export function aggregateRecommendationSelection(
  rows: MlbResearchScorecardRowV1[],
): RecommendationSelectionDimension {
  const graded = rows.filter(isGradedResearchRow);
  let goodC = 0;
  let goodI = 0;
  let nonC = 0;
  let nonI = 0;
  for (const row of graded) {
    if (row.isGoodPick) {
      if (row.predictionCorrect) goodC += 1;
      else goodI += 1;
    } else if (row.predictionCorrect) nonC += 1;
    else nonI += 1;
  }
  return {
    dimension: "RECOMMENDATION_SELECTION_VALUE",
    goodPick: countAccuracy(goodC, goodI),
    nonGoodResearch: countAccuracy(nonC, nonI),
    note: "Research-only Good Picks vs remaining graded research baseline. Not official picks. No causal claim.",
  };
}

export function aggregateInputCompleteness(
  rows: MlbResearchScorecardRowV1[],
): InputCompletenessDimension {
  const keys: StarterAvailability[] = [
    "BOTH_AVAILABLE",
    "PARTIAL",
    "MISSING",
  ];
  const starter = keys.map((availability) => {
    const subset = rows.filter(
      (r) => r.starterAvailability === availability && isGradedResearchRow(r),
    );
    let c = 0;
    let i = 0;
    for (const r of subset) {
      if (r.predictionCorrect) c += 1;
      else i += 1;
    }
    return { availability, ...countAccuracy(c, i) };
  });
  return {
    dimension: "INPUT_COMPLETENESS",
    starter,
    note: "Observational correlation of pregame starter completeness with graded outcome. Not an Engine weight. Expected Lineup is coverage/timing only in v1.",
  };
}

export function aggregateMarketBenchmark(
  rows: MlbResearchScorecardRowV1[],
): MarketBenchmarkDimension {
  const graded = rows.filter(isGradedResearchRow);
  let alignedC = 0;
  let alignedI = 0;
  let conflictC = 0;
  let conflictI = 0;
  for (const row of graded) {
    if (row.modelVsKoreanMarket === "ALIGNED") {
      if (row.predictionCorrect) alignedC += 1;
      else alignedI += 1;
    } else if (row.modelVsKoreanMarket === "CONFLICT") {
      if (row.predictionCorrect) conflictC += 1;
      else conflictI += 1;
    }
  }

  let kWon = 0;
  let kLost = 0;
  let pWon = 0;
  let pLost = 0;
  const providerVsKorean = {
    SAME_FAVORITE: 0,
    DIFFERENT_FAVORITE: 0,
    NO_KOREAN_OBSERVATION: 0,
    NO_PROVIDER_MARKET: 0,
    AMBIGUOUS: 0,
  };

  for (const row of rows) {
    const kFav = row.koreanMarketFavoriteSide;
    const pFav = row.providerMarketFavoriteSide;
    if (row.koreanMarketObservationStatus === "NO_KOREAN_OBSERVATION") {
      providerVsKorean.NO_KOREAN_OBSERVATION += 1;
    } else if (!row.providerMarketAvailable || pFav == null || pFav === "NO_FAVORITE") {
      providerVsKorean.NO_PROVIDER_MARKET += 1;
    } else if (
      kFav == null ||
      kFav === "TIE" ||
      kFav === "NO_FAVORITE" ||
      pFav === "TIE"
    ) {
      providerVsKorean.AMBIGUOUS += 1;
    } else if (kFav === pFav) {
      providerVsKorean.SAME_FAVORITE += 1;
    } else {
      providerVsKorean.DIFFERENT_FAVORITE += 1;
    }

    if (row.resultStatus !== "FINAL") continue;
    const winner = row.actualWinnerSide;
    if (winner !== "HOME" && winner !== "AWAY") continue;
    if (kFav === "HOME" || kFav === "AWAY") {
      if (kFav === winner) kWon += 1;
      else kLost += 1;
    }
    if (pFav === "HOME" || pFav === "AWAY") {
      if (pFav === winner) pWon += 1;
      else pLost += 1;
    }
  }

  return {
    dimension: "MARKET_BENCHMARK",
    koreanSource: "MANUAL_OBSERVATION",
    providerConfirmed: false,
    koreanUsedAsEngineInput: false,
    modelVsKorean: [
      { group: "ALIGNED", ...countAccuracy(alignedC, alignedI) },
      { group: "CONFLICT", ...countAccuracy(conflictC, conflictI) },
    ],
    koreanFavoriteBaseline: countAccuracy(kWon, kLost),
    providerFavoriteBaseline: countAccuracy(pWon, pLost),
    providerVsKorean,
    note: "Korean market is operator-supplied, not Provider-confirmed, and is not an Engine input. Known 08-12/13/14 observations are post-Prediction. ALIGNED/CONFLICT accuracy uses graded research rows only. Favorite baselines use FINAL results and exclude AWAITING.",
  };
}

export function aggregateExpectedLineupCoverage(
  rows: MlbResearchScorecardRowV1[],
): ExpectedLineupCoverage {
  const timing: Record<ObservationTiming, number> = {
    BEFORE_PREDICTION: 0,
    AFTER_PREDICTION_BUT_BEFORE_GAME: 0,
    LATE: 0,
    UNKNOWN: 0,
  };
  let observed = 0;
  let notObserved = 0;
  let expectedStatusCount = 0;
  let post = 0;
  for (const row of rows) {
    if (row.expectedLineupObservationStatus === "OBSERVED") observed += 1;
    else notObserved += 1;
    if (row.expectedLineupStatus === "EXPECTED") expectedStatusCount += 1;
    if (row.expectedLineupTimingRelativeToPrediction) {
      timing[row.expectedLineupTimingRelativeToPrediction] += 1;
    }
    if (row.expectedLineupPostPredictionPregameObservation) post += 1;
  }
  return {
    observed,
    notObserved,
    expectedStatusCount,
    confirmedStatusCount: 0,
    timing,
    postPredictionPregameObservation: post,
    usedByPredictionCount: 0,
    note: "Coverage and timing only. Not a v1 performance dimension. Never promoted to CONFIRMED. expectedLineupUsedByPrediction is always false.",
  };
}

export function aggregateReviewTagQa(
  rows: MlbResearchScorecardRowV1[],
): {
  dataClass: "POSTGAME_REVIEW_TAG";
  tags: ReviewTagFrequency[];
  note: string;
} {
  const graded = rows.filter(isGradedResearchRow);
  const byTag = new Map<string, { wins: number; losses: number }>();
  for (const row of graded) {
    for (const tag of row.reviewTags) {
      const slot = byTag.get(tag) ?? { wins: 0, losses: 0 };
      if (row.predictionCorrect) slot.wins += 1;
      else slot.losses += 1;
      byTag.set(tag, slot);
    }
  }
  const tags: ReviewTagFrequency[] = [...byTag.entries()]
    .map(([tag, v]) => ({
      tag,
      winsWithTag: v.wins,
      lossesWithTag: v.losses,
      total: v.wins + v.losses,
      dataClass: "POSTGAME_REVIEW_TAG" as const,
      provenance: reviewTagProvenance(tag),
    }))
    .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));
  return {
    dataClass: "POSTGAME_REVIEW_TAG",
    tags,
    note: "Descriptive postgame QA only. A tag appearing among losses is not evidence that the tag caused the loss. Not an Engine variable.",
  };
}

export function researchStatusForGradedN(gradedN: number): {
  overall: ScorecardSampleStatus;
  promotion: "PROHIBITED";
  allowedConclusions: ScorecardSampleStatus[];
  forbiddenConclusions: ["PROMISING", "READY_FOR_BACKTEST", "VERIFIED"];
  note: string;
} {
  return {
    overall: scorecardSampleStatus(gradedN),
    promotion: "PROHIBITED",
    allowedConclusions: [
      "INSUFFICIENT_SAMPLE",
      "EARLY_SAMPLE",
      "DATA_COLLECTION",
      "DATA_ACCUMULATION_CONTINUES",
      "INVESTIGATE_MORE",
      "NO_SAMPLE",
    ],
    forbiddenConclusions: ["PROMISING", "READY_FOR_BACKTEST", "VERIFIED"],
    note: "Reuses tracker SMALL_SAMPLE_THRESHOLD=10, EARLY_SAMPLE_THRESHOLD=30, and Registry <100 graded games cannot be PROMISING. autoApply remains false.",
  };
}
