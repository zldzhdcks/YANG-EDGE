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
  /**
   * 외부 제공자 이벤트 ID (예: TheSportsDB idEvent).
   * 내부 id(buildGameId)와 분리해 매핑한다.
   */
  externalId?: string;
  /** 외부 데이터 출처 힌트 */
  externalProvider?: "thesportsdb" | "apisports" | "api-football" | "dummy";
};

export type SportFilter = "all" | SportCategory;

export function getAnalysisPath(gameId: string): string {
  return `/analysis/${gameId}`;
}

export function getMatchLabel(game: Pick<GameData, "homeTeam" | "awayTeam">): string {
  return `${game.homeTeam} vs ${game.awayTeam}`;
}
