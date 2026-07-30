"use client";

import { useState, useCallback } from "react";
import type { OperatorActionCard } from "@/lib/internal/research-lab-presenter";
import type { UserStatus } from "@/lib/internal/research-task-state";
import { useResearchTaskState } from "@/hooks/useResearchTaskState";

type FilterKey = "all" | "todo" | "in_progress" | "deferred" | "completed" | "resolved";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todo", label: "해야 할 일" },
  { key: "in_progress", label: "진행 중" },
  { key: "all", label: "전체" },
  { key: "deferred", label: "보류" },
  { key: "completed", label: "완료" },
  { key: "resolved", label: "자동 해결" },
];

const STATUS_LABELS: Record<UserStatus, string> = {
  TODO: "해야 함",
  IN_PROGRESS: "진행 중",
  ACKNOWLEDGED: "확인함",
  DEFERRED: "보류",
  COMPLETED: "완료",
};

function priorityColor(s: string): string {
  switch (s) {
    case "CRITICAL": return "text-red-400";
    case "HIGH": return "text-amber-400";
    case "NORMAL": return "text-blue-400";
    default: return "text-zinc-500";
  }
}

function userStatusColor(s: UserStatus): string {
  switch (s) {
    case "TODO": return "text-zinc-400";
    case "IN_PROGRESS": return "text-blue-400";
    case "ACKNOWLEDGED": return "text-green-400";
    case "DEFERRED": return "text-amber-400";
    case "COMPLETED": return "text-green-400";
  }
}

type Props = {
  cards: OperatorActionCard[];
  dateKst: string;
};

export default function OperatorTaskList({ cards, dateKst }: Props) {
  const { states, corrupted, updateStatus, updateNote, reset, resetAll } =
    useResearchTaskState(dateKst);
  const [filter, setFilter] = useState<FilterKey>("todo");
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const getUserStatus = useCallback(
    (taskKey: string): UserStatus => states[taskKey]?.userStatus ?? "TODO",
    [states],
  );

  const getNote = useCallback(
    (taskKey: string): string => states[taskKey]?.note ?? "",
    [states],
  );

  const handleStatusChange = useCallback(
    (card: OperatorActionCard, newStatus: UserStatus) => {
      if (newStatus === "COMPLETED" && card.systemStatus === "OPEN") {
        setConfirmKey(card.taskKey);
        return;
      }
      updateStatus(card.taskKey, card.taskType, card.relatedEntityId, newStatus);
    },
    [updateStatus],
  );

  const confirmComplete = useCallback(
    (card: OperatorActionCard) => {
      updateStatus(card.taskKey, card.taskType, card.relatedEntityId, "COMPLETED");
      setConfirmKey(null);
    },
    [updateStatus],
  );

  // Filter logic
  const filteredCards = cards.filter((card) => {
    const us = getUserStatus(card.taskKey);
    switch (filter) {
      case "all": return true;
      case "todo": return us === "TODO" || us === "IN_PROGRESS";
      case "in_progress": return us === "IN_PROGRESS";
      case "deferred": return us === "DEFERRED";
      case "completed": return us === "COMPLETED" || us === "ACKNOWLEDGED";
      case "resolved": return card.systemStatus === "RESOLVED";
    }
  });

  // Progress summary
  const total = cards.length;
  const todoCount = cards.filter((c) => getUserStatus(c.taskKey) === "TODO").length;
  const inProgressCount = cards.filter((c) => getUserStatus(c.taskKey) === "IN_PROGRESS").length;
  const completedCount = cards.filter(
    (c) => getUserStatus(c.taskKey) === "COMPLETED" || getUserStatus(c.taskKey) === "ACKNOWLEDGED" || c.systemStatus === "RESOLVED",
  ).length;
  const deferredCount = cards.filter((c) => getUserStatus(c.taskKey) === "DEFERRED").length;
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : null;

  // Critical/High warnings that always show
  const criticalOpen = cards.filter(
    (c) => (c.priority === "CRITICAL" || c.priority === "HIGH") && c.systemStatus === "OPEN",
  );

  return (
    <div className="space-y-4">
      {corrupted && (
        <div className="rounded border border-amber-800 bg-amber-950/30 px-3 py-2 text-xs text-amber-400">
          localStorage 데이터가 손상되었습니다. 상태가 초기화되었습니다.
        </div>
      )}

      {/* Progress summary */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <span className="text-sm font-semibold text-zinc-200">오늘의 업무</span>
        <div className="flex gap-3 text-xs">
          <span className="text-zinc-400">전체 <strong className="text-zinc-200">{total}</strong></span>
          <span className="text-zinc-400">해야 함 <strong className="text-zinc-200">{todoCount}</strong></span>
          <span className="text-blue-400">진행 중 <strong>{inProgressCount}</strong></span>
          <span className="text-green-400">완료 <strong>{completedCount}</strong></span>
          {deferredCount > 0 && <span className="text-amber-400">보류 <strong>{deferredCount}</strong></span>}
        </div>
        {completionRate != null && (
          <span className="text-xs text-zinc-600">완료율 {completionRate}%</span>
        )}
      </div>

      {/* Critical warnings always visible */}
      {criticalOpen.length > 0 && filter !== "all" && filter !== "todo" && (
        <div className="rounded border border-red-800 bg-red-950/30 px-3 py-2 text-xs text-red-400">
          {criticalOpen.length}건의 중요 문제가 아직 해결되지 않았습니다.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setResetConfirm(true)}
          className="rounded px-2 py-1 text-xs text-zinc-600 hover:text-red-400 hover:bg-zinc-800"
        >
          오늘 초기화
        </button>
      </div>

      {/* Reset confirm */}
      {resetConfirm && (
        <div className="rounded border border-red-800 bg-red-950/30 px-4 py-3 text-xs">
          <p className="text-red-400 mb-2">{dateKst}의 모든 업무 상태와 메모를 초기화하시겠습니까?</p>
          <div className="flex gap-2">
            <button
              onClick={() => { resetAll(); setResetConfirm(false); }}
              className="rounded bg-red-800 px-3 py-1 text-white hover:bg-red-700"
            >
              초기화
            </button>
            <button
              onClick={() => setResetConfirm(false)}
              className="rounded bg-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-600"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Task cards */}
      {filteredCards.length === 0 ? (
        <p className="text-sm text-zinc-500">표시할 항목이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {filteredCards.map((card) => (
            <TaskCard
              key={card.taskKey}
              card={card}
              userStatus={getUserStatus(card.taskKey)}
              note={getNote(card.taskKey)}
              onStatusChange={(s) => handleStatusChange(card, s)}
              onNoteChange={(n) => updateNote(card.taskKey, n)}
              onReset={() => reset(card.taskKey)}
              showConfirm={confirmKey === card.taskKey}
              onConfirmComplete={() => confirmComplete(card)}
              onCancelConfirm={() => setConfirmKey(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

function TaskCard({
  card,
  userStatus,
  note,
  onStatusChange,
  onNoteChange,
  onReset,
  showConfirm,
  onConfirmComplete,
  onCancelConfirm,
}: {
  card: OperatorActionCard;
  userStatus: UserStatus;
  note: string;
  onStatusChange: (s: UserStatus) => void;
  onNoteChange: (n: string) => void;
  onReset: () => void;
  showConfirm: boolean;
  onConfirmComplete: () => void;
  onCancelConfirm: () => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const isCompleted = userStatus === "COMPLETED" || userStatus === "ACKNOWLEDGED";
  const systemResolved = card.systemStatus === "RESOLVED";
  const openButCompleted = card.systemStatus === "OPEN" && isCompleted;

  return (
    <div
      className={`rounded-lg border bg-zinc-900/60 px-4 py-3 ${
        isCompleted && !openButCompleted
          ? "border-zinc-800/50 opacity-70"
          : "border-zinc-800"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-semibold ${priorityColor(card.priority)}`}>
          {card.priority}
        </span>
        <span className={`text-sm font-semibold ${isCompleted ? "text-zinc-500 line-through" : "text-zinc-200"}`}>
          {card.title}
        </span>
        <span className={`ml-auto rounded px-1.5 py-0.5 text-xs font-medium ${userStatusColor(userStatus)} bg-zinc-800`}>
          {STATUS_LABELS[userStatus]}
        </span>
      </div>

      {/* System warnings */}
      {systemResolved && (
        <p className="text-xs text-green-500 mb-1">시스템에서 자동 해결됨</p>
      )}
      {openButCompleted && (
        <p className="text-xs text-amber-400 mb-1">
          확인 완료로 표시했지만 시스템 문제는 아직 남아 있습니다.
        </p>
      )}

      {/* Content */}
      <p className="text-xs text-zinc-400">{card.situation}</p>
      {card.reason && <p className="mt-0.5 text-xs text-zinc-500">{card.reason}</p>}
      {card.relatedGame && (
        <p className="mt-0.5 text-xs text-zinc-600 font-mono">{card.relatedGame}</p>
      )}
      {card.nextAction && (
        <div className="mt-1.5 rounded bg-zinc-800/60 px-3 py-1.5">
          <span className="text-xs text-zinc-500">다음 행동: </span>
          <span className="text-xs text-zinc-300">{card.nextAction}</span>
        </div>
      )}
      {card.command && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">
            실행 명령어 보기
          </summary>
          <code className="mt-1 block rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 font-mono select-all">
            {card.command}
          </code>
        </details>
      )}

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="mt-3 rounded border border-amber-800 bg-amber-950/30 px-3 py-2 text-xs">
          <p className="text-amber-400 mb-2">
            이 문제는 시스템상 아직 해결되지 않았습니다.<br />
            업무 확인만 완료한 것으로 표시하시겠습니까?
          </p>
          <div className="flex gap-2">
            <button
              onClick={onConfirmComplete}
              className="rounded bg-amber-800 px-3 py-1 text-white hover:bg-amber-700"
            >
              확인 완료로 표시
            </button>
            <button
              onClick={onCancelConfirm}
              className="rounded bg-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-600"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {userStatus !== "ACKNOWLEDGED" && (
          <button onClick={() => onStatusChange("ACKNOWLEDGED")} className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700">
            확인함
          </button>
        )}
        {userStatus !== "IN_PROGRESS" && (
          <button onClick={() => onStatusChange("IN_PROGRESS")} className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-zinc-700">
            진행 시작
          </button>
        )}
        {userStatus !== "COMPLETED" && (
          <button onClick={() => onStatusChange("COMPLETED")} className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-green-400 hover:text-green-300 hover:bg-zinc-700">
            완료
          </button>
        )}
        {userStatus !== "DEFERRED" && (
          <button onClick={() => onStatusChange("DEFERRED")} className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-zinc-700">
            보류
          </button>
        )}
        {userStatus !== "TODO" && (
          <button onClick={onReset} className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700">
            초기화
          </button>
        )}
        <button
          onClick={() => setShowNote((v) => !v)}
          className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
        >
          {showNote ? "메모 닫기" : note ? "메모 보기" : "메모"}
        </button>
      </div>

      {/* Note */}
      {showNote && (
        <div className="mt-2">
          <textarea
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none resize-none"
            rows={2}
            maxLength={300}
            placeholder="메모를 입력하세요 (최대 300자)"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
          <div className="mt-0.5 text-right text-xs text-zinc-600">{note.length}/300</div>
        </div>
      )}
    </div>
  );
}
