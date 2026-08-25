/**
 * Football 90-minute 1X2 Research Odds Dataset v1 tests.
 * Run: npm run test:football-1x2-odds-v1
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
import { GAMES } from "../src/constants/games";
import {
  finalizeFootballScheduleDocument,
  type FootballScheduleArtifactV1,
  type FootballScheduleRowV1,
} from "../src/lib/football/core";
import { computeOneXTwoDevig } from "../src/lib/football/odds-foundation-v0/compute-devig-probabilities";
import {
  assembleFootball1x2OddsArtifact,
  buildFootball1x2OddsV1,
  computeFootball1x2OddsArtifactHash,
  extractBookmaker1x2Quote,
  FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  assertOddsTeamBridgeIntegrity,
  getOddsSportKey,
  joinScheduleRowToOddsEvent,
  medianDevigFromQuotes,
  parseFootball1x2OddsJsonText,
  parseFootballScheduleArtifact,
  planOddsFetches,
  type FootballOddsTeamBridgeEntry,
} from "../src/lib/football/odds-1x2-v1";
import type { OddsBookmaker, OddsData } from "../src/lib/odds/types";

const HOME_ID = "fb-team-v1-api-football-9001";
const AWAY_ID = "fb-team-v1-api-football-9002";
const KICKOFF = "2026-08-20T14:00:00.000Z";
const OBSERVED = "2026-08-20T12:00:00.000Z";
const GENERATED = "2026-08-20T12:01:00.000Z";

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

function scheduleOf(
  rows: FootballScheduleRowV1[],
): FootballScheduleArtifactV1 {
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
  key?: string;
}): OddsBookmaker {
  return {
    key: over.key ?? "pinnacle",
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

function assemble(over: {
  rows?: FootballScheduleRowV1[];
  events?: OddsData[];
  observedAt?: string;
  generatedAt?: string;
  previous?: ReturnType<typeof assembleFootball1x2OddsArtifact>["observations"];
  providerCalled?: boolean;
  requested?: string[];
  bridge?: FootballOddsTeamBridgeEntry[];
}) {
  const schedule = scheduleOf(over.rows ?? [eligibleRow()]);
  return assembleFootball1x2OddsArtifact({
    schedule,
    observedAt: over.observedAt ?? OBSERVED,
    generatedAt: over.generatedAt ?? GENERATED,
    eventsBySportKey: { soccer_epl: over.events ?? [oddsEvent()] },
    teamBridge: over.bridge ?? TEST_BRIDGE,
    previousObservations: over.previous,
    providerCalled: over.providerCalled ?? true,
    providerSportKeysRequested: over.requested ?? ["soccer_epl"],
  });
}

function assertNoForbiddenImports(filePath: string) {
  const src = readFileSync(filePath, "utf8");
  assert.equal(
    /from ["'][^"']*football\/prediction/.test(src),
    false,
    `prediction import in ${filePath}`,
  );
  assert.equal(
    /from ["'][^"']*engine/.test(src),
    false,
    `engine import in ${filePath}`,
  );
  assert.equal(
    /GOOD PICK|STRONG PICK/.test(src),
    false,
    `recommendation text in ${filePath}`,
  );
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
  const hash12Before = shaFile(schedule12);
  const hash14Before = shaFile(schedule14);

  // 1. complete HOME/DRAW/AWAY
  const complete = assemble({});
  const obs = complete.observations[0]!;
  assert.equal(obs.joinStatus, "JOINED");
  assert.equal(obs.marketStatus, "COMPLETE_1X2");
  assert.equal(obs.pregameUsable, true);
  assert.equal(obs.bookmakers.length, 1);
  assert.equal(obs.bookmakers[0]!.homeDecimal, 2.1);
  assert.equal(obs.bookmakers[0]!.drawDecimal, 3.4);
  assert.equal(obs.bookmakers[0]!.awayDecimal, 3.6);
  assert.equal(obs.oddsProviderEventId, "odds-evt-1");
  assert.equal(obs.matchId, "soccer-api-football-999001");
  assert.equal(obs.apiFootballProviderMatchId, "999001");
  assert.equal(complete.meta.complete1x2Games, 1);
  assert.equal(complete.meta.pregameUsableGames, 1);

  // 2. missing DRAW → PARTIAL / unusable
  const partial = assemble({
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
  assert.equal(partial.observations[0]!.marketStatus, "PARTIAL_1X2");
  assert.equal(partial.observations[0]!.pregameUsable, false);
  assert.equal(partial.meta.partial1x2Games, 1);
  assert.ok(partial.observations[0]!.reasonCodes.includes("MISSING_DRAW"));

  // 3. invalid decimal
  const invalid = assemble({
    events: [
      oddsEvent({
        bookmakers: [
          bookmaker({
            outcomes: [
              { name: "Home FC", price: 1.0 },
              { name: "Draw", price: 3.4 },
              { name: "Away FC", price: 3.6 },
            ],
          }),
        ],
      }),
    ],
  });
  assert.equal(invalid.observations[0]!.marketStatus, "INVALID_MARKET");
  assert.equal(invalid.observations[0]!.pregameUsable, false);

  // 4. overround / devig matches foundation
  const math = computeOneXTwoDevig({
    homeDecimal: 2.1,
    drawDecimal: 3.4,
    awayDecimal: 3.6,
  });
  const q = obs.bookmakers[0]!;
  assert.equal(q.overround, math.overround);
  assert.equal(q.devigHome, math.devigHome);
  assert.equal(q.devigDraw, math.devigDraw);
  assert.equal(q.devigAway, math.devigAway);
  const quoteDirect = extractBookmaker1x2Quote({
    bookmaker: bookmaker({ outcomes: completeOutcomes() }),
    homeTeam: "Home FC",
    awayTeam: "Away FC",
  });
  assert.equal(quoteDirect.overround, math.overround);

  // 5. exact canonical team mapping joins
  const joinOk = joinScheduleRowToOddsEvent({
    row: eligibleRow(),
    events: [oddsEvent()],
    teamBridge: TEST_BRIDGE,
  });
  assert.equal(joinOk.status, "JOINED");

  // 6. unknown Odds-provider team → fail-close
  const unknown = assemble({
    bridge: [
      {
        canonicalTeamId: HOME_ID,
        oddsProvider: "THE_ODDS_API",
        oddsTeamNames: ["Home FC"],
        source: "test",
      },
    ],
  });
  assert.equal(
    unknown.observations[0]!.joinStatus,
    "ODDS_EVENT_IDENTITY_REVIEW_REQUIRED",
  );
  assert.equal(unknown.observations[0]!.pregameUsable, false);
  assert.equal(unknown.observations[0]!.oddsProviderEventId, null);

  // 7. reversed home/away → no false join
  const reversed = joinScheduleRowToOddsEvent({
    row: eligibleRow(),
    events: [oddsEvent({ homeTeam: "Away FC", awayTeam: "Home FC" })],
    teamBridge: TEST_BRIDGE,
  });
  assert.equal(reversed.status, "NOT_JOINED");

  // 8. kickoff within 15 minutes
  const within = joinScheduleRowToOddsEvent({
    row: eligibleRow(),
    events: [oddsEvent({ commenceTime: "2026-08-20T14:15:00.000Z" })],
    teamBridge: TEST_BRIDGE,
  });
  assert.equal(within.status, "JOINED");
  if (within.status === "JOINED") {
    assert.equal(within.kickoffDeltaMinutes, 15);
  }

  // 9. kickoff outside tolerance
  const outside = joinScheduleRowToOddsEvent({
    row: eligibleRow(),
    events: [oddsEvent({ commenceTime: "2026-08-20T14:16:00.000Z" })],
    teamBridge: TEST_BRIDGE,
  });
  assert.equal(outside.status, "NOT_JOINED");

  // 10. multiple event candidates → ambiguous
  const ambi = assemble({
    events: [
      oddsEvent({ externalEventId: "odds-evt-a" }),
      oddsEvent({ externalEventId: "odds-evt-b" }),
    ],
  });
  assert.equal(ambi.observations[0]!.joinStatus, "AMBIGUOUS_EVENT_JOIN");
  assert.equal(ambi.observations[0]!.pregameUsable, false);
  assert.equal(ambi.meta.ambiguousGames, 1);

  // 11. post-kickoff observedAt
  const late = assemble({ observedAt: "2026-08-20T14:00:00.000Z" });
  assert.equal(late.observations[0]!.joinStatus, "JOINED");
  assert.equal(late.observations[0]!.pregameUsable, false);
  assert.ok(
    late.observations[0]!.reasonCodes.includes("CAPTURED_AFTER_OR_AT_KICKOFF"),
  );
  assert.equal(late.meta.lateGames, 1);

  // 12. same match multiple observation times remain distinct
  const first = assemble({ observedAt: "2026-08-20T11:00:00.000Z" });
  const second = assemble({
    observedAt: "2026-08-20T12:00:00.000Z",
    previous: first.observations,
  });
  assert.equal(second.observations.length, 2);
  assert.notEqual(
    second.observations[0]!.observationId,
    second.observations[1]!.observationId,
  );
  assert.throws(
    () =>
      assemble({
        observedAt: "2026-08-20T11:00:00.000Z",
        previous: first.observations,
      }),
    /DUPLICATE_ODDS_OBSERVATION/,
  );

  // 13. generatedAt-only change does not change content hash
  const g1 = assemble({ generatedAt: "2026-08-20T12:01:00.000Z" });
  const g2 = assemble({ generatedAt: "2099-01-01T00:00:00.000Z" });
  assert.equal(g1.meta.artifactHash, g2.meta.artifactHash);
  assert.equal(
    computeFootball1x2OddsArtifactHash({
      meta: { ...g1.meta, generatedAt: "x" },
      observations: g1.observations,
    }),
    g1.meta.artifactHash,
  );

  // 14. observedAt change DOES represent different observation content
  const o1 = assemble({ observedAt: "2026-08-20T11:00:00.000Z" });
  const o2 = assemble({ observedAt: "2026-08-20T11:01:00.000Z" });
  assert.notEqual(o1.meta.artifactHash, o2.meta.artifactHash);

  // 15–16. NOT_SUPPORTED_FORMAT / COMPETITION_BLOCKED do not trigger Odds requests
  const blockedSchedule = scheduleOf([
    eligibleRow({
      matchId: "soccer-api-football-ucl",
      providerMatchId: "1",
      competitionId: "fb-comp-api-football-2",
      matchFormat: "KNOCKOUT",
      predictionEligibility: "NOT_SUPPORTED_FORMAT",
    }),
    eligibleRow({
      matchId: "soccer-api-football-blocked",
      providerMatchId: "2",
      competitionId: "fb-comp-api-football-39",
      predictionEligibility: "COMPETITION_BLOCKED",
    }),
  ]);
  const planBlocked = planOddsFetches({
    schedule: blockedSchedule,
    teamBridge: TEST_BRIDGE,
  });
  assert.equal(planBlocked.eligible.length, 0);
  assert.equal(planBlocked.wouldCallProvider, false);
  assert.equal(planBlocked.sportKeysToFetch.length, 0);
  assert.equal(planBlocked.skipped.notSupportedFormat, 1);
  assert.equal(planBlocked.skipped.competitionBlocked, 1);

  const assembledBlocked = assembleFootball1x2OddsArtifact({
    schedule: blockedSchedule,
    observedAt: OBSERVED,
    generatedAt: GENERATED,
    eventsBySportKey: { soccer_epl: [oddsEvent()] },
    teamBridge: TEST_BRIDGE,
    providerCalled: false,
    providerSportKeysRequested: [],
  });
  assert.equal(assembledBlocked.observations.length, 0);
  assert.equal(assembledBlocked.meta.scheduleEligibleGames, 0);

  // J1 sport key mapped; unmapped teams → no fetch
  const j1UnmappedTeams = scheduleOf([
    eligibleRow({
      competitionId: "fb-comp-api-football-98",
      matchId: "soccer-api-football-1556021",
      providerMatchId: "1556021",
      homeTeamId: "fb-team-v1-api-football-99991",
      awayTeamId: "fb-team-v1-api-football-99992",
    }),
  ]);
  const planJ1Unmapped = planOddsFetches({
    schedule: j1UnmappedTeams,
    teamBridge: TEST_BRIDGE,
  });
  assert.equal(planJ1Unmapped.wouldCallProvider, false);
  assert.equal(planJ1Unmapped.skipped.teamBridgeMissing, 1);

  const j1MappedTeams = scheduleOf([
    eligibleRow({
      competitionId: "fb-comp-api-football-98",
    }),
  ]);
  const planJ1Mapped = planOddsFetches({
    schedule: j1MappedTeams,
    teamBridge: TEST_BRIDGE,
  });
  assert.equal(planJ1Mapped.wouldCallProvider, true);
  assert.deepEqual(planJ1Mapped.sportKeysToFetch, ["soccer_japan_j_league"]);

  // 17. committed schedule artifact bytes unchanged after odds assemble
  assert.equal(shaFile(schedule12), hash12Before);
  assert.equal(shaFile(schedule14), hash14Before);
  const live12 = parseFootballScheduleArtifact(
    JSON.parse(readFileSync(schedule12, "utf8")),
  );
  const live14 = parseFootballScheduleArtifact(
    JSON.parse(readFileSync(schedule14, "utf8")),
  );
  assert.equal(live12.meta.artifactHash.length, 64);
  assert.equal(live14.meta.artifactHash.length, 64);
  const live14Plan = planOddsFetches({
    schedule: live14,
    teamBridge: [],
  });
  assert.equal(live14Plan.eligible.length, 1);
  assert.equal(live14Plan.wouldCallProvider, false);
  assert.equal(live14Plan.skipped.teamBridgeMissing, 1);

  const live14Prod = planOddsFetches({
    schedule: live14,
    observedAt: "2026-08-14T09:00:00.000Z",
  });
  assert.equal(getOddsSportKey("fb-comp-api-football-98")?.sportKey, "soccer_japan_j_league");
  assert.equal(getOddsSportKey("fb-comp-api-football-140")?.sportKey, "soccer_spain_la_liga");
  assert.equal(getOddsSportKey("fb-comp-api-football-253")?.sportKey, "soccer_usa_mls");
  const bridgeIds = FOOTBALL_ODDS_TEAM_BRIDGE_V1.map((e) => e.canonicalTeamId);
  assert.equal(bridgeIds.includes("fb-team-v1-api-football-281"), true);
  assert.equal(bridgeIds.includes("fb-team-v1-api-football-306"), true);
  assert.equal(live14Prod.wouldCallProvider, true);
  assert.deepEqual(live14Prod.sportKeysToFetch, ["soccer_japan_j_league"]);

  const live14Late = planOddsFetches({
    schedule: live14,
    observedAt: "2026-08-14T10:00:00.000Z",
  });
  assert.equal(live14Late.wouldCallProvider, false);
  assert.equal(live14Late.skipped.missedPregameWindow, 1);

  const j1ExactJoin = joinScheduleRowToOddsEvent({
    row: eligibleRow({
      matchId: "soccer-api-football-1556021",
      providerMatchId: "1556021",
      competitionId: "fb-comp-api-football-98",
      homeTeamId: "fb-team-v1-api-football-306",
      awayTeamId: "fb-team-v1-api-football-281",
      kickoffTimeUtc: "2026-08-14T10:00:00.000Z",
    }),
    events: [
      oddsEvent({
        externalEventId: "b5533f61730b76f4a8f39ed5918218ae",
        sportKey: "soccer_japan_j_league",
        homeTeam: "Tokyo Verdy",
        awayTeam: "Kashiwa Reysol",
        commenceTime: "2026-08-14T10:00:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(j1ExactJoin.status, "JOINED");
  if (j1ExactJoin.status === "JOINED") {
    assert.equal(j1ExactJoin.kickoffDeltaMinutes, 0);
  }

  // 18–19. no Prediction / Engine import in odds-1x2-v1
  const oddsDir = path.join(process.cwd(), "src/lib/football/odds-1x2-v1");
  for (const rel of readTree(oddsDir)) {
    assertNoForbiddenImports(path.join(oddsDir, rel));
  }
  assertNoForbiddenImports(
    path.join(process.cwd(), "scripts/build-football-1x2-odds-v1.ts"),
  );

  // 20. dummy/product rows never become research odds
  const footballGames = GAMES.filter((g) => g.sport === "football");
  assert.ok(footballGames.length >= 1);
  assert.throws(
    () => parseFootballScheduleArtifact(footballGames[0]),
    /DUMMY_PRODUCT_GAMES_NOT_RESEARCH/,
  );
  assert.throws(
    () =>
      assembleFootball1x2OddsArtifact({
        schedule: scheduleOf([eligibleRow()]),
        observedAt: OBSERVED,
        generatedAt: GENERATED,
        eventsBySportKey: {
          soccer_epl: [oddsEvent({ source: "dummy" })],
        },
        teamBridge: TEST_BRIDGE,
        providerCalled: true,
        providerSportKeysRequested: ["soccer_epl"],
      }),
    /DUMMY_ODDS_NOT_RESEARCH/,
  );

  // dry-run: zero writes, zero fetch
  const tmp = mkdtempSync(path.join(tmpdir(), "fb-1x2-odds-"));
  try {
    const relDir = path.join(tmp, "data/research/football");
    mkdirSync(relDir, { recursive: true });
    const sched = scheduleOf([eligibleRow()]);
    writeFileSync(
      path.join(relDir, "2026-08-20-schedule-v1.json"),
      `${JSON.stringify(sched, null, 2)}\n`,
    );
    let fetched = 0;
    const dry = await awaitBuild(tmp, true, async () => {
      fetched += 1;
      return {
        events: [oddsEvent()],
        usage: {
          requestsUsed: 1,
          requestsRemaining: 99,
          requestsLast: 1,
        },
      };
    });
    assert.equal(dry.wrote, false);
    assert.equal(dry.providerCalled, false);
    assert.equal(fetched, 0);
    assert.equal(
      existsSync(path.join(relDir, "2026-08-20-1x2-odds-v1.json")),
      false,
    );

    const liveMapped = await awaitBuild(tmp, false, async () => {
      fetched += 1;
      return {
        events: [oddsEvent()],
        usage: {
          requestsUsed: 12,
          requestsRemaining: 488,
          requestsLast: 1,
        },
      };
    });
    assert.equal(liveMapped.wrote, true);
    assert.equal(liveMapped.providerCalled, true);
    assert.equal(fetched, 1);
    assert.equal(liveMapped.document.meta.pregameUsableGames, 1);
    assert.equal(liveMapped.document.meta.requestsRemaining, 488);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // live 08-14 schedule copy: must not call provider (J1 unmapped)
  const tmp2 = mkdtempSync(path.join(tmpdir(), "fb-1x2-odds-live-"));
  try {
    const relDir = path.join(tmp2, "data/research/football");
    mkdirSync(relDir, { recursive: true });
    writeFileSync(
      path.join(relDir, "2026-08-14-schedule-v1.json"),
      readFileSync(schedule14),
    );
    let fetched = 0;
    const result = await awaitBuildSync(tmp2, "2026-08-14", false, async () => {
      fetched += 1;
      throw new Error("MUST_NOT_FETCH");
    });
    assert.equal(fetched, 0);
    assert.equal(result.providerCalled, false);
    assert.equal(result.document.meta.scheduleEligibleGames, 1);
    assert.equal(result.document.observations.length, 1);
    assert.equal(
      result.document.observations[0]!.joinStatus,
      "ODDS_EVENT_IDENTITY_REVIEW_REQUIRED",
    );
    assert.equal(result.document.observations[0]!.pregameUsable, false);
  } finally {
    rmSync(tmp2, { recursive: true, force: true });
  }

  assert.equal(shaFile(schedule12), hash12Before);
  assert.equal(shaFile(schedule14), hash14Before);

  const consensus = complete.observations[0]!;
  assert.equal(typeof consensus.medianDevigHome, "number");
  assert.equal(typeof consensus.medianDevigDraw, "number");
  assert.equal(typeof consensus.medianDevigAway, "number");

  // --- Pre-commit evidence safety ---

  const dupHome = extractBookmaker1x2Quote({
    bookmaker: bookmaker({
      outcomes: [...completeOutcomes(), { name: "Home FC", price: 9.9 }],
    }),
    homeTeam: "Home FC",
    awayTeam: "Away FC",
  });
  assert.equal(dupHome.marketStatus, "INVALID_MARKET");
  assert.ok(dupHome.reasonCodes.includes("DUPLICATE_SIDE:home"));

  const dupDraw = extractBookmaker1x2Quote({
    bookmaker: bookmaker({
      outcomes: [...completeOutcomes(), { name: "Draw", price: 9.9 }],
    }),
    homeTeam: "Home FC",
    awayTeam: "Away FC",
  });
  assert.equal(dupDraw.marketStatus, "INVALID_MARKET");
  assert.ok(dupDraw.reasonCodes.includes("DUPLICATE_SIDE:draw"));

  const dupAway = extractBookmaker1x2Quote({
    bookmaker: bookmaker({
      outcomes: [...completeOutcomes(), { name: "Away FC", price: 9.9 }],
    }),
    homeTeam: "Home FC",
    awayTeam: "Away FC",
  });
  assert.equal(dupAway.marketStatus, "INVALID_MARKET");
  assert.ok(dupAway.reasonCodes.includes("DUPLICATE_SIDE:away"));

  const mixed = assemble({
    events: [
      oddsEvent({
        bookmakers: [
          bookmaker({
            key: "badbook",
            outcomes: [...completeOutcomes(), { name: "Draw", price: 2.2 }],
          }),
          bookmaker({ key: "goodbook", outcomes: completeOutcomes() }),
        ],
      }),
    ],
  });
  const mixedObs = mixed.observations[0]!;
  assert.equal(mixedObs.marketStatus, "COMPLETE_1X2");
  assert.equal(mixedObs.pregameUsable, true);
  assert.equal(mixedObs.bookmakers[0]!.marketStatus, "INVALID_MARKET");
  assert.equal(mixedObs.bookmakers[1]!.marketStatus, "COMPLETE_1X2");
  const mixedMed = medianDevigFromQuotes(mixedObs.bookmakers);
  assert.equal(mixedMed.medianDevigHome, mixedObs.bookmakers[1]!.devigHome);
  assert.equal(mixedObs.medianDevigHome, mixedObs.bookmakers[1]!.devigHome);

  const priceMutatedHash = computeFootball1x2OddsArtifactHash({
    meta: complete.meta,
    observations: complete.observations.map((o) => ({
      ...o,
      bookmakers: o.bookmakers.map((b) => ({ ...b, homeDecimal: 9.99 })),
    })),
  });
  assert.notEqual(priceMutatedHash, complete.meta.artifactHash);
  const quoteMutatedHash = computeFootball1x2OddsArtifactHash({
    meta: complete.meta,
    observations: complete.observations.map((o) => ({
      ...o,
      bookmakers: o.bookmakers.map((b) => ({
        ...b,
        bookmakerKey: `${b.bookmakerKey}-x`,
      })),
    })),
  });
  assert.notEqual(quoteMutatedHash, complete.meta.artifactHash);

  assertOddsTeamBridgeIntegrity(FOOTBALL_ODDS_TEAM_BRIDGE_V1);
  assert.throws(
    () =>
      assertOddsTeamBridgeIntegrity([
        FOOTBALL_ODDS_TEAM_BRIDGE_V1[0]!,
        FOOTBALL_ODDS_TEAM_BRIDGE_V1[0]!,
      ]),
    /ODDS_TEAM_BRIDGE_DUPLICATE_CANONICAL/,
  );
  assert.throws(
    () =>
      assertOddsTeamBridgeIntegrity([
        {
          canonicalTeamId: "fb-team-v1-api-football-306",
          oddsProvider: "THE_ODDS_API",
          oddsTeamNames: ["Tokyo Verdy"],
          source: "test",
        },
        {
          canonicalTeamId: "fb-team-v1-api-football-999",
          oddsProvider: "THE_ODDS_API",
          oddsTeamNames: ["Tokyo Verdy"],
          source: "test",
        },
      ]),
    /ODDS_TEAM_BRIDGE_NAME_COLLISION/,
  );
  assert.throws(
    () =>
      assertOddsTeamBridgeIntegrity([
        {
          canonicalTeamId: "fb-team-v1-api-football-306",
          oddsProvider: "THE_ODDS_API",
          oddsTeamNames: ["Tokyo Verdy", "Tokyo Verdy"],
          source: "test",
        },
      ]),
    /ODDS_TEAM_BRIDGE_DUPLICATE_NAME_IN_ENTRY/,
  );

  const liveOdds12 = parseFootball1x2OddsJsonText(
    readFileSync(
      path.join(process.cwd(), "data/research/football/2026-08-12-1x2-odds-v1.json"),
      "utf8",
    ),
  );
  const liveOdds14 = parseFootball1x2OddsJsonText(
    readFileSync(
      path.join(process.cwd(), "data/research/football/2026-08-14-1x2-odds-v1.json"),
      "utf8",
    ),
  );
  assert.equal(liveOdds12.meta.schemaVersion, "football-1x2-odds-v1");
  assert.equal(liveOdds14.meta.schemaVersion, "football-1x2-odds-v1");
  assert.equal(
    liveOdds12.meta.sourceScheduleArtifactHash,
    live12.meta.artifactHash,
  );
  assert.equal(
    liveOdds14.meta.sourceScheduleArtifactHash,
    live14.meta.artifactHash,
  );
  const joined14 = liveOdds14.observations.find((o) => o.joinStatus === "JOINED");
  assert.ok(joined14);
  assert.equal(
    joined14!.observationId,
    "fb-1x2-obs-v1-soccer-api-football-1556021-THE_ODDS_API-2026-08-13T15:01:48.774Z",
  );
  assert.equal(joined14!.observedAt, "2026-08-13T15:01:48.774Z");
  assert.equal(joined14!.bookmakers[0]!.homeDecimal, 4.05);
  assert.equal(joined14!.bookmakers[0]!.drawDecimal, 3.15);
  assert.equal(joined14!.bookmakers[0]!.awayDecimal, 1.92);

  const safetyTmp = mkdtempSync(path.join(tmpdir(), "fb-1x2-safety-"));
  try {
    const relDir = path.join(safetyTmp, "data/research/football");
    mkdirSync(relDir, { recursive: true });
    const sched = scheduleOf([eligibleRow()]);
    const schedPath = path.join(relDir, "2026-08-20-schedule-v1.json");
    const oddsPath = path.join(relDir, "2026-08-20-1x2-odds-v1.json");
    writeFileSync(schedPath, `${JSON.stringify(sched, null, 2)}\n`);

    const first = await awaitBuild(safetyTmp, false, async () => ({
      events: [oddsEvent()],
      usage: { requestsUsed: 1, requestsRemaining: 10, requestsLast: 1 },
    }));
    assert.equal(first.document.observations.length, 1);
    const validBytes = shaFile(oddsPath);

    const appended = await buildFootball1x2OddsV1({
      dateKst: "2026-08-20",
      observedAt: "2026-08-20T12:30:00.000Z",
      generatedAt: GENERATED,
      dryRun: false,
      fetchOdds: async () => ({
        events: [oddsEvent()],
        usage: { requestsUsed: 2, requestsRemaining: 9, requestsLast: 1 },
      }),
      teamBridge: TEST_BRIDGE,
      rootDir: safetyTmp,
    });
    assert.equal(appended.document.observations.length, 2);
    assert.notEqual(appended.document.meta.artifactHash, first.document.meta.artifactHash);

    writeFileSync(oddsPath, `${JSON.stringify(first.document, null, 2)}\n`);
    assert.equal(shaFile(oddsPath), validBytes);

    writeFileSync(oddsPath, "{not-json");
    let fetched = 0;
    await assert.rejects(
      () =>
        awaitBuild(safetyTmp, false, async () => {
          fetched += 1;
          return {
            events: [oddsEvent()],
            usage: { requestsUsed: 1, requestsRemaining: 10, requestsLast: 1 },
          };
        }),
      /ODDS_ARTIFACT_JSON_INVALID/,
    );
    assert.equal(fetched, 0);
    assert.equal(readFileSync(oddsPath, "utf8"), "{not-json");

    writeFileSync(oddsPath, `${JSON.stringify(first.document, null, 2)}\n`);
    const wrongSchema = JSON.parse(readFileSync(oddsPath, "utf8")) as {
      meta: { schemaVersion: string };
    };
    wrongSchema.meta.schemaVersion = "football-1x2-odds-v0";
    writeFileSync(oddsPath, `${JSON.stringify(wrongSchema, null, 2)}\n`);
    const schemaBytes = shaFile(oddsPath);
    fetched = 0;
    await assert.rejects(
      () =>
        awaitBuild(safetyTmp, false, async () => {
          fetched += 1;
          return {
            events: [oddsEvent()],
            usage: { requestsUsed: 1, requestsRemaining: 10, requestsLast: 1 },
          };
        }),
      /ODDS_ARTIFACT_SCHEMA_MISMATCH/,
    );
    assert.equal(fetched, 0);
    assert.equal(shaFile(oddsPath), schemaBytes);

    const hashTampered = JSON.parse(
      JSON.stringify(first.document),
    ) as typeof first.document;
    hashTampered.meta.artifactHash = "0".repeat(64);
    writeFileSync(oddsPath, `${JSON.stringify(hashTampered, null, 2)}\n`);
    const hashBytes = shaFile(oddsPath);
    fetched = 0;
    await assert.rejects(
      () =>
        awaitBuild(safetyTmp, false, async () => {
          fetched += 1;
          return {
            events: [oddsEvent()],
            usage: { requestsUsed: 1, requestsRemaining: 10, requestsLast: 1 },
          };
        }),
      /ODDS_ARTIFACT_HASH_MISMATCH/,
    );
    assert.equal(fetched, 0);
    assert.equal(shaFile(oddsPath), hashBytes);

    writeFileSync(oddsPath, `${JSON.stringify(first.document, null, 2)}\n`);
    const sched2 = scheduleOf([
      eligibleRow(),
      eligibleRow({
        matchId: "soccer-api-football-999002",
        providerMatchId: "999002",
      }),
    ]);
    writeFileSync(schedPath, `${JSON.stringify(sched2, null, 2)}\n`);
    const afterSchedSwap = shaFile(oddsPath);
    fetched = 0;
    await assert.rejects(
      () =>
        awaitBuild(safetyTmp, false, async () => {
          fetched += 1;
          return {
            events: [oddsEvent()],
            usage: { requestsUsed: 1, requestsRemaining: 10, requestsLast: 1 },
          };
        }),
      /SCHEDULE_HASH_CHANGED_VS_EXISTING_ODDS/,
    );
    assert.equal(fetched, 0);
    assert.equal(shaFile(oddsPath), afterSchedSwap);

    fetched = 0;
    await assert.rejects(
      () =>
        buildFootball1x2OddsV1({
          dateKst: "2026-08-20",
          observedAt: "not-an-instant",
          generatedAt: GENERATED,
          dryRun: false,
          fetchOdds: async () => {
            fetched += 1;
            return {
              events: [oddsEvent()],
              usage: { requestsUsed: 1, requestsRemaining: 10, requestsLast: 1 },
            };
          },
          teamBridge: TEST_BRIDGE,
          rootDir: safetyTmp,
        }),
      /ODDS_OBSERVED_AT_INVALID/,
    );
    assert.equal(fetched, 0);

    fetched = 0;
    await assert.rejects(
      () =>
        buildFootball1x2OddsV1({
          dateKst: "2026-08-20",
          observedAt: OBSERVED,
          generatedAt: "Monday",
          dryRun: false,
          fetchOdds: async () => {
            fetched += 1;
            return {
              events: [oddsEvent()],
              usage: { requestsUsed: 1, requestsRemaining: 10, requestsLast: 1 },
            };
          },
          teamBridge: TEST_BRIDGE,
          rootDir: safetyTmp,
        }),
      /ODDS_GENERATED_AT_INVALID/,
    );
    assert.equal(fetched, 0);
  } finally {
    rmSync(safetyTmp, { recursive: true, force: true });
  }

  assert.equal(shaFile(schedule12), hash12Before);
  assert.equal(shaFile(schedule14), hash14Before);

  const firstZeroEligible = parseFootball1x2OddsJsonText(
    readFileSync(
      path.join(
        process.cwd(),
        "data/research/football/2026-08-25-1x2-odds-v1.json",
      ),
      "utf8",
    ),
  );
  assert.equal(firstZeroEligible.meta.scheduleEligibleGames, 0);
  assert.equal(firstZeroEligible.meta.providerCalled, false);
  assert.equal(firstZeroEligible.observations.length, 0);
  assert.equal(
    firstZeroEligible.meta.artifactHash,
    "617e29e4fbe397f0db73fe586bd452fa314153b7e699d60aeeb50f05d554d68f",
  );
  assert.equal(
    firstZeroEligible.meta.sourceScheduleArtifactHash,
    "06595340bc162ad31fba9e6dea2131bc76cbe76dddc1c9d88a938650d6e3f608",
  );

  console.log("test:football-1x2-odds-v1 PASS");
}

function awaitBuild(
  rootDir: string,
  dryRun: boolean,
  fetchOdds: (sportKey: string) => Promise<{
    events: OddsData[];
    usage: {
      requestsUsed: number | null;
      requestsRemaining: number | null;
      requestsLast: number | null;
    };
  }>,
) {
  return buildFootball1x2OddsV1({
    dateKst: "2026-08-20",
    observedAt: OBSERVED,
    generatedAt: GENERATED,
    dryRun,
    fetchOdds,
    teamBridge: TEST_BRIDGE,
    rootDir,
  });
}

function awaitBuildSync(
  rootDir: string,
  dateKst: string,
  dryRun: boolean,
  fetchOdds: (sportKey: string) => Promise<{
    events: OddsData[];
    usage: {
      requestsUsed: number | null;
      requestsRemaining: number | null;
      requestsLast: number | null;
    };
  }>,
) {
  return buildFootball1x2OddsV1({
    dateKst,
    observedAt: OBSERVED,
    generatedAt: GENERATED,
    dryRun,
    fetchOdds,
    teamBridge: [],
    rootDir,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
