/**
 * Unit/integration tests for KBO T45 Personnel Workflow (temp cwd; no historical mutation).
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { kboAction } from "../src/lib/scheduler/league-adapters/kbo";
import { runKboT45PersonnelWorkflow } from "../src/lib/kbo/t45-personnel/run-t45-personnel-workflow";
import type { KboT45PersonnelInputV1 } from "../src/lib/kbo/t45-personnel/types";
import {
  validateLineup,
  validateProto,
  validateStarter,
} from "../src/lib/kbo/t45-personnel/validate-personnel-input";

function batter(slot: number, name = `P${slot}`) {
  return {
    slot,
    playerName: name,
    position: slot === 3 ? "지명타자" : "내야수",
    bats: "R" as const,
  };
}

function fullLineup(prefix: string) {
  return Array.from({ length: 9 }, (_, i) => batter(i + 1, `${prefix}${i + 1}`));
}

function baseGame(overrides: Partial<KboT45PersonnelInputV1["games"][0]> = {}) {
  return {
    gameId: "kbo-1",
    homeTeam: "두산",
    awayTeam: "LG",
    scheduledStartTime: "2026-08-01T18:30:00+09:00",
    observedAt: "2026-08-01T09:00:00.000Z",
    home: {
      starter: { playerName: "홈선발", throwingHand: "R" as const },
      lineup: fullLineup("H"),
    },
    away: {
      starter: { playerName: "원정선발", throwingHand: "L" as const },
      lineup: fullLineup("A"),
    },
    domesticProto: { homePrice: 1.85, awayPrice: 1.95, format: "DECIMAL" as const },
    ...overrides,
  };
}

function makeInput(games: KboT45PersonnelInputV1["games"]): KboT45PersonnelInputV1 {
  return {
    schemaVersion: "kbo-t45-personnel-input-v1",
    league: "KBO",
    dateKst: "2026-08-01",
    createdAt: "2026-08-01T09:00:00.000Z",
    createdBy: "test",
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    commercialUseStatus: "INTERNAL_ONLY",
    games,
  };
}

function setupCwd(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), "kbo-t45-"));
  mkdirSync(path.join(cwd, "data", "operator-input", "kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data", "research", "kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data", "audits"), { recursive: true });
  mkdirSync(path.join(cwd, "data", "predictions", "kbo"), { recursive: true });
  return cwd;
}

async function main() {
  // --- unit validators ---
  {
    const s = validateStarter(
      { playerName: "송승기", throwingHand: "L" },
      "LG",
      "away",
    );
    assert.equal(s.ok, true);
    assert.ok(s.warnings.includes("PLAYER_ID_UNRESOLVED"));
  }
  {
    const partial = validateLineup(fullLineup("X").slice(0, 8), "LG", "home");
    assert.equal(partial.ok, false);
    assert.equal(partial.partial, true);
  }
  {
    const dupSlot = validateLineup(
      [...fullLineup("X").slice(0, 8), { ...batter(1, "dup") }],
      "LG",
      "home",
    );
    assert.ok(dupSlot.errors.some((e) => e.startsWith("DUPLICATE_BATTING_ORDER")));
  }
  {
    const dupPlayer = validateLineup(
      fullLineup("X").map((b, i) =>
        i === 8 ? { ...b, playerName: "X1", slot: 9 } : b,
      ),
      "LG",
      "home",
    );
    assert.ok(dupPlayer.errors.some((e) => e.startsWith("DUPLICATE_PLAYER")));
  }
  {
    const bad = validateProto({ homePrice: 1, awayPrice: 1.5 }, "두산", "LG");
    assert.equal(bad.status, "INVALID_PRICE");
  }
  {
    const map = validateProto({ homePrice: 1.8, awayPrice: 1.9 }, "NOTATEAM", "LG");
    assert.equal(map.status, "TEAM_MAPPING_FAILED");
  }

  // --- complete dry-run ---
  {
    const cwd = setupCwd();
    const input = makeInput([
      baseGame({ gameId: "kbo-1" }),
      baseGame({
        gameId: "kbo-2",
        homeTeam: "NC",
        awayTeam: "KIA",
        home: {
          starter: { playerName: "홈2", throwingHand: "R" },
          lineup: fullLineup("H2"),
        },
        away: {
          starter: { playerName: "원2", throwingHand: "L" },
          lineup: fullLineup("A2"),
        },
      }),
      baseGame({
        gameId: "kbo-3",
        homeTeam: "키움",
        awayTeam: "SSG",
        home: {
          starter: { playerName: "홈3", throwingHand: "R" },
          lineup: fullLineup("H3"),
        },
        away: {
          starter: { playerName: "원3", throwingHand: "L" },
          lineup: fullLineup("A3"),
        },
      }),
      baseGame({
        gameId: "kbo-4",
        homeTeam: "롯데",
        awayTeam: "삼성",
        home: {
          starter: { playerName: "홈4", throwingHand: "R" },
          lineup: fullLineup("H4"),
        },
        away: {
          starter: { playerName: "원4", throwingHand: "L" },
          lineup: fullLineup("A4"),
        },
      }),
      baseGame({
        gameId: "kbo-5",
        homeTeam: "KT",
        awayTeam: "한화",
        home: {
          starter: { playerName: "홈5", throwingHand: "R" },
          lineup: fullLineup("H5"),
        },
        away: {
          starter: { playerName: "원5", throwingHand: "L" },
          lineup: fullLineup("A5"),
        },
      }),
    ]);
    const inputPath = path.join(
      cwd,
      "data",
      "operator-input",
      "kbo",
      "2026-08-01-personnel-input-v1.json",
    );
    writeFileSync(inputPath, JSON.stringify(input, null, 2));

    const dry = await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-01",
      inputPath,
      dryRun: true,
      cwd,
      now: new Date("2026-08-01T09:00:00.000Z"),
      priorPersonnel: null,
      priorProto: null,
      lockedGameIds: new Set(),
    });
    assert.equal(dry.writesSkipped, true);
    assert.equal(dry.providerCalls, 0);
    assert.equal(dry.writtenArtifacts.length, 0);
    assert.equal(dry.games.filter((g) => g.status === "ADMIN_VERIFIED").length, 5);
    assert.ok(dry.games.every((g) => g.completeness === "COMPLETE"));
    assert.ok(dry.personnelHash);
    assert.ok(dry.domesticProtoHash);
    assert.ok(dry.wouldCreateArtifacts.length > 0);
    assert.equal(existsSync(path.join(cwd, "data", "research", "kbo", "2026-08-01-personnel-snapshot-v1.json")), false);
  }

  // --- partial lineup ---
  {
    const cwd = setupCwd();
    const g = baseGame({
      home: {
        starter: { playerName: "홈선발", throwingHand: "R" },
        lineup: fullLineup("H").slice(0, 8),
      },
    });
    const inputPath = path.join(cwd, "in.json");
    writeFileSync(inputPath, JSON.stringify(makeInput([g])));
    const r = await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-01",
      inputPath,
      dryRun: true,
      cwd,
      now: new Date("2026-08-01T09:00:00.000Z"),
      priorPersonnel: null,
      priorProto: null,
    });
    assert.equal(r.games[0]!.completeness, "PARTIAL");
    assert.notEqual(r.games[0]!.completeness, "COMPLETE");
    assert.ok(
      r.games[0]!.predictionUsability === "WARNING_ONLY" ||
        r.games[0]!.predictionUsability === "UNUSABLE",
    );
  }

  // --- duplicate batting order ---
  {
    const cwd = setupCwd();
    const lineup = fullLineup("H");
    lineup[8] = { ...batter(1, "HX"), slot: 1 };
    const g = baseGame({
      home: {
        starter: { playerName: "홈선발", throwingHand: "R" },
        lineup,
      },
    });
    const inputPath = path.join(cwd, "in.json");
    writeFileSync(inputPath, JSON.stringify(makeInput([g])));
    const r = await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-01",
      inputPath,
      dryRun: true,
      cwd,
      now: new Date("2026-08-01T09:00:00.000Z"),
      priorPersonnel: null,
      priorProto: null,
    });
    assert.equal(r.games[0]!.status, "FAILED");
    assert.ok(r.games[0]!.errors.some((e) => e.includes("DUPLICATE")));
  }

  // --- after cutoff ---
  {
    const cwd = setupCwd();
    const inputPath = path.join(cwd, "in.json");
    writeFileSync(inputPath, JSON.stringify(makeInput([baseGame()])));
    const r = await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-01",
      inputPath,
      dryRun: true,
      cwd,
      now: new Date("2026-08-01T12:00:00.000Z"), // after 18:30 KST = 09:30Z
      priorPersonnel: null,
      priorProto: null,
    });
    assert.equal(r.games[0]!.status, "AFTER_CUTOFF");
    assert.equal(r.writtenArtifacts.length, 0);
  }

  // --- already locked ---
  {
    const cwd = setupCwd();
    const inputPath = path.join(cwd, "in.json");
    writeFileSync(inputPath, JSON.stringify(makeInput([baseGame()])));
    const r = await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-01",
      inputPath,
      dryRun: true,
      cwd,
      now: new Date("2026-08-01T09:00:00.000Z"),
      priorPersonnel: null,
      priorProto: null,
      lockedGameIds: new Set(["kbo-1"]),
    });
    assert.equal(r.games[0]!.status, "ALREADY_LOCKED");
  }

  // --- write + revision ---
  {
    const cwd = setupCwd();
    const inputPath = path.join(cwd, "in.json");
    writeFileSync(inputPath, JSON.stringify(makeInput([baseGame()])));
    const r1 = await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-01",
      inputPath,
      dryRun: false,
      cwd,
      now: new Date("2026-08-01T09:00:00.000Z"),
      priorPersonnel: null,
      priorProto: null,
      lockedGameIds: new Set(),
    });
    assert.ok(r1.personnelHash);
    assert.ok(existsSync(path.join(cwd, "data", "research", "kbo", "2026-08-01-personnel-snapshot-v1.json")));

    const g2 = baseGame({
      home: {
        starter: { playerName: "홈선발변경", throwingHand: "R" },
        lineup: fullLineup("H"),
      },
    });
    writeFileSync(inputPath, JSON.stringify(makeInput([g2])));
    const r2 = await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-01",
      inputPath,
      dryRun: false,
      cwd,
      now: new Date("2026-08-01T09:05:00.000Z"),
      lockedGameIds: new Set(),
    });
    assert.ok(r2.priorSnapshotRunId);
    assert.notEqual(r2.personnelHash, r1.personnelHash);
    const audit = JSON.parse(
      readFileSync(
        path.join(cwd, "data", "audits", "2026-08-01-kbo-t45-personnel-workflow-v1.json"),
        "utf8",
      ),
    );
    assert.ok(audit.audit[0].previousHash);
    assert.ok(audit.audit[0].nextHash);
    assert.ok(Array.isArray(audit.audit[0].changedFields));
  }

  // --- single game preserve ---
  {
    const cwd = setupCwd();
    const games = [
      baseGame({ gameId: "kbo-1" }),
      baseGame({
        gameId: "kbo-2",
        homeTeam: "NC",
        awayTeam: "KIA",
        home: {
          starter: { playerName: "홈2", throwingHand: "R" },
          lineup: fullLineup("B"),
        },
        away: {
          starter: { playerName: "원2", throwingHand: "L" },
          lineup: fullLineup("C"),
        },
      }),
    ];
    const inputPath = path.join(cwd, "in.json");
    writeFileSync(inputPath, JSON.stringify(makeInput(games)));
    await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-01",
      inputPath,
      cwd,
      now: new Date("2026-08-01T09:00:00.000Z"),
      priorPersonnel: null,
      priorProto: null,
      lockedGameIds: new Set(),
    });
    const onlyOne = makeInput([
      baseGame({
        gameId: "kbo-1",
        home: {
          starter: { playerName: "홈선발2", throwingHand: "R" },
          lineup: fullLineup("H"),
        },
      }),
    ]);
    writeFileSync(inputPath, JSON.stringify(onlyOne));
    await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-01",
      inputPath,
      gameIds: ["kbo-1"],
      cwd,
      now: new Date("2026-08-01T09:10:00.000Z"),
      lockedGameIds: new Set(),
    });
    const snap = JSON.parse(
      readFileSync(
        path.join(cwd, "data", "research", "kbo", "2026-08-01-personnel-snapshot-v1.json"),
        "utf8",
      ),
    );
    assert.equal(snap.games.length, 2);
    assert.ok(snap.games.some((g: { gameId: string }) => g.gameId === "kbo-2"));
  }

  // --- scheduler adapter ---
  {
    const cwd = setupCwd();
    const missing = kboAction({
      stage: "T45_LINEUP_CHECK",
      dateKst: "2026-08-01",
      gameId: "kbo-1",
      includePostgame: false,
      noProvider: true,
      cwd,
    });
    assert.equal(missing.kind, "MANUAL_REQUIRED");
    assert.equal(missing.actionId, "MANUAL_INPUT_REQUIRED");

    const inputPath = path.join(
      cwd,
      "data",
      "operator-input",
      "kbo",
      "2026-08-01-personnel-input-v1.json",
    );
    writeFileSync(inputPath, JSON.stringify(makeInput([baseGame()])));
    const ready = kboAction({
      stage: "T45_LINEUP_CHECK",
      dateKst: "2026-08-01",
      gameId: "kbo-1",
      includePostgame: false,
      noProvider: true,
      cwd,
    });
    assert.equal(ready.kind, "SPAWN_TSX");
    assert.equal(ready.actionId, "RUN_KBO_T45_PERSONNEL_WORKFLOW");
    assert.ok(ready.args?.includes("--date"));
    assert.ok(ready.args?.includes("--input"));

    writeFileSync(inputPath, "{not-json");
    const invalid = kboAction({
      stage: "T45_LINEUP_CHECK",
      dateKst: "2026-08-01",
      gameId: "kbo-1",
      includePostgame: false,
      noProvider: true,
      cwd,
    });
    assert.equal(invalid.kind, "INPUT_VALIDATION_FAILED");
    assert.equal(invalid.actionId, "INPUT_VALIDATION_FAILED");
  }

  console.log("test:kbo-t45-personnel OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
