/**
 * Exact ASCII-digit screen date tokens only.
 * No OCR repair. No fullwidth digits. No weekday punctuation substitution.
 */

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const WEEKDAY_INNER = "월|화|수|목|금|토|일";
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const HYPHEN_PREFIX = new RegExp(`^([0-9]{2})-([0-9]{2})\\((${WEEKDAY_INNER})\\)`);
const SPACE_PREFIX = new RegExp(`^([0-9]{2}) ([0-9]{2})\\((${WEEKDAY_INNER})\\)`);
const GLUED_PREFIX = new RegExp(`^([0-9]{2})([0-9]{2})\\((${WEEKDAY_INNER})\\)`);

export type DatePrefixMatch = {
  month: number;
  day: number;
  weekdayRaw: string;
  consumedChars: number;
};

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Calendar check without Date overflow normalization. */
export function isValidCivilDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1) return false;
  const dim =
    DAYS_IN_MONTH[month - 1]! + (month === 2 && isLeapYear(year) ? 1 : 0);
  return day <= dim;
}

export function koreanWeekdayForCivilDate(
  year: number,
  month: number,
  day: number,
): string {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `(${KOREAN_WEEKDAYS[dow]!})`;
}

function fromExec(m: RegExpExecArray): DatePrefixMatch {
  return {
    month: Number(m[1]),
    day: Number(m[2]),
    weekdayRaw: `(${m[3]})`,
    consumedChars: m[0].length,
  };
}

/** Prefix match so the same fragment may still hold a clock remainder. */
export function matchDatePrefix(text: string): DatePrefixMatch | null {
  const hyphen = HYPHEN_PREFIX.exec(text);
  if (hyphen) return fromExec(hyphen);
  const space = SPACE_PREFIX.exec(text);
  if (space) return fromExec(space);
  const glued = GLUED_PREFIX.exec(text);
  if (glued) return fromExec(glued);
  return null;
}

export function matchDateFromFragments(
  texts: string[],
  startIndex: number,
): { match: DatePrefixMatch; consumedFragments: number; remainder: string } | null {
  if (startIndex >= texts.length) return null;
  const first = texts[startIndex]!;
  const prefix = matchDatePrefix(first);
  if (prefix) {
    return {
      match: prefix,
      consumedFragments: 1,
      remainder: first.slice(prefix.consumedChars),
    };
  }

  const a = texts[startIndex];
  const b = texts[startIndex + 1];
  const c = texts[startIndex + 2];
  if (a != null && b != null) {
    const twoDigitWeek = new RegExp(`^[0-9]{2}\\((${WEEKDAY_INNER})\\)$`);
    if (/^[0-9]{2}$/.test(a) && twoDigitWeek.test(b)) {
      const joined = matchDatePrefix(`${a} ${b}`);
      if (joined) {
        return { match: joined, consumedFragments: 2, remainder: "" };
      }
    }
    const weekdayOnly = new RegExp(`^\\((${WEEKDAY_INNER})\\)$`);
    if (/^[0-9]{2}-[0-9]{2}$/.test(a) && weekdayOnly.test(b)) {
      const joined = matchDatePrefix(`${a}${b}`);
      if (joined) {
        return { match: joined, consumedFragments: 2, remainder: "" };
      }
    }
  }
  if (a != null && b != null && c != null) {
    const weekdayOnly = new RegExp(`^\\((${WEEKDAY_INNER})\\)$`);
    if (/^[0-9]{2}$/.test(a) && /^[0-9]{2}$/.test(b) && weekdayOnly.test(c)) {
      const joined = matchDatePrefix(`${a} ${b}${c}`);
      if (joined) {
        return { match: joined, consumedFragments: 3, remainder: "" };
      }
    }
  }
  return null;
}

export type DateAnchorHit = {
  startIndex: number;
  match: DatePrefixMatch;
  consumedFragments: number;
  remainder: string;
};

/**
 * Exact date-anchor candidates over fragment start indexes.
 * Unique selection is required; multiple hits fail closed.
 */
export function findDateAnchors(texts: string[]): DateAnchorHit[] {
  const hits: DateAnchorHit[] = [];
  for (let i = 0; i < texts.length; i++) {
    const hit = matchDateFromFragments(texts, i);
    if (!hit) continue;
    hits.push({
      startIndex: i,
      match: hit.match,
      consumedFragments: hit.consumedFragments,
      remainder: hit.remainder,
    });
  }
  return hits;
}
