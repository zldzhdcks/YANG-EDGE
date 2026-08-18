/**
 * 2026-08-18/batch-2253 operator screenshot intake tests.
 * Run: npm run test:operator-observations-2026-08-18-batch-2253
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { canonicalDomesticTeam } from "../src/lib/mlb/domestic-markets-v1";
import {
  AUDIT_REL,
  BATCH_ID,
  FORBIDDEN_WRITE_PREFIXES,
  MANIFEST_REL,
  RAW_REL,
  RECEIVED_AT_KST,
  SCOPE_STATUS,
  SCREENSHOTS,
  SLATE_DATE_KST,
  STRUCTURED_REL,
  TIMING_CLASS,
  runIntake,
} from "./intake-2026-08-18-batch-2253-operator-pregame-observations";

function shaFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function gitShort(cwd: string): string {
  return execSync("git status --short", { cwd, encoding: "utf8" });
}

async function main() {
  const cwd = process.cwd();
  const { document, manifest } = await runIntake(cwd);

  assert.equal(BATCH_ID, "2026-08-18/batch-2253");
  assert.equal(SLATE_DATE_KST, "2026-08-19");
  assert.equal(RECEIVED_AT_KST, "2026-08-18T22:53:44+09:00");
  assert.equal(TIMING_CLASS, "PRE_PREDICTION");
  assert.equal(SCOPE_STATUS, "NOT_READY_TO_LOCK_DAILY_SCOPE");
  assert.equal(SCREENSHOTS.length, 7);
  assert.equal(document.predictionInput, false);
  assert.equal(manifest.predictionInput, false);
  assert.equal(document.observationPhase, "PRE_PREDICTION");
  assert.equal(document.dateClassification, "DATE_CONFIRMED");
  assert.equal(document.scopeLockStatus, "NOT_READY_TO_LOCK_DAILY_SCOPE");

  for (const shot of SCREENSHOTS) {
    const abs = path.join(cwd, RAW_REL, shot.file);
    assert.equal(existsSync(abs), true, shot.file);
    assert.equal(shaFile(abs), shot.sha256, shot.file);
    assert.equal(readFileSync(abs).byteLength, shot.bytes, shot.file);
  }

  const mlbLabels = [
    "볼티오리",
    "뉴욕양키",
    "탬파레이",
    "토론블루",
    "피츠파이",
    "디트타이",
    "필라필리",
    "마이말린",
    "클리가디",
    "샌프자이",
    "신시레즈",
    "세인카디",
    "뉴욕메츠",
    "샌디파드",
    "보스레드",
    "애리다이",
    "미네트윈",
    "애틀브레",
    "밀워브루",
    "시애매리",
    "캔자로얄",
    "애슬레틱",
    "텍사레인",
    "워싱내셔",
    "시카컵스",
    "시카화이",
    "휴스애스",
    "LA에인절",
    "콜로로키",
    "LA다저스",
  ];
  for (const ko of mlbLabels) {
    assert.ok(canonicalDomesticTeam(ko), `alias missing: ${ko}`);
  }
  assert.equal(canonicalDomesticTeam("탬플레이"), null);
  assert.equal(canonicalDomesticTeam("뉴욕메즈"), null);
  assert.equal(canonicalDomesticTeam("루도고레츠"), null);

  assert.equal(document.domesticOdds.length, 15);
  assert.equal(document.expectedLineups.length, 15);
  assert.equal(document.nonMlbOddsFixtures.length, 6);
  assert.equal(document.summary.mlbGamePkJoined, 0);
  assert.equal(document.summary.lineupOfficial, 0);
  assert.equal(document.summary.lineupConfirmed, 0);
  assert.equal(document.summary.predictionInputTrue, 0);
  assert.equal(document.summary.footballJoined, 0);
  assert.equal(document.summary.players, 270);

  for (const row of document.domesticOdds) {
    assert.equal(row.predictionInput, false);
    assert.equal(row.timingClass, "PRE_PREDICTION");
    assert.equal(row.gamePk, null);
    assert.equal(row.internalGameId, null);
    assert.equal(row.mappingStatus, "TEAM_ALIAS_MATCHED_NO_SCHEDULE");
    assert.equal(row.doubleheaderRisk, "UNKNOWN_NO_SCHEDULE");
    assert.ok(row.canonicalHome);
    assert.ok(row.canonicalAway);
  }

  const cubs = document.domesticOdds.find(
    (r) => r.rawHomeLabel === "시카컵스" && r.rawAwayLabel === "시카화이",
  );
  assert.ok(cubs);
  const cubsTotal = cubs.markets.find((m) => m.rawMarketLabel === "U 8.5");
  assert.ok(cubsTotal);
  assert.equal(cubsTotal.awayPrice, null);
  assert.equal(cubsTotal.rawValueStatus, "NOT_FULLY_VISIBLE");

  for (const row of document.expectedLineups) {
    assert.equal(row.lineupType, "EXPECTED");
    assert.equal(row.confirmedLineup, false);
    assert.equal(row.officialLineup, false);
    assert.equal(row.predictionInput, false);
    assert.equal(row.gamePk, null);
    assert.equal(row.internalGameId, null);
    assert.equal(row.awayLineup.length, 9);
    assert.equal(row.homeLineup.length, 9);
    assert.equal(row.umpire, "NOT_ANNOUNCED");
  }

  for (const row of document.nonMlbOddsFixtures) {
    assert.equal(row.identityStatus, "JOIN_FAILED");
    assert.equal(row.mappingStatus, "NOT_ON_REGISTERED_SLATE");
    assert.equal(row.matchId, null);
    assert.equal(row.predictionInput, false);
  }

  const structured = JSON.parse(readFileSync(path.join(cwd, STRUCTURED_REL), "utf8"));
  assert.equal(structured.batchId, BATCH_ID);
  assert.equal(structured.predictionInput, false);
  const audit = JSON.parse(readFileSync(path.join(cwd, AUDIT_REL), "utf8"));
  assert.equal(audit.predictionInput, false);
  assert.equal(audit.frozenArtifactsOpened, false);
  assert.equal(audit.providerLiveCalls, 0);
  assert.equal(audit.predictionBuilderCalls, 0);

  const status = gitShort(cwd);
  for (const line of status.split(/\r?\n/).filter(Boolean)) {
    const xy = line.slice(0, 2);
    const file = line.slice(3).replace(/"/g, "");
    if (
      file.includes("data/predictions/") ||
      (file.includes("data/operator-input/") && !file.includes("2026-08-19")) ||
      (file.includes("data/research/") && !file.includes("2026-08-19"))
    ) {
      throw new Error(`forbidden dirty path: ${xy} ${file}`);
    }
    if (xy.trim() !== "??" && (file.includes("리포트") || file.includes("353\\246\\254"))) {
      throw new Error(`리포트 touched: ${xy} ${file}`);
    }
  }
  void FORBIDDEN_WRITE_PREFIXES;
  assert.equal(existsSync(path.join(cwd, MANIFEST_REL)), true);
  assert.equal(structured.summary.mlbGamePkJoined, 0);
  assert.equal(
    existsSync(path.join(cwd, `data/predictions/mlb/${SLATE_DATE_KST}.json`)),
    false,
  );

  console.log("PASS 2026-08-18/batch-2253 operator observations intake");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
