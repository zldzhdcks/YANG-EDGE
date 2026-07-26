/**
 * 2026-07-27 KST MLB Watchlist 5경기 — 최신 배당 재조회 + 2차 분류.
 *
 * 목적:
 *   저장 Baseline·투수 방향과 함께 최신 Odds를 비교해
 *   KEEP_REVIEW / HOLD / DROP 후보로만 분류한다.
 *
 * 절대 금지:
 *   - EDGE Engine 재실행 / weights / Confidence / 모델 확률 / Baseline pick 변경
 *   - Watchlist 원본·추천 등급 규칙·/games UI·스냅샷·가계부 수정
 *   - SportsDataIO Scrambled / MLB.com 크롤링
 *   - 실제 베팅·수익 보장 표현
 *
 * 데이터:
 *   - 최신 배당: The Odds API만 (정식 구독)
 *   - 투수 방향: pitcher-review JSON (내부 연구용 경고만)
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/recheck-mlb-betting-lines.ts
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
  type OddsUsageMeta,
} from "../src/lib/odds";
import type { GameData } from "../src/types/game";

const TARGET_DATE_KST = "2026-07-27";
const COMMENCE_TOLERANCE_MS = 3 * 60 * 60 * 1000;
const MARKET_MOVE_PP = 2;
const OUTPUT_VERSION = "mlb-line-recheck-v1";

const WATCHLIST_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb.json`,
);
const PITCHER_REVIEW_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-pitcher-review.json`,
);
const FILTER_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-betting-line-filter.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-line-recheck.json`,
);

type Side = "home" | "away";
type PitcherDirection =
  | "SUPPORTS_BASELINE"
  | "CONFLICTS_BASELINE"
  | "MIXED"
  | "INSUFFICIENT"
  | "UNKNOWN";
type OddsMove =
  | "SUPPORTIVE_MOVE"
  | "NEUTRAL_MOVE"
  | "ADVERSE_MOVE"
  | "UNKNOWN";
type RecheckClass = "KEEP_REVIEW" | "HOLD" | "DROP";
type MatchStatus = "matched" | "ambiguous" | "failed";

type WatchGame = {
  gameId: string;
  startTimeKst: string | null;
  homeTeam: string;
  awayTeam: string;
  baselinePick: string | null;
  baselineOdds: number | null;
  modelProbability: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  edgeScore: number | null;
  confidence: number | null;
  dataAvailability: number | null;
  currentClassification: string | null;
  missingData: string[];
  warnings: string[];
  recheckReasons: string[];
  priority: string | null;
};

type FilterLine = {
  gameId: string;
  pickTeamId: Side | null;
  bestOdds: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  confidence: number | null;
  classification: string | null;
};

type PitcherReviewGame = {
  gameId: string;
  direction: PitcherDirection;
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
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function loadWatchlist(raw: unknown): WatchGame[] {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  return games
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) return null;
      const gameId = asString(row.gameId);
      const homeTeam = asString(row.homeTeam);
      const awayTeam = asString(row.awayTeam);
      if (!gameId || !homeTeam || !awayTeam) return null;
      return {
        gameId,
        startTimeKst: asString(row.startTimeKst),
        homeTeam,
        awayTeam,
        baselinePick: asString(row.baselinePick),
        baselineOdds: asNumber(row.baselineOdds),
        modelProbability: asNumber(row.modelProbability),
        marketProbability: asNumber(row.marketProbability),
        valueEdge: asNumber(row.valueEdge),
        edgeScore: asNumber(row.edgeScore),
        confidence: asNumber(row.confidence),
        dataAvailability: asNumber(row.dataAvailability),
        currentClassification: asString(row.currentClassification),
        missingData: Array.isArray(row.missingData)
          ? row.missingData.filter((x): x is string => typeof x === "string")
          : [],
        warnings: Array.isArray(row.warnings)
          ? row.warnings.filter((x): x is string => typeof x === "string")
          : [],
        recheckReasons: Array.isArray(row.recheckReasons)
          ? row.recheckReasons.filter((x): x is string => typeof x === "string")
          : [],
        priority: asString(row.priority),
      } satisfies WatchGame;
    })
    .filter((g): g is WatchGame => g != null);
}

function loadFilterLines(raw: unknown): Map<string, FilterLine> {
  const root = asRecord(raw);
  const lines = Array.isArray(root?.lines) ? root.lines : [];
  const map = new Map<string, FilterLine>();
  for (const entry of lines) {
    const row = asRecord(entry);
    const gameId = asString(row?.gameId);
    if (!row || !gameId) continue;
    const pickTeamId = asString(row.pickTeamId);
    map.set(gameId, {
      gameId,
      pickTeamId:
        pickTeamId === "home" || pickTeamId === "away"
          ? (pickTeamId as Side)
          : null,
      bestOdds: asNumber(row.bestOdds),
      marketProbability: asNumber(row.marketProbability),
      valueEdge: asNumber(row.valueEdge),
      confidence: asNumber(row.confidence),
      classification: asString(row.classification),
    });
  }
  return map;
}

function loadPitcherDirections(raw: unknown): Map<string, PitcherDirection> {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  const map = new Map<string, PitcherDirection>();
  for (const entry of games) {
    const row = asRecord(entry);
    const gameId = asString(row?.gameId);
    const direction = asString(row?.direction);
    if (!gameId) continue;
    if (
      direction === "SUPPORTS_BASELINE" ||
      direction === "CONFLICTS_BASELINE" ||
      direction === "MIXED" ||
      direction === "INSUFFICIENT"
    ) {
      map.set(gameId, direction);
    } else {
      map.set(gameId, "UNKNOWN");
    }
  }
  return map;
}

function resolvePickSide(
  watch: WatchGame,
  filter: FilterLine | undefined,
): Side | null {
  if (filter?.pickTeamId) return filter.pickTeamId;
  if (!watch.baselinePick) return null;
  if (watch.baselinePick === watch.homeTeam) return "home";
  if (watch.baselinePick === watch.awayTeam) return "away";
  return null;
}

function toGameData(watch: WatchGame): GameData {
  return {
    id: watch.gameId,
    sport: "baseball",
    league: "MLB",
    homeTeam: watch.homeTeam,
    awayTeam: watch.awayTeam,
    startTime: watch.startTimeKst ?? "TBD",
    date: TARGET_DATE_KST,
    aiAnalysisAvailable: false,
    externalProvider: "api-baseball",
  };
}

function estimateCommenceMs(watch: WatchGame): number | null {
  const time =
    watch.startTimeKst && /^\d{2}:\d{2}/.test(watch.startTimeKst)
      ? watch.startTimeKst.slice(0, 5)
      : null;
  if (!time) return null;
  const ms = Date.parse(`${TARGET_DATE_KST}T${time}:00+09:00`);
  return Number.isFinite(ms) ? ms : null;
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

function isSameKstDate(odds: OddsData): boolean {
  const kst = instantToKst(odds.commenceTime);
  return kst?.date === TARGET_DATE_KST;
}

type OddsCandidate = { odds: OddsData; confidence: number };

/** 안전 매칭: 날짜 동일 + 홈↔홈/원정↔원정 + ±3h. 복수면 AMBIGUOUS. */
function findOddsCandidates(
  game: GameData,
  oddsList: OddsData[],
  commenceMs: number | null,
): OddsCandidate[] {
  const hits: OddsCandidate[] = [];
  for (const odds of oddsList) {
    if (!isSameKstDate(odds)) continue;
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

function classifyMatch(candidates: OddsCandidate[]): {
  status: MatchStatus;
  odds: OddsData | null;
  confidence: number | null;
  candidateCount: number;
} {
  if (candidates.length === 0) {
    return { status: "failed", odds: null, confidence: null, candidateCount: 0 };
  }
  if (candidates.length > 1) {
    // 최고 confidence가 유일하면 허용, 동률 복수면 AMBIGUOUS
    const top = candidates[0].confidence;
    const tied = candidates.filter((c) => c.confidence === top);
    if (tied.length > 1) {
      return {
        status: "ambiguous",
        odds: null,
        confidence: top,
        candidateCount: candidates.length,
      };
    }
  }
  return {
    status: "matched",
    odds: candidates[0].odds,
    confidence: candidates[0].confidence,
    candidateCount: candidates.length,
  };
}

function pickBestOdds(odds: OddsData, side: Side): number | null {
  return side === "home" ? odds.bestHomeOdds : odds.bestAwayOdds;
}

function marketProbPercent(
  odds: OddsData,
  side: Side,
): {
  percent: number | null;
  dataQuality: string;
  bookmakerCount: number;
} {
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
  return {
    percent: unit == null ? null : Math.round(unit * 100),
    dataQuality: comparison.dataQuality,
    bookmakerCount: odds.bookmakers.length,
  };
}

function classifyOddsMove(
  initialMarketProb: number | null,
  currentMarketProb: number | null,
): OddsMove {
  if (initialMarketProb == null || currentMarketProb == null) return "UNKNOWN";
  const delta = currentMarketProb - initialMarketProb;
  if (delta >= MARKET_MOVE_PP) return "SUPPORTIVE_MOVE";
  if (delta <= -MARKET_MOVE_PP) return "ADVERSE_MOVE";
  return "NEUTRAL_MOVE";
}

function hasKeyMissingData(watch: WatchGame): boolean {
  if (watch.missingData.length > 0) return true;
  const keyReasons = new Set([
    "STARTING_PITCHER_REQUIRED",
    "LINEUP_REQUIRED",
    "INJURY_STATUS_REQUIRED",
    "STANDINGS_UNAVAILABLE",
  ]);
  return watch.recheckReasons.some((r) => keyReasons.has(r));
}

function classifyRecheck(input: {
  currentValueEdge: number | null;
  matchStatus: MatchStatus;
  dataQuality: string | null;
  pitcherDirection: PitcherDirection;
  confidence: number | null;
  oddsMove: OddsMove;
  dataAvailability: number | null;
  keyMissing: boolean;
  gameStatusIssue: boolean;
}): { classification: RecheckClass; reasons: string[] } {
  const reasons: string[] = [];

  // DROP 우선
  if (input.gameStatusIssue) {
    reasons.push("경기 상태 변경·취소·연기 가능성");
  }
  if (input.matchStatus === "failed") {
    reasons.push("Odds 매칭 실패");
  }
  if (input.matchStatus === "ambiguous") {
    reasons.push("Odds 매칭 AMBIGUOUS (복수 후보)");
  }
  if (
    input.dataQuality != null &&
    input.dataQuality !== "complete" &&
    input.matchStatus === "matched"
  ) {
    reasons.push(`배당 데이터 품질 불충분 (${input.dataQuality})`);
  }
  if (input.pitcherDirection === "CONFLICTS_BASELINE") {
    reasons.push("투수 방향 CONFLICTS_BASELINE (내부 연구 경고)");
  }
  if (input.currentValueEdge != null && input.currentValueEdge <= 0) {
    reasons.push(`currentValueEdge <= 0 (${input.currentValueEdge})`);
  }
  if (input.currentValueEdge == null && input.matchStatus !== "matched") {
    // already covered by match fail
  } else if (input.currentValueEdge == null) {
    reasons.push("currentValueEdge 산출 불가");
  }

  const dropReasons = [...reasons];
  if (dropReasons.length > 0) {
    return { classification: "DROP", reasons: dropReasons };
  }

  // HOLD
  const holdReasons: string[] = [];
  if (input.pitcherDirection === "MIXED") {
    holdReasons.push("투수 방향 MIXED");
  }
  if (input.confidence != null && input.confidence < 50) {
    holdReasons.push(`Confidence < 50 (${input.confidence})`);
  }
  if (input.oddsMove === "ADVERSE_MOVE") {
    holdReasons.push("ADVERSE_MOVE (시장 확률 2%p+ 하락)");
  }
  if (input.dataAvailability === 0.7) {
    holdReasons.push("dataAvailability = 0.70");
  }
  if (input.keyMissing) {
    holdReasons.push("핵심 데이터 여전히 누락");
  }

  if (
    input.currentValueEdge != null &&
    input.currentValueEdge > 0 &&
    holdReasons.length > 0
  ) {
    return { classification: "HOLD", reasons: holdReasons };
  }

  // KEEP_REVIEW
  if (
    input.currentValueEdge != null &&
    input.currentValueEdge > 0 &&
    input.matchStatus === "matched" &&
    input.dataQuality === "complete" &&
    input.pitcherDirection !== "CONFLICTS_BASELINE"
  ) {
    return {
      classification: "KEEP_REVIEW",
      reasons: [
        "currentValueEdge > 0",
        "Odds 매칭 정상",
        "배당 데이터 품질 정상",
        `투수 방향 ${input.pitcherDirection} (CONFLICT 아님)`,
      ],
    };
  }

  return {
    classification: "DROP",
    reasons: reasons.length > 0 ? reasons : ["분류 조건 미충족"],
  };
}

function formatKstIso(ms: number): string {
  const kst = instantToKst(new Date(ms));
  if (!kst) return new Date(ms).toISOString();
  return `${kst.date} ${kst.time} KST`;
}

function recommendRecheck(commenceMs: number | null, nowMs: number) {
  if (commenceMs == null) {
    return {
      hoursUntilStart: null,
      recommendedRecheckAtKst: null,
      urgency: "unknown" as const,
      message: "시작 시각 미확정 — 즉시 일정 확인",
    };
  }
  const hoursUntil = (commenceMs - nowMs) / (60 * 60 * 1000);
  if (hoursUntil < 0) {
    return {
      hoursUntilStart: round1(hoursUntil),
      recommendedRecheckAtKst: formatKstIso(nowMs),
      urgency: "immediate" as const,
      message: "경기 시작 시각 경과 — 즉시 재확인 필요",
    };
  }
  if (hoursUntil > 6) {
    const at = commenceMs - 3 * 60 * 60 * 1000;
    return {
      hoursUntilStart: round1(hoursUntil),
      recommendedRecheckAtKst: formatKstIso(at),
      urgency: "before-3h" as const,
      message: "경기 3시간 전 재확인",
    };
  }
  if (hoursUntil >= 2) {
    const at = commenceMs - 90 * 60 * 1000;
    return {
      hoursUntilStart: round1(hoursUntil),
      recommendedRecheckAtKst: formatKstIso(at),
      urgency: "before-90m" as const,
      message: "경기 90분 전 재확인",
    };
  }
  return {
    hoursUntilStart: round1(hoursUntil),
    recommendedRecheckAtKst: formatKstIso(nowMs),
    urgency: "immediate" as const,
    message: "2시간 미만 — 즉시 재확인 필요",
  };
}

type GameRecheck = {
  gameId: string;
  match: string;
  startTimeKst: string | null;
  commenceTimeUtc: string | null;
  baselinePick: string | null;
  pickSide: Side | null;
  initialBestOdds: number | null;
  currentBestOdds: number | null;
  oddsChangeRate: number | null;
  initialMarketProbability: number | null;
  currentMarketProbability: number | null;
  marketProbabilityChangePp: number | null;
  initialValueEdge: number | null;
  currentValueEdge: number | null;
  modelProbabilityUnchanged: number | null;
  oddsMove: OddsMove;
  pitcherDirection: PitcherDirection;
  confidence: number | null;
  dataAvailability: number | null;
  missingData: string[];
  matchStatus: MatchStatus;
  matchConfidence: number | null;
  candidateCount: number;
  bookmakerCount: number | null;
  dataQuality: string | null;
  fetchedAt: string;
  classification: RecheckClass;
  classificationReasons: string[];
  recheck: ReturnType<typeof recommendRecheck>;
  note: string;
};

function buildGameRecheck(
  watch: WatchGame,
  filter: FilterLine | undefined,
  pitcherDirection: PitcherDirection,
  oddsList: OddsData[],
  fetchedAt: string,
  nowMs: number,
): GameRecheck {
  const pickSide = resolvePickSide(watch, filter);
  const game = toGameData(watch);
  const commenceMs = estimateCommenceMs(watch);
  const candidates = findOddsCandidates(game, oddsList, commenceMs);
  const match = classifyMatch(candidates);

  const initialBestOdds = filter?.bestOdds ?? watch.baselineOdds;
  const initialMarketProbability =
    filter?.marketProbability ?? watch.marketProbability;
  const initialValueEdge = filter?.valueEdge ?? watch.valueEdge;
  const modelProbability = watch.modelProbability;
  const confidence = filter?.confidence ?? watch.confidence;

  let currentBestOdds: number | null = null;
  let currentMarketProbability: number | null = null;
  let dataQuality: string | null = null;
  let bookmakerCount: number | null = null;
  let commenceTimeUtc: string | null = null;
  let gameStatusIssue = false;

  if (match.status === "matched" && match.odds && pickSide) {
    currentBestOdds = pickBestOdds(match.odds, pickSide);
    const market = marketProbPercent(match.odds, pickSide);
    currentMarketProbability = market.percent;
    dataQuality = market.dataQuality;
    bookmakerCount = market.bookmakerCount;
    commenceTimeUtc = match.odds.commenceTime;
  } else if (match.status === "matched" && match.odds) {
    dataQuality = "incomplete-odds";
    bookmakerCount = match.odds.bookmakers.length;
    commenceTimeUtc = match.odds.commenceTime;
  }

  // 시작 시각이 지났고 매칭 실패면 상태 변경 가능성 표시 (확정 판정 아님)
  if (
    commenceMs != null &&
    nowMs > commenceMs + 30 * 60 * 1000 &&
    match.status === "failed"
  ) {
    gameStatusIssue = true;
  }

  const currentValueEdge =
    modelProbability != null && currentMarketProbability != null
      ? round1(modelProbability - currentMarketProbability)
      : null;

  const marketProbabilityChangePp =
    initialMarketProbability != null && currentMarketProbability != null
      ? round1(currentMarketProbability - initialMarketProbability)
      : null;

  const oddsChangeRate =
    initialBestOdds != null &&
    initialBestOdds > 0 &&
    currentBestOdds != null
      ? round4((currentBestOdds - initialBestOdds) / initialBestOdds)
      : null;

  const oddsMove =
    match.status !== "matched"
      ? "UNKNOWN"
      : classifyOddsMove(initialMarketProbability, currentMarketProbability);

  const classified = classifyRecheck({
    currentValueEdge,
    matchStatus: match.status,
    dataQuality,
    pitcherDirection,
    confidence,
    oddsMove,
    dataAvailability: watch.dataAvailability,
    keyMissing: hasKeyMissingData(watch),
    gameStatusIssue,
  });

  const recheck = recommendRecheck(commenceMs, nowMs);

  return {
    gameId: watch.gameId,
    match: `${watch.awayTeam} @ ${watch.homeTeam}`,
    startTimeKst: watch.startTimeKst,
    commenceTimeUtc,
    baselinePick: watch.baselinePick,
    pickSide,
    initialBestOdds,
    currentBestOdds,
    oddsChangeRate,
    initialMarketProbability,
    currentMarketProbability,
    marketProbabilityChangePp,
    initialValueEdge,
    currentValueEdge,
    modelProbabilityUnchanged: modelProbability,
    oddsMove,
    pitcherDirection,
    confidence,
    dataAvailability: watch.dataAvailability,
    missingData: watch.missingData,
    matchStatus: match.status,
    matchConfidence: match.confidence,
    candidateCount: match.candidateCount,
    bookmakerCount,
    dataQuality,
    fetchedAt,
    classification: classified.classification,
    classificationReasons: classified.reasons,
    recheck,
    note:
      "최종 베팅 확정이 아니다. 모델 확률·Baseline pick·Confidence는 변경하지 않았다. 투수 방향은 내부 연구 경고로만 사용한다.",
  };
}

function oddsFingerprint(games: GameRecheck[]): string {
  return JSON.stringify(
    games.map((g) => ({
      gameId: g.gameId,
      currentBestOdds: g.currentBestOdds,
      currentMarketProbability: g.currentMarketProbability,
      currentValueEdge: g.currentValueEdge,
      oddsMove: g.oddsMove,
      classification: g.classification,
      matchStatus: g.matchStatus,
    })),
  );
}

function classificationFingerprint(games: GameRecheck[]): string {
  return JSON.stringify(
    games.map((g) => ({
      gameId: g.gameId,
      classification: g.classification,
      reasons: g.classificationReasons,
      oddsMove: g.oddsMove,
      pitcherDirection: g.pitcherDirection,
      currentValueEdge: g.currentValueEdge,
    })),
  );
}

type Snapshot = {
  fetchedAt: string;
  games: GameRecheck[];
  apiUsage: {
    sportKey: string | null;
    sportTitle: string | null;
    sportsListCached: boolean;
    oddsCached: boolean;
    requestsRemaining: number | null;
    requestsUsed: number | null;
    requestsLast: number | null;
  };
};

async function loadExisting(): Promise<{
  history: Snapshot[];
  meta: Record<string, unknown> | null;
} | null> {
  try {
    const raw = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    const root = asRecord(raw);
    if (!root) return null;
    const history = Array.isArray(root.history) ? (root.history as Snapshot[]) : [];
    return { history, meta: asRecord(root.meta) };
  } catch {
    return null;
  }
}

function usageFrom(meta: OddsUsageMeta | undefined) {
  return {
    requestsRemaining: meta?.requestsRemaining ?? null,
    requestsUsed: meta?.requestsUsed ?? null,
    requestsLast: meta?.requestsLast ?? null,
  };
}

async function main() {
  console.log(`=== MLB Line Recheck (${TARGET_DATE_KST} KST) ===`);
  console.log("Engine 미재실행. Baseline pick·모델 확률 유지. 최종 확정 아님.\n");

  const watchRaw = JSON.parse(await readFile(WATCHLIST_PATH, "utf8"));
  const pitcherRaw = JSON.parse(await readFile(PITCHER_REVIEW_PATH, "utf8"));
  const filterRaw = JSON.parse(await readFile(FILTER_PATH, "utf8"));

  const watchGames = loadWatchlist(watchRaw);
  const filterMap = loadFilterLines(filterRaw);
  const pitcherMap = loadPitcherDirections(pitcherRaw);

  // Brewers는 Watchlist에 없어야 함 (MARKET_CONFLICT)
  const brewersOnList = watchGames.some(
    (g) =>
      g.homeTeam.includes("Brewers") ||
      g.awayTeam.includes("Brewers") ||
      g.baselinePick?.includes("Brewers"),
  );
  if (brewersOnList) {
    throw new Error("Brewers가 Watchlist에 포함됨 — MARKET_CONFLICT 제외 규칙 위반");
  }

  const provider = getOddsProvider();
  const resolved = await resolveSportKeysForLeagues(provider, {
    baseball: ["MLB"],
    football: [],
  });
  const mlb = resolved.find((r) => r.league === "MLB");
  if (!mlb) {
    throw new Error("활성 Odds sport key에서 MLB를 찾지 못함");
  }

  const dayStart = new Date(`${TARGET_DATE_KST}T00:00:00+09:00`);
  const dayEnd = new Date(`${TARGET_DATE_KST}T24:00:00+09:00`);
  const oddsResult = await provider.getOdds({
    sportKey: mlb.sportKey,
    regions: "eu",
    markets: "h2h",
    commenceTimeFrom: dayStart.toISOString().replace(".000Z", "Z"),
    commenceTimeTo: dayEnd.toISOString().replace(".000Z", "Z"),
  });

  const oddsForDate = oddsResult.events.filter((e) => {
    const kst = instantToKst(e.commenceTime);
    return kst?.date === TARGET_DATE_KST;
  });

  const fetchedAt = new Date().toISOString();
  const nowMs = Date.now();

  const buildAll = () =>
    watchGames.map((w) =>
      buildGameRecheck(
        w,
        filterMap.get(w.gameId),
        pitcherMap.get(w.gameId) ?? "UNKNOWN",
        oddsForDate,
        fetchedAt,
        nowMs,
      ),
    );

  const first = buildAll();
  const second = buildAll();
  const deterministic =
    classificationFingerprint(first) === classificationFingerprint(second);

  const matchedCount = first.filter((g) => g.matchStatus === "matched").length;

  const existing = await loadExisting();
  const history: Snapshot[] = existing?.history ? [...existing.history] : [];

  const snapshot: Snapshot = {
    fetchedAt,
    games: first,
    apiUsage: {
      sportKey: mlb.sportKey,
      sportTitle: mlb.title,
      sportsListCached: true, // resolveSportKeysForLeagues 캐시 사용
      oddsCached: oddsResult.cached === true,
      ...usageFrom(oddsResult.usage),
    },
  };

  const last = history[history.length - 1];
  const sameAsLast =
    last != null &&
    oddsFingerprint(last.games) === oddsFingerprint(first) &&
    // 동일 Odds 응답이면 snapshot 중복 금지 (fetchedAt 초 단위 차이는 무시하고 fingerprint 기준)
    true;

  if (!sameAsLast) {
    history.push(snapshot);
  }

  const keep = first.filter((g) => g.classification === "KEEP_REVIEW");
  const hold = first.filter((g) => g.classification === "HOLD");
  const drop = first.filter((g) => g.classification === "DROP");

  const topValue = [...first]
    .filter((g) => g.currentValueEdge != null)
    .sort((a, b) => (b.currentValueEdge ?? -999) - (a.currentValueEdge ?? -999));

  const mostAdverse = [...first]
    .filter((g) => g.marketProbabilityChangePp != null)
    .sort(
      (a, b) =>
        (a.marketProbabilityChangePp ?? 0) - (b.marketProbabilityChangePp ?? 0),
    )[0] ?? null;

  const nextRechecks = first
    .map((g) => ({
      gameId: g.gameId,
      match: g.match,
      at: g.recheck.recommendedRecheckAtKst,
      urgency: g.recheck.urgency,
      message: g.recheck.message,
    }))
    .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));

  const output = {
    meta: {
      version: OUTPUT_VERSION,
      generatedAt: fetchedAt,
      targetDateKst: TARGET_DATE_KST,
      kind: "mlb-line-recheck",
      finalBettingConfirmation: false,
      engineRerun: false,
      baselinePickChanged: false,
      modelProbabilityChanged: false,
      weightsChanged: false,
      confidenceChanged: false,
      sportsDataIoUsed: false,
      mlbComHtmlCrawled: false,
      inputs: {
        watchlist: path.relative(process.cwd(), WATCHLIST_PATH).replace(/\\/g, "/"),
        pitcherReview: path
          .relative(process.cwd(), PITCHER_REVIEW_PATH)
          .replace(/\\/g, "/"),
        bettingLineFilter: path
          .relative(process.cwd(), FILTER_PATH)
          .replace(/\\/g, "/"),
      },
      legalUse: {
        oddsSource: "The Odds API (정식 구독)",
        pitcherStatsScope: "내부 연구용 방향 경고만",
        mlbStatsApiCommercialUse: "미확인",
        runtimeConnected: false,
        guaranteeLanguageForbidden: true,
        note:
          "최신 배당은 The Odds API만 사용한다. 투수 비교는 내부 연구 경고이며 수익을 보장하지 않는다. 최종 베팅 확정이 아니다.",
      },
      rules: {
        commenceToleranceHours: 3,
        marketMoveThresholdPp: MARKET_MOVE_PP,
        currentValueEdgeFormula: "stored modelProbability - latest normalized marketProbability",
        classificationPriority: ["DROP", "HOLD", "KEEP_REVIEW"],
      },
      snapshotDeduped: sameAsLast,
      deterministic,
      note:
        "모델·Baseline pick 미변경. 2차 후보 분류만 수행. API 키·원시 인증 헤더 미저장.",
    },
    apiUsage: snapshot.apiUsage,
    summary: {
      watchlistGames: watchGames.length,
      oddsMatched: matchedCount,
      ambiguous: first.filter((g) => g.matchStatus === "ambiguous").length,
      failed: first.filter((g) => g.matchStatus === "failed").length,
      KEEP_REVIEW: keep.length,
      HOLD: hold.length,
      DROP: drop.length,
      keepGames: keep.map((g) => ({
        gameId: g.gameId,
        match: g.match,
        currentValueEdge: g.currentValueEdge,
      })),
      holdGames: hold.map((g) => ({
        gameId: g.gameId,
        match: g.match,
        currentValueEdge: g.currentValueEdge,
        reasons: g.classificationReasons,
      })),
      dropGames: drop.map((g) => ({
        gameId: g.gameId,
        match: g.match,
        currentValueEdge: g.currentValueEdge,
        reasons: g.classificationReasons,
      })),
      topCurrentValueEdge: topValue.slice(0, 3).map((g) => ({
        gameId: g.gameId,
        match: g.match,
        currentValueEdge: g.currentValueEdge,
        baselinePick: g.baselinePick,
      })),
      mostAdverseMove: mostAdverse
        ? {
            gameId: mostAdverse.gameId,
            match: mostAdverse.match,
            marketProbabilityChangePp: mostAdverse.marketProbabilityChangePp,
            oddsMove: mostAdverse.oddsMove,
            initialBestOdds: mostAdverse.initialBestOdds,
            currentBestOdds: mostAdverse.currentBestOdds,
          }
        : null,
      nextRecheckTimes: nextRechecks,
      notFinalLineReason:
        "선발·라인업·부상·순위가 Engine에 미반영이고, 투수 방향은 연구 경고만이며, 모델 재실행·추천 확정이 없다. 배당 이동이 승패를 보장하지 않는다.",
      brewersExcluded: !brewersOnList,
    },
    games: first,
    history,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`최신 배당 매칭: ${matchedCount}/${watchGames.length}`);
  console.log(
    `KEEP ${keep.length} / HOLD ${hold.length} / DROP ${drop.length}` +
      (sameAsLast ? " (snapshot 중복 생략)" : " (history 추가)"),
  );
  console.log("");
  for (const g of first) {
    console.log(
      `${g.match} | ${g.classification}` +
        ` | odds ${g.initialBestOdds ?? "n/a"}→${g.currentBestOdds ?? "n/a"}` +
        ` | VE ${g.initialValueEdge ?? "n/a"}→${g.currentValueEdge ?? "n/a"}` +
        ` | move=${g.oddsMove} | pitcher=${g.pitcherDirection}`,
    );
  }
  if (mostAdverse) {
    console.log(
      `\n가장 큰 불리 변동: ${mostAdverse.match} (시장확률 ${mostAdverse.marketProbabilityChangePp}pp)`,
    );
  }
  console.log("\n다음 재확인:");
  for (const r of nextRechecks) {
    console.log(`  ${r.match}: ${r.at ?? "n/a"} (${r.message})`);
  }
  console.log(
    `\nAPI: sportKey=${mlb.sportKey} cached=${oddsResult.cached} remaining=${oddsResult.usage?.requestsRemaining ?? "n/a"}`,
  );
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message.replace(/apiKey=[^&\s]+/gi, "apiKey=***"));
  process.exitCode = 1;
});
