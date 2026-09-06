import type { TimeParseStatus } from "./types";

const NON_ASCII = /[^\x00-\x7F]/;

export type TimeParseResult = {
  status: TimeParseStatus;
  hour: number | null;
  minute: number | null;
  rawParts: string[];
};

function clock(hour: number, minute: number): TimeParseStatus {
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return "INVALID_TIME";
  }
  return "PARSED_EXACT";
}

function exactResult(
  hour: number,
  minute: number,
  rawParts: string[],
): TimeParseResult {
  const status = clock(hour, minute);
  return {
    status,
    hour: status === "PARSED_EXACT" ? hour : null,
    minute: status === "PARSED_EXACT" ? minute : null,
    rawParts,
  };
}

/**
 * Exact ASCII clock forms only: HH:MM, HH MM, HHMM.
 * No character substitution. No Unicode digits.
 */
export function parseExactClock(text: string, rawParts: string[]): TimeParseResult {
  const colon = /^([0-9]{2}):([0-9]{2})$/.exec(text);
  if (colon) return exactResult(Number(colon[1]), Number(colon[2]), rawParts);
  const spaced = /^([0-9]{2}) ([0-9]{2})$/.exec(text);
  if (spaced) return exactResult(Number(spaced[1]), Number(spaced[2]), rawParts);
  const compact = /^([0-9]{2})([0-9]{2})$/.exec(text);
  if (compact && text.length === 4) {
    return exactResult(Number(compact[1]), Number(compact[2]), rawParts);
  }
  return { status: "TIME_NOT_FOUND", hour: null, minute: null, rawParts };
}

/**
 * Short digit-heavy token with a non-clock character in the time window.
 * Must not classify league/team fragments such as 돈J2리그.
 */
export function looksLikeCorruptedClock(text: string): boolean {
  const t = text.trim();
  if (t.length < 3 || t.length > 5) return false;
  const digits = (t.match(/[0-9]/g) ?? []).length;
  if (digits < 2) return false;
  return NON_ASCII.test(t) || /[A-Za-z]/.test(t);
}

function remainderAmbiguous(candidate: string): boolean {
  if (NON_ASCII.test(candidate)) return true;
  if (/[A-Za-z]/.test(candidate) && /[0-9]/.test(candidate)) return true;
  return looksLikeCorruptedClock(candidate);
}

/**
 * Parse clock only from the immediate post-date window.
 * Does not scan later odds-like fragments.
 */
export function parseImmediateTime(input: {
  remainder: string;
  followingTexts: string[];
}): TimeParseResult {
  const rem = input.remainder;
  if (rem.length > 0) {
    if (rem.trim() === "") {
      return parseImmediateTime({ remainder: "", followingTexts: input.followingTexts });
    }
    const candidate = rem.trimStart();
    const exact = parseExactClock(candidate, [rem]);
    if (exact.status !== "TIME_NOT_FOUND") return exact;
    if (remainderAmbiguous(candidate)) {
      return { status: "OCR_AMBIGUOUS", hour: null, minute: null, rawParts: [rem] };
    }
    return { status: "TIME_NOT_FOUND", hour: null, minute: null, rawParts: [rem] };
  }

  const a = input.followingTexts[0];
  const b = input.followingTexts[1];
  if (a == null) {
    return { status: "TIME_NOT_FOUND", hour: null, minute: null, rawParts: [] };
  }
  const one = parseExactClock(a, [a]);
  if (one.status !== "TIME_NOT_FOUND") return one;
  if (b != null && /^[0-9]{2}$/.test(a) && /^[0-9]{2}$/.test(b)) {
    return parseExactClock(`${a} ${b}`, [a, b]);
  }
  if (looksLikeCorruptedClock(a)) {
    return { status: "OCR_AMBIGUOUS", hour: null, minute: null, rawParts: [a] };
  }
  return { status: "TIME_NOT_FOUND", hour: null, minute: null, rawParts: [a] };
}
