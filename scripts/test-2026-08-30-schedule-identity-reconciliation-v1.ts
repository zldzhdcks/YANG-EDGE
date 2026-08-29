/**
 * 2026-08-30 B1 schedule / identity reconciliation tests.
 * Read-only versus Stage A / 2026-08-29 / global registries.
 * Rewrites only the B1 candidate artifact.
 *
 * Run: npm run test:2026-08-30-schedule-identity-reconciliation-v1
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DATE_KST,
  FROZEN_FORMAL_OBSERVED_AT,
  LOCK_REL,
  sha256File,
} from "./lock-2026-08-30-daily-scope-v1";
import { SEALED_2026_08_29 } from "./intake-2026-08-30-batch-2118-operator-pregame-observations";
import {
  B1_OWNER_REVIEW_RESULT,
  B1_OWNER_REVIEW_STATUS,
  B1_REL,
  B1_STATUS,
  CANDIDATE_B1_SHA256,
  NEXT_RECOMMENDED_STEP,
  REQUIRED_UNRESOLVED,
  SEALED_B1_SHA256,
  SEALED_REGISTRY,
  SEALED_STAGE_A,
  runB1,
} from "./audit-2026-08-30-schedule-identity-reconciliation-v1";

async function main() {
  const cwd = process.cwd();
  const result = await runB1(cwd);
  const b1 = JSON.parse(readFileSync(path.join(cwd, B1_REL), "utf8"));
  const lock = JSON.parse(readFileSync(path.join(cwd, LOCK_REL), "utf8"));

  assert.equal(b1.dateKst, DATE_KST);
  assert.equal(b1.formalObservedAt, FROZEN_FORMAL_OBSERVED_AT);
  assert.equal(b1.formalObservedAtChanged, false);
  assert.equal(lock.scopeTotal, 44);
  assert.equal(b1.status, B1_STATUS);
  assert.equal(b1.ownerReviewStatus, B1_OWNER_REVIEW_STATUS);
  assert.equal(b1.ownerReviewResult, B1_OWNER_REVIEW_RESULT);
  assert.equal(b1.candidateSha256, CANDIDATE_B1_SHA256);
  assert.equal(sha256File(path.join(cwd, B1_REL)), SEALED_B1_SHA256);
  assert.equal(result.sha256, SEALED_B1_SHA256);
  assert.equal(b1.nextRecommendedStep, NEXT_RECOMMENDED_STEP);
  assert.equal(b1.summary.officialScopeTotal, 44);
  assert.equal(b1.summary.accountedFor, 44);
  assert.equal(b1.summary.Football, 29);
  assert.equal(b1.rows.length, 29);
  assert.equal(b1.summary.MLB, 15);
  assert.equal(b1.summary.mlbMatched, 15);
  assert.equal(b1.mlbPreserved.length, 15);
  assert.ok(b1.mlbPreserved.every((r: { identityStatus: string }) => r.identityStatus === "MATCHED"));
  assert.equal(b1.summary.footballMatchedBefore, 2);
  assert.equal(b1.summary.footballMatchedAfter, 16);
  assert.equal(b1.summary.footballMatched, 16);
  assert.equal(b1.summary.footballNewlyResolved, 14);
  assert.equal(b1.summary.footballIdentityReviewRemaining, 13);
  assert.equal(b1.summary.methodBreakdown.sealedAlias, 2);
  assert.equal(b1.summary.methodBreakdown.uniqueCompetitionKickoffSlot, 10);
  assert.equal(b1.summary.methodBreakdown.previousDeterministicEvidence, 4);
  assert.equal(b1.futureAliasCandidates.length, 23);
  assert.equal(b1.unresolvedFootball.length, 13);
  assert.equal(REQUIRED_UNRESOLVED.length, 13);
  for (const [league, kickoff, home, away] of REQUIRED_UNRESOLVED) {
    const hit = b1.rows.find(
      (r: {
        rawLeagueLabel: string;
        displayedKickoffKst: string;
        rawHome: string;
        rawAway: string;
        identityStatus: string;
      }) =>
        r.rawLeagueLabel === league &&
        r.displayedKickoffKst === kickoff &&
        r.rawHome === home &&
        r.rawAway === away,
    );
    assert.ok(hit, `${home} : ${away}`);
    assert.equal(hit.identityStatus, "IDENTITY_REVIEW_REQUIRED");
    assert.equal(hit.identityMethod, null);
  }
  assert.equal(
    b1.summary.footballMatched + b1.summary.footballIdentityReviewRemaining,
    29,
  );
  assert.equal(
    b1.summary.mlbMatched +
      b1.summary.footballMatchedAfter +
      b1.summary.footballIdentityReviewRemaining,
    44,
  );
  assert.equal(b1.summary.competitionReviewRequired, 0);
  assert.equal(b1.summary.providerUnsupported, 0);
  assert.equal(b1.resultDataUsed, false);
  assert.equal(b1.fuzzyMatchingUsed, false);
  assert.equal(b1.marketDataUsedForIdentity, false);
  assert.equal(b1.predictionCreated, 0);
  assert.equal(b1.predictionCalls, 0);
  assert.equal(b1.resultCalls, 0);
  assert.equal(b1.engineCalls, 0);
  assert.equal(b1.engineModified, false);
  assert.equal(b1.weightsModified, false);
  assert.equal(b1.predictionInput, false);
  assert.equal(b1.engineInput, false);
  assert.equal(b1.marketBenchmarkOnly, true);
  assert.equal(b1.globalTeamAliasRegistryModified, false);
  assert.equal(b1.competitionRegistryModified, false);
  assert.equal(b1.newAliasesInvented, 0);
  assert.equal(existsSync(path.join(cwd, "data/predictions/2026-08-30.json")), false);

  const keys = b1.rows.map(
    (r: { rawHome: string; rawAway: string; displayedKickoffKst: string }) =>
      `${r.displayedKickoffKst}|${r.rawHome}|${r.rawAway}`,
  );
  assert.equal(new Set(keys).size, keys.length);

  const matchedFixtureIds = b1.rows
    .filter((r: { providerFixtureId: string | null }) => r.providerFixtureId)
    .map((r: { providerFixtureId: string }) => r.providerFixtureId);
  assert.equal(new Set(matchedFixtureIds).size, matchedFixtureIds.length);

  const espanyol = b1.rows.find(
    (r: { rawAway: string }) => r.rawAway === "에스피뇰",
  );
  assert.ok(espanyol);
  assert.equal(espanyol.rawAway, "에스피뇰");
  assert.notEqual(espanyol.rawAway, "에스파뇰");
  if (espanyol.identityStatus.startsWith("MATCHED_")) {
    assert.equal(espanyol.identityMethod, "UNIQUE_COMPETITION_KICKOFF_SLOT");
    assert.equal(espanyol.providerHomeTeamName, "Real Sociedad");
    assert.equal(espanyol.providerAwayTeamName, "Espanyol");
  }

  const seattle = b1.rows.find(
    (r: { rawHome: string; rawAway: string }) =>
      r.rawHome === "시애사운" && r.rawAway === "시카파이",
  );
  assert.equal(seattle?.identityStatus, "MATCHED_SEALED_ALIAS");
  const portland = b1.rows.find(
    (r: { rawHome: string; rawAway: string }) =>
      r.rawHome === "포틀팀버" && r.rawAway === "오스틴FC",
  );
  assert.equal(portland?.identityStatus, "MATCHED_SEALED_ALIAS");

  for (const row of b1.rows) {
    assert.equal(row.pregameEvidenceOnly, true);
    assert.equal(row.resultDataUsed, false);
    assert.equal(row.fuzzyMatchingUsed, false);
    assert.equal(row.marketDataUsedForIdentity, false);
  }

  for (const sealed of [...SEALED_STAGE_A, ...SEALED_2026_08_29, ...SEALED_REGISTRY]) {
    assert.equal(
      sha256File(path.join(cwd, sealed.rel)),
      sealed.sha256,
      sealed.rel,
    );
  }

  const registryDiff = execSync(
    "git diff --name-only -- src/lib/teams/team-aliases.ts src/lib/teams/types.ts src/lib/football/foundation/competition-registry.ts data/audits/football-team-alias-registry-v1.json",
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(registryDiff, "");

  const stageADiff = execSync(
    `git diff --name-only -- ${LOCK_REL} data/operator-observations/structured/2026-08-30 data/audits/2026-08-30-daily-scope-lock-v1.json data/audits/2026-08-30-scope-slate-recovery-v1.json data/audits/2026-08-30-pregame-current-state-recovery-v1.json`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(stageADiff, "");

  const engineDiff = execSync(
    "git diff --name-only -- src/lib/engine src/lib/mlb/prediction-v0",
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(engineDiff, "");

  assert.equal(result.sha256, sha256File(path.join(cwd, B1_REL)));
  console.log("PASS 2026-08-30 schedule identity reconciliation v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
