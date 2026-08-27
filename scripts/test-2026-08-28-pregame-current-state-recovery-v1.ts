/**
 * 2026-08-28 pregame current-state recovery + manual odds intake tests.
 * Run: npm run test:2026-08-28-pregame-current-state-recovery-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  BATCH_ID,
  CAPTURE_TIME_SOURCE,
  DATE_KST,
  FORMAL_OBSERVED_AT,
  FORBIDDEN_WRITE_PREFIXES,
  INBOX_PATH,
  INTAKE_STARTED_AT,
  MANIFEST_REL,
  PNG_GIT_EXCLUDE,
  RAW_EVIDENCE_STORAGE,
  RAW_REL,
  RECOVERY_AUDIT_REL,
  REPOSITORY_EVIDENCE,
  REQUIRED_BASE_COMMIT,
  SCOPE_STATUS,
  SCREENSHOTS,
  SEALED_2026_08_26,
  SLATE_DATE_KST,
  STATUS,
  STRUCTURED_REL,
  TIMING_CLASS,
  runIntake,
} from "./intake-2026-08-28-batch-2228-operator-pregame-observations";
import {
  OPERATOR_REVIEW_ITEMS,
  SLATE_RECOVERY_REL,
  runSlateRecovery,
} from "./audit-2026-08-28-scope-slate-recovery-v1";

function shaFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

type ObservedRow = {
  formalObservedAt: string;
  screenshotSha256: string;
  originalInboxName: string;
  sourceFileModifiedAt: string;
  marketBenchmarkOnly: boolean;
  predictionInput: boolean;
  engineInput: boolean;
  pregameEligibilityStatus: string;
  identityStatus: string;
  mappingStatus: string;
  pick: unknown;
  yangPick: unknown;
  recommendation: unknown;
  fuzzyMatchingUsed: boolean;
  markets: Array<{
    formalObservedAt: string;
    sourceScreenshotSha: string;
    marketBenchmarkOnly: boolean;
    predictionInput: boolean;
    engineInput: boolean;
    rawValueStatus: string;
  }>;
};

async function main() {
  const cwd = process.cwd();
  const { document, manifest, recoveryAudit } = await runIntake(cwd);

  assert.equal(BATCH_ID, "2026-08-28/batch-2228");
  assert.equal(DATE_KST, "2026-08-28");
  assert.equal(SLATE_DATE_KST, "2026-08-28");
  assert.equal(INTAKE_STARTED_AT, FORMAL_OBSERVED_AT);
  assert.equal(CAPTURE_TIME_SOURCE, "INTAKE_STARTED_AT_FROZEN_NOT_FILE_MTIME");
  assert.equal(TIMING_CLASS, "PREGAME_ELIGIBILITY_UNRESOLVED");
  assert.equal(SCOPE_STATUS, "NOT_READY_TO_LOCK_DAILY_SCOPE");
  assert.equal(STATUS, "OPERATOR_REVIEW_REQUIRED");
  assert.equal(document.predictionCreated, 0);
  assert.equal(document.marketBenchmarkOnly, true);
  assert.equal(document.predictionInput, false);
  assert.equal(document.engineInput, false);
  assert.equal(document.fuzzyMatchingUsed, false);
  assert.equal(manifest.predictionInput, false);
  assert.equal(manifest.engineInput, false);
  assert.equal(document.rawEvidenceStorage, RAW_EVIDENCE_STORAGE);
  assert.equal(document.repositoryEvidence, REPOSITORY_EVIDENCE);
  assert.equal(document.pngGitExcludeRule, PNG_GIT_EXCLUDE);
  assert.equal(recoveryAudit.dailyScopeLocked, false);
  assert.equal(recoveryAudit.predictionCalls, 0);
  assert.equal(recoveryAudit.resultCalls, 0);
  assert.equal(recoveryAudit.engineCalls, 0);
  assert.equal(recoveryAudit.providerCallCount, 0);

  for (const shot of SCREENSHOTS) {
    const copied = path.join(cwd, RAW_REL, shot.file);
    const inbox = path.join(INBOX_PATH, shot.originalInboxName);
    const ignore = execSync(`git check-ignore -- "${RAW_REL}/${shot.file}"`, {
      cwd,
      encoding: "utf8",
    }).trim();
    assert.ok(ignore.length > 0, `png not excluded: ${shot.file}`);
    assert.equal(existsSync(copied), true, shot.file);
    assert.equal(existsSync(inbox), true, shot.originalInboxName);
    assert.equal(shaFile(copied), shot.sha256, shot.file);
    assert.equal(shaFile(inbox), shot.sha256, `inbox ${shot.originalInboxName}`);
    assert.equal(readFileSync(inbox).byteLength, shot.bytes);
    assert.equal(statSync(inbox).size, shot.bytes);
    assert.notEqual(shot.sourceFileModifiedAt, FORMAL_OBSERVED_AT);
    assert.notEqual(shot.sourceFileNameTimestamp, FORMAL_OBSERVED_AT);
  }

  const inboxNames = readdirSync(INBOX_PATH).filter((n) =>
    n.toLowerCase().endsWith(".png"),
  );
  assert.equal(inboxNames.length, 6);

  const rows: ObservedRow[] = [
    ...document.basketballOddsFixtures,
    ...document.footballOddsFixtures,
    ...document.mlbOddsGames,
  ];
  assert.equal(rows.length, 36);
  assert.equal(document.summary.rowsObserved, 169);
  assert.equal(document.summary.rowsParsed, 169);
  assert.equal(document.summary.rowsIdentityMatched, 0);
  assert.equal(document.summary.rowsIdentityReviewRequired, 36);
  assert.equal(document.summary.rowsPregameEligible, 0);
  assert.equal(document.summary.rowsPostStart, 0);
  assert.equal(document.summary.rowsPregameEligibilityUnresolved, 36);
  assert.equal(document.summary.mlbOddsMatchups, 7);
  assert.equal(document.summary.mlbGamePkJoined, 0);
  assert.equal(document.summary.fuzzyMatchingUsed, false);
  assert.equal(document.summary.inventedOddsFields, 0);
  assert.equal(document.summary.inventedTeamIdentities, 0);
  assert.equal(document.summary.predictionCreated, 0);

  for (const row of rows) {
    assert.equal(row.formalObservedAt, FORMAL_OBSERVED_AT);
    assert.ok(row.screenshotSha256);
    assert.ok(row.originalInboxName.startsWith("스크린샷 "));
    assert.notEqual(row.sourceFileModifiedAt, row.formalObservedAt);
    assert.equal(row.marketBenchmarkOnly, true);
    assert.equal(row.predictionInput, false);
    assert.equal(row.engineInput, false);
    assert.equal(row.pregameEligibilityStatus, "PREGAME_ELIGIBILITY_UNRESOLVED");
    assert.equal(row.identityStatus, "ODDS_IDENTITY_REVIEW_REQUIRED");
    assert.equal(row.fuzzyMatchingUsed, false);
    assert.equal(row.pick, null);
    assert.equal(row.yangPick, null);
    assert.equal(row.recommendation, null);
    assert.notEqual(row.mappingStatus, "FUZZY_MATCHED");
    for (const market of row.markets) {
      assert.equal(market.formalObservedAt, FORMAL_OBSERVED_AT);
      assert.ok(market.sourceScreenshotSha);
      assert.equal(market.marketBenchmarkOnly, true);
      assert.equal(market.predictionInput, false);
      assert.equal(market.engineInput, false);
    }
  }

  const unreadBasketball = document.basketballOddsFixtures.filter(
    (r) => r.teamLabelStatus === "FIELD_REVIEW_REQUIRED",
  );
  assert.equal(unreadBasketball.length, 0);
  const ownerConfirmedBasketball = document.basketballOddsFixtures.filter(
    (r) => r.teamLabelStatus === "OWNER_EXPLICIT_CONFIRMATION",
  );
  assert.equal(ownerConfirmedBasketball.length, 2);
  const panama = document.basketballOddsFixtures.find((r) =>
    r.markets.some((m) => m.rowIds.includes(7023)),
  );
  const mexico = document.basketballOddsFixtures.find((r) =>
    r.markets.some((m) => m.rowIds.includes(7019)),
  );
  assert.equal(panama?.displayedStartKst, "10:40");
  assert.equal(panama?.rawHomeLabel, "파나마");
  assert.equal(panama?.rawAwayLabel, "캐나다");
  assert.deepEqual(
    panama?.markets.flatMap((m) => m.rowIds),
    [7023, 7024, 7025, 7026],
  );
  assert.equal(mexico?.displayedStartKst, "11:10");
  assert.equal(mexico?.rawHomeLabel, "멕시코");
  assert.equal(mexico?.rawAwayLabel, "콜롬비아");
  assert.deepEqual(
    mexico?.markets.flatMap((m) => m.rowIds),
    [7019, 7020, 7021, 7022],
  );

  for (const row of document.mlbOddsGames) {
    assert.equal(row.gamePk, null);
    assert.equal(row.mappingStatus, "TEAM_ALIAS_MATCHED_NO_SCHEDULE");
    assert.ok(row.canonicalHome);
    assert.ok(row.canonicalAway);
  }

  for (const sealed of SEALED_2026_08_26) {
    assert.equal(shaFile(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }

  const created20260827 = [
    "data/audits/2026-08-27-daily-scope-lock-v1.json",
    "data/audits/2026-08-27-schedule-identity-reconciliation-v1.json",
    "data/audits/2026-08-27-pregame-input-odds-coverage-v1.json",
    "data/audits/2026-08-27-prediction-pass-reconciliation-v1.json",
    "data/predictions/2026-08-27.json",
  ];
  for (const rel of created20260827) {
    assert.equal(existsSync(path.join(cwd, rel)), false, rel);
  }

  const slateResult = await runSlateRecovery(cwd);
  assert.equal(slateResult.slate.formalObservedAt, FORMAL_OBSERVED_AT);
  assert.equal(slateResult.slate.formalObservedAtChanged, false);
  assert.equal(slateResult.slate.scopeLockReady, true);
  assert.equal(slateResult.slate.fuzzyMatchingUsed, false);
  assert.equal(slateResult.slate.predictionCalls, 0);
  assert.equal(slateResult.slate.resultCalls, 0);
  assert.equal(slateResult.slate.operatorObservedMatchups, 36);
  assert.equal(slateResult.slate.bySport.MLB.matched, 7);
  assert.equal(slateResult.slate.bySport.MLB.unresolved, 0);
  assert.equal(slateResult.slate.bySport.FOOTBALL.matched, 2);
  assert.equal(slateResult.slate.bySport.FOOTBALL.unresolved, 12);
  assert.equal(slateResult.slate.bySport.BASKETBALL.matched, 0);
  assert.equal(slateResult.slate.bySport.BASKETBALL.operatorObserved, 15);
  assert.equal(slateResult.slate.operatorConfirmationRequired, 0);
  assert.equal(slateResult.slate.operatorOwnerExplicitConfirmation, 2);
  assert.equal(slateResult.slate.pregameEligibleObservedMatchups, 9);
  assert.equal(slateResult.slate.postStartObservedMatchups, 0);
  assert.equal(slateResult.slate.pregameEligibilityUnresolved, 27);
  assert.equal(OPERATOR_REVIEW_ITEMS.length, 2);
  assert.equal(OPERATOR_REVIEW_ITEMS[0]?.rawHomeLabel, "파나마");
  assert.equal(OPERATOR_REVIEW_ITEMS[0]?.rawAwayLabel, "캐나다");
  assert.equal(OPERATOR_REVIEW_ITEMS[1]?.rawHomeLabel, "멕시코");
  assert.equal(OPERATOR_REVIEW_ITEMS[1]?.rawAwayLabel, "콜롬비아");
  assert.equal(OPERATOR_REVIEW_ITEMS[0]?.reviewState, "OWNER_EXPLICIT_CONFIRMATION");
  assert.equal(OPERATOR_REVIEW_ITEMS[1]?.reviewState, "OWNER_EXPLICIT_CONFIRMATION");

  const structured = JSON.parse(readFileSync(path.join(cwd, STRUCTURED_REL), "utf8"));
  const audit = JSON.parse(readFileSync(path.join(cwd, RECOVERY_AUDIT_REL), "utf8"));
  const slate = JSON.parse(readFileSync(path.join(cwd, SLATE_RECOVERY_REL), "utf8"));
  assert.equal(structured.batchId, BATCH_ID);
  assert.equal(structured.formalObservedAt, FORMAL_OBSERVED_AT);
  assert.equal(structured.rawEvidenceStorage, RAW_EVIDENCE_STORAGE);
  assert.equal(audit.baseCommit, REQUIRED_BASE_COMMIT);
  assert.equal(audit.formalObservedAt, FORMAL_OBSERVED_AT);
  assert.equal(audit.originalInboxFilesUntouched, true);
  assert.equal(audit.sealed20260826FilesUntouched, true);
  assert.equal(audit.retroactive20260827WorkCreatedOrModified, false);
  assert.equal(audit.rowsPregameEligible, 9);
  assert.equal(slate.scopeLockReady, true);
  assert.equal(slate.scopeAccounting.scopeTotal, 36);
  assert.equal(slate.scopeAccounting.accountedFor, 36);

  const joinedRows = [
    ...structured.mlbOddsGames,
    ...structured.footballOddsFixtures,
    ...structured.basketballOddsFixtures,
  ];
  assert.equal(joinedRows.length, 36);
  for (const row of joinedRows) {
    assert.equal(row.formalObservedAt, FORMAL_OBSERVED_AT);
    assert.equal(row.marketBenchmarkOnly, true);
    assert.equal(row.predictionInput, false);
    assert.equal(row.engineInput, false);
    if (row.pregameEligibilityStatus === "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE") {
      assert.equal(row.identityStatus, "MATCHED");
      assert.ok(row.scheduledStartAt);
      assert.ok(Date.parse(FORMAL_OBSERVED_AT) < Date.parse(row.scheduledStartAt));
    }
    if (row.identityStatus !== "MATCHED") {
      assert.equal(row.pregameEligibilityStatus, "PREGAME_ELIGIBILITY_UNRESOLVED");
    }
  }
  for (const row of structured.mlbOddsGames) {
    assert.equal(row.identityStatus, "MATCHED");
    assert.ok(row.gamePk);
  }
  const footballMatched = structured.footballOddsFixtures.filter(
    (r: { identityStatus: string; rawLeagueLabel: string; scopeAccountingState: string }) =>
      r.identityStatus === "MATCHED",
  );
  assert.equal(footballMatched.length, 2);
  for (const row of footballMatched) {
    assert.equal(row.rawLeagueLabel, "라리가");
    assert.equal(row.scopeAccountingState, "SCHEDULE_MATCHED");
  }
  const footballUnresolved = structured.footballOddsFixtures.filter(
    (r: {
      identityStatus: string;
      rawLeagueLabel: string;
      scopeAccountingState: string;
      scheduleJoinStatus: string;
    }) => r.identityStatus !== "MATCHED",
  );
  assert.equal(footballUnresolved.length, 12);
  for (const row of footballUnresolved) {
    assert.equal(row.rawLeagueLabel, "UEL");
    assert.equal(row.scopeAccountingState, "IDENTITY_REVIEW_REQUIRED");
    assert.notEqual(row.scheduleJoinStatus, "MATCHED");
  }
  const unreadAfter = structured.basketballOddsFixtures.filter(
    (r: { teamLabelStatus: string }) => r.teamLabelStatus === "FIELD_REVIEW_REQUIRED",
  );
  assert.equal(unreadAfter.length, 0);
  const ownerAfter = structured.basketballOddsFixtures.filter(
    (r: { teamLabelStatus: string }) =>
      r.teamLabelStatus === "OWNER_EXPLICIT_CONFIRMATION",
  );
  assert.equal(ownerAfter.length, 2);
  for (const row of structured.basketballOddsFixtures) {
    assert.equal(row.scopeAccountingState, "SCOPE_OBSERVED_PROVIDER_UNSUPPORTED");
    assert.notEqual(row.identityStatus, "MATCHED");
    assert.notEqual(
      row.pregameEligibilityStatus,
      "PRE_GAME_MARKET_OBSERVATION_ELIGIBLE",
    );
  }

  const pngTracked = execSync("git ls-files -- " + JSON.stringify(RAW_REL), {
    cwd,
    encoding: "utf8",
  });
  assert.equal(pngTracked.includes(".png"), false);

  const status = execSync("git status --short", { cwd, encoding: "utf8" });
  for (const line of status.split(/\r?\n/).filter(Boolean)) {
    const xy = line.slice(0, 2);
    const file = line.slice(3).replace(/"/g, "");
    for (const prefix of FORBIDDEN_WRITE_PREFIXES) {
      const normalized = file.replace(/\\/g, "/");
      if (normalized.includes("data/research/mlb/2026-08-28-")) continue;
      if (normalized.includes("data/research/football/2026-08-28-")) continue;
      if (file.includes(prefix.replace(/\\/g, "/")) || file.includes(prefix)) {
        throw new Error(`forbidden dirty path: ${xy} ${file}`);
      }
    }
    if (file.includes("src/lib/") && /engine|weight/i.test(file)) {
      throw new Error(`engine/weights path dirty: ${xy} ${file}`);
    }
    if (file.includes("2026-08-26") && xy.trim() !== "") {
      const allowed = file.includes("operator-observations") === false;
      if (allowed && (xy.includes("M") || xy.includes("D") || xy.includes("A"))) {
        const isSealedAudit = SEALED_2026_08_26.some((s) =>
          file.replace(/\\/g, "/").endsWith(s.rel.replace(/\\/g, "/")),
        );
        assert.equal(isSealedAudit, false, `sealed 2026-08-26 dirty: ${file}`);
      }
    }
  }

  console.log("PASS 2026-08-28 pregame current-state recovery v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
