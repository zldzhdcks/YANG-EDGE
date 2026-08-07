/**
 * NPB Daily Ops One-Command v0 tests.
 * Run: npm run test:npb-daily-ops-v0
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
  resolveNpbDailyOpsNextAction,
  runNpbDailyOpsV0,
} from "../src/lib/npb/daily-ops-v0";
import { assessNpbDailyEvidenceDay } from "../src/lib/npb/daily-evidence-continuity-v0";
import { freezeNpbPregameEvidenceSnapshot } from "../src/lib/npb/pregame-evidence-snapshot-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const root = process.cwd();
  const dateKst = "2026-08-07";
  const snapshotRel = `data/predictions/npb/${dateKst}.json`;
  const beforeHash = sha256File(snapshotRel);
  const beforeMtime = statSync(snapshotRel).mtimeMs;
  const fieldHash = JSON.parse(readFileSync(snapshotRel, "utf8"))
    .predictionHashSha256 as string;
  assert.ok(fieldHash.startsWith("44bf11d6"));

  const report = await runNpbDailyOpsV0({
    dateKst,
    cwd: root,
    assessOnly: true,
    asOf: "2026-08-07T14:00:00.000Z",
  });

  assert.equal(report.opsSuccess, true);
  assert.equal(report.day.lifecycle, "COMPLETED");
  assert.equal(report.day.evidence.status, "PRE_GAME_SNAPSHOT_VERIFIED");
  assert.ok(report.day.evidence.hashSha256?.startsWith("44bf11d6"));
  assert.equal(report.day.schedule.ready, 6);
  assert.equal(report.day.starter.ready, 12);
  assert.equal(report.day.odds.ready, 6);
  assert.match(report.day.lineup.display, /NOT RELEASED/i);
  assert.equal(report.day.prediction.engine, "NOT_AVAILABLE");
  assert.match(report.operatorSummaryText, /NPB DAILY OPS/);
  assert.match(report.operatorSummaryText, /NOT AVAILABLE/);
  assert.match(report.operatorSummaryText, /COMPLETED/);
  assert.ok(report.recentDays.some((d) => d.dateKst === "2026-08-08"));
  const d08 = report.recentDays.find((d) => d.dateKst === "2026-08-08");
  assert.equal(d08?.lifecycle, "NOT_STARTED");

  assert.equal(sha256File(snapshotRel), beforeHash);
  assert.equal(statSync(snapshotRel).mtimeMs, beforeMtime);

  // Missing starter → NEXT ACTION points to UI (assess-only, no freeze)
  const tmp = mkdtempSync(path.join(tmpdir(), "npb-daily-ops-"));
  const scheduleSrc = path.join(
    root,
    `data/research/npb/${dateKst}-schedule-v1.json`,
  );
  const missingDate = "2026-08-09";
  const scheduleDoc = JSON.parse(readFileSync(scheduleSrc, "utf8")) as {
    date: string;
    dateKst: string;
    games: Array<Record<string, unknown>>;
  };
  scheduleDoc.date = missingDate;
  scheduleDoc.dateKst = missingDate;
  for (const g of scheduleDoc.games) {
    g.scheduledStartTime = "2026-08-09T09:00:00.000Z";
    g.commenceTimeUtc = "2026-08-09T09:00:00.000Z";
  }
  mkdirSync(path.join(tmp, "data/research/npb"), { recursive: true });
  writeFileSync(
    path.join(tmp, `data/research/npb/${missingDate}-schedule-v1.json`),
    `${JSON.stringify(scheduleDoc, null, 2)}\n`,
  );

  const missingReport = await runNpbDailyOpsV0({
    dateKst: missingDate,
    cwd: tmp,
    assessOnly: true,
    asOf: "2026-08-09T02:00:00.000Z",
  });
  assert.equal(missingReport.day.lifecycle, "COLLECTING");
  assert.equal(missingReport.nextAction, "OPEN NPB STARTER INPUT");
  assert.ok(missingReport.nextActionUi?.includes("/internal/research/npb/starter"));
  assert.match(missingReport.operatorSummaryText, /OPEN NPB STARTER INPUT/);

  // Schedule-only freeze allowed (null starters/odds) — no invented picks
  const freeze = await freezeNpbPregameEvidenceSnapshot({
    dateKst: missingDate,
    cwd: tmp,
    asOf: "2026-08-09T03:00:00.000Z",
  });
  assert.equal(freeze.wrote, true);
  assert.ok(freeze.document);
  assert.equal(freeze.document!.enginePolicy, "NO_ENGINE_AVAILABLE");
  for (const g of freeze.document!.games) {
    assert.equal(g.prediction.officialPick, null);
    assert.equal(g.prediction.modelProbability, null);
    assert.equal(g.starter.away.displayName, null);
  }
  assert.ok(existsSync(path.join(tmp, `data/predictions/npb/${missingDate}.json`)));

  const afterFreeze = await assessNpbDailyEvidenceDay({
    dateKst: missingDate,
    cwd: tmp,
    asOf: "2026-08-09T03:30:00.000Z",
  });
  const resolved = resolveNpbDailyOpsNextAction({ day: afterFreeze });
  assert.equal(resolved.nextAction, "AWAIT POSTGAME RESULT");

  // Approaching pitch without snapshot → continuity failure
  const alertDate = "2026-08-10";
  scheduleDoc.date = alertDate;
  scheduleDoc.dateKst = alertDate;
  for (const g of scheduleDoc.games) {
    g.scheduledStartTime = "2026-08-10T09:00:00.000Z";
    g.commenceTimeUtc = "2026-08-10T09:00:00.000Z";
  }
  writeFileSync(
    path.join(tmp, `data/research/npb/${alertDate}-schedule-v1.json`),
    `${JSON.stringify(scheduleDoc, null, 2)}\n`,
  );
  const alertReport = await runNpbDailyOpsV0({
    dateKst: alertDate,
    cwd: tmp,
    assessOnly: true,
    asOf: "2026-08-10T08:00:00.000Z",
  });
  assert.equal(alertReport.day.lifecycle, "NO_PREGAME_EVIDENCE");
  assert.equal(alertReport.opsSuccess, false);
  assert.match(alertReport.operatorSummaryText, /NPB_PREGAME_EVIDENCE_MISSING/);

  // Repo 08-07 snapshot still immutable
  assert.equal(sha256File(snapshotRel), beforeHash);
  assert.equal(statSync(snapshotRel).mtimeMs, beforeMtime);

  // Copy 08-07 into tmp and run assess — no mutation
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
  const tmpBefore = sha256File(path.join(tmp, snapshotRel));
  await runNpbDailyOpsV0({
    dateKst,
    cwd: tmp,
    assessOnly: true,
    asOf: "2026-08-07T14:00:00.000Z",
  });
  assert.equal(sha256File(path.join(tmp, snapshotRel)), tmpBefore);

  console.log("\ntest:npb-daily-ops-v0 OK");
  console.log(`08-07 ${report.day.lifecycle} hash ${fieldHash.slice(0, 8)}…`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
