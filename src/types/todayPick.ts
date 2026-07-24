export type TodayPickData = {
  gameId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  aiWinRate: number;
  confidence: number;
  edgeValue: number;
  reasons: string[];
};
