import { joinRawEvidence, scoreRowEvidenceV3, unionIndependentEvidence } from "./evidence";
import {
  exclusiveTextBearingCropBoxes,
  expandedVisualRowCropBox,
  visualRowCropBox,
} from "./geometry";
import {
  assertShaNotFresh,
  identityKey,
  ParticipantOcrExperimentV3Error,
} from "./identity";
import {
  participantOcrV3Level,
  selectBestParticipantOcrCandidateV3,
} from "./select";
import {
  MAXIMUM_EXPERIMENT_VARIANTS,
  PARTICIPANT_OCR_EXPERIMENT_V3_SCHEMA_VERSION,
  PARTICIPANT_OCR_V3_CANDIDATES,
  PILOT_COUNT,
  type CandidatePilotScoreV3,
  type CropOcrProviderV3,
  type CropScaleV3,
  type FrozenIdentityV3,
  type IndependentEvidenceV3,
  type ParticipantOcrV3CandidateName,
  type PilotTruthV3,
  type PixelBoxV3,
  type SemanticRegionGeometryV3,
  type VisualRowGeometryV3,
} from "./types";

async function extractCropOrThrow(
  cropOcr: CropOcrProviderV3,
  request: { imagePath: string; crop: PixelBoxV3; scale: CropScaleV3 },
  candidate: ParticipantOcrV3CandidateName,
): Promise<{ rawText: string; rawLines: Array<{ text: string }> }> {
  try {
    return await cropOcr.extractCrop(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParticipantOcrExperimentV3Error(
      `CROP_OCR_FAILED:${candidate}:x=${request.crop.x},y=${request.crop.y},w=${request.crop.width},h=${request.crop.height},scale=${request.scale}:${msg}`,
    );
  }
}

async function ocrBoxes(input: {
  candidate: ParticipantOcrV3CandidateName;
  imagePath: string;
  boxes: PixelBoxV3[];
  scale: CropScaleV3;
  cropOcr: CropOcrProviderV3;
}): Promise<IndependentEvidenceV3[]> {
  const items: IndependentEvidenceV3[] = [];
  for (const crop of input.boxes) {
    const ocr = await extractCropOrThrow(
      input.cropOcr,
      { imagePath: input.imagePath, crop, scale: input.scale },
      input.candidate,
    );
    items.push({
      source: input.candidate,
      text: joinRawEvidence(ocr.rawText, ocr.rawLines),
    });
  }
  return items;
}

async function candidateEvidence(input: {
  candidate: ParticipantOcrV3CandidateName;
  visual: VisualRowGeometryV3;
  semantic: SemanticRegionGeometryV3 | undefined;
  imagePath: string;
  cropOcr: CropOcrProviderV3;
  reuse: Partial<Record<ParticipantOcrV3CandidateName, IndependentEvidenceV3[]>>;
}): Promise<IndependentEvidenceV3[]> {
  if (input.candidate === "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION") {
    return unionIndependentEvidence(
      input.reuse.V2_ROW_CROP_UPSCALE_3X_KO ?? [],
      input.reuse.TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO ?? [],
    );
  }
  if (input.candidate === "V2_ROW_CROP_UPSCALE_3X_KO") {
    const crop = visualRowCropBox(input.visual);
    if (!crop) return [];
    return ocrBoxes({
      candidate: input.candidate,
      imagePath: input.imagePath,
      boxes: [crop],
      scale: 3,
      cropOcr: input.cropOcr,
    });
  }
  if (input.candidate === "ROW_EXPANDED_VERTICAL_50_UPSCALE_4X_KO") {
    const crop = expandedVisualRowCropBox({
      ...input.visual,
      verticalPaddingRatio: 0.5,
    });
    if (!crop) return [];
    return ocrBoxes({
      candidate: input.candidate,
      imagePath: input.imagePath,
      boxes: [crop],
      scale: 4,
      cropOcr: input.cropOcr,
    });
  }
  if (input.candidate === "ROW_EXPANDED_VERTICAL_100_UPSCALE_5X_KO") {
    const crop = expandedVisualRowCropBox({
      ...input.visual,
      verticalPaddingRatio: 1,
    });
    if (!crop) return [];
    return ocrBoxes({
      candidate: input.candidate,
      imagePath: input.imagePath,
      boxes: [crop],
      scale: 5,
      cropOcr: input.cropOcr,
    });
  }
  const horizontal =
    input.candidate === "TEXT_REGIONS_EXPANDED_40_100_UPSCALE_4X_KO" ? 0.4 : 0.8;
  const scale: CropScaleV3 =
    input.candidate === "TEXT_REGIONS_EXPANDED_40_100_UPSCALE_4X_KO" ? 4 : 5;
  const boxes = exclusiveTextBearingCropBoxes({
    imageWidth: input.visual.imageWidth,
    imageHeight: input.visual.imageHeight,
    horizontalPaddingRatio: horizontal,
    verticalPaddingRatio: 1,
    regions: input.semantic?.regions ?? [],
  });
  return ocrBoxes({
    candidate: input.candidate,
    imagePath: input.imagePath,
    boxes,
    scale,
    cropOcr: input.cropOcr,
  });
}

export async function runParticipantOcrExperimentV3(input: {
  protoRoundKey: string;
  pilotKeys: FrozenIdentityV3[];
  truthRows: PilotTruthV3[];
  visualRows: VisualRowGeometryV3[];
  semanticRows: SemanticRegionGeometryV3[];
  imagePathBySha256: Map<string, string>;
  freshSha256: ReadonlySet<string>;
  cropOcr: CropOcrProviderV3;
}): Promise<{
  schemaVersion: typeof PARTICIPANT_OCR_EXPERIMENT_V3_SCHEMA_VERSION;
  protoRoundKey: string;
  pilotRows: typeof PILOT_COUNT;
  networkUsed: false;
  parserUsed: false;
  holdoutRead: false;
  freshValidationRead: false;
  interpolation: "Linear";
  candidates: CandidatePilotScoreV3[];
  bestCandidate: ParticipantOcrV3CandidateName;
  PARTICIPANT_OCR_V3_LEVEL: 0 | 1 | 2 | 3;
}> {
  if (input.pilotKeys.length !== PILOT_COUNT) {
    throw new ParticipantOcrExperimentV3Error(
      `PILOT_KEYS_UNEXPECTED:${input.pilotKeys.length}`,
    );
  }
  if (PARTICIPANT_OCR_V3_CANDIDATES.length > MAXIMUM_EXPERIMENT_VARIANTS) {
    throw new ParticipantOcrExperimentV3Error("TOO_MANY_EXPERIMENT_VARIANTS");
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

  const rowReuse: Array<
    Partial<Record<ParticipantOcrV3CandidateName, IndependentEvidenceV3[]>>
  > = Array.from({ length: PILOT_COUNT }, () => ({}));
  const candidates: CandidatePilotScoreV3[] = [];

  for (const candidate of PARTICIPANT_OCR_V3_CANDIDATES) {
    let participantLeftExactEvidencePresent = 0;
    let participantRightExactEvidencePresent = 0;
    let participantPairExactEvidencePresent = 0;
    let participantExactSlotCount = 0;
    let numericCellExactEvidenceCount = 0;
    let numericCellTotalTruthCount = 0;
    let numericCellsAllExactEvidencePresent = 0;
    const rows: CandidatePilotScoreV3["rows"] = [];

    for (let i = 0; i < PILOT_COUNT; i++) {
      const key = input.pilotKeys[i]!;
      assertShaNotFresh(key.sourceImageSha256, input.freshSha256);
      const id = identityKey(key.sourceImageSha256, key.visualRowIndex);
      const truth = truthById.get(id);
      const visual = visualById.get(id);
      if (!truth) {
        throw new ParticipantOcrExperimentV3Error(`PILOT_TRUTH_JOIN_FAILED:${i + 1}`);
      }
      if (!visual) {
        throw new ParticipantOcrExperimentV3Error(`PILOT_VISUAL_JOIN_FAILED:${i + 1}`);
      }
      if (
        truth.sourceImageSha256 !== key.sourceImageSha256 ||
        truth.visualRowIndex !== key.visualRowIndex ||
        visual.sourceImageSha256 !== key.sourceImageSha256 ||
        visual.visualRowIndex !== key.visualRowIndex
      ) {
        throw new ParticipantOcrExperimentV3Error(`PILOT_IDENTITY_MISMATCH:${i + 1}`);
      }
      const imagePath = input.imagePathBySha256.get(key.sourceImageSha256);
      if (!imagePath) {
        throw new ParticipantOcrExperimentV3Error(`PILOT_IMAGE_PATH_MISSING:${i + 1}`);
      }
      const evidence = await candidateEvidence({
        candidate,
        visual,
        semantic: semanticById.get(id),
        imagePath,
        cropOcr: input.cropOcr,
        reuse: rowReuse[i]!,
      });
      rowReuse[i]![candidate] = evidence;
      const score = scoreRowEvidenceV3({
        participantLeftRaw: truth.participantLeftRaw,
        participantRightRaw: truth.participantRightRaw,
        numericCellsRaw: truth.numericCellsRaw,
        evidence,
      });
      if (score.leftExactEvidencePresent) participantLeftExactEvidencePresent += 1;
      if (score.rightExactEvidencePresent) participantRightExactEvidencePresent += 1;
      if (score.participantPairExactEvidencePresent) {
        participantPairExactEvidencePresent += 1;
      }
      participantExactSlotCount += score.participantExactSlotCount;
      numericCellExactEvidenceCount += score.numericCellExactEvidenceCount;
      numericCellTotalTruthCount += score.numericCellTotalTruthCount;
      if (score.numericCellsAllExactEvidencePresent) {
        numericCellsAllExactEvidencePresent += 1;
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
      participantLeftExactEvidencePresent,
      participantRightExactEvidencePresent,
      participantPairExactEvidencePresent,
      participantExactSlotCount,
      numericCellExactEvidenceCount,
      numericCellTotalTruthCount,
      numericCellsAllExactEvidencePresent,
      rows,
    });
  }

  const bestCandidate = selectBestParticipantOcrCandidateV3(candidates);
  const best = candidates.find((c) => c.candidate === bestCandidate)!;
  return {
    schemaVersion: PARTICIPANT_OCR_EXPERIMENT_V3_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    pilotRows: PILOT_COUNT,
    networkUsed: false,
    parserUsed: false,
    holdoutRead: false,
    freshValidationRead: false,
    interpolation: "Linear",
    candidates,
    bestCandidate,
    PARTICIPANT_OCR_V3_LEVEL: participantOcrV3Level(
      best.participantPairExactEvidencePresent,
    ),
  };
}
