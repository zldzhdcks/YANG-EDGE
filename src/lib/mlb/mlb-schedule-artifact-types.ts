/**
 * MLB Schedule Artifact v1 — research-only game list for Schedule → Starter → Odds.
 */

export const MLB_SCHEDULE_DATASET_ID = "mlb-schedule";
export const MLB_SCHEDULE_SCHEMA_VERSION = "mlb-schedule-v1";
export const MLB_SCHEDULE_BUILDER_VERSION = "schedule-artifact-builder-v1";

export type MlbScheduleArtifactGame = {
  internalGameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  startTimeKst: string | null;
  commenceTimeUtc: string;
  /** Alias of commenceTimeUtc for timestamp contract clarity. */
  scheduledStartTime?: string;
  officialDate: string;
  statusAbstract: string;
  /** MLB Stats API status.detailedState (Warmup, Pre-Game, In Progress, …). */
  statusDetailed: string | null;
  /** MLB Stats API status.codedGameState when present. */
  codedGameState: string | null;
  collectedAt?: string;
  source?: "mlb-stats-api";
  league: "MLB";
};

export type MlbScheduleArtifactDocument = {
  meta: {
    datasetId: typeof MLB_SCHEDULE_DATASET_ID;
    schemaVersion: typeof MLB_SCHEDULE_SCHEMA_VERSION;
    builderVersion: typeof MLB_SCHEDULE_BUILDER_VERSION;
    dateKst: string;
    generatedAt: string;
    source: "mlb-stats-api";
    researchOnly: true;
    engineAdmission: "PROHIBITED";
    engineConnected: false;
  };
  summary: {
    totalGames: number;
  };
  games: MlbScheduleArtifactGame[];
};
