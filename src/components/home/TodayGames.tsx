import type { HomeGamesLoadResult } from "@/types/home";
import Card from "@/components/ui/Card";
import SportCard from "./SportCard";

type TodayGamesProps = {
  result: HomeGamesLoadResult;
  /** true면 empty/error 시 큰 카드 대신 한 줄만 표시 */
  compactEmpty?: boolean;
};

export default function TodayGames({ result, compactEmpty }: TodayGamesProps) {
  const emptyLine =
    result.status === "error"
      ? "경기 일정을 불러오지 못했습니다."
      : "오늘 등록된 경기 일정이 없습니다.";

  if (compactEmpty && (result.status === "empty" || result.status === "error")) {
    return (
      <section id="today-games" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <h2 className="mb-2 text-lg font-semibold text-white">오늘 경기</h2>
        <p className="text-sm text-zinc-500">{emptyLine}</p>
      </section>
    );
  }

  return (
    <section id="today-games" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <h2 className="mb-6 text-lg font-semibold text-white">오늘 경기</h2>

      {result.status === "error" ? (
        <Card padding="lg" className="rounded-xl">
          <p className="text-sm text-zinc-400">
            경기 일정을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.
          </p>
        </Card>
      ) : result.status === "empty" ? (
        <Card padding="lg" className="rounded-xl">
          <p className="text-sm text-zinc-400">
            오늘 등록된 경기 일정이 없습니다.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.sports.map((sport) => (
            <SportCard key={sport.id} sport={sport} />
          ))}
        </div>
      )}
    </section>
  );
}
