import {
  findDateAnchors,
  isValidCivilDate,
  koreanWeekdayForCivilDate,
  matchDatePrefix,
  type DatePrefixMatch,
} from "../proto-round-row-anchor-schedule-v0/date";
import { parseImmediateTime } from "../proto-round-row-anchor-schedule-v0/time";
import type { OcrPassEvidenceV2 } from "./types";

const DOTTED =
  /^([0-9]{2})\.([0-9]{2})\((월|화|수|목|금|토|일)\)/;

function matchDotted(text: string): DatePrefixMatch | null {
  const dotted = DOTTED.exec(text);
  if (dotted) {
    return {
      month: Number(dotted[1]),
      day: Number(dotted[2]),
      weekdayRaw: `(${dotted[3]})`,
      consumedChars: dotted[0].length,
    };
  }
  return matchDatePrefix(text);
}

function tokensOf(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function parseDateTimeFromText(
  text: string,
  operatingDateKst: string,
): {
  targetDateKst: string | null;
  displayedStartKst: string | null;
  clockAmbiguous: boolean;
} {
  const tokens = tokensOf(text);
  const hits: Array<{
    match: DatePrefixMatch;
    startIndex: number;
    consumedFragments: number;
    remainder: string;
  }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const prefix = matchDotted(tokens[i]!);
    if (!prefix) continue;
    hits.push({
      match: prefix,
      startIndex: i,
      consumedFragments: 1,
      remainder: tokens[i]!.slice(prefix.consumedChars),
    });
  }
  for (const hit of findDateAnchors(tokens)) {
    if (hits.some((h) => h.startIndex === hit.startIndex)) continue;
    hits.push({
      match: hit.match,
      startIndex: hit.startIndex,
      consumedFragments: hit.consumedFragments,
      remainder: hit.remainder,
    });
  }
  if (hits.length !== 1) {
    return { targetDateKst: null, displayedStartKst: null, clockAmbiguous: false };
  }
  const year = Number(operatingDateKst.slice(0, 4));
  const hit = hits[0]!;
  if (!isValidCivilDate(year, hit.match.month, hit.match.day)) {
    return { targetDateKst: null, displayedStartKst: null, clockAmbiguous: false };
  }
  if (
    koreanWeekdayForCivilDate(year, hit.match.month, hit.match.day) !==
    hit.match.weekdayRaw
  ) {
    return { targetDateKst: null, displayedStartKst: null, clockAmbiguous: false };
  }
  const targetDateKst = `${year}-${String(hit.match.month).padStart(2, "0")}-${String(hit.match.day).padStart(2, "0")}`;
  const following = tokens.slice(hit.startIndex + hit.consumedFragments);
  const timeHit = parseImmediateTime({
    remainder: hit.remainder,
    followingTexts: following,
  });
  if (timeHit.status === "PARSED_EXACT" && timeHit.hour != null && timeHit.minute != null) {
    return {
      targetDateKst,
      displayedStartKst: `${String(timeHit.hour).padStart(2, "0")}:${String(timeHit.minute).padStart(2, "0")}`,
      clockAmbiguous: false,
    };
  }
  return {
    targetDateKst,
    displayedStartKst: null,
    clockAmbiguous: timeHit.status === "OCR_AMBIGUOUS",
  };
}

export function parseDateTimeFromPasses(
  passes: OcrPassEvidenceV2[],
  operatingDateKst: string,
): {
  targetDateKst: string | null;
  displayedStartKst: string | null;
  clockAmbiguous: boolean;
} {
  const parsed = passes.map((p) => parseDateTimeFromText(p.rawText, operatingDateKst));
  const dates = parsed.map((p) => p.targetDateKst).filter((d): d is string => d != null);
  const uniqueDates = [...new Set(dates)];
  const targetDateKst = uniqueDates.length === 1 ? uniqueDates[0]! : null;
  const clocks = parsed
    .map((p) => p.displayedStartKst)
    .filter((d): d is string => d != null);
  const uniqueClocks = [...new Set(clocks)];
  const displayedStartKst =
    uniqueClocks.length === 1 && clocks.length >= 1 ? uniqueClocks[0]! : null;
  return {
    targetDateKst,
    displayedStartKst,
    clockAmbiguous: parsed.some((p) => p.clockAmbiguous) && displayedStartKst == null,
  };
}
