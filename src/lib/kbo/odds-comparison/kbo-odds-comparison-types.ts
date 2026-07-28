import type {
  KboOperatorMarketReviewStatus,
  KboOperatorMarketType,
  KboOperatorPeriod,
  KboSelectionCode,
} from "../operator-input-v2/kbo-operator-market-input-types";

export const KBO_ODDS_COMPARISON_DATASET_ID = "kbo-odds-comparison";
export const KBO_ODDS_COMPARISON_SCHEMA_VERSION = "kbo-odds-comparison-v1";
export const KBO_ODDS_COMPARISON_BUILDER_VERSION =
  "kbo-odds-comparison-builder-v1";

export type KboOddsComparisonSelection = {
  selectionCode: KboSelectionCode;
  selectionLabel: string;
  odds: number;
  bookmaker?: string | null;
};

export type KboDomesticOddsSource = {
  sourceType: "DOMESTIC_PROTO_OPERATOR_INPUT";
  sourceLabel: "KOREAN_PROTO";
  capturedAt: string;
  reviewStatus: KboOperatorMarketReviewStatus;
  operatorMarketId: string;
  selections: KboOddsComparisonSelection[];
};

export type KboOverseasOddsSource = {
  provider: "THE_ODDS_API";
  sportKey: string;
  capturedAt: string;
  bookmakerPolicy: "AGGREGATE_BEST";
  marketKey: "h2h";
  selections: KboOddsComparisonSelection[];
  legalStatus: "NEEDS_LEGAL_REVIEW";
};

export type KboOddsComparisonStatus =
  | "COMPARABLE"
  | "DOMESTIC_MISSING"
  | "OVERSEAS_MISSING"
  | "GAME_UNMATCHED"
  | "MARKET_RULE_UNVERIFIED"
  | "SELECTION_MISMATCH"
  | "DRAFT_DOMESTIC_INPUT";

export type KboOddsDifferenceSource =
  | "DOMESTIC"
  | "OVERSEAS"
  | "EQUAL"
  | "NONE";

export type KboOddsComparisonRow = {
  gameId: string;
  dateKst: string;
  startTimeKst: string;
  homeTeam: string;
  awayTeam: string;
  marketType: Extract<KboOperatorMarketType, "MONEYLINE_2WAY">;
  period: Extract<KboOperatorPeriod, "FULL_GAME">;
  line: null;
  domestic: KboDomesticOddsSource | null;
  overseas: KboOverseasOddsSource | null;
  comparison: {
    status: KboOddsComparisonStatus;
    homeDifference: number | null;
    awayDifference: number | null;
    higherHomeSource: KboOddsDifferenceSource;
    higherAwaySource: KboOddsDifferenceSource;
  };
  generatedAt: string;
  warnings: string[];
  missing: string[];
};

export type KboOddsComparisonDocument = {
  meta: {
    datasetId: typeof KBO_ODDS_COMPARISON_DATASET_ID;
    schemaVersion: typeof KBO_ODDS_COMPARISON_SCHEMA_VERSION;
    builderVersion: typeof KBO_ODDS_COMPARISON_BUILDER_VERSION;
    dateKst: string;
    generatedAt: string;
    researchOnly: true;
    legalStatus: "INTERNAL_RESEARCH_ONLY";
    engineAdmission: "PROHIBITED";
    inputHashSha256: string;
    resultHashSha256: string;
    notes: string[];
  };
  cacheUsage: {
    rawHit: number;
    rawMiss: number;
    networkCalls: number;
  };
  warnings: string[];
  missing: string[];
  summary: {
    identityGames: number;
    domesticGames: number;
    domesticMarkets: number;
    domesticReviewStatus: KboOperatorMarketReviewStatus;
    overseasGamesFetched: number;
    overseasGamesMatched: number;
    overseasGamesUnmatched: number;
    comparableGames: number;
    marketRuleUnverified: number;
    domesticOnlyGames: number;
    overseasOnlyGames: number;
    invalidOdds: number;
  };
  rows: KboOddsComparisonRow[];
};
