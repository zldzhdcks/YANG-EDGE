import { joinRawEvidence } from "../proto-round-participant-ocr-experiment-v3/evidence";
import {
  exclusiveTextBearingCropBoxes,
  visualRowCropBox,
} from "../proto-round-participant-ocr-experiment-v3/geometry";
import type {
  CropOcrProviderV3,
  IndependentEvidenceV3,
  PixelBoxV3,
} from "../proto-round-participant-ocr-experiment-v3/types";
import { unionIndependentEvidence } from "../proto-round-participant-ocr-experiment-v3/evidence";
import { FreshValidationBlindTestV0Error } from "./identity";
import type { FreshIndependentEvidenceV0, FreshMachineGeometryRowV0 } from "./types";

async function ocrBoxes(input: {
  source: FreshIndependentEvidenceV0["source"];
  imagePath: string;
  boxes: PixelBoxV3[];
  scale: 3 | 5;
  cropOcr: CropOcrProviderV3;
}): Promise<IndependentEvidenceV3[]> {
  const items: IndependentEvidenceV3[] = [];
  for (const crop of input.boxes) {
    try {
      const ocr = await input.cropOcr.extractCrop({
        imagePath: input.imagePath,
        crop,
        scale: input.scale,
      });
      items.push({
        source: input.source,
        text: joinRawEvidence(ocr.rawText, ocr.rawLines),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new FreshValidationBlindTestV0Error(
        `CROP_OCR_FAILED:${input.source}:x=${crop.x},y=${crop.y},w=${crop.width},h=${crop.height},scale=${input.scale}:${msg}`,
      );
    }
  }
  return items;
}

export async function extractFrozenWinnerEvidence(input: {
  row: FreshMachineGeometryRowV0;
  imagePath: string;
  cropOcr: CropOcrProviderV3;
}): Promise<FreshIndependentEvidenceV0[]> {
  const visual = {
    topY: input.row.topY,
    bottomY: input.row.bottomY,
    imageWidth: input.row.imageWidth,
    imageHeight: input.row.imageHeight,
  };
  const rowCrop = visualRowCropBox(visual);
  const rowEvidence = rowCrop
    ? await ocrBoxes({
        source: "V2_ROW_CROP_UPSCALE_3X_KO",
        imagePath: input.imagePath,
        boxes: [rowCrop],
        scale: 3,
        cropOcr: input.cropOcr,
      })
    : [];
  const textBoxes = exclusiveTextBearingCropBoxes({
    imageWidth: input.row.imageWidth,
    imageHeight: input.row.imageHeight,
    horizontalPaddingRatio: 0.8,
    verticalPaddingRatio: 1,
    regions: input.row.regions,
  });
  const textEvidence = await ocrBoxes({
    source: "TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO",
    imagePath: input.imagePath,
    boxes: textBoxes,
    scale: 5,
    cropOcr: input.cropOcr,
  });
  return unionIndependentEvidence(rowEvidence, textEvidence).map((item) => ({
    source: item.source as FreshIndependentEvidenceV0["source"],
    text: item.text,
  }));
}
