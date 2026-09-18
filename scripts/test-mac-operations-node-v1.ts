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
  MAC_OPS_LOCK_REL,
  MAC_OPS_LOCK_TTL_MS,
  macOpsLockPath,
  readMacOpsLock,
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

    assert.equal(MAC_OPS_LOCK_TTL_MS, 30 * 60_000);
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
