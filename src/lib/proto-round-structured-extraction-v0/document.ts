import { CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";
import type { SemanticRegionCandidatesDocumentV0 } from "../proto-round-semantic-region-candidates-v0/types";
import { parseStructuredRowV0 } from "./parser";
import { assertSemanticRegionSource } from "./source";
import {
  BAND_INDEX_USED_AS_SEMANTIC_LABEL,
  GAME_MATCHING,
  GROUND_TRUTH_AVAILABLE_TO_PARSER,
  HOLDOUT_AVAILABLE_TO_PARSER,
  HOME_AWAY_ASSIGNED,
  MARKET_SEMANTICS_ASSIGNED,
  OCR_CORRECTION,
  OCR_ODDS_REPAIR,
  OFFICIAL_ODDS_RECORD_CREATED,
  STRUCTURED_EXTRACTION_SCHEMA_VERSION,
  STRUCTURED_SCOPE,
  type StructuredExtractionDocumentV0,
  type StructuredExtractionRowV0,
} from "./types";

export function buildStructuredExtractionDocumentV0(
  source: SemanticRegionCandidatesDocumentV0,
): StructuredExtractionDocumentV0 {
  assertSemanticRegionSource(source);
  const rows: StructuredExtractionRowV0[] = source.rows.map((row) => parseStructuredRowV0(row));
  const parsedRows = rows.filter((r) => r.rowParsingStatus === "PARSED").length;
  const ambiguousRows = rows.filter((r) => r.rowParsingStatus === "AMBIGUOUS").length;
  const insufficientEvidenceRows = rows.filter(
    (r) => r.rowParsingStatus === "INSUFFICIENT_EVIDENCE",
  ).length;
  return {
    meta: {
      schemaVersion: STRUCTURED_EXTRACTION_SCHEMA_VERSION,
      protoRoundKey: source.meta.protoRoundKey,
      year: source.meta.year,
      round: source.meta.round,
      sourceSemanticRegionSchema: "proto-round-semantic-region-candidates-v0",
      sourceVisualRows: rows.length,
      structuredScope: STRUCTURED_SCOPE,
      ocrCorrection: OCR_CORRECTION,
      ocrOddsRepair: OCR_ODDS_REPAIR,
      homeAwayAssigned: HOME_AWAY_ASSIGNED,
      marketSemanticsAssigned: MARKET_SEMANTICS_ASSIGNED,
      officialOddsRecordCreated: OFFICIAL_ODDS_RECORD_CREATED,
      gameMatching: GAME_MATCHING,
      groundTruthAvailableToParser: GROUND_TRUTH_AVAILABLE_TO_PARSER,
      holdoutAvailableToParser: HOLDOUT_AVAILABLE_TO_PARSER,
      bandIndexUsedAsSemanticLabel: BAND_INDEX_USED_AS_SEMANTIC_LABEL,
      crossImageDedupe: CROSS_IMAGE_ROW_AUTO_DEDUPE,
      acceptedObservationTimes: "NOT_ASSIGNED",
    },
    coverage: {
      totalRows: rows.length,
      parsedRows,
      ambiguousRows,
      insufficientEvidenceRows,
      rowsWithIdentifier: rows.filter((r) => r.screenRowIdentifierCandidateRaw != null).length,
      rowsWithBothParticipants: rows.filter(
        (r) => r.participantLeftCandidateRaw != null && r.participantRightCandidateRaw != null,
      ).length,
      rowsWithMarketMarker: rows.filter((r) => r.marketMarkerCandidateRaw != null).length,
      rowsWithNumericCells: rows.filter((r) => r.numericCellsCandidateRaw.length > 0).length,
    },
    rows,
  };
}
