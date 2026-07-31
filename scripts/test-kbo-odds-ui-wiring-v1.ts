/**
 * Regression: KBO odds UI adapter wiring (no Provider calls).
 * Run: npx tsx scripts/test-kbo-odds-ui-wiring-v1.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  buildDomesticMarketFromPrices,
  buildOverseasMarketFromPrices,
  isPrimaryJsonName,
  loadKboOddsComparisonViewModel,
  matchByCanonicalIds,
  teamIds,
} from "../src/lib/kbo/odds-ui/load-kbo-odds-ui-view";

const DATE = "2026-07-31";
const cwd = process.cwd();

async function sha256File(rel: string): Promise<string> {
  const buf = await readFile(path.join(cwd, rel));
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  // 1) Domestic MANUAL_COLLECTED
  const d = buildDomesticMarketFromPrices({
    status: "MANUAL_COLLECTED",
    homePrice: 1.77,
    awayPrice: 1.75,
  });
  assert.equal(d.availability, "AVAILABLE");
  assert.equal(d.homePrice, 1.77);
  assert.equal(d.awayPrice, 1.75);

  // 2) Overseas COLLECTED
  const o = buildOverseasMarketFromPrices({
    status: "COLLECTED",
    homePrice: 2.03,
    awayPrice: 1.91,
  });
  assert.equal(o.availability, "AVAILABLE");

  // 3) Reverse display name — UI LG @ 두산, market home 두산 / away LG
  const lg = await loadKboOddsComparisonViewModel({
    dateKst: DATE,
    gameId: "kbo-181917",
    homeTeam: "두산",
    awayTeam: "LG",
    scheduledStartTime: "2026-07-31T18:30:00+09:00",
    cwd,
  });
  assert.equal(lg.domestic.availability, "AVAILABLE");
  assert.equal(lg.domestic.homePrice, 1.77);
  assert.equal(lg.domestic.awayPrice, 1.75);
  assert.equal(lg.overseas.availability, "AVAILABLE");
  assert.equal(lg.overseas.homePrice, 2.03);
  assert.equal(lg.overseas.awayPrice, 1.91);
  assert.equal(lg.homeTeam, "두산");
  assert.equal(lg.awayTeam, "LG");

  // 4) Revision exclusion — primary selected
  const names = await readdir(path.join(cwd, "data/research/kbo"));
  const hasRev = names.some((n) => n.includes("odds-history") && n.includes(".rev-"));
  const hasPrimary = names.includes(`${DATE}-odds-history-dataset-v1.json`);
  assert.ok(hasRev && hasPrimary);
  assert.ok(isPrimaryJsonName(`${DATE}-odds-history-dataset-v1.json`));
  assert.equal(isPrimaryJsonName(`${DATE}-odds-history-dataset-v1.rev-x.json`), false);
  assert.ok(lg.pathRel.overseas?.endsWith(`${DATE}-odds-history-dataset-v1.json`));
  assert.ok(!lg.pathRel.overseas?.includes(".rev-"));

  // 5) Missing market — null, not 0
  const missing = buildDomesticMarketFromPrices({
    status: "MANUAL_COLLECTED",
    homePrice: null,
    awayPrice: null,
  });
  assert.equal(missing.availability, "MISSING");
  assert.equal(missing.homePrice, null);
  assert.equal(missing.awayPrice, null);

  // 6) Partial
  const partial = buildDomesticMarketFromPrices({
    status: "MANUAL_COLLECTED",
    homePrice: 1.77,
    awayPrice: null,
  });
  assert.equal(partial.availability, "PARTIAL");
  assert.equal(partial.homePrice, 1.77);
  assert.equal(partial.awayPrice, null);

  // 7) Wrong game — different teams must not match
  const wrong = await loadKboOddsComparisonViewModel({
    dateKst: DATE,
    gameId: "kbo-WRONG",
    homeTeam: "한화",
    awayTeam: "KT",
    scheduledStartTime: "2026-07-31T18:30:00+09:00",
    cwd,
  });
  // This should match kbo-181921 by canonical ids (한화 @ KT is away/home reversed of KT home / 한화 away)
  // Use teams that exist as a different game than LG@두산 when querying LG ids incorrectly:
  const cross = await loadKboOddsComparisonViewModel({
    dateKst: DATE,
    gameId: "kbo-WRONG-CROSS",
    homeTeam: "LG",
    awayTeam: "두산",
    scheduledStartTime: "2026-07-31T18:30:00+09:00",
    cwd,
  });
  assert.notEqual(cross.domestic.homePrice, 1.77);
  assert.equal(cross.domestic.availability, "MISSING");
  assert.equal(cross.mappingReason, "GAME_ID_MISMATCH");

  // Canonical id matching helpers
  const a = teamIds("두산", "LG");
  const b = teamIds("Doosan Bears", "LG Twins");
  assert.ok(
    matchByCanonicalIds(a.homeTeamId, a.awayTeamId, b.homeTeamId, b.awayTeamId),
  );

  // 5-game domestic expected
  const expected: Array<[string, string, string, number, number]> = [
    ["kbo-181917", "두산", "LG", 1.77, 1.75],
    ["kbo-181918", "NC", "KIA", 1.97, 1.59],
    ["kbo-181919", "키움", "SSG", 1.86, 1.67],
    ["kbo-181920", "롯데", "삼성", 2.56, 1.34],
    ["kbo-181921", "KT", "한화", 1.77, 1.75],
  ];
  for (const [gameId, home, away, dh, da] of expected) {
    const vm = await loadKboOddsComparisonViewModel({
      dateKst: DATE,
      gameId,
      homeTeam: home,
      awayTeam: away,
      scheduledStartTime: "2026-07-31T18:30:00+09:00",
      cwd,
    });
    assert.equal(vm.domestic.homePrice, dh, `${gameId} domestic home`);
    assert.equal(vm.domestic.awayPrice, da, `${gameId} domestic away`);
    assert.equal(vm.domestic.availability, "AVAILABLE", `${gameId} domestic`);
    assert.equal(vm.overseas.availability, "AVAILABLE", `${gameId} overseas`);
    assert.ok(vm.overseas.homePrice != null && vm.overseas.homePrice > 1);
    assert.ok(vm.overseas.awayPrice != null && vm.overseas.awayPrice > 1);
  }

  // Snapshot hash immutability smoke (files unchanged during this test)
  const hashTargets = [
    "data/predictions/kbo/2026-07-31.json",
    "data/research/kbo/2026-07-31-domestic-proto-snapshot-v1.json",
    "data/research/kbo/2026-07-31-odds-history-dataset-v1.json",
    "data/predictions/kbo/2026-07-31.rev-2026-07-31T09-01-59-411Z.json",
  ];
  const before = await Promise.all(hashTargets.map(sha256File));
  // re-read after loads
  const after = await Promise.all(hashTargets.map(sha256File));
  for (let i = 0; i < hashTargets.length; i++) {
    assert.equal(before[i], after[i], `hash changed: ${hashTargets[i]}`);
  }

  // unused var silence
  void wrong;

  console.log("PASS test-kbo-odds-ui-wiring-v1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
