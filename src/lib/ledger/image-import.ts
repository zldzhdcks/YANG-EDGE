/**
 * 배팅 용지·스크린샷 업로드용 순수 헬퍼.
 * 실제 Vision/OCR 호출은 하지 않는다 (개발용 샘플 Draft만 제공).
 * 이미지는 브라우저 메모리에만 두고 저장하지 않는다.
 */

import {
  recognitionField,
  emptyRecognitionField,
  type LedgerTicketDraft,
} from "@/types/ledger-draft";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageFileMeta = {
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

export type ImageValidationResult =
  | { ok: true }
  | { ok: false; reason: "type" | "size" | "empty"; message: string };

export function validateImageFile(
  file: Pick<ImageFileMeta, "type" | "size">,
): ImageValidationResult {
  if (!file.type || !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      reason: "type",
      message: "JPEG, PNG, WEBP 이미지만 올릴 수 있습니다.",
    };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "empty", message: "빈 파일입니다." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      reason: "size",
      message: "이미지 크기는 10MB를 넘을 수 없습니다.",
    };
  }
  return { ok: true };
}

/**
 * 세션 내 중복 판별용 임시 키.
 * 실제 파일 해시가 아니라 파일명+크기+수정시각 조합이다.
 */
export function buildSessionFileKey(
  file: Pick<ImageFileMeta, "name" | "size" | "lastModified">,
): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 개발용 샘플 Draft (Vision 미연동).
 * 실제 인식 결과가 아니라 UI 흐름 확인용 고정값이다.
 */
export function buildSampleTicketDraft(
  options?: { id?: string; imageHash?: string | null },
): LedgerTicketDraft {
  const conf = <T,>(value: T, confidence: number, sourceText: string) =>
    recognitionField<T>({
      value,
      confidence,
      sourceText,
      status: "confirmed",
      issues: [],
    });

  return {
    id: options?.id ?? "sample-draft",
    imageHash: options?.imageHash ?? null,
    betDate: conf("2026-07-25", 0.96, "2026-07-25"),
    stake: conf(10000, 0.94, "10,000"),
    recognizedCombinedOdds: conf(3.6, 0.9, "3.60"),
    calculatedCombinedOdds: null,
    expectedReturn: conf(36000, 0.88, "36,000"),
    calculatedExpectedReturn: null,
    source: conf("manual", 1, "manual"),
    memo: recognitionField<string>({
      value: "",
      confidence: 1,
      sourceText: "",
      status: "confirmed",
      issues: [],
    }),
    picks: [
      {
        clientKey: "pick-0",
        gameId: emptyRecognitionField<string>(),
        sport: conf("baseball", 0.93, "야구"),
        league: conf("KBO", 0.91, "KBO"),
        homeTeam: conf("두산", 0.86, "두산"),
        awayTeam: conf("삼성", 0.86, "삼성"),
        startTime: emptyRecognitionField<string>(),
        selectionType: conf("away" as const, 0.85, "원정승"),
        selectionLabel: conf("삼성 승", 0.85, "삼성 승"),
        odds: conf(1.8, 0.92, "1.80"),
      },
      {
        clientKey: "pick-1",
        gameId: emptyRecognitionField<string>(),
        sport: conf("football", 0.9, "축구"),
        league: conf("K리그", 0.72, "K리그"),
        homeTeam: conf("울산", 0.83, "울산"),
        awayTeam: conf("전북", 0.83, "전북"),
        startTime: emptyRecognitionField<string>(),
        selectionType: conf("home" as const, 0.84, "홈승"),
        selectionLabel: conf("홈승", 0.84, "홈승"),
        odds: conf(2.0, 0.89, "2.00"),
      },
    ],
    validationIssues: [],
    readyToSave: false,
  };
}
