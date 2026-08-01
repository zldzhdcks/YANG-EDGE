"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type DragEvent as ReactDragEvent } from "react";
import {
  CLIPBOARD_INTAKE_LIMITS,
  extractClipboardIntakeFromDataTransfer,
  preflightClipboardImageBlob,
  preflightClipboardQueueLimits,
  sha256HexOfBlob,
  type ClipboardIntakeItem,
  type ClipboardIntakeInputKind,
} from "@/lib/clipboard-intake";

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function revokePreview(item: ClipboardIntakeItem | undefined) {
  if (item?.previewUrl) {
    try {
      URL.revokeObjectURL(item.previewUrl);
    } catch {
      // ignore
    }
  }
}

export type UseClipboardImageIntakeOptions = {
  /** When false, paste handlers should no-op (focus-scoped). */
  pasteEnabled: boolean;
  maxImages?: number;
  onPastedText?: (text: string) => void;
  onReject?: (codes: string[]) => void;
};

export type UseClipboardImageIntakeResult = {
  intakeRunId: string;
  items: ClipboardIntakeItem[];
  queueErrors: string[];
  totalBytes: number;
  addFiles: (
    files: FileList | File[] | Blob[],
    inputKind: ClipboardIntakeInputKind,
  ) => Promise<void>;
  handlePaste: (event: ClipboardEvent | ReactClipboardEvent) => Promise<void>;
  handleDrop: (event: DragEvent | ReactDragEvent) => Promise<void>;
  removeItem: (intakeItemId: string) => void;
  clearAll: () => void;
  moveItem: (intakeItemId: string, direction: -1 | 1) => void;
  getUploadFiles: () => File[];
  resetRun: () => void;
};

export function useClipboardImageIntake(
  options: UseClipboardImageIntakeOptions,
): UseClipboardImageIntakeResult {
  const [intakeRunId, setIntakeRunId] = useState(() => newId("intake-run"));
  const [items, setItems] = useState<ClipboardIntakeItem[]>([]);
  const [queueErrors, setQueueErrors] = useState<string[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const maxImages = options.maxImages ?? CLIPBOARD_INTAKE_LIMITS.maxImages;

  // Unmount: revoke all object URLs
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) revokePreview(item);
    };
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) revokePreview(item);
      return [];
    });
    setQueueErrors([]);
  }, []);

  const resetRun = useCallback(() => {
    clearAll();
    setIntakeRunId(newId("intake-run"));
  }, [clearAll]);

  const removeItem = useCallback((intakeItemId: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.intakeItemId === intakeItemId);
      revokePreview(target);
      return prev.filter((i) => i.intakeItemId !== intakeItemId);
    });
  }, []);

  const moveItem = useCallback((intakeItemId: string, direction: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.intakeItemId === intakeItemId);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [row] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, row!);
      return copy;
    });
  }, []);

  const addBlobs = useCallback(
    async (
      incoming: Array<{
        blob: Blob;
        mimeType: string;
        originalName: string | null;
        inputKind: ClipboardIntakeInputKind;
      }>,
    ) => {
      if (incoming.length === 0) return;
      const current = itemsRef.current;
      const existingTotal = current.reduce(
        (sum, i) => sum + (i.sizeBytes ?? 0),
        0,
      );
      const limits = preflightClipboardQueueLimits({
        existingCount: current.length,
        existingTotalBytes: existingTotal,
        incoming: incoming.map((x) => ({ sizeBytes: x.blob.size })),
      });
      if (!limits.ok) {
        setQueueErrors([limits.errorCode]);
        options.onReject?.([limits.errorCode]);
        return;
      }
      // also respect local maxImages override
      if (current.length + incoming.length > maxImages) {
        setQueueErrors(["IMAGE_TOO_MANY"]);
        options.onReject?.(["IMAGE_TOO_MANY"]);
        return;
      }

      const nextItems: ClipboardIntakeItem[] = [];
      const rejects: string[] = [];

      for (const entry of incoming) {
        const pre = await preflightClipboardImageBlob(
          entry.blob,
          entry.mimeType,
        );
        if (!pre.ok) {
          rejects.push(pre.errorCode);
          continue;
        }
        const sha = await sha256HexOfBlob(entry.blob);
        if (sha && current.some((c) => c.imageSha256 === sha)) {
          rejects.push("DUPLICATE_IMAGE");
          // still allow add with warning? Mission says duplicate fingerprint check —
          // reject duplicate by default
          continue;
        }
        if (sha && nextItems.some((c) => c.imageSha256 === sha)) {
          rejects.push("DUPLICATE_IMAGE");
          continue;
        }

        const previewUrl = URL.createObjectURL(entry.blob);
        nextItems.push({
          intakeItemId: newId("intake-item"),
          intakeRunId,
          inputKind: entry.inputKind,
          mimeType: pre.mimeType,
          originalName: entry.originalName,
          sizeBytes: pre.sizeBytes,
          width: pre.width,
          height: pre.height,
          imageSha256: sha,
          previewUrl,
          receivedAt: new Date().toISOString(),
          status: "READY",
          warnings: pre.warnings,
          errors: [],
          blob: entry.blob,
        });
      }

      if (rejects.length) {
        setQueueErrors(rejects);
        options.onReject?.(rejects);
      } else {
        setQueueErrors([]);
      }
      if (nextItems.length) {
        setItems((prev) => [...prev, ...nextItems]);
      }
    },
    [intakeRunId, maxImages, options],
  );

  const addFiles = useCallback(
    async (
      files: FileList | File[] | Blob[],
      inputKind: ClipboardIntakeInputKind,
    ) => {
      const list = Array.from(files as ArrayLike<Blob>);
      await addBlobs(
        list.map((blob, i) => {
          const file = blob as File;
          return {
            blob,
            mimeType: blob.type || "application/octet-stream",
            originalName:
              typeof file.name === "string" && file.name ? file.name : null,
            inputKind,
          };
        }),
      );
    },
    [addBlobs],
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent | ReactClipboardEvent) => {
      if (!options.pasteEnabled) return;
      const dt = event.clipboardData;
      const extracted = extractClipboardIntakeFromDataTransfer(dt);
      if (extracted.empty && extracted.unsupportedKinds.length) {
        options.onReject?.(extracted.unsupportedKinds);
        setQueueErrors(extracted.unsupportedKinds);
        return;
      }
      if (extracted.images.length === 0 && extracted.pastedText) {
        // text-only → route to paste fallback; do not preventDefault if we didn't take images
        options.onPastedText?.(extracted.pastedText);
        return;
      }
      if (extracted.images.length > 0) {
        event.preventDefault();
        await addBlobs(
          extracted.images.map((img) => ({
            ...img,
            inputKind: "CLIPBOARD_IMAGE" as const,
          })),
        );
        if (extracted.pastedText) {
          options.onPastedText?.(extracted.pastedText);
        }
      } else if (extracted.unsupportedKinds.length) {
        options.onReject?.(extracted.unsupportedKinds);
        setQueueErrors(extracted.unsupportedKinds);
      }
    },
    [addBlobs, options],
  );

  const handleDrop = useCallback(
    async (event: DragEvent | ReactDragEvent) => {
      event.preventDefault();
      const dt = event.dataTransfer;
      const extracted = extractClipboardIntakeFromDataTransfer(dt);
      if (extracted.images.length > 0) {
        await addBlobs(
          extracted.images.map((img) => ({
            ...img,
            inputKind: "FILE_IMAGE" as const,
          })),
        );
      } else if (extracted.unsupportedKinds.length) {
        options.onReject?.(extracted.unsupportedKinds);
        setQueueErrors(extracted.unsupportedKinds);
      }
    },
    [addBlobs, options],
  );

  const getUploadFiles = useCallback((): File[] => {
    return items
      .filter((i) => i.status === "READY" || i.status === "RECEIVED")
      .map((i, idx) => {
        const blob = i.blob;
        if (!blob) return null;
        const name =
          i.originalName ||
          `clipboard-${idx + 1}.${
            i.mimeType === "image/png"
              ? "png"
              : i.mimeType === "image/webp"
                ? "webp"
                : "jpg"
          }`;
        return new File([blob], name, {
          type: i.mimeType || blob.type || "application/octet-stream",
        });
      })
      .filter((f): f is File => f != null);
  }, [items]);

  const totalBytes = items.reduce((s, i) => s + (i.sizeBytes ?? 0), 0);

  return {
    intakeRunId,
    items,
    queueErrors,
    totalBytes,
    addFiles,
    handlePaste,
    handleDrop,
    removeItem,
    clearAll,
    moveItem,
    getUploadFiles,
    resetRun,
  };
}
