"use client";

import { useId, useState, type FormEvent } from "react";
import type { LedgerBudgetSettings } from "@/types/ledger";
import {
  formatKrw,
  formatPercent,
  parseWonAmount,
  type BudgetWarnings,
} from "@/lib/ledger";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type LedgerBudgetPanelProps = {
  budget: LedgerBudgetSettings;
  warnings: BudgetWarnings;
  onSave: (budget: LedgerBudgetSettings) => void;
};

const inputClass =
  "w-full rounded-lg border border-white/[0.08] bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const labelClass = "mb-1.5 block text-xs font-medium text-zinc-400";

function toRaw(value: number | null): string {
  return value == null ? "" : String(value);
}

export default function LedgerBudgetPanel({
  budget,
  warnings,
  onSave,
}: LedgerBudgetPanelProps) {
  const id = useId();
  // budget 변경(전체 삭제 등) 시 폼을 리셋하기 위해 key로 마운트 분리
  return (
    <BudgetForm
      key={[
        budget.monthlyBudget,
        budget.unitStakeLimit,
        budget.dailyLossLimit,
        budget.monthlyLossLimit,
      ].join("|")}
      id={id}
      budget={budget}
      warnings={warnings}
      onSave={onSave}
    />
  );
}

function BudgetForm({
  id,
  budget,
  warnings,
  onSave,
}: {
  id: string;
  budget: LedgerBudgetSettings;
  warnings: BudgetWarnings;
  onSave: (budget: LedgerBudgetSettings) => void;
}) {
  const [monthlyBudget, setMonthlyBudget] = useState(toRaw(budget.monthlyBudget));
  const [unitStakeLimit, setUnitStakeLimit] = useState(
    toRaw(budget.unitStakeLimit),
  );
  const [dailyLossLimit, setDailyLossLimit] = useState(
    toRaw(budget.dailyLossLimit),
  );
  const [monthlyLossLimit, setMonthlyLossLimit] = useState(
    toRaw(budget.monthlyLossLimit),
  );
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  function parseField(raw: string): number | null | "invalid" {
    if (raw.trim() === "") return null;
    const n = parseWonAmount(raw);
    if (n == null || n <= 0) return "invalid";
    return n;
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    setSavedHint(false);

    const monthly = parseField(monthlyBudget);
    const unit = parseField(unitStakeLimit);
    const daily = parseField(dailyLossLimit);
    const monthLoss = parseField(monthlyLossLimit);

    if (
      monthly === "invalid" ||
      unit === "invalid" ||
      daily === "invalid" ||
      monthLoss === "invalid"
    ) {
      setError("금액은 비워두거나 0보다 큰 원 단위로 입력해 주세요.");
      return;
    }

    setError(null);
    onSave({
      monthlyBudget: monthly,
      unitStakeLimit: unit,
      dailyLossLimit: daily,
      monthlyLossLimit: monthLoss,
    });
    setSavedHint(true);
  }

  const usageRatio = warnings.monthlyBudgetUsageRatio;
  const usageLabel =
    usageRatio == null ? null : formatPercent(Math.round(usageRatio * 1000) / 10);

  return (
    <section aria-labelledby={`${id}-title`}>
      <h2
        id={`${id}-title`}
        className="mb-4 text-sm font-medium tracking-wide text-zinc-500 uppercase"
      >
        자금관리 기준
      </h2>

      <Card padding="md" className="rounded-xl">
        <p className="mb-4 text-xs leading-relaxed text-zinc-500">
          선택 입력입니다. 기준을 초과해도 기록을 막지 않으며, 중립적인 안내만
          표시합니다. 베팅 금액을 추천하거나 유도하지 않습니다.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-monthly`} className={labelClass}>
                월 베팅 예산 (원)
              </label>
              <input
                id={`${id}-monthly`}
                type="text"
                inputMode="numeric"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className={inputClass}
                placeholder="비워두면 미설정"
              />
            </div>
            <div>
              <label htmlFor={`${id}-unit`} className={labelClass}>
                1회 기록금액 기준 (원)
              </label>
              <input
                id={`${id}-unit`}
                type="text"
                inputMode="numeric"
                value={unitStakeLimit}
                onChange={(e) => setUnitStakeLimit(e.target.value)}
                className={inputClass}
                placeholder="비워두면 미설정"
              />
            </div>
            <div>
              <label htmlFor={`${id}-daily`} className={labelClass}>
                하루 손실 한도 (원)
              </label>
              <input
                id={`${id}-daily`}
                type="text"
                inputMode="numeric"
                value={dailyLossLimit}
                onChange={(e) => setDailyLossLimit(e.target.value)}
                className={inputClass}
                placeholder="비워두면 미설정"
              />
            </div>
            <div>
              <label htmlFor={`${id}-month-loss`} className={labelClass}>
                월 손실 한도 (원)
              </label>
              <input
                id={`${id}-month-loss`}
                type="text"
                inputMode="numeric"
                value={monthlyLossLimit}
                onChange={(e) => setMonthlyLossLimit(e.target.value)}
                className={inputClass}
                placeholder="비워두면 미설정"
              />
            </div>
          </div>

          {usageLabel != null ? (
            <p className="text-xs text-zinc-500">
              이번 달 베팅금(대기 포함){" "}
              <span className="tabular-nums text-zinc-300">
                {formatKrw(warnings.monthlyStakeTotal)}
              </span>
              {" · "}
              월 예산 대비 사용률{" "}
              <span className="tabular-nums text-zinc-300">{usageLabel}</span>
            </p>
          ) : null}

          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          {savedHint ? (
            <p className="text-xs text-emerald-400/90">설정을 저장했습니다.</p>
          ) : null}

          <Button type="submit" variant="secondary" size="sm">
            기준 저장
          </Button>
        </form>
      </Card>
    </section>
  );
}
