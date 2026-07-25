import type { GameData } from "@/types/game";
import {
  getOddsProvider,
  matchOddsToGames,
  type OddsData,
  type OddsUsageMeta,
} from "@/lib/odds";
import { resolveSportKeysForLeagues } from "@/lib/odds/sport-key-resolver";
import {
  toBareGameWithOdds,
  type GameWithOdds,
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
};

const BASEBALL_ODDS_LEAGUES = new Set(["NPB", "KBO"]);

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
  };
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

  const provider = getOddsProvider();
  const resolved = await resolveSportKeysForLeagues(provider, {
    baseball: [...baseballLeagues],
    football: [...footballLeagues],
  });

  meta.requestedSportKeyCount = resolved.length;
  if (resolved.length === 0) return { items, meta };

  const settled = await Promise.allSettled(
    resolved.map((r) =>
      provider.getOdds({ sportKey: r.sportKey, regions: "eu", markets: "h2h" }),
    ),
  );

  const oddsByLeague = new Map<string, OddsData[]>();
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
      meta.allCached = false;
      meta.sportKeys.push({
        league: target.league,
        sportKey: target.sportKey,
        ok: false,
        eventCount: 0,
        cached: false,
        error: toSafeError(result.reason),
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
      item.oddsMatch = {
        matched: true,
        confidence: Math.round(match.confidence * 100) / 100,
        method: match.method,
      };
      meta.matchedCount += 1;
      meta.byMethod[match.method] += 1;
    }
  }

  meta.unmatchedGameCount = games.length - meta.matchedCount;
  return { items, meta };
}

export function toSafeError(reason: unknown): string {
  const raw =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "Unknown odds error";
  return raw.replace(/apiKey=[^&\s]+/gi, "apiKey=***");
}
