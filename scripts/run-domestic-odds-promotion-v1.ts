/**
 * Promote 2026-09-13 domestic screenshot odds into structured rows.
 * Local OCR only. No prediction. No main merge.
 *
 *   npm run promote:domestic-odds-v1 -- --inventory-date 2026-09-13 --json
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  resolveOperatorRoot,
  sha256FileBytes,
} from "../src/lib/proto-round-screenshot-intake-v1";
import {
  inventoryDailyScreenshots,
  listAmbiguousDuplicateRoundDirectories,
} from "../src/lib/proto-round-daily-odds-intake-v0";
import { auditLocalOcrCapabilities } from "../src/lib/proto-round-raw-ocr-v0/capability-audit";
import { tryCreateWindowsMediaOcrProvider } from "../src/lib/proto-round-raw-ocr-v0/windows-media-ocr";
import {
  canonicalJson,
  countJoin,
  DOMESTIC_ODDS_PROMOTION_SCHEMA,
  joinStructuredOddsRow,
  loadFootballScheduleIfPresent,
  loadMlbScheduleIfPresent,
  parseOcrImageToRows,
  ROUND_IDENTITY_UNCERTAIN,
  sha256Text,
  type OcrGeometryLineV1,
  type StructuredOddsRowV1,
} from "../src/lib/domestic-odds-promotion-v1";
import { footballScheduleV1Rel } from "../src/lib/football/core/paths";
import { mlbScheduleArtifactRel } from "../src/lib/mlb/build-mlb-schedule-artifact";

function parseArgs(argv: string[]) {
  let inventoryDate: string | null = null;
  let json = false;
  let fromGeometry: string | null = null;
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
    if (a === "--from-geometry") {
      const v = argv[++i];
      if (!v) throw new Error("--from-geometry requires a path");
      fromGeometry = v;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  if (inventoryDate == null) throw new Error("Specify --inventory-date");
  return { inventoryDate, json, fromGeometry };
}

function pinnedOperatorObservedAtUtc(cwd: string, inventoryDate: string): string {
  const intakeRel = `data/audits/${inventoryDate}-round-108-domestic-odds-intake-v1.json`;
  const abs = path.join(cwd, intakeRel);
  if (!existsSync(abs)) return new Date().toISOString();
  const parsed = JSON.parse(readFileSync(abs, "utf8")) as {
    intakeObservedAt?: unknown;
  };
  return typeof parsed.intakeObservedAt === "string"
    ? parsed.intakeObservedAt
    : new Date().toISOString();
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorObservedAtUtc = pinnedOperatorObservedAtUtc(
    process.cwd(),
    args.inventoryDate,
  );
  const operatorRootAbs = resolveOperatorRoot();
  const hits = inventoryDailyScreenshots({
    operatorRootAbs,
    inventoryDate: args.inventoryDate,
  });
  const ambiguous = listAmbiguousDuplicateRoundDirectories(operatorRootAbs);
  const footballSchedule = loadFootballScheduleIfPresent(
    process.cwd(),
    args.inventoryDate,
  );
  const mlbSchedule = loadMlbScheduleIfPresent(process.cwd(), args.inventoryDate);
  const ocrImages: Array<{
    sourceFile: string;
    sourceSha256: string;
    ocrStatus: string;
    lineCount: number;
    lines: OcrGeometryLineV1[];
  }> = [];
  const rows: StructuredOddsRowV1[] = [];
  let ocrStatus:
    | "WINDOWS_MEDIA_OCR_LOCAL"
    | "WINDOWS_MEDIA_OCR_LOCAL_REPLAY"
    | "OCR_UNAVAILABLE" = "WINDOWS_MEDIA_OCR_LOCAL";

  if (args.fromGeometry) {
    const geoAbs = path.resolve(process.cwd(), args.fromGeometry);
    const geo = JSON.parse(readFileSync(geoAbs, "utf8")) as {
      images?: Array<{
        sourceFile: string;
        sourceSha256: string;
        ocrStatus?: string;
        lines: OcrGeometryLineV1[];
      }>;
    };
    const byFile = new Map(
      (geo.images ?? []).map((image) => [image.sourceFile, image]),
    );
    ocrStatus = "WINDOWS_MEDIA_OCR_LOCAL_REPLAY";
    for (const hit of hits) {
      const image = byFile.get(hit.sourceFileName);
      if (!image) continue;
      const st = await stat(hit.absPath);
      const parseInput = {
        operatingDateKst: args.inventoryDate,
        claimedRound: hit.round,
        sourceFile: hit.sourceFileName,
        sourceSha256: image.sourceSha256,
        fileMtimeUtc: new Date(st.mtimeMs).toISOString(),
        operatorObservedAtUtc,
        sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL" as const,
        lines: image.lines,
      };
      const parsed = parseOcrImageToRows(parseInput);
      const parsedAgain = parseOcrImageToRows(parseInput);
      if (sha256Text(canonicalJson(parsed)) !== sha256Text(canonicalJson(parsedAgain))) {
        throw new Error(`NON_IDEMPOTENT_OCR_PARSE:${hit.sourceFileName}`);
      }
      ocrImages.push({
        sourceFile: hit.sourceFileName,
        sourceSha256: image.sourceSha256,
        ocrStatus: image.ocrStatus ?? "OCR_OK",
        lineCount: image.lines.length,
        lines: image.lines,
      });
      for (const row of parsed) {
        rows.push(joinStructuredOddsRow(row, { footballSchedule, mlbSchedule }));
      }
    }
  } else {
    const audit = await auditLocalOcrCapabilities();
    const provider = tryCreateWindowsMediaOcrProvider(audit.windowsMediaOcr);
    if (!provider) {
      const payload = {
        schemaVersion: DOMESTIC_ODDS_PROMOTION_SCHEMA,
        operatingDateKst: args.inventoryDate,
        roundIdentityStatus: ROUND_IDENTITY_UNCERTAIN,
        OCR_STATUS: "OCR_UNAVAILABLE",
        screenshotsDiscovered: hits.length,
        ambiguousDuplicateRoundDirectories: ambiguous,
        windowsMediaOcr: audit.windowsMediaOcr,
        tesseract: audit.tesseract,
        networkUsed: audit.networkUsed,
        rows: [],
      };
      const outRel = `data/audits/${args.inventoryDate}-domestic-odds-promotion-v1.json`;
      await writeJsonAtomic(path.join(process.cwd(), outRel), payload);
      if (args.json) console.log(JSON.stringify({ ...payload, outRel }, null, 2));
      else console.log("OCR_UNAVAILABLE");
      return;
    }
    for (const hit of hits) {
      const sourceSha256 = await sha256FileBytes(hit.absPath);
      const st = await stat(hit.absPath);
      const extracted = await provider.extract(hit.absPath);
      const lines: OcrGeometryLineV1[] = extracted.rawLines.map((line) => ({
        text: line.text,
        boundingBox: line.boundingBox ?? null,
      }));
      const parseInput = {
        operatingDateKst: args.inventoryDate,
        claimedRound: hit.round,
        sourceFile: hit.sourceFileName,
        sourceSha256,
        fileMtimeUtc: new Date(st.mtimeMs).toISOString(),
        operatorObservedAtUtc,
        sourceProvenance: "WINDOWS_MEDIA_OCR_LOCAL" as const,
        lines,
      };
      const parsed = parseOcrImageToRows(parseInput);
      const parsedAgain = parseOcrImageToRows(parseInput);
      if (sha256Text(canonicalJson(parsed)) !== sha256Text(canonicalJson(parsedAgain))) {
        throw new Error(`NON_IDEMPOTENT_OCR_PARSE:${hit.sourceFileName}`);
      }
      ocrImages.push({
        sourceFile: hit.sourceFileName,
        sourceSha256,
        ocrStatus: extracted.rawText.trim() ? "OCR_OK" : "OCR_EMPTY",
        lineCount: lines.length,
        lines,
      });
      for (const row of parsed) {
        rows.push(joinStructuredOddsRow(row, { footballSchedule, mlbSchedule }));
      }
    }
  }

  const counts = countJoin(rows);
  const document = {
    schemaVersion: DOMESTIC_ODDS_PROMOTION_SCHEMA,
    operatingDateKst: args.inventoryDate,
    roundIdentityStatus: ROUND_IDENTITY_UNCERTAIN,
    claimedRoundFromFolder: hits[0]?.round ?? null,
    roundEvidence:
      "No visible round header on screenshots. Folder claim 108 is insufficient.",
    OCR_STATUS: ocrStatus,
    OCR_LINE_ORDER_USED_AS_ROW_STRUCTURE: false,
    screenshotsDiscovered: hits.length,
    ambiguousDuplicateRoundDirectories: ambiguous,
    footballSchedulePresent: footballSchedule != null,
    mlbSchedulePresent: mlbSchedule != null,
    scheduleRecovery: {
      footballArtifactRel: footballScheduleV1Rel(args.inventoryDate),
      mlbArtifactRel: mlbScheduleArtifactRel(args.inventoryDate),
      footballPresent: footballSchedule != null,
      mlbPresent: mlbSchedule != null,
      kboDateParametricPregameBuilder: false,
      footballV31CrossWorktreeImport: "NO_EXISTING_CONTRACT_NOT_CREATED",
      usedFor: "FIXTURE_IDENTITY_ONLY",
      importedFootballForwardPredictions: false,
    },
    networkUsedDuringOcr: false,
    MODEL_INPUT_ALLOWED: false,
    PREDICTION_INPUT_ALLOWED: false,
    ENGINE_INPUT_ALLOWED: false,
    counts,
    ocrImages: ocrImages.map(({ lines: _lines, ...rest }) => rest),
    rows,
  };
  const structuredRel = `data/audits/${args.inventoryDate}-domestic-odds-structured-v1.json`;
  const joinRel = `data/audits/${args.inventoryDate}-domestic-odds-join-v1.json`;
  const temporalRel = `data/audits/${args.inventoryDate}-domestic-odds-temporal-v1.json`;
  const geometryRel = `data/audits/${args.inventoryDate}-domestic-odds-ocr-geometry-v1.json`;
  const promotionRel = `data/audits/${args.inventoryDate}-domestic-odds-promotion-v1.json`;
  await writeJsonAtomic(path.join(process.cwd(), geometryRel), {
    schemaVersion: DOMESTIC_ODDS_PROMOTION_SCHEMA,
    operatingDateKst: args.inventoryDate,
    OCR_LINE_ORDER_USED_AS_ROW_STRUCTURE: false,
    images: ocrImages,
  });
  await writeJsonAtomic(path.join(process.cwd(), structuredRel), {
    schemaVersion: DOMESTIC_ODDS_PROMOTION_SCHEMA,
    operatingDateKst: args.inventoryDate,
    rows,
  });
  await writeJsonAtomic(path.join(process.cwd(), joinRel), {
    schemaVersion: DOMESTIC_ODDS_PROMOTION_SCHEMA,
    operatingDateKst: args.inventoryDate,
    footballSchedulePresent: footballSchedule != null,
    mlbSchedulePresent: mlbSchedule != null,
    counts,
    rows: rows.map((row) => ({
      boardGameNumber: row.boardGameNumber,
      competitionRawLabel: row.competitionRawLabel,
      homeRawName: row.homeRawName,
      awayRawName: row.awayRawName,
      joinStatus: row.joinStatus,
      canonicalFixtureId: row.canonicalFixtureId,
      predictionInputAllowed: row.predictionInputAllowed,
      rejectionReason: row.rejectionReason,
    })),
  });
  await writeJsonAtomic(path.join(process.cwd(), temporalRel), {
    schemaVersion: DOMESTIC_ODDS_PROMOTION_SCHEMA,
    operatingDateKst: args.inventoryDate,
    policy: {
      FILE_MTIME: "DESCRIPTIVE_ONLY",
      SCREEN_VISIBLE_TIME: "SCHEDULE_LABEL_NOT_CAPTURE",
      OPERATOR_OBSERVED_TIME: operatorObservedAtUtc,
      VERIFIED_PROVIDER_TIME: null,
      filenameTimestampIsNotCapture: true,
      screenPregameLabelIsNotVerifiedPregame: true,
    },
    rows: rows.map((row) => ({
      boardGameNumber: row.boardGameNumber,
      fileMtimeUtc: row.fileMtimeUtc,
      filenameTimestampCandidateKst: row.filenameTimestampCandidateKst,
      displayedStartKst: row.displayedStartKst,
      screenVisibleStatusLabel: row.screenVisibleStatusLabel,
      verifiedCaptureTime: row.verifiedCaptureTime,
      verifiedProviderTime: row.verifiedProviderTime,
    })),
  });
  const promotionAbs = path.join(process.cwd(), promotionRel);
  await writeJsonAtomic(promotionAbs, document);
  const promotionSha = sha256Text(await readFile(promotionAbs, "utf8"));
  const summary = {
    action: "promote-domestic-odds-v1",
    operatingDateKst: args.inventoryDate,
    screenshotsDiscovered: hits.length,
    ...counts,
    promotionRel,
    promotionSha,
    structuredRel,
    joinRel,
    temporalRel,
    geometryRel,
    OCR_STATUS: document.OCR_STATUS,
    roundIdentityStatus: ROUND_IDENTITY_UNCERTAIN,
  };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else console.log(`screenshots=${hits.length} extracted=${counts.extractedRows}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
