import type { SportFilter } from "@/types/game";
import { SPORT_FILTERS } from "@/constants/games";

type LeagueFilterProps = {
  value: SportFilter;
  onChange: (value: SportFilter) => void;
};

export default function LeagueFilter({ value, onChange }: LeagueFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="종목 선택"
      className="flex gap-1 overflow-x-auto rounded-lg border border-white/[0.08] bg-zinc-900 p-1"
    >
      {SPORT_FILTERS.map((filter) => {
        const isActive = value === filter.id;

        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(filter.id)}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
