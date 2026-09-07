/**
 * Proto-round first-shot structured extraction v0.
 *
 * RAW structural candidates only. No HOME/AWAY, no official market type,
 * no odds record, no game matching. OCR text is copied unmodified.
 */

import { CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";

export { CROSS_IMAGE_ROW_AUTO_DEDUPE };

export const STRUCTURED_EXTRACTION_SCHEMA_VERSION =
  "proto-round-structured-extraction-v0" as const;
export const STRUCTURED_EXTRACTION_ARTIFACT_FILE_NAME =
  "structured-extraction-v0.json" as const;

export const STRUCTURED_SCOPE = "RAW_STRUCTURAL_CANDIDATES_ONLY" as const;
export const OCR_CORRECTION = "DISABLED" as const;
export const OCR_ODDS_REPAIR = "DISABLED" as const;
export const HOME_AWAY_ASSIGNED = false as const;
export const MARKET_SEMANTICS_ASSIGNED = false as const;
export const OFFICIAL_ODDS_RECORD_CREATED = false as const;
export const GAME_MATCHING = false as const;
export const GROUND_TRUTH_AVAILABLE_TO_PARSER = false as const;
export const HOLDOUT_AVAILABLE_TO_PARSER = false as const;
export const BAND_INDEX_USED_AS_SEMANTIC_LABEL = false as const;

export type FieldParseStatusV0 = "PARSED" | "AMBIGUOUS" | "INSUFFICIENT_EVIDENCE";

export type StructuredExtractionRowV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  visualRowIndex: number;
  screenRowIdentifierCandidateRaw: string | null;
  participantLeftCandidateRaw: string | null;
  participantRightCandidateRaw: string | null;
  marketMarkerCandidateRaw: string | null;
  numericCellsCandidateRaw: string[];
  rowIdentifierParsingStatus: FieldParseStatusV0;
  participantParsingStatus: FieldParseStatusV0;
  marketMarkerParsingStatus: FieldParseStatusV0;
  numericCellsParsingStatus: FieldParseStatusV0;
  rowParsingStatus: FieldParseStatusV0;
  homeAwayAssigned: false;
  marketSemanticsAssigned: false;
  officialOddsRecordCreated: false;
  acceptedObservationTime: null;
};

export type StructuredExtractionDocumentV0 = {
  meta: {
    schemaVersion: typeof STRUCTURED_EXTRACTION_SCHEMA_VERSION;
    protoRoundKey: string;
    year: number;
    round: number;
    sourceSemanticRegionSchema: "proto-round-semantic-region-candidates-v0";
    sourceVisualRows: number;
    structuredScope: typeof STRUCTURED_SCOPE;
    ocrCorrection: typeof OCR_CORRECTION;
    ocrOddsRepair: typeof OCR_ODDS_REPAIR;
    homeAwayAssigned: typeof HOME_AWAY_ASSIGNED;
    marketSemanticsAssigned: typeof MARKET_SEMANTICS_ASSIGNED;
    officialOddsRecordCreated: typeof OFFICIAL_ODDS_RECORD_CREATED;
    gameMatching: typeof GAME_MATCHING;
    groundTruthAvailableToParser: typeof GROUND_TRUTH_AVAILABLE_TO_PARSER;
    holdoutAvailableToParser: typeof HOLDOUT_AVAILABLE_TO_PARSER;
    bandIndexUsedAsSemanticLabel: typeof BAND_INDEX_USED_AS_SEMANTIC_LABEL;
    crossImageDedupe: typeof CROSS_IMAGE_ROW_AUTO_DEDUPE;
    acceptedObservationTimes: "NOT_ASSIGNED";
  };
  coverage: {
    totalRows: number;
    parsedRows: number;
    ambiguousRows: number;
    insufficientEvidenceRows: number;
    rowsWithIdentifier: number;
    rowsWithBothParticipants: number;
    rowsWithMarketMarker: number;
    rowsWithNumericCells: number;
  };
  rows: StructuredExtractionRowV0[];
};
