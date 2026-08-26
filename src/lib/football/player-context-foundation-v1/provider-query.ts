/**
 * API-Football v3 query builders for player-context endpoints.
 * Pure. No network. Never logs or embeds the API key.
 */
import { FootballApiError } from "../football-provider";

export const API_FOOTBALL_PLAYERS_ENDPOINT = "/players" as const;
export const API_FOOTBALL_SQUADS_ENDPOINT = "/players/squads" as const;
export const API_FOOTBALL_COACHES_ENDPOINT = "/coachs" as const;
export const API_FOOTBALL_PREDICTIONS_ENDPOINT = "/predictions" as const;

export type ApiFootballPlayersQueryInput = {
  teamId?: number;
  leagueId?: number;
  playerId?: number;
  season: number;
  page?: number;
};

export type ApiFootballSquadsQueryInput = {
  teamId: number;
};

export type ApiFootballCoachesQueryInput = {
  teamId: number;
};

export function assertNotPredictionsEndpoint(path: string): void {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (
    normalized === API_FOOTBALL_PREDICTIONS_ENDPOINT ||
    normalized.startsWith(`${API_FOOTBALL_PREDICTIONS_ENDPOINT}/`)
  ) {
    throw new FootballApiError(
      "FOOTBALL_PROVIDER_PREDICTIONS_ENDPOINT_FORBIDDEN",
      0,
      normalized,
    );
  }
}

export function buildApiFootballPlayersQuery(
  params: ApiFootballPlayersQueryInput,
): Record<string, string> {
  if (!Number.isFinite(params.season)) {
    throw new FootballApiError("players requires season", 400, API_FOOTBALL_PLAYERS_ENDPOINT);
  }
  const hasTeam = params.teamId != null;
  const hasLeague = params.leagueId != null;
  const hasId = params.playerId != null;
  if (!hasTeam && !hasLeague && !hasId) {
    throw new FootballApiError(
      "players requires teamId, leagueId, or playerId",
      400,
      API_FOOTBALL_PLAYERS_ENDPOINT,
    );
  }

  const query: Record<string, string> = {
    season: String(params.season),
  };
  if (hasTeam) query.team = String(params.teamId);
  if (hasLeague) query.league = String(params.leagueId);
  if (hasId) query.id = String(params.playerId);
  if (params.page != null) {
    if (!Number.isFinite(params.page) || params.page < 1) {
      throw new FootballApiError("players page must be >= 1", 400, API_FOOTBALL_PLAYERS_ENDPOINT);
    }
    query.page = String(Math.floor(params.page));
  }
  return query;
}

export function buildApiFootballSquadsQuery(
  params: ApiFootballSquadsQueryInput,
): Record<string, string> {
  if (params.teamId == null || !Number.isFinite(params.teamId)) {
    throw new FootballApiError("players/squads requires teamId", 400, API_FOOTBALL_SQUADS_ENDPOINT);
  }
  return { team: String(params.teamId) };
}

export function buildApiFootballCoachesQuery(
  params: ApiFootballCoachesQueryInput,
): Record<string, string> {
  if (params.teamId == null || !Number.isFinite(params.teamId)) {
    throw new FootballApiError("coachs requires teamId", 400, API_FOOTBALL_COACHES_ENDPOINT);
  }
  return { team: String(params.teamId) };
}
