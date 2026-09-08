/**
 * OCR research expansion v1 tests.
 * Identity-only split. No Holdout visual. No Fresh truth import. No OCR in UI.
 *
 *   npm run test:proto-round-ocr-research-expansion-v1
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DISCOVERY2_COUNT,
  SOURCE_POOL_COUNT,
  SPLIT_SALT,
  VALIDATION2_COUNT,
  assertHoldoutExcluded,
  assertPilot10Excluded,
  blankDiscovery2AnnotationRecords,
  buildExpansionSplitSealV1,
  discovery2RowsFromFrozenGeometry,
  expansionSplitSortKey,
  hashRowIdentity,
  identityKey,
  OcrResearchExpansionV1Error,
  renderDiscovery2AnnotationHtml,
  sourcePoolFromDiscoveryKeys,
  splitDiscovery2Validation2,
  type ExpansionEligibleRowV1,
  type ExpansionRowKeyV1,
} from "../src/lib/proto-round-ocr-research-expansion-v1";

function key(n: number): ExpansionRowKeyV1 {
  return { sourceImageSha256: `sha-${String(n).padStart(2, "0")}`, visualRowIndex: n };
}

function eligible(n: number): ExpansionEligibleRowV1 {
  return {
    ...key(n),
    sourceFileName: `shot-${n}.png`,
    topY: 10 + n,
    bottomY: 20 + n,
    centerY: 15 + n,
    imageWidth: 800,
    imageHeight: 400,
    screenshotRelativePath: `canonical/shot-${n}.png`,
  };
}

function gitDiffExitCode(rel: string): number {
  try {
    execFileSync("git", ["diff", "--exit-code", "--", rel], {
      stdio: "pipe",
      encoding: "utf8",
    });
    return 0;
  } catch (err) {
    const e = err as { status?: number };
    return typeof e.status === "number" ? e.status : 1;
  }
}

function sourceFiles(): string[] {
  const lib = path.join(process.cwd(), "src/lib/proto-round-ocr-research-expansion-v1");
  return [
    ...readdirSync(lib)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/run-proto-round-ocr-research-expansion-split-v1.ts"),
    path.join(
      process.cwd(),
      "scripts/open-proto-round-ocr-research-expansion-discovery2-ui-v1.ts",
    ),
  ];
}

async function main() {
  assert.equal(SPLIT_SALT, "proto-ocr-research-expansion-v1");
  assert.equal(SOURCE_POOL_COUNT, 20);
  assert.equal(DISCOVERY2_COUNT, 10);
  assert.equal(VALIDATION2_COUNT, 10);

  const discovery = Array.from({ length: 30 }, (_, i) => key(i));
  const { pilot10, sourcePool } = sourcePoolFromDiscoveryKeys(discovery);
  assert.equal(pilot10.length, 10);
  assert.equal(sourcePool.length, 20);
  assert.equal(sourcePool[0]!.visualRowIndex, 10);
  assert.equal(sourcePool.every((r) => r.visualRowIndex >= 10), true);
  assertPilot10Excluded(sourcePool, pilot10);

  const holdout = Array.from({ length: 30 }, (_, i) => key(i + 100));
  assertHoldoutExcluded(sourcePool, holdout);
  assert.throws(
    () => assertHoldoutExcluded(sourcePool, [sourcePool[0]!]),
    (err: unknown) =>
      err instanceof OcrResearchExpansionV1Error &&
      err.code === "HOLDOUT_INCLUDED_IN_SOURCE_POOL",
  );
  assert.throws(
    () => assertPilot10Excluded(sourcePool, [sourcePool[0]!]),
    (err: unknown) =>
      err instanceof OcrResearchExpansionV1Error &&
      err.code === "PILOT10_INCLUDED_IN_SOURCE_POOL",
  );

  const split = splitDiscovery2Validation2(sourcePool);
  const again = splitDiscovery2Validation2([...sourcePool].reverse());
  assert.deepEqual(split.discovery2RowKeys, again.discovery2RowKeys);
  assert.deepEqual(split.validation2RowKeys, again.validation2RowKeys);
  assert.equal(split.discovery2RowKeys.length, 10);
  assert.equal(split.validation2RowKeys.length, 10);
  const dIds = new Set(split.discovery2RowKeys.map(identityKey));
  const vIds = new Set(split.validation2RowKeys.map(identityKey));
  for (const id of vIds) assert.equal(dIds.has(id), false);
  const keys = split.discovery2RowKeys.map(expansionSplitSortKey);
  assert.deepEqual(keys, [...keys].sort());

  const shuffledPool = sourcePool.map((row) => ({
    ...row,
    sourceFileName: "ignored.png",
    league: "ignored",
  }));
  const textIgnored = splitDiscovery2Validation2(shuffledPool);
  assert.deepEqual(textIgnored.discovery2RowKeys, split.discovery2RowKeys);

  const seal = buildExpansionSplitSealV1({
    protoRoundKey: "2026-105",
    split,
  });
  assert.equal(seal.discovery2RowKeys.length, 10);
  assert.equal(seal.validation2RowKeyHashes.length, 10);
  assert.deepEqual(
    seal.validation2RowKeyHashes,
    split.validation2RowKeys.map(hashRowIdentity),
  );
  assert.equal("validation2RowKeys" in seal, false);
  assert.equal(seal.VALIDATION_2_VISUAL_RENDERED, false);

  const geometry = sourcePool.map((k) => eligible(k.visualRowIndex));
  const d2 = discovery2RowsFromFrozenGeometry({
    discovery2RowKeys: split.discovery2RowKeys,
    geometryRows: geometry,
  });
  assert.equal(d2.length, 10);
  assert.deepEqual(
    d2.map(identityKey),
    split.discovery2RowKeys.map(identityKey),
  );

  const html = renderDiscovery2AnnotationHtml({
    protoRoundKey: "2026-105",
    records: blankDiscovery2AnnotationRecords(d2),
  });
  assert.equal(html.includes("participantRawOcrEvidences"), false);
  assert.equal(html.includes("safeReconstructed"), false);
  assert.equal(html.includes("ROW_PLUS_TEXT_REGION"), false);
  assert.equal(html.includes("machine candidates"), false);
  assert.equal(html.includes("fresh-validation"), false);
  assert.equal(html.includes("HOME"), false);
  assert.equal(html.includes("AWAY"), false);
  assert.equal(html.includes("discovery2-annotation-v1.json"), true);
  assert.equal(html.includes("경기번호"), true);
  assert.equal(html.includes("왼쪽 참가자"), true);
  assert.equal(html.includes("오른쪽 참가자"), true);
  for (const vKey of split.validation2RowKeys) {
    assert.equal(html.includes(identityKey(vKey)), false);
  }
  for (const rowHash of seal.validation2RowKeyHashes) {
    assert.equal(html.includes(rowHash), false);
  }

  assert.equal(gitDiffExitCode("data/research"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-ground-truth-v0"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-raw-ocr-v0"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-structured-extraction-v0/parser.ts"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-participant-ocr-experiment-v3"), 0);

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("holdout-seal"), false, abs);
    assert.equal(src.includes("fresh-validation-human-truth"), false, abs);
    assert.equal(src.includes("fresh-validation-machine-output"), false, abs);
    assert.equal(src.includes("fetch("), false, abs);
    assert.equal(src.includes("https://"), false, abs);
    assert.equal(src.includes("http://"), false, abs);
    assert.equal(src.includes("parseStructuredRowV0"), false, abs);
    assert.equal(src.includes("validation2-annotation"), false, abs);
    assert.equal(src.includes("holdout-seal-v0"), false, abs);
    assert.equal(src.includes("FRESH_HUMAN_TRUTH"), false, abs);
  }

  console.log("test:proto-round-ocr-research-expansion-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
