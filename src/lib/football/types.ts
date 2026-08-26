/**
 * YANG EDGE — Football (API-Football) Provider 타입
 *
 * SportsProvider / OddsProvider / EDGE Engine 과 분리된 축구 데이터 계층.
 * 이번 단계에서는 fixtures → GameData 매핑과 /api/football/fixtures 만 연결한다.
 */

import type { GameData } from "@/types/game";

export type FootballProviderKind = "dummy" | "api-football";

export type FootballSource = "dummy" | "api-football";

export type GetFixturesParams = {
  /** YYYY-MM-DD (요청 timezone 기준 날짜) */
  date: string;
  leagueId?: number;
  season?: number;
  /** 기본 Asia/Seoul */
  timezone?: string;
};

export type GetStandingsParams = {
  leagueId: number;
  season: number;
};

export type GetTeamStatisticsParams = {
  leagueId: number;
  season: number;
  teamId: number;
};

export type GetInjuriesParams = {
  fixtureId?: number;
  leagueId?: number;
  teamId?: number;
};

/** API-Football GET /players. Primary P1 query: team + season. */
export type GetPlayersParams = {
  teamId?: number;
  leagueId?: number;
  playerId?: number;
  season: number;
  /** If set, fetch that single page only. */
  page?: number;
  /** Fail-closed pagination cap. Provider clamps to a hard maximum. */
  maxPages?: number;
};

export type GetPlayerSquadParams = {
  teamId: number;
};

export type GetCoachesParams = {
  teamId: number;
};

export type FootballProviderPagingMeta = {
  current: number;
  total: number;
  pagesFetched: number;
  truncated: boolean;
  complete: boolean;
  pagingPresent: boolean;
  maxPages: number;
  reason: string | null;
};

export type GetPlayersResult = {
  raw: unknown[];
  pages: Array<{
    page: number;
    raw: unknown;
    paging: { current: number; total: number };
  }>;
  paging: FootballProviderPagingMeta;
  query: Record<string, string>;
  endpoint: "/players";
  usage: FootballUsageMeta;
  cached: boolean;
};

export type GetPlayerSquadResult = {
  raw: unknown;
  query: Record<string, string>;
  endpoint: "/players/squads";
  usage: FootballUsageMeta;
  cached: boolean;
};

export type GetCoachesResult = {
  raw: unknown;
  query: Record<string, string>;
  endpoint: "/coachs";
  usage: FootballUsageMeta;
  cached: boolean;
};

/** API-Football 사용량 메타 (키 값 포함 금지) */
export type FootballUsageMeta = {
  requestsRemaining: number | null;
  requestsLimit: number | null;
};

export type FootballAccountStatus = {
  account: {
    firstname: string | null;
    lastname: string | null;
    email: string | null;
  };
  subscription: {
    plan: string | null;
    end: string | null;
    active: boolean;
  };
  requests: {
    current: number | null;
    limitDay: number | null;
  };
  rawErrors: unknown;
};

/**
 * API-Football fixtures 응답 한 건 (필요한 필드만).
 * 전체 raw 는 FixtureRaw 로 유지해 추후 분석 확장에 쓴다.
 */
export type FixtureRaw = {
  fixture: {
    id: number;
    date: string;
    timezone?: string;
    timestamp?: number;
    status?: {
      long?: string;
      short?: string;
      elapsed?: number | null;
    };
    venue?: {
      id?: number | null;
      name?: string | null;
      city?: string | null;
    };
  };
  league: {
    id: number;
    name: string;
    country?: string;
    season?: number;
    round?: string;
  };
  teams: {
    home: { id: number; name: string; logo?: string; winner?: boolean | null };
    away: { id: number; name: string; logo?: string; winner?: boolean | null };
  };
  goals?: {
    home: number | null;
    away: number | null;
  };
  /**
   * API-Football period scores. Do not treat `goals` as 90-minute 1X2.
   * fulltime = regulation (90 minutes + stoppage).
   * extratime / penalty = extra-time / shootout periods (copied as-is).
   */
  score?: {
    halftime?: { home: number | null; away: number | null };
    fulltime?: { home: number | null; away: number | null };
    extratime?: { home: number | null; away: number | null };
    penalty?: { home: number | null; away: number | null };
  };
};

export type GetFixturesResult = {
  fixtures: FixtureRaw[];
  games: GameData[];
  usage: FootballUsageMeta;
  cached: boolean;
  fetchedAt: string;
  source: FootballSource;
  params: GetFixturesParams;
};

export type FootballProvider = {
  readonly kind: FootballProviderKind;

  getFixtures(params: GetFixturesParams): Promise<GetFixturesResult>;

  getFixtureById(fixtureId: number): Promise<{
    fixture: FixtureRaw | null;
    game: GameData | null;
    usage: FootballUsageMeta;
    cached: boolean;
  }>;

  getStandings(params: GetStandingsParams): Promise<{
    raw: unknown;
    usage: FootballUsageMeta;
    cached: boolean;
  }>;

  getTeamStatistics(params: GetTeamStatisticsParams): Promise<{
    raw: unknown;
    usage: FootballUsageMeta;
    cached: boolean;
  }>;

  getInjuries(params: GetInjuriesParams): Promise<{
    raw: unknown;
    usage: FootballUsageMeta;
    cached: boolean;
  }>;

  getLineups(params: { fixtureId: number }): Promise<{
    raw: unknown;
    usage: FootballUsageMeta;
    cached: boolean;
  }>;

  getPlayers(params: GetPlayersParams): Promise<GetPlayersResult>;

  getPlayerSquad(params: GetPlayerSquadParams): Promise<GetPlayerSquadResult>;

  getCoaches(params: GetCoachesParams): Promise<GetCoachesResult>;

  /** /status — 계정·일일 한도 확인 (가능 시) */
  getStatus?(): Promise<{
    status: FootballAccountStatus;
    usage: FootballUsageMeta;
  }>;
};
