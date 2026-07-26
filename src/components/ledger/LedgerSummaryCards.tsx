import type { LedgerSummary } from "@/lib/ledger";
import { formatKrw, formatPercent, formatProfit } from "@/lib/ledger";
import Card from "@/components/ui/Card";
import StatBox from "@/components/ui/StatBox";
import { cn } from "@/utils/cn";

type LedgerSummaryCardsProps = {
  summary: LedgerSummary;
};

function profitClass(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-white";
}

export default function LedgerSummaryCards({ summary }: LedgerSummaryCardsProps) {
  return (
    <section aria-label="가계부 요약">
      <h2 className="mb-4 text-sm font-medium tracking-wide text-zinc-500 uppercase">
        요약
      </h2>
      <Card padding="md" className="rounded-xl">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          <StatBox
            label="전체 기록"
            value={summary.totalCount}
            size="sm"
          />
          <StatBox
            label="결과 대기"
            value={summary.pendingCount}
            size="sm"
          />
          <StatBox
            label="총 베팅금"
            value={formatKrw(summary.settledStake)}
            size="sm"
            hint="정산 완료만"
          />
          <StatBox
            label="총 환급액"
            value={formatKrw(summary.settledPayout)}
            size="sm"
            hint="정산 완료만"
          />
          <StatBox
            label="누적 손익"
            value={formatProfit(summary.netProfit)}
            size="sm"
            valueClassName={cn(
              "font-bold tabular-nums",
              profitClass(summary.netProfit),
            )}
            hint="정산 완료만"
          />
          <StatBox
            label="ROI"
            value={formatPercent(summary.roiPercent)}
            size="sm"
            hint="손익 ÷ 베팅금"
          />
          <StatBox
            label="적중률"
            value={formatPercent(summary.hitRatePercent)}
            size="sm"
            hint="적중 ÷ (적중+미적중)"
          />
        </div>
      </Card>
    </section>
  );
}
