/**
 * The Odds API 스모크 테스트
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/test-odds-api.ts
 *
 * 필요 환경변수 (서버 전용):
 *   ODDS_API_KEY
 *   ODDS_API_BASE_URL  (선택, 기본 https://api.the-odds-api.com/v4)
 *
 * API 키는 로그에 출력하지 않는다.
 */
import {
  TheOddsApiProvider,
  matchOddsToGames,
  type OddsData,
} from "../src/lib/odds";
import { getSportsProvider } from "../src/lib/sports";
import { getKstToday } from "../src/lib/datetime/kst";

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function printEvent(label: string, event: OddsData | undefined) {
  if (!event) {
    console.log(`${label}: (none)`);
    return;
  }
  console.log(`${label}:`);
  console.log(`  id: ${event.externalEventId}`);
  console.log(`  ${event.homeTeam} vs ${event.awayTeam}`);
  console.log(`  commence: ${event.commenceTime}`);
  console.log(`  bookmakers: ${event.bookmakers.length}`);
  console.log(
    `  best odds H/D/A: ${event.bestHomeOdds ?? "—"} / ${event.bestDrawOdds ?? "—"} / ${event.bestAwayOdds ?? "—"}`,
  );
  console.log(
    `  implied (raw, pre-margin) H/D/A: ${pct(event.impliedHomeProbability)} / ${pct(event.impliedDrawProbability)} / ${pct(event.impliedAwayProbability)}`,
  );
}

async function main() {
  const apiKey = (process.env.ODDS_API_KEY ?? "").trim();
  const baseUrl =
    (process.env.ODDS_API_BASE_URL ?? "").trim() ||
    "https://api.the-odds-api.com/v4";

  if (!apiKey) {
    console.error(
      "ODDS_API_KEY is missing. Add it to .env.local (server-only).",
    );
    process.exit(1);
  }

  const provider = new TheOddsApiProvider(baseUrl, apiKey);

  console.log("=== 1) /sports → KBO / NPB active keys ===");
  const { kbo, npb, usage: sportsUsage } = await provider.resolveBaseballLeagueKeys();
  console.log("KBO:", kbo ? `${kbo.key} (title=${kbo.title}, active=${kbo.active})` : "(not found/active)");
  console.log("NPB:", npb ? `${npb.key} (title=${npb.title}, active=${npb.active})` : "(not found/active)");
  console.log("usage (sports, usually free):", sportsUsage);

  const testSport = kbo ?? npb;
  if (!testSport) {
    console.error("No active KBO/NPB sport found. Abort odds call to protect quota.");
    process.exit(2);
  }

  console.log(`\n=== 2) /sports/${testSport.key}/odds (regions=eu, markets=h2h) ===`);
  const result = await provider.getOdds({
    sportKey: testSport.key,
    regions: "eu",
    markets: "h2h",
  });

  console.log("HTTP: OK (200 assumed — provider throws on error)");
  console.log("sportKey:", result.sportKey);
  console.log("cached:", result.cached);
  console.log("event count:", result.events.length);
  console.log("usage:", result.usage);

  const first = result.events[0];
  printEvent("first event", first);

  console.log("\n=== 3) GameData 매칭 시도 (오늘 KST 일정) ===");
  try {
    const games = await getSportsProvider().getGames({ date: getKstToday() });
    const matches = matchOddsToGames(games, result.events);
    console.log(`games today: ${games.length}, odds matched: ${matches.length}`);
    for (const m of matches.slice(0, 5)) {
      console.log(
        `  [${m.reason}] ${m.game.homeTeam} vs ${m.game.awayTeam} ↔ ${m.odds.homeTeam} vs ${m.odds.awayTeam} | H=${m.odds.bestHomeOdds}`,
      );
    }
    if (matches.length === 0) {
      console.log(
        "  (no safe match — team names/time differ; UI wiring not attempted)",
      );
    }
  } catch (error) {
    console.log(
      "GameData fetch skipped:",
      error instanceof Error ? error.message : error,
    );
  }
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
