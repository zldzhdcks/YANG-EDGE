import {
  FIXTURES_CACHE_TTL_MS,
  SHORT_CACHE_TTL_MS,
  STANDINGS_CACHE_TTL_MS,
  TEAM_STATS_CACHE_TTL_MS,
  footballFixturesCacheKey,
  getFootballCache,
  setFootballCache,
} from "./cache";
import {
  FootballApiError,
  emptyFootballUsage,
  parseFootballUsageHeaders,
} from "./football-provider";
import { mapFixtureToGame, mapFixturesToGames } from "./map-fixture-to-game";
import type {
  FootballAccountStatus,
  FootballProvider,
  FootballUsageMeta,
  FixtureRaw,
  GetFixturesParams,
  GetFixturesResult,
  GetInjuriesParams,
  GetStandingsParams,
  GetTeamStatisticsParams,
} from "./types";

type ApiFootballEnvelope<T> = {
  get?: string;
  parameters?: Record<string, string>;
  errors?: unknown;
  results?: number;
  paging?: { current?: number; total?: number };
  response?: T;
};

/**
 * API-Football (api-sports.io) Provider
 *
 * Base: {FOOTBALL_API_BASE_URL}  기본 https://v3.football.api-sports.io
 * Header: x-apisports-key: FOOTBALL_API_KEY
 *
 * NEXT_PUBLIC_* 금지. API 키는 로그에 출력하지 않는다.
 * HTTP 200 + 빈 response 는 정상(경기 없음) — Dummy 가짜 경기와 섞지 않는다.
 */
export class ApiFootballProvider implements FootballProvider {
  readonly kind = "api-football" as const;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey.trim();
  }

  async getStatus(): Promise<{
    status: FootballAccountStatus;
    usage: FootballUsageMeta;
  }> {
    const { json, usage } = await this.getJson<ApiFootballEnvelope<unknown>>(
      "/status",
      {},
    );
    const response = (json.response ?? null) as {
      account?: {
        firstname?: string;
        lastname?: string;
        email?: string;
      };
      subscription?: {
        plan?: string;
        end?: string;
        active?: boolean;
      };
      requests?: {
        current?: number;
        limit_day?: number;
      };
    } | null;

    return {
      status: {
        account: {
          firstname: response?.account?.firstname ?? null,
          lastname: response?.account?.lastname ?? null,
          email: response?.account?.email ?? null,
        },
        subscription: {
          plan: response?.subscription?.plan ?? null,
          end: response?.subscription?.end ?? null,
          active: Boolean(response?.subscription?.active),
        },
        requests: {
          current: response?.requests?.current ?? null,
          limitDay: response?.requests?.limit_day ?? null,
        },
        rawErrors: json.errors ?? [],
      },
      usage,
    };
  }

  async getFixtures(params: GetFixturesParams): Promise<GetFixturesResult> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      throw new FootballApiError(
        "date must be YYYY-MM-DD",
        400,
        "/fixtures",
      );
    }

    const timezone = params.timezone ?? "Asia/Seoul";
    const cacheKey = footballFixturesCacheKey({
      date: params.date,
      leagueId: params.leagueId,
      season: params.season,
      timezone,
    });

    const cached = getFootballCache<GetFixturesResult>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const query: Record<string, string> = {
      date: params.date,
      timezone,
    };
    if (params.leagueId != null) query.league = String(params.leagueId);
    if (params.season != null) query.season = String(params.season);

    const { json, usage } = await this.getJson<
      ApiFootballEnvelope<FixtureRaw[]>
    >("/fixtures", query);

    assertNoApiErrors(json.errors, "/fixtures");

    const fixtures = Array.isArray(json.response) ? json.response : [];
    const games = mapFixturesToGames(fixtures);
    const fetchedAt = new Date().toISOString();

    const result: GetFixturesResult = {
      fixtures,
      games,
      usage,
      cached: false,
      fetchedAt,
      source: "api-football",
      params: { ...params, timezone },
    };

    setFootballCache(cacheKey, result, FIXTURES_CACHE_TTL_MS);
    logUsageSafe("fixtures", usage, games.length);

    return result;
  }

  async getFixtureById(fixtureId: number) {
    const cacheKey = `fixture|${fixtureId}`;
    const cached = getFootballCache<{
      fixture: FixtureRaw | null;
      game: import("@/types/game").GameData | null;
      usage: FootballUsageMeta;
      cached: boolean;
    }>(cacheKey);
    if (cached) return { ...cached, cached: true };

    const { json, usage } = await this.getJson<
      ApiFootballEnvelope<FixtureRaw[]>
    >("/fixtures", { id: String(fixtureId) });

    assertNoApiErrors(json.errors, "/fixtures");
    const fixture = Array.isArray(json.response) ? json.response[0] ?? null : null;
    const game = fixture ? mapFixtureToGame(fixture) : null;
    const result = { fixture, game, usage, cached: false as const };
    setFootballCache(cacheKey, result, FIXTURES_CACHE_TTL_MS);
    return result;
  }

  async getStandings(params: GetStandingsParams) {
    const cacheKey = `standings|${params.leagueId}|${params.season}`;
    const cached = getFootballCache<{
      raw: unknown;
      usage: FootballUsageMeta;
      cached: boolean;
    }>(cacheKey);
    if (cached) return { ...cached, cached: true };

    const { json, usage } = await this.getJson<ApiFootballEnvelope<unknown>>(
      "/standings",
      {
        league: String(params.leagueId),
        season: String(params.season),
      },
    );
    assertNoApiErrors(json.errors, "/standings");
    const result = {
      raw: json.response ?? [],
      usage,
      cached: false as const,
    };
    setFootballCache(cacheKey, result, STANDINGS_CACHE_TTL_MS);
    return result;
  }

  async getTeamStatistics(params: GetTeamStatisticsParams) {
    const cacheKey = `teamstats|${params.leagueId}|${params.season}|${params.teamId}`;
    const cached = getFootballCache<{
      raw: unknown;
      usage: FootballUsageMeta;
      cached: boolean;
    }>(cacheKey);
    if (cached) return { ...cached, cached: true };

    const { json, usage } = await this.getJson<ApiFootballEnvelope<unknown>>(
      "/teams/statistics",
      {
        league: String(params.leagueId),
        season: String(params.season),
        team: String(params.teamId),
      },
    );
    assertNoApiErrors(json.errors, "/teams/statistics");
    const result = {
      raw: json.response ?? null,
      usage,
      cached: false as const,
    };
    setFootballCache(cacheKey, result, TEAM_STATS_CACHE_TTL_MS);
    return result;
  }

  /**
   * TODO: injuries — 짧은 캐시(SHORT_CACHE_TTL_MS) 적용 예정.
   * 현재도 SHORT TTL 로 보호한다.
   */
  async getInjuries(params: GetInjuriesParams) {
    const cacheKey = [
      "injuries",
      params.fixtureId ?? "",
      params.leagueId ?? "",
      params.teamId ?? "",
    ].join("|");
    const cached = getFootballCache<{
      raw: unknown;
      usage: FootballUsageMeta;
      cached: boolean;
    }>(cacheKey);
    if (cached) return { ...cached, cached: true };

    const query: Record<string, string> = {};
    if (params.fixtureId != null) query.fixture = String(params.fixtureId);
    if (params.leagueId != null) query.league = String(params.leagueId);
    if (params.teamId != null) query.team = String(params.teamId);
    if (Object.keys(query).length === 0) {
      throw new FootballApiError(
        "injuries requires fixtureId, leagueId, or teamId",
        400,
        "/injuries",
      );
    }

    const { json, usage } = await this.getJson<ApiFootballEnvelope<unknown>>(
      "/injuries",
      query,
    );
    assertNoApiErrors(json.errors, "/injuries");
    const result = {
      raw: json.response ?? [],
      usage,
      cached: false as const,
    };
    // TODO: 경기 임박 시 TTL 더 짧게
    setFootballCache(cacheKey, result, SHORT_CACHE_TTL_MS);
    return result;
  }

  /**
   * TODO: lineups — 짧은 캐시 적용 예정 (경기 수시간 전 업데이트).
   */
  async getLineups(params: { fixtureId: number }) {
    const cacheKey = `lineups|${params.fixtureId}`;
    const cached = getFootballCache<{
      raw: unknown;
      usage: FootballUsageMeta;
      cached: boolean;
    }>(cacheKey);
    if (cached) return { ...cached, cached: true };

    const { json, usage } = await this.getJson<ApiFootballEnvelope<unknown>>(
      "/fixtures/lineups",
      { fixture: String(params.fixtureId) },
    );
    assertNoApiErrors(json.errors, "/fixtures/lineups");
    const result = {
      raw: json.response ?? [],
      usage,
      cached: false as const,
    };
    setFootballCache(cacheKey, result, SHORT_CACHE_TTL_MS);
    return result;
  }

  private async getJson<T>(
    path: string,
    query: Record<string, string>,
  ): Promise<{ json: T; usage: FootballUsageMeta }> {
    if (!this.apiKey) {
      throw new FootballApiError(
        "FOOTBALL_API_KEY is not configured",
        0,
        path,
      );
    }

    const url = new URL(
      `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`,
    );
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-apisports-key": this.apiKey,
        },
        cache: "no-store",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network request failed";
      throw new FootballApiError(message, 0, path);
    }

    const usage = parseFootballUsageHeaders(response.headers);

    if (!response.ok) {
      let detail = response.statusText || "Unknown error";
      try {
        const body = (await response.json()) as {
          message?: string;
          errors?: unknown;
        };
        if (typeof body.message === "string") {
          detail = sanitizeMessage(body.message);
        } else if (body.errors) {
          detail = sanitizeMessage(JSON.stringify(body.errors));
        }
      } catch {
        // ignore
      }
      throw new FootballApiError(
        `Football API GET ${path} failed (${response.status}): ${detail}`,
        response.status,
        path,
      );
    }

    const json = (await response.json()) as T;
    return { json, usage };
  }
}

function assertNoApiErrors(errors: unknown, path: string): void {
  if (errors == null) return;
  if (Array.isArray(errors) && errors.length === 0) return;
  if (
    typeof errors === "object" &&
    !Array.isArray(errors) &&
    Object.keys(errors as object).length === 0
  ) {
    return;
  }

  // API-Football 은 가끔 errors: { token: "..." } 형태
  const text = sanitizeMessage(JSON.stringify(errors));
  const lower = text.toLowerCase();
  if (
    lower.includes("token") ||
    lower.includes("key") ||
    lower.includes("unauthorized")
  ) {
    throw new FootballApiError(
      `Football API auth error on ${path}: ${text}`,
      401,
      path,
    );
  }
  throw new FootballApiError(
    `Football API error on ${path}: ${text}`,
    502,
    path,
  );
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/x-apisports-key["\s:=]+[^\s"',}]+/gi, "x-apisports-key=***")
    .replace(/api[_-]?key["\s:=]+[^\s"',}]+/gi, "apiKey=***");
}

function logUsageSafe(
  label: string,
  usage: FootballUsageMeta,
  count: number,
): void {
  console.info(
    `[football] ${label} count=${count} remaining=${usage.requestsRemaining ?? "?"} limit=${usage.requestsLimit ?? "?"}`,
  );
}

export { emptyFootballUsage };
