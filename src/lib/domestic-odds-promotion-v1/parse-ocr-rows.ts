import type {
  ExtractionStatusV1,
  OcrGeometryLineV1,
  StructuredOddsRowV1,
} from "./types";
import { ROUND_IDENTITY_UNCERTAIN } from "./types";
import { parseScreenshotFilenameTimestamp } from "../proto-round-extraction-design-v0";
import { findCompetitionByOperatorLabel } from "../football/foundation/competition-registry";
import {
  findDateAnchors,
  isValidCivilDate,
  koreanWeekdayForCivilDate,
  matchDatePrefix,
  type DatePrefixMatch,
} from "../proto-round-row-anchor-schedule-v0/date";
import { parseImmediateTime } from "../proto-round-row-anchor-schedule-v0/time";
import { clusterPlacedLines } from "../proto-round-visual-rows-v0/cluster";
import {
  deriveBoxGeometry,
  isValidBoundingBox,
} from "../proto-round-visual-rows-v0/geometry";

const BOARD_RE = /^(\d{4})\b/;
const EXACT_BOARD_RE = /^[0-9]{4}$/;
const DOTTED_DATE_RE =
  /^([0-9]{2})\.([0-9]{2})\((월|화|수|목|금|토|일)\)/;
const DISPLAYED_DATE_RE =
  /([0-9]{2})[.\-\s]([0-9]{2})\((월|화|수|목|금|토|일)\)/;
const CLOCK_RE = /\d{1,2}:\d{2}/;
const MARKET_RE =
  /(승①패|승1패|SUM|H\s*[+-]\s*\d+(?:\.\d)?|U\s*\d+(?:\.\d)?|h\(전반\)|h\s*[HU]\s*[+-]?\s*\d+(?:\.\d)?)/u;
const ODDS_TOKEN_SOURCE = String.raw`(?:\d+\.\d{2}|-(?=\s|$))`;
const STATUS_RE = /경기전/;
const SPACED_MATCHUP_RE = /([^\s:]+)\s+:\s+([^\s]+)/;
const KNOWN_LEAGUES = new Set(["KBO", "NPB", "MLB"]);

function oddsTokenRe(): RegExp {
  return new RegExp(ODDS_TOKEN_SOURCE, "g");
}

function expandTokens(lines: OcrGeometryLineV1[]): string[] {
  return lines.flatMap((line) =>
    line.text
      .trim()
      .split(/\s+/)
      .filter((text) => text.length > 0),
  );
}

function matchDottedDatePrefix(text: string): DatePrefixMatch | null {
  const dotted = DOTTED_DATE_RE.exec(text);
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

function findDisplayedDate(tokens: string[]): {
  match: DatePrefixMatch;
  startIndex: number;
  consumedFragments: number;
  remainder: string;
} | null {
  const hits: Array<{
    match: DatePrefixMatch;
    startIndex: number;
    consumedFragments: number;
    remainder: string;
  }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const prefix = matchDottedDatePrefix(tokens[i]!);
    if (!prefix) continue;
    hits.push({
      match: prefix,
      startIndex: i,
      consumedFragments: 1,
      remainder: tokens[i]!.slice(prefix.consumedChars),
    });
  }
  for (const hit of findDateAnchors(tokens)) {
    if (hits.some((existing) => existing.startIndex === hit.startIndex)) continue;
    hits.push({
      match: hit.match,
      startIndex: hit.startIndex,
      consumedFragments: hit.consumedFragments,
      remainder: hit.remainder,
    });
  }
  if (hits.length !== 1) return null;
  return hits[0]!;
}

export function clusterOcrLinesByGeometry(
  lines: OcrGeometryLineV1[],
): OcrGeometryLineV1[][] {
  const placed = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.text.trim() || !isValidBoundingBox(line.boundingBox)) continue;
    placed.push({
      rawLineIndex: i,
      rawText: line.text,
      ...deriveBoxGeometry(line.boundingBox, null),
    });
  }
  return clusterPlacedLines(placed).map((cluster) =>
    [...cluster]
      .sort((a, b) => (a.x !== b.x ? a.x - b.x : a.rawLineIndex - b.rawLineIndex))
      .map((member) => lines[member.rawLineIndex]!),
  );
}

function parseMatchup(joined: string): { home: string; away: string } | null {
  const withoutClock = joined.replace(new RegExp(CLOCK_RE.source, "g"), " ");
  const match = SPACED_MATCHUP_RE.exec(withoutClock);
  if (!match?.[1] || !match[2]) return null;
  return { home: match[1], away: match[2] };
}

function parseOddsTokens(text: string): {
  raw: string | null;
  values: number[] | null;
  status: ExtractionStatusV1;
} {
  const tokens = text.match(oddsTokenRe());
  if (!tokens || tokens.length === 0) {
    return { raw: null, values: null, status: "INSUFFICIENT_EVIDENCE" };
  }
  const raw = tokens.join(" ");
  const values: number[] = [];
  let dashCount = 0;
  for (const token of tokens) {
    if (token === "-") {
      dashCount += 1;
      continue;
    }
    if (!/^\d+\.\d{2}$/.test(token)) {
      return { raw, values: null, status: "SOURCE_UNREADABLE" };
    }
    values.push(Number(token));
  }
  if (values.length < 2) {
    return { raw, values: null, status: "SOURCE_UNREADABLE" };
  }
  if (dashCount > 0 && values.length !== 2) {
    return { raw, values: null, status: "SOURCE_UNREADABLE" };
  }
  return { raw, values, status: "PARSED" };
}

function civilDate(
  operatingDateKst: string,
  month: number,
  day: number,
): string | null {
  const year = Number(operatingDateKst.slice(0, 4));
  if (!isValidCivilDate(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function pickBoard(joined: string, tokens: string[]): string | null {
  const fromJoin = BOARD_RE.exec(joined)?.[1];
  if (fromJoin) return fromJoin;
  const exact = tokens.filter((token) => EXACT_BOARD_RE.test(token));
  return exact.length === 1 ? exact[0]! : null;
}

function pickCompetition(joined: string, tokens: string[]): string | null {
  for (const token of tokens) {
    if (KNOWN_LEAGUES.has(token)) return token;
    if (findCompetitionByOperatorLabel(token)) return token;
  }
  const leagueChunk = joined
    .replace(BOARD_RE, " ")
    .replace(DISPLAYED_DATE_RE, " ")
    .replace(new RegExp(CLOCK_RE.source, "g"), " ")
    .replace(MARKET_RE, " ")
    .replace(SPACED_MATCHUP_RE, " ")
    .replace(STATUS_RE, " ")
    .replace(oddsTokenRe(), " ")
    .trim();
  const first = leagueChunk.split(/\s+/).filter(Boolean)[0] ?? null;
  if (first && (KNOWN_LEAGUES.has(first) || findCompetitionByOperatorLabel(first))) {
    return first;
  }
  return first && !/^\d/.test(first) ? first : null;
}

function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseClusteredRow(input: {
  operatingDateKst: string;
  claimedRound: number | null;
  sourceFile: string;
  sourceSha256: string;
  fileMtimeUtc: string | null;
  operatorObservedAtUtc: string;
  sourceProvenance: StructuredOddsRowV1["sourceProvenance"];
  lines: OcrGeometryLineV1[];
}): StructuredOddsRowV1 {
  const joined = input.lines
    .map((line) => line.text.trim())
    .filter((text) => text.length > 0)
    .join(" ");
  const tokens = expandTokens(input.lines);
  const filenameTs = parseScreenshotFilenameTimestamp(input.sourceFile);
  const board = pickBoard(joined, tokens);
  const dateHit = findDisplayedDate(tokens);
  const year = Number(input.operatingDateKst.slice(0, 4));
  let targetDateKst: string | null = null;
  let displayedStartKst: string | null = null;
  const extraReject: string[] = [];
  if (dateHit && isValidCivilDate(year, dateHit.match.month, dateHit.match.day)) {
    targetDateKst = civilDate(
      input.operatingDateKst,
      dateHit.match.month,
      dateHit.match.day,
    );
    if (
      koreanWeekdayForCivilDate(year, dateHit.match.month, dateHit.match.day) !==
      dateHit.match.weekdayRaw
    ) {
      extraReject.push("WEEKDAY_MISMATCH");
    }
    const following = tokens.slice(dateHit.startIndex + dateHit.consumedFragments);
    const timeHit = parseImmediateTime({
      remainder: dateHit.remainder,
      followingTexts: following,
    });
    if (timeHit.status === "PARSED_EXACT" && timeHit.hour != null && timeHit.minute != null) {
      displayedStartKst = formatClock(timeHit.hour, timeHit.minute);
    } else if (timeHit.status === "OCR_AMBIGUOUS") {
      extraReject.push("DISPLAYED_CLOCK_OCR_AMBIGUOUS");
    }
  }
  const market = MARKET_RE.exec(joined)?.[1]?.replaceAll(" ", "") ?? null;
  const matchup = parseMatchup(joined);
  const home = matchup?.home ?? null;
  const away = matchup?.away ?? null;
  const statusLabel = STATUS_RE.test(joined) ? "경기전" : null;
  const oddsHaystack = joined
    .replace(DISPLAYED_DATE_RE, " ")
    .replace(new RegExp(CLOCK_RE.source, "g"), " ")
    .replace(BOARD_RE, " ")
    .replace(STATUS_RE, " ")
    .replace(MARKET_RE, " ");
  const odds = parseOddsTokens(oddsHaystack);
  const competitionRawLabel = pickCompetition(joined, tokens);

  let extractionStatus: ExtractionStatusV1 = "INSUFFICIENT_EVIDENCE";
  let extractionConfidence: StructuredOddsRowV1["extractionConfidence"] = "NONE";
  if (
    board &&
    targetDateKst &&
    displayedStartKst &&
    home &&
    away &&
    odds.status === "PARSED"
  ) {
    extractionStatus = "PARSED";
    extractionConfidence = "HIGH";
  } else if (board && (odds.status === "SOURCE_UNREADABLE" || (home && away))) {
    extractionStatus =
      odds.status === "SOURCE_UNREADABLE" ? "SOURCE_UNREADABLE" : "INSUFFICIENT_EVIDENCE";
    extractionConfidence = "LOW";
  } else if (board && targetDateKst) {
    extractionStatus = "INSUFFICIENT_EVIDENCE";
    extractionConfidence = "LOW";
  }

  const rejectionReason = [
    "VERIFIED_CAPTURE_TIME_ABSENT",
    "VERIFIED_PROVIDER_TIME_ABSENT",
    "ROUND_IDENTITY_UNCERTAIN",
    "PREDICTION_INPUT_NOT_PROMOTED",
    ...extraReject,
  ];
  if (extractionStatus !== "PARSED") {
    rejectionReason.unshift(`EXTRACTION_${extractionStatus}`);
  }

  return {
    operatingDateKst: input.operatingDateKst,
    claimedRound: input.claimedRound,
    roundIdentityStatus: ROUND_IDENTITY_UNCERTAIN,
    sourceType: "MANUAL_SCREENSHOT",
    sourceFile: input.sourceFile,
    sourceSha256: input.sourceSha256,
    boardGameNumber: board,
    competitionRawLabel,
    homeRawName: home,
    awayRawName: away,
    marketRaw: market,
    rawOddsText: odds.raw,
    parsedOddsValues: odds.values,
    extractionStatus,
    extractionConfidence,
    targetDateKst,
    displayedStartKst,
    screenVisibleStatusLabel: statusLabel,
    fileMtimeUtc: input.fileMtimeUtc,
    filenameTimestampCandidateKst: filenameTs.filenameTimestampCandidateKst,
    filenameTimestampCandidateUtc: filenameTs.filenameTimestampCandidateUtc,
    operatorObservedAtUtc: input.operatorObservedAtUtc,
    verifiedCaptureTime: null,
    verifiedProviderTime: null,
    sourceProvenance: input.sourceProvenance,
    canonicalFixtureId: null,
    joinStatus: extractionStatus === "SOURCE_UNREADABLE"
      ? "SOURCE_UNREADABLE"
      : "IDENTITY_REVIEW_REQUIRED",
    predictionInputAllowed: false,
    rejectionReason,
  };
}

export function parseOcrImageToRows(input: {
  operatingDateKst: string;
  claimedRound: number | null;
  sourceFile: string;
  sourceSha256: string;
  fileMtimeUtc: string | null;
  operatorObservedAtUtc: string;
  sourceProvenance: StructuredOddsRowV1["sourceProvenance"];
  lines: OcrGeometryLineV1[];
}): StructuredOddsRowV1[] {
  return clusterOcrLinesByGeometry(input.lines)
    .filter((cluster) =>
      cluster.some(
        (line) =>
          BOARD_RE.test(line.text.trim()) || EXACT_BOARD_RE.test(line.text.trim()),
      ),
    )
    .map((lines) =>
      parseClusteredRow({
        ...input,
        lines,
      }),
    );
}
