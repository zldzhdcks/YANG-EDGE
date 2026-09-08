import { joinRawEvidence, scoreRowEvidenceV2 } from "./evidence";
import {
  expandedSemanticRegionCropBoxes,
  semanticRegionCropBoxes,
  visualRowCropBox,
} from "./geometry";
import {
  assertShaNotFresh,
  identityKey,
  OcrRecoveryExperimentV2Error,
} from "./identity";
import { ocrRecoveryV2Level, selectBestOcrRecoveryCandidateV2 } from "./select";
import {
  CROP_UPSCALE,
  MAXIMUM_EXPERIMENT_VARIANTS,
  OCR_RECOVERY_EXPERIMENT_V2_SCHEMA_VERSION,
  OCR_RECOVERY_V2_CANDIDATES,
  PILOT_COUNT,
  type CandidatePilotScoreV2,
  type CandidateStatusV2,
  type CropOcrProviderV2,
  type FrozenIdentityV2,
  type IndependentEvidenceV2,
  type OcrLanguageTagV2,
  type OcrRecoveryV2CandidateName,
  type PilotTruthV2,
  type PixelBoxV2,
  type SemanticRegionGeometryV2,
  type VisualRowGeometryV2,
} from "./types";

function candidateNeedsEnglish(name: OcrRecoveryV2CandidateName): boolean {
  return (
    name === "REGION_CROP_UPSCALE_3X_EN" ||
    name === "REGION_CROP_EXPANDED_UPSCALE_3X_DUAL"
  );
}

function candidateLanguages(name: OcrRecoveryV2CandidateName): OcrLanguageTagV2[] {
  if (name === "REGION_CROP_UPSCALE_3X_EN") return ["en-US"];
  if (name === "REGION_CROP_EXPANDED_UPSCALE_3X_DUAL") return ["ko", "en-US"];
  return ["ko"];
}

function usesExpandedRegions(name: OcrRecoveryV2CandidateName): boolean {
  return (
    name === "REGION_CROP_EXPANDED_UPSCALE_3X_KO" ||
    name === "REGION_CROP_EXPANDED_UPSCALE_3X_DUAL"
  );
}

function usesRegionCrops(name: OcrRecoveryV2CandidateName): boolean {
  return (
    name === "REGION_CROP_UPSCALE_3X_KO" ||
    name === "REGION_CROP_EXPANDED_UPSCALE_3X_KO" ||
    name === "REGION_CROP_UPSCALE_3X_EN" ||
    name === "REGION_CROP_EXPANDED_UPSCALE_3X_DUAL"
  );
}

function baselineEvidence(row: VisualRowGeometryV2): IndependentEvidenceV2[] {
  const items: IndependentEvidenceV2[] = [];
  if (row.visualJoinedTextCandidate) {
    items.push({
      language: "ko",
      source: "BASELINE_FRAGMENT",
      text: row.visualJoinedTextCandidate,
    });
  }
  for (const frag of row.fragments) {
    items.push({
      language: "ko",
      source: "BASELINE_FRAGMENT",
      text: frag.rawText,
    });
  }
  return items;
}

async function extractCropOrThrow(
  cropOcr: CropOcrProviderV2,
  request: {
    imagePath: string;
    crop: PixelBoxV2;
    scale: 1 | 2 | 3;
    language: OcrLanguageTagV2;
  },
  candidate: OcrRecoveryV2CandidateName,
): Promise<{ rawText: string; rawLines: Array<{ text: string }> }> {
  try {
    return await cropOcr.extractCrop(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new OcrRecoveryExperimentV2Error(
      `CROP_OCR_FAILED:${candidate}:${request.language}:x=${request.crop.x},y=${request.crop.y},w=${request.crop.width},h=${request.crop.height}:${msg}`,
    );
  }
}

async function candidateEvidence(input: {
  candidate: OcrRecoveryV2CandidateName;
  visual: VisualRowGeometryV2;
  semantic: SemanticRegionGeometryV2 | undefined;
  imagePath: string;
  cropOcr: CropOcrProviderV2;
}): Promise<IndependentEvidenceV2[]> {
  if (input.candidate === "BASELINE_WHOLE_SCREEN") {
    return baselineEvidence(input.visual);
  }
  const languages = candidateLanguages(input.candidate);
  const items: IndependentEvidenceV2[] = [];
  if (usesRegionCrops(input.candidate)) {
    const boxes = usesExpandedRegions(input.candidate)
      ? expandedSemanticRegionCropBoxes({
          imageWidth: input.visual.imageWidth,
          imageHeight: input.visual.imageHeight,
          regions: input.semantic?.regions ?? [],
        })
      : semanticRegionCropBoxes({
          imageWidth: input.visual.imageWidth,
          imageHeight: input.visual.imageHeight,
          regions: input.semantic?.regions ?? [],
        });
    for (const language of languages) {
      for (const crop of boxes) {
        const ocr = await extractCropOrThrow(
          input.cropOcr,
          {
            imagePath: input.imagePath,
            crop,
            scale: CROP_UPSCALE,
            language,
          },
          input.candidate,
        );
        items.push({
          language,
          source: "REGION_CROP",
          text: joinRawEvidence(ocr.rawText, ocr.rawLines),
        });
      }
    }
    return items;
  }
  const crop = visualRowCropBox({
    topY: input.visual.topY,
    bottomY: input.visual.bottomY,
    imageWidth: input.visual.imageWidth,
    imageHeight: input.visual.imageHeight,
  });
  if (!crop) return items;
  for (const language of languages) {
    const ocr = await extractCropOrThrow(
      input.cropOcr,
      {
        imagePath: input.imagePath,
        crop,
        scale: CROP_UPSCALE,
        language,
      },
      input.candidate,
    );
    items.push({
      language,
      source: "ROW_CROP",
      text: joinRawEvidence(ocr.rawText, ocr.rawLines),
    });
  }
  return items;
}

function emptyCandidate(
  candidate: OcrRecoveryV2CandidateName,
  status: CandidateStatusV2,
): CandidatePilotScoreV2 {
  return {
    candidate,
    status,
    participantLeftExactEvidencePresent: 0,
    participantRightExactEvidencePresent: 0,
    numericCellExactEvidenceCount: 0,
    numericCellTotalTruthCount: 0,
    numericCellsAllExactEvidencePresent: 0,
    participantPairExactEvidencePresent: 0,
    allPrimaryEvidencePresent: 0,
    numericReconstructedExactCellCount: 0,
    numericCellsAllExactAfterSafeReconstruction: 0,
    rows: [],
  };
}

export async function runOcrRecoveryExperimentV2(input: {
  protoRoundKey: string;
  pilotKeys: FrozenIdentityV2[];
  truthRows: PilotTruthV2[];
  visualRows: VisualRowGeometryV2[];
  semanticRows: SemanticRegionGeometryV2[];
  imagePathBySha256: Map<string, string>;
  freshSha256: ReadonlySet<string>;
  cropOcr: CropOcrProviderV2;
  enOcrAvailable: boolean;
}): Promise<{
  schemaVersion: typeof OCR_RECOVERY_EXPERIMENT_V2_SCHEMA_VERSION;
  protoRoundKey: string;
  pilotRows: typeof PILOT_COUNT;
  networkUsed: false;
  parserUsed: false;
  holdoutRead: false;
  freshValidationRead: false;
  EN_OCR_AVAILABLE: boolean;
  candidates: CandidatePilotScoreV2[];
  bestCandidate: OcrRecoveryV2CandidateName;
  OCR_RECOVERY_V2_LEVEL: 0 | 1 | 2 | 3;
}> {
  if (input.pilotKeys.length !== PILOT_COUNT) {
    throw new OcrRecoveryExperimentV2Error(
      `PILOT_KEYS_UNEXPECTED:${input.pilotKeys.length}`,
    );
  }
  if (OCR_RECOVERY_V2_CANDIDATES.length > MAXIMUM_EXPERIMENT_VARIANTS) {
    throw new OcrRecoveryExperimentV2Error("TOO_MANY_EXPERIMENT_VARIANTS");
  }

  const truthById = new Map(
    input.truthRows.map((r) => [
      identityKey(r.sourceImageSha256, r.visualRowIndex),
      r,
    ]),
  );
  const visualById = new Map(
    input.visualRows.map((r) => [
      identityKey(r.sourceImageSha256, r.visualRowIndex),
      r,
    ]),
  );
  const semanticById = new Map(
    input.semanticRows.map((r) => [
      identityKey(r.sourceImageSha256, r.visualRowIndex),
      r,
    ]),
  );

  const candidates: CandidatePilotScoreV2[] = [];

  for (const candidate of OCR_RECOVERY_V2_CANDIDATES) {
    if (candidateNeedsEnglish(candidate) && !input.enOcrAvailable) {
      candidates.push(emptyCandidate(candidate, "EN_OCR_UNAVAILABLE"));
      continue;
    }

    let participantLeftExactEvidencePresent = 0;
    let participantRightExactEvidencePresent = 0;
    let numericCellExactEvidenceCount = 0;
    let numericCellTotalTruthCount = 0;
    let numericCellsAllExactEvidencePresent = 0;
    let participantPairExactEvidencePresent = 0;
    let allPrimaryEvidencePresent = 0;
    let numericReconstructedExactCellCount = 0;
    let numericCellsAllExactAfterSafeReconstruction = 0;
    const rows: CandidatePilotScoreV2["rows"] = [];

    for (let i = 0; i < PILOT_COUNT; i++) {
      const key = input.pilotKeys[i]!;
      assertShaNotFresh(key.sourceImageSha256, input.freshSha256);
      const id = identityKey(key.sourceImageSha256, key.visualRowIndex);
      const truth = truthById.get(id);
      const visual = visualById.get(id);
      if (!truth) {
        throw new OcrRecoveryExperimentV2Error(`PILOT_TRUTH_JOIN_FAILED:${i + 1}`);
      }
      if (!visual) {
        throw new OcrRecoveryExperimentV2Error(`PILOT_VISUAL_JOIN_FAILED:${i + 1}`);
      }
      if (
        truth.sourceImageSha256 !== key.sourceImageSha256 ||
        truth.visualRowIndex !== key.visualRowIndex ||
        visual.sourceImageSha256 !== key.sourceImageSha256 ||
        visual.visualRowIndex !== key.visualRowIndex
      ) {
        throw new OcrRecoveryExperimentV2Error(`PILOT_IDENTITY_MISMATCH:${i + 1}`);
      }
      const imagePath = input.imagePathBySha256.get(key.sourceImageSha256);
      if (!imagePath) {
        throw new OcrRecoveryExperimentV2Error(`PILOT_IMAGE_PATH_MISSING:${i + 1}`);
      }
      const evidence = await candidateEvidence({
        candidate,
        visual,
        semantic: semanticById.get(id),
        imagePath,
        cropOcr: input.cropOcr,
      });
      const score = scoreRowEvidenceV2({
        participantLeftRaw: truth.participantLeftRaw,
        participantRightRaw: truth.participantRightRaw,
        numericCellsRaw: truth.numericCellsRaw,
        evidence,
      });
      if (score.participantLeftExactEvidencePresent) {
        participantLeftExactEvidencePresent += 1;
      }
      if (score.participantRightExactEvidencePresent) {
        participantRightExactEvidencePresent += 1;
      }
      numericCellExactEvidenceCount += score.numericCellExactEvidenceCount;
      numericCellTotalTruthCount += score.numericCellTotalTruthCount;
      if (score.numericCellsAllExactEvidencePresent) {
        numericCellsAllExactEvidencePresent += 1;
      }
      if (score.participantPairExactEvidencePresent) {
        participantPairExactEvidencePresent += 1;
      }
      if (score.allPrimaryEvidencePresent) {
        allPrimaryEvidencePresent += 1;
      }
      numericReconstructedExactCellCount += score.numericReconstructedExactCellCount;
      if (score.numericCellsAllExactAfterSafeReconstruction) {
        numericCellsAllExactAfterSafeReconstruction += 1;
      }
      rows.push({
        pilotIndex: i + 1,
        sourceImageSha256: key.sourceImageSha256,
        visualRowIndex: key.visualRowIndex,
        ...score,
      });
    }

    candidates.push({
      candidate,
      status: "OK",
      participantLeftExactEvidencePresent,
      participantRightExactEvidencePresent,
      numericCellExactEvidenceCount,
      numericCellTotalTruthCount,
      numericCellsAllExactEvidencePresent,
      participantPairExactEvidencePresent,
      allPrimaryEvidencePresent,
      numericReconstructedExactCellCount,
      numericCellsAllExactAfterSafeReconstruction,
      rows,
    });
  }

  const bestCandidate = selectBestOcrRecoveryCandidateV2(candidates);
  const best = candidates.find((c) => c.candidate === bestCandidate)!;
  return {
    schemaVersion: OCR_RECOVERY_EXPERIMENT_V2_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    pilotRows: PILOT_COUNT,
    networkUsed: false,
    parserUsed: false,
    holdoutRead: false,
    freshValidationRead: false,
    EN_OCR_AVAILABLE: input.enOcrAvailable,
    candidates,
    bestCandidate,
    OCR_RECOVERY_V2_LEVEL: ocrRecoveryV2Level(best),
  };
}
