/**
 * Audit today's newly added proto-round odds screenshots.
 * Scan-only. No OCR. Does not mix into Discovery-2 / Validation-2 / Holdout.
 *
 *   npm run audit:proto-round-daily-odds-intake-v0 -- --inventory-date 2026-09-09 --json
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  absFromOperatorRelative,
  loadIntakeManifest,
  protoRoundIdentity,
  resolveOperatorRoot,
  scanProtoRoundInbox,
  sha256FileBytes,
  yangEdgeDirectoryRelative,
  type PhysicalFileRecordV1,
} from "../src/lib/proto-round-screenshot-intake-v1";
import {
  buildDailyOddsIntakeSealV0,
  canonicalJson,
  DAILY_ODDS_INTAKE_LOCAL_DIR_NAME,
  dailySealFileName,
  groupInventoryByRound,
  inventoryDailyScreenshots,
  newCanonicalImages,
  sha256Bytes,
  type DailyOddsImageV0,
} from "../src/lib/proto-round-daily-odds-intake-v0";

function parseArgs(argv: string[]) {
  let inventoryDate: string | null = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--inventory-date") {
      const v = argv[++i];
      if (!v) throw new Error("--inventory-date requires YYYY-MM-DD");
      inventoryDate = v;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  if (inventoryDate == null) throw new Error("Specify --inventory-date");
  return { inventoryDate, json };
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

function canonicalImagesFromManifest(
  files: PhysicalFileRecordV1[] | undefined,
): DailyOddsImageV0[] {
  return (files ?? [])
    .filter((f) => f.fileStatus === "CANONICAL_IMAGE")
    .map((f) => ({
      sourceFileName: f.fileName,
      sourceImageSha256: f.sha256,
      relativePath: f.relativePath,
    }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const hits = inventoryDailyScreenshots({
    operatorRootAbs,
    inventoryDate: args.inventoryDate,
  });
  const grouped = groupInventoryByRound(hits);
  const rounds = [];

  for (const [protoRoundKey, roundHits] of grouped) {
    const first = roundHits[0]!;
    const identity = protoRoundIdentity(first.year, first.round);
    const previous = await loadIntakeManifest(
      operatorRootAbs,
      identity.year,
      identity.round,
    );
    const previousCanonicalSha256 = new Set(
      canonicalImagesFromManifest(previous?.files).map((img) => img.sourceImageSha256),
    );
    const scan = await scanProtoRoundInbox({
      year: identity.year,
      round: identity.round,
    });
    const after = await loadIntakeManifest(
      operatorRootAbs,
      identity.year,
      identity.round,
    );
    const dailyImages: DailyOddsImageV0[] = [];
    const seen = new Set<string>();
    for (const hit of roundHits) {
      const sourceImageSha256 = await sha256FileBytes(hit.absPath);
      if (previousCanonicalSha256.has(sourceImageSha256)) continue;
      if (seen.has(sourceImageSha256)) continue;
      seen.add(sourceImageSha256);
      dailyImages.push({
        sourceFileName: hit.sourceFileName,
        sourceImageSha256,
        relativePath: hit.relativePath,
      });
    }
    const roundNewCanonical = newCanonicalImages({
      currentCanonical: canonicalImagesFromManifest(after?.files),
      previousCanonicalSha256,
    });
    const seal = buildDailyOddsIntakeSealV0({
      capturedInventoryDate: args.inventoryDate,
      year: identity.year,
      round: identity.round,
      roundLabel: identity.roundLabel,
      protoRoundKey: identity.protoRoundKey,
      scanSummary: {
        physical: scan.summary.physicalFileCount,
        canonical: scan.summary.canonicalImageCount,
        duplicates: scan.summary.duplicateExactCount,
        unsupported: scan.summary.unsupportedFileCount,
        eligible: scan.summary.extractionEligibleCount,
        previousCanonicalImageCount: scan.previousCanonicalImageCount,
        canonicalImageDelta: scan.canonicalImageDelta,
      },
      images: dailyImages,
    });
    const yangAbs = absFromOperatorRelative(
      operatorRootAbs,
      yangEdgeDirectoryRelative(identity.year, identity.round),
    );
    const sealAbs = path.join(
      yangAbs,
      DAILY_ODDS_INTAKE_LOCAL_DIR_NAME,
      dailySealFileName(args.inventoryDate),
    );
    await writeJsonAtomic(sealAbs, seal);
    const sealSha = sha256Bytes(await readFile(sealAbs));
    rounds.push({
      protoRoundKey,
      NEW_SCREENSHOT_ROUND_DIR: identity.roundLabel,
      NEW_SCREENSHOT_PHYSICAL_COUNT: roundHits.length,
      physical: scan.summary.physicalFileCount,
      canonical: scan.summary.canonicalImageCount,
      duplicates: scan.summary.duplicateExactCount,
      unsupported: scan.summary.unsupportedFileCount,
      eligible: scan.summary.extractionEligibleCount,
      canonicalImageDelta: scan.canonicalImageDelta,
      NEW_CANONICAL_IMAGE_COUNT: dailyImages.length,
      NEW_CANONICAL_IMAGE_SHA256: dailyImages.map((img) => img.sourceImageSha256),
      NEW_CANONICAL_FILE_NAMES: dailyImages.map((img) => img.sourceFileName),
      ROUND_NEW_CANONICAL_VS_PREVIOUS_INTAKE: roundNewCanonical.length,
      NEW_DAILY_ODDS_INTAKE_SEAL_SHA256: sealSha,
      sealAbs,
      USED_FOR_OCR_RULE_DESIGN: "NO",
      USED_FOR_DISCOVERY2_TRUTH: "NO",
      USED_FOR_VALIDATION2: "NO",
      USED_FOR_HOLDOUT: "NO",
      OCR_RUN: "NO",
    });
  }

  const payload = {
    action: "audit-daily-odds-intake-v0",
    capturedInventoryDate: args.inventoryDate,
    rounds,
    OCR_V4_STARTED: "NO",
    NETWORK_CALLS: 0,
  };
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  for (const row of rounds) {
    console.log(`NEW_SCREENSHOT_ROUND_DIR=${row.NEW_SCREENSHOT_ROUND_DIR}`);
    console.log(`NEW_SCREENSHOT_PHYSICAL_COUNT=${row.NEW_SCREENSHOT_PHYSICAL_COUNT}`);
    console.log(`NEW_DAILY_ODDS_INTAKE_SEAL_SHA256=${row.NEW_DAILY_ODDS_INTAKE_SEAL_SHA256}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
