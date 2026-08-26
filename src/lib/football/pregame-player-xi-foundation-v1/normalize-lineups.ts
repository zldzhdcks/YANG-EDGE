/**
 * Normalize API-Football /fixtures/lineups raw response.
 * Pure / deterministic / network-free.
 * Does not classify EXPECTED_XI. Does not invent missing players.
 */
import { createHash } from "node:crypto";
import { resolveFootballTeamAttachment } from "./identity-attach";
import { resolveFootballPlayerIdentity } from "./player-identity";
import { classifyFootballObservationPhase } from "./temporal";
import type {
  FootballDatasetQuality,
  FootballLineupNormalizeMeta,
  FootballLineupObservationType,
  FootballXiDatasetV1,
  FootballXiPlayerV1,
  FootballXiTeamObservationV1,
} from "./types";

type LineupPlayerRaw = {
  player?: {
    id?: number | null;
    name?: string | null;
    number?: number | null;
    pos?: string | null;
    grid?: string | null;
  };
};

type LineupTeamRaw = {
  team?: { id?: number | null; name?: string | null };
  coach?: { id?: number | null; name?: string | null };
  formation?: string | null;
  startXI?: LineupPlayerRaw[];
  substitutes?: LineupPlayerRaw[];
};

function asArray(raw: unknown): LineupTeamRaw[] {
  if (Array.isArray(raw)) return raw as LineupTeamRaw[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { response?: unknown }).response)) {
    return (raw as { response: LineupTeamRaw[] }).response;
  }
  return [];
}

function hashRaw(raw: unknown): string {
  return createHash("sha256").update(JSON.stringify(raw), "utf8").digest("hex");
}

function mapPlayers(
  rows: LineupPlayerRaw[] | undefined,
  providerTeamId: string | null,
  canonicalTeamId: string | null,
): FootballXiPlayerV1[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      player: resolveFootballPlayerIdentity({
        providerPlayerId: row.player?.id ?? null,
        providerTeamId,
        canonicalTeamId,
        playerName: row.player?.name ?? null,
      }),
      number: typeof row.player?.number === "number" ? row.player.number : null,
      position: row.player?.pos?.trim() ? row.player.pos.trim() : null,
      grid: row.player?.grid?.trim() ? row.player.grid.trim() : null,
    }));
}

function lineupType(
  semantic: FootballLineupNormalizeMeta["lineupSemantic"],
): FootballLineupObservationType {
  if (semantic === "OFFICIAL_CONFIRMED") return "CONFIRMED";
  return "UNCLASSIFIED_PROVIDER_LINEUP";
}

function qualityForXi(input: {
  rawRows: number;
  teams: FootballXiTeamObservationV1[];
  identityBlocked: boolean;
  pregameEligible: boolean;
}): FootballDatasetQuality {
  if (input.identityBlocked && input.teams.every((t) => !t.operatorGameAttached)) {
    return "IDENTITY_BLOCKED";
  }
  if (input.rawRows === 0) return "EMPTY_PROVIDER_RESPONSE";
  if (!input.pregameEligible) return "POST_KICKOFF_ONLY";
  const starters = input.teams.reduce((n, t) => n + t.startingXI.length, 0);
  if (starters === 0) return "PARTIAL";
  if (
    input.teams.some((t) =>
      [...t.startingXI, ...t.substitutes].some(
        (p) => p.player.identityStatus === "PLAYER_IDENTITY_REVIEW_REQUIRED",
      ),
    )
  ) {
    return "PARTIAL";
  }
  return "COMPLETE";
}

export function normalizeApiFootballLineups(
  raw: unknown,
  meta: FootballLineupNormalizeMeta,
): FootballXiDatasetV1 {
  const temporal = classifyFootballObservationPhase({
    observedAt: meta.observedAt,
    fixtureKickoff: meta.fixtureKickoff,
  });
  const items = asArray(raw);
  const sourceArtifactHash = meta.sourceArtifactHash || hashRaw(raw);
  const identityBlocked = meta.identityGate.verdict !== "PASS";
  const observationType = lineupType(meta.lineupSemantic);

  const teams: FootballXiTeamObservationV1[] = items.map((item) => {
    const providerTeamId = item.team?.id == null ? null : String(item.team.id);
    const attach = resolveFootballTeamAttachment({
      identityGate: meta.identityGate,
      providerTeamId,
      providerTeamName: item.team?.name ?? null,
    });
    return {
      providerFixtureId: meta.providerFixtureId,
      providerTeamId,
      canonicalTeamId: attach.canonicalTeamId,
      formation: item.formation?.trim() ? item.formation.trim() : null,
      coach: {
        providerCoachId:
          item.coach?.id == null ? null : String(item.coach.id),
        coachName: item.coach?.name?.trim() ? item.coach.name.trim() : null,
      },
      startingXI: mapPlayers(item.startXI, providerTeamId, attach.canonicalTeamId),
      substitutes: mapPlayers(item.substitutes, providerTeamId, attach.canonicalTeamId),
      lineupObservationType: observationType,
      attachmentKind: attach.attachmentKind,
      operatorGameAttached: attach.operatorGameAttached,
    };
  });

  const startingPlayersObserved = teams.reduce((n, t) => n + t.startingXI.length, 0);
  const substitutesObserved = teams.reduce((n, t) => n + t.substitutes.length, 0);
  const unknownPlayerIdentityRows = teams.reduce(
    (n, t) =>
      n +
      [...t.startingXI, ...t.substitutes].filter(
        (p) => p.player.identityStatus === "PLAYER_IDENTITY_REVIEW_REQUIRED",
      ).length,
    0,
  );

  const observation = {
    schemaVersion: "yang-edge-football-xi-observation-v1" as const,
    observationId: meta.observationId,
    observedAt: meta.observedAt,
    fixtureKickoff: meta.fixtureKickoff,
    isBeforeKickoff: temporal.isBeforeKickoff,
    pregameEligible: temporal.pregameEligible,
    observationPhase: temporal.observationPhase,
    sourceProvider: "api-football" as const,
    sourceArtifactHash,
    teams,
    identityGate: {
      verdict: meta.identityGate.verdict,
      reasonCodes: meta.identityGate.reasonCodes,
      predictionAllowed: meta.identityGate.predictionAllowed,
    },
    predictionInput: false as const,
    engineInput: false as const,
    researchOnly: true as const,
  };

  return {
    schemaVersion: "yang-edge-football-xi-dataset-v1",
    foundationVersion: "football-pregame-player-xi-foundation-v1",
    observationId: meta.observationId,
    sourceArtifactHash,
    observation,
    quality: qualityForXi({
      rawRows: items.length,
      teams,
      identityBlocked,
      pregameEligible: temporal.pregameEligible,
    }),
    counts: {
      rawRows: items.length,
      normalizedRows: teams.length,
      unknownPlayerIdentityRows,
      teamsObserved: teams.length,
      startingPlayersObserved,
      substitutesObserved,
    },
    engineConnected: false,
    predictionConnected: false,
    predictionInput: false,
    engineInput: false,
  };
}
