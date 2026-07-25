/**
 * API-Football 스모크 테스트
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/test-api-football.ts
 *
 * 필요 (서버 전용):
 *   FOOTBALL_API_KEY
 *   FOOTBALL_API_BASE_URL  (선택, 기본 https://v3.football.api-sports.io)
 *
 * API 키는 로그에 출력하지 않는다.
 */
import { ApiFootballProvider } from "../src/lib/football";
import { getKstToday } from "../src/lib/datetime/kst";

/** EPL — API-Football league id (시즌 중이면 우선) */
const EPL_LEAGUE_ID = 39;

async function main() {
  const apiKey = (process.env.FOOTBALL_API_KEY ?? "").trim();
  const baseUrl =
    (process.env.FOOTBALL_API_BASE_URL ?? "").trim() ||
    "https://v3.football.api-sports.io";

  if (!apiKey) {
    console.error(
      "FOOTBALL_API_KEY is missing. Add it to .env.local (server-only).",
    );
    process.exit(1);
  }

  const provider = new ApiFootballProvider(baseUrl, apiKey);
  const today = getKstToday();

  console.log("=== 1) /status ===");
  const { status, usage: statusUsage } = await provider.getStatus();
  console.log("plan:", status.subscription.plan);
  console.log("active:", status.subscription.active);
  console.log(
    "requests today:",
    `${status.requests.current ?? "?"} / ${status.requests.limitDay ?? "?"}`,
  );
  console.log("header usage:", statusUsage);

  console.log(`\n=== 2) /fixtures date=${today} timezone=Asia/Seoul ===`);
  const all = await provider.getFixtures({
    date: today,
    timezone: "Asia/Seoul",
  });
  console.log("HTTP: OK");
  console.log("fixture/game count:", all.games.length);
  console.log("cached:", all.cached);
  console.log("usage:", all.usage);

  console.log(`\n=== 3) league filter (prefer EPL ${EPL_LEAGUE_ID}) ===`);
  const leagueCounts = new Map<number, { name: string; count: number; season?: number }>();
  for (const f of all.fixtures) {
    const id = f.league?.id;
    if (id == null) continue;
    const prev = leagueCounts.get(id);
    if (prev) prev.count += 1;
    else {
      leagueCounts.set(id, {
        name: f.league.name,
        count: 1,
        season: f.league.season,
      });
    }
  }

  const eplCount = leagueCounts.get(EPL_LEAGUE_ID)?.count ?? 0;
  console.log(`EPL in today's fixtures: ${eplCount}`);

  const topLeagues = [...leagueCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
  console.log(
    "top leagues today:",
    topLeagues
      .map(([id, v]) => `${v.name}(${id})×${v.count}`)
      .join(", ") || "(none)",
  );

  const sample =
    eplCount > 0
      ? {
          id: EPL_LEAGUE_ID,
          ...leagueCounts.get(EPL_LEAGUE_ID)!,
        }
      : topLeagues[0]
        ? { id: topLeagues[0][0], ...topLeagues[0][1] }
        : null;

  if (sample) {
    try {
      const filtered = await provider.getFixtures({
        date: today,
        leagueId: sample.id,
        season: sample.season,
        timezone: "Asia/Seoul",
      });
      console.log(
        `leagueId=${sample.id} (${sample.name}) season=${sample.season}: ${filtered.games.length} games`,
      );
      console.log("usage:", filtered.usage);
    } catch (error) {
      console.log(
        "league filter query skipped:",
        error instanceof Error ? error.message : error,
      );
    }
  } else {
    console.log("no leagues in today's fixtures to re-query");
  }

  const first = all.games[0] ?? null;
  console.log("\n=== 4) first GameData mapping ===");
  if (!first) {
    console.log("(no fixtures — empty array is OK, not an error)");
  } else {
    console.log(JSON.stringify(first, null, 2));
  }

  console.log("\n=== 5) remaining requests ===");
  let remaining: number | null = all.usage.requestsRemaining ?? null;
  if (
    remaining == null &&
    status.requests.current != null &&
    status.requests.limitDay != null
  ) {
    remaining = status.requests.limitDay - status.requests.current;
  }
  console.log("remaining (header):", remaining);
  console.log(
    "status current/limit_day:",
    status.requests.current,
    "/",
    status.requests.limitDay,
  );
  console.log(
    "note: Free plan — season often required with leagueId; historical seasons limited",
  );
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
