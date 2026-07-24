import type { AiPickData } from "@/types/pick";
import Card from "@/components/ui/Card";
import PickCard from "./PickCard";

type PickListProps = {
  picks: AiPickData[];
};

export default function PickList({ picks }: PickListProps) {
  if (picks.length === 0) {
    return (
      <Card padding="none" className="px-6 py-16 text-center">
        <p className="text-sm text-zinc-500">오늘의 EDGE Ranking이 없습니다.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {picks.map((pick) => (
        <PickCard key={pick.gameId} pick={pick} />
      ))}
    </div>
  );
}
