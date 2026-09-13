/**
 * 2026-09-13 domestic odds OCR extraction v2.
 * Does not rewrite V1 artifacts. Local crop OCR only.
 *
 *   npm run extract:domestic-odds-ocr-v2 -- --inventory-date 2026-09-13 --json
 *   npm run extract:domestic-odds-ocr-v2 -- --inventory-date 2026-09-13 --diagnostic-only --json
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  inventoryDailyScreenshots,
  listAmbiguousDuplicateRoundDirectories,
} from "../src/lib/proto-round-daily-odds-intake-v0";
import {
  resolveOperatorRoot,
  sha256FileBytes,
} from "../src/lib/proto-round-screenshot-intake-v1";
import { createWindowsCropOcrProviderV2 } from "../src/lib/proto-round-ocr-recovery-experiment-v2/windows-crop-ocr";
import {
  loadFootballScheduleIfPresent,
  loadMlbScheduleIfPresent,
} from "../src/lib/domestic-odds-promotion-v1";
import {
  assembleBoardRow,
  buildMatchupEntities,
  canonicalJson,
  countUniqueMatchups,
  diagnoseV1Lines,
  DOMESTIC_ODDS_OCR_EXTRACTION_V2_SCHEMA,
  headerHasRoundEvidence,
  joinAssembledRowV2,
  pngDimensions,
  planImageCrops,
  ROUND_IDENTITY_UNCERTAIN,
  sha256Text,
  V1_GEOMETRY_REL,
  type AssembledBoardRowV2,
  type GeometryLineV2,
  type OcrPassEvidenceV2,
  type PixelBoxV2,
} from "../src/lib/domestic-odds-ocr-extraction-v2";

function parseArgs(argv: string[]) {
  let inventoryDate: string | null = null;
  let json = false;
  let diagnosticOnly = false;
  let fromStructured = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--from-structured") {
      fromStructured = true;
      continue;
    }
    if (a === "--diagnostic-only") {
      diagnosticOnly = true;
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
  if (!inventoryDate) throw new Error("Specify --inventory-date");
  return { inventoryDate, json, diagnosticOnly, fromStructured };
}

async function writeJsonAtomic(abs: string, value: unknown): Promise<void> {
  if (abs.includes("domestic-odds-") && abs.includes("-v1.json")) {
    throw new Error("V1_ARTIFACT_IMMUTABLE");
  }
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

function pinnedObservedAt(cwd: string, date: string): string {
  const intake = path.join(
    cwd,
    `data/audits/${date}-round-108-domestic-odds-intake-v1.json`,
  );
  if (!existsSync(intake)) return "2026-09-13T08:22:37.608Z";
  const parsed = JSON.parse(readFileSync(intake, "utf8")) as {
    intakeObservedAt?: unknown;
  };
  return typeof parsed.intakeObservedAt === "string"
    ? parsed.intakeObservedAt
    : "2026-09-13T08:22:37.608Z";
}

async function cropText(
  provider: ReturnType<typeof createWindowsCropOcrProviderV2>,
  imagePath: string,
  crop: PixelBoxV2,
): Promise<string> {
  try {
    const extracted = await provider.extractCrop({
      imagePath,
      crop,
      scale: 3,
      language: "ko",
    });
    return extracted.rawText.trim();
  } catch {
    return "";
  }
}

function v1LinesOf(
  geometry: {
    images: Array<{ sourceFile: string; lines: GeometryLineV2[] }>;
  },
  sourceFile: string,
): GeometryLineV2[] {
  return geometry.images.find((img) => img.sourceFile === sourceFile)?.lines ?? [];
}

async function writeDerivedArtifacts(input: {
  cwd: string;
  date: string;
  rows: AssembledBoardRowV2[];
  diagnostics: ReturnType<typeof diagnoseV1Lines>;
  ambiguous: unknown;
  footballPresent: boolean;
  mlbPresent: boolean;
  operatorObservedAtUtc: string;
  ocrStatus: string;
  diagnosticOnly: boolean;
  screenshots: number;
  roundVerified: boolean;
  headerTexts: string[];
  plannedCrops: unknown[];
  cellExtractions: unknown[];
  skipCellRewrite: boolean;
  json: boolean;
}): Promise<void> {
  const entities = buildMatchupEntities(input.rows);
  const unique = countUniqueMatchups(entities);
  const targetDateRows = input.rows.filter((r) => r.targetDateKst === input.date);
  const targetDateEntities = entities.filter(
    (e) => e.mergeStatus === "LINKED" && e.targetDateKst === input.date,
  );
  const oddsVerifiedRows = input.rows.filter((r) =>
    r.oddsFields.some((f) => f.verificationStatus === "ODDS_VERIFIED"),
  );
  const oddsCandidateRows = input.rows.filter((r) =>
    r.oddsFields.some((f) => f.verificationStatus === "ODDS_CANDIDATE_UNVERIFIED"),
  );
  const oddsUnreadableRows = input.rows.filter((r) =>
    r.oddsFields.every((f) => f.verificationStatus === "ODDS_UNREADABLE"),
  );
  const fullTeamPairs = input.rows.filter(
    (r) => r.homeStatus === "TEAM_TEXT_VERIFIED" && r.awayStatus === "TEAM_TEXT_VERIFIED",
  );
  const counts = {
    screenshots: input.screenshots,
    totalBoardRows: input.rows.length,
    uniqueMatchups: unique.uniqueMatchups,
    targetDateBoardRows: targetDateRows.length,
    targetDateUniqueMatchups: targetDateEntities.length,
    dateParsed: input.rows.filter((r) => r.targetDateKst != null).length,
    oddsCandidateRows: oddsCandidateRows.length,
    oddsVerifiedRows: oddsVerifiedRows.length,
    oddsUnreadableRows: oddsUnreadableRows.length,
    fullTeamPairRecovered: fullTeamPairs.length,
    scheduleMatched: input.rows.filter((r) => r.joinStatus === "SCHEDULE_MATCHED").length,
    identityReview: input.rows.filter((r) => r.joinStatus === "IDENTITY_REVIEW_REQUIRED").length,
    competitionReview: input.rows.filter((r) => r.joinStatus === "COMPETITION_REVIEW_REQUIRED").length,
    excludedNonTargetDate: input.rows.filter((r) => r.joinStatus === "EXCLUDED_NON_TARGET_DATE").length,
    predictionEligible: 0,
    predictionRejected: input.rows.length,
  };

  const diagnosticRel = `data/audits/${input.date}-domestic-odds-ocr-diagnostics-v2.json`;
  const cellRel = `data/audits/${input.date}-domestic-odds-cell-extraction-v2.json`;
  const structuredRel = `data/audits/${input.date}-domestic-odds-structured-v2.json`;
  const matchupRel = `data/audits/${input.date}-domestic-odds-matchup-entities-v2.json`;
  const joinRel = `data/audits/${input.date}-domestic-odds-join-v2.json`;
  const temporalRel = `data/audits/${input.date}-domestic-odds-temporal-v2.json`;
  const umbrellaRel = `data/audits/${input.date}-domestic-odds-extraction-v2.json`;

  if (!input.skipCellRewrite) {
    await writeJsonAtomic(path.join(input.cwd, diagnosticRel), {
      schemaVersion: DOMESTIC_ODDS_OCR_EXTRACTION_V2_SCHEMA,
      v1GeometryRel: V1_GEOMETRY_REL,
      v1Immutable: true,
      familyCounts: input.diagnostics.familyCounts,
      samples: input.diagnostics.samples,
      tokenCount: input.diagnostics.tokenCount,
    });
    await writeJsonAtomic(path.join(input.cwd, cellRel), {
      schemaVersion: DOMESTIC_ODDS_OCR_EXTRACTION_V2_SCHEMA,
      diagnosticOnly: input.diagnosticOnly,
      plannedCrops: input.plannedCrops,
      headerTexts: input.headerTexts,
      cells: input.cellExtractions,
    });
    await writeJsonAtomic(path.join(input.cwd, structuredRel), {
      schemaVersion: DOMESTIC_ODDS_OCR_EXTRACTION_V2_SCHEMA,
      operatingDateKst: input.date,
      rows: input.rows,
    });
  }
  await writeJsonAtomic(path.join(input.cwd, matchupRel), {
    schemaVersion: DOMESTIC_ODDS_OCR_EXTRACTION_V2_SCHEMA,
    ...unique,
    targetDateUniqueMatchups: targetDateEntities.length,
    entities,
  });
  await writeJsonAtomic(path.join(input.cwd, joinRel), {
    schemaVersion: DOMESTIC_ODDS_OCR_EXTRACTION_V2_SCHEMA,
    footballSchedulePresent: input.footballPresent,
    mlbSchedulePresent: input.mlbPresent,
    rows: input.rows.map((row) => ({
      boardGameNumber: row.boardGameNumber,
      homeRawName: row.homeRawName,
      awayRawName: row.awayRawName,
      homeStatus: row.homeStatus,
      awayStatus: row.awayStatus,
      joinStatus: row.joinStatus,
      canonicalFixtureId: row.canonicalFixtureId,
      predictionInputAllowed: row.predictionInputAllowed,
    })),
  });
  await writeJsonAtomic(path.join(input.cwd, temporalRel), {
    schemaVersion: DOMESTIC_ODDS_OCR_EXTRACTION_V2_SCHEMA,
    policy: {
      FILE_MTIME: "DESCRIPTIVE_ONLY",
      VERIFIED_PROVIDER_TIME: null,
      screenPregameLabelIsNotVerifiedPregame: true,
    },
    operatorObservedAtUtc: input.operatorObservedAtUtc,
    roundIdentityStatus: ROUND_IDENTITY_UNCERTAIN,
    sourceRoundClaim: 108,
    roundVerified: input.roundVerified,
  });
  const umbrella = {
    schemaVersion: DOMESTIC_ODDS_OCR_EXTRACTION_V2_SCHEMA,
    operatingDateKst: input.date,
    OCR_STATUS: input.ocrStatus,
    networkUsedDuringOcr: false,
    ambiguousDuplicateRoundDirectories: input.ambiguous,
    roundIdentityStatus: ROUND_IDENTITY_UNCERTAIN,
    sourceRoundClaim: 108,
    roundVerified: input.roundVerified,
    MODEL_INPUT_ALLOWED: false,
    PREDICTION_INPUT_ALLOWED: false,
    counts,
  };
  await writeJsonAtomic(path.join(input.cwd, umbrellaRel), umbrella);
  const summary = {
    action: "extract-domestic-odds-ocr-v2",
    ...counts,
    umbrellaRel,
    umbrellaSha: sha256Text(await readFile(path.join(input.cwd, umbrellaRel), "utf8")),
    diagnosticRel,
    cellRel,
    structuredRel,
    matchupRel,
    joinRel,
    temporalRel,
    roundVerified: input.roundVerified,
  };
  if (input.json) console.log(JSON.stringify(summary, null, 2));
  else console.log(`boards=${counts.totalBoardRows} verifiedOdds=${counts.oddsVerifiedRows}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const v1GeometryAbs = path.join(cwd, V1_GEOMETRY_REL);
  if (!existsSync(v1GeometryAbs)) throw new Error("V1_GEOMETRY_MISSING");
  const v1Geometry = JSON.parse(readFileSync(v1GeometryAbs, "utf8")) as {
    images: Array<{ sourceFile: string; sourceSha256: string; lines: GeometryLineV2[] }>;
  };
  const operatorObservedAtUtc = pinnedObservedAt(cwd, args.inventoryDate);
  const operatorRootAbs = resolveOperatorRoot();
  const hits = inventoryDailyScreenshots({
    operatorRootAbs,
    inventoryDate: args.inventoryDate,
  });
  const ambiguous = listAmbiguousDuplicateRoundDirectories(operatorRootAbs);
  const footballSchedule = loadFootballScheduleIfPresent(cwd, args.inventoryDate);
  const mlbSchedule = loadMlbScheduleIfPresent(cwd, args.inventoryDate);
  const allLines = v1Geometry.images.flatMap((img) => img.lines);
  const diagnostics = diagnoseV1Lines(allLines);

  const structuredRel = `data/audits/${args.inventoryDate}-domestic-odds-structured-v2.json`;
  if (args.fromStructured) {
    const loaded = JSON.parse(
      readFileSync(path.join(cwd, structuredRel), "utf8"),
    ) as { rows: AssembledBoardRowV2[] };
    const temporalAbs = path.join(
      cwd,
      `data/audits/${args.inventoryDate}-domestic-odds-temporal-v2.json`,
    );
    const priorTemporal = existsSync(temporalAbs)
      ? (JSON.parse(readFileSync(temporalAbs, "utf8")) as { roundVerified?: unknown })
      : null;
    await writeDerivedArtifacts({
      cwd,
      date: args.inventoryDate,
      rows: loaded.rows,
      diagnostics,
      ambiguous,
      footballPresent: footballSchedule != null,
      mlbPresent: mlbSchedule != null,
      operatorObservedAtUtc,
      ocrStatus: "WINDOWS_MEDIA_OCR_CROP_V2",
      diagnosticOnly: false,
      screenshots: hits.length,
      roundVerified: priorTemporal?.roundVerified === true,
      headerTexts: [],
      plannedCrops: [],
      cellExtractions: [],
      skipCellRewrite: true,
      json: args.json,
    });
    return;
  }

  const provider = args.diagnosticOnly ? null : createWindowsCropOcrProviderV2();
  const rows: AssembledBoardRowV2[] = [];
  const cellExtractions: unknown[] = [];
  const headerTexts: string[] = [];
  const plannedCrops: unknown[] = [];

  for (const hit of hits) {
    const lines = v1LinesOf(v1Geometry, hit.sourceFileName);
    const bytes = readFileSync(hit.absPath);
    const dims = pngDimensions(bytes);
    if (!dims) continue;
    const st = await stat(hit.absPath);
    const sourceSha256 = await sha256FileBytes(hit.absPath);
    const planned = planImageCrops({
      sourceFile: hit.sourceFileName,
      lines,
      imageWidth: dims.width,
      imageHeight: dims.height,
    });
    plannedCrops.push({
      sourceFile: hit.sourceFileName,
      imageWidth: planned.imageWidth,
      imageHeight: planned.imageHeight,
      columnBands: planned.columnBands,
      header: planned.header,
      cells: planned.cells,
    });
    if (planned.header && provider) {
      headerTexts.push(await cropText(provider, hit.absPath, planned.header));
    } else if (planned.header) {
      headerTexts.push(
        tokensInBoxSafe(lines, planned.header).map((t) => t.text).join(" "),
      );
    }
    const byBoard = new Map<string, typeof planned.cells>();
    for (const cell of planned.cells) {
      const list = byBoard.get(cell.board) ?? [];
      list.push(cell);
      byBoard.set(cell.board, list);
    }
    for (const [board, cells] of byBoard) {
      const dateCell = cells.find((c) => c.column === "DATE");
      const teamCell = cells.find((c) => c.column === "TEAM");
      const oddsCell = cells.find((c) => c.column === "ODDS");
      const datePasses: OcrPassEvidenceV2[] = [
        { pass: "BASELINE_V1", rawText: dateCell?.baselineText ?? "" },
      ];
      const teamPasses: OcrPassEvidenceV2[] = [
        { pass: "BASELINE_V1", rawText: teamCell?.baselineText ?? "" },
      ];
      const oddsPasses: OcrPassEvidenceV2[] = [
        { pass: "BASELINE_V1", rawText: oddsCell?.baselineText ?? "" },
      ];
      if (provider) {
        if (dateCell) {
          datePasses.push({
            pass: "KO_SCALE3_CROP",
            rawText: await cropText(provider, hit.absPath, dateCell.crop),
          });
        }
        if (teamCell) {
          teamPasses.push({
            pass: "KO_SCALE3_CROP",
            rawText: await cropText(provider, hit.absPath, teamCell.crop),
          });
        }
        if (oddsCell) {
          oddsPasses.push({
            pass: "KO_SCALE3_CROP",
            rawText: await cropText(provider, hit.absPath, oddsCell.crop),
          });
        }
      }
      cellExtractions.push({
        sourceFile: hit.sourceFileName,
        board,
        datePasses,
        teamPasses,
        oddsPasses,
        crops: {
          date: dateCell?.crop ?? null,
          team: teamCell?.crop ?? null,
          odds: oddsCell?.crop ?? null,
        },
      });
      const assembled = assembleBoardRow({
        operatingDateKst: args.inventoryDate,
        sourceFile: hit.sourceFileName,
        sourceSha256,
        fileMtimeUtc: new Date(st.mtimeMs).toISOString(),
        operatorObservedAtUtc,
        board,
        datePasses,
        teamPasses,
        oddsPasses,
      });
      rows.push(joinAssembledRowV2(assembled, { footballSchedule, mlbSchedule }));
    }
  }

  await writeDerivedArtifacts({
    cwd,
    date: args.inventoryDate,
    rows,
    diagnostics,
    ambiguous,
    footballPresent: footballSchedule != null,
    mlbPresent: mlbSchedule != null,
    operatorObservedAtUtc,
    ocrStatus: args.diagnosticOnly ? "V1_GEOMETRY_REPLAY" : "WINDOWS_MEDIA_OCR_CROP_V2",
    diagnosticOnly: args.diagnosticOnly,
    screenshots: hits.length,
    roundVerified: headerHasRoundEvidence(headerTexts),
    headerTexts,
    plannedCrops,
    cellExtractions,
    skipCellRewrite: false,
    json: args.json,
  });
}

function tokensInBoxSafe(
  lines: GeometryLineV2[],
  box: PixelBoxV2,
): GeometryLineV2[] {
  return lines.filter((line) => {
    if (!line.boundingBox) return false;
    const cx = line.boundingBox.x + line.boundingBox.width / 2;
    const cy = line.boundingBox.y + line.boundingBox.height / 2;
    return (
      cx >= box.x &&
      cx <= box.x + box.width &&
      cy >= box.y &&
      cy <= box.y + box.height
    );
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
