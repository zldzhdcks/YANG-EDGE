import { OcrResearchExpansionV1Error } from "./error";
import { identityKey } from "./hash";
import {
  DISCOVERY2_COUNT,
  type Discovery2AnnotationRecordV1,
  type ExpansionEligibleRowV1,
  type ExpansionRowKeyV1,
} from "./types";

export function discovery2RowsFromFrozenGeometry(input: {
  discovery2RowKeys: ExpansionRowKeyV1[];
  geometryRows: ExpansionEligibleRowV1[];
}): ExpansionEligibleRowV1[] {
  if (input.discovery2RowKeys.length !== DISCOVERY2_COUNT) {
    throw new OcrResearchExpansionV1Error("DISCOVERY2_COUNT_UNEXPECTED");
  }
  const byId = new Map(input.geometryRows.map((row) => [identityKey(row), row]));
  return input.discovery2RowKeys.map((key) => {
    const row = byId.get(identityKey(key));
    if (!row) {
      throw new OcrResearchExpansionV1Error("DISCOVERY2_GEOMETRY_MISSING");
    }
    if (
      row.sourceImageSha256 !== key.sourceImageSha256 ||
      row.visualRowIndex !== key.visualRowIndex
    ) {
      throw new OcrResearchExpansionV1Error("DISCOVERY2_IDENTITY_MUTATED");
    }
    return {
      sourceImageSha256: row.sourceImageSha256,
      visualRowIndex: row.visualRowIndex,
      sourceFileName: row.sourceFileName,
      topY: row.topY,
      bottomY: row.bottomY,
      centerY: row.centerY,
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
      screenshotRelativePath: row.screenshotRelativePath,
    };
  });
}

export function blankDiscovery2AnnotationRecords(
  rows: ExpansionEligibleRowV1[],
): Discovery2AnnotationRecordV1[] {
  return rows.map((row) => ({
    ...row,
    targetRowGeometry: {
      topY: row.topY,
      bottomY: row.bottomY,
      centerY: row.centerY,
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
    },
    annotationStatus: "UNANNOTATED",
    screenRowIdentifierRaw: null,
    participantLeftRaw: null,
    participantRightRaw: null,
    numericCellsRaw: [],
    marketMarkerRaw: null,
  }));
}
