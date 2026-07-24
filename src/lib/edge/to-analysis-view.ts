import type { AnalysisData as EngineAnalysisData } from "@/types/engine-analysis";
import type { ReasonIcon, RecommendationGrade } from "@/types/analysis";
import { runEdgeEngine } from "./run-edge-engine";
import type {
  EdgeEngineResult,
  EdgeFactorInsight,
  EdgeReasonIcon,
  EdgeRisk,
} from "./types";

/** EDGE DNA 카드용 factor 표시 */
export type EdgeDnaFactorView = {
  key: string;
  label: string;
  /** pick 기준 부호 반영 impact (|score|×importance) */
  signedImpact: number;
  impact: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  advantage: "advantage" | "neutral" | "disadvantage";
};

export type AnalysisReasonView = {
  id: string;
  title: string;
  detail: string;
  icon: ReasonIcon;
};

export type AnalysisRiskView = {
  id: string;
  title: string;
  description: string;
};

/**
 * 분석 상세 화면용 뷰모델.
 * Provider UI AnalysisData와 분리 — Engine 결과 매핑 전용.
 */
export type AnalysisViewModel = {
  gameId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  pickTeam: string;
  starRating: number;
  winProbability: number;
  confidence: number;
  /** 화면 표시용 절댓값 (추천 팀 EDGE 크기) */
  edgeScore: number;
  grade: RecommendationGrade;
  gradeLabel: string;
  summary: string;
  reasons: AnalysisReasonView[];
  risks: AnalysisRiskView[];
  expectedHomeScore: number;
  expectedAwayScore: number;
  topFactors: EdgeDnaFactorView[];
  explainability: number;
};

function mapIcon(icon: EdgeReasonIcon): ReasonIcon {
  switch (icon) {
    case "pitcher":
      return "pitcher";
    case "form":
      return "form";
    case "home":
      return "home";
    case "offense":
      return "offense";
    case "defense":
      return "defense";
    case "h2h":
      return "h2h";
    case "rest":
      return "rest";
    case "standings":
      return "standings";
    case "injury":
      return "injury";
    case "streak":
      return "streak";
    default:
      return "form";
  }
}

function starFromEdgeScore(edgeScore: number): number {
  const abs = Math.abs(edgeScore);
  if (abs >= 20) return 5;
  if (abs >= 15) return 4;
  if (abs >= 10) return 3;
  if (abs >= 5) return 2;
  return 1;
}

function toSignedImpact(
  factor: EdgeFactorInsight,
  pickTeamId: "home" | "away",
): number {
  // pick 유리 → 양수, 불리 → 음수
  const raw = factor.score * factor.importance;
  const signed = pickTeamId === "home" ? raw : -raw;
  return Math.round(signed * 10) / 10;
}

function buildSummary(
  engineInput: EngineAnalysisData,
  result: EdgeEngineResult,
): string {
  const top = result.topFactors[0];
  const topHint = top
    ? `${top.label} 지표가 가장 크게 기여했습니다.`
    : "주요 지표를 종합했습니다.";
  return `${result.pickTeamName} 우세 (${result.grade} · ${result.label}). ${topHint}`;
}

/**
 * Engine AnalysisData → runEdgeEngine → 화면 뷰모델
 * 동일 입력 → 동일 출력 (결정적).
 */
export function buildAnalysisView(
  engineInput: EngineAnalysisData,
): AnalysisViewModel {
  const result = runEdgeEngine(engineInput);

  const reasons: AnalysisReasonView[] = result.reasons.map((reason, index) => ({
    id: `reason-${reason.factor ?? index}`,
    title: reason.title,
    detail: reason.description,
    icon: mapIcon(reason.icon),
  }));

  const risks: AnalysisRiskView[] = result.risks.map((risk: EdgeRisk) => ({
    id: risk.id,
    title: risk.title,
    description: risk.description,
  }));

  const topFactors: EdgeDnaFactorView[] = result.topFactors.map((factor) => ({
    key: factor.key,
    label: factor.label,
    signedImpact: toSignedImpact(factor, result.pickTeamId),
    impact: factor.impact,
    advantage: factor.advantage,
  }));

  return {
    gameId: engineInput.gameId,
    league: engineInput.league,
    homeTeam: engineInput.homeTeam,
    awayTeam: engineInput.awayTeam,
    startTime: engineInput.startTime,
    pickTeam: result.pickTeamName,
    starRating: starFromEdgeScore(result.edgeScore),
    winProbability: Math.round(result.winProbability),
    confidence: Math.round(result.confidence),
    edgeScore: Math.round(Math.abs(result.edgeScore) * 10) / 10,
    grade: result.grade,
    gradeLabel: result.label,
    summary: buildSummary(engineInput, result),
    reasons,
    risks,
    expectedHomeScore: Math.round(engineInput.home.scoringAverages.scoredAvg),
    expectedAwayScore: Math.round(engineInput.away.scoringAverages.scoredAvg),
    topFactors,
    explainability: Math.round(result.explainability),
  };
}
