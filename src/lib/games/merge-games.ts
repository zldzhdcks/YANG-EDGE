import type { GameData } from "@/types/game";
import { sortGames } from "./sort";

/**
 * 여러 Provider(야구 TheSportsDB + 축구 API-Football) 결과를 하나로 병합한다.
 *
 * - 중복 제거: externalProvider+externalId 우선, 없으면 내부 id
 * - sport / externalId / externalProvider 필드 유지
 * - 최종 정렬: 날짜 → 시작시간 → 종목 → 리그
 * - 가짜 경기를 채우지 않는다 (빈 배열 그대로).
 */
export function mergeGames(...sources: GameData[][]): GameData[] {
  const seen = new Set<string>();
  const seenFixtures = new Set<string>();
  const merged: GameData[] = [];

  for (const list of sources) {
    for (const game of list) {
      const key =
        game.externalProvider && game.externalId
          ? `${game.externalProvider}:${game.externalId}`
          : `id:${game.id}`;
      const fixtureKey = buildFixtureKey(game);

      if (seen.has(key) || (fixtureKey != null && seenFixtures.has(fixtureKey))) {
        continue;
      }
      seen.add(key);
      if (fixtureKey != null) seenFixtures.add(fixtureKey);
      merged.push(game);
    }
  }

  return sortGames(merged);
}

function normalizeFixtureToken(value: string): string {
  return value.toLowerCase().normalize("NFKC").replace(/[^a-z0-9가-힣]/g, "");
}

/**
 * Provider가 달라도 동일한 리그·팀·정확한 시작 시각이면 보조 중복으로 본다.
 * 리그를 키에 포함해 MLB와 KBO/NPB 교차 제거를 막는다.
 * TBD는 더블헤더를 잘못 합칠 수 있어 보조 중복 판정에서 제외한다.
 */
function buildFixtureKey(game: GameData): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(game.date)) return null;
  if (!/^\d{2}:\d{2}/.test(game.startTime) || game.startTime === "TBD") {
    return null;
  }

  return [
    normalizeFixtureToken(game.league),
    normalizeFixtureToken(game.homeTeam),
    normalizeFixtureToken(game.awayTeam),
    game.date,
    game.startTime.slice(0, 5),
  ].join("|");
}
