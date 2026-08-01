/**
 * KBO T45 Admin API unit tests (temp cwd; no historical mutation).
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import Module from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

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
    loadKboT45AdminView,
    runKboT45AdminWorkflow,
    saveKboT45AdminInput,
    validateKboT45AdminPayload,
  } = await import("../src/lib/kbo/t45-personnel/admin-api");
  const { verifyKboT45Historical0731 } = await import(
    "../src/lib/kbo/t45-personnel/historical-verify"
  );
  type KboT45PersonnelInputV1 =
    import("../src/lib/kbo/t45-personnel/types").KboT45PersonnelInputV1;

  function batter(slot: number, name: string) {
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

  function makeInput(
    dateKst: string,
    games: KboT45PersonnelInputV1["games"],
  ): KboT45PersonnelInputV1 {
    return {
      schemaVersion: "kbo-t45-personnel-input-v1",
      league: "KBO",
      dateKst,
      createdAt: "2026-08-02T01:00:00.000Z",
      createdBy: "test",
      sourceType: "ADMIN_MANUAL_SCREENSHOT",
      commercialUseStatus: "INTERNAL_ONLY",
      games,
    };
  }

  function setupCwd(dateKst: string) {
    const cwd = mkdtempSync(path.join(tmpdir(), "kbo-t45-admin-"));
    mkdirSync(path.join(cwd, "data", "operator-input", "kbo"), { recursive: true });
    mkdirSync(path.join(cwd, "data", "research", "kbo"), { recursive: true });
    mkdirSync(path.join(cwd, "data", "audits"), { recursive: true });
    mkdirSync(path.join(cwd, "data", "predictions", "kbo"), { recursive: true });
    writeFileSync(
      path.join(cwd, "data", "research", "kbo", `${dateKst}-schedule-v1.json`),
      JSON.stringify({
        schemaVersion: "kbo-schedule-v1",
        date: dateKst,
        games: [
          {
            gameId: "kbo-1",
            home: "두산",
            away: "LG",
            scheduledStartTime: `${dateKst}T18:30:00+09:00`,
          },
        ],
      }),
    );
    return cwd;
  }

  const dateKst = "2026-08-02";
  const now = new Date("2026-08-02T09:00:00.000Z");

  {
    const input = makeInput(dateKst, [
      {
        gameId: "kbo-1",
        homeTeam: "두산",
        awayTeam: "LG",
        scheduledStartTime: `${dateKst}T18:30:00+09:00`,
        observedAt: "2026-08-02T09:00:00.000Z",
        home: {
          starter: { playerName: "홈선발", throwingHand: "R" },
          lineup: fullLineup("H"),
        },
        away: {
          starter: { playerName: "원정선발", throwingHand: "L" },
          lineup: fullLineup("A"),
        },
        domesticProto: { homePrice: 1.8, awayPrice: 1.9, format: "DECIMAL" },
      },
    ]);
    const v = validateKboT45AdminPayload({ payload: input, now });
    assert.equal(v.status, "VALID");
    assert.equal(v.mutationPerformed, false);
  }

  {
    const lu = fullLineup("H");
    lu[8] = { ...batter(1, "dup"), slot: 1 };
    const input = makeInput(dateKst, [
      {
        gameId: "kbo-1",
        homeTeam: "두산",
        awayTeam: "LG",
        scheduledStartTime: `${dateKst}T18:30:00+09:00`,
        observedAt: "2026-08-02T09:00:00.000Z",
        home: {
          starter: { playerName: "홈선발", throwingHand: "R" },
          lineup: lu,
        },
        away: {
          starter: { playerName: "원정선발", throwingHand: "L" },
          lineup: fullLineup("A"),
        },
        domesticProto: { homePrice: 1.8, awayPrice: 1.9, format: "DECIMAL" },
      },
    ]);
    const v = validateKboT45AdminPayload({ payload: input, now });
    assert.equal(v.status, "INVALID");
  }

  {
    const v = validateKboT45AdminPayload({
      payload: { schemaVersion: "nope" },
      now,
    });
    assert.equal(v.status, "INVALID");
    assert.ok(v.globalErrors.length > 0);
  }

  {
    const input = makeInput(dateKst, [
      {
        gameId: "kbo-1",
        homeTeam: "두산",
        awayTeam: "LG",
        scheduledStartTime: `${dateKst}T18:30:00+09:00`,
        observedAt: "2026-08-02T09:00:00.000Z",
        home: {
          starter: { playerName: "홈선발", throwingHand: "R" },
          lineup: fullLineup("H"),
        },
        away: {
          starter: { playerName: "원정선발", throwingHand: "L" },
          lineup: fullLineup("A"),
        },
        domesticProto: { homePrice: 1.8, awayPrice: 1.9, format: "DECIMAL" },
      },
    ]);
    const v = validateKboT45AdminPayload({
      payload: input,
      now: new Date("2026-08-02T12:00:00.000Z"),
    });
    assert.equal(v.status, "BLOCKED");
  }

  {
    const input = makeInput(dateKst, [
      {
        gameId: "kbo-1",
        homeTeam: "두산",
        awayTeam: "LG",
        scheduledStartTime: `${dateKst}T18:30:00+09:00`,
        observedAt: "2026-08-02T09:00:00.000Z",
        home: {
          starter: { playerName: "홈선발", throwingHand: "R" },
          lineup: fullLineup("H"),
        },
        away: {
          starter: { playerName: "원정선발", throwingHand: "L" },
          lineup: fullLineup("A"),
        },
        domesticProto: { homePrice: 1.8, awayPrice: 1.9, format: "DECIMAL" },
      },
    ]);
    const v = validateKboT45AdminPayload({
      payload: input,
      now,
      lockedGameIds: new Set(["kbo-1"]),
    });
    assert.equal(v.status, "BLOCKED");
  }

  {
    const cwd = setupCwd(dateKst);
    const input = makeInput(dateKst, [
      {
        gameId: "kbo-1",
        homeTeam: "두산",
        awayTeam: "LG",
        scheduledStartTime: `${dateKst}T18:30:00+09:00`,
        observedAt: "2026-08-02T09:00:00.000Z",
        home: {
          starter: { playerName: "홈선발", throwingHand: "R" },
          lineup: fullLineup("H"),
        },
        away: {
          starter: { playerName: "원정선발", throwingHand: "L" },
          lineup: fullLineup("A"),
        },
        domesticProto: { homePrice: 1.8, awayPrice: 1.9, format: "DECIMAL" },
      },
    ]);
    const s1 = await saveKboT45AdminInput({ payload: input, cwd, now });
    assert.equal(s1.ok, true);
    assert.ok(s1.nextHash);
    assert.equal(s1.mutationPerformed, true);
    assert.ok(
      existsSync(
        path.join(
          cwd,
          "data",
          "operator-input",
          "kbo",
          `${dateKst}-personnel-input-v1.json`,
        ),
      ),
    );

    const input2 = structuredClone(input);
    input2.games[0]!.home.starter!.playerName = "홈선발2";
    const s2 = await saveKboT45AdminInput({
      payload: input2,
      cwd,
      now: new Date("2026-08-02T09:05:00.000Z"),
    });
    assert.equal(s2.ok, true);
    assert.ok(s2.previousHash);
    assert.notEqual(s2.previousHash, s2.nextHash);

    const dry = await runKboT45AdminWorkflow({
      dateKst,
      dryRun: true,
      cwd,
      now,
    });
    assert.equal(dry.ok, true);
    assert.equal(dry.t30AutoRun, false);
    assert.equal(dry.result?.writesSkipped, true);
    assert.equal(dry.result?.providerCalls, 0);
    assert.equal(dry.result?.writtenArtifacts.length, 0);
  }

  {
    const cwd = setupCwd(dateKst);
    const r = await runKboT45AdminWorkflow({ dateKst, dryRun: true, cwd, now });
    assert.equal(r.ok, false);
    assert.equal(r.errorCode, "INPUT_MISSING");
  }

  {
    const cwd = setupCwd("2026-07-31");
    const input = makeInput("2026-07-31", [
      {
        gameId: "kbo-1",
        homeTeam: "두산",
        awayTeam: "LG",
        scheduledStartTime: "2026-07-31T18:30:00+09:00",
        observedAt: "2026-07-31T09:00:00.000Z",
        home: {
          starter: { playerName: "홈선발", throwingHand: "R" },
          lineup: fullLineup("H"),
        },
        away: {
          starter: { playerName: "원정선발", throwingHand: "L" },
          lineup: fullLineup("A"),
        },
        domesticProto: { homePrice: 1.8, awayPrice: 1.9, format: "DECIMAL" },
      },
    ]);
    const s = await saveKboT45AdminInput({
      payload: input,
      cwd,
      now: new Date("2026-07-31T09:00:00.000Z"),
    });
    assert.equal(s.ok, false);
    assert.equal(s.errorCode, "ALREADY_LOCKED");
    const run = await runKboT45AdminWorkflow({
      dateKst: "2026-07-31",
      dryRun: false,
      cwd,
    });
    assert.equal(run.ok, false);
    assert.equal(run.errorCode, "HISTORICAL_READ_ONLY");
  }

  {
    const cwd = setupCwd(dateKst);
    const load = await loadKboT45AdminView({ dateKst, cwd, now });
    assert.equal(load.ok, true);
    assert.equal(load.games.length, 1);
    assert.equal(load.games[0]!.homeTeam, "두산");
  }

  // Full runtime QA flow in temp fixture root (no operational paths)
  {
    const cwd = setupCwd(dateKst);
    const baseGame = {
      gameId: "kbo-1",
      homeTeam: "두산",
      awayTeam: "LG",
      scheduledStartTime: `${dateKst}T18:30:00+09:00`,
      observedAt: "2026-08-02T09:00:00.000Z",
      sourceReference: "<script>alert(1)</script> ADMIN_SCREENSHOT_NOTE",
      home: {
        starter: { playerName: "홈선발", throwingHand: "R" as const },
        lineup: fullLineup("H"),
      },
      away: {
        starter: { playerName: "원정선발", throwingHand: "L" as const },
        lineup: fullLineup("A"),
      },
      domesticProto: { homePrice: 1.8, awayPrice: 1.9, format: "DECIMAL" as const },
    };

    const load1 = await loadKboT45AdminView({ dateKst, cwd, now });
    assert.equal(load1.scheduleExists, true);
    assert.equal(load1.inputExists, false);
    assert.ok(
      load1.games[0]!.windowLabel === "OPEN" ||
        load1.games[0]!.windowLabel === "T45_WINDOW" ||
        load1.games[0]!.windowLabel === "T30_WINDOW",
    );
    assert.equal(load1.games[0]!.readOnly, false);

    // invalid: price <= 1 → save rejected, no file
    const bad = makeInput(dateKst, [
      {
        ...baseGame,
        domesticProto: { homePrice: 1, awayPrice: 1.9, format: "DECIMAL" },
      },
    ]);
    const badSave = await saveKboT45AdminInput({ payload: bad, cwd, now });
    assert.equal(badSave.ok, false);
    assert.equal(badSave.mutationPerformed, false);
    assert.equal(
      existsSync(
        path.join(
          cwd,
          "data",
          "operator-input",
          "kbo",
          `${dateKst}-personnel-input-v1.json`,
        ),
      ),
      false,
    );

    // unknown gameId
    const unknown = makeInput(dateKst, [{ ...baseGame, gameId: "kbo-999" }]);
    // first make valid prices so we hit gameId check after validation
    const unknownSave = await saveKboT45AdminInput({
      payload: unknown,
      cwd,
      now,
    });
    assert.equal(unknownSave.ok, false);
    assert.ok(
      unknownSave.errorCode === "UNKNOWN_GAME_ID" ||
        unknownSave.validation.status !== "VALID",
    );

    // valid save
    const good = makeInput(dateKst, [baseGame]);
    const s1 = await saveKboT45AdminInput({
      payload: good,
      cwd,
      now,
      adminId: "qa-admin",
    });
    assert.equal(s1.ok, true);
    assert.equal(s1.mutationPerformed, true);
    assert.ok(s1.nextHash);
    assert.equal(s1.version, 1);

    // reload
    const load2 = await loadKboT45AdminView({ dateKst, cwd, now });
    assert.equal(load2.inputExists, true);
    assert.equal(load2.existingInput?.games[0]?.home.starter?.playerName, "홈선발");
    assert.ok(
      String(load2.existingInput?.games[0]?.sourceReference ?? "").includes(
        "ADMIN_SCREENSHOT_NOTE",
      ),
    );

    // dry-run
    const dry = await runKboT45AdminWorkflow({
      dateKst,
      dryRun: true,
      cwd,
      now,
    });
    assert.equal(dry.ok, true);
    assert.equal(dry.result?.providerCalls, 0);
    assert.equal(dry.result?.writtenArtifacts.length, 0);
    assert.equal(dry.t30AutoRun, false);

    // real T45 workflow only inside temp fixture cwd
    const run = await runKboT45AdminWorkflow({
      dateKst,
      dryRun: false,
      cwd,
      now: new Date("2026-08-02T09:10:00.000Z"),
    });
    assert.equal(run.ok, true);
    assert.equal(run.t30AutoRun, false);
    assert.ok(
      existsSync(
        path.join(
          cwd,
          "data",
          "research",
          "kbo",
          `${dateKst}-personnel-snapshot-v1.json`,
        ),
      ),
    );
    assert.ok(
      existsSync(
        path.join(
          cwd,
          "data",
          "research",
          "kbo",
          `${dateKst}-domestic-proto-snapshot-v1.json`,
        ),
      ),
    );
    // prediction must not be created by T45 admin run
    assert.equal(
      existsSync(path.join(cwd, "data", "predictions", "kbo", `${dateKst}.json`)),
      false,
    );

    // fixture cleanup: remove temp tree
    const { rmSync } = await import("node:fs");
    rmSync(cwd, { recursive: true, force: true });
    assert.equal(existsSync(cwd), false);
  }

  // Access control soft gate
  {
    const { assertInternalKboT45Access, assertSafeDateKst } = await import(
      "../src/lib/kbo/t45-personnel/internal-access"
    );
    assert.equal(assertSafeDateKst("../etc/passwd").ok, false);
    assert.equal(assertSafeDateKst("2026-08-02").ok, true);

    const denied = assertInternalKboT45Access(
      new Request("http://localhost/api"),
      { NODE_ENV: "production" } as NodeJS.ProcessEnv,
    );
    assert.ok(denied);
    assert.equal(denied!.status, 403);

    const bad = assertInternalKboT45Access(
      new Request("http://localhost/api", {
        headers: { "x-internal-token": "wrong" },
      }),
      {
        NODE_ENV: "production",
        INTERNAL_ADMIN_TOKEN: "fixture-token-value",
      } as NodeJS.ProcessEnv,
    );
    assert.ok(bad);
    assert.equal(bad!.status, 401);

    const ok = assertInternalKboT45Access(
      new Request("http://localhost/api", {
        headers: { "x-internal-token": "fixture-token-value" },
      }),
      {
        NODE_ENV: "production",
        INTERNAL_ADMIN_TOKEN: "fixture-token-value",
      } as NodeJS.ProcessEnv,
    );
    assert.equal(ok, null);
  }

  {
    const before = await verifyKboT45Historical0731(process.cwd());
    assert.equal(before.ok, true);
    assert.equal(
      before.personnelHash,
      "987702440e2e635ac2dd8876a1b412d74c34550a9d36d5e9e682e4b72259cd3f",
    );
    assert.equal(
      before.domesticProtoHash,
      "0dc11530014d520ed11915ac7e426c80e44467bdb56b5fa5dbb02ebd41b7deb0",
    );
  }

  console.log("test:kbo-t45-admin-api OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
