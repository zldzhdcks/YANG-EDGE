import type { AiPickData } from "@/types/pick";
import Badge from "@/components/ui/Badge";
import StatBox from "@/components/ui/StatBox";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import { cn } from "@/utils/cn";

type PickCardProps = {
  pick: AiPickData;
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating}점`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < rating;
        return (
          <span
            key={index}
            className={`text-sm ${filled ? "text-blue-400" : "text-zinc-700"}`}
            aria-hidden
          >
            {filled ? "★" : "☆"}
          </span>
        );
      })}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const isTop = rank === 1;

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border",
        isTop
          ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
          : "border-white/[0.08] bg-zinc-950 text-zinc-400",
      )}
    >
      <span className="text-[10px] font-medium tracking-wide uppercase">
        {rank}위
      </span>
      <span
        className={cn(
          "text-lg font-bold tabular-nums leading-none",
          isTop ? "text-blue-400" : "text-white",
        )}
      >
        {rank}
      </span>
    </div>
  );
}

export default function PickCard({ pick }: PickCardProps) {
  const isTop = pick.rank === 1;

  return (
    <AnalysisNavLink
      gameId={pick.gameId}
      className={cn(
        "group block w-full rounded-2xl border p-5 transition-colors sm:p-6",
        isTop
          ? "border-blue-500/25 bg-gradient-to-b from-blue-500/10 to-zinc-900 hover:border-blue-500/40"
          : "border-white/[0.08] bg-zinc-900 hover:border-white/[0.14]",
      )}
    >
      <div className="flex items-start gap-4">
        <RankBadge rank={pick.rank} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-zinc-500">{pick.league}</p>
            {isTop && (
              <Badge
                variant="accent"
                className="px-2 py-0.5 text-[10px] tracking-wide uppercase"
              >
                EDGE Pick
              </Badge>
            )}
          </div>

          <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">
            {pick.pickTeam} 승
          </h2>

          <p className="mt-0.5 text-xs text-zinc-500">
            {pick.homeTeam} vs {pick.awayTeam}
          </p>

          <div className="mt-3">
            <StarRating rating={pick.starRating} />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.06] pt-4">
            <StatBox
              label="Confidence"
              value={pick.confidence}
              size="sm"
              className="[&_p:last-child]:text-[11px]"
            />
            <StatBox
              label="EDGE"
              value={`+${pick.edgeValue}`}
              accent
              size="sm"
              className="[&_p:last-child]:text-[11px]"
            />
            <div className="min-w-0 flex-1 sm:text-right">
              <p className="truncate text-sm text-zinc-300">
                {pick.highlightReason}
              </p>
              <p className="text-[11px] text-zinc-500">추천 이유</p>
            </div>
          </div>
        </div>

        <span
          className="mt-1 hidden shrink-0 text-zinc-600 transition-colors group-hover:text-blue-400 sm:inline"
          aria-hidden
        >
          →
        </span>
      </div>
    </AnalysisNavLink>
  );
}
