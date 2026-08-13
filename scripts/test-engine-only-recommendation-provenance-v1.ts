/**
 * Engine-Only Recommendation Provenance Guard v1
 * Run: npm run test:engine-only-recommendation-provenance-v1
 *
 * Lifecycle-sensitive tracker assertions run against an isolated temp fixture.
 * Real repository 2026-08-08 may already be GRADED; that must not fail this test.
 * Does not mutate Prediction / Recommendation / graded historical artifacts.
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
 * Isolated historical lifecycle the provenance contracts actually need:
 * 08-06 reconstructed pregame snapshot (no ENGINE delivery record)
 * 08-07 schedule only → NO_PREGAME_SNAPSHOT
 * 08-08 verified ENGINE snapshot + sealed recommendation, WITHOUT postgame grades
 */
function stageProvenanceLifecycleFixture(root: string): string {
  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-rec-prov-"));

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
  assert.equal(ENGINE_RECOMMENDATION_RECORD_EPOCH, "2026-08-08");

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
  ];
  const before: Record<string, { hash: string; mtimeMs: number } | null> = {};
  for (const rel of protectedRels) {
    before[rel] = fileAudit(rel);
  }
  assert.ok(before[pred08]);
  assert.ok(before[rec08]);
  const hash08 = JSON.parse(readFileSync(pred08, "utf8")).meta
    .predictionHashSha256 as string;
  assert.ok(hash08.startsWith("809b3973"));

  const fixture = stageProvenanceLifecycleFixture(root);

  // --- 08-07 NO_PREGAME_SNAPSHOT (isolated) ---
  const p07 = await loadDailyPicksV1({
    dateKst: "2026-08-07",
    cwd: fixture,
    sealDeliveryRecord: false,
  });
  assert.equal(p07.provenanceBanner.status, "NO_PREGAME_SNAPSHOT");
  assert.equal(p07.hero.recommendCount, 0);
  assert.equal(p07.strongPicks.length, 0);
  assert.equal(p07.goodPicks.length, 0);
  assert.match(p07.error ?? "", /NO_PREGAME_SNAPSHOT/);

  // --- 08-06: reconstructed, not ENGINE delivered (isolated) ---
  const ban06 = await assessSlateRecommendationProvenance({
    dateKst: "2026-08-06",
    cwd: fixture,
  });
  assert.equal(ban06.generatedBeforeGame, true);
  assert.equal(ban06.hashVerified, true);
  assert.equal(ban06.allowEngineRecommendations, false);

  const p06 = await loadDailyPicksV1({
    dateKst: "2026-08-06",
    cwd: fixture,
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
    cwd: fixture,
  });
  assert.equal(rec06, null);

  // --- 08-08: ENGINE_SNAPSHOT (isolated, pre-result) ---
  const ban08 = await assessSlateRecommendationProvenance({
    dateKst: "2026-08-08",
    cwd: fixture,
  });
  assert.equal(ban08.status, "PRE_GAME_SNAPSHOT_VERIFIED");
  assert.equal(ban08.allowEngineRecommendations, true);
  assert.ok(ban08.predictionHash?.startsWith("809b3973"));

  const p08 = await loadDailyPicksV1({
    dateKst: "2026-08-08",
    cwd: fixture,
    sealDeliveryRecord: true,
  });
  assert.equal(p08.provenanceBanner.status, "PRE_GAME_SNAPSHOT_VERIFIED");
  assert.equal(p08.predictionHash, hash08);
  assert.ok(p08.goodPicks.length >= 1);
  assert.ok(p08.goodPicks.length <= 3);
  assert.equal(
    p08.hero.recommendCount,
    p08.goodPicks.length + p08.strongPicks.length,
  );
  for (const c of p08.goodPicks) {
    assert.equal(c.provenance.sourceType, "ENGINE_SNAPSHOT");
    assert.equal(c.provenance.userRecommendationEligible, true);
    assert.equal(c.researchOnly, true);
    assert.equal(c.provenance.predictionHash, hash08);
  }
  const sealed = await loadEngineRecommendationRecord({
    dateKst: "2026-08-08",
    cwd: fixture,
  });
  assert.ok(sealed);
  assert.equal(sealed!.sourceType, "ENGINE_SNAPSHOT");
  assert.equal(sealed!.predictionHash, hash08);
  assert.deepEqual(
    sealed!.picks.map((p) => p.gameId).sort(),
    [...p08.strongPicks, ...p08.goodPicks].map((c) => c.gameId).sort(),
  );
  assert.equal(
    sha256File(path.join(fixture, rec08)),
    before[rec08]!.hash,
    "isolated seal must not rewrite copied Recommendation record",
  );

  // Tracker against isolated pre-result 08-08 — independent of real GRADED repo
  const tracker = await loadGoodPickLearningTrackerV1({
    dates: ["2026-08-06", "2026-08-07", "2026-08-08"],
    cwd: fixture,
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
  assert.equal(tracker.record.totalGoodPicks, 0);

  // Real repo postgame artifacts exist (filesystem only — no production tracker/seal)
  const realGradedRel =
    "data/research/mlb/2026-08-08-graded-predictions-v1.json";
  const realReviewRel =
    "data/research/mlb/2026-08-08-daily-review-summary-v1.json";
  assert.ok(existsSync(realGradedRel));
  assert.ok(existsSync(realReviewRel));
  JSON.parse(readFileSync(realGradedRel, "utf8"));
  JSON.parse(readFileSync(realReviewRel, "utf8"));

  // Mutation audit — real historical artifacts untouched
  for (const rel of protectedRels) {
    const after = fileAudit(rel);
    assert.equal(after?.hash ?? null, before[rel]?.hash ?? null, rel);
    assert.equal(after?.mtimeMs ?? null, before[rel]?.mtimeMs ?? null, rel);
  }

  console.log("=== RECOMMENDATION PROVENANCE ===\n");
  console.log("2026-08-06 (isolated)");
  console.log(
    `Status: ${ban06.status} · allowEngine=${ban06.allowEngineRecommendations}`,
  );
  console.log(
    `Good Picks (engine): 0 · Reconstructed: ${p06.reconstructedPicks.length}`,
  );
  console.log("Record Eligibility: EXCLUDED (RECONSTRUCTED)\n");

  console.log("2026-08-07 (isolated)");
  console.log("Status: NO_PREGAME_SNAPSHOT");
  console.log("Good Picks: 0");
  console.log("Record Eligibility: EXCLUDED\n");

  console.log("2026-08-08 (isolated pre-result fixture)");
  console.log(`Status: ${ban08.status}`);
  console.log(`Tracker: ${d08!.status}`);
  console.log(`Prediction Hash: ${hash08}`);
  console.log("Engine Good Picks:");
  p08.goodPicks.forEach((c, i) => {
    console.log(
      `${i + 1}. ${c.pickTeam} · ${c.modelProbabilityPercent}% · conf ${c.confidence} · ${c.provenance.sourceType} · RESEARCH_ONLY=${c.researchOnly}`,
    );
  });
  console.log("Official / Research: RESEARCH ONLY (officialPickCount=0)");
  console.log(
    "Record Eligibility: ENGINE_SNAPSHOT (awaiting result for accuracy)\n",
  );

  console.log("2026-08-08 (real repository)");
  console.log("GRADED ARTIFACT PRESENT");
  console.log("");

  console.log("test:engine-only-recommendation-provenance-v1 OK", {
    isolated08: d08!.status,
    realRepo: "GRADED ARTIFACT PRESENT",
    recordPath: existsSync(rec08),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
