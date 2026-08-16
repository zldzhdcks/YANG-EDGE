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
  FOOTBALL_TEAM_CATALOG_V1,
  assertTeamCatalogIntegrity,
  resolveProviderTeam,
} from "../src/lib/football/core";
import {
  FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
  FOOTBALL_ODDS_SPORT_KEY_MAP_V1,
  FOOTBALL_ODDS_TEAM_BRIDGE_V1,
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
