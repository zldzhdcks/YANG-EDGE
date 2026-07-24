import type { AnalysisData } from "@/types/engine-analysis";
import type {
  EdgeFactorInsight,
  EdgeReason,
  EdgeRisk,
  FactorAvailability,
} from "./types";
import { FACTOR_KEYS } from "./weights";
import { FACTOR_LABELS } from "./build-factors";

function factorDescription(
  factor: EdgeFactorInsight,
  data: AnalysisData,
): string {
  const pickFavor =
    factor.advantage === "advantage"
      ? "추천 팀 유리"
      : factor.advantage === "disadvantage"
        ? "추천 팀 불리"
        : "중립";

  switch (factor.key) {
    case "startingPitcher": {
      const hp = data.home.startingPitcher;
      const ap = data.away.startingPitcher;
      const hEra = hp?.era != null ? hp.era.toFixed(2) : "?";
      const aEra = ap?.era != null ? ap.era.toFixed(2) : "?";
      return `${data.homeTeam} 선발 ERA ${hEra} vs ${data.awayTeam} ERA ${aEra}. ${pickFavor} (score ${factor.score.toFixed(2)}).`;
    }
    case "recentForm":
      return `${data.homeTeam} 폼 ${data.home.recentForm.sequence} / ${data.awayTeam} 폼 ${data.away.recentForm.sequence}. ${pickFavor}.`;
    case "scoring":
      return `득점 평균 ${data.home.scoringAverages.scoredAvg.toFixed(1)} vs ${data.away.scoringAverages.scoredAvg.toFixed(1)}. ${pickFavor}.`;
    case "defense":
      return `실점 평균 ${data.home.scoringAverages.concededAvg.toFixed(1)} vs ${data.away.scoringAverages.concededAvg.toFixed(1)}. ${pickFavor}.`;
    case "homeAway":
      return `홈 승률 ${data.home.homeRecord.winRate.toFixed(1)}% vs 원정 승률 ${data.away.awayRecord.winRate.toFixed(1)}%. ${pickFavor}.`;
    case "leagueStanding":
      return `순위 ${data.home.leagueStanding.rank}위 vs ${data.away.leagueStanding.rank}위. ${pickFavor}.`;
    case "headToHead":
      return `맞대결 ${data.headToHead.homeTeamWins}-${data.headToHead.awayTeamWins} (${data.headToHead.played}경기). ${pickFavor}.`;
    case "rest":
      return `휴식일 ${data.home.restDays}일 vs ${data.away.restDays}일. ${pickFavor}.`;
    case "injuries":
      return `부상 ${data.home.injuries.length}명 vs ${data.away.injuries.length}명. ${pickFavor}.`;
    case "streak":
      return `스트릭 ${data.home.streak.type}${data.home.streak.count} vs ${data.away.streak.type}${data.away.streak.count}. ${pickFavor}.`;
    default:
      return `${FACTOR_LABELS[factor.key]} — ${pickFavor}.`;
  }
}

/**
 * impact 상위 factor → EdgeReason 객체 (4~6개)
 */
export function generateEdgeReasons(
  data: AnalysisData,
  factors: EdgeFactorInsight[],
): EdgeReason[] {
  const ranked = factors.filter(
    (f) => f.available && f.impactValue >= 0.15,
  );

  const selected = ranked.slice(0, 6);
  const reasons = selected.map((factor) => {
    const titlePrefix =
      factor.advantage === "advantage"
        ? "우위"
        : factor.advantage === "disadvantage"
          ? "열세"
          : "균형";

    return {
      title: `${factor.label} ${titlePrefix}`,
      description: factorDescription(factor, data),
      score: factor.score,
      importance: factor.importance,
      icon: factor.icon,
      factor: factor.key,
      impact: factor.impact,
    } satisfies EdgeReason;
  });

  if (reasons.length >= 4) return reasons;

  const fillers = factors
    .filter((f) => f.available && !reasons.some((r) => r.factor === f.key))
    .slice(0, 4 - reasons.length)
    .map(
      (factor) =>
        ({
          title: `${factor.label}`,
          description: factorDescription(factor, data),
          score: factor.score,
          importance: factor.importance,
          icon: factor.icon,
          factor: factor.key,
          impact: factor.impact,
        }) satisfies EdgeReason,
    );

  return [...reasons, ...fillers].slice(0, 6);
}

/**
 * 부상·선발·데이터 부족 → EdgeRisk 객체
 */
export function generateEdgeRisks(
  data: AnalysisData,
  availability: FactorAvailability,
): EdgeRisk[] {
  const risks: EdgeRisk[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  for (const side of [
    { teamId: "home" as const, team: data.home },
    { teamId: "away" as const, team: data.away },
  ]) {
    for (const injury of side.team.injuries ?? []) {
      if (injury.status === "out" || injury.status === "doubtful") {
        risks.push({
          id: nextId("injury"),
          title:
            injury.status === "out"
              ? `${side.team.teamName} 결장`
              : `${side.team.teamName} 출전 불투명`,
          description: `${injury.playerName}${injury.note ? ` — ${injury.note}` : ""}`,
          severity: injury.status === "out" ? "high" : "medium",
          category: "injury",
          teamId: side.teamId,
        });
      }
    }
  }

  if (!data.home.startingPitcher) {
    risks.push({
      id: nextId("lineup"),
      title: `${data.homeTeam} 선발 미확정`,
      description: "홈팀 선발투수가 아직 확정되지 않았습니다.",
      severity: "high",
      category: "lineup",
      teamId: "home",
    });
  }
  if (!data.away.startingPitcher) {
    risks.push({
      id: nextId("lineup"),
      title: `${data.awayTeam} 선발 미확정`,
      description: "원정팀 선발투수가 아직 확정되지 않았습니다.",
      severity: "high",
      category: "lineup",
      teamId: "away",
    });
  }

  const missing = FACTOR_KEYS.filter((k) => !availability[k]);
  if (missing.length > 0) {
    risks.push({
      id: nextId("data"),
      title: "데이터 부족",
      description: `사용 불가 지표: ${missing.map((k) => FACTOR_LABELS[k]).join(", ")} (${missing.length}/${FACTOR_KEYS.length})`,
      severity: missing.length >= 3 ? "high" : "medium",
      category: "data",
    });
  }

  if ((data.headToHead?.played ?? 0) === 0) {
    risks.push({
      id: nextId("data"),
      title: "맞대결 데이터 없음",
      description: "시즌 맞대결 기록이 없어 headToHead 기여도가 제한됩니다.",
      severity: "low",
      category: "data",
    });
  }

  return risks.slice(0, 8);
}
