/**
 * TheSportsDB 연동 스모크 테스트
 * 사용: npx tsx --env-file=.env.local scripts/verify-thesportsdb.ts
 */
import { TheSportsDbProvider } from "../src/lib/sports/thesportsdb-provider";
import { getSportsProvider } from "../src/lib/sports/get-provider";
import { DummyProvider } from "../src/lib/sports/dummy-provider";

async function httpProbe(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json };
}

async function main() {
  const base =
    process.env.SPORTS_API_BASE_URL ??
    "https://www.thesportsdb.com/api/v1/json";
  const key = process.env.SPORTS_API_KEY ?? "123";
  const date = "2026-07-24";

  const urls = [
    `${base}/${key}/lookupleague.php?id=4591`,
    `${base}/${key}/lookupleague.php?id=4830`,
    `${base}/${key}/eventsday.php?d=${date}&l=4591`,
    `${base}/${key}/eventsday.php?d=${date}&l=4830`,
  ];

  console.log("=== 1) HTTP probes ===");
  for (const url of urls) {
    const result = await httpProbe(url);
    const preview = JSON.stringify(result.json).slice(0, 180);
    console.log(`\nURL: ${url}`);
    console.log(`HTTP: ${result.status}`);
    console.log(`DATA: ${preview}`);
  }

  console.log("\n=== 2) TheSportsDbProvider.getGames mapping ===");
  const api = new TheSportsDbProvider(base, key);
  const games = await api.getGames({ date, sport: "baseball" });
  console.log(`mapped count: ${games.length}`);
  console.log(JSON.stringify(games.slice(0, 2), null, 2));

  console.log("\n=== 3) Fallback (analysis / empty day) ===");
  const provider = getSportsProvider();
  console.log(`provider.kind: ${provider.kind}`);

  const analysis = await provider.getAnalysis("npb-softbank-orix");
  const dummy = new DummyProvider();
  const dummyAnalysis = await dummy.getAnalysis("npb-softbank-orix");
  console.log("getAnalysis via provider (expect dummy fallback):", {
    hasData: Boolean(analysis),
    matchesDummy: analysis?.gameId === dummyAnalysis?.gameId,
  });

  try {
    await api.getGames({ date: "2099-01-01", sport: "baseball" });
    console.log("empty day: unexpected success");
  } catch (error) {
    console.log(
      "empty day TheSportsDbProvider throws:",
      (error as Error).message,
    );
  }

  const fallbackGames = await provider.getGames({ date: "2099-01-01" });
  console.log("empty day via getSportsProvider (dummy fallback):", {
    count: fallbackGames.length,
    sampleId: fallbackGames[0]?.id,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
