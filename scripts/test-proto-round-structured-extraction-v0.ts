/**
 * Proto-round first-shot structured extraction v0 tests.
 * Synthetic geometry only. No Ground Truth. No Holdout. Network: 0.
 *
 *   npm run test:proto-round-structured-extraction-v0
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  classifyDescriptiveShape,
  classifyTokenShape,
  type LayoutFragmentV0,
} from "../src/lib/proto-round-column-layout-audit-v0";
import {
  taggedRegionFromSource,
  type ProtoRoundSemanticRegionCandidateV0,
  type SemanticRegionCandidatesDocumentV0,
} from "../src/lib/proto-round-semantic-region-candidates-v0";
import {
  BAND_INDEX_USED_AS_SEMANTIC_LABEL,
  GAME_MATCHING,
  GROUND_TRUTH_AVAILABLE_TO_PARSER,
  HOLDOUT_AVAILABLE_TO_PARSER,
  HOME_AWAY_ASSIGNED,
  MARKET_SEMANTICS_ASSIGNED,
  OCR_CORRECTION,
  OCR_ODDS_REPAIR,
  OFFICIAL_ODDS_RECORD_CREATED,
  STRUCTURED_SCOPE,
  StructuredExtractionError,
  assertSemanticRegionSource,
  buildStructuredExtractionDocumentV0,
  parseStructuredRowV0,
} from "../src/lib/proto-round-structured-extraction-v0";

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

function region(input: {
  regionIndex: number;
  left: number;
  right: number;
  texts: string[];
}) {
  const fragments = input.texts.map((t, i) => {
    const width = (input.right - input.left) / input.texts.length;
    const l = input.left + i * width;
    return layoutFrag(t, l, l + width);
  });
  return taggedRegionFromSource({
    regionIndex: input.regionIndex,
    occupiedBandIndex: null,
    normalizedLeft: input.left,
    normalizedRight: input.right,
    fragments,
    joinedRawText: input.texts.join(" "),
    semanticRole: "UNASSIGNED",
  });
}

function candidateRow(input: {
  sha?: string;
  fileName?: string;
  index?: number;
  identifier?: number | null;
  regions: ReturnType<typeof region>[];
}): ProtoRoundSemanticRegionCandidateV0 {
  return {
    sourceImageSha256: input.sha ?? "sha-a",
    sourceFileName: input.fileName ?? "shot.png",
    visualRowIndex: input.index ?? 0,
    rowIdentifierCandidate: input.identifier === undefined ? 9413 : input.identifier,
    scheduledLocalCandidate: null,
    layoutPatternId: "LAYOUT_PATTERN_A",
    visualJoinedTextCandidate: input.regions.map((r) => r.joinedRawText).join(" "),
    regions: input.regions,
    rowRawEvidenceSignature: "",
    teamParsingStatus: "NOT_PERFORMED",
    leagueParsingStatus: "NOT_PERFORMED",
    marketParsingStatus: "NOT_PERFORMED",
    oddsParsingStatus: "NOT_PERFORMED",
    gameMatchingStatus: "NOT_PERFORMED",
    acceptedObservationTime: null,
  };
}

function sourceDoc(
  rows: ProtoRoundSemanticRegionCandidateV0[],
): SemanticRegionCandidatesDocumentV0 {
  return {
    meta: {
      schemaVersion: "proto-round-semantic-region-candidates-v0",
      protoRoundKey: "2026-1",
      year: 2026,
      round: 1,
      sourceColumnLayoutSchema: "proto-round-column-layout-audit-v0",
      sourceImages: 1,
      sourceVisualRows: rows.length,
      semanticScope: "RAW_EVIDENCE_CANDIDATES_ONLY",
      bandIndexSemanticMeaning: "NONE",
      bandIndexUsedAsSemanticLabel: false,
      band1MarketContract: false,
      rawEvidenceTagComposition: "DETERMINISTIC",
      rawRegionTextModified: false,
      textBearingRawIsTeam: false,
      textBearingRawIsLeague: false,
      numericLikeRawIsOdds: false,
      exactMarketMarkerRawIsOfficialMarket: false,
      marketSemanticsAssigned: false,
      teamParsing: "NOT_PERFORMED",
      leagueParsing: "NOT_PERFORMED",
      marketParsing: "NOT_PERFORMED",
      oddsParsing: "NOT_PERFORMED",
      ocrCorrection: "DISABLED",
      oddsRepair: "DISABLED",
      officialOddsExtraction: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageDedupe: "DISABLED",
      acceptedObservationTimes: "NOT_ASSIGNED",
    },
    coverage: {
      totalRows: rows.length,
      totalRegions: rows.reduce((n, r) => n + r.regions.length, 0),
      textBearingRawRegions: 0,
      textBearingRawRows: 0,
      numericLikeRawRegions: 0,
      numericLikeRawRows: 0,
      exactMarketMarkerRawRegions: 0,
      exactMarketMarkerRawRows: 0,
      otherRawRegions: 0,
      otherRawRows: 0,
      invalidNormalizedGeometryRegions: 0,
      invalidNormalizedGeometryRows: 0,
    },
    tagAudit: [],
    tagCombinationAudit: [],
    signatureAudit: [],
    layoutPatternEvidenceAudit: [],
    representativePreviews: [],
    rows,
  };
}

function sourceFiles(): string[] {
  const lib = path.join(process.cwd(), "src/lib/proto-round-structured-extraction-v0");
  return [
    ...readdirSync(lib).filter((f) => f.endsWith(".ts")).map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/build-proto-round-structured-extraction-v0.ts"),
  ];
}

async function main() {
  assert.equal(STRUCTURED_SCOPE, "RAW_STRUCTURAL_CANDIDATES_ONLY");
  assert.equal(OCR_CORRECTION, "DISABLED");
  assert.equal(OCR_ODDS_REPAIR, "DISABLED");
  assert.equal(HOME_AWAY_ASSIGNED, false);
  assert.equal(MARKET_SEMANTICS_ASSIGNED, false);
  assert.equal(OFFICIAL_ODDS_RECORD_CREATED, false);
  assert.equal(GAME_MATCHING, false);
  assert.equal(GROUND_TRUTH_AVAILABLE_TO_PARSER, false);
  assert.equal(HOLDOUT_AVAILABLE_TO_PARSER, false);
  assert.equal(BAND_INDEX_USED_AS_SEMANTIC_LABEL, false);

  const classic = parseStructuredRowV0(
    candidateRow({
      identifier: 9413,
      regions: [
        region({ regionIndex: 0, left: 0.1, right: 0.2, texts: ["J2리그"] }),
        region({ regionIndex: 1, left: 0.22, right: 0.3, texts: ["U2.5"] }),
        region({ regionIndex: 2, left: 0.32, right: 0.45, texts: ["한화"] }),
        region({ regionIndex: 3, left: 0.5, right: 0.58, texts: ["1.91"] }),
        region({ regionIndex: 4, left: 0.6, right: 0.73, texts: ["기아"] }),
        region({ regionIndex: 5, left: 0.75, right: 0.83, texts: ["1.63"] }),
        region({ regionIndex: 6, left: 0.85, right: 0.95, texts: ["경기전"] }),
      ],
    }),
  );
  assert.equal(classic.screenRowIdentifierCandidateRaw, "9413");
  assert.equal(classic.rowIdentifierParsingStatus, "PARSED");
  assert.equal(classic.marketMarkerCandidateRaw, "U2.5");
  assert.equal(classic.marketMarkerParsingStatus, "PARSED");
  assert.equal(classic.participantLeftCandidateRaw, "한화");
  assert.equal(classic.participantRightCandidateRaw, "기아");
  assert.equal(classic.participantParsingStatus, "PARSED");
  assert.deepEqual(classic.numericCellsCandidateRaw, ["1.91", "1.63"]);
  assert.equal(classic.numericCellsParsingStatus, "PARSED");
  assert.equal(classic.rowParsingStatus, "PARSED");
  assert.equal(classic.homeAwayAssigned, false);
  assert.equal(classic.marketSemanticsAssigned, false);
  assert.equal(classic.officialOddsRecordCreated, false);

  const unrepaired = parseStructuredRowV0(
    candidateRow({
      identifier: 9500,
      regions: [
        region({ regionIndex: 0, left: 0.2, right: 0.28, texts: ["SUM"] }),
        region({ regionIndex: 1, left: 0.32, right: 0.45, texts: ["서울"] }),
        region({ regionIndex: 2, left: 0.5, right: 0.58, texts: ["2-09"] }),
        region({ regionIndex: 3, left: 0.6, right: 0.73, texts: ["부산"] }),
        region({ regionIndex: 4, left: 0.75, right: 0.83, texts: ["2 60!"] }),
      ],
    }),
  );
  assert.deepEqual(unrepaired.numericCellsCandidateRaw, ["2-09", "2 60!"]);
  assert.equal(unrepaired.numericCellsCandidateRaw.every((v) => typeof v === "string"), true);
  assert.equal(unrepaired.marketMarkerCandidateRaw, "SUM");
  assert.equal(unrepaired.participantLeftCandidateRaw, "서울");
  assert.equal(unrepaired.participantRightCandidateRaw, "부산");

  const twoMarkers = parseStructuredRowV0(
    candidateRow({
      regions: [
        region({ regionIndex: 0, left: 0.2, right: 0.28, texts: ["U2.5"] }),
        region({ regionIndex: 1, left: 0.3, right: 0.38, texts: ["O2.5"] }),
        region({ regionIndex: 2, left: 0.4, right: 0.5, texts: ["한화"] }),
        region({ regionIndex: 3, left: 0.55, right: 0.65, texts: ["1.80"] }),
        region({ regionIndex: 4, left: 0.7, right: 0.8, texts: ["기아"] }),
      ],
    }),
  );
  assert.equal(twoMarkers.marketMarkerCandidateRaw, null);
  assert.equal(twoMarkers.marketMarkerParsingStatus, "AMBIGUOUS");
  assert.equal(twoMarkers.rowParsingStatus, "AMBIGUOUS");

  const oneParticipant = parseStructuredRowV0(
    candidateRow({
      regions: [
        region({ regionIndex: 0, left: 0.2, right: 0.28, texts: ["U3.5"] }),
        region({ regionIndex: 1, left: 0.4, right: 0.5, texts: ["한화"] }),
        region({ regionIndex: 2, left: 0.6, right: 0.7, texts: ["1.91"] }),
      ],
    }),
  );
  assert.equal(oneParticipant.participantLeftCandidateRaw, null);
  assert.equal(oneParticipant.participantRightCandidateRaw, null);
  assert.equal(oneParticipant.participantParsingStatus, "INSUFFICIENT_EVIDENCE");

  const missingId = parseStructuredRowV0(
    candidateRow({
      identifier: null,
      regions: [
        region({ regionIndex: 0, left: 0.32, right: 0.45, texts: ["한화"] }),
        region({ regionIndex: 1, left: 0.5, right: 0.58, texts: ["1.91"] }),
        region({ regionIndex: 2, left: 0.6, right: 0.73, texts: ["기아"] }),
      ],
    }),
  );
  assert.equal(missingId.screenRowIdentifierCandidateRaw, null);
  assert.equal(missingId.rowIdentifierParsingStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(missingId.participantParsingStatus, "PARSED");

  const threeText = parseStructuredRowV0(
    candidateRow({
      regions: [
        region({ regionIndex: 0, left: 0.3, right: 0.4, texts: ["갑"] }),
        region({ regionIndex: 1, left: 0.42, right: 0.52, texts: ["을"] }),
        region({ regionIndex: 2, left: 0.54, right: 0.64, texts: ["병"] }),
        region({ regionIndex: 3, left: 0.7, right: 0.8, texts: ["1.50"] }),
      ],
    }),
  );
  assert.equal(threeText.participantLeftCandidateRaw, null);
  assert.equal(threeText.participantRightCandidateRaw, null);
  assert.equal(threeText.participantParsingStatus, "AMBIGUOUS");

  const empty = parseStructuredRowV0(candidateRow({ identifier: null, regions: [] }));
  assert.equal(empty.rowParsingStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(empty.marketMarkerCandidateRaw, null);
  assert.deepEqual(empty.numericCellsCandidateRaw, []);

  const many = Array.from({ length: 12 }, (_, i) =>
    candidateRow({
      sha: `sha-${i}`,
      index: i,
      identifier: 9400 + i,
      regions: [
        region({ regionIndex: 0, left: 0.2, right: 0.28, texts: ["H +1.0"] }),
        region({ regionIndex: 1, left: 0.32, right: 0.45, texts: [`좌${i}`] }),
        region({ regionIndex: 2, left: 0.5, right: 0.58, texts: ["2.10"] }),
        region({ regionIndex: 3, left: 0.6, right: 0.73, texts: [`우${i}`] }),
        region({ regionIndex: 4, left: 0.75, right: 0.83, texts: ["1.70"] }),
      ],
    }),
  );
  const built = buildStructuredExtractionDocumentV0(sourceDoc(many));
  assert.equal(built.coverage.totalRows, 12);
  assert.equal(built.rows.length, 12);
  assert.equal(built.meta.groundTruthAvailableToParser, false);
  assert.equal(built.meta.holdoutAvailableToParser, false);
  assert.equal(built.coverage.parsedRows, 12);
  assert.equal(built.rows[11]!.visualRowIndex, 11);
  assert.equal(built.rows[11]!.participantLeftCandidateRaw, "좌11");

  const frozen = sourceDoc([]);
  frozen.meta.marketSemanticsAssigned = true as unknown as false;
  assert.throws(
    () => assertSemanticRegionSource(frozen),
    (err: unknown) =>
      err instanceof StructuredExtractionError &&
      err.code === "MARKET_SEMANTICS_ALREADY_ASSIGNED",
  );

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("proto-round-ground-truth"), false, abs);
    assert.equal(src.includes("discovery-annotation"), false, abs);
    assert.equal(src.includes("holdout-seal"), false, abs);
    assert.equal(src.includes("holdoutRowKeys"), false, abs);
    assert.equal(src.includes("homeTeam"), false, abs);
    assert.equal(src.includes("awayTeam"), false, abs);
    assert.equal(src.includes("marketType"), false, abs);
    assert.equal(src.includes("homeOdds"), false, abs);
    assert.equal(src.includes("DRAW"), false, abs);
    assert.equal(src.includes("OVER"), false, abs);
    assert.equal(src.includes("UNDER"), false, abs);
    assert.equal(src.includes("HANDICAP"), false, abs);
    assert.equal(src.includes("fetch("), false, abs);
    assert.equal(src.includes("occupiedBandIndex ==="), false, abs);
    assert.equal(src.includes("2-09 → 2.09"), false, abs);
    assert.equal(src.includes("postgame"), false, abs);
  }

  console.log("test:proto-round-structured-extraction-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
