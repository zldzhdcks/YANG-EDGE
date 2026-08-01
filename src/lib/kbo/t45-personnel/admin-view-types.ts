/**
 * Shared view/API types for KBO T45 Admin UI (safe for client imports).
 */
import type {
  GameValidationResult,
  KboT45GameInput,
  KboT45PersonnelInputV1,
  PersonnelCompleteness,
  PersonnelWorkflowStatus,
  PredictionUsability,
  T45WorkflowResult,
} from "./types";

export type ValidationView = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type KboT45GameAdminView = {
  gameId: string;
  scheduledStartTime: string;
  homeTeam: string;
  awayTeam: string;
  currentStatus: PersonnelWorkflowStatus | string;
  completeness: PersonnelCompleteness | "NOT_ENTERED" | "NOT_APPLICABLE";
  predictionUsability: PredictionUsability | "UNUSABLE";
  locked: boolean;
  afterCutoff: boolean;
  readOnly: boolean;
  secondsUntilStart: number | null;
  windowLabel:
    | "OPEN"
    | "T45_WINDOW"
    | "T30_WINDOW"
    | "LOCK_WINDOW"
    | "AFTER_CUTOFF"
    | "ALREADY_LOCKED";
  starterValidation: ValidationView;
  lineupValidation: ValidationView;
  protoValidation: ValidationView;
  version: number | null;
  warnings: string[];
  errors: string[];
  draft: KboT45GameInput | null;
};

export type KboT45AdminLoadResult = {
  ok: boolean;
  dateKst: string;
  nowIso: string;
  nowKstHint: string;
  scheduleExists: boolean;
  inputExists: boolean;
  inputPathRel: string;
  personnelHash: string | null;
  domesticProtoHash: string | null;
  snapshotVersion: number | null;
  predictionLocked: boolean;
  historicalReadOnly: boolean;
  authNote: string;
  legalNotice: string[];
  games: KboT45GameAdminView[];
  existingInput: KboT45PersonnelInputV1 | null;
  errorCode?: string;
  message?: string;
};

export type KboT45ValidateApiResult = {
  status: "VALID" | "PARTIAL" | "INVALID" | "BLOCKED";
  dateKst: string;
  globalErrors: string[];
  games: GameValidationResult[];
  wouldCreateArtifacts: string[];
  mutationPerformed: false;
  personnelHashPreview: string | null;
};

export type KboT45SaveApiResult = {
  ok: boolean;
  dateKst: string;
  pathRel: string | null;
  previousHash: string | null;
  nextHash: string | null;
  version: number;
  validation: KboT45ValidateApiResult;
  message: string;
  errorCode?: string;
  mutationPerformed: boolean;
};

export type KboT45RunApiResult = {
  ok: boolean;
  dryRun: boolean;
  dateKst: string;
  result: T45WorkflowResult | null;
  message: string;
  errorCode?: string;
  t30AutoRun: false;
};
