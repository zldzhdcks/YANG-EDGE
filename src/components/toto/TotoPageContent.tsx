"use client";

import { useMemo, useState } from "react";
import type { BudgetOption, TotoRoundData } from "@/types/toto";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import TotoHeader from "./TotoHeader";
import BudgetSelector from "./BudgetSelector";
import AutoCombineButton from "./AutoCombineButton";
import TotoMatchList from "./TotoMatchList";

type TotoPageContentProps = {
  round: TotoRoundData;
  budgetOptions: BudgetOption[];
};

export default function TotoPageContent({
  round,
  budgetOptions,
}: TotoPageContentProps) {
  const [budgetId, setBudgetId] = useState(budgetOptions[1]?.id ?? "10k");
  const [isGenerated, setIsGenerated] = useState(false);

  const selectedBudget = useMemo(
    () => budgetOptions.find((option) => option.id === budgetId),
    [budgetOptions, budgetId],
  );

  const singleCount = round.matches.filter((m) => m.betType === "단식").length;
  const doubleCount = round.matches.filter((m) => m.betType === "복식").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <TotoHeader
        round={round.round}
        deadlineLabel={round.deadlineLabel}
        matchCount={round.matches.length}
      />

      <Card
        as="section"
        padding="md"
        className="mb-8 bg-gradient-to-b from-zinc-900 to-zinc-950"
      >
        <BudgetSelector
          options={budgetOptions}
          value={budgetId}
          onChange={(id) => {
            setBudgetId(id);
            setIsGenerated(false);
          }}
        />

        <div className="mt-5">
          <AutoCombineButton
            isGenerated={isGenerated}
            onClick={() => setIsGenerated(true)}
          />
        </div>

        {isGenerated && selectedBudget && (
          <Badge
            variant="accent"
            className="mt-4 block w-full rounded-xl border-blue-500/20 px-4 py-3 text-left"
          >
            <span className="block text-sm font-medium text-blue-300">
              {selectedBudget.label} 기준 조합이 생성되었습니다
            </span>
            <span className="mt-1 block text-xs text-blue-400/80">
              단식 {singleCount}경기 · 복식 {doubleCount}경기 · EDGE Pick 기준
            </span>
          </Badge>
        )}
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">경기 리스트</h2>
        <p className="text-xs text-zinc-500">{round.matches.length}경기</p>
      </div>

      <TotoMatchList matches={round.matches} />
    </div>
  );
}
