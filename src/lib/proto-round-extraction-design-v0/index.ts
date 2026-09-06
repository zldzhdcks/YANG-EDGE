export * from "./filename-timestamp";
export * from "./png-ihdr";
export * from "./row-fingerprint";
export * from "./types";

import type {
  CanonicalImageDesignRecordV0,
  ExtractionDesignDocumentV0,
  ImageDimensionGroup,
} from "./types";
import {
  CAPTURE_SEQUENCE_RULE,
  CROSS_IMAGE_ROW_AUTO_DEDUPE,
  EXTRACTION_DESIGN_SCHEMA_VERSION,
} from "./types";

export function summarizeDimensionGroups(
  images: CanonicalImageDesignRecordV0[],
): ImageDimensionGroup[] {
  const map = new Map<string, ImageDimensionGroup>();
  for (const img of images) {
    if (!img.pngDimensions) continue;
    const key = `${img.pngDimensions.width}x${img.pngDimensions.height}`;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else {
      map.set(key, {
        width: img.pngDimensions.width,
        height: img.pngDimensions.height,
        aspectRatio: img.pngDimensions.aspectRatio,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.width !== b.width) return a.width - b.width;
    return a.height - b.height;
  });
}

export function filenameTimestampParseCoverage(
  images: CanonicalImageDesignRecordV0[],
): { parsed: number; total: number; text: string } {
  const parsed = images.filter(
    (i) =>
      i.filenameTimestamp.filenameTimestampParseStatus ===
      "PARSED_EXACT_PATTERN",
  ).length;
  return {
    parsed,
    total: images.length,
    text: `${parsed}/${images.length}`,
  };
}

export function buildExtractionDesignDocumentV0(input: {
  year: number;
  round: number;
  roundLabel: string;
  protoRoundKey: string;
  canonicalImages: CanonicalImageDesignRecordV0[];
}): ExtractionDesignDocumentV0 {
  const coverage = filenameTimestampParseCoverage(input.canonicalImages);
  return {
    meta: {
      schemaVersion: EXTRACTION_DESIGN_SCHEMA_VERSION,
      protoRoundKey: input.protoRoundKey,
      year: input.year,
      round: input.round,
      roundLabel: input.roundLabel,
      timezone: "Asia/Seoul",
      operatorRoot: "YANG-EDGE-INBOX",
      realCanonicalImages: input.canonicalImages.length,
      filenameTimestampParseCoverage: coverage.text,
      ocr: "NOT_IMPLEMENTED",
      officialOddsExtraction: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      rowDedupe: "DESIGN_ONLY",
      timingClassification: "UNCLASSIFIED",
      captureSequenceRule: CAPTURE_SEQUENCE_RULE,
      crossImageRowAutoDedupe: CROSS_IMAGE_ROW_AUTO_DEDUPE,
      structuralPixelAnalysis: "NOT_PERFORMED",
      filesystemTimeUsedAsCapturedAt: false,
      filenameTimeUsedAsCapturedAt: false,
      osGeneratorProven: false,
    },
    imageDimensionGroups: summarizeDimensionGroups(input.canonicalImages),
    canonicalImages: input.canonicalImages,
    policies: {
      rawTextNeverOverwrittenByNormalized: true,
      rowContentFingerprintExcludesSourceImageSha256: true,
      differentObservationTimesNotAutoMerged: true,
      pregameRequiresAcceptedObservationTimeAndKickoff: true,
      osGeneratorProven: false,
      crossImageRowAutoDedupe: CROSS_IMAGE_ROW_AUTO_DEDUPE,
    },
  };
}
