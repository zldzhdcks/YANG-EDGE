/**
 * MLB Expected Lineup Observation v0 tests.
 * Run: npm run test:mlb-expected-lineup-observation-v0
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseExpectedLineupPaste,
  saveMlbExpectedLineupObservation,
  loadMlbExpectedLineupObservation,
  mlbExpectedLineupObservationRel,
  mlbLineupDatasetRel,
  mlbPredictionSnapshotRel,
  mlbEngineRecommendationRel,
} from "../src/lib/mlb/expected-lineup-observation-v0";

function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function nine(prefix: string) {
  return Array.from({ length: 9 }, (_, i) => ({
    battingOrder: i + 1,
    displayName: `${prefix} Batter ${i + 1}`,
    position: ["CF", "SS", "1B", "DH", "RF", "3B", "LF", "2B", "C"][i]!,
    bats: "R" as string,
  }));
}

async function main() {
  const root = process.cwd();
  const dateKst = "2026-08-08";

  // Parse paste
  const parsed = parseExpectedLineupPaste(
    "1. Nathan Lukes RF L\n2. V. Guerrero 1B R\n3. K. Okamoto 3B R\n4. G. Springer DH R\n5. A. Kirk C R\n6. J. Sanchez LF L\n7. E. Clement 2B R\n8. A. Gimenez SS L\n9. Myles Straw CF R\n",
  );
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.batters.length, 9);
  assert.equal(parsed.batters[0]!.battingOrder, 1);

  const scheduleRel = `data/research/mlb/${dateKst}-schedule-v1.json`;
  const lineupRel = mlbLineupDatasetRel(dateKst);
  const predRel = mlbPredictionSnapshotRel(dateKst);
  const recRel = mlbEngineRecommendationRel(dateKst);
  assert.ok(existsSync(scheduleRel));
  assert.ok(existsSync(lineupRel));
  assert.ok(existsSync(predRel));
  assert.ok(existsSync(recRel));

  const lineupBefore = sha256File(lineupRel);
  const predBefore = sha256File(predRel);
  const recBefore = sha256File(recRel);
  const lineupMtime = statSync(lineupRel).mtimeMs;
  const predMtime = statSync(predRel).mtimeMs;
  const recMtime = statSync(recRel).mtimeMs;
  const predHashMeta = (
    JSON.parse(readFileSync(predRel, "utf8")) as {
      meta: { predictionHashSha256: string };
    }
  ).meta.predictionHashSha256;
  const recHash = (
    JSON.parse(readFileSync(recRel, "utf8")) as { predictionHash: string }
  ).predictionHash;

  const tmp = mkdtempSync(path.join(tmpdir(), "mlb-expected-lu-"));
  mkdirSync(path.dirname(path.join(tmp, scheduleRel)), { recursive: true });
  cpSync(path.join(root, scheduleRel), path.join(tmp, scheduleRel));

  const schedule = JSON.parse(readFileSync(scheduleRel, "utf8")) as {
    games: Array<{ gamePk: number }>;
  };
  assert.equal(schedule.games.length, 15);

  const drafts = schedule.games.map((g) => ({
    gamePk: g.gamePk,
    awayLineup: nine(`A${g.gamePk}`),
    homeLineup: nine(`H${g.gamePk}`),
  }));

  // Late blocked
  const late = await saveMlbExpectedLineupObservation({
    dateKst,
    cwd: tmp,
    observedAt: "2026-08-09T12:00:00.000Z",
    drafts,
    allowLate: false,
  });
  assert.equal(late.ok, false);
  assert.ok(late.errors.some((e) => e.startsWith("LATE_OBSERVATION_BLOCKED")));

  // Late allowed (marked LATE)
  const lateOk = await saveMlbExpectedLineupObservation({
    dateKst,
    cwd: path.join(tmp, "late"),
    observedAt: "2026-08-09T12:00:00.000Z",
    drafts,
    allowLate: true,
  });
  // need schedule in late cwd
  mkdirSync(path.dirname(path.join(tmp, "late", scheduleRel)), {
    recursive: true,
  });
  cpSync(path.join(root, scheduleRel), path.join(tmp, "late", scheduleRel));
  const lateOk2 = await saveMlbExpectedLineupObservation({
    dateKst,
    cwd: path.join(tmp, "late"),
    observedAt: "2026-08-09T12:00:00.000Z",
    drafts,
    allowLate: true,
  });
  assert.equal(lateOk2.ok, true);
  assert.equal(lateOk2.document!.summary.lateObservations, 15);
  assert.equal(lateOk2.document!.lineupStatus, "EXPECTED");
  assert.equal(lateOk2.document!.summary.confirmedGames, 0);

  // Pre-game save (temp)
  const pre = await saveMlbExpectedLineupObservation({
    dateKst,
    cwd: tmp,
    observedAt: "2026-08-07T07:00:00.000Z",
    drafts,
  });
  assert.equal(pre.ok, true);
  assert.ok(pre.document);
  assert.equal(pre.document!.summary.matchedGames, 15);
  assert.equal(pre.document!.summary.teamLineups, 30);
  assert.equal(pre.document!.summary.expectedBattingSlots, 270);
  assert.equal(pre.document!.summary.preGameObservations, 15);
  assert.equal(pre.document!.sourceType, "MANUAL_OBSERVATION");
  assert.equal(pre.document!.observationType, "EXPECTED_LINEUP");
  assert.equal(pre.document!.lineupStatus, "EXPECTED");
  assert.ok(pre.document!.expectedLineupHash.length === 64);
  for (const g of pre.document!.games) {
    assert.equal(g.lineupStatus, "EXPECTED");
    assert.equal(g.joinStatus, "MATCHED");
    assert.equal(g.awayLineup.length, 9);
    assert.equal(g.homeLineup.length, 9);
    assert.equal(g.awayLineup[0]!.providerPlayerId, null);
    for (let i = 1; i <= 9; i++) {
      assert.ok(g.awayLineup.some((b) => b.battingOrder === i));
      assert.ok(g.homeLineup.some((b) => b.battingOrder === i));
    }
  }

  // Invalid order rejected
  const bad = await saveMlbExpectedLineupObservation({
    dateKst,
    cwd: path.join(tmp, "bad"),
    observedAt: "2026-08-07T07:00:00.000Z",
    drafts: [
      {
        gamePk: schedule.games[0]!.gamePk,
        awayLineup: nine("X").slice(0, 8),
        homeLineup: nine("Y"),
      },
    ],
  });
  mkdirSync(path.dirname(path.join(tmp, "bad", scheduleRel)), {
    recursive: true,
  });
  cpSync(path.join(root, scheduleRel), path.join(tmp, "bad", scheduleRel));
  const bad2 = await saveMlbExpectedLineupObservation({
    dateKst,
    cwd: path.join(tmp, "bad"),
    observedAt: "2026-08-07T07:00:00.000Z",
    drafts: [
      {
        gamePk: schedule.games[0]!.gamePk,
        awayLineup: nine("X").slice(0, 8),
        homeLineup: nine("Y"),
      },
      ...schedule.games.slice(1).map((g) => ({
        gamePk: g.gamePk,
        awayLineup: nine(`A${g.gamePk}`),
        homeLineup: nine(`H${g.gamePk}`),
      })),
    ],
  });
  assert.equal(bad2.ok, false);
  assert.ok(bad2.errors.some((e) => /EXPECTED_9|MISSING_ORDER/.test(e)));

  // Seed / load repo artifact (created by seed script)
  const obsRel = mlbExpectedLineupObservationRel(dateKst);
  assert.ok(
    existsSync(obsRel),
    "Run seed-mlb-expected-lineup-observation-v0.ts first",
  );
  const loaded = await loadMlbExpectedLineupObservation({ dateKst });
  assert.ok(loaded);
  assert.equal(loaded!.summary.matchedGames, 15);
  assert.equal(loaded!.summary.teamLineups, 30);
  assert.equal(loaded!.summary.expectedBattingSlots, 270);
  assert.equal(loaded!.summary.preGameObservations, 15);
  assert.equal(loaded!.lineupStatus, "EXPECTED");
  assert.equal(loaded!.summary.confirmedGames, 0);

  // Mutation audit — protected artifacts unchanged
  assert.equal(sha256File(lineupRel), lineupBefore);
  assert.equal(sha256File(predRel), predBefore);
  assert.equal(sha256File(recRel), recBefore);
  assert.equal(statSync(lineupRel).mtimeMs, lineupMtime);
  assert.equal(statSync(predRel).mtimeMs, predMtime);
  assert.equal(statSync(recRel).mtimeMs, recMtime);
  assert.equal(
    (
      JSON.parse(readFileSync(predRel, "utf8")) as {
        meta: { predictionHashSha256: string };
      }
    ).meta.predictionHashSha256,
    predHashMeta,
  );
  assert.equal(
    (JSON.parse(readFileSync(recRel, "utf8")) as { predictionHash: string })
      .predictionHash,
    recHash,
  );

  // silence unused
  void late;
  void lateOk;
  void bad;
  void writeFileSync;

  console.log("=== MLB EXPECTED LINEUP OBSERVATION ===\n");
  console.log(`Date: ${loaded!.dateKst}`);
  console.log(`Games: ${loaded!.summary.scheduleGames}`);
  console.log(`Matched: ${loaded!.summary.matchedGames}`);
  console.log(`Teams: ${loaded!.summary.teamLineups}`);
  console.log(`Batting Slots: ${loaded!.summary.expectedBattingSlots}`);
  console.log("");
  console.log(`Expected: ${loaded!.summary.expectedGames}`);
  console.log(`Confirmed: ${loaded!.summary.confirmedGames}`);
  console.log(`Missing: ${loaded!.summary.missingGames}`);
  console.log("");
  console.log(
    `Observed Before First Pitch: ${loaded!.summary.preGameObservations}/${loaded!.summary.matchedGames}`,
  );
  console.log("");
  console.log("Prediction Snapshot: PRE_GAME_SNAPSHOT_VERIFIED / UNCHANGED");
  console.log(`Prediction Hash: ${predHashMeta.slice(0, 8)}…`);
  console.log("Recommendation Record: SEALED / UNCHANGED");
  console.log("Mutation: NONE");
  console.log(`Expected Lineup Hash: ${loaded!.expectedLineupHash.slice(0, 8)}…`);
  console.log("\ntest:mlb-expected-lineup-observation-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
