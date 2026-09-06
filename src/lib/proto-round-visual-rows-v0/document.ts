import type { RawOcrDocumentV0 } from "../proto-round-raw-ocr-v0/types";
import {
  CAPTURE_SEQUENCE_RULE,
  CROSS_IMAGE_ROW_AUTO_DEDUPE,
  FOUR_DIGIT_TOKEN_SEMANTIC_ROLE,
  MARKET_SIGNAL_SEMANTICS_ASSIGNED,
  VERTICAL_OVERLAP_THRESHOLD,
  VISUAL_ROWS_SCHEMA_VERSION,
  ROW_CLUSTER_METHOD,
} from "./types";
import { reconstructVisualRowsForImage } from "./reconstruct";
import type { ImageDimensions, VisualRowsDocumentV0 } from "./types";

export function reconstructVisualRowsDocumentV0(input: {
  ocr: RawOcrDocumentV0;
  year: number;
  round: number;
  protoRoundKey: string;
  dimensionsBySha256: Map<string, ImageDimensions>;
}): VisualRowsDocumentV0 {
  const images = input.ocr.images.map((img) =>
    reconstructVisualRowsForImage({
      sourceImageSha256: img.sourceImageSha256,
      sourceFileName: img.sourceFileName,
      rawLines: img.rawLines ?? [],
      dims: input.dimensionsBySha256.get(img.sourceImageSha256) ?? null,
    }),
  );
  return {
    meta: {
      schemaVersion: VISUAL_ROWS_SCHEMA_VERSION,
      protoRoundKey: input.protoRoundKey,
      year: input.year,
      round: input.round,
      sourceRawOcrSchema: "proto-round-raw-ocr-v0",
      sourceImages: images.length,
      rowClusterMethod: ROW_CLUSTER_METHOD,
      verticalOverlapThreshold: VERTICAL_OVERLAP_THRESHOLD,
      providerLineOrderUsed: false,
      geometrySortUsed: true,
      rowClusterRulePredefinedBeforeResults: true,
      postHocGeometryTuning: false,
      semanticParsing: "NOT_PERFORMED",
      officialOddsExtraction: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageRowDedupe: CROSS_IMAGE_ROW_AUTO_DEDUPE,
      captureSequenceRule: CAPTURE_SEQUENCE_RULE,
      acceptedObservationTimes: "NOT_ASSIGNED",
      filenameTimestampUsedAsCapturedAt: false,
      fourDigitTokenSemanticRole: FOUR_DIGIT_TOKEN_SEMANTIC_ROLE,
      marketSignalSemanticsAssigned: MARKET_SIGNAL_SEMANTICS_ASSIGNED,
    },
    images,
  };
}
