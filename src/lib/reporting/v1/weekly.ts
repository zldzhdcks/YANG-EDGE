/**
 * Weekly Report v1 schema + builder from raw inventory.
 * Does not copy numbers from another report.
 */
import type { DailyMandatoryAssessment } from "./daily-mandatory";
import type { LeakageSummary } from "./leakage";
import type { MissingDaySummary } from "./missing-days";
import { buildDeterministicMetricsHash } from "./reproducibility";
import type { ClassifiedSample } from "./sample-separation";
import { summarizeSamples } from "./sample-separation";
import type { RawArtifactInventory } from "./inventory";
import type {
  CommonReportMetadata,
  PipelineClass,
  SportId,
} from "./types";
import { REPORTING_SCHEMA_VERSION } from "./types";

export type WeeklyMandatoryKpi = {
  expectedOperatingDays: number | "NOT_DERIVABLE";
  fullyClosedDays: number;
  partialDays: number;
  missingDays: number;
  averageMandatoryCompletion: number | "NOT_DERIVABLE";
  fullyClosedDayRate: number | "NOT_DERIVABLE";
  pregameCompletionPercent: number | "NOT_DERIVABLE";
  resultJoinPercent: number | "NOT_DERIVABLE";
  gradeCompletionPercent: number | "NOT_DERIVABLE";
  reviewCompletionPercent: number | "NOT_DERIVABLE";
  finalDailyClosePercent: number | "NOT_DERIVABLE";
};

export type WeeklyPipelineKpi = {
  pregameCompleteRate: number | "NOT_DERIVABLE";
  predictionSnapshotFreezeRate: number | "NOT_DERIVABLE";
  recommendationSealRate: number | "NOT_DERIVABLE";
  marketBaselineFreezeRate: number | "NOT_DERIVABLE";
  resultJoinRate: number | "NOT_DERIVABLE";
  gradeCompletionRate: number | "NOT_DERIVABLE";
  postgameReviewRate: number | "NOT_DERIVABLE";
  providerSuccessRate: number | "NOT_DERIVABLE";
  missingRate: number | "NOT_DERIVABLE";
  joinFailedRate: number | "NOT_DERIVABLE";
};

export type WeeklyExecutiveSummary = {
  reportPeriod: { start: string; end: string };
  sports: SportId[];
  leagues: string[];
  expectedOperatingDays: number | "NOT_DERIVABLE";
  daysWithEvidence: number;
  fullyClosedDays: number;
  partiallyClosedDays: number;
  missingDays: number;
  averageMandatoryCompletion: number | "NOT_DERIVABLE";
  fullyClosedDayRate: number | "NOT_DERIVABLE";
  totalSchedule: number | "NOT_DERIVABLE";
  predictionValid: number;
  marketBaselineValid: number;
  GOOD: number;
  PASS: number;
  BLOCKED: number;
  MISSING: number;
  JOIN_FAILED: number;
  NOT_COLLECTED: number;
  resultJoined: number;
  gradeCompleted: number;
  reviewCompleted: number;
  researchValidSample: number;
  invalidExcludedSample: number;
  leakageCount: number | "NOT_DERIVABLE";
  potentialLeakageCount: number | "NOT_DERIVABLE";
  pipelineHealth: string;
  engineVersion: string | null;
  engineChanged: false;
};

export type WeeklyReportV1 = {
  meta: CommonReportMetadata;
  executive: WeeklyExecutiveSummary;
  mandatory: WeeklyMandatoryKpi;
  pipeline: WeeklyPipelineKpi;
  poDecisionRequired: string[];
};

function meanComplete(assessments: DailyMandatoryAssessment[]): number | "NOT_DERIVABLE" {
  if (assessments.length === 0) return "NOT_DERIVABLE";
  if (assessments.some((a) => a.completionStatus === "NOT_DERIVABLE")) {
    return "NOT_DERIVABLE";
  }
  const sum = assessments.reduce((s, a) => s + a.mandatoryCompletionPercent, 0);
  return Math.round(sum / assessments.length);
}

function rate(numer: number, denom: number): number | "NOT_DERIVABLE" {
  if (denom <= 0) return "NOT_DERIVABLE";
  return Math.round((numer / denom) * 100);
}

function stageRate(
  assessments: DailyMandatoryAssessment[],
  stage: DailyMandatoryAssessment["stages"][number]["stage"],
  complete: (status: string) => boolean,
): number | "NOT_DERIVABLE" {
  const applicable = assessments
    .map((a) => a.stages.find((s) => s.stage === stage))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .filter((s) => s.status !== "N/A_PREDECLARED");
  if (applicable.length === 0) return "NOT_DERIVABLE";
  const done = applicable.filter((s) => complete(s.status)).length;
  return rate(done, applicable.length);
}

function countClass(
  samples: ClassifiedSample[],
  klass: PipelineClass | "MARKET_BASELINE",
): number {
  return samples.filter((s) => s.pipelineClass === klass).length;
}

export function buildWeeklyReportV1(input: {
  periodStart: string;
  periodEnd: string;
  sports: SportId[];
  leagues: string[];
  generatedAt: string;
  gitCommit: string | null;
  engineVersion: string | null;
  inventory: RawArtifactInventory;
  assessments: DailyMandatoryAssessment[];
  missing: MissingDaySummary;
  samples: ClassifiedSample[];
  leakage: LeakageSummary;
}): WeeklyReportV1 {
  const sampleSum = summarizeSamples(input.samples);
  const expected =
    input.missing.expectedOperatingDays.status === "DERIVED"
      ? input.missing.expectedOperatingDays.value.length
      : ("NOT_DERIVABLE" as const);
  const avg = meanComplete(input.assessments);
  const fully = input.missing.fullyClosedDays.length;
  const expectedN = typeof expected === "number" ? expected : 0;
  const complete = (s: string) =>
    s === "DONE" || s === "VALID_PASS" || s === "VALID_BLOCKED";

  const scheduleArts = input.inventory.sourceArtifacts.filter(
    (a) => a.kind === "SCHEDULE",
  );
  const resultArts = input.inventory.sourceArtifacts.filter(
    (a) => a.kind === "OFFICIAL_RESULT",
  );
  const gradeArts = input.inventory.sourceArtifacts.filter(
    (a) => a.kind === "GRADED_PREDICTION",
  );
  const reviewArts = input.inventory.sourceArtifacts.filter(
    (a) =>
      a.kind === "DAILY_REVIEW_SUMMARY" ||
      a.kind === "SUCCESS_REVIEW" ||
      a.kind === "FAILURE_REVIEW",
  );

  const metrics = {
    expectedOperatingDays: expected,
    fullyClosedDays: fully,
    partialDays: input.missing.partiallyClosedDays.length,
    missingDays: input.missing.missingDays.length,
    averageMandatoryCompletion: avg,
    researchValidSample: sampleSum.researchValidSample,
    invalidExcludedSample: sampleSum.invalidExcludedSample,
    leakageCount: input.leakage.leakageCount,
  };

  const hash = buildDeterministicMetricsHash({
    sourceManifest: input.inventory.sourceArtifacts,
    metrics,
    sampleClassifications: input.samples.map((s) => ({
      matchKey: s.matchKey,
      lane: s.lane,
      pipelineClass: s.pipelineClass,
    })),
    pipelineClassifications: {
      GOOD: countClass(input.samples, "GOOD"),
      PASS: countClass(input.samples, "PASS"),
      BLOCKED: countClass(input.samples, "BLOCKED"),
    },
  });

  const executive: WeeklyExecutiveSummary = {
    reportPeriod: { start: input.periodStart, end: input.periodEnd },
    sports: input.sports,
    leagues: input.leagues,
    expectedOperatingDays: expected,
    daysWithEvidence: input.missing.daysWithEvidence.length,
    fullyClosedDays: fully,
    partiallyClosedDays: input.missing.partiallyClosedDays.length,
    missingDays: input.missing.missingDays.length,
    averageMandatoryCompletion: avg,
    fullyClosedDayRate: rate(fully, expectedN),
    totalSchedule: scheduleArts.length > 0 ? scheduleArts.length : "NOT_DERIVABLE",
    predictionValid: sampleSum.researchValidSample,
    marketBaselineValid: sampleSum.marketBaselineBenchmark,
    GOOD: countClass(input.samples, "GOOD"),
    PASS: countClass(input.samples, "PASS"),
    BLOCKED: countClass(input.samples, "BLOCKED"),
    MISSING: countClass(input.samples, "MISSING"),
    JOIN_FAILED: countClass(input.samples, "JOIN_FAILED"),
    NOT_COLLECTED: countClass(input.samples, "NOT_COLLECTED"),
    resultJoined: resultArts.length,
    gradeCompleted: gradeArts.length,
    reviewCompleted: reviewArts.length,
    researchValidSample: sampleSum.researchValidSample,
    invalidExcludedSample: sampleSum.invalidExcludedSample,
    leakageCount: input.leakage.leakageCount,
    potentialLeakageCount: input.leakage.potentialLeakageCount,
    pipelineHealth: input.leakage.leakageStatus,
    engineVersion: input.engineVersion,
    engineChanged: false,
  };

  const mandatory: WeeklyMandatoryKpi = {
    expectedOperatingDays: expected,
    fullyClosedDays: fully,
    partialDays: input.missing.partiallyClosedDays.length,
    missingDays: input.missing.missingDays.length,
    averageMandatoryCompletion: avg,
    fullyClosedDayRate: rate(fully, expectedN),
    pregameCompletionPercent: stageRate(
      input.assessments,
      "C_PREGAME_FREEZE",
      complete,
    ),
    resultJoinPercent: stageRate(input.assessments, "E_RESULT_GRADE", complete),
    gradeCompletionPercent: stageRate(
      input.assessments,
      "E_RESULT_GRADE",
      complete,
    ),
    reviewCompletionPercent: stageRate(
      input.assessments,
      "F_REVIEW_SCORECARD",
      complete,
    ),
    finalDailyClosePercent: stageRate(
      input.assessments,
      "G_DAILY_CLOSE",
      complete,
    ),
  };

  const pipeline: WeeklyPipelineKpi = {
    pregameCompleteRate: mandatory.pregameCompletionPercent,
    predictionSnapshotFreezeRate: stageRate(
      input.assessments,
      "C_PREGAME_FREEZE",
      complete,
    ),
    recommendationSealRate: "NOT_DERIVABLE",
    marketBaselineFreezeRate:
      input.inventory.sourceArtifacts.some((a) => a.kind === "MARKET_BASELINE")
        ? stageRate(input.assessments, "C_PREGAME_FREEZE", complete)
        : "NOT_DERIVABLE",
    resultJoinRate: mandatory.resultJoinPercent,
    gradeCompletionRate: mandatory.gradeCompletionPercent,
    postgameReviewRate: mandatory.reviewCompletionPercent,
    providerSuccessRate: "NOT_DERIVABLE",
    missingRate: rate(
      input.missing.missingDays.length,
      expectedN,
    ),
    joinFailedRate: rate(
      countClass(input.samples, "JOIN_FAILED"),
      input.samples.length,
    ),
  };

  return {
    meta: {
      reportType: "WEEKLY",
      reportVersion: REPORTING_SCHEMA_VERSION,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      generatedAt: input.generatedAt,
      sourceArtifacts: input.inventory.sourceArtifacts,
      sourceArtifactCount: input.inventory.sourceArtifacts.length,
      gitCommit: input.gitCommit,
      engineVersion: input.engineVersion,
      researchOnly: true,
      engineConnected: false,
      autoApply: false,
      leakageStatus: input.leakage.leakageStatus,
      sampleStatus: "SEPARATED",
      deterministicMetricsHash: hash,
    },
    executive,
    mandatory,
    pipeline,
    poDecisionRequired: [],
  };
}
