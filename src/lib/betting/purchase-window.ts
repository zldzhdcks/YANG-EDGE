/**
 * 국내 배트맨·판매점 구매 가능 시간 정책 (Asia/Seoul 고정).
 *
 * 사용자 운영 제약:
 *   - 구매 가능 시간대: KST 08:00 ~ 23:00
 *   - KST 23:00 이후에는 신규 구매 결정을 내릴 수 없다.
 *   - 실제 회차·경기별 공식 발매 마감이 더 이르면 그 시각이 우선하지만,
 *     현재 Betman 회차 마감 데이터는 연결되지 않았다.
 *     → officialSalesCloseKst = null / officialCloseVerified = false 로 명시하고
 *       "23:00까지 무조건 구매 가능"이라고 단정하지 않는다.
 *
 * 이 모듈은 시간 계산만 한다. EDGE Engine·모델 확률·pick과 무관하다.
 */
import { instantToKst } from "@/lib/datetime/kst";

export const PURCHASE_WINDOW_OPEN_KST = "08:00";
export const PURCHASE_WINDOW_CLOSE_KST = "23:00";
/** 구매용 권장 최종 조회 시각 (마감이 당겨진 경우) */
export const RECOMMENDED_FINAL_REVIEW_KST = "22:30";
/** 늦어도 이 시각까지 분석 완료 (마감이 당겨진 경우) */
export const DECISION_COMPLETE_DEADLINE_KST = "22:50";

export type PurchaseTimeStatus =
  | "DECISION_BEFORE_CUTOFF"
  | "EARLY_DECISION_REQUIRED"
  | "NO_PURCHASE_WINDOW";

export type PurchaseFlag =
  | "OFFICIAL_CLOSE_UNVERIFIED"
  | "LINEUP_UNAVAILABLE_BEFORE_PURCHASE_CUTOFF"
  | "IDEAL_RECHECK_AFTER_CUTOFF_PULLED"
  | "DEADLINE_BEFORE_SALES_OPEN";

export type PurchaseSchedule = {
  gameStartKst: string;
  gameStartMs: number;
  /** 경기 기준 이상적 재확인 시각 (구매 정책 반영 전) */
  idealRecheckKst: string | null;
  /** 구매용 권장 최종 조회 시각 (23:00 이후면 22:30으로 당김) */
  purchaseFinalReviewKst: string;
  /** 구매 판단 완료 마감 (당겨진 경우 22:50) */
  purchaseDecisionDeadlineKst: string;
  /** 판매 종료 기준 — 해당 결정일 23:00 KST */
  purchaseCutoffKst: string;
  purchaseCutoffMs: number;
  /** 공식 회차별 발매 마감 — 미연결 */
  officialSalesCloseKst: null;
  officialCloseVerified: false;
  /** min(조정된 판단 마감, purchaseCutoff) */
  finalActionDeadlineKst: string;
  finalActionDeadlineMs: number;
  minutesBeforeGameAtDeadline: number;
  /** ideal recheck가 구매 마감 이후라 22:30/22:50으로 당겨졌는지 */
  pulledBeforeCutoff: boolean;
  status: PurchaseTimeStatus;
  flags: PurchaseFlag[];
  /** 현재 시각이 구매 마감 이후인지 — 이후 조회 데이터는 사후 연구용 */
  researchOnly: boolean;
  notes: string[];
};

/** Asia/Seoul 고정 — `YYYY-MM-DD` + `HH:mm` → epoch ms */
export function kstMs(dateKst: string, timeKst: string): number {
  return Date.parse(`${dateKst}T${timeKst}:00+09:00`);
}

/** ms → "YYYY-MM-DD HH:mm KST" (Asia/Seoul 고정, Intl 기반) */
export function formatKstDateTime(ms: number): string {
  const kst = instantToKst(new Date(ms));
  if (!kst) return new Date(ms).toISOString();
  return `${kst.date} ${kst.time} KST`;
}

/** KST 날짜 하루 전 (DST 없는 Asia/Seoul) */
export function previousKstDate(dateKst: string): string {
  const ms = kstMs(dateKst, "12:00") - 24 * 60 * 60 * 1000;
  const kst = instantToKst(new Date(ms));
  return kst?.date ?? dateKst;
}

export type ComputePurchaseScheduleInput = {
  /** 경기 날짜 (KST, YYYY-MM-DD) */
  gameDateKst: string;
  /** 경기 시작 시각 (KST, HH:mm) */
  gameStartTimeKst: string;
  /** 경기 기준 이상적 재확인 시각 ms (없으면 null) */
  idealRecheckMs: number | null;
  /** 현재 시각 ms */
  nowMs: number;
  /** 구매 마감 전 라인업 미공개 여부 (알 수 없으면 null) */
  lineupUnavailableBeforeCutoff: boolean | null;
};

/**
 * 경기별 구매 시간 스케줄 계산.
 *
 * 결정일(decision day):
 *   - 새벽 경기(시작 < 08:00 KST)는 "전날"이 결정일이다.
 *     예: 2026-07-27 01:15 경기는 2026-07-26 23:00 이전에 최종 분류해야 한다.
 *   - 그 외에는 경기 당일이 결정일이다.
 */
export function computePurchaseSchedule(
  input: ComputePurchaseScheduleInput,
): PurchaseSchedule {
  const gameStartMs = kstMs(input.gameDateKst, input.gameStartTimeKst);
  const isDawnGame =
    input.gameStartTimeKst < PURCHASE_WINDOW_OPEN_KST;
  const decisionDate = isDawnGame
    ? previousKstDate(input.gameDateKst)
    : input.gameDateKst;

  const purchaseCutoffMs = kstMs(decisionDate, PURCHASE_WINDOW_CLOSE_KST);
  const windowOpenMs = kstMs(decisionDate, PURCHASE_WINDOW_OPEN_KST);

  // ideal recheck가 구매 마감 이후면 22:30/22:50으로 당긴다
  const pulled =
    input.idealRecheckMs == null || input.idealRecheckMs > purchaseCutoffMs;
  const reviewMs = pulled
    ? kstMs(decisionDate, RECOMMENDED_FINAL_REVIEW_KST)
    : (input.idealRecheckMs as number);
  const decisionDeadlineMs = pulled
    ? kstMs(decisionDate, DECISION_COMPLETE_DEADLINE_KST)
    : (input.idealRecheckMs as number);

  const finalActionDeadlineMs = Math.min(decisionDeadlineMs, purchaseCutoffMs);

  const flags: PurchaseFlag[] = ["OFFICIAL_CLOSE_UNVERIFIED"];
  const notes: string[] = [
    "공식 회차별 발매 마감 미확인 — 23:00까지 무조건 구매 가능하다고 단정하지 않는다.",
  ];
  if (pulled) {
    flags.push("IDEAL_RECHECK_AFTER_CUTOFF_PULLED");
    notes.push(
      `경기 기준 재확인 시각이 구매 마감(23:00) 이후라 ${RECOMMENDED_FINAL_REVIEW_KST}(조회)/${DECISION_COMPLETE_DEADLINE_KST}(판단 완료)로 당김.`,
    );
    notes.push("23:00 이후 데이터는 사후 연구용이며 구매 결정에 사용하지 않는다.");
  }
  if (finalActionDeadlineMs < windowOpenMs) {
    flags.push("DEADLINE_BEFORE_SALES_OPEN");
    notes.push("판단 마감이 판매 개시(08:00) 이전 — 실질 구매 가능 구간이 매우 짧거나 없음.");
  }
  if (input.lineupUnavailableBeforeCutoff === true) {
    flags.push("LINEUP_UNAVAILABLE_BEFORE_PURCHASE_CUTOFF");
    notes.push(
      "구매 마감 전 라인업 미공개 — 라인업을 기다리느라 23:00을 넘기지 않는다. 불완전한 상태에서 일찍 결정해야 한다.",
    );
  }

  let status: PurchaseTimeStatus;
  if (input.nowMs > finalActionDeadlineMs || input.nowMs > purchaseCutoffMs) {
    status = "NO_PURCHASE_WINDOW";
  } else if (pulled || input.lineupUnavailableBeforeCutoff === true) {
    status = "EARLY_DECISION_REQUIRED";
  } else {
    status = "DECISION_BEFORE_CUTOFF";
  }

  return {
    gameStartKst: formatKstDateTime(gameStartMs),
    gameStartMs,
    idealRecheckKst:
      input.idealRecheckMs == null
        ? null
        : formatKstDateTime(input.idealRecheckMs),
    purchaseFinalReviewKst: formatKstDateTime(reviewMs),
    purchaseDecisionDeadlineKst: formatKstDateTime(decisionDeadlineMs),
    purchaseCutoffKst: formatKstDateTime(purchaseCutoffMs),
    purchaseCutoffMs,
    officialSalesCloseKst: null,
    officialCloseVerified: false,
    finalActionDeadlineKst: formatKstDateTime(finalActionDeadlineMs),
    finalActionDeadlineMs,
    minutesBeforeGameAtDeadline: Math.round(
      (gameStartMs - finalActionDeadlineMs) / 60000,
    ),
    pulledBeforeCutoff: pulled,
    status,
    flags,
    researchOnly: input.nowMs > purchaseCutoffMs,
    notes,
  };
}
