export const KBO_STARTER_OPERATOR_INPUT_SCHEMA_VERSION =
  "kbo-starter-confirmation-v1";

export type KboStarterOperatorReviewStatus = "DRAFT" | "VERIFIED" | "REJECTED";

export type KboStarterOperatorInputStatus =
  | "NOT_ENTERED"
  | "DRAFT"
  | "PARTIALLY_VERIFIED"
  | "VERIFIED_FOR_RESEARCH_INPUT"
  | "BLOCKED";

export type KboStarterOperatorSourceType = "OPERATOR_VERIFIED";

export type KboStarterSourceReferenceType =
  | "OFFICIAL_ANNOUNCEMENT"
  | "LICENSED_PROVIDER"
  | "OPERATOR_CONFIRMED"
  | "MEDIA_SECONDARY"
  | "UNKNOWN";

export type KboStarterStatus =
  | "CONFIRMED"
  | "PROBABLE"
  | "OPERATOR_VERIFIED"
  | "NOT_ANNOUNCED"
  | "CHANGED"
  | "UNKNOWN";

export type KboStarterThrowingHand = "R" | "L" | "UNKNOWN";

export type KboStarterPlayerMappingStatus =
  | "MATCHED"
  | "NAME_ONLY"
  | "UNMATCHED"
  | "AMBIGUOUS";

export type KboStarterGameMappingStatus =
  | "MATCHED"
  | "UNMATCHED"
  | "AMBIGUOUS"
  | "IDENTITY_PROVIDER_GAME_MISSING";

export type KboStarterSourceReference = {
  sourceType: KboStarterSourceReferenceType;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  capturedBy: string | null;
  capturedAt: string | null;
  notes: string | null;
};

export type KboStarterSideInput = {
  playerId: string | null;
  playerName: string | null;
  throwingHand: KboStarterThrowingHand | null;
  starterStatus: KboStarterStatus;
  sourceType: KboStarterSourceReferenceType | null;
  sourceReference: KboStarterSourceReference | null;
  announcedAt: string | null;
  capturedAt: string | null;
  mappingStatus: KboStarterPlayerMappingStatus;
  notes: string | null;
};

export type KboStarterGameInput = {
  operatorStarterInputId: string;
  internalGameId: string;
  providerGameId: string;
  awayTeam: string;
  homeTeam: string;
  scheduledStartTimeKst: string;
  awayStarter: KboStarterSideInput;
  homeStarter: KboStarterSideInput;
  capturedAt: string | null;
  enteredAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewStatus: KboStarterOperatorReviewStatus;
  sourceReference: KboStarterSourceReference | null;
  mappingStatus: KboStarterGameMappingStatus;
  warnings: string[];
  blockingReasons: string[];
};

export type KboStarterOperatorInputV1 = {
  schemaVersion: typeof KBO_STARTER_OPERATOR_INPUT_SCHEMA_VERSION;
  targetDateKst: string;
  sourceType: KboStarterOperatorSourceType;
  reviewStatus: KboStarterOperatorReviewStatus;
  createdAt: string;
  updatedAt: string;
  games: KboStarterGameInput[];
};

export type KboStarterOperatorInputAuditV1 = {
  meta: {
    version: "kbo-starter-operator-input-v1";
    generatedAt: string;
    conclusion: string;
  };
  targetDateKst: string;
  identityProvider: string | null;
  identityGames: number;
  inputGames: number;
  matchedGames: number;
  unmatchedGames: number;
  ambiguousGames: number;
  awayStartersEntered: number;
  homeStartersEntered: number;
  confirmedStarters: number;
  probableStarters: number;
  verifiedGames: number;
  draftGames: number;
  rejectedGames: number;
  cutoffViolations: number;
  sourceReferenceMissing: number;
  inputStatus: KboStarterOperatorInputStatus;
  stableInputHashSha256: string | null;
  blockingReasons: string[];
  warnings: string[];
  missing: string[];
  predictionReadiness: "NOT_IMPLEMENTED";
  engineImpact: 0;
  noIdentityGamesAvailable?: boolean;
};
