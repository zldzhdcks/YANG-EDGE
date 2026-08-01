/**
 * KBO T45 readiness — null starter/lineup guards + cancelled NOT_APPLICABLE.
 * Temp cwd only; no operational artifact mutation.
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
import Module from "node:module";

async function main() {
  const stub = path.resolve("scripts/stub-server-only.cjs");
  const original = (
    Module as unknown as { _resolveFilename: (...a: unknown[]) => string }
  )._resolveFilename;
  (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename =
    function (request: unknown, ...args: unknown[]) {
      if (request === "server-only") return stub;
      return original.call(this, request, ...args);
    };

  const {
    validateGame,
    validateProto,
    summarizeT45Readiness,
  } = await import("../src/lib/kbo/t45-personnel/validate-personnel-input");
  const { resolveKboGameOperatingStatus } = await import(
    "../src/lib/kbo/t45-personnel/resolve-game-operating-status"
  );
  const { runKboT45PersonnelWorkflow } = await import(
    "../src/lib/kbo/t45-personnel/run-t45-personnel-workflow"
  );
  const { verifyKboT45Historical0731 } = await import(
    "../src/lib/kbo/t45-personnel/historical-verify"
  );

  // --- Status parser ---
  assert.equal(
    resolveKboGameOperatingStatus({ statusAbstract: "Not Started" }),
    "ACTIVE_PREGAME",
  );
  assert.equal(
    resolveKboGameOperatingStatus({ statusAbstract: "NS" }),
    "ACTIVE_PREGAME",
  );
  assert.equal(
    resolveKboGameOperatingStatus({ statusAbstract: "SCHEDULED" }),
    "ACTIVE_PREGAME",
  );
  assert.equal(
    resolveKboGameOperatingStatus({ statusAbstract: "Cancelled" }),
    "CANCELLED",
  );
  assert.equal(
    resolveKboGameOperatingStatus({
      statusDetailed: "Cancelled - Extreme Heat",
    }),
    "CANCELLED",
  );
  assert.equal(
    resolveKboGameOperatingStatus({ statusAbstract: "Postponed" }),
    "POSTPONED",
  );
  assert.equal(
    resolveKboGameOperatingStatus({ statusAbstract: "Final" }),
    "FINAL",
  );
  assert.equal(
    resolveKboGameOperatingStatus({ statusAbstract: "In Progress" }),
    "STARTED",
  );
  assert.equal(
    resolveKboGameOperatingStatus({ statusAbstract: "WeirdThing" }),
    "UNKNOWN",
  );
  // Must NOT treat Not Started as STARTED
  assert.notEqual(
    resolveKboGameOperatingStatus({ statusAbstract: "Not Started" }),
    "STARTED",
  );

  const future = "2099-08-01T18:00:00+09:00";
  const nowMs = Date.parse("2099-08-01T10:00:00+09:00");
  const observedAt = "2099-08-01T10:00:00+09:00";

  const baseGame = {
    gameId: "kbo-1",
    homeTeam: "두산",
    awayTeam: "LG",
    scheduledStartTime: future,
    observedAt,
    home: { starter: null, lineup: null },
    away: { starter: null, lineup: null },
    domesticProto: null as null,
  };

  // --- Active + null starter/lineup ---
  const activeNull = validateGame(baseGame, { nowMs });
  assert.equal(activeNull.status, "NOT_AVAILABLE");
  assert.ok(activeNull.errors.some((e) => e.includes("STARTER_NOT_ENTERED")));
  assert.ok(activeNull.errors.some((e) => e.includes("LINEUP_NOT_ENTERED")));
  assert.ok(activeNull.errors.some((e) => e.includes("DOMESTIC_PROTO_NOT_ENTERED")));
  assert.equal(activeNull.requirementsApplicable, true);

  // --- Cancelled + null ---
  const cancelledNull = validateGame(
    {
      ...baseGame,
      gameId: "kbo-c",
      cancellationStatus: "CANCELLED",
      protoMarketStatus: "CANCELLED_MARKET_NOT_SAVED",
    },
    { nowMs, statusAbstract: "Cancelled", clockState: "CANCELLED" },
  );
  assert.equal(cancelledNull.status, "NOT_APPLICABLE");
  assert.equal(cancelledNull.requirementsApplicable, false);
  assert.equal(cancelledNull.errors.length, 0);
  assert.ok(
    cancelledNull.warnings.some((w) =>
      w.includes("CANCELLED") || w.includes("NOT_APPLICABLE"),
    ),
  );

  // --- Postponed + null ---
  const postponedNull = validateGame(
    { ...baseGame, gameId: "kbo-p", cancellationStatus: "POSTPONED" },
    { nowMs, statusAbstract: "Postponed" },
  );
  assert.equal(postponedNull.status, "NOT_APPLICABLE");
  assert.equal(postponedNull.errors.length, 0);

  // --- Active missing proto vs cancelled ---
  const activeMissingProto = validateProto(null, "두산", "LG");
  assert.equal(activeMissingProto.status, "NOT_ENTERED");
  assert.ok(activeMissingProto.errors.includes("DOMESTIC_PROTO_NOT_ENTERED"));

  // void 1.00 prices invalid
  const voidPrices = validateProto(
    { homePrice: 1.0, awayPrice: 1.0, format: "DECIMAL", marketType: "MONEYLINE_2WAY" },
    "두산",
    "LG",
  );
  assert.equal(voidPrices.status, "INVALID_PRICE");

  // --- Completeness denominator ---
  const slate = [
    validateGame(
      {
        ...baseGame,
        gameId: "kbo-a1",
        domesticProto: {
          homePrice: 1.75,
          awayPrice: 1.77,
          format: "DECIMAL",
          marketType: "MONEYLINE_2WAY",
        },
      },
      { nowMs, statusAbstract: "SCHEDULED" },
    ),
    validateGame(
      {
        ...baseGame,
        gameId: "kbo-a2",
        domesticProto: {
          homePrice: 1.8,
          awayPrice: 1.7,
          format: "DECIMAL",
          marketType: "MONEYLINE_2WAY",
        },
      },
      { nowMs, statusAbstract: "NS" },
    ),
    validateGame(
      {
        ...baseGame,
        gameId: "kbo-a3",
        domesticProto: {
          homePrice: 1.73,
          awayPrice: 1.79,
          format: "DECIMAL",
          marketType: "MONEYLINE_2WAY",
        },
      },
      { nowMs, statusAbstract: "Not Started" },
    ),
    validateGame(
      {
        ...baseGame,
        gameId: "kbo-x1",
        cancellationStatus: "CANCELLED",
      },
      { nowMs, statusAbstract: "Cancelled", clockState: "CANCELLED" },
    ),
    validateGame(
      {
        ...baseGame,
        gameId: "kbo-x2",
        cancellationStatus: "CANCELLED",
      },
      { nowMs, statusAbstract: "Cancelled", clockState: "CANCELLED" },
    ),
  ];
  const summary = summarizeT45Readiness(slate);
  assert.equal(summary.totalGames, 5);
  assert.equal(summary.cancelledGames, 2);
  assert.equal(summary.notApplicableGames, 2);
  assert.equal(summary.personnelRequiredGames, 3);
  assert.equal(summary.protoRequiredGames, 3);
  assert.equal(summary.protoEntered, 3);
  assert.equal(summary.starterEntered, 0);
  assert.equal(summary.lineupEntered, 0);
  assert.equal(summary.overallCompleteness, "PARTIAL");

  // --- Dry-run fixture (2026-08-01 shape) ---
  const cwd = mkdtempSync(path.join(tmpdir(), "kbo-t45-readiness-"));
  mkdirSync(path.join(cwd, "data/research/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/operator-input/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/audits"), { recursive: true });
  mkdirSync(path.join(cwd, "data/predictions/kbo"), { recursive: true });

  writeFileSync(
    path.join(cwd, "data/research/kbo/2026-08-10-schedule-v1.json"),
    JSON.stringify({
      schemaVersion: "kbo-schedule-v1",
      league: "KBO",
      date: "2026-08-10",
      games: [
        {
          gameId: "kbo-181922",
          home: "두산",
          away: "LG",
          scheduledStartTime: future,
          statusAbstract: "SCHEDULED",
          statusDetailed: "NS",
          clockState: "PREGAME_OPEN",
        },
        {
          gameId: "kbo-181923",
          home: "키움",
          away: "SSG",
          scheduledStartTime: future,
          statusAbstract: "SCHEDULED",
          clockState: "PREGAME_OPEN",
        },
        {
          gameId: "kbo-181924",
          home: "KT",
          away: "한화",
          scheduledStartTime: future,
          statusAbstract: "SCHEDULED",
          clockState: "PREGAME_OPEN",
        },
        {
          gameId: "kbo-181925",
          home: "롯데",
          away: "삼성",
          scheduledStartTime: future,
          statusAbstract: "Cancelled",
          statusDetailed: "Cancelled - Extreme Heat",
          clockState: "CANCELLED",
          cancellationStatus: "CANCELLED",
        },
        {
          gameId: "kbo-181926",
          home: "NC",
          away: "KIA",
          scheduledStartTime: future,
          statusAbstract: "Cancelled",
          clockState: "CANCELLED",
          cancellationStatus: "CANCELLED",
        },
      ],
    }) + "\n",
  );

  const inputPath = path.join(
    cwd,
    "data/operator-input/kbo/2026-08-10-personnel-input-v1.json",
  );
  writeFileSync(
    inputPath,
    JSON.stringify({
      schemaVersion: "kbo-t45-personnel-input-v1",
      league: "KBO",
      dateKst: "2026-08-10",
      createdAt: "2099-08-01T00:00:00.000Z",
      createdBy: "readiness-test",
      commercialUseStatus: "INTERNAL_ONLY",
      games: [
        {
          gameId: "kbo-181922",
          homeTeam: "두산",
          awayTeam: "LG",
          scheduledStartTime: future,
          observedAt,
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
          scheduledStartTime: future,
          observedAt,
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
          scheduledStartTime: future,
          observedAt,
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
          scheduledStartTime: future,
          observedAt,
          home: { starter: null, lineup: null },
          away: { starter: null, lineup: null },
          domesticProto: null,
          cancellationStatus: "CANCELLED",
          protoMarketStatus: "CANCELLED_MARKET_NOT_SAVED",
        },
        {
          gameId: "kbo-181926",
          homeTeam: "NC",
          awayTeam: "KIA",
          scheduledStartTime: future,
          observedAt,
          home: { starter: null, lineup: null },
          away: { starter: null, lineup: null },
          domesticProto: null,
          cancellationStatus: "CANCELLED",
          protoMarketStatus: "CANCELLED_MARKET_NOT_SAVED",
        },
      ],
    }) + "\n",
  );

  let threw = false;
  let result;
  try {
    result = await runKboT45PersonnelWorkflow({
      dateKst: "2026-08-10",
      inputPath,
      dryRun: true,
      cwd,
      now: new Date(nowMs),
    });
  } catch (e) {
    threw = true;
    console.error(e);
  }
  assert.equal(threw, false, "dry-run must not TypeError on null starter");
  assert.ok(result);
  assert.equal(result!.writesSkipped, true);
  assert.equal(result!.providerCalls, 0);
  assert.equal(result!.writtenArtifacts.length, 0);
  assert.ok(result!.readinessSummary);
  assert.equal(result!.readinessSummary!.cancelledGames, 2);
  assert.equal(result!.readinessSummary!.notApplicableGames, 2);
  assert.equal(result!.readinessSummary!.personnelRequiredGames, 3);
  assert.equal(result!.readinessSummary!.protoEntered, 3);
  assert.equal(result!.readinessSummary!.starterEntered, 0);
  assert.equal(result!.readinessSummary!.overallCompleteness, "PARTIAL");
  assert.equal(
    result!.games.filter((g) => g.status === "NOT_APPLICABLE").length,
    2,
  );

  // no snapshots written
  assert.equal(
    existsSync(
      path.join(cwd, "data/research/kbo/2026-08-10-personnel-snapshot-v1.json"),
    ),
    false,
  );
  assert.equal(
    existsSync(path.join(cwd, "data/predictions/kbo/2026-08-10.json")),
    false,
  );

  // Historical hashes (repo cwd)
  const hist = await verifyKboT45Historical0731();
  assert.equal(hist.ok, true);

  console.log("test:kbo-t45-readiness OK", {
    cwd,
    readiness: result!.readinessSummary,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
