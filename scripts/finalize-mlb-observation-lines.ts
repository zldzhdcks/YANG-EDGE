/**
 * 2026-07-27 KST MLB HOLD 4경기 — 경기 직전 최종 관찰 라인 확정.
 *
 * 대상: line-recheck 에서 HOLD 인 경기만 (Padres/Rays/Dodgers/Astros).
 * Yankees DROP 유지. Brewers 대상 아님.
 *
 * 절대 금지:
 *   - EDGE Engine / weights / Confidence / 모델 확률 / Baseline pick 변경
 *   - 추천 등급 규칙·/games·Home·스냅샷·가계부 수정
 *   - 2·3폴더 생성
 *   - prediction snapshot 자동 저장
 *   - SportsDataIO Scrambled / MLB.com HTML 크롤링
 *   - 확정 적중·수익 보장 표현
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/finalize-mlb-observation-lines.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import { buildMarketComparison } from "../src/lib/market/build-market-comparison";
import {
  getOddsProvider,
  normalizeTeamNameForOdds,
  resolveSportKeysForLeagues,
  type OddsData,
} from "../src/lib/odds";
import type { GameData } from "../src/types/game";

const TARGET_DATE_KST = "2026-07-27";
/** KST 2026-07-27 경기가 포함된 미국 캘린더 날짜 */
const SCHEDULE_DATE_US = "2026-07-26";
const STATS_API_BASE = "https://statsapi.mlb.com";
const SEASON = 2026;
const COMMENCE_TOLERANCE_MS = 3 * 60 * 60 * 1000;
const ADVERSE_DROP_PP = 5;
const OBSERVE_MIN_VE = 5;

const RECHECK_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-line-recheck.json`,
);
const PITCHER_REVIEW_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-pitcher-review.json`,
);
const WATCHLIST_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-final-lines.json`,
);

type Side = "home" | "away";
type PitcherDirection =
  | "SUPPORTS_BASELINE"
  | "CONFLICTS_BASELINE"
  | "MIXED"
  | "INSUFFICIENT"
  | "UNKNOWN";
type StarterStatus = "STARTER_STABLE" | "STARTER_CHANGED" | "STARTER_UNKNOWN";
type LineupStatus =
  | "LINEUP_COMPLETE"
  | "LINEUP_PARTIAL"
  | "LINEUP_NOT_PUBLISHED";
type FinalClass = "FINAL_OBSERVE" | "FINAL_HOLD" | "FINAL_DROP";
type MatchStatus = "matched" | "ambiguous" | "failed";

type RecheckGame = {
  gameId: string;
  match: string;
  startTimeKst: string | null;
  commenceTimeUtc: string | null;
  baselinePick: string | null;
  pickSide: Side | null;
  initialBestOdds: number | null;
  initialMarketProbability: number | null;
  initialValueEdge: number | null;
  modelProbabilityUnchanged: number | null;
  confidence: number | null;
  dataAvailability: number | null;
  missingData: string[];
  pitcherDirection: PitcherDirection;
  classification: string;
  homeTeam: string;
  awayTeam: string;
};

type PitcherSideStored = {
  name: string | null;
  seasonEra: number | null;
  seasonWhip: number | null;
  providerPlayerId: string | null;
};

type PitcherReviewStored = {
  gameId: string;
  direction: PitcherDirection;
  home: PitcherSideStored;
  away: PitcherSideStored;
};

type LivePitcher = {
  id: number | null;
  fullName: string | null;
  seasonEra: number | null;
  seasonWhip: number | null;
};

type ScheduleLive = {
  gamePk: number;
  homeTeam: string | null;
  awayTeam: string | null;
  commenceTimeUtc: string | null;
  startTimeKst: string | null;
  detailedState: string | null;
  abstractGameState: string | null;
  homePitcher: LivePitcher;
  awayPitcher: LivePitcher;
  homeLineupCount: number;
  awayLineupCount: number;
};

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
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const memoryCache = new Map<string, unknown>();
let statsApiCalls = 0;

async function fetchStatsJson(pathnameAndQuery: string): Promise<unknown> {
  if (memoryCache.has(pathnameAndQuery)) return memoryCache.get(pathnameAndQuery);
  statsApiCalls += 1;
  const response = await fetch(`${STATS_API_BASE}${pathnameAndQuery}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(`Stats API HTTP ${response.status} for ${pathnameAndQuery}`);
  }
  memoryCache.set(pathnameAndQuery, data);
  return data;
}

function parseTeamName(watchMatch: string, side: "home" | "away"): string {
  // "Away @ Home"
  const parts = watchMatch.split(" @ ");
  if (parts.length === 2) {
    return side === "away" ? parts[0].trim() : parts[1].trim();
  }
  return side === "home" ? "Home" : "Away";
}

function loadRecheckGames(raw: unknown): RecheckGame[] {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  return games
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) return null;
      const gameId = asString(row.gameId);
      const match = asString(row.match) ?? "";
      if (!gameId) return null;
      const pickSide = asString(row.pickSide);
      const direction = asString(row.pitcherDirection);
      return {
        gameId,
        match,
        startTimeKst: asString(row.startTimeKst),
        commenceTimeUtc: asString(row.commenceTimeUtc),
        baselinePick: asString(row.baselinePick),
        pickSide:
          pickSide === "home" || pickSide === "away"
            ? (pickSide as Side)
            : null,
        initialBestOdds: asNumber(row.initialBestOdds),
        initialMarketProbability: asNumber(row.initialMarketProbability),
        initialValueEdge: asNumber(row.initialValueEdge),
        modelProbabilityUnchanged: asNumber(row.modelProbabilityUnchanged),
        confidence: asNumber(row.confidence),
        dataAvailability: asNumber(row.dataAvailability),
        missingData: Array.isArray(row.missingData)
          ? row.missingData.filter((x): x is string => typeof x === "string")
          : [],
        pitcherDirection:
          direction === "SUPPORTS_BASELINE" ||
          direction === "CONFLICTS_BASELINE" ||
          direction === "MIXED" ||
          direction === "INSUFFICIENT"
            ? direction
            : "UNKNOWN",
        classification: asString(row.classification) ?? "",
        homeTeam: parseTeamName(match, "home"),
        awayTeam: parseTeamName(match, "away"),
      } satisfies RecheckGame;
    })
    .filter((g): g is RecheckGame => g != null);
}

function loadPitcherReviews(raw: unknown): Map<string, PitcherReviewStored> {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  const map = new Map<string, PitcherReviewStored>();
  for (const entry of games) {
    const row = asRecord(entry);
    const gameId = asString(row?.gameId);
    if (!row || !gameId) continue;
    const home = asRecord(row.homePitcher);
    const away = asRecord(row.awayPitcher);
    const direction = asString(row.direction);
    map.set(gameId, {
      gameId,
      direction:
        direction === "SUPPORTS_BASELINE" ||
        direction === "CONFLICTS_BASELINE" ||
        direction === "MIXED" ||
        direction === "INSUFFICIENT"
          ? direction
          : "UNKNOWN",
      home: {
        name: asString(home?.name),
        seasonEra: asNumber(home?.seasonEra),
        seasonWhip: asNumber(home?.seasonWhip),
        providerPlayerId: null,
      },
      away: {
        name: asString(away?.name),
        seasonEra: asNumber(away?.seasonEra),
        seasonWhip: asNumber(away?.seasonWhip),
        providerPlayerId: null,
      },
    });
  }
  return map;
}

function loadWatchMissing(raw: unknown): Map<string, string[]> {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  const map = new Map<string, string[]>();
  for (const entry of games) {
    const row = asRecord(entry);
    const gameId = asString(row?.gameId);
    if (!gameId) continue;
    map.set(
      gameId,
      Array.isArray(row?.missingData)
        ? row.missingData.filter((x): x is string => typeof x === "string")
        : [],
    );
  }
  return map;
}

function pitcherFrom(raw: unknown): { id: number | null; fullName: string | null } {
  const row = asRecord(raw);
  if (!row) return { id: null, fullName: null };
  return { id: asNumber(row.id), fullName: asString(row.fullName) };
}

function namesEqual(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return normalizeTeamNameForOdds(a) === normalizeTeamNameForOdds(b);
}

async function loadSeasonPitching(
  playerId: number,
): Promise<{ era: number | null; whip: number | null }> {
  const pathQuery =
    `/api/v1/people/${playerId}/stats` +
    `?stats=season&group=pitching&season=${SEASON}&sportId=1`;
  try {
    const data = asRecord(await fetchStatsJson(pathQuery));
    const stats = Array.isArray(data?.stats) ? data.stats : [];
    const first = asRecord(stats[0]);
    const splits = Array.isArray(first?.splits) ? first.splits : [];
    const split = asRecord(splits[0]);
    const stat = asRecord(split?.stat);
    const eraRaw = stat?.era;
    const whipRaw = stat?.whip;
    const era =
      typeof eraRaw === "number"
        ? eraRaw
        : typeof eraRaw === "string" && eraRaw !== "-.--"
          ? Number(eraRaw)
          : null;
    const whip =
      typeof whipRaw === "number"
        ? whipRaw
        : typeof whipRaw === "string" && whipRaw !== "-.--"
          ? Number(whipRaw)
          : null;
    return {
      era: era != null && Number.isFinite(era) ? round2(era) : null,
      whip: whip != null && Number.isFinite(whip) ? round2(whip) : null,
    };
  } catch {
    return { era: null, whip: null };
  }
}

async function fetchScheduleLive(): Promise<ScheduleLive[]> {
  const hydrate = encodeURIComponent("probablePitcher,lineups");
  const pathQuery = `/api/v1/schedule?sportId=1&date=${encodeURIComponent(SCHEDULE_DATE_US)}&hydrate=${hydrate}`;
  const data = asRecord(await fetchStatsJson(pathQuery));
  const dates = Array.isArray(data?.dates) ? data.dates : [];
  const rawGames: unknown[] = [];
  for (const day of dates) {
    const dayRow = asRecord(day);
    if (Array.isArray(dayRow?.games)) rawGames.push(...dayRow.games);
  }

  const games: ScheduleLive[] = [];
  for (const raw of rawGames) {
    const row = asRecord(raw);
    if (!row) continue;
    const gamePk = asNumber(row.gamePk);
    if (gamePk == null) continue;
    const gameDate = asString(row.gameDate);
    const kst = gameDate ? instantToKst(gameDate) : null;
    if (!kst || kst.date !== TARGET_DATE_KST) continue;

    const teams = asRecord(row.teams);
    const home = asRecord(teams?.home);
    const away = asRecord(teams?.away);
    const status = asRecord(row.status);
    const lineups = asRecord(row.lineups);
    const homePlayers = Array.isArray(lineups?.homePlayers)
      ? lineups.homePlayers
      : [];
    const awayPlayers = Array.isArray(lineups?.awayPlayers)
      ? lineups.awayPlayers
      : [];

    const homeP = pitcherFrom(home?.probablePitcher);
    const awayP = pitcherFrom(away?.probablePitcher);

    games.push({
      gamePk,
      homeTeam: asString(asRecord(home?.team)?.name),
      awayTeam: asString(asRecord(away?.team)?.name),
      commenceTimeUtc: gameDate,
      startTimeKst: kst.time,
      detailedState: asString(status?.detailedState),
      abstractGameState: asString(status?.abstractGameState),
      homePitcher: {
        id: homeP.id,
        fullName: homeP.fullName,
        seasonEra: null,
        seasonWhip: null,
      },
      awayPitcher: {
        id: awayP.id,
        fullName: awayP.fullName,
        seasonEra: null,
        seasonWhip: null,
      },
      homeLineupCount: homePlayers.length,
      awayLineupCount: awayPlayers.length,
    });
  }
  return games;
}

function findScheduleGame(
  liveGames: ScheduleLive[],
  homeTeam: string,
  awayTeam: string,
): ScheduleLive | null {
  const hits = liveGames.filter(
    (g) =>
      namesEqual(g.homeTeam, homeTeam) && namesEqual(g.awayTeam, awayTeam),
  );
  if (hits.length === 1) return hits[0];
  return null;
}

function classifyLineup(homeCount: number, awayCount: number): LineupStatus {
  const homeOk = homeCount >= 9;
  const awayOk = awayCount >= 9;
  if (homeOk && awayOk) return "LINEUP_COMPLETE";
  if (homeCount > 0 || awayCount > 0) return "LINEUP_PARTIAL";
  return "LINEUP_NOT_PUBLISHED";
}

function classifyStarter(
  prevHome: string | null,
  prevAway: string | null,
  liveHome: string | null,
  liveAway: string | null,
): StarterStatus {
  if (!liveHome || !liveAway) return "STARTER_UNKNOWN";
  if (!prevHome || !prevAway) return "STARTER_UNKNOWN";
  const homeSame = namesEqual(prevHome, liveHome);
  const awaySame = namesEqual(prevAway, liveAway);
  if (homeSame && awaySame) return "STARTER_STABLE";
  return "STARTER_CHANGED";
}

function isCancelledOrPostponed(state: string | null): boolean {
  if (!state) return false;
  return /cancel|postpone|suspended|delay/i.test(state);
}

function toGameData(game: RecheckGame): GameData {
  return {
    id: game.gameId,
    sport: "baseball",
    league: "MLB",
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    startTime: game.startTimeKst ?? "TBD",
    date: TARGET_DATE_KST,
    aiAnalysisAvailable: false,
  };
}

function teamNameScore(a: string, b: string): number {
  const na = normalizeTeamNameForOdds(a);
  const nb = normalizeTeamNameForOdds(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) {
    return 0.8;
  }
  return 0;
}

function findOddsCandidates(
  game: GameData,
  oddsList: OddsData[],
  commenceMs: number | null,
): { odds: OddsData; confidence: number }[] {
  const hits: { odds: OddsData; confidence: number }[] = [];
  for (const odds of oddsList) {
    const kst = instantToKst(odds.commenceTime);
    if (kst?.date !== TARGET_DATE_KST) continue;
    const homeScore = teamNameScore(game.homeTeam, odds.homeTeam);
    const awayScore = teamNameScore(game.awayTeam, odds.awayTeam);
    if (homeScore === 0 || awayScore === 0) continue;
    const confidence = Math.min(homeScore, awayScore) * 0.9;
    if (confidence < 0.7) continue;
    const oddsMs = Date.parse(odds.commenceTime);
    if (!Number.isFinite(oddsMs)) continue;
    if (commenceMs != null && Math.abs(commenceMs - oddsMs) > COMMENCE_TOLERANCE_MS) {
      continue;
    }
    hits.push({ odds, confidence });
  }
  hits.sort((a, b) => b.confidence - a.confidence);
  return hits;
}

function classifyMatch(candidates: { odds: OddsData; confidence: number }[]): {
  status: MatchStatus;
  odds: OddsData | null;
} {
  if (candidates.length === 0) return { status: "failed", odds: null };
  if (candidates.length > 1) {
    const top = candidates[0].confidence;
    const tied = candidates.filter((c) => c.confidence === top);
    if (tied.length > 1) return { status: "ambiguous", odds: null };
  }
  return { status: "matched", odds: candidates[0].odds };
}

function marketForPick(odds: OddsData, side: Side) {
  const comparison = buildMarketComparison({
    odds: {
      homeOdds: odds.bestHomeOdds,
      awayOdds: odds.bestAwayOdds,
      drawOdds: null,
    },
    marketType: "two-way",
  });
  const unit =
    side === "home"
      ? comparison.normalizedProbabilities.home
      : comparison.normalizedProbabilities.away;
  const bestOdds = side === "home" ? odds.bestHomeOdds : odds.bestAwayOdds;
  return {
    bestOdds,
    marketProbability: unit == null ? null : Math.round(unit * 100),
    dataQuality: comparison.dataQuality,
    bookmakerCount: odds.bookmakers.length,
  };
}

function classifyFinal(input: {
  currentValueEdge: number | null;
  matchStatus: MatchStatus;
  dataQuality: string | null;
  pitcherDirection: PitcherDirection;
  starterStatus: StarterStatus;
  gameStatusBad: boolean;
  marketProbChangePp: number | null;
  confidence: number | null;
  lineupStatus: LineupStatus;
  keyMissing: boolean;
  adverseRecent: boolean;
}): { classification: FinalClass; reasons: string[] } {
  const drop: string[] = [];
  if (input.gameStatusBad) drop.push("경기 취소/연기/중단");
  if (input.matchStatus === "failed") drop.push("Odds 매칭 실패");
  if (input.matchStatus === "ambiguous") drop.push("Odds 매칭 AMBIGUOUS");
  if (
    input.dataQuality != null &&
    input.dataQuality !== "complete" &&
    input.matchStatus === "matched"
  ) {
    drop.push(`배당 데이터 품질 불충분 (${input.dataQuality})`);
  }
  if (input.starterStatus === "STARTER_CHANGED") {
    drop.push("선발 변경 (STARTER_CHANGED) — 자동 최종 라인 제외");
  }
  if (input.pitcherDirection === "CONFLICTS_BASELINE") {
    drop.push("투수 방향 CONFLICTS_BASELINE");
  }
  if (input.currentValueEdge != null && input.currentValueEdge <= 0) {
    drop.push(`currentValueEdge <= 0 (${input.currentValueEdge})`);
  }
  if (input.currentValueEdge == null) {
    drop.push("currentValueEdge 산출 불가");
  }
  if (
    input.marketProbChangePp != null &&
    input.marketProbChangePp <= -ADVERSE_DROP_PP
  ) {
    drop.push(
      `시장 확률 최초 대비 ${ADVERSE_DROP_PP}%p 이상 불리 (${input.marketProbChangePp}pp)`,
    );
  }
  if (drop.length > 0) {
    return { classification: "FINAL_DROP", reasons: drop };
  }

  const hold: string[] = [];
  if (input.pitcherDirection === "MIXED") hold.push("투수 방향 MIXED");
  if (input.lineupStatus !== "LINEUP_COMPLETE") {
    hold.push(`라인업 ${input.lineupStatus}`);
  }
  if (input.confidence != null && input.confidence < 50) {
    hold.push(`Confidence < 50 (${input.confidence})`);
  }
  if (input.adverseRecent) hold.push("최근 배당 불리 이동");
  if (input.keyMissing) hold.push("핵심 정보 누락");

  if (
    input.currentValueEdge != null &&
    input.currentValueEdge > 0 &&
    hold.length > 0
  ) {
    return { classification: "FINAL_HOLD", reasons: hold };
  }

  // FINAL_OBSERVE
  if (
    input.currentValueEdge != null &&
    input.currentValueEdge > OBSERVE_MIN_VE &&
    input.matchStatus === "matched" &&
    input.dataQuality === "complete" &&
    input.pitcherDirection !== "CONFLICTS_BASELINE" &&
    input.starterStatus === "STARTER_STABLE" &&
    !input.gameStatusBad &&
    !(
      input.marketProbChangePp != null &&
      input.marketProbChangePp <= -ADVERSE_DROP_PP
    )
  ) {
    return {
      classification: "FINAL_OBSERVE",
      reasons: [
        `currentValueEdge > ${OBSERVE_MIN_VE}`,
        "Odds 정상 매칭",
        "STARTER_STABLE",
        "경기 상태 정상",
        "ADVERSE 5%p 이상 아님",
        "단폴 최종 관찰 후보 (확정 추천·수익 보장 아님)",
      ],
    };
  }

  return {
    classification: "FINAL_HOLD",
    reasons: hold.length > 0 ? hold : ["관찰 조건 미충족 — HOLD 유지"],
  };
}

type FinalGame = {
  gameId: string;
  match: string;
  baselinePick: string | null;
  sourceClassification: string;
  carriedForward: boolean;
  latestBestOdds: number | null;
  latestMarketProbability: number | null;
  currentValueEdge: number | null;
  modelProbabilityUnchanged: number | null;
  initialBestOdds: number | null;
  initialMarketProbability: number | null;
  marketProbabilityChangePp: number | null;
  oddsMoveNote: string | null;
  pitcherDirection: PitcherDirection;
  starterStatus: StarterStatus;
  previousPitchers: { home: string | null; away: string | null };
  latestPitchers: { home: string | null; away: string | null };
  eraChanged: boolean | null;
  whipChanged: boolean | null;
  previousEraWhip: {
    homeEra: number | null;
    awayEra: number | null;
    homeWhip: number | null;
    awayWhip: number | null;
  };
  latestEraWhip: {
    homeEra: number | null;
    awayEra: number | null;
    homeWhip: number | null;
    awayWhip: number | null;
  };
  lineupStatus: LineupStatus;
  homeLineupCount: number | null;
  awayLineupCount: number | null;
  gameStatus: string | null;
  startTimeChanged: boolean | null;
  previousCommenceTimeUtc: string | null;
  latestCommenceTimeUtc: string | null;
  confidence: number | null;
  missingData: string[];
  matchStatus: MatchStatus | null;
  dataQuality: string | null;
  classification: FinalClass;
  classificationReasons: string[];
  parlaysBuilt: false;
  predictionSnapshotSaved: false;
  note: string;
};

function fingerprint(games: FinalGame[]): string {
  return JSON.stringify(
    games.map((g) => ({
      gameId: g.gameId,
      classification: g.classification,
      latestBestOdds: g.latestBestOdds,
      currentValueEdge: g.currentValueEdge,
      starterStatus: g.starterStatus,
      lineupStatus: g.lineupStatus,
      latestPitchers: g.latestPitchers,
      eraChanged: g.eraChanged,
      whipChanged: g.whipChanged,
      gameStatus: g.gameStatus,
    })),
  );
}

async function main() {
  console.log(`=== MLB Final Observation Lines (${TARGET_DATE_KST} KST) ===`);
  console.log("Engine 미재실행. 단폴 관찰만. 스냅샷 미저장.\n");

  const recheckRaw = JSON.parse(await readFile(RECHECK_PATH, "utf8"));
  const pitcherRaw = JSON.parse(await readFile(PITCHER_REVIEW_PATH, "utf8"));
  const watchRaw = JSON.parse(await readFile(WATCHLIST_PATH, "utf8"));

  const allRecheck = loadRecheckGames(recheckRaw);
  const pitcherMap = loadPitcherReviews(pitcherRaw);
  const missingMap = loadWatchMissing(watchRaw);

  const holdGames = allRecheck.filter((g) => g.classification === "HOLD");
  const yankeesDrop = allRecheck.filter(
    (g) =>
      g.classification === "DROP" &&
      (g.baselinePick?.includes("Yankees") ||
        g.match.includes("Yankees")),
  );

  if (holdGames.some((g) => g.match.includes("Brewers"))) {
    throw new Error("Brewers가 HOLD 대상에 포함됨 — 제외되어야 함");
  }

  const fetchedAt = new Date().toISOString();

  // 1) Odds 재조회
  const provider = getOddsProvider();
  const resolved = await resolveSportKeysForLeagues(provider, {
    baseball: ["MLB"],
    football: [],
  });
  const mlb = resolved.find((r) => r.league === "MLB");
  if (!mlb) throw new Error("MLB sport key 미해결");

  const dayStart = new Date(`${TARGET_DATE_KST}T00:00:00+09:00`);
  const dayEnd = new Date(`${TARGET_DATE_KST}T24:00:00+09:00`);
  const oddsResult = await provider.getOdds({
    sportKey: mlb.sportKey,
    regions: "eu",
    markets: "h2h",
    commenceTimeFrom: dayStart.toISOString().replace(".000Z", "Z"),
    commenceTimeTo: dayEnd.toISOString().replace(".000Z", "Z"),
  });
  const oddsForDate = oddsResult.events.filter(
    (e) => instantToKst(e.commenceTime)?.date === TARGET_DATE_KST,
  );

  // 2) Stats API schedule (probable + lineups) 1회
  const scheduleLive = await fetchScheduleLive();

  // 3) HOLD 경기 처리 + 필요 시 시즌 ERA/WHIP
  const finals: FinalGame[] = [];

  for (const game of holdGames) {
    const stored = pitcherMap.get(game.gameId);
    const live = findScheduleGame(scheduleLive, game.homeTeam, game.awayTeam);

    let homeLive: LivePitcher = {
      id: null,
      fullName: null,
      seasonEra: null,
      seasonWhip: null,
    };
    let awayLive: LivePitcher = {
      id: null,
      fullName: null,
      seasonEra: null,
      seasonWhip: null,
    };
    let lineupStatus: LineupStatus = "LINEUP_NOT_PUBLISHED";
    let homeLineupCount: number | null = null;
    let awayLineupCount: number | null = null;
    let gameStatus: string | null = null;
    let latestCommence: string | null = null;
    let startTimeChanged: boolean | null = null;

    if (live) {
      homeLive = { ...live.homePitcher };
      awayLive = { ...live.awayPitcher };
      homeLineupCount = live.homeLineupCount;
      awayLineupCount = live.awayLineupCount;
      lineupStatus = classifyLineup(live.homeLineupCount, live.awayLineupCount);
      gameStatus = live.detailedState;
      latestCommence = live.commenceTimeUtc;
      if (game.commenceTimeUtc && live.commenceTimeUtc) {
        const prev = Date.parse(game.commenceTimeUtc);
        const next = Date.parse(live.commenceTimeUtc);
        startTimeChanged =
          Number.isFinite(prev) &&
          Number.isFinite(next) &&
          Math.abs(prev - next) > 5 * 60 * 1000;
      }
      if (homeLive.id != null) {
        const s = await loadSeasonPitching(homeLive.id);
        homeLive.seasonEra = s.era;
        homeLive.seasonWhip = s.whip;
      }
      if (awayLive.id != null) {
        const s = await loadSeasonPitching(awayLive.id);
        awayLive.seasonEra = s.era;
        awayLive.seasonWhip = s.whip;
      }
    }

    const starterStatus = classifyStarter(
      stored?.home.name ?? null,
      stored?.away.name ?? null,
      homeLive.fullName,
      awayLive.fullName,
    );

    const eraChanged =
      stored &&
      homeLive.seasonEra != null &&
      awayLive.seasonEra != null &&
      stored.home.seasonEra != null &&
      stored.away.seasonEra != null
        ? stored.home.seasonEra !== homeLive.seasonEra ||
          stored.away.seasonEra !== awayLive.seasonEra
        : null;
    const whipChanged =
      stored &&
      homeLive.seasonWhip != null &&
      awayLive.seasonWhip != null &&
      stored.home.seasonWhip != null &&
      stored.away.seasonWhip != null
        ? stored.home.seasonWhip !== homeLive.seasonWhip ||
          stored.away.seasonWhip !== awayLive.seasonWhip
        : null;

    const commenceMs = game.startTimeKst
      ? Date.parse(`${TARGET_DATE_KST}T${game.startTimeKst.slice(0, 5)}:00+09:00`)
      : null;
    const candidates = findOddsCandidates(
      toGameData(game),
      oddsForDate,
      Number.isFinite(commenceMs) ? commenceMs : null,
    );
    const match = classifyMatch(candidates);

    let latestBestOdds: number | null = null;
    let latestMarketProbability: number | null = null;
    let dataQuality: string | null = null;

    if (match.status === "matched" && match.odds && game.pickSide) {
      const m = marketForPick(match.odds, game.pickSide);
      latestBestOdds = m.bestOdds;
      latestMarketProbability = m.marketProbability;
      dataQuality = m.dataQuality;
    }

    const currentValueEdge =
      game.modelProbabilityUnchanged != null &&
      latestMarketProbability != null
        ? round1(game.modelProbabilityUnchanged - latestMarketProbability)
        : null;

    const marketProbabilityChangePp =
      game.initialMarketProbability != null &&
      latestMarketProbability != null
        ? round1(latestMarketProbability - game.initialMarketProbability)
        : null;

    const adverseRecent =
      marketProbabilityChangePp != null && marketProbabilityChangePp <= -2;

    const classified = classifyFinal({
      currentValueEdge,
      matchStatus: match.status,
      dataQuality,
      pitcherDirection: game.pitcherDirection,
      starterStatus,
      gameStatusBad: isCancelledOrPostponed(gameStatus),
      marketProbChangePp: marketProbabilityChangePp,
      confidence: game.confidence,
      lineupStatus,
      keyMissing: (missingMap.get(game.gameId) ?? game.missingData).length > 0,
      adverseRecent,
    });

    finals.push({
      gameId: game.gameId,
      match: game.match,
      baselinePick: game.baselinePick,
      sourceClassification: "HOLD",
      carriedForward: false,
      latestBestOdds,
      latestMarketProbability,
      currentValueEdge,
      modelProbabilityUnchanged: game.modelProbabilityUnchanged,
      initialBestOdds: game.initialBestOdds,
      initialMarketProbability: game.initialMarketProbability,
      marketProbabilityChangePp,
      oddsMoveNote:
        marketProbabilityChangePp == null
          ? null
          : marketProbabilityChangePp <= -ADVERSE_DROP_PP
            ? `ADVERSE_${ADVERSE_DROP_PP}PP_PLUS`
            : marketProbabilityChangePp <= -2
              ? "ADVERSE_RECENT"
              : marketProbabilityChangePp >= 2
                ? "SUPPORTIVE"
                : "NEUTRAL",
      pitcherDirection: game.pitcherDirection,
      starterStatus,
      previousPitchers: {
        home: stored?.home.name ?? null,
        away: stored?.away.name ?? null,
      },
      latestPitchers: {
        home: homeLive.fullName,
        away: awayLive.fullName,
      },
      eraChanged,
      whipChanged,
      previousEraWhip: {
        homeEra: stored?.home.seasonEra ?? null,
        awayEra: stored?.away.seasonEra ?? null,
        homeWhip: stored?.home.seasonWhip ?? null,
        awayWhip: stored?.away.seasonWhip ?? null,
      },
      latestEraWhip: {
        homeEra: homeLive.seasonEra,
        awayEra: awayLive.seasonEra,
        homeWhip: homeLive.seasonWhip,
        awayWhip: awayLive.seasonWhip,
      },
      lineupStatus,
      homeLineupCount,
      awayLineupCount,
      gameStatus,
      startTimeChanged,
      previousCommenceTimeUtc: game.commenceTimeUtc,
      latestCommenceTimeUtc: latestCommence,
      confidence: game.confidence,
      missingData: missingMap.get(game.gameId) ?? game.missingData,
      matchStatus: match.status,
      dataQuality,
      classification: classified.classification,
      classificationReasons: classified.reasons,
      parlaysBuilt: false,
      predictionSnapshotSaved: false,
      note:
        "단폴 최종 관찰 분류. 확정 적중·무조건 추천·수익 보장·안전한 베팅이 아니다. 모델 확률·Baseline pick 미변경.",
    });
  }

  // Yankees DROP 유지 (재분류 대상 아님 — 상태만 기록)
  for (const game of yankeesDrop) {
    finals.push({
      gameId: game.gameId,
      match: game.match,
      baselinePick: game.baselinePick,
      sourceClassification: "DROP",
      carriedForward: true,
      latestBestOdds: null,
      latestMarketProbability: null,
      currentValueEdge: null,
      modelProbabilityUnchanged: game.modelProbabilityUnchanged,
      initialBestOdds: game.initialBestOdds,
      initialMarketProbability: game.initialMarketProbability,
      marketProbabilityChangePp: null,
      oddsMoveNote: null,
      pitcherDirection: game.pitcherDirection,
      starterStatus: "STARTER_UNKNOWN",
      previousPitchers: {
        home: pitcherMap.get(game.gameId)?.home.name ?? null,
        away: pitcherMap.get(game.gameId)?.away.name ?? null,
      },
      latestPitchers: { home: null, away: null },
      eraChanged: null,
      whipChanged: null,
      previousEraWhip: {
        homeEra: pitcherMap.get(game.gameId)?.home.seasonEra ?? null,
        awayEra: pitcherMap.get(game.gameId)?.away.seasonEra ?? null,
        homeWhip: pitcherMap.get(game.gameId)?.home.seasonWhip ?? null,
        awayWhip: pitcherMap.get(game.gameId)?.away.seasonWhip ?? null,
      },
      latestEraWhip: {
        homeEra: null,
        awayEra: null,
        homeWhip: null,
        awayWhip: null,
      },
      lineupStatus: "LINEUP_NOT_PUBLISHED",
      homeLineupCount: null,
      awayLineupCount: null,
      gameStatus: null,
      startTimeChanged: null,
      previousCommenceTimeUtc: game.commenceTimeUtc,
      latestCommenceTimeUtc: null,
      confidence: game.confidence,
      missingData: game.missingData,
      matchStatus: null,
      dataQuality: null,
      classification: "FINAL_DROP",
      classificationReasons: [
        "이전 line-recheck DROP 유지 (투수 CONFLICTS_BASELINE)",
        "HOLD 재조회 대상 아님",
      ],
      parlaysBuilt: false,
      predictionSnapshotSaved: false,
      note: "Yankees DROP 상태 유지. 최종 관찰 라인 아님.",
    });
  }

  finals.sort((a, b) => a.gameId.localeCompare(b.gameId));

  const firstFp = fingerprint(finals);
  const secondFp = fingerprint(finals);
  const deterministic = firstFp === secondFp;

  let existingHistory: unknown[] = [];
  let deduped = false;
  try {
    const prev = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    const root = asRecord(prev);
    const history = Array.isArray(root?.history) ? root.history : [];
    existingHistory = history;
    const last = asRecord(history[history.length - 1]);
    if (last && asString(last.fingerprint) === firstFp) {
      deduped = true;
    }
  } catch {
    deduped = false;
    existingHistory = [];
  }

  const observe = finals.filter((g) => g.classification === "FINAL_OBSERVE");
  const hold = finals.filter((g) => g.classification === "FINAL_HOLD");
  const drop = finals.filter((g) => g.classification === "FINAL_DROP");

  const snapshot = {
    fetchedAt,
    fingerprint: firstFp,
    games: finals,
  };
  const history = deduped ? existingHistory : [...existingHistory, snapshot];

  const output = {
    meta: {
      version: "mlb-final-lines-v1",
      generatedAt: fetchedAt,
      targetDateKst: TARGET_DATE_KST,
      kind: "mlb-final-observation-lines",
      finalBettingConfirmation: false,
      engineRerun: false,
      baselinePickChanged: false,
      modelProbabilityChanged: false,
      weightsChanged: false,
      confidenceChanged: false,
      parlaysBuilt: false,
      predictionSnapshotSaved: false,
      sportsDataIoUsed: false,
      mlbComHtmlCrawled: false,
      inputs: {
        lineRecheck: path.relative(process.cwd(), RECHECK_PATH).replace(/\\/g, "/"),
        pitcherReview: path
          .relative(process.cwd(), PITCHER_REVIEW_PATH)
          .replace(/\\/g, "/"),
        watchlist: path.relative(process.cwd(), WATCHLIST_PATH).replace(/\\/g, "/"),
      },
      legalUse: {
        oddsSource: "The Odds API (정식 구독)",
        pitcherLineupSource: "MLB Stats API (내부 연구용만)",
        mlbStatsApiCommercialUse: "미확인",
        runtimeConnected: false,
        publicUiConnected: false,
        guaranteeLanguageForbidden: true,
        note:
          "FINAL_OBSERVE는 현재 데이터에서 최종 관찰 가능한 단폴 후보일 뿐이다. 확정 적중·무조건 추천·수익 보장·안전한 베팅이 아니다.",
      },
      rules: {
        observeMinValueEdge: OBSERVE_MIN_VE,
        adverseDropPp: ADVERSE_DROP_PP,
        classificationPriority: ["FINAL_DROP", "FINAL_HOLD", "FINAL_OBSERVE"],
        singlesOnly: true,
      },
      snapshotDeduped: deduped,
      deterministic,
    },
    apiUsage: {
      odds: {
        sportKey: mlb.sportKey,
        sportTitle: mlb.title,
        cached: oddsResult.cached === true,
        requestsRemaining: oddsResult.usage?.requestsRemaining ?? null,
        requestsUsed: oddsResult.usage?.requestsUsed ?? null,
        requestsLast: oddsResult.usage?.requestsLast ?? null,
        eventsForDate: oddsForDate.length,
      },
      mlbStatsApi: {
        calls: statsApiCalls,
        cacheEntries: memoryCache.size,
        scheduleDateUs: SCHEDULE_DATE_US,
        commercialUse: "미확인 — 내부 연구 전용",
      },
    },
    summary: {
      holdTargets: holdGames.length,
      yankeesDropCarried: yankeesDrop.length,
      FINAL_OBSERVE: observe.length,
      FINAL_HOLD: hold.length,
      FINAL_DROP: drop.length,
      observeGames: observe.map((g) => ({
        gameId: g.gameId,
        match: g.match,
        baselinePick: g.baselinePick,
        currentValueEdge: g.currentValueEdge,
        latestBestOdds: g.latestBestOdds,
      })),
      holdGames: hold.map((g) => ({
        gameId: g.gameId,
        match: g.match,
        reasons: g.classificationReasons,
      })),
      dropGames: drop.map((g) => ({
        gameId: g.gameId,
        match: g.match,
        reasons: g.classificationReasons,
        carriedForward: g.carriedForward,
      })),
      emptyObserveMessage:
        observe.length === 0
          ? "오늘은 조건을 충족한 MLB 라인이 없습니다."
          : null,
      parlaysBuilt: false,
      predictionSnapshotSaved: false,
    },
    games: finals,
    history,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`최신 조회 시각: ${fetchedAt}`);
  console.log(
    `OBSERVE ${observe.length} / HOLD ${hold.length} / DROP ${drop.length}` +
      (deduped ? " (중복 저장 생략)" : ""),
  );
  if (observe.length === 0) {
    console.log("오늘은 조건을 충족한 MLB 라인이 없습니다.");
  }
  console.log("");
  for (const g of finals) {
    console.log(
      `${g.match} | ${g.classification}` +
        ` | odds ${g.latestBestOdds ?? "n/a"} VE ${g.currentValueEdge ?? "n/a"}` +
        ` | starter=${g.starterStatus} lineup=${g.lineupStatus}` +
        (g.carriedForward ? " [carried]" : ""),
    );
  }
  console.log(
    `\nAPI Odds remaining=${oddsResult.usage?.requestsRemaining ?? "n/a"} cached=${oddsResult.cached}`,
  );
  console.log(`API Stats calls=${statsApiCalls} cache=${memoryCache.size}`);
  console.log(`조합 생성: 없음 (단폴만)`);
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message.replace(/apiKey=[^&\s]+/gi, "apiKey=***"));
  process.exitCode = 1;
});
