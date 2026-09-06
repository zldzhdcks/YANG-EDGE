/**
 * Proto-round visual row reconstruction v0.
 *
 * RAW OCR tokens/lines + bounding-box geometry → VISUAL ROW CANDIDATES.
 * Does not parse odds, match games, or merge across images.
 *
 * PROVIDER_LINE_ORDER_USED = NO
 * GEOMETRY_SORT_USED = YES
 * OCR_LINE_ORDER_USED_AS_ROW_STRUCTURE = NO
 *
 * ---------------------------------------------------------------------------
 * ROW CLUSTER RULE (PRE-REGISTERED, NOT TUNED ON ROUND 105)
 * ---------------------------------------------------------------------------
 * Two placed OCR line boxes are geometrically compatible iff:
 *
 *   overlapHeight = max(0, min(bottomA, bottomB) - max(topA, topB))
 *   verticalOverlapRatio = overlapHeight / min(heightA, heightB)
 *   compatible ⇔ verticalOverlapRatio >= 0.50
 *
 * WHY 0.50: at least half of the smaller line height must occupy the same
 * vertical band. Frozen before inspecting Round 105 clusters.
 *
 * TRANSITIVE PROTECTION:
 * A new line joins a cluster only if it is compatible with EVERY current
 * member. Overlap with a neighbor is not enough to chain A–B–C when A and C
 * do not themselves meet 0.50.
 *
 * Missing/invalid boxes are UNPLACED_OCR_LINE. Boxes are never invented.
 */

import { CAPTURE_SEQUENCE_RULE, CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";

export { CAPTURE_SEQUENCE_RULE, CROSS_IMAGE_ROW_AUTO_DEDUPE };

export const VISUAL_ROWS_SCHEMA_VERSION = "proto-round-visual-rows-v0" as const;
export const VISUAL_ROWS_ARTIFACT_FILE_NAME = "visual-rows-v0.json" as const;
export const VERTICAL_OVERLAP_THRESHOLD = 0.5 as const;
export const ROW_CLUSTER_METHOD = "VERTICAL_OVERLAP_RATIO" as const;
export const FOUR_DIGIT_TOKEN_SEMANTIC_ROLE = "UNASSIGNED" as const;
export const MARKET_SIGNAL_SEMANTICS_ASSIGNED = false as const;

export type ImageDimensions = {
  width: number;
  height: number;
};

export type DerivedBoxGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  rightX: number;
  bottomY: number;
  normalizedX: number | null;
  normalizedY: number | null;
  normalizedWidth: number | null;
  normalizedHeight: number | null;
};

export type PlacedOcrLineV0 = DerivedBoxGeometry & {
  rawLineIndex: number;
  rawText: string;
};

export type UnplacedOcrLineV0 = {
  rawLineIndex: number;
  rawText: string;
  reason: "MISSING_BOUNDING_BOX" | "INVALID_BOUNDING_BOX";
};

export type VisualRowFragmentV0 = {
  rawLineIndex: number;
  rawText: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualRowCandidateV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  visualRowIndex: number;
  topY: number;
  bottomY: number;
  centerY: number;
  normalizedTopY: number | null;
  normalizedBottomY: number | null;
  fragmentCount: number;
  fragments: VisualRowFragmentV0[];
  visualJoinedTextCandidate: string;
  semanticStatus: "UNINTERPRETED";
  officialOddsStatus: "NOT_EXTRACTED";
  gameMatchStatus: "NOT_MATCHED";
};

export type VisualRowsImageRecordV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  acceptedObservationTime: null;
  observationTimeProvenance: null;
  imageWidth: number | null;
  imageHeight: number | null;
  placedLineCount: number;
  unplacedLineCount: number;
  visualRowCandidateCount: number;
  unplacedLines: UnplacedOcrLineV0[];
  visualRows: VisualRowCandidateV0[];
};

export type VisualRowsDocumentV0 = {
  meta: {
    schemaVersion: typeof VISUAL_ROWS_SCHEMA_VERSION;
    protoRoundKey: string;
    year: number;
    round: number;
    sourceRawOcrSchema: "proto-round-raw-ocr-v0";
    sourceImages: number;
    rowClusterMethod: typeof ROW_CLUSTER_METHOD;
    verticalOverlapThreshold: typeof VERTICAL_OVERLAP_THRESHOLD;
    providerLineOrderUsed: false;
    geometrySortUsed: true;
    rowClusterRulePredefinedBeforeResults: true;
    postHocGeometryTuning: false;
    semanticParsing: "NOT_PERFORMED";
    officialOddsExtraction: "NOT_PERFORMED";
    gameMatching: "NOT_PERFORMED";
    crossImageRowDedupe: typeof CROSS_IMAGE_ROW_AUTO_DEDUPE;
    captureSequenceRule: typeof CAPTURE_SEQUENCE_RULE;
    acceptedObservationTimes: "NOT_ASSIGNED";
    filenameTimestampUsedAsCapturedAt: false;
    fourDigitTokenSemanticRole: typeof FOUR_DIGIT_TOKEN_SEMANTIC_ROLE;
    marketSignalSemanticsAssigned: false;
  };
  images: VisualRowsImageRecordV0[];
};
