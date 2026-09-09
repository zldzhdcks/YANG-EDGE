import {
  exclusiveTextBearingCropBoxes,
  joinRawEvidence,
  unionIndependentEvidence,
  visualRowCropBox,
  type CropOcrProviderV3,
  type IndependentEvidenceV3,
  type PixelBoxV3,
  type SemanticRegionGeometryV3,
  type VisualRowGeometryV3,
} from "../proto-round-participant-ocr-experiment-v3";
import { OcrV4DesignV0Error } from "./error";

async function ocrBoxes(input: {
  source: IndependentEvidenceV3["source"];
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
      throw new OcrV4DesignV0Error(
        `CROP_OCR_FAILED:${input.source}:x=${crop.x},y=${crop.y},w=${crop.width},h=${crop.height},scale=${input.scale}:${msg}`,
      );
    }
  }
  return items;
}

export async function extractFrozenV3WinnerEvidence(input: {
  visual: VisualRowGeometryV3;
  semantic: SemanticRegionGeometryV3 | undefined;
  imagePath: string;
  cropOcr: CropOcrProviderV3;
}): Promise<IndependentEvidenceV3[]> {
  const rowCrop = visualRowCropBox(input.visual);
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
    imageWidth: input.visual.imageWidth,
    imageHeight: input.visual.imageHeight,
    horizontalPaddingRatio: 0.8,
    verticalPaddingRatio: 1,
    regions: input.semantic?.regions ?? [],
  });
  const textEvidence = await ocrBoxes({
    source: "TEXT_REGIONS_EXPANDED_80_100_UPSCALE_5X_KO",
    imagePath: input.imagePath,
    boxes: textBoxes,
    scale: 5,
    cropOcr: input.cropOcr,
  });
  return unionIndependentEvidence(rowEvidence, textEvidence);
}
