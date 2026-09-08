/**
 * Open Discovery-2 human-only annotation UI.
 * Does not render Validation-2. Does not mutate Pilot10.
 *
 *   npm run open:proto-round-ocr-research-expansion-discovery2-ui-v1 -- --year 2026 --round 105
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  DISCOVERY_ANNOTATION_FILE_NAME,
  GROUND_TRUTH_DIRECTORY_NAME,
} from "../src/lib/proto-round-ground-truth-v0/types";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  resolveOperatorRoot,
  yangEdgeDirectoryRelative,
} from "../src/lib/proto-round-screenshot-intake-v1";
import {
  blankDiscovery2AnnotationRecords,
  DISCOVERY2_ANNOTATION_HTML_FILE_NAME,
  discovery2RowsFromFrozenGeometry,
  OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME,
  renderDiscovery2AnnotationHtml,
  sha256Bytes,
  SPLIT_SEAL_FILE_NAME,
  type ExpansionEligibleRowV1,
  type ExpansionSplitSealV1,
} from "../src/lib/proto-round-ocr-research-expansion-v1";

function parseArgs(argv: string[]) {
  let year: number | null = null;
  let round: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
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
  return assertSafeProtoRoundCoords(year, round);
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

function openLocalFile(abs: string): void {
  spawn("cmd.exe", ["/c", "start", "", abs], {
    windowsHide: true,
    detached: true,
    stdio: "ignore",
  }).unref();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const gtDir = path.join(yangAbs, GROUND_TRUTH_DIRECTORY_NAME);
  const discoveryAbs = path.join(gtDir, DISCOVERY_ANNOTATION_FILE_NAME);
  const pilot10ShaBefore = sha256Bytes(await readFile(discoveryAbs));

  const localDir = path.join(yangAbs, OCR_RESEARCH_EXPANSION_LOCAL_DIR_NAME);
  const seal = JSON.parse(
    await readFile(path.join(localDir, SPLIT_SEAL_FILE_NAME), "utf8"),
  ) as ExpansionSplitSealV1;
  const discoveryDoc = JSON.parse(await readFile(discoveryAbs, "utf8")) as {
    records?: Array<{
      sourceImageSha256: string;
      sourceFileName: string;
      visualRowIndex: number;
      targetRowGeometry?: {
        topY: number;
        bottomY: number;
        centerY: number;
        imageWidth: number;
        imageHeight: number;
      };
      screenshotRelativePath?: string;
    }>;
  };
  const geometryRows: ExpansionEligibleRowV1[] = (discoveryDoc.records ?? [])
    .filter((rec) => rec.targetRowGeometry && rec.screenshotRelativePath)
    .map((rec) => ({
      sourceImageSha256: rec.sourceImageSha256,
      sourceFileName: rec.sourceFileName,
      visualRowIndex: rec.visualRowIndex,
      topY: rec.targetRowGeometry!.topY,
      bottomY: rec.targetRowGeometry!.bottomY,
      centerY: rec.targetRowGeometry!.centerY,
      imageWidth: rec.targetRowGeometry!.imageWidth,
      imageHeight: rec.targetRowGeometry!.imageHeight,
      screenshotRelativePath: rec.screenshotRelativePath!,
    }));
  const discovery2Rows = discovery2RowsFromFrozenGeometry({
    discovery2RowKeys: seal.discovery2RowKeys,
    geometryRows,
  });
  const html = renderDiscovery2AnnotationHtml({
    protoRoundKey: seal.protoRoundKey,
    records: blankDiscovery2AnnotationRecords(discovery2Rows),
  });
  const htmlAbs = path.join(localDir, DISCOVERY2_ANNOTATION_HTML_FILE_NAME);
  await writeTextAtomic(htmlAbs, html);

  const pilot10ShaAfter = sha256Bytes(await readFile(discoveryAbs));
  if (pilot10ShaBefore !== pilot10ShaAfter) {
    throw new Error("PILOT10_MUTATED");
  }
  openLocalFile(htmlAbs);
  console.log("OCR RESEARCH EXPANSION DISCOVERY-2 HUMAN ACTION REQUIRED");
  console.log(htmlAbs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
