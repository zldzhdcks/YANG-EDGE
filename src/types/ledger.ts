/** 개인 베팅 가계부 — 브라우저 localStorage 전용 타입 */

/**
 * UI 분류용 종목.
 * 티켓이 아니라 각 LedgerPick 이 독립적으로 가진다 (혼합 종목 티켓 허용).
 *
 * 의미: **개인 베팅 기록 분류** — YANG EDGE 분석 지원 종목(야구·축구·농구·배구)과 동일하지 않다.
 * `ice-hockey` 는 레거시 저장값 보존용으로만 유지하며, 신규 선택 UI에는 노출하지 않는다.
 */
export const LEDGER_SPORTS = [
  "baseball",
  "football",
  "basketball",
  "volleyball",
  "ice-hockey",
  "other",
] as const;

export type LedgerSportKnown = (typeof LEDGER_SPORTS)[number];

/**
 * 알려진 종목 + 향후 값 여유.
 * 파서는 비어 있지 않은 string 을 허용한다 (구버전/확장 종목 보존).
 */
export type LedgerSport = LedgerSportKnown | (string & {});

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

/** 티켓/픽 결과 상태 (v1 LedgerBetStatus 와 동일 집합) */
export type LedgerTicketStatus = "pending" | "win" | "loss" | "void";
export type LedgerPickStatus = "pending" | "win" | "loss" | "void";

/**
 * MVP: home / draw / away / other.
 * 종목별 승패에 고정하지 않음 — 향후 marketType / line 으로 확장.
 */
export type LedgerSelectionType = "home" | "draw" | "away" | "other";

/**
 * 향후 시장 확장용 (MVP에서는 저장·사용하지 않아도 됨).
 * 예: "moneyline" | "spread" | "total" | ...
 */
export type LedgerMarketType = string;

export type LedgerPick = {
  id: string;
  /** /games 연동 시 채움. 수기·마이그레이션은 null */
  gameId: string | null;
  /** 픽 단위 종목. 같은 티켓 안에서도 서로 다를 수 있다 */
  sport: LedgerSport;
  league: string;
  homeTeam: string;
  awayTeam: string;
  selectionType: LedgerSelectionType;
  selectionLabel: string;
  /**
   * 향후 확장 필드 (MVP 미사용 가능).
   * 예: moneyline / spread / total
   */
  marketType?: LedgerMarketType | null;
  /** 향후 핸디·오버언더 라인 등 (MVP 미사용 가능) */
  line?: number | null;
  /** 소수점 배당 (1 이상) */
  odds: number;
  resultStatus: LedgerPickStatus;
};

/**
 * 티켓에는 sport 필드를 두지 않는다.
 * 종목은 각 pick 이 가지며, 혼합 종목(야구+축구 등) 티켓을 허용한다.
 */
export type LedgerTicket = {
  id: string;
  /** YYYY-MM-DD (KST) */
  betDate: string;
  picks: LedgerPick[];
  /** 원 단위 정수 — 티켓 단위 베팅금 */
  stake: number;
  /**
   * 종목과 무관하게 유효한 pick.odds 를 모두 곱한 값.
   * 단폴이면 그 픽 배당과 동일.
   */
  combinedOdds: number;
  /** 원 단위 반올림(stake × combinedOdds) */
  expectedReturn: number;
  resultStatus: LedgerTicketStatus;
  /**
   * 실제 환급액 (원 단위 정수).
   * null = 미입력 (상태별 기본 규칙으로 계산)
   */
  actualReturn: number | null;
  source: LedgerBetSource;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type LedgerStoreV2 = {
  version: 2;
  tickets: LedgerTicket[];
  budget: LedgerBudgetSettings;
};

export const LEDGER_STORAGE_KEY = "yang-edge:private-ledger:v1";

/** 마이그레이션 직전 v1 raw 1회 보존. 이미 있으면 덮어쓰지 않음 */
export const LEDGER_STORAGE_BACKUP_BEFORE_V2_KEY =
  "yang-edge:private-ledger:v1:backup-before-v2";

/** 자동 정산 직전 raw 백업 (정산 실행마다 갱신) */
export const LEDGER_STORAGE_BACKUP_BEFORE_SETTLE_KEY =
  "yang-edge:private-ledger:v1:backup-before-settle";

export const DEFAULT_LEDGER_BUDGET: LedgerBudgetSettings = {
  monthlyBudget: null,
  unitStakeLimit: null,
  dailyLossLimit: null,
  monthlyLossLimit: null,
};

/** UI 호환용 빈 v1 뷰 (useSyncExternalStore getServerSnapshot) */
export const EMPTY_LEDGER_STORE: LedgerStoreV1 = {
  version: 1,
  bets: [],
  budget: { ...DEFAULT_LEDGER_BUDGET },
};

export const EMPTY_LEDGER_STORE_V2: LedgerStoreV2 = {
  version: 2,
  tickets: [],
  budget: { ...DEFAULT_LEDGER_BUDGET },
};

/** EDGE 제품 지원 4종목 — 신규 선택 UI의 첫 그룹 (기록 분류 라벨) */
export const LEDGER_EDGE_SPORT_OPTIONS: {
  id: Exclude<LedgerSportKnown, "ice-hockey" | "other">;
  label: string;
}[] = [
  { id: "baseball", label: "야구" },
  { id: "football", label: "축구" },
  { id: "basketball", label: "농구" },
  { id: "volleyball", label: "배구" },
];

/** 개인 기록용 — AI 분석 대상 아님 */
export const LEDGER_PERSONAL_SPORT_OPTIONS: {
  id: Extract<LedgerSportKnown, "other">;
  label: string;
}[] = [{ id: "other", label: "기타" }];

/** 레거시 전용 — 신규 선택 불가, 기존 값 표시·편집만 */
export const LEDGER_LEGACY_SPORT_OPTIONS: {
  id: Extract<LedgerSportKnown, "ice-hockey">;
  label: string;
}[] = [
  { id: "ice-hockey", label: "아이스하키 (기록용·분석 미지원)" },
];

/** 라벨 조회용 전체 (레거시 포함) */
export const LEDGER_SPORT_OPTIONS: { id: LedgerSportKnown; label: string }[] = [
  ...LEDGER_EDGE_SPORT_OPTIONS,
  ...LEDGER_PERSONAL_SPORT_OPTIONS,
  ...LEDGER_LEGACY_SPORT_OPTIONS,
];

/** 신규 선택에 노출하는 옵션 (ice-hockey 제외) */
export const LEDGER_SPORT_SELECT_OPTIONS: {
  id: Exclude<LedgerSportKnown, "ice-hockey">;
  label: string;
}[] = [...LEDGER_EDGE_SPORT_OPTIONS, ...LEDGER_PERSONAL_SPORT_OPTIONS];

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

export function isLedgerSportKnown(v: string): v is LedgerSportKnown {
  return (LEDGER_SPORTS as readonly string[]).includes(v);
}

export function isLedgerLegacySport(v: string): boolean {
  return v === "ice-hockey";
}

export function ledgerSportLabel(sport: LedgerSport): string {
  return LEDGER_SPORT_OPTIONS.find((o) => o.id === sport)?.label ?? sport;
}

/**
 * 종목 select 옵션 — 현재 값이 레거시면 해당 옵션만 추가해 crash/강제 변환 방지.
 */
export function ledgerSportSelectOptionsForValue(current: string): {
  edge: typeof LEDGER_EDGE_SPORT_OPTIONS;
  personal: typeof LEDGER_PERSONAL_SPORT_OPTIONS;
  legacy: typeof LEDGER_LEGACY_SPORT_OPTIONS | [];
} {
  return {
    edge: LEDGER_EDGE_SPORT_OPTIONS,
    personal: LEDGER_PERSONAL_SPORT_OPTIONS,
    legacy: isLedgerLegacySport(current) ? LEDGER_LEGACY_SPORT_OPTIONS : [],
  };
}

export function ledgerStatusLabel(status: LedgerBetStatus): string {
  return LEDGER_STATUS_OPTIONS.find((o) => o.id === status)?.label ?? status;
}

export function ledgerSourceLabel(source: LedgerBetSource): string {
  return LEDGER_SOURCE_OPTIONS.find((o) => o.id === source)?.label ?? source;
}
