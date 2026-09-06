/**
 * Proto-round raw OCR v0 tests.
 * Deterministic mock provider. No real OCR engine. No real screenshots. Network: 0.
 *
 *   npm run test:proto-round-raw-ocr-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PhysicalFileRecordV1 } from "../src/lib/proto-round-screenshot-intake-v1";
import {
  extractRawOcrV0,
  isAutoMergeEligible,
  ManifestPathEscapeError,
  measureRawOcrCharacterQuality,
  observationIdentityMayAuthorizeMerge,
  OCR_ACCURACY_PERCENT,
  OCR_LINE_ORDER_USED_AS_ROW_STRUCTURE,
  previewColonRawLines,
  previewDecimalPointRawLines,
  previewHangulRawLines,
  previewNonEmptyRawLines,
  resolveContainedCanonicalImageAbs,
  selectCanonicalExtractionRows,
  createMockLocalOcrProvider,
} from "../src/lib/proto-round-raw-ocr-v0";

const PNG_A = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const PNG_B = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]);

function sha256Buf(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function record(partial: {
  relativePath: string;
  fileName: string;
  bytes: Buffer;
  fileStatus: PhysicalFileRecordV1["fileStatus"];
  extractionEligible: boolean;
}): PhysicalFileRecordV1 {
  return {
    relativePath: partial.relativePath,
    fileName: partial.fileName,
    extension: ".png",
    byteSize: partial.bytes.length,
    sha256: sha256Buf(partial.bytes),
    firstSeenAt: "2026-09-06T02:00:00.000Z",
    lastSeenAt: "2026-09-06T02:00:00.000Z",
    filesystemMtime: "2026-09-06T02:00:00.000Z",
    filesystemBirthtime: "2026-09-06T02:00:00.000Z",
    fileStatus: partial.fileStatus,
    canonicalSha256: sha256Buf(partial.bytes),
    duplicateOfSha256: null,
    canonicalRelativePath: partial.relativePath,
    extractionEligible: partial.extractionEligible,
    extractionStatus: "NOT_EXTRACTED",
    timingClassification: "UNCLASSIFIED",
  };
}

async function main() {
  const roundAbs = mkdtempSync(path.join(tmpdir(), "proto-round-raw-ocr-"));
  const shotName = "스크린샷 2026-09-06 105222.png";
  const dupName = "copy.png";
  writeFileSync(path.join(roundAbs, shotName), PNG_A);
  writeFileSync(path.join(roundAbs, dupName), PNG_A);

  const canonical = record({
    relativePath: shotName,
    fileName: shotName,
    bytes: PNG_A,
    fileStatus: "CANONICAL_IMAGE",
    extractionEligible: true,
  });
  const duplicate = record({
    relativePath: dupName,
    fileName: dupName,
    bytes: PNG_A,
    fileStatus: "DUPLICATE_EXACT",
    extractionEligible: false,
  });

  // C. path traversal rejected
  const roundResolved = path.resolve(roundAbs);
  assert.equal(
    path.basename(resolveContainedCanonicalImageAbs(roundResolved, shotName)),
    shotName,
  );
  await assert.rejects(
    async () => resolveContainedCanonicalImageAbs(roundResolved, "../secret.png"),
    ManifestPathEscapeError,
  );
  await assert.rejects(
    async () => resolveContainedCanonicalImageAbs(roundResolved, "..\\secret.png"),
    ManifestPathEscapeError,
  );
  await assert.rejects(
    async () =>
      resolveContainedCanonicalImageAbs(roundResolved, "C:\\\\Windows\\\\x.png"),
    ManifestPathEscapeError,
  );
  await assert.rejects(
    async () =>
      resolveContainedCanonicalImageAbs(roundResolved, ".yang-edge/intake-manifest-v1.json"),
    ManifestPathEscapeError,
  );
  await assert.rejects(
    async () =>
      resolveContainedCanonicalImageAbs(roundResolved, "sub/.yang-edge/x.png"),
    ManifestPathEscapeError,
  );
  await assert.rejects(
    async () => resolveContainedCanonicalImageAbs(roundResolved, "/tmp/x.png"),
    ManifestPathEscapeError,
  );

  const unsupported = record({
    relativePath: "notes.txt",
    fileName: "notes.txt",
    bytes: PNG_B,
    fileStatus: "UNSUPPORTED_FILE",
    extractionEligible: false,
  });

  // A + B. canonical accepted, duplicate and unsupported excluded
  assert.deepEqual(
    selectCanonicalExtractionRows([canonical, duplicate, unsupported]).map(
      (f) => f.relativePath,
    ),
    [shotName],
  );

  const rawExact = "팀A 1.80\n팀B 2.00";
  const provider = createMockLocalOcrProvider({
    extract: async (imagePath) => {
      const base = path.basename(imagePath);
      if (base === shotName) {
        return {
          rawText: rawExact,
          rawLines: [{ text: "팀A 1.80" }, { text: "팀B 2.00" }],
        };
      }
      throw new Error("unexpected image");
    },
  });

  const doc = await extractRawOcrV0({
    year: 2026,
    round: 105,
    protoRoundKey: "2026-105",
    roundAbs: roundResolved,
    files: [canonical, duplicate],
    provider,
  });
  assert.equal(doc.images.length, 1);
  assert.equal(doc.meta.sourceCanonicalImages, 1);
  assert.equal(doc.meta.networkUsed, false);
  assert.equal(doc.meta.officialOddsExtraction, "NOT_PERFORMED");
  assert.equal(doc.meta.gameMatching, "NOT_PERFORMED");
  assert.equal(doc.meta.crossImageRowDedupe, "DISABLED");
  assert.equal(doc.meta.acceptedObservationTimes, "NOT_ASSIGNED");
  assert.equal(doc.meta.filenameTimestampUsedAsCapturedAt, false);

  const img = doc.images[0]!;
  assert.equal(img.ocrStatus, "OCR_OK");
  // D. raw OCR text preserved
  assert.equal(img.rawText, rawExact);
  assert.deepEqual(
    img.rawLines?.map((l) => l.text),
    ["팀A 1.80", "팀B 2.00"],
  );
  // raw line order is provider order, not visual row structure
  assert.equal(OCR_LINE_ORDER_USED_AS_ROW_STRUCTURE, false);
  assert.equal(doc.meta.ocrLineOrderUsedAsRowStructure, false);
  assert.equal(OCR_ACCURACY_PERCENT, "NOT_MEASURABLE_YET");
  assert.equal(doc.meta.ocrAccuracyPercent, "NOT_MEASURABLE_YET");
  assert.equal("homeOdds" in img, false);
  assert.equal("awayOdds" in img, false);
  assert.equal("moneyline" in img, false);

  // E + F. filename timestamp remains candidate; accepted time null
  assert.equal(img.filenameTimestampParseStatus, "PARSED_EXACT_PATTERN");
  assert.equal(img.filenameTimestampCandidateKst, "2026-09-06T10:52:22+09:00");
  assert.equal(img.filenameTimestampCandidateUtc, "2026-09-06T01:52:22.000Z");
  assert.equal(img.candidateProvenance, "FILENAME_OS_GENERATED_CANDIDATE");
  assert.equal(img.acceptedObservationTime, null);
  assert.equal(img.observationTimeProvenance, null);
  assert.equal(Object.prototype.hasOwnProperty.call(img, "capturedAt"), false);

  // G. AUTO_MERGE_ELIGIBLE=false when accepted time null
  assert.equal(isAutoMergeEligible(null), false);
  assert.equal(isAutoMergeEligible("2026-09-06T10:52:22+09:00"), false);
  assert.equal(observationIdentityMayAuthorizeMerge(null), false);
  assert.equal(img.AUTO_MERGE_ELIGIBLE, false);

  assert.deepEqual(previewNonEmptyRawLines(img.rawLines, 8), ["팀A 1.80", "팀B 2.00"]);

  const orderedName = "스크린샷 2026-09-06 105248.png";
  writeFileSync(path.join(roundAbs, orderedName), PNG_A);
  const orderedRow = record({
    relativePath: orderedName,
    fileName: orderedName,
    bytes: PNG_A,
    fileStatus: "CANONICAL_IMAGE",
    extractionEligible: true,
  });
  const orderedLines = ["9413", "축구", "1.85", "20:00"];
  const orderedDoc = await extractRawOcrV0({
    year: 2026,
    round: 105,
    protoRoundKey: "2026-105",
    roundAbs: roundResolved,
    files: [orderedRow],
    provider: createMockLocalOcrProvider({
      extract: async () => ({
        rawText: orderedLines.join("\n"),
        rawLines: orderedLines.map((text) => ({ text })),
      }),
    }),
  });
  assert.deepEqual(
    orderedDoc.images[0]!.rawLines?.map((l) => l.text),
    orderedLines,
  );
  assert.equal(orderedDoc.images[0]!.rawText, orderedLines.join("\n"));
  assert.deepEqual(previewHangulRawLines(orderedDoc.images[0]!.rawLines, 5), ["축구"]);
  assert.deepEqual(previewDecimalPointRawLines(orderedDoc.images[0]!.rawLines, 5), ["1.85"]);
  assert.deepEqual(previewColonRawLines(orderedDoc.images[0]!.rawLines, 3), ["20:00"]);
  const q = measureRawOcrCharacterQuality(orderedLines.join("\n"), 4);
  assert.equal(q.hangulCharacterCount, 2);
  assert.equal(q.digitCharacterCount, 11);
  assert.equal(q.decimalPointCharacterCount, 1);
  assert.equal(q.colonCharacterCount, 1);
  assert.equal("homeOdds" in q, false);
  assert.equal("kickoff" in q, false);

  // H. OCR empty result is preserved as OCR_EMPTY
  const emptyName = "스크린샷 2026-09-06 105230.png";
  writeFileSync(path.join(roundAbs, emptyName), PNG_B);
  const emptyRow = record({
    relativePath: emptyName,
    fileName: emptyName,
    bytes: PNG_B,
    fileStatus: "CANONICAL_IMAGE",
    extractionEligible: true,
  });
  const emptyDoc = await extractRawOcrV0({
    year: 2026,
    round: 105,
    protoRoundKey: "2026-105",
    roundAbs: roundResolved,
    files: [emptyRow],
    provider: createMockLocalOcrProvider({
      extract: async () => ({ rawText: "   \n", rawLines: [{ text: "   " }] }),
    }),
  });
  assert.equal(emptyDoc.images[0]!.ocrStatus, "OCR_EMPTY");
  assert.equal(emptyDoc.images[0]!.rawText, "   \n");
  assert.equal(emptyDoc.images[0]!.acceptedObservationTime, null);
  assert.equal(emptyDoc.images[0]!.AUTO_MERGE_ELIGIBLE, false);

  // I. OCR provider error fails per-image safely
  const okName = "스크린샷 2026-09-06 105236.png";
  const errName = "스크린샷 2026-09-06 105241.png";
  writeFileSync(path.join(roundAbs, okName), PNG_A);
  writeFileSync(path.join(roundAbs, errName), PNG_B);
  const okRow = record({
    relativePath: okName,
    fileName: okName,
    bytes: PNG_A,
    fileStatus: "CANONICAL_IMAGE",
    extractionEligible: true,
  });
  const errRow = record({
    relativePath: errName,
    fileName: errName,
    bytes: PNG_B,
    fileStatus: "CANONICAL_IMAGE",
    extractionEligible: true,
  });
  const mixed = await extractRawOcrV0({
    year: 2026,
    round: 105,
    protoRoundKey: "2026-105",
    roundAbs: roundResolved,
    files: [okRow, errRow],
    provider: createMockLocalOcrProvider({
      extract: async (imagePath) => {
        if (path.basename(imagePath) === errName) throw new Error("boom");
        return { rawText: "ok", rawLines: [{ text: "ok" }] };
      },
    }),
  });
  assert.equal(mixed.images.length, 2);
  assert.equal(mixed.images[0]!.ocrStatus, "OCR_OK");
  assert.equal(mixed.images[0]!.rawText, "ok");
  assert.equal(mixed.images[1]!.ocrStatus, "OCR_ERROR");
  assert.equal(mixed.images[1]!.rawText, null);
  assert.equal(mixed.images[1]!.errorCode, "OCR_PROVIDER_ERROR");
  assert.equal(mixed.images[1]!.AUTO_MERGE_ELIGIBLE, false);

  await assert.rejects(
    () =>
      extractRawOcrV0({
        year: 2026,
        round: 105,
        protoRoundKey: "2026-105",
        roundAbs: roundResolved,
        files: [
          record({
            relativePath: "../escape.png",
            fileName: "escape.png",
            bytes: PNG_A,
            fileStatus: "CANONICAL_IMAGE",
            extractionEligible: true,
          }),
        ],
        provider,
      }),
    ManifestPathEscapeError,
  );

  // J. no network path exists in core extraction module
  const coreFiles = [
    "extract.ts",
    "path-containment.ts",
    "auto-merge.ts",
    "provider.ts",
    "types.ts",
    "index.ts",
  ];
  const forbidden =
    /from ["']node:https?["']|from ["']undici["']|from ["']node:net["']|\bfetch\s*\(|https?:\/\/|openai|googleapis|clova/i;
  for (const name of coreFiles) {
    const src = readFileSync(
      path.join(process.cwd(), "src/lib/proto-round-raw-ocr-v0", name),
      "utf8",
    );
    assert.equal(forbidden.test(src), false, `network path in ${name}`);
  }

  console.log("PROTO_ROUND_RAW_OCR_V0_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
