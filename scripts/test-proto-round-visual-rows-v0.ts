/**
 * Proto-round visual rows v0 tests.
 * Synthetic bounding boxes only. No real OCR. No screenshots. Network: 0.
 *
 *   npm run test:proto-round-visual-rows-v0
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ProtoRoundLocalOcrLine } from "../src/lib/proto-round-raw-ocr-v0";
import {
  areVerticallyCompatible,
  assertOcrSourceLineageMatchesExpected,
  FOUR_DIGIT_TOKEN_SEMANTIC_ROLE,
  MARKET_SIGNAL_SEMANTICS_ASSIGNED,
  reconstructVisualRowsForImage,
  rowHasStandaloneFourDigitToken,
  VERTICAL_OVERLAP_THRESHOLD,
  verticalOverlapRatio,
  VisualRowsLineageError,
} from "../src/lib/proto-round-visual-rows-v0";

function box(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ProtoRoundLocalOcrLine {
  return { text, boundingBox: { x, y, width, height } };
}

function reconstruct(lines: ProtoRoundLocalOcrLine[]) {
  return reconstructVisualRowsForImage({
    sourceImageSha256: "sha-test",
    sourceFileName: "synthetic.png",
    rawLines: lines,
    dims: { width: 800, height: 1000 },
  });
}

async function main() {
  assert.equal(VERTICAL_OVERLAP_THRESHOLD, 0.5);

  // A. same vertical band + different X → same row
  const sameBand = reconstruct([
    box("right", 200, 10, 40, 10),
    box("left", 10, 10, 40, 10),
  ]);
  assert.equal(sameBand.visualRowCandidateCount, 1);
  assert.deepEqual(
    sameBand.visualRows[0]!.fragments.map((f) => f.rawText),
    ["left", "right"],
  );
  assert.equal(sameBand.visualRows[0]!.visualJoinedTextCandidate, "left right");

  // B. vertical overlap < 0.50 → different rows
  // A: 0–10, B: 6–16, overlap=4, minH=10, ratio=0.40
  const low = reconstruct([box("a", 0, 0, 10, 10), box("b", 0, 6, 10, 10)]);
  assert.equal(
    verticalOverlapRatio(
      { y: 0, height: 10, bottomY: 10 },
      { y: 6, height: 10, bottomY: 16 },
    ),
    0.4,
  );
  assert.equal(areVerticallyCompatible(
    { y: 0, height: 10, bottomY: 10 },
    { y: 6, height: 10, bottomY: 16 },
  ), false);
  assert.equal(low.visualRowCandidateCount, 2);

  // C. exact threshold 0.50 → same row
  // A: 0–10, B: 5–15, overlap=5, minH=10, ratio=0.50
  assert.equal(
    verticalOverlapRatio(
      { y: 0, height: 10, bottomY: 10 },
      { y: 5, height: 10, bottomY: 15 },
    ),
    0.5,
  );
  const exact = reconstruct([box("a", 0, 0, 10, 10), box("b", 40, 5, 10, 10)]);
  assert.equal(exact.visualRowCandidateCount, 1);
  assert.equal(exact.visualRows[0]!.visualJoinedTextCandidate, "a b");

  // D. nearby Y but zero actual overlap → different rows
  // A: 0–10, B: 10–20, overlap=0
  const touch = reconstruct([box("a", 0, 0, 10, 10), box("b", 0, 10, 10, 10)]);
  assert.equal(
    verticalOverlapRatio(
      { y: 0, height: 10, bottomY: 10 },
      { y: 10, height: 10, bottomY: 20 },
    ),
    0,
  );
  assert.equal(touch.visualRowCandidateCount, 2);

  // E. transitive chaining protection
  // A: 0–10 centerY=5; B: 4–14 centerY=9 ratio(A,B)=0.6; C: 9–19 centerY=14 ratio(B,C)=0.5 ratio(A,C)=0.1
  const chained = reconstruct([
    box("C", 0, 9, 10, 10),
    box("A", 0, 0, 10, 10),
    box("B", 20, 4, 10, 10),
  ]);
  assert.equal(
    verticalOverlapRatio(
      { y: 0, height: 10, bottomY: 10 },
      { y: 9, height: 10, bottomY: 19 },
    ),
    0.1,
  );
  assert.equal(chained.visualRowCandidateCount, 2);
  const joined = chained.visualRows.map((r) => r.visualJoinedTextCandidate).sort();
  assert.deepEqual(joined, ["A B", "C"]);

  // F. within-row X ordering
  const xOrder = reconstruct([
    box("3", 90, 0, 8, 8),
    box("1", 10, 0, 8, 8),
    box("2", 50, 0, 8, 8),
  ]);
  assert.equal(xOrder.visualRows[0]!.visualJoinedTextCandidate, "1 2 3");
  assert.deepEqual(
    xOrder.visualRows[0]!.fragments.map((f) => f.x),
    [10, 50, 90],
  );

  // G. provider input order shuffled → same visual rows
  const orderA = reconstruct([
    box("9413", 10, 20, 20, 10),
    box("team", 80, 21, 30, 10),
    box("U3.5", 200, 22, 20, 10),
    box("9414", 10, 80, 20, 10),
  ]);
  const orderB = reconstruct([
    box("U3.5", 200, 22, 20, 10),
    box("9414", 10, 80, 20, 10),
    box("9413", 10, 20, 20, 10),
    box("team", 80, 21, 30, 10),
  ]);
  assert.deepEqual(
    orderA.visualRows.map((r) => r.visualJoinedTextCandidate),
    orderB.visualRows.map((r) => r.visualJoinedTextCandidate),
  );
  assert.deepEqual(
    orderA.visualRows.map((r) => r.fragments.map((f) => f.rawLineIndex)),
    [
      [0, 1, 2],
      [3],
    ],
  );
  assert.deepEqual(
    orderB.visualRows.map((r) => r.fragments.map((f) => f.rawText)),
    [
      ["9413", "team", "U3.5"],
      ["9414"],
    ],
  );

  // H. missing bounding box → UNPLACED_OCR_LINE
  const missing = reconstruct([
    box("placed", 0, 0, 10, 10),
    { text: "ghost" },
    { text: "bad", boundingBox: { x: 1, y: 1, width: 0, height: 10 } },
  ]);
  assert.equal(missing.placedLineCount, 1);
  assert.equal(missing.unplacedLineCount, 2);
  assert.equal(missing.unplacedLines[0]!.reason, "MISSING_BOUNDING_BOX");
  assert.equal(missing.unplacedLines[0]!.rawText, "ghost");
  assert.equal(missing.unplacedLines[1]!.reason, "INVALID_BOUNDING_BOX");
  assert.equal(missing.visualRowCandidateCount, 1);

  // I. raw text preserved exactly
  const raw = "09 06(일) 17고0";
  const preserved = reconstruct([box(raw, 0, 0, 40, 10), box("U3.5", 80, 0, 20, 10)]);
  assert.equal(preserved.visualRows[0]!.fragments[0]!.rawText, raw);
  assert.equal(preserved.visualRows[0]!.visualJoinedTextCandidate, `${raw} U3.5`);

  // J. no semantic odds/game fields created
  const row = preserved.visualRows[0]!;
  assert.equal(row.semanticStatus, "UNINTERPRETED");
  assert.equal(row.officialOddsStatus, "NOT_EXTRACTED");
  assert.equal(row.gameMatchStatus, "NOT_MATCHED");
  assert.equal("homeOdds" in row, false);
  assert.equal("awayOdds" in row, false);
  assert.equal("drawOdds" in row, false);
  assert.equal("kickoff" in row, false);
  assert.equal("gameNumber" in row, false);
  assert.equal("handicap" in row, false);
  assert.equal("total" in row, false);
  assert.equal("homeTeam" in row, false);
  assert.equal("awayTeam" in row, false);
  assert.equal("league" in row, false);
  assert.equal("sport" in row, false);
  assert.equal("pick" in row, false);
  assert.equal(preserved.acceptedObservationTime, null);

  // K. visualJoinedTextCandidate is derived only; fragment rawText unchanged
  assert.equal(
    row.visualJoinedTextCandidate,
    row.fragments.map((f) => f.rawText).join(" "),
  );
  assert.equal(row.fragments[0]!.rawText, raw);
  assert.equal(row.fragments[1]!.rawText, "U3.5");

  // L. threshold fixed at 0.50
  assert.equal(VERTICAL_OVERLAP_THRESHOLD, 0.5);
  assert.equal(FOUR_DIGIT_TOKEN_SEMANTIC_ROLE, "UNASSIGNED");
  assert.equal(MARKET_SIGNAL_SEMANTICS_ASSIGNED, false);
  const fourDigitRow = reconstruct([
    box("9413", 0, 0, 20, 10),
    box("U3.5", 40, 0, 20, 10),
  ]).visualRows[0]!;
  assert.equal(rowHasStandaloneFourDigitToken(fourDigitRow), true);
  assert.equal("gameNumber" in fourDigitRow, false);

  function lineagePair(count: number) {
    const files = Array.from({ length: count }, (_, i) => ({
      fileStatus: "CANONICAL_IMAGE" as const,
      extractionEligible: true,
      sha256: `sha-${i + 1}`,
    }));
    const ocr = {
      meta: {
        protoRoundKey: "2099-1",
        year: 2099,
        round: 1,
        sourceCanonicalImages: count,
      },
      images: files.map((f) => ({ sourceImageSha256: f.sha256 })),
    };
    const manifest = {
      meta: { protoRoundKey: "2099-1", year: 2099, round: 1 },
      files,
    };
    return { manifest, ocr };
  }

  for (const n of [1, 2, 11, 15]) {
    const expected = assertOcrSourceLineageMatchesExpected(lineagePair(n));
    assert.equal(expected.size, n);
  }

  const missingOne = lineagePair(2);
  missingOne.ocr.images = missingOne.ocr.images.slice(0, 1);
  missingOne.ocr.meta.sourceCanonicalImages = 1;
  await assert.rejects(
    async () => assertOcrSourceLineageMatchesExpected(missingOne),
    (err: unknown) =>
      err instanceof VisualRowsLineageError &&
      err.code === "MISSING_CANONICAL_OCR_SOURCE",
  );

  const extraUnknown = lineagePair(1);
  extraUnknown.ocr.images.push({ sourceImageSha256: "sha-unknown" });
  extraUnknown.ocr.meta.sourceCanonicalImages = 2;
  await assert.rejects(
    async () => assertOcrSourceLineageMatchesExpected(extraUnknown),
    (err: unknown) =>
      err instanceof VisualRowsLineageError && err.code === "UNKNOWN_OCR_SOURCE",
  );

  const duplicate = lineagePair(1);
  duplicate.ocr.images.push({ sourceImageSha256: "sha-1" });
  duplicate.ocr.meta.sourceCanonicalImages = 2;
  await assert.rejects(
    async () => assertOcrSourceLineageMatchesExpected(duplicate),
    (err: unknown) =>
      err instanceof VisualRowsLineageError &&
      err.code === "DUPLICATE_OCR_SOURCE_SHA",
  );

  await assert.rejects(
    async () =>
      assertOcrSourceLineageMatchesExpected({
        manifest: {
          meta: { protoRoundKey: "2099-1", year: 2099, round: 1 },
          files: [
            {
              fileStatus: "DUPLICATE_EXACT",
              extractionEligible: false,
              sha256: "sha-dup",
            },
          ],
        },
        ocr: {
          meta: {
            protoRoundKey: "2099-1",
            year: 2099,
            round: 1,
            sourceCanonicalImages: 0,
          },
          images: [],
        },
      }),
    (err: unknown) =>
      err instanceof VisualRowsLineageError &&
      err.code === "NO_CANONICAL_IMAGES_FOR_VISUAL_ROWS",
  );

  const metaCount = lineagePair(2);
  metaCount.ocr.meta.sourceCanonicalImages = 99;
  await assert.rejects(
    async () => assertOcrSourceLineageMatchesExpected(metaCount),
    (err: unknown) =>
      err instanceof VisualRowsLineageError &&
      err.code === "OCR_META_SOURCE_COUNT_MISMATCH",
  );

  const keyMismatch = lineagePair(1);
  keyMismatch.ocr.meta.protoRoundKey = "2099-2";
  await assert.rejects(
    async () => assertOcrSourceLineageMatchesExpected(keyMismatch),
    (err: unknown) =>
      err instanceof VisualRowsLineageError &&
      err.code === "OCR_PROTO_ROUND_KEY_MISMATCH",
  );

  const src = readFileSync(
    path.join(process.cwd(), "src/lib/proto-round-visual-rows-v0/reconstruct.ts"),
    "utf8",
  );
  assert.equal(
    /from ["']node:https?["']|\bfetch\s*\(|https?:\/\/|openai|googleapis|clova/i.test(src),
    false,
  );

  console.log("PROTO_ROUND_VISUAL_ROWS_V0_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
