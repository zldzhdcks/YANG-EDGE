import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Card from "@/components/ui/Card";
import StatBox from "@/components/ui/StatBox";
import LearningBucketTable from "@/components/learning/LearningBucketTable";
import { loadLearningDashboard } from "@/lib/learning/load-learning-dashboard";
import { displayAccuracyPercent } from "@/lib/feedback/display";

/** Always read latest data/learning/dashboard.json (post-game export). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learning Dashboard | YANG EDGE",
  description:
    "채점된 예측 피드백을 집계해 신호 패턴을 확인합니다. 모델 재학습 결과가 아닙니다.",
};

export default async function LearningPage() {
  const data = await loadLearningDashboard();
  const overall = data.summary.overallHitRate;
  const accuracy =
    overall?.hitRate != null
      ? displayAccuracyPercent(overall.hitRate)
      : "INSUFFICIENT_SAMPLE";

  return (
    <>
      <Header />
      <main>
        <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Learning Dashboard
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              종료 경기 채점·피드백을 집계해 신호 패턴을 확인합니다.
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              이 페이지는 사후 기록 집계입니다. 모델 재학습·가중치 자동 반영
              결과가 아니며, 적중만으로 엔진 성능을 단정하지 않습니다.
            </p>
          </header>

          {!data.loaded ? (
            <p className="rounded-xl border border-white/[0.08] bg-zinc-900 px-5 py-8 text-sm text-zinc-400">
              아직 Learning Dashboard 집계 파일이 없습니다. 종료 경기 채점
              파이프라인을 실행하세요.
            </p>
          ) : (
            <>
              <section aria-label="학습 집계 요약">
                <h2 className="mb-4 text-sm font-medium tracking-wide text-zinc-500 uppercase">
                  요약
                </h2>
                <Card padding="md" className="rounded-xl">
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
                    <StatBox
                      label="리뷰 수"
                      value={data.summary.totalReviews}
                      size="sm"
                    />
                    <StatBox
                      label="채점 완료"
                      value={data.summary.graded}
                      size="sm"
                    />
                    <StatBox
                      label="SIGNAL_WORKED"
                      value={data.summary.signalWorked}
                      size="sm"
                      valueClassName="font-bold tabular-nums text-emerald-400"
                    />
                    <StatBox
                      label="SIGNAL_FAILED"
                      value={data.summary.signalFailed}
                      size="sm"
                      valueClassName="font-bold tabular-nums text-rose-400"
                    />
                    <StatBox
                      label="INCONCLUSIVE"
                      value={data.summary.inconclusive}
                      size="sm"
                    />
                    <StatBox
                      label="전체 적중률"
                      value={accuracy}
                      size="sm"
                      hint={
                        overall?.status === "INSUFFICIENT_SAMPLE"
                          ? `표본 ${overall.n} · 최소 ${data.meta.minSample}`
                          : undefined
                      }
                    />
                  </div>
                </Card>
              </section>

              <LearningBucketTable title="리그별" buckets={data.byLeague} />
              <LearningBucketTable
                title="Confidence 구간"
                buckets={data.byConfidence}
              />
              <LearningBucketTable
                title="추천 등급"
                buckets={data.byRecommendationGrade}
              />
              <LearningBucketTable
                title="Value Edge 구간"
                buckets={data.byValueEdge}
              />

              <section aria-label="날짜별 기록">
                <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-500 uppercase">
                  날짜별
                </h2>
                {data.recentDays.length === 0 ? (
                  <p className="text-sm text-zinc-500">날짜별 기록이 없습니다.</p>
                ) : (
                  <Card padding="md" className="rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[32rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-xs text-zinc-500">
                          <th className="pb-2 pr-3 font-medium">날짜</th>
                          <th className="pb-2 pr-3 font-medium">리그</th>
                          <th className="pb-2 pr-3 font-medium">채점</th>
                          <th className="pb-2 pr-3 font-medium">적중</th>
                          <th className="pb-2 pr-3 font-medium">실패</th>
                          <th className="pb-2 font-medium">적중률</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentDays.map((day) => (
                          <tr
                            key={`${day.dateKst}-${day.leagues.join(",")}`}
                            className="border-b border-white/[0.04] last:border-0"
                          >
                            <td className="py-2.5 pr-3 text-zinc-200">
                              {day.dateKst}
                            </td>
                            <td className="py-2.5 pr-3 text-zinc-400">
                              {day.leagues.join(", ") || "—"}
                            </td>
                            <td className="py-2.5 pr-3 tabular-nums text-zinc-400">
                              {day.gradedGames}
                            </td>
                            <td className="py-2.5 pr-3 tabular-nums text-emerald-400">
                              {day.signalWorked}
                            </td>
                            <td className="py-2.5 pr-3 tabular-nums text-rose-400">
                              {day.signalFailed}
                            </td>
                            <td className="py-2.5 tabular-nums text-zinc-300">
                              {day.liveAccuracyPercent != null
                                ? `${day.liveAccuracyPercent}%`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </section>
            </>
          )}

          <aside className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 sm:px-5">
            <h2 className="text-xs font-medium tracking-wide text-zinc-500">
              이용 안내
            </h2>
            <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-zinc-600 sm:text-xs">
              {(data.caveats.length > 0
                ? data.caveats
                : [
                    "이 대시보드는 사후 피드백 집계이며 자동 가중치 변경을 하지 않습니다.",
                    "표본이 작은 구간은 INSUFFICIENT_SAMPLE로 표시합니다.",
                    "베팅 수익을 보장하지 않습니다.",
                  ]
              ).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
