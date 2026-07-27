/**
 * Site Feedback / Learning refresh (read-only vs research numbers).
 *
 * 1) export-mlb-feedback-review.ts  — mlb/{date}-review.json → {date}-mlb-review.json
 * 2) build-learning-dashboard.ts    — aggregates prediction-review-v1 mirrors
 *
 * Does not re-grade, recompute Success/Failure, or touch Engine/home/picks.
 * On failure: prints which step failed and exits non-zero (no "complete" claim).
 *
 *   tsx --env-file=.env.local scripts/refresh-site-feedback-learning.ts [YYYY-MM-DD]
 */
import { spawnLocalTsxScript } from "./lib/spawn-local-tsx";

const dateKst = process.argv[2]?.trim() || "2026-07-27";

async function main() {
  console.log(`=== Site Feedback/Learning refresh (${dateKst}) ===`);
  console.log("Research numbers: read-only (no recompute)\n");

  console.log("--- Step 1/2: Feedback export ---");
  const exportCode = await spawnLocalTsxScript(
    "scripts/export-mlb-feedback-review.ts",
    [dateKst],
  );
  if (exportCode !== 0) {
    console.error(
      `FAILED at step Feedback export (exit ${exportCode}). Learning dashboard was NOT run. Existing dashboard.json is NOT claimed fresh.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log("\n--- Step 2/2: Learning dashboard ---");
  const dashCode = await spawnLocalTsxScript(
    "scripts/build-learning-dashboard.ts",
    [],
  );
  if (dashCode !== 0) {
    console.error(
      `FAILED at step Learning dashboard (exit ${dashCode}). Feedback mirror may have been updated; Learning dashboard is NOT claimed fresh.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log("\n=== Site refresh complete ===");
  console.log(`Feedback mirror: data/predictions/${dateKst}-mlb-review.json`);
  console.log("Learning dashboard: data/learning/dashboard.json");
  console.log("UI (force-dynamic): /feedback , /learning");
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
