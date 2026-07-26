/**
 * readyToSave Draft → LedgerTicket 변환.
 * 인식 메타(sourceText, confidence, image, 티켓번호)는 저장하지 않는다.
 */

import {
  combinePickOdds,
  expectedTicketReturn,
} from "@/lib/ledger/calc";
import { validateTicketDraft } from "@/lib/ledger/validate-ticket-draft";
import type { LedgerTicketDraft } from "@/types/ledger-draft";
import type {
  LedgerBetSource,
  LedgerPick,
  LedgerSelectionType,
  LedgerSport,
  LedgerTicket,
} from "@/types/ledger";

export type TicketFromDraftError = {
  ok: false;
  error: string;
  issues: LedgerTicketDraft["validationIssues"];
};

export type TicketFromDraftSuccess = {
  ok: true;
  ticket: LedgerTicket;
};

export type TicketFromDraftResult =
  | TicketFromDraftSuccess
  | TicketFromDraftError;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * confirmed Draft 만 LedgerTicket 으로 변환.
 * @param draft 검수 완료 Draft (validateTicketDraft 재실행)
 * @param options.id 고정 id (테스트·결정성). 없으면 신규 생성
 * @param options.now ISO timestamp
 */
export function ticketFromConfirmedDraft(
  draft: LedgerTicketDraft,
  options?: { id?: string; now?: string },
): TicketFromDraftResult {
  const validated = validateTicketDraft(draft);
  if (!validated.readyToSave) {
    return {
      ok: false,
      error: "Draft is not readyToSave. Resolve missing/needs-review fields first.",
      issues: validated.validationIssues,
    };
  }

  const now = options?.now ?? new Date().toISOString();
  const ticketId = options?.id ?? createId();

  const betDate = validated.betDate.value!.trim();
  const stake = validated.stake.value!;
  const source = validated.source.value as LedgerBetSource;
  const memo =
    validated.memo.value == null ? "" : String(validated.memo.value);

  const picks: LedgerPick[] = validated.picks.map((p, i) => {
    const gameIdRaw = p.gameId.value;
    const gameId =
      gameIdRaw == null || String(gameIdRaw).trim() === ""
        ? null
        : String(gameIdRaw).trim();

    return {
      id: `${ticketId}-pick-${i}`,
      gameId,
      sport: p.sport.value!.trim() as LedgerSport,
      league: p.league.value == null ? "" : String(p.league.value).trim(),
      homeTeam: p.homeTeam.value!.trim(),
      awayTeam:
        p.awayTeam.value == null ? "" : String(p.awayTeam.value).trim(),
      selectionType: p.selectionType.value as LedgerSelectionType,
      selectionLabel: p.selectionLabel.value!.trim(),
      odds: p.odds.value!,
      resultStatus: "pending" as const,
      // startTime / sourceText / confidence 저장하지 않음
    };
  });

  const combinedOdds = combinePickOdds(picks);
  const expectedReturn = expectedTicketReturn(stake, combinedOdds);

  const ticket: LedgerTicket = {
    id: ticketId,
    betDate,
    picks,
    stake,
    combinedOdds,
    expectedReturn,
    resultStatus: "pending",
    actualReturn: null,
    source,
    memo,
    createdAt: now,
    updatedAt: now,
  };

  return { ok: true, ticket };
}
