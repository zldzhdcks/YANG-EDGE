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
  FROZEN_OCR_RESEARCH_EXPANSION_SPLIT_SHA256,
  FROZEN_PILOT10_DISCOVERY_ANNOTATION_SHA256,
  GROUND_TRUTH_SOURCE,
  SOURCE_POOL_COUNT,
  SPLIT_SALT,
  VALIDATION2_COUNT,
  assertHoldoutExcluded,
  assertNoUnannotatedDiscovery2,
  assertPilot10Excluded,
  blankDiscovery2AnnotationRecords,
  buildDiscovery2HumanTruthDocument,
  buildExpansionSplitSealV1,
  countDiscovery2HumanStatuses,
  discovery2RowsFromFrozenGeometry,
  expansionSplitSortKey,
  hashRowIdentity,
  identityKey,
  joinDiscovery2HumanToFrozenKeys,
  OcrResearchExpansionV1Error,
  parseDiscovery2HumanExportDocument,
  renderDiscovery2AnnotationHtml,
  sourcePoolFromDiscoveryKeys,
  splitDiscovery2Validation2,
  type Discovery2HumanRecordV1,
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
    path.join(
      process.cwd(),
      "scripts/seal-proto-round-ocr-research-expansion-discovery2-human-truth-v1.ts",
    ),
  ];
}

function humanRec(n: number, extra?: Partial<Discovery2HumanRecordV1>): Discovery2HumanRecordV1 {
  return {
    sourceImageSha256: `sha-${String(n).padStart(2, "0")}`,
    visualRowIndex: n,
    sourceFileName: `shot-${n}.png`,
    annotationStatus: "COMPLETE",
    screenRowIdentifierRaw: `id-${n}`,
    participantLeftRaw: `left-${n}`,
    participantRightRaw: `right-${n}`,
    numericCellsRaw: ["1.80", "3.20"],
    marketMarkerRaw: null,
    ...extra,
  };
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
  assert.equal(
    FROZEN_OCR_RESEARCH_EXPANSION_SPLIT_SHA256,
    "64367fb348124df4ba6ca64621ab6c2da88bae0839517afaef54ae79b1f7bdd8",
  );
  assert.equal(
    FROZEN_PILOT10_DISCOVERY_ANNOTATION_SHA256,
    "741d86dfb11ee34349ac18061bce223f418837aca20150acf6b1ef808f6c0f4d",
  );

  const discovery2Humans = split.discovery2RowKeys.map((k) =>
    humanRec(k.visualRowIndex, {
      sourceImageSha256: k.sourceImageSha256,
      visualRowIndex: k.visualRowIndex,
      sourceFileName: `renamed-${k.visualRowIndex}.png`,
    }),
  );
  const joined = joinDiscovery2HumanToFrozenKeys({
    discovery2RowKeys: split.discovery2RowKeys,
    humanRecords: [...discovery2Humans].reverse(),
    validation2RowKeyHashes: seal.validation2RowKeyHashes,
  });
  assert.equal(joined.identityJoin.missing, 0);
  assert.equal(joined.identityJoin.extra, 0);
  assert.equal(joined.identityJoin.duplicates, 0);
  assert.equal(joined.identityJoin.identityMutated, "NO");
  assert.deepEqual(
    joined.orderedRecords.map(identityKey),
    split.discovery2RowKeys.map(identityKey),
  );
  assert.equal(joined.orderedRecords[0]!.sourceFileName.startsWith("renamed-"), true);
  assert.equal(joined.orderedRecords[0]!.numericCellsRaw[0], "1.80");

  const sameNameWrongSha = discovery2Humans.map((rec, i) =>
    i === 0
      ? { ...rec, sourceImageSha256: "not-the-frozen-sha", sourceFileName: rec.sourceFileName }
      : rec,
  );
  assert.throws(
    () =>
      joinDiscovery2HumanToFrozenKeys({
        discovery2RowKeys: split.discovery2RowKeys,
        humanRecords: sameNameWrongSha,
        validation2RowKeyHashes: seal.validation2RowKeyHashes,
      }),
    (err: unknown) =>
      err instanceof OcrResearchExpansionV1Error &&
      (err.code === "MISSING_HUMAN_IDENTITY" || err.code === "EXTRA_HUMAN_IDENTITY"),
  );
  assert.throws(
    () =>
      joinDiscovery2HumanToFrozenKeys({
        discovery2RowKeys: split.discovery2RowKeys,
        humanRecords: [...discovery2Humans.slice(0, 9), discovery2Humans[0]!],
        validation2RowKeyHashes: seal.validation2RowKeyHashes,
      }),
    (err: unknown) =>
      err instanceof OcrResearchExpansionV1Error && err.code === "DUPLICATE_IDENTITY",
  );
  const validation2Human = {
    ...discovery2Humans[0]!,
    sourceImageSha256: split.validation2RowKeys[0]!.sourceImageSha256,
    visualRowIndex: split.validation2RowKeys[0]!.visualRowIndex,
  };
  assert.throws(
    () =>
      joinDiscovery2HumanToFrozenKeys({
        discovery2RowKeys: split.discovery2RowKeys,
        humanRecords: [...discovery2Humans.slice(1), validation2Human],
        validation2RowKeyHashes: seal.validation2RowKeyHashes,
      }),
    (err: unknown) =>
      err instanceof OcrResearchExpansionV1Error &&
      (err.code === "VALIDATION2_IDENTITY_USED" ||
        err.code === "EXTRA_HUMAN_IDENTITY" ||
        err.code === "MISSING_HUMAN_IDENTITY"),
  );

  const uncertain = discovery2Humans.map((rec, i) =>
    i === 0 ? { ...rec, annotationStatus: "UNCERTAIN" as const } : rec,
  );
  const uncertainJoined = joinDiscovery2HumanToFrozenKeys({
    discovery2RowKeys: split.discovery2RowKeys,
    humanRecords: uncertain,
    validation2RowKeyHashes: seal.validation2RowKeyHashes,
  });
  assert.equal(uncertainJoined.orderedRecords[0]!.annotationStatus, "UNCERTAIN");
  const statusCounts = countDiscovery2HumanStatuses(uncertainJoined.orderedRecords);
  assert.equal(statusCounts.UNCERTAIN, 1);
  assert.equal(statusCounts.COMPLETE, 9);
  assert.equal(statusCounts.UNANNOTATED, 0);
  assert.throws(
    () =>
      assertNoUnannotatedDiscovery2(
        discovery2Humans.map((rec, i) =>
          i === 0 ? { ...rec, annotationStatus: "UNANNOTATED" as const } : rec,
        ),
      ),
    (err: unknown) =>
      err instanceof OcrResearchExpansionV1Error && err.code === "UNANNOTATED_HUMAN_ROWS",
  );

  const exportDoc = parseDiscovery2HumanExportDocument({
    schemaVersion: "proto-round-ocr-research-expansion-discovery2-v1",
    protoRoundKey: "2026-105",
    groundTruthSource: GROUND_TRUTH_SOURCE,
    records: discovery2Humans,
  });
  const truth = buildDiscovery2HumanTruthDocument({
    sourceExportPath: "C:\\tmp\\discovery2-annotation-v1.json",
    exportDoc,
    orderedRecords: joined.orderedRecords,
    identityJoin: joined.identityJoin,
  });
  assert.equal(truth.USED_FOR_OCR_RULE_DESIGN, false);
  assert.equal(truth.VALIDATION_2_USED_FOR_RULE_DESIGN, false);
  assert.equal(truth.records[0]!.participantLeftRaw, discovery2Humans.find(
    (r) => identityKey(r) === identityKey(split.discovery2RowKeys[0]!),
  )!.participantLeftRaw);

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
    assert.equal(src.includes("nearest visual"), false, abs);
    assert.equal(src.includes("filename-only"), false, abs);
  }

  const tracked = execFileSync("git", ["ls-files"], {
    encoding: "utf8",
  }).split(/\r?\n/);
  for (const rel of tracked) {
    assert.equal(rel.includes("discovery2-human-truth-v1.json"), false, rel);
    assert.equal(rel.includes("YANG-EDGE-INBOX"), false, rel);
  }

  console.log("test:proto-round-ocr-research-expansion-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
