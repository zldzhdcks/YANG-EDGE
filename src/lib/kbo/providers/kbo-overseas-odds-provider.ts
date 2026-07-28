import type { KboCacheUsageStats } from "../kbo-cache-types";

export type KboOverseasOddsMappingStatus =
  | "MATCHED"
  | "AMBIGUOUS"
  | "UNMATCHED"
  | "NOT_CHECKED";

export type KboNormalizedOverseasOddsGame = {
  provider: "THE_ODDS_API";
  sportKey: string;
  providerEventId: string;
  homeTeamProviderName: string;
  awayTeamProviderName: string;
  homeCanonicalTeamId: string | null;
  awayCanonicalTeamId: string | null;
  providerStartTime: string;
  startTimeKst: string | null;
  capturedAt: string;
  bookmakerPolicy: "AGGREGATE_BEST";
  marketKey: "h2h";
  ruleVerified: false;
  legalStatus: "NEEDS_LEGAL_REVIEW";
  mappingStatus: KboOverseasOddsMappingStatus;
  selections: Array<{
    selectionCode: "HOME" | "AWAY";
    selectionLabel: string;
    odds: number;
    bookmaker: string | null;
  }>;
};

export type KboOverseasOddsFetchResult = {
  provider: "THE_ODDS_API";
  sportKey: string;
  games: KboNormalizedOverseasOddsGame[];
  fetchedAt: string;
  warnings: string[];
  missing: string[];
};

export type KboOverseasOddsProvider = {
  readonly usage: KboCacheUsageStats;
  fetchMoneylineByDate(dateKst: string): Promise<KboOverseasOddsFetchResult>;
};
