/**
 * Proto-round row-anchor + schedule v0 tests.
 * Deterministic synthetic fragments only. No OCR engine. Network: 0.
 *
 *   npm run test:proto-round-row-anchor-schedule-v0
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RawOcrDocumentV0 } from "../src/lib/proto-round-raw-ocr-v0";
import type {
  VisualRowCandidateV0,
  VisualRowsDocumentV0,
} from "../src/lib/proto-round-visual-rows-v0";
import {
  PARSER_ACCURACY_PERCENT,
  ROW_IDENTIFIER_SCOPE,
  RowAnchorScheduleLineageError,
  YEAR_CONTEXT_SOURCE_JOIN,
  buildFilenameDateContextBySha256,
  isValidCivilDate,
  koreanWeekdayForCivilDate,
  matchDatePrefix,
  parseExactClock,
  parseImmediateTime,
  parseRowAnchorSchedule,
  parseRowIdentifierCandidate,
  resolveScheduleYear,
  type ScheduleYearContext,
} from "../src/lib/proto-round-row-anchor-schedule-v0";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function filenameYearContext(
  year: number,
  month: number,
  day: number,
): ScheduleYearContext {
  return {
    sourceFilenameYear: year,
    sourceFilenameMonth: month,
    sourceFilenameDay: day,
    sourceFilenameTimestampCandidateKst: `${year}-${pad2(month)}-${pad2(day)}T10:52:22+09:00`,
    sourceFilenameTimestampParseStatus: "PARSED_EXACT_PATTERN",
  };
}

const YEAR_2026_09_06 = filenameYearContext(2026, 9, 6);

const YEAR_UNAVAILABLE: ScheduleYearContext = {
  sourceFilenameYear: null,
  sourceFilenameMonth: null,
  sourceFilenameDay: null,
  sourceFilenameTimestampCandidateKst: null,
  sourceFilenameTimestampParseStatus: null,
};

function syntheticRow(texts: string[]): VisualRowCandidateV0 {
  return {
    sourceImageSha256: "sha-test",
    sourceFileName: "synthetic.png",
    visualRowIndex: 0,
    topY: 0,
    bottomY: 10,
    centerY: 5,
    normalizedTopY: null,
    normalizedBottomY: null,
    fragmentCount: texts.length,
    fragments: texts.map((rawText, i) => ({
      rawLineIndex: i,
      rawText,
      boundingBox: { x: i * 10, y: 0, width: 8, height: 8 },
      x: i * 10,
      y: 0,
      width: 8,
      height: 8,
    })),
    visualJoinedTextCandidate: texts.join(" "),
    semanticStatus: "UNINTERPRETED",
    officialOddsStatus: "NOT_EXTRACTED",
    gameMatchStatus: "NOT_MATCHED",
  };
}

function parse(texts: string[], yearContext: ScheduleYearContext = YEAR_2026_09_06) {
  return parseRowAnchorSchedule(syntheticRow(texts), yearContext);
}

function sourceFiles(): string[] {
  const lib = path.join(
    process.cwd(),
    "src/lib/proto-round-row-anchor-schedule-v0",
  );
  const scripts = [
    path.join(process.cwd(), "scripts/build-proto-round-row-anchor-schedule-v0.ts"),
  ];
  return [
    ...readdirSync(lib)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(lib, f)),
    ...scripts,
  ];
}

function emptyVisual(shas: string[]): VisualRowsDocumentV0 {
  return {
    meta: {
      schemaVersion: "proto-round-visual-rows-v0",
      protoRoundKey: "2026-105",
      year: 2026,
      round: 105,
      sourceRawOcrSchema: "proto-round-raw-ocr-v0",
      sourceImages: shas.length,
      rowClusterMethod: "VERTICAL_OVERLAP_RATIO",
      verticalOverlapThreshold: 0.5,
      providerLineOrderUsed: false,
      geometrySortUsed: true,
      rowClusterRulePredefinedBeforeResults: true,
      postHocGeometryTuning: false,
      semanticParsing: "NOT_PERFORMED",
      officialOddsExtraction: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageRowDedupe: "DISABLED",
      captureSequenceRule: "NEEDS_PREREGISTRATION",
      acceptedObservationTimes: "NOT_ASSIGNED",
      filenameTimestampUsedAsCapturedAt: false,
      fourDigitTokenSemanticRole: "UNASSIGNED",
      marketSignalSemanticsAssigned: false,
    },
    images: shas.map((sha) => ({
      sourceImageSha256: sha,
      sourceFileName: `${sha}.png`,
      acceptedObservationTime: null,
      observationTimeProvenance: null,
      imageWidth: null,
      imageHeight: null,
      placedLineCount: 0,
      unplacedLineCount: 0,
      visualRowCandidateCount: 0,
      unplacedLines: [],
      visualRows: [],
    })),
  };
}

function emptyOcr(shas: string[]): RawOcrDocumentV0 {
  return {
    meta: {
      schemaVersion: "proto-round-raw-ocr-v0",
      protoRoundKey: "2026-105",
      year: 2026,
      round: 105,
      sourceCanonicalImages: shas.length,
      ocrProvider: "MOCK",
      ocrProviderVersion: "test",
      ocrLanguages: ["ko"],
      networkUsed: false,
      officialOddsExtraction: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageRowDedupe: "DISABLED",
      captureSequenceRule: "NEEDS_PREREGISTRATION",
      acceptedObservationTimes: "NOT_ASSIGNED",
      filenameTimestampUsedAsCapturedAt: false,
      filesystemTimeUsedAsCapturedAt: false,
      autoMergeWithNullTime: false,
      ocrLineOrderUsedAsRowStructure: false,
      ocrAccuracyPercent: "NOT_MEASURABLE_YET",
    },
    images: shas.map((sha) => ({
      sourceImageSha256: sha,
      sourceFileName: `${sha}.png`,
      protoRoundKey: "2026-105",
      year: 2026,
      round: 105,
      filenameTimestampCandidateKst: "2026-09-06T10:52:22+09:00",
      filenameTimestampCandidateUtc: "2026-09-06T01:52:22.000Z",
      filenameTimestampParseStatus: "PARSED_EXACT_PATTERN",
      candidateProvenance: "FILENAME_OS_GENERATED_CANDIDATE",
      acceptedObservationTime: null,
      observationTimeProvenance: null,
      ocrProvider: "MOCK",
      ocrLanguage: ["ko"],
      ocrStatus: "OCR_OK",
      rawText: "",
      rawLines: [],
      lineCount: 0,
      nonWhitespaceCharacterCount: 0,
      AUTO_MERGE_ELIGIBLE: false,
      errorCode: null,
    })),
  };
}

async function main() {
  assert.equal(ROW_IDENTIFIER_SCOPE, "PRE_DATE_ANCHOR_ONLY");
  assert.equal(YEAR_CONTEXT_SOURCE_JOIN, "SOURCE_IMAGE_SHA256");

  // Primitive identifier regex
  const one = parseRowIdentifierCandidate(["9413"]);
  assert.equal(one.status, "EXACT_ONE");
  assert.equal(one.raw, "9413");
  assert.equal(one.candidate, 9413);
  assert.equal(parseRowIdentifierCandidate(["9413abc"]).status, "NONE");
  assert.equal(parseRowIdentifierCandidate(["94I3"]).status, "NONE");
  assert.equal(parseRowIdentifierCandidate(["(9413)"]).status, "NONE");
  assert.equal(parseRowIdentifierCandidate(["9413", "x", "1234"]).status, "MULTIPLE");

  // Positional identifier contract
  const a = parse(["9413", "09-06(일)", "11", "30"]);
  assert.equal(a.rowIdentifierParseStatus, "EXACT_ONE");
  assert.equal(a.rowIdentifierCandidate, 9413);

  const b = parse(["9571", "09 06(일)", "1945"]);
  assert.equal(b.rowIdentifierParseStatus, "EXACT_ONE");
  assert.equal(b.rowIdentifierCandidate, 9571);
  assert.equal(b.displayedHour, 19);
  assert.equal(b.displayedMinute, 45);
  assert.notEqual(b.rowIdentifierCandidate, 1945);

  const c = parse(["9413", "9420", "09-06(일)", "11", "30"]);
  assert.equal(c.rowIdentifierParseStatus, "MULTIPLE");
  assert.equal(c.rowIdentifierCandidate, null);
  assert.equal(c.displayedHour, 11);
  assert.equal(c.displayedMinute, 30);

  const d = parse(["09-06(일)", "1130"]);
  assert.equal(d.rowIdentifierParseStatus, "NONE");
  assert.equal(d.rowIdentifierCandidate, null);
  assert.equal(d.displayedHour, 11);
  assert.equal(d.displayedMinute, 30);

  const e = parse(["94I3", "09-06(일)", "1130"]);
  assert.equal(e.rowIdentifierParseStatus, "NONE");

  const f = parse(["9413abc", "09-06(일)", "1130"]);
  assert.equal(f.rowIdentifierParseStatus, "NONE");

  // Date exact forms
  for (const [text, month, day, weekday] of [
    ["09-06(일)", 9, 6, "(일)"],
    ["09 06(일)", 9, 6, "(일)"],
    ["0907(월)", 9, 7, "(월)"],
    ["09 07(월)", 9, 7, "(월)"],
  ] as const) {
    const hit = matchDatePrefix(text);
    assert.ok(hit, text);
    assert.equal(hit!.month, month);
    assert.equal(hit!.day, day);
    assert.equal(hit!.weekdayRaw, weekday);
    assert.equal(isValidCivilDate(2026, month, day), true);
  }

  assert.equal(isValidCivilDate(2026, 2, 30), false);
  assert.equal(isValidCivilDate(2026, 13, 1), false);
  assert.equal(isValidCivilDate(2026, 0, 10), false);
  assert.equal(parse(["9413", "02-30(일)", "11", "30"]).dateParseStatus, "INVALID_DATE");
  assert.equal(parse(["9413", "13-01(월)", "11", "30"]).dateParseStatus, "INVALID_DATE");
  assert.equal(parse(["9413", "00-10(일)", "11", "30"]).dateParseStatus, "INVALID_DATE");

  assert.equal(matchDatePrefix("09 06{일)"), null);
  assert.equal(matchDatePrefix("O9 06(일)"), null);
  assert.equal(matchDatePrefix("09-0G(일)"), null);
  const malformed = parse(["9413", "09 06{일)", "11", "30"]);
  assert.equal(malformed.dateParseStatus, "DATE_NOT_FOUND");
  assert.equal(malformed.rowIdentifierParseStatus, "NONE");
  assert.equal(parse(["9413", "O9 06(일)", "11", "30"]).dateParseStatus, "DATE_NOT_FOUND");

  // Time accept
  const acceptTimes = [
    ["19:00", 19, 0],
    ["19 00", 19, 0],
    ["1900", 19, 0],
    ["03 45", 3, 45],
    ["0345", 3, 45],
    ["00 15", 0, 15],
    ["0015", 0, 15],
    ["01 30", 1, 30],
    ["0130", 1, 30],
    ["07 20", 7, 20],
    ["0720", 7, 20],
  ] as const;
  for (const [text, hour, minute] of acceptTimes) {
    const hit = parseExactClock(text, [text]);
    assert.equal(hit.status, "PARSED_EXACT", text);
    assert.equal(hit.hour, hour);
    assert.equal(hit.minute, minute);
  }

  const rejectOcr = ["17고0", "1寸00", "0卍30", "0한15", "07고0", "0로45", "13T0"];
  for (const text of rejectOcr) {
    const hit = parseImmediateTime({ remainder: text, followingTexts: [] });
    assert.equal(hit.status, "OCR_AMBIGUOUS", text);
    assert.equal(hit.hour, null);
    assert.equal(hit.minute, null);
    assert.equal(hit.rawParts[0], text);
  }

  assert.equal(parseExactClock("24:00", ["24:00"]).status, "INVALID_TIME");
  assert.equal(parseExactClock("2360", ["2360"]).status, "INVALID_TIME");
  assert.equal(parseExactClock("99 99", ["99 99"]).status, "INVALID_TIME");

  // Positional false-positive
  const positional = parse([
    "9413",
    "09-06(일)",
    "11",
    "30",
    "TEAM",
    "2",
    "60",
  ]);
  assert.equal(positional.rowIdentifierCandidate, 9413);
  assert.equal(positional.displayedHour, 11);
  assert.equal(positional.displayedMinute, 30);
  assert.equal(positional.scheduledLocalCandidate, "2026-09-06T11:30:00+09:00");
  assert.equal(positional.scheduledUtcCandidate, "2026-09-06T02:30:00.000Z");
  assert.equal(positional.scheduleParseStatus, "PARSED_EXACT");
  assert.notEqual(positional.displayedHour, 2);
  assert.notEqual(positional.displayedMinute, 60);

  const ignoreOdds = parse([
    "9505",
    "09 06(일)",
    "18",
    "00",
    "TEAM",
    "320",
    "355",
  ]);
  assert.equal(ignoreOdds.displayedHour, 18);
  assert.equal(ignoreOdds.displayedMinute, 0);
  assert.equal(ignoreOdds.scheduledLocalCandidate, "2026-09-06T18:00:00+09:00");
  assert.notEqual(ignoreOdds.displayedHour, 3);

  const joined = parse(["9413", "09-06(일) 11 30", "2-09", "2 60!"]);
  assert.equal(joined.scheduleParseStatus, "PARSED_EXACT");
  assert.equal(joined.displayedHour, 11);
  assert.equal(joined.displayedMinute, 30);
  assert.equal(joined.fragments[2]!.rawText, "2-09");

  const glued = parse(["9663", "0907(월)0130", "TEAM"]);
  assert.equal(glued.scheduleParseStatus, "PARSED_EXACT");
  assert.equal(glued.rowIdentifierCandidate, 9663);
  assert.equal(glued.displayedHour, 1);
  assert.equal(glued.displayedMinute, 30);
  assert.equal(glued.scheduledLocalCandidate, "2026-09-07T01:30:00+09:00");

  const compactFollow = parse(["9413", "09-06(일)", "1900", "320", "355"]);
  assert.equal(compactFollow.rowIdentifierParseStatus, "EXACT_ONE");
  assert.equal(compactFollow.rowIdentifierCandidate, 9413);
  assert.equal(compactFollow.displayedHour, 19);
  assert.equal(compactFollow.displayedMinute, 0);

  // OCR ambiguous; raw unchanged
  const ocrRow = parse(["9422", "09 06(일) 13고0", "돈J2리그"]);
  assert.equal(ocrRow.dateParseStatus, "PARSED_EXACT");
  assert.equal(ocrRow.timeParseStatus, "OCR_AMBIGUOUS");
  assert.equal(ocrRow.scheduleParseStatus, "OCR_AMBIGUOUS");
  assert.equal(ocrRow.displayedHour, null);
  assert.equal(ocrRow.scheduledLocalCandidate, null);
  assert.equal(ocrRow.fragments[1]!.rawText, "09 06(일) 13고0");
  assert.equal(ocrRow.fragments[2]!.rawText, "돈J2리그");

  const hangulTime = parse(["9635", "0907(월)0한15"]);
  assert.equal(hangulTime.timeParseStatus, "OCR_AMBIGUOUS");
  assert.equal(hangulTime.fragments[1]!.rawText, "0907(월)0한15");

  const tClock = parse(["9421", "09 06(일) 13T0"]);
  assert.equal(tClock.timeParseStatus, "OCR_AMBIGUOUS");
  assert.equal(tClock.scheduledLocalCandidate, null);

  const leagueFollow = parseImmediateTime({
    remainder: "",
    followingTexts: ["돈J2리그", "C시포로"],
  });
  assert.equal(leagueFollow.status, "TIME_NOT_FOUND");

  // Weekday
  assert.equal(koreanWeekdayForCivilDate(2026, 9, 6), "(일)");
  assert.equal(koreanWeekdayForCivilDate(2026, 9, 7), "(월)");
  const sun = parse(["9413", "09-06(일)", "11", "30"]);
  assert.equal(sun.scheduleParseStatus, "PARSED_EXACT");
  const mismatch = parse(["9413", "09-06(월)", "11", "30"]);
  assert.equal(mismatch.dateParseStatus, "WEEKDAY_MISMATCH");
  assert.equal(mismatch.scheduledLocalCandidate, null);
  const mon = parse(["9413", "09-07(월)", "11", "30"]);
  assert.equal(mon.scheduleParseStatus, "PARSED_EXACT");
  assert.equal(mon.scheduledLocalCandidate, "2026-09-07T11:30:00+09:00");

  // Year context from filename date candidate
  const sepSame = resolveScheduleYear(9, filenameYearContext(2026, 9, 6));
  assert.equal(sepSame.year, 2026);
  assert.equal(sepSame.ambiguous, false);

  const sepToOct = resolveScheduleYear(10, filenameYearContext(2026, 9, 30));
  assert.equal(sepToOct.year, 2026);
  assert.equal(sepToOct.ambiguous, false);
  const octRow = parse(["9413", "10-01(목)", "11", "30"], filenameYearContext(2026, 9, 30));
  assert.equal(octRow.scheduleParseStatus, "PARSED_EXACT");
  assert.equal(octRow.scheduledLocalCandidate, "2026-10-01T11:30:00+09:00");
  assert.equal(octRow.scheduleYearContextYear, 2026);
  assert.equal(octRow.scheduleYearContextMonth, 9);

  const decJan = resolveScheduleYear(1, filenameYearContext(2026, 12, 31));
  assert.equal(decJan.ambiguous, true);
  assert.equal(decJan.year, null);
  const decJanRow = parse(["9413", "01-01(목)", "11", "30"], filenameYearContext(2026, 12, 31));
  assert.equal(decJanRow.dateParseStatus, "YEAR_CONTEXT_AMBIGUOUS");
  assert.equal(decJanRow.scheduledLocalCandidate, null);
  assert.equal(decJanRow.scheduledUtcCandidate, null);
  assert.equal(decJanRow.acceptedObservationTime, null);

  const janDec = resolveScheduleYear(12, filenameYearContext(2026, 1, 1));
  assert.equal(janDec.ambiguous, true);
  const janDecRow = parse(["9413", "12-31(목)", "11", "30"], filenameYearContext(2026, 1, 1));
  assert.equal(janDecRow.dateParseStatus, "YEAR_CONTEXT_AMBIGUOUS");
  assert.equal(janDecRow.scheduledLocalCandidate, null);

  const missing = resolveScheduleYear(9, YEAR_UNAVAILABLE);
  assert.equal(missing.ambiguous, true);
  const missingRow = parse(["9413", "09-06(일)", "11", "30"], YEAR_UNAVAILABLE);
  assert.equal(missingRow.dateParseStatus, "YEAR_CONTEXT_AMBIGUOUS");
  assert.equal(missingRow.scheduledLocalCandidate, null);

  // SHA lineage join
  const okMap = buildFilenameDateContextBySha256({
    visual: emptyVisual(["sha-a", "sha-b"]),
    ocr: emptyOcr(["sha-a", "sha-b"]),
  });
  assert.equal(okMap.size, 2);
  assert.equal(okMap.get("sha-a")?.sourceFilenameYear, 2026);
  assert.equal(okMap.get("sha-a")?.sourceFilenameMonth, 9);

  assert.throws(
    () =>
      buildFilenameDateContextBySha256({
        visual: emptyVisual(["sha-a"]),
        ocr: emptyOcr(["sha-missing"]),
      }),
    (err: unknown) =>
      err instanceof RowAnchorScheduleLineageError &&
      err.code === "MISSING_FILENAME_CONTEXT_SHA",
  );
  assert.throws(
    () =>
      buildFilenameDateContextBySha256({
        visual: emptyVisual(["sha-a"]),
        ocr: emptyOcr(["sha-a", "sha-extra"]),
      }),
    (err: unknown) =>
      err instanceof RowAnchorScheduleLineageError &&
      err.code === "UNKNOWN_FILENAME_CONTEXT_SHA",
  );
  const dupOcr = emptyOcr(["sha-a"]);
  dupOcr.images.push({ ...dupOcr.images[0]! });
  assert.throws(
    () =>
      buildFilenameDateContextBySha256({
        visual: emptyVisual(["sha-a"]),
        ocr: dupOcr,
      }),
    (err: unknown) =>
      err instanceof RowAnchorScheduleLineageError &&
      err.code === "DUPLICATE_YEAR_CONTEXT_SHA",
  );
  const keyMismatch = emptyOcr(["sha-a"]);
  keyMismatch.meta.protoRoundKey = "2026-999";
  assert.throws(
    () =>
      buildFilenameDateContextBySha256({
        visual: emptyVisual(["sha-a"]),
        ocr: keyMismatch,
      }),
    (err: unknown) =>
      err instanceof RowAnchorScheduleLineageError &&
      err.code === "YEAR_CONTEXT_PROTO_ROUND_KEY_MISMATCH",
  );

  // Observation time stays null; filename time is not observation time
  assert.equal(sun.acceptedObservationTime, null);
  assert.equal(sun.observationTimeProvenance, null);
  assert.equal(sun.scheduleYearContextProvenance, "SOURCE_FILENAME_DATE_CANDIDATE");
  assert.equal(sun.semanticScope, "ROW_IDENTIFIER_AND_SCHEDULE_ONLY");
  assert.equal(sun.teamParsingStatus, "NOT_PERFORMED");
  assert.equal(sun.marketParsingStatus, "NOT_PERFORMED");
  assert.equal(sun.oddsParsingStatus, "NOT_PERFORMED");
  assert.equal(sun.gameMatchingStatus, "NOT_PERFORMED");
  assert.equal("gameNumber" in sun, false);
  assert.equal("capturedAt" in sun, false);
  assert.equal(PARSER_ACCURACY_PERCENT, "NOT_MEASURABLE_YET");

  const files = sourceFiles();
  assert.ok(files.length >= 8);
  for (const abs of files) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("고 →"), false, abs);
    assert.equal(src.includes("寸 →"), false, abs);
    assert.equal(src.includes("卍 →"), false, abs);
    assert.equal(src.includes("한 →"), false, abs);
    assert.equal(src.includes("로 →"), false, abs);
    assert.equal(src.includes("homeOdds"), false, abs);
    assert.equal(src.includes("drawOdds"), false, abs);
    assert.equal(src.includes("awayOdds"), false, abs);
    assert.equal(src.includes("parseTeam"), false, abs);
    assert.equal(src.includes("parseLeague"), false, abs);
    assert.equal(src.includes("matchedKickoff"), false, abs);
  }

  console.log("proto-round-row-anchor-schedule-v0 tests passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
