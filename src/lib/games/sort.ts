import type { GameData } from "@/types/game";

/** 종목 정렬 우선순위 (요구: 종목 기준 정렬 안정화) */
const SPORT_ORDER: Record<GameData["sport"], number> = {
  baseball: 0,
  football: 1,
  basketball: 2,
};

/** 시간 미정("TBD")은 맨 뒤로 */
function timeKey(startTime: string): string {
  return /^\d{2}:\d{2}/.test(startTime) ? startTime : "99:99";
}

/**
 * 경기 정렬: 날짜 → 시작 시간 → 종목 → 리그
 * (모든 Provider 결과에 동일 적용)
 */
export function sortGames(games: GameData[]): GameData[] {
  return [...games].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);

    const at = timeKey(a.startTime);
    const bt = timeKey(b.startTime);
    if (at !== bt) return at.localeCompare(bt);

    if (a.sport !== b.sport) return SPORT_ORDER[a.sport] - SPORT_ORDER[b.sport];

    return a.league.localeCompare(b.league);
  });
}
