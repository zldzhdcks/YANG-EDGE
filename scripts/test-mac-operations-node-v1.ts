/**
 * Mac operations node v1 tests.
 * Fixture / mock only — zero live Provider calls. No launchd. No Prediction write.
 *
 *   npm run test:mac-operations-node-v1
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getKstDateString } from "../src/lib/datetime/kst";
import {
  acquireMacOpsLock,
  inspectMacOpsLock,
  LOCAL_TSX_CLI_REL,
  MAC_OPS_EXIT,
  MAC_OPS_HEALTH_REL,
  MAC_OPS_LOCK_HEARTBEAT_INTERVAL_MS,
  MAC_OPS_LOCK_REL,
  MAC_OPS_LOCK_TTL_MS,
  MAC_OPS_RECOVERY_LOCK_REL,
  RECOVERY_GUARD_STALE,
  inspectMacOpsRecoveryGuard,
  macOpsLockPath,
  macOpsRecoveryLockPath,
  readMacOpsLock,
  refreshMacOpsLockLease,
  releaseMacOpsLock,
  runMacOperationsNode,
  schedulerUnattendedArgs,
} from "../src/lib/mac-operations-node-v1";
import {
  LEGAL_PROVIDER_AUTOMATION_BLOCKED,
  MLB_STATS_AUTOMATION_ALLOWED,
} from "../src/lib/provider-automation-policy";
import {
  buildOddsQuotaBootstrapReceipt,
  ODDS_OPERATOR_PLAN_EVIDENCE,
  writeOddsQuotaReceipt,
} from "../src/lib/odds/quota-receipt-v1";
import { parseMacOpsCliArgs } from "./run-mac-operations-node-v1";

const REPO = process.cwd();
const NOW = new Date("2026-09-18T16:30:00.000Z");
const DATE_KST = "2026-09-19";
const FIXTURE_ENV = {
  ODDS_PLAN_CONFIRMED: "true",
  ODDS_API_KEY: "fixture-present",
} as const;

function tmpCwd(): string {
  return mkdtempSync(path.join(tmpdir(), "mac-ops-"));
}

function writeJson(cwd: string, rel: string, body: unknown) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

function writeEnv(cwd: string, plan = true, key = true) {
  const lines = [
    plan ? "ODDS_PLAN_CONFIRMED=true" : "ODDS_PLAN_CONFIRMED=false",
    key ? "ODDS_API_KEY=fixture-present" : "",
  ].filter(Boolean);
  writeFileSync(path.join(cwd, ".env.local"), `${lines.join("\n")}\n`, "utf8");
}

function writeStatsArtifacts(cwd: string, dateKst = DATE_KST) {
  writeJson(cwd, `data/research/mlb/${dateKst}-schedule-v1.json`, {
    dateKst,
    games: [],
  });
  writeJson(cwd, `data/research/mlb/${dateKst}-starter-dataset-v1.json`, {
    meta: { dateKst },
    rows: [],
  });
  writeJson(cwd, `data/research/mlb/${dateKst}-lineup-dataset-v1.json`, {
    meta: { dateKst },
    rows: [],
  });
}

async function writeReceipt(
  cwd: string,
  remaining: number,
  observedAt = NOW.toISOString(),
) {
  await writeOddsQuotaReceipt(
    buildOddsQuotaBootstrapReceipt({
      planName: ODDS_OPERATOR_PLAN_EVIDENCE.planName,
      requestsRemaining: remaining,
      requestsUsed: 35,
      evidenceDate: ODDS_OPERATOR_PLAN_EVIDENCE.evidenceDate,
      observedAt,
    }),
    cwd,
  );
}

function readyOpts(cwd: string) {
  return {
    cwd,
    repoRoot: REPO,
    now: NOW,
    envOverride: { ...FIXTURE_ENV },
    gitDirtyTracked: false,
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function writeLock(
  cwd: string,
  partial: {
    pid?: number;
    runId?: string;
    startedAt?: string;
    expiresAt?: string;
  } = {},
) {
  mkdirSync(path.dirname(macOpsLockPath(cwd)), { recursive: true });
  writeFileSync(
    macOpsLockPath(cwd),
    `${JSON.stringify(
      {
        version: "mac-operations-node-v1",
        pid: partial.pid ?? 1,
        startedAt: partial.startedAt ?? "2026-09-01T00:00:00.000Z",
        expiresAt: partial.expiresAt ?? "2026-09-01T00:20:00.000Z",
        runId: partial.runId ?? "old",
        hostname: "test",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function writeRecoveryGuard(
  cwd: string,
  partial: {
    guardId?: string;
    pid?: number;
    startedAt?: string;
    expiresAt?: string;
  } = {},
) {
  mkdirSync(path.dirname(macOpsRecoveryLockPath(cwd)), { recursive: true });
  writeFileSync(
    macOpsRecoveryLockPath(cwd),
    `${JSON.stringify(
      {
        version: "mac-operations-node-v1",
        kind: "recovery-guard",
        guardId: partial.guardId ?? "stale-guard",
        pid: partial.pid ?? 1,
        startedAt: partial.startedAt ?? "2026-09-01T00:00:00.000Z",
        expiresAt: partial.expiresAt ?? "2026-09-01T00:00:30.000Z",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function readRecoveryGuardFile(cwd: string): Record<string, unknown> | null {
  const abs = macOpsRecoveryLockPath(cwd);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf8")) as Record<string, unknown>;
}

async function main() {
  assert.equal(MLB_STATS_AUTOMATION_ALLOWED, false);
  assert.equal(getKstDateString(NOW), DATE_KST);

  const origFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    throw new Error("UNEXPECTED_NETWORK_CALL");
  }) as typeof fetch;

  try {
    // 1. KST date independent of host timezone
    assert.equal(getKstDateString(new Date("2026-09-18T15:00:00.000Z")), "2026-09-19");
    assert.equal(getKstDateString(new Date("2026-09-18T14:59:00.000Z")), "2026-09-18");

    // 29. unattended remains separate from rehearsal
    const cliPre = parseMacOpsCliArgs(["--preflight"]);
    assert.equal(cliPre.mode, "PREFLIGHT");
    assert.throws(() => parseMacOpsCliArgs(["--rehearsal"]), /MAC_OPS_REHEARSAL_FORBIDDEN/);
    assert.throws(() => parseMacOpsCliArgs(["--preflight", "--run"]), /MAC_OPS_MODE_CONFLICT/);
    const none = parseMacOpsCliArgs([]);
    assert.equal(none.mode, null);

    const args = schedulerUnattendedArgs(DATE_KST);
    assert.deepEqual(args, ["--date", DATE_KST, "--league", "MLB", "--unattended"]);
    assert.equal(args.includes("--rehearsal"), false);

    // A / 4–6 / 2–3 / 23 / 30 ready
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465);
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
      });
      assert.equal(report.dateKst, DATE_KST);
      assert.equal(report.status, "READY_FOR_UNATTENDED_ODDS");
      assert.equal(report.exitCode, MAC_OPS_EXIT.HEALTHY);
      assert.equal(report.oddsPlanConfirmed, true);
      assert.equal(report.oddsApiKeyPresent, true);
      assert.equal(report.quotaSource, "RECEIPT");
      assert.equal(report.quotaStatus, "QUOTA_AVAILABLE");
      assert.equal(report.quotaRemaining, 465);
      assert.equal(report.scheduleArtifact, "PRESENT");
      assert.equal(report.starterArtifact, "PRESENT");
      assert.equal(report.lineupArtifact, "PRESENT");
      assert.equal(report.mlbStatsAutomationAllowed, false);
      assert.equal(report.launchdInstalled, false);
      assert.equal(report.gitPull, false);
      assert.equal(report.npmInstall, false);
      assert.equal(report.usesNpx, false);
      assert.equal(report.rehearsal, false);
      assert.equal(report.unattended, true);
      assert.ok(report.nodeExecPath.includes("node"));
      assert.ok(report.localTsx.replace(/\\/g, "/").endsWith(LOCAL_TSX_CLI_REL));
      assert.equal(report.localTsxPresent, true);
      const health = JSON.parse(
        readFileSync(path.join(cwd, MAC_OPS_HEALTH_REL), "utf8"),
      ) as Record<string, unknown>;
      const healthText = JSON.stringify(health);
      assert.equal(healthText.includes("fixture-present"), false);
      assert.equal(/ODDS_API_KEY/i.test(healthText), false);
      assert.equal(health.exitCode, 0);
      const leftovers = readdirSync(path.dirname(path.join(cwd, MAC_OPS_HEALTH_REL))).filter(
        (n) => n.endsWith(".tmp"),
      );
      assert.deepEqual(leftovers, []);
    }

    // 7 missing receipt
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
      });
      assert.equal(report.status, "ODDS_UNAVAILABLE");
      assert.equal(report.exitCode, MAC_OPS_EXIT.PREREQUISITE_BLOCKED);
      assert.equal(report.quotaSource, "NONE");
    }

    // 8 stale receipt
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465, "2026-08-31T12:00:00.000Z");
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
      });
      assert.equal(report.status, "ODDS_UNAVAILABLE");
      assert.equal(report.lastErrorCode, "QUOTA_STALE");
    }

    // 9 zero receipt
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 0);
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
      });
      assert.equal(report.status, "ODDS_UNAVAILABLE");
      assert.equal(report.lastErrorCode, "QUOTA_ZERO");
    }

    // 10 Schedule missing
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeJson(cwd, `data/research/mlb/${DATE_KST}-starter-dataset-v1.json`, {});
      writeJson(cwd, `data/research/mlb/${DATE_KST}-lineup-dataset-v1.json`, {});
      await writeReceipt(cwd, 465);
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
      });
      assert.equal(report.status, "BLOCKED");
      assert.equal(report.lastErrorCode, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
      assert.equal(report.scheduleArtifact, "MISSING");
    }

    // 11 Starter missing
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeJson(cwd, `data/research/mlb/${DATE_KST}-schedule-v1.json`, {});
      writeJson(cwd, `data/research/mlb/${DATE_KST}-lineup-dataset-v1.json`, {});
      await writeReceipt(cwd, 465);
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
      });
      assert.equal(report.status, "BLOCKED");
      assert.equal(report.starterArtifact, "MISSING");
      assert.equal(report.lastErrorCode, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    }

    // 12 Lineup missing
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeJson(cwd, `data/research/mlb/${DATE_KST}-schedule-v1.json`, {});
      writeJson(cwd, `data/research/mlb/${DATE_KST}-starter-dataset-v1.json`, {});
      await writeReceipt(cwd, 465);
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
      });
      assert.equal(report.status, "BLOCKED");
      assert.equal(report.lineupArtifact, "MISSING");
    }

    // E plan false
    {
      const cwd = tmpCwd();
      writeEnv(cwd, false, true);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465);
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
        envOverride: { ODDS_PLAN_CONFIRMED: "false", ODDS_API_KEY: "fixture-present" },
      });
      assert.equal(report.oddsPlanConfirmed, false);
      assert.equal(report.status, "ODDS_UNAVAILABLE");
    }

    // F key missing
    {
      const cwd = tmpCwd();
      writeEnv(cwd, true, false);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465);
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
        envOverride: { ODDS_PLAN_CONFIRMED: "true" },
      });
      assert.equal(report.oddsApiKeyPresent, false);
      assert.equal(report.status, "ODDS_UNAVAILABLE");
    }

    // 13 MLB Stats spawn impossible — preflight/run mock never lists stats scripts
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465);
      const spawned: string[] = [];
      await runMacOperationsNode({
        mode: "RUN",
        ...readyOpts(cwd),
        executeScheduler: async ({ args }) => {
          spawned.push(args.join(" "));
          return { exitCode: 0, schedulerRunId: "sch-fixture" };
        },
      });
      assert.equal(spawned.length, 1);
      assert.equal(spawned[0]?.includes("unattended"), true);
      assert.equal(spawned[0]?.includes("rehearsal"), false);
    }

    // 14–17 mutex
    {
      const cwd = tmpCwd();
      const a = await acquireMacOpsLock({ cwd, runId: "run-a", now: NOW });
      assert.equal(a.outcome, "LOCK_ACQUIRED");
      assert.equal(existsSync(macOpsLockPath(cwd)), true);
      const held = await inspectMacOpsLock({ cwd, now: NOW });
      assert.equal(held, "LOCK_HELD");
      const b = await acquireMacOpsLock({ cwd, runId: "run-b", now: NOW });
      assert.equal(b.outcome, "LOCK_ALREADY_HELD");
      const released = await releaseMacOpsLock({ cwd, runId: "run-a" });
      assert.equal(released, "LOCK_RELEASED");
      assert.equal(existsSync(macOpsLockPath(cwd)), false);

      mkdirSync(path.dirname(macOpsLockPath(cwd)), { recursive: true });
      writeFileSync(
        macOpsLockPath(cwd),
        `${JSON.stringify({
          version: "mac-operations-node-v1",
          pid: 1,
          startedAt: "2026-09-01T00:00:00.000Z",
          expiresAt: "2026-09-01T00:20:00.000Z",
          runId: "old",
          hostname: "test",
        }, null, 2)}\n`,
        "utf8",
      );
      const recovered = await acquireMacOpsLock({ cwd, runId: "run-c", now: NOW });
      assert.equal(recovered.outcome, "LOCK_STALE_RECOVERED");
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.runId, "run-c");
      await releaseMacOpsLock({ cwd, runId: "run-c" });
    }

    // H second tick lock denied on RUN
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465);
      await acquireMacOpsLock({ cwd, runId: "other", now: NOW });
      const report = await runMacOperationsNode({
        mode: "RUN",
        ...readyOpts(cwd),
        executeScheduler: async () => ({ exitCode: 0 }),
      });
      assert.equal(report.status, "DUPLICATE_TICK");
      assert.equal(report.exitCode, MAC_OPS_EXIT.DUPLICATE_TICK);
    }

    // 26 Scheduler failure mapping
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465);
      const report = await runMacOperationsNode({
        mode: "RUN",
        ...readyOpts(cwd),
        executeScheduler: async () => ({ exitCode: 1 }),
      });
      assert.equal(report.exitCode, MAC_OPS_EXIT.EXECUTION_FAILURE);
      assert.equal(report.status, "EXECUTION_FAILURE");
      assert.equal(existsSync(macOpsLockPath(cwd)), false);
    }

    // 21 launchd not installed / 22 no git pull/install
    {
      const src = [
        readFileSync(path.join(REPO, "src/lib/mac-operations-node-v1/run.ts"), "utf8"),
        readFileSync(path.join(REPO, "scripts/run-mac-operations-node-v1.ts"), "utf8"),
      ].join("\n");
      assert.equal(src.includes("launchctl"), false);
      assert.equal(src.includes("git pull"), false);
      assert.equal(src.includes("npm install"), false);
      assert.equal(src.includes("npm ci"), false);
      assert.equal(/\bnpx\b/.test(src), false);
    }

    // 20 runtime files ignored by Git
    {
      const lockIgnore = execFileSync(
        "git",
        ["check-ignore", "-v", MAC_OPS_LOCK_REL],
        { cwd: REPO, encoding: "utf8" },
      );
      const healthIgnore = execFileSync(
        "git",
        ["check-ignore", "-v", MAC_OPS_HEALTH_REL],
        { cwd: REPO, encoding: "utf8" },
      );
      assert.ok(lockIgnore.includes(MAC_OPS_LOCK_REL));
      assert.ok(healthIgnore.includes(MAC_OPS_HEALTH_REL));
    }

    // 27 cwd/repo-root: fixture cwd is not repo, repoRoot still resolved
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465);
      const report = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
      });
      assert.equal(path.resolve(report.repoRoot), path.resolve(REPO));
      assert.notEqual(path.resolve(cwd), path.resolve(REPO));
    }

    // 31 two concurrent acquisitions against a valid existing lock
    {
      const cwd = tmpCwd();
      const owner = await acquireMacOpsLock({ cwd, runId: "owner", now: NOW });
      assert.equal(owner.outcome, "LOCK_ACQUIRED");
      const bothRead = deferred();
      let reads = 0;
      const afterInitialRead = async () => {
        reads += 1;
        if (reads === 2) bothRead.resolve();
        await bothRead.promise;
      };
      const [x, y] = await Promise.all([
        acquireMacOpsLock({
          cwd,
          runId: "challenger-x",
          now: NOW,
          hooks: { afterInitialRead },
        }),
        acquireMacOpsLock({
          cwd,
          runId: "challenger-y",
          now: NOW,
          hooks: { afterInitialRead },
        }),
      ]);
      assert.equal(x.outcome, "LOCK_ALREADY_HELD");
      assert.equal(y.outcome, "LOCK_ALREADY_HELD");
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.runId, "owner");
      await releaseMacOpsLock({ cwd, runId: "owner" });
    }

    // 32–35 concurrent stale recovery: exactly one winner; loser does not unlink
    {
      const cwd = tmpCwd();
      writeLock(cwd, { runId: "stale-old" });
      const bothRead = deferred();
      let reads = 0;
      let unlinks = 0;
      let concurrentGuards = 0;
      let maxGuards = 0;
      const sharedHooks = {
        afterInitialRead: async () => {
          reads += 1;
          if (reads === 2) bothRead.resolve();
          await bothRead.promise;
        },
        beforeUnlinkStale: async () => {
          unlinks += 1;
        },
        afterRecoveryGuardAcquired: async () => {
          concurrentGuards += 1;
          maxGuards = Math.max(maxGuards, concurrentGuards);
        },
        afterRecoveryGuardReleased: async () => {
          concurrentGuards -= 1;
        },
      };
      const [a, b] = await Promise.all([
        acquireMacOpsLock({
          cwd,
          runId: "recover-a",
          now: NOW,
          hooks: sharedHooks,
        }),
        acquireMacOpsLock({
          cwd,
          runId: "recover-b",
          now: NOW,
          hooks: sharedHooks,
        }),
      ]);
      const recovered = [a, b].filter((r) => r.outcome === "LOCK_STALE_RECOVERED");
      const held = [a, b].filter((r) => r.outcome === "LOCK_ALREADY_HELD");
      assert.equal(recovered.length, 1);
      assert.equal(held.length, 1);
      const winner = recovered[0];
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.runId, winner?.record?.runId);
      assert.ok(rec?.runId === "recover-a" || rec?.runId === "recover-b");
      assert.equal(unlinks, 1);
      assert.equal(maxGuards, 1);
      assert.equal(existsSync(macOpsRecoveryLockPath(cwd)), false);
      await releaseMacOpsLock({ cwd, runId: rec!.runId });
    }

    // 36 recovery guard released after failure (wx lost after unlink)
    {
      const cwd = tmpCwd();
      writeLock(cwd, { runId: "stale-old" });
      const competingExpires = new Date(NOW.getTime() + MAC_OPS_LOCK_TTL_MS).toISOString();
      const failed = await acquireMacOpsLock({
        cwd,
        runId: "failed-recover",
        now: NOW,
        hooks: {
          afterUnlinkStale: async () => {
            writeLock(cwd, {
              pid: 99,
              runId: "competitor",
              startedAt: NOW.toISOString(),
              expiresAt: competingExpires,
            });
          },
        },
      });
      assert.equal(failed.outcome, "LOCK_ALREADY_HELD");
      assert.equal(existsSync(macOpsRecoveryLockPath(cwd)), false);
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.runId, "competitor");
    }

    // 37 fresh lock detected after recovery-guard acquisition → never unlinked
    {
      const cwd = tmpCwd();
      writeLock(cwd, { runId: "stale-old" });
      let unlinked = false;
      const freshExpires = new Date(NOW.getTime() + MAC_OPS_LOCK_TTL_MS).toISOString();
      const result = await acquireMacOpsLock({
        cwd,
        runId: "attacker",
        now: NOW,
        hooks: {
          afterRecoveryGuardAcquired: async () => {
            writeLock(cwd, {
              pid: 42,
              runId: "owner-renewed",
              startedAt: NOW.toISOString(),
              expiresAt: freshExpires,
            });
          },
          beforeUnlinkStale: async () => {
            unlinked = true;
          },
        },
      });
      assert.equal(result.outcome, "LOCK_ALREADY_HELD");
      assert.equal(unlinked, false);
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.runId, "owner-renewed");
      assert.equal(existsSync(macOpsRecoveryLockPath(cwd)), false);
    }

    // 38 heartbeat by owner extends expiresAt
    {
      const cwd = tmpCwd();
      const acquired = await acquireMacOpsLock({
        cwd,
        runId: "owner",
        now: NOW,
        ttlMs: 60_000,
      });
      assert.equal(acquired.outcome, "LOCK_ACQUIRED");
      const originalExpiry = acquired.record?.expiresAt;
      const later = new Date(NOW.getTime() + 10_000);
      const refreshed = await refreshMacOpsLockLease({
        cwd,
        runId: "owner",
        now: later,
        ttlMs: 60_000,
      });
      assert.equal(refreshed.outcome, "LEASE_REFRESHED");
      assert.ok(refreshed.record);
      assert.notEqual(refreshed.record?.expiresAt, originalExpiry);
      assert.equal(
        refreshed.record?.expiresAt,
        new Date(later.getTime() + 60_000).toISOString(),
      );
      await releaseMacOpsLock({ cwd, runId: "owner" });
    }

    // 39 heartbeat by wrong runId rejected
    {
      const cwd = tmpCwd();
      await acquireMacOpsLock({ cwd, runId: "owner", now: NOW });
      const denied = await refreshMacOpsLockLease({
        cwd,
        runId: "other",
        now: NOW,
      });
      assert.equal(denied.outcome, "LEASE_NOT_OWNER");
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.runId, "owner");
      await releaseMacOpsLock({ cwd, runId: "owner" });
    }

    // 40 heartbeat by wrong PID rejected
    {
      const cwd = tmpCwd();
      writeLock(cwd, {
        pid: 1,
        runId: "owner",
        startedAt: NOW.toISOString(),
        expiresAt: new Date(NOW.getTime() + MAC_OPS_LOCK_TTL_MS).toISOString(),
      });
      const denied = await refreshMacOpsLockLease({
        cwd,
        runId: "owner",
        now: NOW,
      });
      assert.equal(denied.outcome, "LEASE_NOT_OWNER");
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.pid, 1);
      assert.equal(rec?.runId, "owner");
    }

    // 41 heartbeat cannot recreate missing lock
    {
      const cwd = tmpCwd();
      const missing = await refreshMacOpsLockLease({
        cwd,
        runId: "owner",
        now: NOW,
      });
      assert.equal(missing.outcome, "LEASE_MISSING");
      assert.equal(existsSync(macOpsLockPath(cwd)), false);
    }

    // 42 heartbeat and stale recovery cannot both mutate concurrently
    {
      const cwd = tmpCwd();
      writeLock(cwd, {
        pid: process.pid,
        runId: "old-owner",
        startedAt: "2026-09-01T00:00:00.000Z",
        expiresAt: "2026-09-01T00:20:00.000Z",
      });
      const go = deferred();
      let waiting = 0;
      let concurrentGuards = 0;
      let maxGuards = 0;
      const barrierHooks = {
        beforeRecoveryGuardAttempt: async () => {
          waiting += 1;
          if (waiting === 2) go.resolve();
          await go.promise;
        },
        afterRecoveryGuardAcquired: async () => {
          concurrentGuards += 1;
          maxGuards = Math.max(maxGuards, concurrentGuards);
        },
        afterRecoveryGuardReleased: async () => {
          concurrentGuards -= 1;
        },
      };
      const [acq, hb] = await Promise.all([
        acquireMacOpsLock({
          cwd,
          runId: "recoverer",
          now: NOW,
          hooks: barrierHooks,
        }),
        refreshMacOpsLockLease({
          cwd,
          runId: "old-owner",
          now: NOW,
          hooks: barrierHooks,
        }),
      ]);
      assert.ok(maxGuards <= 1);
      const rec = await readMacOpsLock(cwd);
      assert.ok(rec);
      if (acq.outcome === "LOCK_STALE_RECOVERED") {
        assert.equal(rec?.runId, "recoverer");
        assert.ok(
          hb.outcome === "LEASE_NOT_OWNER" ||
            hb.outcome === "LEASE_SERIALIZATION_BUSY",
        );
      } else {
        assert.equal(acq.outcome, "LOCK_ALREADY_HELD");
        assert.equal(hb.outcome, "LEASE_REFRESHED");
        assert.equal(rec?.runId, "old-owner");
      }
      assert.equal(existsSync(macOpsRecoveryLockPath(cwd)), false);
    }

    // 43 active heartbeat keeps lock non-stale beyond original TTL
    {
      const cwd = tmpCwd();
      const t0 = NOW;
      await acquireMacOpsLock({
        cwd,
        runId: "owner",
        now: t0,
        ttlMs: 1000,
      });
      const tRefresh = new Date(t0.getTime() + 900);
      const refreshed = await refreshMacOpsLockLease({
        cwd,
        runId: "owner",
        now: tRefresh,
        ttlMs: 1000,
      });
      assert.equal(refreshed.outcome, "LEASE_REFRESHED");
      const tPastOriginal = new Date(t0.getTime() + 1500);
      assert.equal(await inspectMacOpsLock({ cwd, now: tPastOriginal }), "LOCK_HELD");
      const other = await acquireMacOpsLock({
        cwd,
        runId: "other",
        now: tPastOriginal,
      });
      assert.equal(other.outcome, "LOCK_ALREADY_HELD");
      const rec = await readMacOpsLock(cwd);
      assert.ok(Date.parse(rec!.expiresAt) > tPastOriginal.getTime());
      await releaseMacOpsLock({ cwd, runId: "owner" });
    }

    // 44 after heartbeat stops and TTL expires → guarded stale recovery
    {
      const cwd = tmpCwd();
      const t0 = NOW;
      await acquireMacOpsLock({ cwd, runId: "owner", now: t0, ttlMs: 1000 });
      const tRefresh = new Date(t0.getTime() + 900);
      await refreshMacOpsLockLease({
        cwd,
        runId: "owner",
        now: tRefresh,
        ttlMs: 1000,
      });
      const tExpired = new Date(tRefresh.getTime() + 1001);
      const recovered = await acquireMacOpsLock({
        cwd,
        runId: "next-tick",
        now: tExpired,
      });
      assert.equal(recovered.outcome, "LOCK_STALE_RECOVERED");
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.runId, "next-tick");
      assert.equal(existsSync(macOpsRecoveryLockPath(cwd)), false);
      await releaseMacOpsLock({ cwd, runId: "next-tick" });
    }

    // 45 normal wrapper RUN stops heartbeat and releases lock
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465);
      let lockDuring = false;
      let recoveryDuring = false;
      const report = await runMacOperationsNode({
        mode: "RUN",
        ...readyOpts(cwd),
        executeScheduler: async () => {
          lockDuring = existsSync(macOpsLockPath(cwd));
          recoveryDuring = existsSync(macOpsRecoveryLockPath(cwd));
          return { exitCode: 0, schedulerRunId: "sch-hb" };
        },
      });
      assert.equal(report.status, "HEALTHY");
      assert.equal(lockDuring, true);
      assert.equal(recoveryDuring, false);
      assert.equal(existsSync(macOpsLockPath(cwd)), false);
      assert.equal(existsSync(macOpsRecoveryLockPath(cwd)), false);
      assert.equal(existsSync(path.join(cwd, "data/predictions")), false);
    }

    // 46 recovery lock path Git-ignored
    {
      const recoveryIgnore = execFileSync(
        "git",
        ["check-ignore", "-v", MAC_OPS_RECOVERY_LOCK_REL],
        { cwd: REPO, encoding: "utf8" },
      );
      assert.ok(recoveryIgnore.includes(MAC_OPS_RECOVERY_LOCK_REL));
    }

    // 49 / 67 two concurrent attempts against expired guard → both fail closed
    {
      const cwd = tmpCwd();
      writeLock(cwd, { runId: "stale-main" });
      writeRecoveryGuard(cwd, { guardId: "expired-shared" });
      const go = deferred();
      let waiting = 0;
      let concurrentGuards = 0;
      let maxGuards = 0;
      const barrierHooks = {
        beforeRecoveryGuardAttempt: async () => {
          waiting += 1;
          if (waiting === 2) go.resolve();
          await go.promise;
        },
        afterRecoveryGuardAcquired: async () => {
          concurrentGuards += 1;
          maxGuards = Math.max(maxGuards, concurrentGuards);
        },
        afterRecoveryGuardReleased: async () => {
          concurrentGuards -= 1;
        },
      };
      const [a, b] = await Promise.all([
        acquireMacOpsLock({
          cwd,
          runId: "reclaim-a",
          now: NOW,
          hooks: barrierHooks,
        }),
        acquireMacOpsLock({
          cwd,
          runId: "reclaim-b",
          now: NOW,
          hooks: barrierHooks,
        }),
      ]);
      assert.equal(maxGuards, 0);
      assert.equal(a.outcome, "LOCK_RECOVERY_GUARD_STALE");
      assert.equal(b.outcome, "LOCK_RECOVERY_GUARD_STALE");
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.runId, "stale-main");
      const guard = readRecoveryGuardFile(cwd);
      assert.equal(guard?.guardId, "expired-shared");
    }

    // 53–54 release when recovery guard busy → no unguarded unlink
    {
      const cwd = tmpCwd();
      const owner = await acquireMacOpsLock({ cwd, runId: "owner", now: NOW });
      assert.equal(owner.outcome, "LOCK_ACQUIRED");
      const hold = deferred();
      const resume = deferred();
      const refreshP = refreshMacOpsLockLease({
        cwd,
        runId: "owner",
        now: NOW,
        hooks: {
          afterRecoveryGuardAcquired: async () => {
            hold.resolve();
            await resume.promise;
          },
        },
      });
      await hold.promise;
      const busy = await releaseMacOpsLock({ cwd, runId: "owner", now: NOW });
      assert.equal(busy, "LOCK_SERIALIZATION_BUSY");
      assert.equal(existsSync(macOpsLockPath(cwd)), true);
      const recDuring = await readMacOpsLock(cwd);
      assert.equal(recDuring?.runId, "owner");
      resume.resolve();
      const refreshed = await refreshP;
      assert.equal(refreshed.outcome, "LEASE_REFRESHED");
      const released = await releaseMacOpsLock({ cwd, runId: "owner", now: NOW });
      assert.equal(released, "LOCK_RELEASED");
      assert.equal(existsSync(macOpsLockPath(cwd)), false);
    }

    // 55 heartbeat + release + stale recovery remain serialized
    {
      const cwd = tmpCwd();
      writeLock(cwd, {
        pid: process.pid,
        runId: "old-owner",
        startedAt: "2026-09-01T00:00:00.000Z",
        expiresAt: "2026-09-01T00:20:00.000Z",
      });
      const go = deferred();
      let waiting = 0;
      let concurrentGuards = 0;
      let maxGuards = 0;
      const barrierHooks = {
        beforeRecoveryGuardAttempt: async () => {
          waiting += 1;
          if (waiting === 3) go.resolve();
          await go.promise;
        },
        afterRecoveryGuardAcquired: async () => {
          concurrentGuards += 1;
          maxGuards = Math.max(maxGuards, concurrentGuards);
        },
        afterRecoveryGuardReleased: async () => {
          concurrentGuards -= 1;
        },
      };
      const [acq, hb, rel] = await Promise.all([
        acquireMacOpsLock({
          cwd,
          runId: "recoverer",
          now: NOW,
          hooks: barrierHooks,
        }),
        refreshMacOpsLockLease({
          cwd,
          runId: "old-owner",
          now: NOW,
          hooks: barrierHooks,
        }),
        releaseMacOpsLock({
          cwd,
          runId: "old-owner",
          now: NOW,
          hooks: barrierHooks,
        }),
      ]);
      assert.ok(maxGuards <= 1);
      assert.ok(
        rel === "LOCK_RELEASED" ||
          rel === "LOCK_SERIALIZATION_BUSY" ||
          rel === "LOCK_HELD" ||
          rel === "LOCK_AVAILABLE",
      );
      const rec = await readMacOpsLock(cwd);
      if (acq.outcome === "LOCK_STALE_RECOVERED") {
        assert.equal(rec?.runId, "recoverer");
      } else if (rel === "LOCK_RELEASED") {
        assert.equal(rec, null);
      } else if (hb.outcome === "LEASE_REFRESHED") {
        assert.equal(rec?.runId, "old-owner");
      }
      assert.equal(existsSync(macOpsRecoveryLockPath(cwd)), false);
    }

    // 56 / 72 abandoned main lock still recoverable after TTL (no leftover guard)
    {
      const cwd = tmpCwd();
      const t0 = NOW;
      await acquireMacOpsLock({ cwd, runId: "abandoned", now: t0, ttlMs: 1000 });
      assert.equal(existsSync(macOpsRecoveryLockPath(cwd)), false);
      const tExpired = new Date(t0.getTime() + 1001);
      const recovered = await acquireMacOpsLock({
        cwd,
        runId: "later-tick",
        now: tExpired,
      });
      assert.equal(recovered.outcome, "LOCK_STALE_RECOVERED");
      const rec = await readMacOpsLock(cwd);
      assert.equal(rec?.runId, "later-tick");
      await releaseMacOpsLock({ cwd, runId: "later-tick" });
    }

    // 61 absent recovery guard → one wx owner
    {
      const cwd = tmpCwd();
      writeLock(cwd, { runId: "stale-main" });
      assert.equal(await inspectMacOpsRecoveryGuard({ cwd, now: NOW }), "GUARD_ABSENT");
      let owned = 0;
      const recovered = await acquireMacOpsLock({
        cwd,
        runId: "wx-owner",
        now: NOW,
        hooks: {
          afterRecoveryGuardAcquired: async () => {
            owned += 1;
            assert.equal(
              await inspectMacOpsRecoveryGuard({ cwd, now: NOW }),
              "GUARD_BUSY",
            );
          },
        },
      });
      assert.equal(recovered.outcome, "LOCK_STALE_RECOVERED");
      assert.equal(owned, 1);
      assert.equal(await inspectMacOpsRecoveryGuard({ cwd, now: NOW }), "GUARD_ABSENT");
      await releaseMacOpsLock({ cwd, runId: "wx-owner" });
    }

    // 62 fresh recovery guard → GUARD_BUSY
    {
      const cwd = tmpCwd();
      writeLock(cwd, { runId: "stale-main" });
      writeRecoveryGuard(cwd, {
        guardId: "live-holder",
        startedAt: NOW.toISOString(),
        expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
      });
      assert.equal(await inspectMacOpsRecoveryGuard({ cwd, now: NOW }), "GUARD_BUSY");
      const denied = await acquireMacOpsLock({
        cwd,
        runId: "challenger",
        now: NOW,
      });
      assert.equal(denied.outcome, "LOCK_SERIALIZATION_BUSY");
      assert.equal(readRecoveryGuardFile(cwd)?.guardId, "live-holder");
      assert.equal((await readMacOpsLock(cwd))?.runId, "stale-main");
    }

    // 63–66 expired recovery guard → GUARD_STALE, untouched, no rename/unlink
    {
      const cwd = tmpCwd();
      writeLock(cwd, { runId: "stale-main" });
      writeRecoveryGuard(cwd, { guardId: "expired-canonical" });
      const before = readFileSync(macOpsRecoveryLockPath(cwd), "utf8");
      assert.equal(await inspectMacOpsRecoveryGuard({ cwd, now: NOW }), "GUARD_STALE");
      const denied = await acquireMacOpsLock({
        cwd,
        runId: "challenger",
        now: NOW,
      });
      assert.equal(denied.outcome, "LOCK_RECOVERY_GUARD_STALE");
      assert.equal(readFileSync(macOpsRecoveryLockPath(cwd), "utf8"), before);
      assert.equal(readRecoveryGuardFile(cwd)?.guardId, "expired-canonical");
      assert.equal((await readMacOpsLock(cwd))?.runId, "stale-main");
      const mutexSrc = readFileSync(
        path.join(REPO, "src/lib/mac-operations-node-v1/mutex.ts"),
        "utf8",
      );
      assert.equal(mutexSrc.includes(".reclaim."), false);
      assert.equal(mutexSrc.includes("afterStaleGuardRenamed"), false);
    }

    // 68 fresh guard appearing after stale read → never moved or deleted
    {
      const cwd = tmpCwd();
      writeLock(cwd, { runId: "stale-main" });
      writeRecoveryGuard(cwd, { guardId: "expired-observed" });
      const freshExpires = new Date(NOW.getTime() + 60_000).toISOString();
      const result = await acquireMacOpsLock({
        cwd,
        runId: "attacker",
        now: NOW,
        hooks: {
          afterRecoveryGuardObserved: async () => {
            writeRecoveryGuard(cwd, {
              guardId: "winner-fresh",
              pid: 77,
              startedAt: NOW.toISOString(),
              expiresAt: freshExpires,
            });
          },
        },
      });
      assert.equal(result.outcome, "LOCK_SERIALIZATION_BUSY");
      assert.equal(readRecoveryGuardFile(cwd)?.guardId, "winner-fresh");
      assert.equal((await readMacOpsLock(cwd))?.runId, "stale-main");
    }

    // 69 heartbeat with stale recovery guard → no main mutation
    {
      const cwd = tmpCwd();
      const acquired = await acquireMacOpsLock({
        cwd,
        runId: "owner",
        now: NOW,
        ttlMs: 60_000,
      });
      const originalExpiry = acquired.record?.expiresAt;
      writeRecoveryGuard(cwd, { guardId: "expired-hb" });
      const hb = await refreshMacOpsLockLease({
        cwd,
        runId: "owner",
        now: NOW,
        ttlMs: 60_000,
      });
      assert.equal(hb.outcome, "LEASE_SERIALIZATION_STALE");
      assert.equal((await readMacOpsLock(cwd))?.expiresAt, originalExpiry);
      assert.equal(readRecoveryGuardFile(cwd)?.guardId, "expired-hb");
    }

    // 70 release with stale recovery guard → no main unlink
    {
      const cwd = tmpCwd();
      await acquireMacOpsLock({ cwd, runId: "owner", now: NOW });
      writeRecoveryGuard(cwd, { guardId: "expired-rel" });
      const rel = await releaseMacOpsLock({ cwd, runId: "owner", now: NOW });
      assert.equal(rel, "LOCK_RECOVERY_GUARD_STALE");
      assert.equal((await readMacOpsLock(cwd))?.runId, "owner");
      assert.equal(readRecoveryGuardFile(cwd)?.guardId, "expired-rel");
    }

    // 71 stale main lock + stale recovery guard → no automatic main takeover
    {
      const cwd = tmpCwd();
      writeEnv(cwd);
      writeStatsArtifacts(cwd);
      await writeReceipt(cwd, 465);
      writeLock(cwd, { runId: "abandoned-main" });
      writeRecoveryGuard(cwd, { guardId: "abandoned-guard" });
      const pre = await runMacOperationsNode({
        mode: "PREFLIGHT",
        ...readyOpts(cwd),
      });
      assert.equal(pre.recoveryGuardStatus, "GUARD_STALE");
      assert.equal(pre.lastErrorCode, RECOVERY_GUARD_STALE);
      assert.equal(pre.exitCode, MAC_OPS_EXIT.CONFIG_FAILURE);
      assert.equal(pre.readyForUnattendedOdds, false);
      const health = JSON.parse(
        readFileSync(path.join(cwd, MAC_OPS_HEALTH_REL), "utf8"),
      ) as { recoveryGuardStatus?: string; lastErrorCode?: string };
      assert.equal(health.recoveryGuardStatus, "GUARD_STALE");
      assert.equal(health.lastErrorCode, RECOVERY_GUARD_STALE);
      const takeover = await acquireMacOpsLock({
        cwd,
        runId: "would-takeover",
        now: NOW,
      });
      assert.equal(takeover.outcome, "LOCK_RECOVERY_GUARD_STALE");
      assert.equal((await readMacOpsLock(cwd))?.runId, "abandoned-main");
    }

    // 73 owner-created recovery guard release → only matching guardId may unlink
    {
      const cwd = tmpCwd();
      await acquireMacOpsLock({ cwd, runId: "owner", now: NOW });
      const released = await releaseMacOpsLock({ cwd, runId: "owner", now: NOW });
      assert.equal(released, "LOCK_RELEASED");
      assert.equal(existsSync(macOpsRecoveryLockPath(cwd)), false);

      await acquireMacOpsLock({ cwd, runId: "owner2", now: NOW });
      writeRecoveryGuard(cwd, {
        guardId: "foreign",
        startedAt: NOW.toISOString(),
        expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
      });
      const denied = await releaseMacOpsLock({ cwd, runId: "owner2", now: NOW });
      assert.equal(denied, "LOCK_SERIALIZATION_BUSY");
      assert.equal(readRecoveryGuardFile(cwd)?.guardId, "foreign");
      assert.equal((await readMacOpsLock(cwd))?.runId, "owner2");
    }

    // 59 runtime files remain Git-ignored
    {
      const recoveryIgnore = execFileSync(
        "git",
        ["check-ignore", "-v", MAC_OPS_RECOVERY_LOCK_REL],
        { cwd: REPO, encoding: "utf8" },
      );
      assert.ok(recoveryIgnore.includes(MAC_OPS_RECOVERY_LOCK_REL));
    }

    assert.equal(MAC_OPS_LOCK_TTL_MS, 30 * 60_000);
    assert.equal(MAC_OPS_LOCK_HEARTBEAT_INTERVAL_MS, 5 * 60_000);
    assert.equal(networkCalls, 0);
    assert.equal(MLB_STATS_AUTOMATION_ALLOWED, false);
  } finally {
    globalThis.fetch = origFetch;
  }

  console.log("test:mac-operations-node-v1 PASS");
  console.log("PROVIDER_CALLS=0");
  console.log("NETWORK_CALL_COUNT=0");
  console.log("PREDICTION_WRITES=0");
  console.log("LAUNCHD_INSTALLED=false");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
