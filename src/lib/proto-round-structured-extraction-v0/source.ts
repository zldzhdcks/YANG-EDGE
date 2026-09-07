import {
  SEMANTIC_REGION_CANDIDATES_SCHEMA_VERSION,
  SEMANTIC_SCOPE,
  type SemanticRegionCandidatesDocumentV0,
} from "../proto-round-semantic-region-candidates-v0/types";

export class StructuredExtractionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "StructuredExtractionError";
    this.code = code;
  }
}

export function assertSemanticRegionSource(doc: SemanticRegionCandidatesDocumentV0): void {
  if (doc.meta.schemaVersion !== SEMANTIC_REGION_CANDIDATES_SCHEMA_VERSION) {
    throw new StructuredExtractionError("UNEXPECTED_SEMANTIC_REGION_SCHEMA");
  }
  if (doc.meta.semanticScope !== SEMANTIC_SCOPE) {
    throw new StructuredExtractionError("SEMANTIC_SCOPE_NOT_RAW_EVIDENCE");
  }
  if (doc.meta.bandIndexUsedAsSemanticLabel !== false) {
    throw new StructuredExtractionError("BAND_INDEX_USED_AS_SEMANTIC_LABEL");
  }
  if (doc.meta.marketSemanticsAssigned !== false) {
    throw new StructuredExtractionError("MARKET_SEMANTICS_ALREADY_ASSIGNED");
  }
  if (doc.meta.teamParsing !== "NOT_PERFORMED") {
    throw new StructuredExtractionError("TEAM_PARSING_ALREADY_PERFORMED");
  }
  if (doc.meta.officialOddsExtraction !== "NOT_PERFORMED") {
    throw new StructuredExtractionError("OFFICIAL_ODDS_ALREADY_EXTRACTED");
  }
}
