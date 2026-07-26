import type { LedgerBet } from "@/types/ledger";
import {
  ledgerSourceLabel,
  ledgerSportLabel,
  ledgerStatusLabel,
} from "@/types/ledger";
import { settleBet, formatKrw, formatOdds, formatProfit } from "@/lib/ledger";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { cn } from "@/utils/cn";

type LedgerBetListProps = {
  bets: LedgerBet[];
  onEdit: (bet: LedgerBet) => void;
  onDelete: (id: string) => void;
};

function statusVariant(
  status: LedgerBet["status"],
): "default" | "accent" | "success" | "warning" | "danger" {
  switch (status) {
    case "win":
      return "success";
    case "loss":
      return "danger";
    case "void":
      return "warning";
    default:
      return "accent";
  }
}

function profitClass(value: number | null): string {
  if (value == null) return "text-zinc-500";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-zinc-300";
}

function BetCard({
  bet,
  onEdit,
  onDelete,
}: {
  bet: LedgerBet;
  onEdit: (bet: LedgerBet) => void;
  onDelete: (id: string) => void;
}) {
  const settlement = settleBet(bet);

  return (
    <Card as="article" padding="md" className="rounded-xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-zinc-500">{bet.betDate}</p>
          <h3 className="mt-1 text-base font-semibold text-white">
            {bet.matchName}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {ledgerSportLabel(bet.sport)}
            {bet.league ? ` · ${bet.league}` : ""}
          </p>
        </div>
        <Badge variant={statusVariant(bet.status)}>
          {ledgerStatusLabel(bet.status)}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-zinc-500">선택</dt>
          <dd className="mt-0.5 text-zinc-200">{bet.selection}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">배당</dt>
          <dd className="mt-0.5 tabular-nums text-zinc-200">
            {formatOdds(bet.odds)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">베팅금</dt>
          <dd className="mt-0.5 tabular-nums text-zinc-200">
            {formatKrw(bet.stake)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">환급액</dt>
          <dd className="mt-0.5 tabular-nums text-zinc-200">
            {settlement.payout == null
              ? "정산 대기"
              : formatKrw(settlement.payout)}
            {settlement.isEstimated ? (
              <span className="ml-1 text-[11px] text-zinc-600">(예상)</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">손익</dt>
          <dd
            className={cn(
              "mt-0.5 tabular-nums font-medium",
              profitClass(settlement.profit),
            )}
          >
            {formatProfit(settlement.profit)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">판단 출처</dt>
          <dd className="mt-0.5 text-zinc-200">
            {ledgerSourceLabel(bet.source)}
          </dd>
        </div>
      </dl>

      {bet.memo ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">{bet.memo}</p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEdit(bet)}
        >
          수정
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(bet.id)}
        >
          삭제
        </Button>
      </div>
    </Card>
  );
}

export default function LedgerBetList({
  bets,
  onEdit,
  onDelete,
}: LedgerBetListProps) {
  return (
    <section aria-label="베팅 기록 목록">
      <h2 className="mb-4 text-sm font-medium tracking-wide text-zinc-500 uppercase">
        기록 목록
      </h2>

      {bets.length === 0 ? (
        <Card padding="lg" className="rounded-xl">
          <p className="text-sm text-zinc-400">
            아직 등록된 기록이 없습니다. 직접 구매한 내역부터 기록해 보세요.
          </p>
        </Card>
      ) : (
        <>
          {/* 모바일: 카드 */}
          <div className="space-y-3 md:hidden">
            {bets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>

          {/* 데스크톱: 표 */}
          <Card padding="none" className="hidden overflow-x-auto rounded-xl md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">날짜</th>
                  <th className="px-4 py-3 font-medium">경기</th>
                  <th className="px-4 py-3 font-medium">선택</th>
                  <th className="px-4 py-3 font-medium">배당</th>
                  <th className="px-4 py-3 font-medium">베팅금</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">환급</th>
                  <th className="px-4 py-3 font-medium">손익</th>
                  <th className="px-4 py-3 font-medium">출처</th>
                  <th className="px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => {
                  const settlement = settleBet(bet);
                  return (
                    <tr
                      key={bet.id}
                      className="border-b border-white/[0.04] last:border-0"
                    >
                      <td className="px-4 py-3 align-top text-zinc-400">
                        {bet.betDate}
                        <div className="mt-0.5 text-[11px] text-zinc-600">
                          {ledgerSportLabel(bet.sport)}
                          {bet.league ? ` · ${bet.league}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-zinc-200">
                        {bet.matchName}
                        {bet.memo ? (
                          <div className="mt-0.5 max-w-[180px] truncate text-[11px] text-zinc-600">
                            {bet.memo}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-zinc-300">
                        {bet.selection}
                      </td>
                      <td className="px-4 py-3 align-top tabular-nums text-zinc-300">
                        {formatOdds(bet.odds)}
                      </td>
                      <td className="px-4 py-3 align-top tabular-nums text-zinc-300">
                        {formatKrw(bet.stake)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={statusVariant(bet.status)}>
                          {ledgerStatusLabel(bet.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top tabular-nums text-zinc-300">
                        {settlement.payout == null
                          ? "정산 대기"
                          : formatKrw(settlement.payout)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 align-top tabular-nums font-medium",
                          profitClass(settlement.profit),
                        )}
                      >
                        {formatProfit(settlement.profit)}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-zinc-500">
                        {ledgerSourceLabel(bet.source)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(bet)}
                          >
                            수정
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(bet.id)}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </section>
  );
}
