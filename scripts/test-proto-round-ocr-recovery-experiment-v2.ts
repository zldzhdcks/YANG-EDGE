/**
 * Isolated OCR recovery experiment v2 tests.
 * Deterministic mock OCR. No real engine. No Holdout. No Fresh pixels.
 * Network: 0.
 *
 *   npm run test:proto-round-ocr-recovery-experiment-v2
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  CANDIDATE_SIMPLICITY_RANK_V2,
  MAXIMUM_EXPERIMENT_VARIANTS,
  OCR_RECOVERY_V2_CANDIDATES,
  PILOT_COUNT,
  REGION_EXPAND_HORIZONTAL_RATIO,
  REGION_EXPAND_MIN_PIXEL_PADDING,
  REGION_EXPAND_VERTICAL_RATIO,
  OcrRecoveryExperimentV2Error,
  assertPilot10Keys,
  collectSafeReconstructedNumerics,
  exactEvidencePresentAny,
  expandRegionBox,
  ocrRecoveryV2Level,
  runOcrRecoveryExperimentV2,
  safeReconstructNumericToken,
  scoreRowEvidenceV2,
  selectBestOcrRecoveryCandidateV2,
  selectPilot10Truth,
  semanticRegionCropBoxes,
  visualRowCropBox,
  type CandidatePilotScoreV2,
  type CropOcrProviderV2,
  type FrozenIdentityV2,
  type IndependentEvidenceV2,
  type PilotTruthV2,
  type SemanticRegionGeometryV2,
  type VisualRowGeometryV2,
} from "../src/lib/proto-round-ocr-recovery-experiment-v2";

function ident(n: number): FrozenIdentityV2 {
  return { sourceImageSha256: `sha-${n}`, visualRowIndex: n };
}

function truth(n: number, extra?: Partial<PilotTruthV2>): PilotTruthV2 {
  return {
    ...ident(n),
    annotationStatus: "COMPLETE",
    participantLeftRaw: `left-${n}`,
    participantRightRaw: `right-${n}`,
    numericCellsRaw: ["1.91", "1.63"],
    ...extra,
  };
}

function visual(n: number): VisualRowGeometryV2 {
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
  };
}

function semantic(n: number): SemanticRegionGeometryV2 {
  const y = 10 + n * 20;
  return {
    ...ident(n),
    regions: [
      { fragments: [{ rawText: `left-${n}`, x: 40, y, width: 80, height: 14 }] },
      { fragments: [{ rawText: `right-${n}`, x: 200, y, width: 80, height: 14 }] },
      { fragments: [{ rawText: "1 91", x: 400, y, width: 40, height: 14 }] },
      { fragments: [{ rawText: "1 63", x: 500, y, width: 40, height: 14 }] },
    ],
  };
}

function tenKeys(): FrozenIdentityV2[] {
  return Array.from({ length: 10 }, (_, i) => ident(i));
}

function mockProvider(): CropOcrProviderV2 {
  return {
    async extractCrop(request) {
      const lang = request.language;
      const expanded = request.crop.x < 40;
      if (lang === "en-US") {
        return {
          rawText: expanded ? "right-0 1.91 1.63" : "right-0 1-91",
          rawLines: [],
        };
      }
      if (request.crop.x === 0) {
        return { rawText: "left-0 1 91 1 63", rawLines: [] };
      }
      return {
        rawText: expanded ? "left-0 1.91 1.63" : "left-0 1 91",
        rawLines: [],
      };
    },
  };
}

function sourceFiles(): string[] {
  const lib = path.join(process.cwd(), "src/lib/proto-round-ocr-recovery-experiment-v2");
  return [
    ...readdirSync(lib).filter((f) => f.endsWith(".ts")).map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/run-proto-round-ocr-recovery-experiment-v2.ts"),
  ];
}

function candidateScore(
  name: CandidatePilotScoreV2["candidate"],
  extra: Partial<CandidatePilotScoreV2>,
): CandidatePilotScoreV2 {
  return {
    candidate: name,
    status: "OK",
    participantLeftExactEvidencePresent: 0,
    participantRightExactEvidencePresent: 0,
    numericCellExactEvidenceCount: 0,
    numericCellTotalTruthCount: 20,
    numericCellsAllExactEvidencePresent: 0,
    participantPairExactEvidencePresent: 0,
    allPrimaryEvidencePresent: 0,
    numericReconstructedExactCellCount: 99,
    numericCellsAllExactAfterSafeReconstruction: 9,
    rows: [],
    ...extra,
  };
}

async function main() {
  assert.equal(PILOT_COUNT, 10);
  assert.equal(OCR_RECOVERY_V2_CANDIDATES.length, 6);
  assert.equal(OCR_RECOVERY_V2_CANDIDATES.length <= MAXIMUM_EXPERIMENT_VARIANTS, true);
  assert.equal(REGION_EXPAND_HORIZONTAL_RATIO, 0.2);
  assert.equal(REGION_EXPAND_VERTICAL_RATIO, 0.5);
  assert.equal(REGION_EXPAND_MIN_PIXEL_PADDING, 1);
  assert.equal(CANDIDATE_SIMPLICITY_RANK_V2.BASELINE_WHOLE_SCREEN, 0);

  const native = semanticRegionCropBoxes({
    imageWidth: 800,
    imageHeight: 400,
    regions: [{ fragments: [{ x: 100, y: 100, width: 50, height: 20 }] }],
  });
  assert.equal(native.length, 1);
  const expanded = expandRegionBox(native[0]!, 800, 400);
  assert.deepEqual(expanded, { x: 90, y: 90, width: 70, height: 40 });
  const clamped = expandRegionBox({ x: 0, y: 0, width: 50, height: 20 }, 800, 400);
  assert.equal(clamped!.x, 0);
  assert.equal(clamped!.y, 0);
  assert.equal(clamped!.width, 60);
  assert.equal(clamped!.height, 30);

  const rowBox = visualRowCropBox({
    topY: 10.2,
    bottomY: 24.8,
    imageWidth: 800,
    imageHeight: 400,
  });
  assert.deepEqual(rowBox, { x: 0, y: 10, width: 800, height: 15 });

  assert.equal(safeReconstructNumericToken("2 95"), "2.95");
  assert.equal(safeReconstructNumericToken("3 50"), "3.50");
  assert.equal(safeReconstructNumericToken("1-91"), "1.91");
  assert.equal(safeReconstructNumericToken("7 80!"), "7.80");
  assert.equal(safeReconstructNumericToken("264"), null);
  assert.equal(safeReconstructNumericToken("227"), null);
  assert.equal(safeReconstructNumericToken("0"), null);
  assert.deepEqual(collectSafeReconstructedNumerics("odds 2 95 and 1-91 end"), [
    "2.95",
    "1.91",
  ]);
  assert.deepEqual(collectSafeReconstructedNumerics("264 227 255"), []);

  const dualKoEn: IndependentEvidenceV2[] = [
    { language: "ko", source: "REGION_CROP", text: "한화 2 95" },
    { language: "en-US", source: "REGION_CROP", text: "기아 1-91" },
  ];
  const dualScore = scoreRowEvidenceV2({
    participantLeftRaw: "한화",
    participantRightRaw: "기아",
    numericCellsRaw: ["2.95", "1.91"],
    evidence: dualKoEn,
  });
  assert.equal(dualScore.participantLeftExactEvidencePresent, true);
  assert.equal(dualScore.participantRightExactEvidencePresent, true);
  assert.equal(dualScore.participantPairExactEvidencePresent, true);
  assert.equal(dualScore.numericCellExactEvidenceCount, 0);
  assert.equal(dualScore.numericReconstructedExactCellCount, 2);
  assert.equal(dualScore.numericCellsAllExactAfterSafeReconstruction, true);
  assert.equal(dualScore.allPrimaryEvidencePresent, false);

  const noInvent = scoreRowEvidenceV2({
    participantLeftRaw: "한화",
    participantRightRaw: "기아",
    numericCellsRaw: ["1.91"],
    evidence: [
      { language: "ko", source: "REGION_CROP", text: "한" },
      { language: "en-US", source: "REGION_CROP", text: "화" },
    ],
  });
  assert.equal(noInvent.participantLeftExactEvidencePresent, false);
  assert.equal(exactEvidencePresentAny(["한", "화"], "한화"), false);

  const ordered = scoreRowEvidenceV2({
    participantLeftRaw: "한화",
    participantRightRaw: "기아",
    numericCellsRaw: ["1.91", "1.63"],
    evidence: [{ language: "ko", source: "ROW_CROP", text: "1.63 한화 1.91 기아" }],
  });
  assert.equal(ordered.numericCellExactEvidenceCount, 2);
  const unsorted = scoreRowEvidenceV2({
    participantLeftRaw: "한화",
    participantRightRaw: "기아",
    numericCellsRaw: ["1.91", "1.63"],
    evidence: [{ language: "ko", source: "ROW_CROP", text: "한화 기아 1.63" }],
  });
  assert.equal(unsorted.numericCellExactEvidenceCount, 1);

  assert.equal(
    selectBestOcrRecoveryCandidateV2([
      candidateScore("REGION_CROP_EXPANDED_UPSCALE_3X_KO", {
        allPrimaryEvidencePresent: 0,
        participantPairExactEvidencePresent: 1,
        numericCellsAllExactEvidencePresent: 2,
        numericCellExactEvidenceCount: 8,
      }),
      candidateScore("BASELINE_WHOLE_SCREEN", {
        allPrimaryEvidencePresent: 1,
        participantPairExactEvidencePresent: 0,
      }),
    ]),
    "BASELINE_WHOLE_SCREEN",
  );
  assert.equal(
    selectBestOcrRecoveryCandidateV2([
      candidateScore("BASELINE_WHOLE_SCREEN", {
        participantPairExactEvidencePresent: 0,
        numericReconstructedExactCellCount: 25,
      }),
      candidateScore("ROW_CROP_UPSCALE_3X_KO", {
        participantPairExactEvidencePresent: 1,
        numericReconstructedExactCellCount: 0,
      }),
    ]),
    "ROW_CROP_UPSCALE_3X_KO",
  );
  assert.equal(
    selectBestOcrRecoveryCandidateV2([
      candidateScore("REGION_CROP_UPSCALE_3X_EN", { status: "EN_OCR_UNAVAILABLE" }),
      candidateScore("BASELINE_WHOLE_SCREEN", { allPrimaryEvidencePresent: 0 }),
    ]),
    "BASELINE_WHOLE_SCREEN",
  );

  const keys = tenKeys();
  assert.deepEqual(assertPilot10Keys([...keys, ident(99)]), keys);
  const selected = selectPilot10Truth({
    discoveryRowKeys: [...keys, ident(99)],
    records: [...Array.from({ length: 10 }, (_, i) => truth(i)), truth(99)],
  });
  assert.equal(selected.length, 10);
  assert.equal(selected.some((r) => r.visualRowIndex === 99), false);

  const first = await runOcrRecoveryExperimentV2({
    protoRoundKey: "2026-105",
    pilotKeys: keys,
    truthRows: selected,
    visualRows: Array.from({ length: 10 }, (_, i) => visual(i)),
    semanticRows: Array.from({ length: 10 }, (_, i) => semantic(i)),
    imagePathBySha256: new Map(
      Array.from({ length: 10 }, (_, i) => [`sha-${i}`, `C:\\tmp\\shot-${i}.png`] as const),
    ),
    freshSha256: new Set(["fresh-sha"]),
    cropOcr: mockProvider(),
    enOcrAvailable: true,
  });
  const second = await runOcrRecoveryExperimentV2({
    protoRoundKey: "2026-105",
    pilotKeys: keys,
    truthRows: selected,
    visualRows: Array.from({ length: 10 }, (_, i) => visual(i)),
    semanticRows: Array.from({ length: 10 }, (_, i) => semantic(i)),
    imagePathBySha256: new Map(
      Array.from({ length: 10 }, (_, i) => [`sha-${i}`, `C:\\tmp\\shot-${i}.png`] as const),
    ),
    freshSha256: new Set(["fresh-sha"]),
    cropOcr: mockProvider(),
    enOcrAvailable: true,
  });
  assert.deepEqual(
    first.candidates.map((c) => ({
      candidate: c.candidate,
      status: c.status,
      allPrimaryEvidencePresent: c.allPrimaryEvidencePresent,
      participantPairExactEvidencePresent: c.participantPairExactEvidencePresent,
      numericCellExactEvidenceCount: c.numericCellExactEvidenceCount,
      numericReconstructedExactCellCount: c.numericReconstructedExactCellCount,
    })),
    second.candidates.map((c) => ({
      candidate: c.candidate,
      status: c.status,
      allPrimaryEvidencePresent: c.allPrimaryEvidencePresent,
      participantPairExactEvidencePresent: c.participantPairExactEvidencePresent,
      numericCellExactEvidenceCount: c.numericCellExactEvidenceCount,
      numericReconstructedExactCellCount: c.numericReconstructedExactCellCount,
    })),
  );
  assert.equal(first.networkUsed, false);
  assert.equal(first.parserUsed, false);
  assert.equal(first.holdoutRead, false);
  assert.equal(first.freshValidationRead, false);
  assert.equal(first.EN_OCR_AVAILABLE, true);
  const expandedKo = first.candidates.find(
    (c) => c.candidate === "REGION_CROP_EXPANDED_UPSCALE_3X_KO",
  )!;
  assert.equal(expandedKo.numericCellExactEvidenceCount >= 2, true);
  const enOnly = first.candidates.find((c) => c.candidate === "REGION_CROP_UPSCALE_3X_EN")!;
  assert.equal(enOnly.status, "OK");
  assert.equal(enOnly.participantRightExactEvidencePresent >= 1, true);
  assert.equal(enOnly.participantLeftExactEvidencePresent, 0);

  const closed = await runOcrRecoveryExperimentV2({
    protoRoundKey: "2026-105",
    pilotKeys: keys,
    truthRows: selected,
    visualRows: Array.from({ length: 10 }, (_, i) => visual(i)),
    semanticRows: Array.from({ length: 10 }, (_, i) => semantic(i)),
    imagePathBySha256: new Map(
      Array.from({ length: 10 }, (_, i) => [`sha-${i}`, `C:\\tmp\\shot-${i}.png`] as const),
    ),
    freshSha256: new Set(["fresh-sha"]),
    cropOcr: mockProvider(),
    enOcrAvailable: false,
  });
  assert.equal(closed.EN_OCR_AVAILABLE, false);
  assert.equal(
    closed.candidates.find((c) => c.candidate === "REGION_CROP_UPSCALE_3X_EN")?.status,
    "EN_OCR_UNAVAILABLE",
  );
  assert.equal(
    closed.candidates.find((c) => c.candidate === "REGION_CROP_EXPANDED_UPSCALE_3X_DUAL")
      ?.status,
    "EN_OCR_UNAVAILABLE",
  );
  assert.equal(closed.bestCandidate.includes("_EN") || closed.bestCandidate.includes("DUAL"), false);

  await assert.rejects(
    () =>
      runOcrRecoveryExperimentV2({
        protoRoundKey: "2026-105",
        pilotKeys: [{ sourceImageSha256: "fresh-sha", visualRowIndex: 0 }, ...keys.slice(1)],
        truthRows: [truth(0, { sourceImageSha256: "fresh-sha" }), ...selected.slice(1)],
        visualRows: [
          { ...visual(0), sourceImageSha256: "fresh-sha" },
          ...Array.from({ length: 9 }, (_, i) => visual(i + 1)),
        ],
        semanticRows: Array.from({ length: 10 }, (_, i) => semantic(i)),
        imagePathBySha256: new Map([["fresh-sha", "C:\\tmp\\fresh.png"]]),
        freshSha256: new Set(["fresh-sha"]),
        cropOcr: mockProvider(),
        enOcrAvailable: true,
      }),
    (err: unknown) =>
      err instanceof OcrRecoveryExperimentV2Error &&
      err.code === "FRESH_VALIDATION_OCR_FORBIDDEN",
  );

  assert.equal(
    ocrRecoveryV2Level(
      candidateScore("BASELINE_WHOLE_SCREEN", { allPrimaryEvidencePresent: 1 }),
    ),
    3,
  );
  assert.equal(
    ocrRecoveryV2Level(
      candidateScore("BASELINE_WHOLE_SCREEN", { participantPairExactEvidencePresent: 1 }),
    ),
    2,
  );
  assert.equal(
    ocrRecoveryV2Level(
      candidateScore("BASELINE_WHOLE_SCREEN", { numericCellExactEvidenceCount: 4 }),
    ),
    1,
  );
  assert.equal(ocrRecoveryV2Level(candidateScore("BASELINE_WHOLE_SCREEN", {})), 0);

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
    assert.equal(src.includes("https://"), false, abs);
    assert.equal(src.includes("http://"), false, abs);
  }

  console.log("test:proto-round-ocr-recovery-experiment-v2 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
