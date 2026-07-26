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

function formatMarketPercent(value: number): string {
  return Number.isFinite(value) ? `${value}%` : "—";
}

function formatValueEdge(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function hasComparableMarket(pick: TodayPickData): boolean {
  return (
    pick.comparisonAvailable === true &&
    pick.marketProbability != null &&
    Number.isFinite(pick.marketProbability) &&
    pick.valueEdge != null &&
    Number.isFinite(pick.valueEdge)
  );
}

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
  const showMarket = hasComparableMarket(pick);
  const marketProbability = pick.marketProbability;
  const valueEdge = pick.valueEdge;

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

        {showMarket &&
        marketProbability != null &&
        valueEdge != null ? (
          <div className="grid grid-cols-2 gap-4 border-b border-white/[0.06] pb-6 sm:gap-8 sm:pb-8">
            <StatBox
              label="시장 확률"
              value={formatMarketPercent(marketProbability)}
              size="lg"
            />
            <StatBox
              label="Value Edge"
              value={formatValueEdge(valueEdge)}
              accent={valueEdge > 0}
              size="lg"
            />
          </div>
        ) : (
          <p className="border-b border-white/[0.06] pb-6 text-sm leading-relaxed text-zinc-500 sm:pb-8">
            배당이 없거나 경기와 매칭되지 않아 Value Edge를 계산할 수 없습니다.
          </p>
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
