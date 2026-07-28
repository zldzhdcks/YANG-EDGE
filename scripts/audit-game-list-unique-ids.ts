import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getStableGameRenderKey } from "../src/lib/games/unique-games";
import type { GameWithOdds } from "../src/types/game-with-odds";

const DATE = process.argv[2]?.trim() || "2026-07-28";

function duplicateValues(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

async function main() {
  const response = await fetch(`http://localhost:3000/api/games?date=${DATE}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GET /api/games failed: ${response.status}`);
  }
  const body = (await response.json()) as { games: GameWithOdds[] };
  const items = Array.isArray(body.games) ? body.games : [];

  const duplicateIds = duplicateValues(items.map((item) => item.game.id));
  const duplicateExternalIds = duplicateValues(
    items
      .map((item) =>
        item.game.externalProvider && item.game.externalId
          ? `${item.game.externalProvider}:${item.game.externalId}`
          : "",
      )
      .filter(Boolean),
  );
  const duplicateRenderKeys = duplicateValues(
    items.map((item) => getStableGameRenderKey(item.game)),
  );

  const audit = {
    dateKst: DATE,
    totalShownGames: items.length,
    uniqueGameIds: new Set(items.map((item) => item.game.id)).size,
    duplicateIds,
    duplicateExternalIds,
    duplicateRenderKeys,
    kboGames: items.filter((item) => item.game.league === "KBO").length,
    mlbCincinnatiClevelandCollision:
      items.filter(
        (item) => item.game.id === "mlb-cincinnati-reds-cleveland-guardians",
      ).length,
    renderKeyPolicy: "league|externalProvider|externalId else game.id|date|startTime",
    rootCauseAssessment:
      "ID_GENERATION_COLLISION risk exists when buildGameId uses only league-home-away; render key now prefers provider-backed external identity and /api/games dedupes by real-game identity.",
    doubleheaderSafety:
      "Distinct externalProvider+externalId pairs remain distinct even if teams match on the same date.",
    rows: items.map((item) => ({
      id: item.game.id,
      renderKey: getStableGameRenderKey(item.game),
      externalId: item.game.externalId ?? null,
      externalProvider: item.game.externalProvider ?? null,
      league: item.game.league,
      date: item.game.date,
      startTime: item.game.startTime,
      home: item.game.homeTeam,
      away: item.game.awayTeam,
      status: item.game.status ?? null,
    })),
  };

  const outPath = path.join(
    process.cwd(),
    "data/audits",
    `${DATE}-game-list-unique-ids-audit.json`,
  );
  await writeFile(outPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log(`shown=${audit.totalShownGames}`);
  console.log(`duplicateIds=${audit.duplicateIds.length}`);
  console.log(`duplicateExternalIds=${audit.duplicateExternalIds.length}`);
  console.log(`duplicateRenderKeys=${audit.duplicateRenderKeys.length}`);
  console.log(`kboGames=${audit.kboGames}`);
  console.log(`cincinnatiCleveland=${audit.mlbCincinnatiClevelandCollision}`);
  console.log(`저장: ${outPath}`);
  console.log("GAME_LIST_UNIQUE_IDS_AUDITED");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
