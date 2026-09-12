import type {Normalized1x2} from "./contract-v1";

export function normalize1x2(
  home: number | null | undefined,
  draw: number | null | undefined,
  away: number | null | undefined,
): Normalized1x2 {
  if (home == null || draw == null || away == null) return {status: "MISSING"};
  if (
    ![home, draw, away].every(
      (odds) => typeof odds === "number" && Number.isFinite(odds) && odds > 1,
    )
  ) {
    return {status: "MALFORMED"};
  }
  const raw = {home: 1 / home, draw: 1 / draw, away: 1 / away};
  const sum = raw.home + raw.draw + raw.away;
  if (!Number.isFinite(sum) || !(sum > 0)) return {status: "MALFORMED"};
  return {
    status: "OK",
    raw,
    normalized: {home: raw.home / sum, draw: raw.draw / sum, away: raw.away / sum},
  };
}

export function fairOdds(probability: number | null): number | null {
  if (probability == null || !(probability > 0) || !Number.isFinite(probability)) return null;
  return 1 / probability;
}

export function probabilityDifference(
  model: number | null,
  market: number | null,
): number | null {
  if (model == null || market == null) return null;
  return model - market;
}
