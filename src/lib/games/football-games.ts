import type { GameData } from "@/types/game";
import {
  getEnabledFootballLeagueIds,
  getFootballLeagueConfig,
} from "@/constants/football-leagues";
import {
  getFootballProvider,
  mapFixtureToGame,
  type FootballUsageMeta,
} from "@/lib/football";

export type FootballGamesResult = {
  games: GameData[];
  usage: FootballUsageMeta;
  cached: boolean;
  /** API 가 반환한 전체 fixture 수 (필터 전) */
  totalFixtures: number;
  /** 관심 리그 필터 통과 수 */
  keptFixtures: number;
};

/**
 * 관심 리그 축구 경기만 반환.
 *
 * API-Football 날짜 응답을 **1회** 받아 서버에서 관심 리그 ID로 필터한다.
 * (리그별 반복 호출 금지 — 무료 한도 보호. 날짜 응답은 Provider 에서 10분 캐시.)
 *
 * 리그명은 관심 리그 설정의 displayName 으로 정규화한다.
 */
export async function getFootballGamesForDate(
  date: string,
): Promise<FootballGamesResult> {
  const provider = getFootballProvider();
  const result = await provider.getFixtures({
    date,
    timezone: "Asia/Seoul",
  });

  const allowedIds = getEnabledFootballLeagueIds();
  const games: GameData[] = [];

  for (const fixture of result.fixtures) {
    const leagueId = fixture.league?.id;
    if (leagueId == null || !allowedIds.has(leagueId)) continue;

    const game = mapFixtureToGame(fixture);
    if (!game) continue;

    const config = getFootballLeagueConfig(leagueId);
    games.push(config ? { ...game, league: config.displayName } : game);
  }

  return {
    games,
    usage: result.usage,
    cached: result.cached,
    totalFixtures: result.fixtures.length,
    keptFixtures: games.length,
  };
}
