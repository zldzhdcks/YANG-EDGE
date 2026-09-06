/**
 * Proto-round ground-truth annotation pack v0 tests.
 * Synthetic identity/geometry only. No OCR engine. Network: 0.
 *
 *   npm run test:proto-round-ground-truth-v0
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { IntakeManifestV1, PhysicalFileRecordV1 } from "../src/lib/proto-round-screenshot-intake-v1/types";
import { sha256RawBytes } from "../src/lib/proto-round-screenshot-intake-v1/hash";
import type {
  VisualRowCandidateV0,
  VisualRowsDocumentV0,
  VisualRowsImageRecordV0,
} from "../src/lib/proto-round-visual-rows-v0/types";
import type { SemanticRegionCandidatesDocumentV0 } from "../src/lib/proto-round-semantic-region-candidates-v0/types";
import {
  GroundTruthError,
  ASSISTED_REVIEW_MODE_ACTIVE,
  CONFIRM_AND_NEXT_LABEL,
  EXPLICIT_HUMAN_REVIEW_REQUIRED_FOR_COMPLETE,
  GROUND_TRUTH_FROM_OCR,
  NAVIGATION_ALONE_MARKS_COMPLETE,
  OCR_VISIBLE_DURING_TRUTH_ENTRY,
  OPTIONAL_SECTION_LABEL,
  PILOT_OPTIONAL_FIELDS,
  PILOT_SAMPLE_SIZE,
  PILOT_SOURCE,
  QUICK_MODE_ADVANCED_FIELDS,
  QUICK_MODE_PRIMARY_FIELDS,
  QUICK_UI_LABELS,
  TYPING_ALONE_MARKS_COMPLETE,
  applyQuickDraftToRecord,
  assertDiscoveryHoldoutDisjoint,
  blankHumanTruthFields,
  buildDiscoveryAnnotationDocumentV0,
  buildDiscoveryExportV0,
  buildGroundTruthPackV0,
  buildHoldoutSealV0,
  buildSelectionManifestV0,
  canonicalJson,
  collectEligibleRows,
  computeSelectionSortKey,
  confirmReviewAnnotationStatus,
  countAnnotatedRecords,
  createScreenshotBytesProbe,
  deriveQuickAnnotationStatus,
  exclusiveReviewOverrides,
  hashRowIdentity,
  importDiscoveryAnnotationV0,
  lineageImagesFromVisualRows,
  parseNumericCellsRaw,
  persistDraftAnnotationStatus,
  preserveOrCreateDiscoveryAnnotation,
  reconcileGroundTruthPackV0,
  renderDiscoveryAnnotationHtml,
  selectFrozenSamples,
  sha256CanonicalJson,
  pilotDiscoverySlice,
  type EligibleVisualRowV0,
  type ScreenshotBytesProbe,
} from "../src/lib/proto-round-ground-truth-v0";

const PROTO = "2026-105";
const OCR_LEAK = "OCR_LEAK_TOKEN_MUST_NOT_PREFILL";
const LIB_DIR = path.join("src", "lib", "proto-round-ground-truth-v0");

function extractPackFromHtml(html: string): {
  schemaVersion: string;
  protoRoundKey: string;
  pilotSampleSize: number;
  records: Array<{
    sourceImageSha256: string;
    screenshotHref: string;
    annotationStatus: string;
    visualRowIndex: number;
  }>;
} {
  const prefix = "const PACK = ";
  const start = html.indexOf(prefix);
  if (start < 0) {
    throw new Error("PACK payload missing from HTML");
  }
  const jsonStart = start + prefix.length;
  const unixEnd = html.indexOf(";\n    const STORAGE_KEY", jsonStart);
  const winEnd = html.indexOf(";\r\n    const STORAGE_KEY", jsonStart);
  const end = unixEnd >= 0 ? unixEnd : winEnd;
  if (end < 0) {
    throw new Error("PACK payload missing from HTML");
  }
  return JSON.parse(html.slice(jsonStart, end)) as {
    schemaVersion: string;
    protoRoundKey: string;
    pilotSampleSize: number;
    records: Array<{
      sourceImageSha256: string;
      screenshotHref: string;
      annotationStatus: string;
      visualRowIndex: number;
    }>;
  };
}

function sourceOf(fileName: string, start: string, end: string): string {
  const src = readFileSync(path.join(LIB_DIR, fileName), "utf8");
  const from = src.indexOf(start);
  const to = src.indexOf(end, from + start.length);
  if (from < 0 || to < 0) {
    throw new Error(`Could not isolate ${start} in ${fileName}`);
  }
  return src.slice(from, to);
}

function shaPad(n: number): string {
  return n.toString(16).padStart(64, "0");
}

function intakeFile(sha: string, fileName: string): PhysicalFileRecordV1 {
  return {
    relativePath: fileName,
    fileName,
    extension: ".png",
    byteSize: 12,
    sha256: sha,
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-01T00:00:00.000Z",
    filesystemMtime: null,
    filesystemBirthtime: null,
    fileStatus: "CANONICAL_IMAGE",
    canonicalSha256: sha,
    duplicateOfSha256: null,
    canonicalRelativePath: fileName,
    extractionEligible: true,
    extractionStatus: "NOT_EXTRACTED",
    timingClassification: "UNCLASSIFIED",
  };
}

function intakeDoc(files: PhysicalFileRecordV1[]): IntakeManifestV1 {
  return {
    meta: {
      schemaVersion: "proto-round-screenshot-intake-v1",
      operatorRoot: "YANG-EDGE-INBOX",
      year: 2026,
      round: 105,
      roundLabel: "105회차",
      protoRoundKey: PROTO,
      timezone: "Asia/Seoul",
      firstInitializedAt: "2026-01-01T00:00:00.000Z",
      lastScanAt: "2026-01-01T00:00:00.000Z",
      groupingPolicy: "PROTO_ROUND_PRIMARY",
      calendarDateSplit: false,
      rawImageStorage: "LOCAL_ONLY",
      ocrStatus: "NOT_IMPLEMENTED",
      oddsExtractionStatus: "NOT_IMPLEMENTED",
      exactImageDedupe: "IMPLEMENTED",
      nearImageDedupe: "NOT_IMPLEMENTED",
      rowObservationDedupe: "NOT_IMPLEMENTED",
      filesystemTimeTreatedAsVerifiedCaptureTime: false,
    },
    summary: {
      physicalFileCount: files.length,
      canonicalImageCount: files.length,
      duplicateExactCount: 0,
      unsupportedFileCount: 0,
      extractionEligibleCount: files.length,
    },
    files,
  };
}

function visualRow(input: {
  sha: string;
  fileName: string;
  index: number;
  topY?: number;
  bottomY?: number;
  centerY?: number;
}): VisualRowCandidateV0 {
  const topY = input.topY ?? input.index * 10;
  const bottomY = input.bottomY ?? topY + 8;
  return {
    sourceImageSha256: input.sha,
    sourceFileName: input.fileName,
    visualRowIndex: input.index,
    topY,
    bottomY,
    centerY: input.centerY ?? (topY + bottomY) / 2,
    normalizedTopY: topY / 1000,
    normalizedBottomY: bottomY / 1000,
    fragmentCount: 1,
    fragments: [
      {
        rawLineIndex: input.index,
        rawText: OCR_LEAK,
        boundingBox: { x: 1, y: topY, width: 10, height: 8 },
        x: 1,
        y: topY,
        width: 10,
        height: 8,
      },
    ],
    visualJoinedTextCandidate: OCR_LEAK,
    semanticStatus: "UNINTERPRETED",
    officialOddsStatus: "NOT_EXTRACTED",
    gameMatchStatus: "NOT_MATCHED",
  };
}

function visualImage(input: {
  sha: string;
  fileName: string;
  rowCount: number;
  invalidIndex?: number;
}): VisualRowsImageRecordV0 {
  const visualRows = Array.from({ length: input.rowCount }, (_, index) => {
    if (index === input.invalidIndex) {
      return visualRow({
        sha: input.sha,
        fileName: input.fileName,
        index,
        topY: Number.NaN,
        bottomY: 8,
      });
    }
    return visualRow({ sha: input.sha, fileName: input.fileName, index });
  });
  return {
    sourceImageSha256: input.sha,
    sourceFileName: input.fileName,
    acceptedObservationTime: null,
    observationTimeProvenance: null,
    imageWidth: 800,
    imageHeight: 1000,
    placedLineCount: input.rowCount,
    unplacedLineCount: 0,
    visualRowCandidateCount: input.rowCount,
    unplacedLines: [],
    visualRows,
  };
}

function visualDoc(images: VisualRowsImageRecordV0[]): VisualRowsDocumentV0 {
  return {
    meta: {
      schemaVersion: "proto-round-visual-rows-v0",
      protoRoundKey: PROTO,
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
    images,
  };
}

function memProbe(
  files: Record<string, string>,
): ScreenshotBytesProbe {
  return {
    async fileExists(rel) {
      return Object.prototype.hasOwnProperty.call(files, rel);
    },
    async fileSha256(rel) {
      const sha = files[rel];
      if (!sha) throw new Error("missing");
      return sha;
    },
  };
}

function universe(rowCounts: number[]) {
  const images = rowCounts.map((rowCount, i) => {
    const sha = shaPad(i + 1);
    const fileName = `shot-${i + 1}.png`;
    return {
      sha,
      fileName,
      image: visualImage({ sha, fileName, rowCount }),
      intake: intakeFile(sha, fileName),
    };
  });
  const visual = visualDoc(images.map((x) => x.image));
  const intake = intakeDoc(images.map((x) => x.intake));
  const files = Object.fromEntries(images.map((x) => [x.fileName, x.sha]));
  return { visual, intake, files, probe: memProbe(files) };
}

function eligibleFrom(visual: VisualRowsDocumentV0): EligibleVisualRowV0[] {
  return visual.images.flatMap((image) =>
    image.visualRows.map((row) => ({
      sourceImageSha256: row.sourceImageSha256,
      sourceFileName: row.sourceFileName,
      visualRowIndex: row.visualRowIndex,
      topY: row.topY,
      bottomY: row.bottomY,
      centerY: row.centerY,
      imageWidth: image.imageWidth ?? 800,
      imageHeight: image.imageHeight ?? 1000,
      screenshotRelativePath: row.sourceFileName,
    })),
  );
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = (i * 17 + 3) % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function libSource(fileName: string): string {
  return readFileSync(path.join(LIB_DIR, fileName), "utf8");
}

async function main() {
  const { visual, intake, probe } = universe([25, 25, 15]);
  const eligible = await collectEligibleRows({
    protoRoundKey: PROTO,
    visualRows: visual,
    intake,
    screenshot: probe,
  });
  assert.equal(eligible.length, 65);

  // A. selection deterministic for same input
  const a1 = selectFrozenSamples({ protoRoundKey: PROTO, eligibleRows: eligible });
  const a2 = selectFrozenSamples({ protoRoundKey: PROTO, eligibleRows: eligible });
  assert.deepEqual(a1, a2);
  assert.equal(a1.discovery.length, 30);
  assert.equal(a1.holdout.length, 30);

  // B. row input order does not affect selection
  const reversed = selectFrozenSamples({
    protoRoundKey: PROTO,
    eligibleRows: [...eligible].reverse(),
  });
  const shuffled = selectFrozenSamples({
    protoRoundKey: PROTO,
    eligibleRows: shuffle(eligible),
  });
  assert.deepEqual(reversed, a1);
  assert.deepEqual(shuffled, a1);

  // C. discovery and holdout are disjoint
  assertDiscoveryHoldoutDisjoint(a1);
  const discoveryIds = new Set(
    a1.discovery.map((k) => `${k.sourceImageSha256}|${k.visualRowIndex}`),
  );
  for (const key of a1.holdout) {
    assert.equal(discoveryIds.has(`${key.sourceImageSha256}|${key.visualRowIndex}`), false);
  }

  // D. exactly 30 + 30 when >=60 eligible rows
  assert.equal(a1.discovery.length + a1.holdout.length, 60);
  assert.throws(
    () =>
      selectFrozenSamples({
        protoRoundKey: PROTO,
        eligibleRows: eligible.slice(0, 59),
      }),
    (err: unknown) =>
      err instanceof GroundTruthError && err.code === "INSUFFICIENT_ELIGIBLE_ROWS",
  );

  // E/F/G. selection does not inspect OCR rawText / layoutPatternId / market tags
  const poisoned = eligible.map((row, i) => ({
    ...row,
    rawText: `${OCR_LEAK}-${i}`,
    layoutPatternId: i % 2 === 0 ? "LAYOUT_PATTERN_Z" : "LAYOUT_PATTERN_Y",
    rawEvidenceTags: ["EXACT_MARKET_MARKER_RAW"],
    visualJoinedTextCandidate: OCR_LEAK,
    scheduledLocalCandidate: "2026-09-06T11:30:00+09:00",
  }));
  const poisonedSelection = selectFrozenSamples({
    protoRoundKey: PROTO,
    eligibleRows: poisoned,
  });
  assert.deepEqual(poisonedSelection, a1);

  for (const fileName of ["select.ts", "lineage.ts", "geometry.ts", "hash.ts"]) {
    const src = libSource(fileName);
    assert.equal(src.includes("rawText"), false, fileName);
    assert.equal(src.includes("layoutPatternId"), false, fileName);
    assert.equal(src.includes("rawEvidenceTags"), false, fileName);
    assert.equal(src.includes("scheduledLocalCandidate"), false, fileName);
    assert.equal(src.includes("visualJoinedText"), false, fileName);
  }

  // H. duplicate row key fails closed
  assert.throws(
    () =>
      selectFrozenSamples({
        protoRoundKey: PROTO,
        eligibleRows: [eligible[0]!, eligible[0]!],
      }),
    (err: unknown) => err instanceof GroundTruthError && err.code === "DUPLICATE_ROW_KEY",
  );
  const dupVisual = visualDoc([
    visualImage({ sha: shaPad(1), fileName: "shot-1.png", rowCount: 1 }),
    visualImage({ sha: shaPad(1), fileName: "shot-1.png", rowCount: 1 }),
  ]);
  await assert.rejects(
    () =>
      collectEligibleRows({
        protoRoundKey: PROTO,
        visualRows: dupVisual,
        intake: intakeDoc([intakeFile(shaPad(1), "shot-1.png")]),
        screenshot: memProbe({ "shot-1.png": shaPad(1) }),
      }),
    (err: unknown) => err instanceof GroundTruthError && err.code === "DUPLICATE_ROW_KEY",
  );

  // I. unknown SHA fails closed
  const unknownVisual = visualDoc([
    visualImage({ sha: shaPad(99), fileName: "missing.png", rowCount: 1 }),
  ]);
  await assert.rejects(
    () =>
      collectEligibleRows({
        protoRoundKey: PROTO,
        visualRows: unknownVisual,
        intake,
        screenshot: probe,
      }),
    (err: unknown) => err instanceof GroundTruthError && err.code === "UNKNOWN_SOURCE_SHA",
  );

  // J. missing screenshot lineage fails closed
  await assert.rejects(
    () =>
      collectEligibleRows({
        protoRoundKey: PROTO,
        visualRows: visual,
        intake,
        screenshot: memProbe({}),
      }),
    (err: unknown) =>
      err instanceof GroundTruthError && err.code === "MISSING_SOURCE_SCREENSHOT",
  );
  await assert.rejects(
    () =>
      collectEligibleRows({
        protoRoundKey: PROTO,
        visualRows: visual,
        intake,
        screenshot: memProbe({
          "shot-1.png": shaPad(8),
          "shot-2.png": shaPad(2),
          "shot-3.png": shaPad(3),
        }),
      }),
    (err: unknown) => err instanceof GroundTruthError && err.code === "SOURCE_SHA_MISMATCH",
  );
  const mismatchIndex = visualDoc([
    {
      ...visualImage({ sha: shaPad(1), fileName: "shot-1.png", rowCount: 2 }),
      visualRows: [
        visualRow({ sha: shaPad(1), fileName: "shot-1.png", index: 7 }),
        visualRow({ sha: shaPad(1), fileName: "shot-1.png", index: 1 }),
      ],
    },
  ]);
  await assert.rejects(
    () =>
      collectEligibleRows({
        protoRoundKey: PROTO,
        visualRows: mismatchIndex,
        intake: intakeDoc([intakeFile(shaPad(1), "shot-1.png")]),
        screenshot: memProbe({ "shot-1.png": shaPad(1) }),
      }),
    (err: unknown) =>
      err instanceof GroundTruthError && err.code === "VISUAL_ROW_INDEX_MISMATCH",
  );

  const lineageOnly = lineageImagesFromVisualRows(visual);
  assert.equal(
    JSON.stringify(lineageOnly).includes(OCR_LEAK),
    false,
  );
  assert.equal("fragments" in lineageOnly[0]!.visualRows[0]!, false);

  // K/L. blank truth fields remain blank; no OCR prefill
  const discoveryDoc = buildDiscoveryAnnotationDocumentV0({
    protoRoundKey: PROTO,
    discoveryRowKeys: a1.discovery,
    eligibleRows: eligible,
  });
  assert.equal(discoveryDoc.records.length, 30);
  for (const record of discoveryDoc.records) {
    assert.equal(record.annotationStatus, "UNANNOTATED");
    assert.equal(record.screenRowIdentifierRaw, null);
    assert.equal(record.screenDateRaw, null);
    assert.equal(record.screenTimeRaw, null);
    assert.equal(record.leagueDisplayRaw, null);
    assert.equal(record.participantLeftRaw, null);
    assert.equal(record.participantRightRaw, null);
    assert.equal(record.marketMarkerRaw, null);
    assert.deepEqual(record.numericCellsRaw, []);
    assert.equal(record.statusTextRaw, null);
    assert.deepEqual(record.otherVisibleTextRaw, []);
    assert.equal(record.annotatorNotes, null);
    assert.equal(JSON.stringify(record).includes(OCR_LEAK), false);
  }
  const blank = blankHumanTruthFields();
  assert.equal(blank.annotationStatus, "UNANNOTATED");
  assert.equal(blank.screenRowIdentifierRaw, null);

  const html = renderDiscoveryAnnotationHtml(discoveryDoc);
  assert.equal(html.includes(OCR_LEAK), false);
  assert.equal(html.includes("rawText"), false);
  assert.equal(html.includes("visualJoinedText"), false);
  assert.equal(html.includes("layoutPatternId"), false);

  // M/N/O. no home/away truth fields, no normalized team IDs, no odds numeric conversion
  const recordKeys = Object.keys(discoveryDoc.records[0]!).join("\n");
  assert.equal(/home|away|teamId|providerId|oddsNumeric|officialGame/i.test(recordKeys), false);
  assert.match(recordKeys, /participantLeftRaw/);
  assert.match(recordKeys, /participantRightRaw/);
  assert.equal(html.includes("HOME"), false);
  assert.equal(html.includes("AWAY"), false);
  assert.equal(discoveryDoc.homeAwayAssigned, false);
  assert.equal(discoveryDoc.teamNormalization, "NOT_PERFORMED");
  assert.equal(discoveryDoc.marketNormalization, "NOT_PERFORMED");
  assert.equal(discoveryDoc.discoveryAnnotated, false);
  assert.equal(discoveryDoc.accuracyMetric, "NOT_AVAILABLE_YET");

  // P. holdout export contains no visual/OCR content
  const manifest = buildSelectionManifestV0({ protoRoundKey: PROTO, selection: a1 });
  const manifestSha = sha256CanonicalJson(manifest);
  const seal = buildHoldoutSealV0({
    protoRoundKey: PROTO,
    holdoutRowKeys: a1.holdout,
    selectionManifestSha256: manifestSha,
  });
  const sealJson = JSON.stringify(seal);
  assert.equal(seal.holdoutSampleSize, 30);
  assert.equal(seal.holdoutRowKeyHashes.length, 30);
  assert.equal(sealJson.includes("rawText"), false);
  assert.equal(sealJson.includes("sourceFileName"), false);
  assert.equal(sealJson.includes("visualRowIndex"), false);
  assert.equal(sealJson.includes("topY"), false);
  assert.equal(sealJson.includes(OCR_LEAK), false);
  assert.equal(seal.holdoutRowKeyHashes[0], hashRowIdentity(a1.holdout[0]!));
  const discoveryShas = new Set(a1.discovery.map((k) => k.sourceImageSha256));
  for (const key of a1.holdout) {
    if (!discoveryShas.has(key.sourceImageSha256)) {
      assert.equal(html.includes(key.sourceImageSha256), false);
    }
  }

  // Q. selection manifest hashing deterministic
  assert.equal(sha256CanonicalJson(manifest), sha256CanonicalJson(structuredClone(manifest)));
  assert.equal(sha256CanonicalJson(seal), sha256CanonicalJson(structuredClone(seal)));
  const sortKey = computeSelectionSortKey({
    protoRoundKey: PROTO,
    sourceImageSha256: eligible[0]!.sourceImageSha256,
    visualRowIndex: eligible[0]!.visualRowIndex,
  });
  assert.equal(sortKey.length, 64);

  // R. source screenshot bytes unchanged
  const dir = await mkdtemp(path.join(tmpdir(), "gt-v0-"));
  const bytes = Buffer.from("PNG-BYTES-UNCHANGED");
  const fileAbs = path.join(dir, "shot-1.png");
  await writeFile(fileAbs, bytes);
  const before = sha256RawBytes(bytes);
  const diskVisual = visualDoc([
    visualImage({ sha: before, fileName: "shot-1.png", rowCount: 1 }),
  ]);
  await collectEligibleRows({
    protoRoundKey: PROTO,
    visualRows: diskVisual,
    intake: intakeDoc([intakeFile(before, "shot-1.png")]),
    screenshot: createScreenshotBytesProbe(dir),
  });
  const after = sha256RawBytes(await readFile(fileAbs));
  assert.equal(after, before);

  const semantic: SemanticRegionCandidatesDocumentV0 = {
    meta: {
      schemaVersion: "proto-round-semantic-region-candidates-v0",
      protoRoundKey: PROTO,
      year: 2026,
      round: 105,
      sourceColumnLayoutSchema: "proto-round-column-layout-audit-v0",
      sourceImages: 3,
      sourceVisualRows: 65,
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
      totalRows: 0,
      totalRegions: 0,
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
    rows: eligible.map((row, i) => ({
      sourceImageSha256: row.sourceImageSha256,
      sourceFileName: row.sourceFileName,
      visualRowIndex: row.visualRowIndex,
      rowIdentifierCandidate: 9413,
      scheduledLocalCandidate: i % 3 === 0 ? "2026-09-06T11:30:00+09:00" : null,
      layoutPatternId: i % 2 === 0 ? "LAYOUT_PATTERN_A" : "LAYOUT_PATTERN_B",
      visualJoinedTextCandidate: OCR_LEAK,
      regions: [
        {
          regionIndex: 0,
          occupiedBandIndex: 1,
          normalizedLeft: 0.1,
          normalizedRight: 0.2,
          joinedRawText: i % 5 === 0 ? "U2.5" : "nc",
          fragments: [],
          semanticRole: "UNASSIGNED",
          rawEvidenceTags:
            i % 5 === 0 ? ["EXACT_MARKET_MARKER_RAW"] : ["TEXT_BEARING_RAW"],
          geometryStatus: "VALID",
        },
      ],
      rowRawEvidenceSignature: i % 5 === 0 ? "M" : "T",
      teamParsingStatus: "NOT_PERFORMED",
      leagueParsingStatus: "NOT_PERFORMED",
      marketParsingStatus: "NOT_PERFORMED",
      oddsParsingStatus: "NOT_PERFORMED",
      gameMatchingStatus: "NOT_PERFORMED",
      acceptedObservationTime: null,
    })),
  };

  const pack = await buildGroundTruthPackV0({
    protoRoundKey: PROTO,
    visualRows: visual,
    intake,
    screenshot: probe,
    semanticRegions: semantic,
  });
  assert.equal(pack.selectionManifest.discoveryRowKeys.length, 30);
  assert.equal(pack.holdoutSeal.holdoutSampleSize, 30);
  assert.equal(pack.discoveryAnnotation.records.length, 30);
  assert.equal(pack.discoveryHtml.includes(OCR_LEAK), false);
  assert.equal(JSON.stringify(pack.holdoutSeal).includes(OCR_LEAK), false);
  assert.equal(pack.coverage.postSelectionCoverageAuditOnly, true);
  assert.equal(pack.coverage.discoverySampleSize, 30);
  assert.ok(pack.coverage.sourceScreenshotCount >= 1);
  assert.ok(pack.coverage.layoutPatternIdCount >= 1);
  assert.equal(eligibleFrom(visual).length, 65);

  const invalidGeometry = visualDoc([
    visualImage({
      sha: shaPad(1),
      fileName: "shot-1.png",
      rowCount: 3,
      invalidIndex: 1,
    }),
  ]);
  const filtered = await collectEligibleRows({
    protoRoundKey: PROTO,
    visualRows: invalidGeometry,
    intake: intakeDoc([intakeFile(shaPad(1), "shot-1.png")]),
    screenshot: memProbe({ "shot-1.png": shaPad(1) }),
  });
  assert.equal(filtered.length, 2);
  assert.deepEqual(
    filtered.map((r) => r.visualRowIndex),
    [0, 2],
  );

  function expectCode(err: unknown, code: string): boolean {
    return err instanceof GroundTruthError && err.code === code;
  }

  // Overwrite blocker / rerun idempotence
  const init = await reconcileGroundTruthPackV0({
    protoRoundKey: PROTO,
    visualRows: visual,
    intake,
    screenshot: probe,
  });
  assert.equal(init.selectionArtifact.action, "CREATED");
  const annotated = structuredClone(init.discoveryAnnotation);
  annotated.records[0]!.annotationStatus = "COMPLETE";
  annotated.records[0]!.participantLeftRaw = "한화";
  annotated.records[0]!.participantRightRaw = "NC";
  annotated.records[0]!.marketMarkerRaw = "U2.5";
  annotated.records[0]!.numericCellsRaw = ["1.79"];
  annotated.records[0]!.otherVisibleTextRaw = ["  spaced  "];
  annotated.records[0]!.annotatorNotes = "exact raw";
  const rerun = await reconcileGroundTruthPackV0({
    protoRoundKey: PROTO,
    visualRows: visual,
    intake,
    screenshot: probe,
    existing: {
      selectionManifestRaw: init.selectionArtifact.raw,
      holdoutSealRaw: init.holdoutSealArtifact.raw,
      discoveryAnnotationRaw: canonicalJson(annotated),
    },
  });
  assert.equal(rerun.selectionArtifact.write, false);
  assert.equal(rerun.holdoutSealArtifact.write, false);
  assert.equal(rerun.discoveryAnnotationArtifact.write, false);
  assert.equal(rerun.selectionManifestSha256, init.selectionManifestSha256);
  assert.equal(rerun.holdoutSealSha256, init.holdoutSealSha256);
  assert.equal(rerun.discoveryAnnotation.records[0]!.annotationStatus, "COMPLETE");
  assert.equal(rerun.discoveryAnnotation.records[0]!.participantLeftRaw, "한화");
  assert.equal(rerun.discoveryAnnotation.records[0]!.participantRightRaw, "NC");
  assert.equal(rerun.discoveryAnnotation.records[0]!.marketMarkerRaw, "U2.5");
  assert.deepEqual(rerun.discoveryAnnotation.records[0]!.numericCellsRaw, ["1.79"]);
  assert.deepEqual(rerun.discoveryAnnotation.records[0]!.otherVisibleTextRaw, ["  spaced  "]);
  assert.equal(rerun.discoveryHtml.includes("한화"), true);
  assert.equal(rerun.discoveryHtml.includes(OCR_LEAK), false);

  // Selection drift: extra eligible image changes the frozen universe
  const drifted = universe([25, 25, 15, 1]);
  await assert.rejects(
    () =>
      reconcileGroundTruthPackV0({
        protoRoundKey: PROTO,
        visualRows: drifted.visual,
        intake: drifted.intake,
        screenshot: drifted.probe,
        existing: {
          selectionManifestRaw: init.selectionArtifact.raw,
          holdoutSealRaw: init.holdoutSealArtifact.raw,
          discoveryAnnotationRaw: init.discoveryAnnotationArtifact.raw,
        },
      }),
    (err: unknown) => expectCode(err, "FROZEN_SELECTION_DRIFT"),
  );

  // Holdout seal drift
  const corruptedSeal = JSON.parse(init.holdoutSealArtifact.raw) as {
    holdoutRowKeyHashes: string[];
  };
  corruptedSeal.holdoutRowKeyHashes[0] = "0".repeat(64);
  await assert.rejects(
    () =>
      reconcileGroundTruthPackV0({
        protoRoundKey: PROTO,
        visualRows: visual,
        intake,
        screenshot: probe,
        existing: {
          selectionManifestRaw: init.selectionArtifact.raw,
          holdoutSealRaw: canonicalJson(corruptedSeal),
          discoveryAnnotationRaw: init.discoveryAnnotationArtifact.raw,
        },
      }),
    (err: unknown) => expectCode(err, "HOLDOUT_SEAL_DRIFT"),
  );

  // Annotation identity drift
  const missing = structuredClone(init.discoveryAnnotation);
  missing.records = missing.records.slice(1);
  assert.throws(
    () =>
      preserveOrCreateDiscoveryAnnotation({
        existingRaw: canonicalJson(missing),
        protoRoundKey: PROTO,
        expectedBlank: init.discoveryAnnotation,
        discoveryRowKeys: init.selectionManifest.discoveryRowKeys,
        holdoutRowKeys: init.selectionManifest.holdoutRowKeys,
      }),
    (err: unknown) => expectCode(err, "DISCOVERY_ANNOTATION_IDENTITY_DRIFT"),
  );

  const duplicate = structuredClone(init.discoveryAnnotation);
  duplicate.records[1] = structuredClone(duplicate.records[0]!);
  assert.throws(
    () =>
      preserveOrCreateDiscoveryAnnotation({
        existingRaw: canonicalJson(duplicate),
        protoRoundKey: PROTO,
        expectedBlank: init.discoveryAnnotation,
        discoveryRowKeys: init.selectionManifest.discoveryRowKeys,
        holdoutRowKeys: init.selectionManifest.holdoutRowKeys,
      }),
    (err: unknown) => expectCode(err, "DISCOVERY_ANNOTATION_DUPLICATE_ROW"),
  );

  const extra = structuredClone(init.discoveryAnnotation);
  extra.records.push(structuredClone(extra.records[0]!));
  extra.records[extra.records.length - 1]!.visualRowIndex = 999;
  extra.records[extra.records.length - 1]!.sourceImageSha256 = shaPad(99);
  assert.throws(
    () =>
      preserveOrCreateDiscoveryAnnotation({
        existingRaw: canonicalJson(extra),
        protoRoundKey: PROTO,
        expectedBlank: init.discoveryAnnotation,
        discoveryRowKeys: init.selectionManifest.discoveryRowKeys,
        holdoutRowKeys: init.selectionManifest.holdoutRowKeys,
      }),
    (err: unknown) => expectCode(err, "DISCOVERY_ANNOTATION_IDENTITY_DRIFT"),
  );

  const leaked = structuredClone(init.discoveryAnnotation);
  leaked.records[0]!.sourceImageSha256 = init.selectionManifest.holdoutRowKeys[0]!.sourceImageSha256;
  leaked.records[0]!.visualRowIndex = init.selectionManifest.holdoutRowKeys[0]!.visualRowIndex;
  assert.throws(
    () =>
      preserveOrCreateDiscoveryAnnotation({
        existingRaw: canonicalJson(leaked),
        protoRoundKey: PROTO,
        expectedBlank: init.discoveryAnnotation,
        discoveryRowKeys: init.selectionManifest.discoveryRowKeys,
        holdoutRowKeys: init.selectionManifest.holdoutRowKeys,
      }),
    (err: unknown) => expectCode(err, "DISCOVERY_ANNOTATION_HOLDOUT_LEAK"),
  );

  // Human text preservation via import; frozen identity cannot change
  const importPayload = {
    schemaVersion: "proto-round-ground-truth-discovery-v0",
    protoRoundKey: PROTO,
    records: init.discoveryAnnotation.records.map((record, i) => ({
      sourceImageSha256: record.sourceImageSha256,
      sourceFileName: record.sourceFileName,
      visualRowIndex: record.visualRowIndex,
      annotationStatus: i === 0 ? "COMPLETE" : "UNANNOTATED",
      screenRowIdentifierRaw: i === 0 ? "9413" : null,
      screenDateRaw: i === 0 ? "09-06" : null,
      screenTimeRaw: i === 0 ? "11:30" : null,
      leagueDisplayRaw: i === 0 ? "J2리그" : null,
      participantLeftRaw: i === 0 ? "한화" : null,
      participantRightRaw: i === 0 ? "NC" : null,
      marketMarkerRaw: i === 0 ? "U2.5" : null,
      numericCellsRaw: i === 0 ? ["1.79"] : [],
      statusTextRaw: null,
      otherVisibleTextRaw: i === 0 ? ["  spaced  "] : [],
      annotatorNotes: i === 0 ? "keep punctuation!" : null,
    })),
  };
  const imported = importDiscoveryAnnotationV0({
    protoRoundKey: PROTO,
    selectionManifest: init.selectionManifest,
    existingAnnotation: init.discoveryAnnotation,
    imported: importPayload,
  });
  assert.equal(imported.records[0]!.participantLeftRaw, "한화");
  assert.equal(imported.records[0]!.participantRightRaw, "NC");
  assert.equal(imported.records[0]!.leagueDisplayRaw, "J2리그");
  assert.equal(imported.records[0]!.marketMarkerRaw, "U2.5");
  assert.deepEqual(imported.records[0]!.numericCellsRaw, ["1.79"]);
  assert.deepEqual(imported.records[0]!.otherVisibleTextRaw, ["  spaced  "]);
  assert.equal(imported.records[0]!.annotatorNotes, "keep punctuation!");
  assert.deepEqual(
    imported.records[0]!.targetRowGeometry,
    init.discoveryAnnotation.records[0]!.targetRowGeometry,
  );
  const mutateGeometry = structuredClone(importPayload);
  mutateGeometry.records[0]!.targetRowGeometry = {
    ...init.discoveryAnnotation.records[0]!.targetRowGeometry,
    topY: 0,
  };
  assert.throws(
    () =>
      importDiscoveryAnnotationV0({
        protoRoundKey: PROTO,
        selectionManifest: init.selectionManifest,
        existingAnnotation: init.discoveryAnnotation,
        imported: mutateGeometry,
      }),
    (err: unknown) => expectCode(err, "ANNOTATION_IMPORT_MUTATES_FROZEN_IDENTITY"),
  );

  // Quick UI v0 / Pilot 10
  assert.equal(QUICK_MODE_PRIMARY_FIELDS.length, 4);
  assert.equal(PILOT_SAMPLE_SIZE, 10);
  assert.equal(PILOT_SOURCE, "FIRST_10_FROZEN_DISCOVERY_ROWS");
  assert.equal(ASSISTED_REVIEW_MODE_ACTIVE, false);
  assert.equal(GROUND_TRUTH_FROM_OCR, false);
  assert.equal(OCR_VISIBLE_DURING_TRUTH_ENTRY, false);
  assert.equal(TYPING_ALONE_MARKS_COMPLETE, false);
  assert.equal(NAVIGATION_ALONE_MARKS_COMPLETE, false);
  assert.equal(EXPLICIT_HUMAN_REVIEW_REQUIRED_FOR_COMPLETE, true);

  const formHtml = html.slice(html.indexOf('<form id="truthForm"'), html.indexOf("</form>"));
  const detailsHtml = formHtml.slice(formHtml.indexOf("<details>"));
  const visibleHtml = formHtml.slice(0, formHtml.indexOf("<details>"));
  for (const field of QUICK_MODE_PRIMARY_FIELDS) {
    assert.equal(field in discoveryDoc.records[0]!, true);
    assert.equal(visibleHtml.includes(`data-schema-field="${field}"`), true);
    assert.equal(html.includes(QUICK_UI_LABELS[field]), true);
    assert.equal(detailsHtml.includes(`data-schema-field="${field}"`), false);
  }
  for (const field of PILOT_OPTIONAL_FIELDS) {
    assert.equal(field in discoveryDoc.records[0]!, true);
    assert.equal(detailsHtml.includes(`data-schema-field="${field}"`), true);
    assert.equal(visibleHtml.includes(`data-schema-field="${field}"`), false);
    assert.equal(html.includes(QUICK_UI_LABELS[field]), true);
  }
  assert.deepEqual([...QUICK_MODE_ADVANCED_FIELDS], [...PILOT_OPTIONAL_FIELDS]);
  assert.equal(html.includes(OPTIONAL_SECTION_LABEL), true);
  assert.equal(html.includes("Advanced / Optional"), false);
  assert.equal(html.includes("<details open"), false);
  assert.equal(html.includes("HOME"), false);
  assert.equal(html.includes("AWAY"), false);
  assert.equal(/holdout/i.test(html), false);
  assert.equal(html.includes(OCR_LEAK), false);
  assert.equal(html.includes("Last saved:"), true);
  assert.equal(html.includes("Annotated"), true);
  assert.equal(html.includes("1 / 10"), true);
  assert.equal(html.includes("1 / 30"), false);
  assert.equal(html.includes(CONFIRM_AND_NEXT_LABEL), true);
  assert.equal(html.includes("confirmAndNext"), true);
  assert.equal(html.includes("autosave(false)"), true);
  assert.equal(html.includes('e.key === "Enter" && shortcut'), true);
  assert.equal(html.includes("if (e.key === \"Enter\" && editing)"), true);
  assert.equal(html.includes("% PILOT_COUNT"), true);
  assert.equal(html.includes("% records.length"), false);
  assert.equal(html.includes('getElementById("fieldRowId")'), true);

  const blankDraft = {
    uncertain: false,
    unreadable: false,
    screenRowIdentifierRaw: null,
    screenDateRaw: null,
    screenTimeRaw: null,
    leagueDisplayRaw: null,
    participantLeftRaw: null,
    participantRightRaw: null,
    marketMarkerRaw: null,
    numericCellsRaw: [] as string[],
    statusTextRaw: null,
    otherVisibleTextRaw: [] as string[],
    annotatorNotes: null,
  };
  const typedDraft = {
    ...blankDraft,
    screenRowIdentifierRaw: "9571",
    screenDateRaw: "09.06(일)",
    screenTimeRaw: "19:15",
    leagueDisplayRaw: "에레디비",
    numericCellsRaw: parseNumericCellsRaw("2.95 3.50 1.91"),
    statusTextRaw: "경기전",
  };
  assert.equal(persistDraftAnnotationStatus("UNANNOTATED"), "UNANNOTATED");
  assert.equal(deriveQuickAnnotationStatus(typedDraft), "UNANNOTATED");
  assert.equal(
    deriveQuickAnnotationStatus(typedDraft, { confirm: false, currentStatus: "UNANNOTATED" }),
    "UNANNOTATED",
  );
  assert.equal(confirmReviewAnnotationStatus(typedDraft), "COMPLETE");
  assert.equal(
    deriveQuickAnnotationStatus(typedDraft, { confirm: true, currentStatus: "UNANNOTATED" }),
    "COMPLETE",
  );
  assert.equal(
    confirmReviewAnnotationStatus({ ...typedDraft, uncertain: true }),
    "UNCERTAIN",
  );
  assert.equal(
    confirmReviewAnnotationStatus({ ...typedDraft, unreadable: true }),
    "UNREADABLE",
  );
  assert.deepEqual(
    exclusiveReviewOverrides({ uncertain: true, unreadable: true, lastToggled: "unreadable" }),
    { uncertain: false, unreadable: true },
  );
  assert.deepEqual(
    exclusiveReviewOverrides({ uncertain: true, unreadable: true, lastToggled: "uncertain" }),
    { uncertain: true, unreadable: false },
  );
  const draftOnly = applyQuickDraftToRecord(discoveryDoc.records[0]!, typedDraft);
  assert.equal(draftOnly.annotationStatus, "UNANNOTATED");
  assert.equal(draftOnly.screenRowIdentifierRaw, "9571");
  assert.equal(countAnnotatedRecords([draftOnly, ...discoveryDoc.records.slice(1)]), 0);
  const surviving = applyQuickDraftToRecord(
    { ...discoveryDoc.records[0]!, annotationStatus: "COMPLETE", participantLeftRaw: "한화" },
    { ...blankDraft, participantLeftRaw: "한화", participantRightRaw: "NC" },
  );
  assert.equal(surviving.annotationStatus, "COMPLETE");
  assert.equal(surviving.participantRightRaw, "NC");

  assert.deepEqual(parseNumericCellsRaw("2.95 3.50 1.91"), ["2.95", "3.50", "1.91"]);
  assert.deepEqual(parseNumericCellsRaw("2.95,3.50,1.91"), ["2.95", "3.50", "1.91"]);
  const numericToken = parseNumericCellsRaw("1.790")[0];
  assert.equal(numericToken, "1.790");
  assert.equal(typeof numericToken, "string");
  assert.deepEqual(parseNumericCellsRaw("2-03"), ["2-03"]);

  const filled = applyQuickDraftToRecord(
    discoveryDoc.records[0]!,
    {
      ...blankDraft,
      participantLeftRaw: "한화",
      numericCellsRaw: parseNumericCellsRaw("2.95 3.50 1.91"),
      marketMarkerRaw: null,
      otherVisibleTextRaw: [],
      annotatorNotes: null,
    },
    { confirm: true },
  );
  assert.equal(filled.annotationStatus, "COMPLETE");
  assert.equal(filled.marketMarkerRaw, null);
  assert.equal(countAnnotatedRecords([filled, ...discoveryDoc.records.slice(1)]), 1);

  const preservedHtml = renderDiscoveryAnnotationHtml({
    ...discoveryDoc,
    records: [filled, ...discoveryDoc.records.slice(1)],
  });
  assert.equal(preservedHtml.includes("한화"), true);
  assert.deepEqual(
    preservedHtml.includes(filled.sourceImageSha256),
    true,
  );
  const exported = buildDiscoveryExportV0(discoveryDoc, [
    filled,
    ...discoveryDoc.records.slice(1),
  ]);
  const roundTripped = importDiscoveryAnnotationV0({
    protoRoundKey: PROTO,
    selectionManifest: buildSelectionManifestV0({
      protoRoundKey: PROTO,
      selection: a1,
    }),
    existingAnnotation: discoveryDoc,
    imported: exported,
  });
  assert.equal(roundTripped.records[0]!.participantLeftRaw, "한화");
  assert.deepEqual(roundTripped.records[0]!.numericCellsRaw, ["2.95", "3.50", "1.91"]);
  assert.equal(roundTripped.records[0]!.sourceImageSha256, discoveryDoc.records[0]!.sourceImageSha256);
  assert.equal(roundTripped.records[0]!.visualRowIndex, discoveryDoc.records[0]!.visualRowIndex);
  assert.deepEqual(
    roundTripped.records.map((r) => `${r.sourceImageSha256}|${r.visualRowIndex}`),
    discoveryDoc.records.map((r) => `${r.sourceImageSha256}|${r.visualRowIndex}`),
  );

  // Pilot 10 subset / render / export contract
  const pilot = pilotDiscoverySlice(discoveryDoc.records);
  assert.equal(pilot.length, 10);
  assert.deepEqual(
    pilot.map((r) => `${r.sourceImageSha256}|${r.visualRowIndex}`),
    discoveryDoc.records.slice(0, 10).map((r) => `${r.sourceImageSha256}|${r.visualRowIndex}`),
  );
  const sliceSrc = sourceOf(
    "quick-ui.ts",
    "export function pilotDiscoverySlice",
    "export function buildDiscoveryExportV0",
  );
  assert.equal(sliceSrc.includes("rawText"), false);
  assert.equal(sliceSrc.includes("layoutPatternId"), false);
  assert.equal(sliceSrc.includes("slice(0, PILOT_SAMPLE_SIZE)"), true);

  const htmlPack = extractPackFromHtml(html);
  assert.equal(htmlPack.pilotSampleSize, 10);
  assert.equal(htmlPack.records.length, 30);
  assert.equal(htmlPack.records.filter((r) => r.screenshotHref.length > 0).length, 10);
  assert.equal(
    htmlPack.records.slice(10).every((r) => r.screenshotHref === ""),
    true,
  );
  assert.deepEqual(
    htmlPack.records.slice(0, 10).map((r) => `${r.sourceImageSha256}|${r.visualRowIndex}`),
    discoveryDoc.records.slice(0, 10).map((r) => `${r.sourceImageSha256}|${r.visualRowIndex}`),
  );
  assert.equal(html.includes("id=\"totalCount\">10"), true);
  assert.equal(exported.records.length, 30);
  assert.equal(exported.records.slice(10).every((r) => r.annotationStatus === "UNANNOTATED"), true);
  assert.equal(roundTripped.records.length, 30);
  assert.equal(
    roundTripped.records.slice(10).every((r) => r.annotationStatus === "UNANNOTATED"),
    true,
  );
  assert.equal(html.includes("tabindex=\"1\""), true);
  assert.equal(html.includes("tabindex=\"5\""), true);
  assert.equal(confirmReviewAnnotationStatus(blankDraft), "COMPLETE");
  assert.equal(html.includes("if (i >= PILOT_COUNT) continue;"), true);
  assert.equal(html.includes("function restoreNonPilotRecords()"), true);
  assert.equal(html.includes("restoreNonPilotRecords();"), true);

  console.log("test:proto-round-ground-truth-v0 OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
