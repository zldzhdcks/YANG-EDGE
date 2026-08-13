import type { FootballMarketBaselineOutcome } from "./types";

export function isValidFrozenMarketProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1;
}

export function renormalizeFrozenMedianDevig(input: {
  home: number;
  draw: number;
  away: number;
}): {
  rawMedianSum: number;
  normalizedHome: number;
  normalizedDraw: number;
  normalizedAway: number;
} {
  const rawMedianSum = input.home + input.draw + input.away;
  if (!Number.isFinite(rawMedianSum) || rawMedianSum <= 0) {
    throw new Error("FOOTBALL_MARKET_BASELINE_INVALID_FROZEN_PROBABILITIES");
  }
  return {
    rawMedianSum,
    normalizedHome: input.home / rawMedianSum,
    normalizedDraw: input.draw / rawMedianSum,
    normalizedAway: input.away / rawMedianSum,
  };
}

export function argmaxNormalizedMarketProbability(input: {
  normalizedHome: number;
  normalizedDraw: number;
  normalizedAway: number;
}): {
  outcome: FootballMarketBaselineOutcome | null;
  probability: number | null;
  ambiguous: boolean;
} {
  const ranked: { outcome: FootballMarketBaselineOutcome; probability: number }[] =
    [
      { outcome: "HOME", probability: input.normalizedHome },
      { outcome: "DRAW", probability: input.normalizedDraw },
      { outcome: "AWAY", probability: input.normalizedAway },
    ];
  let max = -Infinity;
  for (const row of ranked) {
    if (row.probability > max) max = row.probability;
  }
  const winners = ranked.filter((row) => row.probability === max);
  if (winners.length !== 1) {
    return { outcome: null, probability: null, ambiguous: true };
  }
  return {
    outcome: winners[0]!.outcome,
    probability: winners[0]!.probability,
    ambiguous: false,
  };
}
