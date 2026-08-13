/**
 * Football Prediction Input Snapshot v0 tests.
 * Run: npm run test:football-prediction-snapshot-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  finalizeFootballScheduleDocument,
  type FootballScheduleArtifactV1,
  type FootballScheduleRowV1,
} from "../src/lib/football/core";
import {
  assembleFootball1x2OddsArtifact,
  computeFootball1x2OddsArtifactHash,
  computeFootball1x2OddsObservationHash,
  type Football1x2OddsObservationV1,
  type FootballOddsTeamBridgeEntry,
} from "../src/lib/football/odds-1x2-v1";
import {
  assembleFootballPredictionSnapshotV0,
  assertFrozenOddsObservationProvenance,
  buildFootballPredictionSnapshotV0,
  computeFootballPredictionSnapshotHash,
  type FootballPredictionSnapshotV0,
} from "../src/lib/football/prediction-snapshot-v0";
import type { OddsBookmaker, OddsData } from "../src/lib/odds/types";

const HOME_ID = "fb-team-v1-api-football-9001";
const AWAY_ID = "fb-team-v1-api-football-9002";
const KICKOFF = "2026-08-20T14:00:00.000Z";
const FREEZE = "2026-08-20T13:00:00.000Z";
const OBSERVED_LATEST = "2026-08-20T12:30:00.000Z";
const OBSERVED_OLDER = "2026-08-20T08:00:00.000Z";
const GENERATED = "2026-08-20T13:01:00.000Z";

const TEST_BRIDGE: FootballOddsTeamBridgeEntry[] = [
  {
    canonicalTeamId: HOME_ID,
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Home FC"],
    source: "test-fixture",
  },
  {
    canonicalTeamId: AWAY_ID,
    oddsProvider: "THE_ODDS_API",
    oddsTeamNames: ["Away FC"],
    source: "test-fixture",
  },
];

function readTree(dir: string, acc: string[] = [], prefix = ""): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    const abs = path.join(dir, name.name);
    if (name.isDirectory()) readTree(abs, acc, rel);
    else acc.push(rel);
  }
  return acc;
}

function shaFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function eligibleRow(
  over: Partial<FootballScheduleRowV1> = {},
): FootballScheduleRowV1 {
  return {
    dateKst: "2026-08-20",
    matchId: "soccer-api-football-999001",
    provider: "api-football",
    providerMatchId: "999001",
    competitionId: "fb-comp-api-football-39",
    seasonId: "2026",
    competitionType: "LEAGUE",
    matchFormat: "LEAGUE_MATCH",
    homeTeamId: HOME_ID,
    awayTeamId: AWAY_ID,
    homeProviderTeamId: "9001",
    awayProviderTeamId: "9002",
    homeTeamName: "Home FC",
    awayTeamName: "Away FC",
    kickoffTimeUtc: KICKOFF,
    status: "SCHEDULED",
    venue: "Test",
    identityStatus: "MATCHED",
    identityReasons: [],
    predictionEligibility: "ELIGIBLE_FORMAT",
    researchOnly: true,
    ...over,
  };
}

function scheduleOf(rows: FootballScheduleRowV1[]): FootballScheduleArtifactV1 {
  return finalizeFootballScheduleDocument({
    dateKst: rows[0]?.dateKst ?? "2026-08-20",
    generatedAt: "2026-08-20T00:00:00.000Z",
    provider: "api-football",
    rows,
    droppedUnregisteredCompetition: 0,
  });
}

function bookmaker(over: {
  outcomes: { name: string; price: number }[];
}): OddsBookmaker {
  return {
    key: "pinnacle",
    title: "Pinnacle",
    lastUpdate: "2026-08-20T11:00:00Z",
    markets: [
      {
        key: "h2h",
        lastUpdate: "2026-08-20T11:00:00Z",
        outcomes: over.outcomes,
      },
    ],
  };
}

function completeOutcomes(): { name: string; price: number }[] {
  return [
    { name: "Home FC", price: 2.1 },
    { name: "Draw", price: 3.4 },
    { name: "Away FC", price: 3.6 },
  ];
}

function oddsEvent(over: Partial<OddsData> = {}): OddsData {
  return {
    externalEventId: "odds-evt-1",
    sportKey: "soccer_epl",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    commenceTime: "2026-08-20T14:05:00.000Z",
    bookmakers: [bookmaker({ outcomes: completeOutcomes() })],
    bestHomeOdds: null,
    bestDrawOdds: null,
    bestAwayOdds: null,
    impliedHomeProbability: null,
    impliedDrawProbability: null,
    impliedAwayProbability: null,
    lastUpdated: "2026-08-20T11:00:00Z",
    source: "the-odds-api",
    ...over,
  };
}

function oddsArtifact(over: {
  rows?: FootballScheduleRowV1[];
  events?: OddsData[];
  observedAt?: string;
  previous?: ReturnType<typeof assembleFootball1x2OddsArtifact>["observations"];
}) {
  const schedule = scheduleOf(over.rows ?? [eligibleRow()]);
  return {
    schedule,
    odds: assembleFootball1x2OddsArtifact({
      schedule,
      observedAt: over.observedAt ?? OBSERVED_LATEST,
      generatedAt: GENERATED,
      eventsBySportKey: { soccer_epl: over.events ?? [oddsEvent()] },
      teamBridge: TEST_BRIDGE,
      previousObservations: over.previous,
      providerCalled: true,
      providerSportKeysRequested: ["soccer_epl"],
    }),
  };
}

function assertNoForbiddenSnapshotImports(filePath: string) {
  const src = readFileSync(filePath, "utf8");
  assert.equal(/getOddsProvider/.test(src), false, filePath);
  assert.equal(/the-odds-api-provider/.test(src), false, filePath);
  assert.equal(/assembleFootball1x2OddsArtifact/.test(src), false, filePath);
  assert.equal(/buildFootball1x2OddsV1/.test(src), false, filePath);
  assert.equal(/from ["'][^"']*odds-1x2-v1["']/.test(src), false, filePath);
  assert.equal(/from ["'][^"']*odds-1x2-v1\/(?:build|index)["']/.test(src), false, filePath);
  assert.equal(/from ["'][^"']*engine/.test(src), false, filePath);
  assert.equal(/GOOD PICK|STRONG PICK|PREDICTED/.test(src), false, filePath);
}

async function main() {
  const schedule12 = path.join(
    process.cwd(),
    "data/research/football/2026-08-12-schedule-v1.json",
  );
  const schedule14 = path.join(
    process.cwd(),
    "data/research/football/2026-08-14-schedule-v1.json",
  );
  const odds12 = path.join(
    process.cwd(),
    "data/research/football/2026-08-12-1x2-odds-v1.json",
  );
  const odds14 = path.join(
    process.cwd(),
    "data/research/football/2026-08-14-1x2-odds-v1.json",
  );
  const snapshot14 = path.join(
    process.cwd(),
    "data/research/football/2026-08-14-prediction-snapshot-v0.json",
  );
  const hash12S = shaFile(schedule12);
  const hash14S = shaFile(schedule14);
  const hash12O = shaFile(odds12);
  const hash14O = shaFile(odds14);
  const hash14Snap = shaFile(snapshot14);

  // 1. valid Schedule + Odds → snapshot
  const pair = oddsArtifact({});
  const snap = assembleFootballPredictionSnapshotV0({
    schedule: pair.schedule,
    odds: pair.odds,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  assert.equal(snap.matches.length, 1);
  assert.equal(snap.matches[0]!.snapshotStatus, "FROZEN");
  assert.equal(snap.meta.prediction, "NONE");
  assert.equal(snap.meta.engine, "NONE");
  assert.equal(snap.meta.frozenGames, 1);
  assert.ok(snap.matches[0]!.frozenOddsObservation);
  assert.ok(snap.matches[0]!.frozenScheduleRow);

  // 2–3. latest usable <= freeze selected; older not selected
  const older = oddsArtifact({ observedAt: OBSERVED_OLDER });
  const both = oddsArtifact({
    observedAt: OBSERVED_LATEST,
    previous: older.odds.observations,
  });
  const latestSnap = assembleFootballPredictionSnapshotV0({
    schedule: both.schedule,
    odds: both.odds,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  assert.equal(
    latestSnap.matches[0]!.frozenOddsObservation!.observedAt,
    OBSERVED_LATEST,
  );
  assert.notEqual(
    latestSnap.matches[0]!.selectedOddsObservationId,
    older.odds.observations[0]!.observationId,
  );

  // 4. observation after freeze excluded
  const after = oddsArtifact({
    observedAt: "2026-08-20T13:30:00.000Z",
    previous: both.odds.observations,
  });
  const afterSnap = assembleFootballPredictionSnapshotV0({
    schedule: after.schedule,
    odds: after.odds,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  assert.equal(afterSnap.matches[0]!.afterFreezeObservationCount, 1);
  assert.equal(
    afterSnap.matches[0]!.frozenOddsObservation!.observedAt,
    OBSERVED_LATEST,
  );

  // 5. post-kickoff freeze → no FROZEN
  const lateFreeze = assembleFootballPredictionSnapshotV0({
    schedule: pair.schedule,
    odds: pair.odds,
    freezeAt: "2026-08-20T14:00:00.000Z",
    generatedAt: GENERATED,
  });
  assert.equal(
    lateFreeze.matches[0]!.snapshotStatus,
    "MISSED_SNAPSHOT_FREEZE_WINDOW",
  );
  assert.equal(lateFreeze.meta.frozenGames, 0);

  // 6. incomplete 1X2 excluded
  const partial = oddsArtifact({
    events: [
      oddsEvent({
        bookmakers: [
          bookmaker({
            outcomes: [
              { name: "Home FC", price: 2.1 },
              { name: "Away FC", price: 3.6 },
            ],
          }),
        ],
      }),
    ],
  });
  const partialSnap = assembleFootballPredictionSnapshotV0({
    schedule: partial.schedule,
    odds: partial.odds,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  assert.equal(
    partialSnap.matches[0]!.snapshotStatus,
    "NO_USABLE_ODDS_BEFORE_FREEZE",
  );

  // 7. pregameUsable=false excluded
  const unusableOdds = structuredClone(pair.odds);
  unusableOdds.observations[0]!.pregameUsable = false;
  const unusableSnap = assembleFootballPredictionSnapshotV0({
    schedule: pair.schedule,
    odds: unusableOdds,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  assert.equal(
    unusableSnap.matches[0]!.snapshotStatus,
    "NO_USABLE_ODDS_BEFORE_FREEZE",
  );

  // 8. NOT_JOINED excluded
  const notJoined = structuredClone(pair.odds);
  notJoined.observations[0]!.joinStatus = "NOT_JOINED";
  const notJoinedSnap = assembleFootballPredictionSnapshotV0({
    schedule: pair.schedule,
    odds: notJoined,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  assert.equal(
    notJoinedSnap.matches[0]!.snapshotStatus,
    "NO_USABLE_ODDS_BEFORE_FREEZE",
  );

  // 9. wrong matchId excluded
  const wrongId = structuredClone(pair.odds);
  wrongId.observations[0]!.matchId = "soccer-api-football-000000";
  const wrongSnap = assembleFootballPredictionSnapshotV0({
    schedule: pair.schedule,
    odds: wrongId,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  assert.equal(
    wrongSnap.matches[0]!.snapshotStatus,
    "NO_USABLE_ODDS_BEFORE_FREEZE",
  );

  // 10. same latest timestamp ambiguity → fail closed
  const ambi = structuredClone(both.odds);
  const clone = structuredClone(ambi.observations[1]!);
  clone.observationId = `${clone.observationId}-dup`;
  ambi.observations.push(clone);
  assert.throws(
    () =>
      assembleFootballPredictionSnapshotV0({
        schedule: both.schedule,
        odds: ambi,
        freezeAt: FREEZE,
        generatedAt: GENERATED,
      }),
    /AMBIGUOUS_ODDS_OBSERVATION_SELECTION/,
  );

  // 11. no usable odds
  const emptyOdds = assembleFootball1x2OddsArtifact({
    schedule: pair.schedule,
    observedAt: OBSERVED_LATEST,
    generatedAt: GENERATED,
    eventsBySportKey: {},
    teamBridge: TEST_BRIDGE,
    providerCalled: false,
    providerSportKeysRequested: [],
  });
  const noneSnap = assembleFootballPredictionSnapshotV0({
    schedule: pair.schedule,
    odds: emptyOdds,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  assert.equal(
    noneSnap.matches[0]!.snapshotStatus,
    "NO_USABLE_ODDS_BEFORE_FREEZE",
  );

  // 12–14. non-eligible retained
  const mixedSched = scheduleOf([
    eligibleRow({
      matchId: "soccer-api-football-ucl",
      providerMatchId: "1",
      predictionEligibility: "NOT_SUPPORTED_FORMAT",
      matchFormat: "KNOCKOUT",
    }),
    eligibleRow({
      matchId: "soccer-api-football-blocked",
      providerMatchId: "2",
      predictionEligibility: "COMPETITION_BLOCKED",
    }),
    eligibleRow({
      matchId: "soccer-api-football-ident",
      providerMatchId: "3",
      predictionEligibility: "IDENTITY_BLOCKED",
      identityStatus: "IDENTITY_BLOCKED",
    }),
    eligibleRow({
      matchId: "soccer-api-football-unknown",
      providerMatchId: "4",
      predictionEligibility: "UNKNOWN",
    }),
  ]);
  const mixedOdds = assembleFootball1x2OddsArtifact({
    schedule: mixedSched,
    observedAt: OBSERVED_LATEST,
    generatedAt: GENERATED,
    eventsBySportKey: {},
    teamBridge: TEST_BRIDGE,
    providerCalled: false,
    providerSportKeysRequested: [],
  });
  const mixedSnap = assembleFootballPredictionSnapshotV0({
    schedule: mixedSched,
    odds: mixedOdds,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  const byId = Object.fromEntries(
    mixedSnap.matches.map((m) => [m.matchId, m.snapshotStatus]),
  );
  assert.equal(byId["soccer-api-football-ucl"], "NOT_ELIGIBLE_FORMAT");
  assert.equal(byId["soccer-api-football-blocked"], "COMPETITION_BLOCKED");
  assert.equal(byId["soccer-api-football-ident"], "IDENTITY_BLOCKED");
  assert.equal(byId["soccer-api-football-unknown"], "UNKNOWN_ELIGIBILITY");
  assert.equal(mixedSnap.meta.frozenGames, 0);
  assert.equal(mixedSnap.meta.notEligibleGames, 1);
  assert.equal(mixedSnap.meta.blockedGames, 2);
  assert.equal(mixedSnap.meta.unknownEligibilityGames, 1);

  // 20–21. observation hash
  const frozenObs = snap.matches[0]!.frozenOddsObservation!;
  const hashA = computeFootball1x2OddsObservationHash(frozenObs);
  assert.equal(snap.matches[0]!.selectedOddsObservationHash, hashA);
  const priceChanged = structuredClone(frozenObs);
  priceChanged.bookmakers[0]!.homeDecimal = 9.99;
  assert.notEqual(computeFootball1x2OddsObservationHash(priceChanged), hashA);
  const observedChanged = structuredClone(frozenObs);
  observedChanged.observedAt = "2026-08-20T12:31:00.000Z";
  assert.notEqual(computeFootball1x2OddsObservationHash(observedChanged), hashA);

  // 22–24. snapshot hash
  const snapB = assembleFootballPredictionSnapshotV0({
    schedule: pair.schedule,
    odds: pair.odds,
    freezeAt: FREEZE,
    generatedAt: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(snap.meta.snapshotHash, snapB.meta.snapshotHash);
  const snapC = assembleFootballPredictionSnapshotV0({
    schedule: pair.schedule,
    odds: pair.odds,
    freezeAt: "2026-08-20T12:45:00.000Z",
    generatedAt: GENERATED,
  });
  assert.notEqual(snap.meta.snapshotHash, snapC.meta.snapshotHash);
  assert.equal(
    computeFootballPredictionSnapshotHash({
      meta: { ...snap.meta, generatedAt: "x" },
      matches: snap.matches,
    }),
    snap.meta.snapshotHash,
  );

  function provenanceOdds(
    mutate: (obs: Football1x2OddsObservationV1) => void,
  ) {
    const odds = structuredClone(pair.odds);
    mutate(odds.observations[0]!);
    return odds;
  }

  function assertProvenanceFail(
    mutate: (obs: Football1x2OddsObservationV1) => void,
    code: string,
  ) {
    assert.throws(
      () =>
        assembleFootballPredictionSnapshotV0({
          schedule: pair.schedule,
          odds: provenanceOdds(mutate),
          freezeAt: FREEZE,
          generatedAt: GENERATED,
        }),
      new RegExp(code),
    );
  }

  assertProvenanceFail(
    (obs) => {
      obs.apiFootballProviderMatchId = "000000";
    },
    "FOOTBALL_SNAPSHOT_ODDS_PROVIDER_MATCH_ID_MISMATCH",
  );
  assertProvenanceFail(
    (obs) => {
      obs.competitionId = "fb-comp-api-football-000";
    },
    "FOOTBALL_SNAPSHOT_ODDS_COMPETITION_MISMATCH",
  );
  assertProvenanceFail(
    (obs) => {
      obs.homeTeamId = "fb-team-v1-api-football-0000";
    },
    "FOOTBALL_SNAPSHOT_ODDS_HOME_TEAM_MISMATCH",
  );
  assertProvenanceFail(
    (obs) => {
      obs.awayTeamId = "fb-team-v1-api-football-0000";
    },
    "FOOTBALL_SNAPSHOT_ODDS_AWAY_TEAM_MISMATCH",
  );
  assertProvenanceFail(
    (obs) => {
      obs.scheduleKickoffTimeUtc = "2026-08-20T15:00:00.000Z";
    },
    "FOOTBALL_SNAPSHOT_ODDS_KICKOFF_MISMATCH",
  );
  assertProvenanceFail(
    (obs) => {
      obs.sourceScheduleArtifactHash = "0".repeat(64);
    },
    "FOOTBALL_SNAPSHOT_ODDS_SCHEDULE_HASH_MISMATCH",
  );

  const exactSnap = assembleFootballPredictionSnapshotV0({
    schedule: pair.schedule,
    odds: pair.odds,
    freezeAt: FREEZE,
    generatedAt: GENERATED,
  });
  assert.equal(exactSnap.matches[0]!.snapshotStatus, "FROZEN");
  assertFrozenOddsObservationProvenance({
    row: exactSnap.matches[0]!.frozenScheduleRow,
    observation: exactSnap.matches[0]!.frozenOddsObservation!,
    scheduleArtifactHash: pair.schedule.meta.artifactHash,
  });

  const snapDir = path.join(process.cwd(), "src/lib/football/prediction-snapshot-v0");
  for (const rel of readTree(snapDir)) {
    assertNoForbiddenSnapshotImports(path.join(snapDir, rel));
  }
  assertNoForbiddenSnapshotImports(
    path.join(process.cwd(), "scripts/build-football-prediction-snapshot-v0.ts"),
  );
  const cliSrc = readFileSync(
    path.join(process.cwd(), "scripts/build-football-prediction-snapshot-v0.ts"),
    "utf8",
  );
  assert.equal(/--freeze-at/.test(cliSrc), false);
  assert.equal(/freezeAt = new Date\(\)\.toISOString\(\)/.test(cliSrc), true);

  const tmp = mkdtempSync(path.join(tmpdir(), "fb-snap-v0-"));
  try {
    const relDir = path.join(tmp, "data/research/football");
    mkdirSync(relDir, { recursive: true });
    writeFileSync(
      path.join(relDir, "2026-08-20-schedule-v1.json"),
      `${JSON.stringify(pair.schedule, null, 2)}\n`,
    );
    writeFileSync(
      path.join(relDir, "2026-08-20-1x2-odds-v1.json"),
      `${JSON.stringify(pair.odds, null, 2)}\n`,
    );

    // 15. invalid freezeAt → fail before write
    await assert.rejects(
      () =>
        buildFootballPredictionSnapshotV0({
          dateKst: "2026-08-20",
          freezeAt: "not-an-instant",
          generatedAt: GENERATED,
          dryRun: false,
          rootDir: tmp,
        }),
      /FOOTBALL_SNAPSHOT_FREEZE_AT_INVALID/,
    );
    assert.equal(
      existsSync(path.join(relDir, "2026-08-20-prediction-snapshot-v0.json")),
      false,
    );

    // 26. dry-run → zero writes
    const dry = await buildFootballPredictionSnapshotV0({
      dateKst: "2026-08-20",
      freezeAt: FREEZE,
      generatedAt: GENERATED,
      dryRun: true,
      rootDir: tmp,
    });
    assert.equal(dry.wrote, false);
    assert.equal(dry.document.meta.frozenGames, 1);
    assert.equal(
      existsSync(path.join(relDir, "2026-08-20-prediction-snapshot-v0.json")),
      false,
    );

    const written = await buildFootballPredictionSnapshotV0({
      dateKst: "2026-08-20",
      freezeAt: FREEZE,
      generatedAt: GENERATED,
      dryRun: false,
      rootDir: tmp,
    });
    assert.equal(written.wrote, true);
    const snapPath = path.join(relDir, "2026-08-20-prediction-snapshot-v0.json");
    const beforeBytes = shaFile(snapPath);

    // 25. existing Snapshot → refuse overwrite
    await assert.rejects(
      () =>
        buildFootballPredictionSnapshotV0({
          dateKst: "2026-08-20",
          freezeAt: FREEZE,
          generatedAt: GENERATED,
          dryRun: false,
          rootDir: tmp,
        }),
      /FOOTBALL_PREDICTION_SNAPSHOT_ALREADY_EXISTS/,
    );
    assert.equal(shaFile(snapPath), beforeBytes);

    // 16. corrupt Schedule
    const schedPath = path.join(relDir, "2026-08-20-schedule-v1.json");
    const oddsPath = path.join(relDir, "2026-08-20-1x2-odds-v1.json");
    rmSync(snapPath);
    const schedBytes = readFileSync(schedPath);
    writeFileSync(schedPath, "{not-json");
    await assert.rejects(
      () =>
        buildFootballPredictionSnapshotV0({
          dateKst: "2026-08-20",
          freezeAt: FREEZE,
          generatedAt: GENERATED,
          dryRun: false,
          rootDir: tmp,
        }),
      /SCHEDULE_JSON_INVALID/,
    );
    assert.equal(existsSync(snapPath), false);
    writeFileSync(schedPath, schedBytes);

    // 17. corrupt Odds
    const oddsBytes = readFileSync(oddsPath);
    writeFileSync(oddsPath, "{not-json");
    await assert.rejects(
      () =>
        buildFootballPredictionSnapshotV0({
          dateKst: "2026-08-20",
          freezeAt: FREEZE,
          generatedAt: GENERATED,
          dryRun: false,
          rootDir: tmp,
        }),
      /ODDS_ARTIFACT_JSON_INVALID/,
    );
    assert.equal(existsSync(snapPath), false);
    writeFileSync(oddsPath, oddsBytes);

    // 19. Odds artifact hash mismatch
    const tamperedOdds = JSON.parse(oddsBytes.toString()) as typeof pair.odds;
    tamperedOdds.meta.artifactHash = "0".repeat(64);
    writeFileSync(oddsPath, `${JSON.stringify(tamperedOdds, null, 2)}\n`);
    await assert.rejects(
      () =>
        buildFootballPredictionSnapshotV0({
          dateKst: "2026-08-20",
          freezeAt: FREEZE,
          generatedAt: GENERATED,
          dryRun: false,
          rootDir: tmp,
        }),
      /ODDS_ARTIFACT_HASH_MISMATCH/,
    );
    assert.equal(existsSync(snapPath), false);
    writeFileSync(oddsPath, oddsBytes);

    const mismatchedOdds = structuredClone(pair.odds);
    mismatchedOdds.observations[0]!.homeTeamId = "fb-team-v1-api-football-0000";
    const { artifactHash: _ignoredHash, ...metaWithoutHash } =
      mismatchedOdds.meta;
    void _ignoredHash;
    mismatchedOdds.meta.artifactHash = computeFootball1x2OddsArtifactHash({
      meta: metaWithoutHash,
      observations: mismatchedOdds.observations,
    });
    writeFileSync(
      oddsPath,
      `${JSON.stringify(mismatchedOdds, null, 2)}\n`,
    );
    await assert.rejects(
      () =>
        buildFootballPredictionSnapshotV0({
          dateKst: "2026-08-20",
          freezeAt: FREEZE,
          generatedAt: GENERATED,
          dryRun: false,
          rootDir: tmp,
        }),
      /FOOTBALL_SNAPSHOT_ODDS_HOME_TEAM_MISMATCH/,
    );
    assert.equal(existsSync(snapPath), false);
    writeFileSync(oddsPath, oddsBytes);

    // 18. Schedule hash mismatch vs Odds source
    const otherSched = scheduleOf([
      eligibleRow(),
      eligibleRow({
        matchId: "soccer-api-football-999002",
        providerMatchId: "999002",
      }),
    ]);
    writeFileSync(schedPath, `${JSON.stringify(otherSched, null, 2)}\n`);
    await assert.rejects(
      () =>
        buildFootballPredictionSnapshotV0({
          dateKst: "2026-08-20",
          freezeAt: FREEZE,
          generatedAt: GENERATED,
          dryRun: false,
          rootDir: tmp,
        }),
      /SCHEDULE_HASH_CHANGED_VS_EXISTING_ODDS/,
    );
    assert.equal(existsSync(snapPath), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const actualSnap = JSON.parse(
    readFileSync(snapshot14, "utf8"),
  ) as FootballPredictionSnapshotV0;
  const actualFrozen = actualSnap.matches.find(
    (m) => m.matchId === "soccer-api-football-1556021",
  );
  assert.ok(actualFrozen);
  assert.equal(actualFrozen.snapshotStatus, "FROZEN");
  assert.ok(actualFrozen.frozenOddsObservation);
  const liveSchedule = JSON.parse(readFileSync(schedule14, "utf8")) as {
    meta: { artifactHash: string };
  };
  assertFrozenOddsObservationProvenance({
    row: actualFrozen.frozenScheduleRow,
    observation: actualFrozen.frozenOddsObservation,
    scheduleArtifactHash: liveSchedule.meta.artifactHash,
  });
  assert.equal(
    actualFrozen.frozenOddsObservation.matchId,
    actualFrozen.frozenScheduleRow.matchId,
  );
  assert.equal(
    actualFrozen.frozenOddsObservation.apiFootballProviderMatchId,
    actualFrozen.frozenScheduleRow.providerMatchId,
  );
  assert.equal(
    actualFrozen.frozenOddsObservation.competitionId,
    actualFrozen.frozenScheduleRow.competitionId,
  );
  assert.equal(
    actualFrozen.frozenOddsObservation.homeTeamId,
    actualFrozen.frozenScheduleRow.homeTeamId,
  );
  assert.equal(
    actualFrozen.frozenOddsObservation.awayTeamId,
    actualFrozen.frozenScheduleRow.awayTeamId,
  );
  assert.equal(
    actualFrozen.frozenOddsObservation.scheduleKickoffTimeUtc,
    actualFrozen.frozenScheduleRow.kickoffTimeUtc,
  );
  assert.equal(
    actualFrozen.frozenOddsObservation.sourceScheduleArtifactHash,
    liveSchedule.meta.artifactHash,
  );
  const { snapshotHash: storedSnapHash, ...actualMetaNoHash } = actualSnap.meta;
  assert.equal(
    computeFootballPredictionSnapshotHash({
      meta: actualMetaNoHash,
      matches: actualSnap.matches,
    }),
    storedSnapHash,
  );
  assert.equal(
    actualFrozen.selectedOddsObservationId,
    "fb-1x2-obs-v1-soccer-api-football-1556021-THE_ODDS_API-2026-08-13T15:01:48.774Z",
  );

  assert.equal(shaFile(schedule12), hash12S);
  assert.equal(shaFile(schedule14), hash14S);
  assert.equal(shaFile(odds12), hash12O);
  assert.equal(shaFile(odds14), hash14O);
  assert.equal(shaFile(snapshot14), hash14Snap);

  console.log("test:football-prediction-snapshot-v0 PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
