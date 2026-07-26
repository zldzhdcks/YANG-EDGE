/**
 * MLB Baseline 후보 → 단폴 베팅 라인 검토 분류.
 *
 * Engine / Market / Odds 계산식은 변경하지 않는다.
 * Confidence는 자동 탈락 기준이 아니다 (warning·경계 분류만).
 */

export type BettingLineClass =
  | "REVIEW_PRIORITY"
  | "REVIEW_SECONDARY"
  | "MARKET_CONFLICT"
  | "INSUFFICIENT";

export type MarketDataQualityTag =
  | "complete"
  | "incomplete-odds"
  | "model-not-compatible"
  | "no-odds"
  | string;

export type BettingLineCandidateInput = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  pickTeam: string | null;
  pickTeamId: "home" | "away" | null;
  startTimeKst: string;
  dateKst: string;
  edgeScore: number | null;
  confidence: number | null;
  modelWinProbability: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  dataAvailability: number | null;
  marketDataQuality: MarketDataQualityTag | null;
  bestHomeOdds: number | null;
  bestAwayOdds: number | null;
  recentSampleHome: number | null;
  recentSampleAway: number | null;
  missingData: string[];
  baselineWarnings: string[];
};

export type BettingLineFilterResult = {
  gameId: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  pickTeam: string | null;
  pickTeamId: "home" | "away" | null;
  startTimeKst: string;
  dateKst: string;
  bestOdds: number | null;
  modelWinProbability: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  edgeScore: number | null;
  confidence: number | null;
  dataAvailability: number | null;
  classification: BettingLineClass;
  warnings: string[];
  missingData: string[];
  reasons: string[];
};

const CLASS_ORDER: Record<BettingLineClass, number> = {
  REVIEW_PRIORITY: 0,
  REVIEW_SECONDARY: 1,
  MARKET_CONFLICT: 2,
  INSUFFICIENT: 3,
};

const COMPARABLE_QUALITY = new Set(["complete"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function absEdge(edgeScore: number | null): number | null {
  return isFiniteNumber(edgeScore) ? Math.abs(edgeScore) : null;
}

export function isComparableMarketQuality(
  quality: MarketDataQualityTag | null | undefined,
): boolean {
  return quality != null && COMPARABLE_QUALITY.has(quality);
}

export function pickBestOdds(input: {
  pickTeamId: "home" | "away" | null;
  bestHomeOdds: number | null;
  bestAwayOdds: number | null;
}): number | null {
  if (input.pickTeamId === "home") {
    return isFiniteNumber(input.bestHomeOdds) && input.bestHomeOdds > 1
      ? input.bestHomeOdds
      : null;
  }
  if (input.pickTeamId === "away") {
    return isFiniteNumber(input.bestAwayOdds) && input.bestAwayOdds > 1
      ? input.bestAwayOdds
      : null;
  }
  return null;
}

/**
 * BASELINE_CANDIDATE 1건을 단폴 검토 분류로 판정한다.
 * 조합(2폴·3폴) 계산은 하지 않는다.
 */
export function classifyBettingLine(
  input: BettingLineCandidateInput,
): BettingLineFilterResult {
  const warnings = [...input.baselineWarnings];
  const missingData = [...input.missingData];
  const reasons: string[] = [];

  if (isFiniteNumber(input.confidence) && input.confidence < 50) {
    warnings.push("Confidence < 50");
  }
  // Confidence 50 이상도 신뢰 보장으로 표현하지 않음 (warning 추가 없음)

  const edgeAbs = absEdge(input.edgeScore);
  const hasMarketProbability = isFiniteNumber(input.marketProbability);
  const hasValueEdge = isFiniteNumber(input.valueEdge);
  const dataAvailability = input.dataAvailability;
  const recentHome = input.recentSampleHome;
  const recentAway = input.recentSampleAway;
  const comparable = isComparableMarketQuality(input.marketDataQuality);
  const bestOdds = pickBestOdds(input);

  const insufficientReasons: string[] = [];
  if (!hasMarketProbability) {
    insufficientReasons.push("시장 확률 없음");
  }
  if (!isFiniteNumber(dataAvailability) || dataAvailability < 0.7) {
    insufficientReasons.push("dataAvailability < 0.70");
  }
  if (
    !isFiniteNumber(recentHome) ||
    !isFiniteNumber(recentAway) ||
    recentHome < 5 ||
    recentAway < 5
  ) {
    insufficientReasons.push("최근 경기 표본 부족");
  }
  if (
    !comparable ||
    input.marketDataQuality === "incomplete-odds" ||
    input.marketDataQuality === "no-odds"
  ) {
    insufficientReasons.push("배당 불완전 또는 비교 불가");
  }
  if (!hasValueEdge) {
    insufficientReasons.push("Value Edge 없음");
  }

  let classification: BettingLineClass;

  if (insufficientReasons.length > 0) {
    classification = "INSUFFICIENT";
    reasons.push(...insufficientReasons);
  } else if (edgeAbs == null || edgeAbs < 10) {
    classification = "INSUFFICIENT";
    reasons.push("|EDGE Score| < 10");
  } else if ((input.valueEdge as number) <= 0) {
    classification = "MARKET_CONFLICT";
    reasons.push("|EDGE| >= 10 이지만 Value Edge <= 0");
  } else {
    // |EDGE| >= 10 && Value Edge > 0 && 기본 데이터 충족
    const boundary =
      (isFiniteNumber(input.confidence) && input.confidence < 50) ||
      dataAvailability === 0.7;

    if (boundary) {
      classification = "REVIEW_SECONDARY";
      if (isFiniteNumber(input.confidence) && input.confidence < 50) {
        reasons.push("Value Edge 양수이나 Confidence < 50 경계");
      }
      if (dataAvailability === 0.7) {
        reasons.push("Value Edge 양수이나 dataAvailability = 0.70 경계");
      }
    } else {
      classification = "REVIEW_PRIORITY";
      reasons.push(
        "|EDGE| >= 10, Value Edge > 0, 시장·표본·배당 비교 가능",
      );
    }
  }

  return {
    gameId: input.gameId,
    match: `${input.homeTeam} vs ${input.awayTeam}`,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    pickTeam: input.pickTeam,
    pickTeamId: input.pickTeamId,
    startTimeKst: input.startTimeKst,
    dateKst: input.dateKst,
    bestOdds,
    modelWinProbability: input.modelWinProbability,
    marketProbability: input.marketProbability,
    valueEdge: input.valueEdge,
    edgeScore: input.edgeScore,
    confidence: input.confidence,
    dataAvailability: input.dataAvailability,
    classification,
    warnings: [...new Set(warnings)],
    missingData: [...new Set(missingData)],
    reasons,
  };
}

export function sortBettingLineResults(
  rows: BettingLineFilterResult[],
): BettingLineFilterResult[] {
  return [...rows].sort((a, b) => {
    const classDiff =
      CLASS_ORDER[a.classification] - CLASS_ORDER[b.classification];
    if (classDiff !== 0) return classDiff;

    const valueDiff =
      (b.valueEdge ?? Number.NEGATIVE_INFINITY) -
      (a.valueEdge ?? Number.NEGATIVE_INFINITY);
    if (valueDiff !== 0) return valueDiff;

    const edgeDiff =
      Math.abs(b.edgeScore ?? 0) - Math.abs(a.edgeScore ?? 0);
    if (edgeDiff !== 0) return edgeDiff;

    const confDiff =
      (b.confidence ?? Number.NEGATIVE_INFINITY) -
      (a.confidence ?? Number.NEGATIVE_INFINITY);
    if (confDiff !== 0) return confDiff;

    const timeDiff = a.startTimeKst.localeCompare(b.startTimeKst);
    if (timeDiff !== 0) return timeDiff;

    return a.gameId.localeCompare(b.gameId);
  });
}

export function filterBaselineBettingLines(
  candidates: BettingLineCandidateInput[],
): BettingLineFilterResult[] {
  return sortBettingLineResults(candidates.map(classifyBettingLine));
}
