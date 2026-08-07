/**
 * Decimal moneyline odds — presentation helpers only.
 * Implied probability is NEVER model probability.
 */

export function parseDecimalOdds(raw: number | string | null | undefined): {
  ok: boolean;
  value: number | null;
  error: string | null;
} {
  if (raw == null || raw === "") {
    return { ok: false, value: null, error: "ODDS_MISSING" };
  }
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) {
    return { ok: false, value: null, error: "ODDS_NOT_NUMERIC" };
  }
  if (!(n > 1)) {
    return { ok: false, value: null, error: "ODDS_MUST_BE_GT_1" };
  }
  return { ok: true, value: n, error: null };
}

export function impliedProbabilityFromDecimal(odds: number): number {
  return 1 / odds;
}

export function normalizeImpliedPair(
  awayOdds: number,
  homeOdds: number,
): { away: number; home: number } {
  const awayRaw = impliedProbabilityFromDecimal(awayOdds);
  const homeRaw = impliedProbabilityFromDecimal(homeOdds);
  const sum = awayRaw + homeRaw;
  if (!(sum > 0)) return { away: awayRaw, home: homeRaw };
  return { away: awayRaw / sum, home: homeRaw / sum };
}
