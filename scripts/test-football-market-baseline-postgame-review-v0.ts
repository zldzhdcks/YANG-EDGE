/**
 * Football Market Baseline Postgame Review v0 tests.
 * Run: npm run test:football-market-baseline-postgame-review-v0
 *
 * No Provider. Does not mutate sealed 2026-08-18 live artifacts.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assembleFootballMarketBaselinePostgameReviewV0,
  buildFootballMarketBaselinePostgameReviewV0,
  footballMarketBaselineReviewV0Rel,
  footballMarketBaselineScorecardV0Rel,
} from "../src/lib/football/market-baseline-postgame-review-v0";
import { footballMarketBaselinePredictionV0Rel } from "../src/lib/football/market-baseline-prediction-v0/paths";
import { footballOfficialResultV0Rel } from "../src/lib/football/official-result-v0/paths";
import type { FootballMarketBaselinePredictionV0 } from "../src/lib/football/market-baseline-prediction-v0/types";
import type { FootballOfficialResultArtifactV0 } from "../src/lib/football/official-result-v0/types";

function shaFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function writeJson(root: string, rel: string, body: unknown): void {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

function fixtureBaseline(
  over: Partial<FootballMarketBaselinePredictionV0["matches"][number]> = {},
): FootballMarketBaselinePredictionV0 {
  return {
    meta: {
      schemaVersion: "football-market-baseline-prediction-v0",
      builderVersion: "football-market-baseline-prediction-builder-v0",
      dateKst: "2026-08-20",
      generatedAt: "2026-08-20T12:00:00.000Z",
      predictionAt: "2026-08-20T12:00:00.000Z",
      researchOnly: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      predictionClass: "MARKET_BASELINE",
      market: "MONEYLINE_3WAY_1X2",
      baselineRule: "ARGMAX_NORMALIZED_MARKET_PROBABILITY",
      normalizationPolicy: "RENORMALIZE_FROZEN_MEDIAN_DEVIG_TO_SUM_1",
      model: "NONE",
      engine: "NONE",
      recommendation: "NONE",
      officialPickCount: 0,
      sourceSnapshotRel: "data/research/football/2026-08-20-prediction-snapshot-v0.json",
      sourceSnapshotHash: "aa",
      snapshotMatches: 1,
      frozenInputGames: 1,
      baselinePredictedGames: 1,
      ambiguousMarketGames: 0,
      missedPredictionWindowGames: 0,
      nonFrozenInputGames: 0,
      predictionHash: "baseline-hash-1",
    },
    matches: [
      {
        matchId: "soccer-api-football-1",
        baselineStatus: "MARKET_BASELINE_PREDICTED",
        sourceSnapshotStatus: "FROZEN",
        competitionId: "fb-comp-api-football-140",
        homeTeamId: "h",
        awayTeamId: "a",
        homeTeamName: "Home",
        awayTeamName: "Away",
        kickoffTimeUtc: "2026-08-20T14:00:00.000Z",
        sourceFreezeAt: "2026-08-20T12:00:00.000Z",
        sourceSelectedOddsObservationId: "obs",
        sourceSelectedOddsObservationHash: "obs-hash",
        rawMedianDevigHome: 0.43,
        rawMedianDevigDraw: 0.31,
        rawMedianDevigAway: 0.26,
        rawMedianSum: 1,
        normalizedHome: 0.434898968586169,
        normalizedDraw: 0.30882035562222093,
        normalizedAway: 0.25628067579161007,
        baselineRule: "ARGMAX_NORMALIZED_MARKET_PROBABILITY",
        researchOnly: true,
        baselineOutcome: "HOME",
        baselineProbability: 0.434898968586169,
        ...over,
      },
    ],
  };
}

function fixtureResult(
  over: Partial<FootballOfficialResultArtifactV0["matches"][number]> = {},
): FootballOfficialResultArtifactV0 {
  return {
    meta: {
      schemaVersion: "football-official-result-v0",
      builderVersion: "football-official-result-builder-v0",
      dateKst: "2026-08-20",
      generatedAt: "2026-08-20T16:00:00.000Z",
      resultObservedAt: "2026-08-20T16:00:00.000Z",
      researchOnly: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      provider: "API_FOOTBALL",
      marketSettlement: "REGULATION_90_MINUTES_1X2",
      sourceScheduleRel: "data/research/football/2026-08-20-schedule-v1.json",
      sourceScheduleHash: "sched",
      scheduleMatches: 1,
      providerRequestedGames: 1,
      finalUsableGames: 1,
      notFinalGames: 0,
      blockedGames: 0,
      prediction: "NONE",
      engine: "NONE",
      recommendation: "NONE",
      resultArtifactHash: "result-hash-1",
    },
    matches: [
      {
        matchId: "soccer-api-football-1",
        fixtureId: "1",
        competitionId: "fb-comp-api-football-140",
        homeTeamId: "h",
        awayTeamId: "a",
        homeTeamName: "Home",
        awayTeamName: "Away",
        kickoffTimeUtc: "2026-08-20T14:00:00.000Z",
        providerStatusRaw: "FT",
        resultStatus: "FINAL",
        resultObservedAt: "2026-08-20T16:00:00.000Z",
        regularTime: { home: 1, away: 1 },
        extraTime: null,
        penalties: null,
        finalScore: { home: 1, away: 1 },
        oneXTwoOutcome: "DRAW",
        advancementWinner: null,
        usability: "FINAL_USABLE",
        gradingAllowed: true,
        reasonCodes: ["FT_DRAW_NO_ET_PEN"],
        resultHash: "match-result-hash-1",
        researchOnly: true,
        ...over,
      },
    ],
  };
}

async function main() {
  const assembled = assembleFootballMarketBaselinePostgameReviewV0({
    dateKst: "2026-08-20",
    generatedAt: "2026-08-20T16:05:00.000Z",
    baseline: fixtureBaseline(),
    baselineRel: footballMarketBaselinePredictionV0Rel("2026-08-20"),
    result: fixtureResult(),
    resultRel: footballOfficialResultV0Rel("2026-08-20"),
  });
  const grade = assembled.review.review.grades[0]!;
  assert.equal(grade.predictedSide, "HOME");
  assert.equal(grade.actualSide, "DRAW");
  assert.equal(grade.verdict, "INCORRECT");
  assert.equal(grade.exactMatch, false);
  assert.equal(grade.blockReason, null);
  assert.equal(grade.sampleLane, "RESEARCH");
  assert.equal(assembled.review.review.reviewLane, "RESEARCH_REVIEW");
  assert.equal(assembled.review.review.summary.graded, 1);
  assert.equal(assembled.review.review.summary.correct, 0);
  assert.equal(assembled.review.review.summary.incorrect, 1);
  assert.equal(assembled.review.review.summary.blocked, 0);
  assert.equal(assembled.review.review.officialKpi.accuracy, null);
  assert.equal(assembled.review.review.officialKpi.eligible, false);
  assert.equal(assembled.review.meta.predictionClass, "MARKET_BASELINE");
  assert.equal(assembled.review.meta.officialPickCount, 0);
  assert.equal(assembled.scorecard.scorecard.sampleLane, "RESEARCH");
  assert.equal(assembled.scorecard.scorecard.metrics.gradedCount, 1);
  assert.equal(assembled.scorecard.scorecard.metrics.blockedCount, 0);
  assert.equal(assembled.scorecard.scorecard.metrics.accuracy, 0);
  assert.equal(assembled.scorecard.scorecard.engineImpact, "NONE");
  assert.equal(assembled.scorecard.scorecard.predictionFormulaConnected, false);
  assert.equal(assembled.scorecard.scorecard.calibration.observationOnly, true);
  assert.equal(
    assembled.scorecard.scorecard.confidence.predictionLayerConnected,
    false,
  );
  assert.equal(assembled.scorecard.meta.insufficientSample, true);
  assert.equal(
    assembled.review.meta.sourceMarketBaselinePredictionHash,
    "baseline-hash-1",
  );
  assert.equal(
    assembled.review.meta.sourceOfficialResultArtifactHash,
    "result-hash-1",
  );
  assert.equal(
    assembled.review.meta.sourceMatchResultHash,
    "match-result-hash-1",
  );

  const drawDraw = assembleFootballMarketBaselinePostgameReviewV0({
    dateKst: "2026-08-20",
    generatedAt: "2026-08-20T16:05:00.000Z",
    baseline: fixtureBaseline({ baselineOutcome: "DRAW" }),
    baselineRel: "b.json",
    result: fixtureResult({ oneXTwoOutcome: "DRAW" }),
    resultRel: "r.json",
  });
  assert.equal(drawDraw.review.review.grades[0]?.verdict, "CORRECT");
  assert.equal(drawDraw.review.review.grades[0]?.exactMatch, true);

  const blocked = assembleFootballMarketBaselinePostgameReviewV0({
    dateKst: "2026-08-20",
    generatedAt: "2026-08-20T16:05:00.000Z",
    baseline: fixtureBaseline(),
    baselineRel: "b.json",
    result: fixtureResult({
      resultStatus: "NOT_FINAL",
      gradingAllowed: false,
      oneXTwoOutcome: null,
      usability: "NOT_FINAL",
    }),
    resultRel: "r.json",
  });
  assert.equal(blocked.review.review.grades[0]?.verdict, "GRADING_BLOCKED");
  assert.equal(blocked.review.review.grades[0]?.blockReason, "NOT_FINAL");

  const tmp = mkdtempSync(path.join(tmpdir(), "fb-postgame-"));
  writeJson(
    tmp,
    footballMarketBaselinePredictionV0Rel("2026-08-20"),
    fixtureBaseline(),
  );
  writeJson(tmp, footballOfficialResultV0Rel("2026-08-20"), fixtureResult());
  const baseRel = path.join(
    tmp,
    footballMarketBaselinePredictionV0Rel("2026-08-20"),
  );
  const resRel = path.join(tmp, footballOfficialResultV0Rel("2026-08-20"));
  const beforeB = shaFile(baseRel);
  const beforeR = shaFile(resRel);

  const built = await buildFootballMarketBaselinePostgameReviewV0({
    dateKst: "2026-08-20",
    generatedAt: "2026-08-20T16:05:00.000Z",
    cwd: tmp,
  });
  assert.equal(built.wrote, true);
  assert.equal(shaFile(baseRel), beforeB);
  assert.equal(shaFile(resRel), beforeR);
  assert.equal(
    existsSync(path.join(tmp, footballMarketBaselineReviewV0Rel("2026-08-20"))),
    true,
  );

  await assert.rejects(
    () =>
      buildFootballMarketBaselinePostgameReviewV0({
        dateKst: "2026-08-20",
        cwd: tmp,
      }),
    /FOOTBALL_MARKET_BASELINE_REVIEW_ALREADY_EXISTS/,
  );

  const liveBase =
    "data/research/football/2026-08-18-market-baseline-prediction-v0.json";
  const liveResult =
    "data/research/football/2026-08-18-official-result-v0.json";
  const liveSnap =
    "data/research/football/2026-08-18-prediction-snapshot-v0.json";
  const liveOdds = "data/research/football/2026-08-18-1x2-odds-v1.json";
  const liveSched = "data/research/football/2026-08-18-schedule-v1.json";
  const h = {
    base: shaFile(liveBase),
    result: shaFile(liveResult),
    snap: shaFile(liveSnap),
    odds: shaFile(liveOdds),
    sched: shaFile(liveSched),
  };
  const liveReviewRel =
    footballMarketBaselineReviewV0Rel("2026-08-18");
  const liveReviewAbs = path.join(process.cwd(), liveReviewRel);
  if (existsSync(liveReviewAbs)) {
    const live = JSON.parse(readFileSync(liveReviewAbs, "utf8")) as {
      review: { grades: Array<{ verdict: string; exactMatch: boolean | null }> };
      meta: { sampleLane: string; officialPickCount: number };
    };
    assert.equal(live.review.grades[0]?.verdict, "INCORRECT");
    assert.equal(live.review.grades[0]?.exactMatch, false);
    assert.equal(live.meta.sampleLane, "RESEARCH");
    assert.equal(live.meta.officialPickCount, 0);
  }
  assert.equal(shaFile(liveBase), h.base);
  assert.equal(shaFile(liveResult), h.result);
  assert.equal(shaFile(liveSnap), h.snap);
  assert.equal(shaFile(liveOdds), h.odds);
  assert.equal(shaFile(liveSched), h.sched);

  console.log("PASS test-football-market-baseline-postgame-review-v0");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
