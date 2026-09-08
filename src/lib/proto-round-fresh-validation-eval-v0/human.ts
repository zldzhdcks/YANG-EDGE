import {
  FRESH_HUMAN_TRUTH_SCHEMA_VERSION,
  GROUND_TRUTH_SOURCE,
  type FreshHumanExportDocumentV0,
  type FreshHumanTruthDocumentV0,
} from "./types";

export function buildFreshHumanTruthDocument(input: {
  sourceExportPath: string;
  exportDoc: FreshHumanExportDocumentV0;
}): FreshHumanTruthDocumentV0 {
  return {
    schemaVersion: FRESH_HUMAN_TRUTH_SCHEMA_VERSION,
    protoRoundKey: input.exportDoc.protoRoundKey,
    groundTruthSource: GROUND_TRUTH_SOURCE,
    sourceExportPath: input.sourceExportPath,
    records: input.exportDoc.records.map((rec) => ({
      sourceImageSha256: rec.sourceImageSha256,
      visualRowIndex: rec.visualRowIndex,
      sourceFileName: rec.sourceFileName,
      annotationStatus: rec.annotationStatus,
      screenRowIdentifierRaw: rec.screenRowIdentifierRaw,
      participantLeftRaw: rec.participantLeftRaw,
      participantRightRaw: rec.participantRightRaw,
      numericCellsRaw: [...rec.numericCellsRaw],
      marketMarkerRaw: rec.marketMarkerRaw,
    })),
  };
}
