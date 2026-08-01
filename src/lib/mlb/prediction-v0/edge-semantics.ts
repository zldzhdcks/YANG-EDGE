/**
 * Additive MONEYLINE edge semantics for MLB Prediction v0 reporting.
 * Does not change model probabilities or frozen snapshot payloads.
 *
 * researchBaseline / mostLikelySelection = higher model probability side
 * valueSelection = side with positive model−market edge (optional threshold)
 */
import { round6 } from "./math";

export type MoneylineEdgeSemantics = {
  homeModelProbability: number;
  awayModelProbability: number;
  marketHomeProbability: number | null;
  marketAwayProbability: number | null;
  homeModelEdge: number | null;
  awayModelEdge: number | null;
  /** Higher model win probability side (same intent as researchBaseline.selection). */
  mostLikelySelection: "HOME" | "AWAY";
  mostLikelyProbability: number;
  marketProbabilityForMostLikely: number | null;
  /** modelP(mostLikely) − marketP(mostLikely). May be negative. */
  selectedSideEdge: number | null;
  /**
   * Side with the larger strictly-positive model−market edge, else null.
   * Distinct from mostLikelySelection.
   */
  valueSelection: "HOME" | "AWAY" | null;
  valueEdge: number | null;
  /** modelEdgeHome + modelEdgeAway ≈ 0 when both markets present. */
  edgeComplementSum: number | null;
};

export function deriveMoneylineEdgeSemantics(input: {
  homeProbability: number;
  awayProbability: number;
  marketHomeProbability: number | null;
  marketAwayProbability: number | null;
  /** Optional floor for valueSelection (default 0 = any positive). */
  valueEdgeMin?: number;
}): MoneylineEdgeSemantics {
  const homeP = input.homeProbability;
  const awayP = input.awayProbability;
  const mktH = input.marketHomeProbability;
  const mktA = input.marketAwayProbability;
  const minValue = input.valueEdgeMin ?? 0;

  const homeModelEdge =
    mktH != null && Number.isFinite(mktH) ? round6(homeP - mktH) : null;
  const awayModelEdge =
    mktA != null && Number.isFinite(mktA) ? round6(awayP - mktA) : null;

  const mostLikelySelection: "HOME" | "AWAY" = homeP >= awayP ? "HOME" : "AWAY";
  const mostLikelyProbability =
    mostLikelySelection === "HOME" ? homeP : awayP;
  const marketProbabilityForMostLikely =
    mostLikelySelection === "HOME" ? mktH : mktA;
  const selectedSideEdge =
    mostLikelySelection === "HOME" ? homeModelEdge : awayModelEdge;

  let valueSelection: "HOME" | "AWAY" | null = null;
  let valueEdge: number | null = null;
  if (homeModelEdge != null && awayModelEdge != null) {
    const homeOk = homeModelEdge > minValue;
    const awayOk = awayModelEdge > minValue;
    if (homeOk && (!awayOk || homeModelEdge >= awayModelEdge)) {
      valueSelection = "HOME";
      valueEdge = homeModelEdge;
    } else if (awayOk) {
      valueSelection = "AWAY";
      valueEdge = awayModelEdge;
    }
  } else if (homeModelEdge != null && homeModelEdge > minValue) {
    valueSelection = "HOME";
    valueEdge = homeModelEdge;
  } else if (awayModelEdge != null && awayModelEdge > minValue) {
    valueSelection = "AWAY";
    valueEdge = awayModelEdge;
  }

  const edgeComplementSum =
    homeModelEdge != null && awayModelEdge != null
      ? round6(homeModelEdge + awayModelEdge)
      : null;

  return {
    homeModelProbability: homeP,
    awayModelProbability: awayP,
    marketHomeProbability: mktH,
    marketAwayProbability: mktA,
    homeModelEdge,
    awayModelEdge,
    mostLikelySelection,
    mostLikelyProbability,
    marketProbabilityForMostLikely,
    selectedSideEdge,
    valueSelection,
    valueEdge,
    edgeComplementSum,
  };
}
