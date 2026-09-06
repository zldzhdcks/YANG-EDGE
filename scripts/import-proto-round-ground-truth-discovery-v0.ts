/**
 * Import exported discovery human-truth JSON into the frozen local document.
 * Does not change frozen identities, geometry, or screenshot paths.
 *
 *   npm run import:proto-round-ground-truth-discovery-v0 -- --year <year> --round <round> --file <exported-json>
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DISCOVERY_ANNOTATION_FILE_NAME,
  DISCOVERY_ANNOTATION_HTML_FILE_NAME,
  GROUND_TRUTH_DIRECTORY_NAME,
  SELECTION_MANIFEST_FILE_NAME,
  canonicalJson,
  importDiscoveryAnnotationV0,
  parseDiscoveryAnnotationDocumentV0,
  parseSelectionManifestV0,
  renderDiscoveryAnnotationHtml,
} from "../src/lib/proto-round-ground-truth-v0";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  resolveOperatorRoot,
  yangEdgeDirectoryRelative,
} from "../src/lib/proto-round-screenshot-intake-v1";

function parseArgs(argv: string[]) {
  let year: number | null = null;
  let round: number | null = null;
  let file: string | null = null;
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
    if (a === "--file") {
      const v = argv[++i];
      if (!v) throw new Error("--file requires a path");
      file = v;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  if (year == null || round == null || file == null) {
    throw new Error("Specify --year, --round, and --file");
  }
  return { ...assertSafeProtoRoundCoords(year, round), file, json };
}

async function writeTextAtomic(abs: string, body: string): Promise<void> {
  const dir = path.dirname(abs);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${path.basename(abs)}.${process.pid}.tmp`);
  await writeFile(tmp, body, "utf8");
  try {
    await rename(tmp, abs);
  } catch {
    await unlink(abs).catch(() => undefined);
    await rename(tmp, abs);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const expectedKey = `${args.year}-${args.round}`;
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const outDir = path.join(yangAbs, GROUND_TRUTH_DIRECTORY_NAME);
  const selection = parseSelectionManifestV0(
    await readFile(path.join(outDir, SELECTION_MANIFEST_FILE_NAME), "utf8"),
    expectedKey,
  );
  const existing = parseDiscoveryAnnotationDocumentV0(
    await readFile(path.join(outDir, DISCOVERY_ANNOTATION_FILE_NAME), "utf8"),
    expectedKey,
  );
  const imported = JSON.parse(await readFile(args.file, "utf8")) as unknown;
  const merged = importDiscoveryAnnotationV0({
    protoRoundKey: expectedKey,
    selectionManifest: selection,
    existingAnnotation: existing,
    imported,
  });
  const annotationAbs = path.join(outDir, DISCOVERY_ANNOTATION_FILE_NAME);
  await writeTextAtomic(annotationAbs, canonicalJson(merged));
  await writeTextAtomic(
    path.join(outDir, DISCOVERY_ANNOTATION_HTML_FILE_NAME),
    renderDiscoveryAnnotationHtml(merged),
  );
  const payload = {
    action: "import-ground-truth-discovery-v0",
    protoRoundKey: expectedKey,
    artifactAbs: annotationAbs,
    recordCount: merged.records.length,
    frozenIdentityMutated: false,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`artifact=${annotationAbs}`);
  console.log(`recordCount=${merged.records.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
