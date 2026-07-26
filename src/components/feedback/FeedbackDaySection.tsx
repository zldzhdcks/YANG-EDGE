import type { FeedbackDayReview } from "@/types/feedback";
import FeedbackGameCard from "./FeedbackGameCard";

type FeedbackDaySectionProps = {
  day: FeedbackDayReview;
};

export default function FeedbackDaySection({ day }: FeedbackDaySectionProps) {
  return (
    <section aria-labelledby={`feedback-day-${day.meta.dateKst}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id={`feedback-day-${day.meta.dateKst}`}
            className="text-sm font-medium tracking-wide text-zinc-500 uppercase"
          >
            {day.meta.dateKst}
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            예측 {day.meta.totalPredictions} · 채점 {day.meta.gradedGames} · 적중{" "}
            {day.meta.signalWorked} · 실패 {day.meta.signalFailed}
            {day.meta.inconclusive > 0
              ? ` · 미결 ${day.meta.inconclusive}`
              : ""}
          </p>
        </div>
      </div>

      {day.reviews.length === 0 ? (
        <p className="text-sm text-zinc-500">이 날짜의 리뷰 항목이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {day.reviews.map((review) => (
            <FeedbackGameCard key={review.gameId} review={review} />
          ))}
        </div>
      )}

      {day.meta.limitations.length > 0 ? (
        <aside className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
          <h3 className="text-xs font-medium tracking-wide text-zinc-500">
            이 날짜 리뷰의 한계
          </h3>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-600 sm:text-xs">
            {day.meta.limitations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
      ) : null}
    </section>
  );
}
