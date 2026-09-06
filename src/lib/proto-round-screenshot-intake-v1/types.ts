/**
 * Proto-round screenshot intake v1 — sport-agnostic image inbox.
 *
 * This module is the SAFE INTAKE FOUNDATION only.
 * It does not OCR, parse odds, match games, or classify pregame/late.
 *
 * ---------------------------------------------------------------------------
 * TWO-LAYER DEDUPE POLICY
 * ---------------------------------------------------------------------------
 * LAYER 1 — THIS MISSION (IMPLEMENTED)
 *   Exact image dedupe by SHA-256 of raw file bytes.
 *   Same hash = same exact image content, regardless of filename or copy order.
 *
 * LAYER 2 — FUTURE EXTRACTION STAGE (NOT_IMPLEMENTED)
 *   Row-level dedupe after OCR / structured extraction, for overlapping
 *   screenshots that contain the same game/market rows but are not
 *   byte-identical images.
 *   Do not pretend Layer 2 exists yet.
 *
 * ---------------------------------------------------------------------------
 * TIME-SERIES OBSERVATIONS (FUTURE RULE — NOT APPLIED IN V1)
 * ---------------------------------------------------------------------------
 * Same game at DIFFERENT capture times must NOT automatically be discarded
 * merely because the odds values are equal.
 *
 * Example:
 *   20:00  Team A 1.80
 *   23:00  Team A 1.80
 *
 * These may be two legitimate observations. Only proven duplicate source
 * observations should be collapsed. This preserves future odds-movement research.
 *
 * ---------------------------------------------------------------------------
 * CAPTURE-TIME PROVENANCE
 * ---------------------------------------------------------------------------
 * filesystem mtime / birthtime are descriptive metadata only.
 * They must NOT automatically become official screenshot capturedAt.
 * Copying or moving files can alter filesystem times.
 *
 * firstSeenAt  = time YANG EDGE first discovered the file
 * filesystemMtime / filesystemBirthtime = OS metadata, unverified
 *
 * Future fields (not populated in v1):
 *   imageMetadataCapturedAt
 *   operatorConfirmedCapturedAt
 *
 * FILESYSTEM_TIME_TREATED_AS_VERIFIED_CAPTURE_TIME = NO
 *
 * ---------------------------------------------------------------------------
 * FUTURE PREGAME POLICY (NOT CLASSIFIED IN V1)
 * ---------------------------------------------------------------------------
 * Each image: timingClassification = UNCLASSIFIED
 *
 * Future rule (no calendar-date assumption; midnight does not split a round):
 *   verified/accepted observation time < game kickoff  → PREGAME
 *   otherwise                                          → LATE or UNKNOWN
 *
 * Round is the PRIMARY grouping key. Calendar date is not.
 */

export const INTAKE_SCHEMA_VERSION = "proto-round-screenshot-intake-v1" as const;
export const ROUND_CONFIG_SCHEMA_VERSION = "proto-round-config-v1" as const;
export const DEFAULT_TIMEZONE = "Asia/Seoul" as const;
export const GROUPING_POLICY = "PROTO_ROUND_PRIMARY" as const;

export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".heic",
  ".heif",
] as const;

export type SupportedImageExtension = (typeof SUPPORTED_IMAGE_EXTENSIONS)[number];

export type FileStatus =
  | "CANONICAL_IMAGE"
  | "DUPLICATE_EXACT"
  | "UNSUPPORTED_FILE";

export type ExtractionStatus = "NOT_EXTRACTED";

/**
 * v1 always writes UNCLASSIFIED.
 * PREGAME / LATE / UNKNOWN are reserved for a future extraction/matching stage.
 */
export type FuturePregameTimingClass = "PREGAME" | "LATE" | "UNKNOWN";
export type ImageTimingClassification = "UNCLASSIFIED" | FuturePregameTimingClass;

export type ImplementationStatus = "IMPLEMENTED" | "NOT_IMPLEMENTED";

export const DEDUPE_POLICY_V1 = {
  exactImageDedupe: "IMPLEMENTED",
  nearImageDedupe: "NOT_IMPLEMENTED",
  rowObservationDedupe: "NOT_IMPLEMENTED",
} as const satisfies {
  exactImageDedupe: ImplementationStatus;
  nearImageDedupe: ImplementationStatus;
  rowObservationDedupe: ImplementationStatus;
};

export type ProtoRoundIdentity = {
  year: number;
  round: number;
  roundLabel: string;
  protoRoundKey: string;
};

export type ProtoRoundConfigV1 = ProtoRoundIdentity & {
  schemaVersion: typeof ROUND_CONFIG_SCHEMA_VERSION;
  operatorRoot: "YANG-EDGE-INBOX";
  createdAt: string;
  timezone: typeof DEFAULT_TIMEZONE;
  groupingPolicy: typeof GROUPING_POLICY;
  calendarDateSplit: false;
};

export type PhysicalFileRecordV1 = {
  relativePath: string;
  fileName: string;
  extension: string;
  byteSize: number;
  sha256: string;
  firstSeenAt: string;
  lastSeenAt: string;
  filesystemMtime: string | null;
  filesystemBirthtime: string | null;
  fileStatus: FileStatus;
  canonicalSha256: string | null;
  duplicateOfSha256: string | null;
  canonicalRelativePath: string | null;
  extractionEligible: boolean;
  extractionStatus: ExtractionStatus;
  timingClassification: "UNCLASSIFIED";
};

export type IntakeManifestMetaV1 = ProtoRoundIdentity & {
  schemaVersion: typeof INTAKE_SCHEMA_VERSION;
  operatorRoot: "YANG-EDGE-INBOX";
  timezone: typeof DEFAULT_TIMEZONE;
  firstInitializedAt: string;
  lastScanAt: string;
  groupingPolicy: typeof GROUPING_POLICY;
  calendarDateSplit: false;
  rawImageStorage: "LOCAL_ONLY";
  ocrStatus: "NOT_IMPLEMENTED";
  oddsExtractionStatus: "NOT_IMPLEMENTED";
  exactImageDedupe: "IMPLEMENTED";
  nearImageDedupe: "NOT_IMPLEMENTED";
  rowObservationDedupe: "NOT_IMPLEMENTED";
  filesystemTimeTreatedAsVerifiedCaptureTime: false;
};

export type IntakeManifestSummaryV1 = {
  physicalFileCount: number;
  canonicalImageCount: number;
  duplicateExactCount: number;
  unsupportedFileCount: number;
  extractionEligibleCount: number;
};

export type IntakeManifestV1 = {
  meta: IntakeManifestMetaV1;
  summary: IntakeManifestSummaryV1;
  files: PhysicalFileRecordV1[];
};

export type InitProtoRoundResult = {
  action: "init";
  year: number;
  round: number;
  roundLabel: string;
  protoRoundKey: string;
  operatorRoot: "YANG-EDGE-INBOX";
  operatorRootAbs: string;
  roundRelativePath: string;
  screenshotDirectoryAbs: string;
  roundConfigRelativePath: string;
  createdRoundDirectory: boolean;
  wroteRoundConfig: boolean;
};

export type ScanProtoRoundResult = {
  action: "scan";
  year: number;
  round: number;
  roundLabel: string;
  protoRoundKey: string;
  operatorRoot: "YANG-EDGE-INBOX";
  operatorRootAbs: string;
  roundRelativePath: string;
  screenshotDirectoryAbs: string;
  manifestRelativePath: string;
  summary: IntakeManifestSummaryV1;
  previousCanonicalImageCount: number;
  canonicalImageDelta: number;
};
