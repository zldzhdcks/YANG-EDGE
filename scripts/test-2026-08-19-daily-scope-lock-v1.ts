/**
 * 2026-08-19 daily scope lock + schedule join tests.
 * Run: npm run test:2026-08-19-daily-scope-lock-v1
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
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
} from "./lock-2026-08-19-daily-scope-v1";
import {
  JOIN_REL,
  auditOperatorScopeJoin,
} from "./audit-2026-08-19-operator-scope-join-v1";

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

  const join = await auditOperatorScopeJoin(cwd);
  assert.equal(join.scopeLockedAt, lockedAt);
  assert.equal(join.coverage.observedScope, 21);
  assert.equal(join.coverage.accounted, 21);
  assert.equal(join.coverage.unexplainedMissing, 0);
  assert.equal(join.coverage.scheduleStageDone, true);
  assert.equal(join.mlb.observedExpected, 15);
  assert.equal(join.mlb.officialSchedule, 15);
  assert.equal(join.mlb.matched, 15);
  assert.equal(join.mlb.ambiguous, 0);
  assert.equal(join.mlb.missing, 0);
  assert.equal(join.mlb.uniqueGamePkJoined, 15);
  assert.equal(join.mlb.doubleheaders.length, 0);
  assert.equal(join.football.observedExpected, 6);
  assert.equal(join.football.joins.length, 6);
  assert.equal(join.football.unregisteredCompetition, 3);
  assert.equal(join.football.identityMatched, 1);
  assert.equal(join.football.identityBlocked, 2);
  assert.equal(join.football.screenshotIdentityBlocked, 3);
  assert.equal(join.football.notFound, 0);
  assert.equal(join.football.registeredMatched, 0);

  const copa = join.football.joins.filter((r) => r.rawLeagueLabel === "코파리베");
  const ucl = join.football.joins.filter((r) => r.rawLeagueLabel === "UCL");
  assert.equal(copa.length, 3);
  assert.ok(copa.every((r) => r.status === "UNREGISTERED_COMPETITION"));
  assert.equal(ucl.length, 3);
  assert.ok(ucl.every((r) => r.status === "IDENTITY_BLOCKED"));
  assert.ok(ucl.every((r) => r.fixtureId == null));

  const cinStl = join.mlb.joins.find(
    (r) => r.rawHome === "신시레즈" && r.rawAway === "세인카디",
  );
  assert.ok(cinStl);
  assert.equal(cinStl.status, "MATCHED_REGISTERED");
  assert.equal(cinStl.gamePk, 824475);

  const gamePks = new Set(
    join.mlb.joins.map((r) => r.gamePk).filter((pk): pk is number => pk != null),
  );
  assert.equal(gamePks.size, 15);

  const afterObs = sha256File(path.join(cwd, SOURCE_OBS_REL));
  assert.equal(afterObs, obsHash);
  const afterLock = JSON.parse(readFileSync(path.join(cwd, LOCK_REL), "utf8"));
  assert.equal(afterLock.scopeLockedAt, lockedAt);

  const status = execSync("git status --short", { cwd, encoding: "utf8" });
  for (const line of status.split(/\r?\n/).filter(Boolean)) {
    const file = line.slice(3).replace(/"/g, "");
    if (
      file.includes("data/operator-observations/") ||
      file.includes("data/predictions/") ||
      (file.includes("data/research/") && !file.includes("2026-08-19"))
    ) {
      throw new Error(`forbidden dirty path: ${line}`);
    }
  }

  console.log("PASS 2026-08-19 daily scope lock + schedule join");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
