/**
 * Isolated OCR recovery experiment v1.
 *
 * OCR evidence only. Does not parse odds, does not replace production OCR,
 * and does not open Fresh Validation or Holdout visual content.
 */

export const OCR_RECOVERY_EXPERIMENT_SCHEMA_VERSION =
  "proto-round-ocr-recovery-experiment-v1" as const;
export const FRESH_VALIDATION_SEAL_SCHEMA_VERSION =
  "proto-round-fresh-validation-seal-v0" as const;
export const FRESH_VALIDATION_SEAL_FILE_NAME =
  "fresh-validation-seal-v0.json" as const;
export const OCR_RECOVERY_EXPERIMENT_RESULT_FILE_NAME =
  "experiment-result-v0.json" as const;
export const OCR_RECOVERY_LOCAL_DIR_NAME = "ocr-recovery-v1" as const;

export const PILOT_COUNT = 10 as const;
export const MAXIMUM_EXPERIMENT_VARIANTS = 6 as const;
export const GROUND_TRUTH_USED = "PILOT10_DISCOVERY_ONLY" as const;
export const FROZEN_FIRST_SHOT_EXTRACTION_SHA256 =
  "31779a19f71db49d1b9c75ab1c6be41bca8f7b681ff4ea1782b9b5043592fbcd" as const;
export const FRESH_VALIDATION_PURPOSE =
  "POST_RULE_FREEZE_FRESH_VALIDATION" as const;

export const OCR_RECOVERY_CANDIDATES = [
  "BASELINE_WHOLE_SCREEN",
  "ROW_CROP_NATIVE",
  "REGION_CROP_NATIVE",
  "ROW_CROP_GRAYSCALE_NATIVE",
  "ROW_CROP_UPSCALE_2X",
  "ROW_CROP_UPSCALE_3X",
] as const;

export type OcrRecoveryCandidateName = (typeof OCR_RECOVERY_CANDIDATES)[number];

/** Lower is simpler. Frozen before looking at Pilot10 scores. */
export const CANDIDATE_SIMPLICITY_RANK: Record<OcrRecoveryCandidateName, number> =
  {
    BASELINE_WHOLE_SCREEN: 0,
    ROW_CROP_NATIVE: 1,
    REGION_CROP_NATIVE: 2,
    ROW_CROP_GRAYSCALE_NATIVE: 3,
    ROW_CROP_UPSCALE_2X: 4,
    ROW_CROP_UPSCALE_3X: 5,
  };

export type FrozenIdentityV1 = {
  sourceImageSha256: string;
  visualRowIndex: number;
};

export type PilotTruthV1 = FrozenIdentityV1 & {
  annotationStatus: string;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
};

export type PixelBoxV1 = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualRowGeometryV1 = FrozenIdentityV1 & {
  sourceFileName: string;
  topY: number;
  bottomY: number;
  imageWidth: number;
  imageHeight: number;
  visualJoinedTextCandidate: string;
  fragments: Array<{
    rawText: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

export type SemanticRegionGeometryV1 = FrozenIdentityV1 & {
  regions: Array<{
    fragments: Array<{
      rawText: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }>;
};

export type CropOcrRequestV1 = {
  imagePath: string;
  crop: PixelBoxV1;
  scale: 1 | 2 | 3;
  grayscale: boolean;
};

export type CropOcrExtractResultV1 = {
  rawText: string;
  rawLines: Array<{ text: string }>;
};

export type CropOcrProviderV1 = {
  extractCrop(request: CropOcrRequestV1): Promise<CropOcrExtractResultV1>;
};

export type RowEvidenceScoreV1 = {
  participantLeftExactEvidencePresent: boolean;
  participantRightExactEvidencePresent: boolean;
  numericCellExactEvidenceCount: number;
  numericCellTotalTruthCount: number;
  numericCellsAllExactEvidencePresent: boolean;
  participantPairExactEvidencePresent: boolean;
  allPrimaryEvidencePresent: boolean;
};

export type CandidatePilotScoreV1 = {
  candidate: OcrRecoveryCandidateName;
  participantLeftExactEvidencePresent: number;
  participantRightExactEvidencePresent: number;
  numericCellExactEvidenceCount: number;
  numericCellTotalTruthCount: number;
  numericCellsAllExactEvidencePresent: number;
  participantPairExactEvidencePresent: number;
  allPrimaryEvidencePresent: number;
  rows: Array<
    FrozenIdentityV1 &
      RowEvidenceScoreV1 & {
        pilotIndex: number;
        evidence: string;
      }
  >;
};

export type NumericOcrPatternV1 =
  | "DIGIT_SPACE_DIGIT"
  | "DIGIT_HYPHEN_DIGIT"
  | "MISSING_DECIMAL"
  | "TRAILING_PUNCTUATION"
  | "EXTRA_NUMERIC_FRAGMENT"
  | "OTHER";

export type ParticipantOcrPatternV1 =
  | "ONE_CHARACTER_SUBSTITUTION"
  | "MULTI_CHARACTER_SUBSTITUTION"
  | "PREFIX_LOSS"
  | "SUFFIX_LOSS"
  | "LATIN_KOREAN_CONFUSION"
  | "MISSING_TEXT"
  | "FRAGMENTATION"
  | "OTHER";

export type TaxonomyCounts<T extends string> = Record<T, number>;

export type FreshValidationImageV1 = {
  sourceFileName: string;
  sourceImageSha256: string;
};

export type FreshValidationSealV1 = {
  schemaVersion: typeof FRESH_VALIDATION_SEAL_SCHEMA_VERSION;
  protoRoundKey: string;
  createdFromIntakeManifest: string;
  imageCount: number;
  images: FreshValidationImageV1[];
  purpose: typeof FRESH_VALIDATION_PURPOSE;
  visualContentUsedForRuleDesign: false;
  ocrUsedForRuleDesign: false;
  groundTruthCreated: false;
  OPEN_FOR_VISUAL_RULE_DESIGN: false;
  OCR_FOR_RULE_DESIGN: false;
  GROUND_TRUTH_CREATED: false;
};

export type FreshUnseenReportV1 = {
  freshUnseenImageCount: number;
  freshUnseenImageSha256: string[];
  freshUnseenFileNames: string[];
  images: FreshValidationImageV1[];
};
