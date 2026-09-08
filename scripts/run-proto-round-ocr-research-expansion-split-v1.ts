/**
 * Freeze OCR research expansion split v1.
 * Discovery rows 11–30 → Discovery-2 / Validation-2. No Human UI yet.
 *
 *   npm run run:proto-round-ocr-research-expansion-split-v1 -- --year 2026 --round 105 --json
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DISCOVERY_ANNOTATION_FILE_NAME,
  GROUND_TRUTH_DIRECTORY_NAME,
  SELECTION_MANIFEST_FILE_NAME,
} from "../src/lib/proto-round-ground-truth-v0/types";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  resolveOperatorRoot,
  yangEdgeDirectoryRelative,
} from "../src/lib/proto-round-screenshot-intake-v1";
import {
  buildExpansionSplitSealV1,
  canonicalJson,
  OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME,
  sha256Bytes,
  sourcePoolFromDiscoveryKeys,
  splitDiscovery2Validation2,
  SPLIT_SEAL_FILE_NAME,
  type ExpansionRowKeyV1,
} from "../src/lib/proto-round-ocr-research-expansion-v1";
// Holdout identities/visuals are not read. Source pool is Discovery keys 11–30 only.

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const gtDir = path.join(yangAbs, GROUND_TRUTH_DIRECTORY_NAME);
  const discoveryAbs = path.join(gtDir, DISCOVERY_ANNOTATION_FILE_NAME);
  const pilot10ShaBefore = sha256Bytes(await readFile(discoveryAbs));

  const selection = JSON.parse(
    await readFile(path.join(gtDir, SELECTION_MANIFEST_FILE_NAME), "utf8"),
  ) as {
    protoRoundKey?: string;
    discoveryRowKeys?: ExpansionRowKeyV1[];
  };
  if (!selection.protoRoundKey || !Array.isArray(selection.discoveryRowKeys)) {
    throw new Error("SELECTION_MANIFEST_INVALID");
  }
  const { sourcePool } = sourcePoolFromDiscoveryKeys(selection.discoveryRowKeys);
  const split = splitDiscovery2Validation2(sourcePool);
  const seal = buildExpansionSplitSealV1({
    protoRoundKey: selection.protoRoundKey,
    split,
  });
  const localDir = path.join(yangAbs, OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME);
  const sealAbs = path.join(localDir, SPLIT_SEAL_FILE_NAME);
  await writeJsonAtomic(sealAbs, seal);
  const splitSha = sha256Bytes(await readFile(sealAbs));
  const pilot10ShaAfter = sha256Bytes(await readFile(discoveryAbs));
  if (pilot10ShaBefore !== pilot10ShaAfter) {
    throw new Error("PILOT10_MUTATED");
  }

  const payload = {
    action: "ocr-research-expansion-split-v1",
    protoRoundKey: selection.protoRoundKey,
    sourcePoolCount: split.sourcePoolCount,
    discovery2Count: split.discovery2Count,
    validation2Count: split.validation2Count,
    OCR_RESEARCH_EXPANSION_SPLIT_SHA256: splitSha,
    sealAbs,
    SPLIT_MUTABLE: false,
    PILOT10_MUTATED: false,
    VALIDATION_2_VISUAL_RENDERED: false,
    VALIDATION_2_HUMAN_ANNOTATED: false,
    HOLDOUT_READ: false,
    FRESH_VALIDATION_USED_FOR_RULE_TUNING: false,
    NETWORK_CALLS: 0,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`OCR_RESEARCH_EXPANSION_SPLIT_SHA256=${splitSha}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
