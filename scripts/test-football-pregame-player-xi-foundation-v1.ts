/**
 * Football Pregame Player / Availability / XI Foundation v1 tests.
 * Run: npm run test:football-pregame-player-xi-foundation-v1
 *
 * Synthetic fixtures only. Zero live provider calls.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ApiFootballProvider } from "../src/lib/football/api-football-provider";
import { evaluateFootballIdentityGate } from "../src/lib/football/foundation/identity-gate";
import {
  emptyExpectedXiNotCollected,
  emptyPlayerFeatureContract,
  footballInjuriesObservationRel,
  footballLineupsObservationRel,
  mapApiFootballInjuryAvailability,
  replayNormalizeFootballInjuries,
  replayNormalizeFootballLineups,
  resolveFootballPlayerIdentity,
} from "../src/lib/football/pregame-player-xi-foundation-v1";
import { classifyFootballObservationPhase } from "../src/lib/football/pregame-player-xi-foundation-v1/temporal";
import {
  SYNTHETIC_FIXTURE_ID,
  SYNTHETIC_INJURIES_RAW,
  SYNTHETIC_KICKOFF,
  SYNTHETIC_LINEUPS_RAW,
  SYNTHETIC_POST_KICKOFF_AT,
  SYNTHETIC_PREGAME_AT,
  syntheticInjuriesObservation,
  syntheticLineupsObservation,
} from "../src/lib/football/pregame-player-xi-foundation-v1/test-fixtures";

const AUDIT_REL = "data/audits/football-pregame-player-xi-foundation-v1.json";
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
    fixtureId: SYNTHETIC_FIXTURE_ID,
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
    fixtureId: SYNTHETIC_FIXTURE_ID,
    competitionId: "fb-comp-api-football-39",
    season: "2025",
    kickoffUtc: SYNTHETIC_KICKOFF,
    homeTeamId: "999999",
    awayTeamId: "888888",
    neutralVenue: false,
    status: "SCHEDULED",
  });
}

function main() {
  const cwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const originalInjuries = ApiFootballProvider.prototype.getInjuries;
  const originalLineups = ApiFootballProvider.prototype.getLineups;
  let fetchCalls = 0;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error(LIVE_FORBIDDEN);
  }) as typeof fetch;
  ApiFootballProvider.prototype.getInjuries = async () => {
    throw new Error(LIVE_FORBIDDEN);
  };
  ApiFootballProvider.prototype.getLineups = async () => {
    throw new Error(LIVE_FORBIDDEN);
  };

  try {
    const gatePass = passingGate();
    assert.equal(gatePass.verdict, "PASS");
    const gateFail = failingGate();
    assert.equal(gateFail.verdict, "FAIL");
    assert.equal(gateFail.predictionAllowed, false);

    const playerWithId = resolveFootballPlayerIdentity({
      providerPlayerId: 276,
      providerTeamId: 33,
      canonicalTeamId: "fb-team-v1-api-football-33",
      playerName: "D. De Gea",
    });
    assert.equal(playerWithId.identityStatus, "PROVIDER_ID_ONLY");
    assert.equal(playerWithId.canonicalPlayerId, null);
    assert.equal(playerWithId.providerPlayerId, "276");

    const playerNoId = resolveFootballPlayerIdentity({
      providerPlayerId: null,
      providerTeamId: 33,
      canonicalTeamId: null,
      playerName: "Nameless Trialist",
    });
    assert.equal(playerNoId.identityStatus, "PLAYER_IDENTITY_REVIEW_REQUIRED");

    const mappedUnknown = mapApiFootballInjuryAvailability({
      typeRaw: "Medical Review",
      reasonRaw: "Unspecified",
    });
    assert.equal(mappedUnknown.availabilityStatus, "UNKNOWN");
    assert.equal(mappedUnknown.reasonNormalized, null);

    const pregameInj = replayNormalizeFootballInjuries(
      syntheticInjuriesObservation(SYNTHETIC_PREGAME_AT),
      { sourceArtifactHash: "test-injuries-hash", identityGate: gatePass },
    );
    assert.equal(pregameInj.predictionInput, false);
    assert.equal(pregameInj.engineInput, false);
    assert.equal(pregameInj.engineConnected, false);
    assert.equal(pregameInj.predictionConnected, false);
    assert.equal(pregameInj.counts.rawRows, SYNTHETIC_INJURIES_RAW.length);
    assert.equal(pregameInj.counts.normalizedRows, SYNTHETIC_INJURIES_RAW.length);
    const deGea = pregameInj.rows.find((r) => r.player.providerPlayerId === "276");
    assert.ok(deGea);
    assert.equal(deGea.player.providerPlayerId, "276");
    assert.equal(deGea.reasonRaw, "Knee Injury");
    assert.equal(deGea.availabilityStatus, "OUT");
    assert.equal(deGea.pregameEligible, true);
    assert.equal(deGea.operatorGameAttached, true);

    const rashford = pregameInj.rows.find((r) => r.player.providerPlayerId === "882");
    assert.equal(rashford?.availabilityStatus, "QUESTIONABLE");

    const casemiro = pregameInj.rows.find((r) => r.player.providerPlayerId === "909");
    assert.equal(casemiro?.availabilityStatus, "SUSPENDED");
    assert.equal(casemiro?.reasonRaw, "Suspended");

    const unknown = pregameInj.rows.find((r) => r.player.providerPlayerId === "1485");
    assert.equal(unknown?.availabilityStatus, "UNKNOWN");
    assert.equal(unknown?.reasonRaw, "Unspecified");
    assert.equal(unknown?.reasonNormalized, null);

    const nameless = pregameInj.rows.find((r) => r.player.playerName === "Nameless Trialist");
    assert.equal(nameless?.player.identityStatus, "PLAYER_IDENTITY_REVIEW_REQUIRED");
    assert.equal(nameless?.player.providerPlayerId, null);

    const blockedInj = replayNormalizeFootballInjuries(
      syntheticInjuriesObservation(SYNTHETIC_PREGAME_AT),
      { sourceArtifactHash: "test-injuries-blocked", identityGate: gateFail },
    );
    assert.equal(blockedInj.rows.every((r) => r.operatorGameAttached === false), true);
    assert.equal(
      blockedInj.rows.every((r) => r.attachmentKind === "PROVIDER_FIXTURE_RESEARCH_ONLY"),
      true,
    );
    assert.equal(blockedInj.quality, "IDENTITY_BLOCKED");

    const emptyInj = replayNormalizeFootballInjuries(
      {
        ...syntheticInjuriesObservation(SYNTHETIC_PREGAME_AT),
        observationId: "empty-injuries",
        raw: [],
      },
      { sourceArtifactHash: "empty", identityGate: gatePass },
    );
    assert.equal(emptyInj.quality, "EMPTY_PROVIDER_RESPONSE");
    assert.equal(emptyInj.counts.normalizedRows, 0);

    const pregameXi = replayNormalizeFootballLineups(
      syntheticLineupsObservation(SYNTHETIC_PREGAME_AT),
      { sourceArtifactHash: "test-lineups-hash", identityGate: gatePass },
    );
    assert.equal(pregameXi.predictionInput, false);
    assert.equal(pregameXi.engineInput, false);
    assert.equal(pregameXi.observation.teams.length, 2);
    const united = pregameXi.observation.teams.find((t) => t.providerTeamId === "33");
    const liverpool = pregameXi.observation.teams.find((t) => t.providerTeamId === "40");
    assert.equal(united?.formation, "4-2-3-1");
    assert.equal(united?.startingXI.length, 11);
    assert.equal(united?.substitutes.length, 2);
    assert.equal(liverpool?.formation, "4-3-3");
    assert.equal(liverpool?.startingXI.length, 11);
    assert.equal(pregameXi.counts.startingPlayersObserved, 22);
    assert.equal(pregameXi.counts.substitutesObserved, 3);
    assert.equal(united?.lineupObservationType, "UNCLASSIFIED_PROVIDER_LINEUP");
    assert.equal(united?.startingXI[0]?.player.providerPlayerId, "1");
    assert.equal(united?.operatorGameAttached, true);

    const confirmedXi = replayNormalizeFootballLineups(
      syntheticLineupsObservation(SYNTHETIC_PREGAME_AT),
      {
        sourceArtifactHash: "test-lineups-confirmed",
        identityGate: gatePass,
        lineupSemantic: "OFFICIAL_CONFIRMED",
      },
    );
    assert.equal(
      confirmedXi.observation.teams.every((t) => t.lineupObservationType === "CONFIRMED"),
      true,
    );

    const blockedXi = replayNormalizeFootballLineups(
      syntheticLineupsObservation(SYNTHETIC_PREGAME_AT),
      { sourceArtifactHash: "test-lineups-blocked", identityGate: gateFail },
    );
    assert.equal(blockedXi.observation.teams.every((t) => t.operatorGameAttached === false), true);
    assert.equal(blockedXi.quality, "IDENTITY_BLOCKED");

    const before = classifyFootballObservationPhase({
      observedAt: SYNTHETIC_PREGAME_AT,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    assert.equal(before.pregameEligible, true);
    assert.equal(before.observationPhase, "PRE_GAME");
    const atKick = classifyFootballObservationPhase({
      observedAt: SYNTHETIC_POST_KICKOFF_AT,
      fixtureKickoff: SYNTHETIC_KICKOFF,
    });
    assert.equal(atKick.pregameEligible, false);
    assert.equal(atKick.observationPhase, "POST_KICKOFF_INVALID_FOR_PREGAME");

    const postXi = replayNormalizeFootballLineups(
      syntheticLineupsObservation(SYNTHETIC_POST_KICKOFF_AT),
      { sourceArtifactHash: "post-kickoff", identityGate: gatePass },
    );
    assert.equal(postXi.observation.pregameEligible, false);
    assert.equal(postXi.quality, "POST_KICKOFF_ONLY");

    const obsA = syntheticInjuriesObservation("2026-09-01T17:00:00.000Z");
    const obsB = syntheticInjuriesObservation("2026-09-01T17:30:00.000Z");
    assert.notEqual(obsA.observationId, obsB.observationId);
    const dsA = replayNormalizeFootballInjuries(obsA, {
      sourceArtifactHash: "obs-a",
      identityGate: gatePass,
    });
    const dsB = replayNormalizeFootballInjuries(obsB, {
      sourceArtifactHash: "obs-b",
      identityGate: gatePass,
    });
    assert.notEqual(dsA.observationId, dsB.observationId);
    assert.notEqual(dsA.rows[0]?.observedAt, dsB.rows[0]?.observedAt);
    assert.notEqual(
      footballInjuriesObservationRel({
        providerFixtureId: obsA.providerFixtureId,
        observedAt: obsA.observedAt,
      }),
      footballInjuriesObservationRel({
        providerFixtureId: obsB.providerFixtureId,
        observedAt: obsB.observedAt,
      }),
    );
    assert.notEqual(
      footballLineupsObservationRel({
        providerFixtureId: SYNTHETIC_FIXTURE_ID,
        observedAt: SYNTHETIC_PREGAME_AT,
      }),
      footballLineupsObservationRel({
        providerFixtureId: SYNTHETIC_FIXTURE_ID,
        observedAt: SYNTHETIC_POST_KICKOFF_AT,
      }),
    );

    const expected = emptyExpectedXiNotCollected({
      providerFixtureId: SYNTHETIC_FIXTURE_ID,
      observedAt: SYNTHETIC_PREGAME_AT,
      sourceType: "OFFICIAL_PROVIDER_EXPECTED",
    });
    assert.equal(expected.sourceStatus, "NOT_COLLECTED_IN_V1");
    assert.equal(expected.expectedStarters.length, 0);
    assert.equal(expected.predictionInput, false);

    const feature = emptyPlayerFeatureContract({
      providerPlayerId: "276",
      providerTeamId: "33",
      canonicalTeamId: "fb-team-v1-api-football-33",
      position: "G",
    });
    assert.equal(feature.filled, false);
    assert.equal(feature.playerScore, null);
    assert.equal(feature.engineInput, false);

    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    ApiFootballProvider.prototype.getInjuries = originalInjuries;
    ApiFootballProvider.prototype.getLineups = originalLineups;
  }

  const auditAbs = path.join(cwd, AUDIT_REL);
  assert.equal(existsSync(auditAbs), true);
  const audit = JSON.parse(readFileSync(auditAbs, "utf8")) as {
    engineConnected: boolean;
    predictionConnected: boolean;
    sealed20260826ArtifactsUntouched: boolean;
    knownDataGaps: string[];
    replayNetworkSeparation: { rebuildRequiresLiveProvider: boolean };
  };
  assert.equal(audit.engineConnected, false);
  assert.equal(audit.predictionConnected, false);
  assert.equal(audit.sealed20260826ArtifactsUntouched, true);
  assert.equal(audit.replayNetworkSeparation.rebuildRequiresLiveProvider, false);
  assert.equal(audit.knownDataGaps.includes("EXPECTED_XI_PROVIDER_NOT_CONFIRMED"), true);
  assert.equal(audit.knownDataGaps.includes("PLAYER_FEATURE_DATASET_NOT_BUILT"), true);
  assert.equal(audit.knownDataGaps.includes("XI_STRENGTH_NOT_BUILT"), true);

  const sealedDiff = execSync(
    `git diff --name-only -- ${SEALED_2026_08_26.join(" ")} src/lib/engine src/lib/football/prediction-snapshot-v0 src/lib/football/market-baseline-prediction-v0`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(sealedDiff, "");

  console.log("test:football-pregame-player-xi-foundation-v1 OK", {
    fetchCalls,
    injuryRows: SYNTHETIC_INJURIES_RAW.length,
    lineupTeams: SYNTHETIC_LINEUPS_RAW.length,
    engineConnected: false,
    predictionConnected: false,
  });
}

main();
