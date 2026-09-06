import type { RawOcrDocumentV0 } from "../proto-round-raw-ocr-v0/types";
import type { VisualRowsDocumentV0 } from "../proto-round-visual-rows-v0/types";
import type { ScheduleYearContext } from "./types";
import { yearContextFromFilenameCandidate } from "./year";

export class RowAnchorScheduleLineageError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "RowAnchorScheduleLineageError";
    this.code = code;
  }
}

export type FilenameDateContextBySha256 = Map<string, ScheduleYearContext>;

function uniqueShaSet(
  shas: string[],
  duplicateCode: string,
): Set<string> {
  const set = new Set<string>();
  for (const sha of shas) {
    if (set.has(sha)) {
      throw new RowAnchorScheduleLineageError(duplicateCode);
    }
    set.add(sha);
  }
  return set;
}

/**
 * Join visual-row source images to filename-date context by exact SHA-256.
 * No filename-only fallback. Fail closed on missing, duplicate, or unknown SHA.
 */
export function buildFilenameDateContextBySha256(input: {
  visual: VisualRowsDocumentV0;
  ocr: RawOcrDocumentV0;
}): FilenameDateContextBySha256 {
  if (input.ocr.meta.protoRoundKey !== input.visual.meta.protoRoundKey) {
    throw new RowAnchorScheduleLineageError("YEAR_CONTEXT_PROTO_ROUND_KEY_MISMATCH");
  }
  if (input.ocr.meta.year !== input.visual.meta.year) {
    throw new RowAnchorScheduleLineageError("YEAR_CONTEXT_YEAR_MISMATCH");
  }
  if (input.ocr.meta.round !== input.visual.meta.round) {
    throw new RowAnchorScheduleLineageError("YEAR_CONTEXT_ROUND_MISMATCH");
  }

  const visualShas = uniqueShaSet(
    input.visual.images.map((img) => img.sourceImageSha256),
    "DUPLICATE_VISUAL_SOURCE_SHA",
  );
  const ocrShas = uniqueShaSet(
    input.ocr.images.map((img) => img.sourceImageSha256),
    "DUPLICATE_YEAR_CONTEXT_SHA",
  );

  for (const sha of visualShas) {
    if (!ocrShas.has(sha)) {
      throw new RowAnchorScheduleLineageError("MISSING_FILENAME_CONTEXT_SHA");
    }
  }
  for (const sha of ocrShas) {
    if (!visualShas.has(sha)) {
      throw new RowAnchorScheduleLineageError("UNKNOWN_FILENAME_CONTEXT_SHA");
    }
  }

  const map: FilenameDateContextBySha256 = new Map();
  for (const img of input.ocr.images) {
    map.set(
      img.sourceImageSha256,
      yearContextFromFilenameCandidate({
        filenameTimestampCandidateKst: img.filenameTimestampCandidateKst,
        filenameTimestampParseStatus: img.filenameTimestampParseStatus,
      }),
    );
  }

  for (const img of input.visual.images) {
    for (const row of img.visualRows) {
      if (row.sourceImageSha256 !== img.sourceImageSha256) {
        throw new RowAnchorScheduleLineageError("VISUAL_ROW_SHA_IMAGE_MISMATCH");
      }
      if (!map.has(row.sourceImageSha256)) {
        throw new RowAnchorScheduleLineageError("MISSING_FILENAME_CONTEXT_SHA");
      }
    }
  }
  return map;
}
