/**
 * NPB Daily Evidence Continuity v0 tests.
 * Run: npm run test:npb-daily-evidence-continuity-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assessNpbDailyEvidenceDay,
  assessNpbPregameEvidenceContinuity,
  loadNpbDailyOpsView,
  NPB_PREGAME_EVIDENCE_MISSING,
} from "../src/lib/npb/daily-evidence-continuity-v0";
import { freezeNpbPregameEvidenceSnapshot } from "../src/lib/npb/pregame-evidence-snapshot-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const root = process.cwd();
  const dateKst = "2026-08-07";
  const snapshotRel = `data/predictions/npb/${dateKst}.json`;
  assert.ok(existsSync(snapshotRel));

  const snapBeforeHash = sha256File(snapshotRel);
  const snapBeforeMtime = statSync(snapshotRel).mtimeMs;
  const snapJson = JSON.parse(readFileSync(snapshotRel, "utf8")) as {
    predictionHashSha256: string;
  };
  assert.ok(snapJson.predictionHashSha256.startsWith("44bf11d6"));

  // --- Acceptance: 2026-08-07 COMPLETED ---
  const day = await assessNpbDailyEvidenceDay({
    dateKst,
    cwd: root,
    asOf: "2026-08-07T14:00:00.000Z",
  });
  assert.equal(day.lifecycle, "COMPLETED");
  assert.equal(day.schedule.ready, 6);
  assert.equal(day.schedule.total, 6);
  assert.equal(day.starter.ready, 12);
  assert.equal(day.starter.total, 12);
  assert.equal(day.odds.ready, 6);
  assert.equal(day.odds.total, 6);
  assert.match(day.lineup.display, /NOT RELEASED/i);
  assert.equal(day.evidence.frozen, true);
  assert.ok(day.evidence.hashSha256?.startsWith("44bf11d6"));
  assert.equal(day.results.finalCount, 6);
  assert.equal(day.results.total, 6);
  assert.ok(day.marketBaseline);
  assert.equal(day.marketBaseline!.kind, "MARKET_BASELINE");
  assert.equal(day.marketBaseline!.won, 3);
  assert.equal(day.marketBaseline!.lost, 3);
  assert.equal(day.marketBaseline!.winRatePercent, 50);
  assert.equal(day.prediction.engine, "NOT_AVAILABLE");
  assert.equal(day.prediction.accuracy, "N/A");
  assert.equal(day.prediction.goodPicks, "N/A");
  assert.equal(day.continuity.alert, null);

  const view = await loadNpbDailyOpsView({
    dateKst,
    cwd: root,
    asOf: "2026-08-07T14:00:00.000Z",
  });
  assert.equal(view.day.lifecycle, "COMPLETED");
  assert.ok(view.recentDays.some((d) => d.dateKst === dateKst));
  assert.ok(view.recentDays.some((d) => d.dateKst === "2026-08-08"));
  const d08 = view.recentDays.find((d) => d.dateKst === "2026-08-08");
  assert.ok(d08);
  assert.equal(d08!.lifecycle, "NOT_STARTED");
  assert.ok(view.operatorLines.some((l) => l.includes("COMPLETED")));
  assert.ok(
    view.operatorLines.some((l) => l.includes("Prediction Engine")),
  );

  // --- Continuity guard: schedule without snapshot near first pitch ---
  const guard = assessNpbPregameEvidenceContinuity({
    scheduleExists: true,
    gameCount: 6,
    snapshotExists: false,
    earliestFirstPitchAt: "2026-08-08T09:00:00.000Z",
    asOf: "2026-08-08T08:00:00.000Z", // 1h before → approaching
  });
  assert.equal(guard.alert, NPB_PREGAME_EVIDENCE_MISSING);

  const tmp = mkdtempSync(path.join(tmpdir(), "npb-continuity-"));
  const scheduleSrc = path.join(
    root,
    `data/research/npb/${dateKst}-schedule-v1.json`,
  );
  const scheduleDoc = JSON.parse(readFileSync(scheduleSrc, "utf8")) as {
    date: string;
    dateKst: string;
    games: Array<Record<string, unknown>>;
  };
  const missingDate = "2026-08-08";
  scheduleDoc.date = missingDate;
  scheduleDoc.dateKst = missingDate;
  for (const g of scheduleDoc.games) {
    g.scheduledStartTime = "2026-08-08T09:00:00.000Z";
    g.commenceTimeUtc = "2026-08-08T09:00:00.000Z";
  }
  mkdirSync(path.join(tmp, "data/research/npb"), { recursive: true });
  writeFileSync(
    path.join(tmp, `data/research/npb/${missingDate}-schedule-v1.json`),
    `${JSON.stringify(scheduleDoc, null, 2)}\n`,
    "utf8",
  );

  const missingDay = await assessNpbDailyEvidenceDay({
    dateKst: missingDate,
    cwd: tmp,
    asOf: "2026-08-08T08:30:00.000Z",
  });
  assert.equal(missingDay.lifecycle, "NO_PREGAME_EVIDENCE");
  assert.equal(missingDay.continuity.alert, NPB_PREGAME_EVIDENCE_MISSING);
  assert.equal(
    missingDay.nextAction,
    "OPS_ALERT_NPB_PREGAME_EVIDENCE_MISSING",
  );

  // Collecting (schedule present, not yet approaching) stays COLLECTING
  const collecting = await assessNpbDailyEvidenceDay({
    dateKst: missingDate,
    cwd: tmp,
    asOf: "2026-08-08T02:00:00.000Z",
  });
  assert.equal(collecting.lifecycle, "COLLECTING");
  assert.equal(collecting.continuity.alert, null);

  // Post-start freeze refused (existing freeze guard)
  mkdirSync(path.join(tmp, "data/operator-input/npb"), { recursive: true });
  for (const rel of [
    `data/operator-input/npb/${dateKst}-starter-confirmation-v1.json`,
    `data/operator-input/npb/${dateKst}-market-odds-confirmation-v0.json`,
  ]) {
    const src = path.join(root, rel);
    const dstRel = rel.replace(dateKst, missingDate);
    const raw = readFileSync(src, "utf8").replaceAll(dateKst, missingDate);
    mkdirSync(path.dirname(path.join(tmp, dstRel)), { recursive: true });
    writeFileSync(path.join(tmp, dstRel), raw, "utf8");
  }
  // Also need schedule path already written; rewrite starter/odds game dates via replaceAll
  const postFreeze = await freezeNpbPregameEvidenceSnapshot({
    dateKst: missingDate,
    cwd: tmp,
    asOf: "2026-08-08T10:00:00.000Z", // after first pitch
  });
  assert.equal(postFreeze.wrote, false);
  assert.equal(postFreeze.snapshotStatus, "BLOCKED_AFTER_START");
  assert.ok(!existsSync(path.join(tmp, `data/predictions/npb/${missingDate}.json`)));

  // --- Mutation audit: 08-07 snapshot untouched ---
  assert.equal(sha256File(snapshotRel), snapBeforeHash);
  assert.equal(statSync(snapshotRel).mtimeMs, snapBeforeMtime);
  assert.ok(snapJson.predictionHashSha256.startsWith("44bf11d6"));

  // Copy 08-07 into tmp and re-assess — still COMPLETED, no write to snapshot
  for (const rel of [
    snapshotRel,
    `data/research/npb/${dateKst}-schedule-v1.json`,
    `data/research/npb/${dateKst}-official-results-v0.json`,
    `data/operator-input/npb/${dateKst}-starter-confirmation-v1.json`,
    `data/operator-input/npb/${dateKst}-market-odds-confirmation-v0.json`,
  ]) {
    mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    cpSync(path.join(root, rel), path.join(tmp, rel));
  }
  const beforeTmp = sha256File(path.join(tmp, snapshotRel));
  await assessNpbDailyEvidenceDay({
    dateKst,
    cwd: tmp,
    asOf: "2026-08-07T14:00:00.000Z",
  });
  assert.equal(sha256File(path.join(tmp, snapshotRel)), beforeTmp);
  assert.equal(sha256File(snapshotRel), snapBeforeHash);

  console.log("\ntest:npb-daily-evidence-continuity-v0 OK");
  console.log(`08-07 lifecycle ${day.lifecycle}`);
  console.log(
    `Market Baseline ${day.marketBaseline!.won} Won ${day.marketBaseline!.lost} Lost ${day.marketBaseline!.winRatePercent}%`,
  );
  console.log(`Snapshot hash ${snapJson.predictionHashSha256.slice(0, 8)}… unchanged`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
