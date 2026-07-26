import type { GameData } from "@/types/game";
import {
  getOddsProvider,
  matchOddsToGames,
  type OddsData,
  type OddsUsageMeta,
} from "@/lib/odds";
import { resolveSportKeysForLeagues } from "@/lib/odds/sport-key-resolver";
import { getKstDateString, instantToKst } from "@/lib/datetime/kst";
import {
  toBareGameWithOdds,
  type GameWithOdds,
  type OddsAvailability,
} from "@/types/game-with-odds";

export type SportKeyMeta = {
  league: string;
  sportKey: string;
  ok: boolean;
  eventCount: number;
  cached: boolean;
  error?: string;
};

export type OddsEnrichmentMeta = {
  ok: boolean;
  error?: string;
  /** 요청한 sportKey 목록 (리그당 1개, 5분 캐시) */
  sportKeys: SportKeyMeta[];
  requestedSportKeyCount: number;
  /** 반환된 배당 이벤트 총수 */
  oddsEventCount: number;
  /** 일정과 매칭된 경기 수 */
  matchedCount: number;
  /** 배당이 붙지 않은 경기 수 */
  unmatchedGameCount: number;
  byMethod: Record<"external-id" | "teams-time", number>;
  /** 마지막 응답 기준 usage (remaining 최솟값 우선) */
  usage: OddsUsageMeta;
  /** 모든 키가 캐시에서 응답됐는지 */
  allCached: boolean;
  available: number;
  marketClosed: number;
  historicalNotLoaded: number;
  notYetPosted: number;
  notFound: number;
  providerError: number;
};

const BASEBALL_ODDS_LEAGUES = new Set(["KBO", "NPB", "MLB"]);

function emptyMeta(): OddsEnrichmentMeta {
  return {
    ok: true,
    sportKeys: [],
    requestedSportKeyCount: 0,
    oddsEventCount: 0,
    matchedCount: 0,
    unmatchedGameCount: 0,
    byMethod: { "external-id": 0, "teams-time": 0 },
    usage: { requestsRemaining: null, requestsUsed: null, requestsLast: null },
    allCached: true,
    available: 0,
    marketClosed: 0,
    historicalNotLoaded: 0,
    notYetPosted: 0,
    notFound: 0,
    providerError: 0,
  };
}

export type OddsAvailabilityContext = {
  now?: Date;
  leagueResolved: boolean;
  providerFailed: boolean;
  oddsEvents: OddsData[];
};

export type OddsAvailabilityResult = {
  availability: Exclude<OddsAvailability, "available">;
  reason: string;
};

function gameStartMs(game: GameData): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(game.date)) return null;
  if (!/^\d{2}:\d{2}/.test(game.startTime) || game.startTime === "TBD") {
    return null;
  }
  const value = Date.parse(
    `${game.date}T${game.startTime.slice(0, 5)}:00+09:00`,
  );
  return Number.isFinite(value) ? value : null;
}

/**
 * 미매칭 경기의 배당 상태를 결정한다.
 * historical API는 호출하지 않으며 현재 Odds 응답만 근거로 삼는다.
 */
export function classifyUnavailableOdds(
  game: GameData,
  context: OddsAvailabilityContext,
): OddsAvailabilityResult {
  if (context.providerFailed) {
    return {
      availability: "provider-error",
      reason: "배당 제공자 조회에 실패했습니다.",
    };
  }

  const now = context.now ?? new Date();
  const todayKst = getKstDateString(now);
  if (game.date < todayKst) {
    return {
      availability: "historical-not-loaded",
      reason: "과거 배당 데이터를 조회하지 않았습니다.",
    };
  }

  const startMs = gameStartMs(game);
  if (startMs != null && startMs < now.getTime()) {
    return {
      availability: "market-closed",
      reason: "경기 시작 후 현재 시장 배당이 마감되었습니다.",
    };
  }

  if (!context.leagueResolved) {
    return {
      availability: "not-found",
      reason: "활성 배당 시장을 찾지 못했습니다.",
    };
  }

  const hasSameDateEvents = context.oddsEvents.some(
    (event) => instantToKst(event.commenceTime)?.date === game.date,
  );
  if (!hasSameDateEvents) {
    return {
      availability: "not-yet-posted",
      reason: "해당 경기 날짜의 배당이 아직 게시되지 않았습니다.",
    };
  }

  return {
    availability: "not-found",
    reason: "같은 날짜의 다른 배당은 있지만 해당 경기 배당은 없습니다.",
  };
}

function updateAvailabilityCounts(
  items: GameWithOdds[],
  meta: OddsEnrichmentMeta,
): void {
  meta.available = 0;
  meta.marketClosed = 0;
  meta.historicalNotLoaded = 0;
  meta.notYetPosted = 0;
  meta.notFound = 0;
  meta.providerError = 0;

  for (const item of items) {
    switch (item.oddsAvailability) {
      case "available":
        meta.available += 1;
        break;
      case "market-closed":
        meta.marketClosed += 1;
        break;
      case "historical-not-loaded":
        meta.historicalNotLoaded += 1;
        break;
      case "not-yet-posted":
        meta.notYetPosted += 1;
        break;
      case "not-found":
        meta.notFound += 1;
        break;
      case "provider-error":
        meta.providerError += 1;
        break;
    }
  }
}

function markAllProviderError(
  items: GameWithOdds[],
  meta: OddsEnrichmentMeta,
): { items: GameWithOdds[]; meta: OddsEnrichmentMeta } {
  meta.ok = false;
  meta.error = "배당 조회 실패";
  meta.allCached = false;
  for (const item of items) {
    item.oddsAvailability = "provider-error";
    item.oddsUnavailableReason = "배당 제공자 조회에 실패했습니다.";
  }
  updateAvailabilityCounts(items, meta);
  return { items, meta };
}

export function buildProviderErrorOddsResult(
  games: GameData[],
): { items: GameWithOdds[]; meta: OddsEnrichmentMeta } {
  return markAllProviderError(games.map(toBareGameWithOdds), emptyMeta());
}

/**
 * 병합된 경기 목록에 시장 최고 배당을 연결한다.
 *
 * - 화면에 실제 노출된 리그만 sportKey 로 해석 (활성 /sports 목록 1시간 캐시)
 * - sportKey 당 1회 호출 (Provider 내부 5분 캐시)
 * - 리그 단위로만 매칭 → 종목/리그 교차 오매칭 차단
 * - 실패는 항목별로 격리 — 일정 표시는 영향받지 않는다
 * - API 키 로그 출력 금지
 */
export async function attachOddsToGames(
  games: GameData[],
): Promise<{ items: GameWithOdds[]; meta: OddsEnrichmentMeta }> {
  const items = games.map(toBareGameWithOdds);
  const meta = emptyMeta();
  meta.unmatchedGameCount = games.length;

  if (games.length === 0) return { items, meta };

  // 화면에 노출된 리그만 대상
  const baseballLeagues = new Set<string>();
  const footballLeagues = new Set<string>();
  for (const game of games) {
    if (game.sport === "baseball" && BASEBALL_ODDS_LEAGUES.has(game.league)) {
      baseballLeagues.add(game.league);
    } else if (game.sport === "football") {
      footballLeagues.add(game.league);
    }
  }

  let provider: ReturnType<typeof getOddsProvider>;
  let resolved: Awaited<ReturnType<typeof resolveSportKeysForLeagues>>;
  try {
    provider = getOddsProvider();
    resolved = await resolveSportKeysForLeagues(provider, {
      baseball: [...baseballLeagues],
      football: [...footballLeagues],
    });
  } catch {
    return markAllProviderError(items, meta);
  }

  meta.requestedSportKeyCount = resolved.length;
  const resolvedLeagues = new Set(resolved.map((entry) => entry.league));
  if (resolved.length === 0) {
    for (const item of items) {
      const status = classifyUnavailableOdds(item.game, {
        leagueResolved: false,
        providerFailed: false,
        oddsEvents: [],
      });
      item.oddsAvailability = status.availability;
      item.oddsUnavailableReason = status.reason;
    }
    updateAvailabilityCounts(items, meta);
    return { items, meta };
  }

  const settled = await Promise.allSettled(
    resolved.map((r) =>
      provider.getOdds({ sportKey: r.sportKey, regions: "eu", markets: "h2h" }),
    ),
  );

  const oddsByLeague = new Map<string, OddsData[]>();
  const failedLeagues = new Set<string>();
  let minRemaining: number | null = null;

  settled.forEach((result, index) => {
    const target = resolved[index];
    if (result.status === "fulfilled") {
      const value = result.value;
      oddsByLeague.set(target.league, value.events);
      meta.oddsEventCount += value.events.length;
      meta.sportKeys.push({
        league: target.league,
        sportKey: target.sportKey,
        ok: true,
        eventCount: value.events.length,
        cached: value.cached,
      });
      if (!value.cached) meta.allCached = false;

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
    } else {
      meta.ok = false;
      meta.error = "일부 배당 조회 실패";
      meta.allCached = false;
      failedLeagues.add(target.league);
      meta.sportKeys.push({
        league: target.league,
        sportKey: target.sportKey,
        ok: false,
        eventCount: 0,
        cached: false,
        error: "배당 조회 실패",
      });
    }
  });

  // 리그 단위 매칭 (같은 리그 배당만 후보로 — 종목·리그 확인)
  const itemByGameId = new Map(items.map((item) => [item.game.id, item]));

  for (const [league, oddsList] of oddsByLeague) {
    if (oddsList.length === 0) continue;
    const leagueGames = games.filter((g) => g.league === league);
    const matches = matchOddsToGames(leagueGames, oddsList);

    for (const match of matches) {
      const item = itemByGameId.get(match.game.id);
      if (!item) continue;
      item.odds = match.odds;
      item.oddsAvailability = "available";
      item.oddsUnavailableReason = null;
      item.oddsMatch = {
        matched: true,
        confidence: Math.round(match.confidence * 100) / 100,
        method: match.method,
      };
      meta.matchedCount += 1;
      meta.byMethod[match.method] += 1;
    }
  }

  for (const item of items) {
    if (item.oddsAvailability === "available") continue;
    const league = item.game.league;
    const status = classifyUnavailableOdds(item.game, {
      leagueResolved: resolvedLeagues.has(league),
      providerFailed: failedLeagues.has(league),
      oddsEvents: oddsByLeague.get(league) ?? [],
    });
    item.oddsAvailability = status.availability;
    item.oddsUnavailableReason = status.reason;
  }

  meta.unmatchedGameCount = games.length - meta.matchedCount;
  updateAvailabilityCounts(items, meta);
  return { items, meta };
}

