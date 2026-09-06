/**
 * Frozen football context-dominance scorer v0.
 * Two metrics only. No weights. No market. No network.
 */

export type FootballIndependentDecisionV0 = "LEAN_HOME" | "LEAN_AWAY" | "PASS";

export type FootballMetricWinnerV0 =
  | "HOME"
  | "AWAY"
  | "TIE"
  | "INSUFFICIENT";

export type FootballContextCountsV0 = {
  fixturesPlayed: number | null;
  wins: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
};

export type FootballContextMetricsV0 = {
  contextWinRate: number | null;
  contextWinRateWins: number | null;
  contextWinRatePlayed: number | null;
  contextGoalDifferencePerGame: number | null;
  contextGoalDifferenceGoalsFor: number | null;
  contextGoalDifferenceGoalsAgainst: number | null;
  contextGoalDifferencePlayed: number | null;
};

export type FootballDominanceScoreV0 = {
  decision: FootballIndependentDecisionV0;
  reasonCodes: string[];
  metric1Winner: FootballMetricWinnerV0;
  metric2Winner: FootballMetricWinnerV0;
  home: FootballContextMetricsV0;
  away: FootballContextMetricsV0;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function deriveContextMetrics(
  counts: FootballContextCountsV0,
): FootballContextMetricsV0 {
  const played = finiteNumber(counts.fixturesPlayed);
  const wins = finiteNumber(counts.wins);
  const gf = finiteNumber(counts.goalsFor);
  const ga = finiteNumber(counts.goalsAgainst);
  const usableDenom = played != null && played > 0;
  return {
    contextWinRate: usableDenom && wins != null ? wins / played : null,
    contextWinRateWins: wins,
    contextWinRatePlayed: played,
    contextGoalDifferencePerGame:
      usableDenom && gf != null && ga != null ? (gf - ga) / played : null,
    contextGoalDifferenceGoalsFor: gf,
    contextGoalDifferenceGoalsAgainst: ga,
    contextGoalDifferencePlayed: played,
  };
}

function winner(
  home: number | null,
  away: number | null,
): FootballMetricWinnerV0 {
  if (home == null || away == null) return "INSUFFICIENT";
  if (home > away) return "HOME";
  if (away > home) return "AWAY";
  return "TIE";
}

export function scoreContextDominance(input: {
  home: FootballContextCountsV0;
  away: FootballContextCountsV0;
}): FootballDominanceScoreV0 {
  const home = deriveContextMetrics(input.home);
  const away = deriveContextMetrics(input.away);
  const metric1Winner = winner(home.contextWinRate, away.contextWinRate);
  const metric2Winner = winner(
    home.contextGoalDifferencePerGame,
    away.contextGoalDifferencePerGame,
  );

  if (metric1Winner === "INSUFFICIENT" || metric2Winner === "INSUFFICIENT") {
    return {
      decision: "PASS",
      reasonCodes: ["INSUFFICIENT_INDEPENDENT_DATA"],
      metric1Winner,
      metric2Winner,
      home,
      away,
    };
  }

  if (metric1Winner === "HOME" && metric2Winner === "HOME") {
    return {
      decision: "LEAN_HOME",
      reasonCodes: ["STRICT_BOTH_METRICS_HOME"],
      metric1Winner,
      metric2Winner,
      home,
      away,
    };
  }

  if (metric1Winner === "AWAY" && metric2Winner === "AWAY") {
    return {
      decision: "LEAN_AWAY",
      reasonCodes: ["STRICT_BOTH_METRICS_AWAY"],
      metric1Winner,
      metric2Winner,
      home,
      away,
    };
  }

  return {
    decision: "PASS",
    reasonCodes: ["NO_STRICT_DOMINANCE"],
    metric1Winner,
    metric2Winner,
    home,
    away,
  };
}
