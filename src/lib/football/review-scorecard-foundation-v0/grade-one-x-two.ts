/**
 * 3-way MONEYLINE_3WAY_1X2 exact-match grade.
 * DRAW is a first-class outcome — never absorb into HOME/AWAY.
 */
import type {
  FootballGradeBlockReason,
  FootballOneXTwoGradeInput,
  FootballOneXTwoGradeResult,
  FootballOneXTwoSide,
} from "./types";

const TERMINAL_BLOCKS: FootballGradeBlockReason[] = [
  "NOT_FINAL",
  "VOID",
  "POSTPONED",
  "CANCELLED",
  "ABANDONED",
  "SUSPENDED",
];

export function gradeFootballOneXTwo(
  input: FootballOneXTwoGradeInput,
): FootballOneXTwoGradeResult {
  if (input.marketType !== "MONEYLINE_3WAY_1X2") {
    return {
      matchId: input.matchId,
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide: input.predictedSide,
      actualSide: input.actualSide,
      verdict: "GRADING_BLOCKED",
      blockReason: "UNSUPPORTED_MARKET",
      sampleLane: input.sampleLane,
      exactMatch: null,
    };
  }

  if (!input.gradingAllowed) {
    const block =
      input.blockReason && TERMINAL_BLOCKS.includes(input.blockReason)
        ? input.blockReason
        : input.blockReason ?? "RESULT_NOT_GRADABLE";
    return {
      matchId: input.matchId,
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide: input.predictedSide,
      actualSide: input.actualSide,
      verdict: "GRADING_BLOCKED",
      blockReason: block,
      sampleLane: input.sampleLane,
      exactMatch: null,
    };
  }

  if (input.predictedSide == null) {
    return {
      matchId: input.matchId,
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide: null,
      actualSide: input.actualSide,
      verdict: "GRADING_BLOCKED",
      blockReason: "PREDICTION_SIDE_MISSING",
      sampleLane: input.sampleLane,
      exactMatch: null,
    };
  }

  if (input.actualSide == null) {
    return {
      matchId: input.matchId,
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide: input.predictedSide,
      actualSide: null,
      verdict: "GRADING_BLOCKED",
      blockReason: "RESULT_NOT_GRADABLE",
      sampleLane: input.sampleLane,
      exactMatch: null,
    };
  }

  const exactMatch = input.predictedSide === input.actualSide;
  return {
    matchId: input.matchId,
    marketType: "MONEYLINE_3WAY_1X2",
    predictedSide: input.predictedSide,
    actualSide: input.actualSide,
    verdict: exactMatch ? "CORRECT" : "INCORRECT",
    blockReason: null,
    sampleLane: input.sampleLane,
    exactMatch,
  };
}

/** Map result foundation usability / status strings to block reasons. */
export function blockReasonFromResultStatus(
  status: string,
): FootballGradeBlockReason {
  switch (status) {
    case "NOT_FINAL":
    case "LIVE":
    case "HALFTIME":
    case "SCHEDULED":
      return "NOT_FINAL";
    case "VOID":
    case "VOID_NOT_GRADED":
      return "VOID";
    case "POSTPONED":
    case "POSTPONED_NOT_GRADED":
      return "POSTPONED";
    case "CANCELLED":
    case "CANCELLED_NOT_GRADED":
      return "CANCELLED";
    case "ABANDONED":
    case "ABANDONED_REVIEW_REQUIRED":
      return "ABANDONED";
    case "SUSPENDED":
    case "SUSPENDED_NOT_GRADED":
      return "SUSPENDED";
    default:
      return "RESULT_NOT_GRADABLE";
  }
}

export function isValidOneXTwoSide(v: unknown): v is FootballOneXTwoSide {
  return v === "HOME" || v === "DRAW" || v === "AWAY";
}
