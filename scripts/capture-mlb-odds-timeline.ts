/**
 * 2026-07-27 KST MLB 연구 예측 15경기 — 경기 시작 전 Odds timeline 수집.
 *
 * - 예측 스냅샷(data/predictions/mlb/2026-07-27.json)은 읽기만 한다 (수정 금지).
 * - 모델·추천·예측값·구매 상태는 변경하지 않는다.
 * - The Odds API MLB sport key는 기존 resolver로 확인.
 * - Odds endpoint 최신 조회 1회만.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/capture-mlb-odds-timeline.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import { removeBookmakerMargin } from "../src/lib/market/remove-bookmaker-margin";
import { roundProb } from "../src/lib/market/calculate-implied-probabilities";
import {
  getOddsProvider,
  normalizeTeamNameForOdds,
  oddsCacheKey,
  resolveSportKeysForLeagues,
  type OddsData,
} from "../src/lib/odds";
import { deleteCachedOdds } from "../src/lib/odds/cache";
import type { GameData } from "../src/types/game";

const TARGET_DATE_KST = "2026-07-27";
const COMMENCE_TOLERANCE_MS = 3 * 60 * 60 * 1000;
const MOVE_THRESHOLD_PP = 2;

const PREDICTION_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}.json`,
);
const TIMELINE_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}-odds-timeline.json`,
);

type Movement =
  | "MARKET_SUPPORT"
  | "MARKET_NEUTRAL"
  | "MARKET_ADVERSE"
  | "UNKNOWN";

type MatchStatus = "matched" | "ambiguous" | "failed" | "started" | "closed";

type PredictionRow = {
  gameId: string;
  externalId: string | null;
  homeTeam: string;
  awayTeam: string;
  baselinePick: string | null;
  startTimeKst: string | null;
  dateKst: string;
  resultStatus: string | null;
};

type OddsSnapshot = {
  capturedAt: string;
  oddsEventId: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number | null;
  awayOdds: number | null;
  pickOdds: number | null;
  opposingOdds: number | null;
  bookmakerCount: number;
  rawImpliedHome: number | null;
  rawImpliedAway: number | null;
  rawImpliedPick: number | null;
  marketProbabilityHome: number | null;
  marketProbabilityAway: number | null;
  /** margin 제거 후 baselinePick 시장 확률 (0~1) */
  marketProbability: number | null;
  overround: number | null;
  minutesUntilStart: number | null;
  oddsChange?: number | null;
  marketProbabilityChangePp?: number | null;
  bookmakerCountChange?: number | null;
  movementFromFirst?: Movement;
  movementFromPrevious?: Movement;
  closingSnapshotCandidate?: boolean;
};

type GameTimeline = {
  gameId: string;
  externalId: string | null;
  homeTeam: string;
  awayTeam: string;
  baselinePick: string | null;
  startTimeKst: string | null;
  matchStatus: MatchStatus;
  matchConfidence: number | null;
  candidateCount: number;
  pregameClosed: boolean;
  commenceTime: string | null;
  oddsEventId: string | null;
  latestMovementFromFirst: Movement;
  snapshots: OddsSnapshot[];
  note: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function roundOdds(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
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

function estimateCommenceMs(pred: PredictionRow): number | null {
  const time =
    pred.startTimeKst && /^\d{2}:\d{2}/.test(pred.startTimeKst)
      ? pred.startTimeKst.slice(0, 5)
      : null;
  if (!time) return null;
  const ms = Date.parse(`${pred.dateKst}T${time}:00+09:00`);
  return Number.isFinite(ms) ? ms : null;
}

function toGameData(pred: PredictionRow): GameData {
  return {
    id: pred.gameId,
    sport: "baseball",
    league: "MLB",
    homeTeam: pred.homeTeam,
    awayTeam: pred.awayTeam,
    startTime: pred.startTimeKst ?? "TBD",
    date: pred.dateKst,
    aiAnalysisAvailable: false,
    externalId: pred.externalId ?? undefined,
    externalProvider: "api-baseball",
  };
}

type OddsCandidate = { odds: OddsData; confidence: number };

/** 동일 홈·원정 방향 + 동일 KST 날짜 + ±3h. 복수면 AMBIGUOUS. */
function findOddsCandidates(
  game: GameData,
  oddsList: OddsData[],
  commenceMs: number | null,
): OddsCandidate[] {
  const hits: OddsCandidate[] = [];
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
    if (
      commenceMs != null &&
      Math.abs(commenceMs - oddsMs) > COMMENCE_TOLERANCE_MS
    ) {
      continue;
    }
    hits.push({ odds, confidence });
  }
  hits.sort((a, b) => b.confidence - a.confidence);
  return hits;
}

function resolvePickSide(
  baselinePick: string | null,
  homeTeam: string,
  awayTeam: string,
): "home" | "away" | null {
  if (!baselinePick) return null;
  if (baselinePick === homeTeam) return "home";
  if (baselinePick === awayTeam) return "away";
  // soft match via normalize
  if (
    normalizeTeamNameForOdds(baselinePick) ===
    normalizeTeamNameForOdds(homeTeam)
  ) {
    return "home";
  }
  if (
    normalizeTeamNameForOdds(baselinePick) ===
    normalizeTeamNameForOdds(awayTeam)
  ) {
    return "away";
  }
  return null;
}

function classifyMovement(
  firstPickMp: number | null,
  currentPickMp: number | null,
): Movement {
  if (firstPickMp == null || currentPickMp == null) return "UNKNOWN";
  const deltaPp = (currentPickMp - firstPickMp) * 100;
  if (deltaPp >= MOVE_THRESHOLD_PP) return "MARKET_SUPPORT";
  if (deltaPp <= -MOVE_THRESHOLD_PP) return "MARKET_ADVERSE";
  return "MARKET_NEUTRAL";
}

function snapshotDedupeKey(s: {
  pickOdds: number | null;
  opposingOdds: number | null;
  marketProbability: number | null;
  bookmakerCount: number;
  commenceTime: string;
}): string {
  return [
    s.pickOdds ?? "null",
    s.opposingOdds ?? "null",
    s.marketProbability ?? "null",
    s.bookmakerCount,
    s.commenceTime,
  ].join("|");
}

function buildSnapshot(
  odds: OddsData,
  baselinePick: string | null,
  homeTeam: string,
  awayTeam: string,
  capturedAt: string,
  nowMs: number,
): OddsSnapshot | null {
  const side = resolvePickSide(baselinePick, homeTeam, awayTeam);
  if (!side) return null;

  const homeOdds = roundOdds(odds.bestHomeOdds);
  const awayOdds = roundOdds(odds.bestAwayOdds);
  const pickOdds = side === "home" ? homeOdds : awayOdds;
  const opposingOdds = side === "home" ? awayOdds : homeOdds;

  const rawHome = odds.impliedHomeProbability;
  const rawAway = odds.impliedAwayProbability;
  const margin = removeBookmakerMargin({
    home: rawHome,
    away: rawAway,
    draw: null,
  });

  const marketProbabilityHome = margin.normalized.home;
  const marketProbabilityAway = margin.normalized.away;
  const marketProbability =
    side === "home" ? marketProbabilityHome : marketProbabilityAway;
  const rawImpliedPick = side === "home" ? rawHome : rawAway;

  const commenceMs = Date.parse(odds.commenceTime);
  const minutesUntilStart = Number.isFinite(commenceMs)
    ? Math.round((commenceMs - nowMs) / 60000)
    : null;

  return {
    capturedAt,
    oddsEventId: odds.externalEventId,
    commenceTime: odds.commenceTime,
    homeTeam: odds.homeTeam,
    awayTeam: odds.awayTeam,
    homeOdds,
    awayOdds,
    pickOdds,
    opposingOdds,
    bookmakerCount: odds.bookmakers.length,
    rawImpliedHome: rawHome != null ? roundProb(rawHome) : null,
    rawImpliedAway: rawAway != null ? roundProb(rawAway) : null,
    rawImpliedPick: rawImpliedPick != null ? roundProb(rawImpliedPick) : null,
    marketProbabilityHome,
    marketProbabilityAway,
    marketProbability,
    overround: margin.overround,
    minutesUntilStart,
  };
}

function annotateChanges(
  snapshots: OddsSnapshot[],
): OddsSnapshot[] {
  if (snapshots.length === 0) return snapshots;
  const first = snapshots[0];
  return snapshots.map((snap, index) => {
    if (index === 0) {
      return {
        ...snap,
        oddsChange: undefined,
        marketProbabilityChangePp: undefined,
        bookmakerCountChange: undefined,
        movementFromFirst: undefined,
        movementFromPrevious: undefined,
      };
    }
    const prev = snapshots[index - 1];
    const oddsChange =
      snap.pickOdds != null && first.pickOdds != null
        ? roundOdds(snap.pickOdds - first.pickOdds)
        : null;
    const marketProbabilityChangePp =
      snap.marketProbability != null && first.marketProbability != null
        ? roundProb((snap.marketProbability - first.marketProbability) * 100)
        : null;
    const bookmakerCountChange =
      snap.bookmakerCount - first.bookmakerCount;
    return {
      ...snap,
      oddsChange,
      marketProbabilityChangePp,
      bookmakerCountChange,
      movementFromFirst: classifyMovement(
        first.marketProbability,
        snap.marketProbability,
      ),
      movementFromPrevious: classifyMovement(
        prev.marketProbability,
        snap.marketProbability,
      ),
    };
  });
}

function markClosingCandidate(game: GameTimeline): void {
  if (game.snapshots.length === 0) return;
  game.snapshots = game.snapshots.map((s, i) => ({
    ...s,
    closingSnapshotCandidate: i === game.snapshots.length - 1,
  }));
}

function gameHasStarted(
  pred: PredictionRow,
  commenceTime: string | null,
  nowMs: number,
): boolean {
  if (
    pred.resultStatus === "graded" ||
    pred.resultStatus === "cancelled" ||
    pred.resultStatus === "postponed" ||
    pred.resultStatus === "inconclusive"
  ) {
    return true;
  }
  if (commenceTime) {
    const ms = Date.parse(commenceTime);
    if (Number.isFinite(ms) && nowMs >= ms) return true;
  }
  const est = estimateCommenceMs(pred);
  if (est != null && nowMs >= est) return true;
  return false;
}

async function loadExistingTimeline(): Promise<{
  games: GameTimeline[];
} | null> {
  try {
    const raw = JSON.parse(await readFile(TIMELINE_PATH, "utf8"));
    const root = asRecord(raw);
    const games = Array.isArray(root?.games) ? root.games : null;
    if (!games) return null;
    return {
      games: games.map((entry) => {
        const row = asRecord(entry) ?? {};
        return {
          gameId: asString(row.gameId) ?? "",
          externalId: asString(row.externalId),
          homeTeam: asString(row.homeTeam) ?? "",
          awayTeam: asString(row.awayTeam) ?? "",
          baselinePick: asString(row.baselinePick),
          startTimeKst: asString(row.startTimeKst),
          matchStatus: (asString(row.matchStatus) as MatchStatus) ?? "failed",
          matchConfidence: asNumber(row.matchConfidence),
          candidateCount: asNumber(row.candidateCount) ?? 0,
          pregameClosed: row.pregameClosed === true,
          commenceTime: asString(row.commenceTime),
          oddsEventId: asString(row.oddsEventId),
          latestMovementFromFirst:
            (asString(row.latestMovementFromFirst) as Movement) ?? "UNKNOWN",
          snapshots: Array.isArray(row.snapshots)
            ? (row.snapshots as OddsSnapshot[])
            : [],
          note: asString(row.note),
        } satisfies GameTimeline;
      }),
    };
  } catch {
    return null;
  }
}

async function main() {
  console.log(`=== Capture MLB Odds Timeline (${TARGET_DATE_KST} KST) ===`);
  console.log("예측 파일 수정 금지. Odds snapshot만 수집.\n");

  const predictionRaw = await readFile(PREDICTION_PATH, "utf8");
  const predictionHashBefore = sha256(predictionRaw);
  const predictionJson = JSON.parse(predictionRaw);
  const root = asRecord(predictionJson);
  const predictionsRaw = Array.isArray(root?.predictions)
    ? root.predictions
    : [];

  const predictions: PredictionRow[] = predictionsRaw.map((entry) => {
    const row = asRecord(entry) ?? {};
    return {
      gameId: asString(row.gameId) ?? "",
      externalId: asString(row.externalId),
      homeTeam: asString(row.homeTeam) ?? "",
      awayTeam: asString(row.awayTeam) ?? "",
      baselinePick: asString(row.baselinePick),
      startTimeKst: asString(row.startTimeKst),
      dateKst: asString(row.dateKst) ?? TARGET_DATE_KST,
      resultStatus: asString(row.resultStatus),
    };
  });

  if (predictions.length !== 15) {
    throw new Error(`예상 15경기, 실제 ${predictions.length}`);
  }

  const existing = await loadExistingTimeline();
  const existingById = new Map(
    (existing?.games ?? []).map((g) => [g.gameId, g]),
  );

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
  const oddsParams = {
    sportKey: mlb.sportKey,
    regions: "eu",
    markets: "h2h",
    commenceTimeFrom: dayStart.toISOString().replace(".000Z", "Z"),
    commenceTimeTo: dayEnd.toISOString().replace(".000Z", "Z"),
  };

  // timeline 수집은 캐시된 값이 있어도 최신 1회 조회를 강제한다.
  deleteCachedOdds(oddsCacheKey(oddsParams));
  const oddsResult = await provider.getOdds(oddsParams);
  if (oddsResult.cached) {
    throw new Error("Odds 캐시 히트 — timeline은 최신 조회 1회가 필요함");
  }
  const oddsCached = false;

  const oddsForDate = oddsResult.events.filter((e) => {
    const kst = instantToKst(e.commenceTime);
    return kst?.date === TARGET_DATE_KST;
  });

  const capturedAt = new Date().toISOString();
  const nowMs = Date.now();

  let matchedCount = 0;
  let newlyAdded = 0;
  let duplicateSkipped = 0;
  let startedSkipped = 0;
  let ambiguousCount = 0;
  let failedCount = 0;

  const games: GameTimeline[] = [];

  for (const pred of predictions) {
    const prev = existingById.get(pred.gameId);
    const gameData = toGameData(pred);
    const commenceEst = estimateCommenceMs(pred);

    let game: GameTimeline = prev
      ? {
          ...prev,
          baselinePick: pred.baselinePick,
          homeTeam: pred.homeTeam,
          awayTeam: pred.awayTeam,
          startTimeKst: pred.startTimeKst,
          externalId: pred.externalId,
          snapshots: [...prev.snapshots],
        }
      : {
          gameId: pred.gameId,
          externalId: pred.externalId,
          homeTeam: pred.homeTeam,
          awayTeam: pred.awayTeam,
          baselinePick: pred.baselinePick,
          startTimeKst: pred.startTimeKst,
          matchStatus: "failed",
          matchConfidence: null,
          candidateCount: 0,
          pregameClosed: false,
          commenceTime: null,
          oddsEventId: null,
          latestMovementFromFirst: "UNKNOWN",
          snapshots: [],
          note: null,
        };

    // 이미 닫힌 경기는 재매칭만 유지하고 snapshot 추가 금지
    const knownCommence = game.commenceTime;
    if (game.pregameClosed || gameHasStarted(pred, knownCommence, nowMs)) {
      game.pregameClosed = true;
      if (game.matchStatus === "matched" || game.snapshots.length > 0) {
        game.matchStatus = "closed";
      }
      markClosingCandidate(game);
      startedSkipped += 1;
      game.note =
        "경기 시작 시각 경과 — 새 pregame snapshot 추가 안 함. 마지막 수집 배당만 closingSnapshotCandidate.";
      if (game.snapshots.length > 0) {
        const annotated = annotateChanges(game.snapshots);
        game.snapshots = annotated;
        const last = annotated[annotated.length - 1];
        game.latestMovementFromFirst =
          last.movementFromFirst ?? "UNKNOWN";
      }
      games.push(game);
      continue;
    }

    const candidates = findOddsCandidates(
      gameData,
      oddsForDate,
      commenceEst,
    );
    game.candidateCount = candidates.length;

    if (candidates.length === 0) {
      game.matchStatus = "failed";
      game.matchConfidence = null;
      game.note = "배당 매칭 실패 — 임의 배당 저장 안 함";
      failedCount += 1;
      games.push(game);
      continue;
    }

    if (candidates.length > 1) {
      game.matchStatus = "ambiguous";
      game.matchConfidence = candidates[0].confidence;
      game.note = "후보 복수 — AMBIGUOUS, snapshot 저장 안 함";
      ambiguousCount += 1;
      games.push(game);
      continue;
    }

    const { odds, confidence } = candidates[0];
    matchedCount += 1;
    game.matchStatus = "matched";
    game.matchConfidence = confidence;
    game.commenceTime = odds.commenceTime;
    game.oddsEventId = odds.externalEventId;
    game.note = null;

    // 매칭 직후 시작 여부 재확인 (odds commence 기준)
    if (gameHasStarted(pred, odds.commenceTime, nowMs)) {
      game.pregameClosed = true;
      game.matchStatus = "closed";
      markClosingCandidate(game);
      startedSkipped += 1;
      game.note =
        "경기 시작 시각 경과 — 새 pregame snapshot 추가 안 함. 마지막 수집 배당만 closingSnapshotCandidate.";
      if (game.snapshots.length > 0) {
        game.snapshots = annotateChanges(game.snapshots);
        const last = game.snapshots[game.snapshots.length - 1];
        game.latestMovementFromFirst =
          last.movementFromFirst ?? "UNKNOWN";
      }
      games.push(game);
      continue;
    }

    const snap = buildSnapshot(
      odds,
      pred.baselinePick,
      pred.homeTeam,
      pred.awayTeam,
      capturedAt,
      nowMs,
    );
    if (!snap) {
      game.note = "baselinePick 측 해석 실패 — snapshot 저장 안 함";
      failedCount += 1;
      games.push(game);
      continue;
    }

    const dedupe = snapshotDedupeKey(snap);
    const isDup = game.snapshots.some(
      (s) => snapshotDedupeKey(s) === dedupe,
    );
    if (isDup) {
      duplicateSkipped += 1;
      game.snapshots = annotateChanges(game.snapshots);
      const last = game.snapshots[game.snapshots.length - 1];
      game.latestMovementFromFirst =
        last?.movementFromFirst ??
        (game.snapshots.length <= 1 ? "UNKNOWN" : "UNKNOWN");
      if (game.snapshots.length === 1) {
        game.latestMovementFromFirst = "UNKNOWN";
      } else if (last?.movementFromFirst) {
        game.latestMovementFromFirst = last.movementFromFirst;
      }
      games.push(game);
      continue;
    }

    game.snapshots.push(snap);
    newlyAdded += 1;
    game.snapshots = annotateChanges(game.snapshots);
    if (game.snapshots.length >= 2) {
      const last = game.snapshots[game.snapshots.length - 1];
      game.latestMovementFromFirst = last.movementFromFirst ?? "UNKNOWN";
    } else {
      game.latestMovementFromFirst = "UNKNOWN";
    }
    games.push(game);
  }

  // 예측 원본 불변 재확인
  const predictionRawAfter = await readFile(PREDICTION_PATH, "utf8");
  const predictionHashAfter = sha256(predictionRawAfter);
  if (predictionHashBefore !== predictionHashAfter) {
    throw new Error("예측 원본 hash 변경 감지 — 중단");
  }

  const movementCounts = {
    MARKET_SUPPORT: 0,
    MARKET_NEUTRAL: 0,
    MARKET_ADVERSE: 0,
    UNKNOWN: 0,
  };
  for (const g of games) {
    if (g.snapshots.length < 2) {
      movementCounts.UNKNOWN += 1;
      continue;
    }
    const m = g.latestMovementFromFirst;
    movementCounts[m] += 1;
  }

  type Mover = {
    gameId: string;
    match: string;
    deltaPp: number;
    movement: Movement;
  };
  const movers: Mover[] = [];
  for (const g of games) {
    if (g.snapshots.length < 2) continue;
    const first = g.snapshots[0];
    const last = g.snapshots[g.snapshots.length - 1];
    if (first.marketProbability == null || last.marketProbability == null) {
      continue;
    }
    const deltaPp = roundProb(
      (last.marketProbability - first.marketProbability) * 100,
    );
    movers.push({
      gameId: g.gameId,
      match: `${g.awayTeam} @ ${g.homeTeam}`,
      deltaPp,
      movement: last.movementFromFirst ?? "UNKNOWN",
    });
  }
  movers.sort((a, b) => b.deltaPp - a.deltaPp);
  const biggestUp = movers[0] ?? null;
  const biggestDown =
    movers.length > 0 ? movers[movers.length - 1] : null;

  const nextWorthCollecting = games
    .filter(
      (g) =>
        !g.pregameClosed &&
        g.matchStatus === "matched" &&
        (g.snapshots[g.snapshots.length - 1]?.minutesUntilStart ?? 0) > 0,
    )
    .map((g) => ({
      gameId: g.gameId,
      match: `${g.awayTeam} @ ${g.homeTeam}`,
      minutesUntilStart:
        g.snapshots[g.snapshots.length - 1]?.minutesUntilStart ?? null,
      snapshotCount: g.snapshots.length,
      latestMovementFromFirst: g.latestMovementFromFirst,
    }))
    .sort(
      (a, b) => (a.minutesUntilStart ?? 0) - (b.minutesUntilStart ?? 0),
    );

  const out = {
    meta: {
      version: "mlb-odds-timeline-v1",
      dateKst: TARGET_DATE_KST,
      generatedAt: capturedAt,
      predictionSnapshot: path
        .relative(process.cwd(), PREDICTION_PATH)
        .replace(/\\/g, "/"),
      predictionHashSha256: predictionHashBefore,
      predictionUnchanged: true,
      sportKey: mlb.sportKey,
      sportTitle: mlb.title,
      note:
        "경기 시작 전 Odds snapshot 시계열. 시장 이동이 적중을 보장한다고 표현하지 않는다. closingSnapshotCandidate는 공식 closing odds가 아니라 마지막 수집 배당이다.",
    },
    apiUsage: {
      oddsEndpointCalls: 1,
      cached: oddsCached,
      requestsRemaining: oddsResult.usage.requestsRemaining,
      requestsUsed: oddsResult.usage.requestsUsed,
      requestsLast: oddsResult.usage.requestsLast,
      eventsReturned: oddsResult.events.length,
      eventsOnDate: oddsForDate.length,
    },
    summary: {
      targetGames: predictions.length,
      matched: matchedCount,
      newlyAdded,
      duplicateSkipped,
      startedSkipped,
      ambiguous: ambiguousCount,
      failed: failedCount,
      movement: movementCounts,
      biggestSupport: biggestUp,
      biggestAdverse: biggestDown,
      nextWorthCollecting,
    },
    games,
  };

  await mkdir(path.dirname(TIMELINE_PATH), { recursive: true });
  await writeFile(TIMELINE_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  // 최종 hash 재검증
  const finalHash = sha256(await readFile(PREDICTION_PATH, "utf8"));
  if (finalHash !== predictionHashBefore) {
    throw new Error("저장 후 예측 원본 hash 불일치");
  }

  console.log(`대상 ${predictions.length}경기`);
  console.log(`최신 배당 매칭 ${matchedCount}`);
  console.log(
    `신규 snapshot ${newlyAdded} / 중복 스킵 ${duplicateSkipped} / 시작 후 스킵 ${startedSkipped}`,
  );
  console.log(
    `SUPPORT ${movementCounts.MARKET_SUPPORT} / NEUTRAL ${movementCounts.MARKET_NEUTRAL} / ADVERSE ${movementCounts.MARKET_ADVERSE} / UNKNOWN ${movementCounts.UNKNOWN}`,
  );
  if (biggestUp) {
    console.log(
      `최대 상승: ${biggestUp.match} ${biggestUp.deltaPp >= 0 ? "+" : ""}${biggestUp.deltaPp}%p`,
    );
  }
  if (biggestDown) {
    console.log(
      `최대 하락: ${biggestDown.match} ${biggestDown.deltaPp >= 0 ? "+" : ""}${biggestDown.deltaPp}%p`,
    );
  }
  console.log(
    `다음 수집 가치: ${nextWorthCollecting.length}경기`,
  );
  console.log(`예측 원본 hash 유지: 예 (${predictionHashBefore.slice(0, 12)}…)`);
  console.log(
    `Odds API remaining=${oddsResult.usage.requestsRemaining ?? "n/a"} used=${oddsResult.usage.requestsUsed ?? "n/a"} last=${oddsResult.usage.requestsLast ?? "n/a"}`,
  );
  console.log(`저장: ${path.relative(process.cwd(), TIMELINE_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    "FAILED:",
    message.replace(/apiKey=[^&\s]+/gi, "apiKey=***"),
  );
  process.exitCode = 1;
});
