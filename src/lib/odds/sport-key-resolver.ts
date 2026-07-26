import { getCachedOdds, setCachedOdds } from "./cache";
import type { OddsProvider, OddsSportInfo } from "./types";

/**
 * The Odds API 활성 sport key 해석.
 *
 * /sports 목록(쿼터 미차감)을 1시간 캐시하고,
 * 실제 활성(active)인 리그만 sportKey 로 반환한다.
 * key 를 추측 하드코딩하지 않는다 — title/description 매칭으로 검증.
 */

const SPORTS_LIST_CACHE_KEY = "the-odds-api:sports-list";
const SPORTS_LIST_TTL_MS = 60 * 60 * 1000;

export async function getActiveSportsListCached(
  provider: OddsProvider,
): Promise<OddsSportInfo[]> {
  const cached = getCachedOdds<OddsSportInfo[]>(SPORTS_LIST_CACHE_KEY);
  if (cached) return cached;

  if (!provider.listSports) return [];
  const { sports } = await provider.listSports();
  const active = sports.filter((s) => s.active && !s.hasOutrights);
  setCachedOdds(SPORTS_LIST_CACHE_KEY, active, SPORTS_LIST_TTL_MS);
  return active;
}

/** 야구 리그명 → 활성 /sports title/description 힌트 */
const BASEBALL_LEAGUE_HINTS: Record<string, string[]> = {
  KBO: ["kbo", "korea baseball"],
  NPB: ["npb", "nippon professional baseball", "japan baseball"],
  MLB: ["mlb", "major league baseball"],
};

/**
 * /games 축구 리그 displayName → The Odds API title/description 힌트.
 * (src/constants/football-leagues.ts 의 displayName 기준)
 */
const FOOTBALL_LEAGUE_HINTS: Record<string, string[]> = {
  "프리미어리그": ["epl", "english premier league"],
  "라리가": ["la liga"],
  "분데스리가": ["bundesliga"],
  "세리에 A": ["serie a - italy", "serie a italy", "serie a"],
  "리그 1": ["ligue 1", "ligue one"],
  "UEFA 챔피언스리그": ["uefa champions league"],
  "UEFA 유로파리그": ["uefa europa league"],
  MLS: ["mls", "major league soccer"],
  "K리그1": ["k league 1", "k-league"],
  "J1리그": ["j league", "j-league"],
};

function findSportByHints(
  sports: OddsSportInfo[],
  hints: string[],
  group?: string,
): OddsSportInfo | null {
  const pool = group
    ? sports.filter((s) => s.group.toLowerCase() === group.toLowerCase())
    : sports;

  const candidates: OddsSportInfo[] = [];
  for (const sport of pool) {
    const hay = `${sport.title} ${sport.description}`.toLowerCase();
    if (hints.some((h) => hay.includes(h))) {
      candidates.push(sport);
    }
  }
  if (candidates.length === 0) return null;

  // 가장 짧은 title = 기본 리그일 확률이 높음 (예: "Bundesliga" vs "Bundesliga 2")
  candidates.sort((a, b) => a.title.length - b.title.length);
  return candidates[0];
}

export type ResolvedSportKey = {
  /** 우리 화면 리그명 (NPB, KBO, 프리미어리그 …) */
  league: string;
  sportKey: string;
  title: string;
};

/**
 * 화면에 실제 노출된 리그 목록만 받아 활성 sportKey 로 해석한다.
 * 지원되지 않는(비활성) 리그는 결과에서 제외 — 불필요한 odds 호출 방지.
 */
export async function resolveSportKeysForLeagues(
  provider: OddsProvider,
  leagues: { baseball: string[]; football: string[] },
): Promise<ResolvedSportKey[]> {
  const sports = await getActiveSportsListCached(provider);
  if (sports.length === 0) return [];

  const resolved: ResolvedSportKey[] = [];
  const usedKeys = new Set<string>();

  for (const league of leagues.baseball) {
    const hints = BASEBALL_LEAGUE_HINTS[league.toUpperCase()];
    if (!hints) continue;
    const hit = findSportByHints(sports, hints, "Baseball");
    if (hit && !usedKeys.has(hit.key)) {
      usedKeys.add(hit.key);
      resolved.push({ league, sportKey: hit.key, title: hit.title });
    }
  }

  for (const league of leagues.football) {
    const hints = FOOTBALL_LEAGUE_HINTS[league];
    if (!hints) continue;
    const hit = findSportByHints(sports, hints, "Soccer");
    if (hit && !usedKeys.has(hit.key)) {
      usedKeys.add(hit.key);
      resolved.push({ league, sportKey: hit.key, title: hit.title });
    }
  }

  return resolved;
}
