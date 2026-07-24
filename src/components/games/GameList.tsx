import type { GameData } from "@/types/game";
import Card from "@/components/ui/Card";
import GameCard from "./GameCard";

type GameListProps = {
  games: GameData[];
};

export default function GameList({ games }: GameListProps) {
  if (games.length === 0) {
    return (
      <Card padding="none" className="rounded-xl px-6 py-16 text-center">
        <p className="text-sm font-medium text-zinc-400">
          조건에 맞는 경기가 없습니다.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          검색어나 종목, 날짜를 변경해 보세요.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none" className="rounded-xl px-4 sm:px-6">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </Card>
  );
}
