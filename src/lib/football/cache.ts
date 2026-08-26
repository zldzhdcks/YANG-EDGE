/**
 * Football API 서버 메모리 캐시.
 * 무료 한도(100요청/일, 10요청/분) 보호용. API 키는 키/값에 넣지 않는다.
 */

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const store = new Map<string, CacheEntry<unknown>>();

/** fixtures 날짜별 — 최소 10분 */
export const FIXTURES_CACHE_TTL_MS = 10 * 60 * 1000;
/** standings — 1시간 */
export const STANDINGS_CACHE_TTL_MS = 60 * 60 * 1000;
/** team statistics — 1시간 */
export const TEAM_STATS_CACHE_TTL_MS = 60 * 60 * 1000;
/** injuries / lineups — TODO: 짧은 TTL (예: 5분) 적용 예정 */
export const SHORT_CACHE_TTL_MS = 5 * 60 * 1000;
/** player season stats — medium-lived, same class as team statistics */
export const PLAYERS_STATS_CACHE_TTL_MS = TEAM_STATS_CACHE_TTL_MS;
/** current squad snapshot — medium-lived */
export const SQUAD_CACHE_TTL_MS = TEAM_STATS_CACHE_TTL_MS;
/** coach profile/career — medium-lived */
export const COACH_CACHE_TTL_MS = TEAM_STATS_CACHE_TTL_MS;

export function getFootballCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setFootballCache<T>(
  key: string,
  value: T,
  ttlMs: number,
): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function footballFixturesCacheKey(params: {
  date: string;
  leagueId?: number;
  season?: number;
  timezone?: string;
}): string {
  return [
    "fixtures",
    params.date,
    params.leagueId ?? "",
    params.season ?? "",
    params.timezone ?? "Asia/Seoul",
  ].join("|");
}
