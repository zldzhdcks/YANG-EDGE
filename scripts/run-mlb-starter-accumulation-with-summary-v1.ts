/**
 * MLB Starter accumulation + summary tail (v1).
 *
 * Runs run-mlb-starter-accumulation-v1.ts then summarize-mlb-starter-accumulation-v1.ts.
 * Summary failure does not roll back dataset artifacts.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/run-mlb-starter-accumulation-with-summary-v1.ts [YYYY-MM-DD]
 *   npm run research:starter -- YYYY-MM-DD
 */
import { spawnLocalTsxScript } from "./lib/spawn-local-tsx";

const dateKst =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

async function main() {
  console.log(`=== MLB Starter Accumulation + Summary (${dateKst}) ===\n`);

  console.log("--- START: Starter accumulation ---");
  const accCode = await spawnLocalTsxScript("scripts/run-mlb-starter-accumulation-v1.ts", [
    dateKst,
  ]);
  if (accCode !== 0) {
    console.error(
      `FAILED: Starter accumulation (exit ${accCode}). Summary skipped.`,
    );
    process.exitCode = accCode;
    return;
  }
  console.log("--- OK: Starter accumulation ---");

  console.log("\n--- START: Starter accumulation summary ---");
  const sumCode = await spawnLocalTsxScript(
    "scripts/summarize-mlb-starter-accumulation-v1.ts",
    [],
  );
  if (sumCode !== 0) {
    console.error(
      `FAILED: Starter summary (exit ${sumCode}). Dataset artifacts unchanged.`,
    );
    process.exitCode = sumCode;
    return;
  }
  console.log("--- OK: Starter accumulation summary ---");

  console.log("\n=== Starter pipeline complete ===");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
