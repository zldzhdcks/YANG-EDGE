import Card from "@/components/ui/Card";
import StatBox from "@/components/ui/StatBox";
import type { FeedbackCenterData } from "@/types/feedback";
import { displayAccuracyPercent } from "@/lib/feedback/display";

type FeedbackSummaryProps = {
  summary: FeedbackCenterData["summary"];
};

export default function FeedbackSummary({ summary }: FeedbackSummaryProps) {
  const accuracy = displayAccuracyPercent(summary.liveAccuracyPercent);
  const showSampleCaveat =
    summary.totalPredictions > 0 && summary.totalPredictions < 30;

  return (
    <section aria-label="피드백 요약">
      <h2 className="mb-4 text-sm font-medium tracking-wide text-zinc-500 uppercase">
        요약
      </h2>
      <Card padding="md" className="rounded-xl">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          <StatBox label="전체 예측 수" value={summary.totalPredictions} size="sm" />
          <StatBox label="채점 완료 수" value={summary.gradedGames} size="sm" />
          <StatBox
            label="적중"
            value={summary.signalWorked}
            size="sm"
            valueClassName="font-bold tabular-nums text-emerald-400"
          />
          <StatBox
            label="실패"
            value={summary.signalFailed}
            size="sm"
            valueClassName="font-bold tabular-nums text-rose-400"
          />
          <StatBox label="미결" value={summary.inconclusive} size="sm" />
          <StatBox
            label="현재 적중률"
            value={accuracy}
            size="sm"
            hint={
              showSampleCaveat
                ? "표본이 적어 엔진 성능을 판단할 수 없습니다."
                : undefined
            }
          />
        </div>
        {showSampleCaveat ? (
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            표본이 적어 엔진 성능을 판단할 수 없습니다. 아래 수치는 기록 확인용이며
            성능 홍보 지표가 아닙니다.
          </p>
        ) : null}
      </Card>
    </section>
  );
}
