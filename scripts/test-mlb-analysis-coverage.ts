/**
 * 2026-07-27 KST MLB EngineAnalysisData 생성 가능 범위 검증.
 *
 * 실제 값:
 * - API-BASEBALL Pro: 현재 시즌 일정/완료 경기/순위
 * - The Odds API: 시장 배당만 (기존 fusion 결과 캐시 우선)
 *
 * 제외:
 * - SportsDataIO Trial 값 (Scrambled): 구조 확인용일 뿐 가용성 계산에 미포함
 * - EDGE Engine 실행 및 UI/Provider 연결
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/test-mlb-analysis-coverage.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import {
  normalizeTeamNameForOdds,
  TheOddsApiProvider,
  type OddsSportInfo,
  type OddsUsageMeta,
} from "../src/lib/odds";

function nextKstDate(dateKst: string): string {
  const ms = Date.parse(`${dateKst}T12:00:00+09:00`) + 24 * 60 * 60 * 1000;
  const kst = instantToKst(new Date(ms));
  if (!kst) throw new Error(`nextKstDate 실패: ${dateKst}`);
  return kst.date;
}

const TARGET_DATE_KST = (
  process.env.MLB_TARGET_DATE_KST ?? "2026-07-27"
).trim();
const NEXT_DATE = nextKstDate(TARGET_DATE_KST);
const TARGET_DAY_START_MS = Date.parse(`${TARGET_DATE_KST}T00:00:00+09:00`);
const TARGET_DAY_END_MS = Date.parse(`${NEXT_DATE}T00:00:00+09:00`);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-analysis-coverage.json`,
);
const FUSION_CACHE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-data-fusion.json`,
);
const FINISHED_STATUSES = new Set(["FT", "AOT", "AP"]);
const FACTOR_KEYS = [
  "recentForm",
  "homeAway",
  "scoring",
  "defense",
  "leagueStanding",
  "headToHead",
  "rest",
  "injuries",
  "streak",
  "startingPitcher",
] as const;

type FactorKey = (typeof FACTOR_KEYS)[number];
type CoverageStatus = "BASELINE_READY" | "INSUFFICIENT";
type Result = "W" | "D" | "L";

type FieldCandidate<T> = {
  value: T | null;
  available: boolean;
  source: string | null;
  sampleSize: number | null;
  cutoffTime: string;
};

type ApiEnvelope = {
  errors?: unknown;
  results?: number;
  response?: unknown[];
};

type ApiUsage = {
  calls: number;
  remaining: number | null;
  limit: number | null;
};

type RawSeasonGame = {
  externalId: string;
  commenceTimeUtc: string;
  dateKst: string;
  startTimeKst: string;
  status: string | null;
  statusLong: string | null;
  leagueId: number;
  leagueName: string | null;
  season: number;
  homeTeamId: number;
  homeTeam: string;
  awayTeamId: number;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  observedTopLevelFields: string[];
  observedStatusFields: string[];
  observedScoreFields: {
    home: string[];
    away: string[];
  };
  pitcherFields: Record<string, unknown>;
};

type TeamGame = {
  externalId: string;
  commenceTimeUtc: string;
  dateKst: string;
  opponentId: number;
  opponent: string;
  result: Result;
  scoreFor: number;
  scoreAgainst: number;
  isHome: boolean;
};

type VenueRecord = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
};

type Standing = {
  rank: number | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  winningPercentage: number | null;
  gamesBehind: number | null;
  observedFields: string[];
};

type MarketOdds = {
  eventId: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bestHomeOdds: number;
  bestAwayOdds: number;
  bookmakerCount: number;
  normalizedHomeProbability: number;
  normalizedAwayProbability: number;
};

type OddsLoadResult = {
  events: MarketOdds[];
  cacheReused: boolean;
  cacheSource: string | null;
  calls: number;
  usage: OddsUsageMeta;
  sportKey: string | null;
  error: string | null;
};

type TimedResponse<T> = {
  data: T;
  headers: Headers;
  elapsedMs: number;
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

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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
    .replace(/x-apisports-key[^,\s]*/gi, "x-apisports-key=***");
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

function numberHeader(headers: Headers, ...names: string[]): number | null {
  for (const name of names) {
    const raw = headers.get(name);
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
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
      `HTTP ${response.status}: ${safeError(text.slice(0, 240))}`,
    );
  }
  return { data: data as T, headers: response.headers, elapsedMs };
}

function utcIsoFromGame(row: Record<string, unknown>): string | null {
  const timestamp = asNumber(row.timestamp);
  if (timestamp != null) {
    return new Date(timestamp * 1000).toISOString();
  }
  const date = asString(row.date);
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseSeasonGame(
  raw: unknown,
  fallbackSeason: number,
  fallbackLeagueId: number,
): RawSeasonGame | null {
  const row = asRecord(raw);
  if (!row) return null;
  const teams = asRecord(row.teams);
  const home = asRecord(teams?.home);
  const away = asRecord(teams?.away);
  const scores = asRecord(row.scores);
  const homeScores = asRecord(scores?.home);
  const awayScores = asRecord(scores?.away);
  const status = asRecord(row.status);
  const league = asRecord(row.league);

  const id = asNumber(row.id);
  const homeTeamId = asNumber(home?.id);
  const awayTeamId = asNumber(away?.id);
  const homeTeam = asString(home?.name);
  const awayTeam = asString(away?.name);
  const commenceTimeUtc = utcIsoFromGame(row);
  if (
    id == null ||
    homeTeamId == null ||
    awayTeamId == null ||
    !homeTeam ||
    !awayTeam ||
    !commenceTimeUtc
  ) {
    return null;
  }
  const kst = instantToKst(commenceTimeUtc);
  if (!kst) return null;

  const pitcherFields = Object.fromEntries(
    Object.entries(row).filter(([key]) => /pitcher/i.test(key)),
  );

  return {
    externalId: String(id),
    commenceTimeUtc,
    dateKst: kst.date,
    startTimeKst: kst.time,
    status: asString(status?.short),
    statusLong: asString(status?.long),
    leagueId: asNumber(league?.id) ?? fallbackLeagueId,
    leagueName: asString(league?.name),
    season: asNumber(league?.season) ?? fallbackSeason,
    homeTeamId,
    homeTeam,
    awayTeamId,
    awayTeam,
    homeScore: asNumber(homeScores?.total),
    awayScore: asNumber(awayScores?.total),
    observedTopLevelFields: Object.keys(row),
    observedStatusFields: Object.keys(status ?? {}),
    observedScoreFields: {
      home: Object.keys(homeScores ?? {}),
      away: Object.keys(awayScores ?? {}),
    },
    pitcherFields,
  };
}

function collectObjects(value: unknown, output: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output);
    return;
  }
  const row = asRecord(value);
  if (!row) return;
  output.push(row);
  for (const child of Object.values(row)) {
    if (typeof child === "object" && child !== null) {
      collectObjects(child, output);
    }
  }
}

function parseStandings(
  raw: unknown[],
): Map<number, Standing> {
  const objects: Record<string, unknown>[] = [];
  collectObjects(raw, objects);
  const standings = new Map<number, Standing>();

  for (const row of objects) {
    const team = asRecord(row.team);
    const teamId =
      asNumber(team?.id) ??
      asNumber(row.teamId) ??
      asNumber(row.TeamID);
    if (teamId == null) continue;
    const games = asRecord(row.games);
    const playedNode = asRecord(games?.played);
    const winsNode = asRecord(games?.win);
    const lossesNode = asRecord(games?.lose);

    const played =
      asNumber(playedNode?.all) ??
      asNumber(games?.played) ??
      asNumber(row.played);
    const wins =
      asNumber(winsNode?.total) ??
      asNumber(winsNode?.all) ??
      asNumber(row.wins) ??
      asNumber(row.win);
    const losses =
      asNumber(lossesNode?.total) ??
      asNumber(lossesNode?.all) ??
      asNumber(row.losses) ??
      asNumber(row.lose);
    const draws = asNumber(row.draws) ?? asNumber(row.draw);
    const percentageRaw =
      asNumber(row.winningPercentage) ??
      asNumber(row.winPercentage) ??
      asNumber(winsNode?.percentage);
    const winningPercentage =
      percentageRaw == null
        ? wins != null && played != null && played > 0
          ? wins / played
          : null
        : percentageRaw > 1
          ? percentageRaw / 100
          : percentageRaw;

    standings.set(teamId, {
      rank:
        asNumber(row.position) ??
        asNumber(row.rank) ??
        asNumber(row.Position),
      played,
      wins,
      draws,
      losses,
      winningPercentage,
      gamesBehind:
        asNumber(row.gamesBehind) ??
        asNumber(row.GamesBehind) ??
        asNumber(row.gb),
      observedFields: Object.keys(row),
    });
  }
  return standings;
}

function isFinishedBeforeCutoff(
  game: RawSeasonGame,
  cutoffMs: number,
): boolean {
  const status = (game.status ?? "").toUpperCase();
  const startMs = Date.parse(game.commenceTimeUtc);
  return (
    FINISHED_STATUSES.has(status) &&
    game.homeScore != null &&
    game.awayScore != null &&
    Number.isFinite(startMs) &&
    startMs < cutoffMs &&
    // 보수적 누수 방지: 대상 KST 날짜에 시작한 경기는 전부 제외한다.
    game.dateKst < TARGET_DATE_KST
  );
}

function teamResult(
  scoreFor: number,
  scoreAgainst: number,
): Result {
  if (scoreFor > scoreAgainst) return "W";
  if (scoreFor < scoreAgainst) return "L";
  return "D";
}

function toTeamGame(
  game: RawSeasonGame,
  teamId: number,
): TeamGame | null {
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeTeamId === teamId) {
    return {
      externalId: game.externalId,
      commenceTimeUtc: game.commenceTimeUtc,
      dateKst: game.dateKst,
      opponentId: game.awayTeamId,
      opponent: game.awayTeam,
      result: teamResult(game.homeScore, game.awayScore),
      scoreFor: game.homeScore,
      scoreAgainst: game.awayScore,
      isHome: true,
    };
  }
  if (game.awayTeamId === teamId) {
    return {
      externalId: game.externalId,
      commenceTimeUtc: game.commenceTimeUtc,
      dateKst: game.dateKst,
      opponentId: game.homeTeamId,
      opponent: game.homeTeam,
      result: teamResult(game.awayScore, game.homeScore),
      scoreFor: game.awayScore,
      scoreAgainst: game.homeScore,
      isHome: false,
    };
  }
  return null;
}

function venueRecord(games: TeamGame[], isHome: boolean): VenueRecord {
  const venue = games.filter((game) => game.isHome === isHome);
  const wins = venue.filter((game) => game.result === "W").length;
  const draws = venue.filter((game) => game.result === "D").length;
  const losses = venue.filter((game) => game.result === "L").length;
  return {
    played: venue.length,
    wins,
    draws,
    losses,
    winRate: venue.length > 0 ? round((wins / venue.length) * 100) : 0,
  };
}

function currentStreak(gamesNewestFirst: TeamGame[]): {
  type: "win" | "loss" | "draw";
  count: number;
} | null {
  const first = gamesNewestFirst[0];
  if (!first) return null;
  let count = 0;
  for (const game of gamesNewestFirst) {
    if (game.result !== first.result) break;
    count += 1;
  }
  return {
    type:
      first.result === "W"
        ? "win"
        : first.result === "L"
          ? "loss"
          : "draw",
    count,
  };
}

function availableField<T>(
  value: T,
  source: string,
  sampleSize: number | null,
  cutoffTime: string,
): FieldCandidate<T> {
  return {
    value,
    available: true,
    source,
    sampleSize,
    cutoffTime,
  };
}

function missingField<T>(
  cutoffTime: string,
  source: string | null = null,
): FieldCandidate<T> {
  return {
    value: null,
    available: false,
    source,
    sampleSize: null,
    cutoffTime,
  };
}

function teamCandidate(
  target: RawSeasonGame,
  teamId: number,
  teamName: string,
  seasonGames: RawSeasonGame[],
  standing: Standing | null,
) {
  const cutoffMs = Date.parse(target.commenceTimeUtc);
  const cutoffTime = target.commenceTimeUtc;
  const completed = seasonGames
    .filter((game) => isFinishedBeforeCutoff(game, cutoffMs))
    .map((game) => toTeamGame(game, teamId))
    .filter((game): game is TeamGame => game != null)
    .sort(
      (a, b) =>
        Date.parse(b.commenceTimeUtc) - Date.parse(a.commenceTimeUtc),
    );
  const recent = completed.slice(0, 5);
  const wins = completed.filter((game) => game.result === "W").length;
  const last = completed[0] ?? null;
  const homeRecord = venueRecord(completed, true);
  const awayRecord = venueRecord(completed, false);
  const recentScored =
    recent.length > 0
      ? round(
          recent.reduce((sum, game) => sum + game.scoreFor, 0) /
            recent.length,
        )
      : null;
  const recentConceded =
    recent.length > 0
      ? round(
          recent.reduce((sum, game) => sum + game.scoreAgainst, 0) /
            recent.length,
        )
      : null;
  const streak = currentStreak(completed);
  const restDays =
    last == null
      ? null
      : Math.max(
          0,
          Math.floor(
            (Date.parse(target.commenceTimeUtc) -
              Date.parse(last.commenceTimeUtc)) /
              86_400_000,
          ),
        );

  const sourceGames = "api-baseball:/games?league={id}&season={season}";
  const sourceStandings =
    "api-baseball:/standings?league={id}&season={season}";

  return {
    teamId,
    teamName,
    recentGames:
      recent.length > 0
        ? availableField(recent, sourceGames, recent.length, cutoffTime)
        : missingField<TeamGame[]>(cutoffTime, sourceGames),
    recentForm:
      recent.length > 0
        ? availableField(
            recent.map((game) => game.result).join(""),
            sourceGames,
            recent.length,
            cutoffTime,
          )
        : missingField<string>(cutoffTime, sourceGames),
    scoringAverages:
      recentScored != null && recentConceded != null
        ? availableField(
            {
              scoredAvg: recentScored,
              concededAvg: recentConceded,
            },
            sourceGames,
            recent.length,
            cutoffTime,
          )
        : missingField<{
            scoredAvg: number;
            concededAvg: number;
          }>(cutoffTime, sourceGames),
    homeRecord:
      homeRecord.played > 0
        ? availableField(
            homeRecord,
            sourceGames,
            homeRecord.played,
            cutoffTime,
          )
        : missingField<VenueRecord>(cutoffTime, sourceGames),
    awayRecord:
      awayRecord.played > 0
        ? availableField(
            awayRecord,
            sourceGames,
            awayRecord.played,
            cutoffTime,
          )
        : missingField<VenueRecord>(cutoffTime, sourceGames),
    seasonWinRate:
      completed.length > 0
        ? availableField(
            round((wins / completed.length) * 100),
            sourceGames,
            completed.length,
            cutoffTime,
          )
        : missingField<number>(cutoffTime, sourceGames),
    streak:
      streak != null
        ? availableField(streak, sourceGames, completed.length, cutoffTime)
        : missingField<NonNullable<typeof streak>>(cutoffTime, sourceGames),
    restDays:
      restDays != null
        ? availableField(restDays, sourceGames, 1, cutoffTime)
        : missingField<number>(cutoffTime, sourceGames),
    standing:
      standing?.rank != null
        ? availableField(standing, sourceStandings, standing.played, cutoffTime)
        : missingField<Standing>(cutoffTime, sourceStandings),
    teamStatistics:
      completed.length > 0
        ? availableField(
            {
              played: completed.length,
              wins,
              draws: completed.filter((game) => game.result === "D").length,
              losses: completed.filter((game) => game.result === "L").length,
              runsFor: completed.reduce(
                (sum, game) => sum + game.scoreFor,
                0,
              ),
              runsAgainst: completed.reduce(
                (sum, game) => sum + game.scoreAgainst,
                0,
              ),
            },
            `${sourceGames} (로컬 집계; 팀별 endpoint 반복 호출 없음)`,
            completed.length,
            cutoffTime,
          )
        : missingField<Record<string, number>>(cutoffTime, sourceGames),
    injuries: missingField<unknown[]>(
      cutoffTime,
      "API-BASEBALL 공식 MLB 응답에서 사용 가능한 injuries endpoint 확인 안 됨",
    ),
  };
}

function headToHeadCandidate(
  target: RawSeasonGame,
  seasonGames: RawSeasonGame[],
) {
  const cutoffMs = Date.parse(target.commenceTimeUtc);
  const meetings = seasonGames
    .filter(
      (game) =>
        isFinishedBeforeCutoff(game, cutoffMs) &&
        ((game.homeTeamId === target.homeTeamId &&
          game.awayTeamId === target.awayTeamId) ||
          (game.homeTeamId === target.awayTeamId &&
            game.awayTeamId === target.homeTeamId)),
    )
    .sort(
      (a, b) =>
        Date.parse(b.commenceTimeUtc) - Date.parse(a.commenceTimeUtc),
    )
    .slice(0, 5);

  let homeTeamWins = 0;
  let awayTeamWins = 0;
  let draws = 0;
  for (const game of meetings) {
    if (game.homeScore == null || game.awayScore == null) continue;
    const targetHomeScore =
      game.homeTeamId === target.homeTeamId
        ? game.homeScore
        : game.awayScore;
    const targetAwayScore =
      game.awayTeamId === target.awayTeamId
        ? game.awayScore
        : game.homeScore;
    if (targetHomeScore > targetAwayScore) homeTeamWins += 1;
    else if (targetAwayScore > targetHomeScore) awayTeamWins += 1;
    else draws += 1;
  }

  // 시즌 전체 게임 응답을 완전 조회했으므로 0경기도 실제 확인된 값이다.
  return availableField(
    {
      played: meetings.length,
      homeTeamWins,
      awayTeamWins,
      draws,
      recentMeetings: meetings.map((game) => ({
        externalId: game.externalId,
        dateKst: game.dateKst,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
      })),
    },
    "api-baseball:/games season aggregate (동일 팀 ID)",
    meetings.length,
    target.commenceTimeUtc,
  );
}

function detectStartingPitcher(target: RawSeasonGame) {
  const fields = Object.keys(target.pitcherFields);
  const values = Object.values(target.pitcherFields).filter(
    (value) => value != null && value !== "",
  );
  return {
    field: values.length > 0
      ? availableField(
          target.pitcherFields,
          "api-baseball:/games target response",
          1,
          target.commenceTimeUtc,
        )
      : missingField<Record<string, unknown>>(
          target.commenceTimeUtc,
          "api-baseball:/games target response",
        ),
    observedFieldNames: fields,
  };
}

function teamScore(a: string, b: string): number {
  const left = normalizeTeamNameForOdds(a);
  const right = normalizeTeamNameForOdds(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (
    left.length >= 4 &&
    right.length >= 4 &&
    (left.includes(right) || right.includes(left))
  ) {
    return 0.8;
  }
  return 0;
}

function matchMarketOdds(
  target: RawSeasonGame,
  events: MarketOdds[],
): MarketOdds | null {
  const candidates = events.filter((event) => {
    const home = teamScore(target.homeTeam, event.homeTeam);
    const away = teamScore(target.awayTeam, event.awayTeam);
    if (home === 0 || away === 0) return false;
    const diff = Math.abs(
      Date.parse(target.commenceTimeUtc) - Date.parse(event.commenceTime),
    );
    return Number.isFinite(diff) && diff <= 3 * 60 * 60 * 1000;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function normalizedTwoWayProbability(
  homeOdds: number,
  awayOdds: number,
): { home: number; away: number } {
  const homeRaw = 1 / homeOdds;
  const awayRaw = 1 / awayOdds;
  const total = homeRaw + awayRaw;
  return {
    home: round(homeRaw / total, 4),
    away: round(awayRaw / total, 4),
  };
}

async function loadOddsFromFusionCache(): Promise<OddsLoadResult | null> {
  try {
    const text = await readFile(FUSION_CACHE_PATH, "utf8");
    const parsed = JSON.parse(text) as unknown;
    const root = asRecord(parsed);
    const meta = asRecord(root?.meta);
    if (asString(meta?.targetDateKst) !== TARGET_DATE_KST) return null;
    const games = Array.isArray(root?.games) ? root.games : [];
    const events: MarketOdds[] = [];
    for (const gameRaw of games) {
      const game = asRecord(gameRaw);
      const oddsMatch = asRecord(game?.oddsMatch);
      const event = asRecord(oddsMatch?.event);
      const eventId = asString(event?.eventId);
      const commenceTime = asString(event?.commenceTime);
      const homeTeam = asString(event?.homeTeam);
      const awayTeam = asString(event?.awayTeam);
      const bestHomeOdds = asNumber(event?.bestHomeOdds);
      const bestAwayOdds = asNumber(event?.bestAwayOdds);
      if (
        !eventId ||
        !commenceTime ||
        !homeTeam ||
        !awayTeam ||
        bestHomeOdds == null ||
        bestAwayOdds == null ||
        !(bestHomeOdds > 1) ||
        !(bestAwayOdds > 1)
      ) {
        continue;
      }
      const normalized = normalizedTwoWayProbability(
        bestHomeOdds,
        bestAwayOdds,
      );
      events.push({
        eventId,
        commenceTime,
        homeTeam,
        awayTeam,
        bestHomeOdds,
        bestAwayOdds,
        bookmakerCount: asNumber(event?.bookmakerCount) ?? 0,
        normalizedHomeProbability: normalized.home,
        normalizedAwayProbability: normalized.away,
      });
    }
    if (events.length === 0) return null;

    const providerSummary = asRecord(root?.providerSummary);
    const oddsSummary = asRecord(providerSummary?.theOddsApi);
    const requests = asRecord(oddsSummary?.requests);
    const activeSport = asRecord(oddsSummary?.activeSport);
    return {
      events,
      cacheReused: true,
      cacheSource: path.relative(process.cwd(), FUSION_CACHE_PATH),
      calls: 0,
      usage: {
        requestsRemaining: asNumber(requests?.remaining),
        requestsUsed: asNumber(requests?.used),
        requestsLast: asNumber(requests?.last),
      },
      sportKey: asString(activeSport?.key),
      error: null,
    };
  } catch {
    return null;
  }
}

function findMlbSport(sports: OddsSportInfo[]): OddsSportInfo | null {
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

async function loadOdds(): Promise<OddsLoadResult> {
  const cached = await loadOddsFromFusionCache();
  if (cached) return cached;

  const apiKey = (process.env.ODDS_API_KEY ?? "").trim();
  const emptyUsage: OddsUsageMeta = {
    requestsRemaining: null,
    requestsUsed: null,
    requestsLast: null,
  };
  if (!apiKey) {
    return {
      events: [],
      cacheReused: false,
      cacheSource: null,
      calls: 0,
      usage: emptyUsage,
      sportKey: null,
      error: "ODDS_API_KEY 미설정",
    };
  }

  try {
    const provider = new TheOddsApiProvider(
      (process.env.ODDS_API_BASE_URL ?? "").trim() ||
        "https://api.the-odds-api.com/v4",
      apiKey,
    );
    const listed = await provider.listSports();
    const sport = findMlbSport(listed.sports);
    if (!sport) throw new Error("활성 MLB sport key 없음");
    const result = await provider.getOdds({
      sportKey: sport.key,
      regions: "eu",
      markets: "h2h",
      commenceTimeFrom: new Date(TARGET_DAY_START_MS)
        .toISOString()
        .replace(".000Z", "Z"),
      commenceTimeTo: new Date(TARGET_DAY_END_MS)
        .toISOString()
        .replace(".000Z", "Z"),
    });
    const events = result.events
      .filter(
        (event) =>
          event.bestHomeOdds != null &&
          event.bestAwayOdds != null &&
          event.bestHomeOdds > 1 &&
          event.bestAwayOdds > 1,
      )
      .map((event) => {
        const probabilities = normalizedTwoWayProbability(
          event.bestHomeOdds!,
          event.bestAwayOdds!,
        );
        return {
          eventId: event.externalEventId,
          commenceTime: event.commenceTime,
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          bestHomeOdds: event.bestHomeOdds!,
          bestAwayOdds: event.bestAwayOdds!,
          bookmakerCount: event.bookmakers.length,
          normalizedHomeProbability: probabilities.home,
          normalizedAwayProbability: probabilities.away,
        };
      });
    return {
      events,
      cacheReused: result.cached,
      cacheSource: result.cached ? "in-process odds cache" : null,
      calls: result.cached ? 1 : 2,
      usage: result.usage,
      sportKey: sport.key,
      error: null,
    };
  } catch (error) {
    return {
      events: [],
      cacheReused: false,
      cacheSource: null,
      calls: 0,
      usage: emptyUsage,
      sportKey: null,
      error: safeError(error),
    };
  }
}

async function loadApiBaseball(): Promise<{
  season: number;
  leagueId: number | null;
  games: RawSeasonGame[];
  standings: Map<number, Standing>;
  usage: ApiUsage;
  elapsedMs: number[];
  errors: string[];
  observedFields: {
    game: string[];
    status: string[];
    scoreHome: string[];
    scoreAway: string[];
    pitcher: string[];
    standing: string[];
  };
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
  const usage: ApiUsage = { calls: 0, remaining: null, limit: null };
  const elapsedMs: number[] = [];
  const errors: string[] = [];
  const cache = new Map<string, TimedResponse<ApiEnvelope>>();

  const get = async (
    endpoint: string,
    params: Record<string, string | number>,
  ) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
      ),
    );
    const cacheKey = `${endpoint}?${query}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    usage.calls += 1;
    const result = await fetchJson<ApiEnvelope>(
      `${baseUrl}/${endpoint}?${query}`,
      { headers: { "x-apisports-key": apiKey } },
    );
    cache.set(cacheKey, result);
    elapsedMs.push(result.elapsedMs);
    usage.remaining = numberHeader(
      result.headers,
      "x-ratelimit-requests-remaining",
      "x-ratelimit-remaining",
    );
    usage.limit = numberHeader(
      result.headers,
      "x-ratelimit-requests-limit",
      "x-ratelimit-limit",
    );
    const apiError = errorsText(result.data.errors);
    if (apiError) throw new Error(apiError);
    return result;
  };

  if (!apiKey) {
    errors.push("BASEBALL_API_KEY/FOOTBALL_API_KEY 미설정");
    return {
      season: 2026,
      leagueId: null,
      games: [],
      standings: new Map(),
      usage,
      elapsedMs,
      errors,
      observedFields: {
        game: [],
        status: [],
        scoreHome: [],
        scoreAway: [],
        pitcher: [],
        standing: [],
      },
    };
  }

  let season = 2026;
  let leagueId: number | null = null;
  let games: RawSeasonGame[] = [];
  let standings = new Map<number, Standing>();
  try {
    const leagues = await get("leagues", { search: "MLB" });
    const leagueRows = Array.isArray(leagues.data.response)
      ? leagues.data.response
      : [];
    const league = leagueRows
      .map(asRecord)
      .find((row) => /\bmlb\b|major league baseball/i.test(asString(row?.name) ?? ""));
    leagueId = asNumber(league?.id);
    if (leagueId == null) throw new Error("MLB league ID 없음");
    const seasons = Array.isArray(league?.seasons) ? league.seasons : [];
    const current = seasons
      .map(asRecord)
      .find((row) => row?.current === true);
    season =
      asNumber(current?.season) ??
      asNumber(current?.year) ??
      2026;

    // 현재 시즌 전체 일정을 한 번 조회하고 모든 팀/맞대결 집계에 재사용한다.
    const seasonGames = await get("games", { league: leagueId, season });
    const gameRows = Array.isArray(seasonGames.data.response)
      ? seasonGames.data.response
      : [];
    games = gameRows
      .map((row) => parseSeasonGame(row, season, leagueId!))
      .filter((game): game is RawSeasonGame => game != null);

    const standingResult = await get("standings", {
      league: leagueId,
      season,
    });
    const standingRows = Array.isArray(standingResult.data.response)
      ? standingResult.data.response
      : [];
    standings = parseStandings(standingRows);
  } catch (error) {
    errors.push(safeError(error));
  }

  const sampleGame = games[0];
  const sampleStanding = [...standings.values()][0];
  return {
    season,
    leagueId,
    games,
    standings,
    usage,
    elapsedMs,
    errors,
    observedFields: {
      game: sampleGame?.observedTopLevelFields ?? [],
      status: sampleGame?.observedStatusFields ?? [],
      scoreHome: sampleGame?.observedScoreFields.home ?? [],
      scoreAway: sampleGame?.observedScoreFields.away ?? [],
      pitcher: [
        ...new Set(games.flatMap((game) => Object.keys(game.pitcherFields))),
      ],
      standing: sampleStanding?.observedFields ?? [],
    },
  };
}

function factorAvailability(
  home: ReturnType<typeof teamCandidate>,
  away: ReturnType<typeof teamCandidate>,
  h2h: ReturnType<typeof headToHeadCandidate>,
  pitchersAvailable: boolean,
): Record<FactorKey, boolean> {
  return {
    recentForm:
      home.recentGames.available && away.recentGames.available,
    homeAway:
      home.homeRecord.available && away.awayRecord.available,
    scoring:
      home.scoringAverages.available && away.scoringAverages.available,
    defense:
      home.scoringAverages.available && away.scoringAverages.available,
    leagueStanding:
      home.standing.available && away.standing.available,
    headToHead: h2h.available,
    rest: home.restDays.available && away.restDays.available,
    injuries: false,
    streak: home.streak.available && away.streak.available,
    startingPitcher: pitchersAvailable,
  };
}

function percentage(count: number, total: number): number {
  return total > 0 ? round((count / total) * 100) : 0;
}

async function main() {
  console.log(
    `=== MLB AnalysisData 커버리지 (${TARGET_DATE_KST} KST) ===`,
  );
  const [api, odds] = await Promise.all([loadApiBaseball(), loadOdds()]);
  const targets = api.games
    .filter(
      (game) =>
        game.dateKst === TARGET_DATE_KST &&
        Date.parse(game.commenceTimeUtc) >= TARGET_DAY_START_MS &&
        Date.parse(game.commenceTimeUtc) < TARGET_DAY_END_MS,
    )
    .sort(
      (a, b) =>
        Date.parse(a.commenceTimeUtc) - Date.parse(b.commenceTimeUtc),
    );

  const games = targets.map((target) => {
    const home = teamCandidate(
      target,
      target.homeTeamId,
      target.homeTeam,
      api.games,
      api.standings.get(target.homeTeamId) ?? null,
    );
    const away = teamCandidate(
      target,
      target.awayTeamId,
      target.awayTeam,
      api.games,
      api.standings.get(target.awayTeamId) ?? null,
    );
    const h2h = headToHeadCandidate(target, api.games);
    const pitcher = detectStartingPitcher(target);
    const pitcherAvailable = pitcher.field.available;
    const factors = factorAvailability(
      home,
      away,
      h2h,
      pitcherAvailable,
    );
    const availableFactors = Object.values(factors).filter(Boolean).length;
    const dataAvailability = round(
      availableFactors / FACTOR_KEYS.length,
      4,
    );
    const market = matchMarketOdds(target, odds.events);
    const oddsField =
      market == null
        ? missingField<MarketOdds>(
            target.commenceTimeUtc,
            "the-odds-api",
          )
        : availableField(
            market,
            "the-odds-api (h2h, normalized two-way probability)",
            market.bookmakerCount,
            target.commenceTimeUtc,
          );

    const missingFields: string[] = [];
    if ((home.recentGames.sampleSize ?? 0) < 5) {
      missingFields.push("home.recentGames<5");
    }
    if ((away.recentGames.sampleSize ?? 0) < 5) {
      missingFields.push("away.recentGames<5");
    }
    if (!home.seasonWinRate.available) {
      missingFields.push("home.seasonWinRate");
    }
    if (!away.seasonWinRate.available) {
      missingFields.push("away.seasonWinRate");
    }
    if (!home.homeRecord.available) missingFields.push("home.homeRecord");
    if (!away.awayRecord.available) missingFields.push("away.awayRecord");
    if (!home.scoringAverages.available) {
      missingFields.push("home.scoringAverages");
    }
    if (!away.scoringAverages.available) {
      missingFields.push("away.scoringAverages");
    }
    if (!home.standing.available) missingFields.push("home.leagueStanding");
    if (!away.standing.available) missingFields.push("away.leagueStanding");
    if (!pitcherAvailable) missingFields.push("startingPitcher");
    missingFields.push("injuries");
    if (!oddsField.available) missingFields.push("marketOdds");

    const baselineReady =
      (home.recentGames.sampleSize ?? 0) >= 5 &&
      (away.recentGames.sampleSize ?? 0) >= 5 &&
      home.seasonWinRate.available &&
      away.seasonWinRate.available &&
      home.homeRecord.available &&
      away.awayRecord.available &&
      home.scoringAverages.available &&
      away.scoringAverages.available &&
      oddsField.available &&
      dataAvailability >= 0.7;
    const status: CoverageStatus = baselineReady
      ? "BASELINE_READY"
      : "INSUFFICIENT";

    return {
      game: {
        externalId: target.externalId,
        commenceTimeUtc: target.commenceTimeUtc,
        dateKst: target.dateKst,
        startTimeKst: target.startTimeKst,
        homeTeam: target.homeTeam,
        awayTeam: target.awayTeam,
        status: target.statusLong ?? target.status,
        league: target.leagueName,
        season: target.season,
      },
      analysisCandidate: {
        home,
        away,
        headToHead: h2h,
        startingPitcher: pitcher.field,
        marketOdds: oddsField,
      },
      factorAvailability: factors,
      dataAvailability,
      missingFields: [...new Set(missingFields)],
      qualityStatus: status,
      leakageGuard: {
        cutoffTime: target.commenceTimeUtc,
        finishedStatusesAccepted: [...FINISHED_STATUSES],
        targetKstDateGamesExcluded: true,
        futureGamesExcluded: true,
        inProgressGamesExcluded: true,
      },
    };
  });

  const readyCount = games.filter(
    (game) => game.qualityStatus === "BASELINE_READY",
  ).length;
  const insufficientCount = games.length - readyCount;
  const averageAvailability =
    games.length > 0
      ? round(
          games.reduce(
            (sum, game) => sum + game.dataAvailability,
            0,
          ) / games.length,
          4,
        )
      : 0;
  const pitcherCount = games.filter(
    (game) => game.analysisCandidate.startingPitcher.available,
  ).length;

  const itemAvailability = {
    recentGames5: games.filter(
      (game) =>
        (game.analysisCandidate.home.recentGames.sampleSize ?? 0) >= 5 &&
        (game.analysisCandidate.away.recentGames.sampleSize ?? 0) >= 5,
    ).length,
    recentForm: games.filter(
      (game) => game.factorAvailability.recentForm,
    ).length,
    scoringAverages: games.filter(
      (game) => game.factorAvailability.scoring,
    ).length,
    homeAwayRecords: games.filter(
      (game) => game.factorAvailability.homeAway,
    ).length,
    seasonWinRate: games.filter(
      (game) =>
        game.analysisCandidate.home.seasonWinRate.available &&
        game.analysisCandidate.away.seasonWinRate.available,
    ).length,
    streak: games.filter((game) => game.factorAvailability.streak).length,
    restDays: games.filter((game) => game.factorAvailability.rest).length,
    headToHead: games.filter(
      (game) => game.factorAvailability.headToHead,
    ).length,
    teamStatistics: games.filter(
      (game) =>
        game.analysisCandidate.home.teamStatistics.available &&
        game.analysisCandidate.away.teamStatistics.available,
    ).length,
    leagueStanding: games.filter(
      (game) => game.factorAvailability.leagueStanding,
    ).length,
    startingPitcher: pitcherCount,
    injuries: 0,
    marketOdds: games.filter(
      (game) => game.analysisCandidate.marketOdds.available,
    ).length,
  };
  const itemAvailabilityRates = Object.fromEntries(
    Object.entries(itemAvailability).map(([key, count]) => [
      key,
      {
        games: count,
        ratePercent: percentage(count, games.length),
      },
    ]),
  );

  const missingCounts = new Map<string, number>();
  for (const game of games) {
    for (const field of game.missingFields) {
      missingCounts.set(field, (missingCounts.get(field) ?? 0) + 1);
    }
  }
  const missingRanking = [...missingCounts.entries()]
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));
  const mostMissingFields = missingRanking.filter(
    (item) => item.count === (missingRanking[0]?.count ?? -1),
  );

  const temporaryAnalysisPossible =
    readyCount === games.length && games.length === 15;

  const output = {
    meta: {
      version: "mlb-analysis-coverage-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      rules: {
        apiBaseballOnlyForAnalysisValues: true,
        sportsDataIoValuesUsed: false,
        sportsDataIoReason: "Trial response marked Scrambled",
        oddsUsedForMarketOnly: true,
        missingValuesImputed: false,
      },
      dataAvailabilityDenominator: {
        factors: FACTOR_KEYS,
        count: FACTOR_KEYS.length,
        note: "실제 가용한 EDGE factor 그룹만 계산. SportsDataIO Trial 값 제외.",
      },
    },
    api: {
      apiBaseball: {
        leagueId: api.leagueId,
        season: api.season,
        seasonGameCount: api.games.length,
        calls: api.usage.calls,
        remaining: api.usage.remaining,
        limit: api.usage.limit,
        averageResponseMs:
          api.elapsedMs.length > 0
            ? Math.round(
                api.elapsedMs.reduce((sum, value) => sum + value, 0) /
                  api.elapsedMs.length,
              )
            : null,
        errors: api.errors,
        endpoints: [
          "/leagues?search=MLB",
          "/games?league={actualId}&season={currentSeason}",
          "/standings?league={actualId}&season={currentSeason}",
        ],
        repeatedPerGameCalls: 0,
        observedFields: api.observedFields,
      },
      odds: {
        sportKey: odds.sportKey,
        events: odds.events.length,
        cacheReused: odds.cacheReused,
        cacheSource: odds.cacheSource,
        calls: odds.calls,
        remaining: odds.usage.requestsRemaining,
        used: odds.usage.requestsUsed,
        error: odds.error,
      },
      sportsDataIo: {
        calls: 0,
        valuesUsed: false,
        note: "Provider 구조는 유지하되 Scrambled Trial 값을 조회/사용하지 않음",
      },
    },
    summary: {
      totalGames: games.length,
      baselineReady: readyCount,
      insufficient: insufficientCount,
      averageDataAvailability: averageAvailability,
      startingPitcherAvailable: pitcherCount,
      itemAvailability: itemAvailabilityRates,
      mostMissingFields,
      temporaryMlbAnalysisPossible: temporaryAnalysisPossible,
      decision: temporaryAnalysisPossible
        ? "선발투수·부상은 누락되지만 정의된 BASELINE_READY 기준으로 15경기 임시 분석 후보 생성 가능"
        : "BASELINE_READY 미충족 경기가 있어 임시 MLB 분석 불가",
      sportsDataIoPaidNeededFor: [
        "실제 선발투수 및 투수 세부 통계",
        "실제 projected/confirmed lineup",
        "실제 부상·결장 정보",
      ],
    },
    games,
  };

  const json = `${JSON.stringify(output, null, 2)}\n`;
  const apiKey = (
    process.env.BASEBALL_API_KEY ??
    process.env.FOOTBALL_API_KEY ??
    ""
  ).trim();
  if (
    /x-apisports-key/i.test(json) ||
    /api[_-]?key/i.test(json) ||
    (apiKey && json.includes(apiKey))
  ) {
    throw new Error("결과 파일에서 API 키 관련 문자열 감지 — 저장 중단");
  }
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, json, "utf8");

  console.log(`전체 MLB 경기 수: ${games.length}`);
  console.log(`BASELINE_READY: ${readyCount}`);
  console.log(`INSUFFICIENT: ${insufficientCount}`);
  console.log(`평균 dataAvailability: ${averageAvailability}`);
  console.log(`선발투수 확보 경기 수: ${pitcherCount}`);
  console.log(
    `가장 많이 누락된 필드: ${
      mostMissingFields.length > 0
        ? mostMissingFields
            .map((item) => `${item.field}(${item.count})`)
            .join(", ")
        : "없음"
    }`,
  );
  console.log(
    `API 요청량: API-BASEBALL ${api.usage.calls}회 remaining=${api.usage.remaining ?? "?"}/${api.usage.limit ?? "?"}; Odds ${odds.calls}회 cache=${odds.cacheReused ? "reused" : "miss"} remaining=${odds.usage.requestsRemaining ?? "?"}`,
  );
  console.log(
    `임시 MLB 분석 가능 여부: ${temporaryAnalysisPossible ? "가능" : "불가"}`,
  );
  console.log(
    "SportsDataIO 유료 필요: 실제 선발투수/라인업/부상·결장 데이터",
  );
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error("FAILED:", safeError(error));
  process.exitCode = 1;
});
