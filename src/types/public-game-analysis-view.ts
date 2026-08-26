/**
 * Public match analysis view model (presentation only).
 * Does not carry research hashes, source paths, raw C codes, or provider IDs.
 */

export type PublicAnalysisState =
  | "YANG_EDGE_ANALYSIS"
  | "OFFICIAL_PREDICTION_DEFERRED"
  | "ANALYSIS_PREPARING"
  | "ANALYSIS_EXPANDING"
  | "PREGAME_ANALYSIS_UNAVAILABLE"
  | "UNRESOLVED"
  | "LEGACY_MIGRATING";

export type PublicRecentFormSide = {
  team: string;
  window: number;
  wins: number;
  draws: number;
  losses: number;
  summary: string;
};

export type PublicRecentForm = {
  home: PublicRecentFormSide;
  away: PublicRecentFormSide;
};

export type PublicMarketBenchmark = {
  available: true;
  sourceType: "해외 시장";
  observedAtLabel: string;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
  homeTeam: string;
  awayTeam: string;
  marketBenchmarkOnly: true;
  referenceNote: string;
};

export type PublicLineupData = {
  note: string;
};

export type PublicAvailabilityData = {
  note: string;
};

export type PublicCoachTacticsData = {
  note: string;
};

export type PublicTeamMetricsData = {
  note: string;
};

export type PublicGameAnalysisViewV1 = {
  game: {
    gameId: string;
    dateKst: string | null;
    sport: string | null;
    league: string | null;
    startTimeKst: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
  };
  analysis: {
    state: PublicAnalysisState;
    headline: string;
    description: string;
    officialPredictionAvailable: boolean;
    predictedSide: string | null;
    probability: number | null;
    confidence: number | null;
  };
  context: {
    keyPoints: string[];
    recentForm: PublicRecentForm | null;
    lineup: PublicLineupData | null;
    injuries: PublicAvailabilityData | null;
    coachTactics: PublicCoachTacticsData | null;
    teamMetrics: PublicTeamMetricsData | null;
  };
  market: PublicMarketBenchmark | null;
  meta: {
    updatedAt: string | null;
    disclaimer: string;
    preparingFallback: boolean;
  };
};

export const PUBLIC_ANALYSIS_DISCLAIMER =
  "YANG EDGE의 경기 분석은 참고용이며 결과나 수익을 보장하지 않습니다.";

export const PUBLIC_MARKET_REFERENCE_NOTE =
  "시장 배당은 참고 정보이며 YANG EDGE의 독립 분석 입력에는 사용하지 않습니다.";

export const PUBLIC_UNRESOLVED_HEADLINE = "경기 분석 정보를 준비하고 있습니다.";
export const PUBLIC_UNRESOLVED_DESCRIPTION =
  "이 경기의 분석 정보를 확인하고 있습니다.";
export const PUBLIC_LEGACY_MIGRATION_HEADLINE =
  "이 경기는 현재 새 분석 화면으로 이전 중입니다.";
export const PUBLIC_LEGACY_MIGRATION_DESCRIPTION =
  "표시할 수 있는 경기 분석이 아직 이 화면으로 옮겨지지 않았습니다.";
