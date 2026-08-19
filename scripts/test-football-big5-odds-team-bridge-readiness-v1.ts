/**
 * Football Big-5 Odds Team Bridge Readiness Audit v1 tests.
 * Run: npm run test:football-big5-odds-team-bridge-readiness-v1
 *
 * No Provider network. Does not rewrite frozen artifacts or football source.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  AUDIT_REL,
  FROZEN_REL,
  SCHEMA,
  writeFootballBig5OddsTeamBridgeReadinessAudit,
} from "./audit-football-big5-odds-team-bridge-readiness-v1";

const SPORT_KEY_STATUS = new Set([
  "LIVE_VERIFIED",
  "HISTORICAL_VERIFIED",
  "CONFIGURED_NOT_PROVEN",
  "MISSING",
]);

const FUNCTIONAL_PATHS = [
  "src/lib/football/odds-1x2-v1/build.ts",
  "src/lib/football/odds-1x2-v1/team-bridge.ts",
  "src/lib/football/odds-1x2-v1/sport-keys.ts",
  "src/lib/football/odds-1x2-v1/event-join.ts",
  "src/lib/football/odds-1x2-v1/types.ts",
  "src/lib/football/core/team-catalog.ts",
  "scripts/build-football-1x2-odds-v1.ts",
];

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

async function main() {
  const cwd = process.cwd();
  const frozenRels = Object.values(FROZEN_REL);
  for (const rel of frozenRels) {
    assert.equal(existsSync(path.join(cwd, rel)), true, `missing ${rel}`);
  }
  const before = Object.fromEntries(
    frozenRels.map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );

  const { document } = await writeFootballBig5OddsTeamBridgeReadinessAudit(cwd);
  assert.equal(document.schemaVersion, SCHEMA);
  assert.equal(document.researchOnly, true);
  assert.equal(document.networkCalls.apiFootball, 0);
  assert.equal(document.networkCalls.theOddsApi, 0);
  assert.equal(document.predictionCalls, 0);
  assert.equal(document.resultCalls, 0);
  assert.equal(document.leagues.length, 5);
  assert.deepEqual(
    document.leagues.map((l) => l.key),
    ["EPL", "LaLiga", "SerieA", "Bundesliga", "Ligue1"],
  );
  assert.equal(document.leagues[0]?.competitionId, "fb-comp-api-football-39");
  assert.equal(document.leagues[1]?.competitionId, "fb-comp-api-football-140");
  assert.equal(document.leagues[2]?.competitionId, "fb-comp-api-football-135");
  assert.equal(document.leagues[3]?.competitionId, "fb-comp-api-football-78");
  assert.equal(document.leagues[4]?.competitionId, "fb-comp-api-football-61");

  for (const league of document.leagues) {
    assert.ok(
      SPORT_KEY_STATUS.has(league.sportKeyStatus),
      `${league.key} sportKeyStatus=${league.sportKeyStatus}`,
    );
    assert.equal(league.notFullSeasonCoverage, true);
    assert.equal(
      league.observedCoverageDenominator,
      "observedCanonicalTeams_currentCatalogResolve",
    );
    if (league.observedCanonicalTeams === 0) {
      assert.equal(league.observedCoveragePercent, null);
    } else {
      assert.equal(typeof league.observedCoveragePercent, "number");
      assert.ok(league.observedCoveragePercent! >= 0);
      assert.ok(league.observedCoveragePercent! <= 100);
    }
    for (const cand of league.evidenceReadyForBridge) {
      assert.ok(cand.evidenceSource, "guessed bridge candidate without source");
      assert.ok(cand.oddsExactName, "guessed bridge candidate without odds name");
      assert.ok(cand.canonicalTeamId);
      assert.equal(cand.joinConfidence, "EXACT_HOME_AWAY_KICKOFF_SPORT_KEY");
    }
  }

  const laLiga = document.leagues.find((l) => l.key === "LaLiga");
  assert.ok(laLiga);
  assert.equal(laLiga.sportKeyStatus, "LIVE_VERIFIED");
  assert.equal(laLiga.bridgeEntries, 6);
  assert.equal(laLiga.openingReadinessAlignment.oddsBridgeCount, 6);
  assert.equal(laLiga.openingReadinessAlignment.matchesCode, true);
  assert.equal(laLiga.existingJoinedOddsGames, 1);
  assert.ok(document.laLigaReferenceTrace);
  assert.equal(document.laLigaReferenceTrace.matchId, "soccer-api-football-1570337");
  assert.equal(
    document.laLigaReferenceTrace.oddsProviderEventId,
    "7b9f4d89d66c48e0c496aab1679e4ae4",
  );
  assert.deepEqual(document.laLigaReferenceTrace.bridgeHome, ["Deportivo La Coruña"]);
  assert.deepEqual(document.laLigaReferenceTrace.bridgeAway, ["Elche CF"]);
  assert.equal(document.laLigaReferenceTrace.join, "JOINED");

  for (const key of ["EPL", "SerieA", "Bundesliga", "Ligue1"] as const) {
    const league = document.leagues.find((l) => l.key === key);
    assert.ok(league);
    assert.equal(league.sportKeyStatus, "CONFIGURED_NOT_PROVEN");
    assert.equal(league.bridgeEntries, 0);
    assert.equal(league.observedScheduleRows, 0);
  }

  assert.equal(document.global.fullSeasonDenominatorStatus, "NOT_PROVEN");
  assert.equal(
    document.denominators.FULL_CURRENT_SEASON_TEAM_COUNT.status,
    "NOT_PROVEN",
  );
  assert.equal(document.global.bridgeEntriesTotal, 16);
  assert.equal(document.global.big5BridgeEntries, 6);
  assert.equal(document.global.evidenceReadyCandidates, 0);
  assert.equal(document.evidenceReadyCandidates.length, 0);
  assert.equal(document.joinContract.fuzzy, false);
  assert.equal(document.joinContract.slug, false);
  assert.equal(document.joinContract.substring, false);
  assert.equal(document.joinContract.caseInsensitiveAutoMatch, false);
  assert.equal(document.joinContract.homeAwayAutoReverseCorrection, false);
  assert.equal(document.mandatoryCompletion.total, "60%");
  assert.equal(document.incrementalStrategy.implementThisMission, false);
  assert.equal(
    document.nextMissionRecommendation,
    "Football Daily Odds Bridge Candidate Intake v1",
  );

  const after = Object.fromEntries(
    frozenRels.map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );
  assert.deepEqual(after, before);

  const frozenDiff = execSync(`git diff --name-only -- ${frozenRels.join(" ")}`, {
    cwd,
    encoding: "utf8",
  }).trim();
  assert.equal(frozenDiff, "");

  const functionalDiff = execSync(
    `git diff --name-only -- ${FUNCTIONAL_PATHS.join(" ")}`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(functionalDiff, "");

  assert.equal(existsSync(path.join(cwd, AUDIT_REL)), true);
  console.log("PASS football-big5-odds-team-bridge-readiness-v1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
