import type { TodayPickData } from "@/types/todayPick";
import Card from "@/components/ui/Card";
import StatBox from "@/components/ui/StatBox";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import { getMatchDisplayLabel } from "@/lib/teams";
import { TODAY_PICK_MIN_ABS_EDGE } from "@/lib/home/build-home-feed";
import TodayPickStats from "./TodayPickStats";
import TodayPickReasons from "./TodayPickReasons";

type TodayPickProps = {
  pick: TodayPickData | null;
};

export default function TodayPick({ pick }: TodayPickProps) {
  if (!pick) {
    return (
      <section id="today-pick" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <p className="mb-4 text-xs font-medium tracking-widest text-blue-500 uppercase">
          오늘의 EDGE PICK
        </p>

        <Card padding="lg" className="rounded-xl">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            오늘은 추천 기준을 충족한 경기가 없습니다.
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            YANG EDGE는 |EDGE Score| {TODAY_PICK_MIN_ABS_EDGE} 이상인 경기만
            추천합니다.
          </p>
        </Card>
      </section>
    );
  }

  const matchLabel = getMatchDisplayLabel(pick.homeTeam, pick.awayTeam);
  const showMarket =
    pick.comparisonAvailable &&
    pick.marketProbability != null &&
    pick.valueEdge != null;
  const valueEdge = pick.valueEdge ?? 0;
  const valueEdgeLabel = `${valueEdge > 0 ? "+" : ""}${valueEdge.toFixed(1)}%`;

  return (
    <section id="today-pick" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <p className="mb-4 text-xs font-medium tracking-widest text-blue-500 uppercase">
        EDGE Pick
      </p>

      <Card padding="lg" className="rounded-xl">
        <p className="text-xs font-medium text-zinc-500">{pick.league}</p>
        <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
          {matchLabel}
        </h2>

        <TodayPickStats
          aiWinRate={pick.aiWinRate}
          confidence={pick.confidence}
          edgeValue={pick.edgeValue}
        />

        {showMarket && (
          <div className="grid grid-cols-3 gap-4 border-b border-white/[0.06] pb-6 sm:gap-8 sm:pb-8">
            <StatBox
              label="시장 확률"
              value={`${pick.marketProbability}%`}
              size="lg"
            />
            <StatBox
              label="Value Edge"
              value={valueEdgeLabel}
              accent={valueEdge > 0}
              size="lg"
            />
          </div>
        )}

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <TodayPickReasons reasons={pick.reasons} />
          <AnalysisNavLink
            gameId={pick.gameId}
            className="inline-flex w-fit shrink-0 self-end text-sm font-medium whitespace-nowrap text-blue-400 hover:text-blue-300"
          >
            상세 분석
            <span aria-hidden>→</span>
          </AnalysisNavLink>
        </div>
      </Card>
    </section>
  );
}
