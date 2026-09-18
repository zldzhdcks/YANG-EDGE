import Card from "@/components/ui/Card";
import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";

function formatUnitValue(value: number): string {
  if (value >= 0 && value <= 1) return `${Math.round(value * 1000) / 10}%`;
  return String(value);
}

export default function PublicAnalysisDecision({
  view,
}: {
  view: PublicGameAnalysisViewV1;
}) {
  if (!view.analysis.officialPredictionAvailable) return null;

  return (
    <Card as="section" padding="md" className="rounded-xl">
      <p className="text-xs font-medium tracking-wide text-zinc-500">
        YANG EDGE 핵심 판단
      </p>
      <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">
        {view.analysis.headline}
      </h2>
      <p className="mt-2 text-sm leading-relaxed break-words text-zinc-400">
        {view.analysis.description}
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {view.analysis.predictedSide ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              예측
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-white">
              {view.analysis.predictedSide}
            </dd>
          </div>
        ) : null}
        {view.analysis.probability != null ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              확률
            </dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-white">
              {formatUnitValue(view.analysis.probability)}
            </dd>
          </div>
        ) : null}
        {view.analysis.confidence != null ? (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              확신
            </dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-white">
              {formatUnitValue(view.analysis.confidence)}
            </dd>
          </div>
        ) : null}
      </dl>
    </Card>
  );
}
