import {
  RECOMMENDATION_FILTERS,
  type RecommendationFilterCounts,
  type RecommendationFilterId,
} from "@/lib/games/recommendation-filter";
import { cn } from "@/utils/cn";

type RecommendationFilterProps = {
  value: RecommendationFilterId;
  onChange: (value: RecommendationFilterId) => void;
  counts: RecommendationFilterCounts;
};

export default function RecommendationFilter({
  value,
  onChange,
  counts,
}: RecommendationFilterProps) {
  return (
    <div
      role="group"
      aria-label="추천 등급 필터"
      className="flex flex-wrap gap-1.5"
    >
      {RECOMMENDATION_FILTERS.map((filter) => {
        const isActive = value === filter.id;
        const count = counts[filter.id];

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
            <span>{filter.label}</span>
            <span
              className={cn(
                "ml-1.5 tabular-nums text-xs font-normal",
                isActive ? "text-zinc-300" : "text-zinc-500",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
