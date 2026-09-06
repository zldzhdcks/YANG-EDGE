/**
 * Proto-round ground-truth annotation pack v0.
 *
 * Human screen-pixel truth only. Selection is identity+geometry.
 * OCR / parser candidates must not prefill truth fields.
 */

export const GROUND_TRUTH_DIRECTORY_NAME = "ground-truth-v0" as const;
export const SELECTION_MANIFEST_FILE_NAME = "selection-manifest-v0.json" as const;
export const HOLDOUT_SEAL_FILE_NAME = "holdout-seal-v0.json" as const;
export const DISCOVERY_ANNOTATION_FILE_NAME = "discovery-annotation-v0.json" as const;
export const DISCOVERY_ANNOTATION_HTML_FILE_NAME = "discovery-annotation.html" as const;

export const SELECTION_SCHEMA_VERSION =
  "proto-round-ground-truth-selection-v0" as const;
export const HOLDOUT_SEAL_SCHEMA_VERSION =
  "proto-round-ground-truth-holdout-seal-v0" as const;
export const DISCOVERY_ANNOTATION_SCHEMA_VERSION =
  "proto-round-ground-truth-discovery-v0" as const;

export const SELECTION_SALT = "proto-round-ground-truth-v0" as const;
export const SELECTION_ALGORITHM =
  "SHA256_SALT_PIPE_SORT_ASC_LEXICOGRAPHIC; FIRST_N_DISCOVERY; NEXT_N_HOLDOUT" as const;

/** Annotation/research contract sizes. Not production parser constants. */
export const DISCOVERY_SAMPLE_SIZE = 30 as const;
export const HOLDOUT_SAMPLE_SIZE = 30 as const;

export const GROUND_TRUTH_SOURCE = "ORIGINAL_SCREENSHOT_PIXELS" as const;
export const GROUND_TRUTH_FROM_OCR = false as const;
export const GROUND_TRUTH_SAMPLE_CHERRY_PICKING = false as const;
export const HOLDOUT_VISUAL_CONTENT_EXPOSED = false as const;
export const HOLDOUT_ANNOTATION_STARTED = false as const;
export const HOLDOUT_USED_FOR_RULE_DESIGN = false as const;
export const OCR_VISIBLE_DURING_TRUTH_ENTRY = false as const;
export const ANNOTATION_ANCHORED_BY_MODEL_OUTPUT = false as const;
export const AUTO_GROUND_TRUTH_COMPLETION = "DISABLED" as const;
export const GROUND_TRUTH_HOME_AWAY_ASSIGNED = false as const;
export const GROUND_TRUTH_MARKET_NORMALIZATION = "NOT_PERFORMED" as const;
export const GROUND_TRUTH_TEAM_NORMALIZATION = "NOT_PERFORMED" as const;
export const GROUND_TRUTH_LEAGUE_NORMALIZATION = "NOT_PERFORMED" as const;
export const POST_SELECTION_COVERAGE_AUDIT_ONLY = true as const;
export const GROUND_TRUTH_DISCOVERY_TEMPLATE = "GENERATED" as const;
export const GROUND_TRUTH_DISCOVERY_ANNOTATED = false as const;
export const GROUND_TRUTH_ACCURACY_METRIC = "NOT_AVAILABLE_YET" as const;

export type AnnotationStatusV0 =
  | "UNANNOTATED"
  | "COMPLETE"
  | "UNCERTAIN"
  | "UNREADABLE";

export type FrozenRowKeyV0 = {
  sourceImageSha256: string;
  visualRowIndex: number;
};

export type EligibleVisualRowV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  visualRowIndex: number;
  topY: number;
  bottomY: number;
  centerY: number;
  imageWidth: number;
  imageHeight: number;
  screenshotRelativePath: string;
};

export type SelectionManifestV0 = {
  schemaVersion: typeof SELECTION_SCHEMA_VERSION;
  protoRoundKey: string;
  selectionAlgorithm: typeof SELECTION_ALGORITHM;
  selectionSalt: typeof SELECTION_SALT;
  eligibleRowCount: number;
  discoverySampleSize: typeof DISCOVERY_SAMPLE_SIZE;
  holdoutSampleSize: typeof HOLDOUT_SAMPLE_SIZE;
  discoveryRowKeys: FrozenRowKeyV0[];
  holdoutRowKeys: FrozenRowKeyV0[];
};

export type HoldoutSealV0 = {
  schemaVersion: typeof HOLDOUT_SEAL_SCHEMA_VERSION;
  protoRoundKey: string;
  holdoutSampleSize: typeof HOLDOUT_SAMPLE_SIZE;
  selectionManifestSha256: string;
  holdoutRowKeyHashes: string[];
};

export type TargetRowGeometryV0 = {
  topY: number;
  bottomY: number;
  centerY: number;
  imageWidth: number;
  imageHeight: number;
};

export type DiscoveryAnnotationRecordV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  visualRowIndex: number;
  targetRowGeometry: TargetRowGeometryV0;
  screenshotRelativePath: string;
  annotationStatus: AnnotationStatusV0;
  screenRowIdentifierRaw: string | null;
  screenDateRaw: string | null;
  screenTimeRaw: string | null;
  leagueDisplayRaw: string | null;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  marketMarkerRaw: string | null;
  numericCellsRaw: string[];
  statusTextRaw: string | null;
  otherVisibleTextRaw: string[];
  annotatorNotes: string | null;
};

export type DiscoveryAnnotationDocumentV0 = {
  schemaVersion: typeof DISCOVERY_ANNOTATION_SCHEMA_VERSION;
  protoRoundKey: string;
  groundTruthSource: typeof GROUND_TRUTH_SOURCE;
  groundTruthFromOcr: typeof GROUND_TRUTH_FROM_OCR;
  autoGroundTruthCompletion: typeof AUTO_GROUND_TRUTH_COMPLETION;
  homeAwayAssigned: typeof GROUND_TRUTH_HOME_AWAY_ASSIGNED;
  marketNormalization: typeof GROUND_TRUTH_MARKET_NORMALIZATION;
  teamNormalization: typeof GROUND_TRUTH_TEAM_NORMALIZATION;
  leagueNormalization: typeof GROUND_TRUTH_LEAGUE_NORMALIZATION;
  ocrVisibleDuringTruthEntry: typeof OCR_VISIBLE_DURING_TRUTH_ENTRY;
  annotationAnchoredByModelOutput: typeof ANNOTATION_ANCHORED_BY_MODEL_OUTPUT;
  discoveryTemplate: typeof GROUND_TRUTH_DISCOVERY_TEMPLATE;
  discoveryAnnotated: typeof GROUND_TRUTH_DISCOVERY_ANNOTATED;
  accuracyMetric: typeof GROUND_TRUTH_ACCURACY_METRIC;
  records: DiscoveryAnnotationRecordV0[];
};

export type DiscoveryCoverageAuditV0 = {
  postSelectionCoverageAuditOnly: typeof POST_SELECTION_COVERAGE_AUDIT_ONLY;
  discoverySampleSize: number;
  sourceScreenshotCount: number;
  layoutPatternIdCount: number;
  rowsWithExactSchedule: number;
  rowsWithRawMarketMarker: number;
};

export type GroundTruthLineageVisualRowV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  visualRowIndex: number;
  topY: number;
  bottomY: number;
  centerY: number;
};

export type GroundTruthLineageImageV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  imageWidth: number | null;
  imageHeight: number | null;
  visualRows: GroundTruthLineageVisualRowV0[];
};

export type ScreenshotBytesProbe = {
  fileExists: (roundRelativePath: string) => Promise<boolean>;
  fileSha256: (roundRelativePath: string) => Promise<string>;
};
