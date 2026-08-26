import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";

export default function PublicAnalysisFooter({
  view,
}: {
  view: PublicGameAnalysisViewV1;
}) {
  return (
    <p className="text-xs leading-relaxed text-zinc-600">{view.meta.disclaimer}</p>
  );
}
