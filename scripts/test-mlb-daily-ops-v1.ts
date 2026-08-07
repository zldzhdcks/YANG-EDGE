/**
 * MLB Daily Ops One-Command v1 tests.
 * Run: npm run test:mlb-daily-ops-v1
 * Read-only / assess-only — does not mutate Prediction artifacts.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import {
  assessMlbDailyOpsDay,
  runMlbDailyOpsV1,
} from "../src/lib/mlb/daily-ops-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const pred08 = "data/predictions/mlb/2026-08-08.json";
  const before08 = sha256File(pred08);
  const mtime08 = statSync(pred08).mtimeMs;
  const hash08 = JSON.parse(readFileSync(pred08, "utf8")).meta
    .predictionHashSha256 as string;
  assert.ok(hash08.startsWith("809b3973"));

  // --- 08-07 NO_PREGAME_SNAPSHOT ---
  const d07 = await assessMlbDailyOpsDay({
    dateKst: "2026-08-07",
    sealDeliveryRecord: false,
  });
  assert.equal(d07.lifecycle, "NO_PREGAME_SNAPSHOT");
  assert.equal(d07.provenanceStatus, "NO_PREGAME_SNAPSHOT");
  assert.equal(d07.snapshotVerified, false);
  assert.equal(d07.goodPickCount, 0);
  assert.equal(d07.strongPickCount, 0);
  assert.equal(d07.enginePicks.length, 0);

  // --- 08-08 dry-run / assess-only ---
  const report08 = await runMlbDailyOpsV1({
    dateKst: "2026-08-08",
    assessOnly: true,
    dryRun: true,
    sealDeliveryRecord: false,
    recentDates: ["2026-08-06", "2026-08-07", "2026-08-08"],
  });

  assert.equal(report08.opsSuccess, true);
  assert.equal(report08.day.snapshotVerified, true);
  assert.equal(report08.day.provenanceStatus, "PRE_GAME_SNAPSHOT_VERIFIED");
  assert.equal(report08.day.games, 15);
  assert.ok(report08.day.predictionHash?.startsWith("809b3973"));
  assert.equal(report08.day.predictionHash, hash08);
  assert.equal(report08.day.starter.ready, 27);
  assert.equal(report08.day.starter.total, 30);
  assert.equal(report08.day.odds.ready, 14);
  assert.equal(report08.day.odds.total, 15);
  assert.equal(report08.day.lineup.ready, 0);
  assert.equal(report08.day.lineup.total, 15);
  assert.equal(report08.day.researchReadyPercent, 61);
  assert.equal(report08.day.strongPickCount, 0);
  assert.equal(report08.day.goodPickCount, 3);
  assert.equal(report08.day.enginePicks.length, 3);
  for (const p of report08.day.enginePicks) {
    assert.equal(p.researchOnly, true);
  }
  // Artifact-derived names — not hardcoded assertions on team strings beyond presence
  assert.ok(report08.day.enginePicks.every((p) => p.team.length > 0));
  assert.equal(report08.day.recommendationRecord, "SEALED");
  assert.ok(
    existsSync("data/recommendations/mlb/2026-08-08-engine-recommendations-v1.json"),
  );
  assert.match(report08.operatorSummaryText, /FROZEN BEFORE GAME/);
  assert.match(report08.operatorSummaryText, /RESEARCH ONLY/);
  assert.match(report08.operatorSummaryText, /SEALED/);
  assert.ok(
    report08.lifecycle === "AWAITING_RESULT" ||
      report08.lifecycle === "REVIEW_READY" ||
      report08.lifecycle === "READY",
  );

  // Recent gap visibility
  const r06 = report08.recentDays.find((d) => d.dateKst === "2026-08-06");
  const r07 = report08.recentDays.find((d) => d.dateKst === "2026-08-07");
  const r08 = report08.recentDays.find((d) => d.dateKst === "2026-08-08");
  assert.ok(r06);
  assert.ok(r07);
  assert.ok(r08);
  assert.equal(r07!.lifecycle, "NO_PREGAME_SNAPSHOT");
  assert.equal(r08!.snapshotVerified, true);

  // 08-07 assess-only ops must fail
  const report07 = await runMlbDailyOpsV1({
    dateKst: "2026-08-07",
    assessOnly: true,
    dryRun: true,
    sealDeliveryRecord: false,
  });
  assert.equal(report07.opsSuccess, false);
  assert.ok(report07.failure);
  assert.match(
    report07.failure!.reason,
    /DAILY_PREDICTION_SNAPSHOT_MISSING|NO_PREGAME/,
  );
  assert.match(report07.operatorSummaryText, /NO_PREGAME_SNAPSHOT/);

  // Mutation audit
  assert.equal(sha256File(pred08), before08);
  assert.equal(statSync(pred08).mtimeMs, mtime08);

  console.log("=== MLB DAILY OPS STATUS ===\n");
  for (const d of [r06!, r07!, r08!]) {
    console.log(d.dateKst.slice(5));
    if (d.lifecycle === "NO_PREGAME_SNAPSHOT") {
      console.log("NO_PREGAME_SNAPSHOT");
    } else {
      console.log(
        d.snapshotVerified
          ? "PRE_GAME_SNAPSHOT_VERIFIED"
          : d.provenanceStatus,
      );
      if (d.enginePicks.length) {
        console.log(`Good Picks: ${d.goodPickCount}`);
        console.log(
          `Recommendation Record: ${d.recommendationRecord}`,
        );
        console.log(d.lifecycle);
      } else if (d.recommendationRecord === "NOT_ELIGIBLE") {
        console.log("Record: NOT_ELIGIBLE (reconstructed / pre-epoch)");
        console.log(d.lifecycle);
      }
    }
    console.log("");
  }

  console.log("test:mlb-daily-ops-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
