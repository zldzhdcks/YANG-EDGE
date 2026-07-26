import { buildGameId } from "@/lib/game-id";
import { instantToKst } from "@/lib/datetime/kst";
import type { GameData } from "@/types/game";

const API_BASEBALL_DEFAULT_URL = "https://v1.baseball.api-sports.io";
/** /leagues?search=MLB 및 2026 검증 리포트에서 확인된 API-BASEBALL MLB ID. */
const MLB_LEAGUE_ID = 1;
const MLB_SEASON = 2026;
const MLB_GAMES_CACHE_TTL_MS = 10 * 60 * 1000;

type ApiBaseballEnvelope<T> = {
  errors?: unknown;
  results?: number;
  response?: T;
};

type ApiBaseballGame = {
  id?: number;
  date?: string;
  time?: string;
  timestamp?: number;
  timezone?: string;
  status?: {
    short?: string;
    long?: string;
  };
  league?: {
    id?: number;
    name?: string;
    season?: number;
  };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
};

export type ApiBaseballUsage = {
  requestsRemaining: number | null;
  requestsLimit: number | null;
};

export type MlbGamesResult = {
  games: GameData[];
  cached: boolean;
  fetchedAt: string;
  usage: ApiBaseballUsage;
  leagueId: number;
  season: number;
};

type CacheEntry = {
  expiresAt: number;
  value: Omit<MlbGamesResult, "cached">;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Omit<MlbGamesResult, "cached">>>();

function readApiKey(): string {
  return (
    process.env.BASEBALL_API_KEY ??
    process.env.FOOTBALL_API_KEY ??
    ""
  ).trim();
}

function readBaseUrl(): string {
  return (
    process.env.BASEBALL_API_BASE_URL ?? API_BASEBALL_DEFAULT_URL
  ).replace(/\/$/, "");
}

function errorsText(errors: unknown): string {
  if (errors == null) return "";
  if (Array.isArray(errors)) return errors.map(String).join("; ");
  if (typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>)
      .map(String)
      .filter(Boolean)
      .join("; ");
  }
  return String(errors);
}

function numberHeader(headers: Headers, ...names: string[]): number | null {
  for (const name of names) {
    const raw = headers.get(name);
    if (!raw) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function parseUsage(headers: Headers): ApiBaseballUsage {
  return {
    requestsRemaining: numberHeader(
      headers,
      "x-ratelimit-requests-remaining",
      "x-ratelimit-remaining",
    ),
    requestsLimit: numberHeader(
      headers,
      "x-ratelimit-requests-limit",
      "x-ratelimit-limit",
    ),
  };
}

function toKstSchedule(
  game: ApiBaseballGame,
): { date: string; time: string } | null {
  if (typeof game.timestamp === "number" && Number.isFinite(game.timestamp)) {
    return instantToKst(new Date(game.timestamp * 1000));
  }

  if (game.date) {
    const parsed = new Date(game.date);
    if (!Number.isNaN(parsed.getTime()) && game.date.includes("T")) {
      return instantToKst(parsed);
    }
  }

  if (game.date && /^\d{4}-\d{2}-\d{2}$/.test(game.date)) {
    const time =
      game.time && /^\d{2}:\d{2}/.test(game.time)
        ? game.time.slice(0, 5)
        : "TBD";
    return { date: game.date, time };
  }

  return null;
}

function mapApiBaseballGame(
  raw: ApiBaseballGame,
  dateKst: string,
): GameData | null {
  const externalId =
    typeof raw.id === "number" && Number.isFinite(raw.id)
      ? String(raw.id)
      : null;
  const homeTeam = raw.teams?.home?.name?.trim();
  const awayTeam = raw.teams?.away?.name?.trim();
  const schedule = toKstSchedule(raw);

  if (
    !externalId ||
    !homeTeam ||
    !awayTeam ||
    !schedule ||
    schedule.date !== dateKst
  ) {
    return null;
  }

  return {
    id: buildGameId("MLB", homeTeam, awayTeam),
    sport: "baseball",
    league: "MLB",
    homeTeam,
    awayTeam,
    date: schedule.date,
    startTime: schedule.time,
    status: raw.status?.long?.trim() || raw.status?.short?.trim() || undefined,
    aiAnalysisAvailable: false,
    externalId,
    externalProvider: "api-baseball",
  };
}

async function fetchMlbGamesForDate(
  dateKst: string,
): Promise<Omit<MlbGamesResult, "cached">> {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error("BASEBALL_API_KEY is not configured");
  }

  const url = new URL(`${readBaseUrl()}/games`);
  url.searchParams.set("league", String(MLB_LEAGUE_ID));
  url.searchParams.set("season", String(MLB_SEASON));
  url.searchParams.set("date", dateKst);
  url.searchParams.set("timezone", "Asia/Seoul");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-apisports-key": apiKey,
    },
    cache: "no-store",
  });

  let body: ApiBaseballEnvelope<ApiBaseballGame[]> | null = null;
  try {
    body = (await response.json()) as ApiBaseballEnvelope<ApiBaseballGame[]>;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(
      `API-BASEBALL games request failed (${response.status} ${response.statusText})`,
    );
  }

  const apiError = errorsText(body?.errors);
  if (apiError) {
    throw new Error(`API-BASEBALL games request failed: ${apiError}`);
  }

  const rows = Array.isArray(body?.response) ? body.response : [];
  const games = rows
    .map((row) => mapApiBaseballGame(row, dateKst))
    .filter((game): game is GameData => game !== null);

  return {
    games,
    fetchedAt: new Date().toISOString(),
    usage: parseUsage(response.headers),
    leagueId: MLB_LEAGUE_ID,
    season: MLB_SEASON,
  };
}

/**
 * API-BASEBALL Pro MLB 날짜별 일정.
 * 성공 응답은 날짜별 10분 캐시하며, 동시 요청도 하나의 Promise를 공유한다.
 */
export async function getMlbGamesForDate(
  dateKst: string,
): Promise<MlbGamesResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    throw new Error("MLB schedule date must be YYYY-MM-DD");
  }

  const cached = cache.get(dateKst);
  if (cached && Date.now() <= cached.expiresAt) {
    return { ...cached.value, cached: true };
  }
  if (cached) cache.delete(dateKst);

  const pending =
    inFlight.get(dateKst) ??
    fetchMlbGamesForDate(dateKst).finally(() => {
      inFlight.delete(dateKst);
    });
  inFlight.set(dateKst, pending);

  const value = await pending;
  cache.set(dateKst, {
    expiresAt: Date.now() + MLB_GAMES_CACHE_TTL_MS,
    value,
  });
  return { ...value, cached: false };
}

export const MLB_RUNTIME_CONFIG = {
  leagueId: MLB_LEAGUE_ID,
  season: MLB_SEASON,
  cacheTtlMs: MLB_GAMES_CACHE_TTL_MS,
} as const;
