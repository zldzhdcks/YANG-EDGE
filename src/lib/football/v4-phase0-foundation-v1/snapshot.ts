/**
 * Combine lineup / injury / player-season / squad into one research snapshot.
 * Missing sections stay NOT_AVAILABLE. Do not fill guesses.
 * engineAdmission is always false. No prediction imports. No player scores.
 */
import { classifyFootballV4TemporalProvenance } from "../pregame-player-xi-foundation-v1/temporal";
import { FOOTBALL_V4_PUBLIC_DISPLAY_RIGHTS } from "../pregame-player-xi-foundation-v1/types";
import type { FootballPlayerSeasonDatasetV1, FootballSquadSnapshotV1 } from "../player-context-foundation-v1/types";
import type {
  FootballAvailabilityDatasetV1,
  FootballPlayerIdentityStatus,
  FootballXiDatasetV1,
} from "../pregame-player-xi-foundation-v1/types";
import { evaluateFootballV4Phase0Coverage } from "./coverage";
import type {
  FootballV4PlayerContextSnapshotV1,
  FootballV4SectionEnvelope,
  FootballV4SectionStatus,
} from "./types";
import {
  FOOTBALL_V4_PHASE0_FOUNDATION_VERSION,
  FOOTBALL_V4_PHASE0_SNAPSHOT_SCHEMA,
} from "./types";

function sectionStatusFromXi(
  dataset: FootballXiDatasetV1 | null | undefined,
): FootballV4SectionStatus {
  if (!dataset) return "NOT_AVAILABLE";
  if (dataset.xiAvailabilityStatus === "NOT_AVAILABLE" || dataset.counts.rawRows === 0) {
    return "NOT_AVAILABLE";
  }
  if (
    dataset.xiAvailabilityStatus === "CONFIRMED_XI" &&
    dataset.quality === "COMPLETE"
  ) {
    return "AVAILABLE";
  }
  return "PARTIAL";
}

function sectionStatusFromInjury(
  dataset: FootballAvailabilityDatasetV1 | null | undefined,
): FootballV4SectionStatus {
  if (!dataset) return "NOT_AVAILABLE";
  if (dataset.counts.rawRows === 0) return "NOT_AVAILABLE";
  if (dataset.quality === "COMPLETE") return "AVAILABLE";
  return "PARTIAL";
}

function sectionStatusFromSeason(
  dataset: FootballPlayerSeasonDatasetV1 | null | undefined,
): FootballV4SectionStatus {
  if (!dataset) return "NOT_AVAILABLE";
  if (dataset.counts.rawPlayerItems === 0) return "NOT_AVAILABLE";
  if (dataset.quality === "COMPLETE") return "AVAILABLE";
  return "PARTIAL";
}

function sectionStatusFromSquad(
  dataset: FootballSquadSnapshotV1 | null | undefined,
): FootballV4SectionStatus {
  if (!dataset) return "NOT_AVAILABLE";
  if (dataset.players.length === 0) return "NOT_AVAILABLE";
  if (dataset.quality === "COMPLETE") return "AVAILABLE";
  return "PARTIAL";
}

function envelope<T>(
  status: FootballV4SectionStatus,
  dataset: T | null | undefined,
): FootballV4SectionEnvelope<T> {
  if (status === "NOT_AVAILABLE") {
    return { status, dataset: null };
  }
  return { status, dataset: dataset ?? null };
}

function summarizeIdentity(input: {
  lineup: FootballXiDatasetV1 | null;
  injury: FootballAvailabilityDatasetV1 | null;
  playerSeason: FootballPlayerSeasonDatasetV1 | null;
  squad: FootballSquadSnapshotV1 | null;
}): FootballPlayerIdentityStatus | "MIXED" | "NOT_AVAILABLE" {
  const statuses: FootballPlayerIdentityStatus[] = [];
  for (const team of input.lineup?.observation.teams ?? []) {
    for (const row of [...team.startingXI, ...team.substitutes]) {
      statuses.push(row.player.identityStatus);
    }
  }
  for (const row of input.injury?.rows ?? []) {
    statuses.push(row.player.identityStatus);
  }
  for (const row of input.playerSeason?.rows ?? []) {
    statuses.push(row.identity.identityStatus);
  }
  for (const row of input.squad?.players ?? []) {
    statuses.push(row.identityStatus);
  }
  if (statuses.length === 0) return "NOT_AVAILABLE";
  const unique = new Set(statuses);
  if (unique.size === 1) return statuses[0]!;
  return "MIXED";
}

export function buildFootballV4PlayerContextSnapshot(input: {
  observedAt: string;
  kickoffUtc: string;
  providerFetchedAt?: string | null;
  providerPublishedAt?: string | null;
  snapshotCreatedAt?: string | null;
  providerFixtureId?: string | null;
  providerTeamId?: string | null;
  season?: number | null;
  source: FootballV4PlayerContextSnapshotV1["source"];
  lineup?: FootballXiDatasetV1 | null;
  injury?: FootballAvailabilityDatasetV1 | null;
  playerSeason?: FootballPlayerSeasonDatasetV1 | null;
  squad?: FootballSquadSnapshotV1 | null;
}): FootballV4PlayerContextSnapshotV1 {
  const temporal = classifyFootballV4TemporalProvenance({
    observedAt: input.observedAt,
    kickoffUtc: input.kickoffUtc,
    providerFetchedAt: input.providerFetchedAt,
    providerPublishedAt: input.providerPublishedAt,
  });

  const lineupStatus = sectionStatusFromXi(input.lineup);
  const injuryStatus = sectionStatusFromInjury(input.injury);
  const playerSeasonStatus = sectionStatusFromSeason(input.playerSeason);
  const squadStatus = sectionStatusFromSquad(input.squad);

  const snapshotCore = {
    lineup: envelope(lineupStatus, input.lineup),
    injury: envelope(injuryStatus, input.injury),
    playerSeason: envelope(playerSeasonStatus, input.playerSeason),
    squad: envelope(squadStatus, input.squad),
  };

  const coverage = evaluateFootballV4Phase0Coverage({
    lineup: snapshotCore.lineup.dataset,
    injury: snapshotCore.injury.dataset,
    playerSeason: snapshotCore.playerSeason.dataset,
    squad: snapshotCore.squad.dataset,
    temporalStatus: temporal.temporalStatus,
    identityGateBlocked:
      input.lineup?.observation.identityGate.verdict === "FAIL" ||
      input.injury?.rows.some((r) => r.identityGate.verdict === "FAIL") === true,
  });

  return {
    schemaVersion: FOOTBALL_V4_PHASE0_SNAPSHOT_SCHEMA,
    foundationVersion: FOOTBALL_V4_PHASE0_FOUNDATION_VERSION,
    observedAt: input.observedAt,
    providerFetchedAt: input.providerFetchedAt ?? null,
    providerPublishedAt: input.providerPublishedAt ?? null,
    snapshotCreatedAt: input.snapshotCreatedAt ?? null,
    providerFixtureId: input.providerFixtureId ?? null,
    providerTeamId: input.providerTeamId ?? null,
    season: input.season ?? null,
    source: input.source,
    ...snapshotCore,
    identityStatus: summarizeIdentity({
      lineup: snapshotCore.lineup.dataset,
      injury: snapshotCore.injury.dataset,
      playerSeason: snapshotCore.playerSeason.dataset,
      squad: snapshotCore.squad.dataset,
    }),
    temporalStatus: temporal.temporalStatus,
    coverage,
    engineInput: false,
    engineAdmission: false,
    researchOnly: true,
    predictionInput: false,
    PUBLIC_DISPLAY_RIGHTS: FOOTBALL_V4_PUBLIC_DISPLAY_RIGHTS,
  };
}
