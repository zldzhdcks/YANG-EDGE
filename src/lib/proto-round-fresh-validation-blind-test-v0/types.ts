/**
 * Isolated Fresh Validation blind test v0.
 *
 * Machine pass first. Human Ground Truth is not opened here.
 * Does not modify frozen v3, production OCR, or the parser.
 * Does not read Holdout.
 */

export const FRESH_VALIDATION_BLIND_TEST_SCHEMA_VERSION =
  "proto-round-fresh-validation-blind-test-v0" as const;
export const FRESH_VALIDATION_LOCAL_DIR_NAME = "fresh-validation-v0" as const;
export const FRESH_MACHINE_OUTPUT_FILE_NAME =
  "fresh-validation-machine-output-v0.json" as const;
export const FRESH_SELECTION_FILE_NAME =
  "fresh-validation-selection-v0.json" as const;
export const FRESH_ANNOTATION_HTML_FILE_NAME =
  "fresh-validation-annotation.html" as const;
export const FRESH_ANNOTATION_EXPORT_FILE_NAME =
  "fresh-validation-annotation-v0.json" as const;

export const FROZEN_V3_COMMIT_SHA =
  "1dce5e9808d51635d8f6d7b07644b1142d9a50b5" as const;
export const FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256 =
  "d6ae3ae73e6aab4bd403307fa43111bec05c7d50269a7c53519c34fc5b35812e" as const;
export const FROZEN_FRESH_VALIDATION_SEAL_SHA256 =
  "5c11acb6346ad90d695c8531882dd0eaa629db6cd0940a857bd42eaa848c6e46" as const;
export const FROZEN_FRESH_IMAGE_COUNT = 3 as const;
export const FROZEN_FRESH_IMAGE_SHA256 = [
  "a5fa99c380d91dc3e813bddbc72adedcb54b7c8437cd7c59e537cb0a6dadc573",
  "c5a99a598b10cf2af18dd35f522473cefd4db877c91ed9ef5726ea0ee9a24dd4",
  "f95f125b7fd1e4ef288a6407d5f429fc950e978095bf3f16b7ba6b087b2cbe3c",
] as const;

export const FROZEN_WINNER_CANDIDATE =
  "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION" as const;
export const FRESH_SELECTION_SALT = "proto-fresh-validation-v0" as const;
export const FRESH_VALIDATION_SAMPLE_SIZE = 10 as const;
export const OCR_INTERPOLATION = "Linear" as const;

export const FRESH_VALIDATION_ANNOTATION_SCHEMA_VERSION =
  "proto-round-fresh-validation-annotation-v0" as const;
export const GROUND_TRUTH_SOURCE = "ORIGINAL_SCREENSHOT_PIXELS_ONLY" as const;

export type FreshRowKeyV0 = {
  sourceImageSha256: string;
  visualRowIndex: number;
};

export type FreshEligibleRowV0 = FreshRowKeyV0 & {
  sourceFileName: string;
  topY: number;
  bottomY: number;
  centerY: number;
  imageWidth: number;
  imageHeight: number;
  screenshotRelativePath: string;
};

export type FreshSemanticRegionV0 = {
  rawEvidenceTags: string[];
  joinedRawText: string;
  fragments: Array<{ x: number; y: number; width: number; height: number }>;
};

export type FreshMachineGeometryRowV0 = FreshEligibleRowV0 & {
  regions: FreshSemanticRegionV0[];
};

export type FreshIndependentEvidenceV0 = {
  source: "V2_ROW_CROP_UPSCALE_3X_KO" | "TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO";
  text: string;
};

export type FreshMachineRowV0 = FreshRowKeyV0 & {
  sourceFileName: string;
  geometry: {
    topY: number;
    bottomY: number;
    centerY: number;
    imageWidth: number;
    imageHeight: number;
  };
  participantRawOcrEvidences: FreshIndependentEvidenceV0[];
  numericRawOcrEvidences: string[];
  safeReconstructedNumericEvidences: string[];
  marketMarkerCandidateRaw: string | null;
};

export type FreshSelectionDocumentV0 = {
  schemaVersion: typeof FRESH_VALIDATION_BLIND_TEST_SCHEMA_VERSION;
  protoRoundKey: string;
  selectionSalt: typeof FRESH_SELECTION_SALT;
  selectionAlgorithm: "SHA256_SALT_CONCAT_SOURCE_SHA_VISUAL_ROW_INDEX_SORT_ASC_TAKE_N";
  sampleSizeTarget: typeof FRESH_VALIDATION_SAMPLE_SIZE;
  eligibleRowCount: number;
  selectedRowCount: number;
  eligibleRows: FreshEligibleRowV0[];
  selectedRows: FreshEligibleRowV0[];
};

export type FreshMachineOutputDocumentV0 = {
  schemaVersion: typeof FRESH_VALIDATION_BLIND_TEST_SCHEMA_VERSION;
  protoRoundKey: string;
  winnerCandidate: typeof FROZEN_WINNER_CANDIDATE;
  interpolation: typeof OCR_INTERPOLATION;
  parserUsed: false;
  holdoutRead: false;
  humanGroundTruthRead: false;
  rows: FreshMachineRowV0[];
};

export type FreshAnnotationStatusV0 =
  | "UNANNOTATED"
  | "COMPLETE"
  | "UNCERTAIN"
  | "UNREADABLE";

export type FreshHumanAnnotationRecordV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  visualRowIndex: number;
  targetRowGeometry: {
    topY: number;
    bottomY: number;
    centerY: number;
    imageWidth: number;
    imageHeight: number;
  };
  screenshotRelativePath: string;
  annotationStatus: FreshAnnotationStatusV0;
  screenRowIdentifierRaw: string | null;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
  marketMarkerRaw: string | null;
};
