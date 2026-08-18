/**
 * 2026-08-19 pregame input close tests.
 * Run: npm run test:2026-08-19-pregame-input-close-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  CLOSE_REL,
  DATE_KST,
  EXPECTED_REL,
  FB_SCHEDULE_REL,
  JOIN_REL,
  KOREAN_REL,
  LOCK_REL,
  MLB_SCHEDULE_REL,
  OBS_REL,
  PREDICTION_REL,
  SNAPSHOT_REL,
  auditPregameInputClose,
} from "./audit-2026-08-19-pregame-input-close-v1";

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

async function main() {
  const cwd = process.cwd();
  const lock = JSON.parse(readFileSync(path.join(cwd, LOCK_REL), "utf8"));
  const obsHash = sha256File(path.join(cwd, OBS_REL));
  assert.equal(obsHash, lock.sourceOperatorObservationHash);
  assert.equal(lock.observedScope.total, 21);
  assert.equal(existsSync(path.join(cwd, PREDICTION_REL)), false);
  assert.equal(existsSync(path.join(cwd, SNAPSHOT_REL)), false);

  const scheduleBefore = sha256File(path.join(cwd, MLB_SCHEDULE_REL));
  const fbBefore = sha256File(path.join(cwd, FB_SCHEDULE_REL));
  const joinBefore = sha256File(path.join(cwd, JOIN_REL));
  const lockBefore = sha256File(path.join(cwd, LOCK_REL));

  const close = await auditPregameInputClose(cwd);
  assert.equal(close.stageStatus, "B_PREGAME_INPUT_DONE");
  assert.equal(close.predictionRun, false);
  assert.equal(close.snapshotRun, false);
  assert.equal(close.postgameAccess, false);
  assert.equal(close.engineConnected, false);
  assert.equal(close.unexplainedMissing, 0);
  assert.equal(close.MLB.gamePkUnique, 15);
  assert.equal(close.MLB.expectedLineupObservation.matched, 15);
  assert.equal(close.MLB.expectedLineupObservation.slots, 270);
  assert.equal(close.MLB.expectedLineupObservation.confirmed, 0);
  assert.equal(close.MLB.expectedLineupObservation.late, 0);
  assert.equal(close.MLB.koreanMarketOddsObservation.observed, 15);
  assert.equal(close.MLB.koreanMarketOddsObservation.pregame, 15);
  assert.equal(close.MLB.koreanMarketOddsObservation.late, 0);
  assert.equal(close.MLB.koreanMarketOddsObservation.market, "KOREAN_MARKET");
  assert.equal(close.FOOTBALL.scopeGames, 6);
  assert.equal(close.FOOTBALL.accounted, 6);
  assert.equal(close.FOOTBALL.unexplainedMissing, 0);
  assert.equal(
    close.FOOTBALL.rows.filter((r) => r.pregameInputStatus === "VALID_BLOCKED_IDENTITY")
      .length,
    3,
  );
  assert.equal(
    close.FOOTBALL.rows.filter(
      (r) => r.pregameInputStatus === "VALID_BLOCKED_UNREGISTERED_COMPETITION",
    ).length,
    3,
  );

  const expected = JSON.parse(readFileSync(path.join(cwd, EXPECTED_REL), "utf8"));
  assert.equal(expected.lineupStatus, "EXPECTED");
  assert.equal(expected.observedAt, "2026-08-18T13:53:44.000Z");
  assert.equal(expected.games.length, 15);
  assert.ok(expected.games.every((g: { lineupStatus: string }) => g.lineupStatus === "EXPECTED"));
  const pks = new Set(expected.games.map((g: { gamePk: number }) => g.gamePk));
  assert.equal(pks.size, 15);

  const korean = JSON.parse(readFileSync(path.join(cwd, KOREAN_REL), "utf8"));
  assert.equal(korean.observedAt, "2026-08-18T13:53:44.000Z");
  assert.equal(korean.marketType, "MONEYLINE");
  assert.equal(korean.games.length, 15);
  assert.ok(
    korean.games.every(
      (g: { observationStatus: string; awayOdds: number; homeOdds: number }) =>
        g.observationStatus === "PRE_GAME_OBSERVATION" &&
        g.awayOdds > 1 &&
        g.homeOdds > 1,
    ),
  );

  assert.equal(sha256File(path.join(cwd, OBS_REL)), obsHash);
  assert.equal(sha256File(path.join(cwd, MLB_SCHEDULE_REL)), scheduleBefore);
  assert.equal(sha256File(path.join(cwd, FB_SCHEDULE_REL)), fbBefore);
  assert.equal(sha256File(path.join(cwd, JOIN_REL)), joinBefore);
  assert.equal(sha256File(path.join(cwd, LOCK_REL)), lockBefore);
  assert.equal(existsSync(path.join(cwd, CLOSE_REL)), true);

  const status = execSync("git status --short", { cwd, encoding: "utf8" });
  for (const line of status.split(/\r?\n/).filter(Boolean)) {
    const xy = line.slice(0, 2);
    const file = line.slice(3).replace(/"/g, "");
    if (file.includes("data/predictions/") || file.includes("data/recommendations/")) {
      throw new Error(`forbidden dirty path: ${line}`);
    }
    if (xy.trim() !== "??" && (file.includes("리포트") || file.includes("353\\246\\254"))) {
      throw new Error(`리포트 touched: ${line}`);
    }
    if (
      file.includes("data/operator-observations/") ||
      file.includes(`data/research/mlb/${DATE_KST}-schedule-v1.json`) ||
      file.includes(`data/research/football/${DATE_KST}-schedule-v1.json`) ||
      file.includes("2026-08-19-daily-scope-lock-v1.json")
    ) {
      throw new Error(`frozen dirty path: ${line}`);
    }
  }

  console.log("PASS 2026-08-19 pregame input close");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
