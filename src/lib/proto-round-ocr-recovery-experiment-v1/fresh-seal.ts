import { createHash } from "node:crypto";
import {
  FRESH_VALIDATION_PURPOSE,
  FRESH_VALIDATION_SEAL_SCHEMA_VERSION,
  type FreshUnseenReportV1,
  type FreshValidationImageV1,
  type FreshValidationSealV1,
} from "./types";

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function identifyFreshUnseenImages(input: {
  canonicalImages: Array<{ sha256: string; fileName: string }>;
  firstShotSourceImages: Array<{
    sourceImageSha256: string;
    sourceFileName: string;
  }>;
}): FreshUnseenReportV1 {
  const firstShot = new Set(
    input.firstShotSourceImages.map((img) => img.sourceImageSha256),
  );
  const images: FreshValidationImageV1[] = [];
  for (const img of input.canonicalImages) {
    if (firstShot.has(img.sha256)) continue;
    images.push({
      sourceFileName: img.fileName,
      sourceImageSha256: img.sha256,
    });
  }
  images.sort((a, b) => {
    if (a.sourceImageSha256 < b.sourceImageSha256) return -1;
    if (a.sourceImageSha256 > b.sourceImageSha256) return 1;
    return a.sourceFileName < b.sourceFileName ? -1 : 1;
  });
  return {
    freshUnseenImageCount: images.length,
    freshUnseenImageSha256: images.map((i) => i.sourceImageSha256),
    freshUnseenFileNames: images.map((i) => i.sourceFileName),
    images,
  };
}

export function buildFreshValidationSeal(input: {
  protoRoundKey: string;
  createdFromIntakeManifest: string;
  images: FreshValidationImageV1[];
}): FreshValidationSealV1 {
  return {
    schemaVersion: FRESH_VALIDATION_SEAL_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    createdFromIntakeManifest: input.createdFromIntakeManifest,
    imageCount: input.images.length,
    images: input.images.map((img) => ({
      sourceFileName: img.sourceFileName,
      sourceImageSha256: img.sourceImageSha256,
    })),
    purpose: FRESH_VALIDATION_PURPOSE,
    visualContentUsedForRuleDesign: false,
    ocrUsedForRuleDesign: false,
    groundTruthCreated: false,
    OPEN_FOR_VISUAL_RULE_DESIGN: false,
    OCR_FOR_RULE_DESIGN: false,
    GROUND_TRUTH_CREATED: false,
  };
}
