export type DailyCMarketBenchmark = {
  attached: boolean;
  marketBenchmarkOnly: boolean;
  source: string | null;
  observedAt: string | null;
  oddsHomeTeam: string | null;
  oddsAwayTeam: string | null;
  oddsBestHome: number | null;
  oddsBestDraw: number | null;
  oddsBestAway: number | null;
};

export type DailyCIndependentPrediction = {
  created: boolean;
  predictedSide: string | null;
  independentProbability: number | null;
  confidence: number | null;
};

export type DailyCGameRow = {
  operatorGameId: string;
  sport: string;
  rawLeagueLabel: string | null;
  rawHome: string;
  rawAway: string;
  canonicalHome: string | null;
  canonicalAway: string | null;
  displayedStartKst: string | null;
  displayedKickoffUtc: string | null;
  cState: string;
  independentPrediction: DailyCIndependentPrediction;
  marketBenchmark: DailyCMarketBenchmark;
  extraPublicGameIds: string[];
};

export type DailyCArtifact = {
  dateKst: string;
  predictionCount: number;
  passCount: number;
  marketBenchmarkOnly: boolean;
  providerLiveCalls: number;
  games: DailyCGameRow[];
  sourceRel: string;
};
