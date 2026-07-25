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
  const merged: GameData[] = [];

  for (const list of sources) {
    for (const game of list) {
      const key =
        game.externalProvider && game.externalId
          ? `${game.externalProvider}:${game.externalId}`
          : `id:${game.id}`;

      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(game);
    }
  }

  return sortGames(merged);
}
