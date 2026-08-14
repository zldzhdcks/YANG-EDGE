/**
 * Football Official Result v0 — operational postgame artifact.
 * Reuses Result Foundation v0. No Prediction / Engine / Grade.
 */
import type { FootballLegalStatus } from "../core/types";
import type {
  FootballAdvancementWinner,
  FootballOneXTwoOutcome,
  FootballResultStatus,
  FootballResultUsabilityStatus,
  FootballScorePair,
} from "../result-foundation-v0/types";

export const FOOTBALL_OFFICIAL_RESULT_V0_SCHEMA =
  "football-official-result-v0" as const;
export const FOOTBALL_OFFICIAL_RESULT_V0_BUILDER =
  "football-official-result-builder-v0" as const;
export const FOOTBALL_OFFICIAL_RESULT_MARKET_SETTLEMENT =
  "REGULATION_90_MINUTES_1X2" as const;
export const FOOTBALL_OFFICIAL_RESULT_PROVIDER = "API_FOOTBALL" as const;

export type FootballOfficialResultRunOutcome =
  | "SEALED"
  | "WAITING_FINAL"
  | "RESULT_NOT_FINAL";

export type FootballOfficialResultMatchV0 = {
  matchId: string;
  fixtureId: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTimeUtc: string | null;
  providerStatusRaw: string | null;
  resultStatus: FootballResultStatus;
  resultObservedAt: string;
  regularTime: FootballScorePair;
  extraTime: FootballScorePair | null;
  penalties: FootballScorePair | null;
  finalScore: FootballScorePair;
  oneXTwoOutcome: "HOME" | "DRAW" | "AWAY" | null;
  advancementWinner: "HOME" | "AWAY" | null;
  usability: FootballResultUsabilityStatus;
  gradingAllowed: boolean;
  reasonCodes: string[];
  resultHash: string | null;
  researchOnly: true;
};

export type FootballOfficialResultArtifactV0 = {
  meta: {
    schemaVersion: typeof FOOTBALL_OFFICIAL_RESULT_V0_SCHEMA;
    builderVersion: typeof FOOTBALL_OFFICIAL_RESULT_V0_BUILDER;
    dateKst: string;
    generatedAt: string;
    resultObservedAt: string;
    researchOnly: true;
    legalStatus: FootballLegalStatus;
    provider: typeof FOOTBALL_OFFICIAL_RESULT_PROVIDER;
    marketSettlement: typeof FOOTBALL_OFFICIAL_RESULT_MARKET_SETTLEMENT;
    sourceScheduleRel: string;
    sourceScheduleHash: string;
    scheduleMatches: number;
    providerRequestedGames: number;
    finalUsableGames: number;
    notFinalGames: number;
    blockedGames: number;
    prediction: "NONE";
    engine: "NONE";
    recommendation: "NONE";
    resultArtifactHash: string;
  };
  matches: FootballOfficialResultMatchV0[];
};

export type FootballOfficialResultFixtureFetch = {
  fixture: import("../types").FixtureRaw | null;
  cached: boolean;
};

export type FootballOfficialResultFixtureFetcher = {
  getFixtureById(fixtureId: number): Promise<FootballOfficialResultFixtureFetch>;
};

export type FootballOfficialResultRunV0 = {
  outcome: FootballOfficialResultRunOutcome;
  wrote: boolean;
  rel: string;
  document: FootballOfficialResultArtifactV0 | null;
  providerRequestCount: number;
  providerCachedCount: number;
  terminalFinal: boolean;
  providerStatusRaw: string | null;
  resultStatus: FootballResultStatus | null;
  reasonCodes: string[];
  matchSummaries: FootballOfficialResultMatchV0[];
};

export type {
  FootballAdvancementWinner,
  FootballOneXTwoOutcome,
  FootballResultStatus,
  FootballResultUsabilityStatus,
  FootballScorePair,
};
