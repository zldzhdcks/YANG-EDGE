/**
 * Build visual row candidates from an existing raw-ocr-v0.json.
 * Geometry only. No OCR rerun. No odds parse. No network.
 *
 *   npm run build:proto-round-visual-rows-v0 -- --year <year> --round <round> --json
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RawOcrDocumentV0 } from "../src/lib/proto-round-raw-ocr-v0";
import { RAW_OCR_ARTIFACT_FILE_NAME } from "../src/lib/proto-round-raw-ocr-v0";
import {
  countSignalRows,
  fragmentCountDistribution,
  reconstructVisualRowsDocumentV0,
  VISUAL_ROWS_ARTIFACT_FILE_NAME,
  assertOcrSourceLineageMatchesExpected,
  type ImageDimensions,
} from "../src/lib/proto-round-visual-rows-v0";
import type { ExtractionDesignDocumentV0 } from "../src/lib/proto-round-extraction-design-v0";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  loadIntakeManifest,
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
  const manifest = await loadIntakeManifest(
    operatorRootAbs,
    args.year,
    args.round,
  );
  if (!manifest) throw new Error("INTAKE_MANIFEST_MISSING");

  const ocrAbs = path.join(yangAbs, RAW_OCR_ARTIFACT_FILE_NAME);
  const ocr = JSON.parse(await readFile(ocrAbs, "utf8")) as RawOcrDocumentV0;
  assertOcrSourceLineageMatchesExpected({
    manifest,
    ocr,
  });

  const dimensionsBySha256 = new Map<string, ImageDimensions>();
  try {
    const design = JSON.parse(
      await readFile(path.join(yangAbs, "extraction-design-v0.json"), "utf8"),
    ) as ExtractionDesignDocumentV0;
    for (const rec of design.canonicalImages) {
      if (rec.pngDimensions) {
        dimensionsBySha256.set(rec.sha256, {
          width: rec.pngDimensions.width,
          height: rec.pngDimensions.height,
        });
      }
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }

  const doc = reconstructVisualRowsDocumentV0({
    ocr,
    year: manifest.meta.year,
    round: manifest.meta.round,
    protoRoundKey: manifest.meta.protoRoundKey,
    dimensionsBySha256,
  });

  const outAbs = path.join(yangAbs, VISUAL_ROWS_ARTIFACT_FILE_NAME);
  await writeJsonAtomic(outAbs, doc);

  const allRows = doc.images.flatMap((img) => img.visualRows);
  const signals = countSignalRows(allRows);
  const coverage = {
    totalRawLines: ocr.images.reduce((s, i) => s + (i.rawLines?.length ?? 0), 0),
    linesWithBoundingBox: doc.images.reduce((s, i) => s + i.placedLineCount, 0),
    linesWithoutBoundingBox: doc.images.reduce((s, i) => s + i.unplacedLineCount, 0),
  };

  const images = doc.images.map((img) => ({
    fileName: img.sourceFileName,
    placedLineCount: img.placedLineCount,
    unplacedLineCount: img.unplacedLineCount,
    visualRowCandidateCount: img.visualRowCandidateCount,
    fragmentDistribution: fragmentCountDistribution(img.visualRows),
    previewRows: img.visualRows.slice(0, 10).map((row) => ({
      visualRowIndex: row.visualRowIndex,
      fragmentCount: row.fragmentCount,
      visualJoinedTextCandidate: row.visualJoinedTextCandidate,
    })),
  }));

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          action: "visual-rows-v0",
          artifactAbs: outAbs,
          boundingBoxCoverage: `${coverage.linesWithBoundingBox}/${coverage.totalRawLines}`,
          verticalOverlapThreshold: doc.meta.verticalOverlapThreshold,
          providerLineOrderUsed: doc.meta.providerLineOrderUsed,
          geometrySortUsed: doc.meta.geometrySortUsed,
          semanticParsing: doc.meta.semanticParsing,
          officialOddsExtraction: doc.meta.officialOddsExtraction,
          gameMatching: doc.meta.gameMatching,
          crossImageRowDedupe: doc.meta.crossImageRowDedupe,
          signals,
          images,
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(`artifact=${outAbs}`);
  console.log(`coverage=${coverage.linesWithBoundingBox}/${coverage.totalRawLines}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
