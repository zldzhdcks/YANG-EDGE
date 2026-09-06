/**
 * Freeze Proto Round ground-truth v0 discovery/holdout samples.
 * No OCR rerun. No screenshot rewrite. No network.
 *
 *   npm run build:proto-round-ground-truth-v0 -- --year <year> --round <round> --json
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DISCOVERY_ANNOTATION_FILE_NAME,
  DISCOVERY_ANNOTATION_HTML_FILE_NAME,
  GROUND_TRUTH_DIRECTORY_NAME,
  HOLDOUT_SEAL_FILE_NAME,
  SELECTION_MANIFEST_FILE_NAME,
  buildGroundTruthPackV0,
  canonicalJson,
  createScreenshotBytesProbe,
} from "../src/lib/proto-round-ground-truth-v0";
import { SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME } from "../src/lib/proto-round-semantic-region-candidates-v0";
import type { SemanticRegionCandidatesDocumentV0 } from "../src/lib/proto-round-semantic-region-candidates-v0";
import {
  INTAKE_MANIFEST_FILE_NAME,
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  resolveOperatorRoot,
  roundDirectoryRelative,
  yangEdgeDirectoryRelative,
  type IntakeManifestV1,
} from "../src/lib/proto-round-screenshot-intake-v1";
import {
  VISUAL_ROWS_ARTIFACT_FILE_NAME,
  type VisualRowsDocumentV0,
} from "../src/lib/proto-round-visual-rows-v0";

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

async function writeJsonAtomic(abs: string, value: unknown): Promise<void> {
  await writeTextAtomic(abs, canonicalJson(value));
}

async function loadOptionalSemantic(
  yangAbs: string,
): Promise<SemanticRegionCandidatesDocumentV0 | null> {
  try {
    const raw = await readFile(
      path.join(yangAbs, SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME),
      "utf8",
    );
    return JSON.parse(raw) as SemanticRegionCandidatesDocumentV0;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const expectedKey = `${args.year}-${args.round}`;
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const roundAbs = absFromOperatorRelative(
    operatorRootAbs,
    roundDirectoryRelative(args.year, args.round),
  );

  const visualRows = JSON.parse(
    await readFile(path.join(yangAbs, VISUAL_ROWS_ARTIFACT_FILE_NAME), "utf8"),
  ) as VisualRowsDocumentV0;
  const intake = JSON.parse(
    await readFile(path.join(yangAbs, INTAKE_MANIFEST_FILE_NAME), "utf8"),
  ) as IntakeManifestV1;
  if (visualRows.meta.protoRoundKey !== expectedKey) {
    throw new Error(
      `PROTO_ROUND_KEY_MISMATCH: ${visualRows.meta.protoRoundKey} != ${expectedKey}`,
    );
  }

  const semanticRegions = await loadOptionalSemantic(yangAbs);
  const pack = await buildGroundTruthPackV0({
    protoRoundKey: expectedKey,
    visualRows,
    intake,
    screenshot: createScreenshotBytesProbe(roundAbs),
    semanticRegions,
  });

  const outDir = path.join(yangAbs, GROUND_TRUTH_DIRECTORY_NAME);
  await writeJsonAtomic(
    path.join(outDir, SELECTION_MANIFEST_FILE_NAME),
    pack.selectionManifest,
  );
  await writeJsonAtomic(path.join(outDir, HOLDOUT_SEAL_FILE_NAME), pack.holdoutSeal);
  await writeJsonAtomic(
    path.join(outDir, DISCOVERY_ANNOTATION_FILE_NAME),
    pack.discoveryAnnotation,
  );
  await writeTextAtomic(
    path.join(outDir, DISCOVERY_ANNOTATION_HTML_FILE_NAME),
    pack.discoveryHtml,
  );

  const payload = {
    action: "ground-truth-v0",
    artifactDirAbs: outDir,
    protoRoundKey: expectedKey,
    eligibleRowCount: pack.eligibleRowCount,
    discoverySampleSize: pack.selectionManifest.discoverySampleSize,
    holdoutSampleSize: pack.selectionManifest.holdoutSampleSize,
    selectionManifestSha256: pack.selectionManifestSha256,
    holdoutSealSha256: pack.holdoutSealSha256,
    discoveryHoldoutDisjoint: true,
    coverage: pack.coverage,
    discoveryTemplate: pack.discoveryAnnotation.discoveryTemplate,
    discoveryAnnotated: pack.discoveryAnnotation.discoveryAnnotated,
    accuracyMetric: pack.discoveryAnnotation.accuracyMetric,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`artifactDir=${outDir}`);
  console.log(`eligibleRowCount=${pack.eligibleRowCount}`);
  console.log(`discoverySampleSize=${pack.selectionManifest.discoverySampleSize}`);
  console.log(`holdoutSampleSize=${pack.selectionManifest.holdoutSampleSize}`);
  console.log(`SELECTION_MANIFEST_SHA256=${pack.selectionManifestSha256}`);
  console.log(`HOLDOUT_SEAL_SHA256=${pack.holdoutSealSha256}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
