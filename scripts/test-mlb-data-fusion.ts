/**
 * 2026-07-27 KST MLB 데이터 fusion 검증.
 *
 * 기준 일정: API-BASEBALL 현재 시즌 MLB
 * 연결 대상: The Odds API + SportsDataIO
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/test-mlb-data-fusion.ts
 *
 * 조회·매칭·품질 검증 전용. Engine/UI/기존 Provider 로직에 연결하지 않는다.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import {
  matchOddsToGame,
  normalizeTeamNameForOdds,
  TheOddsApiProvider,
  type OddsData,
  type OddsSportInfo,
  type OddsUsageMeta,
} from "../src/lib/odds";
import {
  SportsDataApiError,
  SportsDataHttpClient,
  SPORTSDATAIO_DEFAULT_BASE_URL,
  type SportsDataRateLimitMeta,
} from "../src/lib/sportsdata";
import type { GameData } from "../src/types/game";

const TARGET_DATE_KST = "2026-07-27";
const PREVIOUS_DATE = "2026-07-26";
const NEXT_DATE = "2026-07-28";
const KST_START_MS = Date.parse(`${TARGET_DATE_KST}T00:00:00+09:00`);
const KST_END_MS = Date.parse(`${NEXT_DATE}T00:00:00+09:00`);
const MATCH_TOLERANCE_MS = 3 * 60 * 60 * 1000;
const MIN_CONFIDENCE = 0.7;
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-data-fusion.json`,
);

type FusionStatus =
  | "FULL_MATCH"
  | "ODDS_ONLY_MISSING"
  | "SPORTSDATA_ONLY_MISSING"
  | "BOTH_MISSING"
  | "AMBIGUOUS";

type MatchMethod = "external-id" | "teams-time" | "none" | "ambiguous";

type BaselineGame = {
  externalId: string;
  commenceTimeUtc: string | null;
  dateKst: string;
  startTimeKst: string;
  homeTeam: string;
  awayTeam: string;
  status: string | null;
  league: { id: number; name: string | null };
  season: number;
};

type ApiBaseballEnvelope = {
  errors?: unknown;
  results?: number;
  response?: unknown[];
};

type ApiBaseballUsage = {
  calls: number;
  remaining: number | null;
  limit: number | null;
};

type ProviderMatch<T> = {
  item: T | null;
  method: MatchMethod;
  confidence: number;
  candidateCount: number;
  timeDiffMinutes: number | null;
};

type SportsDataGame = {
  gameId: string;
  dateTime: string | null;
  dateTimeUtc: string | null;
  commenceTimeUtc: string | null;
  dateKst: string | null;
  startTimeKst: string | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  status: string | null;
  probablePitcherIds: {
    home: number | null;
    away: number | null;
  };
  startingPitcherIds: {
    home: number | null;
    away: number | null;
  };
  observedPitcherFields: string[];
};

type LineupQuality = {
  projectedAvailable: boolean;
  confirmedAvailable: boolean;
  projectedPlayerCount: number;
  confirmedPlayerCount: number;
  observedFields: string[];
};

type DiscrepancyType =
  | "TEAM_NAME_MISMATCH"
  | "TIME_DIFFERENCE"
  | "HOME_AWAY_REVERSED"
  | "DUPLICATE_CANDIDATE";

type Discrepancy = {
  type: DiscrepancyType;
  provider: "the-odds-api" | "sportsdataio";
  baselineExternalId: string;
  detail: string;
};

type TimedResponse<T> = {
  data: T;
  status: number;
  elapsedMs: number;
  headers: Headers;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function errorsText(errors: unknown): string {
  if (errors == null) return "";
  if (Array.isArray(errors)) return errors.map(String).join("; ");
  if (typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>)
      .map(String)
      .join("; ");
  }
  return String(errors);
}

function safeError(reason: unknown): string {
  const raw =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "Unknown error";
  return raw
    .replace(/apiKey=[^&\s]+/gi, "apiKey=***")
    .replace(/subscription-key=[^&\s]+/gi, "subscription-key=***")
    .replace(
      /Ocp-Apim-Subscription-Key:\s*\S+/gi,
      "Ocp-Apim-Subscription-Key: ***",
    )
    .replace(/x-apisports-key[^,\s]*/gi, "x-apisports-key=***");
}

function parseNumberHeader(headers: Headers, ...names: string[]): number | null {
  for (const name of names) {
    const raw = headers.get(name);
    if (raw == null || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<TimedResponse<T>> {
  const started = performance.now();
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  const elapsedMs = Math.round(performance.now() - started);
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text === "" ? null : JSON.parse(text);
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(
      `GET failed (${response.status}): ${safeError(text.slice(0, 240))}`,
    );
  }
  return {
    data: data as T,
    status: response.status,
    elapsedMs,
    headers: response.headers,
  };
}

function toUtcIso(value: string | null, assumeUtc = false): string | null {
  if (!value) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const normalized = assumeUtc && !hasZone ? `${value}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toKstParts(iso: string | null): {
  date: string;
  time: string;
} | null {
  return iso ? instantToKst(iso) : null;
}

function isTargetKstInstant(iso: string | null): boolean {
  if (!iso) return false;
  const time = Date.parse(iso);
  return (
    Number.isFinite(time) && time >= KST_START_MS && time < KST_END_MS
  );
}

function parseApiBaseballGame(
  raw: unknown,
  season: number,
  leagueId: number,
): BaselineGame | null {
  const row = asRecord(raw);
  if (!row) return null;
  const teams = asRecord(row.teams);
  const home = asRecord(teams?.home);
  const away = asRecord(teams?.away);
  const league = asRecord(row.league);
  const status = asRecord(row.status);
  const id = asNumber(row.id);
  const homeName = asString(home?.name);
  const awayName = asString(away?.name);
  if (id == null || !homeName || !awayName) return null;

  let commenceTimeUtc: string | null = null;
  const timestamp = asNumber(row.timestamp);
  if (timestamp != null) {
    commenceTimeUtc = new Date(timestamp * 1000).toISOString();
  } else {
    commenceTimeUtc = toUtcIso(asString(row.date));
  }
  const kst = toKstParts(commenceTimeUtc);
  if (!kst || kst.date !== TARGET_DATE_KST) return null;

  return {
    externalId: String(id),
    commenceTimeUtc,
    dateKst: kst.date,
    startTimeKst: kst.time,
    homeTeam: homeName,
    awayTeam: awayName,
    status: asString(status?.long) ?? asString(status?.short),
    league: {
      id: asNumber(league?.id) ?? leagueId,
      name: asString(league?.name),
    },
    season,
  };
}

async function loadApiBaseballBaseline(): Promise<{
  games: BaselineGame[];
  leagueId: number | null;
  season: number;
  usage: ApiBaseballUsage;
  elapsedMs: number[];
  error: string | null;
}> {
  const baseUrl = (
    process.env.BASEBALL_API_BASE_URL ??
    "https://v1.baseball.api-sports.io"
  ).replace(/\/$/, "");
  const apiKey = (
    process.env.BASEBALL_API_KEY ??
    process.env.FOOTBALL_API_KEY ??
    ""
  ).trim();
  const usage: ApiBaseballUsage = {
    calls: 0,
    remaining: null,
    limit: null,
  };
  const elapsedMs: number[] = [];
  if (!apiKey) {
    return {
      games: [],
      leagueId: null,
      season: 2026,
      usage,
      elapsedMs,
      error: "BASEBALL_API_KEY/FOOTBALL_API_KEY 미설정",
    };
  }

  const cache = new Map<string, TimedResponse<ApiBaseballEnvelope>>();
  const get = async (
    endpoint: string,
    params: Record<string, string | number>,
  ) => {
    const url = new URL(`${baseUrl}/${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    const cacheKey = `${endpoint}?${url.searchParams.toString()}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    usage.calls += 1;
    const result = await fetchJson<ApiBaseballEnvelope>(url.toString(), {
      headers: { "x-apisports-key": apiKey },
    });
    cache.set(cacheKey, result);
    elapsedMs.push(result.elapsedMs);
    usage.remaining = parseNumberHeader(
      result.headers,
      "x-ratelimit-requests-remaining",
      "x-ratelimit-remaining",
    );
    usage.limit = parseNumberHeader(
      result.headers,
      "x-ratelimit-requests-limit",
      "x-ratelimit-limit",
    );
    return result;
  };

  try {
    const leagueResult = await get("leagues", { search: "MLB" });
    const leagueError = errorsText(leagueResult.data.errors);
    if (leagueError) throw new Error(leagueError);
    const leagueRows = Array.isArray(leagueResult.data.response)
      ? leagueResult.data.response
      : [];
    const league = leagueRows
      .map(asRecord)
      .find((row) => /\bmlb\b|major league baseball/i.test(asString(row?.name) ?? ""));
    const leagueId = asNumber(league?.id);
    if (leagueId == null) {
      throw new Error("MLB league ID를 실제 응답에서 찾지 못함");
    }

    const seasons = Array.isArray(league?.seasons) ? league.seasons : [];
    const current = seasons
      .map(asRecord)
      .find((row) => row?.current === true);
    const season =
      asNumber(current?.season) ??
      asNumber(current?.year) ??
      2026;

    const gamesResult = await get("games", {
      league: leagueId,
      season,
      date: TARGET_DATE_KST,
      timezone: "Asia/Seoul",
    });
    const gamesError = errorsText(gamesResult.data.errors);
    if (gamesError) throw new Error(gamesError);
    const rows = Array.isArray(gamesResult.data.response)
      ? gamesResult.data.response
      : [];
    const games = rows
      .map((row) => parseApiBaseballGame(row, season, leagueId))
      .filter((game): game is BaselineGame => game != null);
    return {
      games,
      leagueId,
      season,
      usage,
      elapsedMs,
      error: null,
    };
  } catch (error) {
    return {
      games: [],
      leagueId: null,
      season: 2026,
      usage,
      elapsedMs,
      error: safeError(error),
    };
  }
}

function findActiveMlbSport(sports: OddsSportInfo[]): OddsSportInfo | null {
  return (
    sports.find(
      (sport) =>
        sport.active &&
        !sport.hasOutrights &&
        sport.group.toLowerCase() === "baseball" &&
        /\bmlb\b|major league baseball/i.test(
          `${sport.key} ${sport.title} ${sport.description}`,
        ),
    ) ?? null
  );
}

async function loadOdds(): Promise<{
  events: OddsData[];
  sport: OddsSportInfo | null;
  calls: number;
  usage: OddsUsageMeta;
  sportsUsage: OddsUsageMeta;
  elapsedMs: number[];
  error: string | null;
}> {
  const baseUrl =
    (process.env.ODDS_API_BASE_URL ?? "").trim() ||
    "https://api.the-odds-api.com/v4";
  const apiKey = (process.env.ODDS_API_KEY ?? "").trim();
  const emptyUsage: OddsUsageMeta = {
    requestsRemaining: null,
    requestsUsed: null,
    requestsLast: null,
  };
  if (!apiKey) {
    return {
      events: [],
      sport: null,
      calls: 0,
      usage: emptyUsage,
      sportsUsage: emptyUsage,
      elapsedMs: [],
      error: "ODDS_API_KEY 미설정",
    };
  }

  const provider = new TheOddsApiProvider(baseUrl, apiKey);
  const elapsedMs: number[] = [];
  try {
    const sportsStarted = performance.now();
    const listed = await provider.listSports();
    elapsedMs.push(Math.round(performance.now() - sportsStarted));
    const sport = findActiveMlbSport(listed.sports);
    if (!sport) throw new Error("활성 MLB sport key 없음");

    const oddsStarted = performance.now();
    const result = await provider.getOdds({
      sportKey: sport.key,
      regions: "eu",
      markets: "h2h",
      commenceTimeFrom: new Date(KST_START_MS)
        .toISOString()
        .replace(".000Z", "Z"),
      commenceTimeTo: new Date(KST_END_MS)
        .toISOString()
        .replace(".000Z", "Z"),
    });
    elapsedMs.push(Math.round(performance.now() - oddsStarted));
    return {
      events: result.events.filter((event) =>
        isTargetKstInstant(toUtcIso(event.commenceTime)),
      ),
      sport,
      calls: result.cached ? 1 : 2,
      usage: result.usage,
      sportsUsage: listed.usage,
      elapsedMs,
      error: null,
    };
  } catch (error) {
    return {
      events: [],
      sport: null,
      calls: 0,
      usage: emptyUsage,
      sportsUsage: emptyUsage,
      elapsedMs,
      error: safeError(error),
    };
  }
}

function parseSportsDataRateHeaders(
  rateLimit: SportsDataRateLimitMeta,
): { remaining: string | null; used: string | null; raw: Record<string, string> } {
  const usedEntry = Object.entries(rateLimit.raw).find(([key]) =>
    key.toLowerCase().includes("used"),
  );
  return {
    remaining: rateLimit.remaining,
    used: usedEntry?.[1] ?? null,
    raw: rateLimit.raw,
  };
}

function teamFullName(row: Record<string, unknown>): string | null {
  const direct =
    asString(row.FullName) ??
    asString(row.Name) ??
    asString(row.TeamName);
  const city = asString(row.City);
  if (!direct) return null;
  if (!city || direct.toLowerCase().includes(city.toLowerCase())) return direct;
  return `${city} ${direct}`;
}

function parseSportsDataGame(
  raw: unknown,
  teamNames: Map<string, string>,
): SportsDataGame | null {
  const row = asRecord(raw);
  if (!row) return null;
  const gameId =
    asNumber(row.GameID) ??
    asNumber(row.GlobalGameID) ??
    asNumber(row.GameId);
  if (gameId == null) return null;

  const homeCode = asString(row.HomeTeam);
  const awayCode = asString(row.AwayTeam);
  const homeTeamId = asNumber(row.HomeTeamID);
  const awayTeamId = asNumber(row.AwayTeamID);
  const homeTeam =
    (homeTeamId != null ? teamNames.get(`id:${homeTeamId}`) : null) ??
    (homeCode ? teamNames.get(`key:${homeCode.toLowerCase()}`) : null) ??
    homeCode;
  const awayTeam =
    (awayTeamId != null ? teamNames.get(`id:${awayTeamId}`) : null) ??
    (awayCode ? teamNames.get(`key:${awayCode.toLowerCase()}`) : null) ??
    awayCode;
  if (!homeTeam || !awayTeam) return null;

  const dateTimeUtc = asString(row.DateTimeUTC);
  const commenceTimeUtc =
    toUtcIso(dateTimeUtc, true) ??
    toUtcIso(asString(row.DateTime));
  const kst = toKstParts(commenceTimeUtc);
  if (!kst || kst.date !== TARGET_DATE_KST) return null;
  const pitcherFields = Object.keys(row).filter((key) => /pitcher/i.test(key));

  return {
    gameId: String(gameId),
    dateTime: asString(row.DateTime),
    dateTimeUtc,
    commenceTimeUtc,
    dateKst: kst.date,
    startTimeKst: kst.time,
    homeTeam,
    awayTeam,
    homeTeamCode: homeCode,
    awayTeamCode: awayCode,
    homeTeamId,
    awayTeamId,
    status: asString(row.Status),
    probablePitcherIds: {
      home: asNumber(row.HomeTeamProbablePitcherID),
      away: asNumber(row.AwayTeamProbablePitcherID),
    },
    startingPitcherIds: {
      home: asNumber(row.HomeTeamStartingPitcherID),
      away: asNumber(row.AwayTeamStartingPitcherID),
    },
    observedPitcherFields: pitcherFields,
  };
}

function collectLineupQuality(raw: unknown[]): Map<string, LineupQuality> {
  const byGame = new Map<string, LineupQuality>();

  const quality = (gameId: string) => {
    const existing = byGame.get(gameId);
    if (existing) return existing;
    const created: LineupQuality = {
      projectedAvailable: false,
      confirmedAvailable: false,
      projectedPlayerCount: 0,
      confirmedPlayerCount: 0,
      observedFields: [],
    };
    byGame.set(gameId, created);
    return created;
  };

  const visit = (
    value: unknown,
    inheritedGameId: string | null,
    pathName: string,
  ) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, inheritedGameId, pathName);
      return;
    }
    const row = asRecord(value);
    if (!row) return;
    const ownGameId =
      asNumber(row.GameID) ??
      asNumber(row.GlobalGameID) ??
      asNumber(row.GameId);
    const gameId = ownGameId == null ? inheritedGameId : String(ownGameId);
    if (!gameId) return;
    const q = quality(gameId);
    for (const key of Object.keys(row)) {
      if (
        /lineup|batting|batter|confirmed/i.test(key) &&
        !q.observedFields.includes(key)
      ) {
        q.observedFields.push(key);
      }
    }

    const battingOrder = asNumber(row.BattingOrder);
    const playerId = asNumber(row.PlayerID) ?? asNumber(row.PlayerId);
    const confirmed =
      typeof row.BattingOrderConfirmed === "boolean"
        ? row.BattingOrderConfirmed
        : typeof row.Confirmed === "boolean"
          ? row.Confirmed
          : null;
    const looksLikePlayer =
      playerId != null || battingOrder != null || /batter|lineup/i.test(pathName);
    if (looksLikePlayer) {
      q.projectedAvailable = true;
      q.projectedPlayerCount += 1;
      if (confirmed === true) {
        q.confirmedAvailable = true;
        q.confirmedPlayerCount += 1;
      }
    }

    for (const [key, child] of Object.entries(row)) {
      if (typeof child === "object" && child !== null) {
        visit(child, gameId, key);
      }
    }
  };

  for (const row of raw) visit(row, null, "root");
  return byGame;
}

async function loadSportsData(): Promise<{
  games: SportsDataGame[];
  lineups: Map<string, LineupQuality>;
  injuriesByTeam: Map<number, number>;
  scrambledMarkerObserved: boolean;
  calls: number;
  usage: { remaining: string | null; used: string | null; raw: Record<string, string> };
  elapsedMs: number[];
  endpointSupport: Record<string, string>;
  observedLineupFields: string[];
  error: string | null;
}> {
  const apiKey = (process.env.SPORTSDATAIO_API_KEY ?? "").trim();
  const empty = {
    games: [] as SportsDataGame[],
    lineups: new Map<string, LineupQuality>(),
    injuriesByTeam: new Map<number, number>(),
    scrambledMarkerObserved: false,
    calls: 0,
    usage: {
      remaining: null,
      used: null,
      raw: {} as Record<string, string>,
    },
    elapsedMs: [] as number[],
    endpointSupport: {} as Record<string, string>,
    observedLineupFields: [] as string[],
    error: null as string | null,
  };
  if (!apiKey) return { ...empty, error: "SPORTSDATAIO_API_KEY 미설정" };

  const http = new SportsDataHttpClient(
    SPORTSDATAIO_DEFAULT_BASE_URL,
    apiKey,
  );
  const cache = new Map<string, unknown>();
  const elapsedMs: number[] = [];
  let calls = 0;
  let usage: ReturnType<typeof parseSportsDataRateHeaders> = empty.usage;
  const endpointSupport: Record<string, string> = {};

  const get = async <T>(endpoint: string): Promise<T | null> => {
    if (cache.has(endpoint)) return cache.get(endpoint) as T;
    calls += 1;
    try {
      const result = await http.getJson<T>(endpoint);
      cache.set(endpoint, result.data);
      elapsedMs.push(result.meta.elapsedMs);
      usage = parseSportsDataRateHeaders(result.meta.rateLimit);
      endpointSupport[endpoint] = "available";
      return result.data;
    } catch (error) {
      if (error instanceof SportsDataApiError) {
        elapsedMs.push(error.elapsedMs);
        usage = parseSportsDataRateHeaders(error.rateLimit);
        endpointSupport[endpoint] = error.unsupported
          ? "unsupported"
          : `error:${error.status}`;
        if (error.unsupported) {
          cache.set(endpoint, null);
          return null;
        }
      }
      throw error;
    }
  };

  try {
    const teamsRaw = await get<unknown[]>("/scores/json/Teams");
    const teamNames = new Map<string, string>();
    for (const raw of Array.isArray(teamsRaw) ? teamsRaw : []) {
      const row = asRecord(raw);
      if (!row) continue;
      const name = teamFullName(row);
      if (!name) continue;
      const id = asNumber(row.TeamID) ?? asNumber(row.TeamId);
      const key = asString(row.Key) ?? asString(row.Team);
      if (id != null) teamNames.set(`id:${id}`, name);
      if (key) teamNames.set(`key:${key.toLowerCase()}`, name);
    }

    // SportsDataIO GamesByDate는 미국 현지 캘린더 기준이므로 인접 날짜를
    // 각각 한 번 조회한 뒤 DateTimeUTC를 KST 경계로 재필터링한다.
    const gameDates = [PREVIOUS_DATE, TARGET_DATE_KST];
    const gameRows: unknown[] = [];
    for (const date of gameDates) {
      const data = await get<unknown[]>(
        `/scores/json/GamesByDate/${date}`,
      );
      if (Array.isArray(data)) gameRows.push(...data);
    }
    const scrambledMarkerObserved = gameRows.some((row) =>
      /"Scrambled"/i.test(JSON.stringify(row)),
    );
    const games = gameRows
      .map((row) => parseSportsDataGame(row, teamNames))
      .filter((game): game is SportsDataGame => game != null);

    const lineupRows: unknown[] = [];
    for (const date of gameDates) {
      const data = await get<unknown[]>(
        `/projections/json/StartingLineupsByDate/${date}`,
      );
      if (Array.isArray(data)) lineupRows.push(...data);
    }
    const lineups = collectLineupQuality(lineupRows);

    let injuries = await get<unknown[]>("/scores/json/Injuries");
    if (injuries == null) {
      injuries = await get<unknown[]>("/projections/json/InjuredPlayers");
    }
    const injuriesByTeam = new Map<number, number>();
    for (const raw of Array.isArray(injuries) ? injuries : []) {
      const row = asRecord(raw);
      const teamId = asNumber(row?.TeamID) ?? asNumber(row?.TeamId);
      if (teamId == null) continue;
      injuriesByTeam.set(teamId, (injuriesByTeam.get(teamId) ?? 0) + 1);
    }
    const observedLineupFields = [
      ...new Set(
        [...lineups.values()].flatMap((lineup) => lineup.observedFields),
      ),
    ];
    return {
      games,
      lineups,
      injuriesByTeam,
      scrambledMarkerObserved,
      calls,
      usage,
      elapsedMs,
      endpointSupport,
      observedLineupFields,
      error: null,
    };
  } catch (error) {
    return {
      ...empty,
      calls,
      usage,
      elapsedMs,
      endpointSupport,
      error: safeError(error),
    };
  }
}

function teamScore(a: string, b: string): number {
  const normalizedA = normalizeTeamNameForOdds(a);
  const normalizedB = normalizeTeamNameForOdds(b);
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;
  if (
    normalizedA.length >= 4 &&
    normalizedB.length >= 4 &&
    (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA))
  ) {
    return 0.8;
  }
  return 0;
}

function timeDiffMinutes(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return null;
  return Math.round(Math.abs(aMs - bMs) / 60000);
}

function findCandidates<T extends {
  homeTeam: string;
  awayTeam: string;
  commenceTimeUtc?: string | null;
  externalId?: string;
  gameId?: string;
}>(
  baseline: BaselineGame,
  candidates: T[],
): Array<{
  item: T;
  method: Exclude<MatchMethod, "none" | "ambiguous">;
  confidence: number;
  timeDiffMinutes: number | null;
}> {
  const matches: Array<{
    item: T;
    method: Exclude<MatchMethod, "none" | "ambiguous">;
    confidence: number;
    timeDiffMinutes: number | null;
  }> = [];
  for (const item of candidates) {
    const home = teamScore(baseline.homeTeam, item.homeTeam);
    const away = teamScore(baseline.awayTeam, item.awayTeam);
    if (home === 0 || away === 0) continue;
    const diff = timeDiffMinutes(
      baseline.commenceTimeUtc,
      item.commenceTimeUtc ?? null,
    );
    if (diff != null && diff > MATCH_TOLERANCE_MS / 60000) continue;
    const directId =
      (item.externalId != null &&
        item.externalId === baseline.externalId) ||
      (item.gameId != null && item.gameId === baseline.externalId);
    matches.push({
      item,
      method: directId ? "external-id" : "teams-time",
      confidence: directId ? 1 : Math.min(home, away) * 0.9,
      timeDiffMinutes: diff,
    });
  }
  return matches.sort((a, b) => b.confidence - a.confidence);
}

function chooseMatch<T extends {
  homeTeam: string;
  awayTeam: string;
  commenceTimeUtc?: string | null;
  externalId?: string;
  gameId?: string;
}>(baseline: BaselineGame, candidates: T[]): ProviderMatch<T> {
  const matches = findCandidates(baseline, candidates);
  if (matches.length === 0) {
    return {
      item: null,
      method: "none",
      confidence: 0,
      candidateCount: 0,
      timeDiffMinutes: null,
    };
  }
  if (
    matches.length > 1 ||
    matches[0].confidence < MIN_CONFIDENCE
  ) {
    return {
      item: null,
      method: "ambiguous",
      confidence: matches[0].confidence,
      candidateCount: matches.length,
      timeDiffMinutes: matches[0].timeDiffMinutes,
    };
  }
  return {
    item: matches[0].item,
    method: matches[0].method,
    confidence: matches[0].confidence,
    candidateCount: 1,
    timeDiffMinutes: matches[0].timeDiffMinutes,
  };
}

function collectDiscrepancies<T extends {
  homeTeam: string;
  awayTeam: string;
  commenceTimeUtc?: string | null;
}>(
  baseline: BaselineGame,
  candidates: T[],
  provider: Discrepancy["provider"],
  chosen: ProviderMatch<T>,
): Discrepancy[] {
  const result: Discrepancy[] = [];
  if (chosen.candidateCount > 1) {
    result.push({
      type: "DUPLICATE_CANDIDATE",
      provider,
      baselineExternalId: baseline.externalId,
      detail: `${chosen.candidateCount}개 후보`,
    });
  }
  for (const candidate of candidates) {
    const diff = timeDiffMinutes(
      baseline.commenceTimeUtc,
      candidate.commenceTimeUtc ?? null,
    );
    const sameHome = teamScore(baseline.homeTeam, candidate.homeTeam) > 0;
    const sameAway = teamScore(baseline.awayTeam, candidate.awayTeam) > 0;
    const reversed =
      teamScore(baseline.homeTeam, candidate.awayTeam) > 0 &&
      teamScore(baseline.awayTeam, candidate.homeTeam) > 0;
    if (reversed && (diff == null || diff <= 180)) {
      result.push({
        type: "HOME_AWAY_REVERSED",
        provider,
        baselineExternalId: baseline.externalId,
        detail: `${candidate.awayTeam} @ ${candidate.homeTeam}`,
      });
    } else if (
      sameHome &&
      sameAway &&
      diff != null &&
      diff > 180
    ) {
      result.push({
        type: "TIME_DIFFERENCE",
        provider,
        baselineExternalId: baseline.externalId,
        detail: `${diff}분 차이`,
      });
    } else if (
      sameHome !== sameAway &&
      diff != null &&
      diff <= 15
    ) {
      result.push({
        type: "TEAM_NAME_MISMATCH",
        provider,
        baselineExternalId: baseline.externalId,
        detail: `${baseline.awayTeam} @ ${baseline.homeTeam} vs ${candidate.awayTeam} @ ${candidate.homeTeam}`,
      });
    }
  }
  return result;
}

function oddsAsMatchCandidate(event: OddsData) {
  return {
    externalId: event.externalEventId,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    commenceTimeUtc: toUtcIso(event.commenceTime),
    event,
  };
}

function fusionStatus(
  odds: ProviderMatch<ReturnType<typeof oddsAsMatchCandidate>>,
  sportsData: ProviderMatch<SportsDataGame>,
): FusionStatus {
  if (odds.method === "ambiguous" || sportsData.method === "ambiguous") {
    return "AMBIGUOUS";
  }
  if (odds.item && sportsData.item) return "FULL_MATCH";
  if (!odds.item && sportsData.item) return "ODDS_ONLY_MISSING";
  if (odds.item && !sportsData.item) return "SPORTSDATA_ONLY_MISSING";
  return "BOTH_MISSING";
}

function avg(values: number[]): number | null {
  return values.length === 0
    ? null
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

async function main() {
  console.log(`=== MLB 데이터 fusion 검증 (${TARGET_DATE_KST} KST) ===`);
  console.log(
    `KST 경계: ${new Date(KST_START_MS).toISOString()} <= start < ${new Date(KST_END_MS).toISOString()}`,
  );

  // Provider끼리 독립적이므로 병렬 조회. 각 endpoint는 내부 캐시로 1회만 호출한다.
  const [baselineResult, oddsResult, sportsDataResult] = await Promise.all([
    loadApiBaseballBaseline(),
    loadOdds(),
    loadSportsData(),
  ]);

  const oddsCandidates = oddsResult.events.map(oddsAsMatchCandidate);
  const usedOdds = new Set<string>();
  const usedSportsData = new Set<string>();
  const discrepancies: Discrepancy[] = [];

  const games = baselineResult.games.map((baseline, index) => {
    const oddsMatch = chooseMatch(baseline, oddsCandidates);
    const sportsDataMatch = chooseMatch(baseline, sportsDataResult.games);
    discrepancies.push(
      ...collectDiscrepancies(
        baseline,
        oddsCandidates,
        "the-odds-api",
        oddsMatch,
      ),
      ...collectDiscrepancies(
        baseline,
        sportsDataResult.games,
        "sportsdataio",
        sportsDataMatch,
      ),
    );
    if (oddsMatch.item) usedOdds.add(oddsMatch.item.externalId);
    if (sportsDataMatch.item) usedSportsData.add(sportsDataMatch.item.gameId);

    // 기존 matcher도 같은 결과인지 확인하되, 실제 선택은 모호성 검사를 포함한 위 결과 사용.
    const gameData: GameData = {
      id: `api-baseball-${baseline.externalId}`,
      sport: "baseball",
      league: "MLB",
      homeTeam: baseline.homeTeam,
      awayTeam: baseline.awayTeam,
      startTime: baseline.startTimeKst,
      date: baseline.dateKst,
      aiAnalysisAvailable: false,
      externalId: baseline.externalId,
      externalProvider: "apisports",
    };
    const existingOddsMatch = matchOddsToGame(
      gameData,
      oddsResult.events,
      {
        commenceToleranceMs: MATCH_TOLERANCE_MS,
        minConfidence: MIN_CONFIDENCE,
      },
    );

    const sportsGame = sportsDataMatch.item;
    const lineup = sportsGame
      ? sportsDataResult.lineups.get(sportsGame.gameId)
      : null;
    const homeInjuries =
      sportsGame?.homeTeamId == null
        ? 0
        : (sportsDataResult.injuriesByTeam.get(sportsGame.homeTeamId) ?? 0);
    const awayInjuries =
      sportsGame?.awayTeamId == null
        ? 0
        : (sportsDataResult.injuriesByTeam.get(sportsGame.awayTeamId) ?? 0);
    const pitcherAvailable = Boolean(
      sportsGame &&
        (sportsGame.startingPitcherIds.home ??
          sportsGame.probablePitcherIds.home) != null &&
        (sportsGame.startingPitcherIds.away ??
          sportsGame.probablePitcherIds.away) != null,
    );
    const oddsEvent = oddsMatch.item?.event ?? null;
    const oddsAvailable = Boolean(
      oddsEvent?.bestHomeOdds != null &&
        oddsEvent.bestAwayOdds != null,
    );
    const status = fusionStatus(oddsMatch, sportsDataMatch);

    return {
      index: index + 1,
      baseline: {
        source: "api-baseball",
        ...baseline,
      },
      oddsMatch: {
        method: oddsMatch.method,
        confidence: oddsMatch.confidence,
        candidateCount: oddsMatch.candidateCount,
        timeDiffMinutes: oddsMatch.timeDiffMinutes,
        existingMatchOddsToGameAgreement:
          existingOddsMatch?.odds.externalEventId ===
          oddsMatch.item?.externalId,
        event: oddsEvent
          ? {
              eventId: oddsEvent.externalEventId,
              commenceTime: oddsEvent.commenceTime,
              homeTeam: oddsEvent.homeTeam,
              awayTeam: oddsEvent.awayTeam,
              bestHomeOdds: oddsEvent.bestHomeOdds,
              bestAwayOdds: oddsEvent.bestAwayOdds,
              bookmakerCount: oddsEvent.bookmakers.length,
            }
          : null,
      },
      sportsDataMatch: {
        method: sportsDataMatch.method,
        confidence: sportsDataMatch.confidence,
        candidateCount: sportsDataMatch.candidateCount,
        timeDiffMinutes: sportsDataMatch.timeDiffMinutes,
        game: sportsGame,
      },
      quality: {
        startingPitcherAvailable: pitcherAvailable,
        projectedLineupAvailable: lineup?.projectedAvailable ?? false,
        confirmedLineupAvailable: lineup?.confirmedAvailable ?? false,
        projectedLineupPlayerCount: lineup?.projectedPlayerCount ?? 0,
        confirmedLineupPlayerCount: lineup?.confirmedPlayerCount ?? 0,
        injuriesCount: homeInjuries + awayInjuries,
        homeInjuriesCount: homeInjuries,
        awayInjuriesCount: awayInjuries,
        oddsAvailable,
      },
      fusionStatus: status,
    };
  });

  const oddsOnly = oddsCandidates
    .filter((item) => !usedOdds.has(item.externalId))
    .map((item) => ({
      eventId: item.externalId,
      commenceTime: item.event.commenceTime,
      homeTeam: item.homeTeam,
      awayTeam: item.awayTeam,
    }));
  const sportsDataOnly = sportsDataResult.games
    .filter((item) => !usedSportsData.has(item.gameId))
    .map((item) => ({
      gameId: item.gameId,
      commenceTimeUtc: item.commenceTimeUtc,
      homeTeam: item.homeTeam,
      awayTeam: item.awayTeam,
    }));

  const fullMatchCount = games.filter(
    (game) => game.fusionStatus === "FULL_MATCH",
  ).length;
  const partialMatchCount = games.filter(
    (game) =>
      game.fusionStatus === "ODDS_ONLY_MISSING" ||
      game.fusionStatus === "SPORTSDATA_ONLY_MISSING",
  ).length;
  const failedMatchCount = games.length - fullMatchCount - partialMatchCount;
  const pitcherCount = games.filter(
    (game) => game.quality.startingPitcherAvailable,
  ).length;
  const projectedCount = games.filter(
    (game) => game.quality.projectedLineupAvailable,
  ).length;
  const confirmedCount = games.filter(
    (game) => game.quality.confirmedLineupAvailable,
  ).length;
  const injuryCount = games.filter(
    (game) => game.quality.injuriesCount > 0,
  ).length;
  const oddsCount = games.filter(
    (game) => game.quality.oddsAvailable,
  ).length;

  const discrepancyCounts = new Map<DiscrepancyType, number>();
  for (const item of discrepancies) {
    discrepancyCounts.set(
      item.type,
      (discrepancyCounts.get(item.type) ?? 0) + 1,
    );
  }
  const unmatchedCounts = {
    SPORTSDATA_ONLY_GAME: sportsDataOnly.length,
    ODDS_ONLY_GAME: oddsOnly.length,
    API_BASEBALL_ONLY_GAME: games.filter(
      (game) =>
        !game.oddsMatch.event && !game.sportsDataMatch.game,
    ).length,
  };
  const discrepancyRanking = [
    ...[...discrepancyCounts.entries()].map(([type, count]) => ({
      type,
      count,
    })),
    ...Object.entries(unmatchedCounts).map(([type, count]) => ({
      type,
      count,
    })),
  ].sort((a, b) => b.count - a.count);
  const mostCommonDiscrepancy =
    discrepancyRanking.find((item) => item.count > 0) ?? null;

  const allGamesFullMatch =
    games.length > 0 &&
    fullMatchCount === games.length;
  const engineReady =
    allGamesFullMatch && !sportsDataResult.scrambledMarkerObserved;

  const output = {
    meta: {
      version: "mlb-data-fusion-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      kstBoundary: {
        fromInclusiveUtc: new Date(KST_START_MS).toISOString(),
        toExclusiveUtc: new Date(KST_END_MS).toISOString(),
      },
      readOnlyValidation: true,
      trialValuesVerifiedAsReal: false,
      scrambledMarkerObserved:
        sportsDataResult.scrambledMarkerObserved,
      trialValueNote:
        sportsDataResult.scrambledMarkerObserved
          ? "SportsDataIO 게임 응답에서 literal 'Scrambled' 표시를 확인함. 해당 Trial 세부값을 실제값으로 간주하지 않음."
          : "응답 또는 계정 안내에서 실제값/스크램블 여부를 확인하지 못해 단정하지 않음",
    },
    providerSummary: {
      apiBaseball: {
        baseline: true,
        leagueId: baselineResult.leagueId,
        season: baselineResult.season,
        gameCount: baselineResult.games.length,
        error: baselineResult.error,
        requests: baselineResult.usage,
        averageResponseMs: avg(baselineResult.elapsedMs),
      },
      theOddsApi: {
        activeSport: oddsResult.sport,
        eventCount: oddsResult.events.length,
        error: oddsResult.error,
        requests: {
          calls: oddsResult.calls,
          remaining: oddsResult.usage.requestsRemaining,
          used: oddsResult.usage.requestsUsed,
          last: oddsResult.usage.requestsLast,
        },
        averageResponseMs: avg(oddsResult.elapsedMs),
      },
      sportsDataIo: {
        gameCount: sportsDataResult.games.length,
        error: sportsDataResult.error,
        requests: {
          calls: sportsDataResult.calls,
          remaining: sportsDataResult.usage.remaining,
          used: sportsDataResult.usage.used,
        },
        endpointSupport: sportsDataResult.endpointSupport,
        observedLineupFields: sportsDataResult.observedLineupFields,
        averageResponseMs: avg(sportsDataResult.elapsedMs),
      },
    },
    summary: {
      baselineGames: games.length,
      fullMatch: fullMatchCount,
      partialMatch: partialMatchCount,
      failedMatch: failedMatchCount,
      startingPitchersAvailable: pitcherCount,
      projectedLineupsAvailable: projectedCount,
      confirmedLineupsAvailable: confirmedCount,
      injuriesAvailable: injuryCount,
      oddsAvailable: oddsCount,
      mostCommonDiscrepancy,
      engineReady,
      engineDecision:
        !allGamesFullMatch
          ? "FULL_MATCH가 아닌 기준 경기가 있어 Engine 투입 준비 완료로 표시하지 않음"
          : sportsDataResult.scrambledMarkerObserved
            ? "15경기 모두 FULL_MATCH지만 SportsDataIO Trial 응답에 Scrambled 표시가 있어 Engine 투입 준비 완료로 표시하지 않음"
            : "모든 기준 경기가 FULL_MATCH이고 Scrambled 표시를 확인하지 못함",
    },
    games,
    mismatches: {
      discrepancies,
      sportsDataOnly,
      oddsOnly,
      apiBaseballOnly: games
        .filter(
          (game) =>
            !game.oddsMatch.event && !game.sportsDataMatch.game,
        )
        .map((game) => game.baseline),
    },
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`\n기준 MLB 경기 수: ${games.length}`);
  console.log(`FULL_MATCH: ${fullMatchCount}`);
  console.log(`부분 매칭: ${partialMatchCount}`);
  console.log(`매칭 실패: ${failedMatchCount}`);
  console.log(`선발투수 확보 경기 수: ${pitcherCount}`);
  console.log(`projected lineup 확보 경기 수: ${projectedCount}`);
  console.log(`confirmed lineup 확보 경기 수: ${confirmedCount}`);
  console.log(`부상 데이터 확보 경기 수: ${injuryCount}`);
  console.log(`배당 확보 경기 수: ${oddsCount}`);
  console.log(
    `가장 많이 발생한 불일치: ${
      mostCommonDiscrepancy
        ? `${mostCommonDiscrepancy.type} (${mostCommonDiscrepancy.count})`
        : "없음"
    }`,
  );
  console.log(
    `API 사용량: API-BASEBALL calls=${baselineResult.usage.calls} remaining=${baselineResult.usage.remaining ?? "?"} limit=${baselineResult.usage.limit ?? "?"}; ` +
      `Odds calls=${oddsResult.calls} remaining=${oddsResult.usage.requestsRemaining ?? "?"} used=${oddsResult.usage.requestsUsed ?? "?"}; ` +
      `SportsDataIO calls=${sportsDataResult.calls} remaining=${sportsDataResult.usage.remaining ?? "?"} used=${sportsDataResult.usage.used ?? "?"}`,
  );
  console.log(`Engine 투입 가능 여부: ${engineReady ? "가능" : "불가"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error("FAILED:", safeError(error));
  process.exitCode = 1;
});
