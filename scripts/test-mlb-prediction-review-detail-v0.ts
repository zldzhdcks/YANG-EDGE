/**
 * Fixture checks for prediction review-detail v0.
 * Run: npm run test:mlb-prediction-review-detail-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  buildMlbPredictionReviewDetailV0,
  reviewDetailContentHash,
} from "../src/lib/mlb/review-detail-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const dateKst = "2026-08-02";
  const predPath = `data/predictions/mlb/${dateKst}.json`;
  assert.ok(existsSync(predPath));
  const before = sha256File(predPath);

  const dry = await buildMlbPredictionReviewDetailV0({
    dateKst,
    dryRun: true,
  });
  assert.equal(dry.wrote, false);
  assert.equal(dry.document.conclusion, "DATA_ACCUMULATION_CONTINUES");
  const games = dry.document.gameReviews as Array<Record<string, unknown>>;
  assert.equal(games.length, 15);
  const pks = new Set(games.map((g) => g.gamePk));
  assert.equal(pks.size, 15);

  const pass = games.filter(
    (g) => g.grade === "CORRECT" || g.grade === "INCORRECT",
  );
  assert.equal(pass.length, 13);
  assert.equal(games.filter((g) => g.grade === "CORRECT").length, 8);
  assert.equal(games.filter((g) => g.grade === "INCORRECT").length, 5);
  assert.equal(games.filter((g) => g.grade === "BLOCKED").length, 2);
  for (const b of games.filter((g) => g.grade === "BLOCKED")) {
    const cf = b.blockedCounterfactual as { denominatorIncluded: boolean };
    assert.equal(cf.denominatorIncluded, false);
  }

  const mc = dry.document.marketComparison as {
    mostLikely: { correct: number; incorrect: number };
    valueSelection: { correct: number; incorrect: number };
    focusGames: {
      pitAtCin: { grade: string; whoWasRight?: string; marketFavorite: string };
      milAtLaa: { grade: string; marketFavorite: string };
    };
    sideFavoriteDisagreement: { incorrect: number; sampleCount: number };
  };
  assert.equal(mc.mostLikely.correct, 8);
  assert.equal(mc.mostLikely.incorrect, 5);
  assert.ok(mc.valueSelection.correct + mc.valueSelection.incorrect === 13);
  assert.equal(mc.focusGames.pitAtCin.grade, "INCORRECT");
  assert.equal(mc.focusGames.milAtLaa.grade, "INCORRECT");
  assert.equal(mc.sideFavoriteDisagreement.sampleCount, 2);
  assert.equal(mc.sideFavoriteDisagreement.incorrect, 2);

  const hyps = dry.document.hypothesisCandidates as unknown[];
  assert.ok(hyps.length <= 3);
  const patterns = dry.document.repeatedPatterns as unknown[];
  assert.ok(patterns.length <= 5);

  const h1 = reviewDetailContentHash(dry.document);
  const dry2 = await buildMlbPredictionReviewDetailV0({
    dateKst,
    dryRun: true,
  });
  assert.equal(reviewDetailContentHash(dry2.document), h1);

  assert.equal(sha256File(predPath), before);
  console.log("test:mlb-prediction-review-detail-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
