/**
 * Local raw OCR v0 for a proto round.
 * IMAGE → LOCAL OCR RAW TEXT. No odds parse. No game matching. No network.
 *
 *   npm run extract:proto-round-raw-ocr-v0 -- --year 2026 --round 105 --json
 */
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseScreenshotFilenameTimestamp } from "../src/lib/proto-round-extraction-design-v0";
import {
  extractRawOcrV0,
  previewNonEmptyRawLines,
  RAW_OCR_ARTIFACT_FILE_NAME,
} from "../src/lib/proto-round-raw-ocr-v0";
import { auditLocalOcrCapabilities } from "../src/lib/proto-round-raw-ocr-v0/capability-audit";
import { tryCreateWindowsMediaOcrProvider } from "../src/lib/proto-round-raw-ocr-v0/windows-media-ocr";
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
  const audit = await auditLocalOcrCapabilities();
  const provider = tryCreateWindowsMediaOcrProvider(audit.windowsMediaOcr);
  if (!provider) {
    console.error("PROTO_ROUND_105_RAW_OCR_LOCAL_PROVIDER_BLOCKED");
    console.error(
      JSON.stringify(
        {
          windowsMediaOcr: audit.windowsMediaOcr,
          tesseract: audit.tesseract,
          autoInstalled: audit.autoInstalled,
          networkUsed: audit.networkUsed,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

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

  const doc = await extractRawOcrV0({
    year: manifest.meta.year,
    round: manifest.meta.round,
    protoRoundKey: manifest.meta.protoRoundKey,
    roundAbs,
    files: manifest.files,
    provider,
  });

  const outAbs = path.join(
    absFromOperatorRelative(
      operatorRootAbs,
      yangEdgeDirectoryRelative(args.year, args.round),
    ),
    RAW_OCR_ARTIFACT_FILE_NAME,
  );
  await writeJsonAtomic(outAbs, doc);

  const summary = doc.images.map((img) => ({
    fileName: img.sourceFileName,
    ocrStatus: img.ocrStatus,
    lineCount: img.lineCount,
    nonWhitespaceCharacterCount: img.nonWhitespaceCharacterCount,
    filenameTimestampParseStatus: img.filenameTimestampParseStatus,
    acceptedObservationTime: img.acceptedObservationTime,
    AUTO_MERGE_ELIGIBLE: img.AUTO_MERGE_ELIGIBLE,
    previewLines: previewNonEmptyRawLines(img.rawLines, 8),
    filenameTimestampCandidateKst: img.filenameTimestampCandidateKst,
    candidateProvenance: img.candidateProvenance,
    capturedAtWouldBe: parseScreenshotFilenameTimestamp(img.sourceFileName)
      .filenameTimestampCandidateKst
      ? "CANDIDATE_ONLY"
      : "NO_CANDIDATE",
  }));

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          action: "raw-ocr-v0",
          artifactAbs: outAbs,
          capabilityAudit: {
            windowsMediaOcr: audit.windowsMediaOcr,
            tesseract: audit.tesseract,
            networkUsed: audit.networkUsed,
            autoInstalled: audit.autoInstalled,
          },
          ocrProvider: doc.meta.ocrProvider,
          ocrProviderVersion: doc.meta.ocrProviderVersion,
          ocrLanguages: doc.meta.ocrLanguages,
          sourceCanonicalImages: doc.meta.sourceCanonicalImages,
          officialOddsExtraction: doc.meta.officialOddsExtraction,
          gameMatching: doc.meta.gameMatching,
          crossImageRowDedupe: doc.meta.crossImageRowDedupe,
          acceptedObservationTimes: doc.meta.acceptedObservationTimes,
          images: summary,
        },
        null,
        2,
      ),
    );
    return;
  }
  console.log(`artifact=${outAbs}`);
  console.log(`provider=${doc.meta.ocrProvider} ${doc.meta.ocrProviderVersion}`);
  for (const row of summary) {
    console.log(
      `${row.fileName} ${row.ocrStatus} lines=${row.lineCount} chars=${row.nonWhitespaceCharacterCount}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
