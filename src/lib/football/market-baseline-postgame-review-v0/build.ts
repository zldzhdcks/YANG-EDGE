/**
 * Football Market Baseline Postgame Review v0.
 * Reads sealed Baseline + Official Result only. No Provider / Engine.
 * Canonical grade evidence = review.grades[] — no second Grade SoT.
 */
import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  FootballMarketBaselineMatchV0,
  FootballMarketBaselinePredictionV0,
} from "../market-baseline-prediction-v0/types";
import type {
  FootballOfficialResultArtifactV0,
  FootballOfficialResultMatchV0,
} from "../official-result-v0/types";
import {
  blockReasonFromResultStatus,
  buildFootballReviewRecord,
  buildFootballScorecard,
  isValidOneXTwoSide,
  type FootballOneXTwoGradeInput,
  type FootballThreeWayProbability,
  type ScorecardRowInput,
} from "../review-scorecard-foundation-v0";
import { loadFootballMarketBaselinePostgameSources } from "./load";
import {
  footballMarketBaselineReviewV0Rel,
  footballMarketBaselineScorecardV0Rel,
} from "./paths";
import {
  FOOTBALL_MARKET_BASELINE_POSTGAME_REVIEW_BUILDER,
  FOOTBALL_MARKET_BASELINE_REVIEW_V0_SCHEMA,
  FOOTBALL_MARKET_BASELINE_SCORECARD_V0_SCHEMA,
  type FootballMarketBaselinePostgameProvenanceV0,
  type FootballMarketBaselineReviewArtifactV0,
  type FootballMarketBaselineScorecardArtifactV0,
} from "./types";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

function observationProbabilities(
  row: FootballMarketBaselineMatchV0,
): FootballThreeWayProbability | null {
  if (
    row.normalizedHome == null ||
    row.normalizedDraw == null ||
    row.normalizedAway == null
  ) {
    return null;
  }
  return {
    home: row.normalizedHome,
    draw: row.normalizedDraw,
    away: row.normalizedAway,
  };
}

function gradeInputFromJoin(
  baseline: FootballMarketBaselineMatchV0,
  result: FootballOfficialResultMatchV0 | undefined,
): FootballOneXTwoGradeInput {
  const predictedSide = isValidOneXTwoSide(baseline.baselineOutcome)
    ? baseline.baselineOutcome
    : null;
  if (!result) {
    return {
      matchId: baseline.matchId,
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide,
      actualSide: null,
      gradingAllowed: false,
      blockReason: "NOT_FINAL",
      sampleLane: "RESEARCH",
    };
  }
  const actualSide = isValidOneXTwoSide(result.oneXTwoOutcome)
    ? result.oneXTwoOutcome
    : null;
  if (!result.gradingAllowed) {
    return {
      matchId: baseline.matchId,
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide,
      actualSide,
      gradingAllowed: false,
      blockReason: blockReasonFromResultStatus(result.resultStatus),
      sampleLane: "RESEARCH",
    };
  }
  return {
    matchId: baseline.matchId,
    marketType: "MONEYLINE_3WAY_1X2",
    predictedSide,
    actualSide,
    gradingAllowed: true,
    sampleLane: "RESEARCH",
  };
}

function provenanceFromSources(input: {
  dateKst: string;
  matchIds: string[];
  baselineRel: string;
  predictionHash: string;
  resultRel: string;
  resultArtifactHash: string;
  sourceMatchResultHash: string | null;
}): FootballMarketBaselinePostgameProvenanceV0 {
  return {
    dateKst: input.dateKst,
    matchIds: input.matchIds,
    sourceMarketBaselinePath: input.baselineRel,
    sourceMarketBaselinePredictionHash: input.predictionHash,
    sourceOfficialResultPath: input.resultRel,
    sourceOfficialResultArtifactHash: input.resultArtifactHash,
    sourceMatchResultHash: input.sourceMatchResultHash,
    sampleLane: "RESEARCH",
    predictionClass: "MARKET_BASELINE",
    model: "NONE",
    engine: "NONE",
    recommendation: "NONE",
    officialPickCount: 0,
    engineImpact: "NONE",
    predictionFormulaConnected: false,
    researchOnly: true,
  };
}

export function assembleFootballMarketBaselinePostgameReviewV0(input: {
  dateKst: string;
  generatedAt: string;
  baseline: FootballMarketBaselinePredictionV0;
  baselineRel: string;
  result: FootballOfficialResultArtifactV0;
  resultRel: string;
}): {
  review: FootballMarketBaselineReviewArtifactV0;
  scorecard: FootballMarketBaselineScorecardArtifactV0;
} {
  const resultByMatch = new Map(
    input.result.matches.map((m) => [m.matchId, m] as const),
  );
  const gradeInputs: FootballOneXTwoGradeInput[] = [];
  const scorecardRows: ScorecardRowInput[] = [];
  const matchIds: string[] = [];

  for (const row of input.baseline.matches) {
    matchIds.push(row.matchId);
    const joined = resultByMatch.get(row.matchId);
    const gradeInput = gradeInputFromJoin(row, joined);
    gradeInputs.push(gradeInput);
    scorecardRows.push({
      gradeInput,
      probabilities: observationProbabilities(row),
    });
  }

  if (gradeInputs.length === 0) {
    throw new Error("FOOTBALL_POSTGAME_NO_BASELINE_MATCHES");
  }

  const firstJoined = input.result.matches.find((m) =>
    matchIds.includes(m.matchId),
  );
  const provenance = provenanceFromSources({
    dateKst: input.dateKst,
    matchIds,
    baselineRel: input.baselineRel,
    predictionHash: input.baseline.meta.predictionHash,
    resultRel: input.resultRel,
    resultArtifactHash: input.result.meta.resultArtifactHash,
    sourceMatchResultHash: firstJoined?.resultHash ?? null,
  });

  const reviewRecord = buildFootballReviewRecord({
    dateKst: input.dateKst,
    sampleLane: "RESEARCH",
    grades: gradeInputs,
    generatedAt: input.generatedAt,
  });
  const scorecardRecord = buildFootballScorecard({
    dateKst: input.dateKst,
    sampleLane: "RESEARCH",
    rows: scorecardRows,
    generatedAt: input.generatedAt,
  });

  if (reviewRecord.officialKpi.eligible || reviewRecord.officialKpi.accuracy != null) {
    throw new Error("FOOTBALL_POSTGAME_OFFICIAL_KPI_LEAK");
  }
  if (scorecardRecord.engineImpact !== "NONE") {
    throw new Error("FOOTBALL_POSTGAME_ENGINE_IMPACT_FORBIDDEN");
  }
  if (scorecardRecord.predictionFormulaConnected) {
    throw new Error("FOOTBALL_POSTGAME_PREDICTION_FORMULA_FORBIDDEN");
  }

  return {
    review: {
      meta: {
        schemaVersion: FOOTBALL_MARKET_BASELINE_REVIEW_V0_SCHEMA,
        builderVersion: FOOTBALL_MARKET_BASELINE_POSTGAME_REVIEW_BUILDER,
        generatedAt: input.generatedAt,
        ...provenance,
      },
      review: reviewRecord,
    },
    scorecard: {
      meta: {
        schemaVersion: FOOTBALL_MARKET_BASELINE_SCORECARD_V0_SCHEMA,
        builderVersion: FOOTBALL_MARKET_BASELINE_POSTGAME_REVIEW_BUILDER,
        generatedAt: input.generatedAt,
        insufficientSample: true,
        ...provenance,
      },
      scorecard: scorecardRecord,
    },
  };
}

export async function buildFootballMarketBaselinePostgameReviewV0(input: {
  dateKst: string;
  generatedAt?: string;
  dryRun?: boolean;
  cwd?: string;
}): Promise<{
  reviewRel: string;
  scorecardRel: string;
  wrote: boolean;
  review: FootballMarketBaselineReviewArtifactV0;
  scorecard: FootballMarketBaselineScorecardArtifactV0;
}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("FOOTBALL_POSTGAME_DATE_KST_INVALID");
  }
  const cwd = input.cwd ?? process.cwd();
  const reviewRel = footballMarketBaselineReviewV0Rel(input.dateKst);
  const scorecardRel = footballMarketBaselineScorecardV0Rel(input.dateKst);
  const reviewAbs = path.join(cwd, reviewRel);
  const scorecardAbs = path.join(cwd, scorecardRel);

  if (existsSync(reviewAbs)) {
    throw new Error(`FOOTBALL_MARKET_BASELINE_REVIEW_ALREADY_EXISTS: ${reviewRel}`);
  }
  if (existsSync(scorecardAbs)) {
    throw new Error(
      `FOOTBALL_MARKET_BASELINE_SCORECARD_ALREADY_EXISTS: ${scorecardRel}`,
    );
  }

  const sources = await loadFootballMarketBaselinePostgameSources({
    dateKst: input.dateKst,
    cwd,
  });
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const assembled = assembleFootballMarketBaselinePostgameReviewV0({
    dateKst: input.dateKst,
    generatedAt,
    baseline: sources.baseline,
    baselineRel: sources.baselineRel,
    result: sources.result,
    resultRel: sources.resultRel,
  });

  let wrote = false;
  if (!input.dryRun) {
    await writeJsonAtomic(reviewAbs, assembled.review);
    await writeJsonAtomic(scorecardAbs, assembled.scorecard);
    wrote = true;
  }

  return {
    reviewRel,
    scorecardRel,
    wrote,
    review: assembled.review,
    scorecard: assembled.scorecard,
  };
}
