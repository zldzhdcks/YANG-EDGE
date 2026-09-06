import type { RawOcrDocumentV0 } from "../proto-round-raw-ocr-v0/types";
import type { VisualRowsDocumentV0 } from "../proto-round-visual-rows-v0/types";
import { buildFilenameDateContextBySha256 } from "./lineage";
import { parseRowAnchorSchedule } from "./parse-row";
import {
  CROSS_IMAGE_ROW_AUTO_DEDUPE,
  PARSER_ACCURACY_PERCENT,
  ROUND_FOLDER_YEAR_OVERRIDES_BOUNDARY_AMBIGUITY,
  ROW_ANCHOR_SCHEDULE_SCHEMA_VERSION,
  ROW_IDENTIFIER_SCOPE,
  SCHEDULE_TIMEZONE,
  SCHEDULE_YEAR_CONTEXT_PROVENANCE,
  YEAR_CONTEXT_SOURCE_JOIN,
  type RowAnchorScheduleDocumentV0,
  type ScheduleParseStatus,
  type ScheduleYearContext,
} from "./types";

export function countScheduleStatuses(
  rows: RowAnchorScheduleDocumentV0["rows"],
): Record<ScheduleParseStatus | "identifierExactOne" | "identifierNone" | "identifierMultiple", number> {
  const out = {
    identifierExactOne: 0,
    identifierNone: 0,
    identifierMultiple: 0,
    PARSED_EXACT: 0,
    DATE_NOT_FOUND: 0,
    TIME_NOT_FOUND: 0,
    OCR_AMBIGUOUS: 0,
    INVALID_DATE: 0,
    INVALID_TIME: 0,
    WEEKDAY_MISMATCH: 0,
    MULTIPLE_DATE_CANDIDATES: 0,
    MULTIPLE_TIME_CANDIDATES: 0,
    YEAR_CONTEXT_AMBIGUOUS: 0,
  };
  for (const r of rows) {
    if (r.rowIdentifierParseStatus === "EXACT_ONE") out.identifierExactOne += 1;
    else if (r.rowIdentifierParseStatus === "NONE") out.identifierNone += 1;
    else out.identifierMultiple += 1;
    out[r.scheduleParseStatus] += 1;
  }
  return out;
}

function parseImageRows(
  visual: VisualRowsDocumentV0,
  contextBySha: Map<string, ScheduleYearContext>,
) {
  return visual.images.flatMap((img) =>
    img.visualRows.map((row) => {
      const ctx = contextBySha.get(row.sourceImageSha256);
      if (!ctx) {
        throw new Error("MISSING_FILENAME_CONTEXT_SHA");
      }
      return parseRowAnchorSchedule(row, ctx);
    }),
  );
}

export function buildRowAnchorScheduleDocumentV0(input: {
  visual: VisualRowsDocumentV0;
  ocr: RawOcrDocumentV0;
}): RowAnchorScheduleDocumentV0 {
  const contextBySha = buildFilenameDateContextBySha256({
    visual: input.visual,
    ocr: input.ocr,
  });
  const rows = parseImageRows(input.visual, contextBySha);
  return {
    meta: {
      schemaVersion: ROW_ANCHOR_SCHEDULE_SCHEMA_VERSION,
      protoRoundKey: input.visual.meta.protoRoundKey,
      year: input.visual.meta.year,
      round: input.visual.meta.round,
      sourceVisualRowsSchema: "proto-round-visual-rows-v0",
      sourceImages: input.visual.images.length,
      sourceVisualRows: rows.length,
      semanticScope: "ROW_IDENTIFIER_AND_SCHEDULE_ONLY",
      ocrCorrection: "DISABLED",
      teamParsing: "NOT_PERFORMED",
      marketParsing: "NOT_PERFORMED",
      oddsParsing: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageDedupe: CROSS_IMAGE_ROW_AUTO_DEDUPE,
      scheduleTimezone: SCHEDULE_TIMEZONE,
      parserAccuracyPercent: PARSER_ACCURACY_PERCENT,
      rowIdentifierScope: ROW_IDENTIFIER_SCOPE,
      yearContextSourceJoin: YEAR_CONTEXT_SOURCE_JOIN,
      scheduleYearContextProvenance: SCHEDULE_YEAR_CONTEXT_PROVENANCE,
      sourceFilenameDateUsedForYearContext: true,
      sourceFilenameTimeUsedAsObservationTime: false,
      roundFolderYearOverridesBoundaryAmbiguity:
        ROUND_FOLDER_YEAR_OVERRIDES_BOUNDARY_AMBIGUITY,
      filenameTimestampUsedAsCapturedAt: false,
      screenScheduleTimeUsedAsObservationTime: false,
      acceptedObservationTimes: "NOT_ASSIGNED",
    },
    rows,
  };
}
