/**
 * Tests: MLB Review v1 ↔ RESEARCH_BASELINE_V0 compatibility
 * Run: npm run test:mlb-review-v0-compat
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
import { gradeMlbPredictionsV1 } from "../src/lib/mlb/grade-mlb-predictions-v1";
import {
  detectPredictionContract,
  verifyPredictionHash,
} from "../src/lib/mlb/prediction-contract-v1";
import { buildMlbPredictionReviewsV1 } from "../src/lib/mlb/build-mlb-prediction-reviews-v1";
import { buildMlbPredictionScorecardV0 } from "../src/lib/mlb/scorecard-v0";
import { computePredictionContentHash } from "../src/lib/mlb/mlb-review-utils";
import { isNoPickStatus } from "../src/lib/mlb/mlb-review-utils";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  // --- Contract detection ---
  const frozenPath = "data/predictions/mlb/2026-08-02.json";
  assert.ok(existsSync(frozenPath));
  const frozenBefore = sha256File(frozenPath);
  const frozen = JSON.parse(readFileSync(frozenPath, "utf8"));
  assert.equal(detectPredictionContract(frozen), "RESEARCH_BASELINE_V0");

  const legacyLike = {
    meta: {
      immutablePredictionFields: ["baselinePick", "modelProbability"],
      predictionHashSha256: "abc",
    },
    predictions: [
      {
        gameId: "mlb-a-b",
        homeTeam: "A",
        awayTeam: "B",
        baselinePick: "A",
        modelProbability: 55,
      },
    ],
  };
  assert.equal(detectPredictionContract(legacyLike), "LEGACY_V1");

  const unknown = { meta: {}, predictions: [{ gameId: "x" }] };
  assert.equal(detectPredictionContract(unknown), "UNKNOWN");

  // --- Hash ---
  const v0Hash = verifyPredictionHash(frozen);
  assert.equal(v0Hash.verified, true);
  assert.equal(v0Hash.method, "VERIFIED_V0_PREDICTION_HASH");
  assert.equal(
    v0Hash.storedHash,
    "afee69629e97095306aff9abab61daadb0bf6374001828d9eabd87fc1fbed139",
  );

  // Empty immutable fingerprint must NOT verify v0
  const legacyEmpty = computePredictionContentHash(frozen);
  assert.notEqual(legacyEmpty, frozen.meta.predictionHashSha256);

  // Mutation fails
  const mutated = structuredClone(frozen);
  mutated.predictions[0].marketPredictions[0].homeProbability = 0.99;
  const mutHash = verifyPredictionHash(mutated);
  assert.equal(mutHash.verified, false);
  assert.equal(mutHash.method, "PREDICTION_HASH_MISMATCH");

  // isNoPickStatus unchanged for legacy
  assert.equal(isNoPickStatus("PASS"), true);

  // --- Grade + review in temp (copy 08-02 slate) ---
  const dateKst = "2026-08-02";
  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-review-v0-compat-"));
  try {
    for (const rel of [
      `data/predictions/mlb/${dateKst}.json`,
      `data/research/mlb/${dateKst}-official-results-v1.json`,
      `data/research/mlb/${dateKst}-schedule-v1.json`,
    ]) {
      const src = path.join(process.cwd(), rel);
      assert.ok(existsSync(src), `missing ${rel}`);
      const dest = path.join(tmp, rel);
      mkdirSync(path.dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }

    const { document: graded } = await gradeMlbPredictionsV1({
      dateKst,
      cwd: tmp,
    });
    assert.equal(graded.summary.predictionContract, "RESEARCH_BASELINE_V0");
    assert.equal(graded.summary.eligiblePredictions, 0);
    assert.equal(graded.summary.officialSampleCount, 0);
    assert.equal(graded.summary.officialAccuracy?.status, "N/A");
    assert.equal(graded.summary.researchCandidates, 13);
    assert.equal(graded.summary.researchGraded, 13);
    assert.equal(
      (graded.summary.researchCorrect ?? 0) +
        (graded.summary.researchIncorrect ?? 0),
      13,
    );
    assert.equal(graded.summary.blocked, 2);
    assert.equal(graded.summary.noPick, 0);
    assert.equal(
      graded.predictionHash,
      "afee69629e97095306aff9abab61daadb0bf6374001828d9eabd87fc1fbed139",
    );

    const blocked = graded.games.filter((g) => g.grade === "BLOCKED");
    assert.equal(blocked.length, 2);
    for (const b of blocked) {
      assert.equal(b.blockedCounterfactual?.denominatorIncluded, false);
      assert.equal(b.researchGrade?.result, "NOT_GRADED");
    }

    const { daily } = await buildMlbPredictionReviewsV1({
      dateKst,
      cwd: tmp,
      graded,
    });
    assert.notEqual(daily.reviewStatus, "RESEARCH_INVALID");
    assert.notEqual(daily.leakageAudit.status, "FAIL");
    assert.equal(daily.leakageAudit.predictionHashVerified, true);
    assert.equal(
      daily.leakageAudit.hashValidationMethod,
      "VERIFIED_V0_PREDICTION_HASH",
    );
    assert.equal(daily.officialPerformance?.officialAccuracy, "N/A");
    assert.equal(daily.researchPerformance?.researchGraded, 13);
    assert.equal(daily.blockedPolicy?.blockedGames, 2);

    const scorecard = await buildMlbPredictionScorecardV0({
      dateKst,
      cwd: tmp,
      dryRun: true,
    });
    assert.equal(
      scorecard.document.meta.researchSampleCount,
      graded.summary.researchGraded,
    );
    assert.equal(
      scorecard.document.researchBaselinePerformance.correct,
      graded.summary.researchCorrect,
    );
    assert.equal(
      scorecard.document.researchBaselinePerformance.incorrect,
      graded.summary.researchIncorrect,
    );
    assert.equal(scorecard.document.meta.blockedCount, 2);
    // Brier/logloss within float tolerance
    const sb = scorecard.document.probabilityMetrics.meanBrierScore;
    const rb = graded.summary.researchMeanBrier;
    assert.ok(sb != null && rb != null);
    assert.ok(Math.abs(sb! - rb!) < 1e-9);
    const sl = scorecard.document.probabilityMetrics.meanLogLoss;
    const rl = graded.summary.researchMeanLogLoss;
    assert.ok(sl != null && rl != null);
    assert.ok(Math.abs(sl! - rl!) < 1e-9);

    assert.equal(sha256File(path.join(tmp, frozenPath)), frozenBefore);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  assert.equal(sha256File(frozenPath), frozenBefore);

  // Invalid late snapshot must not enter scorecard / research denominator
  const invalidValidity = JSON.parse(
    readFileSync(
      "data/research/mlb/2026-08-03-prediction-validity-v0.json",
      "utf8",
    ),
  );
  assert.equal(invalidValidity.researchValidity, "INVALID_FOR_PREGAME");
  assert.equal(
    invalidValidity.predictionHashSha256,
    JSON.parse(readFileSync("data/predictions/mlb/2026-08-03.json", "utf8"))
      .meta.predictionHashSha256,
  );
  await assert.rejects(
    () =>
      buildMlbPredictionScorecardV0({
        dateKst: "2026-08-03",
        dryRun: true,
      }),
    /SCORECARD_BLOCKED_PREDICTION_INVALID_FOR_PREGAME/,
  );

  console.log("test:mlb-review-v0-compat OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
