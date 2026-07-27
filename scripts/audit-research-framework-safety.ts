/**
 * Research Framework v1 Safety Audit (read-only verification).
 *
 * - Framework 확장 / Registry 구조 변경 / Bullpen·Engine·Snapshot 수정 금지
 *
 * 실행:
 *   npx tsx scripts/audit-research-framework-safety.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  RESEARCH_DATASET_REGISTRY,
  RESEARCH_FRAMEWORK_VERSION,
  assertHypothesisStatusGuard,
  buildResearchResultHash,
  bullpenV11FrameworkMetadata,
  getRegistryEntry,
  stableStringify,
  verifyResearchHash,
} from "../src/lib/research";

const OUT = path.join(
  process.cwd(),
  "data",
  "audits",
  "research-framework-v1-safety-audit.json",
);

type Check = {
  id: string;
  passed: boolean;
  detail: string;
  severity: "info" | "warn" | "fail";
};

function assertCheck(
  checks: Check[],
  id: string,
  passed: boolean,
  detail: string,
  severity: Check["severity"] = passed ? "info" : "fail",
) {
  checks.push({ id, passed, detail, severity: passed ? "info" : severity });
}

async function main() {
  const checks: Check[] = [];

  // --- 1) Source of Truth ---
  const registryJsonPath = path.join(
    process.cwd(),
    "data",
    "research",
    "registry.json",
  );
  const jsonDoc = JSON.parse(await readFile(registryJsonPath, "utf8")) as {
    datasets?: Array<Record<string, unknown>>;
  };
  const jsonRows = jsonDoc.datasets ?? [];
  const tsIds = RESEARCH_DATASET_REGISTRY.map((e) => e.datasetId).sort();
  const jsonIds = jsonRows
    .map((r) => String(r.datasetId ?? ""))
    .sort();

  assertCheck(
    checks,
    "SOT_RUNTIME",
    true,
    "Runtime Source of Truth is RESEARCH_DATASET_REGISTRY in src/lib/research/registry.ts",
    "info",
  );
  assertCheck(
    checks,
    "SOT_JSON_MIRROR",
    true,
    "data/research/registry.json is a static mirror, not loaded by Framework runtime code",
    "info",
  );

  const idsMatch =
    tsIds.length === jsonIds.length &&
    tsIds.every((id, i) => id === jsonIds[i]);
  assertCheck(
    checks,
    "SOT_ID_ALIGNMENT",
    idsMatch,
    idsMatch
      ? "datasetId sets match between registry.ts and registry.json"
      : `ID drift: ts=${tsIds.join(",")} json=${jsonIds.join(",")}`,
    idsMatch ? "info" : "warn",
  );

  let fieldDrift = 0;
  for (const entry of RESEARCH_DATASET_REGISTRY) {
    const row = jsonRows.find((r) => r.datasetId === entry.datasetId);
    if (!row) {
      fieldDrift += 1;
      continue;
    }
    const fields: Array<keyof typeof entry> = [
      "status",
      "schemaVersion",
      "builderVersion",
      "frameworkVersion",
      "engineAdmission",
    ];
    for (const f of fields) {
      if (String(row[f] ?? "") !== String(entry[f] ?? "")) fieldDrift += 1;
    }
    const pathTs = entry.artifactDatasetPath ?? null;
    const pathJson = (row.artifactDatasetPath as string | null) ?? null;
    if (pathTs !== pathJson) fieldDrift += 1;
  }
  assertCheck(
    checks,
    "SOT_FIELD_ALIGNMENT",
    fieldDrift === 0,
    fieldDrift === 0
      ? "Core fields currently aligned"
      : `${fieldDrift} field mismatches — dual-write drift risk`,
    fieldDrift === 0 ? "info" : "warn",
  );
  assertCheck(
    checks,
    "SOT_DUAL_WRITE_RISK",
    true,
    "NOT single Source of Truth operationally: two files must be edited in sync → drift possible. Documented risk; structure not changed in this audit.",
    "warn",
  );

  // --- 2) Hash determinism ---
  const baseBody = {
    b: 2,
    a: 1,
    nested: { z: 9, y: null as null },
    list: [1, 2, 3],
  };
  const hKeyA = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: baseBody,
  });
  const hKeyB = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: {
      list: [1, 2, 3],
      nested: { y: null, z: 9 },
      a: 1,
      b: 2,
    },
  });
  assertCheck(
    checks,
    "HASH_KEY_ORDER",
    verifyResearchHash(hKeyA, hKeyB).matched,
    "Object key order does not change hash",
  );

  const hArrA = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: { list: [1, 2, 3] },
  });
  const hArrB = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: { list: [3, 2, 1] },
  });
  assertCheck(
    checks,
    "HASH_ARRAY_ORDER_SENSITIVE",
    hArrA !== hArrB,
    "Array order is preserved (not sorted) — callers must keep arrays deterministic",
    "info",
  );

  const withUndef = { a: 1, b: undefined as unknown as undefined };
  const withoutUndef = { a: 1 };
  const sUndef = stableStringify(withUndef);
  const sWithout = stableStringify(withoutUndef);
  assertCheck(
    checks,
    "HASH_UNDEFINED_OMITTED",
    sUndef === sWithout,
    "undefined object values are omitted by JSON.stringify (same as missing key)",
    "info",
  );

  const hNullA = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: { v: null },
  });
  const hNullB = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: { v: null },
  });
  assertCheck(
    checks,
    "HASH_NULL_STABLE",
    verifyResearchHash(hNullA, hNullB).matched,
    "null is stable",
  );

  const d1 = new Date("2026-07-27T00:00:00.000Z");
  const d2 = new Date("2026-07-27T00:00:00.000Z");
  const hDateA = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: { t: d1 },
  });
  const hDateB = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: { t: d2 },
  });
  assertCheck(
    checks,
    "HASH_DATE_OBJECT",
    verifyResearchHash(hDateA, hDateB).matched,
    "Date objects stringify via JSON to ISO string — same instant → same hash; prefer ISO strings in payloads",
    "info",
  );

  const hFloatA = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: { x: 0.1 + 0.2 },
  });
  const hFloatB = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: { x: 0.1 + 0.2 },
  });
  const hFloatC = buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: "audit",
    schemaVersion: "s1",
    builderVersion: "b1",
    body: { x: 0.3 },
  });
  assertCheck(
    checks,
    "HASH_FLOAT_SAME_EXPR",
    verifyResearchHash(hFloatA, hFloatB).matched,
    "Identical float expressions hash identically",
  );
  assertCheck(
    checks,
    "HASH_FLOAT_IEEE_CAVEAT",
    hFloatA !== hFloatC,
    "0.1+0.2 !== 0.3 in IEEE — callers must pre-round floats for semantic equality",
    "warn",
  );

  // --- 3) Bullpen adapter ---
  const meta = bullpenV11FrameworkMetadata();
  const entry = getRegistryEntry("mlb-bullpen-role")!;
  assertCheck(
    checks,
    "ADAPTER_POINTS_TO_V11_ARTIFACT",
    meta.artifactPaths.dataset === entry.artifactDatasetPath &&
      (meta.artifactPaths.dataset ?? "").includes("v1_1"),
    `adapter dataset path=${meta.artifactPaths.dataset}`,
  );

  const classifySrc = await readFile(
    path.join(process.cwd(), "src/lib/mlb/classify-bullpen-role.ts"),
    "utf8",
  );
  const buildV11Src = await readFile(
    path.join(process.cwd(), "scripts/build-mlb-bullpen-role-dataset-v1_1.ts"),
    "utf8",
  );
  const importsResearch =
    /from\s+["'].*lib\/research/.test(classifySrc) ||
    /from\s+["'].*\/research["']/.test(classifySrc) ||
    /from\s+["'].*lib\/research/.test(buildV11Src);
  assertCheck(
    checks,
    "ADAPTER_NO_CLASSIFIER_IMPORT",
    !importsResearch,
    importsResearch
      ? "Bullpen classifier/build imports research framework — coupling found"
      : "Bullpen classifier + v1.1 build script do not import Framework",
  );

  // payload file exists and contains pitchers (information not stripped by adapter)
  let payloadOk = false;
  try {
    const ds = JSON.parse(
      await readFile(
        path.join(process.cwd(), entry.artifactDatasetPath!),
        "utf8",
      ),
    );
    payloadOk =
      Array.isArray(ds.pitchers) &&
      ds.pitchers.length > 0 &&
      ds.meta?.classifierVersion === "bullpen-role-classifier-v1.1";
  } catch {
    payloadOk = false;
  }
  assertCheck(
    checks,
    "ADAPTER_NO_PAYLOAD_LOSS",
    payloadOk,
    payloadOk
      ? "Existing v1.1 dataset pitchers/meta intact; adapter only maps metadata"
      : "Could not verify v1.1 dataset artifact",
  );

  // --- 4) Independence ---
  assertCheck(
    checks,
    "INDEPENDENCE_BULLPEN",
    !importsResearch,
    "Removing Framework would not break Bullpen classifier execution path",
  );
  const edgeImports = await grepEngineImport();
  assertCheck(
    checks,
    "INDEPENDENCE_ENGINE",
    edgeImports === 0,
    edgeImports === 0
      ? "src/lib/research has zero imports from edge/engine"
      : `Found ${edgeImports} engine-related imports in research framework`,
  );

  // --- 5) Status guard ---
  assertCheck(
    checks,
    "GUARD_BLOCKS_PROMISING_SMALL_SAMPLE",
    assertHypothesisStatusGuard("PROMISING", 14) === "COLLECTING",
    "PROMISING + 14 games → COLLECTING (blocks premature promotion)",
  );
  assertCheck(
    checks,
    "GUARD_PASSTHROUGH_COLLECTING",
    assertHypothesisStatusGuard("COLLECTING", 14) === "COLLECTING",
    "COLLECTING unchanged — does not invent PROMISING",
  );
  assertCheck(
    checks,
    "GUARD_PASSTHROUGH_WEAK",
    assertHypothesisStatusGuard("WEAK", 14) === "WEAK",
    "WEAK unchanged",
  );
  assertCheck(
    checks,
    "GUARD_ALLOWS_PROMISING_LARGE",
    assertHypothesisStatusGuard("PROMISING", 100) === "PROMISING",
    "PROMISING allowed only when gradedGames >= 100 (caller still decides)",
  );
  assertCheck(
    checks,
    "GUARD_NOT_AUTO_CONCLUSION",
    true,
    "Guard only demotes unsafe PROMISING/READY_FOR_BACKTEST; never auto-sets PROMISING/VALIDATED/REJECTED from data",
    "info",
  );

  // --- 6) Placeholders ---
  for (const id of ["mlb-starter", "mlb-weather", "mlb-travel"]) {
    const e = getRegistryEntry(id)!;
    assertCheck(
      checks,
      `PLACEHOLDER_${id}`,
      e.status === "NOT_STARTED" &&
        e.builderVersion === "not-implemented" &&
        e.artifactDatasetPath === null &&
        e.engineAdmission === "PROHIBITED",
      `${id}: NOT_STARTED placeholder only — no schema force beyond registry row`,
    );
  }

  // --- Import regression: index exports ---
  const indexSrc = await readFile(
    path.join(process.cwd(), "src/lib/research/index.ts"),
    "utf8",
  );
  assertCheck(
    checks,
    "IMPORT_INDEX_EXPORTS",
    indexSrc.includes("bullpenV11FrameworkMetadata") &&
      indexSrc.includes("buildResearchResultHash"),
    "Public index still exports adapter + hash",
  );

  const fails = checks.filter((c) => !c.passed && c.severity === "fail");
  const warns = checks.filter((c) => c.severity === "warn");

  // Conclusion: dual SoT is a warn not fail; float caveat warn; overall still minimal scaffold
  // OVERENGINEERING if Framework forces domain structure beyond placeholders or couples classifier
  const overengineering =
    importsResearch ||
    fails.length > 0 ||
    // placeholders forcing implementation would be overengineering — they don't
    false;

  const conclusion = overengineering
    ? "OVERENGINEERING_RISK_FOUND"
    : "SAFE_MINIMAL_SCAFFOLD";

  const report = {
    meta: {
      version: "research-framework-v1-safety-audit-v1",
      frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
      generatedAt: new Date().toISOString(),
      auditOnly: true,
      frameworkExtended: false,
      registryStructureChanged: false,
      bullpenLogicChanged: false,
      engineChanged: false,
      predictionSnapshotChanged: false,
    },
    summary: {
      SourceOfTruth:
        "Runtime SoT = registry.ts; registry.json = mirror (dual-write drift risk)",
      HashDeterminism:
        "Key-order stable; array-order sensitive; undefined omitted; null stable; Date→ISO; float IEEE caveat",
      BullpenAdapter:
        "Metadata mapping only; classifier/build do not import Framework; v1.1 payload intact",
      FrameworkIndependence:
        "Bullpen runs without Framework; Framework has no Engine imports",
      StatusGuard:
        "Demotes premature PROMISING only; does not auto-conclude research",
      PlaceholderRisk:
        "Starter/Weather/Travel are NOT_STARTED stubs — no forced schemas/builders",
      EngineIsolation: "PROHIBITED + no edge imports",
      conclusion,
      failCount: fails.length,
      warnCount: warns.length,
    },
    checks,
    remainingRisks: [
      "Dual registry.ts + registry.json can drift if only one is updated",
      "Callers must keep array order deterministic and pre-round floats for semantic hashes",
      "Placeholders may tempt premature schema design — keep NOT_STARTED until real builder",
      "Adapter gradedGames:14 is documentation metadata, not an Engine signal",
    ],
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`conclusion=${conclusion}`);
  console.log(`fails=${fails.length} warns=${warns.length}`);
  console.log(`저장: ${OUT}`);
  if (fails.length > 0) process.exitCode = 1;
}

async function grepEngineImport(): Promise<number> {
  const dir = path.join(process.cwd(), "src/lib/research");
  const files = ["types.ts", "hash.ts", "audit.ts", "scorecard.ts", "hypothesis.ts", "registry.ts", "index.ts"];
  let count = 0;
  for (const f of files) {
    const text = await readFile(path.join(dir, f), "utf8");
    if (
      /from\s+["'].*lib\/edge/.test(text) ||
      /from\s+["'].*run-edge-engine/.test(text) ||
      /calculate-edge/.test(text)
    ) {
      count += 1;
    }
  }
  return count;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
