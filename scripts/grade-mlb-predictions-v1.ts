/**
 * MLB prediction grader v1 — reads snapshot + official results; writes graded artifact only.
 *
 * npm run grade:mlb -- YYYY-MM-DD
 */
import { readFile } from "node:fs/promises";
import { instantToKst } from "../src/lib/datetime/kst";
import { gradeMlbPredictionsV1 } from "../src/lib/mlb/grade-mlb-predictions-v1";
import {
  absFromRel,
  mlbOfficialResultsRel,
  mlbPredictionSnapshotRel,
} from "../src/lib/mlb/mlb-prediction-review-paths";

const dateKst =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  instantToKst(new Date())?.date ||
  "";

async function main() {
  if (!dateKst) {
    console.error("Usage: npm run grade:mlb -- YYYY-MM-DD");
    process.exit(1);
  }

  const cwd = process.cwd();
  try {
    await readFile(absFromRel(mlbPredictionSnapshotRel(dateKst), cwd), "utf8");
  } catch {
    console.error(
      `NO_PREGAME_SNAPSHOT: ${mlbPredictionSnapshotRel(dateKst)} (DAILY_PREDICTION_SNAPSHOT_MISSING)`,
    );
    process.exit(1);
  }
  try {
    await readFile(absFromRel(mlbOfficialResultsRel(dateKst), cwd), "utf8");
  } catch {
    console.error(`RESULT_ARTIFACT_MISSING: ${mlbOfficialResultsRel(dateKst)}. Run npm run result:mlb -- ${dateKst}`);
    process.exit(1);
  }

  console.log(`=== MLB Prediction Grader v1 (${dateKst}) ===`);
  const { document, pathRel } = await gradeMlbPredictionsV1({ dateKst });
  const s = document.summary;

  console.log(`Wrote ${pathRel}`);
  console.log(`predictionHash=${document.predictionHash}`);
  console.log(`resultHash=${document.resultHash}`);
  console.log(
    `total=${s.totalGames} eligible=${s.eligiblePredictions} blocked=${s.blocked} graded=${s.graded} correct=${s.correct} incorrect=${s.incorrect} pending=${s.pending} void=${s.void}`,
  );
  console.log(
    `accuracy=${s.accuracy.percent ?? "null"} (${s.accuracy.numerator}/${s.accuracy.denominator}) status=${s.accuracy.status}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
