/**
 * Normalize API-Football /players raw response.
 * Pure / deterministic / network-free. observedAt comes from observation metadata.
 *
 * Each statistics[] entry becomes its own row. No silent collapse.
 * Missing fields stay null. Explicit 0 is preserved. No invented zeros.
 * Provider typo `appearences` is mapped to appearances.
 */
import { createHash } from "node:crypto";
import { resolveFootballPlayerIdentity, resolvePlayerContextTeamAttachment } from "./identity";
import { asNullableBoolean, asNullableId, asNullableNumber, asNullableString } from "./read-fields";
import { classifyPlayerContextTemporal } from "./temporal";
import type {
  FootballPlayerContextDatasetQuality,
  FootballPlayerContextNormalizeMeta,
  FootballPlayerSeasonDatasetV1,
  FootballPlayerSeasonStatV1,
  FootballRawPlayerContextObservationV1,
} from "./types";

type PlayerRaw = {
  player?: {
    id?: unknown;
    name?: unknown;
    firstname?: unknown;
    lastname?: unknown;
    age?: unknown;
    nationality?: unknown;
    height?: unknown;
    weight?: unknown;
    injured?: unknown;
    photo?: unknown;
  };
  statistics?: unknown;
};

function hashRaw(raw: unknown): string {
  return createHash("sha256").update(JSON.stringify(raw), "utf8").digest("hex");
}

export function extractApiFootballPlayerItems(raw: unknown): PlayerRaw[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    const first = raw[0];
    if (first && typeof first === "object" && "player" in first) {
      return raw as PlayerRaw[];
    }
    if (first && typeof first === "object" && "page" in first && "raw" in first) {
      return (raw as Array<{ raw?: unknown }>).flatMap((page) =>
        extractApiFootballPlayerItems(page.raw),
      );
    }
  }
  if (raw && typeof raw === "object") {
    const obj = raw as { response?: unknown; raw?: unknown; pages?: unknown };
    if (Array.isArray(obj.response)) return extractApiFootballPlayerItems(obj.response);
    if (Array.isArray(obj.raw)) return extractApiFootballPlayerItems(obj.raw);
    if (Array.isArray(obj.pages)) return extractApiFootballPlayerItems(obj.pages);
  }
  return [];
}

function asStatisticsArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  return value.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
}

function nested(obj: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
  const value = obj?.[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function qualityForPlayers(input: {
  rawPlayerItems: number;
  rows: FootballPlayerSeasonStatV1[];
  identityBlocked: boolean;
  truncated: boolean;
}): FootballPlayerContextDatasetQuality {
  if (input.identityBlocked && input.rows.every((r) => !r.canonicalTeamAttached)) {
    return "IDENTITY_BLOCKED";
  }
  if (input.rawPlayerItems === 0) return "EMPTY_PROVIDER_RESPONSE";
  if (input.rows.length > 0 && input.rows.every((r) => !r.pregameEligible) &&
      input.rows.every((r) => r.observationPhase === "POST_KICKOFF_INVALID_FOR_PREGAME")) {
    return "POST_KICKOFF_ONLY";
  }
  if (input.truncated) return "TRUNCATED_PAGINATION";
  if (
    input.rows.some(
      (r) => r.identity.identityStatus === "PLAYER_IDENTITY_REVIEW_REQUIRED",
    )
  ) {
    return "PARTIAL";
  }
  return "COMPLETE";
}

export function normalizeApiFootballPlayers(
  observation: FootballRawPlayerContextObservationV1,
  meta: FootballPlayerContextNormalizeMeta,
): FootballPlayerSeasonDatasetV1 {
  const temporal = classifyPlayerContextTemporal({
    observedAt: observation.observedAt,
    fixtureKickoff: meta.fixtureKickoff,
  });
  const items = extractApiFootballPlayerItems(observation.rawResponse);
  const rows: FootballPlayerSeasonStatV1[] = [];

  for (const item of items) {
    const player = item.player ?? {};
    const statsEntries = asStatisticsArray(item.statistics);
    const contexts =
      statsEntries.length === 0 ? [null] : statsEntries;

    for (const stats of contexts) {
      const teamObj = nested(stats ?? undefined, "team");
      const leagueObj = nested(stats ?? undefined, "league");
      const games = nested(stats ?? undefined, "games");
      const substitutes = nested(stats ?? undefined, "substitutes");
      const shots = nested(stats ?? undefined, "shots");
      const goals = nested(stats ?? undefined, "goals");
      const passes = nested(stats ?? undefined, "passes");
      const tackles = nested(stats ?? undefined, "tackles");
      const duels = nested(stats ?? undefined, "duels");
      const dribbles = nested(stats ?? undefined, "dribbles");
      const fouls = nested(stats ?? undefined, "fouls");
      const cards = nested(stats ?? undefined, "cards");
      const penalty = nested(stats ?? undefined, "penalty");

      const statisticsTeamId = asNullableId(teamObj?.id) ?? observation.providerTeamId;
      const statisticsTeamName = asNullableString(teamObj?.name);
      const attach = resolvePlayerContextTeamAttachment({
        providerTeamId: statisticsTeamId,
        providerTeamName: statisticsTeamName,
        identityGate: meta.identityGate,
      });
      const identity = resolveFootballPlayerIdentity({
        providerPlayerId: asNullableId(player.id),
        providerTeamId: statisticsTeamId,
        canonicalTeamId: attach.canonicalTeamId,
        playerName: asNullableString(player.name),
      });

      const leagueId = asNullableId(leagueObj?.id) ?? observation.leagueId;
      const season = asNullableNumber(leagueObj?.season) ?? observation.season;

      rows.push({
        schemaVersion: "yang-edge-football-player-season-stat-v1",
        observationId: observation.observationId,
        observedAt: observation.observedAt,
        identity,
        providerPlayerId: identity.providerPlayerId,
        providerTeamId: statisticsTeamId,
        canonicalTeamId: attach.canonicalTeamId,
        playerName: identity.playerName,
        leagueId,
        leagueName: asNullableString(leagueObj?.name),
        season,
        statisticsTeamId,
        statisticsTeamName,
        profile: {
          age: asNullableNumber(player.age),
          nationality: asNullableString(player.nationality),
          height: asNullableString(player.height),
          weight: asNullableString(player.weight),
          injured: asNullableBoolean(player.injured),
          photo: asNullableString(player.photo),
          firstname: asNullableString(player.firstname),
          lastname: asNullableString(player.lastname),
        },
        games: {
          appearances: asNullableNumber(games?.appearences ?? games?.appearances),
          starts: asNullableNumber(games?.lineups),
          minutes: asNullableNumber(games?.minutes),
          number: asNullableNumber(games?.number),
          position: asNullableString(games?.position),
          rating: asNullableNumber(games?.rating),
          captain: asNullableBoolean(games?.captain),
        },
        substitutes: {
          in: asNullableNumber(substitutes?.in),
          out: asNullableNumber(substitutes?.out),
          bench: asNullableNumber(substitutes?.bench),
        },
        shots: {
          total: asNullableNumber(shots?.total),
          onTarget: asNullableNumber(shots?.on),
        },
        goals: {
          total: asNullableNumber(goals?.total),
          conceded: asNullableNumber(goals?.conceded),
          assists: asNullableNumber(goals?.assists),
          saves: asNullableNumber(goals?.saves),
        },
        passes: {
          total: asNullableNumber(passes?.total),
          key: asNullableNumber(passes?.key),
          accuracy: asNullableNumber(passes?.accuracy),
        },
        tackles: {
          total: asNullableNumber(tackles?.total),
          blocks: asNullableNumber(tackles?.blocks),
          interceptions: asNullableNumber(tackles?.interceptions),
        },
        duels: {
          total: asNullableNumber(duels?.total),
          won: asNullableNumber(duels?.won),
        },
        dribbles: {
          attempts: asNullableNumber(dribbles?.attempts),
          success: asNullableNumber(dribbles?.success),
          past: asNullableNumber(dribbles?.past),
        },
        fouls: {
          drawn: asNullableNumber(fouls?.drawn),
          committed: asNullableNumber(fouls?.committed),
        },
        cards: {
          yellow: asNullableNumber(cards?.yellow),
          yellowRed: asNullableNumber(cards?.yellowred),
          red: asNullableNumber(cards?.red),
        },
        penalty: {
          won: asNullableNumber(penalty?.won),
          committed: asNullableNumber(penalty?.commited ?? penalty?.committed),
          scored: asNullableNumber(penalty?.scored),
          missed: asNullableNumber(penalty?.missed),
          saved: asNullableNumber(penalty?.saved),
        },
        pregameEligible: temporal.pregameEligible,
        observationPhase: temporal.observationPhase,
        operatorGameAttached: attach.operatorGameAttached,
        canonicalTeamAttached: attach.canonicalTeamAttached,
        predictionInput: false,
        engineInput: false,
        researchOnly: true,
      });
    }
  }

  const identityBlocked = rows.length > 0 && rows.every((r) => !r.canonicalTeamAttached);
  const truncated = Boolean(observation.paging?.truncated);
  const uniquePlayers = new Set(rows.map((r) => r.providerPlayerId ?? r.playerName));
  const multiContextPlayers = [...uniquePlayers].filter((id) => {
    const playerRows = rows.filter((r) => (r.providerPlayerId ?? r.playerName) === id);
    const contexts = new Set(
      playerRows.map((r) => `${r.statisticsTeamId}|${r.leagueId}|${r.season}`),
    );
    return contexts.size > 1;
  }).length;

  return {
    schemaVersion: "yang-edge-football-player-season-dataset-v1",
    foundationVersion: "football-player-stats-squad-coach-foundation-v1",
    observationId: observation.observationId,
    observedAt: observation.observedAt,
    sourceArtifactHash: meta.sourceArtifactHash || hashRaw(observation.rawResponse),
    rows,
    quality: qualityForPlayers({
      rawPlayerItems: items.length,
      rows,
      identityBlocked,
      truncated,
    }),
    counts: {
      rawPlayerItems: items.length,
      normalizedRows: rows.length,
      unknownPlayerIdentityRows: rows.filter(
        (r) => r.identity.identityStatus === "PLAYER_IDENTITY_REVIEW_REQUIRED",
      ).length,
      multiContextPlayers,
    },
    paging: observation.paging,
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
