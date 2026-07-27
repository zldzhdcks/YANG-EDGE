export type SportCategory = "football" | "baseball" | "basketball";

export type GameData = {
  id: string;
  sport: SportCategory;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  date: string;
  /** Provider 원본 경기 상태 (제공되는 경우에만 보존) */
  status?: string;
  aiAnalysisAvailable: boolean;
  /**
   * 외부 제공자 이벤트 ID (예: TheSportsDB idEvent).
   * 내부 id(buildGameId)와 분리해 매핑한다.
   */
  externalId?: string;
  /** 외부 데이터 출처 힌트 */
  externalProvider?:
    | "thesportsdb"
    | "apisports"
    | "api-football"
    | "api-baseball"
    | "the-odds-api"
    | "dummy";
};

export type SportFilter = "all" | SportCategory;

export function getAnalysisPath(gameId: string): string {
  return `/analysis/${gameId}`;
}

/**
 * Research Analysis Viewer 경로용 gameId.
 * MLB api-baseball 경기는 prediction snapshot의 `mlb-{externalId}`와 맞춘다.
 * (UI 내부 `buildGameId` 슬러그와 research artifact id가 다르기 때문)
 */
export function getResearchAnalysisGameId(
  game: Pick<GameData, "id" | "league" | "externalId" | "externalProvider">,
): string {
  if (
    game.externalProvider === "api-baseball" &&
    game.externalId &&
    (game.league === "MLB" || game.id.startsWith("mlb-"))
  ) {
    return `mlb-${game.externalId}`;
  }
  return game.id;
}

export function getMatchLabel(game: Pick<GameData, "homeTeam" | "awayTeam">): string {
  return `${game.homeTeam} vs ${game.awayTeam}`;
}
