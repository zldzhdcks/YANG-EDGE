/**
 * Build row-anchor + schedule candidates from existing visual-rows + raw-ocr.
 * Additive semantics only. No OCR rerun. No network.
 *
 *   npm run build:proto-round-row-anchor-schedule-v0 -- --year <year> --round <round> --json
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  RAW_OCR_ARTIFACT_FILE_NAME,
  RAW_OCR_SCHEMA_VERSION,
  type RawOcrDocumentV0,
} from "../src/lib/proto-round-raw-ocr-v0";
import {
  VISUAL_ROWS_ARTIFACT_FILE_NAME,
  VISUAL_ROWS_SCHEMA_VERSION,
  type VisualRowsDocumentV0,
} from "../src/lib/proto-round-visual-rows-v0";
import {
  ROW_ANCHOR_SCHEDULE_ARTIFACT_FILE_NAME,
  buildRowAnchorScheduleDocumentV0,
  countScheduleStatuses,
} from "../src/lib/proto-round-row-anchor-schedule-v0";
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

async function writeJsonAtomic(abs: string, value: unknown): Promise<void> {
  const dir = path.dirname(abs);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${path.basename(abs)}.${process.pid}.tmp`);
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
  const visualAbs = path.join(yangAbs, VISUAL_ROWS_ARTIFACT_FILE_NAME);
  const ocrAbs = path.join(yangAbs, RAW_OCR_ARTIFACT_FILE_NAME);
  const visual = JSON.parse(await readFile(visualAbs, "utf8")) as VisualRowsDocumentV0;
  const ocr = JSON.parse(await readFile(ocrAbs, "utf8")) as RawOcrDocumentV0;
  if (visual.meta.schemaVersion !== VISUAL_ROWS_SCHEMA_VERSION) {
    throw new Error(
      `UNEXPECTED_VISUAL_ROWS_SCHEMA: ${visual.meta.schemaVersion}`,
    );
  }
  if (ocr.meta.schemaVersion !== RAW_OCR_SCHEMA_VERSION) {
    throw new Error(`UNEXPECTED_RAW_OCR_SCHEMA: ${ocr.meta.schemaVersion}`);
  }
  const expectedKey = `${args.year}-${args.round}`;
  if (visual.meta.protoRoundKey !== expectedKey) {
    throw new Error(
      `PROTO_ROUND_KEY_MISMATCH: ${visual.meta.protoRoundKey} != ${expectedKey}`,
    );
  }

  const doc = buildRowAnchorScheduleDocumentV0({ visual, ocr });
  const outAbs = path.join(yangAbs, ROW_ANCHOR_SCHEDULE_ARTIFACT_FILE_NAME);
  await writeJsonAtomic(outAbs, doc);

  const metrics = countScheduleStatuses(doc.rows);
  const coverage =
    doc.meta.sourceVisualRows === 0
      ? null
      : metrics.PARSED_EXACT / doc.meta.sourceVisualRows;
  const payload = {
    action: "row-anchor-schedule-v0",
    artifactAbs: outAbs,
    schemaVersion: doc.meta.schemaVersion,
    protoRoundKey: doc.meta.protoRoundKey,
    sourceImages: doc.meta.sourceImages,
    sourceVisualRows: doc.meta.sourceVisualRows,
    semanticScope: doc.meta.semanticScope,
    ocrCorrection: doc.meta.ocrCorrection,
    parserAccuracyPercent: doc.meta.parserAccuracyPercent,
    rowIdentifierScope: doc.meta.rowIdentifierScope,
    yearContextSourceJoin: doc.meta.yearContextSourceJoin,
    exactScheduleParseCoverage: coverage,
    metrics,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`artifact=${outAbs}`);
  console.log(`sourceImages=${doc.meta.sourceImages}`);
  console.log(`sourceVisualRows=${doc.meta.sourceVisualRows}`);
  console.log(`PARSED_EXACT=${metrics.PARSED_EXACT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
