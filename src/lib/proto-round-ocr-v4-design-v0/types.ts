/**
 * Isolated OCR v4 development design freeze.
 *
 * Pre-registers development corpus, frozen v3 baseline scoring,
 * morphology taxonomy, and v4 candidates. Does not run the v4 experiment.
 * Does not open Validation-2, Fresh truth, Formal Holdout, or Round 106 pixels.
 */

export const OCR_V4_DESIGN_SCHEMA_VERSION =
  "proto-round-ocr-v4-design-v0" as const;
export const OCR_V4_LOCAL_DIR_NAME = "ocr-v4" as const;
export const DEVELOPMENT_CORPUS_FILE_NAME = "development-corpus-v0.json" as const;
export const DEVELOPMENT_BASELINE_FILE_NAME =
  "development-baseline-v0.json" as const;
export const ERROR_MORPHOLOGY_FILE_NAME = "ocr-error-morphology-v0.json" as const;

export const OCR_V4_PROTO_ROUND_KEY = "2026-105" as const;
export const PILOT10_COUNT = 10 as const;
export const DISCOVERY2_COUNT = 10 as const;
export const DEVELOPMENT_CORPUS_COUNT = 20 as const;
export const MAXIMUM_V4_CANDIDATES = 6 as const;

export const FROZEN_WINNER_CANDIDATE =
  "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION" as const;
export const FROZEN_OCR_INTERPOLATION = "Linear" as const;
export const FROZEN_OCR_LANGUAGE = "ko" as const;

export const FROZEN_OCR_RESEARCH_EXPANSION_SPLIT_SHA256 =
  "64367fb348124df4ba6ca64621ab6c2da88bae0839517afaef54ae79b1f7bdd8" as const;
export const FROZEN_DISCOVERY2_HUMAN_TRUTH_SHA256 =
  "4fdec8065bd5e8a9ef2184b49b3cdfd77b75a3dbea6bd6836cff530c8ed7a667" as const;
export const FROZEN_PILOT10_DISCOVERY_ANNOTATION_SHA256 =
  "741d86dfb11ee34349ac18061bce223f418837aca20150acf6b1ef808f6c0f4d" as const;
export const FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256 =
  "d6ae3ae73e6aab4bd403307fa43111bec05c7d50269a7c53519c34fc5b35812e" as const;
export const FROZEN_NEW_DAILY_ODDS_INTAKE_SEAL_SHA256 =
  "d0ebb3d2bae7ad352177afb1386deb6a44edf3305a60f197c3875a64c3ad1983" as const;

export const DATASET_ROLE = {
  Pilot10: "DEVELOPMENT",
  Discovery2: "DEVELOPMENT",
  Validation2: "UNSEEN_VALIDATION",
  FreshValidation: "HISTORICAL_BLIND_VALIDATION",
  FormalHoldout: "SEALED_FINAL_RESEARCH_HOLDOUT",
  Round106NewScreenshots: "OPERATIONAL_EVIDENCE_ONLY",
} as const;

export const FRESH_VALIDATION_NOT_FOR_V4_RULE_DESIGN = true as const;

export type OcrV4RowKeyV0 = {
  sourceImageSha256: string;
  visualRowIndex: number;
};

export type OcrV4SubsetNameV0 = "PILOT10" | "DISCOVERY2";

export type ParticipantFailureFamilyV0 =
  | "NO_TEXT_DETECTED"
  | "WRONG_CHARACTER_SUBSTITUTION"
  | "MULTI_CHARACTER_CORRUPTION"
  | "LATIN_KOREAN_CONFUSION"
  | "PREFIX_LOSS"
  | "SUFFIX_LOSS"
  | "SPACING_ERROR"
  | "FRAGMENTED_TEXT"
  | "REGION_MISLOCALIZATION"
  | "ROW_CONTEXT_INTERFERENCE"
  | "OTHER";

export type NumericFailureFamilyV0 =
  | "DECIMAL_TO_SPACE"
  | "DECIMAL_TO_HYPHEN"
  | "DECIMAL_DROPPED"
  | "DIGIT_SUBSTITUTION"
  | "TRAILING_PUNCTUATION"
  | "MERGED_DIGITS"
  | "FRAGMENTED_DIGITS"
  | "REGION_MISLOCALIZATION"
  | "EXTRA_NUMERIC_NOISE"
  | "OTHER";

export type OcrV4InterpolationV0 = "Linear" | "NearestNeighbor";

export type OcrV4CandidateNameV0 =
  | "LEFT_RIGHT_HALF_ROW_BANDS_UPSCALE_4X_LINEAR_KO"
  | "MULTI_SCALE_ROW_CROP_3X_5X_LINEAR_KO"
  | "ROW_NEAREST_NEIGHBOR_UPSCALE_4X_KO"
  | "TEXT_REGION_LEFT_RIGHT_BY_CENTER_X_UPSCALE_5X_LINEAR_KO"
  | "ROW_PLUS_LEFT_RIGHT_BANDS_EVIDENCE_UNION"
  | "CONTRAST_NORMALIZE_ROW_UPSCALE_4X_LINEAR_KO";

export const OCR_V4_CANDIDATES = [
  "LEFT_RIGHT_HALF_ROW_BANDS_UPSCALE_4X_LINEAR_KO",
  "MULTI_SCALE_ROW_CROP_3X_5X_LINEAR_KO",
  "ROW_NEAREST_NEIGHBOR_UPSCALE_4X_KO",
  "TEXT_REGION_LEFT_RIGHT_BY_CENTER_X_UPSCALE_5X_LINEAR_KO",
  "ROW_PLUS_LEFT_RIGHT_BANDS_EVIDENCE_UNION",
  "CONTRAST_NORMALIZE_ROW_UPSCALE_4X_LINEAR_KO",
] as const satisfies readonly OcrV4CandidateNameV0[];

export const CANDIDATE_SIMPLICITY_RANK_V4: Record<OcrV4CandidateNameV0, number> = {
  LEFT_RIGHT_HALF_ROW_BANDS_UPSCALE_4X_LINEAR_KO: 0,
  MULTI_SCALE_ROW_CROP_3X_5X_LINEAR_KO: 1,
  ROW_NEAREST_NEIGHBOR_UPSCALE_4X_KO: 2,
  TEXT_REGION_LEFT_RIGHT_BY_CENTER_X_UPSCALE_5X_LINEAR_KO: 3,
  ROW_PLUS_LEFT_RIGHT_BANDS_EVIDENCE_UNION: 4,
  CONTRAST_NORMALIZE_ROW_UPSCALE_4X_LINEAR_KO: 5,
};

export const WINNER_RULE_ORDER_V4 = [
  "participantPairExactEvidencePresent",
  "participantExactSlotCount",
  "numericRawAllExactRowCount",
  "numericRawExactCellCount",
  "simplerPreprocessing",
] as const;

export type OcrV4CandidateDefinitionV0 = {
  name: OcrV4CandidateNameV0;
  cropRule: string;
  scale: string;
  interpolation: OcrV4InterpolationV0;
  preprocessing: string;
  language: "ko";
  evidenceUnionRule: string;
};

export type OcrV4SuccessLevelV0 =
  | "V4_LEVEL_0"
  | "V4_LEVEL_1"
  | "V4_LEVEL_2"
  | "V4_LEVEL_3";

export type DevelopmentSubsetMetricsV0 = {
  rows: number;
  participantLeftExact: number;
  participantRightExact: number;
  participantPairExact: number;
  participantSlotsExact: number;
  participantSlotTotal: number;
  numericRawExactCells: number;
  numericRawTruthCells: number;
  numericRawAllExactRows: number;
  numericSafeExactCells: number;
  numericSafeAllExactRows: number;
};

export type DevelopmentCorpusDocumentV0 = {
  schemaVersion: typeof OCR_V4_DESIGN_SCHEMA_VERSION;
  protoRoundKey: typeof OCR_V4_PROTO_ROUND_KEY;
  roles: typeof DATASET_ROLE;
  FRESH_VALIDATION_NOT_FOR_V4_RULE_DESIGN: true;
  ROUND_106_USED_FOR_V4_DESIGN: false;
  VALIDATION_2_READ: false;
  FORMAL_HOLDOUT_READ: false;
  pilot10Count: typeof PILOT10_COUNT;
  discovery2Count: typeof DISCOVERY2_COUNT;
  total: typeof DEVELOPMENT_CORPUS_COUNT;
  duplicates: 0;
  missing: 0;
  overlapValidation2: 0;
  overlapFormalHoldout: 0;
  LEFT_RIGHT_HALF_ROW_SPLIT_DETERMINISTIC: true;
  pilot10: OcrV4RowKeyV0[];
  discovery2: OcrV4RowKeyV0[];
};
