/**
 * 2026-08-20 pregame freeze close tests.
 * Run: npm run test:2026-08-20-pregame-freeze-close-v1
 * Read-only against sealed freeze artifacts (does not rewrite snapshot).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  CLOSE_REL,
  DATE_KST,
  FOOTBALL_SNAPSHOT_REL,
  FROZEN_INPUTS,
  PREDICTION_REL,
  STARTER_POSTGAME_REL,
  SUMMARY_HASH_BEFORE_PREDICTION,
  SUMMARY_REL,
  auditPregameFreezeClose,
} from "./audit-2026-08-20-pregame-freeze-close-v1";

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

async function main() {
  const cwd = process.cwd();
  assert.equal(existsSync(path.join(cwd, PREDICTION_REL)), true);
  assert.equal(existsSync(path.join(cwd, SUMMARY_REL)), true);
  assert.equal(existsSync(path.join(cwd, FOOTBALL_SNAPSHOT_REL)), false);
  assert.equal(existsSync(path.join(cwd, STARTER_POSTGAME_REL)), true);

  const before = Object.fromEntries(
    Object.entries(FROZEN_INPUTS).map(([k, rel]) => [
      k,
      sha256File(path.join(cwd, rel)),
    ]),
  );
  const summaryBefore = sha256File(path.join(cwd, SUMMARY_REL));
  assert.equal(summaryBefore, SUMMARY_HASH_BEFORE_PREDICTION);

  const close = await auditPregameFreezeClose(cwd);
  assert.equal(close.dateKst, DATE_KST);
  assert.equal(close.stageStatus, "C_PREGAME_FREEZE_DONE");
  assert.equal(close.allFrozenInputsUnchanged, true);
  assert.equal(close.providerCalls, 0);
  assert.equal(close.resultCalls, 0);
  assert.equal(close.gradeCalls, 0);
  assert.equal(close.reviewCalls, 0);
  assert.equal(close.postgameCalls, 0);
  assert.equal(close.engineMutation, false);
  assert.equal(close.accountedTotal, 38);
  assert.equal(close.scopeShrink, 0);
  assert.equal(close.unexplainedMissing, 0);

  const mlb = close.MLB as Record<string, unknown>;
  assert.equal(mlb.scheduleGames, 15);
  assert.equal(mlb.predictionRows, 15);
  assert.equal(mlb.allBeforeKickoff, true);
  assert.equal(mlb.lateFreezeRows, 0);
  assert.equal(mlb.inventedValues, 0);
  assert.equal(mlb.resultsFetched, false);
  assert.equal(mlb.engineRerun, false);
  assert.equal(mlb.officialPickCount, 0);

  const football = close.FOOTBALL as Record<string, unknown>;
  assert.equal(football.scopeGames, 23);
  assert.equal(football.predictionEligible, 0);
  assert.equal(football.validBlocked, 23);
  assert.equal(football.predictionGenerated, 0);

  const wiring = close.operatorWiring as Record<string, unknown>;
  assert.equal(wiring.confirmedWiredToEngine, false);
  assert.equal(wiring.expectedWiredToEngine, false);
  assert.equal(wiring.koreanOddsWiredToEngine, false);
  assert.equal(wiring.starterPostgameReviewReferenced, false);

  const semantic = close.officialLineupSemanticMismatch as Record<string, unknown>;
  assert.equal(semantic.lateRowsSelected, 0);
  assert.equal(semantic.resultDerivedFieldsUsed, 0);
  assert.equal(semantic.rawArtifactRewritten, false);

  const after = Object.fromEntries(
    Object.entries(FROZEN_INPUTS).map(([k, rel]) => [
      k,
      sha256File(path.join(cwd, rel)),
    ]),
  );
  assert.deepEqual(after, before);
  assert.deepEqual(close.inputHashesAfter, after);
  assert.equal(sha256File(path.join(cwd, SUMMARY_REL)), summaryBefore);

  const pred = JSON.parse(readFileSync(path.join(cwd, PREDICTION_REL), "utf8"));
  assert.equal(pred.meta.dateKst, DATE_KST);
  assert.equal(pred.summary.researchOnly, 15);
  assert.equal(pred.predictions.length, 15);
  assert.ok(pred.meta.predictionHashSha256);
  assert.ok(pred.meta.inputManifest.inputHash);
  const predText = readFileSync(path.join(cwd, PREDICTION_REL), "utf8");
  assert.equal(predText.includes("starter-postgame-review"), false);
  assert.equal(predText.includes("confirmed-lineup-observation"), false);
  assert.equal(predText.includes("expected-lineup-observation"), false);
  assert.equal(predText.includes("korean-market-odds-observation"), false);

  const schedule = JSON.parse(
    readFileSync(path.join(cwd, FROZEN_INPUTS.mlbSchedule), "utf8"),
  ) as { games: Array<{ internalGameId: string; commenceTimeUtc: string }> };
  const commence = new Map(
    schedule.games.map((g) => [g.internalGameId, g.commenceTimeUtc]),
  );
  for (const row of pred.predictions as Array<{
    gameId: string;
    predictedAt: string;
  }>) {
    const start = commence.get(row.gameId);
    assert.ok(start);
    assert.ok(Date.parse(row.predictedAt) < Date.parse(start));
  }

  const status = execSync("git status --short", { cwd, encoding: "utf8" });
  for (const line of status.split(/\r?\n/).filter(Boolean)) {
    const file = line.slice(3).replace(/"/g, "");
    if (
      file.includes("data/operator-observations/") ||
      file.includes("2026-08-20-schedule-v1.json") ||
      file.includes("2026-08-20-starter-dataset-v1.json") ||
      file.includes("2026-08-20-odds-history-dataset-v1.json") ||
      file.includes("2026-08-20-lineup-dataset-v1.json") ||
      file.includes("2026-08-20-daily-scope-lock") ||
      file.includes("2026-08-20-pregame-input-close") ||
      file.includes("2026-08-19-")
    ) {
      throw new Error(`frozen dirty path: ${line}`);
    }
    if (file.includes("리포트") && line.slice(0, 2).trim() !== "??") {
      throw new Error(`리포트 touched: ${line}`);
    }
  }

  console.log("PASS 2026-08-20 pregame freeze close");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
