/**
 * Build raw-evidence semantic region candidates from an existing
 * column-layout-audit-v0 artifact. No OCR rerun. No network.
 *
 *   npm run build:proto-round-semantic-region-candidates-v0 -- --year <year> --round <round> --json
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  COLUMN_LAYOUT_AUDIT_ARTIFACT_FILE_NAME,
  type ColumnLayoutAuditDocumentV0,
} from "../src/lib/proto-round-column-layout-audit-v0";
import {
  SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME,
  buildSemanticRegionCandidatesDocumentV0,
} from "../src/lib/proto-round-semantic-region-candidates-v0";
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
  const layout = JSON.parse(
    await readFile(path.join(yangAbs, COLUMN_LAYOUT_AUDIT_ARTIFACT_FILE_NAME), "utf8"),
  ) as ColumnLayoutAuditDocumentV0;
  const expectedKey = `${args.year}-${args.round}`;
  if (layout.meta.protoRoundKey !== expectedKey) {
    throw new Error(
      `PROTO_ROUND_KEY_MISMATCH: ${layout.meta.protoRoundKey} != ${expectedKey}`,
    );
  }

  const doc = buildSemanticRegionCandidatesDocumentV0(layout);
  const outAbs = path.join(yangAbs, SEMANTIC_REGION_CANDIDATES_ARTIFACT_FILE_NAME);
  await writeJsonAtomic(outAbs, doc);

  const payload = {
    action: "semantic-region-candidates-v0",
    artifactAbs: outAbs,
    schemaVersion: doc.meta.schemaVersion,
    protoRoundKey: doc.meta.protoRoundKey,
    semanticScope: doc.meta.semanticScope,
    bandIndexSemanticMeaning: doc.meta.bandIndexSemanticMeaning,
    coverage: doc.coverage,
    tagAudit: doc.tagAudit.map((t) => ({
      tag: t.tag,
      regionCount: t.regionCount,
      rowCoverage: t.rowCoverage,
      occupiedBandIndexCounts: t.occupiedBandIndexCounts,
    })),
    tagCombinationAudit: doc.tagCombinationAudit,
    signatureAudit: doc.signatureAudit.slice(0, 40),
    layoutPatternEvidenceAudit: doc.layoutPatternEvidenceAudit.slice(0, 20).map((p) => ({
      layoutPatternId: p.layoutPatternId,
      rowCount: p.rowCount,
      mostCommonRawEvidenceSignature: p.mostCommonRawEvidenceSignature,
      mostCommonSignatureCount: p.mostCommonSignatureCount,
      otherSignatureCount: p.otherSignatureCount,
    })),
    representativePreviews: doc.representativePreviews,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`artifact=${outAbs}`);
  console.log(`totalRows=${doc.coverage.totalRows}`);
  console.log(`totalRegions=${doc.coverage.totalRegions}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
