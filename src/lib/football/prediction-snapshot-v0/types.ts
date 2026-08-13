/**
 * Football Prediction Input Snapshot v0 — types.
 * Freeze of Schedule + Odds research inputs. No model, pick, or Engine.
 */
import type { FootballLegalStatus, FootballScheduleRowV1 } from "../core/types";
import type { Football1x2OddsObservationV1 } from "../odds-1x2-v1/types";

export const FOOTBALL_PREDICTION_SNAPSHOT_V0_SCHEMA =
  "football-prediction-snapshot-v0" as const;
export const FOOTBALL_PREDICTION_SNAPSHOT_V0_BUILDER =
  "football-prediction-snapshot-builder-v0" as const;
export const FOOTBALL_SNAPSHOT_SELECTION_POLICY =
  "LATEST_PREGAME_USABLE_AT_OR_BEFORE_FREEZE" as const;

export type FootballSnapshotSelectionPolicy =
  typeof FOOTBALL_SNAPSHOT_SELECTION_POLICY;

export const FOOTBALL_SNAPSHOT_MATCH_STATUSES = [
  "FROZEN",
  "NO_USABLE_ODDS_BEFORE_FREEZE",
  "MISSED_SNAPSHOT_FREEZE_WINDOW",
  "NOT_ELIGIBLE_FORMAT",
  "COMPETITION_BLOCKED",
  "IDENTITY_BLOCKED",
  "UNKNOWN_ELIGIBILITY",
] as const;

export type FootballSnapshotMatchStatus =
  (typeof FOOTBALL_SNAPSHOT_MATCH_STATUSES)[number];

export function isFootballSnapshotMatchStatus(
  value: unknown,
): value is FootballSnapshotMatchStatus {
  return (
    typeof value === "string" &&
    (FOOTBALL_SNAPSHOT_MATCH_STATUSES as readonly string[]).includes(value)
  );
}

export type FootballSnapshotMatchV0 = {
  matchId: string;
  snapshotStatus: FootballSnapshotMatchStatus;
  frozenScheduleRow: FootballScheduleRowV1;
  frozenOddsObservation: Football1x2OddsObservationV1 | null;
  selectedOddsObservationId: string | null;
  selectedOddsObservationHash: string | null;
  afterFreezeObservationCount: number;
  reasonCodes: string[];
  researchOnly: true;
};

export type FootballPredictionSnapshotV0 = {
  meta: {
    schemaVersion: typeof FOOTBALL_PREDICTION_SNAPSHOT_V0_SCHEMA;
    builderVersion: typeof FOOTBALL_PREDICTION_SNAPSHOT_V0_BUILDER;
    dateKst: string;
    generatedAt: string;
    freezeAt: string;
    researchOnly: true;
    legalStatus: FootballLegalStatus;
    prediction: "NONE";
    engine: "NONE";
    selectionPolicy: FootballSnapshotSelectionPolicy;
    sourceScheduleRel: string;
    sourceScheduleArtifactHashAtFreeze: string;
    sourceOddsRel: string;
    sourceOddsArtifactHashAtFreeze: string;
    scheduleGames: number;
    eligibleGames: number;
    frozenGames: number;
    noUsableOddsGames: number;
    notEligibleGames: number;
    blockedGames: number;
    unknownEligibilityGames: number;
    missedFreezeWindowGames: number;
    snapshotHash: string;
  };
  matches: FootballSnapshotMatchV0[];
};
