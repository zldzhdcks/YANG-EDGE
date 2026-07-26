/**
 * MLB 날짜별 경기 → 한국 구매 가능 시간(08:00~23:00 KST) 기준
 * 분석·재확인·결정 시점 계획.
 *
 * 추천·배당·Engine·Watchlist와 무관. 시간 계획만 생성한다.
 * 공식 회차별 발매 마감은 생성하지 않는다 (항상 null / unverified).
 */
import {
  DECISION_COMPLETE_DEADLINE_KST,
  formatKstDateTime,
  kstMs,
  previousKstDate,
  PURCHASE_WINDOW_CLOSE_KST,
  PURCHASE_WINDOW_OPEN_KST,
  RECOMMENDED_FINAL_REVIEW_KST,
} from "@/lib/betting/purchase-window";
import type { GameData } from "@/types/game";

export type PurchasePlanBucket =
  | "PREVIOUS_DAY_DECISION_REQUIRED"
  | "SAME_DAY_DECISION_AVAILABLE"
  | "CONDITIONAL_MORNING_WINDOW"
  | "NO_PURCHASE_WINDOW";

export type PurchasePlanWarning =
  | "OFFICIAL_CLOSE_UNVERIFIED"
  | "NARROW_MORNING_WINDOW"
  | "MISSED_INITIAL_ANALYSIS"
  | "MISSED_ODDS_REFRESH"
  | "MISSED_FINAL_DECISION"
  | "NO_PURCHASE_WINDOW";

export type PurchaseNextAction =
  | "INITIAL_ANALYSIS"
  | "ODDS_REFRESH"
  | "FINAL_DATA_FETCH"
  | "FINAL_DECISION"
  | "CONDITIONAL_MORNING_RECHECK"
  | "NONE_RESEARCH_ONLY"
  | "NONE_WAITING";

export type PurchaseDecisionPlanGame = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  gameStartKst: string;
  gameStartMs: number;
  purchaseWindowOpenKst: string;
  purchaseWindowCloseKst: string;
  officialSalesCloseKst: null;
  officialCloseVerified: false;
  lastPossiblePurchaseTimeKst: string;
  recommendedInitialAnalysisKst: string;
  recommendedOddsRefreshKst: string;
  recommendedFinalDataFetchKst: string;
  recommendedFinalDecisionKst: string;
  /** 08:00~09:00 경기만 — 당일 08:00 조건부 재확인 (단정 금지) */
  conditionalMorningRecheckKst: string | null;
  bucket: PurchasePlanBucket;
  nextAction: PurchaseNextAction;
  nextActionAtKst: string | null;
  researchOnly: boolean;
  warnings: PurchasePlanWarning[];
  notes: string[];
};

export type BuildPurchaseDecisionPlanInput = {
  targetDateKst: string;
  games: GameData[];
  nowMs: number;
};

export type PurchaseDecisionPlanResult = {
  targetDateKst: string;
  generatedAtMs: number;
  games: PurchaseDecisionPlanGame[];
  summary: {
    totalGames: number;
    previousDayDecisionRequired: number;
    sameDayDecisionAvailable: number;
    conditionalMorningWindow: number;
    noPurchaseWindow: number;
    missedAny: number;
    officialCloseUnverified: number;
    nextAction: {
      action: PurchaseNextAction;
      atKst: string | null;
      gameId: string | null;
      match: string | null;
    } | null;
  };
};

const HOUR_MS = 60 * 60 * 1000;
const PREV_DAY_INITIAL = "18:00";
const PREV_DAY_ODDS = "21:30";
const PREV_DAY_FINAL_FETCH = RECOMMENDED_FINAL_REVIEW_KST; // 22:30
const PREV_DAY_FINAL_DECISION = DECISION_COMPLETE_DEADLINE_KST; // 22:50

function parseStartTime(startTime: string): string | null {
  if (!/^\d{2}:\d{2}/.test(startTime) || startTime === "TBD") return null;
  return startTime.slice(0, 5);
}

function classifyBucket(startTimeKst: string): Exclude<
  PurchasePlanBucket,
  "NO_PURCHASE_WINDOW"
> {
  if (startTimeKst < PURCHASE_WINDOW_OPEN_KST) {
    return "PREVIOUS_DAY_DECISION_REQUIRED";
  }
  // 08:00 inclusive ~ 09:00 exclusive
  if (startTimeKst >= "08:00" && startTimeKst < "09:00") {
    return "CONDITIONAL_MORNING_WINDOW";
  }
  return "SAME_DAY_DECISION_AVAILABLE";
}

function clampMs(ms: number, min: number, max: number): number {
  return Math.min(Math.max(ms, min), max);
}

/**
 * 당일(09:00+) 경기: 경기 상대 시각을 구매 창 안으로 클램프.
 * 최종 판단은 당일 22:50을 넘지 않는다.
 */
function sameDaySchedule(
  gameDateKst: string,
  gameStartMs: number,
): {
  initialMs: number;
  oddsMs: number;
  finalFetchMs: number;
  finalDecisionMs: number;
  lastPurchaseMs: number;
  windowOpenMs: number;
  windowCloseMs: number;
} {
  const windowOpenMs = kstMs(gameDateKst, PURCHASE_WINDOW_OPEN_KST);
  const windowCloseMs = kstMs(gameDateKst, PURCHASE_WINDOW_CLOSE_KST);
  const decisionCapMs = kstMs(gameDateKst, PREV_DAY_FINAL_DECISION);

  let initialMs = gameStartMs - 6 * HOUR_MS;
  let oddsMs = gameStartMs - 3 * HOUR_MS;
  let finalFetchMs = gameStartMs - 1.5 * HOUR_MS;

  // 구매 창 개시 이전이면 당일 08:00으로 당김 (여전히 경기 전이어야 함)
  if (initialMs < windowOpenMs) initialMs = windowOpenMs;
  if (oddsMs < windowOpenMs) oddsMs = windowOpenMs;
  if (finalFetchMs < windowOpenMs) finalFetchMs = windowOpenMs;

  // 경기 시작 이후로는 밀지 않음
  initialMs = Math.min(initialMs, gameStartMs - 1);
  oddsMs = Math.min(oddsMs, gameStartMs - 1);
  finalFetchMs = Math.min(finalFetchMs, gameStartMs - 1);

  // 최종 판단 ≤ 22:50, ≤ 최종 조회, ≤ 구매 마감
  const finalDecisionMs = Math.min(
    finalFetchMs,
    decisionCapMs,
    windowCloseMs,
  );

  return {
    initialMs: clampMs(initialMs, windowOpenMs, windowCloseMs),
    oddsMs: clampMs(oddsMs, windowOpenMs, windowCloseMs),
    finalFetchMs: clampMs(finalFetchMs, windowOpenMs, windowCloseMs),
    finalDecisionMs: clampMs(finalDecisionMs, windowOpenMs, windowCloseMs),
    lastPurchaseMs: windowCloseMs,
    windowOpenMs,
    windowCloseMs,
  };
}

function previousDaySchedule(gameDateKst: string): {
  decisionDate: string;
  initialMs: number;
  oddsMs: number;
  finalFetchMs: number;
  finalDecisionMs: number;
  lastPurchaseMs: number;
  windowOpenMs: number;
  windowCloseMs: number;
} {
  const decisionDate = previousKstDate(gameDateKst);
  return {
    decisionDate,
    initialMs: kstMs(decisionDate, PREV_DAY_INITIAL),
    oddsMs: kstMs(decisionDate, PREV_DAY_ODDS),
    finalFetchMs: kstMs(decisionDate, PREV_DAY_FINAL_FETCH),
    finalDecisionMs: kstMs(decisionDate, PREV_DAY_FINAL_DECISION),
    lastPurchaseMs: kstMs(decisionDate, PURCHASE_WINDOW_CLOSE_KST),
    windowOpenMs: kstMs(decisionDate, PURCHASE_WINDOW_OPEN_KST),
    windowCloseMs: kstMs(decisionDate, PURCHASE_WINDOW_CLOSE_KST),
  };
}

function resolveNextAction(input: {
  nowMs: number;
  initialMs: number;
  oddsMs: number;
  finalFetchMs: number;
  finalDecisionMs: number;
  lastPurchaseMs: number;
  conditionalMorningMs: number | null;
  gameStartMs: number;
}): { action: PurchaseNextAction; atMs: number | null } {
  const {
    nowMs,
    initialMs,
    oddsMs,
    finalFetchMs,
    finalDecisionMs,
    lastPurchaseMs,
    conditionalMorningMs,
    gameStartMs,
  } = input;

  if (nowMs > lastPurchaseMs || nowMs >= gameStartMs) {
    return { action: "NONE_RESEARCH_ONLY", atMs: null };
  }

  const candidates: { action: PurchaseNextAction; atMs: number }[] = [];
  if (nowMs < initialMs) {
    candidates.push({ action: "INITIAL_ANALYSIS", atMs: initialMs });
  }
  if (nowMs < oddsMs) {
    candidates.push({ action: "ODDS_REFRESH", atMs: oddsMs });
  }
  if (nowMs < finalFetchMs) {
    candidates.push({ action: "FINAL_DATA_FETCH", atMs: finalFetchMs });
  }
  if (nowMs < finalDecisionMs) {
    candidates.push({ action: "FINAL_DECISION", atMs: finalDecisionMs });
  }
  if (
    conditionalMorningMs != null &&
    nowMs < conditionalMorningMs &&
    conditionalMorningMs < gameStartMs
  ) {
    candidates.push({
      action: "CONDITIONAL_MORNING_RECHECK",
      atMs: conditionalMorningMs,
    });
  }

  if (candidates.length === 0) {
    return { action: "NONE_WAITING", atMs: null };
  }
  candidates.sort((a, b) => a.atMs - b.atMs);
  return candidates[0];
}

export function buildPurchaseDecisionPlanGame(
  game: GameData,
  nowMs: number,
): PurchaseDecisionPlanGame | null {
  const startTime = parseStartTime(game.startTime);
  if (!startTime) return null;
  // UTC 날짜가 아니라 경기 실제 KST 시작 날짜로 분류
  const gameDateKst = game.date;
  const gameStartMs = kstMs(gameDateKst, startTime);
  if (!Number.isFinite(gameStartMs)) return null;

  const structuralBucket = classifyBucket(startTime);
  const warnings: PurchasePlanWarning[] = ["OFFICIAL_CLOSE_UNVERIFIED"];
  const notes: string[] = [
    "공식 회차별 발매 마감 미확인 — 23:00까지 무조건 구매 가능하다고 단정하지 않는다.",
  ];

  let initialMs: number;
  let oddsMs: number;
  let finalFetchMs: number;
  let finalDecisionMs: number;
  let lastPurchaseMs: number;
  let windowOpenMs: number;
  let windowCloseMs: number;
  let conditionalMorningMs: number | null = null;

  if (structuralBucket === "PREVIOUS_DAY_DECISION_REQUIRED") {
    const prev = previousDaySchedule(gameDateKst);
    initialMs = prev.initialMs;
    oddsMs = prev.oddsMs;
    finalFetchMs = prev.finalFetchMs;
    finalDecisionMs = prev.finalDecisionMs;
    lastPurchaseMs = prev.lastPurchaseMs;
    // 표시용 구매 창: 결정일(전날) 기준
    windowOpenMs = prev.windowOpenMs;
    windowCloseMs = prev.windowCloseMs;
    notes.push(
      "새벽(00:00~07:59) 경기 — 당일 아침 구매 창 개시 전이므로 전날 23:00 이전에 결정해야 한다.",
    );
    notes.push(
      `계획: 최초 ${PREV_DAY_INITIAL} / 배당 ${PREV_DAY_ODDS} / 최종조회 ${PREV_DAY_FINAL_FETCH} / 판단마감 ${PREV_DAY_FINAL_DECISION} (전날 KST).`,
    );
  } else if (structuralBucket === "CONDITIONAL_MORNING_WINDOW") {
    const prev = previousDaySchedule(gameDateKst);
    initialMs = prev.initialMs;
    oddsMs = prev.oddsMs;
    finalFetchMs = prev.finalFetchMs;
    finalDecisionMs = prev.finalDecisionMs;
    lastPurchaseMs = prev.lastPurchaseMs;
    windowOpenMs = kstMs(gameDateKst, PURCHASE_WINDOW_OPEN_KST);
    windowCloseMs = kstMs(gameDateKst, PURCHASE_WINDOW_CLOSE_KST);
    conditionalMorningMs = windowOpenMs;
    warnings.push("NARROW_MORNING_WINDOW");
    notes.push(
      "08:00~09:00 경기 — 기본 최종 판단은 전날 22:50. 당일 08:00 재확인은 CONDITIONAL_MORNING_WINDOW이며 공식 마감 미확인으로 실제 구매 가능하다고 단정하지 않는다.",
    );
  } else {
    const same = sameDaySchedule(gameDateKst, gameStartMs);
    initialMs = same.initialMs;
    oddsMs = same.oddsMs;
    finalFetchMs = same.finalFetchMs;
    finalDecisionMs = same.finalDecisionMs;
    lastPurchaseMs = same.lastPurchaseMs;
    windowOpenMs = same.windowOpenMs;
    windowCloseMs = same.windowCloseMs;
    notes.push(
      "09:00 이후 경기 — 구매 창 안에서 경기 전 재확인. 최종 판단은 당일 22:50을 넘지 않는다.",
    );
  }

  // 모든 구매 판단 시각은 23:00 이전이어야 함
  if (finalDecisionMs > lastPurchaseMs) {
    finalDecisionMs = lastPurchaseMs - 10 * 60 * 1000; // 22:50 fallback
  }

  if (nowMs >= initialMs) warnings.push("MISSED_INITIAL_ANALYSIS");
  if (nowMs >= oddsMs) warnings.push("MISSED_ODDS_REFRESH");
  if (nowMs >= finalDecisionMs) warnings.push("MISSED_FINAL_DECISION");

  // 오전 좁은 창: 전날 23:00 경과 후에도 CONDITIONAL_MORNING_WINDOW 유지.
  // 08:00 재확인은 researchOnly가 아니나, 공식 마감 미확인으로 구매 가능을 단정하지 않는다.
  const primaryPurchaseClosed = nowMs > lastPurchaseMs;
  const morningStillOpen =
    structuralBucket === "CONDITIONAL_MORNING_WINDOW" && nowMs < gameStartMs;

  const purchaseClosed =
    structuralBucket === "CONDITIONAL_MORNING_WINDOW"
      ? nowMs >= gameStartMs
      : primaryPurchaseClosed;

  if (purchaseClosed) warnings.push("NO_PURCHASE_WINDOW");
  if (
    structuralBucket === "CONDITIONAL_MORNING_WINDOW" &&
    primaryPurchaseClosed &&
    !purchaseClosed
  ) {
    notes.push(
      "전날 구매 마감 경과 — 당일 08:00 재확인은 조건부이며 공식 마감 미확인으로 실제 구매 가능을 단정하지 않는다.",
    );
  }

  const bucket: PurchasePlanBucket = purchaseClosed
    ? "NO_PURCHASE_WINDOW"
    : structuralBucket;

  const next = resolveNextAction({
    nowMs,
    initialMs,
    oddsMs,
    finalFetchMs,
    finalDecisionMs,
    lastPurchaseMs:
      structuralBucket === "CONDITIONAL_MORNING_WINDOW" && morningStillOpen
        ? gameStartMs - 1
        : lastPurchaseMs,
    conditionalMorningMs,
    gameStartMs,
  });

  return {
    gameId: game.id,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    gameStartKst: formatKstDateTime(gameStartMs),
    gameStartMs,
    purchaseWindowOpenKst: formatKstDateTime(windowOpenMs),
    purchaseWindowCloseKst: formatKstDateTime(windowCloseMs),
    officialSalesCloseKst: null,
    officialCloseVerified: false,
    lastPossiblePurchaseTimeKst: formatKstDateTime(lastPurchaseMs),
    recommendedInitialAnalysisKst: formatKstDateTime(initialMs),
    recommendedOddsRefreshKst: formatKstDateTime(oddsMs),
    recommendedFinalDataFetchKst: formatKstDateTime(finalFetchMs),
    recommendedFinalDecisionKst: formatKstDateTime(finalDecisionMs),
    conditionalMorningRecheckKst:
      conditionalMorningMs == null
        ? null
        : formatKstDateTime(conditionalMorningMs),
    bucket,
    nextAction: next.action,
    nextActionAtKst: next.atMs == null ? null : formatKstDateTime(next.atMs),
    researchOnly:
      structuralBucket === "CONDITIONAL_MORNING_WINDOW"
        ? purchaseClosed
        : primaryPurchaseClosed,
    warnings: [...new Set(warnings)],
    notes,
  };
}

export function buildPurchaseDecisionPlan(
  input: BuildPurchaseDecisionPlanInput,
): PurchaseDecisionPlanResult {
  const games = input.games
    .filter((g) => g.date === input.targetDateKst)
    .map((g) => buildPurchaseDecisionPlanGame(g, input.nowMs))
    .filter((g): g is PurchaseDecisionPlanGame => g != null)
    .sort((a, b) => a.gameStartMs - b.gameStartMs || a.gameId.localeCompare(b.gameId));

  const count = (bucket: PurchasePlanBucket) =>
    games.filter((g) => g.bucket === bucket).length;

  const actionable = games
    .filter(
      (g) =>
        g.nextActionAtKst != null &&
        g.nextAction !== "NONE_RESEARCH_ONLY" &&
        g.nextAction !== "NONE_WAITING",
    )
    .sort((a, b) => {
      const am = a.nextActionAtKst ?? "";
      const bm = b.nextActionAtKst ?? "";
      return am.localeCompare(bm);
    });

  const next = actionable[0] ?? null;

  return {
    targetDateKst: input.targetDateKst,
    generatedAtMs: input.nowMs,
    games,
    summary: {
      totalGames: games.length,
      previousDayDecisionRequired: count("PREVIOUS_DAY_DECISION_REQUIRED"),
      sameDayDecisionAvailable: count("SAME_DAY_DECISION_AVAILABLE"),
      conditionalMorningWindow: count("CONDITIONAL_MORNING_WINDOW"),
      noPurchaseWindow: count("NO_PURCHASE_WINDOW"),
      missedAny: games.filter((g) =>
        g.warnings.some((w) => w.startsWith("MISSED_")),
      ).length,
      officialCloseUnverified: games.filter((g) =>
        g.warnings.includes("OFFICIAL_CLOSE_UNVERIFIED"),
      ).length,
      nextAction: next
        ? {
            action: next.nextAction,
            atKst: next.nextActionAtKst,
            gameId: next.gameId,
            match: `${next.awayTeam} @ ${next.homeTeam}`,
          }
        : null,
    },
  };
}

/** 순수 검증용 — 테스트 케이스 (실 API 없이) */
export function assertPurchasePlanInvariants(
  plan: PurchaseDecisionPlanResult,
): string[] {
  const errors: string[] = [];
  for (const g of plan.games) {
    const decisionMatch = g.recommendedFinalDecisionKst.match(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) KST$/,
    );
    const lastMatch = g.lastPossiblePurchaseTimeKst.match(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) KST$/,
    );
    if (decisionMatch && lastMatch) {
      const decisionMs = kstMs(decisionMatch[1], decisionMatch[2]);
      const lastMs = kstMs(lastMatch[1], lastMatch[2]);
      if (decisionMs > lastMs) {
        errors.push(`${g.gameId}: 최종 판단이 구매 마감 이후`);
      }
      // 모든 구매 판단 시각의 시각 부분이 23:00 이전
      if (decisionMatch[2] >= PURCHASE_WINDOW_CLOSE_KST) {
        errors.push(`${g.gameId}: 최종 판단 시각이 23:00 이상`);
      }
    }
    if (g.officialCloseVerified !== false || g.officialSalesCloseKst !== null) {
      errors.push(`${g.gameId}: 공식 마감 필드 불일치`);
    }
    if (!g.warnings.includes("OFFICIAL_CLOSE_UNVERIFIED")) {
      errors.push(`${g.gameId}: OFFICIAL_CLOSE_UNVERIFIED 누락`);
    }
    // 새벽/오전좁은창: 최종 판단이 심야·새벽(00~07)이면 안 됨
    if (
      (g.bucket === "PREVIOUS_DAY_DECISION_REQUIRED" ||
        g.bucket === "CONDITIONAL_MORNING_WINDOW") &&
      decisionMatch
    ) {
      if (decisionMatch[2] < PURCHASE_WINDOW_OPEN_KST) {
        errors.push(
          `${g.gameId}: 전날 결정 경기 최종 판단이 심야/새벽 (${g.recommendedFinalDecisionKst})`,
        );
      }
    }
  }
  return errors;
}

/** 단위 검증용 더미 경기 (API 없이) */
export function buildSelfCheckFixtures(targetDateKst: string): GameData[] {
  const prev = previousKstDate(targetDateKst);
  void prev;
  return [
    {
      id: "fixture-0115",
      sport: "baseball",
      league: "MLB",
      homeTeam: "Dawn Home",
      awayTeam: "Dawn Away",
      startTime: "01:15",
      date: targetDateKst,
      aiAnalysisAvailable: false,
    },
    {
      id: "fixture-0310",
      sport: "baseball",
      league: "MLB",
      homeTeam: "Late Dawn Home",
      awayTeam: "Late Dawn Away",
      startTime: "03:10",
      date: targetDateKst,
      aiAnalysisAvailable: false,
    },
    {
      id: "fixture-0820",
      sport: "baseball",
      league: "MLB",
      homeTeam: "Morning Home",
      awayTeam: "Morning Away",
      startTime: "08:20",
      date: targetDateKst,
      aiAnalysisAvailable: false,
    },
    {
      id: "fixture-1000",
      sport: "baseball",
      league: "MLB",
      homeTeam: "Day Home",
      awayTeam: "Day Away",
      startTime: "10:00",
      date: targetDateKst,
      aiAnalysisAvailable: false,
    },
  ];
}

export function runPurchasePlanSelfCheck(targetDateKst: string): string[] {
  const prev = previousKstDate(targetDateKst);
  // 전날 12:00 — 아직 마감 전
  const nowMs = kstMs(prev, "12:00");
  const plan = buildPurchaseDecisionPlan({
    targetDateKst,
    games: buildSelfCheckFixtures(targetDateKst),
    nowMs,
  });
  const errors = assertPurchasePlanInvariants(plan);
  const byId = new Map(plan.games.map((g) => [g.gameId, g]));

  const dawn = byId.get("fixture-0115");
  if (!dawn || dawn.bucket !== "PREVIOUS_DAY_DECISION_REQUIRED") {
    errors.push("01:15 → PREVIOUS_DAY_DECISION_REQUIRED 실패");
  }
  if (dawn && !dawn.recommendedFinalDecisionKst.startsWith(`${prev} 22:50`)) {
    errors.push(`01:15 최종 판단 마감 실패: ${dawn.recommendedFinalDecisionKst}`);
  }

  const lateDawn = byId.get("fixture-0310");
  if (!lateDawn || lateDawn.bucket !== "PREVIOUS_DAY_DECISION_REQUIRED") {
    errors.push("03:10 → PREVIOUS_DAY_DECISION_REQUIRED 실패");
  }
  if (
    lateDawn &&
    !lateDawn.recommendedFinalDecisionKst.startsWith(`${prev} 22:50`)
  ) {
    errors.push(`03:10 최종 판단 마감 실패: ${lateDawn.recommendedFinalDecisionKst}`);
  }

  const morning = byId.get("fixture-0820");
  if (!morning || morning.bucket !== "CONDITIONAL_MORNING_WINDOW") {
    errors.push("08:20 → CONDITIONAL_MORNING_WINDOW 실패");
  }
  if (
    morning &&
    !morning.recommendedFinalDecisionKst.startsWith(`${prev} 22:50`)
  ) {
    errors.push(`08:20 최종 판단 마감 실패: ${morning.recommendedFinalDecisionKst}`);
  }

  const day = byId.get("fixture-1000");
  if (!day || day.bucket !== "SAME_DAY_DECISION_AVAILABLE") {
    errors.push("10:00 → SAME_DAY_DECISION_AVAILABLE 실패");
  }

  return errors;
}
