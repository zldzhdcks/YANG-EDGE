/**
 * Isolated participant OCR experiment v3 runner.
 * Pilot10 Discovery only. Does not replace production OCR or the parser.
 * Does not open Fresh Validation pixels or Holdout. Does not rewrite v1/v2 artifacts.
 *
 *   npm run run:proto-round-participant-ocr-experiment-v3 -- --year 2026 --round 105 --json
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256FileBytes } from "../src/lib/proto-round-screenshot-intake-v1/hash";
import { resolveContainedCanonicalImageAbs } from "../src/lib/proto-round-raw-ocr-v0/path-containment";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  loadIntakeManifest,
  resolveOperatorRoot,
  roundDirectoryRelative,
  yangEdgeDirectoryRelative,
} from "../src/lib/proto-round-screenshot-intake-v1";
import { RAW_OCR_ARTIFACT_FILE_NAME } from "../src/lib/proto-round-raw-ocr-v0/types";
import { VISUAL_ROWS_ARTIFACT_FILE_NAME } from "../src/lib/proto-round-visual-rows-v0/types";
import { SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME } from "../src/lib/proto-round-semantic-region-candidates-v0/types";
import {
  DISCOVERY_ANNOTATION_FILE_NAME,
  GROUND_TRUTH_DIRECTORY_NAME,
  SELECTION_MANIFEST_FILE_NAME,
} from "../src/lib/proto-round-ground-truth-v0/types";
import {
  canonicalJson,
  createWindowsCropOcrProviderV3,
  cropOcrProviderVersionV3,
  FROZEN_FIRST_SHOT_EXTRACTION_SHA256,
  FROZEN_FRESH_VALIDATION_IMAGE_COUNT,
  FROZEN_FRESH_VALIDATION_SEAL_SHA256,
  FROZEN_OCR_RECOVERY_V2_RESULT_SHA256,
  identifyFreshUnseenImages,
  OCR_RECOVERY_V2_LOCAL_DIR_NAME,
  OCR_RECOVERY_V2_RESULT_FILE_NAME,
  PARTICIPANT_OCR_V3_LOCAL_DIR_NAME,
  PARTICIPANT_OCR_V3_RESULT_FILE_NAME,
  runParticipantOcrExperimentV3,
  selectPilot10Truth,
  sha256Bytes,
  type FrozenIdentityV3,
  type PilotTruthV3,
  type SemanticRegionGeometryV3,
  type VisualRowGeometryV3,
} from "../src/lib/proto-round-participant-ocr-experiment-v3";

const STRUCTURED_EXTRACTION_ARTIFACT_FILE_NAME = "structured-extraction-v0.json";
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

function selectionPilotKeys(raw: unknown): FrozenIdentityV3[] {
  const doc = raw as { discoveryRowKeys?: FrozenIdentityV3[] };
  if (!Array.isArray(doc.discoveryRowKeys)) {
    throw new Error("SELECTION_DISCOVERY_KEYS_MISSING");
  }
  return doc.discoveryRowKeys.map((k) => ({
    sourceImageSha256: k.sourceImageSha256,
    visualRowIndex: k.visualRowIndex,
  }));
}

function asPilotTruthRecords(raw: unknown): PilotTruthV3[] {
  const doc = raw as { records?: PilotTruthV3[] };
  if (!Array.isArray(doc.records)) {
    throw new Error("DISCOVERY_RECORDS_MISSING");
  }
  return doc.records.map((r) => ({
    sourceImageSha256: r.sourceImageSha256,
    visualRowIndex: r.visualRowIndex,
    annotationStatus: r.annotationStatus,
    participantLeftRaw: r.participantLeftRaw,
    participantRightRaw: r.participantRightRaw,
    numericCellsRaw: Array.isArray(r.numericCellsRaw) ? r.numericCellsRaw : [],
  }));
}

function visualGeometryFromDocument(raw: unknown): VisualRowGeometryV3[] {
  const doc = raw as {
    images?: Array<{
      sourceImageSha256: string;
      sourceFileName: string;
      imageWidth: number | null;
      imageHeight: number | null;
      visualRows?: Array<{
        visualRowIndex: number;
        topY: number;
        bottomY: number;
      }>;
    }>;
  };
  const out: VisualRowGeometryV3[] = [];
  for (const img of doc.images ?? []) {
    if (
      typeof img.imageWidth !== "number" ||
      typeof img.imageHeight !== "number" ||
      img.imageWidth < 1 ||
      img.imageHeight < 1
    ) {
      continue;
    }
    for (const row of img.visualRows ?? []) {
      out.push({
        sourceImageSha256: img.sourceImageSha256,
        sourceFileName: typeof img.sourceFileName === "string" ? img.sourceFileName : "",
        visualRowIndex: row.visualRowIndex,
        topY: row.topY,
        bottomY: row.bottomY,
        imageWidth: img.imageWidth,
        imageHeight: img.imageHeight,
      });
    }
  }
  return out;
}

function semanticGeometryFromDocument(raw: unknown): SemanticRegionGeometryV3[] {
  const doc = raw as {
    rows?: Array<{
      sourceImageSha256: string;
      visualRowIndex: number;
      regions?: Array<{
        rawEvidenceTags?: string[];
        fragments?: Array<{
          x: number;
          y: number;
          width: number;
          height: number;
        }>;
      }>;
    }>;
  };
  return (doc.rows ?? []).map((row) => ({
    sourceImageSha256: row.sourceImageSha256,
    visualRowIndex: row.visualRowIndex,
    regions: (row.regions ?? []).map((region) => ({
      rawEvidenceTags: Array.isArray(region.rawEvidenceTags)
        ? region.rawEvidenceTags.map((tag) => String(tag))
        : [],
      fragments: (region.fragments ?? []).map((f) => ({
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      })),
    })),
  }));
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

  const extractionAbs = path.join(yangAbs, STRUCTURED_EXTRACTION_ARTIFACT_FILE_NAME);
  const extractionSha = sha256Bytes(await readFile(extractionAbs));
  if (extractionSha !== FROZEN_FIRST_SHOT_EXTRACTION_SHA256) {
    console.error("FIRST_SHOT_ARTIFACT_MUTATED");
    console.error(extractionSha);
    process.exit(2);
  }

  const sealAbs = path.join(yangAbs, ...FRESH_VALIDATION_SEAL_REL.split("/"));
  const sealSha = sha256Bytes(await readFile(sealAbs));
  if (sealSha !== FROZEN_FRESH_VALIDATION_SEAL_SHA256) {
    console.error("FRESH_VALIDATION_SEAL_MUTATED");
    console.error(sealSha);
    process.exit(2);
  }

  const v2ResultAbs = path.join(
    yangAbs,
    OCR_RECOVERY_V2_LOCAL_DIR_NAME,
    OCR_RECOVERY_V2_RESULT_FILE_NAME,
  );
  const v2ResultSha = sha256Bytes(await readFile(v2ResultAbs));
  if (v2ResultSha !== FROZEN_OCR_RECOVERY_V2_RESULT_SHA256) {
    console.error("OCR_RECOVERY_V2_RESULT_MUTATED");
    console.error(v2ResultSha);
    process.exit(2);
  }

  const manifest = await loadIntakeManifest(operatorRootAbs, args.year, args.round);
  if (!manifest) throw new Error("INTAKE_MANIFEST_MISSING");

  const rawOcr = JSON.parse(
    await readFile(path.join(yangAbs, RAW_OCR_ARTIFACT_FILE_NAME), "utf8"),
  ) as {
    images?: Array<{ sourceImageSha256: string }>;
  };
  const fresh = identifyFreshUnseenImages({
    canonicalImages: manifest.files
      .filter((f) => f.fileStatus === "CANONICAL_IMAGE")
      .map((f) => ({ sha256: f.sha256 })),
    firstShotSourceImages: (rawOcr.images ?? []).map((img) => ({
      sourceImageSha256: img.sourceImageSha256,
    })),
  });
  if (fresh.freshUnseenImageCount !== FROZEN_FRESH_VALIDATION_IMAGE_COUNT) {
    console.error("FRESH_VALIDATION_IMAGE_COUNT_CHANGED");
    console.error(String(fresh.freshUnseenImageCount));
    process.exit(2);
  }

  const gtDir = path.join(yangAbs, GROUND_TRUTH_DIRECTORY_NAME);
  const pilotKeys = selectionPilotKeys(
    JSON.parse(await readFile(path.join(gtDir, SELECTION_MANIFEST_FILE_NAME), "utf8")),
  );
  const truthRows = selectPilot10Truth({
    discoveryRowKeys: pilotKeys,
    records: asPilotTruthRecords(
      JSON.parse(await readFile(path.join(gtDir, DISCOVERY_ANNOTATION_FILE_NAME), "utf8")),
    ),
  });
  const visualRows = visualGeometryFromDocument(
    JSON.parse(await readFile(path.join(yangAbs, VISUAL_ROWS_ARTIFACT_FILE_NAME), "utf8")),
  );
  const semanticRows = semanticGeometryFromDocument(
    JSON.parse(
      await readFile(
        path.join(yangAbs, SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME),
        "utf8",
      ),
    ),
  );

  const freshSet = new Set(fresh.freshUnseenImageSha256);
  const imagePathBySha256 = new Map<string, string>();
  for (const row of truthRows) {
    if (freshSet.has(row.sourceImageSha256)) {
      throw new Error("FRESH_VALIDATION_OCR_FORBIDDEN");
    }
    const file = manifest.files.find(
      (f) =>
        f.fileStatus === "CANONICAL_IMAGE" && f.sha256 === row.sourceImageSha256,
    );
    if (!file) throw new Error(`PILOT_CANONICAL_IMAGE_MISSING:${row.sourceImageSha256}`);
    const abs = resolveContainedCanonicalImageAbs(roundAbs, file.relativePath);
    const sha = await sha256FileBytes(abs);
    if (sha !== row.sourceImageSha256) {
      throw new Error("PILOT_IMAGE_HASH_MISMATCH");
    }
    imagePathBySha256.set(row.sourceImageSha256, abs);
  }

  const result = await runParticipantOcrExperimentV3({
    protoRoundKey: manifest.meta.protoRoundKey,
    pilotKeys: truthRows.map((r) => ({
      sourceImageSha256: r.sourceImageSha256,
      visualRowIndex: r.visualRowIndex,
    })),
    truthRows,
    visualRows,
    semanticRows,
    imagePathBySha256,
    freshSha256: freshSet,
    cropOcr: createWindowsCropOcrProviderV3(),
  });

  const localDir = path.join(yangAbs, PARTICIPANT_OCR_V3_LOCAL_DIR_NAME);
  const resultAbs = path.join(localDir, PARTICIPANT_OCR_V3_RESULT_FILE_NAME);
  await writeJsonAtomic(resultAbs, {
    ...result,
    ocrProviderVersion: cropOcrProviderVersionV3(),
    OCR_RECOVERY_V2_RESULT_SHA256: v2ResultSha,
    FRESH_VALIDATION_SEAL_SHA256: sealSha,
    freshUnseenImageCount: fresh.freshUnseenImageCount,
  });
  const resultSha = sha256Bytes(await readFile(resultAbs));

  const v2Reference = {
    participantPairExactEvidencePresent: 0,
    participantExactSlotCount: 2,
  };
  const best = result.candidates.find((c) => c.candidate === result.bestCandidate)!;

  const payload = {
    action: "participant-ocr-experiment-v3",
    protoRoundKey: manifest.meta.protoRoundKey,
    FIRST_SHOT_EXTRACTION_SHA256: extractionSha,
    OCR_RECOVERY_V2_RESULT_SHA256: v2ResultSha,
    FRESH_VALIDATION_SEAL_SHA256: sealSha,
    PARTICIPANT_OCR_V3_RESULT_SHA256: resultSha,
    freshUnseenImageCount: fresh.freshUnseenImageCount,
    interpolation: result.interpolation,
    resultAbs,
    candidates: result.candidates.map((c) => ({
      candidate: c.candidate,
      participantLeftExactEvidencePresent: c.participantLeftExactEvidencePresent,
      participantRightExactEvidencePresent: c.participantRightExactEvidencePresent,
      participantPairExactEvidencePresent: c.participantPairExactEvidencePresent,
      participantExactSlotCount: c.participantExactSlotCount,
      numericCellExactEvidenceCount: c.numericCellExactEvidenceCount,
      numericCellTotalTruthCount: c.numericCellTotalTruthCount,
      numericCellsAllExactEvidencePresent: c.numericCellsAllExactEvidencePresent,
    })),
    BEST_PARTICIPANT_OCR_V3_CANDIDATE: result.bestCandidate,
    deltaVsV2: {
      participantPairExactEvidencePresent:
        best.participantPairExactEvidencePresent -
        v2Reference.participantPairExactEvidencePresent,
      participantExactSlotCount:
        best.participantExactSlotCount - v2Reference.participantExactSlotCount,
    },
    PARTICIPANT_OCR_V3_LEVEL: result.PARTICIPANT_OCR_V3_LEVEL,
    PARSER_CHANGED: false,
    PRODUCTION_RAW_OCR_CHANGED: false,
    GROUND_TRUTH_USED: "PILOT10_DISCOVERY_ONLY",
    DISCOVERY_11_TO_30_ANNOTATED: false,
    HOLDOUT_READ: false,
    FRESH_VALIDATION_READ: false,
    FRESH_VALIDATION_OCR: false,
    PARTICIPANT_DICTIONARY_CREATED: false,
    FUZZY_ACCURACY_CREDIT: false,
    ENGINE_CHANGED: false,
    PREDICTION_CHANGED: false,
    DATA_RESEARCH_CHANGED: false,
    NETWORK_CALLS: 0,
  };

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`BEST_PARTICIPANT_OCR_V3_CANDIDATE=${result.bestCandidate}`);
  console.log(`PARTICIPANT_OCR_V3_RESULT_SHA256=${resultSha}`);
  console.log(`PARTICIPANT_OCR_V3_LEVEL=${result.PARTICIPANT_OCR_V3_LEVEL}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
