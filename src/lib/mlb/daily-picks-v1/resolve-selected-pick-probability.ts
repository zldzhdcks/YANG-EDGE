/**
 * Selected-pick probability semantics for Daily Picks / Recommendation records.
 *
 * Contract (future recommendations):
 *   probability / modelProbabilityPercent = P(selected pick wins) as percent.
 *
 * Prediction snapshot fields (do not mutate Engine):
 * - marketPredictions[].homeProbability — HOME win probability (0–1)
 * - marketPredictions[].researchBaseline.probability — SELECTED-side (0–1)
 * - top-level modelProbability — LEGACY ambiguous: HOME win % (not pick %)
 *
 * Prefer researchBaseline.probability / side-resolved home|away.
 * Never treat top-level modelProbability as selected-pick without side check.
 */

import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";

export type SelectedPickProbabilityResolution = {
  /** P(selected pick wins) as percent, 1-decimal when from 0–1 unit. */
  selectedPickProbabilityPercent: number | null;
  /** Explicit HOME win probability percent when available. */
  homeWinProbabilityPercent: number | null;
  pickSide: "HOME" | "AWAY" | null;
  /** Where selected-pick % was taken from. */
  source:
    | "market_research_baseline"
    | "home_away_by_side"
    | "legacy_top_level_inverted"
    | "legacy_top_level_home_as_pick"
    | "unavailable";
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function unitToPercent(unit: number): number {
  return round1(unit * 100);
}

/**
 * Resolve selected-pick win probability (%) from a Prediction game row.
 * Pure / presentation — does not change Engine or sealed artifacts.
 */
export function resolveSelectedPickProbability(
  pred: Record<string, unknown>,
): SelectedPickProbabilityResolution {
  const ml = asRecord(
    (Array.isArray(pred.marketPredictions) ? pred.marketPredictions : []).find(
      (m) => asString(asRecord(m)?.marketType) === "MONEYLINE_2WAY",
    ),
  );

  const selRaw = asString(asRecord(ml?.researchBaseline)?.selection);
  const pickSide: "HOME" | "AWAY" | null =
    selRaw === "HOME" || selRaw === "AWAY" ? selRaw : null;

  const homeUnit = asNumber(ml?.homeProbability);
  const awayUnit = asNumber(ml?.awayProbability);
  const homeWinProbabilityPercent =
    homeUnit != null ? unitToPercent(homeUnit) : null;

  const baselineUnit = asNumber(asRecord(ml?.researchBaseline)?.probability);
  if (
    baselineUnit != null &&
    Number.isFinite(baselineUnit) &&
    baselineUnit >= 0 &&
    baselineUnit <= 1
  ) {
    return {
      selectedPickProbabilityPercent: unitToPercent(baselineUnit),
      homeWinProbabilityPercent,
      pickSide,
      source: "market_research_baseline",
    };
  }

  if (pickSide === "HOME" && homeUnit != null) {
    return {
      selectedPickProbabilityPercent: unitToPercent(homeUnit),
      homeWinProbabilityPercent,
      pickSide,
      source: "home_away_by_side",
    };
  }
  if (pickSide === "AWAY" && awayUnit != null) {
    return {
      selectedPickProbabilityPercent: unitToPercent(awayUnit),
      homeWinProbabilityPercent,
      pickSide,
      source: "home_away_by_side",
    };
  }
  if (pickSide === "AWAY" && homeUnit != null) {
    return {
      selectedPickProbabilityPercent: unitToPercent(1 - homeUnit),
      homeWinProbabilityPercent,
      pickSide,
      source: "home_away_by_side",
    };
  }

  // Legacy top-level modelProbability is HOME win % in mlb-prediction-v0.
  const legacyHomePct = asNumber(pred.modelProbability);
  if (legacyHomePct != null && Number.isFinite(legacyHomePct)) {
    if (pickSide === "AWAY") {
      return {
        selectedPickProbabilityPercent: round1(100 - legacyHomePct),
        homeWinProbabilityPercent: legacyHomePct,
        pickSide,
        source: "legacy_top_level_inverted",
      };
    }
    if (pickSide === "HOME") {
      return {
        selectedPickProbabilityPercent: legacyHomePct,
        homeWinProbabilityPercent: legacyHomePct,
        pickSide,
        source: "legacy_top_level_home_as_pick",
      };
    }
  }

  return {
    selectedPickProbabilityPercent: null,
    homeWinProbabilityPercent,
    pickSide,
    source: "unavailable",
  };
}

/**
 * Pure helper for tests / callers that already have home unit + side.
 * HOME → homeProbability; AWAY → 1 - homeProbability.
 */
export function selectedPickProbabilityFromHomeUnit(input: {
  homeProbability: number;
  pickSide: "HOME" | "AWAY";
}): number {
  const unit =
    input.pickSide === "HOME"
      ? input.homeProbability
      : 1 - input.homeProbability;
  return unitToPercent(unit);
}
