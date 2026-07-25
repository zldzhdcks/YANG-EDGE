/**
 * 2026-07-25 18:00 KST KBO·NPB 4경기 — 킥오프 이전 실제 FT 경기로
 * EngineAnalysisData 생성 후 EDGE Engine 실행 (계산식·weights 변경 없음).
 *
 * TheSportsDB 공식 endpoint (Provider 주석·docs_api_guide 확인):
 * - eventsday.php?d=&l=     (리그·날짜별 일정/결과)
 * - eventslast.php?id=      (팀 최근 경기, free=홈 위주 1건)
 * - eventspastleague.php?id= (리그 과거 1건, free)
 * - searchteams.php?t=      (팀 id 확인)
 *
 * 실행: npx tsx --env-file=.env.local scripts/build-today-baseball-analysis.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { utcToKst } from "../src/lib/datetime/kst";
import { runEdgeEngine } from "../src/lib/edge/run-edge-engine";
import { getRecommendationGrade } from "../src/lib/edge/recommendation-grade";
import { computeFactorScores } from "../src/lib/edge/calculate-edge";
import { buildMarketComparison } from "../src/lib/market";
import {
  getMatchDisplayLabel,
  getTeamDisplayName,
} from "../src/lib/teams";
import type {
  AnalysisData,
  HeadToHead,
  MatchResult,
  RecentGame,
  TeamAnalysisSide,
  VenueRecord,
} from "../src/types/engine-analysis";
import type { FactorAvailability } from "../src/lib/edge/types";

const TARGET_DATE_KST = "2026-07-25";
const TARGET_TIME_KST = "18:00";
/** 2026-07-25 18:00 KST = 09:00 UTC */
const KICKOFF_UTC_MS = Date.parse("2026-07-25T09:00:00.000Z");

const LEAGUE_KBO = "4830";
const LEAGUE_NPB = "4591";

const HISTORY_DAYS = 12;
const MIN_RECENT_GAMES = 3;
const WANT_RECENT_GAMES = 5;
const RECOMMEND_ABS_EDGE = 10;

type RawEvent = {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | number | null;
  intAwayScore?: string | number | null;
  strStatus?: string | null;
  dateEvent?: string;
  strTime?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  idLeague?: string;
};

type TargetGame = {
  gameId: string;
  league: "KBO" | "NPB";
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: string;
  awayTeamId?: string;
};

const TARGETS: TargetGame[] = [
  {
    gameId: "kbo-doosan-bears-samsung-lions",
    league: "KBO",
    homeTeam: "Doosan Bears",
    awayTeam: "Samsung Lions",
    homeTeamId: "139822",
    awayTeamId: "139825",
  },
  {
    gameId: "kbo-hanwha-eagles-lg-twins",
    league: "KBO",
    homeTeam: "Hanwha Eagles",
    awayTeam: "LG Twins",
    homeTeamId: "139826",
    awayTeamId: "139820",
  },
  {
    gameId: "kbo-kia-tigers-kiwoom-heroes",
    league: "KBO",
    homeTeam: "Kia Tigers",
    awayTeam: "Kiwoom Heroes",
    homeTeamId: "139824",
    awayTeamId: "139823",
  },
  {
    gameId: "npb-hanshin-tigers-yomiuri-giants",
    league: "NPB",
    homeTeam: "Hanshin Tigers",
    awayTeam: "Yomiuri Giants",
    homeTeamId: "137506",
    awayTeamId: "137510",
  },
];

type FinalStatus = "ANALYSIS_NOT_READY" | "PASS" | "RECOMMENDED";

type OddsSnap = {
  matched: boolean;
  bestHomeOdds: number | null;
  bestAwayOdds: number | null;
};

const UNAVAILABLE_NUM = Number.NaN;

function envBase(): { base: string; key: string } {
  const base = (process.env.SPORTS_API_BASE_URL ?? "").replace(/\/$/, "");
  const key = (process.env.SPORTS_API_KEY ?? "").trim();
  if (!base || !key) {
    throw new Error("SPORTS_API_BASE_URL / SPORTS_API_KEY required");
  }
  return { base, key };
}

function createClient() {
  const { base, key } = envBase();
  let calls = 0;
  const cache = new Map<string, unknown>();

  async function getJson<T>(endpointAndQuery: string): Promise<T> {
    const cleaned = endpointAndQuery.replace(/^\//, "");
    if (cache.has(cleaned)) return cache.get(cleaned) as T;

    const url = `${base}/${key}/${cleaned}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      calls += 1;
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 429) {
        const waitMs = 4000 * (attempt + 1);
        console.log(`  429 on ${cleaned} — wait ${waitMs}ms (try ${attempt + 1}/6)`);
        await new Promise((r) => setTimeout(r, waitMs));
        lastError = new Error(`TheSportsDB GET ${cleaned} failed (429)`);
        continue;
      }
      if (!res.ok) {
        throw new Error(`TheSportsDB GET ${cleaned} failed (${res.status})`);
      }
      const json = (await res.json()) as T;
      cache.set(cleaned, json);
      await new Promise((r) => setTimeout(r, 800));
      return json;
    }

    throw lastError ?? new Error(`TheSportsDB GET ${cleaned} failed`);
  }

  return {
    getJson,
    get calls() {
      return calls;
    },
    get cacheHits() {
      return cache.size;
    },
  };
}

function parseScore(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function eventStartUtcMs(e: RawEvent): number | null {
  const dateEvent = (e.dateEvent ?? "").trim();
  const strTime = (e.strTime ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEvent)) return null;
  if (!strTime || !/^\d{2}:\d{2}/.test(strTime) || strTime === "00:00:00") {
    return null;
  }
  const normalized =
    strTime.length === 5 ? `${strTime}:00` : strTime.slice(0, 8);
  const ms = Date.parse(`${dateEvent}T${normalized}Z`);
  return Number.isFinite(ms) ? ms : null;
}

/** FT + 점수 있음 + 킥오프(2026-07-25 18:00 KST) 이전 시작 */
function isUsableCompletedBeforeKickoff(e: RawEvent): boolean {
  const status = String(e.strStatus ?? "")
    .trim()
    .toUpperCase();
  if (status !== "FT") return false;
  if (parseScore(e.intHomeScore) == null || parseScore(e.intAwayScore) == null) {
    return false;
  }
  if (!e.strHomeTeam || !e.strAwayTeam || !e.idEvent) return false;
  const start = eventStartUtcMs(e);
  if (start == null) return false;
  return start < KICKOFF_UTC_MS;
}

function kstDateOfEvent(e: RawEvent): string | null {
  const kst = utcToKst(e.dateEvent ?? "", e.strTime);
  return kst?.date ?? null;
}

function daysBetween(earlierYmd: string, laterYmd: string): number {
  const a = Date.parse(`${earlierYmd}T00:00:00+09:00`);
  const b = Date.parse(`${laterYmd}T00:00:00+09:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return UNAVAILABLE_NUM;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function toRecentGame(e: RawEvent, teamName: string): RecentGame | null {
  const hs = parseScore(e.intHomeScore);
  const as = parseScore(e.intAwayScore);
  const date = kstDateOfEvent(e);
  if (hs == null || as == null || !date) return null;

  const isHome = e.strHomeTeam === teamName;
  const isAway = e.strAwayTeam === teamName;
  if (!isHome && !isAway) return null;

  const scoreFor = isHome ? hs : as;
  const scoreAgainst = isHome ? as : hs;
  let result: MatchResult;
  if (scoreFor > scoreAgainst) result = "W";
  else if (scoreFor < scoreAgainst) result = "L";
  else result = "D";

  return {
    date,
    opponent: isHome ? (e.strAwayTeam as string) : (e.strHomeTeam as string),
    result,
    scoreFor,
    scoreAgainst,
    isHome,
  };
}

function venueFromGames(games: RecentGame[], homeSide: boolean): VenueRecord {
  const subset = games.filter((g) => g.isHome === homeSide);
  if (subset.length === 0) {
    return {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: UNAVAILABLE_NUM,
    };
  }
  const wins = subset.filter((g) => g.result === "W").length;
  const draws = subset.filter((g) => g.result === "D").length;
  const losses = subset.filter((g) => g.result === "L").length;
  return {
    played: subset.length,
    wins,
    draws,
    losses,
    winRate: (wins / subset.length) * 100,
  };
}

function streakFromGames(games: RecentGame[]): TeamAnalysisSide["streak"] {
  if (games.length === 0) return { type: "none", count: 0 };
  const first = games[0].result;
  if (first === "D") return { type: "draw", count: 1 };
  let count = 0;
  for (const g of games) {
    if (g.result !== first) break;
    count += 1;
  }
  return {
    type: first === "W" ? "win" : "loss",
    count,
  };
}

function buildTeamSide(
  teamName: string,
  allTeamGamesNewestFirst: RecentGame[],
): {
  side: TeamAnalysisSide;
  usedEvidence: string[];
  missing: string[];
} {
  const recent = allTeamGamesNewestFirst.slice(0, WANT_RECENT_GAMES);
  const usedEvidence: string[] = [];
  const missing: string[] = [];

  if (recent.length > 0) {
    usedEvidence.push(`recentGames:${recent.length}`);
  } else {
    missing.push("recentGames");
  }

  const scoredAvg =
    recent.length > 0
      ? recent.reduce((s, g) => s + g.scoreFor, 0) / recent.length
      : UNAVAILABLE_NUM;
  const concededAvg =
    recent.length > 0
      ? recent.reduce((s, g) => s + g.scoreAgainst, 0) / recent.length
      : UNAVAILABLE_NUM;
  if (recent.length > 0) {
    usedEvidence.push("scoringAverages(from recent)");
  } else {
    missing.push("scoringAverages");
  }

  const homeRecord = venueFromGames(allTeamGamesNewestFirst, true);
  const awayRecord = venueFromGames(allTeamGamesNewestFirst, false);
  if (Number.isFinite(homeRecord.winRate)) {
    usedEvidence.push(`homeRecord(n=${homeRecord.played})`);
  } else {
    missing.push("homeRecord");
  }
  if (Number.isFinite(awayRecord.winRate)) {
    usedEvidence.push(`awayRecord(n=${awayRecord.played})`);
  } else {
    missing.push("awayRecord");
  }

  const streak = streakFromGames(recent);
  usedEvidence.push(`streak:${streak.type}${streak.count}`);

  let restDays = UNAVAILABLE_NUM;
  if (recent[0]?.date) {
    restDays = daysBetween(recent[0].date, TARGET_DATE_KST);
    if (Number.isFinite(restDays)) usedEvidence.push(`restDays:${restDays}`);
    else missing.push("restDays");
  } else {
    missing.push("restDays");
  }

  missing.push(
    "startingPitcher",
    "injuries(source)",
    "leagueStanding",
    "seasonWinRate",
  );

  const side: TeamAnalysisSide = {
    teamName,
    recentGames: recent,
    homeRecord,
    awayRecord,
    leagueStanding: {
      rank: UNAVAILABLE_NUM,
      played: UNAVAILABLE_NUM,
      wins: UNAVAILABLE_NUM,
      draws: UNAVAILABLE_NUM,
      losses: UNAVAILABLE_NUM,
    },
    scoringAverages: { scoredAvg, concededAvg },
    recentForm: {
      sequence: recent.map((g) => g.result).join(""),
      last5: recent,
    },
    winRate: UNAVAILABLE_NUM,
    streak,
    injuries: [],
    restDays,
    startingPitcher: null,
  };

  return { side, usedEvidence, missing };
}

function buildH2h(
  homeTeam: string,
  awayTeam: string,
  events: RawEvent[],
): { h2h: HeadToHead; used: boolean } {
  const meetings = events
    .filter(isUsableCompletedBeforeKickoff)
    .filter(
      (e) =>
        (e.strHomeTeam === homeTeam && e.strAwayTeam === awayTeam) ||
        (e.strHomeTeam === awayTeam && e.strAwayTeam === homeTeam),
    )
    .sort((a, b) => (eventStartUtcMs(b) ?? 0) - (eventStartUtcMs(a) ?? 0));

  const recentMeetings: RecentGame[] = [];
  let homeTeamWins = 0;
  let awayTeamWins = 0;
  let draws = 0;

  for (const e of meetings.slice(0, 5)) {
    const fromHomePerspective = toRecentGame(e, homeTeam);
    if (!fromHomePerspective) continue;
    recentMeetings.push(fromHomePerspective);
    if (fromHomePerspective.result === "W") homeTeamWins += 1;
    else if (fromHomePerspective.result === "L") awayTeamWins += 1;
    else draws += 1;
  }

  // 전체 맞대결 집계 (수집된 범위)
  let allHomeWins = 0;
  let allAwayWins = 0;
  let allDraws = 0;
  for (const e of meetings) {
    const g = toRecentGame(e, homeTeam);
    if (!g) continue;
    if (g.result === "W") allHomeWins += 1;
    else if (g.result === "L") allAwayWins += 1;
    else allDraws += 1;
  }

  const played = allHomeWins + allAwayWins + allDraws;
  return {
    used: played > 0,
    h2h: {
      played,
      homeTeamWins: allHomeWins,
      awayTeamWins: allAwayWins,
      draws: allDraws,
      recentMeetings,
    },
  };
}

function availabilityRatio(a: FactorAvailability): number {
  const keys = Object.keys(a) as (keyof FactorAvailability)[];
  const on = keys.filter((k) => a[k]).length;
  return Math.round((on / keys.length) * 1000) / 1000;
}

function dateMinusUtcCalendar(daysBefore: number): string {
  const d = new Date(Date.UTC(2026, 6, 25 - daysBefore, 12, 0, 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function collectEvents(
  client: ReturnType<typeof createClient>,
): Promise<{ events: RawEvent[]; fromCache: boolean }> {
  const cachePath = path.join(
    process.cwd(),
    "data",
    "daily-tests",
    `${TARGET_DATE_KST}-1800-baseball-events-cache.json`,
  );

  type DiskCache = {
    fetchedAt?: string;
    fetchedPaths?: string[];
    events?: RawEvent[];
  };

  let disk: DiskCache = { fetchedPaths: [], events: [] };
  try {
    const raw = await readFile(cachePath, "utf8");
    disk = JSON.parse(raw) as DiskCache;
  } catch {
    // no cache
  }

  const byId = new Map<string, RawEvent>();
  const fetchedPaths = new Set(disk.fetchedPaths ?? []);
  for (const e of disk.events ?? []) {
    if (e?.idEvent) byId.set(String(e.idEvent), e);
  }

  const ingest = (list: RawEvent[] | null | undefined) => {
    for (const e of list ?? []) {
      if (e?.idEvent) byId.set(String(e.idEvent), e);
    }
  };

  const persist = async () => {
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(
      cachePath,
      `${JSON.stringify(
        {
          fetchedAt: new Date().toISOString(),
          fetchedPaths: [...fetchedPaths],
          events: [...byId.values()],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  };

  const fetchPath = async (cleaned: string) => {
    if (fetchedPaths.has(cleaned)) return;
    const json = await client.getJson<{
      events?: RawEvent[] | null;
      results?: RawEvent[] | null;
    }>(cleaned);
    ingest(json.events);
    ingest(json.results);
    fetchedPaths.add(cleaned);
    await persist();
  };

  const planned: string[] = [];
  for (const leagueId of [LEAGUE_KBO, LEAGUE_NPB]) {
    for (let i = 1; i <= HISTORY_DAYS; i++) {
      const d = dateMinusUtcCalendar(i);
      planned.push(
        `eventsday.php?d=${encodeURIComponent(d)}&l=${encodeURIComponent(leagueId)}`,
      );
    }
  }
  for (const leagueId of [LEAGUE_KBO, LEAGUE_NPB]) {
    planned.push(
      `eventspastleague.php?id=${encodeURIComponent(leagueId)}`,
    );
  }
  const teamIds = new Set<string>();
  for (const t of TARGETS) {
    if (t.homeTeamId) teamIds.add(t.homeTeamId);
    if (t.awayTeamId) teamIds.add(t.awayTeamId);
  }
  for (const id of teamIds) {
    planned.push(`eventslast.php?id=${encodeURIComponent(id)}`);
  }

  const remaining = planned.filter((p) => !fetchedPaths.has(p));
  console.log(
    `event paths: done=${fetchedPaths.size} remaining=${remaining.length} cachedEvents=${byId.size}`,
  );

  for (const p of remaining) {
    try {
      await fetchPath(p);
    } catch (err) {
      await persist();
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`fetch interrupted: ${msg}`);
      console.error(
        `progress saved (${fetchedPaths.size}/${planned.length}). re-run to resume.`,
      );
      throw err;
    }
  }

  const events = [...byId.values()];
  const fullyCached = remaining.length === 0;
  console.log(
    `event collect complete: ${events.length} unique (diskFullyCached=${fullyCached})`,
  );
  return { events, fromCache: fullyCached && client.calls === 0 };
}

function gamesForTeam(events: RawEvent[], teamName: string): RecentGame[] {
  return events
    .filter(isUsableCompletedBeforeKickoff)
    .filter((e) => e.strHomeTeam === teamName || e.strAwayTeam === teamName)
    .map((e) => ({ e, start: eventStartUtcMs(e) ?? 0 }))
    .sort((a, b) => b.start - a.start)
    .map(({ e }) => toRecentGame(e, teamName))
    .filter((g): g is RecentGame => g != null);
}

function resolveStatus(
  runnable: boolean,
  edgeScore: number | null,
): FinalStatus {
  if (!runnable || edgeScore == null) return "ANALYSIS_NOT_READY";
  if (Math.abs(edgeScore) < RECOMMEND_ABS_EDGE) return "PASS";
  return "RECOMMENDED";
}

async function loadOddsFromDailyReport(): Promise<Map<string, OddsSnap>> {
  const map = new Map<string, OddsSnap>();
  const file = path.join(
    process.cwd(),
    "data",
    "daily-tests",
    `${TARGET_DATE_KST}-1800-baseball.json`,
  );
  try {
    const raw = await readFile(file, "utf8");
    const body = JSON.parse(raw) as {
      games?: Array<{
        gameId: string;
        oddsMatched?: boolean;
        bestHomeOdds?: number | null;
        bestAwayOdds?: number | null;
      }>;
    };
    for (const g of body.games ?? []) {
      map.set(g.gameId, {
        matched: Boolean(g.oddsMatched),
        bestHomeOdds: g.bestHomeOdds ?? null,
        bestAwayOdds: g.bestAwayOdds ?? null,
      });
    }
  } catch {
    // 파일 없으면 배당 미연결
  }
  return map;
}

function sanitizeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "number" && !Number.isFinite(v) ? null : v,
    ),
  ) as T;
}

async function main() {
  console.log("=== Build today baseball AnalysisData (pre-kickoff FT only) ===");
  console.log(`kickoff: ${TARGET_DATE_KST} ${TARGET_TIME_KST} KST`);
  console.log(`cutoff UTC: ${new Date(KICKOFF_UTC_MS).toISOString()}\n`);

  const client = createClient();
  const { events, fromCache } = await collectEvents(client);
  const completed = events.filter(isUsableCompletedBeforeKickoff);
  console.log(
    `TheSportsDB calls=${client.calls} fromCache=${fromCache} uniqueEvents=${events.length} completedBeforeKickoff=${completed.length}`,
  );

  const oddsMap = await loadOddsFromDailyReport();
  console.log(`odds from daily report: ${oddsMap.size} games\n`);

  const gameReports: unknown[] = [];
  let analyzed = 0;
  let recommended = 0;
  let pass = 0;
  let notReady = 0;

  for (const target of TARGETS) {
    const homeGames = gamesForTeam(events, target.homeTeam);
    const awayGames = gamesForTeam(events, target.awayTeam);
    const homeOk = homeGames.length >= MIN_RECENT_GAMES;
    const awayOk = awayGames.length >= MIN_RECENT_GAMES;
    const runnable = homeOk && awayOk;

    const homeBuilt = buildTeamSide(target.homeTeam, homeGames);
    const awayBuilt = buildTeamSide(target.awayTeam, awayGames);
    const { h2h, used: h2hUsed } = buildH2h(
      target.homeTeam,
      target.awayTeam,
      events,
    );

    const usedEvidence = [
      ...homeBuilt.usedEvidence.map((x) => `home.${x}`),
      ...awayBuilt.usedEvidence.map((x) => `away.${x}`),
    ];
    if (h2hUsed) usedEvidence.push(`headToHead:played=${h2h.played}`);

    const missingData = [
      ...new Set([
        ...homeBuilt.missing.map((x) => `home.${x}`),
        ...awayBuilt.missing.map((x) => `away.${x}`),
        ...(h2hUsed ? [] : ["headToHead"]),
      ]),
    ];

    const analysis: AnalysisData = {
      gameId: target.gameId,
      sport: "baseball",
      league: target.league,
      homeTeam: target.homeTeam,
      awayTeam: target.awayTeam,
      date: TARGET_DATE_KST,
      startTime: TARGET_TIME_KST,
      home: homeBuilt.side,
      away: awayBuilt.side,
      headToHead: h2h,
    };

    let engineResult = null;
    let recommendation = null;
    let availability: FactorAvailability | null = null;
    let dataAvailability: number | null = null;
    let deterministic: boolean | null = null;
    let marketProbability: number | null = null;
    let valueEdge: number | null = null;
    let edgeScore: number | null = null;
    let confidence: number | null = null;

    if (runnable) {
      const first = runEdgeEngine(analysis);
      const second = runEdgeEngine(analysis);
      deterministic =
        first.edgeScore === second.edgeScore &&
        first.confidence === second.confidence &&
        first.winProbability === second.winProbability &&
        first.pickTeamId === second.pickTeamId;
      engineResult = first;
      const factors = computeFactorScores(analysis);
      availability = factors.availability;
      dataAvailability = availabilityRatio(factors.availability);
      recommendation = getRecommendationGrade(first.edgeScore);
      edgeScore = Math.round(first.edgeScore * 10) / 10;
      confidence = Math.round(first.confidence);

      const odds = oddsMap.get(target.gameId);
      if (
        odds?.matched &&
        odds.bestHomeOdds != null &&
        odds.bestAwayOdds != null
      ) {
        const comparison = buildMarketComparison({
          marketType: "two-way",
          odds: {
            homeOdds: odds.bestHomeOdds,
            awayOdds: odds.bestAwayOdds,
          },
          model: {
            pickTeamId: first.pickTeamId,
            winProbability: first.winProbability,
            marketSupport: "two-way",
          },
        });
        if (comparison.comparable && comparison.marketProbability != null) {
          marketProbability = Math.round(comparison.marketProbability * 100);
        }
        if (
          comparison.comparable &&
          comparison.valueEdgePercentagePoints != null
        ) {
          valueEdge =
            Math.round(comparison.valueEdgePercentagePoints * 10) / 10;
        }
      }

      analyzed += 1;
    }

    const finalStatus = resolveStatus(runnable, edgeScore);
    if (finalStatus === "RECOMMENDED") recommended += 1;
    else if (finalStatus === "PASS") pass += 1;
    else notReady += 1;

    const odds = oddsMap.get(target.gameId);
    const row = {
      gameId: target.gameId,
      league: target.league,
      matchDisplay: getMatchDisplayLabel(target.homeTeam, target.awayTeam),
      homeTeam: target.homeTeam,
      awayTeam: target.awayTeam,
      homeTeamDisplay: getTeamDisplayName(target.homeTeam),
      awayTeamDisplay: getTeamDisplayName(target.awayTeam),
      recentGameCounts: {
        home: homeGames.length,
        away: awayGames.length,
        minRequired: MIN_RECENT_GAMES,
      },
      runnable,
      pickTeam: engineResult?.pickTeamName ?? null,
      winProbability:
        engineResult != null ? Math.round(engineResult.winProbability) : null,
      edgeScore,
      confidence,
      recommendationGrade: recommendation?.grade ?? null,
      marketProbability,
      valueEdge,
      dataAvailability,
      factorAvailability: availability,
      usedEvidence,
      missingData,
      finalStatus,
      analysisDeterministic: deterministic,
      odds: odds
        ? {
            matched: odds.matched,
            bestHomeOdds: odds.bestHomeOdds,
            bestAwayOdds: odds.bestAwayOdds,
          }
        : null,
      analysisInput: sanitizeForJson(analysis),
    };

    gameReports.push(row);

    console.log("─".repeat(56));
    console.log(`${target.league} ${row.matchDisplay}`);
    console.log(
      `  recent FT : home=${homeGames.length} away=${awayGames.length} runnable=${runnable}`,
    );
    console.log(`  pick      : ${row.pickTeam ?? "—"}`);
    console.log(
      `  winProb   : ${row.winProbability != null ? `${row.winProbability}%` : "—"}`,
    );
    console.log(`  EDGE      : ${edgeScore ?? "—"}`);
    console.log(`  Confidence: ${confidence ?? "—"}`);
    console.log(`  grade     : ${row.recommendationGrade ?? "—"}`);
    console.log(
      `  market    : ${marketProbability != null ? `${marketProbability}%` : "—"}`,
    );
    console.log(
      `  valueEdge : ${valueEdge != null ? `${valueEdge}pp` : "—"}`,
    );
    console.log(`  dataAvail : ${dataAvailability ?? "—"}`);
    console.log(`  status    : ${finalStatus}`);
    console.log(`  used      : ${usedEvidence.join(", ")}`);
    console.log(`  missing   : ${missingData.join(", ")}`);
  }

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      dateKst: TARGET_DATE_KST,
      kickoffKst: `${TARGET_DATE_KST}T${TARGET_TIME_KST}+09:00`,
      kickoffUtc: new Date(KICKOFF_UTC_MS).toISOString(),
      endpointsUsed: [
        "eventsday.php",
        "eventslast.php",
        "eventspastleague.php",
      ],
      historyDays: HISTORY_DAYS,
      minRecentGames: MIN_RECENT_GAMES,
      totalTargetGames: TARGETS.length,
      analyzedGames: analyzed,
      recommendedGames: recommended,
      passGames: pass,
      analysisNotReadyGames: notReady,
      completedEventsBeforeKickoff: completed.length,
      apiUsage: {
        thesportsdbCalls: client.calls,
        uniqueCachedPaths: client.cacheHits,
        eventsFromDiskCache: fromCache,
        oddsSource: `${TARGET_DATE_KST}-1800-baseball.json (no new Odds API call)`,
      },
    },
    games: gameReports,
  };

  const outDir = path.join(process.cwd(), "data", "daily-tests");
  const outFile = path.join(
    outDir,
    `${TARGET_DATE_KST}-1800-baseball-analysis.json`,
  );
  await mkdir(outDir, { recursive: true });
  await writeFile(
    outFile,
    `${JSON.stringify(sanitizeForJson(report), null, 2)}\n`,
    "utf8",
  );

  console.log("\n" + "=".repeat(56));
  console.log(`분석 가능: ${analyzed} / ${TARGETS.length}`);
  console.log(`RECOMMENDED: ${recommended}`);
  console.log(`PASS: ${pass}`);
  console.log(`ANALYSIS_NOT_READY: ${notReady}`);
  console.log(`TheSportsDB calls: ${client.calls}`);
  console.log(`저장: ${outFile}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
