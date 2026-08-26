/**
 * NPB schedule-only collect.
 *
 * Reuses the approved API-BASEBALL + TheSportsDB fetch path from
 * scripts/run-npb-kbo-immediate-pregame-accumulation-v1.ts.
 * Writes data/research/npb/{date}-schedule-v1.json only.
 *
 * Does not write odds, starters, lineups, or Prediction snapshots.
 *
 *   npm run research:npb-schedule -- --date 2026-08-26
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import { buildGameId } from "../src/lib/game-id";

const DATE_ARG =
  process.argv.find((a, i, arr) => arr[i - 1] === "--date") ??
  process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ??
  "";

type PregameClockState =
  | "PREGAME_OPEN"
  | "WARMUP_OPEN"
  | "ALREADY_STARTED"
  | "FINAL"
  | "POSTPONED"
  | "CANCELLED"
  | "UNKNOWN";

type ProviderCall = {
  provider: "API_BASEBALL" | "THESPORTSDB";
  endpoint: string;
  callCount: number;
  cached: boolean;
  observationTime: string;
  error: string | null;
  resultCount: number;
};

type ScheduleGame = {
  gameId: string;
  internalGameId: string;
  providerGameId: string | null;
  provider: string;
  home: string;
  away: string;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  scheduledStartTime: string | null;
  commenceTimeUtc: string | null;
  statusAbstract: string | null;
  statusDetailed: string | null;
  collectedAt: string;
  source: string;
  clockState: PregameClockState;
  minutesToStart: number | null;
  homeProviderTeamId: string | null;
  awayProviderTeamId: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function classifyClock(
  scheduledStartTime: string | null,
  statusAbstract: string | null,
  statusDetailed: string | null,
  nowMs: number,
): { clockState: PregameClockState; minutesToStart: number | null } {
  const blob = `${statusAbstract ?? ""} ${statusDetailed ?? ""}`.toUpperCase();
  if (/FINAL|FT|AOT|ENDED/.test(blob)) {
    return { clockState: "FINAL", minutesToStart: null };
  }
  if (/POSTP|POSTPONED/.test(blob)) {
    return { clockState: "POSTPONED", minutesToStart: null };
  }
  if (/CANC|CANCEL/.test(blob)) {
    return { clockState: "CANCELLED", minutesToStart: null };
  }
  let startMs: number | null = null;
  if (scheduledStartTime) {
    const ms = Date.parse(scheduledStartTime);
    if (Number.isFinite(ms)) startMs = ms;
  }
  const minutesToStart =
    startMs == null ? null : Math.round((startMs - nowMs) / 60000);
  const hardCutoff = startMs != null && nowMs >= startMs;
  const liveLike =
    /\bLIVE\b|IN[_\s-]?PROGRESS|\bIN_PLAY\b/.test(blob) &&
    !/\bNOT\s+STARTED\b|\bNS\b/.test(blob);
  if (hardCutoff || liveLike) {
    return { clockState: "ALREADY_STARTED", minutesToStart };
  }
  if (/WARMUP|WARM-UP|PRE-GAME|PREGAME/.test(blob) && !hardCutoff) {
    return { clockState: "WARMUP_OPEN", minutesToStart };
  }
  if (startMs != null && !hardCutoff) {
    return { clockState: "PREGAME_OPEN", minutesToStart };
  }
  return { clockState: "UNKNOWN", minutesToStart };
}

async function fetchTheSportsDbEvents(leagueId: string, dateKst: string) {
  const t0 = Date.now();
  const observationTime = nowIso();
  const base = (
    process.env.SPORTS_API_BASE_URL ?? "https://www.thesportsdb.com/api/v1/json"
  ).replace(/\/$/, "");
  const key = (process.env.SPORTS_API_KEY ?? "").trim();
  if (!key) {
    return {
      events: [] as any[],
      fetchedAt: observationTime,
      error: "SPORTS_API_KEY missing",
      durationMs: Date.now() - t0,
      cached: false,
    };
  }
  const url = `${base}/${key}/eventsday.php?d=${encodeURIComponent(dateKst)}&l=${encodeURIComponent(leagueId)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { events?: any[] | null };
    return {
      events: Array.isArray(json.events) ? json.events : [],
      fetchedAt: nowIso(),
      error: res.ok ? null : `HTTP ${res.status}`,
      durationMs: Date.now() - t0,
      cached: false,
    };
  } catch (e) {
    return {
      events: [] as any[],
      fetchedAt: nowIso(),
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - t0,
      cached: false,
    };
  }
}

async function fetchApiBaseball(pathAndQuery: string) {
  const t0 = Date.now();
  const base = (
    process.env.BASEBALL_API_BASE_URL ?? "https://v1.baseball.api-sports.io"
  ).replace(/\/$/, "");
  const key = (
    process.env.BASEBALL_API_KEY ??
    process.env.FOOTBALL_API_KEY ??
    ""
  ).trim();
  if (!key) {
    return {
      json: null as any,
      fetchedAt: nowIso(),
      error: "API key missing",
      durationMs: Date.now() - t0,
      cached: false,
      usage: { remaining: null as string | null, limit: null as string | null },
    };
  }
  const url = `${base}/${pathAndQuery.replace(/^\//, "")}`;
  try {
    const res = await fetch(url, {
      headers: { "x-apisports-key": key },
      cache: "no-store",
    });
    const json = await res.json();
    return {
      json,
      fetchedAt: nowIso(),
      error: res.ok ? null : `HTTP ${res.status}`,
      durationMs: Date.now() - t0,
      cached: false,
      usage: {
        remaining: res.headers.get("x-ratelimit-requests-remaining"),
        limit: res.headers.get("x-ratelimit-requests-limit"),
      },
    };
  } catch (e) {
    return {
      json: null,
      fetchedAt: nowIso(),
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - t0,
      cached: false,
      usage: { remaining: null, limit: null },
    };
  }
}

async function resolveApiBaseballNpbLeagueId(): Promise<{
  leagueId: string | null;
  error: string | null;
  call: ProviderCall;
}> {
  // Existing research mapping: scripts/build-baseball-backtest-dataset.ts uses leagueId 2 for NPB.
  const known = "2";
  const search = await fetchApiBaseball("leagues?search=NPB");
  const call: ProviderCall = {
    provider: "API_BASEBALL",
    endpoint: "leagues?search=NPB",
    callCount: search.error === "API key missing" ? 0 : 1,
    cached: search.cached,
    observationTime: search.fetchedAt,
    error: search.error,
    resultCount: Array.isArray(search.json?.response)
      ? search.json.response.length
      : 0,
  };
  const hit =
    (Array.isArray(search.json?.response) ? search.json.response : []).find(
      (l: { name?: string; country?: { name?: string }; id?: number }) =>
        `${l.name ?? ""}`.toLowerCase().includes("npb"),
    ) ??
    (Array.isArray(search.json?.response) ? search.json.response : []).find(
      (l: { id?: number }) => l.id === 2,
    ) ??
    null;
  return {
    leagueId: hit?.id != null ? String(hit.id) : known,
    error: search.error,
    call,
  };
}

export function npbScheduleV1Rel(dateKst: string): string {
  return `data/research/npb/${dateKst}-schedule-v1.json`;
}

export async function buildNpbScheduleV1(dateKst: string, cwd = process.cwd()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    throw new Error("DATE_KST_INVALID");
  }
  const collectedAt = nowIso();
  const nowMs = Date.now();
  const providerCalls: ProviderCall[] = [];

  const tsdb = await fetchTheSportsDbEvents("4591", dateKst);
  providerCalls.push({
    provider: "THESPORTSDB",
    endpoint: `eventsday.php?d=${dateKst}&l=4591`,
    callCount: tsdb.error === "SPORTS_API_KEY missing" ? 0 : 1,
    cached: tsdb.cached,
    observationTime: tsdb.fetchedAt,
    error: tsdb.error,
    resultCount: tsdb.events.length,
  });

  const npbLeague = await resolveApiBaseballNpbLeagueId();
  providerCalls.push(npbLeague.call);

  const season = Number(dateKst.slice(0, 4));
  const gamesPath = `games?league=${npbLeague.leagueId}&season=${season}&date=${dateKst}`;
  const apiBb = npbLeague.leagueId
    ? await fetchApiBaseball(gamesPath)
    : {
        json: { response: [] },
        fetchedAt: collectedAt,
        error: "leagueId unresolved",
        durationMs: 0,
        cached: false,
        usage: { remaining: null as string | null, limit: null as string | null },
      };
  const apiGames = Array.isArray(apiBb.json?.response) ? apiBb.json.response : [];
  providerCalls.push({
    provider: "API_BASEBALL",
    endpoint: gamesPath,
    callCount: apiBb.error === "API key missing" ? 0 : 1,
    cached: apiBb.cached,
    observationTime: apiBb.fetchedAt,
    error: apiBb.error,
    resultCount: apiGames.length,
  });

  const scheduleGames: ScheduleGame[] = [];
  for (const ev of tsdb.events) {
    const home = String(ev.strHomeTeam ?? "").trim();
    const away = String(ev.strAwayTeam ?? "").trim();
    if (!home || !away) continue;
    let scheduledStartTime: string | null = null;
    if (ev.dateEvent && ev.strTime) {
      const tstr = String(ev.strTime);
      const utc = `${ev.dateEvent}T${tstr.length === 8 ? tstr : `${tstr.slice(0, 5)}:00`}Z`;
      const ms = Date.parse(utc);
      if (Number.isFinite(ms)) scheduledStartTime = new Date(ms).toISOString();
    }
    const kst = scheduledStartTime ? instantToKst(scheduledStartTime) : null;
    if (kst && kst.date !== dateKst) continue;
    if (!kst && String(ev.dateEvent) !== dateKst) continue;
    const clock = classifyClock(
      scheduledStartTime,
      ev.strStatus ?? "NS",
      ev.strProgress ?? null,
      nowMs,
    );
    const gameId = buildGameId("NPB", home, away);
    scheduleGames.push({
      gameId,
      internalGameId: gameId,
      providerGameId: ev.idEvent ? String(ev.idEvent) : null,
      provider: "thesportsdb",
      home,
      away,
      homeTeam: home,
      awayTeam: away,
      venue: ev.strVenue ? String(ev.strVenue) : null,
      scheduledStartTime,
      commenceTimeUtc: scheduledStartTime,
      statusAbstract: ev.strStatus ? String(ev.strStatus) : "NS",
      statusDetailed: ev.strProgress ? String(ev.strProgress) : null,
      collectedAt: tsdb.fetchedAt,
      source: "THESPORTSDB",
      clockState: clock.clockState,
      minutesToStart: clock.minutesToStart,
      homeProviderTeamId: ev.idHomeTeam ? String(ev.idHomeTeam) : null,
      awayProviderTeamId: ev.idAwayTeam ? String(ev.idAwayTeam) : null,
    });
  }

  for (const g of apiGames) {
    const home = String(g.teams?.home?.name ?? "").trim();
    const away = String(g.teams?.away?.name ?? "").trim();
    if (!home || !away) continue;
    const scheduledStartTime = g.date ? String(g.date) : null;
    const kst = scheduledStartTime ? instantToKst(scheduledStartTime) : null;
    if (kst && kst.date !== dateKst) continue;
    const clock = classifyClock(
      scheduledStartTime,
      g.status?.short ?? null,
      g.status?.long ?? null,
      nowMs,
    );
    const gameId = buildGameId("NPB", home, away);
    const existing = scheduleGames.find((s) => s.gameId === gameId);
    if (existing) {
      existing.providerGameId =
        existing.providerGameId ?? (g.id != null ? String(g.id) : null);
      existing.statusAbstract = g.status?.short ?? existing.statusAbstract;
      existing.statusDetailed = g.status?.long ?? existing.statusDetailed;
      existing.venue = g.venue?.name ?? existing.venue;
      existing.clockState = clock.clockState;
      existing.minutesToStart = clock.minutesToStart;
      existing.homeProviderTeamId =
        existing.homeProviderTeamId ??
        (g.teams?.home?.id != null ? String(g.teams.home.id) : null);
      existing.awayProviderTeamId =
        existing.awayProviderTeamId ??
        (g.teams?.away?.id != null ? String(g.teams.away.id) : null);
      if (!existing.scheduledStartTime) {
        existing.scheduledStartTime = scheduledStartTime;
        existing.commenceTimeUtc = scheduledStartTime;
      }
      continue;
    }
    scheduleGames.push({
      gameId,
      internalGameId: gameId,
      providerGameId: g.id != null ? String(g.id) : null,
      provider: "api-baseball",
      home,
      away,
      homeTeam: home,
      awayTeam: away,
      venue: g.venue?.name ?? null,
      scheduledStartTime,
      commenceTimeUtc: scheduledStartTime,
      statusAbstract: g.status?.short ?? null,
      statusDetailed: g.status?.long ?? null,
      collectedAt: apiBb.fetchedAt,
      source: "API_BASEBALL",
      clockState: clock.clockState,
      minutesToStart: clock.minutesToStart,
      homeProviderTeamId: g.teams?.home?.id != null ? String(g.teams.home.id) : null,
      awayProviderTeamId: g.teams?.away?.id != null ? String(g.teams.away.id) : null,
    });
  }

  const document = {
    schemaVersion: "npb-schedule-v1",
    sport: "baseball",
    league: "NPB",
    date: dateKst,
    dateKst,
    runId: `npb-schedule-only-${collectedAt}`,
    collectedAt,
    source: "THESPORTSDB+API_BASEBALL",
    researchOnly: true,
    predictionInput: false,
    engineConnected: false,
    engineAdmission: "PROHIBITED",
    note: "Schedule identity collect only. No odds, starter, lineup, or Prediction snapshot.",
    games: scheduleGames,
    providerMeta: {
      theSportsDb: {
        fetchedAt: tsdb.fetchedAt,
        count: tsdb.events.length,
        error: tsdb.error,
        cached: tsdb.cached,
      },
      apiBaseball: {
        leagueId: npbLeague.leagueId,
        fetchedAt: apiBb.fetchedAt,
        count: apiGames.length,
        error: apiBb.error,
        cached: apiBb.cached,
        usage: apiBb.usage,
      },
    },
    providerCalls,
  };

  const outRel = npbScheduleV1Rel(dateKst);
  const outAbs = path.join(cwd, outRel);
  await mkdir(path.dirname(outAbs), { recursive: true });
  await writeFile(outAbs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return { document, outRel, providerCalls };
}

async function main() {
  const dateKst = DATE_ARG;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    console.error("Usage: npm run research:npb-schedule -- --date YYYY-MM-DD");
    process.exit(1);
  }
  const { document, outRel, providerCalls } = await buildNpbScheduleV1(dateKst);
  console.log(
    JSON.stringify(
      {
        dateKst,
        outRel,
        games: document.games.length,
        researchOnly: true,
        predictionInput: false,
        engineConnected: false,
        providerCalls,
      },
      null,
      2,
    ),
  );
}

const isDirect = process.argv[1]?.includes("build-npb-schedule-v1");
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
