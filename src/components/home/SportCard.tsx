import type { SportData } from "@/types/sport";

type SportCardProps = {
  sport: SportData;
};

export default function SportCard({ sport }: SportCardProps) {
  return (
    <article className="rounded-xl border border-white/[0.08] bg-zinc-900 p-5 sm:p-6">
      <h3 className="text-base font-semibold text-white">{sport.name}</h3>
      <p className="mt-1 text-xs text-zinc-500">{sport.league}</p>

      <div className="mt-5 space-y-3 border-t border-white/[0.06] pt-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">오늘 경기</span>
          <span className="text-sm font-semibold text-white">
            {sport.todayGames}경기
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">AI 분석 완료</span>
          <span className="text-sm font-semibold text-blue-400">
            {sport.analyzedGames}
          </span>
        </div>
      </div>
    </article>
  );
}
