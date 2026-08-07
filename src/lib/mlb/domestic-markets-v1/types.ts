/**
 * MLB domestic proto markets operator artifact (v1).
 * Separate namespace from overseas Odds API prior.
 */

export const MLB_DOMESTIC_MARKETS_SCHEMA = "mlb-domestic-markets-v1" as const;

export type DomesticSourceMeta = {
  sourceType: "ADMIN_MANUAL_SCREENSHOT";
  extractionMethod: "MANUAL_VISUAL_CONFIRMATION";
  confirmationMethod: "ADMIN_VERIFIED";
  commercialUseStatus: "INTERNAL_ONLY";
  screenshotCount: number;
  observedAt: string;
  enteredAt: string;
};

export type RawDomesticMarket = {
  rawMarketCode: string;
  screenLabel: string;
  prices: number[];
  line: number | null;
  sideHint: string | null;
  notes?: string[];
};

export type NormalizedDomesticMarket =
  | {
      marketType: "MONEYLINE_2WAY";
      homePrice: number;
      awayPrice: number;
      predictionSupport: "SUPPORTED_V0";
    }
  | {
      marketType: "TOTALS";
      line: number;
      underPrice: number;
      overPrice: number;
      predictionSupport: "STORED_NOT_USED_V0";
    }
  | {
      marketType: "RUN_LINE";
      line: number;
      homeHandicap: number;
      homePrice: number;
      awayPrice: number;
      predictionSupport: "STORED_NOT_USED_V0";
    }
  | {
      marketType: "DOMESTIC_THREE_WAY_SPECIAL";
      rawMarketCode: "승①패";
      homeWinPrice: number;
      drawPrice: number;
      awayWinPrice: number;
      predictionSupport: "NOT_IMPLEMENTED";
    }
  | {
      marketType: "UNSUPPORTED_OR_UNRESOLVED";
      rawMarketCode: string;
      prices: number[];
      line: number | null;
      predictionSupport: "EXCLUDED";
    }
  | {
      marketType: "FIRST_HALF_THREE_WAY";
      prices: [number, number, number];
      predictionSupport: "NOT_IMPLEMENTED";
    }
  | {
      marketType: "FIRST_HALF_RUN_LINE";
      homeHandicap: number;
      homePrice: number;
      awayPrice: number;
      predictionSupport: "NOT_IMPLEMENTED";
    }
  | {
      marketType: "FIRST_HALF_TOTALS";
      line: number;
      underPrice: number;
      overPrice: number;
      predictionSupport: "NOT_IMPLEMENTED";
    };

export type DomesticMarketGameRow = {
  gamePk: number;
  internalGameId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  commenceTimeUtc: string;
  startTimeKst: string;
  displayOrder: number;
  screenLeftTeam: string;
  screenRightTeam: string;
  screenLeftCanonical: string;
  screenRightCanonical: string;
  mappingMethod: string;
  cutoffStatus: "PASS" | "BLOCKED_AFTER_CUTOFF";
  capturedBeforeStart: boolean;
  rawMarkets: RawDomesticMarket[];
  normalizedMarkets: NormalizedDomesticMarket[];
};

export type UnresolvedDomesticRow = {
  reason: string;
  displayOrder: number;
  screenLeftTeam: string | null;
  screenRightTeam: string | null;
  screenStartKst: string | null;
  detail: string;
};

export type MlbDomesticMarketsDocument = {
  meta: DomesticSourceMeta & {
    schemaVersion: typeof MLB_DOMESTIC_MARKETS_SCHEMA;
    dateKst: string;
    scheduleArtifact: string;
    scheduleHash: string;
    rowsHash: string;
    marketCounts: Record<string, number>;
    unresolvedRows: number;
    cancelledExcluded: number;
    capturedBeforeStart: boolean;
    namespace: "DOMESTIC_OPERATOR_COMPARISON";
    doesNotReplaceOverseasPrior: true;
  };
  summary: {
    totalScheduleGames: number;
    mappedGames: number;
    unmappedScheduleGames: number;
    moneylineComplete: number;
    totalsComplete: number;
    runLineComplete: number;
    specialMarketsRawOnly: number;
  };
  games: DomesticMarketGameRow[];
  unresolved: UnresolvedDomesticRow[];
  unmappedSchedule: Array<{
    gamePk: number;
    homeTeam: string;
    awayTeam: string;
    startTimeKst: string;
    reason: string;
    status: "NOT_ENTERED";
  }>;
};
