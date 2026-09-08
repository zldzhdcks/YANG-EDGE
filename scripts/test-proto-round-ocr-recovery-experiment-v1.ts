/**
 * Isolated OCR recovery experiment v1 tests.
 * Deterministic mock OCR. No real engine. No Holdout. No Fresh pixels.
 * Network: 0.
 *
 *   npm run test:proto-round-ocr-recovery-experiment-v1
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  CANDIDATE_SIMPLICITY_RANK,
  MAXIMUM_EXPERIMENT_VARIANTS,
  OCR_RECOVERY_CANDIDATES,
  PILOT_COUNT,
  OcrRecoveryExperimentError,
  assertPilot10Keys,
  buildFreshValidationSeal,
  classifyNumericOcrPattern,
  classifyParticipantOcrPattern,
  exactEvidencePresent,
  identifyFreshUnseenImages,
  runOcrRecoveryExperimentV1,
  scoreRowEvidence,
  selectBestOcrRecoveryCandidate,
  selectPilot10Truth,
  semanticRegionCropBoxes,
  visualRowCropBox,
  type CandidatePilotScoreV1,
  type CropOcrProviderV1,
  type FrozenIdentityV1,
  type PilotTruthV1,
  type SemanticRegionGeometryV1,
  type VisualRowGeometryV1,
} from "../src/lib/proto-round-ocr-recovery-experiment-v1";

function ident(n: number): FrozenIdentityV1 {
  return { sourceImageSha256: `sha-${n}`, visualRowIndex: n };
}

function truth(n: number, extra?: Partial<PilotTruthV1>): PilotTruthV1 {
  return {
    ...ident(n),
    annotationStatus: "COMPLETE",
    participantLeftRaw: `left-${n}`,
    participantRightRaw: `right-${n}`,
    numericCellsRaw: ["1.91", "1.63"],
    ...extra,
  };
}

function visual(n: number, extra?: Partial<VisualRowGeometryV1>): VisualRowGeometryV1 {
  return {
    ...ident(n),
    sourceFileName: `shot-${n}.png`,
    topY: 10 + n * 20,
    bottomY: 24 + n * 20,
    imageWidth: 800,
    imageHeight: 400,
    visualJoinedTextCandidate: `left-${n} right-${n} 1 91 1 63`,
    fragments: [
      { rawText: `left-${n}`, x: 40, y: 10 + n * 20, width: 80, height: 14 },
      { rawText: `right-${n}`, x: 200, y: 10 + n * 20, width: 80, height: 14 },
      { rawText: "1 91", x: 400, y: 10 + n * 20, width: 40, height: 14 },
      { rawText: "1 63", x: 500, y: 10 + n * 20, width: 40, height: 14 },
    ],
    ...extra,
  };
}

function semantic(n: number): SemanticRegionGeometryV1 {
  const y = 10 + n * 20;
  return {
    ...ident(n),
    regions: [
      {
        fragments: [{ rawText: `left-${n}`, x: 40, y, width: 80, height: 14 }],
      },
      {
        fragments: [{ rawText: `right-${n}`, x: 200, y, width: 80, height: 14 }],
      },
      {
        fragments: [{ rawText: "1 91", x: 400, y, width: 40, height: 14 }],
      },
    ],
  };
}

function tenKeys(): FrozenIdentityV1[] {
  return Array.from({ length: 10 }, (_, i) => ident(i));
}

function mockProvider(spec: {
  native?: string;
  gray?: string;
  up2?: string;
  up3?: string;
  region?: string;
}): CropOcrProviderV1 {
  return {
    async extractCrop(request) {
      if (request.scale === 2) {
        return { rawText: spec.up2 ?? spec.native ?? "", rawLines: [] };
      }
      if (request.scale === 3) {
        return { rawText: spec.up3 ?? spec.native ?? "", rawLines: [] };
      }
      if (request.grayscale) {
        return { rawText: spec.gray ?? spec.native ?? "", rawLines: [] };
      }
      if (request.crop.x > 0) {
        return { rawText: spec.region ?? spec.native ?? "", rawLines: [] };
      }
      return { rawText: spec.native ?? "", rawLines: [] };
    },
  };
}

function sourceFiles(): string[] {
  const lib = path.join(process.cwd(), "src/lib/proto-round-ocr-recovery-experiment-v1");
  return [
    ...readdirSync(lib).filter((f) => f.endsWith(".ts")).map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/run-proto-round-ocr-recovery-experiment-v1.ts"),
  ];
}

function candidateScore(
  name: CandidatePilotScoreV1["candidate"],
  primary: number,
  left: number,
  right: number,
  nums: number,
): CandidatePilotScoreV1 {
  return {
    candidate: name,
    participantLeftExactEvidencePresent: left,
    participantRightExactEvidencePresent: right,
    numericCellExactEvidenceCount: 0,
    numericCellTotalTruthCount: 20,
    numericCellsAllExactEvidencePresent: nums,
    participantPairExactEvidencePresent: Math.min(left, right),
    allPrimaryEvidencePresent: primary,
    rows: [],
  };
}

async function main() {
  assert.equal(PILOT_COUNT, 10);
  assert.equal(OCR_RECOVERY_CANDIDATES.length, 6);
  assert.equal(OCR_RECOVERY_CANDIDATES.length <= MAXIMUM_EXPERIMENT_VARIANTS, true);
  assert.equal(CANDIDATE_SIMPLICITY_RANK.BASELINE_WHOLE_SCREEN, 0);
  assert.equal(CANDIDATE_SIMPLICITY_RANK.ROW_CROP_UPSCALE_3X, 5);

  assert.equal(exactEvidencePresent("한화 1.91 기아", "한화"), true);
  assert.equal(exactEvidencePresent("한와 1.91 기아", "한화"), false);
  assert.equal(exactEvidencePresent("2 95 1-91", "2.95"), false);
  assert.equal(exactEvidencePresent("2.95 1.91", "2.95"), true);
  assert.equal(exactEvidencePresent("", "한화"), false);
  assert.equal(exactEvidencePresent("x", null), false);

  const ordered = scoreRowEvidence({
    participantLeftRaw: "한화",
    participantRightRaw: "기아",
    numericCellsRaw: ["1.91", "1.63"],
    evidence: "1.63 한화 1.91 기아",
  });
  assert.equal(ordered.numericCellExactEvidenceCount, 2);
  assert.equal(ordered.numericCellsAllExactEvidencePresent, true);
  assert.equal(ordered.allPrimaryEvidencePresent, true);

  const unsortedDoesNotInflate = scoreRowEvidence({
    participantLeftRaw: "한화",
    participantRightRaw: "기아",
    numericCellsRaw: ["1.91", "1.63"],
    evidence: "한화 기아 1.63",
  });
  assert.equal(unsortedDoesNotInflate.numericCellExactEvidenceCount, 1);
  assert.equal(unsortedDoesNotInflate.numericCellsAllExactEvidencePresent, false);
  assert.equal(unsortedDoesNotInflate.allPrimaryEvidencePresent, false);

  const box = visualRowCropBox({
    topY: 10.2,
    bottomY: 24.8,
    imageWidth: 800,
    imageHeight: 400,
  });
  assert.deepEqual(box, { x: 0, y: 10, width: 800, height: 15 });
  const regions = semanticRegionCropBoxes({
    imageWidth: 800,
    imageHeight: 400,
    regions: [
      { fragments: [{ x: 40.2, y: 10, width: 80, height: 14 }] },
      { fragments: [{ x: 200, y: 10, width: 80, height: 14 }] },
    ],
  });
  assert.equal(regions.length, 2);
  assert.equal(regions[0]!.x, 40);
  assert.equal(regions[0]!.y, 10);

  assert.equal(
    classifyNumericOcrPattern({ truth: "2.95", evidence: "2 95 1.80" }),
    "DIGIT_SPACE_DIGIT",
  );
  assert.equal(
    classifyNumericOcrPattern({ truth: "1.91", evidence: "1-91" }),
    "DIGIT_HYPHEN_DIGIT",
  );
  assert.equal(
    classifyNumericOcrPattern({ truth: "2.64", evidence: "264" }),
    "MISSING_DECIMAL",
  );
  assert.equal(
    classifyNumericOcrPattern({ truth: "7.80", evidence: "7 80!" }),
    "TRAILING_PUNCTUATION",
  );
  assert.equal(
    classifyNumericOcrPattern({ truth: "1.91", evidence: "2191" }),
    "EXTRA_NUMERIC_FRAGMENT",
  );
  assert.equal(classifyNumericOcrPattern({ truth: "1.91", evidence: "1.91" }), null);

  assert.equal(
    classifyParticipantOcrPattern({ truth: "한화", evidence: "한 화" }),
    "FRAGMENTATION",
  );
  assert.equal(
    classifyParticipantOcrPattern({ truth: "한화", evidence: "한" }),
    "PREFIX_LOSS",
  );
  assert.equal(
    classifyParticipantOcrPattern({ truth: "한화", evidence: "화" }),
    "SUFFIX_LOSS",
  );
  assert.equal(
    classifyParticipantOcrPattern({ truth: "한화", evidence: "한와" }),
    "ONE_CHARACTER_SUBSTITUTION",
  );
  assert.equal(
    classifyParticipantOcrPattern({ truth: "한화팀", evidence: "기아기" }),
    "MULTI_CHARACTER_SUBSTITUTION",
  );
  assert.equal(
    classifyParticipantOcrPattern({ truth: "한화", evidence: "ABC" }),
    "LATIN_KOREAN_CONFUSION",
  );
  assert.equal(
    classifyParticipantOcrPattern({ truth: "한화", evidence: "" }),
    "MISSING_TEXT",
  );
  assert.equal(classifyParticipantOcrPattern({ truth: "한화", evidence: "한화" }), null);

  const fresh = identifyFreshUnseenImages({
    canonicalImages: [
      { sha256: "aaa", fileName: "old-name.png" },
      { sha256: "bbb", fileName: "new-a.png" },
      { sha256: "ccc", fileName: "new-b.png" },
    ],
    firstShotSourceImages: [
      { sourceImageSha256: "aaa", sourceFileName: "renamed-but-same-bytes.png" },
    ],
  });
  assert.equal(fresh.freshUnseenImageCount, 2);
  assert.deepEqual(fresh.freshUnseenImageSha256, ["bbb", "ccc"]);
  assert.equal(fresh.freshUnseenFileNames.includes("old-name.png"), false);

  const seal = buildFreshValidationSeal({
    protoRoundKey: "2026-105",
    createdFromIntakeManifest: "intake-manifest-v1.json",
    images: fresh.images,
  });
  assert.equal(seal.imageCount, 2);
  assert.equal(seal.visualContentUsedForRuleDesign, false);
  assert.equal(seal.ocrUsedForRuleDesign, false);
  assert.equal(seal.groundTruthCreated, false);
  assert.equal(seal.purpose, "POST_RULE_FREEZE_FRESH_VALIDATION");

  assert.equal(
    selectBestOcrRecoveryCandidate([
      candidateScore("ROW_CROP_UPSCALE_3X", 4, 8, 8, 4),
      candidateScore("ROW_CROP_NATIVE", 4, 8, 8, 4),
      candidateScore("BASELINE_WHOLE_SCREEN", 3, 7, 7, 3),
    ]),
    "ROW_CROP_NATIVE",
  );
  assert.equal(
    selectBestOcrRecoveryCandidate([
      candidateScore("BASELINE_WHOLE_SCREEN", 2, 5, 5, 2),
      candidateScore("ROW_CROP_UPSCALE_2X", 3, 6, 6, 3),
    ]),
    "ROW_CROP_UPSCALE_2X",
  );
  assert.equal(
    selectBestOcrRecoveryCandidate([
      candidateScore("ROW_CROP_NATIVE", 3, 6, 5, 3),
      candidateScore("ROW_CROP_GRAYSCALE_NATIVE", 3, 7, 7, 3),
    ]),
    "ROW_CROP_GRAYSCALE_NATIVE",
  );

  const keys = tenKeys();
  assert.deepEqual(assertPilot10Keys([...keys, ident(99)]), keys);
  const truthRows = [
    ...Array.from({ length: 10 }, (_, i) => truth(i)),
    truth(99, { participantLeftRaw: "NOT_PILOT" }),
  ];
  const selected = selectPilot10Truth({
    discoveryRowKeys: [...keys, ident(99)],
    records: truthRows,
  });
  assert.equal(selected.length, 10);
  assert.equal(selected.some((r) => r.visualRowIndex === 99), false);

  const visualRows = Array.from({ length: 10 }, (_, i) => visual(i));
  const semanticRows = Array.from({ length: 10 }, (_, i) => semantic(i));
  const imagePathBySha256 = new Map(
    Array.from({ length: 10 }, (_, i) => [`sha-${i}`, `C:\\tmp\\shot-${i}.png`] as const),
  );
  const cropOcr = mockProvider({
    native: "left-0 right-0 1.91 1.63 leftover",
    gray: "left-0 right-0 1.91 1.63 leftover",
    up2: "left-0 right-0 1.91 1.63 leftover",
    up3: "left-0 right-0 1.91 1.63 leftover",
    region: "left-0 right-0 1.91 leftover",
  });

  const first = await runOcrRecoveryExperimentV1({
    protoRoundKey: "2026-105",
    pilotKeys: keys,
    truthRows: selected,
    visualRows,
    semanticRows,
    imagePathBySha256,
    freshSha256: new Set(["fresh-sha"]),
    cropOcr,
  });
  const second = await runOcrRecoveryExperimentV1({
    protoRoundKey: "2026-105",
    pilotKeys: keys,
    truthRows: selected,
    visualRows,
    semanticRows,
    imagePathBySha256,
    freshSha256: new Set(["fresh-sha"]),
    cropOcr,
  });
  assert.deepEqual(
    first.candidates.map((c) => ({
      candidate: c.candidate,
      allPrimaryEvidencePresent: c.allPrimaryEvidencePresent,
      participantLeftExactEvidencePresent: c.participantLeftExactEvidencePresent,
      participantRightExactEvidencePresent: c.participantRightExactEvidencePresent,
      numericCellsAllExactEvidencePresent: c.numericCellsAllExactEvidencePresent,
    })),
    second.candidates.map((c) => ({
      candidate: c.candidate,
      allPrimaryEvidencePresent: c.allPrimaryEvidencePresent,
      participantLeftExactEvidencePresent: c.participantLeftExactEvidencePresent,
      participantRightExactEvidencePresent: c.participantRightExactEvidencePresent,
      numericCellsAllExactEvidencePresent: c.numericCellsAllExactEvidencePresent,
    })),
  );
  const baseline = first.candidates.find((c) => c.candidate === "BASELINE_WHOLE_SCREEN")!;
  assert.equal(baseline.participantLeftExactEvidencePresent, 10);
  assert.equal(baseline.participantRightExactEvidencePresent, 10);
  assert.equal(baseline.numericCellsAllExactEvidencePresent, 0);
  assert.equal(baseline.allPrimaryEvidencePresent, 0);
  const native = first.candidates.find((c) => c.candidate === "ROW_CROP_NATIVE")!;
  assert.equal(native.allPrimaryEvidencePresent, 1);
  assert.equal(first.bestCandidate, "ROW_CROP_NATIVE");
  assert.equal(first.networkUsed, false);
  assert.equal(first.parserUsed, false);
  assert.equal(first.holdoutRead, false);
  assert.equal(first.freshValidationReadForRuleDesign, false);
  assert.equal(first.candidates.every((c) => c.rows.length === 10), true);
  assert.equal(first.candidates.some((c) => c.rows.some((r) => r.visualRowIndex === 99)), false);

  await assert.rejects(
    () =>
      runOcrRecoveryExperimentV1({
        protoRoundKey: "2026-105",
        pilotKeys: [{ sourceImageSha256: "fresh-sha", visualRowIndex: 0 }, ...keys.slice(1)],
        truthRows: [truth(0, { sourceImageSha256: "fresh-sha" }), ...selected.slice(1)],
        visualRows: [visual(0, { sourceImageSha256: "fresh-sha" }), ...visualRows.slice(1)],
        semanticRows,
        imagePathBySha256: new Map([["fresh-sha", "C:\\tmp\\fresh.png"], ...imagePathBySha256]),
        freshSha256: new Set(["fresh-sha"]),
        cropOcr,
      }),
    (err: unknown) =>
      err instanceof OcrRecoveryExperimentError && err.code === "FRESH_VALIDATION_OCR_FORBIDDEN",
  );

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("holdoutRowKeys"), false, abs);
    assert.equal(src.includes("holdout-seal"), false, abs);
    assert.equal(src.includes("fetch("), false, abs);
    assert.equal(src.includes("postgame"), false, abs);
    assert.equal(src.includes("parseStructuredRowV0"), false, abs);
    assert.equal(src.includes("proto-round-structured-extraction-v0/parser"), false, abs);
    assert.equal(src.includes("C시포로"), false, abs);
    assert.equal(src.includes("C삿포로"), false, abs);
    assert.equal(src.includes("도지기시"), false, abs);
    assert.equal(src.includes("도치기시"), false, abs);
    assert.equal(src.includes("님이와라"), false, abs);
    assert.equal(src.includes("J이와타"), false, abs);
    assert.equal(src.includes("https://"), false, abs);
    assert.equal(src.includes("http://"), false, abs);
  }

  console.log("test:proto-round-ocr-recovery-experiment-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
