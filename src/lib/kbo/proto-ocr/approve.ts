/**
 * Approve Proto OCR rows → merge Domestic Proto into existing T45 operator input.
 * Does NOT run T45 workflow or T30.
 */
import "server-only";
import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { kboT45Paths } from "../t45-personnel/paths";
import type {
  KboT45GameInput,
  KboT45PersonnelInputV1,
} from "../t45-personnel/types";
import { validateProtoOcrDraft } from "./validate-draft";
import { loadKboScheduleGames } from "./schedule-load";
import type {
  KboProtoOcrDraftRow,
  ProtoOcrApproveResponse,
  ProtoOcrCorrection,
} from "./types";
import { PROTO_OCR_PARSER_VERSION } from "./types";

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(fp: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmp, fp);
}

function sha256Raw(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function emptySide() {
  return { starter: null, lineup: null };
}

function buildCorrections(row: KboProtoOcrDraftRow): ProtoOcrCorrection[] {
  const out = [...row.adminCorrections];
  if (row.adminDecision === "CORRECTED" || row.adminDecision === "APPROVED") {
    // record approved prices vs raw
    if (row.rawPriceTexts[0] && row.awayPrice != null) {
      out.push({
        field: "awayPrice",
        rawValue: row.rawPriceTexts[0] ?? null,
        parsedValue: row.awayPrice,
        approvedValue: row.awayPrice,
        correctionReason: row.adminDecision,
        gameId: row.gameId,
      });
    }
  }
  return out;
}

export async function approveProtoOcrDraft(options: {
  dateKst: string;
  ocrRunId: string;
  approvedRows: KboProtoOcrDraftRow[];
  adminId: string;
  sourceReference?: string;
  screenshotObservedAt?: string;
  explicitConfirmation: boolean;
  approveAll?: boolean;
  cwd?: string;
  now?: Date;
  /** Clipboard intake audit metadata (additive). */
  intakeRunId?: string | null;
  intakeItemIds?: string[];
  imageFingerprints?: string[];
  inputKind?: string | null;
  /**
   * OCR_ASSISTED only when engine produced candidates.
   * MANUAL_VISUAL_CONFIRMATION when admin typed from screenshot without OCR candidates.
   */
  extractionMethod?: "OCR_ASSISTED" | "MANUAL_VISUAL_CONFIRMATION" | "MANUAL";
}): Promise<ProtoOcrApproveResponse> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const paths = kboT45Paths(options.dateKst, cwd);

  if (!options.explicitConfirmation) {
    return {
      ok: false,
      dateKst: options.dateKst,
      pathRel: null,
      previousHash: null,
      nextHash: null,
      version: 0,
      approvedGameIds: [],
      auditPathRel: null,
      mutationPerformed: false,
      t45AutoRun: false,
      t30AutoRun: false,
      message: "Explicit confirmation checkbox required",
      errorCode: "CONFIRMATION_REQUIRED",
    };
  }

  if (options.dateKst === "2026-07-31") {
    return {
      ok: false,
      dateKst: options.dateKst,
      pathRel: null,
      previousHash: null,
      nextHash: null,
      version: 0,
      approvedGameIds: [],
      auditPathRel: null,
      mutationPerformed: false,
      t45AutoRun: false,
      t30AutoRun: false,
      message: "Historical read-only",
      errorCode: "HISTORICAL_READ_ONLY",
    };
  }

  const selected = options.approvedRows.filter(
    (r) => r.adminDecision === "APPROVED" || r.adminDecision === "CORRECTED",
  );
  if (selected.length === 0) {
    return {
      ok: false,
      dateKst: options.dateKst,
      pathRel: null,
      previousHash: null,
      nextHash: null,
      version: 0,
      approvedGameIds: [],
      auditPathRel: null,
      mutationPerformed: false,
      t45AutoRun: false,
      t30AutoRun: false,
      message: "No approved rows",
      errorCode: "NO_APPROVED_ROWS",
    };
  }

  const validation = await validateProtoOcrDraft({
    dateKst: options.dateKst,
    rows: selected,
    now,
    cwd,
  });

  if (options.approveAll) {
    const blocked = validation.rows.some((r) =>
      r.errors.some((e) =>
        ["AFTER_CUTOFF", "ALREADY_LOCKED", "HISTORICAL_READ_ONLY", "GAME_NOT_FOUND"].includes(
          e,
        ),
      ),
    );
    if (blocked || validation.globalErrors.length > 0) {
      return {
        ok: false,
        dateKst: options.dateKst,
        pathRel: null,
        previousHash: null,
        nextHash: null,
        version: 0,
        approvedGameIds: [],
        auditPathRel: null,
        mutationPerformed: false,
        t45AutoRun: false,
        t30AutoRun: false,
        message: "Approve-all failed: some rows blocked (no implicit partial save)",
        errorCode: "APPROVE_ALL_BLOCKED",
        validation,
      };
    }
  }

  const passRows = validation.rows.filter(
    (r) =>
      r.errors.length === 0 &&
      r.gameId &&
      r.homePrice != null &&
      r.awayPrice != null &&
      (r.detectedMarket ?? "MONEYLINE_2WAY") === "MONEYLINE_2WAY" &&
      r.saveAllowed !== false,
  );
  if (passRows.length === 0) {
    return {
      ok: false,
      dateKst: options.dateKst,
      pathRel: null,
      previousHash: null,
      nextHash: null,
      version: 0,
      approvedGameIds: [],
      auditPathRel: null,
      mutationPerformed: false,
      t45AutoRun: false,
      t30AutoRun: false,
      message: "No rows passed server revalidation",
      errorCode: "VALIDATION_FAILED",
      validation,
    };
  }

  // Implicit partial forbidden only for approveAll; selective approve OK
  const schedule = await loadKboScheduleGames(options.dateKst, cwd);
  const scheduleById = new Map(schedule.map((g) => [g.gameId, g]));

  let existing: KboT45PersonnelInputV1 | null = null;
  let previousHash: string | null = null;
  let version = 1;
  if (await exists(paths.personnelInput)) {
    const prevRaw = await readFile(paths.personnelInput, "utf8");
    previousHash = sha256Raw(prevRaw);
    existing = JSON.parse(prevRaw) as KboT45PersonnelInputV1;
    version = (typeof (existing as { version?: number }).version === "number"
      ? (existing as { version?: number }).version!
      : 1) + 1;
    const rev = paths.personnelInput.replace(
      /\.json$/i,
      `.rev-${now.toISOString().replace(/[:.]/g, "-")}.json`,
    );
    if (!(await exists(rev))) await copyFile(paths.personnelInput, rev);
  }

  const byId = new Map<string, KboT45GameInput>();
  if (existing?.games) {
    for (const g of existing.games) byId.set(g.gameId, { ...g });
  } else {
    for (const g of schedule) {
      byId.set(g.gameId, {
        gameId: g.gameId,
        homeTeam: g.home,
        awayTeam: g.away,
        scheduledStartTime: g.scheduledStartTime,
        observedAt: options.screenshotObservedAt || now.toISOString(),
        sourceType: "ADMIN_MANUAL_SCREENSHOT",
        sourceReference: options.sourceReference,
        home: emptySide(),
        away: emptySide(),
        domesticProto: null,
      });
    }
  }

  const extractionMethod =
    options.extractionMethod === "MANUAL_VISUAL_CONFIRMATION"
      ? "MANUAL_VISUAL_CONFIRMATION"
      : options.extractionMethod === "MANUAL"
        ? "MANUAL"
        : "OCR_ASSISTED";

  const changedFields: string[] = [];
  const corrections: ProtoOcrCorrection[] = [];
  for (const row of passRows) {
    const sched = scheduleById.get(row.gameId!);
    if (!sched) continue;
    const game =
      byId.get(row.gameId!) ??
      ({
        gameId: row.gameId!,
        homeTeam: sched.home,
        awayTeam: sched.away,
        scheduledStartTime: sched.scheduledStartTime,
        observedAt: options.screenshotObservedAt || now.toISOString(),
        sourceType: "ADMIN_MANUAL_SCREENSHOT" as const,
        home: emptySide(),
        away: emptySide(),
        domesticProto: null,
      } satisfies KboT45GameInput);

    // Preserve starter/lineup
    const prevProto = game.domesticProto;
    game.domesticProto = {
      homePrice: row.homePrice!,
      awayPrice: row.awayPrice!,
      format: "DECIMAL",
      marketType: "MONEYLINE_2WAY",
      extractionMethod:
        extractionMethod === "MANUAL_VISUAL_CONFIRMATION"
          ? "MANUAL"
          : extractionMethod === "MANUAL"
            ? "MANUAL"
            : "OCR_ASSISTED",
      ocrRunId: options.ocrRunId,
      parserVersion: PROTO_OCR_PARSER_VERSION,
      correctedByAdmin: row.adminDecision === "CORRECTED",
      observedAt: options.screenshotObservedAt || now.toISOString(),
    } as KboT45GameInput["domesticProto"];
    game.sourceType = game.sourceType ?? "ADMIN_MANUAL_SCREENSHOT";
    game.observedAt = options.screenshotObservedAt || game.observedAt || now.toISOString();
    if (
      !prevProto ||
      prevProto.homePrice !== row.homePrice ||
      prevProto.awayPrice !== row.awayPrice
    ) {
      changedFields.push(`domesticProto:${row.gameId}`);
    }
    corrections.push(...buildCorrections(row));
    byId.set(row.gameId!, game);
  }

  // Preserve game order from schedule when possible
  const orderedGames: KboT45GameInput[] = [];
  const seen = new Set<string>();
  for (const g of schedule) {
    const row = byId.get(g.gameId);
    if (row) {
      orderedGames.push(row);
      seen.add(g.gameId);
    }
  }
  for (const [id, g] of byId) {
    if (!seen.has(id)) orderedGames.push(g);
  }

  const toSave: KboT45PersonnelInputV1 & {
    version?: number;
    extractionMethod?: string;
    ocrRunId?: string;
  } = {
    schemaVersion: "kbo-t45-personnel-input-v1",
    league: "KBO",
    dateKst: options.dateKst,
    createdAt: existing?.createdAt || now.toISOString(),
    createdBy: options.adminId || existing?.createdBy || "admin-ui",
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    sourceReference: options.sourceReference ?? existing?.sourceReference,
    commercialUseStatus: "INTERNAL_ONLY",
    games: orderedGames,
    version,
    extractionMethod,
    ocrRunId: options.ocrRunId,
  };

  await writeJsonAtomic(paths.personnelInput, toSave);
  const nextRaw = `${JSON.stringify(toSave, null, 2)}\n`;
  const nextHash = sha256Raw(nextRaw);

  const auditPath = path.join(
    paths.auditsRoot,
    `${options.dateKst}-kbo-proto-ocr-admin-v1.json`,
  );
  const audit = {
    schemaVersion: "kbo-proto-ocr-admin-v1",
    auditId: `ocr-audit-${options.ocrRunId}`,
    ocrRunId: options.ocrRunId,
    dateKst: options.dateKst,
    parserVersion: PROTO_OCR_PARSER_VERSION,
    ocrProvider: "NONE_OR_FIXTURE",
    imageCount: options.imageFingerprints?.length ?? 0,
    imageFingerprints: options.imageFingerprints ?? [],
    intakeRunId: options.intakeRunId ?? null,
    intakeItemIds: options.intakeItemIds ?? [],
    inputKind: options.inputKind ?? null,
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    extractionMethod,
    confirmationMethod: "ADMIN_VERIFIED",
    commercialUseStatus: "INTERNAL_ONLY",
    extractedRows: options.approvedRows.length,
    matchedRows: passRows.filter((r) => r.gameId).length,
    ambiguousRows: options.approvedRows.filter((r) => r.mappingStatus === "AMBIGUOUS")
      .length,
    rejectedRows: options.approvedRows.filter((r) => r.adminDecision === "REJECTED")
      .length,
    approvedRows: passRows.length,
    correctedRows: passRows.filter((r) => r.adminDecision === "CORRECTED").length,
    corrections,
    confidenceDistribution: passRows.map((r) => r.confidence.grade),
    approvedOperatorInputHash: nextHash,
    previousHash,
    changedFields,
    adminId: options.adminId,
    approvedAt: now.toISOString(),
    warnings: validation.globalErrors,
    t45AutoRun: false,
    t30AutoRun: false,
  };
  await writeJsonAtomic(auditPath, audit);

  return {
    ok: true,
    dateKst: options.dateKst,
    pathRel: path.relative(cwd, paths.personnelInput).replace(/\\/g, "/"),
    previousHash,
    nextHash,
    version,
    approvedGameIds: passRows.map((r) => r.gameId!),
    auditPathRel: path.relative(cwd, auditPath).replace(/\\/g, "/"),
    mutationPerformed: true,
    t45AutoRun: false,
    t30AutoRun: false,
    message: "Domestic Proto approved into operator input (T45 not run)",
    validation,
  };
}
