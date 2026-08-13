/**
 * Good Pick Learning Tracker v1
 * Run: npm run test:mlb-good-pick-learning-tracker-v1
 *
 * Lifecycle-sensitive assertions run against an isolated PRE-RESULT fixture.
 * Real repository 2026-08-08 may already be GRADED; that must not fail this test.
 * Does not mutate Prediction / Recommendation / graded historical artifacts.
 * Does not seal a Recommendation against the real repository.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  classifyMargin,
  classifyMarketAlignment,
  loadGoodPickLearningTrackerV1,
} from "../src/lib/mlb/good-pick-learning-tracker-v1";
import { loadGoodPickFeedbackV1 } from "../src/lib/mlb/good-pick-feedback-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function fileAudit(p: string): { hash: string; mtimeMs: number } | null {
  if (!existsSync(p)) return null;
  return { hash: sha256File(p), mtimeMs: statSync(p).mtimeMs };
}

function copyRel(root: string, cwd: string, rel: string) {
  const src = path.join(root, rel);
  if (!existsSync(src)) {
    throw new Error(`FIXTURE_SOURCE_MISSING:${rel}`);
  }
  const dest = path.join(cwd, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest);
}

/**
 * Isolated PRE-RESULT lifecycle:
 * 08-06 reconstructed snapshot (no ENGINE delivery)
 * 08-07 schedule only → NO_PREGAME_SNAPSHOT
 * 08-08 verified snapshot + sealed Recommendation, without postgame grades
 */
function stagePreResultTrackerFixture(root: string): string {
  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-gp-tracker-"));

  copyRel(root, tmp, "data/predictions/mlb/2026-08-06.json");
  copyRel(root, tmp, "data/research/mlb/2026-08-06-schedule-v1.json");
  copyRel(
    root,
    tmp,
    "data/research/mlb/2026-08-06-daily-research-summary-v1.json",
  );

  copyRel(root, tmp, "data/research/mlb/2026-08-07-schedule-v1.json");

  copyRel(root, tmp, "data/predictions/mlb/2026-08-08.json");
  copyRel(root, tmp, "data/research/mlb/2026-08-08-schedule-v1.json");
  copyRel(
    root,
    tmp,
    "data/research/mlb/2026-08-08-daily-research-summary-v1.json",
  );
  copyRel(
    root,
    tmp,
    "data/recommendations/mlb/2026-08-08-engine-recommendations-v1.json",
  );

  const forbidden = [
    "data/research/mlb/2026-08-08-official-results-v1.json",
    "data/research/mlb/2026-08-08-graded-predictions-v1.json",
    "data/research/mlb/2026-08-08-success-review-v1.json",
    "data/research/mlb/2026-08-08-failure-review-v1.json",
    "data/research/mlb/2026-08-08-daily-review-summary-v1.json",
  ];
  for (const rel of forbidden) {
    assert.equal(
      existsSync(path.join(tmp, rel)),
      false,
      `isolated fixture must omit postgame artifact: ${rel}`,
    );
  }

  return tmp;
}

async function main() {
  const root = process.cwd();
  const pred06 = "data/predictions/mlb/2026-08-06.json";
  const pred08 = "data/predictions/mlb/2026-08-08.json";
  const rec08 =
    "data/recommendations/mlb/2026-08-08-engine-recommendations-v1.json";
  const protectedRels = [
    pred06,
    pred08,
    rec08,
    "data/research/mlb/2026-08-08-official-results-v1.json",
    "data/research/mlb/2026-08-08-graded-predictions-v1.json",
    "data/research/mlb/2026-08-08-success-review-v1.json",
    "data/research/mlb/2026-08-08-failure-review-v1.json",
    "data/research/mlb/2026-08-08-daily-review-summary-v1.json",
  ];
  const before: Record<string, { hash: string; mtimeMs: number } | null> = {};
  for (const rel of protectedRels) {
    before[rel] = fileAudit(rel);
  }
  assert.ok(before[pred06]);
  assert.ok(before[pred08]);
  assert.ok(before[rec08]);
  const predHash = JSON.parse(readFileSync(pred06, "utf8")).meta
    .predictionHashSha256 as string;

  const fixture = stagePreResultTrackerFixture(root);

  // --- A. simulated PRE-RESULT lifecycle (isolated cwd) ---
  const view = await loadGoodPickLearningTrackerV1({
    dates: ["2026-08-06", "2026-08-07", "2026-08-08"],
    cwd: fixture,
  });

  assert.equal(view.loaded, true);
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

  assert.match(view.probabilityVsConfidence.confidencePlain, /승률이 아닙니다/);
  assert.equal(view.predictionHashes["2026-08-06"], predHash);

  // Isolated seal must not rewrite the copied Recommendation record
  assert.equal(sha256File(path.join(fixture, rec08)), before[rec08]!.hash);

  // --- B. immutable real-artifact / read-only reconstructed 08-06 feedback ---
  const fb = await loadGoodPickFeedbackV1({ dateKst: "2026-08-06" });
  assert.ok(fb.games.length >= 1);
  const buckets = fb.games.map(classifyMarketAlignment);
  assert.ok(
    buckets.includes("MARKET_ALIGNED") || buckets.includes("MARKET_CONFLICT"),
  );
  const margins = fb.games.map(classifyMargin);
  assert.ok(margins.includes("ONE_RUN"));

  for (const rel of protectedRels) {
    const after = fileAudit(rel);
    assert.equal(after?.hash ?? null, before[rel]?.hash ?? null, rel);
    assert.equal(after?.mtimeMs ?? null, before[rel]?.mtimeMs ?? null, rel);
  }

  console.log("test:mlb-good-pick-learning-tracker-v1 OK", {
    isolated08: d08!.status,
    record: view.record.recordLine,
    days: view.days.map((d) => `${d.dateKst} ${d.line}`),
    predictionHash: predHash,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
