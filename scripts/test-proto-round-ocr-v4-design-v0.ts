/**
 * OCR v4 development design freeze tests.
 * Synthetic identities only. No Holdout visual. No Round 106 pixels. No v4 experiment.
 *
 *   npm run test:proto-round-ocr-v4-design-v0
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildDevelopmentCorpusV0,
  classifyNumericFailure,
  classifyParticipantFailure,
  frozenOcrV4CandidateDefinitions,
  leftRightHalfRowBands,
  MAXIMUM_V4_CANDIDATES,
  OCR_V4_CANDIDATES,
  ocrV4SuccessLevel,
  OcrV4DesignV0Error,
  recurringFamilies,
  selectOcrV4Winner,
  TEAM_NAME_DICTIONARY_FORBIDDEN,
  THREE_DIGIT_DECIMAL_GUESS_FORBIDDEN,
  WINNER_RULE_ORDER_V4,
} from "../src/lib/proto-round-ocr-v4-design-v0";
import { hashRowIdentity } from "../src/lib/proto-round-ocr-v4-design-v0/hash";

function gitDiffExitCode(rel: string): number {
  try {
    execFileSync("git", ["diff", "--exit-code", "--", rel], {
      stdio: "pipe",
      encoding: "utf8",
    });
    return 0;
  } catch (err) {
    const e = err as { status?: number };
    return typeof e.status === "number" ? e.status : 1;
  }
}

function sourceFiles(): string[] {
  const lib = path.join(process.cwd(), "src/lib/proto-round-ocr-v4-design-v0");
  return [
    ...readdirSync(lib)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/run-proto-round-ocr-v4-development-audit-v0.ts"),
  ];
}

function key(n: number) {
  return { sourceImageSha256: `sha-${String(n).padStart(2, "0")}`, visualRowIndex: n };
}

async function main() {
  const defs = frozenOcrV4CandidateDefinitions();
  assert.equal(defs.length, 6);
  assert.equal(defs.length <= MAXIMUM_V4_CANDIDATES, true);
  assert.equal(OCR_V4_CANDIDATES.length, 6);
  assert.equal(TEAM_NAME_DICTIONARY_FORBIDDEN, true);
  assert.equal(THREE_DIGIT_DECIMAL_GUESS_FORBIDDEN, true);
  assert.deepEqual(
    [...WINNER_RULE_ORDER_V4],
    [
      "participantPairExactEvidencePresent",
      "participantExactSlotCount",
      "numericRawAllExactRowCount",
      "numericRawExactCellCount",
      "simplerPreprocessing",
    ],
  );

  const pilot10 = Array.from({ length: 10 }, (_, i) => key(i));
  const discovery2 = Array.from({ length: 10 }, (_, i) => key(i + 10));
  const validationHash = hashRowIdentity(key(99));
  const holdoutHash = hashRowIdentity(key(80));
  const corpus = buildDevelopmentCorpusV0({
    pilot10,
    discovery2,
    validation2RowKeyHashes: [validationHash],
    holdoutRowKeyHashes: [holdoutHash],
  });
  assert.equal(corpus.total, 20);
  assert.equal(corpus.pilot10Count, 10);
  assert.equal(corpus.discovery2Count, 10);
  assert.equal(corpus.duplicates, 0);
  assert.equal(corpus.overlapValidation2, 0);
  assert.equal(corpus.overlapFormalHoldout, 0);
  assert.equal(corpus.ROUND_106_USED_FOR_V4_DESIGN, false);
  assert.equal(corpus.roles.Validation2, "UNSEEN_VALIDATION");
  assert.equal(corpus.roles.FreshValidation, "HISTORICAL_BLIND_VALIDATION");
  assert.equal(corpus.roles.FormalHoldout, "SEALED_FINAL_RESEARCH_HOLDOUT");
  assert.equal(corpus.roles.Round106NewScreenshots, "OPERATIONAL_EVIDENCE_ONLY");

  assert.throws(
    () =>
      buildDevelopmentCorpusV0({
        pilot10,
        discovery2: [...discovery2.slice(0, 9), key(0)],
        validation2RowKeyHashes: [validationHash],
        holdoutRowKeyHashes: [holdoutHash],
      }),
    (err: unknown) =>
      err instanceof OcrV4DesignV0Error && err.code === "DEVELOPMENT_CORPUS_DUPLICATE",
  );
  assert.throws(
    () =>
      buildDevelopmentCorpusV0({
        pilot10,
        discovery2,
        validation2RowKeyHashes: [hashRowIdentity(pilot10[0]!)],
        holdoutRowKeyHashes: [holdoutHash],
      }),
    (err: unknown) =>
      err instanceof OcrV4DesignV0Error && err.code === "VALIDATION2_OVERLAP",
  );
  assert.throws(
    () =>
      buildDevelopmentCorpusV0({
        pilot10,
        discovery2,
        validation2RowKeyHashes: [validationHash],
        holdoutRowKeyHashes: [hashRowIdentity(discovery2[0]!)],
      }),
    (err: unknown) =>
      err instanceof OcrV4DesignV0Error && err.code === "HOLDOUT_OVERLAP",
  );

  const bands = leftRightHalfRowBands({
    topY: 10,
    bottomY: 30,
    imageWidth: 800,
    imageHeight: 400,
  });
  assert.equal(bands.deterministic, true);
  assert.equal(bands.left?.x, 0);
  assert.equal(bands.right?.x, 400);

  assert.equal(
    classifyParticipantFailure({
      truth: "alpha",
      evidenceParts: [""],
      otherSlotTruth: "beta",
    }),
    "NO_TEXT_DETECTED",
  );
  assert.equal(
    classifyParticipantFailure({
      truth: "alpha",
      evidenceParts: ["al pha"],
      otherSlotTruth: null,
    }),
    "FRAGMENTED_TEXT",
  );
  assert.equal(
    classifyParticipantFailure({
      truth: "alpha",
      evidenceParts: ["alp"],
      otherSlotTruth: null,
    }),
    "PREFIX_LOSS",
  );
  assert.equal(
    classifyNumericFailure({ truth: "2.95", evidenceParts: ["2 95"] }),
    "DECIMAL_TO_SPACE",
  );
  assert.equal(
    classifyNumericFailure({ truth: "1.91", evidenceParts: ["1-91"] }),
    "DECIMAL_TO_HYPHEN",
  );
  assert.equal(
    classifyNumericFailure({ truth: "2.64", evidenceParts: ["264"] }),
    "DECIMAL_DROPPED",
  );

  const winner = selectOcrV4Winner([
    {
      candidate: "CONTRAST_NORMALIZE_ROW_UPSCALE_4X_LINEAR_KO",
      participantPairExactEvidencePresent: 2,
      participantExactSlotCount: 8,
      numericRawAllExactRowCount: 2,
      numericRawExactCellCount: 10,
    },
    {
      candidate: "LEFT_RIGHT_HALF_ROW_BANDS_UPSCALE_4X_LINEAR_KO",
      participantPairExactEvidencePresent: 2,
      participantExactSlotCount: 8,
      numericRawAllExactRowCount: 2,
      numericRawExactCellCount: 10,
    },
  ]);
  assert.equal(winner, "LEFT_RIGHT_HALF_ROW_BANDS_UPSCALE_4X_LINEAR_KO");

  assert.equal(
    ocrV4SuccessLevel({
      baselinePair: 2,
      candidatePair: 2,
      baselineNumericRawAllExactRows: 1,
      candidateNumericRawAllExactRows: 1,
      candidatePairExact: 2,
    }),
    "V4_LEVEL_0",
  );
  assert.equal(
    ocrV4SuccessLevel({
      baselinePair: 2,
      candidatePair: 3,
      baselineNumericRawAllExactRows: 1,
      candidateNumericRawAllExactRows: 1,
      candidatePairExact: 3,
    }),
    "V4_LEVEL_1",
  );
  assert.equal(
    ocrV4SuccessLevel({
      baselinePair: 2,
      candidatePair: 4,
      baselineNumericRawAllExactRows: 1,
      candidateNumericRawAllExactRows: 2,
      candidatePairExact: 4,
    }),
    "V4_LEVEL_2",
  );
  assert.equal(
    ocrV4SuccessLevel({
      baselinePair: 2,
      candidatePair: 5,
      baselineNumericRawAllExactRows: 1,
      candidateNumericRawAllExactRows: 3,
      candidatePairExact: 5,
    }),
    "V4_LEVEL_3",
  );

  const recurring = recurringFamilies(
    { PREFIX_LOSS: 2, OTHER: 0, NO_TEXT_DETECTED: 1 } as never,
    { PREFIX_LOSS: 1, OTHER: 4, NO_TEXT_DETECTED: 0 } as never,
  );
  assert.deepEqual(recurring, ["PREFIX_LOSS"]);

  assert.equal(gitDiffExitCode("data/research"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-participant-ocr-experiment-v3"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-raw-ocr-v0"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-structured-extraction-v0/parser.ts"), 0);

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("holdout-seal"), false, abs);
    assert.equal(src.includes("fresh-validation-human-truth"), false, abs);
    assert.equal(src.includes("fresh-validation-machine-output"), false, abs);
    assert.equal(src.includes("validation2-annotation"), false, abs);
    assert.equal(src.includes("parseStructuredRowV0"), false, abs);
    assert.equal(src.includes("fetch("), false, abs);
    assert.equal(src.includes("https://"), false, abs);
    assert.equal(src.includes("http://"), false, abs);
    assert.equal(src.includes("C시포로"), false, abs);
    assert.equal(src.includes("도지기시"), false, abs);
  }

  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split(/\r?\n/);
  for (const rel of tracked) {
    assert.equal(rel.includes("development-corpus-v0.json"), false, rel);
    assert.equal(rel.includes("ocr-error-morphology-v0.json"), false, rel);
    assert.equal(rel.includes("YANG-EDGE-INBOX"), false, rel);
  }

  console.log("test:proto-round-ocr-v4-design-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
