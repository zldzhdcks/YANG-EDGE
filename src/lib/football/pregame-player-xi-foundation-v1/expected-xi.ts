/**
 * Expected XI contract helpers.
 * v1 does not collect or fabricate Expected XI.
 * MODEL_INFERRED_EXPECTED_XI is prohibited.
 */
import type { FootballExpectedXiContractV1 } from "./types";

export function assertExpectedXiNotFabricated(): void {
  // Schema-only mission. No expected starters from model or from /fixtures/lineups.
}

export function emptyExpectedXiNotCollected(input: {
  providerFixtureId: string;
  observedAt: string;
  sourceType: FootballExpectedXiContractV1["sourceType"];
}): FootballExpectedXiContractV1 {
  return {
    schemaVersion: "yang-edge-football-expected-xi-contract-v1",
    sourceType: input.sourceType,
    observedAt: input.observedAt,
    sourceStatus: "NOT_COLLECTED_IN_V1",
    providerFixtureId: input.providerFixtureId,
    providerTeamId: null,
    canonicalTeamId: null,
    expectedStarters: [],
    evidenceProvenance: "CONTRACT_ONLY_NO_ROWS",
    predictionInput: false,
    engineInput: false,
  };
}
