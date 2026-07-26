import {
  combinePickOdds,
  deriveTicketStatus,
  expectedTicketReturn,
} from "@/lib/ledger/calc";
import {
  DEFAULT_LEDGER_BUDGET,
  EMPTY_LEDGER_STORE_V2,
  type LedgerBet,
  type LedgerPick,
  type LedgerSelectionType,
  type LedgerStoreV1,
  type LedgerStoreV2,
  type LedgerTicket,
} from "@/types/ledger";

/** "A vs B" / "A VS B" 패턴 분리. 실패 시 home=원문, away="" */
export function splitMatchName(matchName: string): {
  homeTeam: string;
  awayTeam: string;
} {
  const trimmed = matchName.trim();
  const m = trimmed.match(/^(.+?)\s+vs\s+(.+)$/i);
  if (!m) {
    return { homeTeam: trimmed, awayTeam: "" };
  }
  const homeTeam = m[1].trim();
  const awayTeam = m[2].trim();
  if (!homeTeam || !awayTeam) {
    return { homeTeam: trimmed, awayTeam: "" };
  }
  return { homeTeam, awayTeam };
}

/**
 * 확실히 판별 가능한 경우만 home/draw/away.
 * 공백 제거 후 비교. 그 외는 other + 원문 라벨.
 */
export function mapSelection(
  selection: string,
): { selectionType: LedgerSelectionType; selectionLabel: string } {
  const selectionLabel = selection.trim();
  const compact = selectionLabel.replace(/\s+/g, "");

  if (compact === "홈승") {
    return { selectionType: "home", selectionLabel };
  }
  if (compact === "원정승") {
    return { selectionType: "away", selectionLabel };
  }
  if (compact === "무") {
    return { selectionType: "draw", selectionLabel };
  }

  return { selectionType: "other", selectionLabel };
}

export function ledgerBetToTicket(bet: LedgerBet): LedgerTicket {
  const { homeTeam, awayTeam } = splitMatchName(bet.matchName);
  const { selectionType, selectionLabel } = mapSelection(bet.selection);

  // 기존 sport 는 티켓이 아니라 pick 에 보존 (티켓에 sport 없음)
  const pick: LedgerPick = {
    id: `${bet.id}-pick-0`,
    gameId: null,
    sport: bet.sport,
    league: bet.league,
    homeTeam,
    awayTeam,
    selectionType,
    selectionLabel,
    odds: bet.odds,
    resultStatus: bet.status,
  };

  const picks = [pick];
  const combinedOdds = combinePickOdds(picks);
  const expectedReturn = expectedTicketReturn(bet.stake, combinedOdds);

  return {
    id: bet.id,
    betDate: bet.betDate,
    picks,
    stake: bet.stake,
    combinedOdds,
    expectedReturn,
    resultStatus: deriveTicketStatus(picks),
    actualReturn: bet.settledReturn,
    source: bet.source,
    memo: bet.memo,
    createdAt: bet.createdAt,
    updatedAt: bet.updatedAt,
  };
}

export function migrateLedgerStoreV1ToV2(store: LedgerStoreV1): LedgerStoreV2 {
  return {
    version: 2,
    tickets: store.bets.map(ledgerBetToTicket),
    budget: {
      monthlyBudget: store.budget.monthlyBudget,
      unitStakeLimit: store.budget.unitStakeLimit,
      dailyLossLimit: store.budget.dailyLossLimit,
      monthlyLossLimit: store.budget.monthlyLossLimit,
    },
  };
}

export function emptyLedgerStoreV2(
  budget: LedgerStoreV2["budget"] = { ...DEFAULT_LEDGER_BUDGET },
): LedgerStoreV2 {
  return {
    ...EMPTY_LEDGER_STORE_V2,
    tickets: [],
    budget: { ...budget },
  };
}
