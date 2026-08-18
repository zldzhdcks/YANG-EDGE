import Card from "@/components/ui/Card";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import { getTeamDisplayName } from "@/lib/teams";
import { filterHomeBestPicks } from "@/lib/home/filter-home-best-picks";
import type {
  TodayEdgePick,
  TodayEdgePickSelectionResult,
} from "@/types/today-edge-pick";

type HomeBestPicksProps = {
  result: TodayEdgePickSelectionResult | null;
};

function formatModelProbability(value: number | null): string | null {
  if (value == null) return null;
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(1)}%`;
}

function formatValueEdge(value: number | null): string | null {
  if (value == null) return null;
  const pct = Math.abs(value) > 1 ? value : value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function teamLabel(name: string, league: string): string {
  return getTeamDisplayName({ originalName: name, league });
}

function BestPickCard({ pick }: { pick: TodayEdgePick }) {
  const away = teamLabel(pick.away, pick.league);
  const home = teamLabel(pick.home, pick.league);
  const pickSide = teamLabel(pick.prediction, pick.league);
  const modelProb = formatModelProbability(pick.modelProbability);
  const valueEdge = formatValueEdge(pick.valueEdge);
  const timeLabel = pick.startTimeKst || null;

  return (
    <Card as="article" padding="md" className="flex h-full flex-col">
      <p className="text-xs tracking-wide text-zinc-500">
        {pick.league}
        {timeLabel ? ` · ${timeLabel}` : ""}
      </p>

      <div className="mt-4 text-lg font-semibold leading-snug text-white sm:text-xl">
        <p className="break-words">{away}</p>
        <p className="my-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
          vs
        </p>
        <p className="break-words">{home}</p>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase">
          BEST PICK
        </p>
        <p className="mt-1 text-base font-semibold break-words text-white">
          {pickSide} 승
        </p>
      </div>

      {(modelProb || valueEdge) && (
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
          {modelProb ? (
            <div>
              <dt className="text-[11px] tracking-wide text-zinc-500 uppercase">
                MODEL
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-white">
                {modelProb}
              </dd>
            </div>
          ) : null}
          {valueEdge ? (
            <div>
              <dt className="text-[11px] tracking-wide text-zinc-500 uppercase">
                EDGE
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-white">
                {valueEdge}
              </dd>
            </div>
          ) : null}
        </dl>
      )}

      <AnalysisNavLink
        gameId={pick.gameId}
        className="mt-auto pt-5 text-sm font-medium text-blue-400 hover:text-blue-300 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        분석 보기 →
      </AnalysisNavLink>
    </Card>
  );
}

export default function HomeBestPicks({ result }: HomeBestPicksProps) {
  const picks = filterHomeBestPicks(result);

  return (
    <section
      aria-labelledby="home-best-picks-heading"
      className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16"
    >
      <h2
        id="home-best-picks-heading"
        className="text-xs font-medium tracking-widest text-zinc-400 uppercase"
      >
        오늘의 BEST PICK
      </h2>

      {picks.length === 0 ? (
        <Card padding="lg" className="mt-6">
          <p className="text-lg font-semibold text-white">
            오늘은 기준을 충족한 BEST PICK이 없습니다.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
            경기 데이터는 분석 중이거나, 기준 미달 경기는 PASS 처리됩니다.
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((pick) => (
            <BestPickCard key={pick.gameId} pick={pick} />
          ))}
        </div>
      )}
    </section>
  );
}
