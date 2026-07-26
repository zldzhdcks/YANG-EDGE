import type { FeedbackVerdict } from "@/types/feedback";

/** 값이 없거나 비어 있으면 표시용 문구. 임의 값을 만들지 않는다. */
export const UNCONFIRMED = "확인되지 않음";

export function displayText(value: string | null | undefined): string {
  if (value == null) return UNCONFIRMED;
  const trimmed = value.trim();
  return trimmed === "" ? UNCONFIRMED : trimmed;
}

export function displayNumber(
  value: number | null | undefined,
  options?: { suffix?: string; digits?: number },
): string {
  if (value == null || !Number.isFinite(value)) return UNCONFIRMED;
  const digits = options?.digits;
  const formatted =
    digits != null ? value.toFixed(digits) : String(value);
  return options?.suffix ? `${formatted}${options.suffix}` : formatted;
}

export function displayPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return UNCONFIRMED;
  return `${value}%`;
}

export function displayAccuracyPercent(
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return UNCONFIRMED;
  return `${value}%`;
}

export function outcomeLabel(
  predictionCorrect: boolean | null,
  verdict: FeedbackVerdict,
): string {
  if (verdict === "INCONCLUSIVE" || predictionCorrect == null) return "미결";
  return predictionCorrect ? "적중" : "실패";
}

export function verdictLabel(verdict: FeedbackVerdict): string {
  return verdict;
}

export function verdictMessage(verdict: FeedbackVerdict): string {
  switch (verdict) {
    case "SIGNAL_WORKED":
      return "추천 방향과 실제 결과가 일치했습니다.";
    case "SIGNAL_FAILED":
      return "추천 방향과 실제 결과가 일치하지 않았습니다.";
    case "INCONCLUSIVE":
      return "결과가 확정되지 않아 신호 일치 여부를 판단할 수 없습니다.";
  }
}
