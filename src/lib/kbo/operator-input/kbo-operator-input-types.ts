export type KboOperatorMappingStatus =
  | "NOT_CHECKED"
  | "MATCHED"
  | "UNMATCHED"
  | "AMBIGUOUS";

export type KboOperatorReviewStatus = "DRAFT" | "VERIFIED" | "REJECTED";

export type KboOperatorMarketType =
  | "MONEYLINE"
  | "HANDICAP"
  | "TOTAL"
  | "OTHER";

export type KboOperatorInputMethod = "MANUAL" | "OCR_REVIEWED";

export type KboBetmanScopeGameInput = {
  operatorGameId: string;
  homeTeamText: string;
  awayTeamText: string;
  startTimeKst: string;
  marketTypes: KboOperatorMarketType[];
  matchedInternalGameId: string | null;
  mappingStatus: KboOperatorMappingStatus;
  reviewStatus: KboOperatorReviewStatus;
  notes?: string;
};

export type KboBetmanScopeInput = {
  dateKst: string;
  round: string;
  enteredAt: string;
  enteredBy: string;
  sourceLabel: string;
  games: KboBetmanScopeGameInput[];
};

export type KboProtoOddsGameInput = {
  operatorGameId: string;
  matchedInternalGameId: string | null;
  marketType: KboOperatorMarketType;
  selection: string;
  odds: number;
  mappingStatus: KboOperatorMappingStatus;
  reviewStatus: KboOperatorReviewStatus;
  notes?: string;
};

export type KboProtoOddsInput = {
  dateKst: string;
  round: string;
  capturedAt: string;
  enteredAt: string;
  enteredBy: string;
  sourceLabel: string;
  inputMethod: KboOperatorInputMethod;
  reviewStatus: KboOperatorReviewStatus;
  games: KboProtoOddsGameInput[];
};

export type KboOperatorGameMapping = {
  operatorGameId: string;
  matchedInternalGameId: string | null;
  mappingStatus: KboOperatorMappingStatus;
  blockingReason: string | null;
};

export type KboOperatorInputReadyStatus =
  | "NOT_ENTERED"
  | "DRAFT"
  | "PARTIALLY_MAPPED"
  | "READY_FOR_OPERATOR_REVIEW"
  | "VERIFIED_FOR_RESEARCH_INPUT";

export type KboOperatorInputValidation = {
  targetDateKst: string;
  betmanScopeFile: string;
  protoOddsFile: string;
  scopeGamesEntered: number;
  scopeGamesVerified: number;
  scopeGamesMatched: number;
  scopeGamesUnmatched: number;
  scopeGamesAmbiguous: number;
  oddsRowsEntered: number;
  oddsRowsVerified: number;
  oddsRowsRejected: number;
  oddsGamesMatched: number;
  duplicateRows: string[];
  invalidOdds: Array<{ operatorGameId: string; marketType: string; value: unknown }>;
  identityGamesAvailable: number;
  operatorOnlyGames: string[];
  blockingReasons: string[];
  inputReadyStatus: KboOperatorInputReadyStatus;
  mappings: KboOperatorGameMapping[];
  generatedAt: string;
};
