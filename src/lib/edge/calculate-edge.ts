import type { AnalysisData, StartingPitcher } from "@/types/engine-analysis";
import type {
  EdgeFactorKey,
  EdgeFactorScores,
  FactorAvailability,
} from "./types";
import {
  BASEBALL_EDGE_WEIGHTS,
  EDGE_SCORE_MAX,
  EDGE_SCORE_MIN,
  EDGE_SCORE_SCALE,
  WEIGHT_TOTAL,
} from "./weights";

/** NaN/Infinity 방지 */
export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

export function clamp(value: number, min: number, max: number): number {
  const n = safeNumber(value, min);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** 값을 [-1, 1]로 클램프 */
export function clampUnit(value: number): number {
  return clamp(value, -1, 1);
}

/** 표시·직렬화용 고정 소수 (결정성 유지) */
export function round4(value: number): number {
  return Math.round(safeNumber(value, 0) * 10000) / 10000;
}

function formStrength(sequence: string, last5Length: number): number {
  const seq = (sequence || "").toUpperCase().replace(/[^WDL]/g, "");
  if (seq.length === 0) {
    return last5Length > 0 ? 0 : Number.NaN;
  }
  let sum = 0;
  for (const ch of seq.slice(0, 5)) {
    if (ch === "W") sum += 1;
    else if (ch === "L") sum -= 1;
  }
  return sum / Math.min(seq.length, 5);
}

function injuryPenalty(
  injuries: AnalysisData["home"]["injuries"] | undefined,
): number {
  if (!injuries || injuries.length === 0) return 0;
  let penalty = 0;
  for (const item of injuries) {
    if (item.status === "out") penalty += 1;
    else if (item.status === "doubtful") penalty += 0.5;
    else if (item.status === "probable") penalty += 0.15;
  }
  return penalty;
}

function pitcherQuality(pitcher: StartingPitcher): number | null {
  if (!pitcher) return null;
  const era = safeNumber(pitcher.era, Number.NaN);
  if (!Number.isFinite(era)) return null;
  // ERA 낮을수록 좋음. 기준 3.50 대비 우위 → 양수 품질
  // quality ≈ (3.5 - era) / 2 → 대략 -1.75~+1.75, 이후 clampUnit
  let quality = (3.5 - era) / 2;
  const whip = pitcher.whip;
  if (typeof whip === "number" && Number.isFinite(whip)) {
    quality += (1.25 - whip) / 2;
  }
  return quality;
}

export type FactorBreakdown = {
  scores: EdgeFactorScores;
  availability: FactorAvailability;
};

/**
 * 홈 기준 factor 점수 (-1~+1).
 * 양수 = 홈 우세, 음수 = 원정 우세.
 */
export function computeFactorScores(data: AnalysisData): FactorBreakdown {
  const home = data.home;
  const away = data.away;
  const h2h = data.headToHead;

  const scores: EdgeFactorScores = {
    recentForm: 0,
    homeAway: 0,
    scoring: 0,
    defense: 0,
    leagueStanding: 0,
    headToHead: 0,
    rest: 0,
    injuries: 0,
    streak: 0,
    startingPitcher: 0,
  };

  const availability: FactorAvailability = {
    recentForm: false,
    homeAway: false,
    scoring: false,
    defense: false,
    leagueStanding: false,
    headToHead: false,
    rest: false,
    injuries: false,
    streak: false,
    startingPitcher: false,
  };

  // 1) recentForm
  const homeForm = formStrength(
    home.recentForm?.sequence ?? "",
    home.recentGames?.length ?? 0,
  );
  const awayForm = formStrength(
    away.recentForm?.sequence ?? "",
    away.recentGames?.length ?? 0,
  );
  if (Number.isFinite(homeForm) && Number.isFinite(awayForm)) {
    availability.recentForm = true;
    scores.recentForm = clampUnit((homeForm - awayForm) / 1.5);
  }

  // 2) homeAway — 홈팀의 홈 승률 vs 원정팀의 원정 승률
  const homeVenue = safeNumber(home.homeRecord?.winRate, Number.NaN);
  const awayVenue = safeNumber(away.awayRecord?.winRate, Number.NaN);
  if (Number.isFinite(homeVenue) && Number.isFinite(awayVenue)) {
    availability.homeAway = true;
    scores.homeAway = clampUnit((homeVenue - awayVenue) / 40);
  }

  // 3) scoring — 득점 평균
  const homeScored = safeNumber(home.scoringAverages?.scoredAvg, Number.NaN);
  const awayScored = safeNumber(away.scoringAverages?.scoredAvg, Number.NaN);
  if (Number.isFinite(homeScored) && Number.isFinite(awayScored)) {
    availability.scoring = true;
    scores.scoring = clampUnit((homeScored - awayScored) / 2.5);
  }

  // 4) defense — 실점 평균 (낮을수록 우세)
  const homeConc = safeNumber(home.scoringAverages?.concededAvg, Number.NaN);
  const awayConc = safeNumber(away.scoringAverages?.concededAvg, Number.NaN);
  if (Number.isFinite(homeConc) && Number.isFinite(awayConc)) {
    availability.defense = true;
    scores.defense = clampUnit((awayConc - homeConc) / 2.5);
  }

  // 5) leagueStanding
  const homeWp = safeNumber(
    home.leagueStanding?.winningPercentage ?? home.winRate / 100,
    Number.NaN,
  );
  const awayWp = safeNumber(
    away.leagueStanding?.winningPercentage ?? away.winRate / 100,
    Number.NaN,
  );
  if (Number.isFinite(homeWp) && Number.isFinite(awayWp)) {
    availability.leagueStanding = true;
    scores.leagueStanding = clampUnit((homeWp - awayWp) / 0.25);
  } else {
    const homeRank = safeNumber(home.leagueStanding?.rank, Number.NaN);
    const awayRank = safeNumber(away.leagueStanding?.rank, Number.NaN);
    if (Number.isFinite(homeRank) && Number.isFinite(awayRank)) {
      availability.leagueStanding = true;
      // 순위 낮을수록 좋음
      scores.leagueStanding = clampUnit((awayRank - homeRank) / 6);
    }
  }

  // 6) headToHead
  const played = safeNumber(h2h?.played, 0);
  if (played > 0) {
    availability.headToHead = true;
    const homeWins = safeNumber(h2h.homeTeamWins, 0);
    const awayWins = safeNumber(h2h.awayTeamWins, 0);
    scores.headToHead = clampUnit((homeWins - awayWins) / played);
  }

  // 7) rest
  const homeRest = safeNumber(home.restDays, Number.NaN);
  const awayRest = safeNumber(away.restDays, Number.NaN);
  if (Number.isFinite(homeRest) && Number.isFinite(awayRest)) {
    availability.rest = true;
    scores.rest = clampUnit((homeRest - awayRest) / 2);
  }

  // 8) injuries — 페널티가 적을수록 우세
  availability.injuries = true;
  const homeInj = injuryPenalty(home.injuries);
  const awayInj = injuryPenalty(away.injuries);
  scores.injuries = clampUnit((awayInj - homeInj) / 2);

  // 9) streak
  const streakVal = (side: AnalysisData["home"]): number => {
    const count = safeNumber(side.streak?.count, 0);
    const type = side.streak?.type ?? "none";
    if (type === "win") return count;
    if (type === "loss") return -count;
    return 0;
  };
  availability.streak = true;
  scores.streak = clampUnit((streakVal(home) - streakVal(away)) / 4);

  // 10) startingPitcher (야구)
  const homePitch = pitcherQuality(home.startingPitcher ?? null);
  const awayPitch = pitcherQuality(away.startingPitcher ?? null);
  if (homePitch !== null && awayPitch !== null) {
    availability.startingPitcher = true;
    scores.startingPitcher = clampUnit((homePitch - awayPitch) / 1.5);
  }

  // 최종 방어: 모든 점수 finite + 소수 고정
  for (const key of Object.keys(scores) as EdgeFactorKey[]) {
    scores[key] = round4(clampUnit(safeNumber(scores[key], 0)));
  }

  return { scores, availability };
}

/**
 * 가중 합산 후 EDGE Score (-30 ~ +30) 계산.
 * 양수 = 홈 우세, 음수 = 원정 우세.
 */
export function calculateEdgeScore(scores: EdgeFactorScores): number {
  let weighted = 0;
  for (const key of Object.keys(BASEBALL_EDGE_WEIGHTS) as EdgeFactorKey[]) {
    const w = BASEBALL_EDGE_WEIGHTS[key];
    const s = safeNumber(scores[key], 0);
    weighted += s * w;
  }
  const normalized = weighted / WEIGHT_TOTAL; // -1 ~ +1
  return round4(
    clamp(
      safeNumber(normalized, 0) * EDGE_SCORE_SCALE,
      EDGE_SCORE_MIN,
      EDGE_SCORE_MAX,
    ),
  );
}

/**
 * EDGE Score → 추천 팀 승리 확률 (시제품 규칙).
 *
 * 주의: 실제 확률 모델이 아니다.
 * 50%를 기준으로 |EDGE Score|만큼 가산한 뒤 20~80%로 제한한다.
 * (EDGE Score ±30 ↔ 확률 20~80)
 */
export function edgeScoreToWinProbability(edgeScore: number): number {
  const score = safeNumber(edgeScore, 0);
  const pickBias = Math.abs(score);
  return round4(clamp(50 + pickBias, 20, 80));
}

export function pickFromEdgeScore(
  edgeScore: number,
  homeName: string,
  awayName: string,
): { pickTeamId: "home" | "away"; pickTeamName: string } {
  // 동점(0)은 홈팀으로 결정 — 결정적(deterministic) 타이브레이크
  if (safeNumber(edgeScore, 0) >= 0) {
    return { pickTeamId: "home", pickTeamName: homeName || "Home" };
  }
  return { pickTeamId: "away", pickTeamName: awayName || "Away" };
}

export function gradeFromEdgeScore(edgeScore: number): {
  grade: "S" | "A+" | "A" | "B" | "C";
  label: string;
} {
  const abs = Math.abs(safeNumber(edgeScore, 0));
  if (abs >= 20) return { grade: "S", label: "Elite Edge" };
  if (abs >= 15) return { grade: "A+", label: "Premium Edge" };
  if (abs >= 10) return { grade: "A", label: "Strong Edge" };
  if (abs >= 5) return { grade: "B", label: "Moderate Edge" };
  return { grade: "C", label: "Low Edge" };
}
