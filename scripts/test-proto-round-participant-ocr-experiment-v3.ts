/**
 * Isolated participant OCR experiment v3 tests.
 * Deterministic mock OCR. No real engine. No Holdout. No Fresh pixels.
 * Network: 0.
 *
 *   npm run test:proto-round-participant-ocr-experiment-v3
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  CANDIDATE_SIMPLICITY_RANK_V3,
  MAXIMUM_EXPERIMENT_VARIANTS,
  OCR_INTERPOLATION,
  PARTICIPANT_OCR_V3_CANDIDATES,
  PILOT_COUNT,
  ParticipantOcrExperimentV3Error,
  assertPilot10Keys,
  createWindowsCropOcrProviderV3,
  exactEvidencePresentAny,
  exclusiveTextBearingCropBoxes,
  expandBox,
  expandedVisualRowCropBox,
  isExclusiveTextBearingRaw,
  participantOcrV3Level,
  runParticipantOcrExperimentV3,
  scoreRowEvidenceV3,
  selectBestParticipantOcrCandidateV3,
  selectPilot10Truth,
  unionIndependentEvidence,
  visualRowCropBox,
  type CandidatePilotScoreV3,
  type CropOcrProviderV3,
  type CropOcrRequestV3,
  type FrozenIdentityV3,
  type PilotTruthV3,
  type SemanticRegionGeometryV3,
  type VisualRowGeometryV3,
} from "../src/lib/proto-round-participant-ocr-experiment-v3";

function ident(n: number): FrozenIdentityV3 {
  return { sourceImageSha256: `sha-${n}`, visualRowIndex: n };
}

function truth(n: number, extra?: Partial<PilotTruthV3>): PilotTruthV3 {
  return {
    ...ident(n),
    annotationStatus: "COMPLETE",
    participantLeftRaw: `left-${n}`,
    participantRightRaw: `right-${n}`,
    numericCellsRaw: ["1.91", "1.63"],
    ...extra,
  };
}

function visual(n: number): VisualRowGeometryV3 {
  return {
    ...ident(n),
    sourceFileName: `shot-${n}.png`,
    topY: 10 + n * 20,
    bottomY: 24 + n * 20,
    imageWidth: 800,
    imageHeight: 400,
  };
}

function semantic(n: number): SemanticRegionGeometryV3 {
  const y = 10 + n * 20;
  return {
    ...ident(n),
    regions: [
      {
        rawEvidenceTags: ["TEXT_BEARING_RAW"],
        fragments: [{ x: 40, y, width: 80, height: 14 }],
      },
      {
        rawEvidenceTags: ["TEXT_BEARING_RAW"],
        fragments: [{ x: 200, y, width: 80, height: 14 }],
      },
      {
        rawEvidenceTags: ["TEXT_BEARING_RAW", "NUMERIC_LIKE_RAW"],
        fragments: [{ x: 400, y, width: 40, height: 14 }],
      },
      {
        rawEvidenceTags: ["NUMERIC_LIKE_RAW"],
        fragments: [{ x: 500, y, width: 40, height: 14 }],
      },
    ],
  };
}

function tenKeys(): FrozenIdentityV3[] {
  return Array.from({ length: 10 }, (_, i) => ident(i));
}

type RecordedCrop = CropOcrRequestV3;

function mockProvider(calls: RecordedCrop[]): CropOcrProviderV3 {
  return {
    async extractCrop(request) {
      calls.push({
        imagePath: request.imagePath,
        crop: { ...request.crop },
        scale: request.scale,
      });
      const match = request.imagePath.match(/shot-(\d+)\.png$/);
      const n = match ? Number(match[1]) : 0;
      if (request.scale === 3) {
        return { rawText: `left-${n} 1.91`, rawLines: [] };
      }
      if (request.scale === 4) {
        return { rawText: `left-${n} right-${n} 1.91 1.63`, rawLines: [] };
      }
      if (request.scale === 5) {
        return { rawText: `right-${n} 1.63`, rawLines: [] };
      }
      throw new Error(`UNEXPECTED_SCALE:${String(request.scale)}`);
    },
  };
}

function sourceFiles(): string[] {
  const lib = path.join(
    process.cwd(),
    "src/lib/proto-round-participant-ocr-experiment-v3",
  );
  return [
    ...readdirSync(lib)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/run-proto-round-participant-ocr-experiment-v3.ts"),
  ];
}

function candidateScore(
  name: CandidatePilotScoreV3["candidate"],
  extra: Partial<CandidatePilotScoreV3>,
): CandidatePilotScoreV3 {
  return {
    candidate: name,
    participantLeftExactEvidencePresent: 0,
    participantRightExactEvidencePresent: 0,
    participantPairExactEvidencePresent: 0,
    participantExactSlotCount: 0,
    numericCellExactEvidenceCount: 0,
    numericCellTotalTruthCount: 20,
    numericCellsAllExactEvidencePresent: 0,
    rows: [],
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

async function main() {
  assert.equal(PILOT_COUNT, 10);
  assert.equal(PARTICIPANT_OCR_V3_CANDIDATES.length, 6);
  assert.equal(PARTICIPANT_OCR_V3_CANDIDATES.length <= MAXIMUM_EXPERIMENT_VARIANTS, true);
  assert.equal(OCR_INTERPOLATION, "Linear");
  assert.equal(CANDIDATE_SIMPLICITY_RANK_V3.V2_ROW_CROP_UPSCALE_3X_KO, 0);
  assert.equal(CANDIDATE_SIMPLICITY_RANK_V3.ROW_PLUS_TEXT_REGION_EVIDENCE_UNION, 5);

  const rowBox = visualRowCropBox({
    topY: 10.2,
    bottomY: 24.8,
    imageWidth: 800,
    imageHeight: 400,
  });
  assert.deepEqual(rowBox, { x: 0, y: 10, width: 800, height: 15 });

  const pad50 = expandedVisualRowCropBox({
    topY: 10,
    bottomY: 24,
    imageWidth: 800,
    imageHeight: 400,
    verticalPaddingRatio: 0.5,
  });
  assert.deepEqual(pad50, { x: 0, y: 3, width: 800, height: 28 });

  const pad100 = expandedVisualRowCropBox({
    topY: 10,
    bottomY: 24,
    imageWidth: 800,
    imageHeight: 400,
    verticalPaddingRatio: 1,
  });
  assert.deepEqual(pad100, { x: 0, y: 0, width: 800, height: 38 });

  const clampedBottom = expandedVisualRowCropBox({
    topY: 390,
    bottomY: 400,
    imageWidth: 800,
    imageHeight: 400,
    verticalPaddingRatio: 1,
  });
  assert.deepEqual(clampedBottom, { x: 0, y: 380, width: 800, height: 20 });

  const native = { x: 40, y: 10, width: 80, height: 14 };
  const expand40 = expandBox({
    box: native,
    horizontalPaddingRatio: 0.4,
    verticalPaddingRatio: 1,
    imageWidth: 800,
    imageHeight: 400,
  });
  assert.deepEqual(expand40, { x: 8, y: 0, width: 144, height: 38 });

  const expand80 = expandBox({
    box: native,
    horizontalPaddingRatio: 0.8,
    verticalPaddingRatio: 1,
    imageWidth: 800,
    imageHeight: 400,
  });
  assert.deepEqual(expand80, { x: 0, y: 0, width: 184, height: 38 });

  assert.equal(isExclusiveTextBearingRaw(["TEXT_BEARING_RAW"]), true);
  assert.equal(
    isExclusiveTextBearingRaw(["TEXT_BEARING_RAW", "NUMERIC_LIKE_RAW"]),
    false,
  );

  const exclusive = exclusiveTextBearingCropBoxes({
    imageWidth: 800,
    imageHeight: 400,
    horizontalPaddingRatio: 0.4,
    verticalPaddingRatio: 1,
    regions: semantic(0).regions,
  });
  assert.equal(exclusive.length, 2);
  assert.equal(
    exclusive.some((box) => box.x >= 380 && box.x <= 420),
    false,
  );

  const splitHangul = scoreRowEvidenceV3({
    participantLeftRaw: "left-token",
    participantRightRaw: "right-token",
    numericCellsRaw: ["1.91"],
    evidence: [
      { source: "V2_ROW_CROP_UPSCALE_3X_KO", text: "left" },
      { source: "TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO", text: "-token" },
    ],
  });
  assert.equal(splitHangul.leftExactEvidencePresent, false);
  assert.equal(exactEvidencePresentAny(["left", "-token"], "left-token"), false);

  const unionParts = unionIndependentEvidence(
    [{ source: "V2_ROW_CROP_UPSCALE_3X_KO", text: "left-0 1.91" }],
    [{ source: "TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO", text: "right-0 1.63" }],
  );
  assert.equal(unionParts.length, 2);
  assert.equal(unionParts.some((p) => p.text.includes("left-0 right-0")), false);
  const unionScore = scoreRowEvidenceV3({
    participantLeftRaw: "left-0",
    participantRightRaw: "right-0",
    numericCellsRaw: ["1.91", "1.63"],
    evidence: unionParts,
  });
  assert.equal(unionScore.participantPairExactEvidencePresent, true);
  assert.equal(unionScore.participantExactSlotCount, 2);

  assert.equal(participantOcrV3Level(0), 0);
  assert.equal(participantOcrV3Level(1), 1);
  assert.equal(participantOcrV3Level(3), 2);
  assert.equal(participantOcrV3Level(5), 3);

  assert.equal(
    selectBestParticipantOcrCandidateV3([
      candidateScore("V2_ROW_CROP_UPSCALE_3X_KO", {
        participantPairExactEvidencePresent: 0,
        participantExactSlotCount: 20,
      }),
      candidateScore("ROW_EXPANDED_VERTICAL_50_UPSCALE_4X_KO", {
        participantPairExactEvidencePresent: 1,
        participantExactSlotCount: 2,
      }),
    ]),
    "ROW_EXPANDED_VERTICAL_50_UPSCALE_4X_KO",
  );
  assert.equal(
    selectBestParticipantOcrCandidateV3([
      candidateScore("ROW_EXPANDED_VERTICAL_50_UPSCALE_4X_KO", {
        participantPairExactEvidencePresent: 1,
        participantExactSlotCount: 2,
      }),
      candidateScore("ROW_PLUS_TEXT_REGION_EVIDENCE_UNION", {
        participantPairExactEvidencePresent: 1,
        participantExactSlotCount: 4,
      }),
    ]),
    "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION",
  );
  assert.equal(
    selectBestParticipantOcrCandidateV3([
      candidateScore("TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO", {
        participantPairExactEvidencePresent: 1,
        participantExactSlotCount: 4,
        numericCellsAllExactEvidencePresent: 2,
      }),
      candidateScore("ROW_EXPANDED_VERTICAL_50_UPSCALE_4X_KO", {
        participantPairExactEvidencePresent: 1,
        participantExactSlotCount: 4,
        numericCellsAllExactEvidencePresent: 2,
      }),
    ]),
    "ROW_EXPANDED_VERTICAL_50_UPSCALE_4X_KO",
  );

  const keys = tenKeys();
  assert.deepEqual(assertPilot10Keys([...keys, ident(99)]), keys);
  const selected = selectPilot10Truth({
    discoveryRowKeys: [...keys, ident(99)],
    records: [...Array.from({ length: 10 }, (_, i) => truth(i)), truth(99)],
  });
  assert.equal(selected.length, 10);
  assert.equal(
    selected.some((r) => r.visualRowIndex === 99),
    false,
  );

  const firstCalls: RecordedCrop[] = [];
  const first = await runParticipantOcrExperimentV3({
    protoRoundKey: "2026-105",
    pilotKeys: keys,
    truthRows: selected,
    visualRows: Array.from({ length: 10 }, (_, i) => visual(i)),
    semanticRows: Array.from({ length: 10 }, (_, i) => semantic(i)),
    imagePathBySha256: new Map(
      Array.from({ length: 10 }, (_, i) => [`sha-${i}`, `C:\\tmp\\shot-${i}.png`] as const),
    ),
    freshSha256: new Set(["fresh-sha"]),
    cropOcr: mockProvider(firstCalls),
  });
  const secondCalls: RecordedCrop[] = [];
  const second = await runParticipantOcrExperimentV3({
    protoRoundKey: "2026-105",
    pilotKeys: keys,
    truthRows: selected,
    visualRows: Array.from({ length: 10 }, (_, i) => visual(i)),
    semanticRows: Array.from({ length: 10 }, (_, i) => semantic(i)),
    imagePathBySha256: new Map(
      Array.from({ length: 10 }, (_, i) => [`sha-${i}`, `C:\\tmp\\shot-${i}.png`] as const),
    ),
    freshSha256: new Set(["fresh-sha"]),
    cropOcr: mockProvider(secondCalls),
  });
  assert.deepEqual(
    first.candidates.map((c) => ({
      candidate: c.candidate,
      participantPairExactEvidencePresent: c.participantPairExactEvidencePresent,
      participantExactSlotCount: c.participantExactSlotCount,
      numericCellExactEvidenceCount: c.numericCellExactEvidenceCount,
      numericCellsAllExactEvidencePresent: c.numericCellsAllExactEvidencePresent,
    })),
    second.candidates.map((c) => ({
      candidate: c.candidate,
      participantPairExactEvidencePresent: c.participantPairExactEvidencePresent,
      participantExactSlotCount: c.participantExactSlotCount,
      numericCellExactEvidenceCount: c.numericCellExactEvidenceCount,
      numericCellsAllExactEvidencePresent: c.numericCellsAllExactEvidencePresent,
    })),
  );
  assert.deepEqual(firstCalls, secondCalls);
  assert.equal(firstCalls.some((c) => c.scale === 4), true);
  assert.equal(firstCalls.some((c) => c.scale === 5), true);
  assert.equal(
    firstCalls.every((c) => c.scale === 3 || c.scale === 4 || c.scale === 5),
    true,
  );
  assert.equal(
    firstCalls.some((c) => c.imagePath.includes("fresh")),
    false,
  );
  const scale4 = firstCalls.filter((c) => c.scale === 4);
  const scale5 = firstCalls.filter((c) => c.scale === 5);
  assert.equal(scale4.length > 0, true);
  assert.equal(scale5.length > 0, true);
  assert.deepEqual(
    scale4.map((c) => c.crop),
    secondCalls.filter((c) => c.scale === 4).map((c) => c.crop),
  );
  assert.deepEqual(
    scale5.map((c) => c.crop),
    secondCalls.filter((c) => c.scale === 5).map((c) => c.crop),
  );

  const unionCandidate = first.candidates.find(
    (c) => c.candidate === "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION",
  )!;
  const rowCand = first.candidates.find((c) => c.candidate === "V2_ROW_CROP_UPSCALE_3X_KO")!;
  const text5 = first.candidates.find(
    (c) => c.candidate === "TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO",
  )!;
  assert.equal(rowCand.participantLeftExactEvidencePresent, 10);
  assert.equal(rowCand.participantRightExactEvidencePresent, 0);
  assert.equal(rowCand.participantPairExactEvidencePresent, 0);
  assert.equal(text5.participantRightExactEvidencePresent, 10);
  assert.equal(unionCandidate.participantPairExactEvidencePresent, 10);
  assert.equal(unionCandidate.participantExactSlotCount, 20);

  assert.equal(firstCalls.filter((c) => c.scale === 3).length, 10);
  assert.equal(firstCalls.filter((c) => c.scale === 4).length, 30);
  assert.equal(firstCalls.filter((c) => c.scale === 5).length, 30);
  assert.equal(firstCalls.length, 70);

  assert.equal(first.networkUsed, false);
  assert.equal(first.parserUsed, false);
  assert.equal(first.holdoutRead, false);
  assert.equal(first.freshValidationRead, false);
  assert.equal(first.interpolation, "Linear");

  const geometryCalls: RecordedCrop[] = [];
  await runParticipantOcrExperimentV3({
    protoRoundKey: "2026-105",
    pilotKeys: keys,
    truthRows: selected.map((row, i) =>
      truth(i, {
        participantLeftRaw: `other-left-${i}`,
        participantRightRaw: `other-right-${i}`,
      }),
    ),
    visualRows: Array.from({ length: 10 }, (_, i) => visual(i)),
    semanticRows: Array.from({ length: 10 }, (_, i) => semantic(i)),
    imagePathBySha256: new Map(
      Array.from({ length: 10 }, (_, i) => [`sha-${i}`, `C:\\tmp\\shot-${i}.png`] as const),
    ),
    freshSha256: new Set(["fresh-sha"]),
    cropOcr: mockProvider(geometryCalls),
  });
  assert.deepEqual(
    geometryCalls.map((c) => c.crop),
    firstCalls.map((c) => c.crop),
  );

  await assert.rejects(
    () =>
      runParticipantOcrExperimentV3({
        protoRoundKey: "2026-105",
        pilotKeys: [
          { sourceImageSha256: "fresh-sha", visualRowIndex: 0 },
          ...keys.slice(1),
        ],
        truthRows: [truth(0, { sourceImageSha256: "fresh-sha" }), ...selected.slice(1)],
        visualRows: [
          { ...visual(0), sourceImageSha256: "fresh-sha" },
          ...Array.from({ length: 9 }, (_, i) => visual(i + 1)),
        ],
        semanticRows: Array.from({ length: 10 }, (_, i) => semantic(i)),
        imagePathBySha256: new Map([["fresh-sha", "C:\\tmp\\fresh.png"]]),
        freshSha256: new Set(["fresh-sha"]),
        cropOcr: mockProvider([]),
      }),
    (err: unknown) =>
      err instanceof ParticipantOcrExperimentV3Error &&
      err.code === "FRESH_VALIDATION_OCR_FORBIDDEN",
  );

  const realProvider = createWindowsCropOcrProviderV3();
  await assert.rejects(
    () =>
      realProvider.extractCrop({
        imagePath: "C:\\tmp\\shot.png",
        crop: { x: 0, y: 0, width: 8, height: 8 },
        scale: 6 as CropOcrRequestV3["scale"],
      }),
    (err: unknown) =>
      err instanceof ParticipantOcrExperimentV3Error && err.code === "INVALID_CROP_SCALE",
  );
  await assert.rejects(
    () =>
      realProvider.extractCrop({
        imagePath: "C:\\tmp\\shot.png",
        crop: { x: 0, y: 0, width: 8, height: 8 },
        scale: 2 as CropOcrRequestV3["scale"],
      }),
    (err: unknown) =>
      err instanceof ParticipantOcrExperimentV3Error && err.code === "INVALID_CROP_SCALE",
  );

  assert.equal(gitDiffExitCode("data/research"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-raw-ocr-v0"), 0);
  assert.equal(
    gitDiffExitCode("src/lib/proto-round-structured-extraction-v0/parser.ts"),
    0,
  );
  assert.equal(gitDiffExitCode("src/lib/proto-round-ocr-recovery-experiment-v1"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-ocr-recovery-experiment-v2"), 0);

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("holdoutRowKeys"), false, abs);
    assert.equal(src.includes("holdout-seal"), false, abs);
    assert.equal(src.includes("fetch("), false, abs);
    assert.equal(src.includes("postgame"), false, abs);
    assert.equal(src.includes("parseStructuredRowV0"), false, abs);
    assert.equal(src.includes("proto-round-structured-extraction-v0/parser"), false, abs);
    assert.equal(src.includes("levenshtein"), false, abs);
    assert.equal(src.includes("fuzzy"), false, abs);
    assert.equal(src.includes("C시포로"), false, abs);
    assert.equal(src.includes("C삿포로"), false, abs);
    assert.equal(src.includes("도지기시"), false, abs);
    assert.equal(src.includes("도치기시"), false, abs);
    assert.equal(src.includes("님이와라"), false, abs);
    assert.equal(src.includes("J이와타"), false, abs);
    assert.equal(src.includes("https://"), false, abs);
    assert.equal(src.includes("http://"), false, abs);
    assert.equal(src.includes("participantDictionary"), false, abs);
    assert.equal(src.includes("teamReplacement"), false, abs);
  }

  console.log("test:proto-round-participant-ocr-experiment-v3 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
