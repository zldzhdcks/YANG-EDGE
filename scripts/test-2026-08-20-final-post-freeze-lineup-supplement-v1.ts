/**
 * 2026-08-20 final post-freeze lineup supplement tests (batch-0011).
 * Run: npm run test:2026-08-20-final-post-freeze-lineup-supplement-v1
 * Read-only against sealed freeze artifacts. Does not rerun Prediction.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const DATE_KST = "2026-08-20";
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
const RAW_DIR_REL =
  "data/operator-observations/raw/2026-08-20/batch-0011";
const STRUCTURED_REL =
  "data/operator-observations/structured/2026-08-20/batch-0011-post-freeze-lineup-supplement-v0.json";
const SUPPLEMENT_REL =
  "data/operator-input/mlb/2026-08-20-confirmed-lineup-supplement-batch-0011-v0.json";
const AUDIT_REL =
  "data/audits/2026-08-20-final-post-freeze-lineup-supplement-v1.json";
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

const NEW_SHA = {
  s060059: "99801703428968a1ff8330b7ff37267462154134a7457556f0c5f212e45de95e",
  s060235: "fb8f8e59344d67ece84bc5d1b27fb6fdfba8ad7126333187315445949f44ff07",
} as const;

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
): "PRE_FREEZE" | "POST_FREEZE_PRE_GAME" | "POST_START" | "UNKNOWN_TIMING" {
  const observed = Date.parse(observedAt);
  const freeze = Date.parse(freezePredictedAt);
  const start = Date.parse(commenceTimeUtc);
  if (!Number.isFinite(observed) || !Number.isFinite(freeze) || !Number.isFinite(start)) {
    return "UNKNOWN_TIMING";
  }
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
  assert.equal(pred.meta.dateKst, DATE_KST);
  assert.equal(pred.meta.predictedAt, "2026-08-19T16:27:02.247Z");
  assert.equal(pred.meta.predictionHashSha256, FROZEN_SHA.predictionHashSha256);
  assert.equal(pred.meta.inputManifest.inputHash, FROZEN_SHA.inputManifestHash);

  const rawDir = path.join(cwd, RAW_DIR_REL);
  const png1 = path.join(rawDir, "screenshot_2026-08-20_060059.png");
  const png2 = path.join(rawDir, "screenshot_2026-08-20_060235.png");
  assert.equal(existsSync(png1), true);
  assert.equal(existsSync(png2), true);
  assert.equal(sha256File(png1), NEW_SHA.s060059);
  assert.equal(sha256File(png2), NEW_SHA.s060235);
  assert.equal(statSync(png1).size, 35244);
  assert.equal(statSync(png2).size, 186925);

  const inboxPng = walkPng(INBOX_ROOT);
  const newInbox = inboxPng.filter((p) => {
    const h = sha256File(p);
    return h === NEW_SHA.s060059 || h === NEW_SHA.s060235;
  });
  assert.equal(newInbox.length, 2);

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
  assert.equal(structured.summary.screenshots, 2);
  assert.equal(structured.summary.confirmedCards, 6);
  assert.equal(structured.summary.expectedCards, 1);
  assert.equal(structured.summary.mixedCards, 0);
  assert.equal(structured.summary.confirmedFullGames, 6);
  assert.equal(structured.summary.confirmedPartialGames, 0);
  assert.equal(structured.summary.confirmedPlayerSlots, 108);
  assert.equal(structured.summary.postFreezePregame, 7);
  assert.equal(structured.summary.postStart, 0);
  assert.equal(structured.summary.unknownTiming, 0);
  assert.equal(structured.summary.predictionInputTrue, 0);

  for (const game of structured.confirmedLineups as Array<{
    gamePk: number;
    awayTeam: string;
    homeTeam: string;
    commenceTimeUtc: string;
    observedAt: string;
    timingVsPredictionFreeze: string;
    completeness: string;
    confirmedSides: string[];
    expectedSides: string[];
    awayLineup: unknown[];
    homeLineup: unknown[];
    predictionInput: boolean;
    status: string;
  }>) {
    const sched = byPk.get(game.gamePk);
    assert.ok(sched, `schedule missing gamePk ${game.gamePk}`);
    assert.equal(game.awayTeam, sched!.awayTeam);
    assert.equal(game.homeTeam, sched!.homeTeam);
    assert.equal(game.commenceTimeUtc, sched!.commenceTimeUtc);
    assert.equal(game.status, "MATCHED_UNIQUE");
    assert.equal(game.predictionInput, false);
    assert.equal(game.completeness, "FULL");
    assert.deepEqual(game.confirmedSides, ["AWAY", "HOME"]);
    assert.equal(game.awayLineup.length, 9);
    assert.equal(game.homeLineup.length, 9);
    const timing = classifyTiming(
      game.observedAt,
      pred.meta.predictedAt,
      game.commenceTimeUtc,
    );
    assert.equal(timing, "POST_FREEZE_PRE_GAME");
    assert.equal(game.timingVsPredictionFreeze, "POST_FREEZE_PRE_GAME");
  }

  const ladCol = (
    structured.expectedLineups as Array<{
      gamePk: number;
      confirmedSides: string[];
      expectedSides: string[];
      lineupType: string;
      confirmedLineup: boolean;
    }>
  ).find((g) => g.gamePk === 824318);
  assert.ok(ladCol);
  assert.equal(ladCol!.lineupType, "EXPECTED");
  assert.equal(ladCol!.confirmedLineup, false);
  assert.deepEqual(ladCol!.confirmedSides, []);
  assert.deepEqual(ladCol!.expectedSides, ["AWAY", "HOME"]);
  assert.equal(
    (structured.confirmedLineups as Array<{ gamePk: number }>).some((g) => g.gamePk === 824318),
    false,
  );

  const batch0010 = JSON.parse(readFileSync(path.join(cwd, BATCH_0010_REL), "utf8"));
  const priorNyy = batch0010.confirmedLineups.find((g: { gamePk: number }) => g.gamePk === 824801);
  assert.equal(priorNyy.completeness, "PARTIAL");
  assert.deepEqual(priorNyy.confirmedSides, ["AWAY"]);
  const nowNyy = structured.confirmedLineups.find((g: { gamePk: number }) => g.gamePk === 824801);
  assert.equal(nowNyy.completeness, "FULL");

  assert.equal(supplement.predictionInput, false);
  assert.equal(supplement.predictionFrozen, true);
  assert.equal(supplement.rows.length, 12);
  assert.equal(supplement.summary.expectedCopiedIntoConfirmed, 0);
  for (const row of supplement.rows as Array<{
    predictionInput: boolean;
    players: unknown[];
    relativeToFreeze: string;
    sourceHash: string;
  }>) {
    assert.equal(row.predictionInput, false);
    assert.equal(row.players.length, 9);
    assert.equal(row.relativeToFreeze, "POST_FREEZE_PRE_GAME");
    assert.ok(row.sourceHash === NEW_SHA.s060059 || row.sourceHash === NEW_SHA.s060235);
  }

  assert.equal(audit.intake.newScreenshots, 2);
  assert.equal(audit.timing.postStart, 0);
  assert.equal(audit.timing.postFreezePregame, 7);
  assert.equal(audit.prediction.rerun, false);
  assert.equal(audit.prediction.hashBefore, predSha);
  assert.equal(audit.prediction.hashAfter, predSha);
  assert.equal(audit.network.providerCalls, 0);
  assert.equal(audit.engine.engineCalls, 0);
  assert.equal(audit.mandatoryCompletion.total, "60%");
  assert.equal(audit.latestCoverage.mlbTotalGames, 15);
  assert.equal(audit.latestCoverage.fullConfirmedBoth, 14);
  assert.equal(audit.latestCoverage.partialConfirmed, 0);
  assert.equal(audit.latestCoverage.expectedRemaining, 1);
  assert.equal(audit.latestCoverage.notFullyConfirmed.length, 1);
  assert.equal(audit.latestCoverage.notFullyConfirmed[0].gamePk, 824318);
  assert.equal(audit.latestCoverage.notFullyConfirmed[0].latestStatus, "EXPECTED_BOTH");
  assert.deepEqual(audit.comparisonVsBatch0010.newlyFullConfirmed, [
    824801, 824076, 823748, 822860,
  ]);
  assert.deepEqual(audit.comparisonVsBatch0010.stillExpected, [824318]);
  assert.deepEqual(audit.comparisonVsBatch0010.postStartRecaptures, []);

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
      ].join(" "),
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(gitDiff, "");

  console.log("PASS 2026-08-20-final-post-freeze-lineup-supplement-v1");
  console.log(
    JSON.stringify(
      {
        newScreenshotShaCount: 2,
        confirmedFullGames: 6,
        expectedRemainingThisBatch: 1,
        latestFullConfirmedBoth: 14,
        latestExpected: 1,
        ladColPromoted: false,
        postStart: 0,
        predictionRerun: 0,
        predictionHashUnchanged: true,
      },
      null,
      2,
    ),
  );
}

main();
