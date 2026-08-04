/**
 * Football Result Foundation v0 — public exports.
 */
export * from "./types";
export * from "./derive-one-x-two-outcome";
export * from "./normalize-football-result";
export * from "./identity-join";
export * from "./review-result-adapter";
export * from "./resolve-result-usability";
export * from "./build-football-result-view";

import { buildDefaultFootballResultView } from "./build-football-result-view";
import {
  FOOTBALL_RESULT_FOUNDATION_VERSION,
  FOOTBALL_RESULT_RISK_REGISTER_V0,
} from "./types";

export function getFootballResultDeveloperSnapshot(dateKst: string) {
  const view = buildDefaultFootballResultView(dateKst);
  return {
    resultFoundationVersion: FOOTBALL_RESULT_FOUNDATION_VERSION,
    stage: view.slice.resultStage,
    prediction: view.slice.prediction,
    usability: view.developer.usability,
    gateStatus: view.slice.gate.status,
    gradingAllowed: view.slice.gate.gradingAllowed,
    artifactHash: view.developer.artifactHash,
    plainLanguage: view.slice.plainLanguage,
    usableFinalCount: view.slice.usableFinalCount,
    notFinalCount: view.slice.notFinalCount,
    riskCount: FOOTBALL_RESULT_RISK_REGISTER_V0.length,
    sampleRows: view.developer.rows,
  };
}
