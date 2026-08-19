import type { SportFilter } from "@/types/game";
import { SPORT_FILTERS } from "@/constants/games";
import { cn } from "@/utils/cn";

type LeagueFilterProps = {
  value: SportFilter;
  onChange: (value: SportFilter) => void;
};

export default function LeagueFilter({ value, onChange }: LeagueFilterProps) {
  return (
    <div role="group" aria-label="종목 선택" className="flex flex-wrap gap-1.5">
      {SPORT_FILTERS.map((filter) => {
        const isActive = value === filter.id;

        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(filter.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              isActive
                ? "bg-white/[0.12] font-semibold text-white ring-1 ring-white/20"
                : "font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-white",
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
