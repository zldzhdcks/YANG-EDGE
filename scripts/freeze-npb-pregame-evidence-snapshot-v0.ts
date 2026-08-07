/**
 * Freeze NPB Pregame Evidence Snapshot v0
 *
 *   npx tsx --env-file=.env.local scripts/freeze-npb-pregame-evidence-snapshot-v0.ts 2026-08-07
 */
import { freezeNpbPregameEvidenceSnapshot } from "../src/lib/npb/pregame-evidence-snapshot-v0";
import { getKstToday } from "../src/lib/datetime/kst";

const dateKst =
  process.argv[2]?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2].trim())
    ? process.argv[2].trim()
    : getKstToday();

async function main() {
  const result = await freezeNpbPregameEvidenceSnapshot({ dateKst });
  if (!result.document) {
    console.error("FAILED", result.snapshotStatus, result.errors);
    process.exitCode = 1;
    return;
  }
  const d = result.document;
  console.log("=== NPB PREGAME EVIDENCE ===\n");
  console.log(`Date: ${d.dateKst}`);
  console.log(`Games: ${d.summary.total}`);
  console.log("");
  console.log(`Schedule: ${d.summary.scheduleReady}/${d.summary.total}`);
  console.log(
    `Starter: ${d.summary.starterConfirmed * 2}/${d.summary.total * 2} MANUAL_VERIFIED`,
  );
  console.log(
    `Market: ${d.summary.marketVerified}/${d.summary.total} MANUAL_VERIFIED`,
  );
  console.log("Lineup: NOT_RELEASED");
  console.log("Prediction: NOT_AVAILABLE");
  console.log("");
  console.log(`Snapshot Status: ${d.snapshotStatus}`);
  console.log(`Created At: ${d.snapshotCreatedAt}`);
  console.log(
    `Before First Pitch: ${d.generatedBeforeGameCount}/${d.summary.total}`,
  );
  console.log(`Hash: ${d.predictionHashSha256.slice(0, 8)}…`);
  console.log(`Wrote: ${result.wrote} → ${result.pathRel}`);
  console.log("");
  console.log("Next Action:");
  console.log("WAIT_FOR_LINEUP");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
