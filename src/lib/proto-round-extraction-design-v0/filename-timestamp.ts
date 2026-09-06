import type {
  CandidateTimestampProvenance,
  FilenameTimestampParse,
  FilenameTimestampParseStatus,
} from "./types";

/** Exact recognized form: 스크린샷 YYYY-MM-DD HHMMSS.<supported extension> */
const EXACT_PATTERN =
  /^스크린샷 (\d{4})-(\d{2})-(\d{2}) (\d{6})\.([A-Za-z0-9]+)$/;

const SUPPORTED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "heif",
]);

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Calendar check without Date overflow normalization. */
function isValidCivilDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1) return false;
  const dim =
    DAYS_IN_MONTH[month - 1]! + (month === 2 && isLeapYear(year) ? 1 : 0);
  return day <= dim;
}

function isValidClock(hour: number, minute: number, second: number): boolean {
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    Number.isInteger(second) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59
  );
}

/**
 * Parse a recognized screenshot filename convention as a timestamp CANDIDATE.
 * Does not prove which application created the file.
 * Never returns capturedAt. Never falls back to filesystem mtime.
 */
export function parseScreenshotFilenameTimestamp(
  fileName: string,
): FilenameTimestampParse {
  const unmatched = (
    status: FilenameTimestampParseStatus,
  ): FilenameTimestampParse => ({
    fileName,
    filenameTimestampParseStatus: status,
    filenameTimestampText: null,
    filenameTimestampCandidateKst: null,
    filenameTimestampCandidateUtc: null,
    candidateProvenance: null,
  });

  const m = EXACT_PATTERN.exec(fileName);
  if (!m) return unmatched("NO_MATCH");
  const ext = m[5]!.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) return unmatched("NO_MATCH");

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hhmmss = m[4]!;
  const hour = Number(hhmmss.slice(0, 2));
  const minute = Number(hhmmss.slice(2, 4));
  const second = Number(hhmmss.slice(4, 6));
  const text = `${m[1]}-${m[2]}-${m[3]} ${hhmmss}`;

  if (
    !isValidCivilDate(year, month, day) ||
    !isValidClock(hour, minute, second)
  ) {
    return {
      fileName,
      filenameTimestampParseStatus: "INVALID_DATE_TIME",
      filenameTimestampText: text,
      filenameTimestampCandidateKst: null,
      filenameTimestampCandidateUtc: null,
      candidateProvenance: null,
    };
  }

  const kstWallMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const utc = new Date(kstWallMs - KST_OFFSET_MS);
  const kst = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+09:00`;
  const provenance: CandidateTimestampProvenance =
    "FILENAME_OS_GENERATED_CANDIDATE";

  return {
    fileName,
    filenameTimestampParseStatus: "PARSED_EXACT_PATTERN",
    filenameTimestampText: text,
    filenameTimestampCandidateKst: kst,
    filenameTimestampCandidateUtc: utc.toISOString(),
    candidateProvenance: provenance,
  };
}
