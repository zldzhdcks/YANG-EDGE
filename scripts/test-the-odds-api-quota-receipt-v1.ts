/**
 * The Odds API quota receipt v1 tests.
 * Fixture / mock only — zero live Provider calls. No API key output.
 *
 *   npm run test:the-odds-api-quota-receipt-v1
 */
import assert from "node:assert/strict";
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
import { runMlbDailyOpsV1 } from "../src/lib/mlb/daily-ops-v1";
import {
  buildOddsQuotaBootstrapReceipt,
  currentOddsQuotaResetAtUtc,
  ODDS_OPERATOR_PLAN_EVIDENCE,
  ODDS_QUOTA_RECEIPT_NOT_UPDATED,
  ODDS_QUOTA_RECEIPT_REL,
  parseOddsQuotaReceiptHeaders,
  readOddsQuotaReceipt,
  receiptContainsForbiddenSecrets,
  resolveOddsQuotaInput,
  writeJsonAtomic,
  writeOddsQuotaReceipt,
  writeOddsQuotaReceiptFromHeaders,
} from "../src/lib/odds/quota-receipt-v1";
import { MLB_STATS_AUTOMATION_ALLOWED } from "../src/lib/provider-automation-policy";
import { runPregameScheduler } from "../src/lib/scheduler";
import type { RunnerAction } from "../src/lib/scheduler/types";

const REPO = process.cwd();
const RECEIPT_NOW = new Date("2026-09-19T12:00:00.000Z");
const RESET_OCT = new Date("2026-10-01T00:00:00.000Z");
const BEFORE_RESET = new Date("2026-09-30T23:59:59.000Z");

const OPS_DATE = "2099-09-19";
const OPS_START = "2099-09-19T12:00:00.000Z";
const OPS_AS_OF = "2099-09-19T10:30:00.000Z";
const OPS_RECEIPT_AT = "2099-09-19T10:00:00.000Z";

const SCH_DATE = "2026-09-19";
const SCH_NOW = new Date("2026-09-19T12:00:00.000Z");

function startMinutesFrom(now: Date, minutesUntil: number): string {
  return new Date(now.getTime() + minutesUntil * 60_000).toISOString();
}

function tmpCwd(): string {
  return mkdtempSync(path.join(tmpdir(), "odds-quota-"));
}

function headers(map: Record<string, string | null>): {
  get(name: string): string | null;
} {
  const lower: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return {
    get(name: string) {
      return lower[name.toLowerCase()] ?? null;
    },
  };
}

function writeJson(cwd: string, rel: string, body: unknown) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

function writeSchedule(cwd: string) {
  writeJson(cwd, `data/research/mlb/${OPS_DATE}-schedule-v1.json`, {
    dateKst: OPS_DATE,
    games: [
      {
        internalGameId: "mlb-1",
        gamePk: 1,
        homeTeam: "Home",
        awayTeam: "Away",
        commenceTimeUtc: OPS_START,
        statusAbstract: "Preview",
      },
    ],
  });
}

function writeStarterLineup(cwd: string) {
  writeJson(cwd, `data/research/mlb/${OPS_DATE}-starter-dataset-v1.json`, {
    meta: { generatedAt: OPS_AS_OF, dateKst: OPS_DATE },
    rows: [
      { gameId: "mlb-1", side: "home" },
      { gameId: "mlb-1", side: "away" },
    ],
    summary: {},
  });
  writeJson(cwd, `data/research/mlb/${OPS_DATE}-lineup-dataset-v1.json`, {
    meta: { generatedAt: OPS_AS_OF, dateKst: OPS_DATE },
    rows: [
      {
        gameId: "mlb-1",
        side: "home",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        generatedAt: OPS_AS_OF,
        sourceTimestamp: OPS_AS_OF,
      },
      {
        gameId: "mlb-1",
        side: "away",
        collectionStatus: "CONFIRMED",
        lineupStatus: "COMPLETE",
        generatedAt: OPS_AS_OF,
        sourceTimestamp: OPS_AS_OF,
      },
    ],
  });
}

async function writeAvailableReceipt(
  cwd: string,
  remaining: number,
  observedAt: string,
) {
  const receipt = buildOddsQuotaBootstrapReceipt({
    planName: ODDS_OPERATOR_PLAN_EVIDENCE.planName,
    requestsRemaining: remaining,
    requestsUsed: 1,
    requestsLast: 3,
    evidenceDate: ODDS_OPERATOR_PLAN_EVIDENCE.evidenceDate,
    observedAt,
  });
  await writeOddsQuotaReceipt(receipt, cwd);
  return receipt;
}

async function main() {
  const receiptSrc = readFileSync(
    path.join(REPO, "src/lib/odds/quota-receipt-v1.ts"),
    "utf8",
  );
  assert.equal(receiptSrc.includes("465"), false);

  assert.equal(MLB_STATS_AUTOMATION_ALLOWED, false);

  // 1. valid headers parsed
  const parsedOk = parseOddsQuotaReceiptHeaders(
    headers({
      "x-requests-remaining": "465",
      "x-requests-used": "35",
      "x-requests-last": "3",
    }),
  );
  assert.equal(parsedOk.ok, true);
  if (parsedOk.ok) {
    assert.equal(parsedOk.remaining, 465);
    assert.equal(parsedOk.used, 35);
    assert.equal(parsedOk.last, 3);
  }

  // 2–3. receipt persisted, API key absent
  const cwdPersist = tmpCwd();
  const prevKey = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = "secret-should-never-appear";
  const written = await writeOddsQuotaReceiptFromHeaders({
    headers: headers({
      "x-requests-remaining": "465",
      "x-requests-used": "35",
      "x-requests-last": "3",
    }),
    cwd: cwdPersist,
    now: RECEIPT_NOW,
  });
  assert.equal(written.updated, true);
  const abs = path.join(cwdPersist, ODDS_QUOTA_RECEIPT_REL);
  assert.equal(existsSync(abs), true);
  const text = readFileSync(abs, "utf8");
  assert.equal(text.includes("secret-should-never-appear"), false);
  assert.equal(/ODDS_API_KEY/i.test(text), false);
  assert.equal(receiptContainsForbiddenSecrets(JSON.parse(text)), false);
  const persisted = JSON.parse(text) as {
    requestsRemaining: number;
    source: string;
    provider: string;
  };
  assert.equal(persisted.requestsRemaining, 465);
  assert.equal(persisted.source, "RESPONSE_HEADERS");
  assert.equal(persisted.provider, "THE_ODDS_API");
  if (prevKey === undefined) delete process.env.ODDS_API_KEY;
  else process.env.ODDS_API_KEY = prevKey;

  // 4. malformed remaining rejected
  const badRemaining = parseOddsQuotaReceiptHeaders(
    headers({
      "x-requests-remaining": "1.5",
      "x-requests-used": "1",
      "x-requests-last": "1",
    }),
  );
  assert.equal(badRemaining.ok, false);
  if (!badRemaining.ok) assert.equal(badRemaining.field, "remaining");

  // 5. malformed used rejected
  const badUsed = parseOddsQuotaReceiptHeaders(
    headers({
      "x-requests-remaining": "10",
      "x-requests-used": "-1",
      "x-requests-last": "1",
    }),
  );
  assert.equal(badUsed.ok, false);
  if (!badUsed.ok) assert.equal(badUsed.field, "used");

  // 6. malformed last rejected
  const badLast = parseOddsQuotaReceiptHeaders(
    headers({
      "x-requests-remaining": "10",
      "x-requests-used": "1",
      "x-requests-last": "abc",
    }),
  );
  assert.equal(badLast.ok, false);
  if (!badLast.ok) assert.equal(badLast.field, "last");

  // 7. missing headers → no invented values
  const cwdMissing = tmpCwd();
  const missingWrite = await writeOddsQuotaReceiptFromHeaders({
    headers: headers({
      "x-requests-remaining": "10",
      "x-requests-used": "1",
    }),
    cwd: cwdMissing,
    now: RECEIPT_NOW,
  });
  assert.equal(missingWrite.updated, false);
  assert.equal(missingWrite.reason, ODDS_QUOTA_RECEIPT_NOT_UPDATED);
  assert.equal(existsSync(path.join(cwdMissing, ODDS_QUOTA_RECEIPT_REL)), false);

  // 8. atomic write path
  const cwdAtomic = tmpCwd();
  const atomicPath = path.join(
    cwdAtomic,
    "data/ops/provider/the-odds-api/quota-receipt-v1.json",
  );
  await writeJsonAtomic(atomicPath, { ok: true });
  assert.equal(existsSync(atomicPath), true);
  const leftovers = readdirSync(path.dirname(atomicPath)).filter((n) =>
    n.endsWith(".tmp"),
  );
  assert.deepEqual(leftovers, []);

  // 9. reader valid current-cycle receipt
  const cwdValid = tmpCwd();
  await writeAvailableReceipt(cwdValid, 465, RECEIPT_NOW.toISOString());
  const valid = await readOddsQuotaReceipt({ cwd: cwdValid, now: RECEIPT_NOW });
  assert.equal(valid.status, "QUOTA_AVAILABLE");
  assert.equal(valid.remaining, 465);
  assert.equal(valid.allowsSpawn, true);

  // 10. zero → QUOTA_ZERO
  const cwdZero = tmpCwd();
  await writeAvailableReceipt(cwdZero, 0, RECEIPT_NOW.toISOString());
  const zero = await readOddsQuotaReceipt({ cwd: cwdZero, now: RECEIPT_NOW });
  assert.equal(zero.status, "QUOTA_ZERO");
  assert.equal(zero.remaining, 0);
  assert.equal(zero.allowsSpawn, false);

  // 11. missing → QUOTA_RECEIPT_MISSING
  const missing = await readOddsQuotaReceipt({ cwd: tmpCwd(), now: RECEIPT_NOW });
  assert.equal(missing.status, "QUOTA_RECEIPT_MISSING");
  assert.equal(missing.allowsSpawn, false);

  // 12–13. stale previous-cycle / UTC reset boundary
  const cwdStale = tmpCwd();
  await writeAvailableReceipt(cwdStale, 465, "2026-09-19T12:00:00.000Z");
  const stale = await readOddsQuotaReceipt({ cwd: cwdStale, now: RESET_OCT });
  assert.equal(stale.status, "QUOTA_STALE");
  assert.equal(stale.allowsSpawn, false);
  assert.equal(stale.remaining, null);
  const stillCurrent = await readOddsQuotaReceipt({
    cwd: cwdStale,
    now: BEFORE_RESET,
  });
  assert.equal(stillCurrent.status, "QUOTA_AVAILABLE");
  const boundary = currentOddsQuotaResetAtUtc(RESET_OCT);
  assert.equal(boundary.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(boundary.getUTCHours(), 0);
  assert.equal(boundary.getUTCDate(), 1);

  // 16. unknown receipt does not mean unlimited
  const none = await resolveOddsQuotaInput({
    cliQuotaRemaining: null,
    unattended: true,
    cwd: tmpCwd(),
    now: RECEIPT_NOW,
  });
  assert.equal(none.source, "NONE");
  assert.equal(none.remaining, null);
  assert.equal(none.allowsSpawn, false);

  const fromReceipt = await resolveOddsQuotaInput({
    cliQuotaRemaining: null,
    unattended: true,
    cwd: cwdValid,
    now: RECEIPT_NOW,
  });
  assert.equal(fromReceipt.source, "RECEIPT");
  assert.equal(fromReceipt.remaining, 465);

  const cliOverride = await resolveOddsQuotaInput({
    cliQuotaRemaining: 10,
    unattended: true,
    cwd: cwdValid,
    now: RECEIPT_NOW,
  });
  assert.equal(cliOverride.source, "CLI");
  assert.equal(cliOverride.remaining, 10);

  // 14. Scheduler unattended reads valid receipt
  {
    const cwd = tmpCwd();
    await writeAvailableReceipt(cwd, 465, SCH_NOW.toISOString());
    const calls: RunnerAction[] = [];
    const result = await runPregameScheduler({
      dateKst: SCH_DATE,
      league: "MLB",
      dryRun: false,
      noProvider: false,
      includePostgame: false,
      json: false,
      persist: false,
      unattended: true,
      cwd,
      now: SCH_NOW,
      fixtureGames: [
        {
          gameId: "mlb-game-1",
          scheduledStartTime: startMinutesFrom(SCH_NOW, 100),
        },
      ],
      executeRunner: async (action) => {
        calls.push(action);
        return 0;
      },
    });
    assert.equal(result.quotaSource, "RECEIPT");
    assert.equal(result.audit.quotaSource, "RECEIPT");
    const daily = calls.find((c) => c.actionId === "RUN_MLB_DAILY_OPS");
    assert.ok(daily);
    const i = daily!.args?.indexOf("--quota-remaining") ?? -1;
    assert.ok(i >= 0);
    assert.equal(daily!.args?.[i + 1], "465");
    assert.ok(daily!.args?.includes("--unattended"));
  }

  // 15. CLI --quota-remaining override still works
  {
    const cwd = tmpCwd();
    await writeAvailableReceipt(cwd, 465, SCH_NOW.toISOString());
    const calls: RunnerAction[] = [];
    const result = await runPregameScheduler({
      dateKst: SCH_DATE,
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
      fixtureGames: [
        {
          gameId: "mlb-game-1",
          scheduledStartTime: startMinutesFrom(SCH_NOW, 100),
        },
      ],
      executeRunner: async (action) => {
        calls.push(action);
        return 0;
      },
    });
    assert.equal(result.quotaSource, "CLI");
    const daily = calls.find((c) => c.actionId === "RUN_MLB_DAILY_OPS");
    const i = daily!.args?.indexOf("--quota-remaining") ?? -1;
    assert.equal(daily!.args?.[i + 1], "10");
  }

  // 17. Plan unknown still blocks even with quota
  {
    const cwd = tmpCwd();
    writeSchedule(cwd);
    writeStarterLineup(cwd);
    await writeAvailableReceipt(cwd, 465, OPS_RECEIPT_AT);
    const stats: string[] = [];
    const odds: string[] = [];
    const report = await runMlbDailyOpsV1({
      dateKst: OPS_DATE,
      cwd,
      window: "T90",
      asOf: OPS_AS_OF,
      dryRun: false,
      noProvider: false,
      writePrediction: false,
      sealDeliveryRecord: false,
      unattended: true,
      oddsPlanConfirmed: false,
      oddsApiKeyPresent: true,
      spawnCollector: async (scriptRel) => {
        if (scriptRel.includes("odds")) odds.push(scriptRel);
        else stats.push(scriptRel);
        throw new Error(`UNEXPECTED_SPAWN:${scriptRel}`);
      },
    });
    assert.equal(odds.length, 0);
    assert.equal(stats.length, 0);
    assert.equal(report.quotaSource, "RECEIPT");
    assert.equal(report.failure?.reason, "PLAN_UNKNOWN");
  }

  // 18. API key missing still blocks even with quota
  {
    const cwd = tmpCwd();
    writeSchedule(cwd);
    writeStarterLineup(cwd);
    await writeAvailableReceipt(cwd, 465, OPS_RECEIPT_AT);
    const odds: string[] = [];
    const report = await runMlbDailyOpsV1({
      dateKst: OPS_DATE,
      cwd,
      window: "T90",
      asOf: OPS_AS_OF,
      dryRun: false,
      noProvider: false,
      writePrediction: false,
      sealDeliveryRecord: false,
      unattended: true,
      oddsPlanConfirmed: true,
      oddsApiKeyPresent: false,
      spawnCollector: async (scriptRel) => {
        if (scriptRel.includes("odds")) odds.push(scriptRel);
        throw new Error(`UNEXPECTED_SPAWN:${scriptRel}`);
      },
    });
    assert.equal(odds.length, 0);
    assert.equal(report.failure?.reason, "LEGAL_CONDITIONAL_UNMET");
  }

  // 19. MLB Stats HOLD unaffected
  {
    const cwd = tmpCwd();
    await writeAvailableReceipt(cwd, 465, OPS_RECEIPT_AT);
    const stats: string[] = [];
    const report = await runMlbDailyOpsV1({
      dateKst: OPS_DATE,
      cwd,
      window: "T90",
      asOf: OPS_AS_OF,
      dryRun: false,
      noProvider: false,
      writePrediction: false,
      sealDeliveryRecord: false,
      unattended: true,
      oddsPlanConfirmed: true,
      oddsApiKeyPresent: true,
      spawnCollector: async (scriptRel) => {
        stats.push(scriptRel);
        throw new Error(`UNEXPECTED_SPAWN:${scriptRel}`);
      },
    });
    assert.equal(stats.length, 0);
    assert.equal(report.failure?.reason, "LEGAL_PROVIDER_AUTOMATION_BLOCKED");
    assert.equal(MLB_STATS_AUTOMATION_ALLOWED, false);
  }

  // 16b Daily Ops unknown ≠ unlimited
  {
    const cwd = tmpCwd();
    writeSchedule(cwd);
    writeStarterLineup(cwd);
    const odds: string[] = [];
    const report = await runMlbDailyOpsV1({
      dateKst: OPS_DATE,
      cwd,
      window: "T90",
      asOf: OPS_AS_OF,
      dryRun: false,
      noProvider: false,
      writePrediction: false,
      sealDeliveryRecord: false,
      unattended: true,
      oddsPlanConfirmed: true,
      oddsApiKeyPresent: true,
      spawnCollector: async (scriptRel) => {
        if (scriptRel.includes("odds")) odds.push(scriptRel);
        throw new Error(`UNEXPECTED_SPAWN:${scriptRel}`);
      },
    });
    assert.equal(odds.length, 0);
    assert.equal(report.quotaSource, "NONE");
    assert.equal(report.pregame?.quotaSource, "NONE");
    assert.equal(report.failure?.reason, "QUOTA_DECISION_EXTERNAL");
  }

  console.log("test:the-odds-api-quota-receipt-v1 PASS");
  console.log("PROVIDER_CALLS=0");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
