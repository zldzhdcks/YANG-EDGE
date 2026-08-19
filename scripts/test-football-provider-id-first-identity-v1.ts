/**
 * Football Provider-ID First Identity Gate Audit tests.
 * Run: npm run test:football-provider-id-first-identity-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  AUDIT_REL,
  FROZEN_REL,
  SCHEMA,
  writeFootballProviderIdFirstIdentityAudit,
} from "./audit-football-provider-id-first-identity-v1";

const EXPECTED_FROZEN_SHA256 = {
  [FROZEN_REL.schedule]:
    "7318cf39f461d7e5423d82a670e23d040cf3083a6ea1b71dcc6414299b071440",
  [FROZEN_REL.openingReadiness]:
    "60159f736143c6059cacbbb30828ec16a41b950f581b5f2d0a220d535a151a58",
  [FROZEN_REL.freezeClose]:
    "7d5bbfceb284711d44eb191fba478be5b110e26b0a709250e0838bb8d3eaca8d",
} as const;

const HISTORICAL_REL = [
  FROZEN_REL.schedule,
  FROZEN_REL.openingReadiness,
  FROZEN_REL.freezeClose,
  "data/audits/2026-08-20-operator-scope-join-v1.json",
  "data/audits/2026-08-20-daily-scope-lock-v1.json",
  "data/audits/2026-08-20-pregame-input-close-v1.json",
  "data/research/football/2026-08-18-schedule-v1.json",
  "data/research/football/2026-08-18-official-result-v0.json",
] as const;

const FUNCTIONAL_SRC_GLOBS = [
  "src/lib/football/core",
  "src/lib/football/foundation",
  "src/lib/football/odds-1x2-v1",
  "src/lib/football/official-result-v0",
  "src/lib/football/prediction-snapshot-v0",
  "src/lib/football/market-baseline-prediction-v0",
  "src/lib/engine",
] as const;

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

async function main() {
  const cwd = process.cwd();
  const before = Object.fromEntries(
    HISTORICAL_REL.map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );
  for (const [rel, expected] of Object.entries(EXPECTED_FROZEN_SHA256)) {
    assert.equal(before[rel], expected, `frozen hash mismatch: ${rel}`);
  }

  const { document } = await writeFootballProviderIdFirstIdentityAudit(cwd);

  assert.equal(document.schemaVersion, SCHEMA);
  assert.equal(document.researchOnly, true);
  assert.equal(document.networkCalls, 0);
  assert.equal(document.predictionCalls, 0);
  assert.equal(document.resultCalls, 0);
  assert.equal(document.network.apiFootball, 0);
  assert.equal(document.network.theOddsApi, 0);
  assert.equal(document.frozenArtifactMutations, 0);
  assert.equal(document.mandatoryCompletion.total, "60%");
  assert.equal(document.mandatoryCompletion.unchanged, true);

  assert.ok(document.currentIdentitySoT);
  assert.equal(
    document.currentIdentitySoT.foundationIdentityGateUsedByCurrentSchedule,
    false,
  );
  assert.equal(
    document.currentIdentitySoT.coreTeamCatalogUsedByCurrentSchedule,
    true,
  );
  assert.equal(document.currentIdentitySoT.duplicateSoT, false);
  assert.equal(Array.isArray(document.duplicateIdentitySystems), true);
  assert.ok(document.duplicateIdentitySystems.length >= 2);

  const layers = document.layers;
  assert.ok(layers.providerFixture);
  assert.ok(layers.providerParticipants);
  assert.ok(layers.canonicalTeam);
  assert.ok(layers.operatorDisplay);

  const caseStudy = document.caseStudy20260820;
  assert.equal(caseStudy.scheduleGames, 20);
  assert.equal(caseStudy.currentMatched, 18);
  assert.equal(caseStudy.currentIdentityBlocked, 2);
  assert.ok(caseStudy.atleticoMalaga);
  assert.equal(caseStudy.atleticoMalaga.fixtureId, "1570334");
  assert.equal(caseStudy.atleticoMalaga.homeProviderTeamId, "530");
  assert.equal(caseStudy.atleticoMalaga.awayProviderTeamId, "535");
  assert.equal(caseStudy.atleticoMalaga.providerIdentityComplete, true);
  assert.equal(caseStudy.providerIdentityCompletenessOnBlockedRows, true);

  const hypo = document.memoryOnlyCounterfactual;
  assert.equal(hypo.artifactModified, false);
  assert.equal(hypo.current.matched, 18);
  assert.equal(hypo.current.blocked, 2);
  assert.equal(hypo.providerIdFirstHypothetical.providerIdentified, 18);
  assert.equal(hypo.providerIdFirstHypothetical.canonicalPending, 2);
  assert.equal(hypo.providerIdFirstHypothetical.invalidProviderIdentity, 0);

  const stages = document.stageDependencyMatrix.map((s) => s.stage);
  assert.deepEqual(stages, [
    "Schedule",
    "Operator Join",
    "Odds",
    "Pregame Snapshot",
    "Market Baseline Prediction",
    "Official Result",
    "Grade",
    "Review",
    "Scorecard",
  ]);
  for (const row of document.stageDependencyMatrix) {
    assert.equal(typeof row.needsFixtureId, "boolean");
    assert.equal(typeof row.needsProviderTeamId, "boolean");
    assert.equal(typeof row.needsCanonicalTeamId, "boolean");
    assert.equal(typeof row.needsTeamName, "boolean");
    assert.equal(typeof row.needsOddsBridge, "boolean");
    assert.equal(typeof row.canOperateWithoutPreseedCatalog, "boolean");
  }

  const optionKeys = Object.keys(document.options);
  assert.deepEqual(optionKeys, [
    "A_PRESEEDED_ONLY",
    "B_PROVIDER_ID_FIRST",
    "C_HYBRID",
  ]);
  assert.equal(document.decision.recommendation, "HYBRID");
  assert.equal(document.decision.rejected.length, 3);
  assert.equal(
    document.decision.recommendationCode === "HYBRID" &&
      !document.decision.rejected.includes("HYBRID"),
    true,
  );

  const paid = [
    "P0_REQUIRED",
    "P1_USEFUL",
    "OPTIONAL",
    "NOT_NEEDED_FOR_IDENTITY",
  ];
  assert.ok(paid.includes(document.paidApiImpact.paidPlanClassification));
  assert.ok(
    ["YES", "NO", "NOT_PROVEN"].includes(
      document.paidApiImpact.scheduleResultWithout2026TeamsEndpoint,
    ),
  );
  assert.ok(
    ["YES", "NO", "PARTIAL", "NOT_PROVEN"].includes(
      document.paidApiImpact.oddsPredictionWithout2026TeamsEndpoint,
    ),
  );

  assert.equal(document.kLeagueConflict.doesItInvalidateFixtureProviderIdentity, "NO");
  assert.equal(document.kLeagueConflict.classification, "B");
  assert.equal(document.leakage.providerFixtureIdPregameUse, "SAFE");
  assert.equal(document.canonicalIdStrategy.alreadyProviderSeeded, true);
  assert.equal(document.failureSemanticsProposal.enumAddedThisMission, false);
  assert.equal(document.minimalNextMission.autoExecute, false);
  assert.equal(
    document.decision.openingReadinessProjectionOnly.historicalScoresNotRewritten.EPL,
    65,
  );
  assert.equal(
    document.decision.openingReadinessProjectionOnly.historicalScoresNotRewritten.LA_LIGA,
    82,
  );

  const after = Object.fromEntries(
    HISTORICAL_REL.map((rel) => [rel, sha256File(path.join(cwd, rel))]),
  );
  assert.deepEqual(after, before);

  const frozenGit = execSync(
    `git diff --name-only -- ${HISTORICAL_REL.join(" ")}`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(frozenGit, "");

  const srcDiff = execSync(
    `git diff --name-only -- ${FUNCTIONAL_SRC_GLOBS.join(" ")}`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(srcDiff, "");

  assert.equal(existsSync(path.join(cwd, AUDIT_REL)), true);
  console.log("PASS football-provider-id-first-identity-v1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
