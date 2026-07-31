/**
 * Regression: KBO/NPB full daily slate wiring (no Provider/Odds API).
 * Run: npx tsx scripts/test-baseball-full-slate-wiring-v1.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  dedupeNpbScheduleRowsForTest,
  loadFrozenBaseballSlate,
} from "../src/lib/baseball/load-frozen-baseball-slate";

const cwd = process.cwd();
const DATE = "2026-07-31";

async function sha256File(rel: string): Promise<string> {
  const buf = await readFile(path.join(cwd, rel));
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  // 1) KBO five games
  const kbo = await loadFrozenBaseballSlate({
    dateKst: DATE,
    league: "KBO",
    cwd,
  });
  assert.equal(kbo.kbo.length, 5);
  assert.equal(kbo.meta.kboUniqueCount, 5);
  const expectedIds = [
    "kbo-181917",
    "kbo-181918",
    "kbo-181919",
    "kbo-181920",
    "kbo-181921",
  ];
  assert.deepEqual(
    kbo.kbo.map((g) => g.gameId).sort(),
    [...expectedIds].sort(),
  );

  // 2) KBO PASS-only — all shown, pick null
  for (const g of kbo.kbo) {
    assert.equal(g.officialStatus, "PASS");
    assert.equal(g.officialPick, null);
  }

  // 3) NPB duplicate aliases → 6
  const npb = await loadFrozenBaseballSlate({
    dateKst: DATE,
    league: "NPB",
    cwd,
  });
  assert.equal(npb.meta.npbRawCount, 12);
  assert.equal(npb.npb.length, 6);
  assert.equal(npb.meta.npbUniqueCount, 6);

  // 4) Three-row provider + six API-Baseball style → still 6
  const mixed = dedupeNpbScheduleRowsForTest([
    {
      gameId: "a1",
      home: "Hiroshima Toyo Carp",
      away: "Chunichi Dragons",
      scheduledStartTime: "2026-07-31T09:00:00Z",
      source: "THESPORTSDB",
    },
    {
      gameId: "a2",
      home: "Hokkaido Nippon-Ham Fighters",
      away: "Chiba Lotte Marines",
      scheduledStartTime: "2026-07-31T09:00:00Z",
      source: "THESPORTSDB",
    },
    {
      gameId: "a3",
      home: "Tohoku Rakuten Golden Eagles",
      away: "Fukuoka SoftBank Hawks",
      scheduledStartTime: "2026-07-31T09:00:00Z",
      source: "THESPORTSDB",
    },
    {
      gameId: "b1",
      home: "Hiroshima Carp",
      away: "Chunichi Dragons",
      scheduledStartTime: "2026-07-31T09:00:00+00:00",
      source: "API_BASEBALL",
    },
    {
      gameId: "b2",
      home: "Nippon Ham Fighters",
      away: "Chiba Lotte Marines",
      scheduledStartTime: "2026-07-31T09:00:00+00:00",
      source: "API_BASEBALL",
    },
    {
      gameId: "b3",
      home: "Rakuten Gold. Eagles",
      away: "Fukuoka S. Hawks",
      scheduledStartTime: "2026-07-31T09:00:00+00:00",
      source: "API_BASEBALL",
    },
    {
      gameId: "b4",
      home: "Seibu Lions",
      away: "Orix Buffaloes",
      scheduledStartTime: "2026-07-31T09:00:00+00:00",
      source: "API_BASEBALL",
    },
    {
      gameId: "b5",
      home: "Yakult Swallows",
      away: "Hanshin Tigers",
      scheduledStartTime: "2026-07-31T09:00:00+00:00",
      source: "API_BASEBALL",
    },
    {
      gameId: "b6",
      home: "Yomiuri Giants",
      away: "Yokohama BayStars",
      scheduledStartTime: "2026-07-31T09:00:00+00:00",
      source: "API_BASEBALL",
    },
  ]);
  assert.equal(mixed.length, 6);

  // 5) Revision exclusion — primary path only
  const names = await readdir(path.join(cwd, "data/research/kbo"));
  assert.ok(names.includes(`${DATE}-schedule-v1.json`));
  assert.ok(names.some((n) => n.includes("schedule-v1.rev-")));
  assert.equal(kbo.meta.kboPath, `data/research/kbo/${DATE}-schedule-v1.json`);
  assert.ok(!kbo.meta.kboPath?.includes(".rev-"));

  // 6) Missing odds still listed
  const noOdds = dedupeNpbScheduleRowsForTest([
    {
      gameId: "x1",
      home: "Yomiuri Giants",
      away: "Hanshin Tigers",
      scheduledStartTime: "2026-07-31T09:00:00Z",
      source: "THESPORTSDB",
    },
  ]);
  assert.equal(noOdds.length, 1);
  assert.equal(noOdds[0].overseasOddsAvailable, false);

  // 7) Wrong league filter — NPB loader with KBO league returns empty npb when league=KBO
  const onlyKbo = await loadFrozenBaseballSlate({
    dateKst: DATE,
    league: "KBO",
    cwd,
  });
  assert.equal(onlyKbo.npb.length, 0);
  assert.equal(onlyKbo.kbo.length, 5);

  // Snapshot immutability
  const targets = [
    `data/research/kbo/${DATE}-schedule-v1.json`,
    `data/research/npb/${DATE}-schedule-v1.json`,
    `data/predictions/kbo/${DATE}.json`,
  ];
  const before = await Promise.all(targets.map(sha256File));
  await loadFrozenBaseballSlate({ dateKst: DATE, cwd });
  const after = await Promise.all(targets.map(sha256File));
  assert.deepEqual(before, after);

  console.log("PASS test-baseball-full-slate-wiring-v1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
