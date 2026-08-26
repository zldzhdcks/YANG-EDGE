import type { PublicLineupData } from "@/types/public-game-analysis-view";
import Card from "@/components/ui/Card";

/** Future lineup slot. Hidden unless real data exists. */
export default function PublicLineup({
  lineup,
}: {
  lineup: PublicLineupData | null;
}) {
  if (!lineup) return null;
  return (
    <Card as="section" padding="md" className="rounded-xl">
      <h2 className="text-sm font-semibold text-white">라인업</h2>
      <p className="mt-2 text-sm text-zinc-400">{lineup.note}</p>
    </Card>
  );
}
