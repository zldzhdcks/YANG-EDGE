/**
 * Proto-round semantic region candidates v0.
 *
 * RAW_EVIDENCE_CANDIDATES_ONLY.
 * Tags describe OCR string shape. They are not league/team/home/away/odds/market.
 * Discovered layout bands remain ROUND_DESCRIPTIVE evidence, not labels.
 */

import { CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";
import type {
  LayoutFragmentV0,
  PercentileDistribution,
} from "../proto-round-column-layout-audit-v0/types";

export { CROSS_IMAGE_ROW_AUTO_DEDUPE };

export const SEMANTIC_REGION_CANDIDATES_SCHEMA_VERSION =
  "proto-round-semantic-region-candidates-v0" as const;
export const SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME =
  "semantic-region-candidates-v0.json" as const;

export const SEMANTIC_SCOPE = "RAW_EVIDENCE_CANDIDATES_ONLY" as const;
export const BAND_INDEX_SEMANTIC_MEANING = "NONE" as const;
export const BAND_INDEX_USED_AS_SEMANTIC_LABEL = false as const;
export const BAND_1_MARKET_CONTRACT = false as const;
export const RAW_EVIDENCE_TAG_COMPOSITION = "DETERMINISTIC" as const;
export const RAW_REGION_TEXT_MODIFIED = false as const;
export const TEXT_BEARING_RAW_IS_TEAM = false as const;
export const TEXT_BEARING_RAW_IS_LEAGUE = false as const;
export const NUMERIC_LIKE_RAW_IS_ODDS = false as const;
export const EXACT_MARKET_MARKER_RAW_IS_OFFICIAL_MARKET = false as const;
export const MARKET_SEMANTICS_ASSIGNED = false as const;
export const TEAM_PARSING_PERFORMED = false as const;
export const LEAGUE_PARSING_PERFORMED = false as const;
export const HOME_AWAY_SEMANTICS_ASSIGNED = false as const;
export const OCR_CORRECTION = "DISABLED" as const;
export const OCR_ODDS_REPAIR = "DISABLED" as const;
export const ODDS_PARSING_PERFORMED = false as const;
export const OFFICIAL_ODDS_RECORD_CREATED = false as const;
export const GAME_MATCHING = false as const;
export const ACCEPTED_OBSERVATION_TIME_ASSIGNED = false as const;

export type RawEvidenceTagV0 =
  | "TEXT_BEARING_RAW"
  | "NUMERIC_LIKE_RAW"
  | "EXACT_MARKET_MARKER_RAW"
  | "OTHER_RAW";

export type RegionGeometryStatusV0 =
  | "VALID"
  | "INVALID_NORMALIZED_GEOMETRY"
  | "MIXED";

export type RowRawEvidenceSignatureLetterV0 = "T" | "M" | "N" | "X" | "O" | "I";

export type SemanticRegionCandidateRegionV0 = {
  regionIndex: number;
  occupiedBandIndex: number | null;
  normalizedLeft: number;
  normalizedRight: number;
  joinedRawText: string;
  fragments: LayoutFragmentV0[];
  semanticRole: "UNASSIGNED";
  rawEvidenceTags: RawEvidenceTagV0[];
  geometryStatus: RegionGeometryStatusV0;
};

export type ProtoRoundSemanticRegionCandidateV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  visualRowIndex: number;
  rowIdentifierCandidate: number | null;
  scheduledLocalCandidate: string | null;
  layoutPatternId: string | null;
  visualJoinedTextCandidate: string;
  regions: SemanticRegionCandidateRegionV0[];
  rowRawEvidenceSignature: string;
  teamParsingStatus: "NOT_PERFORMED";
  leagueParsingStatus: "NOT_PERFORMED";
  marketParsingStatus: "NOT_PERFORMED";
  oddsParsingStatus: "NOT_PERFORMED";
  gameMatchingStatus: "NOT_PERFORMED";
  acceptedObservationTime: null;
};

export type RawEvidenceTagAuditV0 = {
  tag: RawEvidenceTagV0;
  regionCount: number;
  rowCoverage: number;
  occupiedBandIndexCounts: Record<string, number>;
  normalizedCenterX: PercentileDistribution;
  exampleRawTexts: string[];
};

export type RawEvidenceTagCombinationAuditV0 = {
  combinationKey: string;
  tags: RawEvidenceTagV0[];
  regionCount: number;
  rowCoverage: number;
};

export type RawEvidenceSignatureAuditV0 = {
  signature: string;
  rowCount: number;
};

export type LayoutPatternEvidenceAuditV0 = {
  layoutPatternId: string;
  rowCount: number;
  mostCommonRawEvidenceSignature: string | null;
  mostCommonSignatureCount: number;
  otherSignatureCount: number;
  signatureCounts: RawEvidenceSignatureAuditV0[];
};

export type SemanticRegionCandidatePreviewV0 = {
  previewClass:
    | "EXACT_MARKET_MARKER_RAW_PRESENT"
    | "MULTIPLE_TEXT_BEARING_RAW_REGIONS"
    | "MULTIPLE_NUMERIC_LIKE_RAW_REGIONS"
    | "MIXED_TAG_REGION"
    | "OTHER_RAW";
  sourceFileName: string;
  visualRowIndex: number;
  rowIdentifierCandidate: number | null;
  scheduledLocalCandidate: string | null;
  layoutPatternId: string | null;
  visualJoinedTextCandidate: string;
  rowRawEvidenceSignature: string;
  regions: Array<{
    regionIndex: number;
    rawEvidenceTags: RawEvidenceTagV0[];
    joinedRawText: string;
  }>;
};

export type SemanticRegionCandidatesDocumentV0 = {
  meta: {
    schemaVersion: typeof SEMANTIC_REGION_CANDIDATES_SCHEMA_VERSION;
    protoRoundKey: string;
    year: number;
    round: number;
    sourceColumnLayoutSchema: "proto-round-column-layout-audit-v0";
    sourceImages: number;
    sourceVisualRows: number;
    semanticScope: typeof SEMANTIC_SCOPE;
    bandIndexSemanticMeaning: typeof BAND_INDEX_SEMANTIC_MEANING;
    bandIndexUsedAsSemanticLabel: typeof BAND_INDEX_USED_AS_SEMANTIC_LABEL;
    band1MarketContract: typeof BAND_1_MARKET_CONTRACT;
    rawEvidenceTagComposition: typeof RAW_EVIDENCE_TAG_COMPOSITION;
    rawRegionTextModified: typeof RAW_REGION_TEXT_MODIFIED;
    textBearingRawIsTeam: typeof TEXT_BEARING_RAW_IS_TEAM;
    textBearingRawIsLeague: typeof TEXT_BEARING_RAW_IS_LEAGUE;
    numericLikeRawIsOdds: typeof NUMERIC_LIKE_RAW_IS_ODDS;
    exactMarketMarkerRawIsOfficialMarket: typeof EXACT_MARKET_MARKER_RAW_IS_OFFICIAL_MARKET;
    marketSemanticsAssigned: typeof MARKET_SEMANTICS_ASSIGNED;
    teamParsing: "NOT_PERFORMED";
    leagueParsing: "NOT_PERFORMED";
    marketParsing: "NOT_PERFORMED";
    oddsParsing: "NOT_PERFORMED";
    ocrCorrection: typeof OCR_CORRECTION;
    oddsRepair: typeof OCR_ODDS_REPAIR;
    officialOddsExtraction: "NOT_PERFORMED";
    gameMatching: "NOT_PERFORMED";
    crossImageDedupe: typeof CROSS_IMAGE_ROW_AUTO_DEDUPE;
    acceptedObservationTimes: "NOT_ASSIGNED";
  };
  coverage: {
    totalRows: number;
    totalRegions: number;
    textBearingRawRegions: number;
    textBearingRawRows: number;
    numericLikeRawRegions: number;
    numericLikeRawRows: number;
    exactMarketMarkerRawRegions: number;
    exactMarketMarkerRawRows: number;
    otherRawRegions: number;
    otherRawRows: number;
    invalidNormalizedGeometryRegions: number;
    invalidNormalizedGeometryRows: number;
  };
  tagAudit: RawEvidenceTagAuditV0[];
  tagCombinationAudit: RawEvidenceTagCombinationAuditV0[];
  signatureAudit: RawEvidenceSignatureAuditV0[];
  layoutPatternEvidenceAudit: LayoutPatternEvidenceAuditV0[];
  representativePreviews: SemanticRegionCandidatePreviewV0[];
  rows: ProtoRoundSemanticRegionCandidateV0[];
};
