/**
 * 2026-08-19 pregame freeze close tests.
 * Run: npm run test:2026-08-19-pregame-freeze-close-v1
 * Read-only against sealed freeze artifacts (does not rewrite snapshot).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  CLOSE_REL,
  DATE_KST,
  FOOTBALL_SNAPSHOT_REL,
  FROZEN_INPUTS,
  PREDICTION_REL,
  SUMMARY_REL,
  auditPregameFreezeClose,
} from "./audit-2026-08-19-pregame-freeze-close-v1";

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

async function main() {
  const cwd = process.cwd();
  assert.equal(existsSync(path.join(cwd, PREDICTION_REL)), true);
  assert.equal(existsSync(path.join(cwd, SUMMARY_REL)), true);
  assert.equal(existsSync(path.join(cwd, FOOTBALL_SNAPSHOT_REL)), false);
  assert.equal(existsSync(path.join(cwd, CLOSE_REL)), true);

  const before = Object.fromEntries(
    Object.entries(FROZEN_INPUTS).map(([k, rel]) => [
      k,
      sha256File(path.join(cwd, rel)),
    ]),
  );

  const close = await auditPregameFreezeClose(cwd);
  assert.equal(close.dateKst, DATE_KST);
  assert.equal(close.stageStatus, "C_PREGAME_FREEZE_DONE");
  assert.equal(close.allFrozenInputsUnchanged, true);
  assert.equal(close.providerCalls, 0);
  assert.equal(close.resultCalls, 0);
  assert.equal(close.postgameCalls, 0);
  assert.equal(close.engineMutation, false);

  const mlb = close.MLB as Record<string, unknown>;
  assert.equal(mlb.scheduleGames, 15);
  assert.equal(mlb.predictionRows, 15);
  assert.equal(mlb.allBeforeKickoff, true);
  assert.equal(mlb.inventedValues, 0);
  assert.equal(mlb.officialLineupConfirmed, 0);
  assert.equal(mlb.officialLineupNotReleased, 15);
  assert.equal(mlb.starterMissing, 2);
  assert.equal(mlb.resultsFetched, false);
  assert.equal(mlb.engineRerun, false);

  const football = close.FOOTBALL as Record<string, unknown>;
  assert.equal(football.scopeGames, 6);
  assert.equal(football.predictionEligible, 0);
  assert.equal(football.validBlocked, 6);
  assert.equal(football.predictionGenerated, 0);

  const after = Object.fromEntries(
    Object.entries(FROZEN_INPUTS).map(([k, rel]) => [
      k,
      sha256File(path.join(cwd, rel)),
    ]),
  );
  assert.deepEqual(after, before);
  assert.deepEqual(close.inputHashesAfter, after);

  const pred = JSON.parse(readFileSync(path.join(cwd, PREDICTION_REL), "utf8"));
  assert.equal(pred.meta.dateKst, DATE_KST);
  assert.equal(pred.summary.researchOnly, true);
  assert.equal(pred.predictions.length, 15);
  assert.ok(pred.meta.predictionHashSha256);
  assert.ok(pred.meta.inputManifestHash);

  console.log("PASS 2026-08-19 pregame freeze close");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
