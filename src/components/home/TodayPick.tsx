import type { TodayPickData } from "@/types/todayPick";
import Card from "@/components/ui/Card";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import TodayPickStats from "./TodayPickStats";
import TodayPickReasons from "./TodayPickReasons";

type TodayPickProps = {
  pick: TodayPickData;
};

export default function TodayPick({ pick }: TodayPickProps) {
  return (
    <section id="today-pick" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <p className="mb-4 text-xs font-medium tracking-widest text-blue-500 uppercase">
        EDGE Pick
      </p>

      <Card padding="lg" className="rounded-xl">
        <p className="text-xs font-medium text-zinc-500">{pick.league}</p>
        <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
          {pick.homeTeam} vs {pick.awayTeam}
        </h2>

        <TodayPickStats
          aiWinRate={pick.aiWinRate}
          confidence={pick.confidence}
          edgeValue={pick.edgeValue}
        />

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <TodayPickReasons reasons={pick.reasons} />
          <AnalysisNavLink
            gameId="npb-softbank-orix"
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
