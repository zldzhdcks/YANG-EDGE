export type RecommendationGrade = "S" | "A+" | "A" | "B+" | "B" | "C";

export type ReasonIcon =
  | "pitcher"
  | "home"
  | "offense"
  | "bullpen"
  | "h2h"
  | "form"
  | "defense"
  | "rest"
  | "pace"
  | "rebound"
  | "possession"
  | "setpiece"
  | "clutch"
  | "weather"
  | "standings"
  | "injury"
  | "streak";

export type AnalysisReason = {
  id: string;
  title: string;
  detail: string;
  icon: ReasonIcon;
};

export type AnalysisData = {
  gameId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  pickTeam: string;
  starRating: number;
  /** 해당 팀이 이길 확률 (%). EDGE Score와는 별개 지표. */
  winProbability: number;
  /** EDGE Confidence (0–100). 분석 확신도. */
  confidence: number;
  /** EDGE Score. 시장 대비 가치 우위. 승리 확률과 별개. */
  edgeScore: number;
  grade: RecommendationGrade;
  summary: string;
  reasons: AnalysisReason[];
  risks: string[];
  expectedHomeScore: number;
  expectedAwayScore: number;
};

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return "매우 높음";
  if (confidence >= 80) return "높음";
  if (confidence >= 70) return "보통";
  return "낮음";
}

export function getEdgeScoreLabel(edgeScore: number): string {
  const abs = Math.abs(edgeScore);
  if (abs >= 20) return "Elite Edge";
  if (abs >= 15) return "Premium Edge";
  if (abs >= 10) return "Strong Edge";
  if (abs >= 5) return "Moderate Edge";
  return "Low Edge";
}
