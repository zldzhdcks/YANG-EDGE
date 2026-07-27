/**
 * Research Framework v1 — public exports.
 */
export { RESEARCH_FRAMEWORK_VERSION } from "./hash";
export {
  buildResearchInputHash,
  buildResearchResultHash,
  sha256Hex,
  stableStringify,
  verifyResearchHash,
} from "./hash";
export type { ResearchHashInput, ResearchHashVerifier } from "./hash";

export { createResearchAuditShell } from "./audit";
export type {
  ResearchAuditCacheStats,
  ResearchAuditReport,
  ResearchAuditTotals,
} from "./audit";

export { emptyScorecard } from "./scorecard";
export type {
  ResearchScorecardDimension,
  ResearchVariableScorecard,
  ScorecardVerdict,
} from "./scorecard";

export {
  assertHypothesisStatusGuard,
  createHypothesisLink,
} from "./hypothesis";
export type {
  HypothesisRegistryFile,
  LinkedHypothesisStatus,
  ResearchHypothesisLink,
} from "./hypothesis";

export {
  RESEARCH_DATASET_REGISTRY,
  bullpenV11FrameworkMetadata,
  starterV1FrameworkMetadata,
  getRegistryEntry,
  listDatasetsByStatus,
} from "./registry";

export type {
  ResearchDatasetBase,
  ResearchDatasetMetadata,
  ResearchDatasetRegistryEntry,
  ResearchDatasetStatus,
  ResearchLegalMeta,
  ResearchLeagueScope,
  ResearchSourceLabel,
  ResearchVersionPolicy,
} from "./types";
