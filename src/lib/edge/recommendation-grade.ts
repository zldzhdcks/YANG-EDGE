/**
 * EDGE Score → 추천 등급 (표시용)
 *
 * Engine 계산식·weights·Confidence 와 분리된 순수 매핑 계층.
 * 분석 상세(PredictionHero)에서만 소비한다.
 */

export type RecommendationGradeLabel =
  | "PASS"
  | "WATCH"
  | "EDGE PICK"
  | "TOP EDGE";

export type RecommendationGradeResult = {
  grade: RecommendationGradeLabel;
  /** 표시용 색 토큰 (디자인 시스템 연결 전 문자열 힌트) */
  color: "zinc" | "blue" | "emerald" | "amber";
  description: string;
};

/**
 * |EDGE Score| 구간:
 *   0  ≤ x < 5   → PASS
 *   5  ≤ x < 10  → WATCH
 *   10 ≤ x < 15  → EDGE PICK
 *   15 ≤ x       → TOP EDGE
 *
 * NaN / Infinity → PASS (신호 없음으로 취급)
 */
export function getRecommendationGrade(
  edgeScore: number,
): RecommendationGradeResult {
  const abs =
    typeof edgeScore === "number" && Number.isFinite(edgeScore)
      ? Math.abs(edgeScore)
      : 0;

  if (abs >= 15) {
    return {
      grade: "TOP EDGE",
      color: "amber",
      description: "오늘의 최상위 추천입니다.",
    };
  }
  if (abs >= 10) {
    return {
      grade: "EDGE PICK",
      color: "emerald",
      description: "추천 경기입니다.",
    };
  }
  if (abs >= 5) {
    return {
      grade: "WATCH",
      color: "blue",
      description: "관심 경기입니다.",
    };
  }
  return {
    grade: "PASS",
    color: "zinc",
    description: "신호가 약합니다.",
  };
}
