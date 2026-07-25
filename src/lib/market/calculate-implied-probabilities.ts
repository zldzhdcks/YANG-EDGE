/**
 * 소수 배당 → 단순 내재 확률 (마진 제거 전).
 * implied = 1 / decimalOdds
 *
 * NaN / Infinity / 비양수 배당은 null.
 */

export function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** 소수 4자리 반올림 — 동일 입력 → 동일 출력 */
export function roundProb(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * 단일 배당의 raw implied probability.
 * 유효하지 않으면 null (0·음수·NaN 방어).
 */
export function oddsToRawProbability(odds: number | null | undefined): number | null {
  if (!isFinitePositive(odds)) return null;
  const p = 1 / odds;
  if (!Number.isFinite(p) || p <= 0) return null;
  return roundProb(p);
}

export type RawImpliedResult = {
  home: number | null;
  away: number | null;
  draw: number | null;
  /** 유효한 raw 확률의 합. 모두 null 이면 null */
  sum: number | null;
};

/**
 * 2-way / 3-way raw 확률.
 * drawOdds 가 유효하면 draw 를 채운다 (호출자가 marketType 을 결정).
 */
export function calculateImpliedProbabilities(input: {
  homeOdds: number | null | undefined;
  awayOdds: number | null | undefined;
  drawOdds?: number | null | undefined;
}): RawImpliedResult {
  const home = oddsToRawProbability(input.homeOdds);
  const away = oddsToRawProbability(input.awayOdds);
  const draw =
    input.drawOdds === undefined || input.drawOdds === null
      ? null
      : oddsToRawProbability(input.drawOdds);

  const parts = [home, away, draw].filter((p): p is number => p != null);
  const sum = parts.length === 0 ? null : roundProb(parts.reduce((a, b) => a + b, 0));

  return { home, away, draw, sum };
}
