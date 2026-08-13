import {
  buildOddsData,
  oddsCacheKey,
  parseUsageHeaders,
  type OddsProvider,
} from "./odds-provider";
import { getCachedOdds, setCachedOdds } from "./cache";
import type {
  GetOddsParams,
  GetOddsResult,
  OddsBookmaker,
  OddsEventListing,
  OddsSportInfo,
  OddsUsageMeta,
} from "./types";

type RawSport = {
  key?: string;
  group?: string;
  title?: string;
  description?: string;
  active?: boolean;
  has_outrights?: boolean;
};

type RawOutcome = {
  name?: string;
  price?: number;
};

type RawMarket = {
  key?: string;
  last_update?: string;
  outcomes?: RawOutcome[];
};

type RawBookmaker = {
  key?: string;
  title?: string;
  last_update?: string;
  markets?: RawMarket[];
};

type RawEvent = {
  id?: string;
  sport_key?: string;
  home_team?: string;
  away_team?: string;
  commence_time?: string;
  bookmakers?: RawBookmaker[];
};

export class OddsApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "OddsApiError";
    this.status = status;
    this.path = path;
  }
}

/**
 * The Odds API v4 Provider
 *
 * URL: {ODDS_API_BASE_URL}/sports/...  (기본 https://api.the-odds-api.com/v4)
 * 인증: apiKey 쿼리 (서버 전용 ODDS_API_KEY). NEXT_PUBLIC_* 금지.
 * 로그에 API 키를 절대 출력하지 않는다.
 */
export class TheOddsApiProvider implements OddsProvider {
  readonly kind = "the-odds-api" as const;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey.trim();
  }

  async listSports(): Promise<{ sports: OddsSportInfo[]; usage: OddsUsageMeta }> {
    const { json, usage } = await this.getJson<RawSport[]>("/sports", {});
    const sports = (Array.isArray(json) ? json : [])
      .map(mapSport)
      .filter((s): s is OddsSportInfo => s !== null);

    return { sports, usage };
  }

  /**
   * GET /sports/{sport}/events — official docs: does not count against quota.
   * Odds are not included. Use for identity discovery only.
   */
  async listEvents(
    sportKey: string,
  ): Promise<{ events: OddsEventListing[]; usage: OddsUsageMeta }> {
    if (!sportKey?.trim()) {
      throw new OddsApiError("sportKey is required", 400, "/events");
    }
    const path = `/sports/${encodeURIComponent(sportKey)}/events`;
    const { json, usage } = await this.getJson<RawEvent[]>(path, {
      dateFormat: "iso",
    });
    const events = (Array.isArray(json) ? json : [])
      .map((raw) => mapEventListing(raw, sportKey))
      .filter((e): e is OddsEventListing => e !== null);
    return { events, usage };
  }

  /**
   * title/description 에서 KBO·NPB 를 찾아 활성 sport key 를 검증한다.
   * key 를 추측 하드코딩하지 않는다.
   */
  async resolveBaseballLeagueKeys(): Promise<{
    kbo: OddsSportInfo | null;
    npb: OddsSportInfo | null;
    usage: OddsUsageMeta;
  }> {
    const { sports, usage } = await this.listSports();
    const kbo =
      sports.find(
        (s) =>
          s.active &&
          (matchesLeagueLabel(s, "kbo") ||
            matchesLeagueLabel(s, "korea baseball")),
      ) ?? null;
    const npb =
      sports.find(
        (s) =>
          s.active &&
          (matchesLeagueLabel(s, "npb") ||
            matchesLeagueLabel(s, "nippon professional baseball")),
      ) ?? null;

    return { kbo, npb, usage };
  }

  async getOdds(params: GetOddsParams): Promise<GetOddsResult> {
    if (!params.sportKey?.trim()) {
      throw new OddsApiError("sportKey is required", 400, "/odds");
    }
    if (!this.apiKey) {
      throw new OddsApiError("ODDS_API_KEY is not configured", 0, "/odds");
    }

    const cacheKey = oddsCacheKey(params);
    const cached = getCachedOdds<GetOddsResult>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const query: Record<string, string> = {
      regions: params.regions ?? "eu",
      markets: params.markets ?? "h2h",
      oddsFormat: "decimal",
      dateFormat: "iso",
    };
    if (params.commenceTimeFrom) {
      query.commenceTimeFrom = params.commenceTimeFrom;
    }
    if (params.commenceTimeTo) {
      query.commenceTimeTo = params.commenceTimeTo;
    }

    const path = `/sports/${encodeURIComponent(params.sportKey)}/odds`;
    const { json, usage } = await this.getJson<RawEvent[]>(path, query);
    const fetchedAt = new Date().toISOString();

    const events = (Array.isArray(json) ? json : [])
      .map((ev) => mapEvent(ev, params.sportKey))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const result: GetOddsResult = {
      events,
      usage,
      sportKey: params.sportKey,
      cached: false,
      fetchedAt,
    };

    setCachedOdds(cacheKey, result);
    logUsageSafe(params.sportKey, usage, events.length);

    return result;
  }

  /** apiKey 는 URL에만 넣고 로그/에러 메시지에는 넣지 않는다. */
  private async getJson<T>(
    path: string,
    query: Record<string, string>,
  ): Promise<{ json: T; usage: OddsUsageMeta }> {
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    url.searchParams.set("apiKey", this.apiKey);
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network request failed";
      throw new OddsApiError(message, 0, path);
    }

    const usage = parseUsageHeaders(response.headers);

    if (!response.ok) {
      let detail = response.statusText || "Unknown error";
      try {
        const body = (await response.json()) as {
          message?: string;
          error_code?: string;
        };
        if (typeof body.message === "string" && body.message.length > 0) {
          // 응답 메시지에 키가 실수로 포함될 수 있어 마스킹
          detail = body.message.replace(/apiKey=[^&\s]+/gi, "apiKey=***");
        }
      } catch {
        // ignore
      }
      throw new OddsApiError(
        `Odds API GET ${path} failed (${response.status}): ${detail}`,
        response.status,
        path,
      );
    }

    const json = (await response.json()) as T;
    return { json, usage };
  }
}

function matchesLeagueLabel(sport: OddsSportInfo, needle: string): boolean {
  const n = needle.toLowerCase();
  const hay = `${sport.title} ${sport.description} ${sport.key}`.toLowerCase();
  return hay.includes(n);
}

function mapSport(raw: RawSport): OddsSportInfo | null {
  if (!raw.key) return null;
  return {
    key: raw.key,
    group: raw.group ?? "",
    title: raw.title ?? raw.key,
    description: raw.description ?? "",
    active: Boolean(raw.active),
    hasOutrights: Boolean(raw.has_outrights),
  };
}

function mapEventListing(
  raw: RawEvent,
  fallbackSportKey: string,
): OddsEventListing | null {
  if (!raw.id || !raw.home_team || !raw.away_team) return null;
  return {
    externalEventId: raw.id,
    sportKey: raw.sport_key || fallbackSportKey,
    homeTeam: raw.home_team,
    awayTeam: raw.away_team,
    commenceTime: raw.commence_time || "",
  };
}

function mapEvent(raw: RawEvent, fallbackSportKey: string) {
  if (!raw.id || !raw.home_team || !raw.away_team) return null;

  const bookmakers: OddsBookmaker[] = (raw.bookmakers ?? [])
    .map(mapBookmaker)
    .filter((b): b is OddsBookmaker => b !== null);

  const lastUpdated =
    bookmakers[0]?.lastUpdate ||
    raw.commence_time ||
    new Date().toISOString();

  return buildOddsData({
    externalEventId: raw.id,
    sportKey: raw.sport_key || fallbackSportKey,
    homeTeam: raw.home_team,
    awayTeam: raw.away_team,
    commenceTime: raw.commence_time || "",
    bookmakers,
    lastUpdated,
    source: "the-odds-api",
    sourceFormat: "decimal",
  });
}

function mapBookmaker(raw: RawBookmaker): OddsBookmaker | null {
  if (!raw.key) return null;
  return {
    key: raw.key,
    title: raw.title ?? raw.key,
    lastUpdate: raw.last_update ?? "",
    markets: (raw.markets ?? []).map((m) => ({
      key: m.key ?? "",
      lastUpdate: m.last_update ?? "",
      outcomes: (m.outcomes ?? [])
        .filter((o): o is { name: string; price: number; point?: number } =>
          typeof o.name === "string" && typeof o.price === "number",
        )
        .map((o) => ({
          name: o.name,
          price: o.price,
          point:
            typeof o.point === "number" && Number.isFinite(o.point)
              ? o.point
              : null,
        })),
    })),
  };
}

function logUsageSafe(
  sportKey: string,
  usage: OddsUsageMeta,
  eventCount: number,
): void {
  console.info(
    `[odds] sport=${sportKey} events=${eventCount} remaining=${usage.requestsRemaining ?? "?"} used=${usage.requestsUsed ?? "?"} last=${usage.requestsLast ?? "?"}`,
  );
}
