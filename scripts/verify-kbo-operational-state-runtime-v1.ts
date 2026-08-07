/**
 * Runtime verify: unified KBO operational state across Lab + Analysis paths.
 * Read-only — mutation 0 proof.
 * Run: npm run verify:kbo-operational-state-runtime
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

  const watch = [
    "data/research/kbo/2026-08-01-schedule-v1.json",
    "data/operator-input/kbo/2026-08-01-personnel-input-v1.json",
  ].map((p) => path.resolve(p));
  const before = new Map(
    watch.filter(existsSync).map((p) => [p, hashFile(p)] as const),
  );

  const { loadKboOperationalGameState, loadKboOperationalDayState } =
    await import("../src/lib/kbo/operational-state");
  const { loadKboResearchLabOpsState } = await import(
    "../src/lib/internal/load-kbo-research-lab-ops-state"
  );
  const { loadResearchAnalysisView } = await import(
    "../src/lib/research/load-research-analysis-view"
  );

  const dateKst = "2026-08-01";
  const day = await loadKboOperationalDayState(dateKst);
  const lab = await loadKboResearchLabOpsState(dateKst);

  assert.equal(day.schedule.status, "READY");
  assert.equal(day.hardErrors.length, 0);
  assert.equal(lab.hardErrors.length, 0);
  assert.equal(lab.prediction.status, "NOT_CREATED");

  const ids = ["kbo-181922", "kbo-181923", "kbo-181924"] as const;
  const report: Record<string, unknown> = {};

  for (const id of ids) {
    const ops = await loadKboOperationalGameState(id, { dateKst });
    const view = await loadResearchAnalysisView(id);
    assert.ok(view.kboOperational);
    assert.equal(view.kboOperational!.overallStatus, ops.overallStatus);
    assert.equal(view.researchPrediction.debugStatus, "NOT_CREATED");
    assert.ok(view.researchScore.total > 0);
    assert.notEqual(view.researchScore.overallLabel, "UNKNOWN");
    report[id] = {
      match: `${ops.awayTeam} @ ${ops.homeTeam}`,
      overall: ops.overallStatus,
      readiness: ops.readinessPercent,
      schedule: ops.schedule.status,
      domestic: ops.domesticOdds.status,
      starter: ops.starter.status,
      lineup: ops.lineup.status,
      prediction: ops.prediction.status,
      sources: ops.sources.map((s) => `${s.name}:${s.sourceType}`),
    };
  }

  for (const [p, h] of before) {
    assert.equal(hashFile(p), h, `mutated: ${p}`);
  }

  console.log(
    "verify:kbo-operational-state-runtime OK",
    JSON.stringify(
      {
        mutation: 0,
        labTasks: lab.tasks.filter((t) => t.category === "TODO").length,
        games: report,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
