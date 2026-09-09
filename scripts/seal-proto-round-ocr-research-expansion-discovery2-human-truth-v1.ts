/**
 * Seal Discovery-2 Human Ground Truth from the exported annotation JSON.
 * Does not open Validation-2. Does not mutate Pilot10. Does not start OCR v4.
 *
 *   npm run seal:proto-round-ocr-research-expansion-discovery2-human-truth-v1 -- --year 2026 --round 105 --json
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DISCOVERY_ANNOTATION_FILE_NAME,
  GROUND_TRUTH_DIRECTORY_NAME,
} from "../src/lib/proto-round-ground-truth-v0/types";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  resolveOperatorRoot,
  yangEdgeDirectoryRelative,
} from "../src/lib/proto-round-screenshot-intake-v1";
import {
  assertFrozenSplitSealHash,
  assertNoUnannotatedDiscovery2,
  assertPilot10Unchanged,
  assertSplitSealProtection,
  assertValidation2LocallyAbsent,
  buildDiscovery2HumanTruthDocument,
  canonicalJson,
  countDiscovery2HumanStatuses,
  DISCOVERY2_ANNOTATION_FILE_NAME,
  DISCOVERY2_HUMAN_TRUTH_FILE_NAME,
  joinDiscovery2HumanToFrozenKeys,
  OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME,
  parseDiscovery2HumanExportDocument,
  sha256Bytes,
  SPLIT_SEAL_FILE_NAME,
  type ExpansionSplitSealV1,
} from "../src/lib/proto-round-ocr-research-expansion-v1";

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

function listDiscovery2HumanExportCandidates(): string[] {
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
          if (
            entry.name === "node_modules" ||
            entry.name === ".git" ||
            entry.name === ".next"
          ) {
            continue;
          }
          stack.push(abs);
          continue;
        }
        if (entry.isFile() && entry.name === DISCOVERY2_ANNOTATION_FILE_NAME) {
          const norm = path.resolve(abs);
          if (!seen.has(norm)) {
            seen.add(norm);
            hits.push(norm);
          }
        }
      }
    }
  }
  hits.sort((a, b) => a.localeCompare(b));
  return hits;
}

function selectDiscovery2HumanExport(input: {
  candidates: string[];
  discovery2RowKeys: ExpansionSplitSealV1["discovery2RowKeys"];
  validation2RowKeyHashes: string[];
}): { sourcePath: string; exportDoc: ReturnType<typeof parseDiscovery2HumanExportDocument> } {
  const valid: Array<{
    sourcePath: string;
    exportDoc: ReturnType<typeof parseDiscovery2HumanExportDocument>;
  }> = [];
  for (const sourcePath of input.candidates) {
    let parsed: ReturnType<typeof parseDiscovery2HumanExportDocument>;
    try {
      parsed = parseDiscovery2HumanExportDocument(
        JSON.parse(readFileSync(sourcePath, "utf8")),
      );
    } catch {
      continue;
    }
    try {
      joinDiscovery2HumanToFrozenKeys({
        discovery2RowKeys: input.discovery2RowKeys,
        humanRecords: parsed.records,
        validation2RowKeyHashes: input.validation2RowKeyHashes,
      });
      valid.push({ sourcePath, exportDoc: parsed });
    } catch {
      continue;
    }
  }
  if (valid.length === 0) {
    throw new Error("DISCOVERY2_HUMAN_EXPORT_NOT_FOUND");
  }
  const uniqueBodies = new Set(
    valid.map((item) => JSON.stringify(item.exportDoc.records)),
  );
  if (uniqueBodies.size !== 1 && valid.length > 1) {
    throw new Error("DISCOVERY2_HUMAN_EXPORT_AMBIGUOUS");
  }
  return valid[0]!;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const gtDir = path.join(yangAbs, GROUND_TRUTH_DIRECTORY_NAME);
  const discoveryAbs = path.join(gtDir, DISCOVERY_ANNOTATION_FILE_NAME);
  const localDir = path.join(yangAbs, OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME);
  const sealAbs = path.join(localDir, SPLIT_SEAL_FILE_NAME);

  const splitSha = sha256Bytes(await readFile(sealAbs));
  assertFrozenSplitSealHash(splitSha);
  const seal = JSON.parse(await readFile(sealAbs, "utf8")) as ExpansionSplitSealV1;
  assertSplitSealProtection(seal);
  assertValidation2LocallyAbsent(localDir);

  const pilot10ShaBefore = sha256Bytes(await readFile(discoveryAbs));
  assertPilot10Unchanged(pilot10ShaBefore);

  const selected = selectDiscovery2HumanExport({
    candidates: listDiscovery2HumanExportCandidates(),
    discovery2RowKeys: seal.discovery2RowKeys,
    validation2RowKeyHashes: seal.validation2RowKeyHashes,
  });
  assertNoUnannotatedDiscovery2(selected.exportDoc.records);
  const joined = joinDiscovery2HumanToFrozenKeys({
    discovery2RowKeys: seal.discovery2RowKeys,
    humanRecords: selected.exportDoc.records,
    validation2RowKeyHashes: seal.validation2RowKeyHashes,
  });
  const truth = buildDiscovery2HumanTruthDocument({
    sourceExportPath: selected.sourcePath,
    exportDoc: selected.exportDoc,
    orderedRecords: joined.orderedRecords,
    identityJoin: joined.identityJoin,
  });
  const truthAbs = path.join(localDir, DISCOVERY2_HUMAN_TRUTH_FILE_NAME);
  await writeJsonAtomic(truthAbs, truth);
  const truthSha = sha256Bytes(await readFile(truthAbs));

  const splitShaAfter = sha256Bytes(await readFile(sealAbs));
  assertFrozenSplitSealHash(splitShaAfter);
  const pilot10ShaAfter = sha256Bytes(await readFile(discoveryAbs));
  assertPilot10Unchanged(pilot10ShaAfter);
  if (pilot10ShaBefore !== pilot10ShaAfter) {
    throw new Error("PILOT10_MUTATED");
  }
  assertValidation2LocallyAbsent(localDir);

  const statuses = countDiscovery2HumanStatuses(truth.records);
  const payload = {
    action: "seal-discovery2-human-truth-v1",
    DISCOVERY2_HUMAN_EXPORT_SOURCE_PATH: selected.sourcePath,
    DISCOVERY2_HUMAN_TRUTH_SHA256: truthSha,
    OCR_RESEARCH_EXPANSION_SPLIT_SHA256: splitShaAfter,
    records: statuses.records,
    COMPLETE: statuses.COMPLETE,
    UNCERTAIN: statuses.UNCERTAIN,
    UNREADABLE: statuses.UNREADABLE,
    UNANNOTATED: statuses.UNANNOTATED,
    identityMutated: joined.identityJoin.identityMutated,
    missing: joined.identityJoin.missing,
    extra: joined.identityJoin.extra,
    duplicates: joined.identityJoin.duplicates,
    PILOT10_MUTATED: "NO",
    VALIDATION_2_RENDERED: "NO",
    VALIDATION_2_ANNOTATED: "NO",
    VALIDATION_2_HUMAN_TRUTH_EXISTS: "NO",
    VALIDATION_2_USED_FOR_RULE_DESIGN: "NO",
    OCR_V4_STARTED: "NO",
    HOLDOUT_READ: "NO",
    NETWORK_CALLS: 0,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`DISCOVERY2_HUMAN_EXPORT_SOURCE_PATH=${selected.sourcePath}`);
  console.log(`DISCOVERY2_HUMAN_TRUTH_SHA256=${truthSha}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
