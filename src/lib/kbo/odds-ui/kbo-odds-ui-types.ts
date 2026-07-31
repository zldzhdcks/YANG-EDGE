export type KboOddsUiAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "MISSING"
  | "INVALID";

export type KboOddsUiNamespace = "DOMESTIC_PROTO" | "OVERSEAS_MARKET";

export type KboOddsUiMarket = {
  availability: KboOddsUiAvailability;
  namespace: KboOddsUiNamespace;
  sourceLabel: string;
  sourceType: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homePrice: number | null;
  awayPrice: number | null;
  capturedAt: string | null;
  statusReason: string | null;
  warnings: string[];
  providerName: string | null;
  commercialUseStatus: string | null;
  format: "DECIMAL" | null;
};

export type KboOddsComparisonViewModel = {
  gameId: string;
  dateKst: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  scheduledStartTime: string | null;
  domestic: KboOddsUiMarket;
  overseas: KboOddsUiMarket;
  pathRel: {
    domestic: string | null;
    overseas: string | null;
  };
  mappingReason: string | null;
};
