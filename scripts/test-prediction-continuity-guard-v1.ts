/**
 * Daily Prediction Continuity Guard v1 tests.
 * Run: npx tsx scripts/test-prediction-continuity-guard-v1.ts
 * Read-only — does not mutate prediction snapshots.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  assessMlbPredictionContinuity,
  DAILY_PREDICTION_SNAPSHOT_MISSING,
  NO_PREGAME_SNAPSHOT,
} from "../src/lib/mlb/prediction-continuity-guard-v1";
import { loadDailyPicksV1 } from "../src/lib/mlb/daily-picks-v1";
import { runMlbDailyPregameV0 } from "../src/lib/mlb/daily-pregame-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  assert.equal(NO_PREGAME_SNAPSHOT, "NO_PREGAME_SNAPSHOT");
  assert.equal(
    DAILY_PREDICTION_SNAPSHOT_MISSING,
    "DAILY_PREDICTION_SNAPSHOT_MISSING",
  );

  // --- 08-08: snapshot present (pregame continuity OK) ---
  const d0808 = "2026-08-08";
  const pred0808 = `data/predictions/mlb/${d0808}.json`;
  assert.ok(existsSync(pred0808), "need 08-08 prediction fixture");
  const beforeHash = sha256File(pred0808);
  const beforeMtime = statSync(pred0808).mtimeMs;
  const predDoc = JSON.parse(readFileSync(pred0808, "utf8"));
  const expectedHash = predDoc.meta.predictionHashSha256 as string;

  const c0808 = await assessMlbPredictionContinuity({
    dateKst: d0808,
    asOf: "2026-08-07T04:00:00.000Z",
  });
  assert.equal(c0808.status, "SNAPSHOT_PRESENT");
  assert.equal(c0808.snapshotExists, true);
  assert.equal(c0808.opsFailure, false);
  assert.equal(c0808.predictionHashSha256, expectedHash);
  assert.ok(c0808.generatedAt);
  assert.equal(c0808.createdBeforeFirstStart, true);
  assert.equal(predDoc.meta.officialPickCount, 0);
  assert.ok(
    (predDoc.meta.researchBaselineCount ?? 0) > 0 ||
      (predDoc.meta.passCount ?? 0) > 0,
  );

  // LIMITED_INPUT / official PASS still have research picks
  const sample = predDoc.predictions.find(
    (p: { inputStatus?: string }) => p.inputStatus === "LIMITED_INPUT",
  );
  if (sample) {
    assert.equal(sample.officialPick, null);
    assert.ok(
      sample.baselinePick != null || sample.researchBaseline?.pick != null,
    );
  }

  // --- 08-07: schedule exists, snapshot missing → ops failure ---
  const d0807 = "2026-08-07";
  assert.ok(
    existsSync(`data/research/mlb/${d0807}-schedule-v1.json`),
    "need 08-07 schedule",
  );
  assert.equal(
    existsSync(`data/predictions/mlb/${d0807}.json`),
    false,
    "08-07 must remain without prediction for this test",
  );
  const c0807 = await assessMlbPredictionContinuity({ dateKst: d0807 });
  assert.equal(c0807.status, DAILY_PREDICTION_SNAPSHOT_MISSING);
  assert.equal(c0807.opsFailure, true);
  assert.match(c0807.plainLanguage, /운영 실패|DAILY_PREDICTION_SNAPSHOT_MISSING/);

  // Daily Picks: no cross-date fallback
  const picks = await loadDailyPicksV1({ dateKst: d0807 });
  assert.equal(picks.loaded, false);
  assert.match(picks.error ?? "", /NO_PREGAME_SNAPSHOT/);

  // Dry-run after start still blocked; continuity miss warning
  const afterStart = await runMlbDailyPregameV0({
    dateKst: "2026-07-30",
    dryRun: true,
    noProvider: true,
    enforcePregameGates: true,
    asOf: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(afterStart.overall, "BLOCKED_AFTER_START");
  assert.equal(
    afterStart.stages.find((s) => s.stage === "PREDICTION_V0")?.status,
    "BLOCKED",
  );

  // Dry-run historical: continuity satisfied in memory
  const hist = await runMlbDailyPregameV0({
    dateKst: "2026-07-30",
    dryRun: true,
    noProvider: true,
  });
  assert.ok(hist.continuity);
  assert.equal(hist.continuity?.opsFailure, false);
  assert.ok(hist.prediction?.predictionHashSha256);
  assert.equal(
    hist.stages.find((s) => s.stage === "SNAPSHOT_VERIFY")?.status,
    "SUCCESS",
  );

  // Mutation audit
  assert.equal(sha256File(pred0808), beforeHash);
  assert.equal(statSync(pred0808).mtimeMs, beforeMtime);

  console.log("test:prediction-continuity-guard-v1 OK", {
    "08-08": {
      status: c0808.status,
      hash: expectedHash.slice(0, 16),
      beforeStart: c0808.createdBeforeFirstStart,
    },
    "08-07": { status: c0807.status, opsFailure: c0807.opsFailure },
    histOverall: hist.overall,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
