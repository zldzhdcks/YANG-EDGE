/**
 * Isolated OCR recovery experiment v2.
 *
 * Region upscale, dual-language OCR, and a separate safe numeric
 * reconstruction diagnostic. Does not replace production OCR/parser.
 * Does not open Fresh Validation or Holdout.
 */

export const OCR_RECOVERY_EXPERIMENT_V2_SCHEMA_VERSION =
  "proto-round-ocr-recovery-experiment-v2" as const;
export const OCR_RECOVERY_V2_LOCAL_DIR_NAME = "ocr-recovery-v2" as const;
export const OCR_RECOVERY_V2_RESULT_FILE_NAME = "experiment-result-v0.json" as const;

export const PILOT_COUNT = 10 as const;
export const MAXIMUM_EXPERIMENT_VARIANTS = 6 as const;
export const GROUND_TRUTH_USED = "PILOT10_DISCOVERY_ONLY" as const;
export const FROZEN_FIRST_SHOT_EXTRACTION_SHA256 =
  "31779a19f71db49d1b9c75ab1c6be41bca8f7b681ff4ea1782b9b5043592fbcd" as const;
export const FROZEN_FRESH_VALIDATION_SEAL_SHA256 =
  "5c11acb6346ad90d695c8531882dd0eaa629db6cd0940a857bd42eaa848c6e46" as const;

export const REGION_EXPAND_HORIZONTAL_RATIO = 0.2 as const;
export const REGION_EXPAND_VERTICAL_RATIO = 0.5 as const;
export const REGION_EXPAND_MIN_PIXEL_PADDING = 1 as const;
export const CROP_UPSCALE = 3 as const;

export const OCR_RECOVERY_V2_CANDIDATES = [
  "BASELINE_WHOLE_SCREEN",
  "ROW_CROP_UPSCALE_3X_KO",
  "REGION_CROP_UPSCALE_3X_KO",
  "REGION_CROP_EXPANDED_UPSCALE_3X_KO",
  "REGION_CROP_UPSCALE_3X_EN",
  "REGION_CROP_EXPANDED_UPSCALE_3X_DUAL",
] as const;

export type OcrRecoveryV2CandidateName = (typeof OCR_RECOVERY_V2_CANDIDATES)[number];

export const CANDIDATE_SIMPLICITY_RANK_V2: Record<OcrRecoveryV2CandidateName, number> =
  {
    BASELINE_WHOLE_SCREEN: 0,
    ROW_CROP_UPSCALE_3X_KO: 1,
    REGION_CROP_UPSCALE_3X_KO: 2,
    REGION_CROP_EXPANDED_UPSCALE_3X_KO: 3,
    REGION_CROP_UPSCALE_3X_EN: 4,
    REGION_CROP_EXPANDED_UPSCALE_3X_DUAL: 5,
  };

export type OcrLanguageTagV2 = "ko" | "en-US";

export type CandidateStatusV2 = "OK" | "EN_OCR_UNAVAILABLE";

export type FrozenIdentityV2 = {
  sourceImageSha256: string;
  visualRowIndex: number;
};

export type PilotTruthV2 = FrozenIdentityV2 & {
  annotationStatus: string;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
};

export type PixelBoxV2 = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualRowGeometryV2 = FrozenIdentityV2 & {
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

export type SemanticRegionGeometryV2 = FrozenIdentityV2 & {
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

export type CropOcrRequestV2 = {
  imagePath: string;
  crop: PixelBoxV2;
  scale: 1 | 2 | 3;
  language: OcrLanguageTagV2;
};

export type CropOcrExtractResultV2 = {
  rawText: string;
  rawLines: Array<{ text: string }>;
};

export type CropOcrProviderV2 = {
  extractCrop(request: CropOcrRequestV2): Promise<CropOcrExtractResultV2>;
};

export type IndependentEvidenceV2 = {
  language: OcrLanguageTagV2;
  source: "BASELINE_FRAGMENT" | "ROW_CROP" | "REGION_CROP";
  text: string;
};

export type RowEvidenceScoreV2 = {
  participantLeftExactEvidencePresent: boolean;
  participantRightExactEvidencePresent: boolean;
  numericCellExactEvidenceCount: number;
  numericCellTotalTruthCount: number;
  numericCellsAllExactEvidencePresent: boolean;
  participantPairExactEvidencePresent: boolean;
  allPrimaryEvidencePresent: boolean;
  numericReconstructedExactCellCount: number;
  numericCellsAllExactAfterSafeReconstruction: boolean;
};

export type CandidatePilotScoreV2 = {
  candidate: OcrRecoveryV2CandidateName;
  status: CandidateStatusV2;
  participantLeftExactEvidencePresent: number;
  participantRightExactEvidencePresent: number;
  numericCellExactEvidenceCount: number;
  numericCellTotalTruthCount: number;
  numericCellsAllExactEvidencePresent: number;
  participantPairExactEvidencePresent: number;
  allPrimaryEvidencePresent: number;
  numericReconstructedExactCellCount: number;
  numericCellsAllExactAfterSafeReconstruction: number;
  rows: Array<
    FrozenIdentityV2 &
      RowEvidenceScoreV2 & {
        pilotIndex: number;
      }
  >;
};
