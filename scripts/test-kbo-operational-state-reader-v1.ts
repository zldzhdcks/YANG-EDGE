/**
 * KBO Unified Operational State Reader — fixture + live regression.
 * Temp fixtures only — no operational artifact mutation.
 * Run: npm run test:kbo-operational-state-reader
 */
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

function writeJson(filePath: string, data: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function hashFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function baseSchedule(dateKst: string) {
  return {
    schemaVersion: "kbo-schedule-v1",
    league: "KBO",
    date: dateKst,
    games: [
      {
        gameId: "kbo-181922",
        home: "두산",
        away: "LG",
        scheduledStartTime: `${dateKst}T18:00:00+09:00`,
        statusAbstract: "SCHEDULED",
        statusDetailed: "NS",
        clockState: "PREGAME_OPEN",
      },
      {
        gameId: "kbo-181923",
        home: "키움",
        away: "SSG",
        scheduledStartTime: `${dateKst}T17:00:00+09:00`,
        statusAbstract: "SCHEDULED",
        statusDetailed: "NS",
        clockState: "PREGAME_OPEN",
      },
      {
        gameId: "kbo-181924",
        home: "KT",
        away: "한화",
        scheduledStartTime: `${dateKst}T18:00:00+09:00`,
        statusAbstract: "SCHEDULED",
        statusDetailed: "NS",
        clockState: "PREGAME_OPEN",
      },
      {
        gameId: "kbo-181925",
        home: "삼성",
        away: "롯데",
        statusAbstract: "CANCELLED",
        statusDetailed: "CANC",
        clockState: "CANCELLED",
        cancellationStatus: "CANCELLED",
      },
    ],
  };
}

function personnelFullReady(dateKst: string) {
  const proto = { homePrice: 1.85, awayPrice: 2.05 };
  const lineup9 = (team: string) =>
    Array.from({ length: 9 }, (_, i) => ({
      slot: i + 1,
      playerName: `${team}-B${i + 1}`,
      position: "CF",
    }));
  return {
    schemaVersion: "kbo-personnel-input-v1",
    dateKst,
    games: [
      {
        gameId: "kbo-181922",
        homeTeam: "두산",
        awayTeam: "LG",
        domesticProto: proto,
        home: {
          starter: { playerName: "곽빈", playerId: null },
          lineup: lineup9("두산"),
        },
        away: {
          starter: { playerName: "카라스코", playerId: null },
          lineup: lineup9("LG"),
        },
      },
      {
        gameId: "kbo-181923",
        homeTeam: "키움",
        awayTeam: "SSG",
        domesticProto: proto,
        home: {
          starter: { playerName: "김윤하", playerId: null },
          lineup: null,
        },
        away: {
          starter: { playerName: "타케다", playerId: null },
          lineup: null,
        },
      },
      {
        gameId: "kbo-181924",
        homeTeam: "KT",
        awayTeam: "한화",
        domesticProto: proto,
        home: {
          starter: { playerName: "배제성", playerId: null },
          lineup: lineup9("KT"),
        },
        away: {
          starter: { playerName: "짐머맨", playerId: null },
          lineup: lineup9("한화"),
        },
      },
    ],
  };
}

async function main() {
  const {
    loadKboOperationalDayState,
    loadKboOperationalGameState,
    isReadyStatus,
  } = await import("../src/lib/kbo/operational-state");

  const realSchedule = path.resolve(
    "data/research/kbo/2026-08-01-schedule-v1.json",
  );
  const realPersonnel = path.resolve(
    "data/operator-input/kbo/2026-08-01-personnel-input-v1.json",
  );
  const realHashes = new Map<string, string>();
  for (const p of [realSchedule, realPersonnel]) {
    if (existsSync(p)) realHashes.set(p, hashFile(p));
  }

  const dateKst = "2026-08-01";
  const root = mkdtempSync(path.join(tmpdir(), "kbo-ops-reader-"));
  writeJson(
    path.join(root, "data/research/kbo", `${dateKst}-schedule-v1.json`),
    baseSchedule(dateKst),
  );
  writeJson(
    path.join(
      root,
      "data/operator-input/kbo",
      `${dateKst}-personnel-input-v1.json`,
    ),
    personnelFullReady(dateKst),
  );

  // --- 08-01 LG @ 두산 fixture ---
  const g922 = await loadKboOperationalGameState("kbo-181922", {
    dateKst,
    cwd: root,
  });
  assert.equal(g922.schedule.status, "READY");
  assert.ok(isReadyStatus(g922.domesticOdds.status));
  assert.ok(isReadyStatus(g922.starter.status));
  assert.ok(isReadyStatus(g922.lineup.status));
  assert.equal(g922.prediction.status, "NOT_CREATED");
  assert.equal(g922.review.status, "NOT_READY");
  assert.ok(g922.readinessPercent > 0);
  assert.notEqual(g922.overallStatus, "UNKNOWN");
  assert.ok(
    g922.overallStatus === "WAITING_FOR_PREDICTION" ||
      g922.overallStatus === "PARTIAL_READY",
  );
  assert.equal(g922.hardErrors.length, 0);
  assert.equal(g922.homeTeam, "두산");
  assert.equal(g922.awayTeam, "LG");
  assert.equal(g922.domesticOdds.sourceType, "PERSONNEL_INPUT");

  // --- SSG @ 키움 partial ---
  const g923 = await loadKboOperationalGameState("kbo-181923", {
    dateKst,
    cwd: root,
  });
  assert.ok(isReadyStatus(g923.starter.status));
  assert.equal(g923.lineup.status, "NOT_ENTERED");
  assert.ok(isReadyStatus(g923.domesticOdds.status));
  assert.equal(g923.overallStatus, "WAITING_FOR_LINEUP");
  assert.ok(!g923.blockingReasons.some((r) => /FAIL/i.test(r)));
  assert.equal(g923.prediction.status, "NOT_CREATED");

  // --- Cancelled ---
  const g925 = await loadKboOperationalGameState("kbo-181925", {
    dateKst,
    cwd: root,
  });
  assert.equal(g925.overallStatus, "NOT_APPLICABLE");
  assert.equal(g925.starter.status, "NOT_APPLICABLE");
  assert.equal(g925.lineup.status, "NOT_APPLICABLE");
  assert.equal(g925.starter.applicable, false);
  assert.ok(!g925.waitingReasons.includes("Starter Not Entered"));

  // --- Missing schedule ---
  const missRoot = mkdtempSync(path.join(tmpdir(), "kbo-ops-miss-"));
  const miss = await loadKboOperationalDayState(dateKst, missRoot);
  assert.equal(miss.schedule.status, "BLOCKED");
  assert.equal(miss.overallStatus, "BLOCKED");

  const missGame = await loadKboOperationalGameState("kbo-181922", {
    cwd: missRoot,
  });
  assert.equal(missGame.overallStatus, "BLOCKED");
  assert.ok(missGame.blockingReasons.length > 0);

  // --- Malformed JSON ---
  const badRoot = mkdtempSync(path.join(tmpdir(), "kbo-ops-bad-"));
  const badPath = path.join(
    badRoot,
    "data/research/kbo",
    `${dateKst}-schedule-v1.json`,
  );
  mkdirSync(path.dirname(badPath), { recursive: true });
  writeFileSync(badPath, "{not-json", "utf8");
  const bad = await loadKboOperationalDayState(dateKst, badRoot);
  assert.ok(bad.hardErrors.some((e) => e.code === "MALFORMED_JSON"));
  assert.equal(bad.schedule.status, "ERROR");

  // --- Prediction present ---
  writeJson(
    path.join(root, "data/predictions/kbo", `${dateKst}.json`),
    {
      predictions: [
        {
          gameId: "kbo-181922",
          officialStatus: "PASS",
          passReasons: ["KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED"],
        },
      ],
    },
  );
  const withPred = await loadKboOperationalGameState("kbo-181922", {
    dateKst,
    cwd: root,
  });
  assert.equal(withPred.prediction.status, "READY");
  assert.equal(withPred.prediction.sourceType, "PREDICTION");

  // --- Legacy schedule identity fallback ---
  const legacyRoot = mkdtempSync(path.join(tmpdir(), "kbo-ops-legacy-"));
  writeJson(
    path.join(
      legacyRoot,
      "data/research/kbo",
      `${dateKst}-schedule-result-identity-v1-api-baseball.json`,
    ),
    {
      rows: [
        {
          gameId: "kbo-181922",
          homeTeam: "두산",
          awayTeam: "LG",
          scheduledStartTimeKst: `${dateKst}T18:00:00+09:00`,
          statusAbstract: "SCHEDULED",
        },
      ],
    },
  );
  const legacy = await loadKboOperationalDayState(dateKst, legacyRoot);
  assert.equal(legacy.schedule.status, "READY");
  assert.equal(legacy.schedule.sourcePath?.includes("identity"), true);
  assert.equal(legacy.games[0]?.schedule.sourceType, "SCHEDULE_IDENTITY_LEGACY");

  // --- Live 08-01 (read-only) ---
  if (existsSync(realSchedule) && existsSync(realPersonnel)) {
    const live922 = await loadKboOperationalGameState("kbo-181922");
    assert.equal(live922.schedule.status, "READY");
    assert.equal(live922.domesticOdds.status, "READY_ADMIN_VERIFIED");
    assert.equal(live922.starter.status, "READY_ADMIN_VERIFIED");
    assert.equal(live922.lineup.status, "READY_ADMIN_VERIFIED");
    assert.equal(live922.prediction.status, "NOT_CREATED");
    assert.equal(live922.review.status, "NOT_READY");
    assert.ok(live922.readinessPercent > 0);
    assert.equal(live922.overallStatus, "WAITING_FOR_PREDICTION");
    assert.equal(live922.awayTeam, "LG");
    assert.equal(live922.homeTeam, "두산");

    const live923 = await loadKboOperationalGameState("kbo-181923");
    assert.equal(live923.lineup.status, "NOT_ENTERED");
    assert.equal(live923.overallStatus, "WAITING_FOR_LINEUP");
  }

  for (const [p, h] of realHashes) {
    assert.equal(hashFile(p), h, `mutated: ${p}`);
  }

  console.log("test:kbo-operational-state-reader OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
