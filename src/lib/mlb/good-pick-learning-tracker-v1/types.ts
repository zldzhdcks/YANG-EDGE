/**
 * Good Pick Learning Tracker v1 — cumulative presentation types.
 * Read-only over Good Pick Feedback; no Engine / Prediction changes.
 */

export const GOOD_PICK_LEARNING_TRACKER_SCHEMA =
  "mlb-good-pick-learning-tracker-v1" as const;

export const SMALL_SAMPLE_THRESHOLD = 10;
export const EARLY_SAMPLE_THRESHOLD = 30;

export type DayTrackerStatus =
  | "GRADED"
  | "AWAITING_RESULT"
  | "NO_PREGAME_SNAPSHOT"
  | "NO_GOOD_PICKS"
  | "ERROR";

export type MarketAlignmentBucket =
  | "MARKET_ALIGNED"
  | "MARKET_CONFLICT"
  | "MARKET_UNKNOWN";

export type MarginBucket = "ONE_RUN" | "TWO_THREE_RUN" | "FOUR_PLUS" | "UNKNOWN";

export type SampleStats = {
  sample: number;
  correct: number;
  incorrect: number;
  pending: number;
  accuracyPercent: number | null;
  smallSample: boolean;
};

export type DayTrackerRow = {
  dateKst: string;
  status: DayTrackerStatus;
  goodPickCount: number;
  correct: number;
  incorrect: number;
  pending: number;
  accuracyPercent: number | null;
  /** Included in historical accuracy denominator */
  countsTowardRecord: boolean;
  line: string;
  feedbackHref: string;
};

export type SignalComboRow = {
  id: string;
  label: string;
  stats: SampleStats;
};

export type MarketAlignmentRow = {
  bucket: MarketAlignmentBucket;
  label: string;
  stats: SampleStats;
};

export type MarginRow = {
  bucket: MarginBucket;
  label: string;
  correct: number;
  incorrect: number;
  total: number;
  plain: string;
};

export type GoodPickLearningTrackerView = {
  schemaVersion: typeof GOOD_PICK_LEARNING_TRACKER_SCHEMA;
  asOfDateKst: string;
  loaded: boolean;
  error: string | null;
  /** Cumulative graded Good Picks only (NO_PREGAME_SNAPSHOT excluded) */
  record: {
    totalGoodPicks: number;
    correct: number;
    incorrect: number;
    pending: number;
    accuracyPercent: number | null;
    earlySample: boolean;
    recordLine: string;
  };
  days: DayTrackerRow[];
  signalCombos: SignalComboRow[];
  marketAlignment: MarketAlignmentRow[];
  margins: MarginRow[];
  probabilityVsConfidence: {
    probabilityPlain: string;
    confidencePlain: string;
  };
  predictionHashes: Record<string, string | null>;
  sourceNote: string;
};
