import type { VisualRowCandidateV0 } from "../proto-round-visual-rows-v0/types";
import { findDateAnchors, isValidCivilDate, koreanWeekdayForCivilDate } from "./date";
import { parseRowIdentifierBeforeDateAnchor } from "./identifier";
import { parseImmediateTime } from "./time";
import {
  SCHEDULE_TIMEZONE,
  SCHEDULE_YEAR_CONTEXT_PROVENANCE,
  type DateParseStatus,
  type ProtoRoundRowAnchorScheduleCandidateV0,
  type RowIdentifierParseStatus,
  type ScheduleParseStatus,
  type ScheduleYearContext,
  type TimeParseStatus,
} from "./types";
import { kstLocalAndUtc, resolveScheduleYear } from "./year";

function combineScheduleStatus(
  date: DateParseStatus,
  time: TimeParseStatus,
): ScheduleParseStatus {
  if (date !== "PARSED_EXACT") return date;
  if (time !== "PARSED_EXACT") return time;
  return "PARSED_EXACT";
}

const IDENT_NONE = {
  status: "NONE" as const,
  raw: null,
  candidate: null,
  fragmentIndex: null,
};

export function parseRowAnchorSchedule(
  row: VisualRowCandidateV0,
  yearContext: ScheduleYearContext,
): ProtoRoundRowAnchorScheduleCandidateV0 {
  const texts = row.fragments.map((f) => f.rawText);
  const dateAnchors = findDateAnchors(texts);

  let ident: {
    status: RowIdentifierParseStatus;
    raw: string | null;
    candidate: number | null;
    fragmentIndex: number | null;
  } = IDENT_NONE;
  let dateParseStatus: DateParseStatus = "DATE_NOT_FOUND";
  let displayedMonth: number | null = null;
  let displayedDay: number | null = null;
  let displayedWeekdayRaw: string | null = null;
  let timeParseStatus: TimeParseStatus = "TIME_NOT_FOUND";
  let displayedTimeRawParts: string[] = [];
  let displayedHour: number | null = null;
  let displayedMinute: number | null = null;
  let scheduledLocalCandidate: string | null = null;
  let scheduledUtcCandidate: string | null = null;

  if (dateAnchors.length > 1) {
    dateParseStatus = "MULTIPLE_DATE_CANDIDATES";
  } else if (dateAnchors.length === 1) {
    const dateHit = dateAnchors[0]!;
    ident = parseRowIdentifierBeforeDateAnchor(texts, dateHit.startIndex);
    displayedMonth = dateHit.match.month;
    displayedDay = dateHit.match.day;
    displayedWeekdayRaw = dateHit.match.weekdayRaw;
    const yearRes = resolveScheduleYear(dateHit.match.month, yearContext);
    if (yearRes.ambiguous || yearRes.year == null) {
      dateParseStatus = "YEAR_CONTEXT_AMBIGUOUS";
    } else if (!isValidCivilDate(yearRes.year, dateHit.match.month, dateHit.match.day)) {
      dateParseStatus = "INVALID_DATE";
    } else if (
      koreanWeekdayForCivilDate(yearRes.year, dateHit.match.month, dateHit.match.day) !==
      dateHit.match.weekdayRaw
    ) {
      dateParseStatus = "WEEKDAY_MISMATCH";
    } else {
      dateParseStatus = "PARSED_EXACT";
    }

    const following = texts.slice(dateHit.startIndex + dateHit.consumedFragments);
    const timeHit = parseImmediateTime({
      remainder: dateHit.remainder,
      followingTexts: following,
    });
    timeParseStatus = timeHit.status;
    displayedTimeRawParts = timeHit.rawParts;
    displayedHour = timeHit.hour;
    displayedMinute = timeHit.minute;

    if (
      dateParseStatus === "PARSED_EXACT" &&
      timeParseStatus === "PARSED_EXACT" &&
      yearRes.year != null &&
      displayedHour != null &&
      displayedMinute != null
    ) {
      const conv = kstLocalAndUtc({
        year: yearRes.year,
        month: dateHit.match.month,
        day: dateHit.match.day,
        hour: displayedHour,
        minute: displayedMinute,
      });
      scheduledLocalCandidate = conv.local;
      scheduledUtcCandidate = conv.utc;
    }
  }

  const scheduleParseStatus = combineScheduleStatus(dateParseStatus, timeParseStatus);

  return {
    sourceImageSha256: row.sourceImageSha256,
    sourceFileName: row.sourceFileName,
    visualRowIndex: row.visualRowIndex,
    visualJoinedTextCandidate: row.visualJoinedTextCandidate,
    fragments: row.fragments,
    rowIdentifierParseStatus: ident.status,
    rowIdentifierRaw: ident.raw,
    rowIdentifierCandidate: ident.candidate,
    dateParseStatus,
    displayedMonth,
    displayedDay,
    displayedWeekdayRaw,
    timeParseStatus,
    displayedTimeRawParts,
    displayedHour,
    displayedMinute,
    scheduleParseStatus,
    scheduledLocalCandidate,
    scheduledUtcCandidate,
    scheduleTimezone: SCHEDULE_TIMEZONE,
    sourceFilenameTimestampCandidateKst:
      yearContext.sourceFilenameTimestampCandidateKst,
    sourceFilenameTimestampParseStatus:
      yearContext.sourceFilenameTimestampParseStatus,
    scheduleYearContextProvenance: SCHEDULE_YEAR_CONTEXT_PROVENANCE,
    scheduleYearContextYear: yearContext.sourceFilenameYear,
    scheduleYearContextMonth: yearContext.sourceFilenameMonth,
    acceptedObservationTime: null,
    observationTimeProvenance: null,
    semanticScope: "ROW_IDENTIFIER_AND_SCHEDULE_ONLY",
    teamParsingStatus: "NOT_PERFORMED",
    marketParsingStatus: "NOT_PERFORMED",
    oddsParsingStatus: "NOT_PERFORMED",
    gameMatchingStatus: "NOT_PERFORMED",
  };
}
