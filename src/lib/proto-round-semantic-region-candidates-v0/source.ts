import {
  COLUMN_LAYOUT_AUDIT_SCHEMA_VERSION,
  COLUMN_LAYOUT_AUDIT_SCOPE,
  type ColumnLayoutAuditDocumentV0,
} from "../proto-round-column-layout-audit-v0/types";

export class SemanticRegionCandidateError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "SemanticRegionCandidateError";
    this.code = code;
  }
}

export function assertColumnLayoutAuditSource(doc: ColumnLayoutAuditDocumentV0): void {
  if (doc.meta.schemaVersion !== COLUMN_LAYOUT_AUDIT_SCHEMA_VERSION) {
    throw new SemanticRegionCandidateError("UNEXPECTED_COLUMN_LAYOUT_SCHEMA");
  }
  if (doc.meta.columnLayoutAuditScope !== COLUMN_LAYOUT_AUDIT_SCOPE) {
    throw new SemanticRegionCandidateError("COLUMN_LAYOUT_SCOPE_NOT_ROUND_DESCRIPTIVE");
  }
  if (doc.meta.discoveredBandsAreProductionContract !== false) {
    throw new SemanticRegionCandidateError("DISCOVERED_BANDS_MARKED_PRODUCTION_CONTRACT");
  }
  if (doc.meta.semanticRegionContractFrozen !== false) {
    throw new SemanticRegionCandidateError("SEMANTIC_REGION_CONTRACT_ALREADY_FROZEN");
  }
  if (doc.meta.regionSemanticRoleAssigned !== false) {
    throw new SemanticRegionCandidateError("REGION_SEMANTIC_ROLE_ALREADY_ASSIGNED");
  }
  if (doc.meta.semanticAssignment !== "NOT_PERFORMED") {
    throw new SemanticRegionCandidateError("SEMANTIC_ASSIGNMENT_ALREADY_PERFORMED");
  }
}
