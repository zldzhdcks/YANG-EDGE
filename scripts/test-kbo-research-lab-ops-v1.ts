/**
 * KBO Research Lab ops-state reader tests.
 * Temp fixtures only — no operational artifact mutation.
 */
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
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

async function main() {
  const { loadKboResearchLabOpsState } = await import(
    "../src/lib/internal/load-kbo-research-lab-ops-state"
  );

  const root = mkdtempSync(path.join(tmpdir(), "kbo-research-lab-ops-"));
  const dateKst = "2026-08-01";

  // Track real ops artifacts for mutation proof
  const realSchedule = path.resolve("data/research/kbo/2026-08-01-schedule-v1.json");
  const realPersonnel = path.resolve(
    "data/operator-input/kbo/2026-08-01-personnel-input-v1.json",
  );
  const realHashes = new Map<string, string>();
  for (const p of [realSchedule, realPersonnel]) {
    if (existsSync(p)) realHashes.set(p, hashFile(p));
  }

  const schedulePath = path.join(
    root,
    "data/research/kbo",
    `${dateKst}-schedule-v1.json`,
  );
  const personnelPath = path.join(
    root,
    "data/operator-input/kbo",
    `${dateKst}-personnel-input-v1.json`,
  );

  const schedule = {
    schemaVersion: "kbo-schedule-v1",
    league: "KBO",
    date: dateKst,
    games: [
      {
        gameId: "kbo-181922",
        home: "두산",
        away: "LG",
        statusAbstract: "SCHEDULED",
        statusDetailed: "NS",
        clockState: "PREGAME_OPEN",
      },
      {
        gameId: "kbo-181923",
        home: "키움",
        away: "SSG",
        statusAbstract: "SCHEDULED",
        statusDetailed: "NS",
        clockState: "PREGAME_OPEN",
      },
      {
        gameId: "kbo-181924",
        home: "KT",
        away: "한화",
        statusAbstract: "SCHEDULED",
        statusDetailed: "NS",
        clockState: "PREGAME_OPEN",
      },
      {
        gameId: "kbo-181925",
        home: "롯데",
        away: "삼성",
        statusAbstract: "Cancelled",
        statusDetailed: "Cancelled - Extreme Heat",
        clockState: "CANCELLED",
        cancellationStatus: "CANCELLED",
      },
      {
        gameId: "kbo-181926",
        home: "NC",
        away: "KIA",
        statusAbstract: "Cancelled",
        statusDetailed: "Cancelled - Extreme Heat",
        clockState: "CANCELLED",
        cancellationStatus: "CANCELLED",
      },
    ],
  };

  const personnelNull = {
    schemaVersion: "kbo-t45-personnel-input-v1",
    league: "KBO",
    dateKst,
    commercialUseStatus: "INTERNAL_ONLY",
    games: [
      {
        gameId: "kbo-181922",
        homeTeam: "두산",
        awayTeam: "LG",
        home: { starter: null, lineup: null },
        away: { starter: null, lineup: null },
        domesticProto: {
          homePrice: 1.75,
          awayPrice: 1.77,
          format: "DECIMAL",
          marketType: "MONEYLINE_2WAY",
        },
      },
      {
        gameId: "kbo-181923",
        homeTeam: "키움",
        awayTeam: "SSG",
        home: { starter: null, lineup: null },
        away: { starter: null, lineup: null },
        domesticProto: {
          homePrice: 1.86,
          awayPrice: 1.67,
          format: "DECIMAL",
          marketType: "MONEYLINE_2WAY",
        },
      },
      {
        gameId: "kbo-181924",
        homeTeam: "KT",
        awayTeam: "한화",
        home: { starter: null, lineup: null },
        away: { starter: null, lineup: null },
        domesticProto: {
          homePrice: 1.73,
          awayPrice: 1.79,
          format: "DECIMAL",
          marketType: "MONEYLINE_2WAY",
        },
      },
      {
        gameId: "kbo-181925",
        homeTeam: "롯데",
        awayTeam: "삼성",
        home: { starter: null, lineup: null },
        away: { starter: null, lineup: null },
        domesticProto: null,
        cancellationStatus: "CANCELLED",
      },
      {
        gameId: "kbo-181926",
        homeTeam: "NC",
        awayTeam: "KIA",
        home: { starter: null, lineup: null },
        away: { starter: null, lineup: null },
        domesticProto: null,
        cancellationStatus: "CANCELLED",
      },
    ],
  };

  writeJson(schedulePath, schedule);
  writeJson(personnelPath, personnelNull);

  // --- Fixture A: null starters ---
  const a = await loadKboResearchLabOpsState(dateKst, root);
  assert.equal(a.schedule.status, "READY");
  assert.equal(a.schedule.totalGames, 5);
  assert.equal(a.schedule.activeGames, 3);
  assert.equal(a.schedule.cancelledGames, 2);
  assert.equal(a.domesticProto.status, "READY_ADMIN_VERIFIED");
  assert.equal(a.domesticProto.entered, 3);
  assert.equal(a.domesticProto.required, 3);
  assert.equal(a.domesticProto.source, "OPERATOR_INPUT");
  assert.equal(a.starter.status, "NOT_ENTERED");
  assert.equal(a.starter.entered, 0);
  assert.equal(a.starter.required, 3);
  assert.equal(a.lineup.status, "NOT_ENTERED");
  assert.equal(a.lineup.entered, 0);
  assert.equal(a.prediction.status, "NOT_CREATED");
  assert.equal(a.review.status, "NOT_READY");
  assert.equal(a.hardErrors.length, 0);
  assert.ok(a.tasks.filter((t) => t.category === "TODO").length > 0);
  assert.ok(!a.lockReasons.includes("Reader Error"));
  assert.ok(
    a.overallStatus === "PARTIAL_READY" || a.overallStatus === "WAITING_FOR_LINEUP",
  );
  assert.ok(a.assistantBrief.includes("선발"));

  // --- Fixture B: starters entered ---
  const personnelStarters = JSON.parse(JSON.stringify(personnelNull)) as {
    games: Array<{
      home: { starter: unknown; lineup: unknown };
      away: { starter: unknown; lineup: unknown };
      [k: string]: unknown;
    }>;
    [k: string]: unknown;
  };
  const names = [
    ["곽빈", "카라스코"],
    ["김윤하", "타케다"],
    ["배제성", "짐맨"],
  ];
  for (let i = 0; i < 3; i++) {
    personnelStarters.games[i].home.starter = {
      playerName: names[i][0],
      playerId: null,
    };
    personnelStarters.games[i].away.starter = {
      playerName: names[i][1],
      playerId: null,
    };
  }
  writeJson(personnelPath, personnelStarters);
  const b = await loadKboResearchLabOpsState(dateKst, root);
  assert.equal(b.starter.entered, 3);
  assert.equal(b.starter.required, 3);
  assert.ok(
    b.starter.status === "READY" || b.starter.status === "READY_ADMIN_VERIFIED",
  );
  assert.equal(b.lineup.status, "NOT_ENTERED");
  assert.equal(b.overallStatus, "WAITING_FOR_LINEUP");

  // --- Missing schedule → blocker ---
  const root2 = mkdtempSync(path.join(tmpdir(), "kbo-research-lab-missing-"));
  const miss = await loadKboResearchLabOpsState(dateKst, root2);
  assert.equal(miss.schedule.status, "BLOCKED");
  assert.equal(miss.overallStatus, "BLOCKED");
  assert.ok(miss.tasks.some((t) => t.taskId === "kbo-schedule-missing"));

  // --- Malformed JSON → hard error ---
  const root3 = mkdtempSync(path.join(tmpdir(), "kbo-research-lab-bad-"));
  const badSchedule = path.join(
    root3,
    "data/research/kbo",
    `${dateKst}-schedule-v1.json`,
  );
  mkdirSync(path.dirname(badSchedule), { recursive: true });
  writeFileSync(badSchedule, "{not-json", "utf8");
  const bad = await loadKboResearchLabOpsState(dateKst, root3);
  assert.ok(bad.hardErrors.some((e) => e.code === "MALFORMED_JSON"));

  // --- Historical smoke: real 07-31 if present ---
  const histDate = "2026-07-31";
  const histSchedule = path.resolve(
    `data/research/kbo/${histDate}-schedule-v1.json`,
  );
  if (existsSync(histSchedule)) {
    const hist = await loadKboResearchLabOpsState(histDate, process.cwd());
    assert.equal(hist.schedule.status, "READY");
    assert.ok(hist.schedule.totalGames > 0);
    assert.ok(hist.hardErrors.length === 0 || hist.schedule.status === "READY");
  }

  // --- Real workspace ops load (read-only) ---
  if (existsSync(realSchedule) && existsSync(realPersonnel)) {
    const live = await loadKboResearchLabOpsState("2026-08-01", process.cwd());
    assert.equal(live.schedule.status, "READY");
    assert.equal(live.schedule.totalGames, 5);
    assert.equal(live.schedule.activeGames, 3);
    assert.equal(live.schedule.cancelledGames, 2);
    assert.equal(live.domesticProto.status, "READY_ADMIN_VERIFIED");
    assert.equal(live.domesticProto.entered, 3);
    assert.ok(
      live.starter.status === "READY" ||
        live.starter.status === "READY_ADMIN_VERIFIED",
    );
    assert.equal(live.starter.entered, 3);
    assert.ok(
      live.lineup.status === "PARTIAL" ||
        live.lineup.status === "WAITING_FOR_LINEUP" ||
        live.lineup.status === "READY" ||
        live.lineup.status === "READY_ADMIN_VERIFIED",
    );
    assert.equal(live.lineup.entered, 2);
    assert.equal(live.prediction.status, "NOT_CREATED");
    assert.equal(live.hardErrors.length, 0);
    assert.ok(live.tasks.filter((t) => t.category === "TODO").length > 0);
  }

  // Mutation proof
  for (const [p, h] of realHashes) {
    assert.equal(hashFile(p), h, `mutated: ${p}`);
  }

  console.log("test:kbo-research-lab-ops OK", {
    fixtureA: {
      schedule: a.schedule.status,
      proto: a.domesticProto.status,
      starter: a.starter.status,
      tasks: a.tasks.filter((t) => t.category === "TODO").length,
    },
    fixtureB: { starter: b.starter.status, overall: b.overallStatus },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
