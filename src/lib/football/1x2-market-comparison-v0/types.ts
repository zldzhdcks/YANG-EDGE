/**
 * Football 1X2 Pregame Market Comparison v0 — research overlay.
 * Joins manual domestic 1X2 to The Odds API 1X2 on api-football fixtureId.
 * Not a Prediction / Engine / Grade input.
 */

import type { Football1x2BookmakerQuote } from "../odds-1x2-v1/types";

export const FOOTBALL_1X2_MARKET_COMPARISON_V0_SCHEMA =
  "football-1x2-market-comparison-v0" as const;
export const FOOTBALL_1X2_MARKET_COMPARISON_V0_BUILDER =
  "football-1x2-market-comparison-builder-v0" as const;

export type Football1x2ComparisonIdentityStatus =
  | "JOINED"
  | "ODDS_IDENTITY_UNRESOLVED"
  | "ODDS_SPORT_KEY_NOT_MAPPED"
  | "NOT_JOINED"
  | "NOT_COLLECTED"
  | "POST_KICKOFF_NOT_ELIGIBLE";

export type Football1x2ExternalCutoffStatus =
  | "PRE_GAME_COLLECTED"
  | "POST_KICKOFF_NOT_ELIGIBLE"
  | "NOT_COLLECTED";

export type FootballScreenshotSideVsProvider =
  | "ALIGNED"
  | "REVERSED"
  | "UNCLEAR";

export type FootballOddsSideAlignment = "ALIGNED" | "REVERSED" | "UNRESOLVED";

export type Football1x2ThreeWayMetrics = {
  leftOrHomeDecimal: number | null;
  drawDecimal: number | null;
  rightOrAwayDecimal: number | null;
  rawImpliedLeftOrHome: number | null;
  rawImpliedDraw: number | null;
  rawImpliedRightOrAway: number | null;
  overround: number | null;
  margin: number | null;
};

export type Football1x2DomesticObservationV0 = {
  rowId: number;
  rawLeftTeam: string;
  rawRightTeam: string;
  candidateLeftTeam: string;
  candidateRightTeam: string;
  rawMarketLabel: string;
  prices: Array<number | null>;
  screenshotFile: string;
  screenshotSha256: string;
  receivedAtKst: string;
  captureTime: unknown;
  screenshotSideVsProviderHome: FootballScreenshotSideVsProvider;
  metrics: Football1x2ThreeWayMetrics;
};

export type Football1x2ExternalObservationV0 = {
  provider: "THE_ODDS_API";
  providerEventId: string | null;
  sportKey: string | null;
  oddsHomeTeamName: string | null;
  oddsAwayTeamName: string | null;
  commenceTimeUtc: string | null;
  collectedAt: string | null;
  cached: boolean;
  sideAlignment: FootballOddsSideAlignment;
  joinEvidence: string[];
  cutoffStatus: Football1x2ExternalCutoffStatus;
  bookmakers: Football1x2BookmakerQuote[];
  medianRawImpliedHome: number | null;
  medianRawImpliedDraw: number | null;
  medianRawImpliedAway: number | null;
  medianOverround: number | null;
};

export type Football1x2ProbabilityGapV0 = {
  computed: boolean;
  reason: string | null;
  home: number | null;
  draw: number | null;
  away: number | null;
};

export type Football1x2MarketComparisonRowV0 = {
  fixtureId: number;
  matchup: string;
  competitionId: number;
  competitionName: string;
  kickoffUtc: string | null;
  kickoffKst: string | null;
  scheduleDateKst: string | null;
  identityStatus: Football1x2ComparisonIdentityStatus;
  domestic: Football1x2DomesticObservationV0;
  external: Football1x2ExternalObservationV0;
  probabilityGap: Football1x2ProbabilityGapV0;
  usedByPrediction: false;
};

export type Football1x2MarketComparisonV0 = {
  schemaVersion: typeof FOOTBALL_1X2_MARKET_COMPARISON_V0_SCHEMA;
  builderVersion: typeof FOOTBALL_1X2_MARKET_COMPARISON_V0_BUILDER;
  batchId: string;
  dateKst: string;
  sourceObservedSlatePath: string;
  sourceObservedSlateHash: string;
  sourceObservationPath: string;
  sourceObservationHash: string;
  sourceMappingPath: string;
  sourceMappingHash: string;
  generatedAt: string;
  researchOnly: true;
  engineAdmission: "PROHIBITED";
  engineConnected: false;
  predictionInput: false;
  resultDataUsed: false;
  autoApply: false;
  doesNotReplaceOdds1x2V1: true;
  existingOdds1x2V1Written: false;
  note: string;
  oddsPipelineAudit: {
    oddsBuilderImportsPrediction: false;
    oddsIntakeIndependentOfPrediction: true;
    existingCliWouldCallProvider20260816: false;
    existingCliWouldCallProvider20260817: false;
    existingCliSkipNotes: string[];
    didNotWriteFootball1x2OddsV1: true;
  };
  summary: {
    observedGames: number;
    manual1x2Observations: number;
    registeredResearchEligible: number;
    unregisteredNotInJoin: number;
    targetFixtures: number;
    fixtureIdsUnique: number;
    domesticJoined: number;
    domesticMissing: number;
    externalEventsCollected: number;
    externalMatched: number;
    externalMissing: number;
    unresolved: number;
    domesticPlusExternal: number;
    domesticOnly: number;
    externalOnly: number;
    pregameSafe: number;
    postKickoffExcluded: number;
    impliedProbabilityComputed: number;
    overroundComputed: number;
    gapComputed: number;
    usedByPrediction: false;
  };
  rows: Football1x2MarketComparisonRowV0[];
};
