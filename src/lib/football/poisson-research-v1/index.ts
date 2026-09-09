/** Independent 90-minute model. No odds, providers, live data or production promotion. */
import { isOddsIsoInstant } from "../odds-1x2-v1/instant";

export type HistoricalMatch = {
  matchId: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
  resultObservedAt: string;
  regulationHomeGoals: number;
  regulationAwayGoals: number;
};
export type PredictionInput = {
  target: { matchId: string; competitionId: string; homeTeamId: string; awayTeamId: string; kickoffAt: string };
  cutoffAt: string;
  history: HistoricalMatch[];
};

// Research assumptions, not optimized or validated performance thresholds.
export const POLICY = Object.freeze({
  version: "football-poisson-research-v1",
  minCompetitionMatches: 30,
  minVenueMatches: 5,
  priorMatches: 5,
  lookbackDays: 365,
  maxExpectedGoals: 10,
});

function instant(value: string): number {
  if (!isOddsIsoInstant(value)) throw new Error("INVALID_TIMESTAMP");
  return Date.parse(value);
}
function identity(...values: string[]) {
  if (values.some((v) => typeof v !== "string" || !v.trim())) throw new Error("INVALID_IDENTITY");
}

/** Adaptive score grid: excluded joint probability mass is below 2e-12. */
export function scoreProbabilities(homeRate: number, awayRate: number) {
  function poisson(rate: number): number[] {
    if (!Number.isFinite(rate) || rate <= 0 || rate > POLICY.maxExpectedGoals) throw new Error("INVALID_GOAL_RATE");
    const p = [Math.exp(-rate)];
    let sum = p[0];
    for (let k = 1; 1 - sum > 1e-12 && k < 200; k++) {
      p.push(p[k - 1] * rate / k);
      sum += p[k];
    }
    if (1 - sum > 1e-12) throw new Error("SCORE_GRID_DID_NOT_CONVERGE");
    return p;
  }
  const h = poisson(homeRate), a = poisson(awayRate);
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i < h.length; i++) for (let j = 0; j < a.length; j++) {
    const p = h[i] * a[j];
    if (i > j) home += p;
    else if (i === j) draw += p;
    else away += p;
  }
  const mass = home + draw + away;
  return { home: home / mass, draw: draw / mass, away: away / mass, excludedMass: Math.max(0, 1 - mass) };
}

export function predictFootball(input: PredictionInput) {
  const { target, history } = input;
  identity(target.matchId, target.competitionId, target.homeTeamId, target.awayTeamId);
  if (target.homeTeamId === target.awayTeamId) throw new Error("SAME_TEAM_TARGET");
  const cutoff = instant(input.cutoffAt);
  if (cutoff >= instant(target.kickoffAt)) throw new Error("CUTOFF_NOT_PREGAME");
  const ids = new Set<string>();
  const selected: HistoricalMatch[] = [];
  let excluded = 0;
  for (const row of history) {
    identity(row.matchId, row.competitionId, row.homeTeamId, row.awayTeamId);
    if (ids.has(row.matchId)) throw new Error("DUPLICATE_MATCH_ID");
    ids.add(row.matchId);
    if (row.homeTeamId === row.awayTeamId) throw new Error("SAME_TEAM_HISTORY");
    const kickoff = instant(row.kickoffAt), observed = instant(row.resultObservedAt);
    if (observed <= kickoff) throw new Error("RESULT_OBSERVED_BEFORE_COMPLETION");
    if (![row.regulationHomeGoals, row.regulationAwayGoals].every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 100)) throw new Error("INVALID_REGULATION_SCORE");
    if (row.matchId === target.matchId || row.competitionId !== target.competitionId ||
      observed >= cutoff || kickoff >= cutoff || kickoff < cutoff - POLICY.lookbackDays * 86400000) {
      excluded++;
      continue;
    }
    selected.push(row);
  }
  selected.sort((a, b) => a.matchId.localeCompare(b.matchId));
  const homeRows = selected.filter((r) => r.homeTeamId === target.homeTeamId);
  const awayRows = selected.filter((r) => r.awayTeamId === target.awayTeamId);
  const evidence = {
    competitionMatches: selected.length, homeVenueMatches: homeRows.length,
    awayVenueMatches: awayRows.length, excludedMatches: excluded,
    sourceMatchIds: selected.map((r) => r.matchId),
  };
  const common = { modelVersion: POLICY.version, researchOnly: true as const, calibrated: false as const, officialPick: null, target, cutoffAt: input.cutoffAt, evidence };
  const reasons: string[] = [];
  if (selected.length < POLICY.minCompetitionMatches) reasons.push("INSUFFICIENT_COMPETITION_HISTORY");
  if (homeRows.length < POLICY.minVenueMatches) reasons.push("INSUFFICIENT_HOME_HISTORY");
  if (awayRows.length < POLICY.minVenueMatches) reasons.push("INSUFFICIENT_AWAY_HISTORY");
  if (reasons.length) return { ...common, status: "INSUFFICIENT_DATA" as const, reasons, probabilities: null, expectedGoals: null };
  const sum = (rows: HistoricalMatch[], side: "regulationHomeGoals" | "regulationAwayGoals") => rows.reduce((n, r) => n + r[side], 0);
  const leagueHome = sum(selected, "regulationHomeGoals") / selected.length;
  const leagueAway = sum(selected, "regulationAwayGoals") / selected.length;
  if (leagueHome <= 0 || leagueAway <= 0) return { ...common, status: "INSUFFICIENT_DATA" as const, reasons: ["ZERO_COMPETITION_GOAL_RATE"], probabilities: null, expectedGoals: null };
  const shrunk = (rows: HistoricalMatch[], side: "regulationHomeGoals" | "regulationAwayGoals", prior: number) =>
    (sum(rows, side) + POLICY.priorMatches * prior) / (rows.length + POLICY.priorMatches);
  const home = shrunk(homeRows, "regulationHomeGoals", leagueHome) * shrunk(awayRows, "regulationHomeGoals", leagueHome) / leagueHome;
  const away = shrunk(awayRows, "regulationAwayGoals", leagueAway) * shrunk(homeRows, "regulationAwayGoals", leagueAway) / leagueAway;
  if (Math.max(home, away) > POLICY.maxExpectedGoals) return { ...common, status: "INSUFFICIENT_DATA" as const, reasons: ["GOAL_RATE_OUT_OF_RANGE"], probabilities: null, expectedGoals: null };
  return { ...common, status: "RESEARCH_PREDICTED" as const, reasons: [], expectedGoals: { home, away }, probabilities: scoreProbabilities(home, away) };
}
