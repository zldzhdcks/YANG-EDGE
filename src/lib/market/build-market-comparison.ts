import { calculateImpliedProbabilities } from "./calculate-implied-probabilities";
import { removeBookmakerMargin } from "./remove-bookmaker-margin";
import {
  calculateValueEdgePercentagePoints,
  hasPositiveValueEdge,
  toUnitIntervalProbability,
} from "./calculate-value-edge";
import type {
  DecimalOddsInput,
  MarketComparison,
  MarketType,
  ModelProbabilityInput,
  OutcomeProbabilityMap,
} from "./types";

export type BuildMarketComparisonInput = {
  odds: DecimalOddsInput;
  /**
   * 명시적 시장 타입. 생략 시 drawOdds 유무로 추정.
   * 축구는 반드시 three-way 로 넘기는 것을 권장.
   */
  marketType?: MarketType;
  model?: ModelProbabilityInput | null;
};

function emptyMap(): OutcomeProbabilityMap {
  return { home: null, away: null, draw: null };
}

function baseResult(
  partial: Partial<MarketComparison> &
    Pick<MarketComparison, "marketType" | "dataQuality" | "statusMessage">,
): MarketComparison {
  return {
    marketType: partial.marketType,
    rawProbabilities: partial.rawProbabilities ?? emptyMap(),
    normalizedProbabilities: partial.normalizedProbabilities ?? emptyMap(),
    overround: partial.overround ?? null,
    modelProbability: partial.modelProbability ?? null,
    marketProbability: partial.marketProbability ?? null,
    valueEdgePercentagePoints: partial.valueEdgePercentagePoints ?? null,
    hasPositiveValue: partial.hasPositiveValue ?? false,
    dataQuality: partial.dataQuality,
    comparable: partial.comparable ?? false,
    statusMessage: partial.statusMessage,
  };
}

function resolveMarketType(
  odds: DecimalOddsInput,
  explicit?: MarketType,
): MarketType {
  if (explicit) return explicit;
  // drawOdds 가 숫자로 주어지면 3-way 후보 (유효성 검사는 아래에서)
  if (odds.drawOdds != null && odds.drawOdds !== undefined) return "three-way";
  return "two-way";
}

function oddsCompleteForMarket(
  marketType: MarketType,
  raw: { home: number | null; away: number | null; draw: number | null },
): boolean {
  if (marketType === "two-way") {
    return raw.home != null && raw.away != null;
  }
  return raw.home != null && raw.away != null && raw.draw != null;
}

/**
 * 최고 배당 → 시장 확률 → (가능하면) 모델 Value Edge.
 *
 * 규칙:
 * - 배당 없음 / 불완전 → 계산하지 않음 (incomplete-odds | no-odds)
 * - 야구 2-way + 모델 승률 → 비교 가능
 * - 축구 3-way + 모델이 2-way 승률만 → model-not-compatible
 *   (무승부 확률을 억지로 만들지 않음)
 * - 동일 입력 → 동일 결과 (순수 함수)
 */
export function buildMarketComparison(
  input: BuildMarketComparisonInput,
): MarketComparison {
  const marketType = resolveMarketType(input.odds, input.marketType);
  const { homeOdds, awayOdds, drawOdds } = input.odds;

  const hasAnyOdds =
    homeOdds != null ||
    awayOdds != null ||
    (marketType === "three-way" && drawOdds != null);

  if (!hasAnyOdds) {
    return baseResult({
      marketType,
      dataQuality: "no-odds",
      statusMessage: "배당 없음 — 시장 확률을 계산하지 않음",
    });
  }

  const implied = calculateImpliedProbabilities({
    homeOdds,
    awayOdds,
    drawOdds: marketType === "three-way" ? drawOdds : null,
  });

  if (!oddsCompleteForMarket(marketType, implied)) {
    return baseResult({
      marketType,
      rawProbabilities: {
        home: implied.home,
        away: implied.away,
        draw: marketType === "three-way" ? implied.draw : null,
      },
      dataQuality: "incomplete-odds",
      statusMessage:
        marketType === "three-way"
          ? "3-way 배당 불완전 — 홈/무/원정 중 일부 없음"
          : "2-way 배당 불완전 — 홈/원정 중 일부 없음",
    });
  }

  // 2-way 에서는 draw raw 를 결과에 넣지 않는다
  const rawForMargin = {
    home: implied.home,
    away: implied.away,
    draw: marketType === "three-way" ? implied.draw : null,
  };

  const { normalized, overround } = removeBookmakerMargin(rawForMargin);

  const rawProbabilities: OutcomeProbabilityMap = {
    home: implied.home,
    away: implied.away,
    draw: marketType === "three-way" ? implied.draw : null,
  };

  const model = input.model ?? null;
  const modelSupport: MarketType = model?.marketSupport ?? "two-way";

  // ── 3-way 시장 vs 2-way 전용 모델 ───────────────────────
  // 현재 EDGE Engine 은 추천 팀 승리 확률만 제공 (무승부 없음).
  if (marketType === "three-way" && modelSupport !== "three-way") {
    return baseResult({
      marketType,
      rawProbabilities,
      normalizedProbabilities: normalized,
      overround,
      dataQuality: "model-not-compatible",
      statusMessage:
        "시장 확률 준비됨 / 모델 3-way 확률 미지원 — Value Edge 비교 안 함",
      comparable: false,
    });
  }

  // 모델 없음 → 시장 확률만
  if (!model) {
    return baseResult({
      marketType,
      rawProbabilities,
      normalizedProbabilities: normalized,
      overround,
      dataQuality: "complete",
      statusMessage: "시장 확률만 계산됨 (모델 입력 없음)",
      comparable: false,
    });
  }

  // ── 2-way 비교 (또는 향후 3-way 모델 지원 시) ───────────
  if (marketType === "two-way" && modelSupport === "two-way") {
    const modelUnit = toUnitIntervalProbability(model.winProbability);
    const marketUnit =
      model.pickTeamId === "home" ? normalized.home : normalized.away;

    if (modelUnit == null || marketUnit == null) {
      return baseResult({
        marketType,
        rawProbabilities,
        normalizedProbabilities: normalized,
        overround,
        dataQuality: "incomplete-odds",
        statusMessage: "모델 또는 시장 확률이 유효하지 않음",
      });
    }

    const valueEdge = calculateValueEdgePercentagePoints(modelUnit, marketUnit);

    return baseResult({
      marketType,
      rawProbabilities,
      normalizedProbabilities: normalized,
      overround,
      modelProbability: modelUnit,
      marketProbability: marketUnit,
      valueEdgePercentagePoints: valueEdge,
      hasPositiveValue: hasPositiveValueEdge(valueEdge),
      dataQuality: "complete",
      comparable: true,
      statusMessage: "2-way Value Edge 비교 가능",
    });
  }

  // 모델이 3-way 를 지원한다고 표시된 경우 — 아직은 pick 승률만 있어
  // home/away 쪽만 비교 가능. draw 모델이 없으면 compatible 로 두지 않는다.
  if (marketType === "three-way" && modelSupport === "three-way") {
    return baseResult({
      marketType,
      rawProbabilities,
      normalizedProbabilities: normalized,
      overround,
      dataQuality: "model-not-compatible",
      statusMessage:
        "모델 3-way 플래그는 있으나 무승부 확률 입력이 없음 — 비교 보류",
      comparable: false,
    });
  }

  return baseResult({
    marketType,
    rawProbabilities,
    normalizedProbabilities: normalized,
    overround,
    dataQuality: "model-not-compatible",
    statusMessage: "시장 유형과 모델 지원 범위가 일치하지 않음",
  });
}
