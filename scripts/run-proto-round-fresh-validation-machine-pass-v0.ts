/**
 * Fresh Validation machine pass v0.
 * Frozen v3 winner only. No human Ground Truth. No Holdout. No v3 retune.
 *
 *   npm run run:proto-round-fresh-validation-machine-pass-v0 -- --year 2026 --round 105 --json
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256FileBytes } from "../src/lib/proto-round-screenshot-intake-v1/hash";
import { resolveContainedCanonicalImageAbs } from "../src/lib/proto-round-raw-ocr-v0/path-containment";
import { extractRawOcrV0 } from "../src/lib/proto-round-raw-ocr-v0";
import { RAW_OCR_ARTIFACT_FILE_NAME } from "../src/lib/proto-round-raw-ocr-v0/types";
import { auditLocalOcrCapabilities } from "../src/lib/proto-round-raw-ocr-v0/capability-audit";
import { tryCreateWindowsMediaOcrProvider } from "../src/lib/proto-round-raw-ocr-v0/windows-media-ocr";
import { createWindowsCropOcrProviderV3 } from "../src/lib/proto-round-participant-ocr-experiment-v3";
import {
  PARTICIPANT_OCR_V3_LOCAL_DIR_NAME,
  PARTICIPANT_OCR_V3_RESULT_FILE_NAME,
} from "../src/lib/proto-round-participant-ocr-experiment-v3/types";
import { readPngIhdrDimensions } from "../src/lib/proto-round-extraction-design-v0/png-ihdr";
import type { ImageDimensions } from "../src/lib/proto-round-visual-rows-v0/types";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  loadIntakeManifest,
  resolveOperatorRoot,
  roundDirectoryRelative,
  yangEdgeDirectoryRelative,
} from "../src/lib/proto-round-screenshot-intake-v1";
import {
  assertFrozenSealSha,
  assertFrozenV3ResultSha,
  assertFreshImageIdentities,
  blockedMessage,
  buildFreshMachineOutputDocument,
  buildFreshSelectionDocument,
  canonicalJson,
  FRESH_MACHINE_OUTPUT_FILE_NAME,
  FRESH_SELECTION_FILE_NAME,
  FRESH_VALIDATION_LOCAL_DIR_NAME,
  reconstructFreshMachineGeometry,
  sha256Bytes,
} from "../src/lib/proto-round-fresh-validation-blind-test-v0";
import { identifyFreshUnseenImages as identifyFreshFromV3 } from "../src/lib/proto-round-participant-ocr-experiment-v3";

const FRESH_VALIDATION_SEAL_REL = path.posix.join(
  "ocr-recovery-v1",
  "fresh-validation-seal-v0.json",
);

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

function failBlocked(reason: string): never {
  console.error(blockedMessage());
  console.error(reason);
  process.exit(2);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const roundAbs = absFromOperatorRelative(
    operatorRootAbs,
    roundDirectoryRelative(args.year, args.round),
  );

  try {
    const v3ResultAbs = path.join(
      yangAbs,
      PARTICIPANT_OCR_V3_LOCAL_DIR_NAME,
      PARTICIPANT_OCR_V3_RESULT_FILE_NAME,
    );
    assertFrozenV3ResultSha(sha256Bytes(await readFile(v3ResultAbs)));
    const sealAbs = path.join(yangAbs, ...FRESH_VALIDATION_SEAL_REL.split("/"));
    const sealBytes = await readFile(sealAbs);
    assertFrozenSealSha(sha256Bytes(sealBytes));
    const seal = JSON.parse(sealBytes.toString("utf8")) as {
      images?: Array<{ sourceImageSha256?: string }>;
    };
    assertFreshImageIdentities(
      (seal.images ?? [])
        .map((img) => img.sourceImageSha256)
        .filter((sha): sha is string => typeof sha === "string"),
    );
  } catch (err) {
    failBlocked(err instanceof Error ? err.message : String(err));
  }

  const manifest = await loadIntakeManifest(operatorRootAbs, args.year, args.round);
  if (!manifest) throw new Error("INTAKE_MANIFEST_MISSING");

  const firstShotOcr = JSON.parse(
    await readFile(path.join(yangAbs, RAW_OCR_ARTIFACT_FILE_NAME), "utf8"),
  ) as { images?: Array<{ sourceImageSha256: string }> };
  const fresh = identifyFreshFromV3({
    canonicalImages: manifest.files
      .filter((f) => f.fileStatus === "CANONICAL_IMAGE")
      .map((f) => ({ sha256: f.sha256 })),
    firstShotSourceImages: (firstShotOcr.images ?? []).map((img) => ({
      sourceImageSha256: img.sourceImageSha256,
    })),
  });
  try {
    assertFreshImageIdentities(fresh.freshUnseenImageSha256);
  } catch (err) {
    failBlocked(err instanceof Error ? err.message : String(err));
  }

  const freshSet = new Set(fresh.freshUnseenImageSha256);
  const freshFiles = manifest.files.filter(
    (f) => f.fileStatus === "CANONICAL_IMAGE" && freshSet.has(f.sha256),
  );
  const imagePathBySha256 = new Map<string, string>();
  const screenshotRelativePathBySha256 = new Map<string, string>();
  for (const file of freshFiles) {
    const abs = resolveContainedCanonicalImageAbs(roundAbs, file.relativePath);
    const sha = await sha256FileBytes(abs);
    if (sha !== file.sha256) failBlocked("FRESH_IMAGE_HASH_MISMATCH");
    imagePathBySha256.set(file.sha256, abs);
    screenshotRelativePathBySha256.set(file.sha256, file.relativePath);
  }

  const dimensionsBySha256 = new Map<string, ImageDimensions>();
  for (const file of freshFiles) {
    const abs = imagePathBySha256.get(file.sha256);
    if (!abs) failBlocked("FRESH_IMAGE_PATH_MISSING");
    const ihdr = readPngIhdrDimensions(await readFile(abs));
    if (!ihdr) failBlocked("FRESH_PNG_IHDR_MISSING");
    dimensionsBySha256.set(file.sha256, {
      width: ihdr.width,
      height: ihdr.height,
    });
  }

  const audit = await auditLocalOcrCapabilities();
  const provider = tryCreateWindowsMediaOcrProvider(audit.windowsMediaOcr);
  if (!provider) failBlocked("KO_OCR_UNAVAILABLE");

  const ocr = await extractRawOcrV0({
    year: manifest.meta.year,
    round: manifest.meta.round,
    protoRoundKey: manifest.meta.protoRoundKey,
    roundAbs,
    files: freshFiles,
    provider,
  });
  if (ocr.images.some((img) => img.ocrStatus === "OCR_ERROR")) {
    failBlocked("FRESH_PRODUCTION_OCR_ERROR");
  }

  const eligible = reconstructFreshMachineGeometry({
    ocr,
    year: manifest.meta.year,
    round: manifest.meta.round,
    protoRoundKey: manifest.meta.protoRoundKey,
    dimensionsBySha256,
    screenshotRelativePathBySha256,
  });
  const selection = buildFreshSelectionDocument({
    protoRoundKey: manifest.meta.protoRoundKey,
    eligibleRows: eligible,
  });
  const selectedGeometry = selection.selectedRows.map((key) => {
    const row = eligible.find(
      (r) =>
        r.sourceImageSha256 === key.sourceImageSha256 &&
        r.visualRowIndex === key.visualRowIndex,
    );
    if (!row) failBlocked("SELECTED_GEOMETRY_MISSING");
    return row;
  });

  const machine = await buildFreshMachineOutputDocument({
    protoRoundKey: manifest.meta.protoRoundKey,
    selectedGeometry,
    imagePathBySha256,
    cropOcr: createWindowsCropOcrProviderV3(),
  });

  const localDir = path.join(yangAbs, FRESH_VALIDATION_LOCAL_DIR_NAME);
  const selectionAbs = path.join(localDir, FRESH_SELECTION_FILE_NAME);
  const machineAbs = path.join(localDir, FRESH_MACHINE_OUTPUT_FILE_NAME);
  await writeJsonAtomic(selectionAbs, selection);
  await writeJsonAtomic(machineAbs, machine);
  const selectionSha = sha256Bytes(await readFile(selectionAbs));
  const machineSha = sha256Bytes(await readFile(machineAbs));

  const payload = {
    action: "fresh-validation-machine-pass-v0",
    protoRoundKey: manifest.meta.protoRoundKey,
    freshUnseenImageCount: fresh.freshUnseenImageCount,
    freshUnseenImageSha256: fresh.freshUnseenImageSha256,
    eligibleFreshRows: selection.eligibleRowCount,
    selectedValidationRows: selection.selectedRowCount,
    FRESH_SELECTION_SHA256: selectionSha,
    FRESH_MACHINE_OUTPUT_SHA256: machineSha,
    selectionAbs,
    machineAbs,
    machineOutputFrozen: true,
    HUMAN_GROUND_TRUTH_READ_BEFORE_MACHINE_FREEZE: false,
    FRESH_VISUAL_USED_FOR_RULE_TUNING: false,
    V3_RULE_CHANGED: false,
    PARSER_CHANGED: false,
    HOLDOUT_READ: false,
    NETWORK_CALLS: 0,
  };

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`eligibleFreshRows=${selection.eligibleRowCount}`);
  console.log(`selectedValidationRows=${selection.selectedRowCount}`);
  console.log(`FRESH_SELECTION_SHA256=${selectionSha}`);
  console.log(`FRESH_MACHINE_OUTPUT_SHA256=${machineSha}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
