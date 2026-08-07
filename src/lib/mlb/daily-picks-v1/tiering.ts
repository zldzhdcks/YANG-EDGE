import type { DailyPickReasonCode, DailyPickStars, DailyPickTier } from "./types";

/** Display-only confidence tiers. Does not alter stored confidence values. */
export function tierFromConfidence(confidence: number | null): DailyPickTier {
  if (confidence == null) return "PASS";
  if (confidence >= 80) return "STRONG";
  if (confidence >= 70) return "GOOD";
  if (confidence >= 60) return "LEAN";
  if (confidence >= 40) return "PASS";
  return "AVOID";
}

export function starsForTier(tier: DailyPickTier): DailyPickStars {
  switch (tier) {
    case "STRONG":
      return 5;
    case "GOOD":
      return 4;
    case "LEAN":
      return 3;
    case "PASS":
      return 2;
    case "AVOID":
      return 1;
  }
}

export function starLabel(stars: DailyPickStars): string {
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

export function tierTitle(tier: DailyPickTier): string {
  switch (tier) {
    case "STRONG":
      return "Strong Pick";
    case "GOOD":
      return "Good Pick";
    case "LEAN":
      return "Lean";
    case "PASS":
      return "PASS";
    case "AVOID":
      return "Avoid";
  }
}

export function passReasonLabel(code: DailyPickReasonCode): string {
  switch (code) {
    case "COIN_FLIP":
      return "Coin Flip";
    case "MODEL_UNCERTAIN":
      return "Model Uncertain";
    case "LINEUP_MISSING":
      return "Lineup Missing";
    case "INPUT_LIMITED":
      return "Input Limited";
    case "MARKET_CONFLICT":
      return "Market Conflict";
    case "BLOCKED":
      return "Blocked";
    case "LOW_CONFIDENCE":
      return "Low Confidence";
    case "STARTER_LIMITED":
      return "Starter Limited";
    case "RESEARCH_ONLY_PASS":
      return "Research Only / Official PASS";
  }
}
