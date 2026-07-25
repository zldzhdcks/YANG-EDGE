/**
 * /api/games + OddsProvider 연결 검증.
 *
 * - 전체 경기 수 / 배당 반환 수 / 매칭 성공·실패 수 / 방식별 수
 * - 첫 5개 매칭 결과
 * - API 사용량 (remaining/used/last)
 * - 동일 날짜 2회 호출 → sportKey 캐시 재사용 확인
 *
 * 무료 요청량 보호: 같은 sportKey 를 반복 호출하지 않는다
 * (Provider 5분 캐시 + /sports 목록 1시간 캐시).
 *
 * 실행: npx tsx --env-file=.env.local scripts/verify-games-with-odds.ts
 */

import { GET } from "../src/app/api/games/route";
import { getKstToday } from "../src/lib/datetime/kst";

async function main() {
  const date = getKstToday();
  console.log("KST today:", date);

  async function call(label: string) {
    const res = await GET(
      new Request(`http://localhost:3000/api/games?date=${date}`),
    );
    const body = (await res.json()) as {
      games: Array<{
        game: {
          league: string;
          homeTeam: string;
          awayTeam: string;
          startTime: string;
          sport: string;
        };
        odds: {
          bestHomeOdds: number | null;
          bestDrawOdds: number | null;
          bestAwayOdds: number | null;
          bookmakers: unknown[];
        } | null;
        oddsMatch: { matched: boolean; confidence: number; method: string };
      }>;
      meta: {
        status: string;
        odds: {
          ok: boolean;
          error?: string;
          sportKeys?: Array<{
            league: string;
            sportKey: string;
            ok: boolean;
            eventCount: number;
            cached: boolean;
            error?: string;
          }>;
          requestedSportKeyCount?: number;
          oddsEventCount?: number;
          matchedCount?: number;
          unmatchedGameCount?: number;
          byMethod?: Record<string, number>;
          usage?: unknown;
          allCached?: boolean;
        };
      };
    };

    console.log(`\n=== ${label} — HTTP ${res.status} status=${body.meta.status} ===`);

    const odds = body.meta.odds;
    console.log("전체 경기 수      :", body.games.length);
    console.log("odds.ok           :", odds.ok, odds.error ? `(${odds.error})` : "");
    console.log("요청 sportKey 수  :", odds.requestedSportKeyCount ?? 0);
    for (const k of odds.sportKeys ?? []) {
      console.log(
        `  - ${k.league} → ${k.sportKey}: ok=${k.ok} events=${k.eventCount} cached=${k.cached}${k.error ? ` error=${k.error}` : ""}`,
      );
    }
    console.log("배당 반환 이벤트  :", odds.oddsEventCount ?? 0);
    console.log("매칭 성공         :", odds.matchedCount ?? 0);
    console.log("매칭 실패(무배당) :", odds.unmatchedGameCount ?? 0);
    console.log("방식별            :", odds.byMethod ?? {});
    console.log("usage             :", odds.usage ?? null);
    console.log("allCached         :", odds.allCached ?? false);

    const matched = body.games.filter((g) => g.oddsMatch.matched);
    console.log("\n첫 5개 매칭 결과:");
    for (const item of matched.slice(0, 5)) {
      const o = item.odds;
      console.log(
        `  [${item.oddsMatch.method} ${item.oddsMatch.confidence}] ` +
          `${item.game.league} | ${item.game.homeTeam} vs ${item.game.awayTeam} ${item.game.startTime} ` +
          `| 홈 ${o?.bestHomeOdds ?? "-"}` +
          (o?.bestDrawOdds != null ? ` 무 ${o.bestDrawOdds}` : "") +
          ` 원정 ${o?.bestAwayOdds ?? "-"}` +
          ` (북메이커 ${o?.bookmakers.length ?? 0})`,
      );
    }
    if (matched.length === 0) console.log("  (매칭된 경기 없음)");

    return body;
  }

  await call("1차 호출");
  // 같은 sportKey 반복 호출 금지 검증 — 2차는 캐시에서 응답돼야 한다
  const second = await call("2차 호출 (캐시 확인)");

  if (second.meta.odds.ok && second.meta.odds.allCached) {
    console.log("\n✅ 2차 호출 allCached=true — 추가 odds API 호출 없음");
  } else if (second.meta.odds.ok) {
    console.log("\n⚠️ 2차 호출에 캐시 미적용 키 존재 — sportKeys cached 값 확인 필요");
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("FAILED:", msg.replace(/apiKey=[^&\s]+/gi, "apiKey=***"));
  process.exit(1);
});
