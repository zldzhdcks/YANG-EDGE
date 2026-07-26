import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FeedbackSummary from "@/components/feedback/FeedbackSummary";
import FeedbackDaySection from "@/components/feedback/FeedbackDaySection";
import { loadFeedbackCenterData } from "@/lib/feedback/load-feedback-review";

export const metadata: Metadata = {
  title: "EDGE 피드백 센터 | YANG EDGE",
  description:
    "저장된 예측과 실제 결과를 비교해 신호가 작동했는지 검토합니다.",
};

export default async function FeedbackPage() {
  const data = await loadFeedbackCenterData();
  const empty = data.days.length === 0;

  return (
    <>
      <Header />
      <main>
        <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              EDGE 피드백 센터
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              저장된 예측과 실제 결과를 비교해 신호가 작동했는지 검토합니다.
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              분석과 기록은 참고용입니다. 적중·실패만으로 엔진 성능을 단정하지
              않으며, 이 페이지는 모델 재학습 결과가 아닙니다.
            </p>
          </header>

          {empty ? (
            <p className="rounded-xl border border-white/[0.08] bg-zinc-900 px-5 py-8 text-sm text-zinc-400">
              아직 채점된 예측 리뷰가 없습니다.
            </p>
          ) : (
            <>
              <FeedbackSummary summary={data.summary} />
              <div className="space-y-12">
                {data.days.map((day) => (
                  <FeedbackDaySection key={day.meta.dateKst} day={day} />
                ))}
              </div>
            </>
          )}

          <aside className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 sm:px-5">
            <h2 className="text-xs font-medium tracking-wide text-zinc-500">
              이용 안내
            </h2>
            <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-zinc-600 sm:text-xs">
              <li>
                이 페이지는 저장된 예측 스냅샷과 사후 리뷰를 확인하는 참고용
                도구입니다.
              </li>
              <li>
                적중률은 표본이 적을 때 엔진 성능을 판단하는 지표로 쓰지
                않습니다.
              </li>
              <li>
                실패 경기의 &quot;검토가 필요한 가능성&quot;은 원인을 확정하지
                않습니다.
              </li>
              <li>베팅 참여나 수익을 권유하거나 보장하지 않습니다.</li>
            </ul>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
