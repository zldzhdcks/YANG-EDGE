/**
 * 가계부 v2 티켓 자동 정산 (순수 함수).
 *
 * - pick.gameId 가 있고 pending 인 픽만 대상
 * - gameId null 수기 기록은 절대 변경하지 않음
 * - 이미 win/loss/void 인 픽은 덮어쓰지 않음
 * - stake / odds / combinedOdds / expectedReturn / selection 등 불변
 * - void(취소) 자동 반영은 TODO — 별도 표시만
 */

import { deriveTicketStatus } from "@/lib/ledger/calc";
import type {
  LedgerPick,
  LedgerPickStatus,
  LedgerStoreV2,
  LedgerTicket,
  LedgerTicketStatus,
  LedgerSelectionType,
} from "@/types/ledger";

/** 외부 경기 결과 상태 (정산 입력) */
export type LedgerGameResultStatus =
  | "finished"
  | "pending"
  | "postponed"
  | "cancelled"
  | "not-found";

export type LedgerGameWinner = "home" | "away" | "draw";

export type LedgerGameResult = {
  gameId: string;
  status: LedgerGameResultStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  /** finished 이고 스코어가 있으면 생략 가능 — 스코어에서 유도 */
  winner?: LedgerGameWinner | null;
};

export type SettlePickChange = {
  ticketId: string;
  pickId: string;
  gameId: string;
  from: LedgerPickStatus;
  to: LedgerPickStatus;
  reason: string;
};

export type SettleTicketChange = {
  ticketId: string;
  fromStatus: LedgerTicketStatus;
  toStatus: LedgerTicketStatus;
  fromActualReturn: number | null;
  toActualReturn: number | null;
};

export type SettleSkipNote = {
  ticketId: string;
  pickId: string;
  gameId: string | null;
  reason:
    | "no-gameId"
    | "not-pending"
    | "selection-other"
    | "game-pending"
    | "game-postponed"
    | "game-cancelled-no-auto-void"
    | "game-not-found"
    | "missing-winner"
    | "no-result-for-gameId";
};

export type SettleLedgerTicketsResult = {
  store: LedgerStoreV2;
  changed: boolean;
  pickChanges: SettlePickChange[];
  ticketChanges: SettleTicketChange[];
  skipped: SettleSkipNote[];
};

function resolveWinner(result: LedgerGameResult): LedgerGameWinner | null {
  if (result.winner === "home" || result.winner === "away" || result.winner === "draw") {
    return result.winner;
  }
  const h = result.homeScore;
  const a = result.awayScore;
  if (
    typeof h === "number" &&
    Number.isFinite(h) &&
    typeof a === "number" &&
    Number.isFinite(a)
  ) {
    if (h > a) return "home";
    if (a > h) return "away";
    return "draw";
  }
  return null;
}

/**
 * selectionType → 픽 결과.
 * other 는 자동 정산 대상이 아님 (호출 전에 걸러야 함).
 */
export function pickStatusFromWinner(
  selectionType: Exclude<LedgerSelectionType, "other">,
  winner: LedgerGameWinner,
): "win" | "loss" {
  if (selectionType === winner) return "win";
  return "loss";
}

export function actualReturnForTicketStatus(
  status: LedgerTicketStatus,
  expectedReturn: number,
): number | null {
  if (status === "loss") return 0;
  if (status === "win") return expectedReturn;
  // pending / void — void 환급 규칙 TODO
  return null;
}

function clonePick(pick: LedgerPick): LedgerPick {
  return { ...pick };
}

function cloneTicket(ticket: LedgerTicket): LedgerTicket {
  return {
    ...ticket,
    picks: ticket.picks.map(clonePick),
  };
}

function cloneStore(store: LedgerStoreV2): LedgerStoreV2 {
  return {
    version: 2,
    budget: { ...store.budget },
    tickets: store.tickets.map(cloneTicket),
  };
}

/**
 * 순수 함수: gameResults 로 스토어의 pending+gameId 픽을 갱신한다.
 * 배당·베팅금·예상환급·선택 내용은 변경하지 않는다.
 */
export function settleLedgerTickets(
  store: LedgerStoreV2,
  gameResults: ReadonlyArray<LedgerGameResult>,
  options?: { now?: string },
): SettleLedgerTicketsResult {
  const now = options?.now ?? new Date().toISOString();
  const byGameId = new Map<string, LedgerGameResult>();
  for (const r of gameResults) {
    if (r.gameId) byGameId.set(r.gameId, r);
  }

  const next = cloneStore(store);
  const pickChanges: SettlePickChange[] = [];
  const ticketChanges: SettleTicketChange[] = [];
  const skipped: SettleSkipNote[] = [];

  for (const ticket of next.tickets) {
    let picksChanged = false;

    for (let i = 0; i < ticket.picks.length; i += 1) {
      const pick = ticket.picks[i];

      if (pick.gameId == null || pick.gameId === "") {
        skipped.push({
          ticketId: ticket.id,
          pickId: pick.id,
          gameId: null,
          reason: "no-gameId",
        });
        continue;
      }

      if (pick.resultStatus !== "pending") {
        skipped.push({
          ticketId: ticket.id,
          pickId: pick.id,
          gameId: pick.gameId,
          reason: "not-pending",
        });
        continue;
      }

      if (pick.selectionType === "other") {
        skipped.push({
          ticketId: ticket.id,
          pickId: pick.id,
          gameId: pick.gameId,
          reason: "selection-other",
        });
        continue;
      }

      const result = byGameId.get(pick.gameId);
      if (!result) {
        skipped.push({
          ticketId: ticket.id,
          pickId: pick.id,
          gameId: pick.gameId,
          reason: "no-result-for-gameId",
        });
        continue;
      }

      if (result.status === "pending") {
        skipped.push({
          ticketId: ticket.id,
          pickId: pick.id,
          gameId: pick.gameId,
          reason: "game-pending",
        });
        continue;
      }

      if (result.status === "postponed") {
        skipped.push({
          ticketId: ticket.id,
          pickId: pick.id,
          gameId: pick.gameId,
          reason: "game-postponed",
        });
        continue;
      }

      if (result.status === "cancelled") {
        // TODO: void 자동 반영 — 현재는 픽/티켓을 바꾸지 않고 표시만
        skipped.push({
          ticketId: ticket.id,
          pickId: pick.id,
          gameId: pick.gameId,
          reason: "game-cancelled-no-auto-void",
        });
        continue;
      }

      if (result.status === "not-found") {
        skipped.push({
          ticketId: ticket.id,
          pickId: pick.id,
          gameId: pick.gameId,
          reason: "game-not-found",
        });
        continue;
      }

      // finished
      const winner = resolveWinner(result);
      if (winner == null) {
        skipped.push({
          ticketId: ticket.id,
          pickId: pick.id,
          gameId: pick.gameId,
          reason: "missing-winner",
        });
        continue;
      }

      const to = pickStatusFromWinner(pick.selectionType, winner);

      ticket.picks[i] = { ...pick, resultStatus: to };
      picksChanged = true;
      pickChanges.push({
        ticketId: ticket.id,
        pickId: pick.id,
        gameId: pick.gameId,
        from: "pending",
        to,
        reason: `finished winner=${winner} selection=${pick.selectionType}`,
      });
    }

    const fromStatus = ticket.resultStatus;
    const fromActual = ticket.actualReturn;
    const toStatus = deriveTicketStatus(ticket.picks);
    const toActual = actualReturnForTicketStatus(toStatus, ticket.expectedReturn);

    if (
      picksChanged ||
      toStatus !== fromStatus ||
      toActual !== fromActual
    ) {
      ticket.resultStatus = toStatus;
      ticket.actualReturn = toActual;
      if (picksChanged || toStatus !== fromStatus || toActual !== fromActual) {
        ticket.updatedAt = now;
      }
      if (toStatus !== fromStatus || toActual !== fromActual) {
        ticketChanges.push({
          ticketId: ticket.id,
          fromStatus,
          toStatus,
          fromActualReturn: fromActual,
          toActualReturn: toActual,
        });
      }
    }
  }

  const changed = pickChanges.length > 0 || ticketChanges.length > 0;

  return {
    store: next,
    changed,
    pickChanges,
    ticketChanges,
    skipped,
  };
}

/** 재실행 안전성: 동일 결과로 두 번 돌리면 changed=false */
export function settleLedgerTicketsIdempotent(
  store: LedgerStoreV2,
  gameResults: ReadonlyArray<LedgerGameResult>,
): boolean {
  const first = settleLedgerTickets(store, gameResults, {
    now: "2026-01-01T00:00:00.000Z",
  });
  const second = settleLedgerTickets(first.store, gameResults, {
    now: "2026-01-01T00:00:00.000Z",
  });
  return !second.changed;
}
