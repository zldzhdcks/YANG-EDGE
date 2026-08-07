/**
 * Engine-Only Recommendation Provenance Guard v1
 * Run: npm run test:engine-only-recommendation-provenance-v1
 * Does not mutate Prediction snapshots.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { loadDailyPicksV1 } from "../src/lib/mlb/daily-picks-v1";
import { loadGoodPickLearningTrackerV1 } from "../src/lib/mlb/good-pick-learning-tracker-v1";
import {
  ENGINE_RECOMMENDATION_RECORD_EPOCH,
  assessSlateRecommendationProvenance,
  loadEngineRecommendationRecord,
} from "../src/lib/mlb/recommendation-provenance-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  assert.equal(ENGINE_RECOMMENDATION_RECORD_EPOCH, "2026-08-08");

  const pred06 = "data/predictions/mlb/2026-08-06.json";
  const pred08 = "data/predictions/mlb/2026-08-08.json";
  const before06 = sha256File(pred06);
  const before08 = sha256File(pred08);
  const mtime06 = statSync(pred06).mtimeMs;
  const mtime08 = statSync(pred08).mtimeMs;
  const hash08 = JSON.parse(readFileSync(pred08, "utf8")).meta
    .predictionHashSha256 as string;
  assert.ok(hash08.startsWith("809b3973"));

  // --- 08-07 NO_PREGAME_SNAPSHOT ---
  const p07 = await loadDailyPicksV1({
    dateKst: "2026-08-07",
    sealDeliveryRecord: false,
  });
  assert.equal(p07.provenanceBanner.status, "NO_PREGAME_SNAPSHOT");
  assert.equal(p07.hero.recommendCount, 0);
  assert.equal(p07.strongPicks.length, 0);
  assert.equal(p07.goodPicks.length, 0);
  assert.match(p07.error ?? "", /NO_PREGAME_SNAPSHOT/);

  // --- 08-06: reconstructed, not ENGINE delivered ---
  const ban06 = await assessSlateRecommendationProvenance({
    dateKst: "2026-08-06",
  });
  assert.equal(ban06.generatedBeforeGame, true);
  assert.equal(ban06.hashVerified, true);
  assert.equal(ban06.allowEngineRecommendations, false);

  const p06 = await loadDailyPicksV1({
    dateKst: "2026-08-06",
    sealDeliveryRecord: false,
  });
  assert.equal(p06.goodPicks.length, 0);
  assert.equal(p06.strongPicks.length, 0);
  assert.ok(p06.reconstructedPicks.length >= 1);
  for (const c of p06.reconstructedPicks) {
    assert.equal(c.provenance.sourceType, "RECONSTRUCTED");
    assert.equal(c.provenance.userRecommendationEligible, false);
    assert.equal(c.provenance.recordEligible, false);
  }
  const rec06 = await loadEngineRecommendationRecord({
    dateKst: "2026-08-06",
  });
  assert.equal(rec06, null);

  // --- 08-08: ENGINE_SNAPSHOT ---
  const ban08 = await assessSlateRecommendationProvenance({
    dateKst: "2026-08-08",
  });
  assert.equal(ban08.status, "PRE_GAME_SNAPSHOT_VERIFIED");
  assert.equal(ban08.allowEngineRecommendations, true);
  assert.ok(ban08.predictionHash?.startsWith("809b3973"));

  const p08 = await loadDailyPicksV1({
    dateKst: "2026-08-08",
    sealDeliveryRecord: true,
  });
  assert.equal(p08.provenanceBanner.status, "PRE_GAME_SNAPSHOT_VERIFIED");
  assert.equal(p08.predictionHash, hash08);
  assert.ok(p08.goodPicks.length >= 1);
  assert.ok(p08.goodPicks.length <= 3);
  assert.equal(p08.hero.recommendCount, p08.goodPicks.length + p08.strongPicks.length);
  for (const c of p08.goodPicks) {
    assert.equal(c.provenance.sourceType, "ENGINE_SNAPSHOT");
    assert.equal(c.provenance.userRecommendationEligible, true);
    assert.equal(c.researchOnly, true);
    assert.equal(c.provenance.predictionHash, hash08);
  }
  // Must match artifact-derived presenter picks (not hardcoded names)
  const sealed = await loadEngineRecommendationRecord({
    dateKst: "2026-08-08",
  });
  assert.ok(sealed);
  assert.equal(sealed!.sourceType, "ENGINE_SNAPSHOT");
  assert.equal(sealed!.predictionHash, hash08);
  assert.deepEqual(
    sealed!.picks.map((p) => p.gameId).sort(),
    [...p08.strongPicks, ...p08.goodPicks].map((c) => c.gameId).sort(),
  );

  // Tracker: 08-06 excluded, 08-07 excluded, 08-08 awaiting engine picks
  const tracker = await loadGoodPickLearningTrackerV1({
    dates: ["2026-08-06", "2026-08-07", "2026-08-08"],
  });
  const d06 = tracker.days.find((d) => d.dateKst === "2026-08-06");
  const d07 = tracker.days.find((d) => d.dateKst === "2026-08-07");
  const d08 = tracker.days.find((d) => d.dateKst === "2026-08-08");
  assert.ok(d06);
  assert.equal(d06!.countsTowardRecord, false);
  assert.match(d06!.line, /RECONSTRUCTED|EXCLUDED/);
  assert.ok(d07);
  assert.equal(d07!.status, "NO_PREGAME_SNAPSHOT");
  assert.equal(d07!.countsTowardRecord, false);
  assert.ok(d08);
  assert.equal(d08!.status, "AWAITING_RESULT");
  assert.equal(d08!.countsTowardRecord, false);
  assert.ok(d08!.goodPickCount >= 1);
  // Official record still empty until results
  assert.equal(tracker.record.totalGoodPicks, 0);

  // Mutation audit — prediction files untouched
  assert.equal(sha256File(pred06), before06);
  assert.equal(sha256File(pred08), before08);
  assert.equal(statSync(pred06).mtimeMs, mtime06);
  assert.equal(statSync(pred08).mtimeMs, mtime08);

  console.log("=== RECOMMENDATION PROVENANCE ===\n");
  console.log("2026-08-06");
  console.log(`Status: ${ban06.status} · allowEngine=${ban06.allowEngineRecommendations}`);
  console.log(
    `Good Picks (engine): 0 · Reconstructed: ${p06.reconstructedPicks.length}`,
  );
  console.log("Record Eligibility: EXCLUDED (RECONSTRUCTED)\n");

  console.log("2026-08-07");
  console.log("Status: NO_PREGAME_SNAPSHOT");
  console.log("Good Picks: 0");
  console.log("Record Eligibility: EXCLUDED\n");

  console.log("2026-08-08");
  console.log(`Status: ${ban08.status}`);
  console.log(`Prediction Hash: ${hash08}`);
  console.log("Engine Good Picks:");
  p08.goodPicks.forEach((c, i) => {
    console.log(
      `${i + 1}. ${c.pickTeam} · ${c.modelProbabilityPercent}% · conf ${c.confidence} · ${c.provenance.sourceType} · RESEARCH_ONLY=${c.researchOnly}`,
    );
  });
  console.log("Official / Research: RESEARCH ONLY (officialPickCount=0)");
  console.log("Record Eligibility: ENGINE_SNAPSHOT (awaiting result for accuracy)\n");

  console.log("test:engine-only-recommendation-provenance-v1 OK", {
    recordPath: existsSync(
      "data/recommendations/mlb/2026-08-08-engine-recommendations-v1.json",
    ),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
