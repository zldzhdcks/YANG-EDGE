"use client";

import { useId, useState, type FormEvent } from "react";
import type { LedgerBet } from "@/types/ledger";
import {
  LEDGER_SOURCE_OPTIONS,
  LEDGER_SPORT_OPTIONS,
  LEDGER_STATUS_OPTIONS,
} from "@/types/ledger";
import { getKstToday } from "@/lib/datetime/kst";
import {
  parseOptionalNumber,
  parseWonAmount,
  type BudgetWarnings,
  type LedgerBetInput,
} from "@/lib/ledger";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type LedgerBetFormProps = {
  initial: LedgerBet | null;
  warnings: BudgetWarnings;
  onDraftStakeChange: (stake: number | null) => void;
  onSubmit: (input: LedgerBetInput) => void;
  onCancel?: () => void;
};

type FieldErrors = Partial<
  Record<
    "betDate" | "matchName" | "selection" | "odds" | "stake" | "settledReturn",
    string
  >
>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-400">{message}</p>;
}

const inputClass =
  "w-full rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const labelClass = "mb-1.5 block text-xs font-medium text-zinc-400";

export default function LedgerBetForm({
  initial,
  warnings,
  onDraftStakeChange,
  onSubmit,
  onCancel,
}: LedgerBetFormProps) {
  const formId = useId();
  const isEdit = initial != null;

  const [betDate, setBetDate] = useState(initial?.betDate ?? getKstToday());
  const [sport, setSport] = useState(initial?.sport ?? "baseball");
  const [league, setLeague] = useState(initial?.league ?? "");
  const [matchName, setMatchName] = useState(initial?.matchName ?? "");
  const [selection, setSelection] = useState(initial?.selection ?? "");
  const [oddsRaw, setOddsRaw] = useState(
    initial ? String(initial.odds) : "",
  );
  const [stakeRaw, setStakeRaw] = useState(
    initial ? String(initial.stake) : "",
  );
  const [status, setStatus] = useState(initial?.status ?? "pending");
  const [settledReturnRaw, setSettledReturnRaw] = useState(
    initial?.settledReturn != null ? String(initial.settledReturn) : "",
  );
  const [source, setSource] = useState(initial?.source ?? "manual");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): LedgerBetInput | null {
    const next: FieldErrors = {};

    if (!/^\d{4}-\d{2}-\d{2}$/.test(betDate)) {
      next.betDate = "날짜 형식을 확인해 주세요.";
    }

    if (matchName.trim() === "") {
      next.matchName = "경기명을 입력해 주세요.";
    }

    if (selection.trim() === "") {
      next.selection = "선택 내용을 입력해 주세요.";
    }

    const odds = parseOptionalNumber(oddsRaw);
    if (odds == null || odds < 1) {
      next.odds = "배당은 1 이상이어야 합니다.";
    }

    const stake = parseWonAmount(stakeRaw);
    if (stake == null || stake <= 0) {
      next.stake = "베팅금은 0보다 큰 원 단위로 입력해 주세요.";
    }

    let settledReturn: number | null = null;
    if (settledReturnRaw.trim() !== "") {
      settledReturn = parseWonAmount(settledReturnRaw);
      if (settledReturn == null) {
        next.settledReturn = "환급액은 0 이상 원 단위로 입력해 주세요.";
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    if (odds == null || stake == null) return null;

    return {
      betDate,
      sport,
      league,
      matchName: matchName.trim(),
      selection: selection.trim(),
      odds,
      stake,
      status,
      settledReturn,
      source,
      memo: memo.trim(),
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input = validate();
    if (!input) return;
    onSubmit(input);
  }

  return (
    <section id="ledger-form" aria-labelledby={`${formId}-title`}>
      <h2
        id={`${formId}-title`}
        className="mb-4 text-sm font-medium tracking-wide text-zinc-500 uppercase"
      >
        {isEdit ? "기록 수정" : "기록 등록"}
      </h2>

      <Card padding="md" className="rounded-xl">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-date`} className={labelClass}>
                베팅일 <span className="text-rose-400">*</span>
              </label>
              <input
                id={`${formId}-date`}
                type="date"
                value={betDate}
                onChange={(e) => setBetDate(e.target.value)}
                className={inputClass}
                required
              />
              <FieldError message={errors.betDate} />
            </div>

            <div>
              <label htmlFor={`${formId}-sport`} className={labelClass}>
                종목
              </label>
              <select
                id={`${formId}-sport`}
                value={sport}
                onChange={(e) =>
                  setSport(e.target.value as typeof sport)
                }
                className={inputClass}
              >
                {LEDGER_SPORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${formId}-league`} className={labelClass}>
                리그
              </label>
              <input
                id={`${formId}-league`}
                type="text"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                placeholder="예: KBO, NPB"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={`${formId}-match`} className={labelClass}>
                경기명 <span className="text-rose-400">*</span>
              </label>
              <input
                id={`${formId}-match`}
                type="text"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                placeholder="예: LG vs 두산"
                className={inputClass}
                required
              />
              <FieldError message={errors.matchName} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-selection`} className={labelClass}>
                선택 내용 <span className="text-rose-400">*</span>
              </label>
              <input
                id={`${formId}-selection`}
                type="text"
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                placeholder="예: 홈 승 / 오버 8.5"
                className={inputClass}
                required
              />
              <FieldError message={errors.selection} />
            </div>

            <div>
              <label htmlFor={`${formId}-odds`} className={labelClass}>
                배당 <span className="text-rose-400">*</span>
              </label>
              <input
                id={`${formId}-odds`}
                type="text"
                inputMode="decimal"
                value={oddsRaw}
                onChange={(e) => setOddsRaw(e.target.value)}
                placeholder="예: 1.85"
                className={inputClass}
                required
              />
              <FieldError message={errors.odds} />
            </div>

            <div>
              <label htmlFor={`${formId}-stake`} className={labelClass}>
                베팅금 (원) <span className="text-rose-400">*</span>
              </label>
              <input
                id={`${formId}-stake`}
                type="text"
                inputMode="numeric"
                value={stakeRaw}
                onChange={(e) => {
                  setStakeRaw(e.target.value);
                  onDraftStakeChange(parseWonAmount(e.target.value));
                }}
                placeholder="예: 10000"
                className={inputClass}
                required
              />
              <FieldError message={errors.stake} />
            </div>

            <div>
              <label htmlFor={`${formId}-status`} className={labelClass}>
                결과 상태
              </label>
              <select
                id={`${formId}-status`}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as typeof status)
                }
                className={inputClass}
              >
                {LEDGER_STATUS_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${formId}-return`} className={labelClass}>
                실제 환급액 (원)
              </label>
              <input
                id={`${formId}-return`}
                type="text"
                inputMode="numeric"
                value={settledReturnRaw}
                onChange={(e) => setSettledReturnRaw(e.target.value)}
                placeholder="비워두면 상태별 기본 규칙 적용"
                className={inputClass}
              />
              <FieldError message={errors.settledReturn} />
            </div>

            <div>
              <label htmlFor={`${formId}-source`} className={labelClass}>
                판단 출처
              </label>
              <select
                id={`${formId}-source`}
                value={source}
                onChange={(e) =>
                  setSource(e.target.value as typeof source)
                }
                className={inputClass}
              >
                {LEDGER_SOURCE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={`${formId}-memo`} className={labelClass}>
                메모
              </label>
              <textarea
                id={`${formId}-memo`}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="선택 사항"
              />
            </div>
          </div>

          {(warnings.unitStakeExceeded ||
            warnings.dailyLossReached ||
            warnings.monthlyLossReached) && (
            <ul className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
              {warnings.unitStakeExceeded ? (
                <li>설정한 1회 기록금액 기준을 초과했습니다.</li>
              ) : null}
              {warnings.dailyLossReached ? (
                <li>
                  오늘 정산된 손실이 설정한 하루 손실 한도에 도달했습니다.
                </li>
              ) : null}
              {warnings.monthlyLossReached ? (
                <li>
                  이번 달 정산된 손실이 설정한 월 손실 한도에 도달했습니다.
                </li>
              ) : null}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" variant="primary" size="md">
              {isEdit ? "수정 저장" : "기록 추가"}
            </Button>
            {onCancel ? (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onCancel}
              >
                수정 취소
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </section>
  );
}
