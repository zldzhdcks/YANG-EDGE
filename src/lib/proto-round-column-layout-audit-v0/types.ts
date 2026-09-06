/**
 * Proto-round column layout audit v0.
 *
 * Geometry-first field segmentation. Normalized X only.
 * ROUND_DESCRIPTIVE audit — not a production semantic/parser contract.
 * Does not assign league/team/odds/home/away semantics.
 * Does not repair OCR. Does not create official odds.
 */

import { CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";

export { CROSS_IMAGE_ROW_AUTO_DEDUPE };

export const COLUMN_LAYOUT_AUDIT_SCHEMA_VERSION =
  "proto-round-column-layout-audit-v0" as const;
export const COLUMN_LAYOUT_AUDIT_ARTIFACT_FILE_NAME =
  "column-layout-audit-v0.json" as const;
export const GEOMETRY_BASIS = "NORMALIZED_X" as const;

export const COLUMN_LAYOUT_AUDIT_SCOPE = "ROUND_DESCRIPTIVE" as const;
export const DISCOVERED_BANDS_ARE_PRODUCTION_CONTRACT = false as const;
export const SEMANTIC_REGION_CONTRACT_FROZEN = false as const;
export const AUDIT_DISCOVERY_PARAMETERS_ONLY = true as const;
export const REGION_SEMANTIC_ROLE_ASSIGNED = false as const;

/**
 * Audit discovery parameters only. Not production semantic band edges.
 * Discovered remainder ranges are artifact output. Do not export named
 * production band constants for league, team, odds, or market.
 */
export const ROUND_105_COUNT_SPECIAL_CASE = false as const;
export const FIELD_BOUNDARY_OUTCOME_TUNING = false as const;
export const LAYOUT_DISCOVERY_BIN_WIDTH = 0.02 as const;
export const LAYOUT_DISCOVERY_MIN_MODE_SHARE = 0.01 as const;

export const BOUNDARY_DERIVATION_METHOD =
  "NORMALIZED_CENTER_X_HISTOGRAM_LOCAL_MAXIMA; BAND_EDGES=MIDPOINTS_OF_ADJACENT_MODE_CENTERS" as const;

export type LayoutStatus =
  | "ANCHOR_COMPLETE"
  | "ANCHOR_INCOMPLETE"
  | "GEOMETRY_UNAVAILABLE";

export type TokenShapeClass =
  | "FOUR_DIGIT_EXACT"
  | "TWO_DIGIT"
  | "INTEGER_ASCII"
  | "DECIMAL_ASCII"
  | "H_DECIMAL_EXACT"
  | "U_DECIMAL_EXACT"
  | "O_DECIMAL_EXACT"
  | "SUM_EXACT"
  | "HANGUL_TEXT"
  | "LATIN_TEXT"
  | "MIXED_TEXT"
  | "OTHER";

export type DescriptiveShapeClass =
  | "ALL_DIGITS"
  | "DECIMAL_LIKE"
  | "H_PREFIX"
  | "U_PREFIX"
  | "SUM_LITERAL"
  | "HANGUL_PRESENT"
  | "LATIN_PRESENT"
  | "MIXED"
  | "OTHER";

export type NumericRawShapeClass =
  | "SPACED_DIGIT_GROUPS"
  | "HYPHEN_DIGIT_GROUPS"
  | "INTEGER_ASCII"
  | "DECIMAL_ASCII"
  | "BANG_SUFFIX"
  | "OTHER_NUMERIC_LIKE"
  | "NON_NUMERIC";

export type LayoutFragmentV0 = {
  rawLineIndex: number;
  rawText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  normalizedLeftX: number;
  normalizedCenterX: number;
  normalizedRightX: number;
  tokenShape: TokenShapeClass;
  descriptiveShape: DescriptiveShapeClass;
};

export type RawFieldRegionCandidateV0 = {
  regionIndex: number;
  normalizedLeft: number;
  normalizedRight: number;
  fragments: LayoutFragmentV0[];
  joinedRawText: string;
  semanticRole: "UNASSIGNED";
  occupiedBandIndex: number | null;
};

export type ProtoRoundRawFieldRegionCandidateV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  visualRowIndex: number;
  imageWidth: number | null;
  rowIdentifierCandidate: number | null;
  scheduledLocalCandidate: string | null;
  layoutStatus: LayoutStatus;
  visualJoinedTextCandidate: string;
  identifierFragment: LayoutFragmentV0 | null;
  dateTimeFragments: LayoutFragmentV0[];
  semanticRemainderFragments: LayoutFragmentV0[];
  regions: RawFieldRegionCandidateV0[];
  layoutPatternId: string | null;
  acceptedObservationTime: null;
  teamNormalizationStatus: "NOT_PERFORMED";
  leagueNormalizationStatus: "NOT_PERFORMED";
  homeAwaySemanticsAssigned: false;
  marketSemanticsAssigned: false;
  oddsParsingStatus: "NOT_PERFORMED";
  officialOddsStatus: "NOT_EXTRACTED";
  gameMatchingStatus: "NOT_MATCHED";
};

export type PercentileDistribution = {
  count: number;
  min: number | null;
  p10: number | null;
  median: number | null;
  p90: number | null;
  max: number | null;
};

export type HistogramBinV0 = {
  binIndex: number;
  normalizedLeft: number;
  normalizedRight: number;
  fragmentCount: number;
  rowCoverage: number;
  exampleRawTexts: string[];
  descriptiveShapeCounts: Partial<Record<DescriptiveShapeClass, number>>;
};

export type CandidateXBandV0 = {
  bandIndex: number;
  normalizedLeft: number;
  normalizedRight: number;
  modeCenterX: number;
  fragmentCount: number;
  rowCoverage: number;
  exampleRawTexts: string[];
  descriptiveShapeCounts: Partial<Record<DescriptiveShapeClass, number>>;
  semanticRole: "UNASSIGNED";
};

export type LayoutPatternV0 = {
  patternId: string;
  occupancyKey: string;
  rowCount: number;
  occupiedBandIndexes: number[];
  remainderRegionCountMode: number | null;
  previews: Array<{
    sourceFileName: string;
    visualRowIndex: number;
    rowIdentifierCandidate: number | null;
    scheduledLocalCandidate: string | null;
    visualJoinedTextCandidate: string;
    regions: Array<{
      regionIndex: number;
      joinedRawText: string;
      normalizedLeft: number;
      normalizedRight: number;
    }>;
  }>;
};

export type MarketSignalAuditV0 = {
  className: string;
  pattern: string;
  count: number;
  rowCoverage: number;
  normalizedCenterX: PercentileDistribution;
  exampleRawTexts: string[];
};

export type NumericShapeAuditV0 = {
  className: NumericRawShapeClass;
  count: number;
  rowCoverage: number;
  normalizedCenterX: PercentileDistribution;
  exampleRawTexts: string[];
};

export type ColumnLayoutAuditDocumentV0 = {
  meta: {
    schemaVersion: typeof COLUMN_LAYOUT_AUDIT_SCHEMA_VERSION;
    protoRoundKey: string;
    year: number;
    round: number;
    sourceVisualRowsSchema: "proto-round-visual-rows-v0";
    sourceAnchorScheduleSchema: "proto-round-row-anchor-schedule-v0";
    sourceImages: number;
    sourceVisualRows: number;
    geometryBasis: typeof GEOMETRY_BASIS;
    columnLayoutAuditScope: typeof COLUMN_LAYOUT_AUDIT_SCOPE;
    discoveredBandsAreProductionContract: typeof DISCOVERED_BANDS_ARE_PRODUCTION_CONTRACT;
    semanticRegionContractFrozen: typeof SEMANTIC_REGION_CONTRACT_FROZEN;
    auditDiscoveryParametersOnly: typeof AUDIT_DISCOVERY_PARAMETERS_ONLY;
    regionSemanticRoleAssigned: typeof REGION_SEMANTIC_ROLE_ASSIGNED;
    layoutDiscoveryBinWidth: typeof LAYOUT_DISCOVERY_BIN_WIDTH;
    layoutDiscoveryMinModeShare: typeof LAYOUT_DISCOVERY_MIN_MODE_SHARE;
    boundaryDerivationMethod: typeof BOUNDARY_DERIVATION_METHOD;
    round105CountSpecialCase: typeof ROUND_105_COUNT_SPECIAL_CASE;
    fieldBoundaryOutcomeTuning: typeof FIELD_BOUNDARY_OUTCOME_TUNING;
    semanticAssignment: "NOT_PERFORMED";
    ocrRepair: "DISABLED";
    ocrOddsRepair: "DISABLED";
    teamNormalization: "NOT_PERFORMED";
    leagueNormalization: "NOT_PERFORMED";
    homeAwaySemanticsAssigned: false;
    marketSemanticsAssigned: false;
    officialOddsExtraction: "NOT_PERFORMED";
    gameMatching: "NOT_PERFORMED";
    crossImageDedupe: typeof CROSS_IMAGE_ROW_AUTO_DEDUPE;
    acceptedObservationTimes: "NOT_ASSIGNED";
    multiLayoutCandidate: boolean;
  };
  coverage: {
    totalRows: number;
    rowsWithUsableNormalizedGeometry: number;
    rowsWithAnchorAndDateGeometry: number;
    rowsWithAnchorDateAndExactTimeGeometry: number;
    uniqueLayoutPatternCount: number;
    unclassifiedLayoutRows: number;
  };
  anchorGeometry: {
    identifierCenterX: PercentileDistribution;
    dateTimeCenterX: PercentileDistribution;
    exactClockCenterX: PercentileDistribution;
  };
  remainderHistogram: HistogramBinV0[];
  candidateBands: CandidateXBandV0[];
  layoutPatterns: LayoutPatternV0[];
  marketSignalAudit: MarketSignalAuditV0[];
  numericShapeAudit: NumericShapeAuditV0[];
  rows: ProtoRoundRawFieldRegionCandidateV0[];
};
