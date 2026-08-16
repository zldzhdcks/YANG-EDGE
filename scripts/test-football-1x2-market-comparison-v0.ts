/**
 * Football 1X2 Pregame Market Comparison v0 tests.
 * Run: npm run test:football-1x2-market-comparison-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  assembleFootball1x2MarketComparisonV0,
  assertMarketComparisonIntegrity,
  joinFixtureToOddsEvent,
  loadObservedSlateV0,
  resolveResearchSportKey,
} from "../src/lib/football/1x2-market-comparison-v0";
import { parseFootballScheduleArtifact, planOddsFetches } from "../src/lib/football/odds-1x2-v1";
import { buildOddsData } from "../src/lib/odds";
import type { OddsData, OddsSportInfo } from "../src/lib/odds/types";

const TARGET_IDS = [1570339, 1570338, 1490389, 1490388, 1490383, 1490390];

function sha256File(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), rel)))
    .digest("hex");
}

function readTree(dir: string, acc: string[] = [], prefix = ""): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    const abs = path.join(dir, name.name);
    if (name.isDirectory()) readTree(abs, acc, rel);
    else acc.push(rel);
  }
  return acc;
}

function assertNoForbiddenImports(filePath: string) {
  const src = readFileSync(filePath, "utf8");
  assert.equal(/from ["'][^"']*prediction-snapshot/.test(src), false, filePath);
  assert.equal(/from ["'][^"']*market-baseline-prediction/.test(src), false, filePath);
  assert.equal(/from ["'][^"']*official-result/.test(src), false, filePath);
  assert.equal(/from ["'][^"']*football\/engine/.test(src), false, filePath);
  assert.equal(/from ["'][^"']*competition\/profiles/.test(src), false, filePath);
}

function mockEvent(over: {
  id: string;
  sportKey: string;
  home: string;
  away: string;
  commence: string;
  homePrice?: number;
  drawPrice?: number;
  awayPrice?: number;
}): OddsData {
  return buildOddsData({
    externalEventId: over.id,
    sportKey: over.sportKey,
    homeTeam: over.home,
    awayTeam: over.away,
    commenceTime: over.commence,
    lastUpdated: "2026-08-16T14:00:00.000Z",
    source: "the-odds-api",
    sourceFormat: "decimal",
    bookmakers: [
      {
        key: "pinnacle",
        title: "Pinnacle",
        lastUpdate: "2026-08-16T14:00:00.000Z",
        markets: [
          {
            key: "h2h",
            lastUpdate: "2026-08-16T14:00:00.000Z",
            outcomes: [
              { name: over.home, price: over.homePrice ?? 2.5 },
              { name: "Draw", price: over.drawPrice ?? 3.2 },
              { name: over.away, price: over.awayPrice ?? 2.8 },
            ],
          },
        ],
      },
    ],
  });
}

const SPORTS: OddsSportInfo[] = [
  {
    key: "soccer_spain_la_liga",
    group: "Soccer",
    title: "La Liga - Spain",
    description: "Spanish Soccer",
    active: true,
    hasOutrights: false,
  },
  {
    key: "soccer_usa_mls",
    group: "Soccer",
    title: "MLS",
    description: "Major League Soccer",
    active: true,
    hasOutrights: false,
  },
];

async function main() {
  const loaded = await loadObservedSlateV0();
  assert.equal(loaded.slate.summary.observedGames, 15);
  assert.equal(loaded.slate.summary.oneX2Observations, 15);
  assert.equal(loaded.slate.summary.registeredCompetition, 6);
  assert.equal(loaded.slate.summary.unregisteredCompetition, 9);
  assert.equal(loaded.slate.summary.pregameEligible, 14);
  assert.equal(loaded.slate.summary.cutoffBlocked, 1);

  const targets = loaded.slate.games.filter(
    (g) => g.researchUsageEligibility === "FUTURE_RESEARCH_ELIGIBLE",
  );
  assert.equal(targets.length, 6);
  assert.deepEqual(
    targets.map((g) => g.fixtureId).sort((a, b) => a - b),
    [...TARGET_IDS].sort((a, b) => a - b),
  );

  const schedule16 = parseFootballScheduleArtifact(
    JSON.parse(
      readFileSync("data/research/football/2026-08-16-schedule-v1.json", "utf8"),
    ),
  );
  const schedule17 = parseFootballScheduleArtifact(
    JSON.parse(
      readFileSync("data/research/football/2026-08-17-schedule-v1.json", "utf8"),
    ),
  );
  const plan16 = planOddsFetches({
    schedule: schedule16,
    observedAt: "2026-08-16T14:21:32.826Z",
  });
  const plan17 = planOddsFetches({
    schedule: schedule17,
    observedAt: "2026-08-16T14:21:33.737Z",
  });
  assert.equal(plan16.wouldCallProvider, false);
  assert.equal(plan16.skipped.sportKeyNotMapped, 0);
  assert.equal(plan17.wouldCallProvider, true);
  assert.deepEqual(plan17.sportKeysToFetch, ["soccer_usa_mls"]);
  assert.equal(plan17.skipped.sportKeyNotMapped, 0);
  assert.equal(plan17.skipped.identityBlocked, 2);
  assert.equal(plan17.skipped.teamBridgeMissing, 0);

  const racing = targets.find((g) => g.fixtureId === 1570339)!;
  const joined = joinFixtureToOddsEvent({
    game: racing,
    sportKey: "soccer_spain_la_liga",
    events: [
      mockEvent({
        id: "evt-racing",
        sportKey: "soccer_spain_la_liga",
        home: "Racing Santander",
        away: "Villarreal",
        commence: "2026-08-16T15:00:00.000Z",
      }),
    ],
  });
  assert.equal(joined.status, "JOINED");
  if (joined.status === "JOINED") {
    assert.equal(joined.sideAlignment, "ALIGNED");
    assert.equal(joined.event.externalEventId, "evt-racing");
  }

  const ambiguous = joinFixtureToOddsEvent({
    game: racing,
    sportKey: "soccer_spain_la_liga",
    events: [
      mockEvent({
        id: "evt-a",
        sportKey: "soccer_spain_la_liga",
        home: "Racing Santander",
        away: "Villarreal",
        commence: "2026-08-16T15:00:00.000Z",
      }),
      mockEvent({
        id: "evt-b",
        sportKey: "soccer_spain_la_liga",
        home: "Racing Santander",
        away: "Villarreal",
        commence: "2026-08-16T15:05:00.000Z",
      }),
    ],
  });
  assert.equal(ambiguous.status, "ODDS_IDENTITY_UNRESOLVED");

  const racingVariant = joinFixtureToOddsEvent({
    game: racing,
    sportKey: "soccer_spain_la_liga",
    events: [
      mockEvent({
        id: "evt-racing-variant",
        sportKey: "soccer_spain_la_liga",
        home: "Real Racing Club de Santander",
        away: "Villarreal",
        commence: "2026-08-16T15:00:00.000Z",
      }),
    ],
  });
  assert.equal(racingVariant.status, "JOINED");
  if (racingVariant.status === "JOINED") {
    assert.equal(racingVariant.event.externalEventId, "evt-racing-variant");
    assert.equal(
      racingVariant.evidence.includes("UNIQUE_KICKOFF_WINDOW_CANDIDATE"),
      true,
    );
  }

  const mlsKey = resolveResearchSportKey({
    providerCompetitionId: 253,
    sports: SPORTS,
  });
  assert.equal(mlsKey.status, "MAPPED");
  if (mlsKey.status === "MAPPED") {
    assert.equal(mlsKey.sportKey, "soccer_usa_mls");
  }

  const austin = targets.find((g) => g.fixtureId === 1490383)!;
  const austinJoin = joinFixtureToOddsEvent({
    game: austin,
    sportKey: "soccer_usa_mls",
    events: [
      mockEvent({
        id: "evt-austin",
        sportKey: "soccer_usa_mls",
        home: "Austin FC",
        away: "FC Dallas",
        commence: "2026-08-17T00:30:00.000Z",
      }),
    ],
  });
  assert.equal(austinJoin.status, "JOINED");

  const collectedAt = "2026-08-16T14:20:00.000Z";
  const doc = assembleFootball1x2MarketComparisonV0({
    ...loaded,
    generatedAt: "2026-08-16T14:20:01.000Z",
    sports: SPORTS,
    eventsBySportKey: {
      soccer_spain_la_liga: [
        mockEvent({
          id: "evt-racing",
          sportKey: "soccer_spain_la_liga",
          home: "Racing Santander",
          away: "Villarreal",
          commence: "2026-08-16T15:00:00.000Z",
        }),
        mockEvent({
          id: "evt-espanyol",
          sportKey: "soccer_spain_la_liga",
          home: "Espanyol",
          away: "Levante",
          commence: "2026-08-16T17:00:00.000Z",
        }),
      ],
      soccer_usa_mls: [
        mockEvent({
          id: "evt-chi",
          sportKey: "soccer_usa_mls",
          home: "Chicago Fire",
          away: "Portland Timbers",
          commence: "2026-08-16T22:00:00.000Z",
        }),
        mockEvent({
          id: "evt-nyc",
          sportKey: "soccer_usa_mls",
          home: "New York City FC",
          away: "Philadelphia Union",
          commence: "2026-08-16T22:00:00.000Z",
        }),
        mockEvent({
          id: "evt-austin",
          sportKey: "soccer_usa_mls",
          home: "Austin FC",
          away: "FC Dallas",
          commence: "2026-08-17T00:30:00.000Z",
        }),
        mockEvent({
          id: "evt-sea",
          sportKey: "soccer_usa_mls",
          home: "Seattle Sounders",
          away: "Vancouver Whitecaps",
          commence: "2026-08-17T02:30:00.000Z",
        }),
      ],
    },
    collectedAtBySportKey: {
      soccer_spain_la_liga: collectedAt,
      soccer_usa_mls: collectedAt,
    },
    cachedBySportKey: {},
    providerCalled: true,
  });

  assert.deepEqual(assertMarketComparisonIntegrity(doc), []);
  assert.equal(doc.summary.externalMatched, 6);
  assert.equal(doc.summary.unresolved, 0);
  assert.equal(doc.summary.postKickoffExcluded, 0);
  assert.equal(doc.predictionInput, false);
  assert.equal(doc.existingOdds1x2V1Written, false);

  for (const row of doc.rows) {
    const src = targets.find((g) => g.fixtureId === row.fixtureId)!;
    const oneX2 = src.markets.find((m) => m.marketKind === "ONE_X_TWO")!;
    assert.deepEqual(row.domestic.prices, oneX2.prices);
    assert.equal(row.domestic.screenshotSha256, src.sourceScreenshotSha256);
    assert.equal(row.identityStatus, "JOINED");
    assert.equal(row.external.cutoffStatus, "PRE_GAME_COLLECTED");
    assert.equal(row.usedByPrediction, false);
    assert.equal(row.probabilityGap.computed, true);
  }

  const late = assembleFootball1x2MarketComparisonV0({
    ...loaded,
    generatedAt: "2026-08-16T15:01:00.000Z",
    sports: SPORTS,
    eventsBySportKey: {
      soccer_spain_la_liga: [
        mockEvent({
          id: "evt-racing",
          sportKey: "soccer_spain_la_liga",
          home: "Racing Santander",
          away: "Villarreal",
          commence: "2026-08-16T15:00:00.000Z",
        }),
      ],
    },
    collectedAtBySportKey: {
      soccer_spain_la_liga: "2026-08-16T15:01:00.000Z",
    },
    cachedBySportKey: {},
    providerCalled: true,
  });
  const lateRacing = late.rows.find((r) => r.fixtureId === 1570339)!;
  assert.equal(lateRacing.identityStatus, "POST_KICKOFF_NOT_ELIGIBLE");
  assert.equal(lateRacing.external.bookmakers.length, 0);

  assert.equal(
    doc.sourceObservationHash,
    sha256File(
      "data/operator-observations/structured/2026-08-16/batch-2207-football-manual-market-observation-v0.json",
    ),
  );
  assert.equal(
    doc.sourceMappingHash,
    sha256File(
      "data/research/football/2026-08-16-manual-observation-fixture-mapping-v1.json",
    ),
  );

  assert.equal(
    existsSync("data/research/football/2026-08-16-1x2-odds-v1.json"),
    false,
  );
  assert.equal(
    existsSync("data/research/football/2026-08-17-1x2-odds-v1.json"),
    false,
  );

  const overlayDir = path.join(
    process.cwd(),
    "src/lib/football/1x2-market-comparison-v0",
  );
  for (const rel of readTree(overlayDir)) {
    assertNoForbiddenImports(path.join(overlayDir, rel));
  }
  assertNoForbiddenImports(
    path.join(process.cwd(), "scripts/build-football-1x2-market-comparison-v0.ts"),
  );

  console.log("FOOTBALL_1X2_MARKET_COMPARISON_V0_OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
