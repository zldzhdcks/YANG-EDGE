/**
 * 2026-08-30 B2 pregame input coverage tests.
 * Does not rewrite Stage A / B1 / 2026-08-29. Does not call runB1.
 *
 * Run: npm run test:2026-08-30-pregame-input-coverage-v1
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
  B1_REL,
  REQUIRED_UNRESOLVED,
  SEALED_B1_SHA256,
  SEALED_REGISTRY,
  SEALED_STAGE_A,
} from "./audit-2026-08-30-schedule-identity-reconciliation-v1";
import {
  B2_REL,
  B2_NEXT_RECOMMENDED_STEP,
  B2_OWNER_REVIEW_STATUS,
  CANDIDATE_B2_SHA256,
  SEALED_B2_SHA256,
} from "./audit-2026-08-30-pregame-input-coverage-v1";

async function main() {
  const cwd = process.cwd();
  const b2Abs = path.join(cwd, B2_REL);
  assert.equal(existsSync(b2Abs), true, "Run audit:2026-08-30-pregame-input-coverage-v1 first");

  const b2 = JSON.parse(readFileSync(b2Abs, "utf8"));
  const b1 = JSON.parse(readFileSync(path.join(cwd, B1_REL), "utf8"));

  assert.equal(b2.schemaVersion, "yang-edge-pregame-input-coverage-v1");
  assert.equal(b2.dateKst, DATE_KST);
  assert.equal(b2.stage, "B2");
  assert.equal(b2.candidateStatus, "SEALED");
  assert.equal(b2.ownerReviewStatus, B2_OWNER_REVIEW_STATUS);
  assert.equal(b2.candidateSha256, CANDIDATE_B2_SHA256);
  assert.equal(sha256File(b2Abs), SEALED_B2_SHA256);
  assert.equal(b2.nextRecommendedStep, B2_NEXT_RECOMMENDED_STEP);
  assert.equal(b2.formalObservedAt, FROZEN_FORMAL_OBSERVED_AT);
  assert.equal(b2.formalObservedAtChanged, false);
  assert.equal(b2.b1Sha256, SEALED_B1_SHA256);
  assert.equal(sha256File(path.join(cwd, B1_REL)), SEALED_B1_SHA256);
  assert.equal(sha256File(path.join(cwd, LOCK_REL)), SEALED_STAGE_A[0]!.sha256);

  assert.equal(b2.summary.officialScopeTotal, 44);
  assert.equal(b2.summary.identityMatchedTotal, 31);
  assert.equal(b2.summary.MLBMatched, 15);
  assert.equal(b2.summary.FootballMatched, 16);
  assert.equal(b2.summary.FootballIdentityBlocked, 13);
  assert.equal(b2.games.length, 44);
  assert.equal(
    b2.summary.coverageComplete +
      b2.summary.coveragePartial +
      b2.summary.coverageMinimal +
      b2.summary.coverageBlocked,
    44,
  );

  const mlb = b2.games.filter((g: { sport: string }) => g.sport === "MLB");
  const football = b2.games.filter((g: { sport: string }) => g.sport === "FOOTBALL");
  const footballMatched = football.filter((g: { coverageState: string }) =>
    g.coverageState !== "BLOCKED_IDENTITY_REVIEW_REQUIRED",
  );
  const footballBlocked = football.filter(
    (g: { coverageState: string }) =>
      g.coverageState === "BLOCKED_IDENTITY_REVIEW_REQUIRED",
  );
  assert.equal(mlb.length, 15);
  assert.equal(football.length, 29);
  assert.equal(footballMatched.length, 16);
  assert.equal(footballBlocked.length, 13);
  assert.equal(
    mlb.every((g: { b1IdentityStatus: string }) => g.b1IdentityStatus === "MATCHED"),
    true,
  );

  for (const [league, kickoff, home, away] of REQUIRED_UNRESOLVED) {
    const game = footballBlocked.find(
      (g: { rawMatchup: string; scheduledStartAt: string }) =>
        g.rawMatchup === `${home} : ${away}` &&
        g.scheduledStartAt.includes(`T${kickoff}:`),
    );
    assert.ok(game, `blocked missing ${league} ${home}:${away}`);
    assert.equal(game.providerGameId, null);
    assert.equal(game.coverageState, "BLOCKED_IDENTITY_REVIEW_REQUIRED");
    const b1Row = b1.rows.find(
      (r: {
        rawLeagueLabel: string;
        displayedKickoffKst: string;
        rawHome: string;
        rawAway: string;
      }) =>
        r.rawLeagueLabel === league &&
        r.displayedKickoffKst === kickoff &&
        r.rawHome === home &&
        r.rawAway === away,
    );
    assert.equal(b1Row.identityStatus, "IDENTITY_REVIEW_REQUIRED");
    assert.equal(b1Row.providerFixtureId, null);
  }

  assert.equal(b2.fuzzyMatchingUsed, false);
  assert.equal(b2.resultDataUsed, false);
  assert.equal(b2.resultCalls, 0);
  assert.equal(b2.predictionProviderCalls, 0);
  assert.equal(b2.engineCalls, 0);
  assert.equal(b2.engineModified, false);
  assert.equal(b2.weightsModified, false);
  assert.equal(b2.researchOnly, true);
  assert.equal(b2.predictionInput, false);
  assert.equal(b2.engineInput, false);

  assert.equal(b2.marketFirewall.marketBenchmarkOnly, true);
  assert.equal(b2.marketFirewall.predictionInput, false);
  assert.equal(b2.marketFirewall.engineInput, false);
  assert.equal(b2.marketFirewall.marketPriorUsed, false);
  assert.equal(b2.marketFirewall.marketImpliedProbabilityUsed, false);
  assert.equal(b2.marketFirewall.favoriteStatusUsed, false);
  assert.equal(b2.marketFirewall.oddsApiLiveCalls, 0);

  const calls = b2.providerCalls as Array<{
    endpointFamily: string;
    purpose: string;
  }>;
  assert.equal(
    calls.some((c) => /predictions/i.test(c.endpointFamily) || /predictions/i.test(c.purpose)),
    false,
  );
  assert.equal(
    calls.some((c) => /\/results?\b/i.test(c.endpointFamily)),
    false,
  );

  assert.equal(b2.coverageByDataset.mlb.schedule.state, "COLLECTED");
  assert.equal(b2.coverageByDataset.mlb.schedule.gamesCovered, 15);
  assert.equal(b2.coverageByDataset.mlb.starter.confirmed, 0);
  assert.equal(b2.coverageByDataset.mlb.weather.state, "NOT_SUPPORTED");
  assert.equal(b2.coverageByDataset.football.fixture.gamesCovered, 16);

  for (const g of mlb) {
    assert.equal(g.datasets.schedule, "COLLECTED");
    assert.notEqual(g.datasets.starter, "COLLECTED_CONFIRMED");
    assert.notEqual(g.coverageState, "COMPLETE");
    assert.equal(g.availableBeforeKickoff, true);
  }
  for (const g of footballMatched) {
    assert.equal(g.datasets.fixture, "COLLECTED");
    assert.notEqual(g.datasets.player, "COLLECTED");
    assert.equal(g.predictionInput ?? false, false);
    assert.ok(g.providerGameId);
    assert.equal(g.availableBeforeKickoff, true);
  }

  assert.equal(b2.summary.pregameEligibleForNextStage, 31);
  assert.equal(b2.historicalFirewall.stageAUnchanged, true);
  assert.equal(b2.historicalFirewall.b1Unchanged, true);
  assert.equal(b2.historicalFirewall.sealed20260829Unchanged, true);

  for (const sealed of SEALED_STAGE_A) {
    assert.equal(sha256File(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }
  for (const sealed of SEALED_2026_08_29) {
    assert.equal(sha256File(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }
  for (const sealed of SEALED_REGISTRY) {
    assert.equal(sha256File(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }

  const pngTracked = execSync(
    "git ls-files -- data/operator-observations/raw/2026-08-30 data/operator-observations/raw/2026-08-29",
    { cwd, encoding: "utf8" },
  );
  assert.equal(pngTracked.includes(".png"), false);

  console.log("PASS 2026-08-30 pregame input coverage v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
