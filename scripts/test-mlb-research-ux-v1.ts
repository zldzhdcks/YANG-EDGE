/**
 * MLB Research UX v1 — presenter/viewer load test.
 * Run: npx tsx scripts/test-mlb-research-ux-v1.ts
 * Read-only: must not mutate prediction hash/file.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { loadMlbResearchUxV1 } from "../src/lib/mlb/research-ux-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const dateKst = "2026-08-06";
  const predPath = `data/predictions/mlb/${dateKst}.json`;
  const beforeHash = sha256File(predPath);
  const beforeMtime = statSync(predPath).mtimeMs;
  const predMeta = JSON.parse(readFileSync(predPath, "utf8")).meta
    .predictionHashSha256 as string;

  const view = await loadMlbResearchUxV1({ dateKst });
  assert.equal(view.loaded, true);
  assert.equal(view.schemaVersion, "mlb-research-ux-v1");
  assert.ok(view.dashboard);
  assert.equal(view.dashboard!.totalGames, 15);
  assert.equal(view.dashboard!.correct, 10);
  assert.equal(view.dashboard!.incorrect, 5);
  assert.equal(view.dashboard!.accuracyPercent, 66.7);
  assert.ok(view.dashboard!.topFailureReasons.length >= 1);
  assert.equal(view.dashboard!.topFailureReasons[0]!.medal, "🥇");

  assert.ok(view.cards.length >= 15);
  const failures = view.cards.filter((c) => c.kind === "failure");
  assert.equal(failures.length, 5);
  for (const f of failures) {
    assert.equal(f.accuracy, "INCORRECT");
    assert.ok(f.primary);
    assert.ok(f.aiSummary.length > 20);
    assert.match(f.matchupLine, /@/);
  }
  const successes = view.cards.filter((c) => c.kind === "success");
  assert.equal(successes.length, 10);
  for (const s of successes) {
    assert.equal(s.accuracy, "CORRECT");
    assert.ok(s.primary);
    assert.ok(s.aiSummary.includes("Engine") || s.aiSummary.length > 10);
  }

  assert.match(view.aiCommentary, /lineup|bullpen|research/i);
  assert.ok(view.timeline.length >= 1);
  assert.equal(view.versions.predictionHash, predMeta);
  assert.ok(view.versions.reviewVersion);
  assert.ok(view.versions.researchVersion);
  assert.ok(view.versions.engineVersion);

  assert.equal(sha256File(predPath), beforeHash);
  assert.equal(statSync(predPath).mtimeMs, beforeMtime);

  console.log("test:mlb-research-ux-v1 OK", {
    cards: view.cards.length,
    top: view.dashboard!.topFailureReasons.map((r) => `${r.medal}${r.code}`),
    predictionHash: view.versions.predictionHash,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
