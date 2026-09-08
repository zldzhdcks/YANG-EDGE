/**
 * Isolated participant OCR experiment v3.
 *
 * Machine-geometry crops only. Does not replace production OCR/parser.
 * Does not open Fresh Validation or Holdout.
 */

export const PARTICIPANT_OCR_EXPERIMENT_V3_SCHEMA_VERSION =
  "proto-round-participant-ocr-experiment-v3" as const;
export const PARTICIPANT_OCR_V3_LOCAL_DIR_NAME = "participant-ocr-v3" as const;
export const PARTICIPANT_OCR_V3_RESULT_FILE_NAME =
  "experiment-result-v0.json" as const;

export const PILOT_COUNT = 10 as const;
export const MAXIMUM_EXPERIMENT_VARIANTS = 6 as const;
export const TEXT_BEARING_RAW = "TEXT_BEARING_RAW" as const;
export const OCR_INTERPOLATION = "Linear" as const;
export const MIN_PIXEL_PADDING = 1 as const;

export const FROZEN_OCR_RECOVERY_V2_RESULT_SHA256 =
  "e46ee9bfa483dfd266d5c20c96a8255b1d1f3805141d8767f8a3f0b19ea1f264" as const;
export const FROZEN_FRESH_VALIDATION_SEAL_SHA256 =
  "5c11acb6346ad90d695c8531882dd0eaa629db6cd0940a857bd42eaa848c6e46" as const;
export const FROZEN_FIRST_SHOT_EXTRACTION_SHA256 =
  "31779a19f71db49d1b9c75ab1c6be41bca8f7b681ff4ea1782b9b5043592fbcd" as const;
export const FROZEN_FRESH_VALIDATION_IMAGE_COUNT = 3 as const;

export const OCR_RECOVERY_V2_LOCAL_DIR_NAME = "ocr-recovery-v2" as const;
export const OCR_RECOVERY_V2_RESULT_FILE_NAME =
  "experiment-result-v0.json" as const;

export const PARTICIPANT_OCR_V3_CANDIDATES = [
  "V2_ROW_CROP_UPSCALE_3X_KO",
  "ROW_EXPANDED_VERTICAL_50_UPSCALE_4X_KO",
  "ROW_EXPANDED_VERTICAL_100_UPSCALE_5X_KO",
  "TEXT_REGIONS_EXPANDED_40_100_UPSCALE_4X_KO",
  "TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO",
  "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION",
] as const;

export type ParticipantOcrV3CandidateName =
  (typeof PARTICIPANT_OCR_V3_CANDIDATES)[number];

export const CANDIDATE_SIMPLICITY_RANK_V3: Record<
  ParticipantOcrV3CandidateName,
  number
> = {
  V2_ROW_CROP_UPSCALE_3X_KO: 0,
  ROW_EXPANDED_VERTICAL_50_UPSCALE_4X_KO: 1,
  ROW_EXPANDED_VERTICAL_100_UPSCALE_5X_KO: 2,
  TEXT_REGIONS_EXPANDED_40_100_UPSCALE_4X_KO: 3,
  TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO: 4,
  ROW_PLUS_TEXT_REGION_EVIDENCE_UNION: 5,
};

export type CropScaleV3 = 3 | 4 | 5;

export type FrozenIdentityV3 = {
  sourceImageSha256: string;
  visualRowIndex: number;
};

export type PilotTruthV3 = FrozenIdentityV3 & {
  annotationStatus: string;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
};

export type PixelBoxV3 = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualRowGeometryV3 = FrozenIdentityV3 & {
  sourceFileName: string;
  topY: number;
  bottomY: number;
  imageWidth: number;
  imageHeight: number;
};

export type SemanticRegionGeometryV3 = FrozenIdentityV3 & {
  regions: Array<{
    rawEvidenceTags: string[];
    fragments: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }>;
};

export type CropOcrRequestV3 = {
  imagePath: string;
  crop: PixelBoxV3;
  scale: CropScaleV3;
};

export type CropOcrExtractResultV3 = {
  rawText: string;
  rawLines: Array<{ text: string }>;
};

export type CropOcrProviderV3 = {
  extractCrop(request: CropOcrRequestV3): Promise<CropOcrExtractResultV3>;
};

export type IndependentEvidenceV3 = {
  source: ParticipantOcrV3CandidateName;
  text: string;
};

export type RowEvidenceScoreV3 = {
  leftExactEvidencePresent: boolean;
  rightExactEvidencePresent: boolean;
  participantPairExactEvidencePresent: boolean;
  participantExactSlotCount: number;
  numericCellExactEvidenceCount: number;
  numericCellTotalTruthCount: number;
  numericCellsAllExactEvidencePresent: boolean;
};

export type CandidatePilotScoreV3 = {
  candidate: ParticipantOcrV3CandidateName;
  participantLeftExactEvidencePresent: number;
  participantRightExactEvidencePresent: number;
  participantPairExactEvidencePresent: number;
  participantExactSlotCount: number;
  numericCellExactEvidenceCount: number;
  numericCellTotalTruthCount: number;
  numericCellsAllExactEvidencePresent: number;
  rows: Array<
    FrozenIdentityV3 &
      RowEvidenceScoreV3 & {
        pilotIndex: number;
      }
  >;
};
