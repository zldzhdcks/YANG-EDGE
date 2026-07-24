import type { BudgetOption } from "@/types/toto";
import { cn } from "@/utils/cn";

type BudgetSelectorProps = {
  options: BudgetOption[];
  value: string;
  onChange: (id: string) => void;
};

export default function BudgetSelector({
  options,
  value,
  onChange,
}: BudgetSelectorProps) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
        예산 입력
      </p>
      <div
        role="radiogroup"
        aria-label="예산 선택"
        className="grid grid-cols-3 gap-2"
      >
        {options.map((option) => {
          const isActive = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(option.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
                isActive
                  ? "border-blue-500/50 bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "border-white/[0.08] bg-zinc-900 text-zinc-400 hover:border-white/[0.14] hover:text-white",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
