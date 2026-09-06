/**
 * Proto-round raw OCR v0.
 *
 * IMAGE → LOCAL OCR RAW TEXT only.
 * Does not parse odds, match games, classify Pregame/Late,
 * or merge rows across images.
 *
 * CROSS_IMAGE_ROW_AUTO_DEDUPE = DISABLED
 * CAPTURE_SEQUENCE_RULE = NEEDS_PREREGISTRATION
 * FILENAME_TIMESTAMP_USED_AS_CAPTURED_AT = NO
 *
 * ---------------------------------------------------------------------------
 * WINDOWS OCR LINE ORDER
 * ---------------------------------------------------------------------------
 * Windows.Media.Ocr rawLines are provider output order.
 * OCR_LINE_ORDER_USED_AS_ROW_STRUCTURE = NO
 * Early numeric lines (9413, 9414, ...) are not treated as complete game rows.
 */

export const OCR_LINE_ORDER_USED_AS_ROW_STRUCTURE = false as const;
export const OCR_ACCURACY_PERCENT = "NOT_MEASURABLE_YET" as const;

import type {
  CandidateTimestampProvenance,
  FilenameTimestampParseStatus,
} from "../proto-round-extraction-design-v0/types";
import { CAPTURE_SEQUENCE_RULE, CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";

export { CAPTURE_SEQUENCE_RULE, CROSS_IMAGE_ROW_AUTO_DEDUPE };

export const RAW_OCR_SCHEMA_VERSION = "proto-round-raw-ocr-v0" as const;
export const RAW_OCR_ARTIFACT_FILE_NAME = "raw-ocr-v0.json" as const;

export type ProtoRoundLocalOcrProviderKind =
  | "WINDOWS_MEDIA_OCR"
  | "TESSERACT"
  | "MOCK";

export type RawOcrStatus = "OCR_OK" | "OCR_EMPTY" | "OCR_ERROR";

export type OcrBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ProtoRoundLocalOcrLine = {
  text: string;
  boundingBox?: OcrBoundingBox | null;
  confidence?: number;
};

export type ProtoRoundLocalOcrExtractResult = {
  rawText: string;
  rawLines: ProtoRoundLocalOcrLine[];
};

export type ProtoRoundLocalOcrProvider = {
  providerKind: ProtoRoundLocalOcrProviderKind;
  providerVersion: string;
  languages: string[];
  extract(imagePath: string): Promise<ProtoRoundLocalOcrExtractResult>;
};

export type LocalOcrCapabilityAudit = {
  networkUsed: false;
  autoInstalled: false;
  windowsMediaOcr: {
    engineAvailable: boolean;
    languages: string[];
    koreanSupported: boolean;
    userProfileLanguage: string | null;
    error: string | null;
  };
  tesseract: {
    installed: boolean;
    version: string | null;
    languages: string[];
    koreanSupported: boolean;
    error: string | null;
  };
};

export type RawOcrImageRecordV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  protoRoundKey: string;
  year: number;
  round: number;
  filenameTimestampCandidateKst: string | null;
  filenameTimestampCandidateUtc: string | null;
  filenameTimestampParseStatus: FilenameTimestampParseStatus | null;
  candidateProvenance: CandidateTimestampProvenance | null;
  acceptedObservationTime: null;
  observationTimeProvenance: null;
  ocrProvider: ProtoRoundLocalOcrProviderKind;
  ocrLanguage: string[];
  ocrStatus: RawOcrStatus;
  rawText: string | null;
  rawLines: ProtoRoundLocalOcrLine[] | null;
  lineCount: number;
  nonWhitespaceCharacterCount: number;
  AUTO_MERGE_ELIGIBLE: false;
  errorCode: string | null;
};

export type RawOcrDocumentV0 = {
  meta: {
    schemaVersion: typeof RAW_OCR_SCHEMA_VERSION;
    protoRoundKey: string;
    year: number;
    round: number;
    sourceCanonicalImages: number;
    ocrProvider: ProtoRoundLocalOcrProviderKind;
    ocrProviderVersion: string;
    ocrLanguages: string[];
    networkUsed: false;
    officialOddsExtraction: "NOT_PERFORMED";
    gameMatching: "NOT_PERFORMED";
    crossImageRowDedupe: typeof CROSS_IMAGE_ROW_AUTO_DEDUPE;
    captureSequenceRule: typeof CAPTURE_SEQUENCE_RULE;
    acceptedObservationTimes: "NOT_ASSIGNED";
    filenameTimestampUsedAsCapturedAt: false;
    filesystemTimeUsedAsCapturedAt: false;
    autoMergeWithNullTime: false;
    ocrLineOrderUsedAsRowStructure: false;
    ocrAccuracyPercent: typeof OCR_ACCURACY_PERCENT;
  };
  images: RawOcrImageRecordV0[];
};
