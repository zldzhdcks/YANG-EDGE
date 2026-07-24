import type { GameData } from "@/types/game";
import { getMatchLabel } from "@/types/game";
import Badge from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";

type GameCardProps = {
  game: GameData;
};

export default function GameCard({ game }: GameCardProps) {
  const matchLabel = getMatchLabel(game);

  return (
    <AnalysisNavLink
      gameId={game.id}
      className="group block w-full border-b border-white/[0.06] py-5 first:pt-0 last:border-b-0 last:pb-0"
    >
      <div className="flex items-start justify-between gap-4 rounded-xl px-1 py-1 transition-colors group-hover:bg-white/[0.02] sm:px-3 sm:py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-500">{game.league}</p>
          <h3 className="mt-1 text-base font-semibold text-white sm:text-lg">
            {matchLabel}
          </h3>
          <p className="mt-2 text-sm tabular-nums text-zinc-400">
            {game.startTime}
          </p>
          {game.aiAnalysisAvailable && (
            <Badge variant="muted" className="mt-2 border-0 px-0 py-0">
              EDGE 분석 가능
            </Badge>
          )}
        </div>

        <span
          className={buttonClasses({
            size: "sm",
            className: "h-9 px-4 text-sm group-hover:bg-blue-500",
          })}
        >
          분석
        </span>
      </div>
    </AnalysisNavLink>
  );
}
