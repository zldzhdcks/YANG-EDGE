/**
 * Proto-round row-anchor + schedule candidate v0.
 *
 * Conservative semantics only:
 *   standalone 4-digit row identifier candidate (PRE_DATE_ANCHOR_ONLY)
 *   exact ASCII screen date/time candidate
 *
 * OCR correction is DISABLED. Teams/markets/odds/game matching are not parsed.
 *
 * scheduledLocalCandidate is GAME DISPLAY TIME, not acceptedObservationTime.
 * Source filename timestamps are year-context CANDIDATES only, never capturedAt.
 */

import type { FilenameTimestampParseStatus } from "../proto-round-extraction-design-v0/types";
import { CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";
import type { VisualRowFragmentV0 } from "../proto-round-visual-rows-v0/types";

export { CROSS_IMAGE_ROW_AUTO_DEDUPE };

export const ROW_ANCHOR_SCHEDULE_SCHEMA_VERSION =
  "proto-round-row-anchor-schedule-v0" as const;
export const ROW_ANCHOR_SCHEDULE_ARTIFACT_FILE_NAME =
  "row-anchor-schedule-v0.json" as const;
export const SCHEDULE_TIMEZONE = "Asia/Seoul" as const;
export const PARSER_ACCURACY_PERCENT = "NOT_MEASURABLE_YET" as const;

export const ROW_IDENTIFIER_SCOPE = "PRE_DATE_ANCHOR_ONLY" as const;
export const YEAR_CONTEXT_SOURCE_JOIN = "SOURCE_IMAGE_SHA256" as const;
export const SCHEDULE_YEAR_CONTEXT_PROVENANCE =
  "SOURCE_FILENAME_DATE_CANDIDATE" as const;
export const ROUND_FOLDER_YEAR_OVERRIDES_BOUNDARY_AMBIGUITY = false as const;

export type RowIdentifierParseStatus = "EXACT_ONE" | "NONE" | "MULTIPLE";

export type DateParseStatus =
  | "PARSED_EXACT"
  | "DATE_NOT_FOUND"
  | "INVALID_DATE"
  | "WEEKDAY_MISMATCH"
  | "MULTIPLE_DATE_CANDIDATES"
  | "YEAR_CONTEXT_AMBIGUOUS";

export type TimeParseStatus =
  | "PARSED_EXACT"
  | "TIME_NOT_FOUND"
  | "OCR_AMBIGUOUS"
  | "INVALID_TIME"
  | "MULTIPLE_TIME_CANDIDATES";

export type ScheduleParseStatus =
  | "PARSED_EXACT"
  | "DATE_NOT_FOUND"
  | "TIME_NOT_FOUND"
  | "OCR_AMBIGUOUS"
  | "INVALID_DATE"
  | "INVALID_TIME"
  | "WEEKDAY_MISMATCH"
  | "MULTIPLE_DATE_CANDIDATES"
  | "MULTIPLE_TIME_CANDIDATES"
  | "YEAR_CONTEXT_AMBIGUOUS";

export type ScheduleYearContextProvenance =
  typeof SCHEDULE_YEAR_CONTEXT_PROVENANCE;

export type ProtoRoundRowAnchorScheduleCandidateV0 = {
  sourceImageSha256: string;
  sourceFileName: string;
  visualRowIndex: number;
  visualJoinedTextCandidate: string;
  fragments: VisualRowFragmentV0[];
  rowIdentifierParseStatus: RowIdentifierParseStatus;
  rowIdentifierRaw: string | null;
  rowIdentifierCandidate: number | null;
  dateParseStatus: DateParseStatus;
  displayedMonth: number | null;
  displayedDay: number | null;
  displayedWeekdayRaw: string | null;
  timeParseStatus: TimeParseStatus;
  displayedTimeRawParts: string[];
  displayedHour: number | null;
  displayedMinute: number | null;
  scheduleParseStatus: ScheduleParseStatus;
  scheduledLocalCandidate: string | null;
  scheduledUtcCandidate: string | null;
  scheduleTimezone: typeof SCHEDULE_TIMEZONE;
  sourceFilenameTimestampCandidateKst: string | null;
  sourceFilenameTimestampParseStatus: FilenameTimestampParseStatus | null;
  scheduleYearContextProvenance: ScheduleYearContextProvenance;
  scheduleYearContextYear: number | null;
  scheduleYearContextMonth: number | null;
  acceptedObservationTime: null;
  observationTimeProvenance: null;
  semanticScope: "ROW_IDENTIFIER_AND_SCHEDULE_ONLY";
  teamParsingStatus: "NOT_PERFORMED";
  marketParsingStatus: "NOT_PERFORMED";
  oddsParsingStatus: "NOT_PERFORMED";
  gameMatchingStatus: "NOT_PERFORMED";
};

export type RowAnchorScheduleDocumentV0 = {
  meta: {
    schemaVersion: typeof ROW_ANCHOR_SCHEDULE_SCHEMA_VERSION;
    protoRoundKey: string;
    year: number;
    round: number;
    sourceVisualRowsSchema: "proto-round-visual-rows-v0";
    sourceImages: number;
    sourceVisualRows: number;
    semanticScope: "ROW_IDENTIFIER_AND_SCHEDULE_ONLY";
    ocrCorrection: "DISABLED";
    teamParsing: "NOT_PERFORMED";
    marketParsing: "NOT_PERFORMED";
    oddsParsing: "NOT_PERFORMED";
    gameMatching: "NOT_PERFORMED";
    crossImageDedupe: typeof CROSS_IMAGE_ROW_AUTO_DEDUPE;
    scheduleTimezone: typeof SCHEDULE_TIMEZONE;
    parserAccuracyPercent: typeof PARSER_ACCURACY_PERCENT;
    rowIdentifierScope: typeof ROW_IDENTIFIER_SCOPE;
    yearContextSourceJoin: typeof YEAR_CONTEXT_SOURCE_JOIN;
    scheduleYearContextProvenance: ScheduleYearContextProvenance;
    sourceFilenameDateUsedForYearContext: true;
    sourceFilenameTimeUsedAsObservationTime: false;
    roundFolderYearOverridesBoundaryAmbiguity: typeof ROUND_FOLDER_YEAR_OVERRIDES_BOUNDARY_AMBIGUITY;
    filenameTimestampUsedAsCapturedAt: false;
    screenScheduleTimeUsedAsObservationTime: false;
    acceptedObservationTimes: "NOT_ASSIGNED";
  };
  rows: ProtoRoundRowAnchorScheduleCandidateV0[];
};

/**
 * Calendar date from the source-image filename timestamp candidate.
 * Time-of-day from the filename is never used as observation time.
 */
export type ScheduleYearContext = {
  sourceFilenameYear: number | null;
  sourceFilenameMonth: number | null;
  sourceFilenameDay: number | null;
  sourceFilenameTimestampCandidateKst: string | null;
  sourceFilenameTimestampParseStatus: FilenameTimestampParseStatus | null;
};
