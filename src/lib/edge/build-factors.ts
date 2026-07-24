import type {
  EdgeFactorInsight,
  EdgeFactorKey,
  EdgeFactorScores,
  EdgeReasonIcon,
  FactorAdvantage,
  FactorAvailability,
  FactorImpactLevel,
} from "./types";
import { BASEBALL_EDGE_WEIGHTS, FACTOR_KEYS } from "./weights";
import { round4, safeNumber } from "./calculate-edge";

export const FACTOR_LABELS: Record<EdgeFactorKey, string> = {
  recentForm: "최근 폼",
  homeAway: "홈/원정 성적",
  scoring: "득점력",
  defense: "실점 억제",
  leagueStanding: "리그 순위",
  headToHead: "맞대결",
  rest: "휴식일",
  injuries: "부상/전력",
  streak: "연승/연패",
  startingPitcher: "선발투수",
};

export const FACTOR_ICONS: Record<EdgeFactorKey, EdgeReasonIcon> = {
  recentForm: "form",
  homeAway: "home",
  scoring: "offense",
  defense: "defense",
  leagueStanding: "standings",
  headToHead: "h2h",
  rest: "rest",
  injuries: "injury",
  streak: "streak",
  startingPitcher: "pitcher",
};

const NEUTRAL_BAND = 0.05;

/**
 * pick 팀 기준 advantage / neutral / disadvantage
 * score는 항상 홈 기준(-1~+1).
 */
export function advantageForPick(
  score: number,
  pickTeamId: "home" | "away",
): FactorAdvantage {
  const s = safeNumber(score, 0);
  if (Math.abs(s) < NEUTRAL_BAND) return "neutral";

  if (pickTeamId === "home") {
    return s > 0 ? "advantage" : "disadvantage";
  }
  return s < 0 ? "advantage" : "disadvantage";
}

export function impactLevel(impactValue: number): FactorImpactLevel {
  const v = safeNumber(impactValue, 0);
  if (v >= 8) return "HIGH";
  if (v >= 3) return "MEDIUM";
  if (v >= 0.5) return "LOW";
  return "NONE";
}

/**
 * factorScores → EdgeFactorInsight[] (impactValue 내림차순)
 */
export function buildFactorInsights(
  factorScores: EdgeFactorScores,
  availability: FactorAvailability,
  pickTeamId: "home" | "away",
): EdgeFactorInsight[] {
  const factors: EdgeFactorInsight[] = FACTOR_KEYS.map((key) => {
    const score = round4(safeNumber(factorScores[key], 0));
    const importance = BASEBALL_EDGE_WEIGHTS[key];
    const available = Boolean(availability[key]);
    const impactValue = available ? round4(Math.abs(score) * importance) : 0;

    return {
      key,
      label: FACTOR_LABELS[key],
      score: available ? score : 0,
      importance,
      impactValue,
      impact: available ? impactLevel(impactValue) : "NONE",
      advantage: available
        ? advantageForPick(score, pickTeamId)
        : "neutral",
      available,
      icon: FACTOR_ICONS[key],
    };
  });

  factors.sort((a, b) => {
    if (b.impactValue !== a.impactValue) return b.impactValue - a.impactValue;
    return b.importance - a.importance;
  });

  return factors;
}

export function selectTopFactors(
  factors: EdgeFactorInsight[],
  count = 4,
): EdgeFactorInsight[] {
  return factors.filter((f) => f.available).slice(0, count);
}
