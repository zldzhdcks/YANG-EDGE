/**
 * Football Review & Scorecard Foundation v0 tests.
 * Run: npm run test:football-review-scorecard-foundation-v0
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  assertResearchOfficialSeparated,
  brierThreeWay,
  buildDefaultFootballReviewScorecardView,
  buildFootballReviewRecord,
  buildFootballScorecard,
  gradeFootballOneXTwo,
  logLossThreeWay,
} from "../src/lib/football/review-scorecard-foundation-v0";

function main() {
  // 3-way grades
  assert.equal(
    gradeFootballOneXTwo({
      matchId: "m1",
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide: "HOME",
      actualSide: "DRAW",
      gradingAllowed: true,
      sampleLane: "RESEARCH",
    }).verdict,
    "INCORRECT",
  );
  assert.equal(
    gradeFootballOneXTwo({
      matchId: "m2",
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide: "DRAW",
      actualSide: "DRAW",
      gradingAllowed: true,
      sampleLane: "RESEARCH",
    }).verdict,
    "CORRECT",
  );
  assert.equal(
    gradeFootballOneXTwo({
      matchId: "m3",
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide: "AWAY",
      actualSide: "HOME",
      gradingAllowed: true,
      sampleLane: "OFFICIAL",
    }).verdict,
    "INCORRECT",
  );

  // DRAW is first-class
  const drawHome = gradeFootballOneXTwo({
    matchId: "m4",
    marketType: "MONEYLINE_3WAY_1X2",
    predictedSide: "HOME",
    actualSide: "DRAW",
    gradingAllowed: true,
    sampleLane: "RESEARCH",
  });
  assert.equal(drawHome.exactMatch, false);

  // VOID / POSTPONED / NOT_FINAL blocked
  for (const block of ["VOID", "POSTPONED", "NOT_FINAL", "CANCELLED", "ABANDONED"] as const) {
    const g = gradeFootballOneXTwo({
      matchId: `b-${block}`,
      marketType: "MONEYLINE_3WAY_1X2",
      predictedSide: "HOME",
      actualSide: "HOME",
      gradingAllowed: false,
      blockReason: block,
      sampleLane: "RESEARCH",
    });
    assert.equal(g.verdict, "GRADING_BLOCKED");
    assert.equal(g.blockReason, block);
  }

  // Review separation
  const research = buildFootballReviewRecord({
    dateKst: "2026-08-04",
    sampleLane: "RESEARCH",
    grades: [
      {
        matchId: "r1",
        marketType: "MONEYLINE_3WAY_1X2",
        predictedSide: "DRAW",
        actualSide: "DRAW",
        gradingAllowed: true,
        sampleLane: "RESEARCH",
      },
    ],
  });
  assert.equal(research.reviewLane, "RESEARCH_REVIEW");
  assert.equal(research.officialKpi.eligible, false);
  assert.equal(research.officialKpi.accuracy, null);

  const official = buildFootballReviewRecord({
    dateKst: "2026-08-04",
    sampleLane: "OFFICIAL",
    grades: [
      {
        matchId: "o1",
        marketType: "MONEYLINE_3WAY_1X2",
        predictedSide: "HOME",
        actualSide: "HOME",
        gradingAllowed: true,
        sampleLane: "OFFICIAL",
      },
    ],
  });
  assert.equal(official.reviewLane, "OFFICIAL_REVIEW");
  assert.equal(official.officialKpi.eligible, true);
  assert.equal(official.officialKpi.accuracy, 1);
  assertResearchOfficialSeparated(research, official);

  // Scorecard contract
  const card = buildFootballScorecard({
    dateKst: "2026-08-04",
    sampleLane: "RESEARCH",
    rows: [
      {
        gradeInput: {
          matchId: "s1",
          marketType: "MONEYLINE_3WAY_1X2",
          predictedSide: "HOME",
          actualSide: "HOME",
          gradingAllowed: true,
          sampleLane: "RESEARCH",
        },
        probabilities: { home: 0.5, draw: 0.25, away: 0.25 },
      },
      {
        gradeInput: {
          matchId: "s2",
          marketType: "MONEYLINE_3WAY_1X2",
          predictedSide: "DRAW",
          actualSide: "AWAY",
          gradingAllowed: true,
          sampleLane: "RESEARCH",
        },
        probabilities: { home: 0.2, draw: 0.5, away: 0.3 },
      },
      {
        gradeInput: {
          matchId: "s3",
          marketType: "MONEYLINE_3WAY_1X2",
          predictedSide: "HOME",
          actualSide: null,
          gradingAllowed: false,
          blockReason: "VOID",
          sampleLane: "RESEARCH",
        },
      },
    ],
  });
  assert.equal(card.predictionFormulaConnected, false);
  assert.equal(card.engineImpact, "NONE");
  assert.equal(card.calibration.observationOnly, true);
  assert.equal(card.confidence.predictionLayerConnected, false);
  assert.equal(card.metrics.gradedCount, 2);
  assert.equal(card.metrics.blockedCount, 1);
  assert.ok(card.metrics.accuracy != null);
  assert.ok(card.metrics.meanBrier != null);
  assert.ok(card.metrics.meanLogLoss != null);

  const b = brierThreeWay({ home: 0.5, draw: 0.25, away: 0.25 }, "HOME");
  assert.ok(Number.isFinite(b));
  const ll = logLossThreeWay({ home: 0.5, draw: 0.25, away: 0.25 }, "HOME");
  assert.ok(Number.isFinite(ll));

  // Default OS view
  const view = buildDefaultFootballReviewScorecardView("2026-08-04");
  assert.equal(view.slice.reviewStage, "FOUNDATION");
  assert.equal(view.slice.scorecardStage, "FOUNDATION");
  assert.equal(view.slice.prediction, "NONE");
  assert.equal(view.slice.gate.progressPercent, null);
  assert.equal(view.developer.mixForbidden, true);

  console.log("PASS test-football-review-scorecard-foundation-v0");
  console.log(
    JSON.stringify(
      {
        drawCorrect: true,
        researchOfficialSeparated: true,
        scorecardAccuracy: card.metrics.accuracy,
        stages: {
          review: view.slice.reviewStage,
          scorecard: view.slice.scorecardStage,
          prediction: view.slice.prediction,
        },
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main();
}
