/**
 * Proto OCR Adapter contract + fixture / not-configured adapters.
 * Gate: OCR_ENGINE_NOT_CONFIGURED — no paid/local Korean OCR dependency installed.
 */
import { createHash, randomUUID } from "node:crypto";
import type {
  ProtoOcrExecutionMode,
  ProtoOcrImageInput,
  ProtoOcrRawResult,
  ProtoOcrTextBlock,
} from "./types";
import { readImageDimensions } from "./image-validation";

export interface ProtoOcrAdapter {
  readonly providerName: string;
  readonly executionMode: ProtoOcrExecutionMode;
  readonly supportedLanguages: string[];
  readonly externalImageTransfer: boolean;

  extract(input: {
    images: ProtoOcrImageInput[];
    /** Test-only / paste path: inject raw text per imageId */
    fixtureTexts?: Record<string, string>;
  }): Promise<ProtoOcrRawResult>;
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function blocksFromText(rawText: string): ProtoOcrTextBlock[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, i) => ({
      blockId: `b${i + 1}`,
      text,
      confidence: null,
      bbox: null,
    }));
}

/** Fixture adapter — uses provided fixtureTexts; never calls network. */
export class FixtureProtoOcrAdapter implements ProtoOcrAdapter {
  readonly providerName = "FIXTURE";
  readonly executionMode = "FIXTURE" as const;
  readonly supportedLanguages = ["ko", "en"];
  readonly externalImageTransfer = false;

  async extract(input: {
    images: ProtoOcrImageInput[];
    fixtureTexts?: Record<string, string>;
  }): Promise<ProtoOcrRawResult> {
    const started = Date.now();
    const images = input.images.map((img) => {
      const dims = readImageDimensions(img.bytes, img.mimeType);
      const rawText = input.fixtureTexts?.[img.imageId] ?? "";
      const warnings: string[] = [];
      if (!rawText.trim()) warnings.push("NO_TEXT_DETECTED");
      return {
        imageId: img.imageId,
        imageSha256: sha256Bytes(img.bytes),
        width: dims.width,
        height: dims.height,
        rawText,
        rawConfidence: rawText.trim() ? 1 : null,
        blocks: blocksFromText(rawText),
        warnings,
      };
    });
    return {
      ocrRunId: `ocr-${randomUUID()}`,
      providerName: this.providerName,
      executionMode: this.executionMode,
      extractedAt: new Date().toISOString(),
      images,
      durationMs: Date.now() - started,
      warnings: [],
    };
  }
}

/**
 * Default production adapter when no OCR engine is configured.
 * Validates that images were received but does not invent text.
 */
export class NotConfiguredProtoOcrAdapter implements ProtoOcrAdapter {
  readonly providerName = "NONE";
  readonly executionMode = "LOCAL" as const;
  readonly supportedLanguages = [];
  readonly externalImageTransfer = false;

  async extract(input: {
    images: ProtoOcrImageInput[];
    fixtureTexts?: Record<string, string>;
  }): Promise<ProtoOcrRawResult> {
    // If fixture texts provided (tests), delegate
    if (input.fixtureTexts && Object.keys(input.fixtureTexts).length > 0) {
      return new FixtureProtoOcrAdapter().extract(input);
    }
    const started = Date.now();
    const images = input.images.map((img) => {
      const dims = readImageDimensions(img.bytes, img.mimeType);
      return {
        imageId: img.imageId,
        imageSha256: sha256Bytes(img.bytes),
        width: dims.width,
        height: dims.height,
        rawText: "",
        rawConfidence: null,
        blocks: [] as ProtoOcrTextBlock[],
        warnings: ["OCR_ENGINE_NOT_CONFIGURED"],
      };
    });
    return {
      ocrRunId: `ocr-${randomUUID()}`,
      providerName: this.providerName,
      executionMode: this.executionMode,
      extractedAt: new Date().toISOString(),
      images,
      durationMs: Date.now() - started,
      warnings: ["OCR_ENGINE_NOT_CONFIGURED"],
      errorCode: "OCR_ENGINE_NOT_CONFIGURED",
    };
  }
}

export function createDefaultProtoOcrAdapter(
  env: NodeJS.ProcessEnv = process.env,
): ProtoOcrAdapter {
  const mode = env.KBO_PROTO_OCR_MODE?.trim().toUpperCase();
  if (mode === "FIXTURE") return new FixtureProtoOcrAdapter();
  return new NotConfiguredProtoOcrAdapter();
}
