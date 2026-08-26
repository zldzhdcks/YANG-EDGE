import type { PublicCoachTacticsData } from "@/types/public-game-analysis-view";
import Card from "@/components/ui/Card";

/** Future coach / tactics slot. Hidden unless real data exists. */
export default function PublicCoachTactics({
  coachTactics,
}: {
  coachTactics: PublicCoachTacticsData | null;
}) {
  if (!coachTactics) return null;
  return (
    <Card as="section" padding="md" className="rounded-xl">
      <h2 className="text-sm font-semibold text-white">감독·전술</h2>
      <p className="mt-2 text-sm text-zinc-400">{coachTactics.note}</p>
    </Card>
  );
}
