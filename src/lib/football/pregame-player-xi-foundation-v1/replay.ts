/**
 * Replay / normalize from stored raw observations.
 * NEVER calls FootballProvider / getInjuries / getLineups / fetch.
 */
import { normalizeApiFootballInjuries } from "./normalize-injuries";
import { normalizeApiFootballLineups } from "./normalize-lineups";
import type {
  FootballAvailabilityDatasetV1,
  FootballAvailabilityNormalizeMeta,
  FootballLineupNormalizeMeta,
  FootballRawPointInTimeObservationV1,
  FootballXiDatasetV1,
} from "./types";

export function replayNormalizeFootballInjuries(
  observation: FootballRawPointInTimeObservationV1,
  meta: Omit<
    FootballAvailabilityNormalizeMeta,
    "observationId" | "observedAt" | "fixtureKickoff" | "providerFixtureId"
  >,
): FootballAvailabilityDatasetV1 {
  if (observation.kind !== "INJURIES") {
    throw new Error("FOOTBALL_RAW_KIND_MISMATCH_INJURIES");
  }
  return normalizeApiFootballInjuries(observation.raw, {
    ...meta,
    observationId: observation.observationId,
    observedAt: observation.observedAt,
    fixtureKickoff: observation.fixtureKickoff,
    providerFixtureId: observation.providerFixtureId,
  });
}

export function replayNormalizeFootballLineups(
  observation: FootballRawPointInTimeObservationV1,
  meta: Omit<
    FootballLineupNormalizeMeta,
    "observationId" | "observedAt" | "fixtureKickoff" | "providerFixtureId"
  >,
): FootballXiDatasetV1 {
  if (observation.kind !== "LINEUPS") {
    throw new Error("FOOTBALL_RAW_KIND_MISMATCH_LINEUPS");
  }
  return normalizeApiFootballLineups(observation.raw, {
    ...meta,
    observationId: observation.observationId,
    observedAt: observation.observedAt,
    fixtureKickoff: observation.fixtureKickoff,
    providerFixtureId: observation.providerFixtureId,
  });
}
