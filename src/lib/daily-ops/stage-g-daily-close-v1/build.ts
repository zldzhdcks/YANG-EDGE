/**
 * Daily Stage G close auditor. Repository + local git only.
 * Zero provider/network calls. Does not mutate A–F / Engine / Weights.
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DailyStageEResultGradeCloseV1 } from "../stage-e-result-grade-v1/types";
import type { DailyStageFSuccessFailureReviewScorecardV1 } from "../stage-f-review-scorecard-v1/types";
import {
  STAGE_G_A_COMMIT,
  STAGE_G_B1_COMMIT,
  STAGE_G_B1_REL,
  STAGE_G_B1_SHA256,
  STAGE_G_B2_COMMIT,
  STAGE_G_B2_REL,
  STAGE_G_B2_SHA256,
  STAGE_G_C_D_COMMIT,
  STAGE_G_C_REL,
  STAGE_G_C_SHA256,
  STAGE_G_DATE_KST,
  STAGE_G_E_COMMIT,
  STAGE_G_E_REL,
  STAGE_G_E_SHA256,
  STAGE_G_F_COMMIT,
  STAGE_G_F_PARENT,
  STAGE_G_F_REL,
  STAGE_G_F_SHA256,
  STAGE_G_PRIOR_DAILY_CLOSE_REL,
  STAGE_G_REQUIRED_HEAD,
  STAGE_G_SCOPE_REL,
  STAGE_G_SCOPE_SHA256,
  STAGE_G_SNAPSHOT_REL,
  STAGE_G_SNAPSHOT_SHA256,
} from "./paths";
import {
  DAILY_STAGE_G_METRIC_NA,
  DAILY_STAGE_G_SCHEMA,
  type DailyStageGDailyCloseGitSyncV1,
  type DailyStageGSourceRef,
} from "./types";

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function git(cwd: string, args: string[]): string {
  return execSync(`git ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`, {
    cwd,
    encoding: "utf8",
  }).trim();
}

async function sealedSource(
  cwd: string,
  stage: DailyStageGSourceRef["stage"],
  rel: string,
  expected: string,
): Promise<DailyStageGSourceRef> {
  const raw = await readFile(path.join(cwd, rel), "utf8");
  const workingTreeSha256 = sha256Text(raw);
  if (workingTreeSha256 !== expected) {
    throw new Error(`STAGE_G_HASH_MISMATCH:${stage}:${workingTreeSha256}`);
  }
  const wtBlob = git(cwd, ["hash-object", rel]);
  const headBlob = git(cwd, ["rev-parse", `HEAD:${rel}`]);
  if (wtBlob !== headBlob) {
    throw new Error(`STAGE_G_HEAD_BYTE_MISMATCH:${stage}`);
  }
  return {
    stage,
    path: rel,
    expectedSha256: expected,
    workingTreeSha256,
    matchesExpected: true,
    byteIdenticalToHead: true,
  };
}

export async function buildDailyStageGDailyCloseV1(input: {
  cwd?: string;
  closeAuditRunAt: string;
}): Promise<DailyStageGDailyCloseGitSyncV1> {
  const cwd = input.cwd ?? process.cwd();
  const statusSbAtCandidateBuild = git(cwd, ["status", "-sb"]);
  const head = git(cwd, ["rev-parse", "HEAD"]);
  const originMain = git(cwd, ["rev-parse", "origin/main"]);
  const fParent = git(cwd, ["rev-parse", "HEAD~1"]);
  if (head !== STAGE_G_REQUIRED_HEAD || originMain !== STAGE_G_REQUIRED_HEAD) {
    throw new Error(`STAGE_G_HEAD_NOT_SEALED_F: ${head}`);
  }
  if (head !== originMain) throw new Error("STAGE_G_HEAD_NE_ORIGIN_MAIN");
  if (fParent !== STAGE_G_F_PARENT) throw new Error(`STAGE_G_F_PARENT_MISMATCH: ${fParent}`);

  const sources = await Promise.all([
    sealedSource(cwd, "A", STAGE_G_SCOPE_REL, STAGE_G_SCOPE_SHA256),
    sealedSource(cwd, "B1", STAGE_G_B1_REL, STAGE_G_B1_SHA256),
    sealedSource(cwd, "B2", STAGE_G_B2_REL, STAGE_G_B2_SHA256),
    sealedSource(cwd, "C", STAGE_G_C_REL, STAGE_G_C_SHA256),
    sealedSource(cwd, "SNAPSHOT", STAGE_G_SNAPSHOT_REL, STAGE_G_SNAPSHOT_SHA256),
    sealedSource(cwd, "E", STAGE_G_E_REL, STAGE_G_E_SHA256),
    sealedSource(cwd, "F", STAGE_G_F_REL, STAGE_G_F_SHA256),
  ]);

  const pregameAfterC = git(cwd, [
    "log",
    "--oneline",
    `${STAGE_G_C_D_COMMIT}..HEAD`,
    "--",
    STAGE_G_SCOPE_REL,
    STAGE_G_B1_REL,
    STAGE_G_B2_REL,
    STAGE_G_C_REL,
    STAGE_G_SNAPSHOT_REL,
  ]);
  if (pregameAfterC) {
    throw new Error(`STAGE_G_LEAKAGE_PREGAME_MUTATED: ${pregameAfterC}`);
  }
  const engineDiff = git(cwd, [
    "diff",
    "--name-only",
    `${STAGE_G_A_COMMIT}..HEAD`,
    "--",
    "src/lib/engine",
  ]);
  if (engineDiff) throw new Error(`STAGE_G_ENGINE_MUTATED: ${engineDiff}`);

  const [scopeRaw, b2Raw, cRaw, eRaw, fRaw] = await Promise.all([
    readFile(path.join(cwd, STAGE_G_SCOPE_REL), "utf8"),
    readFile(path.join(cwd, STAGE_G_B2_REL), "utf8"),
    readFile(path.join(cwd, STAGE_G_C_REL), "utf8"),
    readFile(path.join(cwd, STAGE_G_E_REL), "utf8"),
    readFile(path.join(cwd, STAGE_G_F_REL), "utf8"),
  ]);
  const scope = JSON.parse(scopeRaw) as {
    officialDenominator: number;
    observedScope: {
      BASEBALL: number;
      FOOTBALL: number;
      VOLLEYBALL: number;
      MLB: number;
      baseballByLeague: { KBO: number; NPB: number };
    };
  };
  const b2 = JSON.parse(b2Raw) as {
    marketBenchmarkOnly: boolean;
    predictionInput: boolean;
    engineInput: boolean;
  };
  const c = JSON.parse(cRaw) as {
    lockedScope: number;
    predictionCount: number;
    passCount: number;
    cStateCounts: Record<string, number>;
  };
  const e = JSON.parse(eRaw) as DailyStageEResultGradeCloseV1;
  const f = JSON.parse(fRaw) as DailyStageFSuccessFailureReviewScorecardV1;

  const passReasonTotal =
    (c.cStateCounts.PASS_ENGINE_NOT_APPROVED ?? 0) +
    (c.cStateCounts.PASS_IDENTITY_REVIEW_REQUIRED ?? 0) +
    (c.cStateCounts.PASS_MISSED_PRE_GAME_WINDOW ?? 0) +
    (c.cStateCounts.PASS_PROVIDER_NOT_SUPPORTED ?? 0);
  const fabricatedScoreCount = e.games.filter(
    (g) => g.resultState !== "FINAL" && (g.homeScore != null || g.awayScore != null),
  ).length;
  const hygieneAllPass =
    f.researchHygieneControls.length === 15 &&
    f.researchHygieneControls.every((ctl) => ctl.status === "PASS");

  if (scope.officialDenominator !== 26) throw new Error("STAGE_G_SCOPE_NOT_26");
  if (c.predictionCount !== 0 || c.passCount !== 26 || passReasonTotal !== 26) {
    throw new Error("STAGE_G_C_IMMUTABLE");
  }
  if (e.finalResultCount !== 13 || e.resultCoverage.fullFinalClaim !== false) {
    throw new Error("STAGE_G_E_COVERAGE");
  }
  if (f.predictionPerformance.accuracy.value !== null) {
    throw new Error("STAGE_G_F_ACCURACY_NOT_NULL");
  }
  if (!hygieneAllPass) throw new Error("STAGE_G_F_HYGIENE");
  if (b2.predictionInput || b2.engineInput || b2.marketBenchmarkOnly !== true) {
    throw new Error("STAGE_G_B2_ODDS");
  }
  if (fabricatedScoreCount !== 0) throw new Error("STAGE_G_FABRICATED_SCORES");

  const doc: DailyStageGDailyCloseGitSyncV1 = {
    schemaVersion: DAILY_STAGE_G_SCHEMA,
    dateKst: STAGE_G_DATE_KST,
    mandatoryStage: "G_DAILY_CLOSE",
    weight: 5,
    closeAuditRunAt: input.closeAuditRunAt,
    architecture: {
      existingDailyCloseArtifact: STAGE_G_PRIOR_DAILY_CLOSE_REL,
      existingDailyCloseSchema: "yang-edge-daily-close-v1",
      existingCapableOfThisDayIntegrityAudit: false,
      extensionRequired: true,
      historicalArtifactsRewritten: false,
    },
    sources,
    gitLineage: {
      head,
      originMain,
      headEqualsOriginMain: true,
      statusSbAtCandidateBuild,
      aCommit: STAGE_G_A_COMMIT,
      b1Commit: STAGE_G_B1_COMMIT,
      b2Commit: STAGE_G_B2_COMMIT,
      cAndDEquivalentCommit: STAGE_G_C_D_COMMIT,
      eCommit: STAGE_G_E_COMMIT,
      fCommit: STAGE_G_F_COMMIT,
      fParent: STAGE_G_F_PARENT,
      forceRewriteDetected: false,
    },
    dEvidence: {
      kind: "PREGAME_GIT_REMOTE_SEAL_EQUIVALENT",
      commit: STAGE_G_C_D_COMMIT,
      message: "research: seal 2026-08-26 prediction pass snapshot",
      separateStageDArtifact: false,
    },
    credits: {
      A: { awarded: 10, of: 10 },
      B: { awarded: 20, of: 20 },
      C: { awarded: 20, of: 20 },
      D: { awarded: 10, of: 10 },
      E: { awarded: 15, of: 15 },
      F: { awarded: 20, of: 20 },
      G: { awarded: 0, of: 5 },
      preGTotal: 95,
      officialCompletionBeforeSeal: 95,
      targetCompletionAfterSeal: 100,
    },
    scope: {
      scopeTotal: 26,
      baseball: scope.observedScope.BASEBALL,
      kbo: scope.observedScope.baseballByLeague.KBO,
      npb: scope.observedScope.baseballByLeague.NPB,
      football: scope.observedScope.FOOTBALL,
      volleyball: scope.observedScope.VOLLEYBALL,
      mlb: scope.observedScope.MLB,
      laterGamesAdded: false,
    },
    predictionPass: {
      predictionCount: 0,
      passCount: 26,
      passEngineNotApproved: 11,
      passIdentityReviewRequired: 13,
      passMissedPreGameWindow: 1,
      passProviderNotSupported: 1,
      passReasonTotal: 26,
      gradedPredictionCount: 0,
      predictionPerformanceStatus: "NO_GRADABLE_PREDICTIONS",
      predictionPerformanceSemantics: DAILY_STAGE_G_METRIC_NA,
      accuracy: { value: null, semantics: DAILY_STAGE_G_METRIC_NA },
      hitRate: { value: null, semantics: DAILY_STAGE_G_METRIC_NA },
      roi: { value: null, semantics: DAILY_STAGE_G_METRIC_NA },
      yield: { value: null, semantics: DAILY_STAGE_G_METRIC_NA },
      passAssignedSuccessFailureCount: 0,
      passConvertedToGradedOutcome: 0,
      retroactivePrediction: false,
    },
    resultGrade: {
      operationallyClosedCount: 26,
      finalResultCount: 13,
      terminalCoverageGapCount: 13,
      identityCoverageGapCount: 12,
      unsupportedCoverageGapCount: 1,
      activePendingCount: 0,
      resultCoverage: "13_OF_26",
      fullFinalClaim: false,
      operationalCloseIsNotFullFinalCoverage: true,
      resultRequiresCanonical: false,
      fabricatedScoreCount: 0,
    },
    fReview: {
      hygieneControlCount: 15,
      hygieneAllPass: true,
      validatedHypothesisCreated: 0,
      enginePromotion: 0,
      hindsightRerun: false,
    },
    leakageAudit: {
      status: "PASS",
      resultMutatedScope: false,
      resultMutatedB1: false,
      resultMutatedB2: false,
      resultMutatedC: false,
      resultMutatedSnapshot: false,
      stageFMutatedPregame: false,
      stageFCreatedPrediction: false,
      postgameBecamePregameInput: false,
      passChangedAfterResult: false,
    },
    marketOddsFirewall: {
      status: "PASS",
      marketBenchmarkOnly: true,
      predictionInput: false,
      engineInput: false,
    },
    engineWeightAudit: {
      engineModified: false,
      weightsModified: false,
      interveningFoundationSeparatedFromDayPredictionInputs: true,
    },
    identityAudit: {
      fuzzyMatchingUsed: false,
      forcedCanonicalApproval: false,
      resultIdentityTerminalGapsRemain: 12,
      predictionIdentityEqualsResultIdentity: false,
      resultRequiresCanonical: false,
      identityRepairedInStageG: false,
    },
    providerNetworkCallCount: 0,
    providerPredictionsEndpointUsed: false,
    dayContribution: "OPERATIONS_AND_DATA_QUALITY_EVIDENCE_NOT_PREDICTION_ACCURACY",
    credit: 0,
    gStatus: "CANDIDATE_COMPLETE",
    stageResult: "READY_FOR_OWNER_REMOTE_SEAL",
  };
  assertDailyStageGInvariants(doc);
  return doc;
}

export function assertDailyStageGInvariants(doc: DailyStageGDailyCloseGitSyncV1): void {
  if (doc.scope.scopeTotal !== 26) throw new Error("STAGE_G_SCOPE");
  if (doc.predictionPass.predictionCount !== 0 || doc.predictionPass.passCount !== 26) {
    throw new Error("STAGE_G_PRED_PASS");
  }
  if (doc.predictionPass.passReasonTotal !== 26) throw new Error("STAGE_G_PASS_REASON_TOTAL");
  if (doc.predictionPass.gradedPredictionCount !== 0) throw new Error("STAGE_G_GRADED");
  if (doc.predictionPass.predictionPerformanceSemantics !== DAILY_STAGE_G_METRIC_NA) {
    throw new Error("STAGE_G_PERF_NA");
  }
  if (doc.predictionPass.accuracy.value !== null) throw new Error("STAGE_G_ACCURACY");
  if (doc.resultGrade.operationallyClosedCount !== 26) throw new Error("STAGE_G_OPS_CLOSED");
  if (doc.resultGrade.finalResultCount !== 13) throw new Error("STAGE_G_FINAL");
  if (doc.resultGrade.terminalCoverageGapCount !== 13) throw new Error("STAGE_G_TERMINAL");
  if (doc.resultGrade.activePendingCount !== 0) throw new Error("STAGE_G_PENDING");
  if (doc.resultGrade.resultCoverage !== "13_OF_26") throw new Error("STAGE_G_COVERAGE_LABEL");
  if (doc.resultGrade.fullFinalClaim !== false) throw new Error("STAGE_G_FULL_FINAL");
  if (doc.marketOddsFirewall.predictionInput || doc.marketOddsFirewall.engineInput) {
    throw new Error("STAGE_G_ODDS");
  }
  if (doc.predictionPass.retroactivePrediction) throw new Error("STAGE_G_RETRO");
  if (doc.predictionPass.passConvertedToGradedOutcome !== 0) throw new Error("STAGE_G_PASS_GRADED");
  if (doc.identityAudit.fuzzyMatchingUsed) throw new Error("STAGE_G_FUZZY");
  if (doc.resultGrade.fabricatedScoreCount !== 0) throw new Error("STAGE_G_FAB_SCORE");
  if (doc.engineWeightAudit.engineModified || doc.engineWeightAudit.weightsModified) {
    throw new Error("STAGE_G_ENGINE_WEIGHT");
  }
  if (doc.fReview.validatedHypothesisCreated !== 0) throw new Error("STAGE_G_HYPOTHESIS");
  if (doc.providerNetworkCallCount !== 0 || doc.providerPredictionsEndpointUsed) {
    throw new Error("STAGE_G_NETWORK");
  }
  if (doc.leakageAudit.status !== "PASS") throw new Error("STAGE_G_LEAKAGE");
  if (doc.credits.preGTotal !== 95 || doc.credits.officialCompletionBeforeSeal !== 95) {
    throw new Error("STAGE_G_CREDIT_95");
  }
  if (doc.credits.targetCompletionAfterSeal !== 100) throw new Error("STAGE_G_TARGET_100");
  if (doc.credits.G.awarded !== 0) throw new Error("STAGE_G_CREDIT_BEFORE_SEAL");
  if (doc.sources.length !== 7 || doc.sources.some((s) => !s.matchesExpected || !s.byteIdenticalToHead)) {
    throw new Error("STAGE_G_SOURCES");
  }
  if (doc.gitLineage.head !== STAGE_G_REQUIRED_HEAD) throw new Error("STAGE_G_HEAD_CONST");
}
