/**
 * 2026-07-27 KST MLB 일정·배당 커버리지 검증.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/test-mlb-coverage.ts
 *
 * 조회 전용:
 * - 현재 연결된 TheSportsDB / API-BASEBALL / The Odds API 응답만 사용한다.
 * - EDGE Engine, UI, Provider 구현 및 팀 alias를 변경하지 않는다.
 * - API 키는 로그와 결과 파일에 포함하지 않는다.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst, utcToKst } from "../src/lib/datetime/kst";
import {
  matchOddsToGames,
  normalizeTeamNameForOdds,
  TheOddsApiProvider,
  type OddsData,
  type OddsSportInfo,
  type OddsUsageMeta,
} from "../src/lib/odds";
import type { GameData } from "../src/types/game";

const TARGET_DATE_KST = "2026-07-27";
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-coverage.json`,
);
const KST_DAY_START = Date.parse(`${TARGET_DATE_KST}T00:00:00+09:00`);
const KST_DAY_END_EXCLUSIVE = Date.parse("2026-07-28T00:00:00+09:00");
const COMMENCE_TOLERANCE_MS = 3 * 60 * 60 * 1000;
const UNKNOWN = "확인되지 않음";

type ScheduleSource = "thesportsdb" | "api-baseball";

type ScheduleGame = {
  source: ScheduleSource;
  externalId: string | null;
  league: "MLB";
  homeTeam: string;
  awayTeam: string;
  commenceTime: string | null;
  dateKst: string;
  startTimeKst: string;
  status: string;
};

type ProviderCheck = {
  configured: boolean;
  supported: boolean;
  leagueId: string | number | null;
  calls: number;
  error: string | null;
};

type UsageReport = {
  theSportsDbCalls: number;
  apiBaseballCalls: number;
  oddsApiCalls: number;
  oddsSportsList: OddsUsageMeta;
  oddsMlbEvents: OddsUsageMeta;
};

type SafeFetchResult<T> = {
  ok: boolean;
  status: number;
  json: T | null;
  headers: Headers;
  error: string | null;
};

type TheSportsDbLeague = {
  idLeague?: string;
  strLeague?: string;
  strSport?: string;
};

type TheSportsDbEvent = {
  idEvent?: string;
  strLeague?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  strStatus?: string;
};

type ApiBaseballEnvelope = {
  errors?: unknown;
  results?: number;
  response?: unknown[];
};

type ApiBaseballLeague = {
  id?: number;
  name?: string;
  seasons?: Array<{
    season?: number;
    year?: number;
    current?: boolean;
  }>;
};

type ApiBaseballGame = {
  id?: number;
  date?: string;
  time?: string;
  timestamp?: number;
  timezone?: string;
  status?: { short?: string; long?: string };
  league?: { id?: number; name?: string };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
};

function emptyUsage(): OddsUsageMeta {
  return {
    requestsRemaining: null,
    requestsUsed: null,
    requestsLast: null,
  };
}

function safeError(reason: unknown): string {
  const message =
    reason instanceof Error ? reason.message : typeof reason === "string" ? reason : UNKNOWN;
  return message
    .replace(/apiKey=[^&\s]+/gi, "apiKey=***")
    .replace(/x-apisports-key[^,\s]*/gi, "x-apisports-key=***");
}

async function safeFetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<SafeFetchResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    let json: T | null = null;
    try {
      json = (await response.json()) as T;
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      json,
      headers: response.headers,
      error: response.ok ? null : `HTTP ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: null,
      headers: new Headers(),
      error: safeError(error),
    };
  }
}

function errorsText(errors: unknown): string {
  if (errors == null) return "";
  if (Array.isArray(errors)) return errors.map(String).join("; ");
  if (typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>).map(String).join("; ");
  }
  return String(errors);
}

function parseApiSportsUsage(headers: Headers): {
  remaining: number | null;
  limit: number | null;
} {
  const numberHeader = (name: string): number | null => {
    const raw = headers.get(name);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  return {
    remaining:
      numberHeader("x-ratelimit-requests-remaining") ??
      numberHeader("x-ratelimit-remaining"),
    limit:
      numberHeader("x-ratelimit-requests-limit") ??
      numberHeader("x-ratelimit-limit"),
  };
}

function isMlbLabel(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    /\bmlb\b/.test(normalized) ||
    normalized.includes("major league baseball")
  );
}

function eventInstant(
  dateEvent: string | undefined,
  strTime: string | undefined,
  strTimestamp: string | undefined,
): { iso: string | null; dateKst: string; timeKst: string } | null {
  if (strTimestamp) {
    // TheSportsDB strTimestamp는 이 응답에서 offset 없는 UTC 문자열이다.
    // 기존 Provider의 dateEvent + strTime UTC 처리와 동일하게 Z를 붙인다.
    const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(strTimestamp);
    const instant = new Date(hasExplicitZone ? strTimestamp : `${strTimestamp}Z`);
    const kst = instantToKst(instant);
    if (kst) {
      return {
        iso: instant.toISOString(),
        dateKst: kst.date,
        timeKst: kst.time,
      };
    }
  }

  const kst = utcToKst(dateEvent ?? "", strTime);
  if (!kst) return null;
  const hasTime =
    !!strTime && /^\d{2}:\d{2}/.test(strTime) && strTime !== "00:00:00";
  const iso = hasTime
    ? new Date(`${dateEvent}T${strTime!.slice(0, 8)}Z`).toISOString()
    : null;
  return { iso, dateKst: kst.date, timeKst: kst.time };
}

function apiBaseballInstant(
  game: ApiBaseballGame,
): { iso: string | null; dateKst: string; timeKst: string } | null {
  if (typeof game.timestamp === "number" && Number.isFinite(game.timestamp)) {
    const instant = new Date(game.timestamp * 1000);
    const kst = instantToKst(instant);
    if (kst) {
      return {
        iso: instant.toISOString(),
        dateKst: kst.date,
        timeKst: kst.time,
      };
    }
  }

  if (game.date) {
    const parsed = new Date(game.date);
    if (!Number.isNaN(parsed.getTime()) && /T/.test(game.date)) {
      const kst = instantToKst(parsed);
      if (kst) {
        return {
          iso: parsed.toISOString(),
          dateKst: kst.date,
          timeKst: kst.time,
        };
      }
    }
  }

  if (game.date && /^\d{4}-\d{2}-\d{2}$/.test(game.date)) {
    const hasTime = !!game.time && /^\d{2}:\d{2}/.test(game.time);
    return {
      iso: hasTime
        ? new Date(`${game.date}T${game.time!.slice(0, 5)}:00+09:00`).toISOString()
        : null,
      dateKst: game.date,
      timeKst: hasTime ? game.time!.slice(0, 5) : "TBD",
    };
  }
  return null;
}

async function fetchTheSportsDbSchedule(): Promise<{
  games: ScheduleGame[];
  check: ProviderCheck;
}> {
  const baseUrl = (
    process.env.SPORTS_API_BASE_URL ??
    "https://www.thesportsdb.com/api/v1/json"
  ).replace(/\/$/, "");
  const apiKey = (process.env.SPORTS_API_KEY ?? "").trim();
  const check: ProviderCheck = {
    configured: apiKey.length > 0,
    supported: false,
    leagueId: null,
    calls: 0,
    error: null,
  };
  if (!apiKey) {
    check.error = "SPORTS_API_KEY 미설정";
    return { games: [], check };
  }

  const get = async <T>(endpoint: string) => {
    check.calls += 1;
    return safeFetchJson<T>(`${baseUrl}/${apiKey}/${endpoint}`);
  };

  const leaguesResult = await get<{ countries?: TheSportsDbLeague[] | null }>(
    "search_all_leagues.php?c=United%20States&s=Baseball",
  );
  if (!leaguesResult.ok || !leaguesResult.json) {
    check.error = leaguesResult.error ?? "리그 목록 응답 손상";
    return { games: [], check };
  }

  const leagues = Array.isArray(leaguesResult.json.countries)
    ? leaguesResult.json.countries
    : [];
  const mlb = leagues.find(
    (league) =>
      league.strSport?.toLowerCase() === "baseball" &&
      isMlbLabel(league.strLeague ?? ""),
  );
  if (!mlb?.idLeague) {
    check.error = "활성 Baseball 리그 목록에서 MLB를 찾지 못함";
    return { games: [], check };
  }
  check.supported = true;
  check.leagueId = mlb.idLeague;

  // KST 하루는 UTC 기준 전날 15:00~당일 15:00이므로 두 UTC 날짜 응답을 조회한다.
  const queryDates = ["2026-07-26", "2026-07-27"];
  const rawEvents: TheSportsDbEvent[] = [];
  for (const date of queryDates) {
    const result = await get<{ events?: TheSportsDbEvent[] | null }>(
      `eventsday.php?d=${date}&l=${encodeURIComponent(mlb.idLeague)}`,
    );
    if (!result.ok || !result.json) {
      check.error = result.error ?? `eventsday ${date} 응답 손상`;
      continue;
    }
    if (Array.isArray(result.json.events)) rawEvents.push(...result.json.events);
  }

  const games: ScheduleGame[] = [];
  for (const event of rawEvents) {
    if (!event.strHomeTeam?.trim() || !event.strAwayTeam?.trim()) continue;
    const instant = eventInstant(event.dateEvent, event.strTime, event.strTimestamp);
    if (!instant || instant.dateKst !== TARGET_DATE_KST) continue;
    games.push({
      source: "thesportsdb",
      externalId: event.idEvent ?? null,
      league: "MLB",
      homeTeam: event.strHomeTeam,
      awayTeam: event.strAwayTeam,
      commenceTime: instant.iso,
      dateKst: instant.dateKst,
      startTimeKst: instant.timeKst,
      status: event.strStatus?.trim() || UNKNOWN,
    });
  }
  return { games, check };
}

async function fetchApiBaseballSchedule(): Promise<{
  games: ScheduleGame[];
  check: ProviderCheck;
  usage: { remaining: number | null; limit: number | null };
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
  const check: ProviderCheck = {
    configured: apiKey.length > 0,
    supported: false,
    leagueId: null,
    calls: 0,
    error: null,
  };
  let usage = { remaining: null as number | null, limit: null as number | null };
  if (!apiKey) {
    check.error = "BASEBALL_API_KEY/FOOTBALL_API_KEY 미설정";
    return { games: [], check, usage };
  }

  const get = async (
    endpoint: string,
    params: Record<string, string | number>,
  ) => {
    check.calls += 1;
    const url = new URL(`${baseUrl}/${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    const result = await safeFetchJson<ApiBaseballEnvelope>(url.toString(), {
      headers: { "x-apisports-key": apiKey },
    });
    usage = parseApiSportsUsage(result.headers);
    const apiError = errorsText(result.json?.errors);
    if (apiError) result.error = apiError;
    return result;
  };

  const leagueResult = await get("leagues", { search: "MLB" });
  const leagueEntries = Array.isArray(leagueResult.json?.response)
    ? leagueResult.json!.response!
    : [];
  const mlb = leagueEntries
    .filter((entry): entry is ApiBaseballLeague => typeof entry === "object" && entry !== null)
    .find((league) => isMlbLabel(league.name ?? ""));
  if (!leagueResult.ok || !mlb?.id) {
    check.error = leagueResult.error ?? "리그 검색 응답에서 MLB를 찾지 못함";
    return { games: [], check, usage };
  }
  check.supported = true;
  check.leagueId = mlb.id;

  // 목표 날짜가 2026이므로 다른 시즌으로 대체하지 않는다.
  const gameResult = await get("games", {
    league: mlb.id,
    season: 2026,
    date: TARGET_DATE_KST,
    timezone: "Asia/Seoul",
  });
  if (!gameResult.ok || gameResult.error) {
    check.error = gameResult.error ?? "games 응답 실패";
    return { games: [], check, usage };
  }

  const rawGames = Array.isArray(gameResult.json?.response)
    ? (gameResult.json!.response! as ApiBaseballGame[])
    : [];
  const games: ScheduleGame[] = [];
  for (const game of rawGames) {
    const home = game.teams?.home?.name?.trim();
    const away = game.teams?.away?.name?.trim();
    if (!home || !away) continue;
    const instant = apiBaseballInstant(game);
    if (!instant || instant.dateKst !== TARGET_DATE_KST) continue;
    games.push({
      source: "api-baseball",
      externalId: game.id == null ? null : String(game.id),
      league: "MLB",
      homeTeam: home,
      awayTeam: away,
      commenceTime: instant.iso,
      dateKst: instant.dateKst,
      startTimeKst: instant.timeKst,
      status: game.status?.long?.trim() || game.status?.short?.trim() || UNKNOWN,
    });
  }
  return { games, check, usage };
}

function findActiveMlbSport(sports: OddsSportInfo[]): OddsSportInfo | null {
  const candidates = sports.filter(
    (sport) =>
      sport.active &&
      !sport.hasOutrights &&
      sport.group.toLowerCase() === "baseball" &&
      isMlbLabel(`${sport.key} ${sport.title} ${sport.description}`),
  );
  candidates.sort((a, b) => a.title.length - b.title.length);
  return candidates[0] ?? null;
}

async function fetchMlbOdds(): Promise<{
  events: OddsData[];
  sport: OddsSportInfo | null;
  sportsUsage: OddsUsageMeta;
  eventsUsage: OddsUsageMeta;
  calls: number;
  cached: boolean;
  error: string | null;
}> {
  const baseUrl =
    (process.env.ODDS_API_BASE_URL ?? "").trim() ||
    "https://api.the-odds-api.com/v4";
  const apiKey = (process.env.ODDS_API_KEY ?? "").trim();
  if (!apiKey) {
    return {
      events: [],
      sport: null,
      sportsUsage: emptyUsage(),
      eventsUsage: emptyUsage(),
      calls: 0,
      cached: false,
      error: "ODDS_API_KEY 미설정",
    };
  }

  const provider = new TheOddsApiProvider(baseUrl, apiKey);
  try {
    // /sports는 정확히 한 번만 호출하고 응답을 재사용한다.
    const listed = await provider.listSports();
    const sport = findActiveMlbSport(listed.sports);
    if (!sport) {
      return {
        events: [],
        sport: null,
        sportsUsage: listed.usage,
        eventsUsage: emptyUsage(),
        calls: 1,
        cached: false,
        error: "활성 /sports 응답에서 MLB sport key를 찾지 못함",
      };
    }

    // 동일 sport key + 동일 시간 범위는 Provider 캐시 키 하나만 사용한다.
    const oddsResult = await provider.getOdds({
      sportKey: sport.key,
      regions: "eu",
      markets: "h2h",
      // The Odds API는 ISO 초 단위 형식만 허용한다(밀리초 제외).
      commenceTimeFrom: new Date(KST_DAY_START).toISOString().replace(".000Z", "Z"),
      commenceTimeTo: new Date(KST_DAY_END_EXCLUSIVE)
        .toISOString()
        .replace(".000Z", "Z"),
    });
    const events = oddsResult.events.filter((event) => {
      const kst = instantToKst(event.commenceTime);
      return kst?.date === TARGET_DATE_KST;
    });
    return {
      events,
      sport,
      sportsUsage: listed.usage,
      eventsUsage: oddsResult.usage,
      calls: oddsResult.cached ? 1 : 2,
      cached: oddsResult.cached,
      error: null,
    };
  } catch (error) {
    return {
      events: [],
      sport: null,
      sportsUsage: emptyUsage(),
      eventsUsage: emptyUsage(),
      calls: 0,
      cached: false,
      error: safeError(error),
    };
  }
}

function teamsMatch(a: ScheduleGame, b: ScheduleGame): boolean {
  const homeA = normalizeTeamNameForOdds(a.homeTeam);
  const homeB = normalizeTeamNameForOdds(b.homeTeam);
  const awayA = normalizeTeamNameForOdds(a.awayTeam);
  const awayB = normalizeTeamNameForOdds(b.awayTeam);
  const same = (x: string, y: string) =>
    x === y ||
    (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x)));
  return same(homeA, homeB) && same(awayA, awayB);
}

function isSameFixture(a: ScheduleGame, b: ScheduleGame): boolean {
  if (!teamsMatch(a, b)) return false;
  if (a.commenceTime && b.commenceTime) {
    return (
      Math.abs(Date.parse(a.commenceTime) - Date.parse(b.commenceTime)) <=
      COMMENCE_TOLERANCE_MS
    );
  }
  return a.dateKst === b.dateKst;
}

function mergeScheduleGames(games: ScheduleGame[]): {
  games: ScheduleGame[];
  duplicateMergedCount: number;
  duplicates: Array<{ kept: ScheduleGame; duplicate: ScheduleGame }>;
} {
  const unique: ScheduleGame[] = [];
  const duplicates: Array<{ kept: ScheduleGame; duplicate: ScheduleGame }> = [];
  for (const game of games) {
    const existing = unique.find((candidate) => isSameFixture(candidate, game));
    if (existing) {
      duplicates.push({ kept: existing, duplicate: game });
      continue;
    }
    unique.push(game);
  }
  return {
    games: unique,
    duplicateMergedCount: duplicates.length,
    duplicates,
  };
}

function toGameData(game: ScheduleGame, index: number): GameData {
  return {
    id: `mlb-coverage-${index}`,
    sport: "baseball",
    league: "MLB",
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    startTime: game.startTimeKst,
    date: game.dateKst,
    aiAnalysisAvailable: false,
    externalId: game.externalId ?? undefined,
    externalProvider:
      game.source === "thesportsdb" ? "thesportsdb" : "apisports",
  };
}

function oddsDisplay(event: OddsData) {
  const kst = instantToKst(event.commenceTime);
  return {
    externalId: event.externalEventId,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    commenceTime: event.commenceTime,
    commenceTimeKst: kst
      ? `${kst.date} ${kst.time}`
      : UNKNOWN,
    bestHomeOdds: event.bestHomeOdds,
    bestAwayOdds: event.bestAwayOdds,
    bookmakerCount: event.bookmakers.length,
  };
}

async function main() {
  console.log(`=== MLB 일정·배당 커버리지 (${TARGET_DATE_KST} KST) ===`);
  console.log(
    `KST 경계: ${new Date(KST_DAY_START).toISOString()} <= commence < ${new Date(KST_DAY_END_EXCLUSIVE).toISOString()}`,
  );

  // 서로 다른 Provider이므로 병렬 조회한다. 같은 Provider/sport key는 반복 호출하지 않는다.
  const [sportsDb, apiBaseball, odds] = await Promise.all([
    fetchTheSportsDbSchedule(),
    fetchApiBaseballSchedule(),
    fetchMlbOdds(),
  ]);

  const scheduleCandidates = [...sportsDb.games, ...apiBaseball.games];
  const merged = mergeScheduleGames(scheduleCandidates);
  const matchGames = merged.games.map(toGameData);
  const matches = matchOddsToGames(matchGames, odds.events, {
    commenceToleranceMs: COMMENCE_TOLERANCE_MS,
  });
  const matchedScheduleIds = new Set(matches.map((match) => match.game.id));
  const matchedOddsIds = new Set(
    matches.map((match) => match.odds.externalEventId),
  );
  const scheduleOnly = merged.games.filter(
    (_, index) => !matchedScheduleIds.has(`mlb-coverage-${index}`),
  );
  const oddsOnly = odds.events.filter(
    (event) => !matchedOddsIds.has(event.externalEventId),
  );

  // 최종 고유 수는 일정과 배당 이벤트의 합집합이다.
  // 일정에 없는 Odds 이벤트는 현재 /games 보완 구조에서 일정 후보로 변환 가능하다.
  const finalUniqueCount = merged.games.length + oddsOnly.length;
  const gamesWithOdds = matches.length + oddsOnly.length;
  const totalDuplicateMerged =
    merged.duplicateMergedCount + matches.length;
  const matchRate =
    merged.games.length > 0
      ? Math.round((matches.length / merged.games.length) * 10000) / 100
      : 0;

  const usage: UsageReport = {
    theSportsDbCalls: sportsDb.check.calls,
    apiBaseballCalls: apiBaseball.check.calls,
    oddsApiCalls: odds.calls,
    oddsSportsList: odds.sportsUsage,
    oddsMlbEvents: odds.eventsUsage,
  };

  const output = {
    meta: {
      version: "mlb-coverage-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      kstBoundary: {
        fromInclusiveUtc: new Date(KST_DAY_START).toISOString(),
        toExclusiveUtc: new Date(KST_DAY_END_EXCLUSIVE).toISOString(),
        note: "미국 현지 날짜와 KST 날짜가 다르므로 UTC/KST 시각으로 재필터링함",
      },
      readOnlyValidation: true,
    },
    providerChecks: {
      theSportsDb: sportsDb.check,
      apiBaseball: {
        ...apiBaseball.check,
        usage: apiBaseball.usage,
      },
      theOddsApi: {
        configured: (process.env.ODDS_API_KEY ?? "").trim().length > 0,
        supported: odds.sport != null,
        activeSport: odds.sport,
        calls: odds.calls,
        cached: odds.cached,
        error: odds.error,
      },
    },
    counts: {
      scheduleBySource: {
        thesportsdb: sportsDb.games.length,
        apiBaseball: apiBaseball.games.length,
      },
      scheduleCandidates: scheduleCandidates.length,
      oddsEvents: odds.events.length,
      duplicateMerged: totalDuplicateMerged,
      scheduleSourceDuplicates: merged.duplicateMergedCount,
      scheduleOddsDuplicates: matches.length,
      uniqueScheduleGames: merged.games.length,
      finalUniqueGames: finalUniqueCount,
      gamesWithOdds,
      matchSuccess: matches.length,
      matchFailure: scheduleOnly.length,
      scheduleOnly: scheduleOnly.length,
      oddsOnly: oddsOnly.length,
      matchRatePercent: matchRate,
    },
    schedules: {
      thesportsdb: sportsDb.games,
      apiBaseball: apiBaseball.games,
      unique: merged.games,
    },
    odds: odds.events.map(oddsDisplay),
    matching: {
      matched: matches.map((match) => ({
        schedule: merged.games[Number(match.game.id.replace("mlb-coverage-", ""))],
        odds: oddsDisplay(match.odds),
        method: match.method,
        confidence: match.confidence,
      })),
      failedSchedule: scheduleOnly,
      oddsOnly: oddsOnly.map(oddsDisplay),
    },
    duplicates: merged.duplicates,
    usage,
    gamesMergeAssessment: {
      schemaCompatible: finalUniqueCount > 0,
      currentlyWired: false,
      note:
        finalUniqueCount > 0
          ? "GameData 필수 필드와 Odds 일정 보완 구조에는 맞지만, 현재 /games의 야구 보완 대상은 KBO/NPB뿐이므로 MLB는 아직 연결되어 있지 않음."
          : "실제 Provider 응답에서 대상일 MLB 경기를 확보하지 못해 병합 가능성을 확인하지 못함.",
      engineAnalysisPrerequisites: [
        "최근 경기·홈/원정 성적",
        "선발투수",
        "라인업·부상",
        "리그 순위·시즌 성적",
        "상대 전적",
      ],
    },
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log("\n일정 source별 경기 수");
  console.log(`  TheSportsDB : ${sportsDb.games.length}`);
  console.log(`  API-BASEBALL: ${apiBaseball.games.length}`);
  console.log(`Odds 활성 MLB key: ${odds.sport?.key ?? "미확인"}`);
  console.log(`Odds 이벤트 수: ${odds.events.length}`);
  console.log(
    `중복 병합 수: ${totalDuplicateMerged} (일정 source간 ${merged.duplicateMergedCount}, 일정↔Odds ${matches.length})`,
  );
  console.log(`일정 고유 경기 수: ${merged.games.length}`);
  console.log(`최종 MLB 고유 경기 수(일정∪Odds): ${finalUniqueCount}`);
  console.log(`배당 있는 경기 수: ${gamesWithOdds}`);
  console.log(
    `매칭 성공/실패: ${matches.length}/${scheduleOnly.length} (${matchRate.toFixed(2)}%)`,
  );
  console.log(`일정만 있는 경기: ${scheduleOnly.length}`);
  console.log(`배당만 있는 경기: ${oddsOnly.length}`);
  console.log(
    `API 사용량: Odds remaining=${odds.eventsUsage.requestsRemaining ?? "?"} used=${odds.eventsUsage.requestsUsed ?? "?"} last=${odds.eventsUsage.requestsLast ?? "?"}; calls sportsdb=${sportsDb.check.calls}, api-baseball=${apiBaseball.check.calls}, odds=${odds.calls}`,
  );
  console.log(
    `/games 병합 가능 여부: ${output.gamesMergeAssessment.schemaCompatible ? "구조상 가능, 현재 미연결" : "확인 불가"}`,
  );
  console.log(
    `Engine 분석 전 필요 데이터: ${output.gamesMergeAssessment.engineAnalysisPrerequisites.join(", ")}`,
  );

  if (scheduleOnly.length > 0) {
    console.log("\n배당 매칭 실패 일정");
    for (const game of scheduleOnly) {
      console.log(
        `  ${game.startTimeKst} ${game.awayTeam} @ ${game.homeTeam} (${game.source})`,
      );
    }
  }
  if (oddsOnly.length > 0) {
    console.log("\n일정 매칭 실패 Odds 이벤트");
    for (const event of oddsOnly) {
      const kst = instantToKst(event.commenceTime);
      console.log(
        `  ${kst?.time ?? "TBD"} ${event.awayTeam} @ ${event.homeTeam}`,
      );
    }
  }
  console.log(`\n저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error("FAILED:", safeError(error));
  process.exitCode = 1;
});
