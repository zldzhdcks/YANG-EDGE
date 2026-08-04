/**
 * Football 1X2 Odds Foundation v0 — public exports.
 */
export * from "./types";
export * from "./validate-one-x-two-odds";
export * from "./compute-devig-probabilities";
export * from "./identity-join";
export * from "./resolve-odds-usability";
export * from "./build-football-odds-view";

import { buildDefaultFootballOddsView } from "./build-football-odds-view";
import { FOOTBALL_1X2_OVERROUND_CONFIG, FOOTBALL_ODDS_FOUNDATION_VERSION } from "./types";

export function getFootballOddsDeveloperSnapshot(dateKst: string) {
  const view = buildDefaultFootballOddsView(dateKst);
  return {
    oddsFoundationVersion: FOOTBALL_ODDS_FOUNDATION_VERSION,
    stage: view.slice.oddsStage,
    prediction: view.slice.prediction,
    usability: view.developer.usability,
    gateStatus: view.slice.gate.status,
    predictionAllowed: view.slice.gate.predictionAllowed,
    overroundConfig: FOOTBALL_1X2_OVERROUND_CONFIG,
    artifactHash: view.developer.artifactHash,
    plainLanguage: view.slice.gate.plainLanguage,
    namespaces: view.developer.namespaces,
  };
}
