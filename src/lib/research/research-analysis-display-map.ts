/**
 * Display-only label mapping for Research Analysis Viewer.
 * Does not mutate review/prediction artifacts — remaps UI strings only.
 */

import type { FieldAvailability } from "@/types/research-analysis-view";

/**
 * Hypothesis strings from grade-mlb-research-predictions buildHypotheses.
 * "선발투수 지표 MIXED" ← pitcherDirection === "MIXED"
 * (build-mlb-pitcher-comparison classifyVsBaseline: ERA·WHIP가
 *  SUPPORTS/CONFLICTS 조건에 모두 미해당할 때)
 */
const HYPOTHESIS_DISPLAY_MAP: Record<string, string> = {
  "선발투수 누락": "예측 당시 선발 세부 지표 부족",
  "선발투수 지표 MIXED": "선발 ERA·WHIP가 Baseline과 혼합 판정",
};

/** Internal status / classification codes → Korean (display only). */
const STATUS_CODE_KO: Record<string, string> = {
  STARTER_MATCHED: "예상 선발과 실제 선발 일치",
  PROBABLE_ONLY: "예상 선발만 확보",
  ROLE_STRUCTURE_CONFLICTS_BASELINE: "불펜 역할 구조가 Baseline과 충돌",
  ROLE_STRUCTURE_SUPPORTS_BASELINE: "불펜 역할 구조가 Baseline을 지지",
  ROLE_STRUCTURE_NEUTRAL: "불펜 역할 구조 중립",
  ROLE_STRUCTURE_INSUFFICIENT: "불펜 역할 구조 표본 부족",
  SIGNAL_WORKED: "예측 적중",
  SIGNAL_FAILED: "예측 실패",
  BASELINE_SIGNAL_CONFIRMED: "Baseline 신호 확인",
  BULLPEN_PROTECTED_SIGNAL: "불펜이 신호를 지킴",
  MULTIPLE_FACTORS: "복수 요인",
  ADVERSE_MOVE: "불리한 배당 이동",
  /** pitcherDirection MIXED — ERA·WHIP vs baseline neither fully support nor fully conflict */
  MIXED: "선발 ERA·WHIP가 Baseline과 혼합 판정",
  SUPPORTS_BASELINE: "선발 지표가 Baseline을 지지",
  CONFLICTS_BASELINE: "선발 지표가 Baseline과 충돌",
  STARTER_FAILURE: "선발 실패 흐름",
  BULLPEN_FAILURE: "불펜 실패 흐름",
  OFFENSIVE_FAILURE: "공격 실패 흐름",
  OPPONENT_OFFENSE_SURGE: "상대 공격 급등",
  CLOSE_GAME_VARIANCE: "접전 변동성",
  STARTER_DISADVANTAGE_REALIZED: "선발 열세 실현",
  STARTER_ADVANTAGE_WASTED: "선발 우세 낭비",
  STARTERS_EVEN: "선발 균형",
  BULLPEN_COLLAPSE: "불펜 붕괴",
  BULLPEN_DISADVANTAGE: "불펜 열세",
  BULLPEN_PROTECTED_LEAD: "불펜이 리드 보호",
  OPPONENT_OFFENSE_SURGED: "상대 공격 급등",
  OFFENSE_NOT_PRIMARY: "공격이 주 요인 아님",
};

export function mapReviewHypothesisDisplay(raw: string): string {
  return HYPOTHESIS_DISPLAY_MAP[raw] ?? raw;
}

export function mapReviewHypothesesDisplay(raw: string[]): string[] {
  return raw.map(mapReviewHypothesisDisplay);
}

/** Prediction.missingFactors token → viewer wording (identity ≠ metrics). */
export function mapMissingFactorDisplay(raw: string): string {
  if (raw === "선발투수") return "예측 당시 선발 세부 지표 부족";
  return raw;
}

export function predictionMissingStarterMetrics(
  missingFactors: unknown,
): boolean {
  if (!Array.isArray(missingFactors)) return false;
  return missingFactors.some((f) => f === "선발투수");
}

/** User-facing availability (Korean first). */
export function availabilityLabelKo(a: FieldAvailability): string {
  if (a === "COLLECTED") return "수집됨";
  if (a === "AWAITING_RESEARCH") return "연구 대기 중";
  return "미수집";
}

/** English availability for 연구 기술 정보. */
export function availabilityLabelEn(a: FieldAvailability): string {
  if (a === "COLLECTED") return "Collected";
  if (a === "AWAITING_RESEARCH") return "Awaiting Research";
  return "Not Collected";
}

export function mapStatusCodeKo(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  return STATUS_CODE_KO[trimmed] ?? null;
}

/**
 * Split joined status strings ("A · B") and map known codes.
 * Unknown tokens pass through unchanged.
 */
export function mapStatusCodesDisplay(raw: string): Array<{
  ko: string | null;
  code: string;
}> {
  return raw
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((code) => ({ ko: mapStatusCodeKo(code), code }));
}

/** Finished-game summary: Korean outcome only (no SIGNAL_* / hit=). */
export function predictionOutcomeKo(args: {
  feedbackClassification: string | null;
  predictionHit: boolean | null;
}): "예측 적중" | "예측 실패" | null {
  if (args.predictionHit === true) return "예측 적중";
  if (args.predictionHit === false) return "예측 실패";
  if (args.feedbackClassification === "SIGNAL_WORKED") return "예측 적중";
  if (args.feedbackClassification === "SIGNAL_FAILED") return "예측 실패";
  return null;
}
