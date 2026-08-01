/**
 * Client-side preflight only. Server must re-validate; never trust these results.
 */
import { CLIPBOARD_INTAKE_LIMITS, CLIPBOARD_ALLOWED_MIME } from "./constants";

export type ClientPreflightOk = {
  ok: true;
  mimeType: (typeof CLIPBOARD_ALLOWED_MIME)[number];
  sizeBytes: number;
  width: number | null;
  height: number | null;
  warnings: string[];
};

export type ClientPreflightErr = {
  ok: false;
  errorCode: string;
  message: string;
};

function normalizeMime(mime: string): string {
  if (mime === "image/jpg") return "image/jpeg";
  return mime;
}

export function preflightClipboardImageMime(
  mimeType: string | null | undefined,
): ClientPreflightErr | { ok: true; mimeType: (typeof CLIPBOARD_ALLOWED_MIME)[number] } {
  const mime = normalizeMime(mimeType || "");
  if (
    mime !== "image/png" &&
    mime !== "image/jpeg" &&
    mime !== "image/webp"
  ) {
    return {
      ok: false,
      errorCode: "UNSUPPORTED_IMAGE",
      message: `Unsupported MIME: ${mime || "empty"}`,
    };
  }
  return { ok: true, mimeType: mime };
}

export function preflightClipboardQueueLimits(input: {
  existingCount: number;
  existingTotalBytes: number;
  incoming: Array<{ sizeBytes: number }>;
}): ClientPreflightErr | { ok: true } {
  const addCount = input.incoming.length;
  if (input.existingCount + addCount > CLIPBOARD_INTAKE_LIMITS.maxImages) {
    return {
      ok: false,
      errorCode: "IMAGE_TOO_MANY",
      message: `Max ${CLIPBOARD_INTAKE_LIMITS.maxImages} images`,
    };
  }
  let total = input.existingTotalBytes;
  for (const item of input.incoming) {
    if (item.sizeBytes > CLIPBOARD_INTAKE_LIMITS.maxBytesPerImage) {
      return {
        ok: false,
        errorCode: "IMAGE_TOO_LARGE",
        message: `Image exceeds ${CLIPBOARD_INTAKE_LIMITS.maxBytesPerImage} bytes`,
      };
    }
    total += item.sizeBytes;
  }
  if (total > CLIPBOARD_INTAKE_LIMITS.maxBytesTotal) {
    return {
      ok: false,
      errorCode: "IMAGE_TOTAL_TOO_LARGE",
      message: `Total exceeds ${CLIPBOARD_INTAKE_LIMITS.maxBytesTotal} bytes`,
    };
  }
  return { ok: true };
}

/** Decode dimensions in browser; returns nulls if decode fails (server still validates). */
export async function decodeImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob);
      const size = { width: bmp.width, height: bmp.height };
      bmp.close?.();
      return size;
    } catch {
      // fall through
    }
  }
  if (typeof URL === "undefined" || typeof Image === "undefined") {
    return null;
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export async function sha256HexOfBlob(blob: Blob): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const buf = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

export async function preflightClipboardImageBlob(
  blob: Blob,
  declaredMime?: string | null,
): Promise<ClientPreflightOk | ClientPreflightErr> {
  const mimeCheck = preflightClipboardImageMime(declaredMime || blob.type);
  if (!mimeCheck.ok) return mimeCheck;

  const sizeBytes = blob.size;
  if (sizeBytes > CLIPBOARD_INTAKE_LIMITS.maxBytesPerImage) {
    return {
      ok: false,
      errorCode: "IMAGE_TOO_LARGE",
      message: `Image exceeds ${CLIPBOARD_INTAKE_LIMITS.maxBytesPerImage} bytes`,
    };
  }
  if (sizeBytes <= 0) {
    return {
      ok: false,
      errorCode: "IMAGE_DECODE_FAILED",
      message: "Empty image blob",
    };
  }

  const dims = await decodeImageDimensions(blob);
  const warnings: string[] = [];
  if (!dims) warnings.push("CLIENT_DIMENSION_DECODE_FAILED");

  return {
    ok: true,
    mimeType: mimeCheck.mimeType,
    sizeBytes,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    warnings,
  };
}
