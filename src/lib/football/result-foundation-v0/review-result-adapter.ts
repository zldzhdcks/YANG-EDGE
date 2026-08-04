/**
 * Review adapter contract — gradingAllowed only for FINAL usable 1X2.
 * Review formula NOT implemented.
 */
import type {
  FootballOfficialResultV0,
  FootballReviewResultAdapterV0,
  FootballResultUsabilityStatus,
} from "./types";

const USABLE: FootballResultUsabilityStatus[] = [
  "FINAL_USABLE",
  "FINAL_AFTER_EXTRA_TIME_USABLE",
  "FINAL_AFTER_PENALTIES_USABLE",
];

function asMarketOutcome(
  outcome: FootballOfficialResultV0["oneXTwoOutcome"],
): "HOME" | "DRAW" | "AWAY" | null {
  if (outcome === "HOME" || outcome === "DRAW" || outcome === "AWAY") {
    return outcome;
  }
  return null;
}

export function toFootballReviewResultAdapter(input: {
  result: FootballOfficialResultV0;
  usability: FootballResultUsabilityStatus;
}): FootballReviewResultAdapterV0 {
  const { result, usability } = input;
  const outcome = asMarketOutcome(result.oneXTwoOutcome);
  const gradingAllowed = USABLE.includes(usability) && outcome != null;

  return {
    matchId: result.matchId,
    marketType: "MONEYLINE_3WAY_1X2",
    outcome,
    gradingAllowed,
    reason: gradingAllowed ? null : usability,
    resultHash: result.resultHash,
  };
}
