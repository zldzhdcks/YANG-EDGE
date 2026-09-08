/**
 * Isolated Fresh Validation blind evaluation v0.
 *
 * Compares frozen machine OCR evidence to sealed Human truth.
 * Does not modify v3, machine generation, production OCR, or the parser.
 */

export const FRESH_VALIDATION_EVAL_SCHEMA_VERSION =
  "proto-round-fresh-validation-eval-v0" as const;
export const FRESH_HUMAN_TRUTH_FILE_NAME =
  "fresh-validation-human-truth-v0.json" as const;
export const FRESH_EVALUATION_FILE_NAME =
  "fresh-validation-evaluation-v0.json" as const;
export const FRESH_HUMAN_TRUTH_SCHEMA_VERSION =
  "proto-round-fresh-validation-human-truth-v0" as const;

export const FROZEN_MACHINE_FREEZE_COMMIT_SHA =
  "4aa33187bbb309608dc0806f4bcd5b1d8c2a08a2" as const;
export const FROZEN_FRESH_MACHINE_OUTPUT_SHA256 =
  "da6d05728b7dba9a6b5dad5e6e0cd707d10e4cbab6103bc7aa276a4699eacd54" as const;
export const FROZEN_FRESH_SELECTION_SHA256 =
  "5e158cedce0b59f871294ec8a7f51c63cccda49ff928fe53d98cb335535443d1" as const;
export const FROZEN_FRESH_VALIDATION_SEAL_SHA256 =
  "5c11acb6346ad90d695c8531882dd0eaa629db6cd0940a857bd42eaa848c6e46" as const;
export const FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256 =
  "d6ae3ae73e6aab4bd403307fa43111bec05c7d50269a7c53519c34fc5b35812e" as const;

export const FRESH_ANNOTATION_SCHEMA_VERSION =
  "proto-round-fresh-validation-annotation-v0" as const;
export const FRESH_PROTO_ROUND_KEY = "2026-105" as const;
export const GROUND_TRUTH_SOURCE = "ORIGINAL_SCREENSHOT_PIXELS_ONLY" as const;
export const SELECTED_ROW_COUNT = 10 as const;
export const PROTO_SCREENSHOT_AUTOMATION_FUNCTIONAL_MILESTONE =
  "99_PERCENT" as const;

export type FreshEvalRowKeyV0 = {
  sourceImageSha256: string;
  visualRowIndex: number;
};

export type FreshHumanAnnotationStatusV0 =
  | "UNANNOTATED"
  | "COMPLETE"
  | "UNCERTAIN"
  | "UNREADABLE";

export type FreshHumanRecordV0 = FreshEvalRowKeyV0 & {
  sourceFileName: string;
  annotationStatus: FreshHumanAnnotationStatusV0;
  screenRowIdentifierRaw: string | null;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
  marketMarkerRaw: string | null;
};

export type FreshHumanExportDocumentV0 = {
  schemaVersion: typeof FRESH_ANNOTATION_SCHEMA_VERSION;
  protoRoundKey: string;
  groundTruthSource: typeof GROUND_TRUTH_SOURCE;
  records: FreshHumanRecordV0[];
};

export type FreshHumanTruthDocumentV0 = {
  schemaVersion: typeof FRESH_HUMAN_TRUTH_SCHEMA_VERSION;
  protoRoundKey: string;
  groundTruthSource: typeof GROUND_TRUTH_SOURCE;
  sourceExportPath: string;
  records: FreshHumanRecordV0[];
};

export type FreshMachineEvalRowV0 = FreshEvalRowKeyV0 & {
  participantRawOcrEvidences: Array<{ text: string }>;
  numericRawOcrEvidences: string[];
  safeReconstructedNumericEvidences: string[];
  marketMarkerCandidateRaw: string | null;
};

export type FreshRowEvalV0 = FreshEvalRowKeyV0 & {
  annotationStatus: FreshHumanAnnotationStatusV0;
  readable: boolean;
  marketEvaluable: boolean;
  participantLeftExactEvidencePresent: boolean;
  participantRightExactEvidencePresent: boolean;
  participantPairExactEvidencePresent: boolean;
  numericTruthCellCount: number;
  numericRawExactCellCount: number;
  numericRawAllExact: boolean;
  safeReconstructedExactCellCount: number;
  safeReconstructedAllExact: boolean;
  numericSafeLayerAllExact: boolean;
  marketMarkerExact: boolean | null;
  participantPairAndNumericRawExact: boolean;
  participantPairAndNumericSafeExact: boolean;
  participantPairNumericSafeMarketExact: boolean | null;
};

export type FreshEvalTotalsV0 = {
  records: number;
  completeCount: number;
  uncertainCount: number;
  unreadableCount: number;
  unannotatedCount: number;
  participantRowsEvaluable: number;
  participantLeftExactEvidencePresent: number;
  participantRightExactEvidencePresent: number;
  participantPairExactEvidencePresent: number;
  participantExactSlotCount: number;
  participantEvaluableSlotCount: number;
  numericRowsEvaluable: number;
  numericRawExactCellCount: number;
  numericTruthCellCount: number;
  numericRawAllExactRowCount: number;
  safeReconstructedExactCellCount: number;
  safeReconstructedAllExactRowCount: number;
  marketMarkerEvaluableCount: number;
  marketMarkerExactCount: number;
  participantPairAndNumericRawExactRowCount: number;
  participantPairAndNumericSafeExactRowCount: number;
  participantPairNumericSafeMarketExactEvaluableCount: number;
  participantPairNumericSafeMarketExactCount: number;
};

export type FreshEvalDocumentV0 = {
  schemaVersion: typeof FRESH_VALIDATION_EVAL_SCHEMA_VERSION;
  protoRoundKey: string;
  parserUsed: false;
  holdoutRead: false;
  networkUsed: false;
  machineOutputChangedAfterHumanTruth: false;
  FRESH_MACHINE_OUTPUT_SHA256: string;
  FRESH_SELECTION_SHA256: string;
  FRESH_HUMAN_TRUTH_SHA256: string;
  PARTICIPANT_OCR_V3_RESULT_SHA256: string;
  totals: FreshEvalTotalsV0;
  FRESH_PARTICIPANT_GENERALIZATION: "YES" | "NO";
  FRESH_NUMERIC_RAW_GENERALIZATION: "YES" | "NO";
  FRESH_NUMERIC_SAFE_GENERALIZATION: "YES" | "NO";
  PROTO_SCREENSHOT_AUTOMATION_FUNCTIONAL_MILESTONE: typeof PROTO_SCREENSHOT_AUTOMATION_FUNCTIONAL_MILESTONE;
  rows: FreshRowEvalV0[];
};
