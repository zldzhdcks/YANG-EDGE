/**
 * Build first-shot structured extraction from semantic-region-candidates-v0.
 * No Ground Truth. No Holdout. No network. No OCR rerun.
 *
 *   npm run build:proto-round-structured-extraction-v0 -- --year <year> --round <round> --json
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME,
  type SemanticRegionCandidatesDocumentV0,
} from "../src/lib/proto-round-semantic-region-candidates-v0";
import {
  STRUCTURED_EXTRACTION_ARTIFACT_FILE_NAME,
  buildStructuredExtractionDocumentV0,
} from "../src/lib/proto-round-structured-extraction-v0";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  resolveOperatorRoot,
  yangEdgeDirectoryRelative,
} from "../src/lib/proto-round-screenshot-intake-v1";

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

async function writeJsonAtomic(abs: string, value: unknown): Promise<string> {
  const dir = path.dirname(abs);
  await mkdir(dir, { recursive: true });
  const raw = `${JSON.stringify(value, null, 2)}\n`;
  const tmp = path.join(dir, `${path.basename(abs)}.${process.pid}.tmp`);
  await writeFile(tmp, raw, "utf8");
  try {
    await rename(tmp, abs);
  } catch {
    await unlink(abs).catch(() => undefined);
    await rename(tmp, abs);
  }
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const sourceAbs = path.join(yangAbs, SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME);
  const source = JSON.parse(await readFile(sourceAbs, "utf8")) as SemanticRegionCandidatesDocumentV0;
  const expectedKey = `${args.year}-${args.round}`;
  if (source.meta.protoRoundKey !== expectedKey) {
    throw new Error(`PROTO_ROUND_KEY_MISMATCH: ${source.meta.protoRoundKey} != ${expectedKey}`);
  }

  const doc = buildStructuredExtractionDocumentV0(source);
  const outAbs = path.join(yangAbs, STRUCTURED_EXTRACTION_ARTIFACT_FILE_NAME);
  const sha256 = await writeJsonAtomic(outAbs, doc);

  const payload = {
    action: "structured-extraction-v0",
    artifactAbs: outAbs,
    FIRST_SHOT_EXTRACTION_SHA256: sha256,
    schemaVersion: doc.meta.schemaVersion,
    protoRoundKey: doc.meta.protoRoundKey,
    structuredScope: doc.meta.structuredScope,
    groundTruthAvailableToParser: doc.meta.groundTruthAvailableToParser,
    holdoutAvailableToParser: doc.meta.holdoutAvailableToParser,
    coverage: doc.coverage,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`artifact=${outAbs}`);
  console.log(`FIRST_SHOT_EXTRACTION_SHA256=${sha256}`);
  console.log(`totalRows=${doc.coverage.totalRows}`);
  console.log(`PARSED=${doc.coverage.parsedRows}`);
  console.log(`AMBIGUOUS=${doc.coverage.ambiguousRows}`);
  console.log(`INSUFFICIENT_EVIDENCE=${doc.coverage.insufficientEvidenceRows}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
