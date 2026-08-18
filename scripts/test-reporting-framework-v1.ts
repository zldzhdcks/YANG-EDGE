/**
 * Reporting Framework v1 tests.
 * Run: npm run test:reporting-framework-v1
 *
 * Read-only vs live research artifacts. Never writes 리포트/ or prediction/result/grade.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assessDailyMandatory,
  aggregateMonthlyFromRawArtifacts,
  assertCanonicalWritePath,
  buildDeterministicMetricsHash,
  buildWeeklyReportV1,
  classifyArtifactKind,
  classifySample,
  defaultSevenStageTemplate,
  FORBIDDEN_PRESENTATION_DIR,
  futureReportPlaceholder,
  inventoryRawArtifacts,
  isFootballMarketBaseline,
  MANDATORY_STAGE_WEIGHTS,
  provenanceChainFor,
  REPORTING_ZERO_WRITES,
  summarizeLeakage,
  summarizeMissingDays,
  summarizeSamples,
} from "../src/lib/reporting/v1";
import type { DailyMandatoryAssessment } from "../src/lib/reporting/v1";
import type { ClassifiedSample } from "../src/lib/reporting/v1";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function allDone(): ReturnType<typeof defaultSevenStageTemplate> {
  return defaultSevenStageTemplate({
    A_SLATE_SCHEDULE: "DONE",
    B_PREGAME_INPUT: "DONE",
    C_PREGAME_FREEZE: "DONE",
    D_PREGAME_GIT_SEAL: "DONE",
    E_RESULT_GRADE: "DONE",
    F_REVIEW_SCORECARD: "DONE",
    G_DAILY_CLOSE: "DONE",
  });
}

function writeJson(root: string, rel: string, body: unknown): void {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

async function main() {
  console.log("=== test-reporting-framework-v1 ===");

  const weights = Object.values(MANDATORY_STAGE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(weights, 100, "weights total 100");

  const full = assessDailyMandatory({
    dateKst: "2026-08-18",
    sport: "MLB",
    stages: allDone(),
    developmentCommitCount: 12,
  });
  assert.equal(full.mandatoryCompletionPercent, 100);
  assert.equal(full.completionStatus, "COMPLETE");
  assert.equal(full.operationallyClosed, true);
  assert.equal(full.developmentCommitCountIgnored, 12);

  const waiting = assessDailyMandatory({
    dateKst: "2026-08-18",
    sport: "MLB",
    stages: defaultSevenStageTemplate({
      A_SLATE_SCHEDULE: "DONE",
      B_PREGAME_INPUT: "DONE",
      C_PREGAME_FREEZE: "DONE",
      D_PREGAME_GIT_SEAL: "DONE",
      E_RESULT_GRADE: "WAITING_TIME_GATE",
      F_REVIEW_SCORECARD: "WAITING_TIME_GATE",
      G_DAILY_CLOSE: "WAITING_TIME_GATE",
    }),
  });
  assert.notEqual(waiting.mandatoryCompletionPercent, 100);
  assert.equal(waiting.completionStatus, "WAITING_TIME_GATE");
  assert.equal(waiting.mandatoryCompletionPercent, 60);

  const pass = assessDailyMandatory({
    dateKst: "2026-08-18",
    sport: "MLB",
    stages: defaultSevenStageTemplate({
      A_SLATE_SCHEDULE: "DONE",
      B_PREGAME_INPUT: "DONE",
      C_PREGAME_FREEZE: "VALID_PASS",
      D_PREGAME_GIT_SEAL: "DONE",
      E_RESULT_GRADE: "DONE",
      F_REVIEW_SCORECARD: "DONE",
      G_DAILY_CLOSE: "DONE",
    }),
  });
  assert.equal(pass.mandatoryCompletionPercent, 100);
  assert.ok(pass.researchValidStages.includes("C_PREGAME_FREEZE"));

  const blocked = assessDailyMandatory({
    dateKst: "2026-08-18",
    sport: "MLB",
    stages: defaultSevenStageTemplate({
      A_SLATE_SCHEDULE: "DONE",
      B_PREGAME_INPUT: "DONE",
      C_PREGAME_FREEZE: "VALID_BLOCKED",
      D_PREGAME_GIT_SEAL: "DONE",
      E_RESULT_GRADE: "DONE",
      F_REVIEW_SCORECARD: "DONE",
      G_DAILY_CLOSE: "DONE",
    }),
  });
  assert.equal(blocked.mandatoryCompletionPercent, 100);
  assert.equal(blocked.operationallyClosed, true);
  assert.ok(blocked.blockedExcludedStages.includes("C_PREGAME_FREEZE"));
  assert.equal(blocked.researchValidStages.includes("C_PREGAME_FREEZE"), false);

  const missing = assessDailyMandatory({
    dateKst: "2026-08-18",
    sport: "MLB",
    stages: defaultSevenStageTemplate({
      A_SLATE_SCHEDULE: "DONE",
      B_PREGAME_INPUT: "DONE",
      C_PREGAME_FREEZE: "DONE",
      D_PREGAME_GIT_SEAL: "DONE",
      E_RESULT_GRADE: "MISSING",
      F_REVIEW_SCORECARD: "MISSING",
      G_DAILY_CLOSE: "MISSING",
    }),
  });
  assert.ok(missing.mandatoryCompletionPercent < 100);
  assert.equal(missing.completionStatus, "INCOMPLETE");

  const postHocNa = assessDailyMandatory({
    dateKst: "2026-08-18",
    sport: "MLB",
    opsStartedAt: "2026-08-18T00:00:00.000Z",
    stages: defaultSevenStageTemplate({
      A_SLATE_SCHEDULE: "DONE",
      B_PREGAME_INPUT: "DONE",
      C_PREGAME_FREEZE: "DONE",
      D_PREGAME_GIT_SEAL: "DONE",
      E_RESULT_GRADE: "N/A_PREDECLARED",
      F_REVIEW_SCORECARD: "DONE",
      G_DAILY_CLOSE: "DONE",
    }).map((s) =>
      s.stage === "E_RESULT_GRADE"
        ? {
            ...s,
            na: {
              scopeLockedAt: "2026-08-18T12:00:00.000Z",
              reason: "could not finish today",
              evidenceRel: null,
              source: "operator-claim",
            },
          }
        : s,
    ),
  });
  assert.equal(
    postHocNa.stages.find((s) => s.stage === "E_RESULT_GRADE")?.status,
    "NOT_DERIVABLE",
  );
  assert.equal(postHocNa.completionStatus, "NOT_DERIVABLE");

  const predeclared = assessDailyMandatory({
    dateKst: "2026-08-18",
    sport: "FOOTBALL",
    opsStartedAt: "2026-08-18T10:00:00.000Z",
    stages: defaultSevenStageTemplate({
      A_SLATE_SCHEDULE: "DONE",
      B_PREGAME_INPUT: "DONE",
      C_PREGAME_FREEZE: "DONE",
      D_PREGAME_GIT_SEAL: "DONE",
      E_RESULT_GRADE: "DONE",
      F_REVIEW_SCORECARD: "N/A_PREDECLARED",
      G_DAILY_CLOSE: "DONE",
    }).map((s) =>
      s.stage === "F_REVIEW_SCORECARD"
        ? {
            ...s,
            na: {
              scopeLockedAt: "2026-08-17T00:00:00.000Z",
              reason: "football daily review runner not in declared scope",
              evidenceRel: "package.json",
              source: "declared-operational-scope",
            },
          }
        : s,
    ),
  });
  assert.equal(predeclared.mandatoryCompletionPercent, 100);

  const emptyScope = summarizeMissingDays({
    declaredScope: null,
    daysWithEvidence: ["2026-08-18"],
    assessments: [full],
  });
  assert.equal(emptyScope.expectedOperatingDays.status, "NOT_DERIVABLE");
  assert.equal(emptyScope.missingDays.length, 0);

  const missingDays = summarizeMissingDays({
    declaredScope: {
      sport: "MLB",
      dates: ["2026-08-16", "2026-08-17", "2026-08-18"],
      scopeLockedAt: "2026-08-16T00:00:00.000Z",
      reason: "MLB operating window",
      evidenceRel: null,
      source: "test-scope",
    },
    daysWithEvidence: ["2026-08-17", "2026-08-18"],
    assessments: [
      {
        ...full,
        dateKst: "2026-08-18",
      },
      {
        ...waiting,
        dateKst: "2026-08-17",
        operationallyClosed: false,
      },
    ],
  });
  assert.deepEqual(missingDays.missingDays, ["2026-08-16"]);
  assert.deepEqual(missingDays.fullyClosedDays, ["2026-08-18"]);
  assert.deepEqual(missingDays.partiallyClosedDays, ["2026-08-17"]);

  const samples: ClassifiedSample[] = [
    classifySample({
      sport: "MLB",
      dateKst: "2026-08-18",
      matchKey: "good-1",
      pipelineClass: "GOOD",
      officialStatus: "ELIGIBLE",
    }),
    classifySample({
      sport: "MLB",
      dateKst: "2026-08-18",
      matchKey: "pass-1",
      pipelineClass: "PASS",
      officialStatus: "PASS",
    }),
    classifySample({
      sport: "MLB",
      dateKst: "2026-08-18",
      matchKey: "blocked-1",
      pipelineClass: "BLOCKED",
      officialStatus: "BLOCKED",
    }),
    classifySample({
      sport: "FOOTBALL",
      dateKst: "2026-08-18",
      matchKey: "soccer-api-football-1570337",
      pipelineClass: "MARKET_BASELINE",
      predictionClass: "MARKET_BASELINE",
      model: "NONE",
      engine: "NONE",
      recommendation: "NONE",
      officialPickCount: 0,
    }),
  ];
  const sampleSum = summarizeSamples(samples);
  assert.equal(sampleSum.goodAccuracyDenominator, 1);
  assert.equal(sampleSum.passOutcome, 1);
  assert.equal(sampleSum.blockedExcluded, 1);
  assert.equal(sampleSum.marketBaselineBenchmark, 1);
  assert.equal(sampleSum.researchValidSample, 1);
  assert.equal(samples[1]!.inGoodAccuracyDenominator, false);
  assert.equal(samples[2]!.inResearchValidSample, false);
  assert.equal(samples[3]!.inResearchValidSample, false);
  assert.equal(isFootballMarketBaseline(samples[3]!), true);

  const noAudit = summarizeLeakage({ auditPresent: false });
  assert.equal(noAudit.leakageCount, "NOT_DERIVABLE");
  assert.equal(noAudit.leakageStatus, "NOT_DERIVABLE");
  const passAudit = summarizeLeakage({
    auditPresent: true,
    auditStatus: "PASS",
    confirmedCount: 0,
    potentialCount: 0,
  });
  assert.equal(passAudit.leakageCount, 0);

  const tmp = mkdtempSync(path.join(tmpdir(), "reporting-v1-"));
  writeJson(tmp, "data/research/mlb/2026-08-18-schedule-v1.json", {
    schemaVersion: "mlb-schedule-v1",
    dateKst: "2026-08-18",
    meta: { dateKst: "2026-08-18" },
    games: [{ gamePk: 1, internalGameId: "g1" }],
  });
  writeJson(tmp, "data/research/mlb/2026-08-18-official-results-v1.json", {
    schemaVersion: "mlb-official-results-v1",
    dateKst: "2026-08-18",
    games: [{ gamePk: 1, status: "FINAL" }],
  });
  writeJson(tmp, "data/research/football/2026-08-18-market-baseline-prediction-v0.json", {
    meta: {
      schemaVersion: "football-market-baseline-prediction-v0",
      dateKst: "2026-08-18",
      predictionClass: "MARKET_BASELINE",
      model: "NONE",
      engine: "NONE",
      recommendation: "NONE",
      officialPickCount: 0,
    },
    matches: [{ matchId: "m1" }],
  });
  writeJson(tmp, "data/research/reporting/2026-08-18-weekly-v1.json", {
    meta: { reportType: "WEEKLY", generatedAt: "x" },
    copied: { averageMandatoryCompletion: 99 },
  });
  writeJson(tmp, path.join(FORBIDDEN_PRESENTATION_DIR, "fake.pptx.json"), {
    slides: [{ n: 1 }],
  });

  const invDefault = await inventoryRawArtifacts({
    periodStart: "2026-08-18",
    periodEnd: "2026-08-18",
    cwd: tmp,
  });
  assert.equal(
    invDefault.sourceArtifacts.some((a) => a.path.includes("/reporting/")),
    false,
    "default inventory must not read reporting/ as source",
  );

  const inv = await inventoryRawArtifacts({
    periodStart: "2026-08-18",
    periodEnd: "2026-08-18",
    cwd: tmp,
    extraRels: ["data/research/reporting/2026-08-18-weekly-v1.json"],
  });
  assert.equal(inv.writeAudit.predictionWrite, 0);
  assert.equal(inv.writeAudit.providerCalls, 0);
  assert.equal(inv.writeAudit.autoApply, false);
  assert.ok(inv.sourceArtifacts.some((a) => a.kind === "SCHEDULE"));
  assert.ok(inv.sourceArtifacts.some((a) => a.kind === "MARKET_BASELINE"));
  assert.equal(
    inv.sourceArtifacts.some((a) => a.kind === "WEEKLY_REPORT_NON_SOURCE"),
    false,
  );
  assert.ok(
    inv.excludedNonSources.some((a) => a.kind === "WEEKLY_REPORT_NON_SOURCE"),
  );
  assert.equal(
    classifyArtifactKind({
      rel: `${FORBIDDEN_PRESENTATION_DIR}/x.pptx`,
      schemaVersion: null,
    }),
    "PRESENTATION_NON_SOURCE",
  );

  const assessments: DailyMandatoryAssessment[] = [full];
  const weekly = buildWeeklyReportV1({
    periodStart: "2026-08-18",
    periodEnd: "2026-08-18",
    sports: ["MLB", "FOOTBALL"],
    leagues: ["MLB", "La Liga"],
    generatedAt: "2026-08-18T13:00:00.000Z",
    gitCommit: "abc",
    engineVersion: null,
    inventory: inv,
    assessments,
    missing: missingDays,
    samples,
    leakage: noAudit,
  });
  assert.equal(weekly.meta.researchOnly, true);
  assert.equal(weekly.meta.autoApply, false);
  assert.equal(weekly.executive.engineChanged, false);
  assert.equal(weekly.executive.leakageCount, "NOT_DERIVABLE");
  assert.equal(weekly.executive.researchValidSample, 1);
  assert.equal(weekly.executive.marketBaselineValid, 1);
  assert.notEqual(weekly.meta.sourceArtifacts[0]?.kind, "WEEKLY_REPORT_NON_SOURCE");

  const weekly2 = buildWeeklyReportV1({
    ...{
      periodStart: "2026-08-18",
      periodEnd: "2026-08-18",
      sports: ["MLB", "FOOTBALL"] as const,
      leagues: ["MLB", "La Liga"],
      gitCommit: "abc",
      engineVersion: null,
      inventory: inv,
      assessments,
      missing: missingDays,
      samples,
      leakage: noAudit,
    },
    generatedAt: "2026-08-18T23:59:59.000Z",
    gitCommit: "def",
  });
  assert.equal(
    weekly.meta.deterministicMetricsHash,
    weekly2.meta.deterministicMetricsHash,
  );
  assert.notEqual(weekly.meta.generatedAt, weekly2.meta.generatedAt);

  const hashA = buildDeterministicMetricsHash({
    sourceManifest: inv.sourceArtifacts,
    metrics: { a: 1 },
    sampleClassifications: samples,
    pipelineClassifications: { GOOD: 1 },
  });
  const hashB = buildDeterministicMetricsHash({
    sourceManifest: inv.sourceArtifacts,
    metrics: { a: 1, generatedAt: "ignore-me" },
    sampleClassifications: samples,
    pipelineClassifications: { GOOD: 1 },
  });
  assert.equal(hashA, hashB);

  const monthly = aggregateMonthlyFromRawArtifacts({
    periodStart: "2026-08-16",
    periodEnd: "2026-08-18",
    sports: ["MLB"],
    generatedAt: "2026-08-18T13:00:00.000Z",
    gitCommit: "abc",
    engineVersion: null,
    inventory: inv,
    assessments,
    missing: missingDays,
    samples,
    leakage: noAudit,
  });
  assert.equal(monthly.meta.reportType, "MONTHLY");
  assert.equal(monthly.marketBaselineComparisonFoundation.mixed, false);
  assert.equal(
    monthly.hypothesisWatchlist[0]?.status,
    "INSUFFICIENT_SAMPLE",
  );
  assert.ok(monthly.mandatoryDailyCompletionTrend.length >= 1);
  assert.equal(
    monthly.meta.sourceArtifacts.some((a) => a.kind === "WEEKLY_REPORT_NON_SOURCE"),
    false,
  );

  assert.throws(
    () =>
      aggregateMonthlyFromRawArtifacts({
        periodStart: "2026-08-16",
        periodEnd: "2026-08-18",
        sports: ["MLB"],
        generatedAt: "t",
        gitCommit: null,
        engineVersion: null,
        inventory: inv,
        assessments,
        missing: missingDays,
        samples,
        leakage: noAudit,
        weeklyReports: [{ averageMandatoryCompletion: 99 }],
      } as never),
    /MONTHLY_WEEKLY_SUM_FORBIDDEN/,
  );

  assert.throws(
    () => assertCanonicalWritePath(`${FORBIDDEN_PRESENTATION_DIR}/x.pptx`),
    /REPORT_WRITE_FORBIDDEN_PRESENTATION_DIR/,
  );
  assert.doesNotThrow(() =>
    assertCanonicalWritePath("data/research/reporting/weekly-2026-08-18.json"),
  );

  const q = futureReportPlaceholder("QUARTERLY");
  assert.equal(q.status, "NOT_IMPLEMENTED");
  assert.equal(q.autoApply, false);

  assert.ok(provenanceChainFor("MLB"));
  assert.ok(provenanceChainFor("FOOTBALL"));
  assert.notDeepEqual(
    provenanceChainFor("MLB")?.bindings.map((b) => b.artifactKinds.join(",")),
    provenanceChainFor("FOOTBALL")?.bindings.map((b) => b.artifactKinds.join(",")),
  );

  const livePred = "data/predictions/mlb/2026-08-18.json";
  const liveSnap =
    "data/research/football/2026-08-18-prediction-snapshot-v0.json";
  const liveResult = "data/research/mlb/2026-08-18-official-results-v1.json";
  const liveGrade = "data/research/mlb/2026-08-18-graded-predictions-v1.json";
  const liveReview =
    "data/research/mlb/2026-08-18-daily-review-summary-v1.json";
  const before = {
    pred: sha256File(livePred),
    snap: sha256File(liveSnap),
    result: sha256File(liveResult),
    grade: sha256File(liveGrade),
    review: sha256File(liveReview),
    predM: statSync(livePred).mtimeMs,
  };
  const liveInv = await inventoryRawArtifacts({
    periodStart: "2026-08-18",
    periodEnd: "2026-08-18",
  });
  assert.equal(liveInv.writeAudit.predictionWrite, 0);
  assert.equal(liveInv.writeAudit.snapshotWrite, 0);
  assert.equal(liveInv.writeAudit.resultWrite, 0);
  assert.equal(liveInv.writeAudit.gradeWrite, 0);
  assert.equal(liveInv.writeAudit.reviewWrite, 0);
  assert.equal(liveInv.writeAudit.providerCalls, 0);
  assert.equal(liveInv.writeAudit.engineCalls, 0);
  const baseline = liveInv.artifacts.find((a) => a.kind === "MARKET_BASELINE");
  assert.ok(baseline);
  assert.equal(baseline?.predictionClass, "MARKET_BASELINE");
  assert.equal(baseline?.engine, "NONE");
  assert.equal(sha256File(livePred), before.pred);
  assert.equal(sha256File(liveSnap), before.snap);
  assert.equal(sha256File(liveResult), before.result);
  assert.equal(sha256File(liveGrade), before.grade);
  assert.equal(sha256File(liveReview), before.review);
  assert.equal(statSync(livePred).mtimeMs, before.predM);
  assert.equal(existsSync(path.join(process.cwd(), FORBIDDEN_PRESENTATION_DIR, "touched")), false);
  assert.deepEqual(REPORTING_ZERO_WRITES.autoApply, false);

  console.log("PASS reporting-framework-v1");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
