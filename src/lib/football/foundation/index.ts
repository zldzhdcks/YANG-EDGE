/**
 * Football Identity Foundation v0 — public exports.
 *
 * Player / availability / XI normalization lives in
 * `src/lib/football/pregame-player-xi-foundation-v1/` (P0 data foundation;
 * not a Prediction engine).
 */
export * from "./types";
export * from "./competition-registry";
export * from "./team-registry";
export * from "./match-identity";
export * from "./identity-gate";
export * from "./schedule-artifact-contract";
export * from "./reuse-matrix";
export * from "./risk-register";
export * from "./operation-memory-slice";

import { listCompetitions } from "./competition-registry";
import { buildFootballIdentityOperationSlice } from "./operation-memory-slice";
import { FOOTBALL_IDENTITY_RISK_REGISTER_V0 } from "./risk-register";
import { listTeams } from "./team-registry";
import { FOOTBALL_IDENTITY_VERSION } from "./types";

export function getFootballIdentityDeveloperSnapshot() {
  const slice = buildFootballIdentityOperationSlice();
  return {
    identityVersion: FOOTBALL_IDENTITY_VERSION,
    stage: slice.stage,
    competitions: listCompetitions().length,
    teams: listTeams().filter((t) => t.active).length,
    gateModule: "evaluateFootballIdentityGate",
    riskCount: FOOTBALL_IDENTITY_RISK_REGISTER_V0.length,
    predictionSurface: "NONE" as const,
  };
}
