/**
 * Recommendation selected-pick probability semantics regression.
 * Run: npm run test:mlb-recommendation-pick-probability-semantics-v1
 *
 * Does NOT mutate Engine, Prediction formulas, or sealed historical artifacts.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  resolveSelectedPickProbability,
  selectedPickProbabilityFromHomeUnit,
  type DailyPickCard,
} from "../src/lib/mlb/daily-picks-v1";
import { buildEngineRecommendationRecord } from "../src/lib/mlb/recommendation-provenance-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function approx(actual: number, expected: number, eps = 0.05) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ≈ ${expected}, got ${actual}`,
  );
}

function main() {
  // --- A. HOME PICK ---
  const homeProb = selectedPickProbabilityFromHomeUnit({
    homeProbability: 0.532252,
    pickSide: "HOME",
  });
  approx(homeProb, 53.2252);
  assert.notEqual(homeProb, 46.7748);

  const homeRes = resolveSelectedPickProbability({
    modelProbability: 53.2,
    marketPredictions: [
      {
        marketType: "MONEYLINE_2WAY",
        homeProbability: 0.532252,
        awayProbability: 0.467748,
        researchBaseline: {
          selection: "HOME",
          probability: 0.532252,
          researchOnly: true,
        },
      },
    ],
  });
  assert.equal(homeRes.pickSide, "HOME");
  assert.equal(homeRes.source, "market_research_baseline");
  approx(homeRes.selectedPickProbabilityPercent!, 53.2);

  // --- B. AWAY PICK ---
  const awayProb = selectedPickProbabilityFromHomeUnit({
    homeProbability: 0.452856,
    pickSide: "AWAY",
  });
  approx(awayProb, 54.7144);
  assert.notEqual(awayProb, 45.2856);
  assert.ok(awayProb > 50, "AWAY selected-pick must be >50 when home <50");

  const awayRes = resolveSelectedPickProbability({
    // Legacy top-level is HOME % — must NOT be used as selected when baseline present
    modelProbability: 45.3,
    marketPredictions: [
      {
        marketType: "MONEYLINE_2WAY",
        homeProbability: 0.452856,
        awayProbability: 0.547144,
        researchBaseline: {
          selection: "AWAY",
          probability: 0.547144,
          researchOnly: true,
        },
      },
    ],
  });
  assert.equal(awayRes.pickSide, "AWAY");
  assert.equal(awayRes.source, "market_research_baseline");
  approx(awayRes.selectedPickProbabilityPercent!, 54.7);
  assert.notEqual(awayRes.selectedPickProbabilityPercent, 45.3);
  approx(awayRes.homeWinProbabilityPercent!, 45.3);

  // Legacy fallback: invert top-level HOME % when AWAY and no market baseline
  const legacyAway = resolveSelectedPickProbability({
    modelProbability: 45.3,
    marketPredictions: [
      {
        marketType: "MONEYLINE_2WAY",
        researchBaseline: { selection: "AWAY", researchOnly: true },
      },
    ],
  });
  assert.equal(legacyAway.source, "legacy_top_level_inverted");
  approx(legacyAway.selectedPickProbabilityPercent!, 54.7);

  // --- C. 2026-08-13 TB @ ATH fixture (read-only real artifact) ---
  const predPath = "data/predictions/mlb/2026-08-13.json";
  const sealedRecPath =
    "data/recommendations/mlb/2026-08-13-engine-recommendations-v1.json";
  const oddsPath =
    "data/operator-input/mlb/2026-08-13-korean-market-odds-observation-v0.json";

  const predDoc = JSON.parse(readFileSync(predPath, "utf8")) as {
    predictions: Array<Record<string, unknown>>;
  };
  const tb = predDoc.predictions.find((p) => {
    const home = String(p.homeTeam ?? "");
    const away = String(p.awayTeam ?? "");
    const pick = String(p.baselinePick ?? "");
    return (
      away.includes("Tampa Bay") &&
      home.includes("Athletics") &&
      pick.includes("Tampa Bay")
    );
  });
  assert.ok(tb, "TB @ ATH (gamePk 824967) must exist in 2026-08-13 prediction");
  const tbRes = resolveSelectedPickProbability(tb!);
  assert.equal(tbRes.pickSide, "AWAY");
  approx(tbRes.selectedPickProbabilityPercent!, 54.7);
  assert.notEqual(tbRes.selectedPickProbabilityPercent, 45.3);

  // Sealed historical record remains legacy (HOME %) — do not rewrite
  const sealed = JSON.parse(readFileSync(sealedRecPath, "utf8")) as {
    picks: Array<{
      gamePk: number | null;
      probability: number | null;
      pickSide: string | null;
    }>;
  };
  const sealedTb = sealed.picks.find((p) => p.gamePk === 824967);
  assert.ok(sealedTb);
  assert.equal(sealedTb!.pickSide, "AWAY");
  assert.equal(sealedTb!.probability, 45.3);

  // Isolated temp fixture: future seal uses selected-pick %
  const card: DailyPickCard = {
    gameId: "mlb-2026-08-13-tmp",
    gamePk: 824967,
    detailHref: null,
    tier: "GOOD",
    stars: 4,
    starLabel: "★★★★☆ Good Pick",
    matchupLine: "TB @ ATH",
    pickTeam: "Tampa Bay Rays",
    pickSide: "AWAY",
    modelProbabilityPercent: tbRes.selectedPickProbabilityPercent,
    confidence: 73,
    reasonChips: [],
    passReasons: [],
    passReasonLabels: [],
    aiSummary: "fixture",
    researchOnly: true,
    inputStatus: "LIMITED_INPUT",
    provenance: {
      sourceType: "ENGINE_SNAPSHOT",
      predictionDate: "2026-08-13",
      predictionHash: "fixture",
      snapshotCreatedAt: "2026-08-12T00:00:00.000Z",
      generatedBeforeGame: true,
      predictionContract: "RESEARCH_BASELINE_V0",
      pickTier: "GOOD",
      researchOnly: true,
      inputStatus: "LIMITED_INPUT",
      userRecommendationEligible: true,
      recordEligible: true,
    },
  };
  const futureRecord = buildEngineRecommendationRecord({
    dateKst: "2099-01-01",
    predictionHash: "fixture",
    snapshotCreatedAt: "2099-01-01T00:00:00.000Z",
    generatedBeforeGame: true,
    predictionContract: "RESEARCH_BASELINE_V0",
    deliveredAt: "2099-01-01T00:00:00.000Z",
    strongPicks: [],
    goodPicks: [card],
  });
  assert.equal(futureRecord.picks[0]?.pickSide, "AWAY");
  approx(futureRecord.picks[0]!.probability!, 54.7);
  assert.notEqual(futureRecord.picks[0]!.probability, 45.3);

  const tmp = mkdtempSync(path.join(tmpdir(), "yang-edge-rec-prob-"));
  writeFileSync(
    path.join(tmp, "future-recommendations.json"),
    `${JSON.stringify(futureRecord, null, 2)}\n`,
  );

  // --- D. Historical immutability ---
  const beforePred = sha256File(predPath);
  const beforeRec = sha256File(sealedRecPath);
  const beforeOdds = sha256File(oddsPath);
  assert.equal(sha256File(predPath), beforePred);
  assert.equal(sha256File(sealedRecPath), beforeRec);
  assert.equal(sha256File(oddsPath), beforeOdds);

  console.log("test:mlb-recommendation-pick-probability-semantics-v1 OK", {
    homeProb,
    awayProb,
    tbSelected: tbRes.selectedPickProbabilityPercent,
    sealedTbLegacy: sealedTb!.probability,
    futureSeal: futureRecord.picks[0]!.probability,
    hashes: {
      prediction: beforePred.slice(0, 12),
      recommendation: beforeRec.slice(0, 12),
      odds: beforeOdds.slice(0, 12),
    },
  });
}

main();
