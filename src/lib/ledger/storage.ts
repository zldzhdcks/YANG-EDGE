import {
  DEFAULT_LEDGER_BUDGET,
  EMPTY_LEDGER_STORE,
  LEDGER_STORAGE_KEY,
  type LedgerBet,
  type LedgerBetSource,
  type LedgerBetStatus,
  type LedgerBudgetSettings,
  type LedgerSport,
  type LedgerStoreV1,
} from "@/types/ledger";

const CHANGE_EVENT = "yang-edge:private-ledger-change";

function emitChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeLedgerStore(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function getServerLedgerStore(): LedgerStoreV1 {
  return EMPTY_LEDGER_STORE;
}

function isSport(v: unknown): v is LedgerSport {
  return (
    v === "baseball" ||
    v === "football" ||
    v === "basketball" ||
    v === "other"
  );
}

function isStatus(v: unknown): v is LedgerBetStatus {
  return (
    v === "pending" || v === "win" || v === "loss" || v === "void"
  );
}

function isSource(v: unknown): v is LedgerBetSource {
  return v === "yang-edge" || v === "manual";
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

export function parseLedgerStore(raw: string | null): LedgerStoreV1 {
  if (!raw) return { ...EMPTY_LEDGER_STORE, budget: { ...DEFAULT_LEDGER_BUDGET } };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { ...EMPTY_LEDGER_STORE, budget: { ...DEFAULT_LEDGER_BUDGET } };
    }
    const o = parsed as Record<string, unknown>;
    const betsRaw = Array.isArray(o.bets) ? o.bets : [];
    const bets = betsRaw
      .map(parseBet)
      .filter((b): b is LedgerBet => b !== null);

    return {
      version: 1,
      bets,
      budget: parseBudget(o.budget),
    };
  } catch {
    return { ...EMPTY_LEDGER_STORE, budget: { ...DEFAULT_LEDGER_BUDGET } };
  }
}

export function readLedgerStore(): LedgerStoreV1 {
  if (typeof window === "undefined") {
    return { ...EMPTY_LEDGER_STORE, budget: { ...DEFAULT_LEDGER_BUDGET } };
  }
  try {
    return parseLedgerStore(window.localStorage.getItem(LEDGER_STORAGE_KEY));
  } catch {
    return { ...EMPTY_LEDGER_STORE, budget: { ...DEFAULT_LEDGER_BUDGET } };
  }
}

function writeLedgerStore(store: LedgerStoreV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(store));
    emitChange();
  } catch {
    // private mode / quota
  }
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

export function addLedgerBet(input: LedgerBetInput): LedgerBet {
  const now = new Date().toISOString();
  const bet: LedgerBet = {
    id: createId(),
    betDate: input.betDate,
    sport: input.sport,
    league: input.league.trim(),
    matchName: input.matchName.trim(),
    selection: input.selection.trim(),
    odds: input.odds,
    stake: input.stake,
    status: input.status,
    settledReturn: input.settledReturn,
    source: input.source,
    memo: input.memo.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const store = readLedgerStore();
  writeLedgerStore({ ...store, bets: [bet, ...store.bets] });
  return bet;
}

export function updateLedgerBet(
  id: string,
  input: LedgerBetInput,
): LedgerBet | null {
  const store = readLedgerStore();
  const index = store.bets.findIndex((b) => b.id === id);
  if (index < 0) return null;

  const prev = store.bets[index];
  const updated: LedgerBet = {
    ...prev,
    betDate: input.betDate,
    sport: input.sport,
    league: input.league.trim(),
    matchName: input.matchName.trim(),
    selection: input.selection.trim(),
    odds: input.odds,
    stake: input.stake,
    status: input.status,
    settledReturn: input.settledReturn,
    source: input.source,
    memo: input.memo.trim(),
    updatedAt: new Date().toISOString(),
  };

  const bets = [...store.bets];
  bets[index] = updated;
  writeLedgerStore({ ...store, bets });
  return updated;
}

export function deleteLedgerBet(id: string): boolean {
  const store = readLedgerStore();
  const next = store.bets.filter((b) => b.id !== id);
  if (next.length === store.bets.length) return false;
  writeLedgerStore({ ...store, bets: next });
  return true;
}

export function saveLedgerBudget(budget: LedgerBudgetSettings): void {
  const store = readLedgerStore();
  writeLedgerStore({ ...store, budget });
}

/** 전체 기록 삭제. clearBudget=true 이면 자금관리 설정도 초기화 */
export function clearLedgerStore(options: { clearBudget: boolean }): void {
  const current = readLedgerStore();
  writeLedgerStore({
    version: 1,
    bets: [],
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
