"use client";

import { useEffect, useId, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  ALLOWED_IMAGE_TYPES,
  buildSampleTicketDraft,
  buildSessionFileKey,
  formatFileSize,
  validateImageFile,
  validateTicketDraft,
  isDuplicateImageHash,
  appendImageHashIfNew,
} from "@/lib/ledger";
import type { LedgerTicketDraft } from "@/types/ledger-draft";

type SelectedImage = {
  name: string;
  size: number;
  type: string;
  sessionKey: string;
  previewUrl: string;
};

type LedgerImageImportProps = {
  onRecognized: (draft: LedgerTicketDraft) => void;
  /** 검수 중에는 새 인식을 막는다 */
  reviewing?: boolean;
  /** 값이 바뀌면 선택된 이미지를 비운다 (저장·취소 후). 세션 중복 기록은 유지 */
  clearSignal?: number;
};

export default function LedgerImageImport({
  onRecognized,
  reviewing = false,
  clearSignal = 0,
}: LedgerImageImportProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const seenKeysRef = useRef<string[]>([]);
  const draftSeqRef = useRef(0);

  const [image, setImage] = useState<SelectedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // 미리보기 object URL 은 교체·언마운트 시 즉시 해제한다.
  useEffect(() => {
    const url = image?.previewUrl;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [image?.previewUrl]);

  useEffect(() => {
    if (clearSignal === 0) return;
    setImage(null);
    setError(null);
    setDuplicateWarning(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [clearSignal]);

  function resetInputValue() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = validateImageFile(file);
    if (!result.ok) {
      setError(result.message);
      setDuplicateWarning(null);
      setImage(null);
      resetInputValue();
      return;
    }

    const sessionKey = buildSessionFileKey(file);
    const duplicate = isDuplicateImageHash(sessionKey, seenKeysRef.current);
    seenKeysRef.current = appendImageHashIfNew(
      sessionKey,
      seenKeysRef.current,
    );

    setError(null);
    setDuplicateWarning(
      duplicate
        ? "이번 세션에서 같은 파일을 이미 불러왔습니다. 중복 등록이 아닌지 확인하세요."
        : null,
    );
    setImage({
      name: file.name,
      size: file.size,
      type: file.type,
      sessionKey,
      previewUrl: URL.createObjectURL(file),
    });
    resetInputValue();
  }

  function handleRemove() {
    setImage(null);
    setError(null);
    setDuplicateWarning(null);
    resetInputValue();
  }

  function handleSampleRecognize() {
    if (!image) return;
    draftSeqRef.current += 1;
    const draft = buildSampleTicketDraft({
      id: `${inputId}-draft-${draftSeqRef.current}`,
      imageHash: image.sessionKey,
    });
    onRecognized(validateTicketDraft(draft));
  }

  return (
    <Card as="section" aria-labelledby={`${inputId}-title`} className="space-y-4">
      <div>
        <h2 id={`${inputId}-title`} className="text-sm font-semibold text-white">
          배팅 용지·스크린샷 불러오기
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          JPEG · PNG · WEBP, 최대 10MB. 이미지는 이 브라우저 메모리에만 잠시
          두며 저장하거나 서버로 보내지 않습니다.
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          현재는 개발용 샘플 인식만 동작합니다. 실제 OCR은 연결되어 있지
          않습니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-white/10 px-5 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-white/5 focus-within:ring-2 focus-within:ring-blue-500/40"
        >
          배팅 용지 또는 스크린샷 불러오기
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>

        <Button
          type="button"
          variant="secondary"
          onClick={handleSampleRecognize}
          disabled={!image || reviewing}
        >
          샘플 인식 실행
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}

      {duplicateWarning ? (
        <p role="status" className="text-xs text-amber-400">
          {duplicateWarning}
        </p>
      ) : null}

      {image ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.08] bg-zinc-950/40 p-3">
          {/* 로컬 object URL 미리보기 (next/image 최적화 대상 아님) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt={`${image.name} 미리보기`}
            className="h-24 w-24 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm text-white">{image.name}</p>
            <p className="text-xs text-zinc-500">
              {formatFileSize(image.size)} · {image.type}
            </p>
            <Badge variant="muted">브라우저 메모리에만 보관</Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={reviewing}
          >
            제거
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
