import type { GameData } from "@/types/game";
import Badge from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import { getDisplayMatchLabel } from "@/lib/teams/aliases";

type GameCardProps = {
  game: GameData;
  /** 리그 그룹 헤더가 있을 때 카드 내 리그 라벨 숨김 */
  hideLeague?: boolean;
};

function GameCardBody({ game, hideLeague = false }: GameCardProps) {
  const matchLabel = getDisplayMatchLabel(game.homeTeam, game.awayTeam);
  const analysisReady = game.aiAnalysisAvailable;

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl px-1 py-1 transition-colors group-hover:bg-white/[0.02] sm:px-3 sm:py-2">
      <div className="min-w-0 flex-1">
        {!hideLeague && (
          <p className="text-xs font-medium text-zinc-500">{game.league}</p>
        )}
        <h3
          className={`text-base font-semibold text-white sm:text-lg ${hideLeague ? "" : "mt-1"}`}
        >
          {matchLabel}
        </h3>
        <p className="mt-2 text-sm tabular-nums text-zinc-400">
          {game.startTime}
        </p>
        {analysisReady && (
          <Badge variant="muted" className="mt-2 border-0 px-0 py-0">
            EDGE 분석 가능
          </Badge>
        )}
      </div>

      {analysisReady ? (
        <span
          className={buttonClasses({
            size: "sm",
            className: "h-9 px-4 text-sm group-hover:bg-blue-500",
          })}
        >
          분석
        </span>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex h-9 shrink-0 cursor-not-allowed items-center rounded-lg border border-white/[0.06] bg-zinc-900/40 px-4 text-sm font-medium text-zinc-600"
        >
          분석 준비중
        </span>
      )}
    </div>
  );
}

export default function GameCard({ game, hideLeague = false }: GameCardProps) {
  const wrapperClass =
    "group block w-full border-b border-white/[0.06] py-5 first:pt-0 last:border-b-0 last:pb-0";

  if (game.aiAnalysisAvailable) {
    return (
      <AnalysisNavLink gameId={game.id} className={wrapperClass}>
        <GameCardBody game={game} hideLeague={hideLeague} />
      </AnalysisNavLink>
    );
  }

  return (
    <div className={wrapperClass}>
      <GameCardBody game={game} hideLeague={hideLeague} />
    </div>
  );
}
