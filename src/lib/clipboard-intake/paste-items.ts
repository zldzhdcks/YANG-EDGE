/**
 * Extract image/text items from a paste or drop DataTransfer.
 * Uses paste/drop events only — does not call navigator.clipboard.read().
 */
import type { ClipboardPasteExtractResult } from "./types";
import { CLIPBOARD_ALLOWED_MIME } from "./constants";

const ALLOWED = new Set<string>(CLIPBOARD_ALLOWED_MIME);

function isAllowedImageMime(type: string): boolean {
  return ALLOWED.has(type) || type === "image/jpg";
}

function listDataTransferItems(
  items: DataTransferItemList | null | undefined,
): DataTransferItem[] {
  if (!items) return [];
  const out: DataTransferItem[] = [];
  const asAny = items as unknown as {
    length?: number;
    item?: (n: number) => DataTransferItem | null;
    [Symbol.iterator]?: () => Iterator<DataTransferItem>;
  };
  const len = typeof asAny.length === "number" ? asAny.length : 0;
  for (let i = 0; i < len; i += 1) {
    const indexed = (items as unknown as Record<number, DataTransferItem | undefined>)[
      i
    ];
    const viaItem =
      typeof asAny.item === "function" ? asAny.item(i) : null;
    const item = indexed ?? viaItem ?? null;
    if (item) out.push(item);
  }
  if (out.length === 0 && typeof asAny[Symbol.iterator] === "function") {
    for (const item of items as unknown as Iterable<DataTransferItem>) {
      if (item) out.push(item);
    }
  }
  return out;
}

function listDataTransferFiles(
  files: FileList | null | undefined,
): File[] {
  if (!files) return [];
  const out: File[] = [];
  const asAny = files as unknown as {
    length?: number;
    item?: (n: number) => File | null;
    [Symbol.iterator]?: () => Iterator<File>;
  };
  const len = typeof asAny.length === "number" ? asAny.length : 0;
  for (let i = 0; i < len; i += 1) {
    const indexed = (files as unknown as Record<number, File | undefined>)[i];
    const viaItem =
      typeof asAny.item === "function" ? asAny.item(i) : null;
    const file = indexed ?? viaItem ?? null;
    if (file) out.push(file);
  }
  if (out.length === 0 && typeof asAny[Symbol.iterator] === "function") {
    for (const file of files as unknown as Iterable<File>) {
      if (file) out.push(file);
    }
  }
  return out;
}

/**
 * Pure helper for ClipboardEvent / DragEvent dataTransfer.
 * Safe to unit-test without a browser.
 */
export function extractClipboardIntakeFromDataTransfer(
  dataTransfer: DataTransfer | null | undefined,
): ClipboardPasteExtractResult {
  if (!dataTransfer) {
    return {
      images: [],
      pastedText: null,
      unsupportedKinds: ["NO_CLIPBOARD_DATA"],
      empty: true,
    };
  }

  const images: ClipboardPasteExtractResult["images"] = [];
  const unsupportedKinds: string[] = [];
  let pastedText: string | null = null;

  for (const item of listDataTransferItems(dataTransfer.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      if (!isAllowedImageMime(item.type)) {
        unsupportedKinds.push(`UNSUPPORTED_IMAGE_MIME:${item.type || "unknown"}`);
        continue;
      }
      const file = item.getAsFile();
      if (!file) {
        unsupportedKinds.push("IMAGE_FILE_UNAVAILABLE");
        continue;
      }
      images.push({
        blob: file,
        mimeType: item.type === "image/jpg" ? "image/jpeg" : item.type,
        originalName: file.name || null,
      });
    } else if (item.kind === "string" && item.type.startsWith("text/")) {
      // plain text retrieved via getData below
    } else if (item.kind === "file" && !item.type.startsWith("image/")) {
      unsupportedKinds.push(`UNSUPPORTED_FILE:${item.type || "unknown"}`);
    } else if (item.kind !== "string") {
      unsupportedKinds.push(`UNSUPPORTED_KIND:${item.kind}:${item.type}`);
    }
  }

  // Fallback: files list (drag-drop / some paste paths)
  if (images.length === 0) {
    for (const file of listDataTransferFiles(dataTransfer.files)) {
      if (!file.type.startsWith("image/")) {
        unsupportedKinds.push(`UNSUPPORTED_FILE:${file.type || "unknown"}`);
        continue;
      }
      if (!isAllowedImageMime(file.type)) {
        unsupportedKinds.push(`UNSUPPORTED_IMAGE_MIME:${file.type}`);
        continue;
      }
      images.push({
        blob: file,
        mimeType: file.type === "image/jpg" ? "image/jpeg" : file.type,
        originalName: file.name || null,
      });
    }
  }

  try {
    const text = dataTransfer.getData("text/plain");
    if (text && text.trim()) pastedText = text;
  } catch {
    // getData may throw in some contexts
  }

  const empty = images.length === 0 && !pastedText;
  if (empty && unsupportedKinds.length === 0) {
    unsupportedKinds.push("NO_SUPPORTED_CLIPBOARD_CONTENT");
  }

  return { images, pastedText, unsupportedKinds, empty };
}
