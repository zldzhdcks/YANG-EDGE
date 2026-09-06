import type { PhysicalFileRecordV1 } from "../proto-round-screenshot-intake-v1/types";

export class VisualRowsLineageError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "VisualRowsLineageError";
    this.code = code;
  }
}

export type VisualRowsLineageManifestInput = {
  meta: {
    protoRoundKey: string;
    year: number;
    round: number;
  };
  files: Array<
    Pick<PhysicalFileRecordV1, "fileStatus" | "extractionEligible" | "sha256">
  >;
};

export type VisualRowsLineageOcrInput = {
  meta: {
    protoRoundKey: string;
    year: number;
    round: number;
    sourceCanonicalImages: number;
  };
  images: Array<{ sourceImageSha256: string }>;
};

export function expectedCanonicalEligibleSha256Set(
  files: VisualRowsLineageManifestInput["files"],
): Set<string> {
  const set = new Set<string>();
  for (const f of files) {
    if (f.fileStatus === "CANONICAL_IMAGE" && f.extractionEligible === true) {
      set.add(f.sha256);
    }
  }
  return set;
}

function shaSetFromOcrImages(
  images: VisualRowsLineageOcrInput["images"],
): { set: Set<string>; duplicate: boolean } {
  const set = new Set<string>();
  let duplicate = false;
  for (const img of images) {
    if (set.has(img.sourceImageSha256)) duplicate = true;
    else set.add(img.sourceImageSha256);
  }
  return { set, duplicate };
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

/**
 * Fail-closed OCR ↔ intake lineage check.
 * Expected source set = CANONICAL_IMAGE AND extractionEligible.
 * OCR SHA set must equal that set exactly. No hardcoded image count.
 */
export function assertOcrSourceLineageMatchesExpected(input: {
  manifest: VisualRowsLineageManifestInput;
  ocr: VisualRowsLineageOcrInput;
}): Set<string> {
  const expected = expectedCanonicalEligibleSha256Set(input.manifest.files);
  if (expected.size === 0) {
    throw new VisualRowsLineageError("NO_CANONICAL_IMAGES_FOR_VISUAL_ROWS");
  }
  if (input.ocr.meta.protoRoundKey !== input.manifest.meta.protoRoundKey) {
    throw new VisualRowsLineageError("OCR_PROTO_ROUND_KEY_MISMATCH");
  }
  if (input.ocr.meta.year !== input.manifest.meta.year) {
    throw new VisualRowsLineageError("OCR_YEAR_MISMATCH");
  }
  if (input.ocr.meta.round !== input.manifest.meta.round) {
    throw new VisualRowsLineageError("OCR_ROUND_MISMATCH");
  }
  if (input.ocr.meta.sourceCanonicalImages !== input.ocr.images.length) {
    throw new VisualRowsLineageError("OCR_META_SOURCE_COUNT_MISMATCH");
  }

  const ocrShas = shaSetFromOcrImages(input.ocr.images);
  if (ocrShas.duplicate) {
    throw new VisualRowsLineageError("DUPLICATE_OCR_SOURCE_SHA");
  }
  for (const sha of ocrShas.set) {
    if (!expected.has(sha)) {
      throw new VisualRowsLineageError("UNKNOWN_OCR_SOURCE");
    }
  }
  for (const sha of expected) {
    if (!ocrShas.set.has(sha)) {
      throw new VisualRowsLineageError("MISSING_CANONICAL_OCR_SOURCE");
    }
  }
  if (input.ocr.images.length !== expected.size || !setsEqual(ocrShas.set, expected)) {
    throw new VisualRowsLineageError("OCR_SOURCE_COUNT_MISMATCH");
  }
  return expected;
}
