import { joinRawEvidence, scoreRowEvidence } from "./evidence";
import { semanticRegionCropBoxes, visualRowCropBox } from "./geometry";
import {
  assertShaNotFresh,
  identityKey,
  OcrRecoveryExperimentError,
} from "./identity";
import { selectBestOcrRecoveryCandidate } from "./select";
import {
  accumulateNumericTaxonomy,
  accumulateParticipantTaxonomy,
  emptyNumericTaxonomy,
  emptyParticipantTaxonomy,
} from "./taxonomy";
import {
  MAXIMUM_EXPERIMENT_VARIANTS,
  OCR_RECOVERY_CANDIDATES,
  OCR_RECOVERY_EXPERIMENT_SCHEMA_VERSION,
  PILOT_COUNT,
  type CandidatePilotScoreV1,
  type CropOcrProviderV1,
  type FrozenIdentityV1,
  type OcrRecoveryCandidateName,
  type PilotTruthV1,
  type SemanticRegionGeometryV1,
  type VisualRowGeometryV1,
} from "./types";

function candidateScale(name: OcrRecoveryCandidateName): 1 | 2 | 3 {
  if (name === "ROW_CROP_UPSCALE_2X") return 2;
  if (name === "ROW_CROP_UPSCALE_3X") return 3;
  return 1;
}

function candidateGrayscale(name: OcrRecoveryCandidateName): boolean {
  return name === "ROW_CROP_GRAYSCALE_NATIVE";
}

function baselineEvidence(row: VisualRowGeometryV1): string {
  return joinRawEvidence(
    row.visualJoinedTextCandidate,
    row.fragments.map((f) => ({ text: f.rawText })),
  );
}

async function extractCropOrEmpty(
  cropOcr: CropOcrProviderV1,
  request: {
    imagePath: string;
    crop: { x: number; y: number; width: number; height: number };
    scale: 1 | 2 | 3;
    grayscale: boolean;
  },
  candidate: OcrRecoveryCandidateName,
): Promise<{ rawText: string; rawLines: Array<{ text: string }> }> {
  try {
    return await cropOcr.extractCrop(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new OcrRecoveryExperimentError(
      `CROP_OCR_FAILED:${candidate}:x=${request.crop.x},y=${request.crop.y},w=${request.crop.width},h=${request.crop.height},scale=${request.scale},gray=${request.grayscale}:${msg}`,
    );
  }
}

async function candidateEvidence(input: {
  candidate: OcrRecoveryCandidateName;
  visual: VisualRowGeometryV1;
  semantic: SemanticRegionGeometryV1 | undefined;
  imagePath: string;
  cropOcr: CropOcrProviderV1;
}): Promise<string> {
  if (input.candidate === "BASELINE_WHOLE_SCREEN") {
    return baselineEvidence(input.visual);
  }
  if (input.candidate === "REGION_CROP_NATIVE") {
    const boxes = semanticRegionCropBoxes({
      imageWidth: input.visual.imageWidth,
      imageHeight: input.visual.imageHeight,
      regions: input.semantic?.regions ?? [],
    });
    const parts: string[] = [];
    for (const crop of boxes) {
      const ocr = await extractCropOrEmpty(input.cropOcr, {
        imagePath: input.imagePath,
        crop,
        scale: 1,
        grayscale: false,
      }, input.candidate);
      parts.push(joinRawEvidence(ocr.rawText, ocr.rawLines));
    }
    return parts.join("\n");
  }
  const crop = visualRowCropBox({
    topY: input.visual.topY,
    bottomY: input.visual.bottomY,
    imageWidth: input.visual.imageWidth,
    imageHeight: input.visual.imageHeight,
  });
  if (!crop) return "";
  const ocr = await extractCropOrEmpty(
    input.cropOcr,
    {
      imagePath: input.imagePath,
      crop,
      scale: candidateScale(input.candidate),
      grayscale: candidateGrayscale(input.candidate),
    },
    input.candidate,
  );
  return joinRawEvidence(ocr.rawText, ocr.rawLines);
}

export async function runOcrRecoveryExperimentV1(input: {
  protoRoundKey: string;
  pilotKeys: FrozenIdentityV1[];
  truthRows: PilotTruthV1[];
  visualRows: VisualRowGeometryV1[];
  semanticRows: SemanticRegionGeometryV1[];
  imagePathBySha256: Map<string, string>;
  freshSha256: ReadonlySet<string>;
  cropOcr: CropOcrProviderV1;
}): Promise<{
  schemaVersion: typeof OCR_RECOVERY_EXPERIMENT_SCHEMA_VERSION;
  protoRoundKey: string;
  pilotRows: typeof PILOT_COUNT;
  networkUsed: false;
  parserUsed: false;
  holdoutRead: false;
  freshValidationReadForRuleDesign: false;
  candidates: CandidatePilotScoreV1[];
  bestCandidate: OcrRecoveryCandidateName;
  taxonomyByCandidate: Record<
    OcrRecoveryCandidateName,
    {
      numeric: ReturnType<typeof emptyNumericTaxonomy>;
      participant: ReturnType<typeof emptyParticipantTaxonomy>;
    }
  >;
}> {
  if (input.pilotKeys.length !== PILOT_COUNT) {
    throw new OcrRecoveryExperimentError(
      `PILOT_KEYS_UNEXPECTED:${input.pilotKeys.length}`,
    );
  }
  if (OCR_RECOVERY_CANDIDATES.length > MAXIMUM_EXPERIMENT_VARIANTS) {
    throw new OcrRecoveryExperimentError("TOO_MANY_EXPERIMENT_VARIANTS");
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

  const candidates: CandidatePilotScoreV1[] = [];
  const taxonomyByCandidate = {} as Record<
    OcrRecoveryCandidateName,
    {
      numeric: ReturnType<typeof emptyNumericTaxonomy>;
      participant: ReturnType<typeof emptyParticipantTaxonomy>;
    }
  >;

  for (const candidate of OCR_RECOVERY_CANDIDATES) {
    const numeric = emptyNumericTaxonomy();
    const participant = emptyParticipantTaxonomy();
    let participantLeftExactEvidencePresent = 0;
    let participantRightExactEvidencePresent = 0;
    let numericCellExactEvidenceCount = 0;
    let numericCellTotalTruthCount = 0;
    let numericCellsAllExactEvidencePresent = 0;
    let participantPairExactEvidencePresent = 0;
    let allPrimaryEvidencePresent = 0;
    const rows: CandidatePilotScoreV1["rows"] = [];

    for (let i = 0; i < PILOT_COUNT; i++) {
      const key = input.pilotKeys[i]!;
      assertShaNotFresh(key.sourceImageSha256, input.freshSha256);
      const id = identityKey(key.sourceImageSha256, key.visualRowIndex);
      const truth = truthById.get(id);
      const visual = visualById.get(id);
      if (!truth) {
        throw new OcrRecoveryExperimentError(`PILOT_TRUTH_JOIN_FAILED:${i + 1}`);
      }
      if (!visual) {
        throw new OcrRecoveryExperimentError(`PILOT_VISUAL_JOIN_FAILED:${i + 1}`);
      }
      if (
        truth.sourceImageSha256 !== key.sourceImageSha256 ||
        truth.visualRowIndex !== key.visualRowIndex ||
        visual.sourceImageSha256 !== key.sourceImageSha256 ||
        visual.visualRowIndex !== key.visualRowIndex
      ) {
        throw new OcrRecoveryExperimentError(`PILOT_IDENTITY_MISMATCH:${i + 1}`);
      }
      const imagePath = input.imagePathBySha256.get(key.sourceImageSha256);
      if (!imagePath) {
        throw new OcrRecoveryExperimentError(`PILOT_IMAGE_PATH_MISSING:${i + 1}`);
      }
      const evidence = await candidateEvidence({
        candidate,
        visual,
        semantic: semanticById.get(id),
        imagePath,
        cropOcr: input.cropOcr,
      });
      const score = scoreRowEvidence({
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
      accumulateNumericTaxonomy(numeric, truth.numericCellsRaw, evidence);
      accumulateParticipantTaxonomy(
        participant,
        truth.participantLeftRaw,
        truth.participantRightRaw,
        evidence,
      );
      rows.push({
        pilotIndex: i + 1,
        sourceImageSha256: key.sourceImageSha256,
        visualRowIndex: key.visualRowIndex,
        evidence,
        ...score,
      });
    }

    candidates.push({
      candidate,
      participantLeftExactEvidencePresent,
      participantRightExactEvidencePresent,
      numericCellExactEvidenceCount,
      numericCellTotalTruthCount,
      numericCellsAllExactEvidencePresent,
      participantPairExactEvidencePresent,
      allPrimaryEvidencePresent,
      rows,
    });
    taxonomyByCandidate[candidate] = { numeric, participant };
  }

  return {
    schemaVersion: OCR_RECOVERY_EXPERIMENT_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    pilotRows: PILOT_COUNT,
    networkUsed: false,
    parserUsed: false,
    holdoutRead: false,
    freshValidationReadForRuleDesign: false,
    candidates,
    bestCandidate: selectBestOcrRecoveryCandidate(candidates),
    taxonomyByCandidate,
  };
}
