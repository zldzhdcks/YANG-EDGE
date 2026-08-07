/**
 * Engine-Only Recommendation Provenance Guard v1
 * Presentation / audit only — does not change Engine / Prediction / weights.
 */

export const RECOMMENDATION_PROVENANCE_SCHEMA =
  "yang-edge-recommendation-provenance-v1" as const;

/**
 * First KST date on which Daily Picks may seal ENGINE_SNAPSHOT delivery records.
 * Earlier dates without an immutable delivery log are RECONSTRUCTED only.
 */
export const ENGINE_RECOMMENDATION_RECORD_EPOCH = "2026-08-08" as const;

export type RecommendationSourceType =
  | "ENGINE_SNAPSHOT"
  | "RECONSTRUCTED"
  | "MANUAL_CTO_OPINION"
  | "NO_PREGAME_SNAPSHOT";

export type SnapshotProvenanceStatus =
  | "PRE_GAME_SNAPSHOT_VERIFIED"
  | "SNAPSHOT_PRESENT_UNVERIFIED"
  | "SNAPSHOT_AFTER_START"
  | "NO_PREGAME_SNAPSHOT"
  | "HASH_MISMATCH";

export type RecommendationProvenance = {
  sourceType: RecommendationSourceType;
  predictionDate: string;
  predictionHash: string | null;
  snapshotCreatedAt: string | null;
  generatedBeforeGame: boolean | null;
  predictionContract: string | null;
  pickTier: string | null;
  researchOnly: boolean;
  inputStatus: string | null;
  /** Eligible for Strong/Good user recommendation surface */
  userRecommendationEligible: boolean;
  /** Eligible for official Good Pick Record / accuracy */
  recordEligible: boolean;
};

export type SlateProvenanceBanner = {
  status: SnapshotProvenanceStatus;
  predictionStatusLine: string;
  snapshotDate: string | null;
  generatedLine: string;
  predictionHash: string | null;
  predictionHashShort: string | null;
  recommendationSourceLine: string;
  hashVerified: boolean;
  generatedBeforeGame: boolean | null;
  allowEngineRecommendations: boolean;
};

/** Immutable delivery record — what was shown to the user */
export type EngineRecommendationRecordV1 = {
  schemaVersion: "yang-edge-engine-recommendation-record-v1";
  dateKst: string;
  predictionHash: string;
  snapshotCreatedAt: string;
  deliveredAt: string;
  generatedBeforeGame: boolean;
  predictionContract: string;
  sourceType: "ENGINE_SNAPSHOT";
  picks: Array<{
    date: string;
    gamePk: number | null;
    gameId: string;
    pick: string | null;
    tier: "STRONG" | "GOOD";
    probability: number | null;
    confidence: number | null;
    sourceType: "ENGINE_SNAPSHOT";
    predictionHash: string;
    snapshotCreatedAt: string;
    deliveredAt: string;
    researchOnly: boolean;
    inputStatus: string | null;
    pickSide: "HOME" | "AWAY" | null;
    matchupLine: string;
  }>;
};
