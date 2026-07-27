import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import Card from "@/components/ui/Card";
import { getMatchDisplayLabel } from "@/lib/teams";
import type { ResearchSlateGame } from "@/types/today-edge-pick";

type ResearchSlateGamesProps = {
  dateKst: string;
  games: ResearchSlateGame[];
};

export default function ResearchSlateGames({
  dateKst,
  games,
}: ResearchSlateGamesProps) {
  return (
    <section id="next-games" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">다음 경기</h2>
        <p className="text-[11px] text-zinc-500">대상 경기일 {dateKst} KST</p>
      </div>

      <div className="grid gap-3">
        {games.map((game) => {
          const matchLabel = getMatchDisplayLabel(
            game.homeTeam,
            game.awayTeam,
            { league: game.league },
          );

          return (
            <Card key={game.gameId} padding="md" className="rounded-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-zinc-500">
                    {game.league}
                    {game.startTimeKst ? ` · ${game.startTimeKst} KST` : ""}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {matchLabel}
                  </p>
                </div>
                <AnalysisNavLink
                  gameId={game.gameId}
                  className="inline-flex text-sm font-medium text-blue-400 hover:text-blue-300"
                >
                  연구 보기
                  <span aria-hidden>→</span>
                </AnalysisNavLink>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
