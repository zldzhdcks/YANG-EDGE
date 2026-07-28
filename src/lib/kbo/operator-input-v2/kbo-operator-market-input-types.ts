export type KboOperatorMarketMappingStatus =
  | "NOT_CHECKED"
  | "MATCHED"
  | "UNMATCHED"
  | "AMBIGUOUS";

export type KboOperatorMarketReviewStatus = "DRAFT" | "VERIFIED" | "REJECTED";

export type KboOperatorInputMethod = "MANUAL" | "OCR_REVIEWED";

export type KboSelectionCode =
  | "HOME"
  | "DRAW"
  | "AWAY"
  | "HOME_COVER"
  | "AWAY_COVER"
  | "UNDER"
  | "OVER"
  | "ODD"
  | "EVEN";

export type KboOperatorMarketType =
  | "MONEYLINE_2WAY"
  | "MONEYLINE_3WAY"
  | "HANDICAP_2WAY"
  | "TOTAL"
  | "SUM_PARITY"
  | "FIRST_HALF_MONEYLINE_3WAY"
  | "FIRST_HALF_HANDICAP_2WAY"
  | "FIRST_HALF_TOTAL"
  | "OTHER";

export type KboOperatorPeriod = "FULL_GAME" | "FIRST_HALF";

export type KboOperatorSelectionInput = {
  selectionCode: KboSelectionCode;
  selectionLabel: string;
  odds: number;
  reviewStatus: KboOperatorMarketReviewStatus;
};

export type KboOperatorMarketInput = {
  operatorMarketId: string;
  marketType: KboOperatorMarketType;
  period: KboOperatorPeriod;
  line: number | null;
  displayLabel: string;
  reviewStatus: KboOperatorMarketReviewStatus;
  selections: KboOperatorSelectionInput[];
  notes?: string;
};

export type KboOperatorGameMarketInput = {
  operatorGameId: string;
  internalGameId: string | null;
  providerGameId: string | null;
  homeTeamText: string;
  awayTeamText: string;
  canonicalHomeTeamId: string | null;
  canonicalAwayTeamId: string | null;
  startTimeKst: string;
  mappingStatus: KboOperatorMarketMappingStatus;
  reviewStatus: KboOperatorMarketReviewStatus;
  blockingReasons: string[];
  markets: KboOperatorMarketInput[];
  notes?: string;
};

export type KboOperatorMarketInputV2 = {
  dateKst: string;
  round: string;
  capturedAt: string;
  enteredAt: string;
  enteredBy: string;
  sourceLabel: string;
  inputMethod: KboOperatorInputMethod;
  reviewStatus: KboOperatorMarketReviewStatus;
  games: KboOperatorGameMarketInput[];
  metadata: {
    sourceType: "SCREENSHOT_TRANSCRIPTION";
    screenshotCount: number | null;
    notes?: string;
  };
};

export type KboOperatorMarketInputStatus =
  | "DRAFT"
  | "PARTIALLY_MAPPED"
  | "READY_FOR_OPERATOR_REVIEW"
  | "VERIFIED_FOR_RESEARCH_INPUT";
