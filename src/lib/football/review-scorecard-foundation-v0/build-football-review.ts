/**
 * Football Review builders — RESEARCH and OFFICIAL lanes never mix.
 */
import { FOOTBALL_IDENTITY_VERSION } from "../foundation/types";
import { FOOTBALL_RESULT_FOUNDATION_VERSION } from "../result-foundation-v0/types";
import { gradeFootballOneXTwo } from "./grade-one-x-two";
import type {
  FootballOneXTwoGradeInput,
  FootballOneXTwoGradeResult,
  FootballReviewRecordV0,
  FootballSampleLane,
} from "./types";

function summarize(
  grades: FootballOneXTwoGradeResult[],
  lane: FootballSampleLane,
): FootballReviewRecordV0["summary"] {
  let graded = 0;
  let correct = 0;
  let incorrect = 0;
  let blocked = 0;
  for (const g of grades) {
    if (g.verdict === "GRADING_BLOCKED") blocked += 1;
    else {
      graded += 1;
      if (g.verdict === "CORRECT") correct += 1;
      else incorrect += 1;
    }
  }
  return {
    graded,
    correct,
    incorrect,
    blocked,
    observationNote:
      lane === "RESEARCH"
        ? "Research Review는 관찰용입니다. Official KPI와 혼합하지 않습니다."
        : "Official Review KPI lane — Research observation과 분리됩니다.",
  };
}

export function buildFootballReviewRecord(input: {
  dateKst: string;
  sampleLane: FootballSampleLane;
  grades: FootballOneXTwoGradeInput[];
  generatedAt?: string;
}): FootballReviewRecordV0 {
  const graded = input.grades.map((g) => {
    if (g.sampleLane !== input.sampleLane) {
      throw new Error("REVIEW_LANE_SAMPLE_MISMATCH");
    }
    return gradeFootballOneXTwo(g);
  });

  const summary = summarize(graded, input.sampleLane);
  const accuracy =
    summary.graded > 0 ? summary.correct / summary.graded : null;

  const isOfficial = input.sampleLane === "OFFICIAL";

  return {
    schemaVersion: "football-review-v0",
    reviewLane: isOfficial ? "OFFICIAL_REVIEW" : "RESEARCH_REVIEW",
    sampleLane: input.sampleLane,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dateKst: input.dateKst,
    identityVersion: FOOTBALL_IDENTITY_VERSION,
    resultFoundationVersion: FOOTBALL_RESULT_FOUNDATION_VERSION,
    grades: graded,
    summary,
    officialKpi: isOfficial
      ? { accuracy, eligible: summary.graded > 0 }
      : { accuracy: null, eligible: false },
  };
}

/** Refuse to merge research grades into an official review record. */
export function assertResearchOfficialSeparated(
  research: FootballReviewRecordV0,
  official: FootballReviewRecordV0,
): void {
  if (research.sampleLane !== "RESEARCH") {
    throw new Error("RESEARCH_LANE_EXPECTED");
  }
  if (official.sampleLane !== "OFFICIAL") {
    throw new Error("OFFICIAL_LANE_EXPECTED");
  }
  if (research.officialKpi.eligible) {
    throw new Error("RESEARCH_MUST_NOT_SET_OFFICIAL_KPI");
  }
  if (research.reviewLane === official.reviewLane) {
    throw new Error("REVIEW_LANES_MUST_DIFFER");
  }
}
