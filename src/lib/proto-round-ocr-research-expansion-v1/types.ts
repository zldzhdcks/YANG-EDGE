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

export type Discovery2AnnotationRecordV1 = ExpansionEligibleRowV1 & {
  targetRowGeometry: {
    topY: number;
    bottomY: number;
    centerY: number;
    imageWidth: number;
    imageHeight: number;
  };
  annotationStatus: "UNANNOTATED" | "COMPLETE" | "UNCERTAIN" | "UNREADABLE";
  screenRowIdentifierRaw: string | null;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
  marketMarkerRaw: string | null;
};
