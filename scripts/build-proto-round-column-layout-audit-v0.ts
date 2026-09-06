/**
 * Build a geometry-first column layout audit from existing visual-rows +
 * row-anchor-schedule artifacts. No OCR rerun. No network.
 *
 *   npm run build:proto-round-column-layout-audit-v0 -- --year <year> --round <round> --json
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  COLUMN_LAYOUT_AUDIT_ARTIFACT_FILE_NAME,
  buildColumnLayoutAuditDocumentV0,
} from "../src/lib/proto-round-column-layout-audit-v0";
import {
  ROW_ANCHOR_SCHEDULE_ARTIFACT_FILE_NAME,
  ROW_ANCHOR_SCHEDULE_SCHEMA_VERSION,
  type RowAnchorScheduleDocumentV0,
} from "../src/lib/proto-round-row-anchor-schedule-v0";
import {
  VISUAL_ROWS_ARTIFACT_FILE_NAME,
  VISUAL_ROWS_SCHEMA_VERSION,
  type VisualRowsDocumentV0,
} from "../src/lib/proto-round-visual-rows-v0";
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
  const visual = JSON.parse(
    await readFile(path.join(yangAbs, VISUAL_ROWS_ARTIFACT_FILE_NAME), "utf8"),
  ) as VisualRowsDocumentV0;
  const semantic = JSON.parse(
    await readFile(path.join(yangAbs, ROW_ANCHOR_SCHEDULE_ARTIFACT_FILE_NAME), "utf8"),
  ) as RowAnchorScheduleDocumentV0;
  if (visual.meta.schemaVersion !== VISUAL_ROWS_SCHEMA_VERSION) {
    throw new Error(`UNEXPECTED_VISUAL_ROWS_SCHEMA: ${visual.meta.schemaVersion}`);
  }
  if (semantic.meta.schemaVersion !== ROW_ANCHOR_SCHEDULE_SCHEMA_VERSION) {
    throw new Error(
      `UNEXPECTED_ROW_ANCHOR_SCHEDULE_SCHEMA: ${semantic.meta.schemaVersion}`,
    );
  }
  const expectedKey = `${args.year}-${args.round}`;
  if (visual.meta.protoRoundKey !== expectedKey) {
    throw new Error(
      `PROTO_ROUND_KEY_MISMATCH: ${visual.meta.protoRoundKey} != ${expectedKey}`,
    );
  }

  const doc = buildColumnLayoutAuditDocumentV0({ visual, semantic });
  const outAbs = path.join(yangAbs, COLUMN_LAYOUT_AUDIT_ARTIFACT_FILE_NAME);
  await writeJsonAtomic(outAbs, doc);

  const payload = {
    action: "column-layout-audit-v0",
    artifactAbs: outAbs,
    schemaVersion: doc.meta.schemaVersion,
    protoRoundKey: doc.meta.protoRoundKey,
    sourceImages: doc.meta.sourceImages,
    sourceVisualRows: doc.meta.sourceVisualRows,
    geometryBasis: doc.meta.geometryBasis,
    boundaryDerivationMethod: doc.meta.boundaryDerivationMethod,
    multiLayoutCandidate: doc.meta.multiLayoutCandidate,
    coverage: doc.coverage,
    candidateBandCount: doc.candidateBands.length,
    layoutPatterns: doc.layoutPatterns.map((p) => ({
      patternId: p.patternId,
      occupancyKey: p.occupancyKey,
      rowCount: p.rowCount,
    })),
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`artifact=${outAbs}`);
  console.log(`sourceVisualRows=${doc.meta.sourceVisualRows}`);
  console.log(`patterns=${doc.coverage.uniqueLayoutPatternCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
