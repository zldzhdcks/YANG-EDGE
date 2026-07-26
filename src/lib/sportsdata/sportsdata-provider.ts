/**
 * SportsDataIO MLB Provider 구현.
 * Endpoint 경로는 Scores / Projections 공식 경로를 사용한다.
 * Trial에서 막히면 SportsDataApiError.unsupported = true.
 */

import { getCachedSportsData, setCachedSportsData } from "./cache";
import {
  SportsDataApiError,
  SportsDataHttpClient,
  SPORTSDATAIO_DEFAULT_BASE_URL,
} from "./provider";
import type {
  SportsDataInjury,
  SportsDataLineup,
  SportsDataLineupPlayer,
  SportsDataMlbGame,
  SportsDataProvider,
  SportsDataStartingPitchers,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function mapGame(raw: unknown): SportsDataMlbGame | null {
  const row = asRecord(raw);
  if (!row) return null;
  const gameId =
    asNumber(row.GameID) ??
    asNumber(row.GlobalGameID) ??
    asNumber(row.GameId);
  if (gameId == null) return null;

  return {
    gameId: String(gameId),
    season: asNumber(row.Season),
    status: asString(row.Status),
    dateTime: asString(row.DateTime) ?? asString(row.Day),
    dateTimeUtc: asString(row.DateTimeUTC),
    homeTeam: asString(row.HomeTeam),
    awayTeam: asString(row.AwayTeam),
    homeTeamId: asNumber(row.HomeTeamID),
    awayTeamId: asNumber(row.AwayTeamID),
    homePitcherId:
      asNumber(row.HomeTeamStartingPitcherID) ??
      asNumber(row.HomeTeamProbablePitcherID) ??
      asNumber(row.HomePitcherID) ??
      asNumber(row.PredictedHomePitcherID),
    awayPitcherId:
      asNumber(row.AwayTeamStartingPitcherID) ??
      asNumber(row.AwayTeamProbablePitcherID) ??
      asNumber(row.AwayPitcherID) ??
      asNumber(row.PredictedAwayPitcherID),
    homePitcherName:
      asString(row.HomeTeamStartingPitcher) ??
      asString(row.HomePitcher) ??
      asString(row.PredictedHomePitcherName),
    awayPitcherName:
      asString(row.AwayTeamStartingPitcher) ??
      asString(row.AwayPitcher) ??
      asString(row.PredictedAwayPitcherName),
    raw: row,
  };
}

function lineupConfirmedFlag(row: Record<string, unknown>): boolean | null {
  const confirmed =
    row.BattingOrderConfirmed ?? row.Confirmed ?? row.IsConfirmed;
  if (typeof confirmed === "boolean") return confirmed;
  const status = asString(row.Status)?.toLowerCase();
  if (!status) return null;
  if (status.includes("confirm") || status === "final") return true;
  if (status.includes("project") || status === "expected") return false;
  return null;
}

function mapLineupPlayer(raw: unknown): SportsDataLineupPlayer | null {
  const row = asRecord(raw);
  if (!row) return null;
  return {
    playerId: asNumber(row.PlayerID) ?? asNumber(row.PlayerId),
    name: asString(row.Name) ?? asString(row.PlayerName),
    position: asString(row.Position) ?? asString(row.StartingPosition),
    battingOrder: asNumber(row.BattingOrder),
    confirmed: lineupConfirmedFlag(row),
  };
}

function mapLineupGroup(
  raw: unknown,
  preferred: "projected" | "confirmed" | "unknown",
): SportsDataLineup | null {
  const row = asRecord(raw);
  if (!row) return null;
  const gameId =
    asNumber(row.GameID) ?? asNumber(row.GlobalGameID) ?? asNumber(row.GameId);
  if (gameId == null) return null;

  const playerArrays = [
    row.Lineup,
    row.Players,
    row.StartingLineup,
    row.Batters,
  ];
  const players: SportsDataLineupPlayer[] = [];
  for (const candidate of playerArrays) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      const player = mapLineupPlayer(item);
      if (player) players.push(player);
    }
  }

  // StartingLineupsByDate 응답이 선수 단위 flat array 인 경우
  if (players.length === 0 && (row.PlayerID != null || row.BattingOrder != null)) {
    const player = mapLineupPlayer(row);
    if (player) players.push(player);
  }

  const confirmed = lineupConfirmedFlag(row);
  const lineupType: SportsDataLineup["lineupType"] =
    confirmed === true
      ? "confirmed"
      : confirmed === false
        ? "projected"
        : preferred;

  return {
    gameId: String(gameId),
    teamId: asNumber(row.TeamID) ?? asNumber(row.TeamId),
    team: asString(row.Team) ?? asString(row.TeamName),
    lineupType,
    players,
    raw: row,
  };
}

function mapInjury(raw: unknown): SportsDataInjury | null {
  const row = asRecord(raw);
  if (!row) return null;
  return {
    playerId: asNumber(row.PlayerID) ?? asNumber(row.PlayerId),
    name: asString(row.Name) ?? asString(row.PlayerName),
    teamId: asNumber(row.TeamID) ?? asNumber(row.TeamId),
    team: asString(row.Team) ?? asString(row.TeamName),
    status: asString(row.Status) ?? asString(row.InjuryStatus),
    bodyPart: asString(row.BodyPart) ?? asString(row.InjuryBodyPart),
    startDate: asString(row.StartDate) ?? asString(row.Updated),
    raw: row,
  };
}

export class SportsDataIoProvider implements SportsDataProvider {
  readonly kind = "sportsdataio" as const;
  private readonly http: SportsDataHttpClient;
  /** getGames 로 확보한 gameId → 메타 (선발/라인업 조회용) */
  private readonly gameIndex = new Map<
    string,
    { date: string; game: SportsDataMlbGame }
  >();

  constructor(apiKey: string, baseUrl = SPORTSDATAIO_DEFAULT_BASE_URL) {
    this.http = new SportsDataHttpClient(baseUrl, apiKey);
  }

  async getCurrentMlbSeason(): Promise<number> {
    const cacheKey = "sportsdataio:mlb:current-season";
    const cached = getCachedSportsData<number>(cacheKey);
    if (cached != null) return cached;

    const { data } = await this.http.getJson<unknown>(
      "/scores/json/CurrentSeason",
    );
    const season =
      typeof data === "number"
        ? data
        : asNumber(asRecord(data)?.Season) ?? asNumber(asRecord(data)?.Year);
    if (season == null) {
      throw new SportsDataApiError({
        message: "CurrentSeason 응답에서 시즌 숫자를 찾지 못함",
        status: 200,
        path: "/scores/json/CurrentSeason",
        unsupported: false,
        elapsedMs: 0,
        rateLimit: { remaining: null, limit: null, reset: null, raw: {} },
      });
    }
    setCachedSportsData(cacheKey, season);
    return season;
  }

  async getGames(date: string): Promise<SportsDataMlbGame[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("getGames(date) expects YYYY-MM-DD");
    }
    const cacheKey = `sportsdataio:mlb:games:${date}`;
    const cached = getCachedSportsData<SportsDataMlbGame[]>(cacheKey);
    if (cached) {
      for (const game of cached) {
        this.gameIndex.set(game.gameId, { date, game });
      }
      return cached;
    }

    const { data } = await this.http.getJson<unknown>(
      `/scores/json/GamesByDate/${encodeURIComponent(date)}`,
    );
    const rows = Array.isArray(data) ? data : [];
    const games = rows
      .map(mapGame)
      .filter((game): game is SportsDataMlbGame => game != null);
    for (const game of games) {
      this.gameIndex.set(game.gameId, { date, game });
    }
    setCachedSportsData(cacheKey, games);
    return games;
  }

  async getStartingPitchers(
    gameId: string,
  ): Promise<SportsDataStartingPitchers | null> {
    // GamesByDate 응답의 HomePitcher / AwayPitcher 필드를 사용한다.
    const indexed = this.gameIndex.get(String(gameId));
    const hit = indexed?.game;
    if (!hit) return null;

    const hasPitcher =
      hit.homePitcherId != null ||
      hit.awayPitcherId != null ||
      hit.homePitcherName != null ||
      hit.awayPitcherName != null;

    return {
      gameId: hit.gameId,
      home: { playerId: hit.homePitcherId, name: hit.homePitcherName },
      away: { playerId: hit.awayPitcherId, name: hit.awayPitcherName },
      supported: hasPitcher,
    };
  }

  async getProjectedLineup(gameId: string): Promise<SportsDataLineup[]> {
    return this.getLineupsByGame(gameId, "projected");
  }

  async getConfirmedLineup(gameId: string): Promise<SportsDataLineup[]> {
    return this.getLineupsByGame(gameId, "confirmed");
  }

  async getInjuries(teamId: number): Promise<SportsDataInjury[]> {
    const cacheKey = "sportsdataio:mlb:injuries";
    let all = getCachedSportsData<SportsDataInjury[]>(cacheKey);
    if (!all) {
      // Trial 패키지에 따라 Scores 또는 Projections Injuries 경로가 다를 수 있다.
      try {
        const { data } = await this.http.getJson<unknown>(
          "/scores/json/Injuries",
        );
        all = (Array.isArray(data) ? data : [])
          .map(mapInjury)
          .filter((item): item is SportsDataInjury => item != null);
      } catch (error) {
        if (!(error instanceof SportsDataApiError) || !error.unsupported) {
          throw error;
        }
        const { data } = await this.http.getJson<unknown>(
          "/projections/json/InjuredPlayers",
        );
        all = (Array.isArray(data) ? data : [])
          .map(mapInjury)
          .filter((item): item is SportsDataInjury => item != null);
      }
      setCachedSportsData(cacheKey, all);
    }
    return all.filter((injury) => injury.teamId === teamId);
  }

  private async getLineupsByGame(
    gameId: string,
    preferred: "projected" | "confirmed",
  ): Promise<SportsDataLineup[]> {
    const indexed = this.gameIndex.get(String(gameId));
    const date = indexed?.date ?? new Date().toISOString().slice(0, 10);
    const cacheKey = `sportsdataio:mlb:lineups:${date}`;
    let groups = getCachedSportsData<SportsDataLineup[]>(cacheKey);
    if (!groups) {
      const { data } = await this.http.getJson<unknown>(
        `/projections/json/StartingLineupsByDate/${encodeURIComponent(date)}`,
      );
      const rows = Array.isArray(data) ? data : [];
      groups = rows
        .map((row) => mapLineupGroup(row, "unknown"))
        .filter((item): item is SportsDataLineup => item != null);

      // flat player rows → gameId+teamId 로 묶기
      if (groups.every((g) => g.players.length <= 1)) {
        const bucket = new Map<string, SportsDataLineup>();
        for (const group of groups) {
          const key = `${group.gameId}:${group.teamId ?? "na"}`;
          const existing = bucket.get(key);
          if (!existing) {
            bucket.set(key, {
              ...group,
              players: [...group.players],
            });
          } else {
            existing.players.push(...group.players);
          }
        }
        groups = [...bucket.values()];
      }
      setCachedSportsData(cacheKey, groups);
    }

    return groups.filter((group) => {
      if (group.gameId !== String(gameId)) return false;
      if (preferred === "confirmed") {
        return (
          group.lineupType === "confirmed" || group.lineupType === "unknown"
        );
      }
      return group.lineupType === "projected" || group.lineupType === "unknown";
    });
  }
}
