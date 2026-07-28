import Card from "@/components/ui/Card";
import type { KboOddsComparisonRow } from "@/lib/kbo/odds-comparison/kbo-odds-comparison-types";

function formatOdds(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(2);
}

function getDomesticReviewLabel(reviewStatus: string | null | undefined): string {
  return reviewStatus === "VERIFIED" ? "검수 완료" : "국내 배당 검수 전";
}

export default function KboOddsComparisonCard({
  row,
}: {
  row: KboOddsComparisonRow;
}) {
  const domesticHome =
    row.domestic?.selections.find((selection) => selection.selectionCode === "HOME")
      ?.odds ?? null;
  const domesticAway =
    row.domestic?.selections.find((selection) => selection.selectionCode === "AWAY")
      ?.odds ?? null;
  const overseasHome =
    row.overseas?.selections.find((selection) => selection.selectionCode === "HOME")
      ?.odds ?? null;
  const overseasAway =
    row.overseas?.selections.find((selection) => selection.selectionCode === "AWAY")
      ?.odds ?? null;

  return (
    <Card padding="md" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {row.homeTeam} vs {row.awayTeam}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{row.startTimeKst.slice(11, 16)} KST</p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">국내 프로토</p>
            <span className="text-xs text-amber-300">
              {getDomesticReviewLabel(row.domestic?.reviewStatus)}
            </span>
          </div>
          <div className="grid grid-cols-[72px_1fr_1fr] gap-2 text-sm tabular-nums text-zinc-300">
            <span className="text-zinc-500"> </span>
            <span>홈</span>
            <span>원정</span>
            <span className="text-zinc-500">배당</span>
            <span>{formatOdds(domesticHome)}</span>
            <span>{formatOdds(domesticAway)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">해외 시장</p>
            <span className="text-xs text-zinc-400">
              {row.overseas ? "The Odds API" : "해외 배당 미수집"}
            </span>
          </div>
          <div className="grid grid-cols-[72px_1fr_1fr] gap-2 text-sm tabular-nums text-zinc-300">
            <span className="text-zinc-500"> </span>
            <span>홈</span>
            <span>원정</span>
            <span className="text-zinc-500">배당</span>
            <span>{formatOdds(overseasHome)}</span>
            <span>{formatOdds(overseasAway)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1 text-xs text-zinc-500">
        <p>운영자 입력 국내 배당과 해외 Provider 배당의 단순 비교입니다.</p>
        <p>추천·구매 지시가 아닙니다.</p>
        {row.comparison.status === "MARKET_RULE_UNVERIFIED" && (
          <p className="text-amber-300">시장 규칙 미확인으로 숫자 차이 비교는 보류합니다.</p>
        )}
      </div>
    </Card>
  );
}
