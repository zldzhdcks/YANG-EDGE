/**
 * 2026-08-20 complete lineup coverage supplement tests (batch-0012).
 * Run: npm run test:2026-08-20-complete-lineup-coverage-supplement-v1
 * Read-only against sealed freeze artifacts. Does not rerun Prediction.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const PREDICTION_REL = "data/predictions/mlb/2026-08-20.json";
const STAGE_B_REL = "data/audits/2026-08-20-pregame-input-close-v1.json";
const STAGE_C_REL = "data/audits/2026-08-20-pregame-freeze-close-v1.json";
const CONFIRMED_REL =
  "data/operator-input/mlb/2026-08-20-confirmed-lineup-observation-v0.json";
const EXPECTED_REL =
  "data/operator-input/mlb/2026-08-20-expected-lineup-observation-v0.json";
const SUMMARY_REL =
  "data/research/mlb/2026-08-20-daily-research-summary-v1.json";
const SCHEDULE_REL = "data/research/mlb/2026-08-20-schedule-v1.json";
const BATCH_0008_REL =
  "data/operator-observations/structured/2026-08-20/batch-0008-next-pregame-v0.json";
const BATCH_0009_REL =
  "data/operator-observations/structured/2026-08-20/batch-0009-post-freeze-lineup-supplement-v0.json";
const BATCH_0010_REL =
  "data/operator-observations/structured/2026-08-20/batch-0010-post-freeze-lineup-supplement-v0.json";
const BATCH_0011_REL =
  "data/operator-observations/structured/2026-08-20/batch-0011-post-freeze-lineup-supplement-v0.json";
const RAW_DIR_REL = "data/operator-observations/raw/2026-08-20/batch-0012";
const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-20/batch-0012-complete-lineup-supplement-v0.json";
const SUPPLEMENT_REL =
  "data/operator-input/mlb/2026-08-20-confirmed-lineup-supplement-batch-0012-v0.json";
const AUDIT_REL =
  "data/audits/2026-08-20-complete-lineup-coverage-supplement-v1.json";
const INBOX_ROOT = "C:\\Users\\TCTCTC\\YANG-EDGE\\YANG-EDGE-INBOX";

const FROZEN_SHA = {
  predictionArtifact:
    "67f22360cdc5d797d81d6582516bc183eb034ff54c1231dddb8c27f567f2a3e6",
  predictionHashSha256:
    "334a67a4038626c681f6437f4373053de0b900f3b9ff4afe649dfd27481ab473",
  inputManifestHash:
    "d5b2f53dc343be25353103ee4a90c200d7092af87ae143fdeef18b9d7be89dad",
  stageB: "d0e2860c27da1a27888dc83d014569435bbe07d9b56ba0da87b30134e4e0730c",
  stageC: "7d5bbfceb284711d44eb191fba478be5b110e26b0a709250e0838bb8d3eaca8d",
  confirmed:
    "3bb784ce95a35c09b4fa13e52e9157dcb36f166ffb4a0ad7fbc5958de7dca119",
  expected:
    "6548e349f93f7f1603aaee3f25d0a24e68535be1fe71f04d90e771f71d0b1ebc",
  summary: "a7d970a1843e6feaf42be80e8ae25a34727801d30e051cc4f481163f7846da47",
} as const;
const NEW_SHA =
  "2332e94ccdc1a8e09bd3c8c94a0359fbf72e12de15fcfbafd76b754433a5fd4c";

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}
function walkPng(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walkPng(abs, out);
    else if (ent.name.toLowerCase().endsWith(".png")) out.push(abs);
  }
  return out;
}
function classifyTiming(
  observedAt: string,
  freezePredictedAt: string,
  commenceTimeUtc: string,
): string {
  const observed = Date.parse(observedAt);
  const freeze = Date.parse(freezePredictedAt);
  const start = Date.parse(commenceTimeUtc);
  if (observed <= freeze) return "PRE_FREEZE";
  if (observed < start) return "POST_FREEZE_PRE_GAME";
  return "POST_START";
}

function main() {
  const cwd = process.cwd();
  const predAbs = path.join(cwd, PREDICTION_REL);
  const predSha = sha256File(predAbs);
  assert.equal(predSha, FROZEN_SHA.predictionArtifact);
  assert.equal(sha256File(path.join(cwd, STAGE_B_REL)), FROZEN_SHA.stageB);
  assert.equal(sha256File(path.join(cwd, STAGE_C_REL)), FROZEN_SHA.stageC);
  assert.equal(sha256File(path.join(cwd, CONFIRMED_REL)), FROZEN_SHA.confirmed);
  assert.equal(sha256File(path.join(cwd, EXPECTED_REL)), FROZEN_SHA.expected);
  assert.equal(sha256File(path.join(cwd, SUMMARY_REL)), FROZEN_SHA.summary);

  const pred = JSON.parse(readFileSync(predAbs, "utf8"));
  assert.equal(pred.meta.predictionHashSha256, FROZEN_SHA.predictionHashSha256);
  assert.equal(pred.meta.inputManifest.inputHash, FROZEN_SHA.inputManifestHash);

  const png = path.join(cwd, RAW_DIR_REL, "screenshot_2026-08-20_071002.png");
  assert.equal(existsSync(png), true);
  assert.equal(sha256File(png), NEW_SHA);
  assert.equal(statSync(png).size, 101096);
  const newInbox = walkPng(INBOX_ROOT).filter((p) => sha256File(p) === NEW_SHA);
  assert.equal(newInbox.length, 1);

  const structured = JSON.parse(readFileSync(path.join(cwd, STRUCTURED_REL), "utf8"));
  const supplement = JSON.parse(readFileSync(path.join(cwd, SUPPLEMENT_REL), "utf8"));
  const audit = JSON.parse(readFileSync(path.join(cwd, AUDIT_REL), "utf8"));
  const schedule = JSON.parse(readFileSync(path.join(cwd, SCHEDULE_REL), "utf8")) as {
    games: Array<{ gamePk: number; awayTeam: string; homeTeam: string; commenceTimeUtc: string }>;
  };
  const byPk = new Map(schedule.games.map((g) => [g.gamePk, g]));

  assert.equal(structured.predictionInput, false);
  assert.equal(structured.predictionFrozen, true);
  assert.equal(structured.supplementalEvidenceOnly, true);
  assert.equal(structured.summary.screenshots, 1);
  assert.equal(structured.summary.confirmedCards, 3);
  assert.equal(structured.summary.expectedCards, 0);
  assert.equal(structured.summary.confirmedFullGames, 3);
  assert.equal(structured.summary.confirmedPlayerSlots, 54);
  assert.equal(structured.summary.postStart, 0);
  assert.equal(structured.summary.postFreezePregame, 3);
  assert.equal(structured.summary.predictionInputTrue, 0);

  const lad = structured.confirmedLineups.find((g: { gamePk: number }) => g.gamePk === 824318);
  assert.ok(lad);
  assert.equal(lad.lineupType, "CONFIRMED");
  assert.equal(lad.completeness, "FULL");
  assert.deepEqual(lad.confirmedSides, ["AWAY", "HOME"]);
  assert.equal(lad.awayLineup.length, 9);
  assert.equal(lad.homeLineup.length, 9);
  assert.equal(lad.predictionInput, false);
  assert.equal(lad.awayTeam, "Los Angeles Dodgers");
  assert.equal(lad.homeTeam, "Colorado Rockies");
  assert.equal(
    classifyTiming(lad.observedAt, pred.meta.predictedAt, lad.commenceTimeUtc),
    "POST_FREEZE_PRE_GAME",
  );
  assert.equal(lad.timingVsPredictionFreeze, "POST_FREEZE_PRE_GAME");
  assert.equal(structured.expectedLineups.length, 0);

  const prior = JSON.parse(readFileSync(path.join(cwd, BATCH_0011_REL), "utf8"));
  const priorLad = prior.expectedLineups.find((g: { gamePk: number }) => g.gamePk === 824318);
  assert.ok(priorLad);
  assert.equal(priorLad.lineupType, "EXPECTED");
  assert.deepEqual(priorLad.confirmedSides, []);
  assert.equal(
    prior.confirmedLineups.some((g: { gamePk: number }) => g.gamePk === 824318),
    false,
  );

  for (const game of structured.confirmedLineups as Array<{
    gamePk: number;
    awayTeam: string;
    homeTeam: string;
    commenceTimeUtc: string;
    completeness: string;
    awayLineup: unknown[];
    homeLineup: unknown[];
  }>) {
    const sched = byPk.get(game.gamePk);
    assert.ok(sched);
    assert.equal(game.awayTeam, sched!.awayTeam);
    assert.equal(game.homeTeam, sched!.homeTeam);
    assert.equal(game.commenceTimeUtc, sched!.commenceTimeUtc);
    assert.equal(game.completeness, "FULL");
    assert.equal(game.awayLineup.length, 9);
    assert.equal(game.homeLineup.length, 9);
  }

  assert.equal(supplement.predictionInput, false);
  assert.equal(supplement.rows.length, 6);
  assert.equal(supplement.summary.expectedCopiedIntoConfirmed, 0);
  for (const row of supplement.rows as Array<{ predictionInput: boolean; players: unknown[]; sourceHash: string }>) {
    assert.equal(row.predictionInput, false);
    assert.equal(row.players.length, 9);
    assert.equal(row.sourceHash, NEW_SHA);
  }

  assert.equal(audit.intake.newScreenshots, 1);
  assert.equal(audit.ladCol.fullConfirmedBoth, true);
  assert.equal(audit.ladCol.dodgersConfirmedSlots, 9);
  assert.equal(audit.ladCol.rockiesConfirmedSlots, 9);
  assert.equal(audit.timing.postStart, 0);
  assert.equal(audit.prediction.rerun, false);
  assert.equal(audit.prediction.hashBefore, predSha);
  assert.equal(audit.prediction.hashAfter, predSha);
  assert.equal(audit.network.providerCalls, 0);
  assert.equal(audit.engine.engineCalls, 0);
  assert.equal(audit.mandatoryCompletion.total, "60%");
  assert.equal(audit.latestCoverage.mlbTotalGames, 15);
  assert.equal(audit.latestCoverage.fullConfirmedBoth, 15);
  assert.equal(audit.latestCoverage.partialConfirmed, 0);
  assert.equal(audit.latestCoverage.expectedRemaining, 0);
  assert.equal(audit.latestCoverage.notFullyConfirmed.length, 0);
  assert.equal(audit.lineupAvailabilityProgression.atPredictionFreeze.fullConfirmedBoth, 2);
  assert.equal(audit.lineupAvailabilityProgression.afterBatch0009.fullConfirmedBoth, 4);
  assert.equal(audit.lineupAvailabilityProgression.afterBatch0010.fullConfirmedBoth, 10);
  assert.equal(audit.lineupAvailabilityProgression.afterBatch0011.fullConfirmedBoth, 14);
  assert.equal(audit.lineupAvailabilityProgression.afterFinalBatch0012.fullConfirmedBoth, 15);

  const gitDiff = execSync(
    "git diff --name-only -- " +
      [
        PREDICTION_REL,
        STAGE_B_REL,
        STAGE_C_REL,
        CONFIRMED_REL,
        EXPECTED_REL,
        SUMMARY_REL,
        BATCH_0008_REL,
        BATCH_0009_REL,
        BATCH_0010_REL,
        BATCH_0011_REL,
      ].join(" "),
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(gitDiff, "");

  console.log("PASS 2026-08-20-complete-lineup-coverage-supplement-v1");
  console.log(JSON.stringify({
    newScreenshots: 1,
    ladColFull: true,
    latestFullConfirmedBoth: 15,
    forcedFifteen: false,
    predictionHashUnchanged: true,
    predictionInput: false,
  }, null, 2));
}

main();
