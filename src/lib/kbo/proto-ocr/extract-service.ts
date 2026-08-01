/**
 * Proto OCR extract orchestration — images or paste text → draft rows.
 * mutationPerformed always false.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import {
  createDefaultProtoOcrAdapter,
  FixtureProtoOcrAdapter,
  type ProtoOcrAdapter,
} from "./adapter";
import {
  validateProtoOcrImage,
  validateProtoOcrImageBatch,
} from "./image-validation";
import {
  cleanupEphemeralSession,
  createEphemeralOcrSession,
  writeEphemeralImage,
} from "./ephemeral";
import { parseProtoCandidatesFromOcr, parseProtoCandidatesFromText } from "./parse-candidates";
import { mapAllCandidates } from "./schedule-map";
import { mergeProtoOcrDraftRows } from "./merge-rows";
import { loadKboScheduleGames } from "./schedule-load";
import type { ProtoOcrExtractResponse, ProtoOcrImageInput } from "./types";

export { loadKboScheduleGames } from "./schedule-load";

export async function extractProtoOcrFromImages(options: {
  dateKst: string;
  files: Array<{ bytes: Uint8Array; mimeType?: string; filename?: string }>;
  fixtureTexts?: Record<string, string>;
  adapter?: ProtoOcrAdapter;
  cwd?: string;
  allowCommaAsDecimal?: boolean;
}): Promise<ProtoOcrExtractResponse> {
  const cwd = options.cwd ?? process.cwd();
  const started = Date.now();
  const warnings: string[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateKst)) {
    return {
      ok: false,
      ocrRunId: "",
      dateKst: options.dateKst,
      engineStatus: "OCR_ENGINE_NOT_CONFIGURED",
      executionMode: "LOCAL",
      externalImageTransfer: false,
      rows: [],
      unmatchedBlocks: [],
      warnings: [],
      durationMs: 0,
      imageFingerprints: [],
      mutationPerformed: false,
      errorCode: "INVALID_DATE_KST",
      message: "dateKst YYYY-MM-DD required",
    };
  }

  const batchErr = validateProtoOcrImageBatch(options.files.map((f) => f.bytes));
  if (batchErr) {
    return {
      ok: false,
      ocrRunId: "",
      dateKst: options.dateKst,
      engineStatus: "OCR_ENGINE_NOT_CONFIGURED",
      executionMode: "LOCAL",
      externalImageTransfer: false,
      rows: [],
      unmatchedBlocks: [],
      warnings: [],
      durationMs: Date.now() - started,
      imageFingerprints: [],
      mutationPerformed: false,
      errorCode: batchErr.errorCode,
      message: batchErr.message,
    };
  }

  const session = await createEphemeralOcrSession();
  const images: ProtoOcrImageInput[] = [];
  const fixtureById: Record<string, string> = {};

  try {
    for (const file of options.files) {
      const v = validateProtoOcrImage({
        bytes: file.bytes,
        declaredMime: file.mimeType,
        filename: file.filename,
      });
      if (!v.ok) {
        return {
          ok: false,
          ocrRunId: "",
          dateKst: options.dateKst,
          engineStatus: "OCR_ENGINE_NOT_CONFIGURED",
          executionMode: "LOCAL",
          externalImageTransfer: false,
          rows: [],
          unmatchedBlocks: [],
          warnings: session.warnings,
          durationMs: Date.now() - started,
          imageFingerprints: [],
          mutationPerformed: false,
          errorCode: v.errorCode,
          message: v.message,
        };
      }
      const ext =
        v.mimeType === "image/png"
          ? "png"
          : v.mimeType === "image/webp"
            ? "webp"
            : "jpg";
      const { imageId } = await writeEphemeralImage(session, file.bytes, ext);
      images.push({
        imageId,
        bytes: file.bytes,
        mimeType: v.mimeType,
        originalFilename: file.filename ?? `${imageId}.${ext}`,
      });
      if (options.fixtureTexts) {
        // Map by index order if keys are img0, img1... or by filename
        const byIndex = options.fixtureTexts[`img${images.length - 1}`];
        const byName = file.filename
          ? options.fixtureTexts[file.filename]
          : undefined;
        if (byIndex) fixtureById[imageId] = byIndex;
        if (byName) fixtureById[imageId] = byName;
      }
    }

    const adapter =
      options.adapter ??
      (Object.keys(fixtureById).length > 0
        ? new FixtureProtoOcrAdapter()
        : createDefaultProtoOcrAdapter());

    const raw = await adapter.extract({
      images,
      fixtureTexts: Object.keys(fixtureById).length ? fixtureById : undefined,
    });
    warnings.push(...raw.warnings);

    const schedule = await loadKboScheduleGames(options.dateKst, cwd);
    if (schedule.length === 0) {
      warnings.push("SCHEDULE_ARTIFACT_MISSING");
    }

    const candidates = parseProtoCandidatesFromOcr(raw, {
      allowCommaAsDecimal: options.allowCommaAsDecimal,
    });
    const mapped = mapAllCandidates(candidates, schedule, raw.ocrRunId);
    const rows = mergeProtoOcrDraftRows(mapped);

    const engineStatus =
      raw.errorCode === "OCR_ENGINE_NOT_CONFIGURED"
        ? "OCR_ENGINE_NOT_CONFIGURED"
        : adapter.executionMode === "FIXTURE"
          ? "FIXTURE"
          : "READY";

    return {
      ok: true,
      ocrRunId: raw.ocrRunId,
      dateKst: options.dateKst,
      engineStatus,
      executionMode: adapter.executionMode,
      externalImageTransfer: adapter.externalImageTransfer,
      rows,
      unmatchedBlocks: raw.images.flatMap((img) =>
        img.blocks
          .filter((b) => !candidates.some((c) => c.sourceBlockIds.includes(b.blockId)))
          .map((b) => b.text),
      ),
      warnings,
      durationMs: Date.now() - started,
      imageFingerprints: raw.images.map((i) => i.imageSha256),
      mutationPerformed: false,
      errorCode: raw.errorCode,
      message:
        engineStatus === "OCR_ENGINE_NOT_CONFIGURED"
          ? "OCR engine not configured — use paste-text fallback"
          : undefined,
    };
  } finally {
    const cleanupWarnings = await cleanupEphemeralSession(session);
    warnings.push(...cleanupWarnings);
  }
}

export async function extractProtoOcrFromPasteText(options: {
  dateKst: string;
  text: string;
  cwd?: string;
  allowCommaAsDecimal?: boolean;
  adminId?: string;
}): Promise<ProtoOcrExtractResponse> {
  const started = Date.now();
  const cwd = options.cwd ?? process.cwd();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.dateKst)) {
    return {
      ok: false,
      ocrRunId: "",
      dateKst: options.dateKst,
      engineStatus: "FIXTURE",
      executionMode: "FIXTURE",
      externalImageTransfer: false,
      rows: [],
      unmatchedBlocks: [],
      warnings: [],
      durationMs: 0,
      imageFingerprints: [],
      mutationPerformed: false,
      errorCode: "INVALID_DATE_KST",
    };
  }
  const ocrRunId = `ocr-paste-${randomUUID()}`;
  const imageId = `paste-${randomUUID()}`;
  const candidates = parseProtoCandidatesFromText({
    rawText: options.text,
    sourceImageId: imageId,
    allowCommaAsDecimal: options.allowCommaAsDecimal ?? true,
  });
  const schedule = await loadKboScheduleGames(options.dateKst, cwd);
  const warnings: string[] = [];
  if (schedule.length === 0) warnings.push("SCHEDULE_ARTIFACT_MISSING");
  if (!options.text.trim()) warnings.push("NO_TEXT_DETECTED");
  const mapped = mapAllCandidates(candidates, schedule, ocrRunId);
  const rows = mergeProtoOcrDraftRows(mapped);
  return {
    ok: true,
    ocrRunId,
    dateKst: options.dateKst,
    engineStatus: "FIXTURE",
    executionMode: "FIXTURE",
    externalImageTransfer: false,
    rows,
    unmatchedBlocks: [],
    warnings: [...warnings, "PASTE_TEXT_FALLBACK"],
    durationMs: Date.now() - started,
    imageFingerprints: [],
    mutationPerformed: false,
    message: "Parsed from pasted text (same parser as OCR)",
  };
}
