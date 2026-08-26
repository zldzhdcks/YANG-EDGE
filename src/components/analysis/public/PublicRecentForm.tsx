import Card from "@/components/ui/Card";
import type { PublicRecentForm } from "@/types/public-game-analysis-view";

export default function PublicRecentForm({
  recentForm,
}: {
  recentForm: PublicRecentForm | null;
}) {
  if (!recentForm) return null;
  return (
    <Card as="section" padding="md" className="rounded-xl">
      <h2 className="text-sm font-semibold text-white">최근 흐름</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-white">{recentForm.home.team}</p>
          <p className="mt-1 text-sm text-zinc-400">{recentForm.home.summary}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-white">{recentForm.away.team}</p>
          <p className="mt-1 text-sm text-zinc-400">{recentForm.away.summary}</p>
        </div>
      </div>
    </Card>
  );
}
