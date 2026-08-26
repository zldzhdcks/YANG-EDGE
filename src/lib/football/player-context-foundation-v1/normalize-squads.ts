/**
 * Normalize API-Football /players/squads raw response.
 * Pure / deterministic / network-free. observedAt comes from observation metadata.
 *
 * Squad membership at observedAt is roster evidence only.
 * It does not imply starter, availability, or expected XI.
 */
import { resolveFootballPlayerIdentity, resolvePlayerContextTeamAttachment } from "./identity";
import { asNullableId, asNullableNumber, asNullableString } from "./read-fields";
import { classifyPlayerContextTemporal } from "./temporal";
import type {
  FootballPlayerContextDatasetQuality,
  FootballPlayerContextNormalizeMeta,
  FootballRawPlayerContextObservationV1,
  FootballSquadPlayerV1,
  FootballSquadSnapshotV1,
} from "./types";

type SquadEnvelope = {
  team?: { id?: unknown; name?: unknown };
  players?: unknown;
};

function extractSquadBlocks(raw: unknown): SquadEnvelope[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    return raw.filter((row) => row && typeof row === "object") as SquadEnvelope[];
  }
  if (raw && typeof raw === "object") {
    const obj = raw as { response?: unknown; raw?: unknown };
    if (Array.isArray(obj.response)) return extractSquadBlocks(obj.response);
    if (Array.isArray(obj.raw)) return extractSquadBlocks(obj.raw);
    if ("team" in obj || "players" in obj) return [obj as SquadEnvelope];
  }
  return [];
}

function qualityForSquad(input: {
  players: FootballSquadPlayerV1[];
  identityBlocked: boolean;
  postKickoffOnly: boolean;
}): FootballPlayerContextDatasetQuality {
  if (input.identityBlocked) return "IDENTITY_BLOCKED";
  if (input.postKickoffOnly) return "POST_KICKOFF_ONLY";
  if (input.players.length === 0) return "EMPTY_PROVIDER_RESPONSE";
  if (input.players.some((p) => p.identityStatus === "PLAYER_IDENTITY_REVIEW_REQUIRED")) {
    return "PARTIAL";
  }
  return "COMPLETE";
}

export function normalizeApiFootballSquad(
  observation: FootballRawPlayerContextObservationV1,
  meta: FootballPlayerContextNormalizeMeta,
): FootballSquadSnapshotV1 {
  const temporal = classifyPlayerContextTemporal({
    observedAt: observation.observedAt,
    fixtureKickoff: meta.fixtureKickoff,
  });
  const blocks = extractSquadBlocks(observation.rawResponse);
  const first = blocks[0] ?? {};
  const providerTeamId =
    asNullableId(first.team?.id) ?? observation.providerTeamId;
  const teamName = asNullableString(first.team?.name);
  const attach = resolvePlayerContextTeamAttachment({
    providerTeamId,
    providerTeamName: teamName,
    identityGate: meta.identityGate,
  });

  const rawPlayers = Array.isArray(first.players) ? first.players : [];
  const players: FootballSquadPlayerV1[] = rawPlayers.map((row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const identity = resolveFootballPlayerIdentity({
      providerPlayerId: asNullableId(item.id),
      providerTeamId,
      canonicalTeamId: attach.canonicalTeamId,
      playerName: asNullableString(item.name),
    });
    return {
      providerPlayerId: identity.providerPlayerId,
      canonicalPlayerId: null,
      name: identity.playerName,
      age: asNullableNumber(item.age),
      number: asNullableNumber(item.number),
      position: asNullableString(item.position),
      photo: asNullableString(item.photo),
      identityStatus: identity.identityStatus,
      impliesStarter: false,
      impliesAvailability: false,
      impliesExpectedXi: false,
    };
  });

  const identityBlocked = !attach.canonicalTeamAttached;
  const postKickoffOnly = temporal.observationPhase === "POST_KICKOFF_INVALID_FOR_PREGAME";

  return {
    schemaVersion: "yang-edge-football-squad-snapshot-v1",
    foundationVersion: "football-player-stats-squad-coach-foundation-v1",
    observationId: observation.observationId,
    providerTeamId,
    canonicalTeamId: attach.canonicalTeamId,
    canonicalTeamAttached: attach.canonicalTeamAttached,
    operatorGameAttached: attach.operatorGameAttached,
    observedAt: observation.observedAt,
    teamName,
    players,
    quality: qualityForSquad({
      players,
      identityBlocked,
      postKickoffOnly,
    }),
    rosterSemantics: "CURRENT_AT_OBSERVED_AT",
    impliesStarter: false,
    impliesAvailability: false,
    impliesExpectedXi: false,
    pregameEligible: temporal.pregameEligible,
    observationPhase: temporal.observationPhase,
    identityGate: meta.identityGate
      ? {
          verdict: meta.identityGate.verdict,
          reasonCodes: meta.identityGate.reasonCodes,
          predictionAllowed: meta.identityGate.predictionAllowed,
        }
      : null,
    engineConnected: false,
    predictionConnected: false,
    predictionInput: false,
    engineInput: false,
    researchOnly: true,
  };
}
