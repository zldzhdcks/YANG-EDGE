/**
 * Football Foundation Pre-Design Audit v0 — deterministic reader tests.
 * No provider calls. No dataset/engine mutation.
 * Run: npm run test:football-foundation-audit-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const AUDIT_REL =
  "data/audits/2026-08-04-football-foundation-pre-design-audit-v0.json";
const DOC_REL = "FOOTBALL_FOUNDATION_PRE_DESIGN_AUDIT_V0.md";

function main() {
  const auditPath = path.join(ROOT, AUDIT_REL);
  const before = fs.readFileSync(auditPath);
  const audit = JSON.parse(before.toString("utf8")) as Record<string, unknown>;

  assert.equal(audit.schemaVersion, "football-foundation-pre-design-audit-v0");
  assert.equal(audit.conclusion, "FOOTBALL_FOUNDATION_AUDIT_COMPLETE");

  const scope = audit.missionScope as Record<string, unknown>;
  assert.equal(scope.implementsPrediction, false);
  assert.equal(scope.implementsEngine, false);
  assert.equal(scope.implementsWeight, false);
  assert.equal(scope.implementsModel, false);
  assert.equal(scope.providerCalls, 0);
  assert.equal(scope.datasetSchemaMutation, false);
  assert.equal(scope.pipelineMutation, false);

  const odds = audit.oddsPolicy as Record<string, unknown>;
  assert.deepEqual(odds.predictionTarget, ["1X2"]);
  assert.ok(Array.isArray(odds.collectOnly));
  assert.ok((odds.collectOnly as string[]).includes("O/U"));
  assert.ok((odds.collectOnly as string[]).includes("AH"));
  assert.ok((odds.collectOnly as string[]).includes("BTTS"));

  const lineup = audit.lineupPolicy as Record<string, unknown>;
  assert.deepEqual(lineup.states, [
    "NOT_RELEASED",
    "CONFIRMED",
    "AFTER_CUTOFF",
  ]);
  assert.equal(lineup.afterCutoffUsableForPrediction, false);

  const gate = audit.predictionGate as Record<string, unknown>;
  assert.equal(gate.required, true);
  const conditions = gate.conditions as string[];
  for (const c of [
    "SCHEDULE_READY",
    "ODDS_1X2_USABLE",
    "BEFORE_KICKOFF",
    "IDENTITY_VERIFIED",
    "NO_RESULT_DEPENDENCY",
    "NO_LEAKAGE",
  ]) {
    assert.ok(conditions.includes(c), `missing gate ${c}`);
  }

  const reuse = audit.reuseMatrix as Record<string, string[]>;
  assert.ok(reuse.reusable.includes("pregame_usability_gates_pattern"));
  assert.ok(reuse.reusable.includes("prediction_validity_sidecar_pattern"));
  assert.ok(reuse.notReusable.includes("mlb_bullpen_dataset"));
  assert.ok(reuse.notReusable.includes("mlb_starter_dataset"));

  const rrs = audit.resultReviewScorecard as Record<string, unknown>;
  assert.equal(rrs.reviewBeforeFinal, "PROHIBITED");
  assert.equal(rrs.researchVsOfficialMix, "PROHIBITED");
  assert.equal(rrs.scorecardEngineImpact, "NONE");

  const os = audit.operationOs as Record<string, unknown>;
  assert.deepEqual(os.levelsReusable, ["READY", "WARNING", "BLOCKED", "OFF"]);
  assert.equal(os.fakeProgressForbidden, true);

  const match = audit.matchIdentity as Record<string, unknown>;
  assert.equal(match.artifactExistsNeUsable, true);

  const regression = audit.regression as Record<string, unknown>;
  for (const k of [
    "mlbPredictionChanged",
    "mlbEngineChanged",
    "mlbWeightChanged",
    "mlbReviewFormulaChanged",
    "mlbScorecardChanged",
    "hashAlgorithmChanged",
    "datasetSchemaChanged",
    "pipelineChanged",
    "providerCalled",
  ]) {
    assert.equal(regression[k], false, k);
  }

  // Deterministic serialize
  const normalized = `${JSON.stringify(audit)}\n`;
  const h1 = createHash("sha256").update(normalized).digest("hex");
  const h2 = createHash("sha256").update(`${JSON.stringify(audit)}\n`).digest("hex");
  assert.equal(h1, h2);

  // Doc present with required section titles
  const doc = fs.readFileSync(path.join(ROOT, DOC_REL), "utf8");
  for (const title of [
    "Football Foundation Architecture",
    "Football Data Flow",
    "Football Gate",
    "Identity Audit",
    "Football Risk Audit",
    "Football Reuse Matrix",
    "Football TODO",
  ]) {
    assert.ok(doc.includes(title), `doc missing section: ${title}`);
  }

  // No mutation of audit file during test
  const after = fs.readFileSync(auditPath);
  assert.equal(Buffer.compare(before, after), 0);

  // Guard: no football engine/prediction builder paths claimed as implemented
  const arch = audit.architecture as { layers: Record<string, string> };
  assert.equal(arch.layers.prediction, "NOT_IMPLEMENTED");
  assert.equal(arch.layers.engineWeight, "PROHIBITED");
  assert.equal(arch.layers.researchDatasets, "NOT_STARTED");

  console.log("PASS test-football-foundation-audit-v0");
  console.log(
    JSON.stringify(
      {
        conclusion: audit.conclusion,
        predictionTarget: odds.predictionTarget,
        reusableCount: reuse.reusable.length,
        notReusableCount: reuse.notReusable.length,
        riskCount: (audit.risks as unknown[]).length,
        todoCount: (audit.todo as unknown[]).length,
        contentSha256Prefix: h1.slice(0, 12),
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main();
}
