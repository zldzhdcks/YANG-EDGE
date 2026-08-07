/**
 * Good Pick Learning Tracker v1
 * Run: npm run test:mlb-good-pick-learning-tracker-v1
 * Read-only prediction — may seal ENGINE recommendation delivery records.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import {
  classifyMargin,
  classifyMarketAlignment,
  loadGoodPickLearningTrackerV1,
} from "../src/lib/mlb/good-pick-learning-tracker-v1";
import { loadGoodPickFeedbackV1 } from "../src/lib/mlb/good-pick-feedback-v1";
import { loadDailyPicksV1 } from "../src/lib/mlb/daily-picks-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const predPath = "data/predictions/mlb/2026-08-06.json";
  const before = sha256File(predPath);
  const beforeMtime = statSync(predPath).mtimeMs;
  const predHash = JSON.parse(readFileSync(predPath, "utf8")).meta
    .predictionHashSha256 as string;

  // Seal 08-08 engine delivery if needed
  await loadDailyPicksV1({ dateKst: "2026-08-08", sealDeliveryRecord: true });

  const view = await loadGoodPickLearningTrackerV1({
    dates: ["2026-08-06", "2026-08-07", "2026-08-08"],
  });

  assert.equal(view.loaded, true);
  // Official ENGINE record has no graded results yet → total 0
  assert.equal(view.record.totalGoodPicks, 0);
  assert.equal(view.record.earlySample, true);

  const d06 = view.days.find((d) => d.dateKst === "2026-08-06");
  const d07 = view.days.find((d) => d.dateKst === "2026-08-07");
  const d08 = view.days.find((d) => d.dateKst === "2026-08-08");
  assert.ok(d06);
  assert.equal(d06!.countsTowardRecord, false);
  assert.match(d06!.line, /RECONSTRUCTED|EXCLUDED/);

  assert.ok(d07);
  assert.equal(d07!.status, "NO_PREGAME_SNAPSHOT");
  assert.equal(d07!.countsTowardRecord, false);
  assert.equal(d07!.line, "NO_PREGAME_SNAPSHOT");

  assert.ok(d08);
  assert.equal(d08!.status, "AWAITING_RESULT");
  assert.equal(d08!.countsTowardRecord, false);
  assert.match(d08!.line, /AWAITING_RESULT/);
  assert.ok(d08!.goodPickCount >= 1);

  // Research feedback still can load reconstructed 08-06 for review (not record)
  const fb = await loadGoodPickFeedbackV1({ dateKst: "2026-08-06" });
  assert.ok(fb.games.length >= 1);
  const buckets = fb.games.map(classifyMarketAlignment);
  assert.ok(
    buckets.includes("MARKET_ALIGNED") || buckets.includes("MARKET_CONFLICT"),
  );
  const margins = fb.games.map(classifyMargin);
  assert.ok(margins.includes("ONE_RUN"));

  assert.match(view.probabilityVsConfidence.confidencePlain, /승률이 아닙니다/);

  assert.equal(sha256File(predPath), before);
  assert.equal(statSync(predPath).mtimeMs, beforeMtime);
  assert.equal(view.predictionHashes["2026-08-06"], predHash);

  console.log("test:mlb-good-pick-learning-tracker-v1 OK", {
    record: view.record.recordLine,
    days: view.days.map((d) => `${d.dateKst} ${d.line}`),
    predictionHash: predHash,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
