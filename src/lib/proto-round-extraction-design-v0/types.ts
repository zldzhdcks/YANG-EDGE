/**
 * Proto-round extraction design v0.
 *
 * Design / provenance / layout contract only.
 * Does not OCR, parse odds, match games, or classify Pregame/Late.
 *
 * ---------------------------------------------------------------------------
 * TIMESTAMP PROVENANCE
 * ---------------------------------------------------------------------------
 * Future accepted observation time may come from:
 *   OPERATOR_CONFIRMED
 *   IMAGE_METADATA
 *   FILENAME_OS_GENERATED
 *   FILESYSTEM_ONLY
 *   UNKNOWN
 *
 * This mission never assigns OPERATOR_CONFIRMED automatically.
 * A recognized filename convention may yield:
 *   FILENAME_OS_GENERATED_CANDIDATE
 * That does not prove which application created the file.
 * They are not capturedAt.
 *
 * Filesystem mtime / birthtime remain descriptive and are never a fallback
 * for capturedAt.
 *
 * ---------------------------------------------------------------------------
 * RAW FIRST
 * ---------------------------------------------------------------------------
 * leftTeamTextRaw / rightTeamTextRaw / oddsValuesRaw stay exactly as extracted.
 * Normalized fields are separate and must never overwrite raw text.
 *
 * ---------------------------------------------------------------------------
 * LAYER 2 ROW DEDUPE (DESIGN ONLY — NOT APPLIED)
 * ---------------------------------------------------------------------------
 * ROW_CONTENT_FINGERPRINT
 *   visible row content; MUST NOT include source image SHA-256
 *
 * OBSERVATION_IDENTITY
 *   content fingerprint + accepted observation time
 *
 * Same content at different accepted times is NOT an automatic duplicate.
 *
 * ---------------------------------------------------------------------------
 * CAPTURE SEQUENCE
 * ---------------------------------------------------------------------------
 * CAPTURE_SEQUENCE_RULE = NEEDS_PREREGISTRATION
 * Adjacent filename times may later form a sequence, but no threshold
 * (10s / 30s / 2min) is encoded here.
 * CROSS_IMAGE_ROW_AUTO_DEDUPE = DISABLED for the first extraction stage.
 *
 * ---------------------------------------------------------------------------
 * PREGAME / LATE (FUTURE)
 * ---------------------------------------------------------------------------
 * Only after acceptedObservationTime AND matched game kickoff:
 *   acceptedObservationTime < kickoff  → PREGAME
 *   acceptedObservationTime >= kickoff → LATE
 * No calendar-date shortcut. Current timingClassification = UNCLASSIFIED.
 */

export const EXTRACTION_DESIGN_SCHEMA_VERSION =
  "proto-round-extraction-design-v0" as const;

export const DEFAULT_TIMEZONE = "Asia/Seoul" as const;

export const CAPTURE_SEQUENCE_RULE = "NEEDS_PREREGISTRATION" as const;
export const CROSS_IMAGE_ROW_AUTO_DEDUPE = "DISABLED" as const;

export type FilenameTimestampParseStatus =
  | "PARSED_EXACT_PATTERN"
  | "NO_MATCH"
  | "INVALID_DATE_TIME";

export type FutureTimestampProvenance =
  | "OPERATOR_CONFIRMED"
  | "IMAGE_METADATA"
  | "FILENAME_OS_GENERATED"
  | "FILESYSTEM_ONLY"
  | "UNKNOWN";

export type CandidateTimestampProvenance =
  "FILENAME_OS_GENERATED_CANDIDATE";

export type FilenameTimestampParse = {
  fileName: string;
  filenameTimestampParseStatus: FilenameTimestampParseStatus;
  filenameTimestampText: string | null;
  filenameTimestampCandidateKst: string | null;
  filenameTimestampCandidateUtc: string | null;
  candidateProvenance: CandidateTimestampProvenance | null;
};

export type PngIhdrDimensions = {
  width: number;
  height: number;
  aspectRatio: string;
};

export type ImageDimensionGroup = {
  width: number;
  height: number;
  aspectRatio: string;
  count: number;
};

/**
 * Future extracted visible row. Designed, not populated with official odds.
 * Raw screen text fields must remain distinct from normalized fields.
 */
export type ExtractionRowDraftV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  protoRoundKey: string;
  year: number;
  round: number;
  filenameTimestampCandidateKst: string | null;
  filenameTimestampCandidateUtc: string | null;
  filenameTimestampParseStatus: FilenameTimestampParseStatus | null;
  acceptedObservationTime: string | null;
  observationTimeProvenance: FutureTimestampProvenance | CandidateTimestampProvenance | null;
  sportTextRaw: string | null;
  leagueTextRaw: string | null;
  scheduledDateTextRaw: string | null;
  scheduledTimeTextRaw: string | null;
  leftTeamTextRaw: string | null;
  rightTeamTextRaw: string | null;
  leftTeamNormalized: string | null;
  rightTeamNormalized: string | null;
  marketTypeRaw: string | null;
  selectionLabelsRaw: string[] | null;
  oddsValuesRaw: string[] | null;
  handicapLineRaw: string | null;
  totalLineRaw: string | null;
  visibleRowFingerprint: string | null;
  extractionStatus: "NOT_EXTRACTED";
  reviewStatus: "NOT_REVIEWED";
  timingClassification: "UNCLASSIFIED";
};

export type RowContentFingerprintInput = {
  protoRoundKey: string;
  sportTextRaw: string | null;
  leagueTextRaw: string | null;
  scheduledDateTextRaw: string | null;
  scheduledTimeTextRaw: string | null;
  leftTeamTextRaw: string | null;
  rightTeamTextRaw: string | null;
  leftTeamNormalized: string | null;
  rightTeamNormalized: string | null;
  marketTypeRaw: string | null;
  handicapLineRaw: string | null;
  totalLineRaw: string | null;
  oddsValuesRaw: string[] | null;
};

export type CanonicalImageDesignRecordV0 = {
  relativePath: string;
  fileName: string;
  extension: string;
  byteSize: number;
  sha256: string;
  firstSeenAt: string;
  filesystemMtime: string | null;
  filesystemBirthtime: string | null;
  filenameTimestamp: FilenameTimestampParse;
  pngDimensions: PngIhdrDimensions | null;
  pngDecodeStatus: "IHDR_OK" | "NOT_PNG" | "READ_ERROR";
  timingClassification: "UNCLASSIFIED";
};

export type ExtractionDesignDocumentV0 = {
  meta: {
    schemaVersion: typeof EXTRACTION_DESIGN_SCHEMA_VERSION;
    protoRoundKey: string;
    year: number;
    round: number;
    roundLabel: string;
    timezone: typeof DEFAULT_TIMEZONE;
    operatorRoot: "YANG-EDGE-INBOX";
    realCanonicalImages: number;
    filenameTimestampParseCoverage: string;
    ocr: "NOT_IMPLEMENTED";
    officialOddsExtraction: "NOT_PERFORMED";
    gameMatching: "NOT_PERFORMED";
    rowDedupe: "DESIGN_ONLY";
    timingClassification: "UNCLASSIFIED";
    captureSequenceRule: typeof CAPTURE_SEQUENCE_RULE;
    crossImageRowAutoDedupe: typeof CROSS_IMAGE_ROW_AUTO_DEDUPE;
    structuralPixelAnalysis: "NOT_PERFORMED";
    filesystemTimeUsedAsCapturedAt: false;
    filenameTimeUsedAsCapturedAt: false;
    osGeneratorProven: false;
  };
  imageDimensionGroups: ImageDimensionGroup[];
  canonicalImages: CanonicalImageDesignRecordV0[];
  policies: {
    rawTextNeverOverwrittenByNormalized: true;
    rowContentFingerprintExcludesSourceImageSha256: true;
    differentObservationTimesNotAutoMerged: true;
    pregameRequiresAcceptedObservationTimeAndKickoff: true;
    osGeneratorProven: false;
    crossImageRowAutoDedupe: typeof CROSS_IMAGE_ROW_AUTO_DEDUPE;
  };
};
