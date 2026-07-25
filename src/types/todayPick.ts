export type TodayPickData = {
  gameId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  aiWinRate: number;
  confidence: number;
  edgeValue: number;
  reasons: string[];
  /** 추천 팀 기준 정규화 시장 확률 (0~100). 야구 2-way + 배당 매칭 시에만. */
  marketProbability?: number | null;
  /** Value Edge (percentage points). 비교 불가면 null. */
  valueEdge?: number | null;
  /** 야구 2-way + 완전 배당 + 모델 비교 가능 시에만 true */
  comparisonAvailable?: boolean;
};
