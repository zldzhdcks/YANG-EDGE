import {
  DEFAULT_LEDGER_BUDGET,
  EMPTY_LEDGER_STORE,
  EMPTY_LEDGER_STORE_V2,
  LEDGER_STORAGE_BACKUP_BEFORE_SETTLE_KEY,
  LEDGER_STORAGE_BACKUP_BEFORE_V2_KEY,
  LEDGER_STORAGE_KEY,
  type LedgerBet,
  type LedgerBetSource,
  type LedgerBetStatus,
  type LedgerBudgetSettings,
  type LedgerPick,
  type LedgerSport,
  type LedgerStoreV1,
  type LedgerStoreV2,
  type LedgerTicket,
  type LedgerTicketStatus,
  type LedgerPickStatus,
  type LedgerSelectionType,
} from "@/types/ledger";
import {
  combinePickOdds,
  deriveTicketStatus,
  expectedTicketReturn,
} from "@/lib/ledger/calc";
import {
  mapSelection,
  migrateLedgerStoreV1ToV2,
  splitMatchName,
} from "@/lib/ledger/migrate-v1-to-v2";
import {
  settleLedgerTickets as settleTicketsPure,
  type LedgerGameResult,
  type SettleLedgerTicketsResult,
} from "@/lib/ledger/settle-tickets-from-results";

const CHANGE_EVENT = "yang-edge:private-ledger-change";

function emitChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeLedgerStore(onStoreChange: () => void): () => void {
  // storage 이벤트는 다른 탭의 모든 localStorage 키에 대해 발생하므로
  // 가계부 키가 실제로 바뀐 경우에만 listener 를 호출한다.
  // (key === null 은 localStorage.clear() — 가계부도 지워지므로 통지)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LEDGER_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

/**
 * SSR용 스냅샷 — useSyncExternalStore 의 getServerSnapshot 은
 * 매 호출 동일 참조를 반환해야 한다 (새 객체 생성 금지).
 * UI는 아직 v1 LedgerBet[] 뷰를 사용한다.
 */
export function getServerLedgerStore(): LedgerStoreV1 {
  return EMPTY_LEDGER_STORE;
}

function isSport(v: unknown): v is LedgerSport {
  // 확장 가능: 비어 있지 않은 string 이면 종목으로 보존
  return typeof v === "string" && v.trim() !== "";
}

function isStatus(v: unknown): v is LedgerBetStatus {
  return (
    v === "pending" || v === "win" || v === "loss" || v === "void"
  );
}

function isSource(v: unknown): v is LedgerBetSource {
  return v === "yang-edge" || v === "manual";
}

function isSelectionType(v: unknown): v is LedgerSelectionType {
  return (
    v === "home" || v === "draw" || v === "away" || v === "other"
  );
}

function parseBet(raw: unknown): LedgerBet | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || o.id.trim() === "") return null;
  if (typeof o.betDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.betDate)) {
    return null;
  }
  if (!isSport(o.sport)) return null;
  if (typeof o.league !== "string") return null;
  if (typeof o.matchName !== "string" || o.matchName.trim() === "") return null;
  if (typeof o.selection !== "string" || o.selection.trim() === "") return null;
  if (typeof o.odds !== "number" || !Number.isFinite(o.odds) || o.odds < 1) {
    return null;
  }
  if (
    typeof o.stake !== "number" ||
    !Number.isFinite(o.stake) ||
    o.stake <= 0 ||
    !Number.isInteger(o.stake)
  ) {
    return null;
  }
  if (!isStatus(o.status)) return null;

  let settledReturn: number | null = null;
  if (o.settledReturn === null || o.settledReturn === undefined) {
    settledReturn = null;
  } else if (
    typeof o.settledReturn === "number" &&
    Number.isFinite(o.settledReturn) &&
    o.settledReturn >= 0 &&
    Number.isInteger(o.settledReturn)
  ) {
    settledReturn = o.settledReturn;
  } else {
    return null;
  }

  if (!isSource(o.source)) return null;
  if (typeof o.memo !== "string") return null;
  if (typeof o.createdAt !== "string") return null;
  if (typeof o.updatedAt !== "string") return null;

  return {
    id: o.id,
    betDate: o.betDate,
    sport: o.sport,
    league: o.league,
    matchName: o.matchName.trim(),
    selection: o.selection.trim(),
    odds: o.odds,
    stake: o.stake,
    status: o.status,
    settledReturn,
    source: o.source,
    memo: o.memo,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function parseBudget(raw: unknown): LedgerBudgetSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LEDGER_BUDGET };
  const o = raw as Record<string, unknown>;

  const readPositiveInt = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
    return Math.round(v);
  };

  return {
    monthlyBudget: readPositiveInt(o.monthlyBudget),
    unitStakeLimit: readPositiveInt(o.unitStakeLimit),
    dailyLossLimit: readPositiveInt(o.dailyLossLimit),
    monthlyLossLimit: readPositiveInt(o.monthlyLossLimit),
  };
}

function parsePick(raw: unknown): LedgerPick | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || o.id.trim() === "") return null;
  if (!(o.gameId === null || typeof o.gameId === "string")) return null;
  if (!isSport(o.sport)) return null;
  if (typeof o.league !== "string") return null;
  if (typeof o.homeTeam !== "string") return null;
  if (typeof o.awayTeam !== "string") return null;
  if (!isSelectionType(o.selectionType)) return null;
  if (typeof o.selectionLabel !== "string" || o.selectionLabel.trim() === "") {
    return null;
  }
  if (typeof o.odds !== "number" || !Number.isFinite(o.odds) || o.odds < 1) {
    return null;
  }
  if (!isStatus(o.resultStatus)) return null;

  let marketType: string | null | undefined;
  if (o.marketType === undefined) {
    marketType = undefined;
  } else if (o.marketType === null) {
    marketType = null;
  } else if (typeof o.marketType === "string") {
    marketType = o.marketType;
  } else {
    return null;
  }

  let line: number | null | undefined;
  if (o.line === undefined) {
    line = undefined;
  } else if (o.line === null) {
    line = null;
  } else if (typeof o.line === "number" && Number.isFinite(o.line)) {
    line = o.line;
  } else {
    return null;
  }

  return {
    id: o.id,
    gameId: o.gameId,
    sport: o.sport,
    league: o.league,
    homeTeam: o.homeTeam,
    awayTeam: o.awayTeam,
    selectionType: o.selectionType,
    selectionLabel: o.selectionLabel.trim(),
    ...(marketType !== undefined ? { marketType } : {}),
    ...(line !== undefined ? { line } : {}),
    odds: o.odds,
    resultStatus: o.resultStatus as LedgerPickStatus,
  };
}

function parseTicket(raw: unknown): LedgerTicket | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.id !== "string" || o.id.trim() === "") return null;
  if (typeof o.betDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.betDate)) {
    return null;
  }
  if (!Array.isArray(o.picks) || o.picks.length === 0) return null;
  const picks = o.picks
    .map(parsePick)
    .filter((p): p is LedgerPick => p !== null);
  if (picks.length === 0) return null;

  if (
    typeof o.stake !== "number" ||
    !Number.isFinite(o.stake) ||
    o.stake <= 0 ||
    !Number.isInteger(o.stake)
  ) {
    return null;
  }
  if (
    typeof o.combinedOdds !== "number" ||
    !Number.isFinite(o.combinedOdds) ||
    o.combinedOdds < 1
  ) {
    return null;
  }
  if (
    typeof o.expectedReturn !== "number" ||
    !Number.isFinite(o.expectedReturn) ||
    o.expectedReturn < 0 ||
    !Number.isInteger(o.expectedReturn)
  ) {
    return null;
  }
  if (!isStatus(o.resultStatus)) return null;

  let actualReturn: number | null = null;
  if (o.actualReturn === null || o.actualReturn === undefined) {
    actualReturn = null;
  } else if (
    typeof o.actualReturn === "number" &&
    Number.isFinite(o.actualReturn) &&
    o.actualReturn >= 0 &&
    Number.isInteger(o.actualReturn)
  ) {
    actualReturn = o.actualReturn;
  } else {
    return null;
  }

  if (!isSource(o.source)) return null;
  if (typeof o.memo !== "string") return null;
  if (typeof o.createdAt !== "string") return null;
  if (typeof o.updatedAt !== "string") return null;

  return {
    id: o.id,
    betDate: o.betDate,
    picks,
    stake: o.stake,
    combinedOdds: o.combinedOdds,
    expectedReturn: o.expectedReturn,
    resultStatus: o.resultStatus as LedgerTicketStatus,
    actualReturn,
    source: o.source,
    memo: o.memo,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function parseStoreV1Object(o: Record<string, unknown>): LedgerStoreV1 {
  const betsRaw = Array.isArray(o.bets) ? o.bets : [];
  const bets = betsRaw
    .map(parseBet)
    .filter((b): b is LedgerBet => b !== null);

  return {
    version: 1,
    bets,
    budget: parseBudget(o.budget),
  };
}

function parseStoreV2Object(o: Record<string, unknown>): LedgerStoreV2 | null {
  if (!Array.isArray(o.tickets)) return null;
  const tickets = o.tickets
    .map(parseTicket)
    .filter((t): t is LedgerTicket => t !== null);

  return {
    version: 2,
    tickets,
    budget: parseBudget(o.budget),
  };
}

export type LoadLedgerStoreV2Result =
  | {
      ok: true;
      store: LedgerStoreV2;
      /** v1 → v2 변환이 이번 로드에서 필요했는지 */
      needsPersist: boolean;
      /** 마이그레이션 직전 원본 raw (needsPersist 일 때만) */
      previousRaw: string | null;
    }
  | {
      ok: false;
      /** JSON 파싱 실패 또는 알 수 없는 스키마 — raw 덮어쓰기 금지 */
      reason: "invalid-json" | "unknown-schema";
    };

/**
 * raw → LedgerStoreV2.
 * 부작용 없음 (localStorage 쓰지 않음).
 */
export function loadLedgerStoreV2FromRaw(
  raw: string | null,
): LoadLedgerStoreV2Result {
  if (!raw) {
    return {
      ok: true,
      store: {
        version: 2,
        tickets: [],
        budget: { ...DEFAULT_LEDGER_BUDGET },
      },
      needsPersist: false,
      previousRaw: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, reason: "invalid-json" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "unknown-schema" };
  }

  const o = parsed as Record<string, unknown>;

  if (o.version === 2 && Array.isArray(o.tickets)) {
    const store = parseStoreV2Object(o);
    if (!store) {
      return { ok: false, reason: "unknown-schema" };
    }
    return {
      ok: true,
      store,
      needsPersist: false,
      previousRaw: null,
    };
  }

  if (o.version === 1 || Array.isArray(o.bets)) {
    const v1 = parseStoreV1Object(o);
    return {
      ok: true,
      store: migrateLedgerStoreV1ToV2(v1),
      needsPersist: true,
      previousRaw: raw,
    };
  }

  return { ok: false, reason: "unknown-schema" };
}

/** v1 UI용: 티켓 → 단일 베팅 뷰 (첫 픽 기준) */
export function ticketToLedgerBet(ticket: LedgerTicket): LedgerBet {
  const pick = ticket.picks[0];
  const matchName =
    pick && pick.awayTeam.trim() !== ""
      ? `${pick.homeTeam} vs ${pick.awayTeam}`
      : (pick?.homeTeam ?? "");

  return {
    id: ticket.id,
    betDate: ticket.betDate,
    sport: pick?.sport ?? "other",
    league: pick?.league ?? "",
    matchName,
    selection: pick?.selectionLabel ?? "",
    odds: pick?.odds ?? ticket.combinedOdds,
    stake: ticket.stake,
    status: ticket.resultStatus,
    settledReturn: ticket.actualReturn,
    source: ticket.source,
    memo: ticket.memo,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

export function adaptStoreV2ToV1(store: LedgerStoreV2): LedgerStoreV1 {
  return {
    version: 1,
    bets: store.tickets.map(ticketToLedgerBet),
    budget: {
      monthlyBudget: store.budget.monthlyBudget,
      unitStakeLimit: store.budget.unitStakeLimit,
      dailyLossLimit: store.budget.dailyLossLimit,
      monthlyLossLimit: store.budget.monthlyLossLimit,
    },
  };
}

/**
 * @deprecated v1 파서. 호환용으로 유지 — 내부적으로 v2 로드 후 어댑트.
 * 파싱 실패 시 빈 v1 (원본 raw는 건드리지 않음 — 호출부가 저장하지 말 것).
 */
export function parseLedgerStore(raw: string | null): LedgerStoreV1 {
  const loaded = loadLedgerStoreV2FromRaw(raw);
  if (!loaded.ok) {
    return {
      ...EMPTY_LEDGER_STORE,
      budget: { ...DEFAULT_LEDGER_BUDGET },
    };
  }
  return adaptStoreV2ToV1(loaded.store);
}

/**
 * getSnapshot 캐시 — useSyncExternalStore 는 같은 저장 상태에서
 * 같은 객체 참조를 요구한다 (매번 새 객체를 만들면 무한 렌더링).
 *
 * localStorage 원문(raw)이 같으면 이전 snapshot 객체를 그대로 반환하고,
 * 원문이 실제로 바뀐 경우에만 새로 파싱한다.
 */
let snapshotRaw: string | null | undefined;
let snapshotStoreV1: LedgerStoreV1 | undefined;
let snapshotStoreV2: LedgerStoreV2 | undefined;

/** 테스트용 스냅샷 캐시 초기화 */
export function resetLedgerSnapshotCacheForTests(): void {
  snapshotRaw = undefined;
  snapshotStoreV1 = undefined;
  snapshotStoreV2 = undefined;
}

function setSnapshot(raw: string | null, storeV2: LedgerStoreV2): LedgerStoreV1 {
  snapshotRaw = raw;
  snapshotStoreV2 = storeV2;
  snapshotStoreV1 = adaptStoreV2ToV1(storeV2);
  return snapshotStoreV1;
}

function backupRawBeforeV2(previousRaw: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = window.localStorage.getItem(
      LEDGER_STORAGE_BACKUP_BEFORE_V2_KEY,
    );
    if (existing != null) return;
    window.localStorage.setItem(
      LEDGER_STORAGE_BACKUP_BEFORE_V2_KEY,
      previousRaw,
    );
  } catch {
    // private mode / quota — 마이그레이션은 계속 진행
  }
}

function persistStoreV2(store: LedgerStoreV2): string | null {
  if (typeof window === "undefined") return null;
  const raw = JSON.stringify(store);
  try {
    window.localStorage.setItem(LEDGER_STORAGE_KEY, raw);
  } catch {
    return null;
  }
  return raw;
}

function writeLedgerStoreV2(store: LedgerStoreV2): void {
  if (typeof window === "undefined") return;
  const raw = persistStoreV2(store);
  if (raw == null) return;
  // emit 전에 스냅샷을 새 raw 로 맞춰 재구독 시 동일 참조 유지
  setSnapshot(raw, store);
  emitChange();
}

export function readLedgerStoreV2(): LedgerStoreV2 {
  if (typeof window === "undefined") {
    return EMPTY_LEDGER_STORE_V2;
  }

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (
    snapshotStoreV2 !== undefined &&
    snapshotStoreV1 !== undefined &&
    raw === snapshotRaw
  ) {
    return snapshotStoreV2;
  }

  const loaded = loadLedgerStoreV2FromRaw(raw);

  if (!loaded.ok) {
    // 원본 raw 보존 — 덮어쓰지 않음. UI에는 빈 뷰.
    snapshotRaw = raw;
    snapshotStoreV2 = {
      version: 2,
      tickets: [],
      budget: { ...DEFAULT_LEDGER_BUDGET },
    };
    snapshotStoreV1 = {
      ...EMPTY_LEDGER_STORE,
      budget: { ...DEFAULT_LEDGER_BUDGET },
    };
    return snapshotStoreV2;
  }

  if (loaded.needsPersist && loaded.previousRaw != null) {
    // getSnapshot/read 경로: localStorage 에 v2 를 1회 기록하되
    // emitChange 는 호출하지 않는다 (구독 중 setState 루프 방지).
    backupRawBeforeV2(loaded.previousRaw);
    const written = persistStoreV2(loaded.store);
    if (written != null) {
      setSnapshot(written, loaded.store);
      return loaded.store;
    }
    // 쓰기 실패 시에도 메모리 스냅샷만 갱신 (원본 raw 유지)
    setSnapshot(raw, loaded.store);
    return loaded.store;
  }

  setSnapshot(raw, loaded.store);
  return loaded.store;
}

export function readLedgerStore(): LedgerStoreV1 {
  if (typeof window === "undefined") {
    return EMPTY_LEDGER_STORE;
  }

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (snapshotStoreV1 !== undefined && raw === snapshotRaw) {
    return snapshotStoreV1;
  }

  readLedgerStoreV2();
  return snapshotStoreV1 ?? EMPTY_LEDGER_STORE;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type LedgerBetInput = {
  betDate: string;
  sport: LedgerSport;
  league: string;
  matchName: string;
  selection: string;
  odds: number;
  stake: number;
  status: LedgerBetStatus;
  settledReturn: number | null;
  source: LedgerBetSource;
  memo: string;
};

function betInputToTicket(
  input: LedgerBetInput,
  ids: { ticketId: string; pickId: string; createdAt: string; updatedAt: string },
): LedgerTicket {
  const { homeTeam, awayTeam } = splitMatchName(input.matchName.trim());
  const { selectionType, selectionLabel } = mapSelection(input.selection);

  const pick: LedgerPick = {
    id: ids.pickId,
    gameId: null,
    sport: input.sport,
    league: input.league.trim(),
    homeTeam,
    awayTeam,
    selectionType,
    selectionLabel,
    odds: input.odds,
    resultStatus: input.status,
  };

  const picks = [pick];
  const combinedOdds = combinePickOdds(picks);
  const expectedReturn = expectedTicketReturn(input.stake, combinedOdds);

  return {
    id: ids.ticketId,
    betDate: input.betDate,
    picks,
    stake: input.stake,
    combinedOdds,
    expectedReturn,
    resultStatus: deriveTicketStatus(picks),
    actualReturn: input.settledReturn,
    source: input.source,
    memo: input.memo.trim(),
    createdAt: ids.createdAt,
    updatedAt: ids.updatedAt,
  };
}

/** UI 호환: v1 베팅 추가 → 내부는 picks 1개 티켓으로 저장 */
export function addLedgerBet(input: LedgerBetInput): LedgerBet {
  const now = new Date().toISOString();
  const ticketId = createId();
  const ticket = betInputToTicket(input, {
    ticketId,
    pickId: `${ticketId}-pick-0`,
    createdAt: now,
    updatedAt: now,
  });

  const store = readLedgerStoreV2();
  writeLedgerStoreV2({ ...store, tickets: [ticket, ...store.tickets] });
  return ticketToLedgerBet(ticket);
}

export function updateLedgerBet(
  id: string,
  input: LedgerBetInput,
): LedgerBet | null {
  const store = readLedgerStoreV2();
  const index = store.tickets.findIndex((t) => t.id === id);
  if (index < 0) return null;

  const prev = store.tickets[index];
  const pickId = prev.picks[0]?.id ?? `${prev.id}-pick-0`;
  const updated = betInputToTicket(input, {
    ticketId: prev.id,
    pickId,
    createdAt: prev.createdAt,
    updatedAt: new Date().toISOString(),
  });

  const tickets = [...store.tickets];
  tickets[index] = updated;
  writeLedgerStoreV2({ ...store, tickets });
  return ticketToLedgerBet(updated);
}

/** 신규 티켓 등록 입력 (v2 CRUD — v1 어댑터 미사용) */
export type LedgerTicketPickInput = {
  sport: LedgerSport;
  league: string;
  /** "A vs B" 또는 단일 경기명 */
  matchName: string;
  selectionType: LedgerSelectionType;
  selectionLabel: string;
  odds: number;
};

export type LedgerTicketInput = {
  betDate: string;
  stake: number;
  source: LedgerBetSource;
  memo: string;
  picks: LedgerTicketPickInput[];
};

function ticketInputToTicket(
  input: LedgerTicketInput,
  ids: {
    ticketId: string;
    pickIds: string[];
    createdAt: string;
    updatedAt: string;
  },
): LedgerTicket {
  const picks: LedgerPick[] = input.picks.map((p, i) => {
    const { homeTeam, awayTeam } = splitMatchName(p.matchName.trim());
    return {
      id: ids.pickIds[i] ?? `${ids.ticketId}-pick-${i}`,
      gameId: null,
      sport: p.sport,
      league: p.league.trim(),
      homeTeam,
      awayTeam,
      selectionType: p.selectionType,
      selectionLabel: p.selectionLabel.trim(),
      odds: p.odds,
      resultStatus: "pending" as const,
    };
  });

  const combinedOdds = combinePickOdds(picks);
  const expectedReturn = expectedTicketReturn(input.stake, combinedOdds);

  return {
    id: ids.ticketId,
    betDate: input.betDate,
    picks,
    stake: input.stake,
    combinedOdds,
    expectedReturn,
    resultStatus: "pending",
    actualReturn: null,
    source: input.source,
    memo: input.memo.trim(),
    createdAt: ids.createdAt,
    updatedAt: ids.updatedAt,
  };
}

export function addLedgerTicket(input: LedgerTicketInput): LedgerTicket {
  const now = new Date().toISOString();
  const ticketId = createId();
  const ticket = ticketInputToTicket(input, {
    ticketId,
    pickIds: input.picks.map((_, i) => `${ticketId}-pick-${i}`),
    createdAt: now,
    updatedAt: now,
  });

  const store = readLedgerStoreV2();
  writeLedgerStoreV2({ ...store, tickets: [ticket, ...store.tickets] });
  return ticket;
}

export function updateLedgerTicket(
  id: string,
  input: LedgerTicketInput,
): LedgerTicket | null {
  const store = readLedgerStoreV2();
  const index = store.tickets.findIndex((t) => t.id === id);
  if (index < 0) return null;

  const prev = store.tickets[index];
  const updated = ticketInputToTicket(input, {
    ticketId: prev.id,
    pickIds: input.picks.map(
      (_, i) => prev.picks[i]?.id ?? `${prev.id}-pick-${i}`,
    ),
    createdAt: prev.createdAt,
    updatedAt: new Date().toISOString(),
  });

  // 수정 시에도 이번 MVP 등록폼은 pending/actualReturn null 로 맞춤
  // (목록 정산 UI는 아직 미개편)

  const tickets = [...store.tickets];
  tickets[index] = updated;
  writeLedgerStoreV2({ ...store, tickets });
  return updated;
}

/**
 * 이미 완성된 LedgerTicket 을 그대로 저장한다.
 * (검수 완료 Draft → ticketFromConfirmedDraft 결과용 — pick.gameId 보존)
 */
export function addLedgerTicketRecord(ticket: LedgerTicket): LedgerTicket {
  const store = readLedgerStoreV2();
  writeLedgerStoreV2({ ...store, tickets: [ticket, ...store.tickets] });
  return ticket;
}

export function getLedgerTicketById(id: string): LedgerTicket | null {
  const store = readLedgerStoreV2();
  return store.tickets.find((t) => t.id === id) ?? null;
}

export function deleteLedgerBet(id: string): boolean {
  const store = readLedgerStoreV2();
  const next = store.tickets.filter((t) => t.id !== id);
  if (next.length === store.tickets.length) return false;
  writeLedgerStoreV2({ ...store, tickets: next });
  return true;
}

export function saveLedgerBudget(budget: LedgerBudgetSettings): void {
  const store = readLedgerStoreV2();
  writeLedgerStoreV2({ ...store, budget });
}

/** 전체 기록 삭제. clearBudget=true 이면 자금관리 설정도 초기화 */
export function clearLedgerStore(options: { clearBudget: boolean }): void {
  const current = readLedgerStoreV2();
  writeLedgerStoreV2({
    version: 2,
    tickets: [],
    budget: options.clearBudget
      ? { ...DEFAULT_LEDGER_BUDGET }
      : { ...current.budget },
  });
}

export type LedgerBackupPayload = {
  exportedAt: string;
  app: "yang-edge";
  kind: "private-ledger";
  version: 1;
  store: LedgerStoreV1;
};

/** UI 호환: 백업 payload 의 store 는 여전히 v1 뷰 */
export function buildLedgerBackup(): LedgerBackupPayload {
  return {
    exportedAt: new Date().toISOString(),
    app: "yang-edge",
    kind: "private-ledger",
    version: 1,
    store: readLedgerStore(),
  };
}

export function downloadLedgerBackup(filename: string): void {
  const payload = buildLedgerBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function backupRawBeforeSettle(raw: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LEDGER_STORAGE_BACKUP_BEFORE_SETTLE_KEY,
      JSON.stringify({
        backedUpAt: new Date().toISOString(),
        raw,
      }),
    );
  } catch {
    // private mode / quota
  }
}

/**
 * 브라우저 가계부 스토어에 경기 결과를 반영한다.
 * - 정산 전 현재 raw 를 backup-before-settle 키에 보존
 * - 변경이 있을 때만 write + emit
 */
export function applyLedgerTicketSettlement(
  gameResults: ReadonlyArray<LedgerGameResult>,
  options?: { now?: string },
): SettleLedgerTicketsResult {
  const current = readLedgerStoreV2();
  const settled = settleTicketsPure(current, gameResults, options);

  if (!settled.changed) {
    return settled;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
      if (raw != null) backupRawBeforeSettle(raw);
    } catch {
      // ignore
    }
  }

  writeLedgerStoreV2(settled.store);
  return settled;
}
