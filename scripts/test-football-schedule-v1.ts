/**
 * Football Schedule + Identity Dataset v1 tests.
 * Run: npm run test:football-schedule-v1
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { GAMES } from "../src/constants/games";
import {
  assembleFootballScheduleArtifact,
  assertTeamCatalogIntegrity,
  buildFootballScheduleV1,
  canonicalizeKickoffTimeUtc,
  FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS,
  FOOTBALL_IDENTITY_SCOPE_V1,
  FOOTBALL_SLATE_2026_08_12_TEAMS,
  FOOTBALL_SLATE_2026_08_14_TEAMS,
  FOOTBALL_TEAM_CATALOG_V1,
  FOOTBALL_TEAM_CONFLICTS_V1,
  getMatchedTeam,
  isCanonicalUtcIso,
  rejoinFootballScheduleArtifact,
  resolveMatchFormat,
  resolvePredictionEligibility,
  resolveProviderTeam,
  type FootballScheduleArtifactV1,
  type FootballTeamCatalogEntry,
} from "../src/lib/football/core";
import {
  getCompetitionProfileByProviderId,
  listCompetitionProfiles,
} from "../src/lib/football/competition";
import type { FixtureRaw } from "../src/lib/football/types";
import { sampleFixtureForMapperTest } from "../src/lib/football/dummy-football-provider";

function fixture(over: {
  id: number;
  leagueId: number;
  season: number;
  homeId: number;
  awayId: number;
  homeName?: string;
  awayName?: string;
  round?: string;
  status?: string;
  date?: string;
}): FixtureRaw {
  return {
    fixture: {
      id: over.id,
      date: over.date ?? "2026-08-15T14:00:00+00:00",
      status: { short: over.status ?? "NS", long: "Not Started", elapsed: null },
      venue: { name: "Test Venue", city: "Test City" },
    },
    league: {
      id: over.leagueId,
      name: "Test",
      season: over.season,
      round: over.round ?? "Regular Season - 1",
    },
    teams: {
      home: { id: over.homeId, name: over.homeName ?? "Home", winner: null },
      away: { id: over.awayId, name: over.awayName ?? "Away", winner: null },
    },
    goals: { home: null, away: null },
  };
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

function assertNoEngineImports(filePath: string) {
  const src = readFileSync(filePath, "utf8");
  assert.equal(src.includes("src/lib/") && src.includes("prediction-v0/"), false, filePath);
  assert.equal(/from ["'][^"']*prediction-v0/.test(src), false, filePath);
  assert.equal(/from ["'][^"']*compute-moneyline/.test(src), false, filePath);
  assert.equal(/from ["'][^"']*load-and-predict/.test(src), false, filePath);
}

async function main() {
  const eplMatched = fixture({
    id: 111,
    leagueId: 39,
    season: 2026,
    homeId: 42,
    awayId: 40,
    homeName: "Arsenal",
    awayName: "Liverpool",
  });

  const a = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [eplMatched],
  });
  const b = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 111,
        leagueId: 39,
        season: 2026,
        homeId: 42,
        awayId: 40,
        homeName: "The Arsenal",
        awayName: "Liverpool FC",
      }),
    ],
  });
  assert.equal(a.document.rows[0]!.matchId, "soccer-api-football-111");
  assert.equal(a.document.rows[0]!.matchId, b.document.rows[0]!.matchId);
  assert.equal(a.document.rows[0]!.homeTeamId, b.document.rows[0]!.homeTeamId);
  assert.equal(a.document.rows[0]!.awayTeamId, b.document.rows[0]!.awayTeamId);
  assert.equal(a.document.rows[0]!.homeProviderTeamId, "42");
  assert.equal(a.document.rows[0]!.awayProviderTeamId, "40");
  assert.notEqual(a.document.rows[0]!.homeTeamName, b.document.rows[0]!.homeTeamName);

  assert.throws(
    () =>
      assembleFootballScheduleArtifact({
        dateKst: "2026-08-15",
        generatedAt: "2026-08-13T00:00:00.000Z",
        fixtures: [eplMatched, { ...eplMatched }],
      }),
    /DUPLICATE_PROVIDER_MATCH_ID/,
  );

  const unknownTeam = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 222,
        leagueId: 39,
        season: 2026,
        homeId: 42,
        awayId: 999001,
      }),
    ],
  });
  assert.equal(unknownTeam.document.rows[0]!.identityStatus, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(
    unknownTeam.document.rows[0]!.predictionEligibility,
    "IDENTITY_BLOCKED",
  );
  assert.equal(unknownTeam.document.rows[0]!.awayTeamId, null);
  assert.ok(
    unknownTeam.document.rows[0]!.identityReasons.includes("UNKNOWN_PROVIDER_TEAM_ID"),
  );

  const epl = getCompetitionProfileByProviderId("api-football", "39");
  assert.ok(epl);
  assert.equal(epl!.canonicalName, "Premier League");
  assert.equal(epl!.competitionType, "LEAGUE");
  const mls = getCompetitionProfileByProviderId("api-football", "253");
  assert.ok(mls);
  assert.equal(mls!.canonicalName, "Major League Soccer");
  assert.equal(listCompetitionProfiles().length, 10);
  assert.equal(
    listCompetitionProfiles().every((p) => p.seasonIdAuthoritative === "FIXTURE"),
    true,
  );

  assert.equal(a.document.rows[0]!.seasonId, "2026");
  assert.notEqual(a.document.rows[0]!.seasonId, "2025");
  assert.equal(
    listCompetitionProfiles().some((p) => p.competitionId.includes("2025")),
    false,
  );

  assert.equal(a.document.rows[0]!.matchFormat, "LEAGUE_MATCH");
  assert.equal(a.document.rows[0]!.predictionEligibility, "ELIGIBLE_FORMAT");
  assert.equal(resolveMatchFormat(epl!), "LEAGUE_MATCH");

  const ucl = getCompetitionProfileByProviderId("api-football", "2")!;
  assert.equal(resolveMatchFormat(ucl), "UNKNOWN");
  const uclDoc = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 333,
        leagueId: 2,
        season: 2026,
        homeId: 42,
        awayId: 40,
      }),
    ],
  });
  assert.equal(uclDoc.document.rows[0]!.matchFormat, "UNKNOWN");
  assert.equal(
    uclDoc.document.rows[0]!.predictionEligibility,
    "NOT_SUPPORTED_FORMAT",
  );
  assert.equal(
    resolvePredictionEligibility({
      identityOk: true,
      matchFormat: "KNOCKOUT",
      profile: {
        researchStatus: "RESEARCH_ONLY",
        predictionEligibility: "ELIGIBLE_FORMAT",
      },
    }),
    "NOT_SUPPORTED_FORMAT",
  );
  assert.equal(
    resolvePredictionEligibility({
      identityOk: true,
      matchFormat: "UNKNOWN",
      profile: {
        researchStatus: "RESEARCH_ONLY",
        predictionEligibility: "ELIGIBLE_FORMAT",
      },
    }),
    "NOT_SUPPORTED_FORMAT",
  );
  assert.equal(
    resolvePredictionEligibility({
      identityOk: true,
      matchFormat: "LEAGUE_MATCH",
      profile: {
        researchStatus: "DISABLED",
        predictionEligibility: "ELIGIBLE_FORMAT",
      },
    }),
    "COMPETITION_BLOCKED",
  );
  assert.notEqual(
    resolvePredictionEligibility({
      identityOk: true,
      matchFormat: "LEAGUE_MATCH",
      profile: {
        researchStatus: "DISABLED",
        predictionEligibility: "ELIGIBLE_FORMAT",
      },
    }),
    "ELIGIBLE_FORMAT",
  );
  assert.equal(
    resolvePredictionEligibility({
      identityOk: true,
      matchFormat: "LEAGUE_MATCH",
      profile: {
        researchStatus: "RESEARCH_ONLY",
        predictionEligibility: "NOT_SUPPORTED_FORMAT",
      },
    }),
    "NOT_SUPPORTED_FORMAT",
  );
  assert.notEqual(
    resolvePredictionEligibility({
      identityOk: true,
      matchFormat: "LEAGUE_MATCH",
      profile: {
        researchStatus: "RESEARCH_ONLY",
        predictionEligibility: "NOT_SUPPORTED_FORMAT",
      },
    }),
    "ELIGIBLE_FORMAT",
  );

  const hashA = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [eplMatched],
  });
  const hashB = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2099-01-01T00:00:00.000Z",
    fixtures: [eplMatched],
  });
  assert.notEqual(hashA.document.meta.generatedAt, hashB.document.meta.generatedAt);
  assert.equal(hashA.document.meta.artifactHash, hashB.document.meta.artifactHash);
  assert.equal(a.document.rows[0]!.kickoffTimeUtc, "2026-08-15T14:00:00.000Z");
  assert.equal(isCanonicalUtcIso(a.document.rows[0]!.kickoffTimeUtc!), true);

  const plusNine = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 111,
        leagueId: 39,
        season: 2026,
        homeId: 42,
        awayId: 40,
        date: "2026-08-15T23:00:00+09:00",
      }),
    ],
  });
  assert.equal(plusNine.document.rows[0]!.kickoffTimeUtc, "2026-08-15T14:00:00.000Z");
  const plusTwo = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 111,
        leagueId: 39,
        season: 2026,
        homeId: 42,
        awayId: 40,
        date: "2026-08-15T16:00:00+02:00",
      }),
    ],
  });
  assert.equal(
    plusNine.document.rows[0]!.kickoffTimeUtc,
    plusTwo.document.rows[0]!.kickoffTimeUtc,
  );
  assert.equal(plusNine.document.meta.artifactHash, plusTwo.document.meta.artifactHash);
  assert.equal(
    canonicalizeKickoffTimeUtc("2026-08-14T19:00:00+09:00"),
    "2026-08-14T10:00:00.000Z",
  );

  assert.throws(
    () =>
      assembleFootballScheduleArtifact({
        dateKst: "2026-08-15",
        generatedAt: "2026-08-13T00:00:00.000Z",
        fixtures: [
          fixture({
            id: 666,
            leagueId: 39,
            season: 2026,
            homeId: 42,
            awayId: 40,
            date: "not-a-kickoff",
          }),
        ],
      }),
    /FIXTURE_KICKOFF_INVALID/,
  );
  assert.throws(
    () =>
      assembleFootballScheduleArtifact({
        dateKst: "2026-08-16",
        generatedAt: "2026-08-13T00:00:00.000Z",
        fixtures: [
          fixture({
            id: 667,
            leagueId: 39,
            season: 2026,
            homeId: 42,
            awayId: 40,
            date: "2026-08-15T14:00:00+00:00",
          }),
        ],
      }),
    /FIXTURE_DATE_KST_MISMATCH/,
  );

  const missingKickoff = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 668,
        leagueId: 39,
        season: 2026,
        homeId: 42,
        awayId: 40,
        date: "",
      }),
    ],
  });
  assert.equal(missingKickoff.document.rows[0]!.kickoffTimeUtc, null);
  assert.equal(missingKickoff.document.rows[0]!.identityStatus, "IDENTITY_REVIEW_REQUIRED");
  assert.ok(
    missingKickoff.document.rows[0]!.identityReasons.includes("KICKOFF_MISSING"),
  );
  assert.equal(
    missingKickoff.document.rows[0]!.predictionEligibility,
    "IDENTITY_BLOCKED",
  );

  assert.equal(getMatchedTeam("api-football", "1614")?.country, "Canada");
  assert.equal(getMatchedTeam("api-football", "1601")?.country, "Canada");
  assert.equal(getMatchedTeam("api-football", "1603")?.country, "Canada");
  assert.equal(getMatchedTeam("api-football", "1614")?.canonicalTeamId, "fb-team-v1-api-football-1614");
  assert.equal(getMatchedTeam("api-football", "1601")?.providerTeamId, "1601");
  assert.equal(getMatchedTeam("api-football", "1603")?.providerTeamId, "1603");

  assert.throws(
    () =>
      assembleFootballScheduleArtifact({
        dateKst: "2026-08-15",
        generatedAt: "2026-08-13T00:00:00.000Z",
        fixtures: GAMES.filter((g) => g.sport === "football") as never,
      }),
    /DUMMY_PRODUCT_GAMES_NOT_RESEARCH/,
  );
  await assert.rejects(
    () =>
      buildFootballScheduleV1({
        dateKst: "2026-08-15",
        fixtures: [eplMatched],
        source: "dummy",
        dryRun: true,
      }),
    /DUMMY_PROVIDER_NOT_RESEARCH/,
  );

  const mapperSample = sampleFixtureForMapperTest().raw as FixtureRaw;
  const fromMapper = assembleFootballScheduleArtifact({
    dateKst: "2026-07-25",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [mapperSample],
  });
  assert.equal(fromMapper.document.rows[0]!.seasonId, "2025");
  assert.equal(fromMapper.document.rows[0]!.homeTeamId, "fb-team-v1-api-football-42");

  assert.equal(resolveProviderTeam("api-football", "276").status, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(resolveProviderTeam("api-football", "2769").status, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(resolveProviderTeam("api-football", "275").status, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(resolveProviderTeam("api-football", "2764").status, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(getMatchedTeam("api-football", "276"), null);
  assert.equal(FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has("2769"), true);
  assert.equal(FOOTBALL_TEAM_CONFLICTS_V1.length, 2);

  const kConflict = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 444,
        leagueId: 292,
        season: 2026,
        homeId: 2769,
        awayId: 2766,
      }),
    ],
  });
  assert.equal(kConflict.document.rows[0]!.identityStatus, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(kConflict.document.rows[0]!.predictionEligibility, "IDENTITY_BLOCKED");
  assert.equal(kConflict.document.rows[0]!.homeTeamId, null);
  assert.equal(
    kConflict.document.rows[0]!.awayTeamId,
    "fb-team-v1-api-football-2766",
  );

  const unregistered = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 555,
        leagueId: 88,
        season: 2026,
        homeId: 42,
        awayId: 40,
      }),
    ],
  });
  assert.equal(unregistered.document.meta.scheduleGames, 0);
  assert.equal(unregistered.document.meta.droppedUnregisteredCompetition, 1);

  const tmp = mkdtempSync(path.join(tmpdir(), "fb-sched-v1-"));
  try {
    const result = await buildFootballScheduleV1({
      dateKst: "2026-08-15",
      cwd: tmp,
      dryRun: false,
      generatedAt: "2026-08-13T00:00:00.000Z",
      fixtures: [eplMatched],
      source: "api-football",
    });
    assert.equal(result.wrote, true);
    assert.equal(
      result.outRel,
      "data/research/football/2026-08-15-schedule-v1.json",
    );
    const files = readTree(tmp);
    assert.deepEqual(files, [
      "data/research/football/2026-08-15-schedule-v1.json",
    ]);
    const raw = readFileSync(path.join(tmp, result.outRel), "utf8");
    const parsed = JSON.parse(raw) as { meta: { artifactHash: string } };
    assert.equal(parsed.meta.artifactHash, result.document.meta.artifactHash);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const slateIds = [
    ...FOOTBALL_SLATE_2026_08_12_TEAMS,
    ...FOOTBALL_SLATE_2026_08_14_TEAMS,
  ];
  assert.equal(slateIds.length, 48);
  assert.equal(new Set(slateIds.map(([id]) => id)).size, 48);
  for (const [id] of slateIds) {
    const hit = resolveProviderTeam("api-football", id);
    assert.equal(hit.status, "MATCHED", `slate ${id}`);
    assert.equal(hit.canonicalTeamId, `fb-team-v1-api-football-${id}`);
  }
  assert.equal(
    FOOTBALL_TEAM_CATALOG_V1.every(
      (t) => t.identityScope === FOOTBALL_IDENTITY_SCOPE_V1,
    ),
    true,
  );
  assert.equal(
    FOOTBALL_TEAM_CATALOG_V1.every(
      (t) => t.providers.apiFootball.teamId === t.providerTeamId,
    ),
    true,
  );
  assert.equal(FOOTBALL_IDENTITY_SCOPE_V1, "PROVIDER_SEEDED_V1");

  const uclSlate = assembleFootballScheduleArtifact({
    dateKst: "2026-08-12",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 1598827,
        leagueId: 2,
        season: 2026,
        homeId: 327,
        awayId: 1393,
        homeName: "Bodo/Glimt",
        awayName: "Union St. Gilloise",
        date: "2026-08-12T01:00:00+09:00",
      }),
    ],
  });
  assert.equal(uclSlate.document.rows[0]!.identityStatus, "MATCHED");
  assert.equal(uclSlate.document.rows[0]!.matchFormat, "UNKNOWN");
  assert.equal(
    uclSlate.document.rows[0]!.predictionEligibility,
    "NOT_SUPPORTED_FORMAT",
  );
  assert.equal(
    uclSlate.document.rows[0]!.homeTeamId,
    "fb-team-v1-api-football-327",
  );

  const j1Slate = assembleFootballScheduleArtifact({
    dateKst: "2026-08-14",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 1556021,
        leagueId: 98,
        season: 2027,
        homeId: 306,
        awayId: 281,
        homeName: "Tokyo Verdy",
        awayName: "Kashiwa Reysol",
        date: "2026-08-14T19:00:00+09:00",
      }),
    ],
  });
  assert.equal(j1Slate.document.rows[0]!.seasonId, "2027");
  assert.equal(j1Slate.document.rows[0]!.identityStatus, "MATCHED");
  assert.equal(j1Slate.document.rows[0]!.matchFormat, "LEAGUE_MATCH");
  assert.equal(
    j1Slate.document.rows[0]!.predictionEligibility,
    "ELIGIBLE_FORMAT",
  );

  const uelSameTeam = assembleFootballScheduleArtifact({
    dateKst: "2026-08-14",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 1607570,
        leagueId: 3,
        season: 2026,
        homeId: 254,
        awayId: 211,
        date: "2026-08-14T03:45:00+09:00",
      }),
    ],
  });
  const uclSameTeam = assembleFootballScheduleArtifact({
    dateKst: "2026-08-15",
    generatedAt: "2026-08-13T00:00:00.000Z",
    fixtures: [
      fixture({
        id: 888001,
        leagueId: 2,
        season: 2026,
        homeId: 254,
        awayId: 211,
      }),
    ],
  });
  assert.equal(
    uelSameTeam.document.rows[0]!.awayTeamId,
    uclSameTeam.document.rows[0]!.awayTeamId,
  );
  assert.equal(
    uelSameTeam.document.rows[0]!.awayTeamId,
    "fb-team-v1-api-football-211",
  );
  assert.equal(
    uclSameTeam.document.rows[0]!.predictionEligibility,
    "NOT_SUPPORTED_FORMAT",
  );

  assert.equal(
    resolveProviderTeam("api-football", "Man United").status,
    "IDENTITY_REVIEW_REQUIRED",
  );
  assert.equal(getMatchedTeam("api-football", "Liverpool FC"), null);
  const manUtdByAlias = FOOTBALL_TEAM_CATALOG_V1.find((t) =>
    t.aliases.includes("Man United"),
  );
  assert.ok(manUtdByAlias);
  assert.equal(manUtdByAlias!.providerTeamId, "33");
  assert.equal(
    resolveProviderTeam("api-football", "33").canonicalTeamId,
    manUtdByAlias!.canonicalTeamId,
  );

  assert.equal(getMatchedTeam("the-odds-api", "42"), null);
  assert.equal(
    resolveProviderTeam("the-odds-api", "42").status,
    "IDENTITY_REVIEW_REQUIRED",
  );
  assert.ok(
    resolveProviderTeam("the-odds-api", "42").reasons.includes(
      "UNKNOWN_PROVIDER_TEAM_ID",
    ),
  );

  const seed: FootballTeamCatalogEntry = {
    canonicalTeamId: "fb-team-v1-api-football-33",
    canonicalName: "Manchester United",
    country: "England",
    active: true,
    identityScope: "PROVIDER_SEEDED_V1",
    identityStatus: "MATCHED",
    provider: "api-football",
    providerTeamId: "33",
    providers: { apiFootball: { teamId: "33" } },
    aliases: [],
    source: "test",
  };
  assert.throws(
    () =>
      assertTeamCatalogIntegrity([
        seed,
        {
          ...seed,
          canonicalTeamId: "fb-team-other",
        },
      ]),
    /PROVIDER_TEAM_ID_COLLISION/,
  );
  assert.throws(
    () =>
      assertTeamCatalogIntegrity([
        seed,
        {
          ...seed,
          canonicalTeamId: "fb-team-v1-api-football-33",
          providerTeamId: "40",
          providers: { apiFootball: { teamId: "40" } },
        },
      ]),
    /CANONICAL_TEAM_PROVIDER_CONFLICT/,
  );
  assert.throws(
    () =>
      assertTeamCatalogIntegrity([
        {
          ...seed,
          canonicalTeamId: "fb-team-v1-api-football-276",
          providerTeamId: "276",
          providers: { apiFootball: { teamId: "276" } },
        },
      ]),
    /PROVIDER_TEAM_ID_COLLISION/,
  );
  assert.equal(resolveProviderTeam("api-football", "276").status, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(resolveProviderTeam("api-football", "2769").status, "IDENTITY_REVIEW_REQUIRED");

  const blockedClone: FootballScheduleArtifactV1 = {
    ...uclSlate.document,
    rows: uclSlate.document.rows.map((r) => ({
      ...r,
      homeTeamId: null,
      awayTeamId: null,
      identityStatus: "IDENTITY_REVIEW_REQUIRED",
      identityReasons: ["UNKNOWN_PROVIDER_TEAM_ID"],
      predictionEligibility: "IDENTITY_BLOCKED",
    })),
  };
  const rejoined = rejoinFootballScheduleArtifact({
    existing: blockedClone,
    generatedAt: "2026-08-13T12:00:00.000Z",
  });
  assert.equal(rejoined.rows.length, blockedClone.rows.length);
  assert.equal(rejoined.rows[0]!.matchId, blockedClone.rows[0]!.matchId);
  assert.equal(rejoined.rows[0]!.identityStatus, "MATCHED");
  assert.equal(rejoined.rows[0]!.matchFormat, "UNKNOWN");
  assert.equal(rejoined.rows[0]!.predictionEligibility, "NOT_SUPPORTED_FORMAT");
  assert.equal(rejoined.meta.droppedUnregisteredCompetition, blockedClone.meta.droppedUnregisteredCompetition);

  const stillUnknown = rejoinFootballScheduleArtifact({
    existing: unknownTeam.document,
    generatedAt: "2026-08-13T12:00:00.000Z",
  });
  assert.equal(stillUnknown.rows[0]!.identityStatus, "IDENTITY_REVIEW_REQUIRED");
  assert.equal(stillUnknown.rows[0]!.predictionEligibility, "IDENTITY_BLOCKED");
  assert.equal(stillUnknown.rows[0]!.awayTeamId, null);

  const MATCH_IDS_08_12 = [
    "soccer-api-football-1598827",
    "soccer-api-football-1598828",
    "soccer-api-football-1598829",
    "soccer-api-football-1605371",
    "soccer-api-football-1607169",
    "soccer-api-football-1607170",
    "soccer-api-football-1607171",
    "soccer-api-football-1607172",
    "soccer-api-football-1607173",
    "soccer-api-football-1607174",
    "soccer-api-football-1607180",
  ];
  const MATCH_IDS_08_14 = [
    "soccer-api-football-1556021",
    "soccer-api-football-1598831",
    "soccer-api-football-1606353",
    "soccer-api-football-1607181",
    "soccer-api-football-1607182",
    "soccer-api-football-1607183",
    "soccer-api-football-1607184",
    "soccer-api-football-1607566",
    "soccer-api-football-1607567",
    "soccer-api-football-1607568",
    "soccer-api-football-1607569",
    "soccer-api-football-1607570",
    "soccer-api-football-1607571",
  ];
  const live12 = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "data/research/football/2026-08-12-schedule-v1.json"),
      "utf8",
    ),
  ) as FootballScheduleArtifactV1;
  const live14 = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "data/research/football/2026-08-14-schedule-v1.json"),
      "utf8",
    ),
  ) as FootballScheduleArtifactV1;
  assert.deepEqual(
    live12.rows.map((r) => r.matchId),
    MATCH_IDS_08_12,
  );
  assert.deepEqual(
    live14.rows.map((r) => r.matchId),
    MATCH_IDS_08_14,
  );
  assert.equal(live12.meta.scheduleGames, 11);
  assert.equal(live12.meta.identityMatched, 11);
  assert.equal(live12.meta.identityBlocked, 0);
  assert.equal(live12.meta.formatEligible, 0);
  assert.equal(live12.meta.formatNotSupported, 11);
  assert.equal(live14.meta.scheduleGames, 13);
  assert.equal(live14.meta.identityMatched, 13);
  assert.equal(live14.meta.identityBlocked, 0);
  assert.equal(live14.meta.formatEligible, 1);
  assert.equal(live14.meta.formatNotSupported, 12);
  assert.equal(
    live14.rows.find((r) => r.competitionId === "fb-comp-api-football-98")
      ?.predictionEligibility,
    "ELIGIBLE_FORMAT",
  );
  assert.equal(
    live14.rows.find((r) => r.competitionId === "fb-comp-api-football-98")
      ?.seasonId,
    "2027",
  );
  assert.equal(
    live12.rows.every((r) => r.predictionEligibility === "NOT_SUPPORTED_FORMAT"),
    true,
  );
  assert.equal(
    live12.rows.every(
      (r) => r.kickoffTimeUtc != null && isCanonicalUtcIso(r.kickoffTimeUtc),
    ),
    true,
  );
  assert.equal(
    live14.rows.every(
      (r) => r.kickoffTimeUtc != null && isCanonicalUtcIso(r.kickoffTimeUtc),
    ),
    true,
  );
  const re12 = rejoinFootballScheduleArtifact({
    existing: live12,
    generatedAt: "2026-08-13T12:00:00.000Z",
  });
  const re14 = rejoinFootballScheduleArtifact({
    existing: live14,
    generatedAt: "2026-08-13T12:00:00.000Z",
  });
  assert.deepEqual(
    re12.rows.map((r) => r.matchId),
    live12.rows.map((r) => r.matchId),
  );
  assert.deepEqual(
    re14.rows.map((r) => r.matchId),
    live14.rows.map((r) => r.matchId),
  );
  assert.equal(
    re12.rows.every(
      (r) => r.kickoffTimeUtc != null && isCanonicalUtcIso(r.kickoffTimeUtc),
    ),
    true,
  );
  assert.equal(
    re14.rows.every(
      (r) => r.kickoffTimeUtc != null && isCanonicalUtcIso(r.kickoffTimeUtc),
    ),
    true,
  );
  assert.equal(re12.meta.identityMatched, 11);
  assert.equal(re12.meta.formatEligible, 0);
  assert.equal(re12.meta.formatNotSupported, 11);
  assert.equal(re14.meta.identityMatched, 13);
  assert.equal(re14.meta.formatEligible, 1);
  assert.equal(re14.meta.formatNotSupported, 12);
  assert.equal(re12.meta.artifactHash, rejoinFootballScheduleArtifact({
    existing: live12,
    generatedAt: "2099-01-01T00:00:00.000Z",
  }).meta.artifactHash);

  finishSourceGuards();
}

function finishSourceGuards() {
  const root = path.join(process.cwd(), "src/lib/football");
  const files = [
    ...readTree(path.join(root, "core")).map((f) => path.join(root, "core", f)),
    ...readTree(path.join(root, "competition")).map((f) =>
      path.join(root, "competition", f),
    ),
    path.join(process.cwd(), "scripts/build-football-schedule-v1.ts"),
  ];
  for (const f of files) {
    assertNoEngineImports(f);
    const src = readFileSync(f, "utf8");
    assert.equal(/from ["'][^"']*odds-foundation/.test(src), false, f);
  }

  const mlbPred = path.join(
    process.cwd(),
    "data/predictions/mlb/2026-08-14.json",
  );
  const before = createHash("sha256").update(readFileSync(mlbPred)).digest("hex");
  assert.equal(before.length, 64);

  console.log("test:football-schedule-v1 PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
