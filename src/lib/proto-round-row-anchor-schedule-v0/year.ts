import type { FilenameTimestampParseStatus } from "../proto-round-extraction-design-v0/types";
import type { ScheduleYearContext } from "./types";

const KST_CIVIL_PREFIX = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T/;

export type FilenameCalendarDate = {
  year: number;
  month: number;
  day: number;
};

/**
 * Calendar date only from a sealed filename timestamp candidate KST string.
 * Filename clock time is not an observation time.
 */
export function parseFilenameCalendarDate(input: {
  filenameTimestampCandidateKst: string | null;
  filenameTimestampParseStatus: FilenameTimestampParseStatus | null;
}): FilenameCalendarDate | null {
  if (input.filenameTimestampParseStatus !== "PARSED_EXACT_PATTERN") return null;
  if (input.filenameTimestampCandidateKst == null) return null;
  const m = KST_CIVIL_PREFIX.exec(input.filenameTimestampCandidateKst);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

export function yearContextFromFilenameCandidate(input: {
  filenameTimestampCandidateKst: string | null;
  filenameTimestampParseStatus: FilenameTimestampParseStatus | null;
}): ScheduleYearContext {
  const civil = parseFilenameCalendarDate(input);
  return {
    sourceFilenameYear: civil?.year ?? null,
    sourceFilenameMonth: civil?.month ?? null,
    sourceFilenameDay: civil?.day ?? null,
    sourceFilenameTimestampCandidateKst: input.filenameTimestampCandidateKst,
    sourceFilenameTimestampParseStatus: input.filenameTimestampParseStatus,
  };
}

/**
 * Year comes only from the source-filename calendar date candidate.
 * Round-folder year never overrides a Dec/Jan boundary.
 * No silent year rollover.
 */
export function resolveScheduleYear(
  displayedMonth: number,
  ctx: ScheduleYearContext,
): { year: number | null; ambiguous: boolean } {
  if (
    ctx.sourceFilenameYear == null ||
    ctx.sourceFilenameMonth == null
  ) {
    return { year: null, ambiguous: true };
  }
  if (ctx.sourceFilenameMonth === 12 && displayedMonth === 1) {
    return { year: null, ambiguous: true };
  }
  if (ctx.sourceFilenameMonth === 1 && displayedMonth === 12) {
    return { year: null, ambiguous: true };
  }
  return { year: ctx.sourceFilenameYear, ambiguous: false };
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function kstLocalAndUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): { local: string; utc: string } {
  const local = `${input.year}-${pad2(input.month)}-${pad2(input.day)}T${pad2(input.hour)}:${pad2(input.minute)}:00+09:00`;
  const wallUtcMs = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    0,
  );
  const utc = new Date(wallUtcMs - KST_OFFSET_MS).toISOString();
  return { local, utc };
}
