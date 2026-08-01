/**
 * MLB Baseline Prediction v0 — types.
 */

export type OfficialStatus = "ELIGIBLE" | "PASS" | "BLOCKED" | "NOT_APPLICABLE";

export type InputQuality =
  | "FULL_INPUT"
  | "LIMITED_INPUT"
  | "STARTER_ONLY"
  | "MARKET_ONLY"
  | "INSUFFICIENT";

export type StarterQuality =
  | "GOOD"
  | "PARTIAL"
  | "INSUFFICIENT"
  | "MISSING";

export type FeatureProvenance = {
  sourceArtifact: string | null;
  sourceTimestamp: string | null;
  statsAsOf: string | null;
  cutoffTime: string | null;
  leakageEligible: boolean;
  warning: string[];
};

export type StarterFeature = {
  playerName: string | null;
  era: number | null;
  whip: number | null;
  inningsPitched: number | null;
  strikeouts: number | null;
  walks: number | null;
  throws: "L" | "R" | null;
  score: number;
  quality: StarterQuality;
  provenance: FeatureProvenance;
};

export type MarketFeature = {
  homeOdds: number | null;
  awayOdds: number | null;
  oddsFormat: "DECIMAL" | "UNKNOWN" | "INVALID";
  marketProbabilityHome: number | null;
  marketProbabilityAway: number | null;
  overround: number | null;
  oddsQuality: "GOOD" | "PARTIAL" | "MISSING" | "INVALID";
  provenance: FeatureProvenance;
};

export type LineupFeature = {
  confirmed: boolean;
  completeness: number;
  missingCoreHitters: number;
  performanceEdgeWeight: 0;
  provenance: FeatureProvenance;
};

export type BullpenFeature = {
  score: number;
  dataQuality: "DISABLED" | "UNKNOWN" | "PARTIAL" | "GOOD";
  edge: number;
  provenance: FeatureProvenance;
};

export type LogitComponents = {
  base: number;
  starter: number;
  bullpen: number;
  lineup: number;
  homeAdvantage: number;
  marketPrior: number;
};

export type MarketPredictionV0 = {
  marketType: "MONEYLINE_2WAY";
  line: null;
  homeProbability: number;
  awayProbability: number;
  marketHomeProbability: number | null;
  marketAwayProbability: number | null;
  modelEdgeHome: number | null;
  modelEdgeAway: number | null;
  confidence: number;
  officialStatus: OfficialStatus;
  officialPick: "HOME" | "AWAY" | null;
  researchBaseline: {
    selection: "HOME" | "AWAY";
    probability: number;
    researchOnly: true;
  };
  components: LogitComponents;
  missingInputs: string[];
  warnings: string[];
  explanations: string[];
  inputQuality: InputQuality;
  calibration: {
    rawHomeProbability: number;
    clampedHomeProbability: number;
    shrinkStrength: number;
    clampMin: number;
    clampMax: number;
  };
};

export type GamePredictionV0 = {
  gameId: string;
  externalId: string | null;
  dateKst: string;
  startTimeKst: string | null;
  commenceTimeUtc: string | null;
  league: "MLB";
  homeTeam: string;
  awayTeam: string;
  marketPredictions: MarketPredictionV0[];
  /** Legacy-compatible fields for existing readers. */
  baselinePick: string | null;
  modelProbability: number | null;
  edgeScore: number | null;
  confidence: number | null;
  baselineStatus: "PASS" | "INSUFFICIENT" | "BASELINE_CANDIDATE";
  marketProbability: number | null;
  valueEdge: number | null;
  openingOdds: number | null;
  latestOdds: number | null;
  oddsMovement: string | null;
  officialStatus: OfficialStatus;
  officialPick: "HOME" | "AWAY" | null;
  passReasons: string[];
  missingInputs: string[];
  researchBaseline: {
    pick: string | null;
    confidence: number | null;
    modelProbability: number | null;
    researchOnly: true;
  };
  inputStatus: "ELIGIBLE" | "LIMITED_INPUT" | "BLOCKED";
  inputWarnings: string[];
  features: {
    homeStarter: StarterFeature;
    awayStarter: StarterFeature;
    market: MarketFeature;
    lineup: LineupFeature;
    homeBullpen: BullpenFeature;
    awayBullpen: BullpenFeature;
  };
  leakage: {
    blocked: boolean;
    reasons: string[];
  };
};

export type PredictionSnapshotV0Meta = {
  schemaVersion: "mlb-research-prediction-snapshot-v1";
  modelVersion: string;
  modelStatus: "RESEARCH_BASELINE_V0";
  configHash: string;
  inputManifestHash: string;
  predictionHashSha256: string;
  generatedAt: string;
  dateKst: string;
  marketTypes: string[];
  notImplementedMarkets: string[];
  eligibleCount: number;
  passCount: number;
  blockedCount: number;
  researchBaselineCount: number;
  officialPickCount: number;
  observationOnly: boolean;
  useMarketPrior: boolean;
  dryRun: boolean;
};

export type PredictionSnapshotV0 = {
  meta: PredictionSnapshotV0Meta;
  summary: {
    totalGames: number;
    predictedGames: number;
    researchOnly: true;
    purchaseEligible: false;
  };
  predictions: Array<Record<string, unknown>>;
};
