/**
 * Build 2026-08-26 Stage F Success/Failure Review + Scorecard.
 * Repository-only. Does not mutate A/B/C/D/E/P0/P1/Engine/Weights.
 *
 *   npx tsx scripts/audit-2026-08-26-stage-f-review-scorecard-v1.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  STAGE_F_CLOSE_REL,
  assertDailyStageFInvariants,
  buildDailyStageFReviewScorecardV1,
} from "../src/lib/daily-ops/stage-f-review-scorecard-v1";

async function main() {
  const doc = await buildDailyStageFReviewScorecardV1({
    reviewRunAt: new Date().toISOString(),
  });
  assertDailyStageFInvariants(doc);
  const abs = path.join(process.cwd(), STAGE_F_CLOSE_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`Wrote ${STAGE_F_CLOSE_REL}`);
  console.log(
    `F_STATUS=${doc.fStatus} stageResult=${doc.stageResult} scopeTotal=${doc.scopeTotal}`,
  );
  console.log(
    `predictionCount=${doc.predictionPerformance.predictionCount} passCount=${doc.predictionPerformance.passCount} graded=${doc.predictionPerformance.gradedPredictionCount}`,
  );
  console.log(
    `accuracy=${doc.predictionPerformance.accuracy.semantics} final=${doc.resultCoverage.finalResultCount} terminalGaps=${doc.resultCoverage.terminalCoverageGapCount}`,
  );
  console.log(
    `network=${doc.providerNetworkCallCount} credit=${doc.credit} mandatoryRemainsPct=${doc.officialMandatoryCompletionRemainsPct}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
