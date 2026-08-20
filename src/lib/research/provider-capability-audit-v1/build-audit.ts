/**
 * Assemble provider capability audit document.
 */
import type { ProviderCapabilityAuditV1 } from "./types";
import {
  MLB_STATS_API_PUBLIC_PROBE,
  PROVIDER_INVENTORY,
} from "./inventory";
import {
  PROVIDER_GAP_MATRIX,
  countAvailability,
  countBuildVsBuy,
  countIntake,
} from "./catalog";

export function buildProviderCapabilityAuditDocument(input: {
  generatedAt: string;
  gitBefore: ProviderCapabilityAuditV1["gitBefore"];
}): ProviderCapabilityAuditV1 {
  const rows = PROVIDER_GAP_MATRIX;
  return {
    schemaVersion: "yang-edge-provider-capability-audit-v1",
    builderVersion: "provider-capability-audit-builder-v1",
    generatedAt: input.generatedAt,
    researchOnly: true,
    independentModelSample: 0,
    marketInIndependentProbability: false,
    engineAdmission: "PROHIBITED",
    mutation: {
      predictionSnapshotsModified: 0,
      engineWeightsModified: 0,
      predictionLogicModified: 0,
      scorecardModified: 0,
      paidProviderCalls: 0,
    },
    gitBefore: input.gitBefore,
    previousAudits: {
      methodology: "48c9ac86543cdfc1a069bccee931e8ac06a66820",
      playerCondition: "639694c4fddbcb8e352a792c9f736959a13dbe09",
    },
    probe: {
      paidApis: "NOT_EXECUTED",
      paidReason:
        "SportsDataIO / API-Football / API-Baseball / Odds API quota and current plan are CURRENT_PLAN_UNKNOWN. No bulk, no historical sweep, no plan change.",
      mlbStatsApiPublic: MLB_STATS_API_PUBLIC_PROBE,
    },
    providers: PROVIDER_INVENTORY,
    rows,
    availabilityCounts: countAvailability(rows),
    buildVsBuyCounts: countBuildVsBuy(rows),
    intakeCounts: countIntake(rows),
  };
}
