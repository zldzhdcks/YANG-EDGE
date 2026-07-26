/** 개인 베팅 가계부 — 브라우저 localStorage 전용 타입 */

export type LedgerSport = "baseball" | "football" | "basketball" | "other";

export type LedgerBetStatus = "pending" | "win" | "loss" | "void";

export type LedgerBetSource = "yang-edge" | "manual";

export type LedgerBet = {
  id: string;
  /** YYYY-MM-DD (KST) */
  betDate: string;
  sport: LedgerSport;
  league: string;
  matchName: string;
  selection: string;
  /** 소수점 배당 (1 이상) */
  odds: number;
  /** 원 단위 정수 */
  stake: number;
  status: LedgerBetStatus;
  /**
   * 실제 환급액 (원 단위 정수).
   * null = 미입력 (상태별 기본 규칙으로 계산)
   */
  settledReturn: number | null;
  source: LedgerBetSource;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type LedgerBudgetSettings = {
  /** 월 베팅 예산 (원). null = 미설정 */
  monthlyBudget: number | null;
  /** 1회 기록금액 기준 (원). null = 미설정 */
  unitStakeLimit: number | null;
  /** 하루 손실 한도 (원, 양수). null = 미설정 */
  dailyLossLimit: number | null;
  /** 월 손실 한도 (원, 양수). null = 미설정 */
  monthlyLossLimit: number | null;
};

export type LedgerStoreV1 = {
  version: 1;
  bets: LedgerBet[];
  budget: LedgerBudgetSettings;
};

export const LEDGER_STORAGE_KEY = "yang-edge:private-ledger:v1";

export const DEFAULT_LEDGER_BUDGET: LedgerBudgetSettings = {
  monthlyBudget: null,
  unitStakeLimit: null,
  dailyLossLimit: null,
  monthlyLossLimit: null,
};

export const EMPTY_LEDGER_STORE: LedgerStoreV1 = {
  version: 1,
  bets: [],
  budget: { ...DEFAULT_LEDGER_BUDGET },
};

export const LEDGER_SPORT_OPTIONS: { id: LedgerSport; label: string }[] = [
  { id: "baseball", label: "야구" },
  { id: "football", label: "축구" },
  { id: "basketball", label: "농구" },
  { id: "other", label: "기타" },
];

export const LEDGER_STATUS_OPTIONS: { id: LedgerBetStatus; label: string }[] = [
  { id: "pending", label: "결과 대기" },
  { id: "win", label: "적중" },
  { id: "loss", label: "미적중" },
  { id: "void", label: "취소·환불" },
];

export const LEDGER_SOURCE_OPTIONS: { id: LedgerBetSource; label: string }[] = [
  { id: "manual", label: "직접 판단" },
  { id: "yang-edge", label: "YANG EDGE 참고" },
];

export function ledgerSportLabel(sport: LedgerSport): string {
  return LEDGER_SPORT_OPTIONS.find((o) => o.id === sport)?.label ?? sport;
}

export function ledgerStatusLabel(status: LedgerBetStatus): string {
  return LEDGER_STATUS_OPTIONS.find((o) => o.id === status)?.label ?? status;
}

export function ledgerSourceLabel(source: LedgerBetSource): string {
  return LEDGER_SOURCE_OPTIONS.find((o) => o.id === source)?.label ?? source;
}
