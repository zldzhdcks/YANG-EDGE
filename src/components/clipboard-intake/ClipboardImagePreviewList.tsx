"use client";

import { useState } from "react";
import type { ClipboardIntakeItem } from "@/lib/clipboard-intake";
import type { UseClipboardImageIntakeResult } from "@/hooks/useClipboardImageIntake";

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

type Props = {
  intake: UseClipboardImageIntakeResult;
  disabled?: boolean;
};

export default function ClipboardImagePreviewList({ intake, disabled }: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (intake.items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">
          {intake.items.length}장 · {formatBytes(intake.totalBytes)} · run=
          {intake.intakeRunId.slice(0, 18)}…
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => intake.clearAll()}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 disabled:opacity-50"
        >
          전체 제거
        </button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {intake.items.map((item, index) => (
          <PreviewCard
            key={item.intakeItemId}
            item={item}
            index={index}
            disabled={disabled}
            onRemove={() => intake.removeItem(item.intakeItemId)}
            onMoveUp={() => intake.moveItem(item.intakeItemId, -1)}
            onMoveDown={() => intake.moveItem(item.intakeItemId, 1)}
            onZoom={() => item.previewUrl && setLightboxUrl(item.previewUrl)}
          />
        ))}
      </ul>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-label="Image preview"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="확대 미리보기"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function PreviewCard({
  item,
  index,
  disabled,
  onRemove,
  onMoveUp,
  onMoveDown,
  onZoom,
}: {
  item: ClipboardIntakeItem;
  index: number;
  disabled?: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onZoom: () => void;
}) {
  return (
    <li className="overflow-hidden rounded border border-zinc-800 bg-zinc-950/60">
      <div className="aspect-video bg-zinc-900">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.previewUrl}
            alt={`미리보기 ${index + 1}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            no preview
          </div>
        )}
      </div>
      <div className="space-y-1 p-2 text-[11px] text-zinc-400">
        <div className="font-medium text-zinc-300">#{index + 1}</div>
        <div>
          {formatBytes(item.sizeBytes)}
          {item.width != null && item.height != null
            ? ` · ${item.width}×${item.height}`
            : ""}
        </div>
        <div>{item.mimeType ?? "—"}</div>
        <div>
          입력:{" "}
          {item.inputKind === "CLIPBOARD_IMAGE"
            ? "Clipboard"
            : item.inputKind === "FILE_IMAGE"
              ? "File"
              : "Text"}
        </div>
        <div className="text-amber-600/90">아직 저장되지 않음</div>
        <div>외부 전송: 없음 · 원본 보존: 없음</div>
        {item.warnings.length > 0 && (
          <div className="text-amber-500">{item.warnings.join(", ")}</div>
        )}
        <div className="flex flex-wrap gap-1 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={onZoom}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 disabled:opacity-50"
          >
            확대
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onMoveUp}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 disabled:opacity-50"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onMoveDown}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 disabled:opacity-50"
          >
            ↓
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            className="rounded border border-red-900 px-1.5 py-0.5 text-red-300 disabled:opacity-50"
          >
            제거
          </button>
        </div>
      </div>
    </li>
  );
}
