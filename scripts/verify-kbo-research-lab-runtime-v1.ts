/**
 * Runtime QA for Research Lab KBO wiring — read-only.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import Module from "node:module";

const stub = path.resolve("scripts/stub-server-only.cjs");
const original = (
  Module as unknown as { _resolveFilename: (...a: unknown[]) => string }
)._resolveFilename;
(Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename =
  function (request: unknown, ...args: unknown[]) {
    if (request === "server-only") return stub;
    return original.call(this, request, ...args);
  };

function hash(p: string) {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

async function main() {
  const sch = "data/research/kbo/2026-08-01-schedule-v1.json";
  const per = "data/operator-input/kbo/2026-08-01-personnel-input-v1.json";
  const before = { sch: hash(sch), per: hash(per) };

  const { loadResearchLabData } = await import(
    "../src/lib/internal/research-lab-reader"
  );
  const { buildOperatorPresentation } = await import(
    "../src/lib/internal/research-lab-presenter"
  );
  const { buildAssistantBrief } = await import(
    "../src/lib/internal/edge-assistant-presenter"
  );

  const data = await loadResearchLabData("2026-08-01");
  const op = buildOperatorPresentation(data);
  const brief = buildAssistantBrief(data, op, {});

  assert.equal(data.errors.length, 0, "Load Errors must be 0");
  assert.equal(data.kboOps.schedule.status, "READY");
  assert.equal(data.kboOps.schedule.totalGames, 5);
  assert.equal(data.kboOps.schedule.activeGames, 3);
  assert.equal(data.kboOps.schedule.cancelledGames, 2);
  assert.equal(data.kboOps.domesticProto.status, "READY_ADMIN_VERIFIED");
  assert.equal(data.kboOps.domesticProto.entered, 3);
  assert.equal(data.kboOps.starter.status, "NOT_ENTERED");
  assert.equal(data.kboOps.lineup.status, "NOT_ENTERED");
  assert.equal(data.kboOps.prediction.status, "NOT_CREATED");
  assert.equal(data.kboOps.review.status, "NOT_READY");
  assert.ok(op.actionCards.length > 0, "Today tasks > 0");
  assert.ok(op.completedKboItems.length > 0);
  assert.ok(!data.kboReadiness.predictionLock.reasons.includes("Reader Error"));
  assert.ok(brief.primaryRecommendation.includes("프로토") || brief.primaryRecommendation.includes("선발"));

  const after = { sch: hash(sch), per: hash(per) };
  assert.equal(after.sch, before.sch);
  assert.equal(after.per, before.per);

  console.log("verify:kbo-research-lab-runtime OK", {
    errors: data.errors.length,
    todoCards: op.actionCards.length,
    completed: op.completedKboItems.length,
    overall: data.kboOps.overallStatus,
    assistant: brief.primaryRecommendation.slice(0, 100),
    mutation: 0,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
