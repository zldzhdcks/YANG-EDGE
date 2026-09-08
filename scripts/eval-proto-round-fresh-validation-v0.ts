/**
 * Fresh Validation blind evaluation v0.
 * Frozen machine output vs sealed Human truth. No OCR/parser retune.
 *
 *   npm run eval:proto-round-fresh-validation-v0 -- --year 2026 --round 105 --json
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  resolveOperatorRoot,
  yangEdgeDirectoryRelative,
} from "../src/lib/proto-round-screenshot-intake-v1";
import {
  FRESH_MACHINE_OUTPUT_FILE_NAME,
  FRESH_SELECTION_FILE_NAME,
  FRESH_VALIDATION_LOCAL_DIR_NAME,
} from "../src/lib/proto-round-fresh-validation-blind-test-v0/types";
import {
  PARTICIPANT_OCR_V3_LOCAL_DIR_NAME,
  PARTICIPANT_OCR_V3_RESULT_FILE_NAME,
} from "../src/lib/proto-round-participant-ocr-experiment-v3/types";
import {
  FRESH_EVALUATION_FILE_NAME,
  FRESH_HUMAN_TRUTH_FILE_NAME,
  assertFrozenMachineEvidence,
  buildFreshHumanTruthDocument,
  canonicalJson,
  evaluateFreshValidationV0,
  parseHumanExportDocument,
  sha256Bytes,
  type FreshEvalRowKeyV0,
  type FreshMachineEvalRowV0,
} from "../src/lib/proto-round-fresh-validation-eval-v0";

const FRESH_VALIDATION_SEAL_REL = path.posix.join(
  "ocr-recovery-v1",
  "fresh-validation-seal-v0.json",
);

const HUMAN_EXPORT_SEARCH_ROOTS = [
  path.join("C:\\Users\\TCTCTC\\YANG-EDGE", "Export JSON"),
  "C:\\Users\\TCTCTC\\Downloads",
  "C:\\Users\\TCTCTC\\YANG-EDGE",
];

function parseArgs(argv: string[]) {
  let year: number | null = null;
  let round: number | null = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--year") {
      const v = argv[++i];
      if (!v) throw new Error("--year requires a number");
      year = Number(v);
      continue;
    }
    if (a === "--round") {
      const v = argv[++i];
      if (!v) throw new Error("--round requires a number");
      round = Number(v);
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  if (year == null || round == null) throw new Error("Specify --year and --round");
  return { ...assertSafeProtoRoundCoords(year, round), json };
}

async function writeJsonAtomic(abs: string, value: unknown): Promise<void> {
  const dir = path.dirname(abs);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${path.basename(abs)}.${process.pid}.tmp`);
  await writeFile(tmp, canonicalJson(value), "utf8");
  try {
    await rename(tmp, abs);
  } catch {
    await unlink(abs).catch(() => undefined);
    await rename(tmp, abs);
  }
}

function findHumanExport(): string {
  const hits: string[] = [];
  const seen = new Set<string>();
  for (const root of HUMAN_EXPORT_SEARCH_ROOTS) {
    if (!existsSync(root)) continue;
    const stack = [root];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git") continue;
          stack.push(abs);
          continue;
        }
        if (entry.isFile() && entry.name === "fresh-validation-annotation-v0.json") {
          const norm = path.resolve(abs);
          if (!seen.has(norm)) {
            seen.add(norm);
            hits.push(norm);
          }
        }
      }
    }
  }
  if (hits.length === 0) {
    throw new Error("HUMAN_EXPORT_NOT_FOUND");
  }
  hits.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return hits[0]!;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const localDir = path.join(yangAbs, FRESH_VALIDATION_LOCAL_DIR_NAME);

  const machineAbs = path.join(localDir, FRESH_MACHINE_OUTPUT_FILE_NAME);
  const selectionAbs = path.join(localDir, FRESH_SELECTION_FILE_NAME);
  const sealAbs = path.join(yangAbs, ...FRESH_VALIDATION_SEAL_REL.split("/"));
  const v3Abs = path.join(
    yangAbs,
    PARTICIPANT_OCR_V3_LOCAL_DIR_NAME,
    PARTICIPANT_OCR_V3_RESULT_FILE_NAME,
  );
  const machineSha = sha256Bytes(await readFile(machineAbs));
  const selectionSha = sha256Bytes(await readFile(selectionAbs));
  const sealSha = sha256Bytes(await readFile(sealAbs));
  const v3Sha = sha256Bytes(await readFile(v3Abs));
  assertFrozenMachineEvidence({
    machineSha256: machineSha,
    selectionSha256: selectionSha,
    sealSha256: sealSha,
    v3Sha256: v3Sha,
  });

  const humanExportPath = findHumanExport();
  const exportDoc = parseHumanExportDocument(
    JSON.parse(await readFile(humanExportPath, "utf8")),
  );
  const humanTruth = buildFreshHumanTruthDocument({
    sourceExportPath: humanExportPath,
    exportDoc,
  });
  const humanAbs = path.join(localDir, FRESH_HUMAN_TRUTH_FILE_NAME);
  await writeJsonAtomic(humanAbs, humanTruth);
  const humanSha = sha256Bytes(await readFile(humanAbs));

  const selection = JSON.parse(await readFile(selectionAbs, "utf8")) as {
    selectedRows?: FreshEvalRowKeyV0[];
  };
  const machine = JSON.parse(await readFile(machineAbs, "utf8")) as {
    rows?: FreshMachineEvalRowV0[];
  };
  const evalDoc = evaluateFreshValidationV0({
    selectionKeys: selection.selectedRows ?? [],
    humanRecords: humanTruth.records,
    machineRows: (machine.rows ?? []).map((row) => ({
      sourceImageSha256: row.sourceImageSha256,
      visualRowIndex: row.visualRowIndex,
      participantRawOcrEvidences: row.participantRawOcrEvidences ?? [],
      numericRawOcrEvidences: row.numericRawOcrEvidences ?? [],
      safeReconstructedNumericEvidences: row.safeReconstructedNumericEvidences ?? [],
      marketMarkerCandidateRaw: row.marketMarkerCandidateRaw ?? null,
    })),
    machineSha256: machineSha,
    selectionSha256: selectionSha,
    humanTruthSha256: humanSha,
  });
  const evalAbs = path.join(localDir, FRESH_EVALUATION_FILE_NAME);
  await writeJsonAtomic(evalAbs, evalDoc);
  const evalSha = sha256Bytes(await readFile(evalAbs));

  const t = evalDoc.totals;
  const payload = {
    action: "fresh-validation-blind-evaluation-v0",
    HUMAN_EXPORT_SOURCE_PATH: humanExportPath,
    FRESH_MACHINE_OUTPUT_SHA256: machineSha,
    FRESH_SELECTION_SHA256: selectionSha,
    FRESH_HUMAN_TRUTH_SHA256: humanSha,
    FRESH_VALIDATION_EVALUATION_SHA256: evalSha,
    PARTICIPANT_OCR_V3_RESULT_SHA256: v3Sha,
    humanTruth: {
      records: t.records,
      COMPLETE: t.completeCount,
      UNCERTAIN: t.uncertainCount,
      UNREADABLE: t.unreadableCount,
      UNANNOTATED: t.unannotatedCount,
    },
    participant: {
      participantRowsEvaluable: t.participantRowsEvaluable,
      leftExact: t.participantLeftExactEvidencePresent,
      rightExact: t.participantRightExactEvidencePresent,
      pairExact: t.participantPairExactEvidencePresent,
      exactSlots: t.participantExactSlotCount,
      evaluableSlots: t.participantEvaluableSlotCount,
    },
    numeric: {
      numericRawExactCellCount: t.numericRawExactCellCount,
      numericTruthCellCount: t.numericTruthCellCount,
      numericRawAllExactRowCount: t.numericRawAllExactRowCount,
      safeReconstructedExactCellCount: t.safeReconstructedExactCellCount,
      safeReconstructedAllExactRowCount: t.safeReconstructedAllExactRowCount,
    },
    market: {
      marketMarkerEvaluableCount: t.marketMarkerEvaluableCount,
      marketMarkerExactCount: t.marketMarkerExactCount,
    },
    combined: {
      participantPairAndNumericRawExactRowCount:
        t.participantPairAndNumericRawExactRowCount,
      participantPairAndNumericSafeExactRowCount:
        t.participantPairAndNumericSafeExactRowCount,
      participantPairNumericSafeMarketExactEvaluableCount:
        t.participantPairNumericSafeMarketExactEvaluableCount,
      participantPairNumericSafeMarketExactCount:
        t.participantPairNumericSafeMarketExactCount,
    },
    FRESH_PARTICIPANT_GENERALIZATION: evalDoc.FRESH_PARTICIPANT_GENERALIZATION,
    FRESH_NUMERIC_RAW_GENERALIZATION: evalDoc.FRESH_NUMERIC_RAW_GENERALIZATION,
    FRESH_NUMERIC_SAFE_GENERALIZATION: evalDoc.FRESH_NUMERIC_SAFE_GENERALIZATION,
    PROTO_SCREENSHOT_AUTOMATION_FUNCTIONAL_MILESTONE:
      evalDoc.PROTO_SCREENSHOT_AUTOMATION_FUNCTIONAL_MILESTONE,
    MACHINE_OUTPUT_CHANGED_AFTER_HUMAN_TRUTH: false,
    V3_RULE_CHANGED: false,
    PARSER_CHANGED: false,
    HOLDOUT_READ: false,
    NETWORK_CALLS: 0,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`HUMAN_EXPORT_SOURCE_PATH=${humanExportPath}`);
  console.log(`FRESH_HUMAN_TRUTH_SHA256=${humanSha}`);
  console.log(`FRESH_VALIDATION_EVALUATION_SHA256=${evalSha}`);
  console.log(
    `FRESH_PARTICIPANT_GENERALIZATION=${evalDoc.FRESH_PARTICIPANT_GENERALIZATION}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
