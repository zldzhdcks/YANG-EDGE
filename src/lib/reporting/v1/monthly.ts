/**
 * Monthly Report v1 schema + raw-artifact aggregator.
 * Weekly report files are not an input. Summing weekly KPIs is forbidden.
 */
import type { DailyMandatoryAssessment } from "./daily-mandatory";
import type { RawArtifactInventory } from "./inventory";
import type { LeakageSummary } from "./leakage";
import type { MissingDaySummary } from "./missing-days";
import { buildDeterministicMetricsHash } from "./reproducibility";
import type { ClassifiedSample } from "./sample-separation";
import { summarizeSamples } from "./sample-separation";
import type {
  CommonReportMetadata,
  HypothesisWatchStatus,
  MonthlyTrendLabel,
  SportId,
} from "./types";
import { REPORTING_SCHEMA_VERSION } from "./types";

export type MonthlyWeekBucket = {
  weekLabel: string;
  periodStart: string;
  periodEnd: string;
  averageMandatoryCompletion: number | "NOT_DERIVABLE";
  fullyClosedDays: number;
  partialDays: number;
  missingDays: number;
};

export type SampleValidityFunnel = {
  operationalObservation: number;
  researchValidSample: number;
  invalidExcludedSample: number;
  passOutcome: number;
  blockedExcluded: number;
  marketBaselineBenchmark: number;
};

export type HypothesisWatchItem = {
  id: string;
  status: HypothesisWatchStatus;
  note: string;
};

export type MonthlyReportV1 = {
  meta: CommonReportMetadata;
  executiveSummary: {
    periodStart: string;
    periodEnd: string;
    sports: SportId[];
    averageMandatoryCompletion: number | "NOT_DERIVABLE";
    fullyClosedDays: number;
    partialDays: number;
    missingDays: number;
    trend: MonthlyTrendLabel;
  };
  mandatoryDailyCompletionTrend: MonthlyWeekBucket[];
  missingDaySummary: MissingDaySummary;
  dataQualityTrend: {
    resultArtifacts: number;
    gradeArtifacts: number;
    reviewArtifacts: number;
    snapshotArtifacts: number;
  };
  sampleValidityFunnel: SampleValidityFunnel;
  performanceObservation: {
    note: string;
    researchValidSample: number;
    accuracyNotPrimaryKpi: true;
  };
  marketBaselineComparisonFoundation: {
    marketBaselineSample: number;
    enginePredictionSample: number;
    mixed: false;
  };
  repeatedPatterns: string[];
  providerPipelineReliability: {
    note: string;
    status: "NOT_DERIVABLE" | "OBSERVED";
  };
  leakageAuditSummary: LeakageSummary;
  hypothesisWatchlist: HypothesisWatchItem[];
  poDecisionRequired: string[];
};

type MonthlyInput = {
  periodStart: string;
  periodEnd: string;
  sports: SportId[];
  generatedAt: string;
  gitCommit: string | null;
  engineVersion: string | null;
  inventory: RawArtifactInventory;
  assessments: DailyMandatoryAssessment[];
  missing: MissingDaySummary;
  samples: ClassifiedSample[];
  leakage: LeakageSummary;
};

function assertNoWeeklySum(input: MonthlyInput & Record<string, unknown>): void {
  if ("weeklyReports" in input || "weeklyMetrics" in input) {
    throw new Error("MONTHLY_WEEKLY_SUM_FORBIDDEN");
  }
}

export function isoWeekLabel(dateKst: string): string {
  const [y, m, d] = dateKst.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function addDays(dateKst: string, delta: number): string {
  const [y, m, d] = dateKst.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function bucketWeeks(input: {
  periodStart: string;
  periodEnd: string;
  assessments: DailyMandatoryAssessment[];
  missing: MissingDaySummary;
}): MonthlyWeekBucket[] {
  const labels = new Map<string, { dates: string[] }>();
  let cursor = input.periodStart;
  while (cursor <= input.periodEnd) {
    const label = isoWeekLabel(cursor);
    const cur = labels.get(label) ?? { dates: [] };
    cur.dates.push(cursor);
    labels.set(label, cur);
    cursor = addDays(cursor, 1);
  }

  const byDate = new Map(input.assessments.map((a) => [a.dateKst, a]));
  const missing = new Set(input.missing.missingDays);
  const fully = new Set(input.missing.fullyClosedDays);
  const partial = new Set(input.missing.partiallyClosedDays);

  return [...labels.entries()].map(([weekLabel, { dates }]) => {
    const weekAssess = dates
      .map((d) => byDate.get(d))
      .filter((a): a is DailyMandatoryAssessment => Boolean(a));
    const avg =
      weekAssess.length === 0
        ? ("NOT_DERIVABLE" as const)
        : Math.round(
            weekAssess.reduce((s, a) => s + a.mandatoryCompletionPercent, 0) /
              weekAssess.length,
          );
    return {
      weekLabel,
      periodStart: dates[0]!,
      periodEnd: dates[dates.length - 1]!,
      averageMandatoryCompletion: avg,
      fullyClosedDays: dates.filter((d) => fully.has(d)).length,
      partialDays: dates.filter((d) => partial.has(d)).length,
      missingDays: dates.filter((d) => missing.has(d)).length,
    };
  });
}

export function classifyMonthlyTrend(
  weeks: MonthlyWeekBucket[],
): MonthlyTrendLabel {
  const numeric = weeks
    .map((w) => w.averageMandatoryCompletion)
    .filter((n): n is number => typeof n === "number");
  if (numeric.length < 2) return "Insufficient Data";
  const first = numeric[0]!;
  const last = numeric[numeric.length - 1]!;
  const delta = last - first;
  if (delta >= 3) return "Improving";
  if (delta <= -3) return "Degrading";
  return "Stable";
}

export function aggregateMonthlyFromRawArtifacts(
  input: MonthlyInput,
): MonthlyReportV1 {
  assertNoWeeklySum(input as MonthlyInput & Record<string, unknown>);

  const sampleSum = summarizeSamples(input.samples);
  const weeks = bucketWeeks(input);
  const trend = classifyMonthlyTrend(weeks);
  const avg =
    input.assessments.length === 0
      ? ("NOT_DERIVABLE" as const)
      : Math.round(
          input.assessments.reduce(
            (s, a) => s + a.mandatoryCompletionPercent,
            0,
          ) / input.assessments.length,
        );

  const kinds = (kind: string) =>
    input.inventory.sourceArtifacts.filter((a) => a.kind === kind).length;

  const metrics = {
    averageMandatoryCompletion: avg,
    fullyClosedDays: input.missing.fullyClosedDays.length,
    partialDays: input.missing.partiallyClosedDays.length,
    missingDays: input.missing.missingDays.length,
    trend,
    sampleFunnel: sampleSum,
  };

  const hash = buildDeterministicMetricsHash({
    sourceManifest: input.inventory.sourceArtifacts,
    metrics,
    sampleClassifications: input.samples.map((s) => ({
      matchKey: s.matchKey,
      lane: s.lane,
    })),
    pipelineClassifications: weeks,
  });

  const hypothesisWatchlist: HypothesisWatchItem[] =
    sampleSum.researchValidSample < 100
      ? [
          {
            id: "SAMPLE_SIZE",
            status: "INSUFFICIENT_SAMPLE",
            note: "Initial observation only. Additional sample required before Backtest.",
          },
        ]
      : [
          {
            id: "SAMPLE_SIZE",
            status: "OBSERVING",
            note: "Continue observation. No Engine promotion.",
          },
        ];

  return {
    meta: {
      reportType: "MONTHLY",
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
    executiveSummary: {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      sports: input.sports,
      averageMandatoryCompletion: avg,
      fullyClosedDays: input.missing.fullyClosedDays.length,
      partialDays: input.missing.partiallyClosedDays.length,
      missingDays: input.missing.missingDays.length,
      trend,
    },
    mandatoryDailyCompletionTrend: weeks,
    missingDaySummary: input.missing,
    dataQualityTrend: {
      resultArtifacts: kinds("OFFICIAL_RESULT"),
      gradeArtifacts: kinds("GRADED_PREDICTION"),
      reviewArtifacts:
        kinds("DAILY_REVIEW_SUMMARY") +
        kinds("SUCCESS_REVIEW") +
        kinds("FAILURE_REVIEW"),
      snapshotArtifacts: kinds("PREDICTION_SNAPSHOT"),
    },
    sampleValidityFunnel: sampleSum,
    performanceObservation: {
      note: "Accuracy is observational only. Not a primary KPI. Insufficient sample is not Engine proof.",
      researchValidSample: sampleSum.researchValidSample,
      accuracyNotPrimaryKpi: true,
    },
    marketBaselineComparisonFoundation: {
      marketBaselineSample: sampleSum.marketBaselineBenchmark,
      enginePredictionSample: sampleSum.researchValidSample,
      mixed: false,
    },
    repeatedPatterns: [],
    providerPipelineReliability: {
      note: "Provider success rate is NOT_DERIVABLE without provider-audit artifacts.",
      status: "NOT_DERIVABLE",
    },
    leakageAuditSummary: input.leakage,
    hypothesisWatchlist,
    poDecisionRequired: [],
  };
}
