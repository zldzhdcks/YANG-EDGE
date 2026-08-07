/**
 * Lab ops adapter ↔ Analysis view ↔ Unified game state consistency.
 * Run: npm run test:kbo-analysis-research-lab-consistency
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Module from "node:module";

function hashFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

async function main() {
  const stub = path.resolve("scripts/stub-server-only.cjs");
  const original = (
    Module as unknown as { _resolveFilename: (...a: unknown[]) => string }
  )._resolveFilename;
  (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename =
    function (request: unknown, ...args: unknown[]) {
      if (request === "server-only") return stub;
      return original.call(this, request, ...args);
    };

  const { loadKboOperationalGameState, isReadyStatus } = await import(
    "../src/lib/kbo/operational-state"
  );
  const { loadKboResearchLabOpsState } = await import(
    "../src/lib/internal/load-kbo-research-lab-ops-state"
  );
  const { loadResearchAnalysisView } = await import(
    "../src/lib/research/load-research-analysis-view"
  );

  const realSchedule = path.resolve(
    "data/research/kbo/2026-08-01-schedule-v1.json",
  );
  const realPersonnel = path.resolve(
    "data/operator-input/kbo/2026-08-01-personnel-input-v1.json",
  );
  const hashes = new Map<string, string>();
  for (const p of [realSchedule, realPersonnel]) {
    if (existsSync(p)) hashes.set(p, hashFile(p));
  }

  assert.ok(existsSync(realSchedule), "schedule fixture required");
  assert.ok(existsSync(realPersonnel), "personnel fixture required");

  const dateKst = "2026-08-01";
  const lab = await loadKboResearchLabOpsState(dateKst);
  const games = ["kbo-181922", "kbo-181923", "kbo-181924"] as const;

  for (const gameId of games) {
    const ops = await loadKboOperationalGameState(gameId, { dateKst });
    const view = await loadResearchAnalysisView(gameId);

    assert.ok(view.kboOperational, `${gameId}: kboOperational missing`);
    assert.equal(view.kboOperational!.schedule.status, ops.schedule.status);
    assert.equal(
      view.kboOperational!.domesticOdds.status,
      ops.domesticOdds.status,
    );
    assert.equal(view.kboOperational!.starter.status, ops.starter.status);
    assert.equal(view.kboOperational!.lineup.status, ops.lineup.status);
    assert.equal(
      view.kboOperational!.prediction.status,
      ops.prediction.status,
    );
    assert.equal(view.kboOperational!.review.status, ops.review.status);
    assert.equal(view.kboOperational!.overallStatus, ops.overallStatus);
    assert.equal(view.researchScore.total, ops.readinessPercent);
    assert.ok(view.researchScore.total > 0, `${gameId}: readiness 0%`);
    assert.notEqual(view.researchScore.overallLabel, "UNKNOWN");
    assert.equal(view.researchPrediction.debugStatus, "NOT_CREATED");
    assert.equal(view.gameInfo.availability, "COLLECTED");
    assert.equal(view.gameInfo.homeTeam, ops.homeTeam);
    assert.equal(view.gameInfo.awayTeam, ops.awayTeam);

    // Lab day aggregates must not contradict per-game ready counts
    if (isReadyStatus(ops.starter.status)) {
      assert.ok(lab.starter.entered >= 1);
    }
    if (ops.lineup.status === "NOT_ENTERED") {
      assert.ok(lab.lineup.entered < lab.lineup.required);
    }
  }

  assert.equal(lab.schedule.status, "READY");
  assert.equal(lab.prediction.status, "NOT_CREATED");
  assert.equal(lab.hardErrors.length, 0);
  assert.equal(lab.domesticProto.entered, 3);
  assert.equal(lab.starter.entered, 3);
  assert.equal(lab.lineup.entered, 2);

  // 181922 specific expectations
  const v922 = await loadResearchAnalysisView("kbo-181922");
  assert.equal(v922.kboOperational!.schedule.status, "READY");
  assert.equal(
    v922.kboOperational!.domesticOdds.status,
    "READY_ADMIN_VERIFIED",
  );
  assert.equal(v922.kboOperational!.starter.status, "READY_ADMIN_VERIFIED");
  assert.equal(v922.kboOperational!.lineup.status, "READY_ADMIN_VERIFIED");
  assert.equal(v922.kboOperational!.prediction.status, "NOT_CREATED");
  assert.ok(
    v922.researchScore.overallLabel === "WAITING_FOR_PREDICTION" ||
      v922.researchScore.overallLabel === "PARTIAL_READY",
  );

  const v923 = await loadResearchAnalysisView("kbo-181923");
  assert.equal(v923.kboOperational!.lineup.status, "NOT_ENTERED");
  assert.equal(v923.researchScore.overallLabel, "WAITING_FOR_LINEUP");

  for (const [p, h] of hashes) {
    assert.equal(hashFile(p), h, `mutated: ${p}`);
  }

  console.log("test:kbo-analysis-research-lab-consistency OK", {
    labLineup: `${lab.lineup.entered}/${lab.lineup.required}`,
    g922: v922.researchScore.overallLabel,
    g923: v923.researchScore.overallLabel,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
