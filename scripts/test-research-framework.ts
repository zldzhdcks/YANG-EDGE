/**
 * Research Framework v1 smoke (네트워크 없음).
 *
 * 실행: npx tsx scripts/test-research-framework.ts
 */
import {
  RESEARCH_DATASET_REGISTRY,
  RESEARCH_FRAMEWORK_VERSION,
  assertHypothesisStatusGuard,
  buildResearchResultHash,
  bullpenV11FrameworkMetadata,
  createHypothesisLink,
  createResearchAuditShell,
  emptyScorecard,
  getRegistryEntry,
  verifyResearchHash,
} from "../src/lib/research";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function main() {
  console.log("=== test-research-framework ===");
  assert(RESEARCH_FRAMEWORK_VERSION === "research-framework-v1", "version");
  assert(RESEARCH_DATASET_REGISTRY.length >= 4, "registry size");

  const bullpen = getRegistryEntry("mlb-bullpen-role");
  assert(bullpen?.status === "COLLECTING", "bullpen status");
  assert(bullpen?.engineAdmission === "PROHIBITED", "engine prohibited");
  assert(bullpen?.builderVersion.includes("v1.1") === true, "v1.1 builder");

  const starter = getRegistryEntry("mlb-starter");
  assert(starter?.status === "NOT_STARTED", "starter not started");

  const meta = bullpenV11FrameworkMetadata();
  assert(meta.datasetId === "mlb-bullpen-role", "adapter id");
  assert(meta.legal.publicRuntimeUseAllowed === false, "no public runtime");
  assert(meta.legal.engineConnected === false, "no engine");

  const h1 = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "demo",
    schemaVersion: "demo-v1",
    builderVersion: "demo-builder-1",
    body: { a: 1, b: [2, 3] },
  });
  const h2 = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "demo",
    schemaVersion: "demo-v1",
    builderVersion: "demo-builder-1",
    body: { b: [2, 3], a: 1 },
  });
  assert(verifyResearchHash(h1, h2).matched, "hash stable key order");

  assert(
    assertHypothesisStatusGuard("PROMISING", 14) === "COLLECTING",
    "promising guard",
  );

  const link = createHypothesisLink({
    hypothesisId: "H-DEMO-001",
    datasetId: "demo",
    description: "demo",
    requiredFields: [],
    sampleCount: 0,
    supportingCount: 0,
    contradictingCount: 0,
    inconclusiveCount: 0,
    currentStatus: "UNTESTED",
    minimumSampleTarget: 100,
    lastEvaluatedAt: null,
  });
  assert(link.autoApply === false, "autoApply false");

  const audit = createResearchAuditShell({
    datasetId: "demo",
    auditVersion: "demo-audit-v1",
    datasetStatus: "COLLECTING",
    legal: meta.legal,
    totals: {
      totalRows: 0,
      uniqueEntities: 0,
      resultHash: h1,
      rerunHashMatched: true,
    },
  });
  assert(audit.meta.engineConnected === false, "audit engine");
  assert(audit.meta.predictionSnapshotsUntouched === true, "snapshots");

  const card = emptyScorecard({
    datasetId: "demo",
    variableId: "demo.var",
    scorecardVersion: "demo-scorecard-v1",
    minimumSampleTarget: 100,
  });
  assert(card.autoApply === false, "scorecard autoApply");
  assert(card.meta.engineAdmission === "PROHIBITED", "scorecard engine");

  console.log("ALL PASSED");
}

main();
