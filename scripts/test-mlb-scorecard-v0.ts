/**
 * Tests: MLB Prediction Scorecard v0
 * Run: npm run test:mlb-scorecard-v0
 *
 * Uses temp fixtures + historical 2026-07-31 (legacy adapter).
 * Does NOT run or write 2026-08-02 scorecard / results.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  accuracySummary,
  assignCalibrationBucket,
  brierHome,
  buildMlbPredictionScorecardV0,
  clampProb,
  computeScorecardHash,
  logLossHomeAway,
  MLB_SCORECARD_V0_SCHEMA,
  mlbScorecardV0Rel,
  validateProbabilityPair,
} from "../src/lib/mlb/scorecard-v0";
import { deriveMoneylineEdgeSemantics } from "../src/lib/mlb/prediction-v0/edge-semantics";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function writeMiniFixture(tmp: string, opts: {
  dateKst: string;
  predictions: unknown[];
  results: unknown[];
  scheduleGames: Array<{
    gamePk: number;
    internalGameId: string;
    homeTeam: string;
    awayTeam: string;
    commenceTimeUtc?: string;
  }>;
}) {
  const predDir = path.join(tmp, "data", "predictions", "mlb");
  const researchDir = path.join(tmp, "data", "research", "mlb");
  mkdirSync(predDir, { recursive: true });
  mkdirSync(researchDir, { recursive: true });

  const predDoc = {
    meta: {
      schemaVersion: "mlb-research-prediction-snapshot-v1",
      modelVersion: "mlb-baseline-prediction-v0.1.0",
      modelStatus: "RESEARCH_BASELINE_V0",
      predictionHashSha256: "fixture-pred-hash",
      configHash: "fixture-config",
      inputManifestHash: "fixture-manifest",
      officialPickCount: 0,
      passCount: opts.predictions.length,
      blockedCount: 0,
      dateKst: opts.dateKst,
    },
    predictions: opts.predictions,
  };
  writeFileSync(
    path.join(predDir, `${opts.dateKst}.json`),
    JSON.stringify(predDoc, null, 2),
  );

  writeFileSync(
    path.join(researchDir, `${opts.dateKst}-official-results-v1.json`),
    JSON.stringify(
      {
        schemaVersion: "mlb-official-results-v1",
        dateKst: opts.dateKst,
        generatedAt: "2026-08-01T00:00:00.000Z",
        provider: "mlb-stats-api",
        scheduleArtifact: `data/research/mlb/${opts.dateKst}-schedule-v1.json`,
        resultHash: "fixture-result-hash",
        games: opts.results,
      },
      null,
      2,
    ),
  );

  writeFileSync(
    path.join(researchDir, `${opts.dateKst}-schedule-v1.json`),
    JSON.stringify(
      {
        meta: {
          datasetId: "mlb-schedule-v1",
          schemaVersion: "mlb-schedule-v1",
          dateKst: opts.dateKst,
        },
        games: opts.scheduleGames.map((g) => ({
          ...g,
          commenceTimeUtc: g.commenceTimeUtc ?? "2026-08-01T00:00:00Z",
        })),
      },
      null,
      2,
    ),
  );
}

function v0Game(input: {
  gameId: string;
  home: string;
  away: string;
  homeP: number;
  awayP: number;
  mktH?: number | null;
  mktA?: number | null;
  status?: string;
  confidence?: number;
  starter?: number;
  marketPrior?: number;
  homeAdvantage?: number;
  selection?: "HOME" | "AWAY";
}) {
  const selection =
    input.selection ?? (input.homeP >= input.awayP ? "HOME" : "AWAY");
  const selP = selection === "HOME" ? input.homeP : input.awayP;
  return {
    gameId: input.gameId,
    homeTeam: input.home,
    awayTeam: input.away,
    confidence: input.confidence ?? 55,
    officialStatus: input.status ?? "PASS",
    officialPick: null,
    inputStatus: input.status === "BLOCKED" ? "BLOCKED" : "LIMITED_INPUT",
    inputWarnings:
      input.status === "BLOCKED" ? ["STARTER_SAMPLE_INSUFFICIENT"] : [],
    marketPredictions: [
      {
        marketType: "MONEYLINE_2WAY",
        homeProbability: input.homeP,
        awayProbability: input.awayP,
        marketHomeProbability: input.mktH ?? null,
        marketAwayProbability: input.mktA ?? null,
        confidence: input.confidence ?? 55,
        officialStatus: input.status ?? "PASS",
        officialPick: null,
        researchBaseline: {
          selection,
          probability: selP,
          researchOnly: true,
        },
        components: {
          base: 0,
          starter: input.starter ?? 0.1,
          bullpen: 0,
          lineup: 0,
          homeAdvantage: input.homeAdvantage ?? 0.08,
          marketPrior: input.marketPrior ?? 0,
        },
        inputQuality: "LIMITED_INPUT",
        warnings: [],
      },
    ],
    components: {
      starter: input.starter ?? 0.1,
      bullpen: 0,
      lineup: 0,
      homeAdvantage: input.homeAdvantage ?? 0.08,
      marketPrior: input.marketPrior ?? 0,
    },
  };
}

async function main() {
  // --- metrics ---
  assert.ok(Math.abs(brierHome(0.6, 1) - 0.16) < 1e-12);
  assert.ok(Math.abs(brierHome(0.6, 0) - 0.36) < 1e-12);
  assert.ok(Math.abs(logLossHomeAway(0.7, 0.3, "HOME") - -Math.log(0.7)) < 1e-12);
  assert.ok(Math.abs(logLossHomeAway(0.7, 0.3, "AWAY") - -Math.log(0.3)) < 1e-12);
  assert.equal(clampProb(0), 1e-12);
  assert.equal(validateProbabilityPair(0.6, 0.4, 1e-4), null);
  assert.ok(validateProbabilityPair(0.6, 0.5, 1e-4));
  assert.equal(assignCalibrationBucket(0.51), "0.500-0.525");
  assert.equal(assignCalibrationBucket(0.525), "0.525-0.550");
  assert.equal(assignCalibrationBucket(0.65), "0.600-0.650");
  assert.equal(accuracySummary(0, 0, { emptyStatus: "N/A" }).status, "N/A");

  // --- edge semantics ---
  const edge = deriveMoneylineEdgeSemantics({
    homeProbability: 0.488165,
    awayProbability: 0.511835,
    marketHomeProbability: 0.444444,
    marketAwayProbability: 0.555556,
  });
  assert.equal(edge.mostLikelySelection, "AWAY");
  assert.ok((edge.selectedSideEdge ?? 0) < 0);
  assert.equal(edge.valueSelection, "HOME");
  assert.ok((edge.valueEdge ?? 0) > 0);

  const noPosOnMostLikely = deriveMoneylineEdgeSemantics({
    homeProbability: 0.55,
    awayProbability: 0.45,
    marketHomeProbability: 0.6,
    marketAwayProbability: 0.4,
  });
  assert.equal(noPosOnMostLikely.mostLikelySelection, "HOME");
  assert.ok((noPosOnMostLikely.selectedSideEdge ?? 0) < 0);
  // Away still has positive edge → valueSelection may differ from mostLikely
  assert.equal(noPosOnMostLikely.valueSelection, "AWAY");

  const bothNegative = deriveMoneylineEdgeSemantics({
    homeProbability: 0.52,
    awayProbability: 0.48,
    marketHomeProbability: 0.6,
    marketAwayProbability: 0.55,
  });
  // home edge -0.08, away edge -0.07 → no positive value
  assert.equal(bothNegative.valueSelection, null);

  const missingMkt = deriveMoneylineEdgeSemantics({
    homeProbability: 0.55,
    awayProbability: 0.45,
    marketHomeProbability: null,
    marketAwayProbability: null,
  });
  assert.equal(missingMkt.valueSelection, null);

  // --- grade fixture temp ---
  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-scorecard-v0-"));
  try {
    const dateKst = "2099-01-01";
    writeMiniFixture(tmp, {
      dateKst,
      scheduleGames: [
        {
          gamePk: 1,
          internalGameId: "mlb-a-b",
          homeTeam: "A",
          awayTeam: "B",
        },
        {
          gamePk: 2,
          internalGameId: "mlb-c-d",
          homeTeam: "C",
          awayTeam: "D",
        },
        {
          gamePk: 3,
          internalGameId: "mlb-e-f",
          homeTeam: "E",
          awayTeam: "F",
        },
        {
          gamePk: 4,
          internalGameId: "mlb-g-h",
          homeTeam: "G",
          awayTeam: "H",
        },
        {
          gamePk: 5,
          internalGameId: "mlb-i-j",
          homeTeam: "I",
          awayTeam: "J",
        },
        {
          gamePk: 6,
          internalGameId: "mlb-k-l",
          homeTeam: "K",
          awayTeam: "L",
        },
      ],
      predictions: [
        v0Game({
          gameId: "mlb-a-b",
          home: "A",
          away: "B",
          homeP: 0.56,
          awayP: 0.44,
          mktH: 0.5,
          mktA: 0.5,
          selection: "HOME",
          starter: 0.12,
          confidence: 72,
        }),
        v0Game({
          gameId: "mlb-c-d",
          home: "C",
          away: "D",
          homeP: 0.42,
          awayP: 0.58,
          mktH: 0.4,
          mktA: 0.6,
          selection: "AWAY",
          starter: -0.15,
          confidence: 65,
        }),
        v0Game({
          gameId: "mlb-e-f",
          home: "E",
          away: "F",
          homeP: 0.6,
          awayP: 0.4,
          mktH: 0.55,
          mktA: 0.45,
          selection: "HOME",
          starter: 0.05,
          confidence: 50,
        }),
        v0Game({
          gameId: "mlb-g-h",
          home: "G",
          away: "H",
          homeP: 0.52,
          awayP: 0.48,
          mktH: 0.52,
          mktA: 0.48,
          selection: "HOME",
          confidence: 40,
        }),
        v0Game({
          gameId: "mlb-i-j",
          home: "I",
          away: "J",
          homeP: 0.51,
          awayP: 0.49,
          mktH: null,
          mktA: null,
          selection: "HOME",
          status: "BLOCKED",
          confidence: 30,
          starter: 0,
        }),
        v0Game({
          gameId: "mlb-k-l",
          home: "K",
          away: "L",
          homeP: 0.53,
          awayP: 0.47,
          mktH: 0.6,
          mktA: 0.4,
          selection: "HOME",
          confidence: 55,
          starter: 0,
          homeAdvantage: 0,
          marketPrior: 0,
        }),
      ],
      results: [
        {
          gamePk: 1,
          internalGameId: "mlb-a-b",
          status: "FINAL",
          homeTeam: "A",
          awayTeam: "B",
          homeScore: 5,
          awayScore: 2,
          winner: "HOME",
          resultTimestamp: "t",
        },
        {
          gamePk: 2,
          internalGameId: "mlb-c-d",
          status: "FINAL",
          homeTeam: "C",
          awayTeam: "D",
          homeScore: 1,
          awayScore: 4,
          winner: "AWAY",
          resultTimestamp: "t",
        },
        {
          gamePk: 3,
          internalGameId: "mlb-e-f",
          status: "FINAL",
          homeTeam: "E",
          awayTeam: "F",
          homeScore: 2,
          awayScore: 3,
          winner: "AWAY",
          resultTimestamp: "t",
        },
        {
          gamePk: 4,
          internalGameId: "mlb-g-h",
          status: "CANCELLED",
          homeTeam: "G",
          awayTeam: "H",
          homeScore: null,
          awayScore: null,
          winner: null,
          resultTimestamp: null,
        },
        {
          gamePk: 5,
          internalGameId: "mlb-i-j",
          status: "FINAL",
          homeTeam: "I",
          awayTeam: "J",
          homeScore: 3,
          awayScore: 1,
          winner: "HOME",
          resultTimestamp: "t",
        },
        {
          gamePk: 6,
          internalGameId: "mlb-k-l",
          status: "NOT_FINAL",
          homeTeam: "K",
          awayTeam: "L",
          homeScore: null,
          awayScore: null,
          winner: null,
          resultTimestamp: null,
        },
      ],
    });

    const predPath = path.join(
      tmp,
      "data",
      "predictions",
      "mlb",
      `${dateKst}.json`,
    );
    const before = sha256File(predPath);

    const dry = await buildMlbPredictionScorecardV0({
      dateKst,
      cwd: tmp,
      dryRun: true,
      allowPartialResults: true,
    });
    assert.equal(dry.wrote, false);
    assert.equal(sha256File(predPath), before);
    assert.ok(!existsSync(path.join(tmp, mlbScorecardV0Rel(dateKst))));

    const scored = await buildMlbPredictionScorecardV0({
      dateKst,
      cwd: tmp,
      dryRun: false,
      allowPartialResults: true,
    });
    assert.equal(scored.wrote, true);
    assert.equal(sha256File(predPath), before);
    assert.equal(scored.document.meta.schemaVersion, MLB_SCORECARD_V0_SCHEMA);
    assert.equal(scored.document.meta.conclusion, "PARTIAL_SCORECARD");
    assert.equal(scored.document.meta.voidGames, 1);
    assert.equal(scored.document.meta.pendingGames, 1);
    assert.equal(scored.document.meta.blockedCount, 1);
    // research: HOME correct, AWAY correct, HOME incorrect = 3 (blocked+void+pending excluded)
    assert.equal(scored.document.meta.researchSampleCount, 3);
    assert.equal(scored.document.researchBaselinePerformance.correct, 2);
    assert.equal(scored.document.researchBaselinePerformance.incorrect, 1);
    assert.equal(scored.document.officialPerformance.accuracy.status, "N/A");

    const blocked = scored.document.blockedPolicyReview;
    assert.equal(blocked.length, 1);
    assert.equal(blocked[0]!.includedInResearchDenominator, false);
    assert.equal(blocked[0]!.counterfactualGrade, "CORRECT");

    const voidG = scored.document.gameGrades.find((g) => g.gamePk === 4);
    assert.equal(voidG?.researchGrade, "VOID");
    const pendingG = scored.document.gameGrades.find((g) => g.gamePk === 6);
    assert.equal(pendingG?.researchGrade, "PENDING");
    const blockedG = scored.document.gameGrades.find((g) => g.gamePk === 5);
    assert.equal(blockedG?.researchGrade, "NOT_GRADED");

    // Components
    const starter = scored.document.componentScorecards.find(
      (c) => c.name === "starter",
    );
    assert.ok(starter);
    assert.equal(starter!.status === "DIRECTIONAL_ASSOCIATION_ONLY" || starter!.status === "INSUFFICIENT_SAMPLE", true);
    const bullpen = scored.document.componentScorecards.find(
      (c) => c.name === "bullpen",
    );
    assert.equal(bullpen!.status, "DISABLED");

    // Exact Brier on game 1: homeP=0.56, HOME win → (0.56-1)^2
    const g1 = scored.document.gameGrades.find((g) => g.gamePk === 1);
    assert.ok(Math.abs((g1!.brierScore ?? -1) - 0.1936) < 1e-9);
    assert.ok(
      Math.abs((g1!.logLoss ?? -1) - -Math.log(0.56)) < 1e-9,
    );

    // Determinism
    const h1 = scored.document.meta.scorecardHash;
    const again = await buildMlbPredictionScorecardV0({
      dateKst,
      cwd: tmp,
      dryRun: true,
      allowPartialResults: true,
    });
    assert.equal(again.document.meta.scorecardHash, h1);
    // key order independent
    const recomputed = computeScorecardHash({
      ...again.document,
      meta: { ...again.document.meta },
    });
    assert.equal(recomputed, h1);

    // result change → hash change
    const resPath = path.join(
      tmp,
      "data",
      "research",
      "mlb",
      `${dateKst}-official-results-v1.json`,
    );
    const resDoc = JSON.parse(readFileSync(resPath, "utf8")) as {
      games: Array<{ gamePk: number; winner: string; homeScore: number; awayScore: number }>;
    };
    const flip = resDoc.games.find((g) => g.gamePk === 1)!;
    flip.winner = "AWAY";
    flip.homeScore = 1;
    flip.awayScore = 5;
    writeFileSync(resPath, JSON.stringify(resDoc, null, 2));
    const changed = await buildMlbPredictionScorecardV0({
      dateKst,
      cwd: tmp,
      dryRun: true,
    });
    assert.notEqual(changed.document.meta.scorecardHash, h1);

    // predictionHash mismatch block
    let threw = false;
    try {
      await buildMlbPredictionScorecardV0({
        dateKst,
        cwd: tmp,
        dryRun: true,
        expectedPredictionHash: "wrong-hash",
      });
    } catch (e) {
      threw = e instanceof Error && e.message.includes("PREDICTION_HASH_MISMATCH");
    }
    assert.equal(threw, true);

    // gamePk filter
    const one = await buildMlbPredictionScorecardV0({
      dateKst,
      cwd: tmp,
      dryRun: true,
      gamePk: 2,
    });
    assert.equal(one.document.gameGrades.length, 1);
    assert.equal(one.document.gameGrades[0]!.gamePk, 2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // --- historical replay 2026-07-31 (legacy + FINAL) ---
  const histDate = "2026-07-31";
  const histPred = path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${histDate}.json`,
  );
  const histRes = path.join(
    process.cwd(),
    "data",
    "research",
    "mlb",
    `${histDate}-official-results-v1.json`,
  );
  assert.ok(existsSync(histPred) && existsSync(histRes));
  const histBefore = sha256File(histPred);
  const histTmp = mkdtempSync(path.join(tmpdir(), "mlb-scorecard-hist-"));
  try {
    // Isolate write to temp: copy pred/results/schedule
    for (const rel of [
      `data/predictions/mlb/${histDate}.json`,
      `data/research/mlb/${histDate}-official-results-v1.json`,
      `data/research/mlb/${histDate}-schedule-v1.json`,
    ]) {
      const src = path.join(process.cwd(), rel);
      const dest = path.join(histTmp, rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
    const hist = await buildMlbPredictionScorecardV0({
      dateKst: histDate,
      cwd: histTmp,
      dryRun: false,
    });
    assert.equal(hist.wrote, true);
    assert.equal(sha256File(histPred), histBefore, "repo prediction untouched");
    assert.ok(hist.document.warnings.includes("LEGACY_PREDICTION_SCHEMA_ADAPTER"));
    assert.equal(hist.document.meta.finalGames, 10);
    assert.ok(hist.document.meta.researchSampleCount > 0);
    assert.ok(hist.document.probabilityMetrics.meanBrierScore != null);
    assert.ok(hist.document.probabilityMetrics.meanLogLoss != null);
    assert.equal(hist.document.officialPerformance.accuracy.status, "N/A");
    assert.ok(hist.document.meta.scorecardHash.length === 64);
    console.log(
      JSON.stringify(
        {
          historical: histDate,
          researchSample: hist.document.meta.researchSampleCount,
          accuracy: hist.document.researchBaselinePerformance.accuracy,
          meanBrier: hist.document.probabilityMetrics.meanBrierScore,
          meanLogLoss: hist.document.probabilityMetrics.meanLogLoss,
          conclusion: hist.document.meta.conclusion,
          scorecardHash: hist.document.meta.scorecardHash,
        },
        null,
        2,
      ),
    );
  } finally {
    rmSync(histTmp, { recursive: true, force: true });
  }

  // Safety: frozen 08-02 hash meta intact; no scorecard write in this test
  const freeze = path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    "2026-08-02.json",
  );
  if (existsSync(freeze)) {
    const meta = JSON.parse(readFileSync(freeze, "utf8")).meta;
    assert.equal(
      meta.predictionHashSha256,
      "afee69629e97095306aff9abab61daadb0bf6374001828d9eabd87fc1fbed139",
    );
  }

  console.log("test:mlb-scorecard-v0 OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
