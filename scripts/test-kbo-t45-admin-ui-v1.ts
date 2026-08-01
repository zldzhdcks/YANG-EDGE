/**
 * KBO T45 Admin UI view-model integration checks (no Playwright).
 * Uses temp cwd only — never writes operational data/.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
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

  const { loadKboT45AdminView } = await import(
    "../src/lib/kbo/t45-personnel/admin-api"
  );

  const dateKst = "2026-08-03";
  const cwd = mkdtempSync(path.join(tmpdir(), "kbo-t45-admin-ui-"));
  try {
    mkdirSync(path.join(cwd, "data", "research", "kbo"), { recursive: true });
    mkdirSync(path.join(cwd, "data", "predictions", "kbo"), { recursive: true });
    writeFileSync(
      path.join(cwd, "data", "research", "kbo", `${dateKst}-schedule-v1.json`),
      JSON.stringify({
        games: [
          {
            gameId: "kbo-ui-1",
            home: "NC",
            away: "KIA",
            scheduledStartTime: `${dateKst}T18:30:00+09:00`,
          },
        ],
      }),
    );

    const open = await loadKboT45AdminView({
      dateKst,
      cwd,
      now: new Date("2026-08-03T09:00:00.000Z"),
    });
    assert.equal(open.ok, true);
    assert.equal(open.games.length, 1);
    assert.equal(open.games[0]!.readOnly, false);
    assert.ok(open.legalNotice.length >= 2);
    assert.ok(open.authNote.includes("INTERNAL"));

    const after = await loadKboT45AdminView({
      dateKst,
      cwd,
      now: new Date("2026-08-03T12:00:00.000Z"),
    });
    assert.equal(after.games[0]!.afterCutoff, true);
    assert.equal(after.games[0]!.readOnly, true);
    assert.equal(after.games[0]!.windowLabel, "AFTER_CUTOFF");

    // locked prediction forces read-only
    writeFileSync(
      path.join(cwd, "data", "predictions", "kbo", `${dateKst}.json`),
      JSON.stringify({
        lockPhase: "T30_FINAL_PREGAME_LOCK",
        games: [{ gameId: "kbo-ui-1" }],
      }),
    );
    const locked = await loadKboT45AdminView({
      dateKst,
      cwd,
      now: new Date("2026-08-03T09:00:00.000Z"),
    });
    assert.equal(locked.predictionLocked, true);
    assert.equal(locked.games[0]!.locked, true);
    assert.equal(locked.games[0]!.readOnly, true);

    // historical date always read-only flag
    const hist = await loadKboT45AdminView({
      dateKst: "2026-07-31",
      cwd,
      now: new Date("2026-07-31T09:00:00.000Z"),
    });
    assert.equal(hist.historicalReadOnly, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    assert.equal(existsSync(cwd), false);
  }

  console.log("test:kbo-t45-admin-ui OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
