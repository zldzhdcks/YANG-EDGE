/**
 * Pilot10 evaluator for frozen first-shot structured extraction.
 * Reads Ground Truth only after parser freeze. Does not modify the parser.
 * Evaluates Discovery rows 1-10 only. Does not read Holdout visual content.
 *
 *   npm run eval:proto-round-structured-extraction-pilot10-v0 -- --year 2026 --round 105 --json
 *   npm run eval:proto-round-structured-extraction-pilot10-v0 -- --year 2026 --round 105 --json --diagnose
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DISCOVERY_ANNOTATION_FILE_NAME,
  GROUND_TRUTH_DIRECTORY_NAME,
  SELECTION_MANIFEST_FILE_NAME,
  type DiscoveryAnnotationDocumentV0,
} from "../src/lib/proto-round-ground-truth-v0/types";
import {
  diagnosePilot10Discovery,
  evaluatePilot10Discovery,
  type PilotSelectionSourceV0,
} from "../src/lib/proto-round-structured-extraction-eval-v0";
import {
  STRUCTURED_EXTRACTION_ARTIFACT_FILE_NAME,
  type StructuredExtractionDocumentV0,
} from "../src/lib/proto-round-structured-extraction-v0/types";
import {
  SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME,
  type SemanticRegionCandidatesDocumentV0,
} from "../src/lib/proto-round-semantic-region-candidates-v0/types";
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
  let diagnose = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--diagnose") {
      diagnose = true;
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
  return { ...assertSafeProtoRoundCoords(year, round), json, diagnose };
}

function selectionPilotOnly(raw: unknown): PilotSelectionSourceV0 {
  const doc = raw as { discoveryRowKeys?: PilotSelectionSourceV0["discoveryRowKeys"] };
  if (!Array.isArray(doc.discoveryRowKeys)) {
    throw new Error("SELECTION_DISCOVERY_KEYS_MISSING");
  }
  return { discoveryRowKeys: doc.discoveryRowKeys };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const gtDir = path.join(yangAbs, GROUND_TRUTH_DIRECTORY_NAME);

  const selection = selectionPilotOnly(
    JSON.parse(await readFile(path.join(gtDir, SELECTION_MANIFEST_FILE_NAME), "utf8")),
  );
  const discovery = JSON.parse(
    await readFile(path.join(gtDir, DISCOVERY_ANNOTATION_FILE_NAME), "utf8"),
  ) as DiscoveryAnnotationDocumentV0;
  const extraction = JSON.parse(
    await readFile(path.join(yangAbs, STRUCTURED_EXTRACTION_ARTIFACT_FILE_NAME), "utf8"),
  ) as StructuredExtractionDocumentV0;

  const evalResult = evaluatePilot10Discovery({
    selection,
    truthRecords: discovery.records,
    machineRecords: extraction.rows,
  });

  const payload: Record<string, unknown> = {
    action: "eval-structured-extraction-pilot10-v0",
    protoRoundKey: `${args.year}-${args.round}`,
    parserFreezeCommitRequired: true,
    ...evalResult,
  };

  if (args.diagnose) {
    const semantic = JSON.parse(
      await readFile(path.join(yangAbs, SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME), "utf8"),
    ) as SemanticRegionCandidatesDocumentV0;
    payload.diagnosis = diagnosePilot10Discovery({
      selection,
      truthRecords: discovery.records,
      machineRecords: extraction.rows,
      semanticRows: semantic.rows,
    });
    payload.marketGroundTruthSufficient = evalResult.marketMarkerEvaluableCount > 0;
  }

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`pilotRows=${evalResult.pilotRows}`);
  console.log(`rowIdentifierExactCount=${evalResult.rowIdentifierExactCount}`);
  console.log(`participantLeftExactCount=${evalResult.participantLeftExactCount}`);
  console.log(`participantRightExactCount=${evalResult.participantRightExactCount}`);
  console.log(`numericCellsExactCount=${evalResult.numericCellsExactCount}`);
  console.log(`primaryFourExactRowCount=${evalResult.primaryFourExactRowCount}`);
  console.log(`marketMarkerEvaluableCount=${evalResult.marketMarkerEvaluableCount}`);
  console.log(`marketMarkerExactCount=${evalResult.marketMarkerExactCount}`);
  console.log(`fullStructureEvaluableCount=${evalResult.fullStructureEvaluableCount}`);
  console.log(`fullStructureExactCount=${evalResult.fullStructureExactCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
