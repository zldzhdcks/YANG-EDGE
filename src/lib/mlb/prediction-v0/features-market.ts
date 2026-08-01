/**
 * Market prior — de-vig decimal moneyline; never copy as final pick.
 */
import { buildMarketComparison } from "@/lib/market/build-market-comparison";
import type { FeatureProvenance, MarketFeature } from "./types";

export function buildMarketFeature(args: {
  homeOdds: number | null;
  awayOdds: number | null;
  provenance: FeatureProvenance;
}): MarketFeature {
  const { homeOdds, awayOdds, provenance } = args;
  const warnings = [...provenance.warning];

  if (homeOdds == null || awayOdds == null) {
    return {
      homeOdds,
      awayOdds,
      oddsFormat: homeOdds == null && awayOdds == null ? "UNKNOWN" : "INVALID",
      marketProbabilityHome: null,
      marketProbabilityAway: null,
      overround: null,
      oddsQuality: "MISSING",
      provenance: {
        ...provenance,
        warning: [...warnings, "MONEYLINE_INCOMPLETE"],
      },
    };
  }

  if (homeOdds <= 1 || awayOdds <= 1) {
    return {
      homeOdds,
      awayOdds,
      oddsFormat: "INVALID",
      marketProbabilityHome: null,
      marketProbabilityAway: null,
      overround: null,
      oddsQuality: "INVALID",
      provenance: {
        ...provenance,
        warning: [...warnings, "MONEYLINE_INVALID_DECIMAL"],
      },
    };
  }

  const cmp = buildMarketComparison({
    odds: { homeOdds, awayOdds },
    marketType: "two-way",
  });

  if (
    cmp.dataQuality !== "complete" ||
    cmp.normalizedProbabilities.home == null ||
    cmp.normalizedProbabilities.away == null
  ) {
    return {
      homeOdds,
      awayOdds,
      oddsFormat: "DECIMAL",
      marketProbabilityHome: null,
      marketProbabilityAway: null,
      overround: cmp.overround,
      oddsQuality: "INVALID",
      provenance: {
        ...provenance,
        warning: [...warnings, "MONEYLINE_NORMALIZE_FAILED"],
      },
    };
  }

  return {
    homeOdds,
    awayOdds,
    oddsFormat: "DECIMAL",
    marketProbabilityHome: cmp.normalizedProbabilities.home,
    marketProbabilityAway: cmp.normalizedProbabilities.away,
    overround: cmp.overround,
    oddsQuality: "GOOD",
    provenance,
  };
}
