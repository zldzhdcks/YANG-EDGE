/**
 * /games 데이터 흐름 검증 스크립트 (dev 서버 불필요)
 * 사용: npx tsx scripts/verify-games.ts
 *
 * .env.local 값을 주입해 실제 Provider(getGames) 흐름을 그대로 탄다.
 */
process.env.SPORTS_PROVIDER ??= "thesportsdb";
process.env.SPORTS_API_BASE_URL ??= "https://www.thesportsdb.com/api/v1/json";
process.env.SPORTS_API_KEY ??= "123";

import { getSportsProvider } from "../src/lib/sports";
import { sortGames } from "../src/lib/games/sort";
import { getKstToday } from "../src/lib/datetime/kst";

async function run(label: string, params: Record<string, string>) {
  const provider = getSportsProvider();
  const games = sortGames(await provider.getGames(params));
  console.log(`\n=== ${label} (provider=${provider.kind}) ===`);
  console.log(`count: ${games.length}`);
  for (const g of games.slice(0, 10)) {
    console.log(
      `  ${g.date} ${g.startTime} [${g.sport}/${g.league}] ${g.homeTeam} vs ${g.awayTeam} | analysis=${g.aiAnalysisAvailable} | ${g.id}`,
    );
  }
}

async function main() {
  const date = getKstToday();
  console.log("KST today:", date);
  await run(`date=${date}`, { date });
  await run(`date=${date}&league=NPB`, { date, league: "NPB" });
  await run(`date=${date}&league=KBO`, { date, league: "KBO" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
