/**
 * Fresh Validation machine-pass v0 tests.
 * Deterministic mocks. No real OCR. No Holdout. No human Ground Truth.
 *
 *   npm run test:proto-round-fresh-validation-machine-pass-v0
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FRESH_SELECTION_SALT,
  FRESH_VALIDATION_SAMPLE_SIZE,
  FROZEN_FRESH_IMAGE_COUNT,
  FROZEN_FRESH_IMAGE_SHA256,
  FROZEN_WINNER_CANDIDATE,
  FreshValidationBlindTestV0Error,
  assertFreshImageIdentities,
  blockedMessage,
  buildFreshMachineOutputDocument,
  buildFreshSelectionDocument,
  freshSelectionSortKey,
  humanAnnotationRecordsFromSelection,
  literalMarketMarkerCandidateRaw,
  numericRawEvidences,
  renderFreshValidationHumanHtml,
  safeReconstructedNumericEvidences,
  selectFreshValidationRows,
  type FreshEligibleRowV0,
  type FreshMachineGeometryRowV0,
} from "../src/lib/proto-round-fresh-validation-blind-test-v0";
import {
  exactEvidencePresentAny,
  type CropOcrProviderV3,
} from "../src/lib/proto-round-participant-ocr-experiment-v3";

function eligible(n: number, extra?: Partial<FreshEligibleRowV0>): FreshEligibleRowV0 {
  return {
    sourceImageSha256: `sha-${String(n).padStart(2, "0")}`,
    sourceFileName: `shot-${n}.png`,
    visualRowIndex: n,
    topY: 10 + n * 20,
    bottomY: 24 + n * 20,
    centerY: 17 + n * 20,
    imageWidth: 800,
    imageHeight: 400,
    screenshotRelativePath: `canonical/shot-${n}.png`,
    ...extra,
  };
}

function geometry(n: number, extra?: Partial<FreshMachineGeometryRowV0>): FreshMachineGeometryRowV0 {
  return {
    ...eligible(n),
    regions: [
      {
        rawEvidenceTags: ["TEXT_BEARING_RAW"],
        joinedRawText: "text-region",
        fragments: [{ x: 40, y: 10 + n * 20, width: 80, height: 14 }],
      },
      {
        rawEvidenceTags: ["NUMERIC_LIKE_RAW"],
        joinedRawText: "1.91",
        fragments: [{ x: 400, y: 10 + n * 20, width: 40, height: 14 }],
      },
      {
        rawEvidenceTags: ["EXACT_MARKET_MARKER_RAW"],
        joinedRawText: "SUM",
        fragments: [{ x: 500, y: 10 + n * 20, width: 30, height: 14 }],
      },
    ],
    ...extra,
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
  const lib = path.join(
    process.cwd(),
    "src/lib/proto-round-fresh-validation-blind-test-v0",
  );
  return [
    ...readdirSync(lib)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(lib, f)),
    path.join(
      process.cwd(),
      "scripts/run-proto-round-fresh-validation-machine-pass-v0.ts",
    ),
    path.join(
      process.cwd(),
      "scripts/open-proto-round-fresh-validation-human-ui-v0.ts",
    ),
  ];
}

async function main() {
  assert.equal(FROZEN_WINNER_CANDIDATE, "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION");
  assert.equal(FRESH_SELECTION_SALT, "proto-fresh-validation-v0");
  assert.equal(FRESH_VALIDATION_SAMPLE_SIZE, 10);
  assert.equal(FROZEN_FRESH_IMAGE_COUNT, 3);
  assert.equal(FROZEN_FRESH_IMAGE_SHA256.length, 3);
  assert.equal(blockedMessage(), "FRESH_VALIDATION_BLIND_TEST_V0_BLOCKED");

  assert.doesNotThrow(() => assertFreshImageIdentities([...FROZEN_FRESH_IMAGE_SHA256].reverse()));
  assert.throws(
    () => assertFreshImageIdentities(["aaa", "bbb", "ccc"]),
    (err: unknown) =>
      err instanceof FreshValidationBlindTestV0Error && err.code === "FRESH_IMAGE_SHA_MISMATCH",
  );

  const rows12 = Array.from({ length: 12 }, (_, i) => eligible(i));
  const selected = selectFreshValidationRows({ eligibleRows: rows12 });
  assert.equal(selected.selectedRows.length, 10);
  const resorted = selectFreshValidationRows({
    eligibleRows: [...rows12].reverse(),
  });
  assert.deepEqual(
    selected.selectedRows.map((r) => `${r.sourceImageSha256}|${r.visualRowIndex}`),
    resorted.selectedRows.map((r) => `${r.sourceImageSha256}|${r.visualRowIndex}`),
  );
  const keys = selected.selectedRows.map((r) =>
    freshSelectionSortKey({
      sourceImageSha256: r.sourceImageSha256,
      visualRowIndex: r.visualRowIndex,
    }),
  );
  const sortedKeys = [...keys].sort();
  assert.deepEqual(keys, sortedKeys);

  const few = selectFreshValidationRows({ eligibleRows: rows12.slice(0, 4) });
  assert.equal(few.selectedRows.length, 4);

  const doc = buildFreshSelectionDocument({
    protoRoundKey: "2026-105",
    eligibleRows: Array.from({ length: 12 }, (_, i) => geometry(i)),
  });
  assert.equal(doc.selectedRowCount, 10);
  assert.equal("regions" in doc.selectedRows[0]!, false);
  assert.equal("participantRawOcrEvidences" in doc.selectedRows[0]!, false);

  assert.equal(literalMarketMarkerCandidateRaw(geometry(0).regions), "SUM");
  assert.equal(
    literalMarketMarkerCandidateRaw([
      { rawEvidenceTags: ["EXACT_MARKET_MARKER_RAW", "TEXT_BEARING_RAW"], joinedRawText: "SUM", fragments: [] },
    ]),
    null,
  );
  const split = safeReconstructedNumericEvidences([
    { source: "V2_ROW_CROP_UPSCALE_3X_KO", text: "2 95" },
    { source: "TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO", text: "1-91" },
  ]);
  assert.deepEqual(split, ["2.95", "1.91"]);
  assert.equal(exactEvidencePresentAny(["left", "-token"], "left-token"), false);
  const numeric = numericRawEvidences({
    regions: geometry(0).regions,
    participantEvidence: [
      { source: "V2_ROW_CROP_UPSCALE_3X_KO", text: "1.63 left" },
    ],
  });
  assert.equal(numeric.includes("1.91"), true);
  assert.equal(numeric.includes("1.63"), true);

  const calls: Array<{ scale: number; cropX: number }> = [];
  const mock: CropOcrProviderV3 = {
    async extractCrop(request) {
      calls.push({ scale: request.scale, cropX: request.crop.x });
      if (request.scale === 3) return { rawText: "left-0 1.91", rawLines: [] };
      return { rawText: "right-0 1.63", rawLines: [] };
    },
  };
  const machine = await buildFreshMachineOutputDocument({
    protoRoundKey: "2026-105",
    selectedGeometry: [geometry(0)],
    imagePathBySha256: new Map([["sha-00", "C:\\tmp\\shot-0.png"]]),
    cropOcr: mock,
  });
  assert.equal(machine.winnerCandidate, "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION");
  assert.equal(machine.humanGroundTruthRead, false);
  assert.equal(machine.holdoutRead, false);
  assert.equal(machine.rows[0]!.participantRawOcrEvidences.length >= 2, true);
  assert.equal(
    machine.rows[0]!.participantRawOcrEvidences.some((p) => p.text.includes("left-0 right-0")),
    false,
  );
  assert.equal(calls.some((c) => c.scale === 3), true);
  assert.equal(calls.some((c) => c.scale === 5), true);
  assert.equal(calls.some((c) => c.scale === 4), false);

  const html = renderFreshValidationHumanHtml({
    protoRoundKey: "2026-105",
    records: humanAnnotationRecordsFromSelection(doc.selectedRows),
  });
  assert.equal(html.includes("participantRawOcrEvidences"), false);
  assert.equal(html.includes("safeReconstructedNumericEvidences"), false);
  assert.equal(html.includes("marketMarkerCandidateRaw"), false);
  assert.equal(html.includes("ROW_PLUS_TEXT_REGION_EVIDENCE_UNION"), false);
  assert.equal(html.includes("경기번호"), true);
  assert.equal(html.includes("시장 표시"), true);

  assert.equal(gitDiffExitCode("data/research"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-raw-ocr-v0"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-structured-extraction-v0/parser.ts"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-participant-ocr-experiment-v3"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-ocr-recovery-experiment-v2"), 0);

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("holdoutRowKeys"), false, abs);
    assert.equal(src.includes("holdout-seal"), false, abs);
    assert.equal(src.includes("fetch("), false, abs);
    assert.equal(src.includes("parseStructuredRowV0"), false, abs);
    assert.equal(src.includes("https://"), false, abs);
    assert.equal(src.includes("http://"), false, abs);
    assert.equal(src.includes("participantDictionary"), false, abs);
  }

  console.log("test:proto-round-fresh-validation-machine-pass-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
