/**
 * Replay / normalize from stored raw player-context observations.
 * NEVER calls FootballProvider / getPlayers / getPlayerSquad / getCoaches / fetch.
 */
import { normalizeApiFootballCoaches } from "./normalize-coaches";
import { normalizeApiFootballPlayers } from "./normalize-players";
import { normalizeApiFootballSquad } from "./normalize-squads";
import type {
  FootballCoachSnapshotV1,
  FootballPlayerContextNormalizeMeta,
  FootballPlayerSeasonDatasetV1,
  FootballRawPlayerContextObservationV1,
  FootballSquadSnapshotV1,
} from "./types";

export function replayNormalizeFootballPlayers(
  observation: FootballRawPlayerContextObservationV1,
  meta: FootballPlayerContextNormalizeMeta,
): FootballPlayerSeasonDatasetV1 {
  if (observation.kind !== "PLAYERS" || observation.endpoint !== "/players") {
    throw new Error("FOOTBALL_RAW_KIND_MISMATCH_PLAYERS");
  }
  return normalizeApiFootballPlayers(observation, meta);
}

export function replayNormalizeFootballSquad(
  observation: FootballRawPlayerContextObservationV1,
  meta: FootballPlayerContextNormalizeMeta,
): FootballSquadSnapshotV1 {
  if (observation.kind !== "SQUADS" || observation.endpoint !== "/players/squads") {
    throw new Error("FOOTBALL_RAW_KIND_MISMATCH_SQUADS");
  }
  return normalizeApiFootballSquad(observation, meta);
}

export function replayNormalizeFootballCoaches(
  observation: FootballRawPlayerContextObservationV1,
  meta: FootballPlayerContextNormalizeMeta,
): FootballCoachSnapshotV1 {
  if (observation.kind !== "COACHES" || observation.endpoint !== "/coachs") {
    throw new Error("FOOTBALL_RAW_KIND_MISMATCH_COACHES");
  }
  return normalizeApiFootballCoaches(observation, meta);
}
