/**
 * Football V4 Phase 0 foundation tests — WRITE ONLY in the unattended mission.
 * Run later (attended): npm run test:football-v4-phase0-v1
 *
 * Synthetic fixtures only. Zero live provider calls. Zero filesystem writes.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { evaluateFootballIdentityGate } from "../src/lib/football/foundation/identity-gate";
import {
  mapApiFootballInjuryAvailability,
  normalizeApiFootballInjuries,
  normalizeApiFootballLineups,
  resolveFootballPlayerIdentity,
} from "../src/lib/football/pregame-player-xi-foundation-v1";
import { classifyFootballV4TemporalProvenance } from "../src/lib/football/pregame-player-xi-foundation-v1/temporal";
import {
  SYNTHETIC_FIXTURE_ID,
  SYNTHETIC_KICKOFF,
  SYNTHETIC_LINEUPS_RAW,
  SYNTHETIC_POST_KICKOFF_AT,
  SYNTHETIC_PREGAME_AT,
} from "../src/lib/football/pregame-player-xi-foundation-v1/test-fixtures";
import {
  buildFootballV4PlayerContextSnapshot,
  planFootballV4PlayerContextPersist,
} from "../src/lib/football/v4-phase0-foundation-v1";

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

function lineupMeta(overrides?: { observedAt?: string; providerFetchedAt?: string | null; providerPublishedAt?: string | null }) {
  return {
    observationId: "v4-phase0-lineup",
    observedAt: overrides?.observedAt ?? SYNTHETIC_PREGAME_AT,
    fixtureKickoff: SYNTHETIC_KICKOFF,
    providerFixtureId: SYNTHETIC_FIXTURE_ID,
    sourceArtifactHash: "v4-phase0-lineup-hash",
    identityGate: passingGate(),
    providerFetchedAt: overrides?.providerFetchedAt,
    providerPublishedAt: overrides?.providerPublishedAt,
  };
}

function injuryMeta() {
  return {
    observationId: "v4-phase0-injury",
    observedAt: SYNTHETIC_PREGAME_AT,
    fixtureKickoff: SYNTHETIC_KICKOFF,
    providerFixtureId: SYNTHETIC_FIXTURE_ID,
    sourceArtifactHash: "v4-phase0-injury-hash",
    identityGate: passingGate(),
  };
}

function listPhase0SourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listPhase0SourceFiles(abs));
    else if (entry.name.endsWith(".ts")) out.push(abs);
  }
  return out;
}

function main() {
  // 1. empty lineup → NOT_AVAILABLE (not confirmed empty)
  const emptyXi = normalizeApiFootballLineups([], lineupMeta());
  assert.equal(emptyXi.xiAvailabilityStatus, "NOT_AVAILABLE");
  assert.equal(emptyXi.quality, "NOT_AVAILABLE");
  assert.equal(emptyXi.counts.startingPlayersObserved, 0);
  assert.equal(emptyXi.engineAdmission, false);
  assert.notEqual(emptyXi.xiAvailabilityStatus, "CONFIRMED_XI");

  // 2. synthetic nonempty startXI → normalized starters
  const nonemptyXi = normalizeApiFootballLineups(SYNTHETIC_LINEUPS_RAW, lineupMeta());
  assert.ok(nonemptyXi.counts.startingPlayersObserved >= 11);
  const united = nonemptyXi.observation.teams.find((t) => t.providerTeamId === "33");
  assert.equal(united?.startingXI.length, 11);
  assert.equal(united?.lineupObservationType, "UNCLASSIFIED_PROVIDER_LINEUP");
  assert.equal(nonemptyXi.xiAvailabilityStatus, "UNCLASSIFIED_PROVIDER_LINEUP");

  // 3. missing providerPlayerId → PLAYER_ID_UNRESOLVED
  const unresolved = resolveFootballPlayerIdentity({
    providerPlayerId: null,
    providerTeamId: 33,
    canonicalTeamId: null,
    playerName: "Nameless Trialist",
  });
  assert.equal(unresolved.identityStatus, "PLAYER_ID_UNRESOLVED");
  assert.equal(unresolved.canonicalPlayerId, null);

  // 4. providerPlayerId only → PROVIDER_ID_ONLY (MATCHED not auto-created)
  const providerOnly = resolveFootballPlayerIdentity({
    providerPlayerId: 276,
    providerTeamId: 33,
    canonicalTeamId: "fb-team-v1-api-football-33",
    playerName: "D. De Gea",
    canonicalPlayerId: "276",
    canonicalMappingPresent: false,
  });
  assert.equal(providerOnly.identityStatus, "PROVIDER_ID_ONLY");
  assert.equal(providerOnly.canonicalPlayerId, null);

  const matchedOnlyWithRegistry = resolveFootballPlayerIdentity({
    providerPlayerId: 276,
    providerTeamId: 33,
    canonicalTeamId: "fb-team-v1-api-football-33",
    playerName: "D. De Gea",
    canonicalPlayerId: "yang-player-de-gea",
    canonicalMappingPresent: true,
  });
  assert.equal(matchedOnlyWithRegistry.identityStatus, "MATCHED");
  assert.equal(matchedOnlyWithRegistry.canonicalPlayerId, "yang-player-de-gea");

  // 5. observedAt >= kickoff → POST_KICKOFF_OBSERVATION
  const postKick = classifyFootballV4TemporalProvenance({
    observedAt: SYNTHETIC_POST_KICKOFF_AT,
    kickoffUtc: SYNTHETIC_KICKOFF,
    providerFetchedAt: SYNTHETIC_PREGAME_AT,
    providerPublishedAt: SYNTHETIC_PREGAME_AT,
  });
  assert.equal(postKick.temporalStatus, "POST_KICKOFF_OBSERVATION");
  assert.equal(postKick.pregameEligible, false);
  assert.equal(postKick.strictReplayEligible, false);

  const postXi = normalizeApiFootballLineups(SYNTHETIC_LINEUPS_RAW, lineupMeta({
    observedAt: SYNTHETIC_POST_KICKOFF_AT,
  }));
  assert.equal(postXi.observation.temporalStatus, "POST_KICKOFF_OBSERVATION");
  assert.equal(postXi.observation.pregameEligible, false);

  // 6. publishedAt/fetchedAt missing → TEMPORAL_PARTIAL
  const partial = classifyFootballV4TemporalProvenance({
    observedAt: SYNTHETIC_PREGAME_AT,
    kickoffUtc: SYNTHETIC_KICKOFF,
  });
  assert.equal(partial.temporalStatus, "TEMPORAL_PARTIAL");
  assert.equal(partial.pregameEligible, true);
  assert.equal(partial.strictReplayEligible, false);

  // 7. all temporal fields valid → TEMPORAL_VERIFIED
  const verified = classifyFootballV4TemporalProvenance({
    observedAt: SYNTHETIC_PREGAME_AT,
    kickoffUtc: SYNTHETIC_KICKOFF,
    providerFetchedAt: "2026-09-01T17:55:00.000Z",
    providerPublishedAt: "2026-09-01T17:50:00.000Z",
  });
  assert.equal(verified.temporalStatus, "TEMPORAL_VERIFIED");
  assert.equal(verified.strictReplayEligible, true);
  assert.equal(verified.pregameEligible, true);

  // 8. injury empty → AVAILABLE not generated
  const emptyInj = normalizeApiFootballInjuries([], injuryMeta());
  assert.equal(emptyInj.counts.normalizedRows, 0);
  assert.equal(emptyInj.rows.some((r) => r.availabilityStatus === "AVAILABLE"), false);

  // 9. UNKNOWN injury preserved
  const unknownMapped = mapApiFootballInjuryAvailability({
    typeRaw: "Medical Review",
    reasonRaw: "Unspecified",
  });
  assert.equal(unknownMapped.availabilityStatus, "UNKNOWN");
  const unknownRow = normalizeApiFootballInjuries(
    [{
      player: { id: 1485, name: "Unknown Status Player", type: "Medical Review", reason: "Unspecified" },
      team: { id: 33, name: "Manchester United" },
      fixture: { id: 1234567 },
    }],
    injuryMeta(),
  );
  assert.equal(unknownRow.rows[0]?.availabilityStatus, "UNKNOWN");
  assert.equal(unknownRow.rows[0]?.reasonRaw, "Unspecified");
  assert.equal(unknownRow.rows[0]?.typeRaw, "Medical Review");

  // 10. suspension existing mapping only
  const suspended = mapApiFootballInjuryAvailability({
    typeRaw: "Missing Fixture",
    reasonRaw: "Suspended",
  });
  assert.equal(suspended.availabilityStatus, "SUSPENDED");
  const notSuspendedByGuess = mapApiFootballInjuryAvailability({
    typeRaw: "Missing Fixture",
    reasonRaw: "Ban pending review",
  });
  assert.equal(notSuspendedByGuess.availabilityStatus, "OUT");

  // 11. goalkeeper pos preserved as raw token
  assert.equal(united?.startingXI[0]?.position, "G");
  assert.equal(united?.startingXI[0]?.player.playerName, "A. Onana");

  // 12. context snapshot → engineAdmission=false
  const snapshot = buildFootballV4PlayerContextSnapshot({
    observedAt: SYNTHETIC_PREGAME_AT,
    kickoffUtc: SYNTHETIC_KICKOFF,
    providerFixtureId: SYNTHETIC_FIXTURE_ID,
    source: "synthetic-test",
    lineup: nonemptyXi,
    injury: emptyInj,
  });
  assert.equal(snapshot.engineAdmission, false);
  assert.equal(snapshot.engineInput, false);
  assert.equal(snapshot.predictionInput, false);
  assert.equal(snapshot.PUBLIC_DISPLAY_RIGHTS, "UNRESOLVED");
  assert.equal(snapshot.injury.status, "NOT_AVAILABLE");
  assert.equal(snapshot.playerSeason.status, "NOT_AVAILABLE");
  assert.equal(snapshot.squad.status, "NOT_AVAILABLE");
  assert.equal(snapshot.coverage.playerImpactScore, null);
  assert.equal(snapshot.coverage.lineupStrength, null);
  assert.equal(snapshot.coverage.engineAdmission, false);

  const plan = planFootballV4PlayerContextPersist({ snapshot });
  assert.equal(plan.writeExecuted, false);
  assert.equal(plan.overwriteForbidden, true);
  assert.match(plan.relativePath, /player-context-v1\/snapshots\//);

  // 13. Prediction / Poisson / Forward / V3 imports absent (static)
  const phase0Dir = path.join(process.cwd(), "src/lib/football/v4-phase0-foundation-v1");
  const sources = listPhase0SourceFiles(phase0Dir);
  assert.ok(sources.length > 0);
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    for (const token of [
      "poisson-research-v1",
      "football-forward-shadow",
      "football-v3-feature-research",
      "football-v31-incremental",
      "prediction-snapshot-v0",
      "market-baseline-prediction-v0",
      "predictFootball",
    ]) {
      assert.equal(text.includes(token), false, `${file} must not import ${token}`);
    }
    assert.equal(/from ["'].*poisson/.test(text), false, `${file} poisson import`);
  }

  console.log("test:football-v4-phase0-v1 OK", {
    engineAdmission: false,
    emptyLineup: emptyXi.xiAvailabilityStatus,
  });
}

main();
