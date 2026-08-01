"use client";

import { useCallback, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from "react";
import type { UseClipboardImageIntakeResult } from "@/hooks/useClipboardImageIntake";

type Props = {
  intake: UseClipboardImageIntakeResult;
  pasteEnabled: boolean;
  onPasteModeChange: (enabled: boolean) => void;
  disabled?: boolean;
  onFileSelect?: (files: FileList) => void;
  children?: React.ReactNode;
};

/**
 * Focus-scoped clipboard drop zone.
 * Paste only when focused or paste-mode explicitly enabled — never a global handler.
 */
export default function ClipboardImageDropZone({
  intake,
  pasteEnabled,
  onPasteModeChange,
  disabled,
  onFileSelect,
  children,
}: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const onPaste = useCallback(
    (e: ReactClipboardEvent) => {
      if (disabled || !pasteEnabled) return;
      void intake.handlePaste(e);
    },
    [disabled, pasteEnabled, intake],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={pasteEnabled}
            disabled={disabled}
            onChange={(e) => onPasteModeChange(e.target.checked)}
          />
          붙여넣기 모드
        </label>
        <span>
          {focused || pasteEnabled
            ? "포커스/붙여넣기 모드 활성"
            : "영역을 클릭하거나 붙여넣기 모드를 켜세요"}
        </span>
      </div>

      <div
        ref={zoneRef}
        tabIndex={disabled ? -1 : 0}
        role="region"
        aria-label="Clipboard image drop zone"
        onFocus={() => {
          setFocused(true);
          if (!pasteEnabled) onPasteModeChange(true);
        }}
        onBlur={(e) => {
          if (!zoneRef.current?.contains(e.relatedTarget as Node)) {
            setFocused(false);
          }
        }}
        onPaste={onPaste}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          if (disabled) return;
          void intake.handleDrop(e);
        }}
        className={[
          "rounded border-2 border-dashed px-4 py-8 outline-none transition-colors",
          disabled
            ? "cursor-not-allowed border-zinc-800 bg-zinc-950/20 opacity-60"
            : focused || pasteEnabled
              ? "border-amber-600 bg-amber-950/20"
              : "border-zinc-700 bg-zinc-950/40",
          dragOver ? "border-amber-400 bg-amber-900/30" : "",
        ].join(" ")}
      >
        <p className="text-center text-sm font-medium text-amber-100">
          여기를 클릭한 뒤 스크린샷을 Ctrl+V로 붙여넣으세요.
        </p>
        <ul className="mt-3 space-y-1 text-center text-xs text-zinc-500">
          <li>Win + Shift + S로 캡처 → Ctrl + V</li>
          <li>파일 저장 불필요 · 원본은 기본적으로 임시 처리</li>
          <li>자동 저장되지 않음 · Schedule이 경기 identity SoT</li>
          <li>모바일: 클립보드 제한 시 파일 선택 사용</li>
        </ul>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
            className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
          >
            파일 선택
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const files = e.target.files;
              if (!files?.length) return;
              if (onFileSelect) onFileSelect(files);
              else void intake.addFiles(files, "FILE_IMAGE");
              e.target.value = "";
            }}
          />
        </div>

        {children}
      </div>

      {intake.queueErrors.length > 0 && (
        <div className="text-xs text-red-400">
          {intake.queueErrors.join(", ")}
        </div>
      )}
    </div>
  );
}
