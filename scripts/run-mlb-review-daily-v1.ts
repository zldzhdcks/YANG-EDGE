/**
 * MLB daily review orchestrator: result → grade → review.
 *
 * npm run review:mlb-daily -- YYYY-MM-DD
 */
import { instantToKst } from "../src/lib/datetime/kst";
import { buildMlbOfficialResultsV1 } from "../src/lib/mlb/build-mlb-official-results";
import { buildMlbPredictionReviewsV1 } from "../src/lib/mlb/build-mlb-prediction-reviews-v1";
import { gradeMlbPredictionsV1 } from "../src/lib/mlb/grade-mlb-predictions-v1";

const dateKst =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  instantToKst(new Date())?.date ||
  "";

async function main() {
  if (!dateKst) {
    console.error("Usage: npm run review:mlb-daily -- YYYY-MM-DD");
    process.exit(1);
  }

  console.log(`=== MLB Daily Review Pipeline v1 (${dateKst}) ===\n`);

  console.log("Step 1/3: Official results");
  const { document: results, pathRel: resultPath } =
    await buildMlbOfficialResultsV1({ dateKst });
  console.log(`  ${resultPath} (FINAL=${results.games.filter((g) => g.status === "FINAL").length})\n`);

  console.log("Step 2/3: Grade predictions");
  const { document: graded, pathRel: gradedPath } = await gradeMlbPredictionsV1({
    dateKst,
    results,
  });
  console.log(
    `  ${gradedPath} (graded=${graded.summary.graded} correct=${graded.summary.correct} incorrect=${graded.summary.incorrect})\n`,
  );

  console.log("Step 3/3: Build reviews");
  const { daily, paths } = await buildMlbPredictionReviewsV1({
    dateKst,
    graded,
  });
  console.log(`  ${paths.daily}`);
  console.log(`  reviewStatus=${daily.reviewStatus} leakage=${daily.leakageAudit.status}`);
  console.log("");
  console.log(daily.assistantSummary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
