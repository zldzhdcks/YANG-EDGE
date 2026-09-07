/**
 * Synthetic tests for Pilot10 evaluator logic.
 * Network: 0. Does not read Holdout. Does not modify the parser.
 *
 *   npm run test:proto-round-structured-extraction-eval-v0
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FLOAT_NORMALIZATION,
  HOLDOUT_UNAVAILABLE_TO_EVALUATOR,
  HOLDOUT_VISUAL_CONTENT_READ,
  PILOT_COUNT,
  StructuredExtractionEvalError,
  classifyNumericFailure,
  classifyParticipantFailure,
  evaluatePilot10Discovery,
  identityKey,
  marketTruthPresent,
  numericExact,
  stringsEqual,
} from "../src/lib/proto-round-structured-extraction-eval-v0";

function ident(n: number) {
  return { sourceImageSha256: `sha-${n}`, visualRowIndex: n };
}

function truth(n: number, extra?: Partial<ReturnType<typeof baseTruth>>) {
  return { ...baseTruth(n), ...extra };
}

function baseTruth(n: number) {
  return {
    ...ident(n),
    annotationStatus: "COMPLETE",
    screenRowIdentifierRaw: String(9400 + n),
    participantLeftRaw: `left-${n}`,
    participantRightRaw: `right-${n}`,
    numericCellsRaw: ["1.91", "1.63"],
    marketMarkerRaw: null as string | null,
  };
}

function machine(n: number, extra?: Partial<ReturnType<typeof baseMachine>>) {
  return { ...baseMachine(n), ...extra };
}

function baseMachine(n: number) {
  return {
    ...ident(n),
    screenRowIdentifierCandidateRaw: String(9400 + n),
    participantLeftCandidateRaw: `left-${n}`,
    participantRightCandidateRaw: `right-${n}`,
    numericCellsCandidateRaw: ["1.91", "1.63"],
    marketMarkerCandidateRaw: null as string | null,
  };
}

function tenKeys() {
  return Array.from({ length: 10 }, (_, i) => ident(i));
}

function sourceFiles(): string[] {
  const lib = path.join(process.cwd(), "src/lib/proto-round-structured-extraction-eval-v0");
  return [
    ...readdirSync(lib).filter((f) => f.endsWith(".ts")).map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/eval-proto-round-structured-extraction-pilot10-v0.ts"),
  ];
}

async function main() {
  assert.equal(PILOT_COUNT, 10);
  assert.equal(HOLDOUT_VISUAL_CONTENT_READ, false);
  assert.equal(HOLDOUT_UNAVAILABLE_TO_EVALUATOR, true);
  assert.equal(FLOAT_NORMALIZATION, "DISABLED");
  assert.equal(identityKey("abc", 3), "abc|3");
  assert.equal(stringsEqual("9413", "9413"), true);
  assert.equal(stringsEqual("9413", "9414"), false);
  assert.equal(numericExact(["1.91", "1.63"], ["1.91", "1.63"]), true);
  assert.equal(numericExact(["1.91", "1.63"], ["1.63", "1.91"]), false);
  assert.equal(numericExact(["2.09"], ["2.90"]), false);
  assert.equal(numericExact(["2.10"], ["2.1"]), false);
  assert.equal(marketTruthPresent(null), false);
  assert.equal(marketTruthPresent(""), false);
  assert.equal(marketTruthPresent("U2.5"), true);

  const perfect = evaluatePilot10Discovery({
    selection: { discoveryRowKeys: [...tenKeys(), ident(99)] },
    truthRecords: [
      ...Array.from({ length: 10 }, (_, i) => truth(i)),
      truth(99, { participantLeftRaw: "NOT_PILOT" }),
    ],
    machineRecords: [
      ...Array.from({ length: 10 }, (_, i) => machine(i)),
      machine(99, { participantLeftCandidateRaw: "NOT_PILOT" }),
    ],
  });
  assert.equal(perfect.pilotRows, 10);
  assert.equal(perfect.rowIdentifierExactCount, 10);
  assert.equal(perfect.participantLeftExactCount, 10);
  assert.equal(perfect.participantRightExactCount, 10);
  assert.equal(perfect.numericCellsExactCount, 10);
  assert.equal(perfect.primaryFourExactRowCount, 10);
  assert.equal(perfect.marketMarkerEvaluableCount, 0);
  assert.equal(perfect.marketMarkerExactCount, 0);
  assert.equal(perfect.fullStructureEvaluableCount, 0);
  assert.equal(perfect.fullStructureExactCount, 0);
  assert.equal(perfect.rows.every((r) => r.visualRowIndex <= 9), true);
  assert.equal(perfect.rows.some((r) => r.visualRowIndex === 99), false);

  const mismatches = evaluatePilot10Discovery({
    selection: { discoveryRowKeys: tenKeys() },
    truthRecords: Array.from({ length: 10 }, (_, i) =>
      truth(i, {
        participantLeftRaw: "한화",
        participantRightRaw: "기아",
        numericCellsRaw: ["2.09", "1.80"],
        marketMarkerRaw: i === 0 ? "U2.5" : null,
      }),
    ),
    machineRecords: Array.from({ length: 10 }, (_, i) =>
      machine(i, {
        participantLeftCandidateRaw: "한와",
        participantRightCandidateRaw: "기야",
        numericCellsCandidateRaw: ["2-09", "1-80"],
        marketMarkerCandidateRaw: "U2.5",
      }),
    ),
  });
  assert.equal(mismatches.rowIdentifierExactCount, 10);
  assert.equal(mismatches.participantLeftExactCount, 0);
  assert.equal(mismatches.participantRightExactCount, 0);
  assert.equal(mismatches.numericCellsExactCount, 0);
  assert.equal(mismatches.primaryFourExactRowCount, 0);
  assert.equal(mismatches.marketMarkerEvaluableCount, 1);
  assert.equal(mismatches.marketMarkerExactCount, 1);
  assert.equal(mismatches.fullStructureEvaluableCount, 1);
  assert.equal(mismatches.fullStructureExactCount, 0);

  assert.throws(
    () =>
      evaluatePilot10Discovery({
        selection: { discoveryRowKeys: tenKeys() },
        truthRecords: Array.from({ length: 10 }, (_, i) => truth(i)),
        machineRecords: Array.from({ length: 9 }, (_, i) => machine(i)),
      }),
    (err: unknown) =>
      err instanceof StructuredExtractionEvalError && err.code.startsWith("PILOT_EXTRACTION_JOIN_FAILED"),
  );

  assert.equal(
    classifyParticipantFailure({
      human: "한화",
      machine: "한와",
      otherHuman: "기아",
      semantic: {
        sourceImageSha256: "sha",
        visualRowIndex: 0,
        regions: [
          {
            joinedRawText: "한와",
            rawEvidenceTags: ["TEXT_BEARING_RAW"],
            normalizedLeft: 0.3,
            normalizedRight: 0.4,
            fragments: [{ rawText: "한와" }],
          },
        ],
      },
    }),
    "OCR_TEXT_MISMATCH",
  );
  assert.equal(
    classifyNumericFailure({
      human: ["2.09", "1.80"],
      machine: ["2-09", "1-80"],
      semantic: {
        sourceImageSha256: "sha",
        visualRowIndex: 0,
        regions: [
          {
            joinedRawText: "2-09",
            rawEvidenceTags: ["NUMERIC_LIKE_RAW"],
            normalizedLeft: 0.5,
            normalizedRight: 0.6,
            fragments: [{ rawText: "2-09" }],
          },
          {
            joinedRawText: "1-80",
            rawEvidenceTags: ["NUMERIC_LIKE_RAW"],
            normalizedLeft: 0.7,
            normalizedRight: 0.8,
            fragments: [{ rawText: "1-80" }],
          },
        ],
      },
    }),
    "OCR_TEXT_MISMATCH",
  );

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("holdoutRowKeys"), false, abs);
    assert.equal(src.includes("holdout-seal"), false, abs);
    assert.equal(src.includes("fetch("), false, abs);
    assert.equal(src.includes("postgame"), false, abs);
    assert.equal(src.includes("2-09 → 2.09"), false, abs);
    assert.equal(src.includes("parseStructuredRowV0"), false, abs);
    assert.equal(src.includes("proto-round-structured-extraction-v0/parser"), false, abs);
  }

  console.log("test:proto-round-structured-extraction-eval-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
