/**
 * MLB Daily Ops One-Command v1 tests.
 * Run: npm run test:mlb-daily-ops-v1
 * Read-only / assess-only — does not mutate Prediction artifacts.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assessMlbDailyOpsDay,
  runMlbDailyOpsV1,
} from "../src/lib/mlb/daily-ops-v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function fileAudit(p: string): { hash: string; mtimeMs: number } | null {
  if (!existsSync(p)) return null;
  return { hash: sha256File(p), mtimeMs: statSync(p).mtimeMs };
}

/** Copy 08-08 slate fixtures into temp cwd WITHOUT recommendation record. */
function stageSealFixture(dateKst: string): string {
  const root = process.cwd();
  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-daily-ops-seal-"));
  const rels = [
    `data/predictions/mlb/${dateKst}.json`,
    `data/research/mlb/${dateKst}-schedule-v1.json`,
    `data/research/mlb/${dateKst}-daily-research-summary-v1.json`,
    `data/research/mlb/${dateKst}-starter-dataset-v1.json`,
    `data/research/mlb/${dateKst}-odds-history-dataset-v1.json`,
    `data/research/mlb/${dateKst}-lineup-dataset-v1.json`,
  ];
  for (const rel of rels) {
    const src = path.join(root, rel);
    if (!existsSync(src)) continue;
    const dest = path.join(tmp, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(src, dest);
  }
  mkdirSync(path.join(tmp, "data/recommendations/mlb"), { recursive: true });
  assert.equal(
    existsSync(
      path.join(
        tmp,
        `data/recommendations/mlb/${dateKst}-engine-recommendations-v1.json`,
      ),
    ),
    false,
  );
  return tmp;
}

async function main() {
  const pred08 = "data/predictions/mlb/2026-08-08.json";
  const pred12 = "data/predictions/mlb/2026-08-12.json";
  const korean12 =
    "data/operator-input/mlb/2026-08-12-korean-market-odds-observation-v0.json";
  const lineup12 =
    "data/operator-input/mlb/2026-08-12-expected-lineup-observation-v0.json";
  const rec08 =
    "data/recommendations/mlb/2026-08-08-engine-recommendations-v1.json";
  const rec12 =
    "data/recommendations/mlb/2026-08-12-engine-recommendations-v1.json";

  const before08 = sha256File(pred08);
  const mtime08 = statSync(pred08).mtimeMs;
  const hash08 = JSON.parse(readFileSync(pred08, "utf8")).meta
    .predictionHashSha256 as string;
  assert.ok(hash08.startsWith("809b3973"));

  const before12 = fileAudit(pred12);
  const beforeKorean12 = fileAudit(korean12);
  const beforeLineup12 = fileAudit(lineup12);
  const beforeRec08 = fileAudit(rec08);
  const beforeRec12 = fileAudit(rec12);
  assert.ok(before12);
  const pred12MetaHash = JSON.parse(readFileSync(pred12, "utf8")).meta
    .predictionHashSha256 as string;
  assert.equal(
    pred12MetaHash,
    "b8c179301037b40fee8f70ec768e39be85eb34d7195232b5f72be919e8fa04db",
  );
  const korean12DocHash = beforeKorean12
    ? (JSON.parse(readFileSync(korean12, "utf8")).koreanMarketOddsHash as string)
    : null;
  const lineup12DocHash = beforeLineup12
    ? (JSON.parse(readFileSync(lineup12, "utf8")).expectedLineupHash as string)
    : null;
  if (korean12DocHash) {
    assert.equal(
      korean12DocHash,
      "4b53874fd72c641b20edadeab7890025d00b140c375063d0fe576bc009f51a42",
    );
  }
  if (lineup12DocHash) {
    assert.equal(
      lineup12DocHash,
      "5ba12c76528dbeeeb660a85ee9e0dc0b5f9935170487f1474c2228223662422c",
    );
  }

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

  // --- A. assessMlbDailyOpsDay direct: seal → same assessment SEALED ---
  const sealTmp = stageSealFixture("2026-08-08");
  const sealedDay = await assessMlbDailyOpsDay({
    dateKst: "2026-08-08",
    cwd: sealTmp,
    sealDeliveryRecord: true,
  });
  assert.equal(sealedDay.recommendationRecord, "SEALED");
  assert.ok(
    existsSync(
      path.join(
        sealTmp,
        "data/recommendations/mlb/2026-08-08-engine-recommendations-v1.json",
      ),
    ),
  );
  // Already-sealed re-assess stays SEALED (immutable)
  const resealed = await assessMlbDailyOpsDay({
    dateKst: "2026-08-08",
    cwd: sealTmp,
    sealDeliveryRecord: true,
  });
  assert.equal(resealed.recommendationRecord, "SEALED");

  // --- B. assessOnly ALWAYS read-only (even if sealDeliveryRecord=true) ---
  const roTmp = stageSealFixture("2026-08-08");
  const roBefore = readdirSync(path.join(roTmp, "data/recommendations/mlb"));
  const roReport = await runMlbDailyOpsV1({
    dateKst: "2026-08-08",
    cwd: roTmp,
    assessOnly: true,
    dryRun: false,
    sealDeliveryRecord: true,
    recentDates: ["2026-08-08"],
  });
  assert.equal(roReport.day.recommendationRecord, "ABSENT");
  assert.equal(roReport.writesPerformed, 0);
  assert.deepEqual(
    readdirSync(path.join(roTmp, "data/recommendations/mlb")),
    roBefore,
  );
  assert.equal(
    existsSync(
      path.join(
        roTmp,
        "data/recommendations/mlb/2026-08-08-engine-recommendations-v1.json",
      ),
    ),
    false,
  );

  // --- C. normal run: seal in same run → day + recent + summary SEALED ---
  const normalTmp = stageSealFixture("2026-08-08");
  const predBeforeNormal = sha256File(
    path.join(normalTmp, "data/predictions/mlb/2026-08-08.json"),
  );
  const normalReport = await runMlbDailyOpsV1({
    dateKst: "2026-08-08",
    cwd: normalTmp,
    assessOnly: false,
    dryRun: false,
    noProvider: true,
    writePrediction: false,
    enforcePregameGates: false,
    sealDeliveryRecord: true,
    recentDates: ["2026-08-08"],
  });
  assert.equal(normalReport.day.recommendationRecord, "SEALED");
  const normalRecent = normalReport.recentDays.find(
    (d) => d.dateKst === "2026-08-08",
  );
  assert.ok(normalRecent);
  assert.equal(normalRecent!.recommendationRecord, "SEALED");
  assert.match(
    normalReport.operatorSummaryText,
    /Recommendation Record\n✓ SEALED/,
  );
  assert.doesNotMatch(
    normalReport.operatorSummaryText,
    /Recommendation Record\n✗ ABSENT/,
  );
  assert.ok(
    existsSync(
      path.join(
        normalTmp,
        "data/recommendations/mlb/2026-08-08-engine-recommendations-v1.json",
      ),
    ),
  );
  assert.equal(
    sha256File(path.join(normalTmp, "data/predictions/mlb/2026-08-08.json")),
    predBeforeNormal,
  );

  // --- Provenance not eligible → NOT_ELIGIBLE ---
  const d06 = await assessMlbDailyOpsDay({
    dateKst: "2026-08-06",
    sealDeliveryRecord: false,
  });
  assert.equal(d06.recommendationRecord, "NOT_ELIGIBLE");

  // Mutation audit (repo artifacts)
  assert.equal(sha256File(pred08), before08);
  assert.equal(statSync(pred08).mtimeMs, mtime08);
  assert.equal(fileAudit(pred12)?.hash, before12!.hash);
  assert.equal(fileAudit(pred12)?.mtimeMs, before12!.mtimeMs);
  assert.equal(
    JSON.parse(readFileSync(pred12, "utf8")).meta.predictionHashSha256,
    pred12MetaHash,
  );
  if (beforeKorean12) {
    assert.equal(fileAudit(korean12)?.hash, beforeKorean12.hash);
    assert.equal(fileAudit(korean12)?.mtimeMs, beforeKorean12.mtimeMs);
    assert.equal(
      JSON.parse(readFileSync(korean12, "utf8")).koreanMarketOddsHash,
      korean12DocHash,
    );
  }
  if (beforeLineup12) {
    assert.equal(fileAudit(lineup12)?.hash, beforeLineup12.hash);
    assert.equal(fileAudit(lineup12)?.mtimeMs, beforeLineup12.mtimeMs);
    assert.equal(
      JSON.parse(readFileSync(lineup12, "utf8")).expectedLineupHash,
      lineup12DocHash,
    );
  }
  if (beforeRec08) {
    assert.equal(fileAudit(rec08)?.hash, beforeRec08.hash);
    assert.equal(fileAudit(rec08)?.mtimeMs, beforeRec08.mtimeMs);
  }
  if (beforeRec12) {
    assert.equal(fileAudit(rec12)?.hash, beforeRec12.hash);
    assert.equal(fileAudit(rec12)?.mtimeMs, beforeRec12.mtimeMs);
  }

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

  console.log("regression A: assessDay seal → SEALED");
  console.log("regression B: assessOnly write=0 / ABSENT");
  console.log("regression C: normal same-run day+recent SEALED");
  console.log("test:mlb-daily-ops-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
