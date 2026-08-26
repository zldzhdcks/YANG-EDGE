/**
 * Korean-first presentation mapper for Internal OS.
 * Maps stored/internal enum codes → human UI labels.
 * Does NOT rewrite research artifacts, provider payloads, or domain enums.
 */

export const KOREAN_STATUS_DISPLAY = {
  IN_PROGRESS: "진행 중",
  NOT_STARTED: "시작 전",
  READY: "준비 완료",
  DONE: "완료",
  COMPLETE: "완료",
  COMPLETED: "완료",
  BLOCKED: "차단됨",
  WARNING: "확인 필요",
  OPEN: "확인 필요",
  APPROVED: "승인됨",
  PARTIAL: "일부 완료",
  PARTIAL_READY: "일부 준비됨",
  WAITING: "대기 중",
  PENDING: "대기 중",
  NOT_AVAILABLE: "현재 사용 불가",
  NOT_COLLECTED: "미수집",
  AWAITING_RESULT: "결과 대기",
  OPS_FAILURE: "운영 오류",
  NO_PREGAME_SNAPSHOT: "사전 스냅샷 없음",
  REVIEW_READY: "복기 가능",
  FOUNDATION: "기반 구축",
  OFF: "해당 없음",
  OFFSEASON: "시즌오프",
  NONE: "없음",
  UNKNOWN: "확인 불가",
  MISSING: "없음",
  YES: "예",
  NO: "아니오",
  ACTIVE: "진행 중",
  COLLECTING: "수집 중",
  DISABLED: "사용 안 함",
  RESEARCH: "연구 중",
  PREPARING: "준비 중",
  "INPUT REQUIRED": "입력 필요",
  NEEDS_OWNER_DECISION: "대표 승인 필요",
  NOT_READY: "아직 아님",
  DEFERRED: "보류",
  REJECTED: "반려",
  PROPOSED: "제안됨",
  RESOLVED: "해결됨",
  CRITICAL: "긴급",
  HIGH: "높음",
  NORMAL: "보통",
  LOW: "낮음",
  LIMITED_INPUT: "제한 입력",
  PRE_GAME_SNAPSHOT_VERIFIED: "경기 전 스냅샷 확인됨",
  "PREDICTION SNAPSHOT MISSING": "예측 스냅샷 없음",
  FILE_NOT_FOUND: "파일 없음",
} as const;

export type KoreanStatusCode = keyof typeof KOREAN_STATUS_DISPLAY;

export const KOREAN_FIELD_LABEL = {
  Schedule: "일정",
  Starter: "선발",
  Odds: "배당",
  Lineup: "라인업",
  Prediction: "예측",
  Result: "결과",
  Review: "복기",
  Identity: "정체성",
  Dataset: "데이터셋",
  Coverage: "커버리지",
  Pipeline: "파이프라인",
  "Recommendation Record": "추천 기록",
  "Review Foundation": "복기 기반",
  "Scorecard Foundation": "스코어카드 기반",
  "1X2 Odds": "1X2 배당",
  Snapshot: "스냅샷",
} as const;

export const KOREAN_CHECKLIST_TITLE = {
  "MLB Review": "MLB 복기",
  "KBO Odds": "KBO 배당",
  "Football Identity": "축구 정체성",
} as const;

const TOKEN_BOUNDARY = /[_\s]+/;

function lookupExact(raw: string): string | null {
  const direct = KOREAN_STATUS_DISPLAY[raw as KoreanStatusCode];
  if (direct) return direct;
  const upper = raw.toUpperCase();
  const fromUpper = KOREAN_STATUS_DISPLAY[upper as KoreanStatusCode];
  if (fromUpper) return fromUpper;
  return null;
}

/**
 * Display-only. Returns semantic Korean for known codes.
 * Unknown / already-human text is returned unchanged.
 * Raw code is never mutated.
 */
export function koreanStatusLabel(raw: string | null | undefined): string {
  if (raw == null) return "—";
  const trimmed = raw.trim();
  if (!trimmed) return "—";

  const exact = lookupExact(trimmed);
  if (exact) return exact;

  const lastToken = trimmed.split(TOKEN_BOUNDARY).filter(Boolean).at(-1);
  if (lastToken && lastToken !== trimmed) {
    const lastMapped = lookupExact(lastToken);
    if (lastMapped) {
      const prefix = trimmed.slice(0, trimmed.length - lastToken.length).trim();
      const prefixKo =
        KOREAN_FIELD_LABEL[prefix as keyof typeof KOREAN_FIELD_LABEL] ?? prefix;
      return prefixKo ? `${prefixKo} ${lastMapped}` : lastMapped;
    }
  }

  return trimmed;
}

export function koreanFieldLabel(raw: string): string {
  return KOREAN_FIELD_LABEL[raw as keyof typeof KOREAN_FIELD_LABEL] ?? raw;
}

export function koreanChecklistTitle(raw: string): string {
  const mapped = KOREAN_CHECKLIST_TITLE[raw as keyof typeof KOREAN_CHECKLIST_TITLE] ?? raw;
  return mapped
    .replaceAll("Starter", "선발")
    .replaceAll("Lineup", "라인업")
    .replaceAll("Prediction", "예측")
    .replaceAll("Review", "복기")
    .replaceAll("Odds", "배당")
    .replaceAll("Schedule", "일정")
    .replaceAll("Snapshot", "스냅샷");
}

export function koreanOwnerCopy(raw: string): string {
  return koreanChecklistTitle(koreanStatusLabel(raw));
}

export function checklistActionStateLabel(done: boolean, level: string): string {
  if (done) return KOREAN_STATUS_DISPLAY.DONE;
  if (level === "BLOCKED") return KOREAN_STATUS_DISPLAY.BLOCKED;
  if (level === "WARNING") return KOREAN_STATUS_DISPLAY.WARNING;
  return KOREAN_STATUS_DISPLAY.WAITING;
}

export function isKnownStatusCode(raw: string): boolean {
  return lookupExact(raw.trim()) != null;
}
