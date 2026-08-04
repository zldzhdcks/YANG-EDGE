/**
 * Football Identity Foundation v0 tests.
 * Run: npm run test:football-identity-foundation-v0
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  buildFootballMatchId,
  buildFootballMatchIdentity,
  buildIdentityHashPayload,
  computeFootballIdentityHash,
  evaluateFootballIdentityGate,
  getCompetitionById,
  identityHashIgnoresDisplayFields,
  isTeamRegistered,
  listCompetitions,
  listTeams,
  buildFootballScheduleArtifactV1,
  assertScheduleArtifactContract,
  FOOTBALL_REUSE_MATRIX_V0,
  FOOTBALL_IDENTITY_RISK_REGISTER_V0,
  buildFootballIdentityOperationSlice,
  FOOTBALL_IDENTITY_VERSION,
} from "../src/lib/football/foundation";

function baseInput() {
  return {
    provider: "api-football" as const,
    fixtureId: "1234567",
    competitionId: "fb-comp-api-football-39",
    season: "2025",
    kickoffUtc: "2025-08-15T19:00:00.000Z",
    homeTeamId: "33",
    awayTeamId: "40",
    neutralVenue: false,
    status: "SCHEDULED" as const,
  };
}

function main() {
  // fixtureId missing → FAIL
  const noFixture = evaluateFootballIdentityGate({
    ...baseInput(),
    fixtureId: "",
  });
  assert.equal(noFixture.verdict, "FAIL");
  assert.ok(noFixture.reasonCodes.includes("FIXTURE_ID_MISSING"));
  assert.equal(noFixture.predictionAllowed, false);

  // team registry missing → FAIL
  const noTeam = evaluateFootballIdentityGate({
    ...baseInput(),
    homeTeamId: "999999",
  });
  assert.equal(noTeam.verdict, "FAIL");
  assert.ok(noTeam.reasonCodes.includes("HOME_TEAM_NOT_REGISTERED"));
  assert.equal(noTeam.predictionAllowed, false);

  // competition missing → FAIL
  const noComp = evaluateFootballIdentityGate({
    ...baseInput(),
    competitionId: "fb-comp-does-not-exist",
  });
  assert.equal(noComp.verdict, "FAIL");
  assert.ok(noComp.reasonCodes.includes("COMPETITION_NOT_REGISTERED"));

  // happy path PASS
  const pass = evaluateFootballIdentityGate(baseInput());
  assert.equal(pass.verdict, "PASS");
  assert.equal(pass.matchId, "soccer-api-football-1234567");
  assert.ok(pass.identityHash && pass.identityHash.length === 64);

  // identityHash deterministic
  const a = computeFootballIdentityHash(baseInput());
  const b = computeFootballIdentityHash(baseInput());
  assert.equal(a, b);
  const id1 = buildFootballMatchIdentity(baseInput());
  const id2 = buildFootballMatchIdentity(baseInput());
  assert.equal(id1.identityHash, id2.identityHash);
  assert.equal(id1.matchId, id2.matchId);
  assert.equal(id1.identityVersion, FOOTBALL_IDENTITY_VERSION);

  // slug / displayName changes must not affect hash
  assert.ok(identityHashIgnoresDisplayFields().includes("displayName"));
  assert.ok(identityHashIgnoresDisplayFields().includes("uiSlug"));
  assert.equal(
    buildFootballMatchId("api-football", "1234567"),
    "soccer-api-football-1234567",
  );
  assert.equal(
    buildFootballMatchId("api-football", "1234567").includes("United"),
    false,
  );
  // Hash payload uses provider IDs only — displayName is not a hash input key
  const payload = buildIdentityHashPayload(baseInput());
  assert.equal(payload.includes("displayName"), false);
  assert.equal(payload.includes("맨체스터"), false);
  assert.equal(payload.includes("United"), false);

  // competition still resolvable (SoT), but name not in hash
  assert.ok(getCompetitionById("fb-comp-api-football-39"));
  assert.equal(payload.includes("Premier"), false);

  // schedule artifact contract
  const artifact = buildFootballScheduleArtifactV1({
    revision: "r1",
    sourceProvider: "api-football",
    dateKst: "2026-08-04",
    matches: [id1],
  });
  assert.equal(assertScheduleArtifactContract(artifact).length, 0);
  assert.equal(artifact.schemaVersion, "football-schedule-v1");
  assert.equal(artifact.identityVersion, FOOTBALL_IDENTITY_VERSION);

  // registries populated; UI leagues not imported as SoT (no import of football-leagues)
  assert.ok(listCompetitions().length >= 5);
  assert.ok(listTeams().length >= 2);
  assert.equal(isTeamRegistered("api-football", "33"), true);

  // reuse + risks
  assert.ok(FOOTBALL_REUSE_MATRIX_V0.some((r) => r.id === "bullpen" && r.reuse === "NO"));
  assert.ok(FOOTBALL_REUSE_MATRIX_V0.some((r) => r.id === "pregame-gate" && r.reuse === "YES"));
  assert.ok(FOOTBALL_IDENTITY_RISK_REGISTER_V0.length >= 10);

  // operation slice — no fake %
  const slice = buildFootballIdentityOperationSlice();
  assert.equal(slice.stage, "FOUNDATION");
  assert.equal(slice.progressPercent, null);
  assert.equal(slice.osLevel, "WARNING");

  console.log("PASS test-football-identity-foundation-v0");
  console.log(
    JSON.stringify(
      {
        matchId: id1.matchId,
        identityHashPrefix: id1.identityHash.slice(0, 12),
        stage: slice.stage,
        competitions: listCompetitions().length,
        teams: listTeams().length,
        risks: FOOTBALL_IDENTITY_RISK_REGISTER_V0.length,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main();
}
