/**
 * Provider-specific automation legal gate enforcement v1.
 * Fixture / mock only — zero live Provider calls.
 *
 *   npm run test:mlb-provider-automation-legal-gate-v1
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseMlbDailyOpsCliArgs } from "./run-mlb-daily-ops-v1";
import { parsePregameSchedulerCliArgs } from "./run-pregame-scheduler-v1";
import { runMlbDailyOpsV1 } from "../src/lib/mlb/daily-ops-v1";
import {
  decideMlbDailyCollection,
  evaluateCollectionWindowRun,
} from "../src/lib/mlb/daily-pregame-v0";
import {
  evaluateOddsLiveAutomation,
  evaluateUnattendedCollectorSpawn,
  getProviderAutomationPolicySnapshot,
  isMlbStatsCollectorScript,
  LEGAL_CONDITIONAL_UNMET,
  LEGAL_PROVIDER_AUTOMATION_BLOCKED,
  MLB_PRIVATE_RESEARCH_SCRIPTS,
  MLB_STATS_AUTOMATION_ALLOWED,
  MLB_STATS_COLLECTOR_SCRIPTS,
  MLB_STATS_LEGAL_STATUS,
  ODDS_COLLECTOR_SCRIPT,
  ODDS_LEGAL_STATUS,
  PLAN_UNKNOWN,
} from "../src/lib/provider-automation-policy";
import { runPregameScheduler } from "../src/lib/scheduler";
import { mlbAction } from "../src/lib/scheduler/league-adapters/mlb";

const DATE = "2099-09-19";
const START = "2099-09-19T12:00:00.000Z";
const AS_OF = "2099-09-19T10:30:00.000Z";
const REPO = process.cwd();

function tmpCwd(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

function writeJson(cwd: string, rel: string, body: unknown) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

function writeSchedule(cwd: string) {
  writeJson(cwd, `data/research/mlb/${DATE}-schedule-v1.json`, {
    dateKst: DATE,
    games: [
      {
        internalGameId: "mlb-1",
        gamePk: 1,
        homeTeam: "Home",
        awayTeam: "Away",
        commenceTimeUtc: START,
        statusAbstract: "Preview",
      },
    ],
  });
}

function writeStarter(cwd: string) {
  writeJson(cwd, `data/research/mlb/${DATE}-starter-dataset-v1.json`, {
    meta: { generatedAt: AS_OF, dateKst: DATE },
    rows: [
      { gameId: "mlb-1", side: "home" },
      { gameId: "mlb-1", side: "away" },
    ],
    summary: {},
  });
}

function writeLineup(cwd: string) {
  writeJson(cwd, `data/research/mlb/${DATE}-lineup-dataset-v1.json`, {
    meta: { generatedAt: AS_OF, dateKst: DATE },
    rows: [
      {
        gameId: "mlb-1",
        side: "home",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        generatedAt: AS_OF,
        sourceTimestamp: AS_OF,
      },
      {
        gameId: "mlb-1",
        side: "away",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        generatedAt: AS_OF,
        sourceTimestamp: AS_OF,
      },
    ],
  });
}

function writeOdds(cwd: string) {
  writeJson(cwd, `data/research/mlb/${DATE}-odds-history-dataset-v1.json`, {
    meta: { generatedAt: AS_OF, dateKst: DATE },
    rows: [
      {
        gameId: "mlb-1",
        collectionStatus: "COLLECTED",
        capturedAt: AS_OF,
        cutoffTime: START,
        markets: [
          { marketType: "moneyline", selection: "home", priceDecimal: 1.9 },
          { marketType: "moneyline", selection: "away", priceDecimal: 2.1 },
        ],
      },
    ],
  });
}

function countByKind(calls: string[]) {
  return {
    stats: calls.filter((s) => isMlbStatsCollectorScript(s)).length,
    odds: calls.filter((s) => s === ODDS_COLLECTOR_SCRIPT).length,
    all: calls.length,
  };
}

function mockSpawn(opts?: { allowOdds?: boolean; allowStats?: boolean }) {
  const calls: string[] = [];
  return {
    calls,
    spawnCollector: async (scriptRel: string) => {
      calls.push(scriptRel);
      if (isMlbStatsCollectorScript(scriptRel) && !opts?.allowStats) {
        throw new Error(`UNEXPECTED_MLB_STATS_SPAWN:${scriptRel}`);
      }
      if (scriptRel === ODDS_COLLECTOR_SCRIPT && !opts?.allowOdds) {
        throw new Error(`UNEXPECTED_ODDS_SPAWN:${scriptRel}`);
      }
      return 0;
    },
  };
}

async function unattendedOps(
  cwd: string,
  extra: {
    allowOdds?: boolean;
    allowStats?: boolean;
    oddsPlanConfirmed?: boolean;
    oddsApiKeyPresent?: boolean;
    genericProviderLaunchd?: boolean;
    unattended?: boolean;
  } = {},
) {
  const mock = mockSpawn({
    allowOdds: extra.allowOdds,
    allowStats: extra.allowStats,
  });
  const report = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd,
    window: "T90",
    asOf: AS_OF,
    dryRun: false,
    noProvider: false,
    writePrediction: false,
    sealDeliveryRecord: false,
    quotaRemaining: 465,
    unattended: extra.unattended ?? true,
    oddsPlanConfirmed: extra.oddsPlanConfirmed ?? false,
    oddsApiKeyPresent: extra.oddsApiKeyPresent ?? false,
    genericProviderLaunchd: extra.genericProviderLaunchd,
    spawnCollector: mock.spawnCollector,
  });
  return { report, calls: mock.calls };
}

async function main() {
  const policy = getProviderAutomationPolicySnapshot({
    oddsPlanConfirmed: false,
    oddsApiKeyPresent: false,
    oddsQuotaAllows: false,
  });
  assert.equal(policy.MLB_STATS_API.legalStatus, MLB_STATS_LEGAL_STATUS);
  assert.equal(policy.MLB_STATS_API.legalStatus, "LEGAL_REVIEW_REQUIRED");
  assert.equal(policy.MLB_STATS_API.automationAllowed, false);
  assert.equal(MLB_STATS_AUTOMATION_ALLOWED, false);
  assert.equal(policy.THE_ODDS_API.legalStatus, ODDS_LEGAL_STATUS);
  assert.equal(policy.THE_ODDS_API.legalStatus, "LEGAL_CONDITIONAL");
  assert.equal(policy.THE_ODDS_API.planConfirmed, false);
  assert.equal(policy.THE_ODDS_API.automationAllowed, false);
  assert.equal(policy.THE_ODDS_API.reason, PLAN_UNKNOWN);

  const oddsUnknown = evaluateOddsLiveAutomation({
    planConfirmed: false,
    apiKeyPresent: true,
    quotaAllows: true,
  });
  assert.equal(oddsUnknown.legalStatus, "LEGAL_CONDITIONAL");
  assert.equal(oddsUnknown.automationAllowed, false);
  assert.equal(oddsUnknown.reason, PLAN_UNKNOWN);

  const oddsEligible = evaluateOddsLiveAutomation({
    planConfirmed: true,
    apiKeyPresent: true,
    quotaAllows: true,
  });
  assert.equal(oddsEligible.legalStatus, "LEGAL_CONDITIONAL");
  assert.equal(oddsEligible.automationAllowed, true);
  assert.equal(oddsEligible.reason, null);

  const statsHold = evaluateUnattendedCollectorSpawn({
    collector: "SCHEDULE",
    executionContext: "UNATTENDED_AUTOMATION",
    genericProviderLaunchd: true,
  });
  assert.equal(statsHold.spawnAllowed, false);
  assert.equal(statsHold.automationAllowed, false);
  assert.equal(statsHold.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
  assert.equal(statsHold.provider, "MLB_STATS_API");

  const missingScheduleUnattended = decideMlbDailyCollection({
    window: "T90",
    dataset: "SCHEDULE",
    exists: false,
    executionContext: "UNATTENDED_AUTOMATION",
    genericProviderLaunchd: true,
  });
  assert.equal(missingScheduleUnattended.spawnAllowed, false);
  assert.equal(missingScheduleUnattended.action, "BLOCK");
  assert.equal(
    missingScheduleUnattended.code,
    LEGAL_PROVIDER_AUTOMATION_BLOCKED,
  );
  assert.ok(
    missingScheduleUnattended.notes.includes(
      "GENERIC_PROVIDER_LAUNCHD_CANNOT_OVERRIDE_MLB_STATS_HOLD",
    ),
  );

  const missingScheduleManual = decideMlbDailyCollection({
    window: "T90",
    dataset: "SCHEDULE",
    exists: false,
    executionContext: "MANUAL_RESEARCH",
  });
  assert.equal(missingScheduleManual.spawnAllowed, true);
  assert.equal(missingScheduleManual.code, "COLLECT_MISSING");

  const oddsPlanUnknown = decideMlbDailyCollection({
    window: "T90",
    dataset: "ODDS",
    exists: false,
    quotaRemaining: 465,
    executionContext: "UNATTENDED_AUTOMATION",
    oddsPlanConfirmed: false,
    oddsApiKeyPresent: true,
  });
  assert.equal(oddsPlanUnknown.spawnAllowed, false);
  assert.equal(oddsPlanUnknown.code, PLAN_UNKNOWN);

  const oddsReady = decideMlbDailyCollection({
    window: "T90",
    dataset: "ODDS",
    exists: false,
    quotaRemaining: 465,
    executionContext: "UNATTENDED_AUTOMATION",
    oddsPlanConfirmed: true,
    oddsApiKeyPresent: true,
  });
  assert.equal(oddsReady.spawnAllowed, true);
  assert.equal(oddsReady.action, "COLLECT");
  assert.equal(oddsReady.code, "COLLECT_MISSING");

  const legalWindow = evaluateCollectionWindowRun({
    blockingIssues: [],
    stages: [
      {
        stage: "SCHEDULE",
        status: "BLOCKED",
        blockers: [LEGAL_PROVIDER_AUTOMATION_BLOCKED],
        errorCode: LEGAL_PROVIDER_AUTOMATION_BLOCKED,
        detail: {
          spawnRequested: true,
          spawnAllowed: false,
          providerPolicy: LEGAL_PROVIDER_AUTOMATION_BLOCKED,
          collectionDecision: LEGAL_PROVIDER_AUTOMATION_BLOCKED,
        },
      },
    ],
  });
  assert.equal(legalWindow.outcome, "ACTION_REQUIRED");
  assert.equal(legalWindow.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
  assert.notEqual(legalWindow.reason, "PROVIDER_REQUIRED");

  // 1. unattended Schedule missing → MLB Stats spawn 0
  {
    const cwd = tmpCwd("legal-sched-");
    const { report, calls } = await unattendedOps(cwd);
    const counts = countByKind(calls);
    assert.equal(counts.stats, 0);
    assert.equal(report.providerCalls, 0);
    assert.equal(report.windowOutcome, "ACTION_REQUIRED");
    assert.equal(report.failure?.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    assert.notEqual(report.failure?.reason, "PROVIDER_REQUIRED");
    const sched = report.pregame?.stages.find((s) => s.stage === "SCHEDULE");
    assert.equal(sched?.detail?.collectionDecision, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    assert.equal(sched?.detail?.providerPolicy, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
  }

  // 2. unattended Starter missing → MLB Stats spawn 0
  {
    const cwd = tmpCwd("legal-starter-");
    writeSchedule(cwd);
    const { report, calls } = await unattendedOps(cwd);
    const counts = countByKind(calls);
    assert.equal(counts.stats, 0);
    assert.equal(report.failure?.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    const starter = report.pregame?.stages.find((s) => s.stage === "STARTER");
    assert.equal(
      starter?.detail?.collectionDecision,
      LEGAL_PROVIDER_AUTOMATION_BLOCKED,
    );
  }

  // 3. unattended Lineup missing → MLB Stats spawn 0
  {
    const cwd = tmpCwd("legal-lineup-");
    writeSchedule(cwd);
    writeStarter(cwd);
    writeOdds(cwd);
    const { report, calls } = await unattendedOps(cwd);
    const counts = countByKind(calls);
    assert.equal(counts.stats, 0);
    assert.equal(report.failure?.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    const lineup = report.pregame?.stages.find((s) => s.stage === "LINEUP");
    assert.equal(
      lineup?.detail?.collectionDecision,
      LEGAL_PROVIDER_AUTOMATION_BLOCKED,
    );
  }

  // 4. correct blocker LEGAL_PROVIDER_AUTOMATION_BLOCKED
  assert.equal(LEGAL_PROVIDER_AUTOMATION_BLOCKED, "LEGAL_PROVIDER_AUTOMATION_BLOCKED");

  // 5. manual/private research path is not deleted
  for (const script of MLB_STATS_COLLECTOR_SCRIPTS) {
    assert.equal(existsSync(path.join(REPO, script)), true, script);
  }
  const pkg = JSON.parse(readFileSync(path.join(REPO, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.ok(pkg.scripts[MLB_PRIVATE_RESEARCH_SCRIPTS.schedule]);
  assert.ok(pkg.scripts[MLB_PRIVATE_RESEARCH_SCRIPTS.starter]);
  assert.ok(pkg.scripts[MLB_PRIVATE_RESEARCH_SCRIPTS.lineup]);
  {
    const cwd = tmpCwd("legal-manual-");
    const mock = mockSpawn({ allowStats: true, allowOdds: true });
    const report = await runMlbDailyOpsV1({
      dateKst: DATE,
      cwd,
      window: "T90",
      asOf: AS_OF,
      dryRun: false,
      noProvider: false,
      writePrediction: false,
      sealDeliveryRecord: false,
      quotaRemaining: 465,
      unattended: false,
      oddsPlanConfirmed: false,
      oddsApiKeyPresent: false,
      spawnCollector: mock.spawnCollector,
    });
    assert.equal(countByKind(mock.calls).stats >= 1, true);
    const sched = report.pregame?.stages.find((s) => s.stage === "SCHEDULE");
    assert.notEqual(
      sched?.detail?.collectionDecision,
      LEGAL_PROVIDER_AUTOMATION_BLOCKED,
    );
  }

  // 6. Odds PLAN_UNKNOWN → network spawn 0
  {
    const cwd = tmpCwd("legal-odds-unknown-");
    writeSchedule(cwd);
    writeStarter(cwd);
    writeLineup(cwd);
    const { report, calls } = await unattendedOps(cwd, {
      oddsPlanConfirmed: false,
      oddsApiKeyPresent: true,
    });
    assert.equal(countByKind(calls).odds, 0);
    assert.equal(countByKind(calls).stats, 0);
    assert.equal(report.failure?.reason, PLAN_UNKNOWN);
    const odds = report.pregame?.stages.find((s) => s.stage === "ODDS");
    assert.equal(odds?.detail?.collectionDecision, PLAN_UNKNOWN);
  }

  // 7. Odds conditional requirements satisfied → action eligible
  {
    const cwd = tmpCwd("legal-odds-ok-");
    writeSchedule(cwd);
    writeStarter(cwd);
    writeLineup(cwd);
    const { report, calls } = await unattendedOps(cwd, {
      allowOdds: true,
      oddsPlanConfirmed: true,
      oddsApiKeyPresent: true,
    });
    assert.equal(countByKind(calls).odds, 1);
    assert.equal(countByKind(calls).stats, 0);
    const odds = report.pregame?.stages.find((s) => s.stage === "ODDS");
    assert.equal(odds?.detail?.spawnAllowed, true);
    assert.notEqual(odds?.detail?.collectionDecision, PLAN_UNKNOWN);
  }

  // 8. generic Provider flag cannot override MLB Stats legal HOLD
  {
    const cwd = tmpCwd("legal-generic-");
    const { report, calls } = await unattendedOps(cwd, {
      genericProviderLaunchd: true,
    });
    assert.equal(countByKind(calls).stats, 0);
    assert.equal(report.failure?.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    const notes = report.pregame?.stages.find((s) => s.stage === "SCHEDULE")
      ?.detail?.notes;
    assert.ok(
      Array.isArray(notes) &&
        notes.includes("GENERIC_PROVIDER_LAUNCHD_CANNOT_OVERRIDE_MLB_STATS_HOLD"),
    );
  }

  const cliDaily = parseMlbDailyOpsCliArgs([
    "--date",
    DATE,
    "--window",
    "T90",
    "--unattended",
    "--quota-remaining",
    "465",
  ]);
  assert.equal(cliDaily.unattended, true);

  const cliSched = parsePregameSchedulerCliArgs([
    "--date",
    DATE,
    "--league",
    "MLB",
    "--unattended",
    "--json",
  ]);
  assert.equal(cliSched.unattended, true);

  assert.throws(
    () =>
      parsePregameSchedulerCliArgs([
        "--date",
        DATE,
        "--league",
        "MLB",
        "--unattended",
        "--rehearsal",
      ]),
    /UNATTENDED_CONFLICT/,
  );

  const discoveryBlocked = mlbAction({
    stage: "SCHEDULE_DISCOVERY",
    dateKst: DATE,
    gameId: "mlb-game-1",
    includePostgame: false,
    noProvider: false,
    unattended: true,
  });
  assert.equal(discoveryBlocked.kind, "MANUAL_REQUIRED");
  assert.equal(discoveryBlocked.actionId, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
  assert.equal(discoveryBlocked.mayCallProvider, false);
  assert.equal(discoveryBlocked.scriptRel, undefined);

  const discoveryManual = mlbAction({
    stage: "SCHEDULE_DISCOVERY",
    dateKst: DATE,
    gameId: "mlb-game-1",
    includePostgame: false,
    noProvider: false,
    unattended: false,
  });
  assert.equal(discoveryManual.scriptRel, "scripts/build-mlb-schedule-artifact-v1.ts");

  const t90Unattended = mlbAction({
    stage: "T90_COLLECTION",
    dateKst: DATE,
    gameId: "mlb-game-1",
    includePostgame: false,
    noProvider: false,
    unattended: true,
  });
  assert.equal(t90Unattended.actionId, "RUN_MLB_DAILY_OPS");
  assert.ok(t90Unattended.args?.includes("--unattended"));
  assert.ok(!t90Unattended.args?.includes("--rehearsal-as-of"));

  {
    const cwd = tmpCwd("legal-sch-miss-");
    let runnerCalls = 0;
    const result = await runPregameScheduler({
      dateKst: DATE,
      league: "MLB",
      dryRun: false,
      noProvider: false,
      includePostgame: false,
      json: false,
      persist: false,
      unattended: true,
      cwd,
      executeRunner: async () => {
        runnerCalls += 1;
        return 0;
      },
    });
    assert.equal(runnerCalls, 0);
    assert.equal(
      result.globalBlocker,
      "LEGAL_PROVIDER_AUTOMATION_BLOCKED:MLB_STATS_API",
    );
  }

  {
    let runnerCalls = 0;
    const result = await runPregameScheduler({
      dateKst: DATE,
      league: "MLB",
      dryRun: false,
      noProvider: false,
      includePostgame: false,
      json: false,
      persist: false,
      unattended: true,
      forceStage: "SCHEDULE_DISCOVERY",
      now: new Date(AS_OF),
      fixtureGames: [
        { gameId: "mlb-game-1", scheduledStartTime: START },
      ],
      cwd: tmpCwd("legal-sch-disc-"),
      executeRunner: async () => {
        runnerCalls += 1;
        return 0;
      },
    });
    assert.equal(runnerCalls, 0);
    assert.equal(
      result.plans[0]?.errorCode,
      LEGAL_PROVIDER_AUTOMATION_BLOCKED,
    );
    assert.equal(result.plans[0]?.action?.kind, "MANUAL_REQUIRED");
  }

  assert.equal(LEGAL_CONDITIONAL_UNMET, "LEGAL_CONDITIONAL_UNMET");
  console.log("test:mlb-provider-automation-legal-gate-v1 PASS");
  console.log("PROVIDER_CALLS=0");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
