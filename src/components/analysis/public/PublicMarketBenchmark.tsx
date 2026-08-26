import Card from "@/components/ui/Card";
import { formatOdds } from "@/lib/public-analysis/format-display";
import type { PublicMarketBenchmark } from "@/types/public-game-analysis-view";

export default function PublicMarketBenchmark({
  market,
}: {
  market: PublicMarketBenchmark | null;
}) {
  if (!market) return null;
  const homeOdds = formatOdds(market.homeOdds);
  const awayOdds = formatOdds(market.awayOdds);
  const drawOdds = formatOdds(market.drawOdds);
  if (!homeOdds || !awayOdds) return null;

  return (
    <Card as="section" padding="md" className="rounded-xl">
      <h2 className="text-sm font-semibold text-white">시장 참고</h2>
      <p className="mt-1 text-xs text-zinc-500">{market.sourceType}</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-zinc-400">{market.homeTeam}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">
            {homeOdds}
          </p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">{market.awayTeam}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">
            {awayOdds}
          </p>
        </div>
        {drawOdds ? (
          <div className="col-span-2">
            <p className="text-sm text-zinc-400">무승부</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              {drawOdds}
            </p>
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        수집 기준: {market.observedAtLabel}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        {market.referenceNote}
      </p>
    </Card>
  );
}
