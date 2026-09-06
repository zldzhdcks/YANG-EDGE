/**
 * Proto-round semantic region candidates v0 tests.
 * Synthetic geometry only. No OCR engine. Network: 0.
 *
 *   npm run test:proto-round-semantic-region-candidates-v0
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  classifyDescriptiveShape,
  classifyTokenShape,
  isValidNormalizedFragmentGeometry,
  type ColumnLayoutAuditDocumentV0,
  type LayoutFragmentV0,
  type ProtoRoundRawFieldRegionCandidateV0,
  type RawFieldRegionCandidateV0,
} from "../src/lib/proto-round-column-layout-audit-v0";
import {
  BAND_1_MARKET_CONTRACT,
  BAND_INDEX_USED_AS_SEMANTIC_LABEL,
  EXACT_MARKET_MARKER_RAW_IS_OFFICIAL_MARKET,
  NUMERIC_LIKE_RAW_IS_ODDS,
  RAW_EVIDENCE_TAG_COMPOSITION,
  SEMANTIC_SCOPE,
  SemanticRegionCandidateError,
  TEXT_BEARING_RAW_IS_LEAGUE,
  TEXT_BEARING_RAW_IS_TEAM,
  assignRawEvidenceTags,
  assertColumnLayoutAuditSource,
  buildSemanticRegionCandidatesDocumentV0,
  isExactMarketMarkerRaw,
  isNumericLikeRaw,
  isTextBearingRaw,
  rowRawEvidenceSignature,
  taggedRegionFromSource,
} from "../src/lib/proto-round-semantic-region-candidates-v0";

function layoutFrag(rawText: string, left: number, right: number): LayoutFragmentV0 {
  return {
    rawLineIndex: 0,
    rawText,
    x: left * 800,
    y: 10,
    width: (right - left) * 800,
    height: 10,
    normalizedLeftX: left,
    normalizedCenterX: (left + right) / 2,
    normalizedRightX: right,
    tokenShape: classifyTokenShape(rawText),
    descriptiveShape: classifyDescriptiveShape(rawText),
  };
}

function sourceRegion(input: {
  regionIndex: number;
  band: number | null;
  left: number;
  right: number;
  fragments: LayoutFragmentV0[];
}): RawFieldRegionCandidateV0 {
  return {
    regionIndex: input.regionIndex,
    occupiedBandIndex: input.band,
    normalizedLeft: input.left,
    normalizedRight: input.right,
    fragments: input.fragments,
    joinedRawText: input.fragments.map((f) => f.rawText).join(" "),
    semanticRole: "UNASSIGNED",
  };
}

function layoutRow(input: {
  sha?: string;
  fileName?: string;
  index?: number;
  identifier?: number | null;
  schedule?: string | null;
  patternId?: string | null;
  regions: RawFieldRegionCandidateV0[];
}): ProtoRoundRawFieldRegionCandidateV0 {
  return {
    sourceImageSha256: input.sha ?? "sha-800",
    sourceFileName: input.fileName ?? "w800.png",
    visualRowIndex: input.index ?? 0,
    imageWidth: 800,
    rowIdentifierCandidate: input.identifier ?? 9413,
    scheduledLocalCandidate: input.schedule ?? "2026-09-06T11:30:00+09:00",
    layoutStatus: "ANCHOR_COMPLETE",
    visualJoinedTextCandidate: input.regions.map((r) => r.joinedRawText).join(" "),
    identifierFragment: null,
    dateTimeFragments: [],
    semanticRemainderFragments: input.regions.flatMap((r) => r.fragments),
    regions: input.regions,
    layoutPatternId: input.patternId ?? "LAYOUT_PATTERN_A",
    acceptedObservationTime: null,
    teamNormalizationStatus: "NOT_PERFORMED",
    leagueNormalizationStatus: "NOT_PERFORMED",
    homeAwaySemanticsAssigned: false,
    marketSemanticsAssigned: false,
    oddsParsingStatus: "NOT_PERFORMED",
    officialOddsStatus: "NOT_EXTRACTED",
    gameMatchingStatus: "NOT_MATCHED",
  };
}

function layoutDoc(rows: ProtoRoundRawFieldRegionCandidateV0[]): ColumnLayoutAuditDocumentV0 {
  return {
    meta: {
      schemaVersion: "proto-round-column-layout-audit-v0",
      protoRoundKey: "2026-1",
      year: 2026,
      round: 1,
      sourceVisualRowsSchema: "proto-round-visual-rows-v0",
      sourceAnchorScheduleSchema: "proto-round-row-anchor-schedule-v0",
      sourceImages: 1,
      sourceVisualRows: rows.length,
      geometryBasis: "NORMALIZED_X",
      columnLayoutAuditScope: "ROUND_DESCRIPTIVE",
      discoveredBandsAreProductionContract: false,
      semanticRegionContractFrozen: false,
      auditDiscoveryParametersOnly: true,
      regionSemanticRoleAssigned: false,
      layoutDiscoveryBinWidth: 0.02,
      layoutDiscoveryMinModeShare: 0.01,
      boundaryDerivationMethod:
        "NORMALIZED_CENTER_X_HISTOGRAM_LOCAL_MAXIMA; BAND_EDGES=MIDPOINTS_OF_ADJACENT_MODE_CENTERS",
      round105CountSpecialCase: false,
      fieldBoundaryOutcomeTuning: false,
      semanticAssignment: "NOT_PERFORMED",
      ocrRepair: "DISABLED",
      ocrOddsRepair: "DISABLED",
      teamNormalization: "NOT_PERFORMED",
      leagueNormalization: "NOT_PERFORMED",
      homeAwaySemanticsAssigned: false,
      marketSemanticsAssigned: false,
      officialOddsExtraction: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageDedupe: "DISABLED",
      acceptedObservationTimes: "NOT_ASSIGNED",
      multiLayoutCandidate: false,
    },
    coverage: {
      totalRows: rows.length,
      rowsWithUsableNormalizedGeometry: rows.length,
      rowsWithAnchorAndDateGeometry: rows.length,
      rowsWithAnchorDateAndExactTimeGeometry: rows.length,
      uniqueLayoutPatternCount: 1,
      unclassifiedLayoutRows: 0,
    },
    anchorGeometry: {
      identifierCenterX: { count: 0, min: null, p10: null, median: null, p90: null, max: null },
      dateTimeCenterX: { count: 0, min: null, p10: null, median: null, p90: null, max: null },
      exactClockCenterX: { count: 0, min: null, p10: null, median: null, p90: null, max: null },
    },
    remainderHistogram: [],
    candidateBands: [],
    layoutPatterns: [],
    marketSignalAudit: [],
    numericShapeAudit: [],
    rows,
  };
}

function sourceFiles(): string[] {
  const lib = path.join(process.cwd(), "src/lib/proto-round-semantic-region-candidates-v0");
  return [
    ...readdirSync(lib).filter((f) => f.endsWith(".ts")).map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/build-proto-round-semantic-region-candidates-v0.ts"),
  ];
}

async function main() {
  assert.equal(SEMANTIC_SCOPE, "RAW_EVIDENCE_CANDIDATES_ONLY");
  assert.equal(BAND_INDEX_USED_AS_SEMANTIC_LABEL, false);
  assert.equal(BAND_1_MARKET_CONTRACT, false);
  assert.equal(RAW_EVIDENCE_TAG_COMPOSITION, "DETERMINISTIC");
  assert.equal(TEXT_BEARING_RAW_IS_TEAM, false);
  assert.equal(TEXT_BEARING_RAW_IS_LEAGUE, false);
  assert.equal(NUMERIC_LIKE_RAW_IS_ODDS, false);
  assert.equal(EXACT_MARKET_MARKER_RAW_IS_OFFICIAL_MARKET, false);

  // A. Hangul text → TEXT_BEARING_RAW
  const hangul = assignRawEvidenceTags([layoutFrag("한화", 0.4, 0.5)]);
  assert.deepEqual(hangul.tags, ["TEXT_BEARING_RAW"]);
  assert.equal(isTextBearingRaw("한화"), true);

  // B. Latin text → TEXT_BEARING_RAW
  const latin = assignRawEvidenceTags([layoutFrag("NPB", 0.2, 0.28)]);
  assert.deepEqual(latin.tags, ["TEXT_BEARING_RAW"]);
  assert.equal(isTextBearingRaw("NC"), true);

  // C/D/E. numeric-like raw strings remain unmodified
  for (const raw of ["1 79", "2-03", "320", "154!", "2 60!"] as const) {
    const tagged = taggedRegionFromSource(
      sourceRegion({
        regionIndex: 0,
        band: 7,
        left: 0.6,
        right: 0.7,
        fragments: [layoutFrag(raw, 0.6, 0.7)],
      }),
    );
    assert.deepEqual(tagged.rawEvidenceTags, ["NUMERIC_LIKE_RAW"]);
    assert.equal(tagged.joinedRawText, raw);
    assert.equal(tagged.fragments[0]!.rawText, raw);
    assert.equal(isNumericLikeRaw(raw), true);
    assert.equal(isExactMarketMarkerRaw(raw), false);
  }

  // F/G/H. exact market marker raw
  assert.deepEqual(assignRawEvidenceTags([layoutFrag("SUM", 0.3, 0.35)]).tags, [
    "EXACT_MARKET_MARKER_RAW",
  ]);
  assert.deepEqual(assignRawEvidenceTags([layoutFrag("U2.5", 0.3, 0.35)]).tags, [
    "EXACT_MARKET_MARKER_RAW",
  ]);
  assert.deepEqual(assignRawEvidenceTags([layoutFrag("H +1.0", 0.3, 0.38)]).tags, [
    "EXACT_MARKET_MARKER_RAW",
  ]);
  assert.equal(isExactMarketMarkerRaw("O3.5"), true);
  assert.equal(isTextBearingRaw("U2.5"), false);
  assert.equal(isNumericLikeRaw("U2.5"), false);
  assert.equal(isTextBearingRaw("SUM"), false);
  assert.equal(isNumericLikeRaw("H +1.0"), false);

  // I. malformed market token is not exact
  assert.equal(isExactMarketMarkerRaw("U2,5"), false);
  assert.deepEqual(assignRawEvidenceTags([layoutFrag("U2,5", 0.3, 0.35)]).tags, [
    "TEXT_BEARING_RAW",
  ]);

  // J. band index alone cannot generate a tag
  const emptyBand1 = taggedRegionFromSource(
    sourceRegion({
      regionIndex: 0,
      band: 1,
      left: 0.27,
      right: 0.38,
      fragments: [layoutFrag("***", 0.3, 0.32)],
    }),
  );
  assert.equal(emptyBand1.occupiedBandIndex, 1);
  assert.deepEqual(emptyBand1.rawEvidenceTags, ["OTHER_RAW"]);
  assert.equal(emptyBand1.rawEvidenceTags.includes("EXACT_MARKET_MARKER_RAW"), false);
  const marketInLastBand = taggedRegionFromSource(
    sourceRegion({
      regionIndex: 0,
      band: 8,
      left: 0.86,
      right: 0.95,
      fragments: [layoutFrag("U2.5", 0.88, 0.92)],
    }),
  );
  assert.deepEqual(marketInLastBand.rawEvidenceTags, ["EXACT_MARKET_MARKER_RAW"]);

  // K. semanticRole remains UNASSIGNED
  assert.equal(emptyBand1.semanticRole, "UNASSIGNED");
  assert.equal(marketInLastBand.semanticRole, "UNASSIGNED");

  // L. multiple raw tags allowed
  const mixed = taggedRegionFromSource(
    sourceRegion({
      regionIndex: 0,
      band: 0,
      left: 0.2,
      right: 0.7,
      fragments: [layoutFrag("돈J2리그", 0.2, 0.28), layoutFrag("1 79", 0.62, 0.68)],
    }),
  );
  assert.deepEqual(mixed.rawEvidenceTags, ["TEXT_BEARING_RAW", "NUMERIC_LIKE_RAW"]);

  // M. raw text immutable
  assert.equal(mixed.joinedRawText, "돈J2리그 1 79");
  assert.equal(mixed.fragments[0]!.rawText, "돈J2리그");
  assert.equal(mixed.fragments[1]!.rawText, "1 79");

  // N. row signature deterministic
  const sigRow = buildSemanticRegionCandidatesDocumentV0(
    layoutDoc([
      layoutRow({
        regions: [
          sourceRegion({
            regionIndex: 0,
            band: 0,
            left: 0.2,
            right: 0.28,
            fragments: [layoutFrag("돈J2리그", 0.2, 0.28)],
          }),
          sourceRegion({
            regionIndex: 1,
            band: 1,
            left: 0.3,
            right: 0.35,
            fragments: [layoutFrag("U2.5", 0.3, 0.35)],
          }),
          sourceRegion({
            regionIndex: 2,
            band: 3,
            left: 0.44,
            right: 0.52,
            fragments: [layoutFrag("A니가타", 0.44, 0.5)],
          }),
          sourceRegion({
            regionIndex: 3,
            band: 6,
            left: 0.62,
            right: 0.7,
            fragments: [layoutFrag("1 79", 0.62, 0.68)],
          }),
          sourceRegion({
            regionIndex: 4,
            band: 7,
            left: 0.7,
            right: 0.78,
            fragments: [layoutFrag("2-03", 0.7, 0.76)],
          }),
        ],
      }),
    ]),
  );
  assert.equal(sigRow.rows[0]!.rowRawEvidenceSignature, "T | M | T | N | N");
  assert.equal(
    rowRawEvidenceSignature([
      { tags: ["TEXT_BEARING_RAW"], geometryStatus: "VALID" },
      { tags: ["EXACT_MARKET_MARKER_RAW"], geometryStatus: "VALID" },
    ]),
    "T | M",
  );

  // O/P/Q. no sport/team/league, market semantic, or odds fields
  const blob = JSON.stringify(sigRow);
  assert.equal(blob.includes("homeTeam"), false);
  assert.equal(blob.includes("awayTeam"), false);
  assert.equal(blob.includes("participantA"), false);
  assert.equal(blob.includes("marketType"), false);
  assert.equal(blob.includes("handicap"), false);
  assert.equal(blob.includes("homeOdds"), false);
  assert.equal(blob.includes("drawOdds"), false);
  assert.equal(sigRow.rows[0]!.teamParsingStatus, "NOT_PERFORMED");
  assert.equal(sigRow.rows[0]!.leagueParsingStatus, "NOT_PERFORMED");
  assert.equal(sigRow.rows[0]!.marketParsingStatus, "NOT_PERFORMED");
  assert.equal(sigRow.rows[0]!.oddsParsingStatus, "NOT_PERFORMED");
  assert.equal(sigRow.rows[0]!.acceptedObservationTime, null);
  assert.equal(sigRow.meta.semanticScope, "RAW_EVIDENCE_CANDIDATES_ONLY");
  assert.equal(sigRow.meta.band1MarketContract, false);
  assert.equal(sigRow.meta.rawEvidenceTagComposition, "DETERMINISTIC");
  assert.equal(sigRow.meta.bandIndexUsedAsSemanticLabel, false);
  for (const r of sigRow.rows[0]!.regions) {
    assert.equal(r.semanticRole, "UNASSIGNED");
  }

  // R. invalid normalized geometry fail closed / not tagged
  const negative = layoutFrag("한화", -0.2, -0.1);
  negative.normalizedLeftX = -0.2;
  negative.normalizedCenterX = -0.15;
  negative.normalizedRightX = -0.1;
  const overflow = layoutFrag("U2.5", 0.9, 1.2);
  overflow.normalizedLeftX = 0.9;
  overflow.normalizedCenterX = 1.05;
  overflow.normalizedRightX = 1.2;
  const nanFrag = layoutFrag("1 79", 0.6, 0.7);
  nanFrag.normalizedLeftX = Number.NaN;
  nanFrag.normalizedCenterX = Number.NaN;
  nanFrag.normalizedRightX = Number.NaN;
  const infFrag = layoutFrag("320", 0.7, 0.8);
  infFrag.normalizedLeftX = Number.POSITIVE_INFINITY;
  infFrag.normalizedCenterX = Number.POSITIVE_INFINITY;
  infFrag.normalizedRightX = Number.POSITIVE_INFINITY;
  const negWidth = layoutFrag("2-03", 0.5, 0.4);
  negWidth.normalizedLeftX = 0.5;
  negWidth.normalizedCenterX = 0.45;
  negWidth.normalizedRightX = 0.4;
  assert.equal(isValidNormalizedFragmentGeometry(negative), false);
  assert.equal(isValidNormalizedFragmentGeometry(overflow), false);
  assert.equal(isValidNormalizedFragmentGeometry(nanFrag), false);
  assert.equal(isValidNormalizedFragmentGeometry(infFrag), false);
  assert.equal(isValidNormalizedFragmentGeometry(negWidth), false);
  const invalidTagged = assignRawEvidenceTags([negative, overflow, nanFrag, infFrag, negWidth]);
  assert.deepEqual(invalidTagged.tags, []);
  assert.equal(invalidTagged.geometryStatus, "INVALID_NORMALIZED_GEOMETRY");
  const invalidRegion = taggedRegionFromSource(
    sourceRegion({
      regionIndex: 0,
      band: 1,
      left: 0.27,
      right: 0.38,
      fragments: [overflow],
    }),
  );
  assert.equal(invalidRegion.fragments[0]!.rawText, "U2.5");
  assert.equal(invalidRegion.rawEvidenceTags.includes("EXACT_MARKET_MARKER_RAW"), false);
  assert.equal(invalidRegion.geometryStatus, "INVALID_NORMALIZED_GEOMETRY");

  const frozen = layoutDoc([]);
  frozen.meta.semanticRegionContractFrozen = true as unknown as false;
  assert.throws(
    () => assertColumnLayoutAuditSource(frozen),
    (err: unknown) =>
      err instanceof SemanticRegionCandidateError &&
      err.code === "SEMANTIC_REGION_CONTRACT_ALREADY_FROZEN",
  );

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("homeTeam"), false, abs);
    assert.equal(src.includes("awayTeam"), false, abs);
    assert.equal(src.includes("marketType"), false, abs);
    assert.equal(src.includes("homeOdds"), false, abs);
    assert.equal(src.includes("1 79 → 1.79"), false, abs);
    assert.equal(src.includes("2-03 → 2.03"), false, abs);
    assert.equal(src.includes("if bandIndex"), false, abs);
    assert.equal(src.includes("occupiedBandIndex ==="), false, abs);
    assert.equal(src.includes("occupiedBandIndex === 1"), false, abs);
    assert.equal(src.includes("band 1 = MARKET"), false, abs);
    assert.equal(src.includes("TEXT_REGION_HOME"), false, abs);
  }

  console.log("proto-round-semantic-region-candidates-v0 tests passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
