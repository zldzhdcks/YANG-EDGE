/**
 * NPB Postgame Ops One-Command v0 tests.
 * Run: npm run test:npb-postgame-ops-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runNpbPostgameOpsV0 } from "../src/lib/npb/postgame-ops-v0";

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

  const report = await runNpbPostgameOpsV0({
    dateKst,
    cwd: root,
    assessOnly: true,
    asOf: "2026-08-07T14:00:00.000Z",
  });

  assert.equal(report.opsSuccess, true);
  assert.equal(report.day.lifecycle, "COMPLETED");
  assert.equal(report.day.results.finalCount, 6);
  assert.equal(report.day.results.total, 6);
  assert.ok(report.day.marketBaseline);
  assert.equal(report.day.marketBaseline!.won, 3);
  assert.equal(report.day.marketBaseline!.lost, 3);
  assert.equal(report.day.marketBaseline!.winRatePercent, 50);
  assert.equal(report.day.prediction.engine, "NOT_AVAILABLE");
  assert.ok(report.immutableAudit.predictionUnchanged);
  assert.equal(
    report.immutableAudit.predictionHashFieldBefore,
    fieldHash,
  );
  assert.match(report.operatorSummaryText, /NPB POSTGAME OPS/);
  assert.match(report.operatorSummaryText, /Market Baseline/);
  assert.match(report.operatorSummaryText, /3 Won/);
  assert.match(report.operatorSummaryText, /50\.0%/);
  assert.match(report.operatorSummaryText, /NOT AVAILABLE/);
  assert.match(report.operatorSummaryText, /Mutation:\nNONE/);
  assert.match(report.operatorSummaryText, /COMPLETED/);
  assert.ok(!report.operatorSummaryText.includes("Good Pick"));

  assert.equal(sha256File(snapshotRel), beforeHash);
  assert.equal(statSync(snapshotRel).mtimeMs, beforeMtime);

  // 08-08 NOT_STARTED / no pregame
  const r08 = await runNpbPostgameOpsV0({
    dateKst: "2026-08-08",
    cwd: root,
    assessOnly: true,
    asOf: "2026-08-08T12:00:00.000Z",
  });
  assert.equal(r08.opsSuccess, false);
  assert.equal(r08.failure?.reason, "NO_PREGAME_EVIDENCE");
  assert.match(r08.operatorSummaryText, /NO_PREGAME_EVIDENCE|사후/);

  // Write path in temp cwd — snapshot immutable
  const tmp = mkdtempSync(path.join(tmpdir(), "npb-postgame-ops-"));
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
  const tmpMtime = statSync(path.join(tmp, snapshotRel)).mtimeMs;
  const tmpField = JSON.parse(readFileSync(path.join(tmp, snapshotRel), "utf8"))
    .predictionHashSha256 as string;

  const written = await runNpbPostgameOpsV0({
    dateKst,
    cwd: tmp,
    asOf: "2026-08-07T12:30:00.000Z",
  });
  assert.equal(written.opsSuccess, true);
  assert.equal(written.day.lifecycle, "COMPLETED");
  assert.ok(written.immutableAudit.predictionUnchanged);
  assert.equal(sha256File(path.join(tmp, snapshotRel)), tmpBefore);
  assert.equal(statSync(path.join(tmp, snapshotRel)).mtimeMs, tmpMtime);
  assert.equal(
    JSON.parse(readFileSync(path.join(tmp, snapshotRel), "utf8"))
      .predictionHashSha256,
    tmpField,
  );

  // Touch results file must not affect snapshot (sanity)
  writeFileSync(
    path.join(tmp, "data/research/npb/touch.txt"),
    "ok\n",
    "utf8",
  );
  assert.equal(sha256File(path.join(tmp, snapshotRel)), tmpBefore);

  // Repo snapshot still untouched
  assert.equal(sha256File(snapshotRel), beforeHash);
  assert.equal(statSync(snapshotRel).mtimeMs, beforeMtime);

  console.log("\ntest:npb-postgame-ops-v0 OK");
  console.log(
    `08-07 COMPLETED · Market ${written.day.marketBaseline!.won}/${written.day.marketBaseline!.lost} · hash ${fieldHash.slice(0, 8)}…`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
