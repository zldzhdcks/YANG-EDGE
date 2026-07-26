import type { LedgerBet, LedgerBetStatus } from "@/types/ledger";

/** 원 단위 반올림 */
export function roundWon(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export type LedgerSettlement = {
  /** pending 이면 false */
  isSettled: boolean;
  /** 확정/예상 환급액. pending 이면 null */
  payout: number | null;
  /** 손익. pending 이면 null ("정산 대기") */
  profit: number | null;
  /** 실제 환급액이 비어 win/void에서 규칙으로 계산했는지 */
  isEstimated: boolean;
};

/**
 * 상태별 정산.
 *
 * - pending: 정산 제외, profit/payout = null
 * - win: settledReturn ?? stake×odds, profit = payout − stake
 * - loss: payout = 0, profit = −stake
 * - void: settledReturn ?? stake, profit = payout − stake
 */
export function settleBet(bet: Pick<
  LedgerBet,
  "status" | "stake" | "odds" | "settledReturn"
>): LedgerSettlement {
  const stake = bet.stake;
  const status: LedgerBetStatus = bet.status;

  if (status === "pending") {
    return {
      isSettled: false,
      payout: null,
      profit: null,
      isEstimated: false,
    };
  }

  if (status === "loss") {
    return {
      isSettled: true,
      payout: 0,
      profit: -stake,
      isEstimated: false,
    };
  }

  if (status === "win") {
    const hasReturn =
      bet.settledReturn != null && Number.isFinite(bet.settledReturn);
    const payout = hasReturn
      ? roundWon(bet.settledReturn as number)
      : roundWon(stake * bet.odds);
    return {
      isSettled: true,
      payout,
      profit: payout - stake,
      isEstimated: !hasReturn,
    };
  }

  // void
  const hasReturn =
    bet.settledReturn != null && Number.isFinite(bet.settledReturn);
  const payout = hasReturn ? roundWon(bet.settledReturn as number) : stake;
  return {
    isSettled: true,
    payout,
    profit: payout - stake,
    isEstimated: !hasReturn,
  };
}

export type LedgerSummary = {
  totalCount: number;
  pendingCount: number;
  /** 정산 완료(win/loss/void) 베팅금 합 */
  settledStake: number;
  /** 정산 완료 환급액 합 */
  settledPayout: number;
  /** 누적 손익 (정산 완료만) */
  netProfit: number;
  /**
   * ROI = netProfit / settledStake × 100.
   * settledStake === 0 이면 null → UI는 "—"
   */
  roiPercent: number | null;
  /**
   * 적중률 = win / (win + loss) × 100.
   * 분모 0이면 null → UI는 "—"
   */
  hitRatePercent: number | null;
  winCount: number;
  lossCount: number;
  voidCount: number;
};

export function summarizeBets(bets: LedgerBet[]): LedgerSummary {
  let pendingCount = 0;
  let settledStake = 0;
  let settledPayout = 0;
  let netProfit = 0;
  let winCount = 0;
  let lossCount = 0;
  let voidCount = 0;

  for (const bet of bets) {
    if (bet.status === "pending") {
      pendingCount += 1;
      continue;
    }

    const s = settleBet(bet);
    settledStake += bet.stake;
    settledPayout += s.payout ?? 0;
    netProfit += s.profit ?? 0;

    if (bet.status === "win") winCount += 1;
    else if (bet.status === "loss") lossCount += 1;
    else voidCount += 1;
  }

  const decided = winCount + lossCount;

  return {
    totalCount: bets.length,
    pendingCount,
    settledStake,
    settledPayout,
    netProfit,
    roiPercent:
      settledStake > 0
        ? Math.round((netProfit / settledStake) * 1000) / 10
        : null,
    hitRatePercent:
      decided > 0 ? Math.round((winCount / decided) * 1000) / 10 : null,
    winCount,
    lossCount,
    voidCount,
  };
}

/** YYYY-MM (KST 날짜 앞 7자) */
export function kstYearMonth(dateYmd: string): string {
  return dateYmd.slice(0, 7);
}

export type BudgetWarnings = {
  unitStakeExceeded: boolean;
  dailyLossReached: boolean;
  monthlyLossReached: boolean;
  /** pending 포함 해당 월 베팅금 / 월 예산. 예산 미설정 시 null */
  monthlyBudgetUsageRatio: number | null;
  monthlyStakeTotal: number;
};

/**
 * 자금관리 경고 (중립 안내만, 입력 차단 없음).
 * 손실 한도는 정산된 손실(profit < 0)의 절대합으로 비교.
 */
export function evaluateBudgetWarnings(input: {
  bets: LedgerBet[];
  /** 방금 입력 중인 베팅금 (원). 없으면 null */
  draftStake: number | null;
  todayYmd: string;
  monthPrefix: string;
  unitStakeLimit: number | null;
  dailyLossLimit: number | null;
  monthlyLossLimit: number | null;
  monthlyBudget: number | null;
}): BudgetWarnings {
  const {
    bets,
    draftStake,
    todayYmd,
    monthPrefix,
    unitStakeLimit,
    dailyLossLimit,
    monthlyLossLimit,
    monthlyBudget,
  } = input;

  const unitStakeExceeded =
    unitStakeLimit != null &&
    draftStake != null &&
    Number.isFinite(draftStake) &&
    draftStake > unitStakeLimit;

  let dailyLoss = 0;
  let monthlyLoss = 0;
  let monthlyStakeTotal = 0;

  for (const bet of bets) {
    if (bet.betDate.startsWith(monthPrefix)) {
      monthlyStakeTotal += bet.stake;
    }

    const s = settleBet(bet);
    if (!s.isSettled || s.profit == null || s.profit >= 0) continue;

    const lossAbs = -s.profit;
    if (bet.betDate === todayYmd) dailyLoss += lossAbs;
    if (bet.betDate.startsWith(monthPrefix)) monthlyLoss += lossAbs;
  }

  const dailyLossReached =
    dailyLossLimit != null && dailyLoss >= dailyLossLimit;
  const monthlyLossReached =
    monthlyLossLimit != null && monthlyLoss >= monthlyLossLimit;

  const monthlyBudgetUsageRatio =
    monthlyBudget != null && monthlyBudget > 0
      ? monthlyStakeTotal / monthlyBudget
      : null;

  return {
    unitStakeExceeded,
    dailyLossReached,
    monthlyLossReached,
    monthlyBudgetUsageRatio,
    monthlyStakeTotal,
  };
}
