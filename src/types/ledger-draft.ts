/**
 * 배팅 용지·스크린샷 인식 결과용 Draft 타입.
 * 가계부 저장 타입(LedgerTicket/LedgerPick)과 분리한다.
 * 경기 결과·적중 여부 필드는 넣지 않는다.
 */

import type { LedgerSelectionType } from "@/types/ledger";

export type RecognitionStatus = "confirmed" | "needs-review" | "missing";

export type RecognitionField<T> = {
  value: T | null;
  /** 0~1. 범위 밖이면 검산 계층에서 null 처리 */
  confidence: number | null;
  sourceText: string | null;
  status: RecognitionStatus;
  issues: string[];
};

export type DraftValidationIssueCode =
  | "NO_PICKS"
  | "INVALID_ODDS"
  | "INVALID_STAKE"
  | "REQUIRED_MISSING"
  | "NEEDS_REVIEW"
  | "COMBINED_ODDS_MISMATCH"
  | "EXPECTED_RETURN_MISMATCH"
  | "INVALID_CONFIDENCE"
  | "INVALID_SOURCE"
  | "INVALID_SELECTION_TYPE"
  | "INVALID_BET_DATE";

export type DraftValidationIssue = {
  code: DraftValidationIssueCode;
  message: string;
  /** 티켓 필드명 또는 pick.clientKey.field */
  path?: string;
};

export type LedgerPickDraft = {
  /** UI·검수용 안정 키. 저장 LedgerPick.id 와 별개 */
  clientKey: string;
  gameId: RecognitionField<string>;
  sport: RecognitionField<string>;
  league: RecognitionField<string>;
  homeTeam: RecognitionField<string>;
  awayTeam: RecognitionField<string>;
  startTime: RecognitionField<string>;
  selectionType: RecognitionField<LedgerSelectionType>;
  selectionLabel: RecognitionField<string>;
  odds: RecognitionField<number>;
};

export type LedgerTicketDraft = {
  id: string;
  /** 중복 업로드 감지용. 원본 이미지는 보관하지 않음 */
  imageHash: string | null;
  betDate: RecognitionField<string>;
  stake: RecognitionField<number>;
  recognizedCombinedOdds: RecognitionField<number>;
  /** 유효 픽 배당 곱. 검산으로 채움 */
  calculatedCombinedOdds: number | null;
  expectedReturn: RecognitionField<number>;
  /** stake × calculatedCombinedOdds (원 반올림) */
  calculatedExpectedReturn: number | null;
  source: RecognitionField<string>;
  memo: RecognitionField<string>;
  picks: LedgerPickDraft[];
  validationIssues: DraftValidationIssue[];
  readyToSave: boolean;
};

/** 빈 RecognitionField (추측값 없음) */
export function emptyRecognitionField<T>(): RecognitionField<T> {
  return {
    value: null,
    confidence: null,
    sourceText: null,
    status: "missing",
    issues: [],
  };
}

export function recognitionField<T>(
  partial: Partial<RecognitionField<T>> & {
    value: T | null;
    status: RecognitionStatus;
  },
): RecognitionField<T> {
  return {
    value: partial.value,
    confidence: partial.confidence ?? null,
    sourceText: partial.sourceText ?? null,
    status: partial.status,
    issues: partial.issues ? [...partial.issues] : [],
  };
}
