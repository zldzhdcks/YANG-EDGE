/**
 * Daily Picks v1 — presentation only.
 * Run: npx tsx scripts/test-daily-picks-v1.ts
 * Does not mutate Prediction / Engine artifacts.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import {
  loadDailyPicksV1,
  tierFromConfidence,
  starsForTier,
} from "../src/lib/mlb/daily-picks-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  assert.equal(tierFromConfidence(80), "STRONG");
  assert.equal(tierFromConfidence(73), "GOOD");
  assert.equal(tierFromConfidence(62), "LEAN");
  assert.equal(tierFromConfidence(35), "AVOID");
  assert.equal(starsForTier("STRONG"), 5);
  assert.equal(starsForTier("GOOD"), 4);

  const dateKst = "2026-08-06";
  const predPath = `data/predictions/mlb/${dateKst}.json`;
  const researchPath = `data/research/mlb/${dateKst}-daily-research-summary-v1.json`;
  const reviewPath = `data/research/mlb/${dateKst}-daily-review-summary-v1.json`;

  const beforePred = sha256File(predPath);
  const beforeResearch = sha256File(researchPath);
  const beforeReview = sha256File(reviewPath);
  const predMtime = statSync(predPath).mtimeMs;
  const predHash = JSON.parse(readFileSync(predPath, "utf8")).meta
    .predictionHashSha256 as string;

  const view = await loadDailyPicksV1({ dateKst, sealDeliveryRecord: false });
  assert.equal(view.loaded, true);
  assert.equal(view.hero.dateKst, dateKst);
  assert.equal(view.hero.totalGames, 15);
  assert.equal(view.hero.researchReadyPercent, 87);
  // 08-06 is before ENGINE delivery epoch → no user recommendations
  assert.equal(view.hero.recommendCount, 0);
  assert.equal(view.goodPicks.length, 0);
  assert.ok(view.reconstructedPicks.length >= 1);
  assert.ok(view.passGames.length >= 1, "expected PASS games");
  assert.ok(view.todaysResearch.focus.length > 0);
  assert.ok(view.ctoCommentary.length > 40);
  assert.equal(view.predictionHash, predHash);
  assert.ok(view.provenanceBanner);

  for (const card of [
    ...view.reconstructedPicks,
    ...view.passGames,
    ...view.leanPicks,
    ...view.avoidGames,
  ]) {
    assert.ok(card.gameId);
    assert.ok(card.detailHref, `missing detailHref for ${card.gameId}`);
    assert.match(
      card.detailHref!,
      new RegExp(`/internal/research/mlb/\\d+\\?date=${dateKst}`),
    );
    assert.ok(card.provenance);
  }

  for (const card of view.passGames) {
    assert.ok(
      card.passReasonLabels.length >= 1,
      `PASS without reason: ${card.gameId}`,
    );
  }

  // Missing slate (acceptance date without artifacts)
  const missing = await loadDailyPicksV1({ dateKst: "2026-08-07" });
  assert.equal(missing.loaded, false);
  assert.ok(missing.error);
  assert.match(missing.error ?? "", /NO_PREGAME_SNAPSHOT/);
  assert.equal(missing.hero.totalGames, 0);
  assert.ok(missing.ctoCommentary.length > 10);

  // Mutation audit
  assert.equal(sha256File(predPath), beforePred);
  assert.equal(sha256File(researchPath), beforeResearch);
  assert.equal(sha256File(reviewPath), beforeReview);
  assert.equal(statSync(predPath).mtimeMs, predMtime);

  console.log("test:daily-picks-v1 OK", {
    dateKst,
    totalGames: view.hero.totalGames,
    strong: view.strongPicks.length,
    good: view.goodPicks.length,
    pass: view.passGames.length,
    researchReady: view.hero.researchReadyPercent,
    researchFocus: view.todaysResearch.focus,
    predictionHash: predHash,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
