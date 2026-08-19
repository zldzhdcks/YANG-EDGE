/**
 * 2026-08-20 pregame input close tests.
 * Run: npm run test:2026-08-20-pregame-input-close-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  CLOSE_REL,
  CONFIRMED_REL,
  DATE_KST,
  EXPECTED_REL,
  FB_SCHEDULE_REL,
  FROZEN_0819_HASHES,
  FROZEN_EXPECTED_0819,
  FROZEN_FREEZE_0819,
  FROZEN_LOCK_0819,
  FROZEN_PRED_0819,
  JOIN_REL,
  KOREAN_REL,
  LOCK_REL,
  MLB_SCHEDULE_REL,
  OBS_REL,
  PREDICTION_REL,
  SNAPSHOT_REL,
  STAGE_A_HASHES,
  STARTER_REL,
  auditPregameInputClose,
} from "./audit-2026-08-20-pregame-input-close-v1";

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

async function main() {
  const cwd = process.cwd();
  assert.equal(sha256File(path.join(cwd, LOCK_REL)), STAGE_A_HASHES.lock);
  assert.equal(
    sha256File(path.join(cwd, OBS_REL)),
    STAGE_A_HASHES.operatorStructured,
  );
  assert.equal(sha256File(path.join(cwd, JOIN_REL)), STAGE_A_HASHES.join);
  assert.equal(
    sha256File(path.join(cwd, MLB_SCHEDULE_REL)),
    STAGE_A_HASHES.mlbSchedule,
  );
  assert.equal(
    sha256File(path.join(cwd, FB_SCHEDULE_REL)),
    STAGE_A_HASHES.footballSchedule,
  );
  assert.equal(existsSync(path.join(cwd, PREDICTION_REL)), false);
  assert.equal(existsSync(path.join(cwd, SNAPSHOT_REL)), false);
  assert.equal(
    sha256File(path.join(cwd, FROZEN_PRED_0819)),
    FROZEN_0819_HASHES.prediction,
  );
  assert.equal(
    sha256File(path.join(cwd, FROZEN_LOCK_0819)),
    FROZEN_0819_HASHES.lock,
  );
  assert.equal(
    sha256File(path.join(cwd, FROZEN_EXPECTED_0819)),
    FROZEN_0819_HASHES.expected,
  );
  assert.equal(
    sha256File(path.join(cwd, FROZEN_FREEZE_0819)),
    FROZEN_0819_HASHES.freezeClose,
  );

  const close = await auditPregameInputClose(cwd);
  assert.equal(close.stageStatus, "B_PREGAME_INPUT_DONE");
  assert.equal(close.predictionRun, false);
  assert.equal(close.snapshotRun, false);
  assert.equal(close.postgameAccess, false);
  assert.equal(close.engineConnected, false);
  assert.equal(close.unexplainedMissing, 0);
  assert.equal(close.accountedTotal, 38);
  assert.equal(close.scopeShrink, 0);
  assert.equal(close.MLB.gamePkUnique, 15);
  assert.equal(close.MLB.starter.games, 15);
  assert.equal(close.MLB.starter.rows, 30);
  assert.equal(close.MLB.providerOdds.games, 15);
  assert.equal(close.MLB.providerOdds.collected, 15);
  assert.equal(close.MLB.providerOdds.preGame, 15);
  assert.equal(close.MLB.providerOdds.late, 0);
  assert.ok(close.MLB.perGame.every((r) => r.providerOddsStatus === "COLLECTED"));
  assert.ok(close.MLB.perGame.every((r) => r.providerOddsTiming === "PRE_GAME"));
  assert.equal(close.MLB.officialLineup.games, 15);
  assert.equal(close.MLB.operatorConfirmedLineup.games, 3);
  assert.equal(close.MLB.operatorConfirmedLineup.full, 2);
  assert.equal(close.MLB.operatorConfirmedLineup.partial, 1);
  assert.equal(close.MLB.operatorConfirmedLineup.preGame, 3);
  assert.equal(close.MLB.operatorConfirmedLineup.officialPromotion, 0);
  assert.equal(close.MLB.operatorExpectedLineup.observed, 13);
  assert.equal(close.MLB.operatorExpectedLineup.confirmed, 0);
  assert.equal(close.MLB.operatorExpectedLineup.late, 0);
  assert.equal(close.MLB.koreanMarketOddsObservation.matched, 13);
  assert.equal(close.MLB.koreanMarketOddsObservation.identityBlocked, 2);
  assert.equal(close.MLB.koreanMarketOddsObservation.accountedObservations, 15);
  assert.equal(close.MLB.perGame.length, 15);
  assert.equal(close.timing.lateEvidenceSelected, 0);
  assert.equal(close.timing.unknownTimingSelected, 0);
  assert.equal(close.timing.allSelectedPregameInputsBeforeStart, true);
  assert.equal(close.koreanIdentityContract.blockedRowsBlockStageB, false);
  assert.equal(close.FOOTBALL.scopeGames, 23);
  assert.equal(close.FOOTBALL.accounted, 23);
  assert.equal(close.FOOTBALL.matchedRegistered, 0);
  assert.equal(close.FOOTBALL.identityBlocked, 5);
  assert.equal(close.FOOTBALL.unregistered, 18);
  assert.equal(close.FOOTBALL.unexplainedMissing, 0);
  assert.equal(close.FOOTBALL.providerCalls, 0);
  assert.equal(
    close.FOOTBALL.rows.filter((r) => r.pregameInputStatus === "VALID_BLOCKED_IDENTITY")
      .length,
    5,
  );
  assert.equal(
    close.FOOTBALL.rows.filter(
      (r) => r.pregameInputStatus === "VALID_BLOCKED_UNREGISTERED_COMPETITION",
    ).length,
    18,
  );

  const expected = JSON.parse(readFileSync(path.join(cwd, EXPECTED_REL), "utf8"));
  assert.equal(expected.lineupStatus, "EXPECTED");
  assert.equal(expected.summary.expectedGames, 13);
  assert.equal(expected.summary.confirmedGames, 0);
  assert.equal(expected.games.length, 15);
  assert.ok(expected.games.every((g: { lineupStatus: string }) => g.lineupStatus === "EXPECTED"));
  const cubsExpected = expected.games.find((g: { gamePk: number }) => g.gamePk === 824640);
  assert.equal(cubsExpected.observationStatus, "OBSERVED");
  assert.equal(cubsExpected.awayLineup.length, 0);
  assert.equal(cubsExpected.homeLineup.length, 9);

  const confirmed = JSON.parse(readFileSync(path.join(cwd, CONFIRMED_REL), "utf8"));
  assert.equal(confirmed.officialLineup, false);
  assert.equal(confirmed.games.length, 3);
  const det = confirmed.games.find((g: { gamePk: number }) => g.gamePk === 823342);
  const nym = confirmed.games.find((g: { gamePk: number }) => g.gamePk === 823587);
  const cws = confirmed.games.find((g: { gamePk: number }) => g.gamePk === 824640);
  assert.equal(det.completeness, "FULL");
  assert.equal(nym.completeness, "FULL");
  assert.equal(cws.completeness, "PARTIAL");
  assert.equal(cws.homeLineup.length, 0);
  assert.equal(cws.awayLineup.length, 9);
  assert.equal(cws.officialLineup, false);

  const korean = JSON.parse(readFileSync(path.join(cwd, KOREAN_REL), "utf8"));
  assert.equal(korean.marketType, "MONEYLINE");
  assert.equal(korean.games.length, 15);
  assert.equal(korean.identityBlockedObservations.length, 2);
  const blockedHomes = korean.identityBlockedObservations
    .map((r: { rawHomeLabel: string }) => r.rawHomeLabel)
    .sort();
  assert.deepEqual(blockedHomes, ["캔자로알", "템파레이"]);
  assert.ok(
    korean.identityBlockedObservations.every(
      (r: { gamePk: number | null }) => r.gamePk == null,
    ),
  );

  const cubsLedger = close.MLB.perGame.find((r) => r.gamePk === 824640);
  assert.ok(cubsLedger);
  assert.equal(cubsLedger.selectedLineupStatus, "MIXED_CONFIRMED_EXPECTED");
  assert.equal(
    cubsLedger.selectedLineupSource.away.lineupSelectionStatus,
    "OFFICIAL_PROVIDER_CONFIRMED",
  );
  assert.equal(
    cubsLedger.selectedLineupSource.home.lineupSelectionStatus,
    "OPERATOR_EXPECTED",
  );
  assert.equal(cubsLedger.operatorConfirmedStatus, "CONFIRMED_PARTIAL");
  assert.equal(cubsLedger.operatorExpectedStatus, "EXPECTED_OBSERVED");

  const starter = JSON.parse(readFileSync(path.join(cwd, STARTER_REL), "utf8"));
  assert.equal(starter.rows.length, 30);
  assert.equal(new Set(starter.rows.map((r: { gamePk: number }) => r.gamePk)).size, 15);

  assert.equal(sha256File(path.join(cwd, OBS_REL)), STAGE_A_HASHES.operatorStructured);
  assert.equal(sha256File(path.join(cwd, MLB_SCHEDULE_REL)), STAGE_A_HASHES.mlbSchedule);
  assert.equal(sha256File(path.join(cwd, FB_SCHEDULE_REL)), STAGE_A_HASHES.footballSchedule);
  assert.equal(sha256File(path.join(cwd, JOIN_REL)), STAGE_A_HASHES.join);
  assert.equal(sha256File(path.join(cwd, LOCK_REL)), STAGE_A_HASHES.lock);
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
      file.includes("2026-08-20-daily-scope-lock-v1.json") ||
      file.includes("2026-08-20-operator-scope-join-v1.json") ||
      file.includes("2026-08-19-")
    ) {
      throw new Error(`frozen dirty path: ${line}`);
    }
  }

  console.log("PASS 2026-08-20 pregame input close");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
