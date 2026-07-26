import type { GameWithOdds } from "@/types/game-with-odds";
import { getFootballLeaguePriorityByName } from "@/constants/football-leagues";

/** 야구 리그 우선순위 (축구 관심 리그보다 앞) */
const BASEBALL_LEAGUE_ORDER = ["NPB", "KBO", "MLB"];

/** 리그당 초기 노출 경기 수 — "더 보기" 확장 대비 */
export const LEAGUE_INITIAL_VISIBLE = 10;

function timeKey(startTime: string): string {
  return /^\d{2}:\d{2}/.test(startTime) ? startTime : "99:99";
}

export type LeagueGroup = {
  league: string;
  /** 시간순 전체 경기 */
  games: GameWithOdds[];
  /** 초기 노출분 (최대 LEAGUE_INITIAL_VISIBLE) */
  visibleGames: GameWithOdds[];
  totalCount: number;
  hiddenCount: number;
  hasMore: boolean;
};

/**
 * 리그 그룹 정렬 우선순위.
 * 야구(NPB → KBO → MLB) → 축구 관심 리그(priority) → 기타(이름순)
 */
function leaguePriority(league: string): number {
  const baseballIndex = BASEBALL_LEAGUE_ORDER.indexOf(league);
  if (baseballIndex !== -1) return baseballIndex;

  const footballPriority = getFootballLeaguePriorityByName(league);
  if (footballPriority != null) {
    return BASEBALL_LEAGUE_ORDER.length + footballPriority;
  }

  return 9999;
}

/**
 * 리그별로 묶고, 같은 리그 안에서는 시작 시간순 정렬.
 * 리그당 초기 노출은 LEAGUE_INITIAL_VISIBLE 로 제한하되
 * 전체 목록(games)도 함께 담아 "더 보기" 를 쉽게 붙일 수 있게 한다.
 */
export function groupGamesByLeague(items: GameWithOdds[]): LeagueGroup[] {
  const map = new Map<string, GameWithOdds[]>();

  for (const item of items) {
    const key = item.game.league || "기타";
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }

  const groups: LeagueGroup[] = Array.from(map.entries()).map(
    ([league, leagueItems]) => {
      const sorted = [...leagueItems].sort((a, b) =>
        timeKey(a.game.startTime).localeCompare(timeKey(b.game.startTime)),
      );
      const visibleGames = sorted.slice(0, LEAGUE_INITIAL_VISIBLE);

      return {
        league,
        games: sorted,
        visibleGames,
        totalCount: sorted.length,
        hiddenCount: sorted.length - visibleGames.length,
        hasMore: sorted.length > visibleGames.length,
      };
    },
  );

  groups.sort((a, b) => {
    const pa = leaguePriority(a.league);
    const pb = leaguePriority(b.league);
    if (pa !== pb) return pa - pb;
    return a.league.localeCompare(b.league);
  });

  return groups;
}

/** YYYY-MM-DD → "2026년 7월 25일" */
export function formatKoreanDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const year = match[1];
  const month = Number(match[2]);
  const day = Number(match[3]);
  return `${year}년 ${month}월 ${day}일`;
}
