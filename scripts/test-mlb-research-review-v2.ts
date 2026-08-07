/**
 * MLB Research Review v2 — classification + daily category stats.
 * Run: npx tsx scripts/test-mlb-research-review-v2.ts
 * Uses 2026-08-06 artifacts in a temp cwd. Does not mutate Engine/Prediction.
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
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildMlbPredictionReviewsV1 } from "../src/lib/mlb/build-mlb-prediction-reviews-v1";
import {
  classifyFailureCategories,
  buildPredictionConfidenceHistogram,
} from "../src/lib/mlb/review-classify-v2";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  // Unit: blowout vs one-run differentiation
  const blowout = classifyFailureCategories(
    {
      pick: "HOME",
      homeScore: 2,
      awayScore: 10,
      predictionProbability: 0.52,
      inputWarnings: ["LINEUP_NOT_CONFIRMED"],
      inputStatus: "LIMITED_INPUT",
    },
    { oddsMovement: "UNCHANGED", marketPredictions: [] },
  );
  assert.ok(blowout.includes("BLOWOUT"));
  assert.ok(blowout.includes("LINEUP"));
  assert.equal(blowout.includes("ONE_RUN_GAME"), false);

  const oneRun = classifyFailureCategories(
    {
      pick: "AWAY",
      homeScore: 5,
      awayScore: 4,
      predictionProbability: 0.51,
      inputWarnings: ["BULLPEN_WEIGHT_DISABLED_V0"],
      inputStatus: "LIMITED_INPUT",
    },
    {},
  );
  assert.ok(oneRun.includes("ONE_RUN_GAME"));
  assert.ok(oneRun.includes("BULLPEN"));

  const hist = buildPredictionConfidenceHistogram([62, 58, 70, 45, null]);
  assert.equal(hist.totalSamples, 4);
  assert.ok(hist.buckets.some((b) => b.count > 0));

  const dateKst = "2026-08-06";
  const predPath = `data/predictions/mlb/${dateKst}.json`;
  assert.ok(existsSync(predPath), "need 2026-08-06 prediction");
  const predHashBefore = sha256File(predPath);
  const predMetaBefore = JSON.parse(readFileSync(predPath, "utf8")).meta
    .predictionHashSha256 as string;

  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-review-v2-"));
  try {
    for (const rel of [
      predPath,
      `data/research/mlb/${dateKst}-graded-predictions-v1.json`,
      `data/research/mlb/${dateKst}-official-results-v1.json`,
    ]) {
      const dest = path.join(tmp, rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      copyFileSync(rel, dest);
    }

    const { failure, success, daily } = await buildMlbPredictionReviewsV1({
      dateKst,
      cwd: tmp,
    });

    assert.equal(failure.reviewLayerVersion, "mlb-research-review-v2");
    assert.equal(success.reviewLayerVersion, "mlb-research-review-v2");
    assert.ok(failure.games.length >= 1);
    assert.ok(success.games.length >= 1);

    const categorySets = failure.games.map((g) =>
      [...g.failureCategories].sort().join("|"),
    );
    assert.ok(
      new Set(categorySets).size >= 2,
      `failure categories should differ across games, got ${JSON.stringify(categorySets)}`,
    );

    for (const g of failure.games) {
      assert.ok(g.failureCategories.length >= 1);
      assert.ok(g.possibleCauses.length >= 1);
      // Must not be ONLY the old generic dual DATA_QUALITY+BULLPEN with identical text
      assert.ok(
        g.unexpectedOutcome.includes("tags="),
        "unexpectedOutcome should include category tags",
      );
    }

    for (const g of success.games) {
      assert.ok(Array.isArray(g.whyCorrect));
      assert.ok(g.whyCorrect.length >= 1);
      assert.ok(g.successCategories.length >= 1);
    }

    assert.ok(daily.failureCategoryCount);
    assert.ok(Object.keys(daily.failureCategoryCount).length >= 1);
    assert.ok(daily.successCategoryCount);
    assert.ok(Object.keys(daily.successCategoryCount).length >= 1);
    assert.ok(Array.isArray(daily.failureCategoryTable));
    assert.equal(daily.failureCategoryTable.length, failure.games.length);
    for (const row of daily.failureCategoryTable) {
      assert.match(row.line, /→/);
      assert.ok(row.label.includes("-"));
    }
    assert.match(
      daily.assistantSummary,
      /Failure Category by Game/,
    );
    assert.equal(
      daily.predictionConfidenceHistogram.schemaVersion,
      "mlb-prediction-confidence-histogram-v1",
    );
    assert.ok(daily.predictionConfidenceHistogram.totalSamples >= 1);

    assert.equal(sha256File(path.join(tmp, predPath)), predHashBefore);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  assert.equal(sha256File(predPath), predHashBefore);
  assert.equal(
    JSON.parse(readFileSync(predPath, "utf8")).meta.predictionHashSha256,
    predMetaBefore,
  );

  console.log("test:mlb-research-review-v2 OK", {
    predHash: predMetaBefore,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
