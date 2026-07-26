/**
 * 기본 야구 일정(TheSportsDB KBO/NPB + API-BASEBALL MLB)을
 * The Odds API 이벤트로 보완한다.
 *
 * - 중복이면 Provider GameData 우선
 * - Odds 전용 경기만 추가 (분석 없으면 aiAnalysisAvailable=false)
 * - getOdds 는 Provider 캐시 재사용 (attachOddsToGames 와 동일 호출 경로)
 * - 배당 계산·최고 배당 선정 로직은 변경하지 않는다
 */
import { buildGameId } from "@/lib/game-id";
import { instantToKst } from "@/lib/datetime/kst";
import {
  getOddsProvider,
  normalizeTeamNameForOdds,
  type OddsData,
  type OddsUsageMeta,
} from "@/lib/odds";
import { resolveSportKeysForLeagues } from "@/lib/odds/sport-key-resolver";
import { sortGames } from "@/lib/games/sort";
import type { GameData } from "@/types/game";

const BASEBALL_ODDS_LEAGUES = ["KBO", "NPB", "MLB"] as const;
const COMMENCE_TOLERANCE_MS = 3 * 60 * 60 * 1000;

export type BaseballScheduleComplementMeta = {
  theSportsDbCount: number;
  apiBaseballCount: number;
  primaryScheduleCount: number;
  oddsEventCount: number;
  /** 당일(KST)로 필터된 Odds → GameData 후보 수 */
  oddsScheduleCandidates: number;
  duplicateMergedCount: number;
  oddsOnlyAddedCount: number;
  finalCount: number;
  oddsCached: boolean;
  usage: OddsUsageMeta;
  sportKeys: Array<{
    league: string;
    sportKey: string;
    ok: boolean;
    eventCount: number;
    cached: boolean;
    error?: string;
  }>;
};

function emptyUsage(): OddsUsageMeta {
  return {
    requestsRemaining: null,
    requestsUsed: null,
    requestsLast: null,
  };
}

function teamNamesMatch(a: string, b: string): boolean {
  const na = normalizeTeamNameForOdds(a);
  const nb = normalizeTeamNameForOdds(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  return false;
}

function gameCommenceMs(game: GameData): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(game.date)) return null;
  const time =
    /^\d{2}:\d{2}/.test(game.startTime) && game.startTime !== "TBD"
      ? game.startTime.slice(0, 5)
      : "12:00";
  const ms = Date.parse(`${game.date}T${time}:00+09:00`);
  return Number.isFinite(ms) ? ms : null;
}

function oddsCommenceMs(odds: OddsData): number | null {
  if (!odds.commenceTime) return null;
  const ms = Date.parse(odds.commenceTime);
  return Number.isFinite(ms) ? ms : null;
}

function isSameBaseballFixture(a: GameData, b: GameData): boolean {
  if (a.league.toUpperCase() !== b.league.toUpperCase()) return false;
  if (!teamNamesMatch(a.homeTeam, b.homeTeam)) return false;
  if (!teamNamesMatch(a.awayTeam, b.awayTeam)) return false;

  const aMs = gameCommenceMs(a);
  const bMs = gameCommenceMs(b);
  if (aMs == null || bMs == null) {
    // 시간 없으면 리그+팀만으로 중복 인정 (같은 날 일정 병합 목적)
    return a.date === b.date;
  }
  return Math.abs(aMs - bMs) <= COMMENCE_TOLERANCE_MS;
}

/**
 * Odds 이벤트 → 일정용 GameData.
 * 배당 수치(best*)는 GameData 에 넣지 않는다 — 일정 보완 전용.
 */
export function oddsEventToScheduleGame(
  odds: OddsData,
  league: string,
): GameData | null {
  if (!odds.homeTeam?.trim() || !odds.awayTeam?.trim()) return null;
  const kst = instantToKst(odds.commenceTime);
  if (!kst) return null;

  return {
    id: buildGameId(league, odds.homeTeam, odds.awayTeam),
    sport: "baseball",
    league,
    homeTeam: odds.homeTeam,
    awayTeam: odds.awayTeam,
    startTime: kst.time,
    date: kst.date,
    aiAnalysisAvailable: false,
    externalId: odds.externalEventId,
    externalProvider: "the-odds-api",
  };
}

function toSafeError(reason: unknown): string {
  const raw =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "Unknown odds error";
  return raw.replace(/apiKey=[^&\s]+/gi, "apiKey=***");
}

/**
 * Provider 야구 일정 + Odds KBO/NPB/MLB 이벤트를 병합한다.
 *
 * @param scheduleGames Provider가 생성한 야구 일정
 * @param dateKst 대상 KST 날짜 YYYY-MM-DD
 */
export async function complementBaseballScheduleWithOdds(
  scheduleGames: GameData[],
  dateKst: string,
  enabledLeagues: readonly (typeof BASEBALL_ODDS_LEAGUES)[number][] =
    BASEBALL_ODDS_LEAGUES,
): Promise<{ games: GameData[]; meta: BaseballScheduleComplementMeta }> {
  const primary = scheduleGames.filter((g) => g.sport === "baseball");
  const meta: BaseballScheduleComplementMeta = {
    theSportsDbCount: primary.filter(
      (game) => game.externalProvider === "thesportsdb",
    ).length,
    apiBaseballCount: primary.filter(
      (game) => game.externalProvider === "api-baseball",
    ).length,
    primaryScheduleCount: primary.length,
    oddsEventCount: 0,
    oddsScheduleCandidates: 0,
    duplicateMergedCount: 0,
    oddsOnlyAddedCount: 0,
    finalCount: primary.length,
    oddsCached: true,
    usage: emptyUsage(),
    sportKeys: [],
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    return { games: sortGames(primary), meta };
  }

  let provider;
  try {
    provider = getOddsProvider();
  } catch {
    return { games: sortGames(primary), meta };
  }

  const resolved = await resolveSportKeysForLeagues(provider, {
    baseball: [...enabledLeagues],
    football: [],
  });

  if (resolved.length === 0) {
    return { games: sortGames(primary), meta };
  }

  const settled = await Promise.allSettled(
    resolved.map((r) =>
      provider.getOdds({ sportKey: r.sportKey, regions: "eu", markets: "h2h" }),
    ),
  );

  const oddsCandidates: GameData[] = [];
  let minRemaining: number | null = null;

  settled.forEach((result, index) => {
    const target = resolved[index];
    if (result.status !== "fulfilled") {
      meta.oddsCached = false;
      meta.sportKeys.push({
        league: target.league,
        sportKey: target.sportKey,
        ok: false,
        eventCount: 0,
        cached: false,
        error: toSafeError(result.reason),
      });
      return;
    }

    const value = result.value;
    meta.oddsEventCount += value.events.length;
    if (!value.cached) meta.oddsCached = false;
    meta.sportKeys.push({
      league: target.league,
      sportKey: target.sportKey,
      ok: true,
      eventCount: value.events.length,
      cached: value.cached,
    });

    const remaining = value.usage.requestsRemaining;
    if (
      remaining != null &&
      (minRemaining == null || remaining < minRemaining)
    ) {
      minRemaining = remaining;
      meta.usage = value.usage;
    } else if (meta.usage.requestsRemaining == null) {
      meta.usage = value.usage;
    }

    for (const event of value.events) {
      // 시간 허용 오차 매칭용 — commence 가 하루 경계에 걸치면 ±3h 후보도 포함
      const ms = oddsCommenceMs(event);
      if (ms == null) continue;
      const kst = instantToKst(new Date(ms));
      if (!kst) continue;

      // 당일 일정 + 전날/다음날 경계(±3h)에서 당일로 떨어지는 것만
      const dayStart = Date.parse(`${dateKst}T00:00:00+09:00`);
      const dayEnd = Date.parse(`${dateKst}T23:59:59.999+09:00`);
      if (
        ms < dayStart - COMMENCE_TOLERANCE_MS ||
        ms > dayEnd + COMMENCE_TOLERANCE_MS
      ) {
        continue;
      }
      // KST 날짜가 대상일이 아니면 스킵 (경계 오차는 팀 매칭 시 시간으로 처리)
      if (kst.date !== dateKst) continue;

      const game = oddsEventToScheduleGame(event, target.league);
      if (game) oddsCandidates.push(game);
    }
  });

  meta.oddsScheduleCandidates = oddsCandidates.length;

  const merged: GameData[] = [...primary];
  for (const oddsGame of oddsCandidates) {
    const dupIndex = merged.findIndex((g) => isSameBaseballFixture(g, oddsGame));
    if (dupIndex >= 0) {
      meta.duplicateMergedCount += 1;
      // Provider 일정을 우선 유지한다. Odds는 누락 일정 보완용이다.
      continue;
    }
    merged.push(oddsGame);
    meta.oddsOnlyAddedCount += 1;
  }

  const games = sortGames(merged);
  meta.finalCount = games.length;
  return { games, meta };
}

/** 콘솔 요약용 */
export function formatBaseballComplementSummary(
  meta: BaseballScheduleComplementMeta,
): string {
  return [
    `TheSportsDB 경기 수   : ${meta.theSportsDbCount}`,
    `API-BASEBALL 경기 수  : ${meta.apiBaseballCount}`,
    `Odds 이벤트 수        : ${meta.oddsEventCount}`,
    `Odds 당일 후보        : ${meta.oddsScheduleCandidates}`,
    `중복 병합 수          : ${meta.duplicateMergedCount}`,
    `Odds로 보완된 경기 수 : ${meta.oddsOnlyAddedCount}`,
    `최종 경기 수          : ${meta.finalCount}`,
    `Odds 캐시             : ${meta.oddsCached ? "all-cached" : "fetched"}`,
  ].join("\n");
}
