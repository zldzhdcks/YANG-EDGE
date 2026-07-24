export type SportCategory = "football" | "baseball" | "basketball";

export type GameData = {
  id: string;
  sport: SportCategory;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  date: string;
  aiAnalysisAvailable: boolean;
};

export type SportFilter = "all" | SportCategory;

export function getAnalysisPath(gameId: string): string {
  return `/analysis/${gameId}`;
}

export function getMatchLabel(game: Pick<GameData, "homeTeam" | "awayTeam">): string {
  return `${game.homeTeam} vs ${game.awayTeam}`;
}
