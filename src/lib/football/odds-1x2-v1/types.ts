/**
 * Football 90-minute 1X2 Research Odds Dataset v1 — types.
 * Prediction / Engine / Snapshot are not part of this layer.
 */
import type { FootballLegalStatus } from "../core/types";
import type { FootballOneXTwoDevig } from "../odds-foundation-v0/types";

export const FOOTBALL_1X2_ODDS_V1_SCHEMA = "football-1x2-odds-v1" as const;
export const FOOTBALL_1X2_ODDS_V1_BUILDER =
  "football-1x2-odds-builder-v1" as const;
export const FOOTBALL_ODDS_TEAM_BRIDGE_VERSION =
  "football-odds-team-bridge-v1" as const;
export const FOOTBALL_ODDS_SPORT_KEY_MAP_VERSION =
  "football-odds-sport-key-map-v1" as const;
export const FOOTBALL_ODDS_MARKET = "MONEYLINE_3WAY_1X2" as const;

/** Smallest research-safe kickoff window in-repo: KBO operator 15 minutes. */
export const FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES = 15;

export type FootballOddsProviderId = "THE_ODDS_API";

export type Football1x2JoinStatus =
  | "JOINED"
  | "NOT_JOINED"
  | "AMBIGUOUS_EVENT_JOIN"
  | "ODDS_EVENT_IDENTITY_REVIEW_REQUIRED"
  | "ODDS_SPORT_KEY_NOT_MAPPED"
  | "PROVIDER_ERROR"
  | "NOT_COLLECTED";

export type Football1x2MarketStatus =
  | "COMPLETE_1X2"
  | "PARTIAL_1X2"
  | "INVALID_MARKET"
  | "NOT_COLLECTED";

export type FootballOddsTeamBridgeEntry = {
  canonicalTeamId: string;
  oddsProvider: FootballOddsProviderId;
  /** Exact The Odds API home_team / away_team strings. Not slugs. */
  oddsTeamNames: string[];
  source: string;
  verifiedAt?: string;
};

export type FootballOddsSportKeyEntry = {
  competitionId: string;
  sportKey: string;
  source: string;
};

export type Football1x2BookmakerQuote = {
  bookmakerKey: string;
  bookmakerTitle: string;
  lastUpdate: string | null;
  homeDecimal: number | null;
  drawDecimal: number | null;
  awayDecimal: number | null;
  marketStatus: Football1x2MarketStatus;
  rawImpliedHome: number | null;
  rawImpliedDraw: number | null;
  rawImpliedAway: number | null;
  overround: number | null;
  margin: number | null;
  devigHome: number | null;
  devigDraw: number | null;
  devigAway: number | null;
  overroundLevel: FootballOneXTwoDevig["overroundLevel"] | null;
  reasonCodes: string[];
};

export type Football1x2OddsObservationV1 = {
  observationId: string;
  matchId: string;
  apiFootballProviderMatchId: string;
  oddsProviderEventId: string | null;
  oddsProvider: FootballOddsProviderId;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  sourceScheduleArtifactHash: string;
  observedAt: string;
  scheduleKickoffTimeUtc: string;
  oddsCommenceTimeUtc: string | null;
  kickoffDeltaMinutes: number | null;
  minutesBeforeKickoff: number | null;
  joinStatus: Football1x2JoinStatus;
  marketStatus: Football1x2MarketStatus;
  pregameUsable: boolean;
  reasonCodes: string[];
  sportKey: string | null;
  oddsHomeTeamName: string | null;
  oddsAwayTeamName: string | null;
  bookmakers: Football1x2BookmakerQuote[];
  medianDevigHome: number | null;
  medianDevigDraw: number | null;
  medianDevigAway: number | null;
  researchOnly: true;
};

export type Football1x2OddsSkipCounts = {
  notSupportedFormat: number;
  competitionBlocked: number;
  identityBlocked: number;
  unknownEligibility: number;
  sportKeyNotMapped: number;
  teamBridgeMissing: number;
  missedPregameWindow: number;
};

export type Football1x2OddsArtifactV1 = {
  meta: {
    schemaVersion: typeof FOOTBALL_1X2_ODDS_V1_SCHEMA;
    builderVersion: typeof FOOTBALL_1X2_ODDS_V1_BUILDER;
    dateKst: string;
    generatedAt: string;
    observedAt: string;
    provider: FootballOddsProviderId;
    researchOnly: true;
    legalStatus: FootballLegalStatus;
    market: typeof FOOTBALL_ODDS_MARKET;
    sourceScheduleRel: string;
    sourceScheduleArtifactHash: string;
    teamBridgeVersion: typeof FOOTBALL_ODDS_TEAM_BRIDGE_VERSION;
    sportKeyMapVersion: typeof FOOTBALL_ODDS_SPORT_KEY_MAP_VERSION;
    kickoffToleranceMinutes: number;
    scheduleEligibleGames: number;
    providerEventsFetched: number;
    providerSportKeysRequested: string[];
    providerCalled: boolean;
    requestsUsed: number | null;
    requestsRemaining: number | null;
    requestCost: number | null;
    joinedGames: number;
    notJoinedGames: number;
    ambiguousGames: number;
    complete1x2Games: number;
    partial1x2Games: number;
    pregameUsableGames: number;
    lateGames: number;
    skipped: Football1x2OddsSkipCounts;
    artifactHash: string;
  };
  observations: Football1x2OddsObservationV1[];
};
