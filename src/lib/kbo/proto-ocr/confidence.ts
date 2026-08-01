/**
 * Explicit fixed-rule confidence for Proto OCR draft rows.
 * No learned weights. VERY_HIGH never auto-approves.
 */
import type {
  ProtoOcrConfidence,
  ProtoOcrConfidenceGrade,
  ProtoOcrMappingStatus,
} from "./types";

export function gradeConfidence(overall: number | null): ProtoOcrConfidenceGrade {
  if (overall == null) return "UNKNOWN";
  if (overall >= 0.95) return "VERY_HIGH";
  if (overall >= 0.85) return "HIGH";
  if (overall >= 0.7) return "MEDIUM";
  return "LOW";
}

export function computeProtoOcrConfidence(input: {
  textRecognitionConfidence: number | null;
  teamResolved: boolean;
  pricesResolved: boolean;
  scheduleMatched: boolean;
  ambiguous: boolean;
  directionMismatch: boolean;
  invalidPrice: boolean;
  parserWarnings: string[];
  mappingStatus: ProtoOcrMappingStatus;
}): ProtoOcrConfidence {
  const reviewReasons: string[] = [];
  const text = input.textRecognitionConfidence;
  const teamResolutionConfidence = input.teamResolved ? 0.95 : 0.2;
  const oddsRecognitionConfidence = input.pricesResolved ? 0.9 : 0.2;
  const layoutAssociationConfidence = input.pricesResolved && input.teamResolved ? 0.85 : 0.4;
  const scheduleIdentityConfidence = input.scheduleMatched ? 0.95 : 0.15;

  const parts = [
    text,
    teamResolutionConfidence,
    oddsRecognitionConfidence,
    layoutAssociationConfidence,
    scheduleIdentityConfidence,
  ].filter((n): n is number => typeof n === "number");

  let overall: number | null =
    parts.length === 5
      ? Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(4))
      : null;

  if (input.ambiguous) {
    reviewReasons.push("AMBIGUOUS");
    overall = overall == null ? null : Math.min(overall, 0.55);
  }
  if (input.directionMismatch) reviewReasons.push("DIRECTION_MISMATCH");
  if (input.invalidPrice) reviewReasons.push("INVALID_PRICE");
  if (!input.pricesResolved) reviewReasons.push("MISSING_PRICE");
  if (!input.teamResolved) reviewReasons.push("UNKNOWN_TEAM");
  if (!input.scheduleMatched) reviewReasons.push("NO_SCHEDULE_MATCH");
  if (input.parserWarnings.includes("MULTIPLE_MARKET_NUMBERS")) {
    reviewReasons.push("MULTIPLE_CANDIDATE_ODDS");
  }
  if (input.mappingStatus === "DUPLICATE_CANDIDATE") {
    reviewReasons.push("DUPLICATE_GAME");
  }
  if (input.mappingStatus === "CONFLICTING_CANDIDATES") {
    reviewReasons.push("CONFLICTING_CANDIDATES");
  }

  const reviewRequired =
    reviewReasons.length > 0 ||
    overall == null ||
    overall < 0.95 ||
    true; // ALWAYS require human review — OCR never auto-approves

  return {
    textRecognitionConfidence: text,
    teamResolutionConfidence,
    oddsRecognitionConfidence,
    layoutAssociationConfidence,
    scheduleIdentityConfidence,
    overallConfidence: overall,
    grade: gradeConfidence(overall),
    reviewRequired,
    reviewReasons: [...new Set(reviewReasons)],
  };
}
