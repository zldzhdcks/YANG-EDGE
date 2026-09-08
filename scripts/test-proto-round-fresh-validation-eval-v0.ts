/**
 * Fresh Validation blind evaluation v0 tests.
 * Synthetic identities only. No Holdout. No network. No parser mutation.
 *
 *   npm run test:proto-round-fresh-validation-eval-v0
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FROZEN_FRESH_MACHINE_OUTPUT_SHA256,
  FROZEN_FRESH_SELECTION_SHA256,
  FreshValidationEvalV0Error,
  assertFrozenMachineEvidence,
  evaluateFreshValidationV0,
  exactParticipantEvidencePresent,
  joinFrozenFreshIdentities,
  parseHumanExportDocument,
  scoreJoinedFreshRow,
  type FreshHumanRecordV0,
  type FreshMachineEvalRowV0,
} from "../src/lib/proto-round-fresh-validation-eval-v0";
import { exactEvidencePresentAny } from "../src/lib/proto-round-participant-ocr-experiment-v3";

function key(n: number) {
  return { sourceImageSha256: `sha-${n}`, visualRowIndex: n };
}

function human(n: number, extra?: Partial<FreshHumanRecordV0>): FreshHumanRecordV0 {
  return {
    ...key(n),
    sourceFileName: `shot-${n}.png`,
    annotationStatus: "COMPLETE",
    screenRowIdentifierRaw: `id-${n}`,
    participantLeftRaw: `left-${n}`,
    participantRightRaw: `right-${n}`,
    numericCellsRaw: ["1.91", "1.63"],
    marketMarkerRaw: null,
    ...extra,
  };
}

function machine(n: number, extra?: Partial<FreshMachineEvalRowV0>): FreshMachineEvalRowV0 {
  return {
    ...key(n),
    participantRawOcrEvidences: [
      { text: `left-${n} 1.91` },
      { text: `right-${n} 1.63` },
    ],
    numericRawOcrEvidences: ["1.91", "1.63"],
    safeReconstructedNumericEvidences: ["1.91", "1.63"],
    marketMarkerCandidateRaw: null,
    ...extra,
  };
}

function tenKeys() {
  return Array.from({ length: 10 }, (_, i) => key(i));
}

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
  const lib = path.join(process.cwd(), "src/lib/proto-round-fresh-validation-eval-v0");
  return [
    ...readdirSync(lib)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/eval-proto-round-fresh-validation-v0.ts"),
  ];
}

async function main() {
  const keys = tenKeys();
  const humans = Array.from({ length: 10 }, (_, i) => human(i));
  const machines = Array.from({ length: 10 }, (_, i) => machine(i));
  const joined = joinFrozenFreshIdentities({
    selectionKeys: keys,
    humanRecords: humans,
    machineRows: machines,
  });
  assert.equal(joined.length, 10);
  assert.equal(joined[0]!.key.sourceImageSha256, "sha-0");

  assert.throws(
    () =>
      joinFrozenFreshIdentities({
        selectionKeys: keys,
        humanRecords: [...humans, human(0)],
        machineRows: machines,
      }),
    (err: unknown) =>
      err instanceof FreshValidationEvalV0Error && err.code === "DUPLICATE_IDENTITY",
  );
  assert.throws(
    () =>
      joinFrozenFreshIdentities({
        selectionKeys: keys,
        humanRecords: humans.slice(1),
        machineRows: machines,
      }),
    (err: unknown) =>
      err instanceof FreshValidationEvalV0Error && err.code === "MISSING_HUMAN_IDENTITY",
  );
  assert.throws(
    () =>
      joinFrozenFreshIdentities({
        selectionKeys: keys,
        humanRecords: humans,
        machineRows: machines.slice(1),
      }),
    (err: unknown) =>
      err instanceof FreshValidationEvalV0Error && err.code === "MISSING_MACHINE_ROW",
  );
  assert.throws(
    () =>
      joinFrozenFreshIdentities({
        selectionKeys: keys,
        humanRecords: [...humans, human(99)],
        machineRows: machines,
      }),
    (err: unknown) =>
      err instanceof FreshValidationEvalV0Error && err.code === "EXTRA_HUMAN_IDENTITY",
  );
  assert.throws(
    () =>
      joinFrozenFreshIdentities({
        selectionKeys: keys,
        humanRecords: [...humans.slice(0, 9), human(99)],
        machineRows: machines,
      }),
    (err: unknown) =>
      err instanceof FreshValidationEvalV0Error &&
      (err.code === "MISSING_HUMAN_IDENTITY" || err.code === "EXTRA_HUMAN_IDENTITY"),
  );

  assert.throws(
    () =>
      evaluateFreshValidationV0({
        selectionKeys: keys,
        humanRecords: humans.map((h, i) =>
          i === 0 ? { ...h, annotationStatus: "UNANNOTATED" } : h,
        ),
        machineRows: machines,
        machineSha256: FROZEN_FRESH_MACHINE_OUTPUT_SHA256,
        selectionSha256: FROZEN_FRESH_SELECTION_SHA256,
        humanTruthSha256: "abc",
      }),
    (err: unknown) =>
      err instanceof FreshValidationEvalV0Error && err.code === "UNANNOTATED_HUMAN_ROWS",
  );

  const mixed = evaluateFreshValidationV0({
    selectionKeys: keys,
    humanRecords: humans.map((h, i) => {
      if (i === 0) return { ...h, annotationStatus: "UNCERTAIN" };
      if (i === 1) return { ...h, annotationStatus: "UNREADABLE" };
      return h;
    }),
    machineRows: machines,
    machineSha256: FROZEN_FRESH_MACHINE_OUTPUT_SHA256,
    selectionSha256: FROZEN_FRESH_SELECTION_SHA256,
    humanTruthSha256: "human-sha",
  });
  assert.equal(mixed.totals.uncertainCount, 1);
  assert.equal(mixed.totals.unreadableCount, 1);
  assert.equal(mixed.totals.participantRowsEvaluable, 8);
  assert.equal(mixed.totals.participantEvaluableSlotCount, 16);
  assert.equal(mixed.totals.unannotatedCount, 0);

  assert.equal(
    exactParticipantEvidencePresent([{ text: "left-0" }, { text: "right-0" }], "left-0"),
    true,
  );
  assert.equal(exactEvidencePresentAny(["left", "-0"], "left-0"), false);
  const noFuzzy = scoreJoinedFreshRow({
    human: human(0, { participantLeftRaw: "left-token" }),
    machine: machine(0, {
      participantRawOcrEvidences: [{ text: "left" }, { text: "-token" }],
    }),
  });
  assert.equal(noFuzzy.participantLeftExactEvidencePresent, false);

  const rawVsSafe = scoreJoinedFreshRow({
    human: human(0, { numericCellsRaw: ["2.95"] }),
    machine: machine(0, {
      numericRawOcrEvidences: ["2 95"],
      safeReconstructedNumericEvidences: ["2.95"],
    }),
  });
  assert.equal(rawVsSafe.numericRawExactCellCount, 0);
  assert.equal(rawVsSafe.numericRawAllExact, false);
  assert.equal(rawVsSafe.safeReconstructedExactCellCount, 1);
  assert.equal(rawVsSafe.safeReconstructedAllExact, true);
  assert.equal(rawVsSafe.numericSafeLayerAllExact, true);

  const noNormalize = scoreJoinedFreshRow({
    human: human(0, { numericCellsRaw: ["1.91"] }),
    machine: machine(0, {
      numericRawOcrEvidences: ["191"],
      safeReconstructedNumericEvidences: [],
    }),
  });
  assert.equal(noNormalize.numericRawExactCellCount, 0);

  const blankMarket = scoreJoinedFreshRow({
    human: human(0, { marketMarkerRaw: null }),
    machine: machine(0, { marketMarkerCandidateRaw: "SUM" }),
  });
  assert.equal(blankMarket.marketEvaluable, false);
  assert.equal(blankMarket.marketMarkerExact, null);

  const marketExact = scoreJoinedFreshRow({
    human: human(0, { marketMarkerRaw: "SUM" }),
    machine: machine(0, { marketMarkerCandidateRaw: "SUM" }),
  });
  assert.equal(marketExact.marketEvaluable, true);
  assert.equal(marketExact.marketMarkerExact, true);
  const marketMismatch = scoreJoinedFreshRow({
    human: human(0, { marketMarkerRaw: "SUM" }),
    machine: machine(0, { marketMarkerCandidateRaw: "O 2.5" }),
  });
  assert.equal(marketMismatch.marketMarkerExact, false);

  assert.throws(
    () =>
      assertFrozenMachineEvidence({
        machineSha256: "nope",
        selectionSha256: FROZEN_FRESH_SELECTION_SHA256,
        sealSha256: "5c11acb6346ad90d695c8531882dd0eaa629db6cd0940a857bd42eaa848c6e46",
        v3Sha256: "d6ae3ae73e6aab4bd403307fa43111bec05c7d50269a7c53519c34fc5b35812e",
      }),
    (err: unknown) =>
      err instanceof FreshValidationEvalV0Error &&
      err.code === "FROZEN_FRESH_MACHINE_EVIDENCE_MUTATED",
  );

  const ok = evaluateFreshValidationV0({
    selectionKeys: keys,
    humanRecords: humans,
    machineRows: machines,
    machineSha256: FROZEN_FRESH_MACHINE_OUTPUT_SHA256,
    selectionSha256: FROZEN_FRESH_SELECTION_SHA256,
    humanTruthSha256: "human-sha",
  });
  assert.equal(ok.FRESH_MACHINE_OUTPUT_SHA256, FROZEN_FRESH_MACHINE_OUTPUT_SHA256);
  assert.equal(ok.FRESH_SELECTION_SHA256, FROZEN_FRESH_SELECTION_SHA256);
  assert.equal(ok.FRESH_HUMAN_TRUTH_SHA256, "human-sha");
  assert.equal(ok.parserUsed, false);
  assert.equal(ok.FRESH_PARTICIPANT_GENERALIZATION, "YES");
  assert.equal(ok.PROTO_SCREENSHOT_AUTOMATION_FUNCTIONAL_MILESTONE, "99_PERCENT");

  assert.throws(
    () =>
      parseHumanExportDocument({
        schemaVersion: "proto-round-fresh-validation-annotation-v0",
        protoRoundKey: "2026-105",
        groundTruthSource: "ORIGINAL_SCREENSHOT_PIXELS_ONLY",
        records: humans.slice(0, 9),
      }),
    (err: unknown) =>
      err instanceof FreshValidationEvalV0Error && err.code === "HUMAN_RECORD_COUNT_MISMATCH",
  );

  assert.equal(gitDiffExitCode("data/research"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-raw-ocr-v0"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-structured-extraction-v0/parser.ts"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-participant-ocr-experiment-v3"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-fresh-validation-blind-test-v0"), 0);

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("holdoutRowKeys"), false, abs);
    assert.equal(src.includes("holdout-seal"), false, abs);
    assert.equal(src.includes("fetch("), false, abs);
    assert.equal(src.includes("parseStructuredRowV0"), false, abs);
    assert.equal(src.includes("https://"), false, abs);
    assert.equal(src.includes("http://"), false, abs);
  }

  console.log("test:proto-round-fresh-validation-eval-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
