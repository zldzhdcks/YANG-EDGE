/**
 * 내부 API + fetch source 검증 스크립트
 * 사용: npx tsx scripts/verify-api.ts  (dev 서버 실행 중이어야 함)
 */
import { fetchGames } from "../src/lib/api/games";
import { fetchTodayGames } from "../src/lib/api/today-games";
import { fetchTodayPick } from "../src/lib/api/today-pick";
import { fetchFeatured } from "../src/lib/api/featured";
import { fetchAnalysis } from "../src/lib/api/analysis";
import { fetchToto } from "../src/lib/api/toto";

async function checkHttp(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  const base = process.env.SITE_URL ?? "http://localhost:3000";

  console.log("=== HTTP endpoints ===");
  for (const path of [
    "/api/games",
    "/api/today-games",
    "/api/today-pick",
    "/api/featured",
    "/api/analysis/npb-softbank-orix",
    "/api/analysis/unknown-id",
    "/api/toto/current",
  ]) {
    const result = await checkHttp(`${base}${path}`);
    const preview =
      typeof result.json === "object" && result.json !== null
        ? JSON.stringify(result.json).slice(0, 120)
        : String(result.json).slice(0, 120);
    console.log(`${path} -> ${result.status} | ${preview}`);
  }

  console.log("\n=== fetch* source ===");
  const games = await fetchGames();
  const todayGames = await fetchTodayGames();
  const pick = await fetchTodayPick();
  const featured = await fetchFeatured();
  const analysis = await fetchAnalysis("npb-softbank-orix");
  const missing = await fetchAnalysis("unknown-id");
  const toto = await fetchToto();

  console.log("fetchGames:", {
    status: games.status,
    source: games.source,
    count: games.data.length,
  });
  console.log("fetchTodayGames:", {
    status: todayGames.status,
    source: todayGames.source,
    count: todayGames.data.length,
  });
  console.log("fetchTodayPick:", {
    status: pick.status,
    source: pick.source,
    league: pick.data.league,
  });
  console.log("fetchFeatured:", {
    status: featured.status,
    source: featured.source,
    count: featured.data.length,
  });
  console.log("fetchAnalysis(softbank):", {
    status: analysis.status,
    source: analysis.source,
    gameId: analysis.data?.gameId ?? null,
  });
  console.log("fetchAnalysis(unknown):", {
    status: missing.status,
    source: missing.source,
    data: missing.data,
  });
  console.log("fetchToto:", {
    status: toto.status,
    source: toto.source,
    round: toto.data.round.round,
  });

  // fallback: force bad internal base
  process.env.SITE_URL = "http://127.0.0.1:9";
  const { fetchGames: fetchGamesAgain } = await import("../src/lib/api/games");
  const fallback = await fetchGamesAgain();
  console.log("\n=== fallback (SITE_URL dead port) ===");
  console.log("fetchGames:", {
    status: fallback.status,
    source: fallback.source,
    count: fallback.data.length,
    error: fallback.error?.message?.slice(0, 80),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
