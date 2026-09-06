/**
 * Proto-round column layout audit v0 tests.
 * Synthetic geometry only. No OCR engine. Network: 0.
 *
 *   npm run test:proto-round-column-layout-audit-v0
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RowAnchorScheduleDocumentV0 } from "../src/lib/proto-round-row-anchor-schedule-v0";
import type {
  VisualRowCandidateV0,
  VisualRowFragmentV0,
  VisualRowsDocumentV0,
} from "../src/lib/proto-round-visual-rows-v0";
import {
  AUDIT_DISCOVERY_PARAMETERS_ONLY,
  COLUMN_LAYOUT_AUDIT_SCOPE,
  ColumnLayoutLineageError,
  DISCOVERED_BANDS_ARE_PRODUCTION_CONTRACT,
  GEOMETRY_BASIS,
  FIELD_BOUNDARY_OUTCOME_TUNING,
  LAYOUT_DISCOVERY_BIN_WIDTH,
  LAYOUT_DISCOVERY_MIN_MODE_SHARE,
  REGION_SEMANTIC_ROLE_ASSIGNED,
  ROUND_105_COUNT_SPECIAL_CASE,
  SEMANTIC_REGION_CONTRACT_FROZEN,
  buildColumnLayoutAuditDocumentV0,
  classifyNumericRawShape,
  classifyTokenShape,
  joinVisualAndAnchorRows,
  layoutFragmentFromVisual,
  looksLikeUnrepairedOddsRaw,
  normalizeX,
  rowKey,
} from "../src/lib/proto-round-column-layout-audit-v0";

function frag(
  rawText: string,
  x: number,
  width: number,
  rawLineIndex: number,
): VisualRowFragmentV0 {
  return {
    rawLineIndex,
    rawText,
    boundingBox: { x, y: 10, width, height: 10 },
    x,
    y: 10,
    width,
    height: 10,
  };
}

function visualRow(input: {
  sha: string;
  fileName: string;
  index: number;
  fragments: VisualRowFragmentV0[];
}): VisualRowCandidateV0 {
  const sorted = [...input.fragments].sort((a, b) => a.x - b.x);
  return {
    sourceImageSha256: input.sha,
    sourceFileName: input.fileName,
    visualRowIndex: input.index,
    topY: 10,
    bottomY: 20,
    centerY: 15,
    normalizedTopY: null,
    normalizedBottomY: null,
    fragmentCount: sorted.length,
    fragments: sorted,
    visualJoinedTextCandidate: sorted.map((f) => f.rawText).join(" "),
    semanticStatus: "UNINTERPRETED",
    officialOddsStatus: "NOT_EXTRACTED",
    gameMatchStatus: "NOT_MATCHED",
  };
}

function visualDoc(
  images: Array<{
    sha: string;
    fileName: string;
    width: number;
    rows: VisualRowCandidateV0[];
  }>,
): VisualRowsDocumentV0 {
  return {
    meta: {
      schemaVersion: "proto-round-visual-rows-v0",
      protoRoundKey: "2026-105",
      year: 2026,
      round: 105,
      sourceRawOcrSchema: "proto-round-raw-ocr-v0",
      sourceImages: images.length,
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
    images: images.map((img) => ({
      sourceImageSha256: img.sha,
      sourceFileName: img.fileName,
      acceptedObservationTime: null,
      observationTimeProvenance: null,
      imageWidth: img.width,
      imageHeight: 1000,
      placedLineCount: img.rows.reduce((s, r) => s + r.fragmentCount, 0),
      unplacedLineCount: 0,
      visualRowCandidateCount: img.rows.length,
      unplacedLines: [],
      visualRows: img.rows,
    })),
  };
}

function semanticRow(
  visual: VisualRowCandidateV0,
  overrides?: Partial<RowAnchorScheduleDocumentV0["rows"][number]>,
): RowAnchorScheduleDocumentV0["rows"][number] {
  return {
    sourceImageSha256: visual.sourceImageSha256,
    sourceFileName: visual.sourceFileName,
    visualRowIndex: visual.visualRowIndex,
    visualJoinedTextCandidate: visual.visualJoinedTextCandidate,
    fragments: visual.fragments,
    rowIdentifierParseStatus: "EXACT_ONE",
    rowIdentifierRaw: "9413",
    rowIdentifierCandidate: 9413,
    dateParseStatus: "PARSED_EXACT",
    displayedMonth: 9,
    displayedDay: 6,
    displayedWeekdayRaw: "(일)",
    timeParseStatus: "PARSED_EXACT",
    displayedTimeRawParts: [" 11 30"],
    displayedHour: 11,
    displayedMinute: 30,
    scheduleParseStatus: "PARSED_EXACT",
    scheduledLocalCandidate: "2026-09-06T11:30:00+09:00",
    scheduledUtcCandidate: "2026-09-06T02:30:00.000Z",
    scheduleTimezone: "Asia/Seoul",
    sourceFilenameTimestampCandidateKst: "2026-09-06T10:52:22+09:00",
    sourceFilenameTimestampParseStatus: "PARSED_EXACT_PATTERN",
    scheduleYearContextProvenance: "SOURCE_FILENAME_DATE_CANDIDATE",
    scheduleYearContextYear: 2026,
    scheduleYearContextMonth: 9,
    acceptedObservationTime: null,
    observationTimeProvenance: null,
    semanticScope: "ROW_IDENTIFIER_AND_SCHEDULE_ONLY",
    teamParsingStatus: "NOT_PERFORMED",
    marketParsingStatus: "NOT_PERFORMED",
    oddsParsingStatus: "NOT_PERFORMED",
    gameMatchingStatus: "NOT_PERFORMED",
    ...overrides,
  };
}

function semanticDoc(
  rows: RowAnchorScheduleDocumentV0["rows"],
  sourceImages: number,
): RowAnchorScheduleDocumentV0 {
  return {
    meta: {
      schemaVersion: "proto-round-row-anchor-schedule-v0",
      protoRoundKey: "2026-105",
      year: 2026,
      round: 105,
      sourceVisualRowsSchema: "proto-round-visual-rows-v0",
      sourceImages,
      sourceVisualRows: rows.length,
      semanticScope: "ROW_IDENTIFIER_AND_SCHEDULE_ONLY",
      ocrCorrection: "DISABLED",
      teamParsing: "NOT_PERFORMED",
      marketParsing: "NOT_PERFORMED",
      oddsParsing: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageDedupe: "DISABLED",
      scheduleTimezone: "Asia/Seoul",
      parserAccuracyPercent: "NOT_MEASURABLE_YET",
      rowIdentifierScope: "PRE_DATE_ANCHOR_ONLY",
      yearContextSourceJoin: "SOURCE_IMAGE_SHA256",
      scheduleYearContextProvenance: "SOURCE_FILENAME_DATE_CANDIDATE",
      sourceFilenameDateUsedForYearContext: true,
      sourceFilenameTimeUsedAsObservationTime: false,
      roundFolderYearOverridesBoundaryAmbiguity: false,
      filenameTimestampUsedAsCapturedAt: false,
      screenScheduleTimeUsedAsObservationTime: false,
      acceptedObservationTimes: "NOT_ASSIGNED",
    },
    rows,
  };
}

function sourceFiles(): string[] {
  const lib = path.join(process.cwd(), "src/lib/proto-round-column-layout-audit-v0");
  return [
    ...readdirSync(lib).filter((f) => f.endsWith(".ts")).map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/build-proto-round-column-layout-audit-v0.ts"),
  ];
}

function proportionalFragments(width: number): VisualRowFragmentV0[] {
  return [
    frag("9413", 0.02 * width, 0.03 * width, 0),
    frag("09-06(일) 11 30", 0.08 * width, 0.10 * width, 1),
    frag("돈J2리그", 0.22 * width, 0.06 * width, 2),
    frag("U2.5", 0.32 * width, 0.04 * width, 3),
    frag("A니가타", 0.44 * width, 0.06 * width, 4),
    frag("요던비|이", 0.52 * width, 0.06 * width, 5),
    frag("1 79", 0.62 * width, 0.03 * width, 6),
    frag("2-03", 0.70 * width, 0.03 * width, 7),
    frag("320", 0.78 * width, 0.03 * width, 8),
  ];
}

async function main() {
  assert.equal(GEOMETRY_BASIS, "NORMALIZED_X");
  assert.equal(COLUMN_LAYOUT_AUDIT_SCOPE, "ROUND_DESCRIPTIVE");
  assert.equal(DISCOVERED_BANDS_ARE_PRODUCTION_CONTRACT, false);
  assert.equal(SEMANTIC_REGION_CONTRACT_FROZEN, false);
  assert.equal(AUDIT_DISCOVERY_PARAMETERS_ONLY, true);
  assert.equal(REGION_SEMANTIC_ROLE_ASSIGNED, false);
  assert.equal(LAYOUT_DISCOVERY_BIN_WIDTH, 0.02);
  assert.equal(LAYOUT_DISCOVERY_MIN_MODE_SHARE, 0.01);
  assert.equal(ROUND_105_COUNT_SPECIAL_CASE, false);
  assert.equal(FIELD_BOUNDARY_OUTCOME_TUNING, false);

  // A. normalized X independent of image width
  assert.equal(normalizeX(400, 800), 0.5);
  assert.equal(normalizeX(600, 1200), 0.5);
  const f800 = layoutFragmentFromVisual(frag("9413", 80, 40, 0), 800);
  const f1200 = layoutFragmentFromVisual(frag("9413", 120, 60, 0), 1200);
  assert.equal(f800.normalizedLeftX, f1200.normalizedLeftX);
  assert.equal(f800.normalizedCenterX, f1200.normalizedCenterX);
  assert.equal(f800.normalizedRightX, f1200.normalizedRightX);

  const row800 = visualRow({
    sha: "sha-800",
    fileName: "w800.png",
    index: 0,
    fragments: proportionalFragments(800),
  });
  const row1200 = visualRow({
    sha: "sha-1200",
    fileName: "w1200.png",
    index: 0,
    fragments: proportionalFragments(1200),
  });
  const vis = visualDoc([
    { sha: "sha-800", fileName: "w800.png", width: 800, rows: [row800] },
    { sha: "sha-1200", fileName: "w1200.png", width: 1200, rows: [row1200] },
  ]);
  const sem = semanticDoc(
    [semanticRow(row800), semanticRow(row1200, { sourceImageSha256: "sha-1200", sourceFileName: "w1200.png" })],
    2,
  );
  const doc = buildColumnLayoutAuditDocumentV0({ visual: vis, semantic: sem });

  // B. same proportional layout maps to equivalent normalized bands
  assert.equal(doc.rows.length, 2);
  assert.deepEqual(
    doc.rows[0]!.regions.map((r) => r.occupiedBandIndex),
    doc.rows[1]!.regions.map((r) => r.occupiedBandIndex),
  );
  assert.equal(doc.rows[0]!.layoutPatternId, doc.rows[1]!.layoutPatternId);

  // C. raw text preserved
  assert.equal(doc.rows[0]!.visualJoinedTextCandidate, row800.visualJoinedTextCandidate);
  assert.ok(doc.rows[0]!.semanticRemainderFragments.some((f) => f.rawText === "돈J2리그"));
  assert.ok(doc.rows[0]!.semanticRemainderFragments.some((f) => f.rawText === "A니가타"));
  assert.ok(doc.rows[0]!.semanticRemainderFragments.some((f) => f.rawText === "요던비|이"));
  assert.ok(doc.rows[0]!.semanticRemainderFragments.some((f) => f.rawText === "1 79"));
  assert.ok(doc.rows[0]!.semanticRemainderFragments.some((f) => f.rawText === "2-03"));

  // C. composite row lineage exact match (SHA + visualRowIndex, not array index)
  const crossed = joinVisualAndAnchorRows({
    visual: vis,
    semantic: semanticDoc(
      [
        semanticRow(row1200, {
          sourceImageSha256: "sha-1200",
          sourceFileName: "w1200.png",
          rowIdentifierCandidate: 9571,
          rowIdentifierRaw: "9413",
        }),
        semanticRow(row800, { rowIdentifierCandidate: 9413 }),
      ],
      2,
    ),
  });
  assert.equal(rowKey("sha-800", 0), "sha-800::0");
  assert.equal(crossed[0]!.visual.sourceImageSha256, "sha-1200");
  assert.equal(crossed[0]!.semantic.rowIdentifierCandidate, 9571);
  assert.equal(crossed[1]!.visual.sourceImageSha256, "sha-800");
  assert.equal(crossed[1]!.semantic.rowIdentifierCandidate, 9413);

  // B/D. fragment ordering by X
  const unordered = visualRow({
    sha: "sha-800",
    fileName: "w800.png",
    index: 0,
    fragments: [
      frag("09-06(일) 11 30", 80, 80, 1),
      frag("1 79", 496, 24, 2),
      frag("9413", 16, 24, 0),
    ],
  });
  const visOrder = visualDoc([
    { sha: "sha-800", fileName: "w800.png", width: 800, rows: [unordered] },
  ]);
  const orderedDoc = buildColumnLayoutAuditDocumentV0({
    visual: visOrder,
    semantic: semanticDoc([semanticRow(unordered)], 1),
  });
  const xs = orderedDoc.rows[0]!.semanticRemainderFragments.map((f) => f.normalizedLeftX);
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b));
  assert.equal(orderedDoc.rows[0]!.identifierFragment?.rawText, "9413");

  // E. duplicate row key fail closed
  const dupVisual = visualDoc([
    { sha: "sha-800", fileName: "w800.png", width: 800, rows: [row800] },
  ]);
  const dupSem = semanticDoc([semanticRow(row800), semanticRow(row800)], 1);
  assert.throws(
    () => joinVisualAndAnchorRows({ visual: dupVisual, semantic: dupSem }),
    (err: unknown) =>
      err instanceof ColumnLayoutLineageError && err.code === "DUPLICATE_SEMANTIC_ROW_KEY",
  );

  // F. missing row lineage fail closed
  const extraVisual = visualRow({
    sha: "sha-800",
    fileName: "w800.png",
    index: 1,
    fragments: proportionalFragments(800),
  });
  const visMissing = visualDoc([
    { sha: "sha-800", fileName: "w800.png", width: 800, rows: [row800, extraVisual] },
  ]);
  assert.throws(
    () =>
      joinVisualAndAnchorRows({
        visual: visMissing,
        semantic: semanticDoc([semanticRow(row800)], 1),
      }),
    (err: unknown) =>
      err instanceof ColumnLayoutLineageError && err.code === "MISSING_SEMANTIC_ROW",
  );

  // G. unknown SHA fail closed
  const unknownSem = semanticDoc(
    [semanticRow(row800, { sourceImageSha256: "sha-unknown" })],
    1,
  );
  assert.throws(
    () => joinVisualAndAnchorRows({ visual: visOrder, semantic: unknownSem }),
    (err: unknown) =>
      err instanceof ColumnLayoutLineageError && err.code === "UNKNOWN_SOURCE_SHA",
  );

  // H. region semanticRole remains UNASSIGNED
  for (const r of doc.rows[0]!.regions) {
    assert.equal(r.semanticRole, "UNASSIGNED");
  }
  for (const b of doc.candidateBands) {
    assert.equal(b.semanticRole, "UNASSIGNED");
  }

  // I. odds-like raw strings are not repaired
  assert.equal(classifyNumericRawShape("1 79"), "SPACED_DIGIT_GROUPS");
  assert.equal(classifyNumericRawShape("2-03"), "HYPHEN_DIGIT_GROUPS");
  assert.equal(classifyNumericRawShape("320"), "INTEGER_ASCII");
  assert.equal(classifyNumericRawShape("154!"), "BANG_SUFFIX");
  assert.equal(looksLikeUnrepairedOddsRaw("154!"), true);
  assert.equal(looksLikeUnrepairedOddsRaw("1 79"), true);
  assert.ok(doc.rows[0]!.regions.some((r) => r.joinedRawText.includes("1 79")));
  assert.equal(doc.rows[0]!.regions.some((r) => r.joinedRawText.includes("1.79")), false);
  assert.equal(doc.meta.ocrOddsRepair, "DISABLED");

  // J. team/league strings are not normalized
  assert.equal(classifyTokenShape("돈J2리그"), "MIXED_TEXT");
  assert.equal(classifyTokenShape("U2.5"), "U_DECIMAL_EXACT");
  assert.equal(classifyTokenShape("H +1.0"), "H_DECIMAL_EXACT");
  assert.equal(classifyTokenShape("SUM"), "SUM_EXACT");
  assert.equal(doc.meta.teamNormalization, "NOT_PERFORMED");
  assert.equal(doc.meta.leagueNormalization, "NOT_PERFORMED");

  // K. no home/away fields
  const blob = JSON.stringify(doc);
  assert.equal(blob.includes("homeTeam"), false);
  assert.equal(blob.includes("awayTeam"), false);
  assert.equal(blob.includes("TEXT_REGION_HOME"), false);
  assert.equal(doc.meta.homeAwaySemanticsAssigned, false);

  // L. no official odds fields
  assert.equal(blob.includes("homeOdds"), false);
  assert.equal(blob.includes("drawOdds"), false);
  assert.equal(blob.includes("awayOdds"), false);
  assert.equal(doc.meta.officialOddsExtraction, "NOT_PERFORMED");
  assert.equal(doc.rows[0]!.officialOddsStatus, "NOT_EXTRACTED");
  assert.equal(doc.rows[0]!.acceptedObservationTime, null);
  assert.equal(doc.meta.columnLayoutAuditScope, "ROUND_DESCRIPTIVE");
  assert.equal(doc.meta.discoveredBandsAreProductionContract, false);
  assert.equal(doc.meta.semanticRegionContractFrozen, false);
  assert.equal(doc.meta.auditDiscoveryParametersOnly, true);
  assert.equal(doc.meta.regionSemanticRoleAssigned, false);
  assert.equal(doc.meta.layoutDiscoveryBinWidth, LAYOUT_DISCOVERY_BIN_WIDTH);
  assert.equal(doc.meta.layoutDiscoveryMinModeShare, LAYOUT_DISCOVERY_MIN_MODE_SHARE);
  assert.equal(doc.meta.round105CountSpecialCase, false);
  assert.equal(doc.meta.fieldBoundaryOutcomeTuning, false);

  // N. no fixed Round-105 count requirement in audit source
  // O. audit parameters do not become semantic band constants
  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("homeOdds"), false, abs);
    assert.equal(src.includes("parseTeam"), false, abs);
    assert.equal(src.includes("1 79 → 1.79"), false, abs);
    assert.equal(src.includes("2-03 → 2.03"), false, abs);
    assert.equal(src.includes("320 → 3.20"), false, abs);
    assert.equal(src.includes("LEAGUE_BAND"), false, abs);
    assert.equal(src.includes("TEAM_BAND"), false, abs);
    assert.equal(src.includes("ODDS_BAND"), false, abs);
    assert.equal(src.includes("MARKET_BAND"), false, abs);
    assert.equal(src.includes("pattern A = football"), false, abs);
    assert.equal(src.includes("pattern C = 1X2"), false, abs);
    assert.equal(src.includes("pattern K = baseball"), false, abs);
    assert.equal(/\b275\b/.test(src), false, abs);
    assert.equal(/\b274\b/.test(src), false, abs);
    assert.equal(/\b145\b/.test(src), false, abs);
  }

  console.log("proto-round-column-layout-audit-v0 tests passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
