"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { LedgerBet, LedgerBudgetSettings, LedgerTicket } from "@/types/ledger";
import { getKstToday } from "@/lib/datetime/kst";
import {
  subscribeLedgerStore,
  getServerLedgerStore,
  readLedgerStore,
  addLedgerTicket,
  updateLedgerTicket,
  getLedgerTicketById,
  deleteLedgerBet,
  saveLedgerBudget,
  clearLedgerStore,
  downloadLedgerBackup,
  summarizeBets,
  evaluateBudgetWarnings,
  kstYearMonth,
  validateTicketDraft,
  ticketFromConfirmedDraft,
  addLedgerTicketRecord,
  type LedgerTicketInput,
} from "@/lib/ledger";
import type { LedgerTicketDraft } from "@/types/ledger-draft";
import LedgerSummaryCards from "./LedgerSummaryCards";
import LedgerImageImport from "./LedgerImageImport";
import LedgerDraftReview from "./LedgerDraftReview";
import LedgerTicketForm from "./LedgerTicketForm";
import LedgerBetList from "./LedgerBetList";
import LedgerBudgetPanel from "./LedgerBudgetPanel";
import LedgerDisclaimer from "./LedgerDisclaimer";
import LedgerToolbar from "./LedgerToolbar";

export default function LedgerPageContent() {
  const store = useSyncExternalStore(
    subscribeLedgerStore,
    readLedgerStore,
    getServerLedgerStore,
  );

  const [editing, setEditing] = useState<LedgerTicket | null>(null);
  const [draftStake, setDraftStake] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [draft, setDraft] = useState<LedgerTicketDraft | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [draftSavedMessage, setDraftSavedMessage] = useState<string | null>(null);
  const [importKey, setImportKey] = useState(0);

  const today = getKstToday();
  const monthPrefix = kstYearMonth(today);

  const summary = useMemo(() => summarizeBets(store.bets), [store.bets]);

  const sortedBets = useMemo(() => {
    return [...store.bets].sort((a, b) => {
      const dateDiff = b.betDate.localeCompare(a.betDate);
      if (dateDiff !== 0) return dateDiff;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [store.bets]);

  const warnings = useMemo(
    () =>
      evaluateBudgetWarnings({
        bets: store.bets,
        draftStake,
        todayYmd: today,
        monthPrefix,
        unitStakeLimit: store.budget.unitStakeLimit,
        dailyLossLimit: store.budget.dailyLossLimit,
        monthlyLossLimit: store.budget.monthlyLossLimit,
        monthlyBudget: store.budget.monthlyBudget,
      }),
    [store.bets, store.budget, draftStake, today, monthPrefix],
  );

  function handleSubmit(input: LedgerTicketInput) {
    if (editing) {
      updateLedgerTicket(editing.id, input);
      setEditing(null);
    } else {
      addLedgerTicket(input);
    }
    setFormKey((k) => k + 1);
    setDraftStake(null);
  }

  function handleDraftRecognized(next: LedgerTicketDraft) {
    setDraft(next);
    setDraftSaveError(null);
    setDraftSavedMessage(null);
  }

  function handleDraftChange(next: LedgerTicketDraft) {
    setDraft(validateTicketDraft(next));
    setDraftSaveError(null);
  }

  function handleDraftSave() {
    if (!draft) return;
    const result = ticketFromConfirmedDraft(draft);
    if (!result.ok) {
      setDraft(validateTicketDraft(draft));
      setDraftSaveError(result.error);
      return;
    }
    addLedgerTicketRecord(result.ticket);
    setDraft(null);
    setDraftSaveError(null);
    setDraftSavedMessage("인식 결과를 가계부에 저장했습니다.");
    setImportKey((k) => k + 1);
  }

  function handleDraftCancel() {
    setDraft(null);
    setDraftSaveError(null);
    setDraftSavedMessage(null);
    setImportKey((k) => k + 1);
  }

  function handleEdit(bet: LedgerBet) {
    const ticket = getLedgerTicketById(bet.id);
    if (!ticket) return;
    setEditing(ticket);
    setDraftStake(ticket.stake);
    setFormKey((k) => k + 1);
    if (typeof window !== "undefined") {
      document.getElementById("ledger-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  function handleCancelEdit() {
    setEditing(null);
    setDraftStake(null);
    setFormKey((k) => k + 1);
  }

  function handleDelete(id: string) {
    const ok = window.confirm("이 기록을 삭제할까요? 삭제 후 되돌릴 수 없습니다.");
    if (!ok) return;
    deleteLedgerBet(id);
    if (editing?.id === id) {
      handleCancelEdit();
    }
  }

  function handleBudgetSave(budget: LedgerBudgetSettings) {
    saveLedgerBudget(budget);
  }

  function handleExport() {
    downloadLedgerBackup(`yang-edge-ledger-${today}.json`);
  }

  function handleClearAll() {
    const first = window.confirm(
      "모든 베팅 기록을 삭제할까요?\n\n이 작업은 되돌릴 수 없습니다.",
    );
    if (!first) return;

    const clearBudget = window.confirm(
      "자금관리 설정도 함께 초기화할까요?\n\n확인: 기록 + 설정 모두 삭제\n취소: 기록만 삭제하고 설정은 유지",
    );

    const finalOk = window.confirm(
      clearBudget
        ? "최종 확인: 모든 기록과 자금관리 설정을 삭제합니다. 계속할까요?"
        : "최종 확인: 모든 베팅 기록을 삭제합니다(설정 유지). 계속할까요?",
    );
    if (!finalOk) return;

    clearLedgerStore({ clearBudget });
    handleCancelEdit();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          개인 베팅 가계부
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          직접 구매한 내역을 기록하고 손익을 확인하는 개인용 관리 도구입니다.
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          현재는 로컬 전용 MVP입니다. 데이터는 이 브라우저에만 저장되며, 기기나
          브라우저가 바뀌면 공유되지 않습니다.
        </p>
      </header>

      <LedgerSummaryCards summary={summary} />

      <LedgerBudgetPanel
        budget={store.budget}
        warnings={warnings}
        onSave={handleBudgetSave}
      />

      <div className="space-y-4">
        <LedgerImageImport
          onRecognized={handleDraftRecognized}
          reviewing={draft != null}
          clearSignal={importKey}
        />

        {draftSavedMessage ? (
          <p role="status" className="text-xs text-emerald-400">
            {draftSavedMessage}
          </p>
        ) : null}

        {draft ? (
          <LedgerDraftReview
            key={draft.id}
            draft={draft}
            onChange={handleDraftChange}
            onSave={handleDraftSave}
            onCancel={handleDraftCancel}
            saveError={draftSaveError}
          />
        ) : null}
      </div>

      <LedgerTicketForm
        key={formKey}
        initial={editing}
        warnings={warnings}
        onDraftStakeChange={setDraftStake}
        onSubmit={handleSubmit}
        onCancel={editing ? handleCancelEdit : undefined}
      />

      <LedgerToolbar onExport={handleExport} onClearAll={handleClearAll} />

      <LedgerBetList
        bets={sortedBets}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <LedgerDisclaimer />
    </div>
  );
}
