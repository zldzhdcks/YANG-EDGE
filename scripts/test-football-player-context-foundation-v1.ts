/**
 * Football Player Stats + Squad + Coach Data Foundation v1 tests.
 * Run: npm run test:football-player-context-foundation-v1
 *
 * Synthetic fixtures only. Zero live provider calls.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ApiFootballProvider } from "../src/lib/football/api-football-provider";
import { DummyFootballProvider } from "../src/lib/football/dummy-football-provider";
import { evaluateFootballIdentityGate } from "../src/lib/football/foundation/identity-gate";
import { FootballApiError } from "../src/lib/football/football-provider";
import {
  API_FOOTBALL_COACHES_ENDPOINT,
  API_FOOTBALL_PLAYERS_ENDPOINT,
  API_FOOTBALL_PREDICTIONS_ENDPOINT,
  API_FOOTBALL_SQUADS_ENDPOINT,
  HARD_PLAYERS_MAX_PAGES_CAP,
  assertNotPredictionsEndpoint,
  buildApiFootballCoachesQuery,
  buildApiFootballPlayersQuery,
  buildApiFootballSquadsQuery,
  buildFootballRawPlayerContextObservation,
  clampPlayersMaxPages,
  footballCoachesObservationRel,
  footballPlayersObservationRel,
  footballSquadsObservationRel,
  parseApiFootballPaging,
  planPlayerPagination,
  projectPlayerContextFeatures,
  replayNormalizeFootballCoaches,
  replayNormalizeFootballPlayers,
  replayNormalizeFootballSquad,
  resolveFootballCoachIdentity,
  resolveFootballPlayerIdentity,
} from "../src/lib/football/player-context-foundation-v1";
import { classifyPlayerContextTemporal } from "../src/lib/football/player-context-foundation-v1/temporal";
import {
  SYNTHETIC_BLOCKED_TEAM_ID,
  SYNTHETIC_BLOCKED_TEAM_SQUAD_RAW,
  SYNTHETIC_COACH_ENVELOPE,
  SYNTHETIC_COACH_RAW,
  SYNTHETIC_EMPTY_SQUAD_RAW,
  SYNTHETIC_KICKOFF,
  SYNTHETIC_PLAYERS_ALL_PAGES,
  SYNTHETIC_PLAYERS_FIVE_PAGE_ENVELOPE,
  SYNTHETIC_PLAYERS_PAGE_1_ENVELOPE,
  SYNTHETIC_PLAYERS_PAGE_2_ENVELOPE,
  SYNTHETIC_POST_KICKOFF_AT,
  SYNTHETIC_PREGAME_AT,
  SYNTHETIC_SEALED_KICKOFF,
  SYNTHETIC_SQUAD_ENVELOPE,
  SYNTHETIC_TEAM_ID,
  syntheticCoachesObservation,
  syntheticPlayersObservation,
  syntheticSquadObservation,
} from "../src/lib/football/player-context-foundation-v1/test-fixtures";

const AUDIT_REL = "data/audits/football-player-stats-squad-coach-foundation-v1.json";
const TEST_KEY = "secret-test-key-do-not-log";
const SEALED_2026_08_26 = [
  "data/audits/2026-08-26-daily-scope-lock-v1.json",
  "data/audits/2026-08-26-schedule-identity-reconciliation-v1.json",
  "data/audits/2026-08-26-pregame-input-odds-coverage-v1.json",
  "data/audits/2026-08-26-prediction-pass-reconciliation-v1.json",
  "data/audits/2026-08-26-pregame-prediction-snapshot-v1.json",
] as const;

const LIVE_FORBIDDEN = "LIVE_FOOTBALL_PROVIDER_FORBIDDEN_DURING_FOUNDATION";

function passingGate() {
  return evaluateFootballIdentityGate({
    provider: "api-football",
    fixtureId: "1234567",
    competitionId: "fb-comp-api-football-39",
    season: "2025",
    kickoffUtc: SYNTHETIC_KICKOFF,
    homeTeamId: "33",
    awayTeamId: "40",
    neutralVenue: false,
    status: "SCHEDULED",
  });
}

function failingGate() {
  return evaluateFootballIdentityGate({
    provider: "api-football",
    fixtureId: "1234567",
    competitionId: "fb-comp-api-football-39",
    season: "2025",
    kickoffUtc: SYNTHETIC_KICKOFF,
    homeTeamId: "999999",
    awayTeamId: "888888",
    neutralVenue: false,
    status: "SCHEDULED",
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function main() {
  const cwd = process.cwd();

  // --- A. provider query construction (no network) ---
  const teamSeason = buildApiFootballPlayersQuery({ teamId: 33, season: 2025 });
  assert.deepEqual(teamSeason, { season: "2025", team: "33" });
  const leagueSeason = buildApiFootballPlayersQuery({ leagueId: 39, season: 2025 });
  assert.deepEqual(leagueSeason, { season: "2025", league: "39" });
  const idSeason = buildApiFootballPlayersQuery({ playerId: 7, season: 2025 });
  assert.deepEqual(idSeason, { season: "2025", id: "7" });
  const paged = buildApiFootballPlayersQuery({ teamId: 33, season: 2025, page: 2 });
  assert.equal(paged.page, "2");
  assert.deepEqual(buildApiFootballSquadsQuery({ teamId: 33 }), { team: "33" });
  assert.deepEqual(buildApiFootballCoachesQuery({ teamId: 33 }), { team: "33" });
  assert.throws(
    () => buildApiFootballPlayersQuery({ season: 2025 }),
    FootballApiError,
  );
  assert.equal(API_FOOTBALL_PLAYERS_ENDPOINT, "/players");
  assert.equal(API_FOOTBALL_SQUADS_ENDPOINT, "/players/squads");
  assert.equal(API_FOOTBALL_COACHES_ENDPOINT, "/coachs");
  assert.throws(
    () => assertNotPredictionsEndpoint(API_FOOTBALL_PREDICTIONS_ENDPOINT),
    (err: unknown) =>
      err instanceof FootballApiError &&
      err.message.includes("PREDICTIONS_ENDPOINT_FORBIDDEN"),
  );

  const dummy = new DummyFootballProvider();
  const dummyPlayers = await dummy.getPlayers({ teamId: 33, season: 2025 });
  assert.equal(dummyPlayers.endpoint, "/players");
  assert.equal(dummyPlayers.raw.length, 0);

  // --- B. pagination planner ---
  const twoPages = planPlayerPagination({
    current: 1,
    total: 2,
    pagingPresent: true,
    maxPages: 8,
  });
  assert.deepEqual(twoPages.pagesToFetch, [1, 2]);
  assert.equal(twoPages.truncated, false);
  assert.equal(twoPages.complete, true);

  const capped = planPlayerPagination({
    current: 1,
    total: 5,
    pagingPresent: true,
    maxPages: 2,
  });
  assert.deepEqual(capped.pagesToFetch, [1, 2]);
  assert.equal(capped.truncated, true);
  assert.equal(capped.complete, false);
  assert.equal(capped.reason, "MAX_PAGES_SAFETY_CAP");

  const missingPaging = parseApiFootballPaging({ response: [] });
  const missingPlan = planPlayerPagination({
    ...missingPaging,
    maxPages: 8,
  });
  assert.equal(missingPlan.complete, false);
  assert.equal(missingPlan.reason, "PAGING_METADATA_MISSING");
  assert.equal(clampPlayersMaxPages(999), HARD_PLAYERS_MAX_PAGES_CAP);

  // --- Provider methods with stubbed fetch (not live API-Football) ---
  const originalFetch = globalThis.fetch;
  let stubFetchCalls = 0;
  const stubUrls: string[] = [];
  const logs: string[] = [];
  const originalInfo = console.info;
  console.info = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  globalThis.fetch = async (input) => {
    stubFetchCalls += 1;
    const url = new URL(String(input));
    stubUrls.push(url.toString());
    assert.equal(url.toString().includes(TEST_KEY), false);
    assert.equal(url.pathname.includes("predictions"), false);
    assert.equal(url.searchParams.has("key"), false);

    if (url.pathname.endsWith("/players/squads")) {
      return jsonResponse(SYNTHETIC_SQUAD_ENVELOPE);
    }
    if (url.pathname.endsWith("/coachs")) {
      return jsonResponse(SYNTHETIC_COACH_ENVELOPE);
    }
    if (url.pathname.endsWith("/players")) {
      const team = url.searchParams.get("team");
      const page = url.searchParams.get("page") ?? "1";
      if (team === "40") {
        if (page === "1") return jsonResponse(SYNTHETIC_PLAYERS_FIVE_PAGE_ENVELOPE);
        return jsonResponse({
          ...SYNTHETIC_PLAYERS_PAGE_2_ENVELOPE,
          paging: { current: Number(page), total: 5 },
        });
      }
      if (page === "2") return jsonResponse(SYNTHETIC_PLAYERS_PAGE_2_ENVELOPE);
      return jsonResponse(SYNTHETIC_PLAYERS_PAGE_1_ENVELOPE);
    }
    throw new Error(`UNEXPECTED_STUB_PATH:${url.pathname}`);
  };

  try {
    const provider = new ApiFootballProvider(
      "https://v3.football.api-sports.io",
      TEST_KEY,
    );

    stubFetchCalls = 0;
    const players = await provider.getPlayers({
      teamId: 33,
      season: 2025,
      maxPages: 8,
    });
    assert.equal(players.endpoint, "/players");
    assert.equal(players.query.team, "33");
    assert.equal(players.query.season, "2025");
    assert.equal(stubFetchCalls, 2);
    assert.equal(players.paging.pagesFetched, 2);
    assert.equal(players.paging.total, 2);
    assert.equal(players.paging.complete, true);
    assert.equal(players.paging.truncated, false);
    assert.equal(players.raw.length, 5);
    assert.equal(
      stubUrls.every((u) => u.includes("/players") && !u.includes("/predictions")),
      true,
    );
    assert.equal(
      stubUrls.some((u) => u.includes("page=1") || new URL(u).searchParams.get("page") === "1"),
      true,
    );
    assert.equal(
      stubUrls.some((u) => new URL(u).searchParams.get("page") === "2"),
      true,
    );

    stubFetchCalls = 0;
    const truncated = await provider.getPlayers({
      teamId: 40,
      season: 2025,
      maxPages: 2,
    });
    assert.equal(stubFetchCalls, 2);
    assert.equal(truncated.paging.truncated, true);
    assert.equal(truncated.paging.complete, false);
    assert.equal(truncated.paging.pagesFetched, 2);
    assert.equal(truncated.paging.total, 5);
    assert.equal(truncated.paging.reason, "MAX_PAGES_SAFETY_CAP");

    stubFetchCalls = 0;
    const squad = await provider.getPlayerSquad({ teamId: 33 });
    assert.equal(stubFetchCalls, 1);
    assert.equal(squad.endpoint, "/players/squads");
    assert.equal(squad.query.team, "33");

    stubFetchCalls = 0;
    const coaches = await provider.getCoaches({ teamId: 33 });
    assert.equal(stubFetchCalls, 1);
    assert.equal(coaches.endpoint, "/coachs");
    assert.equal(coaches.query.team, "33");

    assert.equal(logs.every((line) => !line.includes(TEST_KEY)), true);
    assert.equal(stubUrls.every((u) => !u.toLowerCase().includes("predictions")), true);
  } finally {
    console.info = originalInfo;
    globalThis.fetch = originalFetch;
  }

  // --- Replay / normalize: fetch must stay 0 ---
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error(LIVE_FORBIDDEN);
  };
  const originalGetPlayers = ApiFootballProvider.prototype.getPlayers;
  const originalGetSquad = ApiFootballProvider.prototype.getPlayerSquad;
  const originalGetCoaches = ApiFootballProvider.prototype.getCoaches;
  ApiFootballProvider.prototype.getPlayers = async () => {
    throw new Error(LIVE_FORBIDDEN);
  };
  ApiFootballProvider.prototype.getPlayerSquad = async () => {
    throw new Error(LIVE_FORBIDDEN);
  };
  ApiFootballProvider.prototype.getCoaches = async () => {
    throw new Error(LIVE_FORBIDDEN);
  };

  try {
    const gatePass = passingGate();
    const gateFail = failingGate();
    assert.equal(gatePass.verdict, "PASS");
    assert.equal(gateFail.verdict, "FAIL");

    const playersObs = syntheticPlayersObservation(SYNTHETIC_PREGAME_AT);
    const playersA = replayNormalizeFootballPlayers(playersObs, {
      sourceArtifactHash: "test-players-a",
      identityGate: gatePass,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    const playersB = replayNormalizeFootballPlayers(playersObs, {
      sourceArtifactHash: "test-players-a",
      identityGate: gatePass,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    assert.equal(JSON.stringify(playersA), JSON.stringify(playersB));
    assert.equal(playersA.predictionInput, false);
    assert.equal(playersA.engineInput, false);
    assert.equal(playersA.engineConnected, false);
    assert.equal(playersA.predictionConnected, false);
    assert.equal(playersA.observedAt, SYNTHETIC_PREGAME_AT);
    assert.equal(playersA.counts.rawPlayerItems, SYNTHETIC_PLAYERS_ALL_PAGES.length);
    assert.ok(playersA.counts.normalizedRows > playersA.counts.rawPlayerItems);

    const gk = playersA.rows.find((r) => r.playerName === "A. Onana");
    assert.ok(gk);
    assert.equal(gk!.games.position, "Goalkeeper");
    assert.equal(gk!.goals.saves, 38);
    assert.equal(gk!.goals.total, 0);
    assert.equal(gk!.shots.total, null);
    assert.equal(gk!.identity.canonicalPlayerId, null);
    assert.equal(gk!.identity.identityStatus, "PROVIDER_ID_ONLY");
    assert.equal(gk!.identity.providerPlayerId, "1");
    assert.equal(gk!.pregameEligible, true);

    const brunoRows = playersA.rows.filter((r) => r.providerPlayerId === "7");
    assert.equal(brunoRows.length, 2);
    const leagues = new Set(brunoRows.map((r) => r.leagueId));
    assert.equal(leagues.has("39"), true);
    assert.equal(leagues.has("2"), true);
    assert.equal(playersA.counts.multiContextPlayers >= 1, true);

    const missing = playersA.rows.find((r) => r.playerName === "Trialist Unknown");
    assert.ok(missing);
    assert.equal(missing!.games.appearances, null);
    assert.equal(missing!.games.minutes, null);
    assert.equal(missing!.goals.total, null);
    assert.equal(missing!.shots.total, null);
    assert.equal(missing!.identity.identityStatus, "PROVIDER_ID_ONLY");

    const dialloRows = playersA.rows.filter((r) => r.providerPlayerId === "10");
    assert.equal(dialloRows.length, 2);
    assert.equal(dialloRows[0]!.goals.assists, null);
    assert.equal(dialloRows[0]!.shots.total, null);
    assert.equal(dialloRows[0]!.games.rating, null);
    assert.equal(dialloRows[0]!.cards.yellow, 0);

    const namelessIdentity = resolveFootballPlayerIdentity({
      providerPlayerId: null,
      providerTeamId: "33",
      canonicalTeamId: "fb-team-v1-api-football-33",
      playerName: "Nameless Trialist",
    });
    assert.equal(namelessIdentity.canonicalPlayerId, null);
    assert.equal(namelessIdentity.identityStatus, "PLAYER_IDENTITY_REVIEW_REQUIRED");

    const identitySource = readFileSync(
      path.join(cwd, "src/lib/football/player-context-foundation-v1/identity.ts"),
      "utf8",
    );
    assert.equal(/levenshtein|similarity|fuzzy|nickname/i.test(identitySource), false);

    const squadObs = syntheticSquadObservation(SYNTHETIC_PREGAME_AT);
    const squadDs = replayNormalizeFootballSquad(squadObs, {
      sourceArtifactHash: "test-squad",
      identityGate: gatePass,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    assert.equal(squadDs.impliesStarter, false);
    assert.equal(squadDs.impliesAvailability, false);
    assert.equal(squadDs.impliesExpectedXi, false);
    assert.equal(squadDs.rosterSemantics, "CURRENT_AT_OBSERVED_AT");
    assert.equal(
      squadDs.players.every(
        (p) => !p.impliesStarter && !p.impliesAvailability && !p.impliesExpectedXi,
      ),
      true,
    );
    assert.equal(
      squadDs.players.every((p) => p.canonicalPlayerId === null),
      true,
    );
    const unnamed = squadDs.players.find((p) => p.name === "Nameless Trialist");
    assert.equal(unnamed?.identityStatus, "PLAYER_IDENTITY_REVIEW_REQUIRED");

    const emptySquad = replayNormalizeFootballSquad(
      syntheticSquadObservation(SYNTHETIC_PREGAME_AT, SYNTHETIC_EMPTY_SQUAD_RAW),
      { sourceArtifactHash: "empty-squad", identityGate: gatePass, fixtureKickoff: SYNTHETIC_KICKOFF },
    );
    assert.equal(emptySquad.players.length, 0);
    assert.equal(emptySquad.quality, "EMPTY_PROVIDER_RESPONSE");

    const coachObs = syntheticCoachesObservation(SYNTHETIC_PREGAME_AT);
    const coachDs = replayNormalizeFootballCoaches(coachObs, {
      sourceArtifactHash: "test-coach",
      identityGate: gatePass,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    assert.ok(coachDs.coach);
    assert.equal(coachDs.coach!.identity.canonicalCoachId, null);
    assert.equal(coachDs.coach!.identity.providerCoachId, "19");
    assert.equal(coachDs.coach!.identity.identityStatus, "PROVIDER_ID_ONLY");
    assert.equal(coachDs.coach!.career.length, 5);
    assert.equal(coachDs.coach!.tacticalScore, null);
    assert.equal(coachDs.coach!.coachStrengthScore, null);
    assert.equal(coachDs.coach!.formationScore, null);
    assert.equal(coachDs.coach!.managerRating, null);
    assert.equal(coachDs.predictionInput, false);

    const multiCoach = replayNormalizeFootballCoaches(
      syntheticCoachesObservation(SYNTHETIC_PREGAME_AT, [
        SYNTHETIC_COACH_RAW[0],
        { ...SYNTHETIC_COACH_RAW[0], id: 20, name: "Interim Coach" },
      ]),
      { sourceArtifactHash: "multi-coach", identityGate: gatePass },
    );
    assert.equal(multiCoach.coaches.length, 2);
    assert.equal(multiCoach.coach, null);

    const coachIdentity = resolveFootballCoachIdentity({
      providerCoachId: null,
      name: "Unknown",
    });
    assert.equal(coachIdentity.canonicalCoachId, null);
    assert.equal(coachIdentity.identityStatus, "COACH_IDENTITY_REVIEW_REQUIRED");

    const pregame = classifyPlayerContextTemporal({
      observedAt: SYNTHETIC_PREGAME_AT,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    assert.equal(pregame.pregameEligible, true);
    const post = classifyPlayerContextTemporal({
      observedAt: SYNTHETIC_POST_KICKOFF_AT,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    assert.equal(post.pregameEligible, false);
    assert.equal(post.observationPhase, "POST_KICKOFF_INVALID_FOR_PREGAME");

    const postPlayers = replayNormalizeFootballPlayers(
      syntheticPlayersObservation(SYNTHETIC_POST_KICKOFF_AT),
      {
        sourceArtifactHash: "post-kickoff",
        identityGate: gatePass,
        fixtureKickoff: SYNTHETIC_KICKOFF,
      },
    );
    assert.equal(postPlayers.rows.every((r) => r.pregameEligible === false), true);
    assert.equal(postPlayers.quality, "POST_KICKOFF_ONLY");

    const sealedCutoff = classifyPlayerContextTemporal({
      observedAt: "2026-08-26T15:00:00.000Z",
      fixtureKickoff: SYNTHETIC_SEALED_KICKOFF,
    });
    assert.equal(sealedCutoff.pregameEligible, false);

    const noFixture = classifyPlayerContextTemporal({
      observedAt: SYNTHETIC_PREGAME_AT,
    });
    assert.equal(noFixture.pregameEligible, false);
    assert.equal(noFixture.observationPhase, "RESEARCH_WITHOUT_TARGET_FIXTURE");

    const blockedSquad = replayNormalizeFootballSquad(
      syntheticSquadObservation(
        SYNTHETIC_PREGAME_AT,
        SYNTHETIC_BLOCKED_TEAM_SQUAD_RAW,
        SYNTHETIC_BLOCKED_TEAM_ID,
      ),
      { sourceArtifactHash: "blocked-squad", identityGate: gatePass, fixtureKickoff: SYNTHETIC_KICKOFF },
    );
    assert.equal(blockedSquad.canonicalTeamId, null);
    assert.equal(blockedSquad.canonicalTeamAttached, false);
    assert.equal(blockedSquad.operatorGameAttached, false);
    assert.equal(blockedSquad.quality, "IDENTITY_BLOCKED");

    const blockedPlayers = replayNormalizeFootballPlayers(
      buildFootballRawPlayerContextObservation({
        kind: "PLAYERS",
        endpoint: "/players",
        providerTeamId: SYNTHETIC_BLOCKED_TEAM_ID,
        season: 2025,
        observedAt: SYNTHETIC_PREGAME_AT,
        query: { team: SYNTHETIC_BLOCKED_TEAM_ID, season: "2025" },
        rawResponse: [
          {
            player: { id: 5001, name: "Blocked Team Player" },
            statistics: [
              {
                team: { id: 276, name: "Jeonbuk Motors" },
                league: { id: 292, name: "K League 1", season: 2025 },
                games: { appearences: 10, lineups: 10, minutes: 900, position: "Attacker" },
              },
            ],
          },
        ],
        syntheticTestData: true,
      }),
      { sourceArtifactHash: "blocked-players", identityGate: gatePass, fixtureKickoff: SYNTHETIC_KICKOFF },
    );
    assert.equal(blockedPlayers.rows.every((r) => r.canonicalTeamId === null), true);
    assert.equal(blockedPlayers.rows.every((r) => r.canonicalTeamAttached === false), true);
    assert.equal(blockedPlayers.quality, "IDENTITY_BLOCKED");

    const unresolvedAttach = replayNormalizeFootballPlayers(playersObs, {
      sourceArtifactHash: "unresolved-gate",
      identityGate: gateFail,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    assert.equal(unresolvedAttach.rows.some((r) => r.canonicalTeamAttached), true);
    assert.equal(unresolvedAttach.rows.every((r) => r.operatorGameAttached === false), true);

    const feature = projectPlayerContextFeatures({
      stats: gk!,
      squadMember: squadDs.players[0],
    });
    assert.equal(feature.admittedToEngine, false);
    assert.equal(feature.engineInput, false);
    assert.equal(feature.predictionInput, false);
    assert.equal(feature.playerScore, null);
    assert.equal(feature.availability, null);
    assert.equal(feature.canonicalPlayerId, null);
    assert.equal(feature.squadMembership, true);
    assert.equal(feature.seasonMinutes, 1080);

    assert.equal(
      footballPlayersObservationRel({
        providerTeamId: SYNTHETIC_TEAM_ID,
        observedAt: SYNTHETIC_PREGAME_AT,
      }).includes("player-context-v1/players/33/"),
      true,
    );
    assert.equal(
      footballSquadsObservationRel({
        providerTeamId: SYNTHETIC_TEAM_ID,
        observedAt: SYNTHETIC_PREGAME_AT,
      }).includes("player-context-v1/squads/33/"),
      true,
    );
    assert.equal(
      footballCoachesObservationRel({
        providerTeamId: SYNTHETIC_TEAM_ID,
        observedAt: SYNTHETIC_PREGAME_AT,
      }).includes("player-context-v1/coaches/33/"),
      true,
    );

    const truncatedObs = buildFootballRawPlayerContextObservation({
      kind: "PLAYERS",
      endpoint: "/players",
      providerTeamId: SYNTHETIC_TEAM_ID,
      season: 2025,
      observedAt: SYNTHETIC_PREGAME_AT,
      query: { team: "33", season: "2025" },
      paging: {
        current: 2,
        total: 5,
        pagesFetched: 2,
        truncated: true,
        complete: false,
        pagingPresent: true,
        maxPages: 2,
        reason: "MAX_PAGES_SAFETY_CAP",
      },
      rawResponse: SYNTHETIC_PLAYERS_ALL_PAGES,
      syntheticTestData: true,
    });
    const truncatedDs = replayNormalizeFootballPlayers(truncatedObs, {
      sourceArtifactHash: "truncated",
      identityGate: gatePass,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    assert.equal(truncatedDs.quality, "TRUNCATED_PAGINATION");
    assert.equal(truncatedDs.paging?.complete, false);

    assert.equal(fetchCalls, 0);
    assert.equal(playersObs.predictionInput, false);
    assert.equal(playersObs.engineInput, false);
    assert.equal(playersObs.syntheticTestData, true);
    assert.equal(playersObs.overwriteForbidden, true);
  } finally {
    globalThis.fetch = originalFetch;
    ApiFootballProvider.prototype.getPlayers = originalGetPlayers;
    ApiFootballProvider.prototype.getPlayerSquad = originalGetSquad;
    ApiFootballProvider.prototype.getCoaches = originalGetCoaches;
  }

  const auditAbs = path.join(cwd, AUDIT_REL);
  assert.equal(existsSync(auditAbs), true);
  const auditRaw = readFileSync(auditAbs, "utf8");
  const auditHash = createHash("sha256").update(auditRaw, "utf8").digest("hex");
  const audit = JSON.parse(auditRaw) as {
    provider: string;
    paginationHandled: boolean;
    playerCanonicalRegistryComplete: boolean;
    coachCanonicalRegistryComplete: boolean;
    tacticalFeaturesBuilt: boolean;
    predictionConnected: boolean;
    engineConnected: boolean;
    providerPredictionEndpointUsed: boolean;
    rebuildRequiresLiveProvider: boolean;
    sealed20260826ArtifactsUntouched: boolean;
    knownDataGaps: string[];
    providerLivePolicyThisMission: { actualLiveCalls: number };
    endpointsImplemented: string[];
  };
  assert.equal(audit.provider, "API_FOOTBALL");
  assert.equal(audit.paginationHandled, true);
  assert.equal(audit.playerCanonicalRegistryComplete, false);
  assert.equal(audit.coachCanonicalRegistryComplete, false);
  assert.equal(audit.tacticalFeaturesBuilt, false);
  assert.equal(audit.predictionConnected, false);
  assert.equal(audit.engineConnected, false);
  assert.equal(audit.providerPredictionEndpointUsed, false);
  assert.equal(audit.rebuildRequiresLiveProvider, false);
  assert.equal(audit.sealed20260826ArtifactsUntouched, true);
  assert.equal(audit.providerLivePolicyThisMission.actualLiveCalls, 0);
  assert.deepEqual(audit.endpointsImplemented, [
    "/players",
    "/players/squads",
    "/coachs",
  ]);
  for (const gap of [
    "PLAYER_CANONICAL_REGISTRY_INCOMPLETE",
    "COACH_CANONICAL_REGISTRY_INCOMPLETE",
    "TACTICAL_FEATURES_NOT_BUILT",
    "PLAYER_IMPACT_MODEL_NOT_BUILT",
    "HISTORICAL_ASOF_COVERAGE_NOT_AVAILABLE",
  ]) {
    assert.equal(audit.knownDataGaps.includes(gap), true, gap);
  }

  const sealedDiff = execSync(
    `git diff --name-only -- ${SEALED_2026_08_26.join(" ")} src/lib/engine src/app/analysis src/lib/football/prediction-snapshot-v0 src/lib/football/market-baseline-prediction-v0`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(sealedDiff, "");

  const liveRawRoot = path.join(
    cwd,
    "data/research/football/raw/player-context-v1",
  );
  assert.equal(existsSync(liveRawRoot), false);

  console.log("test:football-player-context-foundation-v1 OK", {
    fetchCalls,
    stubFetchCallsWereLocalOnly: true,
    providerLiveCalls: 0,
    predictionsCalls: 0,
    auditSha256: auditHash,
    engineConnected: false,
    predictionConnected: false,
  });
}

main();
