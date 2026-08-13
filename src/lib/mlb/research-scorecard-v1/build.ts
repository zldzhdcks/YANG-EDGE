/**
 * Build MLB Research Scorecard v1.
 * Additive research artifact only. Never mutates historical inputs or Engine.
 */
import path from "node:path";
import { writeJsonAtomic } from "@/lib/mlb/build-mlb-schedule-artifact";
import { sha256 } from "@/lib/mlb/mlb-review-hash";
import {
  aggregateCalibration,
  aggregateExpectedLineupCoverage,
  aggregateInputCompleteness,
  aggregateMarketBenchmark,
  aggregateRecommendationSelection,
  aggregateReviewTagQa,
  researchStatusForGradedN,
} from "./aggregate";
import { joinMlbResearchScorecardRows } from "./join";
import {
  mlbResearchScorecardV1CumulativeRel,
  mlbResearchScorecardV1Rel,
} from "./paths";
import {
  MLB_RESEARCH_SCORECARD_V1_BUILDER,
  MLB_RESEARCH_SCORECARD_V1_SCHEMA,
  type MlbResearchScorecardCumulativeV1,
  type MlbResearchScorecardRowV1,
  type MlbResearchScorecardV1,
} from "./types";

function documentFromRows(input: {
  dateKst: string;
  generatedAt: string;
  rows: MlbResearchScorecardRowV1[];
}): Omit<MlbResearchScorecardV1, "meta"> & {
  meta: Omit<MlbResearchScorecardV1["meta"], "scorecardHash">;
} {
  const calibration = aggregateCalibration(input.rows);
  const awaitingResults = input.rows.filter(
    (r) => r.resultStatus === "AWAITING",
  ).length;
  return {
    meta: {
      schemaVersion: MLB_RESEARCH_SCORECARD_V1_SCHEMA,
      builderVersion: MLB_RESEARCH_SCORECARD_V1_BUILDER,
      dateKst: input.dateKst,
      generatedAt: input.generatedAt,
      researchOnly: true,
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      autoApply: false,
      primaryDimensions: [
        "CALIBRATION",
        "RECOMMENDATION_SELECTION_VALUE",
        "INPUT_COMPLETENESS",
        "MARKET_BENCHMARK",
      ],
      scheduleGames: input.rows.length,
      awaitingResults,
      gradedResearchN: calibration.gradedN,
      readOnly: true,
      writesHistoricalArtifacts: false,
    },
    rows: input.rows,
    calibration,
    recommendationSelection: aggregateRecommendationSelection(input.rows),
    inputCompleteness: aggregateInputCompleteness(input.rows),
    marketBenchmark: aggregateMarketBenchmark(input.rows),
    expectedLineupCoverage: aggregateExpectedLineupCoverage(input.rows),
    reviewTagQa: aggregateReviewTagQa(input.rows),
    researchStatus: researchStatusForGradedN(calibration.gradedN),
  };
}

/**
 * generatedAt = build provenance (when the artifact was written).
 * scorecardHash = deterministic research-content hash.
 * Canonical payload excludes volatile meta.generatedAt (and scorecardHash itself).
 * All other fields remain in the hash.
 */
export function omitVolatileScorecardMeta<T extends { generatedAt?: string; scorecardHash?: string }>(
  meta: T,
): Omit<T, "generatedAt" | "scorecardHash"> {
  const { generatedAt: _generatedAt, scorecardHash: _scorecardHash, ...rest } =
    meta;
  void _generatedAt;
  void _scorecardHash;
  return rest;
}

export function computeResearchScorecardHash(
  doc: Omit<MlbResearchScorecardV1, "meta"> & {
    meta: Omit<MlbResearchScorecardV1["meta"], "scorecardHash">;
  },
): string {
  return sha256({ ...doc, meta: omitVolatileScorecardMeta(doc.meta) });
}

function computeCumulativeScorecardHash(
  doc: Omit<MlbResearchScorecardCumulativeV1, "meta"> & {
    meta: Omit<MlbResearchScorecardCumulativeV1["meta"], "scorecardHash">;
  },
): string {
  return sha256({ ...doc, meta: omitVolatileScorecardMeta(doc.meta) });
}

export async function buildMlbResearchScorecardV1(input: {
  dateKst: string;
  cwd?: string;
  dryRun?: boolean;
  generatedAt?: string;
}): Promise<{
  document: MlbResearchScorecardV1;
  wrote: boolean;
  outRel: string;
}> {
  const cwd = input.cwd ?? process.cwd();
  const { rows } = await joinMlbResearchScorecardRows({
    dateKst: input.dateKst,
    cwd,
  });
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const withoutHash = documentFromRows({
    dateKst: input.dateKst,
    generatedAt,
    rows,
  });
  const document: MlbResearchScorecardV1 = {
    ...withoutHash,
    meta: {
      ...withoutHash.meta,
      scorecardHash: computeResearchScorecardHash(withoutHash),
    },
  };
  const outRel = mlbResearchScorecardV1Rel(input.dateKst);
  let wrote = false;
  if (!input.dryRun) {
    await writeJsonAtomic(path.join(cwd, outRel), document);
    wrote = true;
  }
  return { document, wrote, outRel };
}

export async function buildMlbResearchScorecardV1Cumulative(input: {
  dates: string[];
  cwd?: string;
  dryRun?: boolean;
  generatedAt?: string;
}): Promise<{
  document: MlbResearchScorecardCumulativeV1;
  wrote: boolean;
  outRel: string;
}> {
  const cwd = input.cwd ?? process.cwd();
  const dates = [...input.dates].sort();
  const allRows: MlbResearchScorecardRowV1[] = [];
  for (const dateKst of dates) {
    const { rows } = await joinMlbResearchScorecardRows({ dateKst, cwd });
    allRows.push(...rows);
  }
  allRows.sort((a, b) =>
    a.dateKst === b.dateKst
      ? a.gamePk - b.gamePk
      : a.dateKst.localeCompare(b.dateKst),
  );
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const calibration = aggregateCalibration(allRows);
  const awaiting = allRows.filter((r) => r.resultStatus === "AWAITING").length;
  const withoutHash = {
    meta: {
      schemaVersion: "mlb-research-scorecard-v1-cumulative" as const,
      builderVersion: MLB_RESEARCH_SCORECARD_V1_BUILDER,
      dates,
      generatedAt,
      researchOnly: true as const,
      engineAdmission: "PROHIBITED" as const,
      autoApply: false as const,
      outcomeDenominatorExcludesAwaiting: true as const,
    },
    rowCount: allRows.length,
    awaitingExcludedFromOutcomes: awaiting,
    calibration,
    recommendationSelection: aggregateRecommendationSelection(allRows),
    inputCompleteness: aggregateInputCompleteness(allRows),
    marketBenchmark: aggregateMarketBenchmark(allRows),
    expectedLineupCoverage: aggregateExpectedLineupCoverage(allRows),
    reviewTagQa: aggregateReviewTagQa(allRows),
    researchStatus: researchStatusForGradedN(calibration.gradedN),
  };
  const document: MlbResearchScorecardCumulativeV1 = {
    ...withoutHash,
    meta: {
      ...withoutHash.meta,
      scorecardHash: computeCumulativeScorecardHash(withoutHash),
    },
  };
  const outRel = mlbResearchScorecardV1CumulativeRel();
  let wrote = false;
  if (!input.dryRun) {
    await writeJsonAtomic(path.join(cwd, outRel), document);
    wrote = true;
  }
  return { document, wrote, outRel };
}
