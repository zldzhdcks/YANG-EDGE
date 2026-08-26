import type { PublicAvailabilityData } from "@/types/public-game-analysis-view";
import Card from "@/components/ui/Card";

/** Future availability / absence slot. Hidden unless real data exists. */
export default function PublicAvailability({
  availability,
}: {
  availability: PublicAvailabilityData | null;
}) {
  if (!availability) return null;
  return (
    <Card as="section" padding="md" className="rounded-xl">
      <h2 className="text-sm font-semibold text-white">선수·결장</h2>
      <p className="mt-2 text-sm text-zinc-400">{availability.note}</p>
    </Card>
  );
}
