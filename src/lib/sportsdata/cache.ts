/**
 * SportsDataIO 요청 메모리 캐시.
 * API 키는 캐시 키/값에 넣지 않는다.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getCachedSportsData<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedSportsData<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearSportsDataCache(): void {
  store.clear();
}

export const SPORTSDATA_CACHE_TTL_MS = DEFAULT_TTL_MS;
