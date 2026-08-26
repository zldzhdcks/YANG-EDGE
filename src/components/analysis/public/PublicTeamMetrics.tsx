import type { PublicTeamMetricsData } from "@/types/public-game-analysis-view";
import Card from "@/components/ui/Card";

/** Future team metrics slot. Hidden unless real data exists. */
export default function PublicTeamMetrics({
  teamMetrics,
}: {
  teamMetrics: PublicTeamMetricsData | null;
}) {
  if (!teamMetrics) return null;
  return (
    <Card as="section" padding="md" className="rounded-xl">
      <h2 className="text-sm font-semibold text-white">팀 세부 지표</h2>
      <p className="mt-2 text-sm text-zinc-400">{teamMetrics.note}</p>
    </Card>
  );
}
