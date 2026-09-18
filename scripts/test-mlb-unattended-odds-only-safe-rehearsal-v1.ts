/**
 * MLB unattended Odds-only safe rehearsal gate v1.
 * Fixture / mock only — zero live Provider calls. No launchd. No Prediction write.
 *
 *   npm run test:mlb-unattended-odds-only-safe-rehearsal-v1
 *
 * CONTROL_PATH rehearsal. Not LIVE_AUTOMATION_PASS.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseMlbDailyOpsCliArgs } from "./run-mlb-daily-ops-v1";
import { parsePregameSchedulerCliArgs } from "./run-pregame-scheduler-v1";
import { runMlbDailyOpsV1 } from "../src/lib/mlb/daily-ops-v1";
import type { MlbDailyOpsReport } from "../src/lib/mlb/daily-ops-v1";
import {
  buildOddsQuotaBootstrapReceipt,
  ODDS_OPERATOR_PLAN_EVIDENCE,
  writeOddsQuotaReceipt,
} from "../src/lib/odds/quota-receipt-v1";
import {
  isMlbStatsCollectorScript,
  LEGAL_CONDITIONAL_UNMET,
  LEGAL_PROVIDER_AUTOMATION_BLOCKED,
  MLB_STATS_AUTOMATION_ALLOWED,
  MLB_STATS_LEGAL_STATUS,
  ODDS_COLLECTOR_SCRIPT,
  ODDS_LEGAL_STATUS,
  PLAN_UNKNOWN,
} from "../src/lib/provider-automation-policy";
import { runPregameScheduler } from "../src/lib/scheduler";
import type { RunnerAction } from "../src/lib/scheduler/types";

const DATE = "2099-09-19";
const START = "2099-09-19T12:00:00.000Z";
const T60_AS_OF = "2099-09-19T11:00:00.000Z";
const T30_AS_OF = "2099-09-19T11:35:00.000Z";
const ODDS_STALE_AT = "2099-09-19T10:00:00.000Z";
const ODDS_FRESH_T30_AT = "2099-09-19T11:30:00.000Z";
const LINEUP_STALE_AT = "2099-09-19T10:00:00.000Z";
const RECEIPT_AT = "2099-09-19T10:30:00.000Z";
const STALE_RECEIPT_AT = "2099-08-31T12:00:00.000Z";
const QUOTA_REMAINING_FIXTURE = 465;
const SCH_NOW = new Date(T60_AS_OF);

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
    meta: { generatedAt: T60_AS_OF, dateKst: DATE },
    rows: [
      { gameId: "mlb-1", side: "home" },
      { gameId: "mlb-1", side: "away" },
    ],
    summary: {},
  });
}

function writeLineup(cwd: string, observedAt = T60_AS_OF) {
  writeJson(cwd, `data/research/mlb/${DATE}-lineup-dataset-v1.json`, {
    meta: { generatedAt: observedAt, dateKst: DATE },
    rows: [
      {
        gameId: "mlb-1",
        side: "home",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        generatedAt: observedAt,
        sourceTimestamp: observedAt,
      },
      {
        gameId: "mlb-1",
        side: "away",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        generatedAt: observedAt,
        sourceTimestamp: observedAt,
      },
    ],
  });
}

function writeOdds(cwd: string, capturedAt: string) {
  writeJson(cwd, `data/research/mlb/${DATE}-odds-history-dataset-v1.json`, {
    meta: { generatedAt: capturedAt, dateKst: DATE },
    rows: [
      {
        gameId: "mlb-1",
        collectionStatus: "COLLECTED",
        capturedAt,
        cutoffTime: START,
        markets: [
          { marketType: "moneyline", selection: "home", priceDecimal: 1.9 },
          { marketType: "moneyline", selection: "away", priceDecimal: 2.1 },
        ],
      },
    ],
  });
}

async function writeReceipt(
  cwd: string,
  remaining: number,
  observedAt: string,
) {
  const receipt = buildOddsQuotaBootstrapReceipt({
    planName: ODDS_OPERATOR_PLAN_EVIDENCE.planName,
    requestsRemaining: remaining,
    requestsUsed: 35,
    evidenceDate: ODDS_OPERATOR_PLAN_EVIDENCE.evidenceDate,
    observedAt,
  });
  await writeOddsQuotaReceipt(receipt, cwd);
}

function countPredictionFiles(cwd: string): number {
  const roots = [
    path.join(cwd, "data", "predictions"),
    path.join(cwd, "data", "research", "mlb"),
  ];
  let n = 0;
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if (/prediction/i.test(name)) n += 1;
    }
  }
  return n;
}

function spawnCounter(opts?: { allowOdds?: boolean }) {
  const stats: string[] = [];
  const odds: string[] = [];
  return {
    stats,
    odds,
    spawnCollector: async (scriptRel: string) => {
      if (isMlbStatsCollectorScript(scriptRel)) {
        stats.push(scriptRel);
        throw new Error(`UNEXPECTED_MLB_STATS_SPAWN:${scriptRel}`);
      }
      if (scriptRel === ODDS_COLLECTOR_SCRIPT) {
        odds.push(scriptRel);
        if (!opts?.allowOdds) {
          throw new Error(`UNEXPECTED_ODDS_SPAWN:${scriptRel}`);
        }
        return 0;
      }
      throw new Error(`UNEXPECTED_SPAWN:${scriptRel}`);
    },
  };
}

async function unattendedT60(
  cwd: string,
  extra: {
    allowOdds?: boolean;
    oddsPlanConfirmed?: boolean;
    oddsApiKeyPresent?: boolean;
    genericProviderLaunchd?: boolean;
    writeOddsStale?: boolean;
    asOf?: string;
    window?: "T60" | "T30";
  } = {},
): Promise<{ report: MlbDailyOpsReport; stats: string[]; odds: string[] }> {
  const mock = spawnCounter({ allowOdds: extra.allowOdds });
  const report = await runMlbDailyOpsV1({
    dateKst: DATE,
    cwd,
    window: extra.window ?? "T60",
    asOf: extra.asOf ?? T60_AS_OF,
    dryRun: false,
    noProvider: false,
    writePrediction: false,
    sealDeliveryRecord: false,
    unattended: true,
    oddsPlanConfirmed: extra.oddsPlanConfirmed ?? true,
    oddsApiKeyPresent: extra.oddsApiKeyPresent ?? true,
    genericProviderLaunchd: extra.genericProviderLaunchd,
    spawnCollector: mock.spawnCollector,
  });
  return { report, stats: mock.stats, odds: mock.odds };
}

async function main() {
  assert.equal(MLB_STATS_AUTOMATION_ALLOWED, false);
  assert.equal(MLB_STATS_LEGAL_STATUS, "LEGAL_REVIEW_REQUIRED");
  assert.equal(ODDS_LEGAL_STATUS, "LEGAL_CONDITIONAL");

  const origFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (async (..._args: Parameters<typeof fetch>) => {
    networkCalls += 1;
    throw new Error("UNEXPECTED_NETWORK_CALL");
  }) as typeof fetch;

  try {
    // 1. unattended context parsed
    const schedCli = parsePregameSchedulerCliArgs([
      "--date",
      DATE,
      "--league",
      "MLB",
      "--unattended",
    ]);
    assert.equal(schedCli.unattended, true);
    assert.equal(schedCli.rehearsal, false);
    const opsCli = parseMlbDailyOpsCliArgs([
      "--date",
      DATE,
      "--window",
      "T60",
      "--unattended",
      "--no-write",
      "--no-seal",
    ]);
    assert.equal(opsCli.unattended, true);
    assert.equal(opsCli.writePrediction, false);

    // 2 + 3 + 11 transport: Scheduler delegates unattended; receipt not CLI-forwarded
    {
      const cwd = tmpCwd("uah-sch-");
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, RECEIPT_AT);
      const calls: RunnerAction[] = [];
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
        now: SCH_NOW,
        fixtureGames: [{ gameId: "mlb-game-1", scheduledStartTime: START }],
        executeRunner: async (action) => {
          calls.push(action);
          return 0;
        },
      });
      assert.equal(result.quotaSource, "RECEIPT");
      const daily = calls.find((c) => c.actionId === "RUN_MLB_DAILY_OPS");
      assert.ok(daily);
      assert.ok(daily!.args?.includes("--unattended"));
      assert.equal(daily!.args?.includes("--quota-remaining"), false);
      assert.equal(daily!.args?.includes("--rehearsal"), false);
      assert.equal(daily!.args?.includes("--rehearsal-as-of"), false);
      const windowIdx = daily!.args?.indexOf("--window") ?? -1;
      assert.equal(daily!.args?.[windowIdx + 1], "T60");
    }

    // 4–6, 18–20. positive valid Plan/key/quota → Odds mock spawn 1, Stats 0
    {
      const cwd = tmpCwd("uah-pos-");
      writeSchedule(cwd);
      writeStarter(cwd);
      writeLineup(cwd, T60_AS_OF);
      writeOdds(cwd, ODDS_STALE_AT);
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, RECEIPT_AT);
      const delegated: RunnerAction[] = [];
      const mock = spawnCounter({ allowOdds: true });
      const sch = await runPregameScheduler({
        dateKst: DATE,
        league: "MLB",
        dryRun: false,
        noProvider: false,
        includePostgame: false,
        json: false,
        persist: false,
        unattended: true,
        cwd,
        now: SCH_NOW,
        fixtureGames: [{ gameId: "mlb-game-1", scheduledStartTime: START }],
        executeRunner: async (action) => {
          delegated.push(action);
          assert.ok(action.args?.includes("--unattended"));
          assert.equal(action.args?.includes("--quota-remaining"), false);
          const report = await runMlbDailyOpsV1({
            dateKst: DATE,
            cwd,
            window: "T60",
            asOf: T60_AS_OF,
            dryRun: false,
            noProvider: false,
            writePrediction: false,
            sealDeliveryRecord: false,
            unattended: true,
            oddsPlanConfirmed: true,
            oddsApiKeyPresent: true,
            spawnCollector: mock.spawnCollector,
          });
          assert.equal(report.quotaSource, "RECEIPT");
          assert.equal(report.window, "T60");
          assert.equal(mock.odds.length, 1);
          assert.equal(mock.stats.length, 0);
          assert.equal(countPredictionFiles(cwd), 0);
          return 0;
        },
      });
      assert.equal(sch.quotaSource, "RECEIPT");
      assert.equal(delegated.length, 1);
      assert.equal(mock.odds.length, 1);
      assert.equal(mock.stats.length, 0);
      assert.equal(countPredictionFiles(cwd), 0);
    }

    // 7. Schedule missing → legal block
    {
      const cwd = tmpCwd("uah-sched-");
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, RECEIPT_AT);
      const { report, stats, odds } = await unattendedT60(cwd);
      assert.equal(stats.length, 0);
      assert.equal(odds.length, 0);
      assert.equal(report.failure?.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    }

    // 8. Starter missing → legal block
    {
      const cwd = tmpCwd("uah-starter-");
      writeSchedule(cwd);
      writeOdds(cwd, T60_AS_OF);
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, RECEIPT_AT);
      const { report, stats, odds } = await unattendedT60(cwd);
      assert.equal(stats.length, 0);
      assert.equal(odds.length, 0);
      assert.equal(report.failure?.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    }

    // 9. Lineup refresh required → legal block
    {
      const cwd = tmpCwd("uah-lineup-");
      writeSchedule(cwd);
      writeStarter(cwd);
      writeLineup(cwd, LINEUP_STALE_AT);
      writeOdds(cwd, ODDS_FRESH_T30_AT);
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, RECEIPT_AT);
      const { report, stats, odds } = await unattendedT60(cwd, {
        window: "T30",
        asOf: T30_AS_OF,
      });
      assert.equal(stats.length, 0);
      assert.equal(odds.length, 0);
      assert.equal(report.failure?.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    }

    // 10. generic provider flag cannot override
    {
      const cwd = tmpCwd("uah-generic-");
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, RECEIPT_AT);
      const { report, stats } = await unattendedT60(cwd, {
        genericProviderLaunchd: true,
      });
      assert.equal(stats.length, 0);
      assert.equal(report.failure?.reason, LEGAL_PROVIDER_AUTOMATION_BLOCKED);
    }

    const oddsNegBase = (cwd: string) => {
      writeSchedule(cwd);
      writeStarter(cwd);
      writeLineup(cwd, T60_AS_OF);
      writeOdds(cwd, ODDS_STALE_AT);
    };

    // 11. Plan unknown → Odds 0
    {
      const cwd = tmpCwd("uah-plan-");
      oddsNegBase(cwd);
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, RECEIPT_AT);
      const { report, odds, stats } = await unattendedT60(cwd, {
        oddsPlanConfirmed: false,
        oddsApiKeyPresent: true,
      });
      assert.equal(odds.length, 0);
      assert.equal(stats.length, 0);
      assert.equal(report.failure?.reason, PLAN_UNKNOWN);
    }

    // 12. key absent → Odds 0
    {
      const cwd = tmpCwd("uah-key-");
      oddsNegBase(cwd);
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, RECEIPT_AT);
      const { report, odds } = await unattendedT60(cwd, {
        oddsPlanConfirmed: true,
        oddsApiKeyPresent: false,
      });
      assert.equal(odds.length, 0);
      assert.equal(report.failure?.reason, LEGAL_CONDITIONAL_UNMET);
    }

    // 13. receipt missing → Odds 0
    {
      const cwd = tmpCwd("uah-miss-");
      oddsNegBase(cwd);
      const { report, odds } = await unattendedT60(cwd);
      assert.equal(odds.length, 0);
      assert.equal(report.quotaSource, "NONE");
      assert.equal(report.failure?.reason, "QUOTA_DECISION_EXTERNAL");
    }

    // 14. receipt stale → Odds 0
    {
      const cwd = tmpCwd("uah-stale-");
      oddsNegBase(cwd);
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, STALE_RECEIPT_AT);
      const { report, odds } = await unattendedT60(cwd);
      assert.equal(odds.length, 0);
      assert.equal(report.quotaSource, "NONE");
      assert.equal(report.failure?.reason, "QUOTA_DECISION_EXTERNAL");
    }

    // 15. quota zero → Odds 0
    {
      const cwd = tmpCwd("uah-zero-");
      oddsNegBase(cwd);
      await writeReceipt(cwd, 0, RECEIPT_AT);
      const { report, odds } = await unattendedT60(cwd);
      assert.equal(odds.length, 0);
      assert.equal(report.quotaSource, "RECEIPT");
      assert.equal(report.failure?.reason, "QUOTA_DECISION_EXTERNAL");
    }

    // 16. CLI quota override remains compatible
    {
      const cwd = tmpCwd("uah-cli-");
      await writeReceipt(cwd, QUOTA_REMAINING_FIXTURE, RECEIPT_AT);
      const calls: RunnerAction[] = [];
      const result = await runPregameScheduler({
        dateKst: DATE,
        league: "MLB",
        dryRun: false,
        noProvider: false,
        includePostgame: false,
        json: false,
        persist: false,
        unattended: true,
        quotaRemaining: 10,
        cwd,
        now: SCH_NOW,
        fixtureGames: [{ gameId: "mlb-game-1", scheduledStartTime: START }],
        executeRunner: async (action) => {
          calls.push(action);
          return 0;
        },
      });
      assert.equal(result.quotaSource, "CLI");
      const daily = calls.find((c) => c.actionId === "RUN_MLB_DAILY_OPS");
      const i = daily!.args?.indexOf("--quota-remaining") ?? -1;
      assert.equal(daily!.args?.[i + 1], "10");
      assert.ok(daily!.args?.includes("--unattended"));
    }

    // 17. rehearsal + unattended rejected
    assert.throws(
      () =>
        parsePregameSchedulerCliArgs([
          "--date",
          DATE,
          "--league",
          "MLB",
          "--rehearsal",
          "--unattended",
        ]),
      /UNATTENDED_CONFLICT/,
    );
    assert.throws(
      () =>
        parseMlbDailyOpsCliArgs([
          "--date",
          DATE,
          "--window",
          "T60",
          "--unattended",
          "--rehearsal-as-of",
          T60_AS_OF,
          "--no-provider",
          "--no-write",
          "--no-seal",
        ]),
      /UNATTENDED_CONFLICT/,
    );

    assert.equal(networkCalls, 0);
    assert.equal(MLB_STATS_AUTOMATION_ALLOWED, false);
  } finally {
    globalThis.fetch = origFetch;
  }

  console.log("test:mlb-unattended-odds-only-safe-rehearsal-v1 PASS");
  console.log("CONTROL_PATH=PASS");
  console.log("ODDS_ELIGIBLE_MOCK");
  console.log("LIVE_AUTOMATION_PASS=false");
  console.log("PROVIDER_CALLS=0");
  console.log("NETWORK_CALL_COUNT=0");
  console.log("PREDICTION_WRITES=0");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
