import type { CropOcrProviderV3 } from "../proto-round-participant-ocr-experiment-v3/types";
import {
  literalMarketMarkerCandidateRaw,
  numericRawEvidences,
  safeReconstructedNumericEvidences,
} from "./evidence";
import { FreshValidationBlindTestV0Error } from "./identity";
import { extractFrozenWinnerEvidence } from "./winner";
import {
  FROZEN_WINNER_CANDIDATE,
  OCR_INTERPOLATION,
  FRESH_VALIDATION_BLIND_TEST_SCHEMA_VERSION,
  FRESH_SELECTION_SALT,
  FRESH_VALIDATION_SAMPLE_SIZE,
  type FreshMachineGeometryRowV0,
  type FreshMachineOutputDocumentV0,
  type FreshSelectionDocumentV0,
} from "./types";
import { selectFreshValidationRows } from "./select";

export function buildFreshSelectionDocument(input: {
  protoRoundKey: string;
  eligibleRows: FreshMachineGeometryRowV0[];
}): FreshSelectionDocumentV0 {
  const selected = selectFreshValidationRows({
    eligibleRows: input.eligibleRows,
  });
  const strip = (row: FreshMachineGeometryRowV0) => ({
    sourceImageSha256: row.sourceImageSha256,
    sourceFileName: row.sourceFileName,
    visualRowIndex: row.visualRowIndex,
    topY: row.topY,
    bottomY: row.bottomY,
    centerY: row.centerY,
    imageWidth: row.imageWidth,
    imageHeight: row.imageHeight,
    screenshotRelativePath: row.screenshotRelativePath,
  });
  return {
    schemaVersion: FRESH_VALIDATION_BLIND_TEST_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    selectionSalt: FRESH_SELECTION_SALT,
    selectionAlgorithm: "SHA256_SALT_CONCAT_SOURCE_SHA_VISUAL_ROW_INDEX_SORT_ASC_TAKE_N",
    sampleSizeTarget: FRESH_VALIDATION_SAMPLE_SIZE,
    eligibleRowCount: selected.eligibleRowCount,
    selectedRowCount: selected.selectedRows.length,
    eligibleRows: input.eligibleRows.map(strip),
    selectedRows: selected.selectedRows.map(strip),
  };
}

export async function buildFreshMachineOutputDocument(input: {
  protoRoundKey: string;
  selectedGeometry: FreshMachineGeometryRowV0[];
  imagePathBySha256: Map<string, string>;
  cropOcr: CropOcrProviderV3;
}): Promise<FreshMachineOutputDocumentV0> {
  const rows = [];
  for (const row of input.selectedGeometry) {
    const imagePath = input.imagePathBySha256.get(row.sourceImageSha256);
    if (!imagePath) {
      throw new FreshValidationBlindTestV0Error("FRESH_IMAGE_PATH_MISSING");
    }
    const participantRawOcrEvidences = await extractFrozenWinnerEvidence({
      row,
      imagePath,
      cropOcr: input.cropOcr,
    });
    rows.push({
      sourceImageSha256: row.sourceImageSha256,
      sourceFileName: row.sourceFileName,
      visualRowIndex: row.visualRowIndex,
      geometry: {
        topY: row.topY,
        bottomY: row.bottomY,
        centerY: row.centerY,
        imageWidth: row.imageWidth,
        imageHeight: row.imageHeight,
      },
      participantRawOcrEvidences,
      numericRawOcrEvidences: numericRawEvidences({
        regions: row.regions,
        participantEvidence: participantRawOcrEvidences,
      }),
      safeReconstructedNumericEvidences: safeReconstructedNumericEvidences(
        participantRawOcrEvidences,
      ),
      marketMarkerCandidateRaw: literalMarketMarkerCandidateRaw(row.regions),
    });
  }
  return {
    schemaVersion: FRESH_VALIDATION_BLIND_TEST_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    winnerCandidate: FROZEN_WINNER_CANDIDATE,
    interpolation: OCR_INTERPOLATION,
    parserUsed: false,
    holdoutRead: false,
    humanGroundTruthRead: false,
    rows,
  };
}
