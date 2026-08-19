/**
 * 2026-08-20 daily scope lock + schedule join tests.
 * Run: npm run test:2026-08-20-daily-scope-lock-v1
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  DATE_KST,
  FOOTBALL_OBSERVED,
  LOCK_REL,
  MLB_OBSERVED,
  SOURCE_OBS_REL,
  TOTAL_OBSERVED,
  lockDailyScope,
  sha256File,
} from "./lock-2026-08-20-daily-scope-v1";
import {
  JOIN_REL,
  MLB_SCHEDULE_REL,
  FOOTBALL_SCHEDULE_REL,
  auditOperatorScopeJoin,
} from "./audit-2026-08-20-operator-scope-join-v1";

const FROZEN_08_19_PREDICTION =
  "data/predictions/mlb/2026-08-19.json";
const FROZEN_08_19_EXPECTED =
  "data/operator-input/mlb/2026-08-19-expected-lineup-observation-v0.json";
const FROZEN_08_19_LOCK = "data/audits/2026-08-19-daily-scope-lock-v1.json";
const FROZEN_08_19_PREDICTION_SHA =
  "78ff77d372cc9827df8107b596b5adf80b3eb8df619f63f6d288fe773126c9a7";
const FROZEN_08_19_EXPECTED_SHA =
  "6c273065797e956d98b9a3b5ac6ef67ccfd9766270e3302caeb9d7ed05672d62";
const FROZEN_08_19_LOCK_SHA =
  "5efd2b0da7ba4cd7f170e6169531ada836558048a0229696927f9b2d56914daa";
const RAW_REL = "data/operator-observations/raw/2026-08-20/batch-0008";
const INTAKE_AUDIT_REL = "data/audits/2026-08-20-batch-0008-next-pregame-v0.json";

async function main() {
  const cwd = process.cwd();
  const beforeLock = JSON.parse(readFileSync(path.join(cwd, LOCK_REL), "utf8"));
  const lockedAt = beforeLock.scopeLockedAt;
  assert.equal(typeof lockedAt, "string");
  assert.ok(lockedAt.length > 0);

  const relock = await lockDailyScope(cwd);
  assert.equal(relock.wrote, false);
  assert.equal(relock.lock.scopeLockedAt, lockedAt);

  const obsHash = sha256File(path.join(cwd, SOURCE_OBS_REL));
  assert.equal(obsHash, beforeLock.sourceOperatorObservationHash);
  assert.equal(beforeLock.dateKst, DATE_KST);
  assert.equal(beforeLock.observedScope.MLB, MLB_OBSERVED);
  assert.equal(beforeLock.observedScope.FOOTBALL, FOOTBALL_OBSERVED);
  assert.equal(beforeLock.observedScope.total, TOTAL_OBSERVED);
  assert.equal(beforeLock.scopeShrinkAfterLockForbidden, true);
  assert.equal(beforeLock.prediction, "NONE");
  assert.equal(beforeLock.engine, "NONE");
  assert.equal(beforeLock.recommendation, "NONE");
  assert.equal(beforeLock.predictionInput, false);
  assert.equal(beforeLock.researchOnly, true);

  const join = await auditOperatorScopeJoin(cwd);
  assert.equal(join.scopeLockedAt, lockedAt);
  assert.equal(join.coverage.observedScope, 38);
  assert.equal(join.coverage.accounted, 38);
  assert.equal(join.coverage.unexplainedMissing, 0);
  assert.equal(join.coverage.ambiguous, 0);
  assert.equal(join.coverage.scopeDiscoveryConflict, false);
  assert.equal(join.coverage.scheduleStageDone, true);
  assert.equal(join.mlb.observedExpected, 15);
  assert.equal(join.mlb.officialSchedule, 15);
  assert.equal(join.mlb.uniqueGamePk, 15);
  assert.equal(join.mlb.matched, 13);
  assert.equal(join.mlb.identityBlocked, 2);
  assert.equal(join.mlb.ambiguous, 0);
  assert.equal(join.mlb.missing, 0);
  assert.equal(join.mlb.uniqueGamePkJoined, 13);
  assert.equal(join.mlb.doubleheaders.length, 0);
  assert.equal(join.mlb.internalGameIdCollisions.length, 0);
  assert.equal(join.mlb.officialGamesOutsideOperatorSlate.length, 0);
  assert.equal(join.football.observedExpected, 23);
  assert.equal(join.football.joins.length, 23);
  assert.equal(join.football.unregisteredCompetition, 18);
  assert.equal(join.football.screenshotIdentityBlocked, 5);
  assert.equal(join.football.notFound, 0);
  assert.equal(join.football.registeredMatched, 0);

  const copa = join.football.joins.filter((r) => r.rawLeagueLabel === "코파리베");
  const mls = join.football.joins.filter((r) => r.rawLeagueLabel === "MLS");
  const ucl = join.football.joins.filter((r) => r.rawLeagueLabel === "UCL");
  const laliga = join.football.joins.filter((r) => r.rawLeagueLabel === "라리가");
  assert.equal(copa.length, 3);
  assert.ok(copa.every((r) => r.status === "UNREGISTERED_COMPETITION"));
  assert.equal(mls.length, 15);
  assert.ok(mls.every((r) => r.status === "UNREGISTERED_COMPETITION"));
  assert.equal(ucl.length, 4);
  assert.ok(ucl.every((r) => r.status === "IDENTITY_BLOCKED"));
  assert.ok(ucl.every((r) => r.fixtureId == null));
  assert.equal(laliga.length, 1);
  assert.equal(laliga[0]?.status, "IDENTITY_BLOCKED");

  const tbTor = join.mlb.joins.find(
    (r) => r.rawHome === "템파레이" && r.rawAway === "토론블루",
  );
  const kcAth = join.mlb.joins.find(
    (r) => r.rawHome === "캔자로알" && r.rawAway === "애슬레틱",
  );
  assert.ok(tbTor);
  assert.equal(tbTor.status, "IDENTITY_BLOCKED");
  assert.equal(tbTor.gamePk, null);
  assert.ok(kcAth);
  assert.equal(kcAth.status, "IDENTITY_BLOCKED");
  assert.equal(kcAth.gamePk, null);

  assert.equal(join.confirmedLineups.cards, 3);
  assert.equal(join.confirmedLineups.matchedUnique, 3);
  assert.equal(join.confirmedLineups.ambiguous, 0);
  assert.equal(join.confirmedLineups.notFound, 0);
  assert.equal(join.confirmedLineups.preGame, 3);
  assert.equal(join.confirmedLineups.postStart, 0);
  assert.equal(join.confirmedLineups.unknownTiming, 0);
  assert.equal(join.confirmedLineups.expectedNotMergedIntoConfirmed, true);
  assert.equal(join.confirmedLineups.predictionInputTrue, 0);
  assert.equal(join.expectedLineups.cards, 13);
  assert.equal(join.expectedLineups.matchedUnique, 13);

  const confirmedPks = new Set(
    join.confirmedLineups.joins.map((r) => r.lineupGamePk),
  );
  assert.equal(confirmedPks.size, 3);
  assert.ok(confirmedPks.has(823342));
  assert.ok(confirmedPks.has(823587));
  assert.ok(confirmedPks.has(824640));

  const obs = JSON.parse(readFileSync(path.join(cwd, SOURCE_OBS_REL), "utf8"));
  assert.equal(obs.predictionInput, false);
  assert.equal(obs.summary.predictionInputTrue, 0);
  assert.equal(obs.summary.confirmedLineups, 3);
  assert.equal(obs.summary.expectedLineups, 13);
  assert.equal(obs.summary.confirmedFullGames, 2);
  assert.equal(obs.summary.confirmedPartialGames, 1);
  for (const card of obs.confirmedLineups) {
    assert.equal(card.predictionInput, false);
    assert.equal(card.lineupType, "CONFIRMED");
  }
  for (const card of obs.expectedLineups) {
    assert.equal(card.predictionInput, false);
    assert.equal(card.lineupType, "EXPECTED");
    assert.equal(card.confirmedLineup, false);
  }
  const mixedConfirmed = obs.confirmedLineups.find(
    (r: { homeTeam: string }) => r.homeTeam === "Chicago Cubs",
  );
  assert.equal(mixedConfirmed.completeness, "PARTIAL");
  assert.equal(mixedConfirmed.homeLineup.length, 0);
  assert.equal(mixedConfirmed.awayLineup.length, 9);

  const intakeAudit = JSON.parse(
    readFileSync(path.join(cwd, INTAKE_AUDIT_REL), "utf8"),
  );
  assert.equal(intakeAudit.predictionInput, false);
  assert.equal(intakeAudit.providerLiveCalls, 0);
  assert.equal(intakeAudit.predictionBuilderCalls, 0);
  assert.equal(intakeAudit.resultPostgameCalls, 0);
  assert.equal(intakeAudit.engineCalls, 0);
  assert.equal(intakeAudit.summary.shaDuplicates, 0);

  const manifest = JSON.parse(
    readFileSync(path.join(cwd, RAW_REL, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.files.length, 10);
  for (const file of manifest.files) {
    const abs = path.join(cwd, RAW_REL, file.file);
    assert.equal(sha256File(abs), file.sha256);
    assert.equal(file.predictionInput, false);
    assert.equal(file.duplicateSource, false);
  }

  assert.equal(
    sha256File(path.join(cwd, FROZEN_08_19_PREDICTION)),
    FROZEN_08_19_PREDICTION_SHA,
  );
  assert.equal(
    sha256File(path.join(cwd, FROZEN_08_19_EXPECTED)),
    FROZEN_08_19_EXPECTED_SHA,
  );
  assert.equal(
    sha256File(path.join(cwd, FROZEN_08_19_LOCK)),
    FROZEN_08_19_LOCK_SHA,
  );

  assert.equal(existsSync(path.join(cwd, MLB_SCHEDULE_REL)), true);
  assert.equal(existsSync(path.join(cwd, FOOTBALL_SCHEDULE_REL)), true);
  const predDir = path.join(cwd, "data/predictions");
  const unexpectedPred = walkPredictions(predDir).filter((p) =>
    p.includes("2026-08-20"),
  );
  assert.equal(unexpectedPred.length, 0);

  const afterObs = sha256File(path.join(cwd, SOURCE_OBS_REL));
  assert.equal(afterObs, obsHash);
  const afterLock = JSON.parse(readFileSync(path.join(cwd, LOCK_REL), "utf8"));
  assert.equal(afterLock.scopeLockedAt, lockedAt);

  assert.equal(join.leakage.predictionCalls, 0);
  assert.equal(join.leakage.oddsProviderCalls, 0);
  assert.equal(join.leakage.starterCalls, 0);
  assert.equal(join.leakage.lineupProviderCalls, 0);
  assert.equal(join.leakage.resultCalls, 0);
  assert.equal(join.leakage.postgameCalls, 0);
  assert.equal(join.leakage.engineCalls, 0);

  console.log("PASS 2026-08-20 daily scope lock + schedule join");
}

function walkPredictions(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkPredictions(p));
    else out.push(p.replace(/\\/g, "/"));
  }
  return out;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
