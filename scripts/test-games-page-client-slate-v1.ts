/**
 * /games client render path — full KBO/NPB slate must survive grouping + keys.
 * Run: npx tsx scripts/test-games-page-client-slate-v1.ts
 */
import assert from "node:assert/strict";
import { groupGamesByLeague } from "../src/lib/games/group";
import {
  getStableGameRenderKey,
} from "../src/lib/games/unique-games";
import { shouldKeepPreviousGamesLoad } from "../src/components/games/GamesPageContent";
import type { GameWithOdds } from "../src/types/game-with-odds";
import type { GameData } from "../src/types/game";

function item(
  partial: Pick<GameData, "id" | "league" | "homeTeam" | "awayTeam"> &
    Partial<GameData>,
): GameWithOdds {
  const game: GameData = {
    sport: "baseball",
    startTime: "18:00",
    date: "2026-07-31",
    aiAnalysisAvailable: false,
    ...partial,
  };
  return {
    game,
    odds: null,
    oddsMatch: { matched: false, confidence: 0, method: "none" },
    oddsAvailability: "market-closed",
    oddsUnavailableReason: null,
    oddsComparison: null,
    recommendation: null,
    researchOutcome: null,
  };
}

function main() {
  const kboIds = [
    "kbo-181917",
    "kbo-181918",
    "kbo-181919",
    "kbo-181920",
    "kbo-181921",
  ];
  const npbIds = [
    "npb-hiroshima-carp-chunichi-dragons",
    "npb-nippon-ham-fighters-chiba-lotte-marines",
    "npb-rakuten-gold-eagles-fukuoka-s-hawks",
    "npb-seibu-lions-orix-buffaloes",
    "npb-yakult-swallows-hanshin-tigers",
    "npb-yomiuri-giants-yokohama-baystars",
  ];

  const items: GameWithOdds[] = [
    ...kboIds.map((id, i) =>
      item({
        id,
        league: "KBO",
        homeTeam: `Home${i}`,
        awayTeam: `Away${i}`,
        startTime: "18:30",
        externalProvider: "api-baseball",
      }),
    ),
    ...npbIds.map((id, i) =>
      item({
        id,
        league: "NPB",
        homeTeam: `NpbHome${i}`,
        awayTeam: `NpbAway${i}`,
        startTime: "18:00",
        externalProvider: "thesportsdb",
        // intentional: provider set, externalId missing (freeze shape)
      }),
    ),
  ];

  // state → grouped
  const groups = groupGamesByLeague(items);
  const kbo = groups.find((g) => g.league === "KBO");
  const npb = groups.find((g) => g.league === "NPB");
  assert.ok(kbo);
  assert.ok(npb);
  assert.equal(kbo.totalCount, 5);
  assert.equal(npb.totalCount, 6);
  assert.equal(kbo.visibleGames.length, 5, "KBO must not truncate full slate");
  assert.equal(npb.visibleGames.length, 6, "NPB must not truncate full slate");
  assert.equal(kbo.hasMore, false);
  assert.equal(npb.hasMore, false);
  assert.deepEqual(
    kbo.games.map((g) => g.game.id),
    kbo.visibleGames.map((g) => g.game.id),
  );
  assert.deepEqual(
    npb.games.map((g) => g.game.id),
    npb.visibleGames.map((g) => g.game.id),
  );

  // React keys unique + exact gameId
  const keys = items.map((x) => getStableGameRenderKey(x.game));
  assert.deepEqual(keys, [...kboIds, ...npbIds]);
  assert.equal(new Set(keys).size, keys.length, "duplicate React keys");

  // freeze load must not be overwritten by thinner live response
  const prev = {
    date: "2026-07-31",
    items,
    ok: true,
    usedFrozenSlate: true,
  };
  const thinLive = items.filter(
    (x) =>
      (x.game.league === "KBO" && kboIds.slice(0, 3).includes(x.game.id)) ||
      (x.game.league === "NPB" && npbIds.slice(0, 3).includes(x.game.id)),
  );
  assert.equal(thinLive.filter((x) => x.game.league === "KBO").length, 3);
  assert.equal(thinLive.filter((x) => x.game.league === "NPB").length, 3);
  assert.equal(
    shouldKeepPreviousGamesLoad(prev, "2026-07-31", thinLive, false),
    true,
  );
  assert.equal(
    shouldKeepPreviousGamesLoad(null, "2026-07-31", thinLive, false),
    false,
  );

  console.log("PASS test-games-page-client-slate-v1");
}

main();
