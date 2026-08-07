/**
 * MLB Daily Pregame Line v0 tests.
 * Run: npm run test:mlb-daily-pregame-v0
 * Mutation: dry-run / temp cwd only (repo prediction write 0).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  MLB_DAILY_PREGAME_STAGE_ORDER,
  artifactPaths,
  runMlbDailyPregameV0,
  buildMlbResearchGradeAdapterV0,
} from "../src/lib/mlb/daily-pregame-v0";

function hashFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function fingerprintTree(
  root: string,
  rels: string[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const rel of rels) {
    const abs = path.join(root, rel);
    out[rel] = existsSync(abs) ? hashFile(abs) : null;
  }
  return out;
}

async function main() {
  // --- Stage ordering ---
  assert.deepEqual(MLB_DAILY_PREGAME_STAGE_ORDER, [
    "SCHEDULE",
    "STARTER",
    "ODDS",
    "LINEUP",
    "INPUT_AUDIT",
    "PREDICTION_V0",
    "SNAPSHOT_VERIFY",
  ]);

  // --- stop-after / resume-from (isolated missing-schedule cwd) ---
  const emptyCwd = mkdtempSync(path.join(tmpdir(), "mlb-daily-v0-empty-"));
  const stopReport = await runMlbDailyPregameV0({
    dateKst: "2026-08-02",
    dryRun: true,
    noProvider: true,
    stopAfter: "SCHEDULE",
    cwd: emptyCwd,
  });
  assert.equal(stopReport.stages.length, 7);
  assert.equal(stopReport.stages[0]?.stage, "SCHEDULE");
  assert.equal(stopReport.stages[0]?.status, "BLOCKED");
  assert.ok(
    stopReport.stages[0]?.blockers.includes("SCHEDULE_ARTIFACT_MISSING"),
  );
  for (const s of stopReport.stages.slice(1)) {
    assert.equal(s.status, "SKIPPED", s.stage);
  }
  assert.equal(stopReport.providerCalls, 0);
  assert.equal(stopReport.writesPerformed, 0);
  assert.equal(stopReport.nextAction, "RUN_SCHEDULE_COLLECTION");
  assert.equal(stopReport.overall, "BLOCKED_MISSING_SCHEDULE");

  const resumeReport = await runMlbDailyPregameV0({
    dateKst: "2026-08-02",
    dryRun: true,
    noProvider: true,
    resumeFrom: "INPUT_AUDIT",
    stopAfter: "INPUT_AUDIT",
    cwd: emptyCwd,
  });
  assert.equal(resumeReport.stages[0]?.status, "SKIPPED");
  assert.equal(resumeReport.stages[4]?.stage, "INPUT_AUDIT");
  assert.equal(resumeReport.stages[4]?.status, "BLOCKED");
  assert.equal(resumeReport.providerCalls, 0);
  assert.equal(resumeReport.writesPerformed, 0);

  // When schedule exists in repo, stop-after SCHEDULE is ALREADY_COMPLETE
  const stopPresent = await runMlbDailyPregameV0({
    dateKst: "2026-08-02",
    dryRun: true,
    noProvider: true,
    stopAfter: "SCHEDULE",
  });
  assert.equal(stopPresent.stages[0]?.status, "ALREADY_COMPLETE");
  assert.equal(stopPresent.providerCalls, 0);
  assert.equal(stopPresent.writesPerformed, 0);

  // --- schedule missing JSON schema ---
  assert.equal(stopReport.schemaVersion, "mlb-daily-pregame-line-v0");
  assert.equal(typeof stopReport.generatedAt, "string");
  assert.ok(Array.isArray(stopReport.blockingIssues));
  assert.ok(stopReport.blockingIssues.includes("SCHEDULE_ARTIFACT_MISSING"));

  // --- Historical dry-run mutation 0 + prediction deterministic ---
  const dateHist = "2026-07-30";
  const cwd = process.cwd();
  const paths = artifactPaths(dateHist);
  const watch = [
    paths.schedule,
    paths.starter,
    paths.odds,
    paths.lineup,
    paths.summary,
    paths.prediction,
    paths.results,
    `data/predictions/mlb/2026-08-02.json`,
  ];
  const before = fingerprintTree(cwd, watch);

  assert.ok(existsSync(path.join(cwd, paths.schedule)), "need 07-30 schedule");
  assert.ok(existsSync(path.join(cwd, paths.summary)), "need 07-30 summary");

  const hist1 = await runMlbDailyPregameV0({
    dateKst: dateHist,
    dryRun: true,
    noProvider: true,
  });
  assert.equal(hist1.providerCalls, 0);
  assert.equal(hist1.writesPerformed, 0);
  assert.equal(hist1.dryRun, true);
  assert.ok(hist1.schedule);
  assert.ok(hist1.prediction);
  const hash1 = String(hist1.prediction?.predictionHashSha256 ?? "");
  assert.equal(hash1.length, 64);

  const hist2 = await runMlbDailyPregameV0({
    dateKst: dateHist,
    dryRun: true,
    noProvider: true,
  });
  assert.equal(
    String(hist2.prediction?.predictionHashSha256 ?? ""),
    hash1,
  );
  assert.equal(hist2.writesPerformed, 0);

  const pass = Number(hist1.prediction?.passCount ?? -1);
  const blocked = Number(hist1.prediction?.blockedCount ?? -1);
  const eligible = Number(hist1.prediction?.eligibleCount ?? -1);
  console.log("historical-daily", {
    pass,
    blocked,
    eligible,
    overall: hist1.overall,
    verify: hist1.stages.find((s) => s.stage === "SNAPSHOT_VERIFY")?.status,
  });
  assert.equal(pass, 2);
  assert.equal(blocked, 14);
  assert.equal(eligible, 0);
  assert.equal(
    hist1.stages.find((s) => s.stage === "SNAPSHOT_VERIFY")?.status,
    "SUCCESS",
  );
  assert.equal(hist1.overall, "READY_FOR_PREGAME_RUN");

  const after = fingerprintTree(cwd, watch);
  assert.deepEqual(after, before, "dry-run mutated watched artifacts");

  // --- Gate: after all commence + enforce → prediction blocked ---
  const afterStart = await runMlbDailyPregameV0({
    dateKst: dateHist,
    dryRun: true,
    noProvider: true,
    enforcePregameGates: true,
    asOf: "2099-01-01T00:00:00.000Z",
  });
  assert.equal(afterStart.overall, "BLOCKED_AFTER_START");
  assert.equal(
    afterStart.stages.find((s) => s.stage === "PREDICTION_V0")?.status,
    "BLOCKED",
  );
  assert.ok(afterStart.blockingIssues.includes("BLOCKED_AFTER_START"));
  assert.equal(afterStart.writesPerformed, 0);

  // --- Gate: odds artifact exists but collected=0 → not ALREADY_COMPLETE ---
  const date0803 = "2026-08-03";
  if (existsSync(path.join(cwd, artifactPaths(date0803).odds))) {
    const late = await runMlbDailyPregameV0({
      dateKst: date0803,
      dryRun: true,
      noProvider: true,
      enforcePregameGates: true,
      asOf: "2026-08-03T12:48:36.000Z",
      stopAfter: "INPUT_AUDIT",
    });
    const oddsStage = late.stages.find((s) => s.stage === "ODDS");
    assert.notEqual(oddsStage?.status, "ALREADY_COMPLETE");
    assert.ok(
      oddsStage?.blockers.includes("ODDS_MISSING_ALL") ||
        oddsStage?.warnings.includes("ODDS_MISSING_ALL") ||
        late.warnings.some((w) => /ODDS/i.test(w)),
    );
    // Continuity: odds incomplete no longer hard-blocks overall when stopping at INPUT_AUDIT
    // (prediction may still run as LIMITED_INPUT). Must not look like full READY freeze.
    assert.notEqual(late.overall, "READY_FOR_PREGAME_RUN");
    assert.equal(late.writesPerformed, 0);

    const starterStage = late.stages.find((s) => s.stage === "STARTER");
    assert.notEqual(starterStage?.status, "ALREADY_COMPLETE");
  }

  // --- Validity sidecar excludes review grade path (load) ---
  const {
    isInvalidForPregame,
    loadPredictionValidityV0,
  } = await import("../src/lib/mlb/prediction-validity-v0");
  const validity = await loadPredictionValidityV0({ dateKst: date0803, cwd });
  assert.equal(isInvalidForPregame(validity), true);
  assert.equal(validity?.predictionHashSha256?.length, 64);

  // --- Temp cwd: missing schedule isolation + no repo write ---
  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-daily-v0-"));
  const tmpReport = await runMlbDailyPregameV0({
    dateKst: "2026-08-02",
    dryRun: true,
    noProvider: true,
    cwd: tmp,
  });
  assert.equal(tmpReport.overall, "BLOCKED_MISSING_SCHEDULE");
  assert.equal(tmpReport.providerCalls, 0);
  assert.equal(tmpReport.writesPerformed, 0);
  assert.equal(
    existsSync(path.join(tmp, "data/predictions/mlb/2026-08-02.json")),
    false,
  );

  // --- Partial fixture: schedule only → later stages blocked/would-run ---
  const researchDir = path.join(tmp, "data/research/mlb");
  mkdirSync(researchDir, { recursive: true });
  writeFileSync(
    path.join(researchDir, "2099-01-01-schedule-v1.json"),
    JSON.stringify({
      dateKst: "2099-01-01",
      games: [
        {
          internalGameId: "mlb-1",
          gamePk: 1,
          homeTeam: "A",
          awayTeam: "B",
          commenceTimeUtc: "2099-01-01T18:00:00.000Z",
          statusAbstract: "Preview",
        },
      ],
    }),
    "utf8",
  );
  const partial = await runMlbDailyPregameV0({
    dateKst: "2099-01-01",
    dryRun: true,
    noProvider: true,
    cwd: tmp,
    stopAfter: "ODDS",
  });
  assert.equal(partial.stages[0]?.status, "ALREADY_COMPLETE");
  assert.equal(partial.stages[1]?.status, "WOULD_RUN");
  assert.equal(partial.stages[2]?.status, "WOULD_RUN");
  assert.equal(partial.providerCalls, 0);
  assert.equal(partial.writesPerformed, 0);

  // --- Research grade adapter smoke (historical results may exist) ---
  if (existsSync(path.join(cwd, paths.prediction))) {
    const grade = await buildMlbResearchGradeAdapterV0({
      dateKst: dateHist,
      cwd,
    });
    assert.equal(grade.dateKst, dateHist);
    assert.ok(Array.isArray(grade.rows));
    if (grade.officialPickCount === 0) {
      assert.equal(grade.officialAccuracy, "N/A");
    }
  } else {
    console.log("skip grade adapter — historical prediction snapshot missing");
  }

  // --- Invalid stage window ---
  await assert.rejects(
    () =>
      runMlbDailyPregameV0({
        dateKst: "2026-07-30",
        dryRun: true,
        resumeFrom: "PREDICTION_V0",
        stopAfter: "SCHEDULE",
      }),
    /Invalid resume-from/,
  );

  console.log("test:mlb-daily-pregame-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
