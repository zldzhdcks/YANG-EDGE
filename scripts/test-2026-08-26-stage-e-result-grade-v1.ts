/**
 * 2026-08-26 Stage E Result + Grade tests.
 * Synthetic provider payloads. Zero requirement for live calls in this file.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  STAGE_E_B1_REL,
  STAGE_E_CLOSE_REL,
  STAGE_E_C_RECONCILIATION_REL,
  STAGE_E_C_RECONCILIATION_SHA256,
  STAGE_E_SNAPSHOT_REL,
  STAGE_E_SNAPSHOT_SHA256,
  assertDailyStageEInvariants,
  buildDailyStageEResultGradeV1,
  deriveDailyStageEStatus,
  type StageEB1Game,
  type StageEBaseballGameNorm,
} from "../src/lib/daily-ops/stage-e-result-grade-v1";
import type { FixtureRaw } from "../src/lib/football/types";

const SEALED = [
  STAGE_E_C_RECONCILIATION_REL,
  STAGE_E_SNAPSHOT_REL,
  "data/audits/2026-08-26-daily-scope-lock-v1.json",
  "data/audits/2026-08-26-schedule-identity-reconciliation-v1.json",
  "data/audits/2026-08-26-pregame-input-odds-coverage-v1.json",
] as const;

function shaFile(rel: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(process.cwd(), rel), "utf8"))
    .digest("hex");
}

function baseballFromB1(
  b1: StageEB1Game,
  status: string,
  homeScore: number | null,
  awayScore: number | null,
): StageEBaseballGameNorm {
  return {
    providerGameId: b1.providerFixtureId!,
    providerStatusRaw: status,
    homeTeamProviderId: b1.providerHomeTeamId ?? null,
    awayTeamProviderId: b1.providerAwayTeamId ?? null,
    homeScore,
    awayScore,
  };
}

function footballFixture(id: string, homeId: string, awayId: string, short: string, home: number | null, away: number | null): FixtureRaw {
  return {
    fixture: {
      id: Number(id),
      date: "2026-08-26T10:30:00+00:00",
      status: { short, long: short === "FT" ? "Match Finished" : "Live", elapsed: 90 },
    },
    league: { id: 292, name: "K League 1", season: 2026 },
    teams: {
      home: { id: Number(homeId), name: "Home", winner: home != null && away != null ? home > away : null },
      away: { id: Number(awayId), name: "Away", winner: home != null && away != null ? away > home : null },
    },
    goals: { home, away },
    score: {
      fulltime: { home, away },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

async function main() {
  const cwd = process.cwd();
  assert.equal(shaFile(STAGE_E_C_RECONCILIATION_REL), STAGE_E_C_RECONCILIATION_SHA256);
  assert.equal(shaFile(STAGE_E_SNAPSHOT_REL), STAGE_E_SNAPSHOT_SHA256);

  const b1 = JSON.parse(readFileSync(path.join(cwd, STAGE_E_B1_REL), "utf8")) as {
    games: StageEB1Game[];
  };
  const kboB1 = b1.games.filter((g) => g.sport === "KBO" && g.providerFixtureId);
  const npbB1 = b1.games.filter((g) => g.sport === "NPB" && g.providerFixtureId);
  const footballB1 = b1.games.filter((g) => g.sport === "FOOTBALL" && g.providerFixtureId);
  assert.equal(kboB1.length, 5);
  assert.equal(npbB1.length, 6);
  assert.ok(footballB1.length >= 2);

  const kbo = kboB1.map((g, i) => baseballFromB1(g, "FT", 3 + i, 1));
  const npb = npbB1.map((g, i) =>
    i === 0
      ? baseballFromB1(g, "IN5", 2, 2)
      : baseballFromB1(g, "FT", 4, 2),
  );
  const footballFixtures = new Map<string, FixtureRaw>();
  for (const row of footballB1) {
    footballFixtures.set(
      row.providerFixtureId!,
      footballFixture(
        row.providerFixtureId!,
        row.providerHomeTeamId ?? "0",
        row.providerAwayTeamId ?? "0",
        "FT",
        1,
        0,
      ),
    );
  }

  const doc = await buildDailyStageEResultGradeV1({
    cwd,
    resultRunAt: "2026-08-26T14:00:00.000Z",
    baseballGames: { kbo, npb },
    footballFixtures,
  });
  assertDailyStageEInvariants(doc);

  assert.equal(doc.lockedScope, 26);
  assert.equal(doc.accountedFor, 26);
  assert.equal(doc.predictionCount, 0);
  assert.equal(doc.passCount, 26);
  assert.equal(doc.gradedPredictionCount, 0);
  assert.equal(doc.passHitMissCount, 0);
  assert.equal(doc.passWinLossCount, 0);
  assert.equal(doc.gradeStatus, "NOT_GRADABLE");
  assert.equal(doc.resultRequiresCanonical, false);
  assert.equal(doc.fuzzyResultMatching, false);
  assert.equal(doc.engineConnected, false);
  assert.equal(doc.predictionConnected, false);
  assert.equal(doc.marketOddsUsedForGrade, false);
  assert.equal(doc.providerPredictionsEndpointUsed, false);
  assert.equal(doc.playerContextP1EndpointsUsed, false);
  assert.equal(doc.officialMandatoryCompletionRemainsPct, 60);

  const volleyball = doc.games.filter((g) => g.sport === "VOLLEYBALL");
  assert.equal(volleyball.length, 1);
  assert.equal(volleyball[0]!.resultState, "UNSUPPORTED");
  assert.equal(volleyball[0]!.coverageGapClass, "RESULT_PROVIDER_UNSUPPORTED_TERMINAL");
  assert.equal(volleyball[0]!.closeClass, "RESULT_PROVIDER_UNSUPPORTED_TERMINAL");
  assert.equal(volleyball[0]!.gradeState, "NOT_GRADABLE");
  assert.equal(volleyball[0]!.homeScore, null);

  const kboRows = doc.games.filter((g) => g.sport === "KBO");
  assert.equal(kboRows.length, 5);
  assert.equal(kboRows.every((g) => g.resultState === "FINAL"), true);
  assert.equal(kboRows.every((g) => g.homeScore != null && g.awayScore != null), true);
  assert.equal(kboRows.every((g) => g.gradeState === "NOT_GRADABLE"), true);

  const npbLive = doc.games.find((g) => g.providerFixtureId === npbB1[0]!.providerFixtureId);
  assert.equal(npbLive?.resultState, "LIVE");
  assert.equal(npbLive?.homeScore, null);
  assert.equal(npbLive?.awayScore, null);

  const footballUnresolved = doc.games.filter(
    (g) => g.sport === "FOOTBALL" && g.resultIdentityState === "IDENTITY_UNRESOLVED",
  );
  assert.ok(footballUnresolved.length >= 10);
  assert.equal(footballUnresolved.every((g) => g.homeScore == null), true);

  const footballMatched = doc.games.filter(
    (g) => g.sport === "FOOTBALL" && g.resultIdentityState === "MATCHED",
  );
  assert.ok(footballMatched.length >= 2);
  assert.equal(footballMatched.every((g) => g.resultState === "FINAL"), true);

  assert.equal(doc.games.every((g) => g.predictionHit === null), true);
  assert.equal(
    doc.games.every((g) => !["WIN", "LOSS", "HIT", "MISS", "CORRECT", "INCORRECT"].includes(g.gradeState)),
    true,
  );
  assert.equal(doc.eStatus, "PARTIAL");
  assert.equal(deriveDailyStageEStatus(doc.games), "PARTIAL");
  assert.equal(doc.activePendingCount >= 1, true);
  assert.equal(doc.scopeTotal, 26);
  assert.equal(doc.credit, 0);
  assert.equal(doc.resultCoverage.fullFinalClaim, false);
  assert.notEqual(doc.resultCoverage.finalOfScope, "26_OF_26");
  assert.equal(doc.stageResult, "PARTIAL_ACTIVE_RESULT_PENDING");

  const identityGaps = doc.games.filter(
    (g) => g.coverageGapClass === "RESULT_IDENTITY_UNRESOLVED_TERMINAL",
  );
  assert.equal(identityGaps.length, 12);
  assert.equal(identityGaps.every((g) => g.homeScore == null && g.awayScore == null), true);
  assert.equal(identityGaps.every((g) => g.providerFixtureId == null), true);
  assert.equal(identityGaps.every((g) => g.fuzzyMatchingUsed === false), true);
  assert.equal(identityGaps.every((g) => g.resultState !== "LIVE"), true);

  const liveRows = doc.games.filter((g) => g.resultState === "LIVE");
  assert.equal(liveRows.every((g) => g.closeClass === "ACTIVE_RESULT_PENDING"), true);
  assert.equal(liveRows.every((g) => g.coverageGapClass == null), true);

  const allMatchedFinal = await buildDailyStageEResultGradeV1({
    cwd,
    resultRunAt: "2026-08-26T14:00:00.000Z",
    baseballGames: {
      kbo,
      npb: npbB1.map((g) => baseballFromB1(g, "FT", 4, 2)),
    },
    footballFixtures,
  });
  assertDailyStageEInvariants(allMatchedFinal);
  assert.equal(allMatchedFinal.unresolvedResultCount, 12);
  assert.equal(allMatchedFinal.unsupportedResultCount, 1);
  assert.equal(allMatchedFinal.identityCoverageGapCount, 12);
  assert.equal(allMatchedFinal.unsupportedCoverageGapCount, 1);
  assert.equal(allMatchedFinal.terminalCoverageGapCount, 13);
  assert.equal(allMatchedFinal.finalResultCount, 13);
  assert.equal(allMatchedFinal.activePendingCount, 0);
  assert.equal(allMatchedFinal.operationallyClosedCount, 26);
  assert.equal(allMatchedFinal.scopeTotal, 26);
  assert.equal(allMatchedFinal.eStatus, "CANDIDATE_COMPLETE");
  assert.equal(
    allMatchedFinal.stageResult,
    "COMPLETED_WITH_RESULT_COVERAGE_GAPS_AND_NOT_GRADABLE",
  );
  assert.equal(allMatchedFinal.resultCoverage.fullFinalClaim, false);
  assert.equal(allMatchedFinal.resultCoverage.finalOfScope, "13_OF_26");
  assert.equal(allMatchedFinal.gradedPredictionCount, 0);
  assert.equal(allMatchedFinal.passHitMissCount, 0);
  assert.equal(
    allMatchedFinal.games.filter((g) => g.resultState === "IDENTITY_UNRESOLVED").every(
      (g) => g.homeScore == null && g.awayScore == null,
    ),
    true,
  );

  const liveFootballFixtures = new Map(footballFixtures);
  const asean = footballB1.find((g) => g.providerFixtureId === "1630226");
  assert.ok(asean);
  liveFootballFixtures.set(
    "1630226",
    footballFixture(
      "1630226",
      asean.providerHomeTeamId ?? "0",
      asean.providerAwayTeamId ?? "0",
      "2H",
      null,
      null,
    ),
  );
  const liveExact = await buildDailyStageEResultGradeV1({
    cwd,
    resultRunAt: "2026-08-26T14:00:00.000Z",
    baseballGames: {
      kbo,
      npb: npbB1.map((g) => baseballFromB1(g, "FT", 4, 2)),
    },
    footballFixtures: liveFootballFixtures,
  });
  assertDailyStageEInvariants(liveExact);
  const aseanRow = liveExact.games.find((g) => g.providerFixtureId === "1630226");
  assert.equal(aseanRow?.resultState, "LIVE");
  assert.equal(aseanRow?.closeClass, "ACTIVE_RESULT_PENDING");
  assert.equal(aseanRow?.coverageGapClass, null);
  assert.equal(aseanRow?.exactResultLookupAvailable, true);
  assert.equal(aseanRow?.homeScore, null);
  assert.equal(liveExact.eStatus, "PARTIAL");
  assert.equal(liveExact.activePendingCount, 1);
  assert.equal(liveExact.operationallyClosedCount, 25);
  assert.equal(liveExact.finalResultCount, 12);

  const liveForbidden = "LIVE_PROVIDER_FORBIDDEN_DURING_STAGE_E_TEST";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error(liveForbidden);
  };
  try {
    const replay = await buildDailyStageEResultGradeV1({
      cwd,
      resultRunAt: "2026-08-26T14:00:00.000Z",
      baseballGames: { kbo, npb },
      footballFixtures,
    });
    assert.equal(JSON.stringify(replay), JSON.stringify(doc));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(shaFile(STAGE_E_C_RECONCILIATION_REL), STAGE_E_C_RECONCILIATION_SHA256);
  assert.equal(shaFile(STAGE_E_SNAPSHOT_REL), STAGE_E_SNAPSHOT_SHA256);

  const sealedDiff = execSync(
    `git diff --name-only -- ${SEALED.join(" ")} src/lib/engine src/app/analysis`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(sealedDiff, "");

  if (existsSync(path.join(cwd, STAGE_E_CLOSE_REL))) {
    const written = JSON.parse(readFileSync(path.join(cwd, STAGE_E_CLOSE_REL), "utf8")) as {
      lockedScope: number;
      accountedFor: number;
      predictionCount: number;
      passCount: number;
      gradedPredictionCount: number;
      gradeStatus: string;
      games: Array<{ predictionHit: null; gradeState: string; predictionCreated: boolean }>;
      resultRequiresCanonical: boolean;
      engineConnected: boolean;
      predictionConnected: boolean;
    };
    assert.equal(written.lockedScope, 26);
    assert.equal(written.accountedFor, 26);
    assert.equal(written.predictionCount, 0);
    assert.equal(written.passCount, 26);
    assert.equal(written.gradedPredictionCount, 0);
    assert.equal(written.gradeStatus, "NOT_GRADABLE");
    assert.equal(written.resultRequiresCanonical, false);
    assert.equal(written.engineConnected, false);
    assert.equal(written.predictionConnected, false);
    assert.equal(written.games.every((g) => g.predictionHit === null), true);
    assert.equal(written.games.every((g) => g.gradeState === "NOT_GRADABLE"), true);
    assert.equal(written.games.every((g) => g.predictionCreated === false), true);
    if ("activePendingCount" in written) {
      const v2 = written as typeof written & {
        activePendingCount: number;
        resultCoverage: { fullFinalClaim: boolean; finalOfScope: string };
        games: Array<{ resultState: string; coverageGapClass: string | null }>;
      };
      assert.equal(v2.resultCoverage.fullFinalClaim, false);
      assert.notEqual(v2.resultCoverage.finalOfScope, "26_OF_26");
      assert.equal(
        v2.games.every((g) => g.resultState !== "LIVE" || g.coverageGapClass == null),
        true,
      );
    }
  }

  console.log("test:2026-08-26-stage-e-result-grade-v1 OK", {
    lockedScope: 26,
    predictionCount: 0,
    passCount: 26,
    gradedPredictionCount: 0,
    eStatus: doc.eStatus,
    fetchCalls: 0,
  });
}

main();
