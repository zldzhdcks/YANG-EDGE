import Card from "@/components/ui/Card";
import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";

export default function PublicAnalysisDecision({
  view,
}: {
  view: PublicGameAnalysisViewV1;
}) {
  return (
    <Card as="section" padding="md" className="rounded-xl">
      <p className="text-xs font-medium tracking-wide text-zinc-500">
        YANG EDGE 핵심 판단
      </p>
      <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">
        {view.analysis.headline}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {view.analysis.description}
      </p>
    </Card>
  );
}
