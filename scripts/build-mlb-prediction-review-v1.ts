/**
 * MLB success/failure review + daily summary v1.
 *
 * npm run review:mlb -- YYYY-MM-DD
 */
import { readFile } from "node:fs/promises";
import { instantToKst } from "../src/lib/datetime/kst";
import { buildMlbPredictionReviewsV1 } from "../src/lib/mlb/build-mlb-prediction-reviews-v1";
import {
  absFromRel,
  mlbGradedPredictionsRel,
} from "../src/lib/mlb/mlb-prediction-review-paths";

const dateKst =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  instantToKst(new Date())?.date ||
  "";

async function main() {
  if (!dateKst) {
    console.error("Usage: npm run review:mlb -- YYYY-MM-DD");
    process.exit(1);
  }

  try {
    await readFile(absFromRel(mlbGradedPredictionsRel(dateKst)), "utf8");
  } catch {
    console.error(
      `GRADED_ARTIFACT_MISSING: ${mlbGradedPredictionsRel(dateKst)}. Run npm run grade:mlb -- ${dateKst}`,
    );
    process.exit(1);
  }

  console.log(`=== MLB Prediction Review v1 (${dateKst}) ===`);
  const { success, failure, daily, paths } =
    await buildMlbPredictionReviewsV1({ dateKst });

  console.log(`Wrote ${paths.success} (${success.games.length} success)`);
  console.log(`Wrote ${paths.failure} (${failure.games.length} failure)`);
  console.log(`Wrote ${paths.daily}`);
  console.log(`reviewStatus=${daily.reviewStatus}`);
  console.log(`leakageAudit=${daily.leakageAudit.status}`);
  console.log(`reviewHash=${daily.reviewHash}`);
  console.log("");
  console.log(daily.assistantSummary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
