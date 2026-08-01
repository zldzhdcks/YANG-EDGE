/**
 * Image validation for Proto OCR uploads (no sharp dependency).
 * Magic bytes + PNG/JPEG dimension headers. SVG/PDF/exec rejected.
 */

export const PROTO_OCR_MAX_IMAGES = 10;
export const PROTO_OCR_MAX_BYTES_PER_IMAGE = 8 * 1024 * 1024;
export const PROTO_OCR_MAX_BYTES_TOTAL = 30 * 1024 * 1024;
export const PROTO_OCR_MAX_WIDTH = 8000;
export const PROTO_OCR_MAX_HEIGHT = 8000;

export type ImageValidationOk = {
  ok: true;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
};

export type ImageValidationErr = {
  ok: false;
  errorCode:
    | "UNSUPPORTED_IMAGE"
    | "IMAGE_TOO_LARGE"
    | "IMAGE_DECODE_FAILED"
    | "MIME_SPOOF"
    | "IMAGE_TOO_MANY"
    | "IMAGE_TOTAL_TOO_LARGE"
    | "INVALID_DIMENSIONS";
  message: string;
};

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

export function detectImageMime(
  bytes: Uint8Array,
): "image/png" | "image/jpeg" | "image/webp" | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  // IHDR at offset 8+8
  if (bytes.length < 24) return null;
  const width =
    (bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!;
  const height =
    (bytes[20]! << 24) | (bytes[21]! << 16) | (bytes[22]! << 8) | bytes[23]!;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = (bytes[i + 5]! << 8) | bytes[i + 6]!;
      const width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function readWebpSize(bytes: Uint8Array): { width: number; height: number } | null {
  // VP8X extended: bytes 24-29 have (width-1)/(height-1) 24-bit LE
  if (bytes.length >= 30 && bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
    const width =
      1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height =
      1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    if (width > 0 && height > 0) return { width, height };
  }
  // VP8 lossy simple: starts at 20 after "VP8 "
  if (bytes.length >= 30 && bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
    const width = bytes[26]! | ((bytes[27]! & 0x3f) << 8);
    const height = bytes[28]! | ((bytes[29]! & 0x3f) << 8);
    if (width > 0 && height > 0) return { width, height };
  }
  return { width: 1, height: 1 }; // dimension unknown but format valid — allow with min size
}

export function readImageDimensions(
  bytes: Uint8Array,
  mimeType: string,
): { width: number; height: number } {
  if (mimeType === "image/png") {
    return readPngSize(bytes) ?? { width: 0, height: 0 };
  }
  if (mimeType === "image/jpeg") {
    return readJpegSize(bytes) ?? { width: 0, height: 0 };
  }
  if (mimeType === "image/webp") {
    return readWebpSize(bytes) ?? { width: 0, height: 0 };
  }
  return { width: 0, height: 0 };
}

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function validateProtoOcrImage(input: {
  bytes: Uint8Array;
  declaredMime?: string | null;
  filename?: string | null;
}): ImageValidationOk | ImageValidationErr {
  if (input.bytes.byteLength > PROTO_OCR_MAX_BYTES_PER_IMAGE) {
    return {
      ok: false,
      errorCode: "IMAGE_TOO_LARGE",
      message: `Image exceeds ${PROTO_OCR_MAX_BYTES_PER_IMAGE} bytes`,
    };
  }
  const detected = detectImageMime(input.bytes);
  if (!detected) {
    return {
      ok: false,
      errorCode: "UNSUPPORTED_IMAGE",
      message: "Only PNG/JPEG/WEBP supported (magic bytes)",
    };
  }
  const name = (input.filename ?? "").toLowerCase();
  if (name.endsWith(".svg") || name.endsWith(".pdf") || name.endsWith(".exe")) {
    return {
      ok: false,
      errorCode: "UNSUPPORTED_IMAGE",
      message: "SVG/PDF/exec not allowed",
    };
  }
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  if (ext && EXT_TO_MIME[ext] && EXT_TO_MIME[ext] !== detected) {
    return {
      ok: false,
      errorCode: "MIME_SPOOF",
      message: `Extension ${ext} does not match magic bytes ${detected}`,
    };
  }
  if (
    input.declaredMime &&
    input.declaredMime !== detected &&
    !(
      (input.declaredMime === "image/jpg" || input.declaredMime === "image/pjpeg") &&
      detected === "image/jpeg"
    )
  ) {
    return {
      ok: false,
      errorCode: "MIME_SPOOF",
      message: `Declared MIME ${input.declaredMime} != ${detected}`,
    };
  }
  const dims = readImageDimensions(input.bytes, detected);
  if (dims.width <= 0 || dims.height <= 0) {
    return {
      ok: false,
      errorCode: "IMAGE_DECODE_FAILED",
      message: "Could not read image dimensions",
    };
  }
  if (dims.width > PROTO_OCR_MAX_WIDTH || dims.height > PROTO_OCR_MAX_HEIGHT) {
    return {
      ok: false,
      errorCode: "INVALID_DIMENSIONS",
      message: `Dimensions ${dims.width}x${dims.height} exceed limits`,
    };
  }
  return { ok: true, mimeType: detected, width: dims.width, height: dims.height };
}

export function validateProtoOcrImageBatch(files: Uint8Array[]): ImageValidationErr | null {
  if (files.length > PROTO_OCR_MAX_IMAGES) {
    return {
      ok: false,
      errorCode: "IMAGE_TOO_MANY",
      message: `Max ${PROTO_OCR_MAX_IMAGES} images`,
    };
  }
  const total = files.reduce((s, b) => s + b.byteLength, 0);
  if (total > PROTO_OCR_MAX_BYTES_TOTAL) {
    return {
      ok: false,
      errorCode: "IMAGE_TOTAL_TOO_LARGE",
      message: `Total upload exceeds ${PROTO_OCR_MAX_BYTES_TOTAL} bytes`,
    };
  }
  return null;
}
