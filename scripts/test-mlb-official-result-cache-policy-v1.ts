/**
 * Official Result cache policy: forceRefresh bypasses stale schedule raw cache.
 * Run: npx tsx scripts/test-mlb-official-result-cache-policy-v1.ts
 * Does not call live StatsAPI (fetch mocked). No Engine/Prediction mutation.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createCacheUsage,
  getRawStatsJson,
} from "../src/lib/mlb/research-stats-cache";

function scheduleBody(abstractGameState: string, gamePk = 999001) {
  return {
    dates: [
      {
        games: [
          {
            gamePk,
            status: {
              abstractGameState,
              detailedState: abstractGameState,
            },
            teams: {
              home: { score: abstractGameState === "Final" ? 5 : null, team: { id: 1, name: "Home" } },
              away: { score: abstractGameState === "Final" ? 3 : null, team: { id: 2, name: "Away" } },
            },
          },
        ],
      },
    ],
  };
}

async function main() {
  const cwd = mkdtempSync(path.join(tmpdir(), "mlb-result-cache-"));
  const pathQuery = "/api/v1/schedule?sportId=1&gamePk=999001";
  const key = pathQuery.replace(/^\//, "").replace(/[?&=]/g, "_");
  const cacheFile = path.join(
    cwd,
    "data/cache/research/mlb/raw/statsapi",
    `${key}.json`,
  );
  mkdirSync(path.dirname(cacheFile), { recursive: true });

  // Stale pre-pitch cache (the bug)
  writeFileSync(
    cacheFile,
    `${JSON.stringify({
      meta: { pathQuery, fetchedAt: "2026-08-05T10:00:00.000Z" },
      body: scheduleBody("Preview"),
    })}\n`,
    "utf8",
  );

  const usageCached = createCacheUsage();
  const cached = await getRawStatsJson(pathQuery, usageCached, { cwd });
  assert.equal(usageCached.rawHit, 1);
  assert.equal(usageCached.networkCalls, 0);
  assert.equal(
    (cached as { dates: { games: { status: { abstractGameState: string } }[] }[] })
      .dates[0].games[0].status.abstractGameState,
    "Preview",
  );

  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return {
      ok: true,
      async json() {
        return scheduleBody("Final");
      },
    } as Response;
  }) as typeof fetch;

  try {
    const usageFresh = createCacheUsage();
    const fresh = await getRawStatsJson(pathQuery, usageFresh, {
      cwd,
      forceRefresh: true,
    });
    assert.equal(usageFresh.rawHit, 0, "forceRefresh must skip disk hit");
    assert.equal(usageFresh.rawMiss, 1);
    assert.equal(usageFresh.networkCalls, 1);
    assert.equal(fetchCount, 1);
    assert.equal(
      (fresh as { dates: { games: { status: { abstractGameState: string } }[] }[] })
        .dates[0].games[0].status.abstractGameState,
      "Final",
    );

    const onDisk = JSON.parse(readFileSync(cacheFile, "utf8")) as {
      body: { dates: { games: { status: { abstractGameState: string } }[] }[] };
      meta: { forceRefresh?: boolean };
    };
    assert.equal(
      onDisk.body.dates[0].games[0].status.abstractGameState,
      "Final",
      "forceRefresh must overwrite raw cache",
    );
    assert.equal(onDisk.meta.forceRefresh, true);

    // Default path still uses the overwritten cache (no network)
    const usageAfter = createCacheUsage();
    const after = await getRawStatsJson(pathQuery, usageAfter, { cwd });
    assert.equal(usageAfter.rawHit, 1);
    assert.equal(usageAfter.networkCalls, 0);
    assert.equal(fetchCount, 1);
    assert.equal(
      (after as { dates: { games: { status: { abstractGameState: string } }[] }[] })
        .dates[0].games[0].status.abstractGameState,
      "Final",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("test:mlb-official-result-cache-policy-v1 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
