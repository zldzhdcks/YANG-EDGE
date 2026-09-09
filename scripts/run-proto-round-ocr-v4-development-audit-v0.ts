/**
 * OCR v4 development corpus audit + frozen v3 baseline.
 * Does not run v4 candidates. Does not open Validation-2, Holdout visuals, or Round 106 pixels.
 *
 *   npm run run:proto-round-ocr-v4-development-audit-v0 -- --year 2026 --round 105 --json
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
import { VISUAL_ROWS_ARTIFACT_FILE_NAME } from "../src/lib/proto-round-visual-rows-v0/types";
import { SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME } from "../src/lib/proto-round-semantic-region-candidates-v0/types";
import {
  DISCOVERY_ANNOTATION_FILE_NAME,
  GROUND_TRUTH_DIRECTORY_NAME,
  SELECTION_MANIFEST_FILE_NAME,
} from "../src/lib/proto-round-ground-truth-v0/types";
import {
  createWindowsCropOcrProviderV3,
  identifyFreshUnseenImages,
  PARTICIPANT_OCR_V3_LOCAL_DIR_NAME,
  PARTICIPANT_OCR_V3_RESULT_FILE_NAME,
  selectPilot10Truth,
  type SemanticRegionGeometryV3,
  type VisualRowGeometryV3,
} from "../src/lib/proto-round-participant-ocr-experiment-v3";
import { RAW_OCR_ARTIFACT_FILE_NAME } from "../src/lib/proto-round-raw-ocr-v0/types";
import {
  DISCOVERY2_HUMAN_TRUTH_FILE_NAME,
  OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME,
  SPLIT_SEAL_FILE_NAME,
  type ExpansionSplitSealV1,
} from "../src/lib/proto-round-ocr-research-expansion-v1";
import {
  accumulateSubsetMetrics,
  assertFrozenDaily106SealSha,
  assertFrozenDiscovery2TruthSha,
  assertFrozenPilot10Sha,
  assertFrozenSplitSha,
  assertFrozenV3ResultSha,
  buildDevelopmentCorpusV0,
  canonicalJson,
  classifyNumericFailure,
  classifyParticipantFailure,
  combineSubsetMetrics,
  DEVELOPMENT_BASELINE_FILE_NAME,
  DEVELOPMENT_CORPUS_FILE_NAME,
  emptyNumericFamilyCounts,
  emptyParticipantFamilyCounts,
  emptySubsetMetrics,
  ERROR_MORPHOLOGY_FILE_NAME,
  extractFrozenV3WinnerEvidence,
  familiesPresent,
  frozenOcrV4CandidateDefinitions,
  identityKey,
  leftRightHalfRowBands,
  OCR_V4_LOCAL_DIR_NAME,
  onlyInFirst,
  recurringFamilies,
  scoreDevelopmentRowV0,
  sha256Bytes,
  type DevelopmentRowScoreV0,
  type DevelopmentTruthRowV0,
} from "../src/lib/proto-round-ocr-v4-design-v0";

const DAILY_SEAL_REL = path.posix.join(
  "daily-odds-intake",
  "2026-09-09-new-screenshot-seal-v0.json",
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

function visualGeometryFromDocument(raw: unknown): VisualRowGeometryV3[] {
  const doc = raw as {
    images?: Array<{
      sourceImageSha256: string;
      sourceFileName: string;
      imageWidth: number | null;
      imageHeight: number | null;
      visualRows?: Array<{ visualRowIndex: number; topY: number; bottomY: number }>;
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
        fragments?: Array<{ x: number; y: number; width: number; height: number }>;
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
  if (args.round !== 105) {
    throw new Error("OCR_V4_DEVELOPMENT_AUDIT_ROUND_MUST_BE_105");
  }
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const roundAbs = absFromOperatorRelative(
    operatorRootAbs,
    roundDirectoryRelative(args.year, args.round),
  );

  const splitAbs = path.join(yangAbs, OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME, SPLIT_SEAL_FILE_NAME);
  const d2TruthAbs = path.join(
    yangAbs,
    OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME,
    DISCOVERY2_HUMAN_TRUTH_FILE_NAME,
  );
  const gtDir = path.join(yangAbs, GROUND_TRUTH_DIRECTORY_NAME);
  const discoveryAbs = path.join(gtDir, DISCOVERY_ANNOTATION_FILE_NAME);
  const v3Abs = path.join(
    yangAbs,
    PARTICIPANT_OCR_V3_LOCAL_DIR_NAME,
    PARTICIPANT_OCR_V3_RESULT_FILE_NAME,
  );
  const dailySealAbs = path.join(
    absFromOperatorRelative(
      operatorRootAbs,
      yangEdgeDirectoryRelative(args.year, 106),
    ),
    ...DAILY_SEAL_REL.split("/"),
  );

  assertFrozenSplitSha(sha256Bytes(await readFile(splitAbs)));
  assertFrozenDiscovery2TruthSha(sha256Bytes(await readFile(d2TruthAbs)));
  assertFrozenPilot10Sha(sha256Bytes(await readFile(discoveryAbs)));
  assertFrozenV3ResultSha(sha256Bytes(await readFile(v3Abs)));
  assertFrozenDaily106SealSha(sha256Bytes(await readFile(dailySealAbs)));

  const seal = JSON.parse(await readFile(splitAbs, "utf8")) as ExpansionSplitSealV1;
  const selection = JSON.parse(
    await readFile(path.join(gtDir, SELECTION_MANIFEST_FILE_NAME), "utf8"),
  ) as {
    discoveryRowKeys?: Array<{ sourceImageSha256: string; visualRowIndex: number }>;
    holdoutRowKeyHashes?: string[];
  };
  const discoveryKeys = (selection.discoveryRowKeys ?? []).map((k) => ({
    sourceImageSha256: k.sourceImageSha256,
    visualRowIndex: k.visualRowIndex,
  }));
  const corpus = buildDevelopmentCorpusV0({
    pilot10: discoveryKeys.slice(0, 10),
    discovery2: seal.discovery2RowKeys.map((k) => ({
      sourceImageSha256: k.sourceImageSha256,
      visualRowIndex: k.visualRowIndex,
    })),
    validation2RowKeyHashes: seal.validation2RowKeyHashes,
    holdoutRowKeyHashes: Array.isArray(selection.holdoutRowKeyHashes)
      ? selection.holdoutRowKeyHashes
      : [],
  });

  const d2TruthDoc = JSON.parse(await readFile(d2TruthAbs, "utf8")) as {
    records?: DevelopmentTruthRowV0[];
  };
  const d2TruthById = new Map(
    (d2TruthDoc.records ?? []).map((r) => [identityKey(r), r]),
  );
  const pilotTruth = selectPilot10Truth({
    discoveryRowKeys: discoveryKeys,
    records: (
      JSON.parse(await readFile(discoveryAbs, "utf8")) as { records?: DevelopmentTruthRowV0[] }
    ).records ?? [],
  });
  const pilotTruthById = new Map(pilotTruth.map((r) => [identityKey(r), r]));

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
  const visualById = new Map(visualRows.map((r) => [identityKey(r), r]));
  const semanticById = new Map(semanticRows.map((r) => [identityKey(r), r]));

  const manifest = await loadIntakeManifest(operatorRootAbs, args.year, args.round);
  if (!manifest) throw new Error("INTAKE_MANIFEST_MISSING");
  const rawOcr = JSON.parse(
    await readFile(path.join(yangAbs, RAW_OCR_ARTIFACT_FILE_NAME), "utf8"),
  ) as { images?: Array<{ sourceImageSha256: string }> };
  const fresh = identifyFreshUnseenImages({
    canonicalImages: manifest.files
      .filter((f) => f.fileStatus === "CANONICAL_IMAGE")
      .map((f) => ({ sha256: f.sha256 })),
    firstShotSourceImages: (rawOcr.images ?? []).map((img) => ({
      sourceImageSha256: img.sourceImageSha256,
    })),
  });
  const freshSet = new Set(fresh.freshUnseenImageSha256);

  const cropOcr = createWindowsCropOcrProviderV3();
  const needed = [...corpus.pilot10, ...corpus.discovery2];
  const imagePathBySha256 = new Map<string, string>();
  for (const row of needed) {
    if (freshSet.has(row.sourceImageSha256)) {
      throw new Error("FRESH_VALIDATION_OCR_FORBIDDEN");
    }
    if (imagePathBySha256.has(row.sourceImageSha256)) continue;
    const file = manifest.files.find(
      (f) => f.fileStatus === "CANONICAL_IMAGE" && f.sha256 === row.sourceImageSha256,
    );
    if (!file) throw new Error(`DEVELOPMENT_IMAGE_MISSING:${row.sourceImageSha256}`);
    const abs = resolveContainedCanonicalImageAbs(roundAbs, file.relativePath);
    const sha = await sha256FileBytes(abs);
    if (sha !== row.sourceImageSha256) throw new Error("DEVELOPMENT_IMAGE_HASH_MISMATCH");
    imagePathBySha256.set(row.sourceImageSha256, abs);
  }

  async function scoreSubset(
    keys: typeof corpus.pilot10,
    truthById: Map<string, DevelopmentTruthRowV0>,
  ): Promise<DevelopmentRowScoreV0[]> {
    const out: DevelopmentRowScoreV0[] = [];
    for (const key of keys) {
      const id = identityKey(key);
      const truth = truthById.get(id);
      const visual = visualById.get(id);
      if (!truth) throw new Error(`DEVELOPMENT_TRUTH_MISSING:${id}`);
      if (!visual) throw new Error(`DEVELOPMENT_VISUAL_MISSING:${id}`);
      const imagePath = imagePathBySha256.get(key.sourceImageSha256);
      if (!imagePath) throw new Error(`DEVELOPMENT_IMAGE_PATH_MISSING:${id}`);
      if (leftRightHalfRowBands(visual).deterministic !== true) {
        throw new Error(`LEFT_RIGHT_BAND_NOT_DETERMINISTIC:${id}`);
      }
      const evidence = await extractFrozenV3WinnerEvidence({
        visual,
        semantic: semanticById.get(id),
        imagePath,
        cropOcr,
      });
      out.push(scoreDevelopmentRowV0({ truth, evidence }));
    }
    return out;
  }

  const d2Rows = await scoreSubset(corpus.discovery2, d2TruthById);
  const pilotRows = await scoreSubset(corpus.pilot10, pilotTruthById);

  const v3 = JSON.parse(await readFile(v3Abs, "utf8")) as {
    bestCandidate?: string;
    candidates?: Array<{
      candidate: string;
      participantLeftExactEvidencePresent: number;
      participantRightExactEvidencePresent: number;
      participantPairExactEvidencePresent: number;
      participantExactSlotCount: number;
      numericCellExactEvidenceCount: number;
      numericCellTotalTruthCount: number;
      numericCellsAllExactEvidencePresent: number;
    }>;
  };
  const frozenWinner = (v3.candidates ?? []).find(
    (c) => c.candidate === "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION",
  );
  if (!frozenWinner) throw new Error("FROZEN_V3_WINNER_MISSING");

  const pilotFrozen = emptySubsetMetrics(10);
  pilotFrozen.participantLeftExact = frozenWinner.participantLeftExactEvidencePresent;
  pilotFrozen.participantRightExact = frozenWinner.participantRightExactEvidencePresent;
  pilotFrozen.participantPairExact = frozenWinner.participantPairExactEvidencePresent;
  pilotFrozen.participantSlotsExact = frozenWinner.participantExactSlotCount;
  pilotFrozen.numericRawExactCells = frozenWinner.numericCellExactEvidenceCount;
  pilotFrozen.numericRawTruthCells = frozenWinner.numericCellTotalTruthCount;
  pilotFrozen.numericRawAllExactRows = frozenWinner.numericCellsAllExactEvidencePresent;
  for (const row of pilotRows) {
    pilotFrozen.numericSafeExactCells += row.numericSafeExactCells;
    if (row.numericSafeAllExact) pilotFrozen.numericSafeAllExactRows += 1;
  }

  const discovery2Metrics = emptySubsetMetrics(10);
  for (const row of d2Rows) accumulateSubsetMetrics(discovery2Metrics, row);
  const combined = combineSubsetMetrics(pilotFrozen, discovery2Metrics);

  function morphologyFor(
    rows: DevelopmentRowScoreV0[],
    truthById: Map<string, DevelopmentTruthRowV0>,
  ) {
    const participant = emptyParticipantFamilyCounts();
    const numeric = emptyNumericFamilyCounts();
    for (const row of rows) {
      const truth = truthById.get(identityKey(row))!;
      if (!row.leftExact) {
        const fam = classifyParticipantFailure({
          truth: truth.participantLeftRaw,
          evidenceParts: row.evidenceParts,
          otherSlotTruth: truth.participantRightRaw,
        });
        if (fam) participant[fam] += 1;
      }
      if (!row.rightExact) {
        const fam = classifyParticipantFailure({
          truth: truth.participantRightRaw,
          evidenceParts: row.evidenceParts,
          otherSlotTruth: truth.participantLeftRaw,
        });
        if (fam) participant[fam] += 1;
      }
      for (const cell of truth.numericCellsRaw) {
        const fam = classifyNumericFailure({
          truth: cell,
          evidenceParts: row.evidenceParts,
        });
        if (fam) numeric[fam] += 1;
      }
    }
    return { participant, numeric };
  }

  const pilotMorph = morphologyFor(pilotRows, pilotTruthById);
  const d2Morph = morphologyFor(d2Rows, d2TruthById);
  const combinedParticipant = emptyParticipantFamilyCounts();
  const combinedNumeric = emptyNumericFamilyCounts();
  for (const k of Object.keys(combinedParticipant) as Array<keyof typeof combinedParticipant>) {
    combinedParticipant[k] = pilotMorph.participant[k] + d2Morph.participant[k];
  }
  for (const k of Object.keys(combinedNumeric) as Array<keyof typeof combinedNumeric>) {
    combinedNumeric[k] = pilotMorph.numeric[k] + d2Morph.numeric[k];
  }

  const localDir = path.join(yangAbs, OCR_V4_LOCAL_DIR_NAME);
  const corpusAbs = path.join(localDir, DEVELOPMENT_CORPUS_FILE_NAME);
  const baselineAbs = path.join(localDir, DEVELOPMENT_BASELINE_FILE_NAME);
  const morphAbs = path.join(localDir, ERROR_MORPHOLOGY_FILE_NAME);

  const baselineDoc = {
    schemaVersion: "proto-round-ocr-v4-design-v0",
    protoRoundKey: "2026-105",
    winnerCandidate: "ROW_PLUS_TEXT_REGION_EVIDENCE_UNION",
    developmentOnly: true,
    notValidation: true,
    ROUND_106_USED_FOR_V4_DESIGN: false,
    VALIDATION_2_READ: false,
    FRESH_VALIDATION_USED_FOR_TUNING: false,
    FORMAL_HOLDOUT_READ: false,
    OCR_V4_EXPERIMENT_EXECUTED: false,
    pilot10: pilotFrozen,
    discovery2: discovery2Metrics,
    combined20: combined,
    candidates: frozenOcrV4CandidateDefinitions(),
  };
  const morphDoc = {
    schemaVersion: "proto-round-ocr-v4-design-v0",
    ROUND_106_USED_FOR_V4_DESIGN: false,
    VALIDATION_2_READ: false,
    FRESH_VALIDATION_USED_FOR_TUNING: false,
    FORMAL_HOLDOUT_READ: false,
    TEAM_NAME_DICTIONARY_FORBIDDEN: true,
    THREE_DIGIT_DECIMAL_GUESS_FORBIDDEN: true,
    participant: {
      pilot10: pilotMorph.participant,
      discovery2: d2Morph.participant,
      combined20: combinedParticipant,
    },
    numeric: {
      pilot10: pilotMorph.numeric,
      discovery2: d2Morph.numeric,
      combined20: combinedNumeric,
    },
    crossSubset: {
      recurringParticipantFamilies: recurringFamilies(
        pilotMorph.participant,
        d2Morph.participant,
      ),
      recurringNumericFamilies: recurringFamilies(pilotMorph.numeric, d2Morph.numeric),
      pilotOnlyParticipantFamilies: onlyInFirst(pilotMorph.participant, d2Morph.participant),
      discovery2OnlyParticipantFamilies: onlyInFirst(d2Morph.participant, pilotMorph.participant),
      pilotOnlyNumericFamilies: onlyInFirst(pilotMorph.numeric, d2Morph.numeric),
      discovery2OnlyNumericFamilies: onlyInFirst(d2Morph.numeric, pilotMorph.numeric),
    },
    presentParticipantFamilies: {
      pilot10: familiesPresent(pilotMorph.participant),
      discovery2: familiesPresent(d2Morph.participant),
      combined20: familiesPresent(combinedParticipant),
    },
    presentNumericFamilies: {
      pilot10: familiesPresent(pilotMorph.numeric),
      discovery2: familiesPresent(d2Morph.numeric),
      combined20: familiesPresent(combinedNumeric),
    },
  };

  await writeJsonAtomic(corpusAbs, corpus);
  await writeJsonAtomic(baselineAbs, baselineDoc);
  await writeJsonAtomic(morphAbs, morphDoc);
  const payload = {
    action: "ocr-v4-development-audit-v0",
    OCR_V4_DEVELOPMENT_CORPUS_SHA256: sha256Bytes(await readFile(corpusAbs)),
    OCR_V4_DEVELOPMENT_BASELINE_SHA256: sha256Bytes(await readFile(baselineAbs)),
    OCR_V4_ERROR_MORPHOLOGY_SHA256: sha256Bytes(await readFile(morphAbs)),
    pilot10: pilotFrozen,
    discovery2: discovery2Metrics,
    combined20: combined,
    morphology: morphDoc.crossSubset,
    candidates: frozenOcrV4CandidateDefinitions().map((c) => c.name),
    ROUND_106_USED_FOR_V4_DESIGN: "NO",
    VALIDATION_2_READ: "NO",
    FRESH_VALIDATION_USED_FOR_TUNING: "NO",
    FORMAL_HOLDOUT_READ: "NO",
    OCR_V4_EXPERIMENT_EXECUTED: "NO",
    NETWORK_CALLS: 0,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`OCR_V4_DEVELOPMENT_CORPUS_SHA256=${payload.OCR_V4_DEVELOPMENT_CORPUS_SHA256}`);
  console.log(`OCR_V4_DEVELOPMENT_BASELINE_SHA256=${payload.OCR_V4_DEVELOPMENT_BASELINE_SHA256}`);
  console.log(`OCR_V4_ERROR_MORPHOLOGY_SHA256=${payload.OCR_V4_ERROR_MORPHOLOGY_SHA256}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
