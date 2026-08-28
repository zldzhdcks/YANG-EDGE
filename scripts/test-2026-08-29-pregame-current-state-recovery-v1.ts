/**
 * 2026-08-29 pregame current-state recovery + manual odds intake tests.
 * Run: npm run test:2026-08-29-pregame-current-state-recovery-v1
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
  SEALED_2026_08_28,
  SLATE_DATE_KST,
  STATUS,
  STRUCTURED_REL,
  TIMING_CLASS,
  runIntake,
} from "./intake-2026-08-29-batch-2130-operator-pregame-observations";

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
  rawHomeLabel: string;
  rawAwayLabel: string;
  markets: Array<{
    formalObservedAt: string;
    sourceScreenshotSha: string;
    marketBenchmarkOnly: boolean;
    predictionInput: boolean;
    engineInput: boolean;
    rawValueStatus: string;
    homePrice: number | null;
    awayPrice: number | null;
  }>;
};

async function main() {
  const cwd = process.cwd();
  const { document, manifest, recoveryAudit } = await runIntake(cwd);

  assert.equal(BATCH_ID, "2026-08-29/batch-2130");
  assert.equal(DATE_KST, "2026-08-29");
  assert.equal(SLATE_DATE_KST, "2026-08-29");
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
  assert.equal(recoveryAudit.inventedOddsFieldsCount, 0);
  assert.equal(recoveryAudit.inventedTeamIdentitiesCount, 0);

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
  assert.equal(inboxNames.length, 5);

  const rows: ObservedRow[] = [
    ...document.basketballOddsFixtures,
    ...document.footballOddsFixtures,
    ...document.mlbOddsGames,
  ];
  assert.equal(rows.length, 30);
  assert.equal(document.summary.matchupCount, 30);
  assert.equal(document.summary.observedBatchCount, 30);
  assert.equal(document.summary.officialTargetDateScopeCount, 29);
  assert.equal(document.summary.excludedCrossDateCount, 1);
  assert.equal(document.summary.rowsObserved, 142);
  assert.equal(document.summary.rowsParsed, 142);
  assert.equal(document.summary.rowsIdentityMatched, 0);
  assert.equal(document.summary.rowsIdentityReviewRequired, 30);
  assert.equal(document.summary.rowsPregameEligible, 0);
  assert.equal(document.summary.rowsPostStart, 0);
  assert.equal(document.summary.rowsPregameEligibilityUnresolved, 30);
  assert.equal(document.summary.mlbOddsMatchups, 15);
  assert.equal(document.summary.mlbGamePkJoined, 0);
  assert.equal(document.summary.basketballOddsFixtures, 7);
  assert.equal(document.summary.footballOddsFixtures, 8);
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
    assert.notEqual(row.rawHomeLabel, "FIELD_REVIEW_REQUIRED");
    assert.notEqual(row.rawAwayLabel, "FIELD_REVIEW_REQUIRED");
    for (const market of row.markets) {
      assert.equal(market.formalObservedAt, FORMAL_OBSERVED_AT);
      assert.ok(market.sourceScreenshotSha);
      assert.equal(market.marketBenchmarkOnly, true);
      assert.equal(market.predictionInput, false);
      assert.equal(market.engineInput, false);
    }
  }

  const serbia = document.basketballOddsFixtures.find(
    (r) => r.rawHomeLabel === "세르비M",
  );
  assert.equal(serbia?.markets[0]?.homePrice, 1.0);
  assert.equal(serbia?.markets[0]?.awayPrice, 1.0);

  const offDate = document.basketballOddsFixtures.filter(
    (r) => r.displayedDateKst === "2026-08-28",
  );
  assert.equal(offDate.length, 1);
  assert.equal(offDate[0]?.rawHomeLabel, "요르단M");
  assert.equal(offDate[0]?.rawAwayLabel, "필리핀M");
  assert.equal(offDate[0]?.scopeMembership, "EXCLUDED_NON_TARGET_DATE");
  assert.deepEqual(
    offDate[0]?.markets.flatMap((m: { rowIds: number[] }) => m.rowIds),
    [7121, 7122, 7123, 7124],
  );
  const targetDateRows = [
    ...document.basketballOddsFixtures,
    ...document.footballOddsFixtures,
    ...document.mlbOddsGames,
  ].filter((r: { scopeMembership?: string }) => r.scopeMembership === "IN_TARGET_DATE_SCOPE");
  assert.equal(targetDateRows.length, 29);
  assert.equal(recoveryAudit.observedBatchCount, 30);
  assert.equal(recoveryAudit.officialTargetDateScopeCount, 29);
  assert.equal(recoveryAudit.excludedCrossDateCount, 1);

  const unreadBasketball = document.basketballOddsFixtures.filter(
    (r) => r.teamLabelStatus === "FIELD_REVIEW_REQUIRED",
  );
  assert.equal(unreadBasketball.length, 0);

  for (const row of document.mlbOddsGames) {
    assert.equal(row.gamePk, null);
    assert.equal(row.mappingStatus, "TEAM_ALIAS_MATCHED_NO_SCHEDULE");
    assert.ok(row.canonicalHome);
    assert.ok(row.canonicalAway);
  }

  for (const sealed of SEALED_2026_08_28) {
    assert.equal(shaFile(path.join(cwd, sealed.rel)), sealed.sha256, sealed.rel);
  }

  const retroactive20260828 = [
    "data/audits/2026-08-28-b1-freeze-v1.json",
    "data/predictions/2026-08-28.json",
    "data/audits/2026-08-28-pregame-prediction-snapshot-v1.json",
  ];
  for (const rel of retroactive20260828) {
    assert.equal(existsSync(path.join(cwd, rel)), false, rel);
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
    const normalized = file.replace(/\\/g, "/");
    if (normalized.endsWith(".png") && (xy.includes("A") || xy === "A ")) {
      throw new Error(`raw png staged: ${file}`);
    }
    for (const prefix of FORBIDDEN_WRITE_PREFIXES) {
      if (normalized.includes("data/research/mlb/2026-08-29-")) continue;
      if (normalized.includes("data/research/football/2026-08-29-")) continue;
      if (file.includes(prefix.replace(/\\/g, "/")) || file.includes(prefix)) {
        throw new Error(`forbidden dirty path: ${xy} ${file}`);
      }
    }
    if (file.includes("src/lib/") && /engine|weight/i.test(file)) {
      throw new Error(`engine/weights path dirty: ${xy} ${file}`);
    }
    if (normalized.includes("2026-08-28") && (xy.includes("M") || xy.includes("D"))) {
      const isSealed = SEALED_2026_08_28.some((s) =>
        normalized.endsWith(s.rel.replace(/\\/g, "/")),
      );
      assert.equal(isSealed, false, `sealed 2026-08-28 dirty: ${file}`);
    }
  }

  console.log("PASS 2026-08-29 pregame current-state recovery v1");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
