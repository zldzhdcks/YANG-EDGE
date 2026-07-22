import type { SportData } from "@/types/sport";
import SportCard from "./SportCard";

type TodayGamesProps = {
  sports: SportData[];
};

export default function TodayGames({ sports }: TodayGamesProps) {
  return (
    <section id="today-games" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <h2 className="mb-6 text-lg font-semibold text-white">오늘 경기</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sports.map((sport) => (
          <SportCard key={sport.id} sport={sport} />
        ))}
      </div>
    </section>
  );
}
