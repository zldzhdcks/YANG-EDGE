/**
 * Pilot10 evaluation + read-only diagnosis for frozen first-shot extraction.
 * Does not import or modify the parser implementation.
 */

export const PILOT_COUNT = 10 as const;

export const EVAL_SCOPE = "DISCOVERY_PILOT10_ONLY" as const;
export const HOLDOUT_VISUAL_CONTENT_READ = false as const;
export const HOLDOUT_UNAVAILABLE_TO_EVALUATOR = true as const;
export const FLOAT_NORMALIZATION = "DISABLED" as const;
export const PARSER_TUNING_FROM_EVAL = false as const;

export type FrozenIdentityV0 = {
  sourceImageSha256: string;
  visualRowIndex: number;
};

export type PilotSelectionSourceV0 = {
  discoveryRowKeys: FrozenIdentityV0[];
};

export type PilotTruthRecordV0 = FrozenIdentityV0 & {
  annotationStatus?: string;
  screenRowIdentifierRaw: string | null;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
  marketMarkerRaw: string | null;
};

export type PilotMachineRecordV0 = FrozenIdentityV0 & {
  screenRowIdentifierCandidateRaw: string | null;
  participantLeftCandidateRaw: string | null;
  participantRightCandidateRaw: string | null;
  numericCellsCandidateRaw: string[];
  marketMarkerCandidateRaw: string | null;
  participantParsingStatus?: string;
  numericCellsParsingStatus?: string;
};

export type FailureCauseV0 =
  | "OCR_TEXT_MISMATCH"
  | "OCR_FRAGMENTATION"
  | "REGION_GROUPING_ERROR"
  | "PARSER_REGION_SELECTION_ERROR"
  | "PARSER_ORDERING_ERROR"
  | "MISSING_MACHINE_EVIDENCE"
  | "OTHER";

export type FirstDivergenceStageV0 =
  | "RAW_OCR"
  | "VISUAL_ROW"
  | "SEMANTIC_REGION"
  | "STRUCTURED_PARSER"
  | "MIXED";

export type PilotRowEvalV0 = {
  pilotIndex: number;
  sourceImageSha256: string;
  visualRowIndex: number;
  annotationStatus: string | null;
  idExact: boolean;
  leftExact: boolean;
  rightExact: boolean;
  numsExact: boolean;
  primaryFourExact: boolean;
  marketEvaluable: boolean;
  marketExact: boolean | null;
};

export type Pilot10EvalResultV0 = {
  holdoutVisualContentRead: typeof HOLDOUT_VISUAL_CONTENT_READ;
  pilotRows: typeof PILOT_COUNT;
  rowIdentifierExactCount: number;
  participantLeftExactCount: number;
  participantRightExactCount: number;
  numericCellsExactCount: number;
  primaryFourExactRowCount: number;
  marketMarkerEvaluableCount: number;
  marketMarkerExactCount: number;
  fullStructureEvaluableCount: number;
  fullStructureExactCount: number;
  rows: PilotRowEvalV0[];
};
