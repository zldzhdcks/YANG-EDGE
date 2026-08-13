import type { FootballCompetitionProfile } from "../competition/profiles";
import type {
  FootballMatchFormat,
  FootballPredictionEligibility,
} from "./types";

/**
 * v1: do not guess UCL/UEL group vs knockout from round strings.
 * Profile `defaultMatchFormat` is authoritative.
 */
export function resolveMatchFormat(
  profile: FootballCompetitionProfile,
): FootballMatchFormat {
  return profile.defaultMatchFormat;
}

/**
 * 1. Identity fail → IDENTITY_BLOCKED
 * 2. Competition research-disabled / blocked → COMPETITION_BLOCKED
 * 3. Profile not a prediction target → NOT_SUPPORTED_FORMAT
 * 4. matchFormat != LEAGUE_MATCH → NOT_SUPPORTED_FORMAT
 * 5. else → ELIGIBLE_FORMAT
 */
export function resolvePredictionEligibility(input: {
  identityOk: boolean;
  matchFormat: FootballMatchFormat;
  profile: Pick<
    FootballCompetitionProfile,
    "researchStatus" | "predictionEligibility"
  >;
}): FootballPredictionEligibility {
  if (!input.identityOk) return "IDENTITY_BLOCKED";
  if (
    input.profile.researchStatus === "DISABLED" ||
    input.profile.researchStatus === "IDENTITY_REVIEW_REQUIRED"
  ) {
    return "COMPETITION_BLOCKED";
  }
  if (input.profile.predictionEligibility !== "ELIGIBLE_FORMAT") {
    return "NOT_SUPPORTED_FORMAT";
  }
  if (input.matchFormat !== "LEAGUE_MATCH") {
    return "NOT_SUPPORTED_FORMAT";
  }
  return "ELIGIBLE_FORMAT";
}
