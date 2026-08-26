import Link from "next/link";
import {
  formatKoreanDateTime,
  matchHeaderMeta,
} from "@/lib/public-analysis/format-display";
import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";

type Props = {
  view: PublicGameAnalysisViewV1;
  gamesBackHref: string;
};

export default function PublicAnalysisHeader({ view, gamesBackHref }: Props) {
  const dateTime = formatKoreanDateTime(view.game.dateKst, view.game.startTimeKst);
  const meta = matchHeaderMeta(view.game.league, dateTime);
  const hasTeams = Boolean(view.game.homeTeam && view.game.awayTeam);

  return (
    <header className="space-y-4">
      <Link
        href={gamesBackHref}
        className="inline-flex text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← 경기 목록으로
      </Link>
      {meta ? (
        <p className="text-sm font-medium tracking-wide text-zinc-400">{meta}</p>
      ) : null}
      {hasTeams ? (
        <div className="flex items-center justify-center gap-4 py-2 sm:gap-8">
          <h1 className="min-w-0 flex-1 text-right text-xl font-bold tracking-tight text-white sm:text-2xl">
            {view.game.homeTeam}
          </h1>
          <span className="shrink-0 text-xs font-semibold tracking-widest text-zinc-500">
            VS
          </span>
          <h1 className="min-w-0 flex-1 text-left text-xl font-bold tracking-tight text-white sm:text-2xl">
            {view.game.awayTeam}
          </h1>
        </div>
      ) : (
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          경기 분석
        </h1>
      )}
    </header>
  );
}
