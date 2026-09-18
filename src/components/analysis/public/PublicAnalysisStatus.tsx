import Card from "@/components/ui/Card";
import { publicAnalysisStatusLabel } from "@/lib/public-analysis/c-state-display";
import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";

export default function PublicAnalysisStatus({
  view,
}: {
  view: PublicGameAnalysisViewV1;
}) {
  const label = publicAnalysisStatusLabel(
    view.analysis.state,
    view.analysis.officialPredictionAvailable,
  );
  return (
    <Card as="section" padding="md" className="rounded-xl">
      <p className="text-xs font-medium tracking-wide text-zinc-500">
        현재 분석 상태
      </p>
      <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">
        {label}
      </h2>
      <p className="mt-2 text-sm leading-relaxed break-words text-zinc-400">
        {view.analysis.description}
      </p>
    </Card>
  );
}
