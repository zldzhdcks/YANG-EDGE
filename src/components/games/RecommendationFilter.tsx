import {
  RECOMMENDATION_FILTERS,
  type RecommendationFilterCounts,
  type RecommendationFilterId,
} from "@/lib/games/recommendation-filter";

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
      role="tablist"
      aria-label="추천 등급 필터"
      className="flex gap-1 overflow-x-auto rounded-lg border border-white/[0.08] bg-zinc-900 p-1"
    >
      {RECOMMENDATION_FILTERS.map((filter) => {
        const isActive = value === filter.id;
        const count = counts[filter.id];

        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(filter.id)}
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>{filter.label}</span>
            <span
              className={`ml-1.5 tabular-nums text-xs font-normal ${
                isActive ? "text-blue-100/80" : "text-zinc-500"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
