/**
 * /api/games 병합 검증 (dev 서버 불필요)
 * 사용: npx tsx --env-file=.env.local scripts/verify-merged-games.ts
 *
 * Route handler 를 직접 호출해 실제 병합/격리 동작을 확인한다.
 */
import { GET } from "../src/app/api/games/route";
import { getKstToday } from "../src/lib/datetime/kst";
import { getFootballGamesForDate } from "../src/lib/games/football-games";
import {
  getEnabledFootballLeagues,
} from "../src/constants/football-leagues";
import { groupGamesByLeague } from "../src/lib/games/group";
import type { GameWithOdds } from "../src/types/game-with-odds";

type Body = {
  games: GameWithOdds[];
  meta: {
    status: string;
    sources: Record<string, Record<string, unknown>>;
  };
};

async function call(query: string): Promise<{ status: number; body: Body }> {
  const res = await GET(
    new Request(`http://localhost:3000/api/games?${query}`),
  );
  return { status: res.status, body: (await res.json()) as Body };
}

function summarize(items: GameWithOdds[]) {
  const bySport = new Map<string, number>();
  for (const { game } of items) {
    bySport.set(game.sport, (bySport.get(game.sport) ?? 0) + 1);
  }
  return Object.fromEntries(bySport);
}

async function main() {
  const date = getKstToday();
  console.log("KST today:", date);
  console.log(
    "enabled football leagues:",
    getEnabledFootballLeagues()
      .map((l) => `${l.shortName}(${l.providerLeagueId})`)
      .join(", "),
  );

  console.log("\n=== 1) 축구 필터: 718건 → 관심 리그 ===");
  const football = await getFootballGamesForDate(date);
  console.log("totalFixtures:", football.totalFixtures);
  console.log("keptFixtures :", football.keptFixtures);
  console.log("cached       :", football.cached);
  console.log("usage        :", football.usage);
  for (const g of football.games.slice(0, 8)) {
    console.log(`  ${g.date} ${g.startTime} [${g.league}] ${g.homeTeam} vs ${g.awayTeam}`);
  }

  console.log("\n=== 2) 동일 날짜 재호출 → 캐시(추가 API 호출 없음) ===");
  const again = await getFootballGamesForDate(date);
  console.log("cached:", again.cached, "| usage:", again.usage);

  console.log(`\n=== 3) GET /api/games?date=${date} ===`);
  const all = await call(`date=${date}`);
  console.log("HTTP:", all.status, "| status:", all.body.meta.status);
  console.log("merged count:", all.body.games.length, summarize(all.body.games));
  console.log("sources:", JSON.stringify(all.body.meta.sources, null, 2));

  console.log("\n=== 4) 리그 그룹 (우선순위 · 리그당 초기 10) ===");
  for (const group of groupGamesByLeague(all.body.games)) {
    console.log(
      `  ${group.league}: total=${group.totalCount} visible=${group.visibleGames.length} hasMore=${group.hasMore}`,
    );
  }

  console.log("\n=== 5) 종목 탭 ===");
  for (const sport of ["football", "baseball", "basketball"]) {
    const r = await call(`date=${date}&sport=${sport}`);
    console.log(
      `  sport=${sport}: HTTP ${r.status} status=${r.body.meta.status} count=${r.body.games.length}`,
    );
  }

  console.log("\n=== 6) 날짜 변경 (내일) ===");
  const tomorrow = new Date(Date.parse(`${date}T00:00:00+09:00`) + 86400000);
  const nextDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrow);
  const next = await call(`date=${nextDate}`);
  console.log(
    `  date=${nextDate}: HTTP ${next.status} status=${next.body.meta.status} count=${next.body.games.length}`,
    summarize(next.body.games),
  );
  console.log("  football source:", JSON.stringify(next.body.meta.sources.football));
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
