/**
 * Isolated OCR research expansion v1.
 *
 * Pre-registers Discovery-2 / Validation-2 from frozen Discovery rows 11–30.
 * Does not annotate Validation-2. Does not mutate Pilot10. Does not open Holdout.
 */

export const OCR_RESEARCH_EXPANSION_SCHEMA_VERSION =
  "proto-round-ocr-research-expansion-v1" as const;
export const OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME =
  "ocr-research-expansion-v1" as const;
export const SPLIT_SEAL_FILE_NAME = "split-seal-v1.json" as const;
export const DISCOVERY2_ANNOTATION_FILE_NAME =
  "discovery2-annotation-v1.json" as const;
export const DISCOVERY2_ANNOTATION_HTML_FILE_NAME =
  "discovery2-annotation.html" as const;
export const DISCOVERY2_HUMAN_TRUTH_FILE_NAME =
  "discovery2-human-truth-v1.json" as const;
export const DISCOVERY2_HUMAN_TRUTH_SCHEMA_VERSION =
  "proto-round-ocr-research-expansion-discovery2-human-truth-v1" as const;

export const FROZEN_OCR_RESEARCH_EXPANSION_SPLIT_SHA256 =
  "64367fb348124df4ba6ca64621ab6c2da88bae0839517afaef54ae79b1f7bdd8" as const;
export const FROZEN_PILOT10_DISCOVERY_ANNOTATION_SHA256 =
  "741d86dfb11ee34349ac18061bce223f418837aca20150acf6b1ef808f6c0f4d" as const;
export const DISCOVERY2_PROTO_ROUND_KEY = "2026-105" as const;

export const SPLIT_SALT = "proto-ocr-research-expansion-v1" as const;
export const SPLIT_ALGORITHM =
  "SHA256_SALT_CONCAT_SOURCE_SHA_PIPE_VISUAL_ROW_INDEX_SORT_ASC; FIRST_10_DISCOVERY2; NEXT_10_VALIDATION2" as const;

export const PILOT10_COUNT = 10 as const;
export const DISCOVERY_TOTAL = 30 as const;
export const SOURCE_POOL_COUNT = 20 as const;
export const DISCOVERY2_COUNT = 10 as const;
export const VALIDATION2_COUNT = 10 as const;

export const GROUND_TRUTH_SOURCE = "ORIGINAL_SCREENSHOT_PIXELS_ONLY" as const;
export const DISCOVERY2_ANNOTATION_SCHEMA_VERSION =
  "proto-round-ocr-research-expansion-discovery2-v1" as const;

export type ExpansionRowKeyV1 = {
  sourceImageSha256: string;
  visualRowIndex: number;
};

export type ExpansionEligibleRowV1 = ExpansionRowKeyV1 & {
  sourceFileName: string;
  topY: number;
  bottomY: number;
  centerY: number;
  imageWidth: number;
  imageHeight: number;
  screenshotRelativePath: string;
};

export type ExpansionSplitV1 = {
  sourcePoolCount: number;
  discovery2Count: number;
  validation2Count: number;
  discovery2RowKeys: ExpansionRowKeyV1[];
  validation2RowKeys: ExpansionRowKeyV1[];
};

export type ExpansionSplitSealV1 = {
  schemaVersion: typeof OCR_RESEARCH_EXPANSION_SCHEMA_VERSION;
  protoRoundKey: string;
  sourcePoolCount: typeof SOURCE_POOL_COUNT;
  splitAlgorithm: typeof SPLIT_ALGORITHM;
  splitSalt: typeof SPLIT_SALT;
  discovery2Count: typeof DISCOVERY2_COUNT;
  validation2Count: typeof VALIDATION2_COUNT;
  SPLIT_MUTABLE: false;
  VALIDATION_2_VISUAL_RENDERED: false;
  VALIDATION_2_HUMAN_ANNOTATED: false;
  VALIDATION_2_USED_FOR_RULE_DESIGN: false;
  PILOT10_MUTATED: false;
  discovery2RowKeys: ExpansionRowKeyV1[];
  validation2RowKeyHashes: string[];
};

export type Discovery2AnnotationStatusV1 =
  | "UNANNOTATED"
  | "COMPLETE"
  | "UNCERTAIN"
  | "UNREADABLE";

export type Discovery2AnnotationRecordV1 = ExpansionEligibleRowV1 & {
  targetRowGeometry: {
    topY: number;
    bottomY: number;
    centerY: number;
    imageWidth: number;
    imageHeight: number;
  };
  annotationStatus: Discovery2AnnotationStatusV1;
  screenRowIdentifierRaw: string | null;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
  marketMarkerRaw: string | null;
};

export type Discovery2HumanRecordV1 = ExpansionRowKeyV1 & {
  sourceFileName: string;
  annotationStatus: Discovery2AnnotationStatusV1;
  screenRowIdentifierRaw: string | null;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
  marketMarkerRaw: string | null;
};

export type Discovery2HumanExportDocumentV1 = {
  schemaVersion: typeof DISCOVERY2_ANNOTATION_SCHEMA_VERSION;
  protoRoundKey: string;
  groundTruthSource: typeof GROUND_TRUTH_SOURCE;
  records: Discovery2HumanRecordV1[];
};

export type Discovery2IdentityJoinV1 = {
  missing: number;
  extra: number;
  duplicates: number;
  identityMutated: "NO";
};

export type Discovery2HumanStatusCountsV1 = {
  records: number;
  COMPLETE: number;
  UNCERTAIN: number;
  UNREADABLE: number;
  UNANNOTATED: number;
};

export type Discovery2HumanTruthDocumentV1 = {
  schemaVersion: typeof DISCOVERY2_HUMAN_TRUTH_SCHEMA_VERSION;
  protoRoundKey: string;
  groundTruthSource: typeof GROUND_TRUTH_SOURCE;
  sourceExportPath: string;
  identityJoin: Discovery2IdentityJoinV1;
  VALIDATION_2_RENDERED: false;
  VALIDATION_2_ANNOTATED: false;
  VALIDATION_2_HUMAN_TRUTH_EXISTS: false;
  VALIDATION_2_USED_FOR_RULE_DESIGN: false;
  PILOT10_MUTATED: false;
  USED_FOR_OCR_RULE_DESIGN: false;
  records: Discovery2HumanRecordV1[];
};
