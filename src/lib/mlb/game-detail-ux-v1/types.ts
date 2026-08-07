/**
 * MLB Game Detail UX v1 — view models (Presenter only).
 */

export const MLB_GAME_DETAIL_UX_SCHEMA = "mlb-game-detail-ux-v1" as const;

export type FactorTone =
  | "ADVANTAGE"
  | "DISADVANTAGE"
  | "NEUTRAL"
  | "HOLD"
  | "NOT_AVAILABLE"
  | "RESEARCH_NOT_CONNECTED";

export type FactorRow = {
  id: string;
  label: string;
  tone: FactorTone;
  toneLabel: string;
  summary: string;
  detailLines: string[];
};

export type QualityCheck = {
  id: string;
  label: string;
  state: "ok" | "warn" | "missing";
  plain: string;
  code: string | null;
};

export type SideProbRow = {
  side: "HOME" | "AWAY";
  team: string;
  modelProbability: number | null;
  marketProbability: number | null;
  difference: number | null;
};

export type ReviewCandidate = {
  code: string;
  label: string;
  role: "primary" | "secondary";
  evidence: string | null;
  /** Soft phrasing — never definitive blame */
  plain: string;
};

export type MlbGameDetailView = {
  schemaVersion: typeof MLB_GAME_DETAIL_UX_SCHEMA;
  dateKst: string;
  gamePk: number;
  loaded: boolean;
  error: string | null;

  headline: {
    matchupLine: string;
    awayTeam: string;
    homeTeam: string;
    startTimeKst: string | null;
    commenceTimeUtc: string | null;
    gameStatus: string;
    researchPredictionTeam: string | null;
    researchPredictionSide: string | null;
    modelProbabilityPercent: number | null;
    marketProbabilityPercent: number | null;
    officialStatus: "PICK" | "PASS" | "BLOCKED" | "RESEARCH_ONLY" | "UNKNOWN";
    officialStatusPlain: string;
    oneLiner: string;
  };

  modelVsMarket: {
    rows: SideProbRow[];
    pickSide: "HOME" | "AWAY" | null;
    edgeScore: number | null;
    narrative: string;
  };

  factors: FactorRow[];

  dataQuality: {
    overall: "FULL_INPUT" | "LIMITED_INPUT" | "BLOCKED" | "UNKNOWN";
    overallPlain: string;
    checks: QualityCheck[];
    advancedCodes: string[];
  };

  postgame: null | {
    available: true;
    homeScore: number | null;
    awayScore: number | null;
    scoreLine: string;
    actualWinnerTeam: string | null;
    actualWinnerSide: string | null;
    researchGrade: string;
    brierScore: number | null;
    logLoss: number | null;
    primaryCandidates: ReviewCandidate[];
    secondaryCandidates: ReviewCandidate[];
    reviewSummary: string;
    reviewConclusion: string;
    observationOnly: boolean;
    conclusionCode: string | null;
  };

  /** Operator Expected Lineup observation — never Confirmed. */
  expectedLineup: import("@/lib/mlb/expected-lineup-observation-v0").MlbExpectedLineupGameDetailPanel | null;

  /** MARKET panels — Model / Provider / Korean kept separate. */
  marketPanels: {
    model: {
      available: boolean;
      awayTeam: string;
      homeTeam: string;
      awayModelProbability: number | null;
      homeModelProbability: number | null;
      sourceLabel: string;
    };
    provider: import("@/lib/mlb/korean-market-odds-observation-v0").MlbProviderMarketPanelV0;
    korean: import("@/lib/mlb/korean-market-odds-observation-v0").MlbKoreanMarketPanelV0;
  };

  advanced: {
    gameId: string | null;
    gamePk: number;
    predictionHash: string | null;
    gradedHash: string | null;
    reviewHash: string | null;
    schemaHints: string[];
    artifactPaths: string[];
    rawWarningCodes: string[];
  };
};
