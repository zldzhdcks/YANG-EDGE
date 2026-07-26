/**
 * 2026-07-27 KST MLB Watchlist 5경기 — 경기 전 probable pitcher 성적 비교.
 *
 * 목적:
 *   기존 Baseline 후보와 선발투수 지표(ERA/WHIP)가 같은 방향인지·충돌하는지
 *   관찰용으로만 평가한다.
 *
 * 절대 금지:
 *   - EDGE Engine 재실행
 *   - Baseline pick / weights / Confidence / 추천 등급 변경
 *   - 모델 승률·EDGE Score·Value Edge 가감
 *   - Watchlist 원본·/games·Home·Analysis UI·스냅샷·가계부 수정
 *   - SportsDataIO Scrambled / MLB.com HTML 크롤링
 *   - Stats API 중복 호출 (저장된 pitcher-stat-coverage JSON 우선)
 *
 * 법적 범위:
 *   MLB Stats API 상업 이용 권한 미확인.
 *   개인 시제품 내부 연구 리포트 전용. 사이트 런타임·공개 UI·유료 서비스 연결 금지.
 *   원본 응답 재배포 금지. 최소 파생값만 로컬 JSON 저장.
 *
 * 실행:
 *   npx tsx scripts/build-mlb-pitcher-comparison.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TARGET_DATE_KST = "2026-07-27";
const ERA_EVEN_GAP = 0.3;
const WHIP_EVEN_GAP = 0.05;
const RECENT_ERA_EVEN_GAP = 0.5;
const RECENT_WHIP_EVEN_GAP = 0.1;

const WATCHLIST_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb.json`,
);
const PITCHER_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-pitcher-stat-coverage.json`,
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
  `${TARGET_DATE_KST}-mlb-pitcher-review.json`,
);

type Side = "home" | "away";
type MetricLean = "HOME" | "AWAY" | "EVEN" | "INSUFFICIENT";
type DirectionClass =
  | "SUPPORTS_BASELINE"
  | "CONFLICTS_BASELINE"
  | "MIXED"
  | "INSUFFICIENT";

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
  currentClassification: string | null;
  priority: string | null;
  recheckRequired: boolean;
  recheckReasons: string[];
  warnings: string[];
};

type FilterLine = {
  gameId: string;
  classification: string | null;
  bestOdds: number | null;
  pickTeam: string | null;
  pickTeamId: Side | null;
  valueEdge: number | null;
  edgeScore: number | null;
  confidence: number | null;
};

type Outing = {
  date: string | null;
  inningsPitched: number | null;
  earnedRuns: number | null;
  hits: number | null;
  baseOnBalls: number | null;
};

type PitcherSide = {
  name: string | null;
  throws: "L" | "R" | null;
  seasonEra: number | null;
  seasonWhip: number | null;
  seasonIp: number | null;
  gamesStarted: number | null;
  strikeOuts: number | null;
  baseOnBalls: number | null;
  homeRuns: number | null;
  lastOutingDate: string | null;
  recent3Era: number | null;
  recent3Whip: number | null;
  recent3Sample: number;
  cutoffTime: string | null;
  sampleSize: number | null;
  status: string | null;
  missingFields: string[];
  warnings: string[];
};

type PitcherGame = {
  baselineGameId: string | null;
  gamePk: number | null;
  status: string | null;
  home: PitcherSide;
  away: PitcherSide;
  warnings: string[];
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
function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
        currentClassification: asString(row.currentClassification),
        priority: asString(row.priority),
        recheckRequired: row.recheckRequired === true,
        recheckReasons: Array.isArray(row.recheckReasons)
          ? row.recheckReasons.filter(
              (r): r is string => typeof r === "string",
            )
          : [],
        warnings: Array.isArray(row.warnings)
          ? row.warnings.filter((r): r is string => typeof r === "string")
          : [],
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
    if (!gameId || !row) continue;
    const pickTeamId = asString(row.pickTeamId);
    map.set(gameId, {
      gameId,
      classification: asString(row.classification),
      bestOdds: asNumber(row.bestOdds),
      pickTeam: asString(row.pickTeam),
      pickTeamId:
        pickTeamId === "home" || pickTeamId === "away"
          ? (pickTeamId as Side)
          : null,
      valueEdge: asNumber(row.valueEdge),
      edgeScore: asNumber(row.edgeScore),
      confidence: asNumber(row.confidence),
    });
  }
  return map;
}

function parseOutings(raw: unknown): Outing[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) return null;
      return {
        date: asString(row.date),
        inningsPitched: asNumber(row.inningsPitched),
        earnedRuns: asNumber(row.earnedRuns),
        hits: asNumber(row.hits),
        baseOnBalls: asNumber(row.baseOnBalls),
      } satisfies Outing;
    })
    .filter((o): o is Outing => o != null);
}

function recent3Stats(outings: Outing[]): {
  era: number | null;
  whip: number | null;
  sample: number;
} {
  const recent = outings.slice(0, 3);
  let er = 0;
  let eraIp = 0;
  let usableEra = 0;
  let hits = 0;
  let bb = 0;
  let whipIp = 0;
  let usableWhip = 0;

  for (const o of recent) {
    if (o.inningsPitched != null && o.inningsPitched > 0 && o.earnedRuns != null) {
      er += o.earnedRuns;
      eraIp += o.inningsPitched;
      usableEra += 1;
    }
    if (
      o.inningsPitched != null &&
      o.inningsPitched > 0 &&
      o.hits != null &&
      o.baseOnBalls != null
    ) {
      whipIp += o.inningsPitched;
      hits += o.hits;
      bb += o.baseOnBalls;
      usableWhip += 1;
    }
  }

  return {
    era: usableEra > 0 && eraIp > 0 ? round2((er / eraIp) * 9) : null,
    whip: usableWhip > 0 && whipIp > 0 ? round2((hits + bb) / whipIp) : null,
    sample: Math.max(usableEra, usableWhip, recent.length),
  };
}

function parsePitcherSide(raw: unknown): PitcherSide {
  const row = asRecord(raw);
  const identity = asRecord(row?.identity);
  const throwsRaw = asString(identity?.throws);
  const outings = parseOutings(row?.recentOutings);
  const recent = recent3Stats(outings);
  const gs = asNumber(row?.gamesStarted);
  return {
    name: asString(identity?.fullName),
    throws: throwsRaw === "L" || throwsRaw === "R" ? throwsRaw : null,
    seasonEra: asNumber(row?.seasonEra),
    seasonWhip: asNumber(row?.seasonWhip),
    seasonIp: asNumber(row?.inningsPitched),
    gamesStarted: gs,
    strikeOuts: asNumber(row?.strikeOuts),
    baseOnBalls: asNumber(row?.baseOnBalls),
    homeRuns: asNumber(row?.homeRuns),
    lastOutingDate: asString(row?.lastOutingDate),
    recent3Era: recent.era,
    recent3Whip: recent.whip,
    recent3Sample: recent.sample,
    cutoffTime: asString(row?.cutoffTime),
    sampleSize: gs,
    status: asString(row?.status),
    missingFields: Array.isArray(row?.missingFields)
      ? row.missingFields.filter((f): f is string => typeof f === "string")
      : [],
    warnings: Array.isArray(row?.warnings)
      ? row.warnings.filter((f): f is string => typeof f === "string")
      : [],
  };
}

function loadPitcherGames(raw: unknown): Map<string, PitcherGame> {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  const map = new Map<string, PitcherGame>();
  for (const entry of games) {
    const row = asRecord(entry);
    if (!row) continue;
    const baselineGameId = asString(row.baselineGameId);
    if (!baselineGameId) continue;
    const detail = asRecord(row.detail);
    map.set(baselineGameId, {
      baselineGameId,
      gamePk: asNumber(row.gamePk),
      status: asString(row.status),
      home: parsePitcherSide(detail?.home),
      away: parsePitcherSide(detail?.away),
      warnings: Array.isArray(row.warnings)
        ? row.warnings.filter((w): w is string => typeof w === "string")
        : [],
    });
  }
  return map;
}

/** 낮은 쪽이 우세. 차이 < gap 이면 EVEN. */
function leanLowerBetter(
  home: number | null,
  away: number | null,
  gap: number,
): MetricLean {
  if (home == null || away == null) return "INSUFFICIENT";
  const diff = Math.abs(home - away);
  if (diff < gap) return "EVEN";
  return home < away ? "HOME" : "AWAY";
}

function resolveBaselineSide(game: WatchGame, filter: FilterLine | undefined): Side | null {
  if (filter?.pickTeamId) return filter.pickTeamId;
  if (!game.baselinePick) return null;
  if (game.baselinePick === game.homeTeam) return "home";
  if (game.baselinePick === game.awayTeam) return "away";
  return null;
}

function metricSupports(
  lean: MetricLean,
  baselineSide: Side,
): "support" | "oppose" | "even" | "insufficient" {
  if (lean === "INSUFFICIENT") return "insufficient";
  if (lean === "EVEN") return "even";
  const leanSide: Side = lean === "HOME" ? "home" : "away";
  return leanSide === baselineSide ? "support" : "oppose";
}

function classifyVsBaseline(
  eraLean: MetricLean,
  whipLean: MetricLean,
  baselineSide: Side | null,
): DirectionClass {
  if (baselineSide == null) return "INSUFFICIENT";
  if (eraLean === "INSUFFICIENT" || whipLean === "INSUFFICIENT") {
    return "INSUFFICIENT";
  }

  const era = metricSupports(eraLean, baselineSide);
  const whip = metricSupports(whipLean, baselineSide);

  const supportCount = [era, whip].filter((x) => x === "support").length;
  const opposeCount = [era, whip].filter((x) => x === "oppose").length;

  // SUPPORTS: ERA·WHIP 중 최소 2개(즉 둘 다)가 baseline 지지, 반대 지표 없음
  if (supportCount >= 2 && opposeCount === 0) return "SUPPORTS_BASELINE";
  // CONFLICTS: ERA·WHIP 중 최소 2개가 상대 지지
  if (opposeCount >= 2 && supportCount === 0) return "CONFLICTS_BASELINE";
  return "MIXED";
}

function displayPitcher(side: PitcherSide) {
  return {
    name: side.name,
    throws: side.throws,
    seasonEra: side.seasonEra,
    seasonWhip: side.seasonWhip,
    seasonIp: side.seasonIp,
    gamesStarted: side.gamesStarted,
    strikeOuts: side.strikeOuts,
    baseOnBalls: side.baseOnBalls,
    homeRuns: side.homeRuns,
    lastOutingDate: side.lastOutingDate,
    recent3Era: side.recent3Era,
    recent3Whip: side.recent3Whip,
    recent3Sample: side.recent3Sample,
    cutoffTime: side.cutoffTime,
    sampleSize: side.sampleSize,
    inningsNote: "투구 능력 점수가 아니라 표본 안정성 참고",
  };
}

function buildGameReview(
  watch: WatchGame,
  pitcher: PitcherGame | undefined,
  filter: FilterLine | undefined,
) {
  const baselineSide = resolveBaselineSide(watch, filter);
  const warnings: string[] = [
    "MLB_STATSAPI_COMMERCIAL_USE_UNVERIFIED",
    "INTERNAL_RESEARCH_ONLY",
    "NOT_A_BETTING_CONFIRMATION",
    "BASELINE_PICK_UNCHANGED",
    "NO_ENGINE_RERUN",
  ];

  if (!pitcher) {
    warnings.push("PITCHER_COVERAGE_MISSING");
    return {
      gameId: watch.gameId,
      match: `${watch.awayTeam} @ ${watch.homeTeam}`,
      startTimeKst: watch.startTimeKst,
      baselinePick: watch.baselinePick,
      baselineSide,
      existingClassification:
        filter?.classification ?? watch.currentClassification,
      baselineOdds: filter?.bestOdds ?? watch.baselineOdds,
      valueEdge: filter?.valueEdge ?? watch.valueEdge,
      edgeScore: filter?.edgeScore ?? watch.edgeScore,
      confidence: filter?.confidence ?? watch.confidence,
      pitcherMatched: false,
      homePitcher: null,
      awayPitcher: null,
      comparisons: {
        era: {
          lean: "INSUFFICIENT" as MetricLean,
          home: null,
          away: null,
          diff: null,
        },
        whip: {
          lean: "INSUFFICIENT" as MetricLean,
          home: null,
          away: null,
          diff: null,
        },
        recentForm: {
          lean: "INSUFFICIENT" as MetricLean,
          homeEra: null,
          awayEra: null,
          homeWhip: null,
          awayWhip: null,
          note: "보조 설명만. SUPPORT/CONFLICT 단독 결정 금지.",
        },
        innings: {
          home: null,
          away: null,
          note: "표본 안정성 참고. 우세 판정 점수화 금지.",
        },
      },
      direction: "INSUFFICIENT" as DirectionClass,
      warnings,
      recheckRequiredBeforePitch: true,
      note: "투수 커버리지 없음. Baseline pick 유지. 확정 라인 아님.",
    };
  }

  const eraLean = leanLowerBetter(
    pitcher.home.seasonEra,
    pitcher.away.seasonEra,
    ERA_EVEN_GAP,
  );
  const whipLean = leanLowerBetter(
    pitcher.home.seasonWhip,
    pitcher.away.seasonWhip,
    WHIP_EVEN_GAP,
  );
  const recentLean =
    pitcher.home.recent3Era != null && pitcher.away.recent3Era != null
      ? leanLowerBetter(
          pitcher.home.recent3Era,
          pitcher.away.recent3Era,
          RECENT_ERA_EVEN_GAP,
        )
      : ("INSUFFICIENT" as MetricLean);

  const direction = classifyVsBaseline(eraLean, whipLean, baselineSide);

  warnings.push(...pitcher.warnings);
  if (pitcher.status && pitcher.status !== "READY_FOR_BACKTEST") {
    warnings.push(`PITCHER_STATUS_${pitcher.status}`);
  }
  if (direction === "CONFLICTS_BASELINE") {
    warnings.push("PITCHER_METRICS_CONFLICT_BASELINE_PICK_NOT_CHANGED");
  }
  if (direction === "MIXED") {
    warnings.push("PITCHER_METRICS_MIXED");
  }

  const eraDiff =
    pitcher.home.seasonEra != null && pitcher.away.seasonEra != null
      ? round2(Math.abs(pitcher.home.seasonEra - pitcher.away.seasonEra))
      : null;
  const whipDiff =
    pitcher.home.seasonWhip != null && pitcher.away.seasonWhip != null
      ? round2(Math.abs(pitcher.home.seasonWhip - pitcher.away.seasonWhip))
      : null;

  return {
    gameId: watch.gameId,
    match: `${watch.awayTeam} @ ${watch.homeTeam}`,
    startTimeKst: watch.startTimeKst,
    baselinePick: watch.baselinePick,
    baselineSide,
    existingClassification:
      filter?.classification ?? watch.currentClassification,
    baselineOdds: filter?.bestOdds ?? watch.baselineOdds,
    valueEdge: filter?.valueEdge ?? watch.valueEdge,
    edgeScore: filter?.edgeScore ?? watch.edgeScore,
    confidence: filter?.confidence ?? watch.confidence,
    pitcherMatched: true,
    homePitcher: displayPitcher(pitcher.home),
    awayPitcher: displayPitcher(pitcher.away),
    comparisons: {
      era: {
        lean: eraLean,
        home: pitcher.home.seasonEra,
        away: pitcher.away.seasonEra,
        diff: eraDiff,
        rule: `낮은 쪽 우세, 차이 ${ERA_EVEN_GAP} 미만 EVEN`,
      },
      whip: {
        lean: whipLean,
        home: pitcher.home.seasonWhip,
        away: pitcher.away.seasonWhip,
        diff: whipDiff,
        rule: `낮은 쪽 우세, 차이 ${WHIP_EVEN_GAP} 미만 EVEN`,
      },
      recentForm: {
        lean: recentLean,
        homeEra: pitcher.home.recent3Era,
        awayEra: pitcher.away.recent3Era,
        homeWhip: pitcher.home.recent3Whip,
        awayWhip: pitcher.away.recent3Whip,
        recentWhipEvenGap: RECENT_WHIP_EVEN_GAP,
        note: "보조 설명만. SUPPORT/CONFLICT 단독 결정 금지.",
      },
      innings: {
        home: pitcher.home.seasonIp,
        away: pitcher.away.seasonIp,
        note: "표본 안정성 참고. 투구 능력 점수·우세 판정 금지.",
      },
    },
    direction,
    warnings: [...new Set(warnings)],
    recheckRequiredBeforePitch: true,
    note:
      "투수 비교는 관찰용이다. Baseline pick·모델 승률·EDGE Score·Confidence·Value Edge를 변경하지 않았다. 확정 베팅 라인이 아니다.",
  };
}

type GameReview = ReturnType<typeof buildGameReview>;

function conflictMagnitude(game: GameReview): number {
  if (game.direction !== "CONFLICTS_BASELINE") return -1;
  const era = game.comparisons.era.diff ?? 0;
  const whip = game.comparisons.whip.diff ?? 0;
  // ERA 차이를 주 신호, WHIP는 보조 스케일
  return era + whip * 10;
}

async function main() {
  console.log(`=== MLB Pitcher Comparison Review (${TARGET_DATE_KST} KST) ===`);
  console.log("Engine 미재실행. Baseline pick 유지. 내부 연구 전용.\n");

  const watchRaw = JSON.parse(await readFile(WATCHLIST_PATH, "utf8"));
  const pitcherRaw = JSON.parse(await readFile(PITCHER_PATH, "utf8"));
  const filterRaw = JSON.parse(await readFile(FILTER_PATH, "utf8"));

  const watchGames = loadWatchlist(watchRaw);
  const pitcherMap = loadPitcherGames(pitcherRaw);
  const filterMap = loadFilterLines(filterRaw);

  if (watchGames.length === 0) {
    throw new Error("watchlist games 없음");
  }

  const runOnce = (): GameReview[] =>
    watchGames.map((w) =>
      buildGameReview(w, pitcherMap.get(w.gameId), filterMap.get(w.gameId)),
    );

  const first = runOnce();
  const second = runOnce();
  const fingerprint = (games: GameReview[]) =>
    JSON.stringify(
      games.map((g) => ({
        gameId: g.gameId,
        direction: g.direction,
        era: g.comparisons.era.lean,
        whip: g.comparisons.whip.lean,
        recent: g.comparisons.recentForm.lean,
        baselinePick: g.baselinePick,
      })),
    );
  const deterministic = fingerprint(first) === fingerprint(second);

  const count = (d: DirectionClass) =>
    first.filter((g) => g.direction === d).length;

  const supports = first.filter((g) => g.direction === "SUPPORTS_BASELINE");
  const conflicts = first.filter((g) => g.direction === "CONFLICTS_BASELINE");
  const mixed = first.filter((g) => g.direction === "MIXED");
  const insufficient = first.filter((g) => g.direction === "INSUFFICIENT");

  const biggestConflict = [...conflicts].sort(
    (a, b) => conflictMagnitude(b) - conflictMagnitude(a),
  )[0] ?? null;

  const output = {
    meta: {
      version: "mlb-pitcher-review-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      kind: "pitcher-baseline-direction-review",
      recommendation: false,
      bettingConfirmation: false,
      engineRerun: false,
      baselinePickChanged: false,
      weightsChanged: false,
      valueEdgeRecalculated: false,
      sportsDataIoUsed: false,
      mlbComHtmlCrawled: false,
      inputs: {
        watchlist: path.relative(process.cwd(), WATCHLIST_PATH).replace(/\\/g, "/"),
        pitcherCoverage: path.relative(process.cwd(), PITCHER_PATH).replace(/\\/g, "/"),
        bettingLineFilter: path.relative(process.cwd(), FILTER_PATH).replace(/\\/g, "/"),
      },
      legalUse: {
        mlbStatsApiCommercialUse: "미확인",
        scope: "개인 시제품 내부 연구 리포트 전용",
        runtimeConnected: false,
        publicUiConnected: false,
        paidServiceConnected: false,
        rawResponseRedistribution: false,
        derivativeOnly: true,
        note:
          "MLB Stats API 데이터는 상업 이용 권한이 미확인이다. 사이트 런타임·공개 UI·유료 서비스에 연결하지 않는다. 원본 응답을 재배포하지 않으며 최소 파생값만 로컬 JSON에 저장한다.",
      },
      rules: {
        eraEvenGap: ERA_EVEN_GAP,
        whipEvenGap: WHIP_EVEN_GAP,
        recentEraEvenGap: RECENT_ERA_EVEN_GAP,
        directionDecidedBy: ["ERA", "WHIP"],
        recentFormRole: "auxiliary-only",
        noWeightedScore: true,
      },
      deterministic,
      note:
        "선발투수 성적을 Baseline 방향과만 비교한다. 투수 때문에 이긴다고 표현하지 않으며 확정 라인이 아니다.",
    },
    summary: {
      totalWatchlistGames: watchGames.length,
      pitcherMatched: first.filter((g) => g.pitcherMatched).length,
      SUPPORTS_BASELINE: count("SUPPORTS_BASELINE"),
      CONFLICTS_BASELINE: count("CONFLICTS_BASELINE"),
      MIXED: count("MIXED"),
      INSUFFICIENT: count("INSUFFICIENT"),
      sameDirectionGames: supports.map((g) => ({
        gameId: g.gameId,
        match: g.match,
        baselinePick: g.baselinePick,
      })),
      conflictGames: conflicts.map((g) => ({
        gameId: g.gameId,
        match: g.match,
        baselinePick: g.baselinePick,
        eraLean: g.comparisons.era.lean,
        whipLean: g.comparisons.whip.lean,
        eraDiff: g.comparisons.era.diff,
        whipDiff: g.comparisons.whip.diff,
      })),
      mixedGames: mixed.map((g) => ({
        gameId: g.gameId,
        match: g.match,
        baselinePick: g.baselinePick,
        eraLean: g.comparisons.era.lean,
        whipLean: g.comparisons.whip.lean,
      })),
      insufficientGames: insufficient.map((g) => ({
        gameId: g.gameId,
        match: g.match,
      })),
      biggestConflict: biggestConflict
        ? {
            gameId: biggestConflict.gameId,
            match: biggestConflict.match,
            baselinePick: biggestConflict.baselinePick,
            eraDiff: biggestConflict.comparisons.era.diff,
            whipDiff: biggestConflict.comparisons.whip.diff,
            eraLean: biggestConflict.comparisons.era.lean,
            whipLean: biggestConflict.comparisons.whip.lean,
          }
        : null,
      cannotConfirmAsLine:
        "선발·라인업·부상·순위가 Engine에 반영되지 않은 Baseline 관찰이며, 투수 비교는 방향 충돌 여부만 본다. 모델 수치를 변경하지 않았고 확정 베팅 라인으로 사용할 수 없다. MLB Stats API 상업 이용도 미확인이다.",
    },
    games: first,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Watchlist: ${watchGames.length}경기`);
  console.log(`투수 매칭: ${output.summary.pitcherMatched}/${watchGames.length}`);
  console.log(
    `SUPPORT ${output.summary.SUPPORTS_BASELINE} / CONFLICT ${output.summary.CONFLICTS_BASELINE} / MIXED ${output.summary.MIXED} / INSUFFICIENT ${output.summary.INSUFFICIENT}`,
  );
  console.log("");
  for (const g of first) {
    const era = g.comparisons.era;
    const whip = g.comparisons.whip;
    console.log(
      `${g.match} | pick=${g.baselinePick} | dir=${g.direction}` +
        ` | ERA ${era.home ?? "n/a"}/${era.away ?? "n/a"} (${era.lean}, Δ${era.diff ?? "n/a"})` +
        ` | WHIP ${whip.home ?? "n/a"}/${whip.away ?? "n/a"} (${whip.lean}, Δ${whip.diff ?? "n/a"})`,
    );
  }
  if (biggestConflict) {
    console.log(
      `\n가장 큰 충돌: ${biggestConflict.match} (ERA Δ${biggestConflict.comparisons.era.diff}, WHIP Δ${biggestConflict.comparisons.whip.diff})`,
    );
  }
  console.log(`\n법적 범위 표시: yes (${output.meta.legalUse.scope})`);
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
