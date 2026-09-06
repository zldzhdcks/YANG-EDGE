/**
 * Local extraction-design v0 for a proto round.
 * Reads canonical intake rows + PNG IHDR only. No OCR. No odds. No network.
 *
 *   npm run design:proto-round-extraction-v0 -- --year 2026 --round 105 --json
 */
import { mkdir, open, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildExtractionDesignDocumentV0,
  parseScreenshotFilenameTimestamp,
  readPngIhdrDimensions,
  type CanonicalImageDesignRecordV0,
} from "../src/lib/proto-round-extraction-design-v0";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  loadIntakeManifest,
  resolveOperatorRoot,
  roundDirectoryRelative,
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

async function readPngHeader(abs: string): Promise<Uint8Array> {
  const fh = await open(abs, "r");
  try {
    const buf = Buffer.alloc(24);
    const { bytesRead } = await fh.read(buf, 0, 24, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
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
  const manifest = await loadIntakeManifest(
    operatorRootAbs,
    args.year,
    args.round,
  );
  if (!manifest) {
    throw new Error("INTAKE_MANIFEST_MISSING");
  }
  const roundAbs = absFromOperatorRelative(
    operatorRootAbs,
    roundDirectoryRelative(args.year, args.round),
  );
  const canonical = manifest.files.filter((f) => f.fileStatus === "CANONICAL_IMAGE");
  const records: CanonicalImageDesignRecordV0[] = [];

  for (const f of canonical) {
    const abs = path.join(roundAbs, f.relativePath);
    let pngDimensions = null;
    let pngDecodeStatus: CanonicalImageDesignRecordV0["pngDecodeStatus"] =
      "READ_ERROR";
    try {
      const header = await readPngHeader(abs);
      const dims = readPngIhdrDimensions(header);
      if (dims) {
        pngDimensions = dims;
        pngDecodeStatus = "IHDR_OK";
      } else {
        pngDecodeStatus = "NOT_PNG";
      }
    } catch {
      pngDecodeStatus = "READ_ERROR";
    }
    records.push({
      relativePath: f.relativePath,
      fileName: f.fileName,
      extension: f.extension,
      byteSize: f.byteSize,
      sha256: f.sha256,
      firstSeenAt: f.firstSeenAt,
      filesystemMtime: f.filesystemMtime,
      filesystemBirthtime: f.filesystemBirthtime,
      filenameTimestamp: parseScreenshotFilenameTimestamp(f.fileName),
      pngDimensions,
      pngDecodeStatus,
      timingClassification: "UNCLASSIFIED",
    });
  }

  records.sort((a, b) => {
    const ak = a.filenameTimestamp.filenameTimestampCandidateUtc ?? a.fileName;
    const bk = b.filenameTimestamp.filenameTimestampCandidateUtc ?? b.fileName;
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });

  const doc = buildExtractionDesignDocumentV0({
    year: manifest.meta.year,
    round: manifest.meta.round,
    roundLabel: manifest.meta.roundLabel,
    protoRoundKey: manifest.meta.protoRoundKey,
    canonicalImages: records,
  });

  const outAbs = path.join(
    absFromOperatorRelative(
      operatorRootAbs,
      yangEdgeDirectoryRelative(args.year, args.round),
    ),
    "extraction-design-v0.json",
  );
  await writeJsonAtomic(outAbs, doc);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          action: "extraction-design-v0",
          artifactAbs: outAbs,
          realCanonicalImages: doc.meta.realCanonicalImages,
          filenameTimestampParseCoverage:
            doc.meta.filenameTimestampParseCoverage,
          imageDimensionGroups: doc.imageDimensionGroups,
          ocr: doc.meta.ocr,
          officialOddsExtraction: doc.meta.officialOddsExtraction,
          gameMatching: doc.meta.gameMatching,
          captureSequenceRule: doc.meta.captureSequenceRule,
          crossImageRowAutoDedupe: doc.meta.crossImageRowAutoDedupe,
          osGeneratorProven: doc.meta.osGeneratorProven,
          structuralPixelAnalysis: doc.meta.structuralPixelAnalysis,
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(`artifact=${outAbs}`);
  console.log(`coverage=${doc.meta.filenameTimestampParseCoverage}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
