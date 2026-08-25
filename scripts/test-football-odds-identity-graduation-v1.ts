/**
 * Football Odds Identity Graduation v1 tests.
 * Run: npm run test:football-odds-identity-graduation-v1
 *
 * Maps only. Does not write odds artifacts. Does not run Prediction.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS,
  FOOTBALL_SLATE_2026_08_17_TEAMS,
  FOOTBALL_SLATE_2026_08_18_TEAMS,
  FOOTBALL_TEAM_CATALOG_V1,
  assertTeamCatalogIntegrity,
  resolveProviderTeam,
} from "../src/lib/football/core";
import {
  FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
  FOOTBALL_ODDS_SPORT_KEY_MAP_V1,
  FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  INTAKE_2026_08_25_OBSERVED_AT,
  MANUAL_REVIEW_2026_08_25_VERIFIED_AT,
  assertOddsTeamBridgeIntegrity,
  getOddsSportKey,
  getOddsTeamNames,
  joinScheduleRowToOddsEvent,
  oddsNameMatchesCanonical,
  parseFootballScheduleArtifact,
  planOddsFetches,
} from "../src/lib/football/odds-1x2-v1";
import type { FootballScheduleRowV1 } from "../src/lib/football/core";
import type { OddsData } from "../src/lib/odds/types";

const CMP_REL = "data/research/football/2026-08-16-1x2-market-comparison-v0.json";
const SCHED17_REL = "data/research/football/2026-08-17-schedule-v1.json";

function sha256File(rel: string): string {
  return createHash("sha256").update(readFileSync(path.join(process.cwd(), rel))).digest("hex");
}

function oddsEvent(over: {
  id: string;
  sportKey: string;
  home: string;
  away: string;
  commence: string;
}): OddsData {
  return {
    externalEventId: over.id,
    sportKey: over.sportKey,
    homeTeam: over.home,
    awayTeam: over.away,
    commenceTime: over.commence,
    bookmakers: [],
    bestHomeOdds: null,
    bestDrawOdds: null,
    bestAwayOdds: null,
    impliedHomeProbability: null,
    impliedDrawProbability: null,
    impliedAwayProbability: null,
    lastUpdated: "2026-08-16T14:27:47.964Z",
    source: "the-odds-api",
  };
}

function row(over: Partial<FootballScheduleRowV1> & Pick<
  FootballScheduleRowV1,
  "matchId" | "providerMatchId" | "competitionId" | "homeTeamId" | "awayTeamId" | "kickoffTimeUtc"
>): FootballScheduleRowV1 {
  return {
    dateKst: "2026-08-17",
    provider: "api-football",
    homeProviderTeamId: "0",
    awayProviderTeamId: "0",
    homeTeamName: "Home",
    awayTeamName: "Away",
    status: "SCHEDULED",
    venue: null,
    researchOnly: true,
    seasonId: "2026",
    competitionType: "LEAGUE",
    matchFormat: "LEAGUE_MATCH",
    identityStatus: "MATCHED",
    identityReasons: [],
    predictionEligibility: "ELIGIBLE_FORMAT",
    ...over,
  };
}

async function main() {
  assertTeamCatalogIntegrity(FOOTBALL_TEAM_CATALOG_V1);
  assertOddsTeamBridgeIntegrity(FOOTBALL_ODDS_TEAM_BRIDGE_V1);

  const canonicals = FOOTBALL_TEAM_CATALOG_V1.map((t) => t.canonicalTeamId);
  assert.equal(canonicals.length, new Set(canonicals).size);
  const providerIds = FOOTBALL_TEAM_CATALOG_V1.map((t) => t.providerTeamId);
  assert.equal(providerIds.length, new Set(providerIds).size);
  for (const id of ["540", "539", "4665", "533"]) {
    assert.equal(FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has(id), false);
  }

  assert.equal(
    getOddsSportKey("fb-comp-api-football-253")?.sportKey,
    "soccer_usa_mls",
  );
  assert.equal(
    getOddsSportKey("fb-comp-api-football-140")?.sportKey,
    "soccer_spain_la_liga",
  );
  assert.equal(getOddsSportKey("fb-comp-api-football-2"), null);
  assert.equal(
    FOOTBALL_ODDS_SPORT_KEY_MAP_V1.filter((e) => e.sportKey === "soccer_epl").length,
    1,
  );

  const mlsPairs: Array<{
    matchId: string;
    homeId: string;
    awayId: string;
    homeOdds: string;
    awayOdds: string;
    kickoff: string;
    eventId: string;
  }> = [
    {
      matchId: "soccer-api-football-1490389",
      homeId: "fb-team-v1-api-football-1607",
      awayId: "fb-team-v1-api-football-1617",
      homeOdds: "Chicago Fire",
      awayOdds: "Portland Timbers",
      kickoff: "2026-08-16T22:00:00.000Z",
      eventId: "af52fb96f1a5ea0fe7e11c6896158211",
    },
    {
      matchId: "soccer-api-football-1490388",
      homeId: "fb-team-v1-api-football-1604",
      awayId: "fb-team-v1-api-football-1599",
      homeOdds: "New York City FC",
      awayOdds: "Philadelphia Union",
      kickoff: "2026-08-16T22:00:00.000Z",
      eventId: "c3be3958beef3c35ea4a9dac6e028863",
    },
    {
      matchId: "soccer-api-football-1490383",
      homeId: "fb-team-v1-api-football-16489",
      awayId: "fb-team-v1-api-football-1597",
      homeOdds: "Austin FC",
      awayOdds: "FC Dallas",
      kickoff: "2026-08-17T00:30:00.000Z",
      eventId: "0198abf59a592bb8855ebf7430656607",
    },
    {
      matchId: "soccer-api-football-1490390",
      homeId: "fb-team-v1-api-football-1595",
      awayId: "fb-team-v1-api-football-1603",
      homeOdds: "Seattle Sounders FC",
      awayOdds: "Vancouver Whitecaps FC",
      kickoff: "2026-08-17T02:30:00.000Z",
      eventId: "235d6733ba040815d12859e40de81c1e",
    },
  ];

  for (const pair of mlsPairs) {
    assert.deepEqual(getOddsTeamNames(pair.homeId), [pair.homeOdds]);
    assert.deepEqual(getOddsTeamNames(pair.awayId), [pair.awayOdds]);
    const joined = joinScheduleRowToOddsEvent({
      row: row({
        matchId: pair.matchId,
        providerMatchId: pair.matchId.replace("soccer-api-football-", ""),
        competitionId: "fb-comp-api-football-253",
        homeTeamId: pair.homeId,
        awayTeamId: pair.awayId,
        kickoffTimeUtc: pair.kickoff,
      }),
      events: [
        oddsEvent({
          id: pair.eventId,
          sportKey: "soccer_usa_mls",
          home: pair.homeOdds,
          away: pair.awayOdds,
          commence: pair.kickoff.replace(".000Z", "Z"),
        }),
      ],
      teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
    });
    assert.equal(joined.status, "JOINED", pair.matchId);
    if (joined.status === "JOINED") {
      assert.equal(Math.abs(joined.kickoffDeltaMinutes) <= FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES, true);
    }
  }

  assert.equal(
    oddsNameMatchesCanonical("Seattle Sounders", "fb-team-v1-api-football-1595"),
    false,
  );
  assert.equal(
    oddsNameMatchesCanonical("Seattle Sounders F", "fb-team-v1-api-football-1595"),
    false,
  );
  assert.equal(
    oddsNameMatchesCanonical("Austin", "fb-team-v1-api-football-16489"),
    false,
  );

  assert.deepEqual(FOOTBALL_SLATE_2026_08_17_TEAMS, [
    ["540", "Espanyol"],
    ["539", "Levante"],
    ["4665", "Racing Santander"],
    ["533", "Villarreal"],
  ]);
  assert.deepEqual(FOOTBALL_SLATE_2026_08_18_TEAMS, [
    ["544", "Deportivo La Coruna"],
    ["797", "Elche"],
  ]);

  const laLiga = [
    { providerId: "540", name: "Espanyol", odds: "Espanyol" },
    { providerId: "539", name: "Levante", odds: "Levante" },
    { providerId: "4665", name: "Racing Santander", odds: "Real Racing Club de Santander" },
    { providerId: "533", name: "Villarreal", odds: "Villarreal" },
  ];
  for (const team of laLiga) {
    const resolved = resolveProviderTeam("api-football", team.providerId);
    assert.equal(resolved.status, "MATCHED", team.providerId);
    assert.equal(resolved.canonicalTeamId, `fb-team-v1-api-football-${team.providerId}`);
    const catalog = FOOTBALL_TEAM_CATALOG_V1.find(
      (t) => t.providerTeamId === team.providerId,
    );
    assert.ok(catalog);
    assert.equal(catalog!.canonicalName, team.name);
    assert.equal(catalog!.source, SCHED17_REL);
    assert.deepEqual(getOddsTeamNames(resolved.canonicalTeamId!), [team.odds]);
  }

  const racingJoin = joinScheduleRowToOddsEvent({
    row: row({
      matchId: "soccer-api-football-1570339",
      providerMatchId: "1570339",
      competitionId: "fb-comp-api-football-140",
      homeTeamId: "fb-team-v1-api-football-4665",
      awayTeamId: "fb-team-v1-api-football-533",
      kickoffTimeUtc: "2026-08-16T15:00:00.000Z",
    }),
    events: [
      oddsEvent({
        id: "f32c9c00fd77e4ec1abd5e34d67a6817",
        sportKey: "soccer_spain_la_liga",
        home: "Real Racing Club de Santander",
        away: "Villarreal",
        commence: "2026-08-16T15:00:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(racingJoin.status, "JOINED");

  const racingSlugRejected = joinScheduleRowToOddsEvent({
    row: row({
      matchId: "soccer-api-football-1570339",
      providerMatchId: "1570339",
      competitionId: "fb-comp-api-football-140",
      homeTeamId: "fb-team-v1-api-football-4665",
      awayTeamId: "fb-team-v1-api-football-533",
      kickoffTimeUtc: "2026-08-16T15:00:00.000Z",
    }),
    events: [
      oddsEvent({
        id: "fake-slug",
        sportKey: "soccer_spain_la_liga",
        home: "Racing Santander",
        away: "Villarreal",
        commence: "2026-08-16T15:00:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(racingSlugRejected.status, "NOT_JOINED");

  const deporElche = [
    {
      providerId: "544",
      catalogName: "Deportivo La Coruna",
      odds: "Deportivo La Coruña",
    },
    { providerId: "797", catalogName: "Elche", odds: "Elche CF" },
  ];
  for (const team of deporElche) {
    const resolved = resolveProviderTeam("api-football", team.providerId);
    assert.equal(resolved.status, "MATCHED", team.providerId);
    assert.equal(
      resolved.canonicalTeamId,
      `fb-team-v1-api-football-${team.providerId}`,
    );
    const catalog = FOOTBALL_TEAM_CATALOG_V1.find(
      (t) => t.providerTeamId === team.providerId,
    );
    assert.ok(catalog);
    assert.equal(catalog!.canonicalName, team.catalogName);
    assert.equal(
      catalog!.source,
      "data/research/football/2026-08-18-schedule-v1.json",
    );
    assert.deepEqual(getOddsTeamNames(resolved.canonicalTeamId!), [team.odds]);
  }

  const deporJoin = joinScheduleRowToOddsEvent({
    row: row({
      dateKst: "2026-08-18",
      matchId: "soccer-api-football-1570337",
      providerMatchId: "1570337",
      competitionId: "fb-comp-api-football-140",
      homeTeamId: "fb-team-v1-api-football-544",
      awayTeamId: "fb-team-v1-api-football-797",
      kickoffTimeUtc: "2026-08-17T19:00:00.000Z",
    }),
    events: [
      oddsEvent({
        id: "7b9f4d89d66c48e0c496aab1679e4ae4",
        sportKey: "soccer_spain_la_liga",
        home: "Deportivo La Coruña",
        away: "Elche CF",
        commence: "2026-08-17T19:00:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(deporJoin.status, "JOINED");

  const deporScheduleNameRejected = joinScheduleRowToOddsEvent({
    row: row({
      dateKst: "2026-08-18",
      matchId: "soccer-api-football-1570337",
      providerMatchId: "1570337",
      competitionId: "fb-comp-api-football-140",
      homeTeamId: "fb-team-v1-api-football-544",
      awayTeamId: "fb-team-v1-api-football-797",
      kickoffTimeUtc: "2026-08-17T19:00:00.000Z",
    }),
    events: [
      oddsEvent({
        id: "fake-schedule-name",
        sportKey: "soccer_spain_la_liga",
        home: "Deportivo La Coruna",
        away: "Elche",
        commence: "2026-08-17T19:00:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(deporScheduleNameRejected.status, "NOT_JOINED");

  const unknown = resolveProviderTeam("api-football", "999001");
  assert.equal(unknown.status, "IDENTITY_REVIEW_REQUIRED");
  assert.ok(unknown.reasons.includes("UNKNOWN_PROVIDER_TEAM_ID"));
  assert.equal(getOddsTeamNames("fb-team-v1-api-football-999001").length, 0);

  const j1 = FOOTBALL_ODDS_TEAM_BRIDGE_V1.filter((e) =>
    e.canonicalTeamId === "fb-team-v1-api-football-306" ||
    e.canonicalTeamId === "fb-team-v1-api-football-281",
  );
  assert.deepEqual(j1[0] && j1.find((e) => e.canonicalTeamId.endsWith("-306"))?.oddsTeamNames, [
    "Tokyo Verdy",
  ]);
  assert.deepEqual(
    getOddsTeamNames("fb-team-v1-api-football-281"),
    ["Kashiwa Reysol"],
  );

  const schedule17 = parseFootballScheduleArtifact(
    JSON.parse(readFileSync(SCHED17_REL, "utf8")),
  );
  const racingHist = schedule17.rows.find((r) => r.providerMatchId === "1570339");
  const espanyolHist = schedule17.rows.find((r) => r.providerMatchId === "1570338");
  assert.equal(racingHist?.identityStatus, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(espanyolHist?.identityStatus, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(racingHist?.homeTeamId, null);
  assert.equal(espanyolHist?.homeTeamId, null);

  const plan17 = planOddsFetches({
    schedule: schedule17,
    observedAt: "2026-08-16T14:21:33.737Z",
  });
  assert.equal(plan17.wouldCallProvider, true);
  assert.deepEqual(plan17.sportKeysToFetch, ["soccer_usa_mls"]);
  assert.equal(plan17.skipped.identityBlocked, 2);

  const INTAKE_REL =
    "data/research/football/2026-08-25-odds-bridge-candidate-intake-v1.json";
  const AUDIT_REL =
    "data/audits/2026-08-25-football-identity-bridge-review-v1.json";
  const ODDS_REL = "data/research/football/2026-08-25-1x2-odds-v1.json";
  const intake = JSON.parse(
    readFileSync(path.join(process.cwd(), INTAKE_REL), "utf8"),
  ) as {
    meta: { artifactHash: string; generatedAt: string; observedAt: string };
    rows: Array<{
      schedule: { providerMatchId: string };
      candidateStatus: string;
      candidateEvents: Array<{
        externalEventId: string;
        homeTeamExact: string;
        awayTeamExact: string;
      }>;
    }>;
  };
  assert.equal(
    intake.meta.artifactHash,
    "869ad8949c8f584a3528ec680d9e0bb343537e2f7bd85af214f1d80564da77c8",
  );
  assert.equal(intake.meta.observedAt, INTAKE_2026_08_25_OBSERVED_AT);
  const byMatch = new Map(
    intake.rows.map((r) => [r.schedule.providerMatchId, r] as const),
  );
  const roma = byMatch.get("1550087")!.candidateEvents[0]!;
  const bologna = byMatch.get("1550089")!.candidateEvents[0]!;
  const fulham = byMatch.get("1557376")!.candidateEvents[0]!;
  const malaga = byMatch.get("1570349")!.candidateEvents[0]!;
  const osasuna = byMatch.get("1570350")!.candidateEvents[0]!;
  const seoulRow = byMatch.get("1507042")!;
  assert.equal(seoulRow.candidateStatus, "AMBIGUOUS_EVENT_CANDIDATES");
  const seoul = seoulRow.candidateEvents.find(
    (e) => e.externalEventId === "d59c12d88d59e5a665b3fd8f626628d5",
  )!;
  assert.ok(seoul);
  assert.equal(roma.externalEventId, "4164b325d120b7310921429a21496210");
  assert.equal(bologna.externalEventId, "c23c70e25e6253ea30f33add6c73d299");
  assert.equal(fulham.externalEventId, "4e4a813bf4218cc527e6f8ef2351170d");
  assert.equal(malaga.externalEventId, "030285b126b6a2f7e022261006ed770e");
  assert.equal(osasuna.externalEventId, "b86f1854fe9f0915d4f9ee47f23a14bf");
  assert.equal(seoul.externalEventId, "d59c12d88d59e5a665b3fd8f626628d5");
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-497"), [
    roma.homeTeamExact,
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-502"), [
    roma.awayTeamExact,
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-500"), [
    bologna.homeTeamExact,
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-487"), [
    bologna.awayTeamExact,
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-36"), [
    fulham.homeTeamExact,
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-49"), [
    fulham.awayTeamExact,
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-535"), [
    malaga.homeTeamExact,
  ]);
  assert.equal(malaga.homeTeamExact, "Málaga");
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-727"), [
    osasuna.homeTeamExact,
  ]);
  assert.equal(osasuna.homeTeamExact, "CA Osasuna");
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-2766"), [
    seoul.homeTeamExact,
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-2745"), [
    seoul.awayTeamExact,
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-544"), [
    "Deportivo La Coruña",
  ]);
  assert.deepEqual(getOddsTeamNames("fb-team-v1-api-football-539"), ["Levante"]);
  assert.equal(malaga.awayTeamExact, "Deportivo La Coruña");
  assert.equal(osasuna.awayTeamExact, "Levante");

  const approvedCanonicals = [
    "fb-team-v1-api-football-497",
    "fb-team-v1-api-football-502",
    "fb-team-v1-api-football-500",
    "fb-team-v1-api-football-487",
    "fb-team-v1-api-football-36",
    "fb-team-v1-api-football-49",
    "fb-team-v1-api-football-535",
    "fb-team-v1-api-football-727",
    "fb-team-v1-api-football-2766",
    "fb-team-v1-api-football-2745",
  ] as const;
  for (const id of approvedCanonicals) {
    const entry = FOOTBALL_ODDS_TEAM_BRIDGE_V1.find(
      (e) => e.canonicalTeamId === id,
    );
    assert.ok(entry, id);
    assert.equal(entry!.verifiedAt, MANUAL_REVIEW_2026_08_25_VERIFIED_AT, id);
    assert.notEqual(entry!.verifiedAt, INTAKE_2026_08_25_OBSERVED_AT, id);
    assert.ok(entry!.source.includes(INTAKE_REL), id);
  }
  assert.equal(
    FOOTBALL_ODDS_TEAM_BRIDGE_V1.find(
      (e) => e.canonicalTeamId === "fb-team-v1-api-football-544",
    )?.verifiedAt,
    "2026-08-17T14:17:15.455Z",
  );
  assert.equal(
    FOOTBALL_ODDS_TEAM_BRIDGE_V1.find(
      (e) => e.canonicalTeamId === "fb-team-v1-api-football-539",
    )?.verifiedAt,
    "2026-08-16T14:27:47.334Z",
  );

  const forbiddenBridgeIds = [
    "fb-team-v1-api-football-2768",
    "fb-team-v1-api-football-2761",
    "fb-team-v1-api-football-2762",
    "fb-team-v1-api-football-2764",
  ] as const;
  for (const id of forbiddenBridgeIds) {
    assert.equal(
      FOOTBALL_ODDS_TEAM_BRIDGE_V1.some((e) => e.canonicalTeamId === id),
      false,
      id,
    );
    assert.equal(getOddsTeamNames(id).length, 0, id);
  }

  const malagaJoin = joinScheduleRowToOddsEvent({
    row: row({
      dateKst: "2026-08-25",
      matchId: "soccer-api-football-1570349",
      providerMatchId: "1570349",
      competitionId: "fb-comp-api-football-140",
      homeTeamId: "fb-team-v1-api-football-535",
      awayTeamId: "fb-team-v1-api-football-544",
      kickoffTimeUtc: "2026-08-24T19:30:00.000Z",
    }),
    events: [
      oddsEvent({
        id: malaga.externalEventId,
        sportKey: "soccer_spain_la_liga",
        home: malaga.homeTeamExact,
        away: malaga.awayTeamExact,
        commence: "2026-08-24T19:30:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(malagaJoin.status, "JOINED");

  const malagaScheduleNameRejected = joinScheduleRowToOddsEvent({
    row: row({
      dateKst: "2026-08-25",
      matchId: "soccer-api-football-1570349",
      providerMatchId: "1570349",
      competitionId: "fb-comp-api-football-140",
      homeTeamId: "fb-team-v1-api-football-535",
      awayTeamId: "fb-team-v1-api-football-544",
      kickoffTimeUtc: "2026-08-24T19:30:00.000Z",
    }),
    events: [
      oddsEvent({
        id: "fake-malaga-schedule-name",
        sportKey: "soccer_spain_la_liga",
        home: "Malaga",
        away: "Deportivo La Coruña",
        commence: "2026-08-24T19:30:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(malagaScheduleNameRejected.status, "NOT_JOINED");

  const osasunaJoin = joinScheduleRowToOddsEvent({
    row: row({
      dateKst: "2026-08-25",
      matchId: "soccer-api-football-1570350",
      providerMatchId: "1570350",
      competitionId: "fb-comp-api-football-140",
      homeTeamId: "fb-team-v1-api-football-727",
      awayTeamId: "fb-team-v1-api-football-539",
      kickoffTimeUtc: "2026-08-24T17:30:00.000Z",
    }),
    events: [
      oddsEvent({
        id: osasuna.externalEventId,
        sportKey: "soccer_spain_la_liga",
        home: osasuna.homeTeamExact,
        away: osasuna.awayTeamExact,
        commence: "2026-08-24T17:30:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(osasunaJoin.status, "JOINED");

  const seoulJoin = joinScheduleRowToOddsEvent({
    row: row({
      dateKst: "2026-08-25",
      matchId: "soccer-api-football-1507042",
      providerMatchId: "1507042",
      competitionId: "fb-comp-api-football-292",
      homeTeamId: "fb-team-v1-api-football-2766",
      awayTeamId: "fb-team-v1-api-football-2745",
      kickoffTimeUtc: "2026-08-25T10:30:00.000Z",
    }),
    events: [
      oddsEvent({
        id: seoul.externalEventId,
        sportKey: "soccer_korea_kleague1",
        home: seoul.homeTeamExact,
        away: seoul.awayTeamExact,
        commence: "2026-08-25T10:30:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(seoulJoin.status, "JOINED");

  const gimcheonRejected = joinScheduleRowToOddsEvent({
    row: row({
      dateKst: "2026-08-25",
      matchId: "soccer-api-football-1507040",
      providerMatchId: "1507040",
      competitionId: "fb-comp-api-football-292",
      homeTeamId: "fb-team-v1-api-football-2768",
      awayTeamId: "fb-team-v1-api-football-2762",
      kickoffTimeUtc: "2026-08-25T10:30:00.000Z",
    }),
    events: [
      oddsEvent({
        id: "9d3d2d6e8c36c82f72a287bf11d93c63",
        sportKey: "soccer_korea_kleague1",
        home: "Sangju Sangmu FC",
        away: "Jeonbuk Hyundai Motors",
        commence: "2026-08-25T10:30:00Z",
      }),
    ],
    teamBridge: FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  });
  assert.equal(gimcheonRejected.status, "ODDS_EVENT_IDENTITY_REVIEW_REQUIRED");

  const canonicals25 = FOOTBALL_ODDS_TEAM_BRIDGE_V1.map((e) => e.canonicalTeamId);
  assert.equal(canonicals25.length, new Set(canonicals25).size);
  const names25 = FOOTBALL_ODDS_TEAM_BRIDGE_V1.flatMap((e) => e.oddsTeamNames);
  assert.equal(names25.length, new Set(names25).size);
  assert.equal(
    FOOTBALL_ODDS_TEAM_BRIDGE_V1.filter(
      (e) => e.canonicalTeamId === "fb-team-v1-api-football-544",
    ).length,
    1,
  );
  assert.equal(
    FOOTBALL_ODDS_TEAM_BRIDGE_V1.filter(
      (e) => e.canonicalTeamId === "fb-team-v1-api-football-539",
    ).length,
    1,
  );

  const audit = JSON.parse(
    readFileSync(path.join(process.cwd(), AUDIT_REL), "utf8"),
  ) as {
    candidateObservedAt: string;
    manualReviewedAt: string;
    manualReviewedAtPrecision: string;
    reviewMethod: string;
    predictionInput: boolean;
    engineAdmission: string;
    independentModelSample: number;
    oddsPriceCollectionPerformed: boolean;
    fcSeoulBucheon: {
      promotionClass: string;
      autoApproveForbidden: boolean;
      candidateStatusAtIntake: string;
      evidenceEventId: string;
    };
    sourceArtifacts: {
      originalBlockedStateOdds: { artifactHash: string };
    };
  };
  assert.equal(audit.candidateObservedAt, INTAKE_2026_08_25_OBSERVED_AT);
  assert.equal(audit.manualReviewedAt, MANUAL_REVIEW_2026_08_25_VERIFIED_AT);
  assert.notEqual(audit.candidateObservedAt, audit.manualReviewedAt);
  assert.equal(audit.manualReviewedAtPrecision, "MINUTE");
  assert.equal(audit.reviewMethod, "MANUAL_EVENT_IDENTITY_REVIEW");
  assert.equal(audit.predictionInput, false);
  assert.equal(audit.engineAdmission, "PROHIBITED");
  assert.equal(audit.independentModelSample, 0);
  assert.equal(audit.oddsPriceCollectionPerformed, false);
  assert.equal(audit.fcSeoulBucheon.promotionClass, "MANUAL_EVENT_IDENTITY_REVIEW");
  assert.equal(audit.fcSeoulBucheon.autoApproveForbidden, true);
  assert.equal(
    audit.fcSeoulBucheon.candidateStatusAtIntake,
    "AMBIGUOUS_EVENT_CANDIDATES",
  );
  assert.equal(
    audit.fcSeoulBucheon.evidenceEventId,
    "d59c12d88d59e5a665b3fd8f626628d5",
  );
  assert.equal(
    audit.sourceArtifacts.originalBlockedStateOdds.artifactHash,
    "617e29e4fbe397f0db73fe586bd452fa314153b7e699d60aeeb50f05d554d68f",
  );
  const firstOdds = JSON.parse(
    readFileSync(path.join(process.cwd(), ODDS_REL), "utf8"),
  ) as { meta: { artifactHash: string; scheduleEligibleGames: number; providerCalled: boolean } };
  assert.equal(
    firstOdds.meta.artifactHash,
    "617e29e4fbe397f0db73fe586bd452fa314153b7e699d60aeeb50f05d554d68f",
  );
  assert.equal(firstOdds.meta.scheduleEligibleGames, 0);
  assert.equal(firstOdds.meta.providerCalled, false);

  const cmpHashBefore = sha256File(CMP_REL);
  const schedHashBefore = sha256File(SCHED17_REL);
  assert.equal(sha256File(CMP_REL), cmpHashBefore);
  assert.equal(sha256File(SCHED17_REL), schedHashBefore);

  console.log("FOOTBALL_ODDS_IDENTITY_GRADUATION_V1_OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
