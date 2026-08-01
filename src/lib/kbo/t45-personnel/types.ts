/**
 * KBO T45 Personnel Workflow — shared types.
 * Admin Verified ≠ official provider data ≠ Engine admission.
 */

export type PersonnelWorkflowStatus =
  | "NOT_AVAILABLE"
  | "PROJECTED"
  | "DRAFT"
  | "ADMIN_VERIFIED"
  | "PROVIDER_CONFIRMED"
  | "LOCKED"
  | "VOID";

export type PersonnelCompleteness = "COMPLETE" | "PARTIAL" | "INSUFFICIENT";

export type PredictionUsability = "ELIGIBLE" | "WARNING_ONLY" | "UNUSABLE";

export type AdminSourceType =
  | "ADMIN_MANUAL_SCREENSHOT"
  | "ADMIN_MANUAL_TEXT"
  | "OFFICIAL_PUBLIC_SOURCE_MANUAL_CHECK"
  | "LICENSED_PROVIDER"
  | "INTERNAL_PROJECTION";

export type ConfirmationMethod =
  | "ADMIN_VERIFIED"
  | "PROVIDER_CONFIRMED"
  | "NONE";

export type CommercialUseStatus = "INTERNAL_ONLY" | "ALLOWED" | "UNKNOWN";

export type KboT45PersonnelInputV1 = {
  schemaVersion: "kbo-t45-personnel-input-v1";
  league: "KBO";
  dateKst: string;
  createdAt: string;
  createdBy: string;
  sourceType?: AdminSourceType;
  sourceReference?: string;
  commercialUseStatus?: CommercialUseStatus;
  games: KboT45GameInput[];
};

export type KboT45GameInput = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  scheduledStartTime: string;
  observedAt: string;
  sourceType?: AdminSourceType;
  sourceReference?: string;
  home: KboT45SideInput;
  away: KboT45SideInput;
  domesticProto?: KboT45ProtoInput | null;
};

export type KboT45SideInput = {
  starter?: KboT45StarterInput | null;
  lineup?: KboT45LineupBatterInput[] | null;
};

export type KboT45StarterInput = {
  playerId?: string | null;
  temporaryPlayerKey?: string | null;
  playerName: string;
  throwingHand: "L" | "R" | "S" | null;
};

export type KboT45LineupBatterInput = {
  slot: number;
  playerId?: string | null;
  temporaryPlayerKey?: string | null;
  playerName: string;
  position: string;
  bats?: "L" | "R" | "S" | null;
  designatedHitter?: boolean;
};

export type KboT45ProtoInput = {
  homePrice: number;
  awayPrice: number;
  format?: "DECIMAL";
  marketType?: "MONEYLINE_2WAY";
  /** Additive OCR assist metadata — not a confirmation status. */
  extractionMethod?: "OCR_ASSISTED" | "MANUAL";
  ocrRunId?: string;
  parserVersion?: string;
  correctedByAdmin?: boolean;
  observedAt?: string;
  originalCandidateHash?: string;
  approvedContentHash?: string;
};

export type GameValidationResult = {
  gameId: string;
  status:
    | PersonnelWorkflowStatus
    | "FAILED"
    | "AFTER_CUTOFF"
    | "ALREADY_LOCKED"
    | "BLOCKED_AFTER_START";
  completeness: PersonnelCompleteness;
  predictionUsability: PredictionUsability;
  starterOk: boolean;
  lineupOk: boolean;
  lineupPartial: boolean;
  protoOk: boolean;
  batterCount: number;
  errors: string[];
  warnings: string[];
};

export type T45WorkflowResult = {
  schemaVersion: "kbo-t45-personnel-workflow-result-v1";
  dryRun: boolean;
  validateOnly: boolean;
  dateKst: string;
  runId: string;
  priorSnapshotRunId: string | null;
  globalBlocker: string | null;
  games: GameValidationResult[];
  wouldCreateArtifacts: string[];
  wouldUpdateT30Inputs: boolean;
  writesSkipped: boolean;
  providerCalls: number;
  writtenArtifacts: string[];
  auditPath: string | null;
  personnelHash: string | null;
  domesticProtoHash: string | null;
};
