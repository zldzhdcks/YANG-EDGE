import { buildColumnLayoutAuditDocumentV0 } from "../proto-round-column-layout-audit-v0";
import type { RawOcrDocumentV0 } from "../proto-round-raw-ocr-v0/types";
import { buildRowAnchorScheduleDocumentV0 } from "../proto-round-row-anchor-schedule-v0";
import { buildSemanticRegionCandidatesDocumentV0 } from "../proto-round-semantic-region-candidates-v0";
import { reconstructVisualRowsDocumentV0 } from "../proto-round-visual-rows-v0";
import type { ImageDimensions } from "../proto-round-visual-rows-v0/types";
import { hasFiniteTargetRowGeometry } from "../proto-round-ground-truth-v0/geometry";
import { FreshValidationBlindTestV0Error } from "./identity";
import type { FreshMachineGeometryRowV0 } from "./types";

export function collectEligibleFreshRows(input: {
  visual: ReturnType<typeof reconstructVisualRowsDocumentV0>;
  semantic: ReturnType<typeof buildSemanticRegionCandidatesDocumentV0>;
  screenshotRelativePathBySha256: Map<string, string>;
}): FreshMachineGeometryRowV0[] {
  const semanticById = new Map(
    input.semantic.rows.map((row) => [
      `${row.sourceImageSha256}|${row.visualRowIndex}`,
      row,
    ]),
  );
  const out: FreshMachineGeometryRowV0[] = [];
  for (const image of input.visual.images) {
    const screenshotRelativePath = input.screenshotRelativePathBySha256.get(
      image.sourceImageSha256,
    );
    if (!screenshotRelativePath) {
      throw new FreshValidationBlindTestV0Error("FRESH_SCREENSHOT_PATH_MISSING");
    }
    if (
      typeof image.imageWidth !== "number" ||
      typeof image.imageHeight !== "number" ||
      image.imageWidth < 1 ||
      image.imageHeight < 1
    ) {
      throw new FreshValidationBlindTestV0Error("FRESH_IMAGE_DIMENSIONS_MISSING");
    }
    for (const row of image.visualRows) {
      if (
        !hasFiniteTargetRowGeometry({
          row: {
            sourceImageSha256: row.sourceImageSha256,
            sourceFileName: row.sourceFileName,
            visualRowIndex: row.visualRowIndex,
            topY: row.topY,
            bottomY: row.bottomY,
            centerY: row.centerY,
          },
          image,
        })
      ) {
        continue;
      }
      const semantic = semanticById.get(
        `${row.sourceImageSha256}|${row.visualRowIndex}`,
      );
      out.push({
        sourceImageSha256: row.sourceImageSha256,
        sourceFileName: row.sourceFileName,
        visualRowIndex: row.visualRowIndex,
        topY: row.topY,
        bottomY: row.bottomY,
        centerY: row.centerY,
        imageWidth: image.imageWidth,
        imageHeight: image.imageHeight,
        screenshotRelativePath,
        regions: (semantic?.regions ?? []).map((region) => ({
          rawEvidenceTags: [...region.rawEvidenceTags],
          joinedRawText: region.joinedRawText,
          fragments: region.fragments.map((f) => ({
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
          })),
        })),
      });
    }
  }
  return out;
}

export function reconstructFreshMachineGeometry(input: {
  ocr: RawOcrDocumentV0;
  year: number;
  round: number;
  protoRoundKey: string;
  dimensionsBySha256: Map<string, ImageDimensions>;
  screenshotRelativePathBySha256: Map<string, string>;
}): FreshMachineGeometryRowV0[] {
  const visual = reconstructVisualRowsDocumentV0({
    ocr: input.ocr,
    year: input.year,
    round: input.round,
    protoRoundKey: input.protoRoundKey,
    dimensionsBySha256: input.dimensionsBySha256,
  });
  const anchors = buildRowAnchorScheduleDocumentV0({
    visual,
    ocr: input.ocr,
  });
  const layout = buildColumnLayoutAuditDocumentV0({
    visual,
    semantic: anchors,
  });
  const semantic = buildSemanticRegionCandidatesDocumentV0(layout);
  return collectEligibleFreshRows({
    visual,
    semantic,
    screenshotRelativePathBySha256: input.screenshotRelativePathBySha256,
  });
}
