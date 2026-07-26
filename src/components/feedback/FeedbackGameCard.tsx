import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { FeedbackReviewItem, FeedbackVerdict } from "@/types/feedback";
import {
  UNCONFIRMED,
  displayNumber,
  displayPercent,
  displayText,
  outcomeLabel,
  verdictMessage,
} from "@/lib/feedback/display";

type FeedbackGameCardProps = {
  review: FeedbackReviewItem;
};

function verdictBadgeVariant(
  verdict: FeedbackVerdict,
): "success" | "danger" | "warning" {
  if (verdict === "SIGNAL_WORKED") return "success";
  if (verdict === "SIGNAL_FAILED") return "danger";
  return "warning";
}

function outcomeBadgeVariant(
  predictionCorrect: boolean | null,
  verdict: FeedbackVerdict,
): "success" | "danger" | "default" {
  if (verdict === "INCONCLUSIVE" || predictionCorrect == null) return "default";
  return predictionCorrect ? "success" : "danger";
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-0.5 truncate text-sm tabular-nums text-white">{value}</p>
    </div>
  );
}

function ChipList({
  items,
  emptyLabel = UNCONFIRMED,
}: {
  items: string[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-md border border-white/[0.08] bg-zinc-950/50 px-2 py-1 text-[11px] text-zinc-400"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function FeedbackGameCard({ review }: FeedbackGameCardProps) {
  const matchLabel = displayText(review.matchDisplay) !== UNCONFIRMED
    ? review.matchDisplay!
    : displayText(review.match);

  const scoreline = displayText(review.actual.scoreline);
  const winnerTeam = displayText(review.actual.winnerTeam);
  const outcome = outcomeLabel(review.predictionCorrect, review.feedback.verdict);
  const dataAvailability =
    review.evidenceAtPrediction.dataAvailability == null
      ? UNCONFIRMED
      : displayNumber(review.evidenceAtPrediction.dataAvailability, {
          digits: 1,
        });

  return (
    <Card
      as="article"
      padding="md"
      className="rounded-xl"
      aria-label={`${matchLabel} 피드백`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{displayText(review.league)}</Badge>
            <Badge
              variant={outcomeBadgeVariant(
                review.predictionCorrect,
                review.feedback.verdict,
              )}
            >
              {outcome}
            </Badge>
            <Badge variant={verdictBadgeVariant(review.feedback.verdict)}>
              {review.feedback.verdict}
            </Badge>
          </div>
          <h3 className="text-base font-semibold text-white sm:text-lg">
            {matchLabel}
          </h3>
          <p className="text-xs text-zinc-500">{displayText(review.match)}</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-zinc-300">
        {verdictMessage(review.feedback.verdict)}
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] text-zinc-500">YANG EDGE 추천 팀</dt>
          <dd className="mt-0.5 text-sm text-white">
            {displayText(review.recommendedTeam)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-zinc-500">실제 최종 스코어</dt>
          <dd className="mt-0.5 text-sm tabular-nums text-white">{scoreline}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-zinc-500">실제 승리 팀</dt>
          <dd className="mt-0.5 text-sm text-white">{winnerTeam}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-zinc-500">feedback classification</dt>
          <dd className="mt-0.5 text-sm text-white">{review.feedback.verdict}</dd>
        </div>
      </dl>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric
          label="모델 승률"
          value={displayPercent(review.snapshot.probability)}
        />
        <Metric
          label="시장 확률"
          value={displayPercent(review.snapshot.marketProbability)}
        />
        <Metric
          label="Value Edge"
          value={
            review.snapshot.valueEdge == null
              ? UNCONFIRMED
              : `${displayNumber(review.snapshot.valueEdge)}%p`
          }
        />
        <Metric
          label="EDGE Score"
          value={displayNumber(review.snapshot.edgeScore)}
        />
        <Metric
          label="Confidence"
          value={displayNumber(review.snapshot.confidence)}
        />
        <Metric
          label="추천 등급"
          value={displayText(review.snapshot.recommendationGrade)}
        />
      </div>

      <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
        <div>
          <p className="text-[11px] font-medium text-zinc-500">dataAvailability</p>
          <p className="mt-1 text-sm tabular-nums text-white">{dataAvailability}</p>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium text-zinc-500">
            당시 사용한 데이터
          </p>
          <ChipList items={review.evidenceAtPrediction.usedData} />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium text-zinc-500">
            당시 누락된 데이터
          </p>
          <ChipList items={review.evidenceAtPrediction.missingData} />
        </div>

        {review.feedback.verdict === "SIGNAL_FAILED" &&
        review.feedback.hypotheses.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-medium text-amber-400/90">
              검토가 필요한 가능성
            </p>
            <p className="mb-2 text-[11px] leading-relaxed text-zinc-600">
              아래는 확정이 아니라, 리뷰에 저장된 확인이 필요한 가능성입니다.
            </p>
            <ul className="space-y-1.5">
              {review.feedback.hypotheses.map((h) => (
                <li
                  key={h}
                  className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2 text-xs leading-relaxed text-zinc-300"
                >
                  {h}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
