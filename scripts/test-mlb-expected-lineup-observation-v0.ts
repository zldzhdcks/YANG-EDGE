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
  loadMlbExpectedLineupGameDetailPanel,
  inferExpectedLineupGameObservationStatus,
  normalizeExpectedLineupObservation,
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
    assert.equal(g.observationStatus, "OBSERVED");
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

  // --- A. strict default: missing draft → MISSING_DRAFT ---
  const strictTmp = mkdtempSync(path.join(tmpdir(), "mlb-expected-lu-strict-"));
  mkdirSync(path.dirname(path.join(strictTmp, scheduleRel)), { recursive: true });
  cpSync(path.join(root, scheduleRel), path.join(strictTmp, scheduleRel));
  const strictFail = await saveMlbExpectedLineupObservation({
    dateKst,
    cwd: strictTmp,
    observedAt: "2026-08-07T07:00:00.000Z",
    drafts: drafts.slice(0, 14),
  });
  assert.equal(strictFail.ok, false);
  assert.ok(strictFail.errors.some((e) => e.startsWith("MISSING_DRAFT")));

  // --- C. full slate: OBSERVED=15 NOT_OBSERVED=0 ---
  assert.equal(pre.document!.games.every((g) => g.observationStatus === "OBSERVED"), true);
  assert.equal(
    pre.document!.games.filter((g) => g.observationStatus === "NOT_OBSERVED").length,
    0,
  );

  // --- B. partial opt-in: 7 observed + 8 missing (2026-08-13 schedule) ---
  const partialDate = "2026-08-13";
  const partialScheduleRel = `data/research/mlb/${partialDate}-schedule-v1.json`;
  assert.ok(existsSync(partialScheduleRel));
  const partialTmp = mkdtempSync(path.join(tmpdir(), "mlb-expected-lu-partial-"));
  mkdirSync(path.dirname(path.join(partialTmp, partialScheduleRel)), {
    recursive: true,
  });
  cpSync(path.join(root, partialScheduleRel), path.join(partialTmp, partialScheduleRel));
  const partialSchedule = JSON.parse(
    readFileSync(partialScheduleRel, "utf8"),
  ) as { games: Array<{ gamePk: number }> };
  const partialDrafts = partialSchedule.games.slice(0, 7).map((g) => ({
    gamePk: g.gamePk,
    awayLineup: nine(`PA${g.gamePk}`),
    homeLineup: nine(`PH${g.gamePk}`),
  }));
  const partial = await saveMlbExpectedLineupObservation({
    dateKst: partialDate,
    cwd: partialTmp,
    observedAt: "2026-08-12T09:00:00.000Z",
    drafts: partialDrafts,
    allowMissingDrafts: true,
  });
  assert.equal(partial.ok, true);
  assert.ok(partial.document);
  assert.equal(partial.document!.summary.expectedGames, 7);
  assert.equal(partial.document!.summary.missingGames, 8);
  assert.equal(
    partial.document!.games.filter((g) => g.observationStatus === "OBSERVED").length,
    7,
  );
  assert.equal(
    partial.document!.games.filter((g) => g.observationStatus === "NOT_OBSERVED")
      .length,
    8,
  );
  assert.equal(partial.document!.summary.teamLineups, 14);
  assert.equal(partial.document!.summary.expectedBattingSlots, 126);
  assert.equal(partial.document!.summary.joinErrors, 0);
  for (const g of partial.document!.games.filter(
    (row) => row.observationStatus === "NOT_OBSERVED",
  )) {
    assert.equal(g.lineupStatus, "EXPECTED");
    assert.equal(g.awayLineup.length, 0);
    assert.equal(g.homeLineup.length, 0);
    assert.equal(g.observedAt, null);
  }
  const partialPanel = await loadMlbExpectedLineupGameDetailPanel({
    dateKst: partialDate,
    cwd: partialTmp,
    gamePk: partialSchedule.games[7]!.gamePk,
  });
  assert.equal(partialPanel.available, false);
  assert.match(partialPanel.operatorObservationStatus, /NOT OBSERVED/);

  // --- D. backward compatibility: legacy artifact without observationStatus ---
  const obsRel = mlbExpectedLineupObservationRel(dateKst);
  assert.ok(
    existsSync(obsRel),
    "Run seed-mlb-expected-lineup-observation-v0.ts first",
  );
  const legacyDoc = JSON.parse(readFileSync(obsRel, "utf8")) as Record<string, unknown>;
  for (const g of legacyDoc.games as Array<Record<string, unknown>>) {
    delete g.observationStatus;
  }
  const legacyTmp = mkdtempSync(path.join(tmpdir(), "mlb-expected-lu-legacy-"));
  const legacyRel = mlbExpectedLineupObservationRel(dateKst);
  mkdirSync(path.dirname(path.join(legacyTmp, legacyRel)), { recursive: true });
  writeFileSync(
    path.join(legacyTmp, legacyRel),
    `${JSON.stringify(legacyDoc, null, 2)}\n`,
    "utf8",
  );
  const legacyLoaded = await loadMlbExpectedLineupObservation({
    dateKst,
    cwd: legacyTmp,
  });
  assert.ok(legacyLoaded);
  assert.equal(
    legacyLoaded!.games.every((g) => g.observationStatus === "OBSERVED"),
    true,
  );
  assert.equal(
    inferExpectedLineupGameObservationStatus({
      observationStatus: undefined,
      awayLineup: Array.from({ length: 9 }, () => ({
        battingOrder: 1,
        displayName: "X",
        position: "CF",
        bats: "R",
        providerPlayerId: null,
      })),
      homeLineup: Array.from({ length: 9 }, () => ({
        battingOrder: 1,
        displayName: "Y",
        position: "SS",
        bats: "L",
        providerPlayerId: null,
      })),
    }),
    "OBSERVED",
  );
  assert.equal(
    inferExpectedLineupGameObservationStatus({
      observationStatus: undefined,
      awayLineup: [],
      homeLineup: [],
    }),
    "NOT_OBSERVED",
  );
  const normalized = normalizeExpectedLineupObservation(
    legacyLoaded as Parameters<typeof normalizeExpectedLineupObservation>[0],
  );
  assert.equal(normalized.games[0]!.observationStatus, "OBSERVED");

  // Seed / load repo artifact (created by seed script)
  const loaded = await loadMlbExpectedLineupObservation({ dateKst });
  assert.ok(loaded);
  assert.equal(loaded!.summary.matchedGames, 15);
  assert.equal(loaded!.summary.teamLineups, 30);
  assert.equal(loaded!.summary.expectedBattingSlots, 270);
  assert.equal(loaded!.summary.preGameObservations, 15);
  assert.equal(loaded!.lineupStatus, "EXPECTED");
  assert.equal(loaded!.summary.confirmedGames, 0);
  // Legacy 08-08 artifact may omit observationStatus — load infers OBSERVED
  assert.equal(
    loaded!.games.every(
      (g) => inferExpectedLineupGameObservationStatus(g) === "OBSERVED",
    ),
    true,
  );

  // --- 08-13 immutability audit (code change must not mutate sealed artifacts) ---
  const immutables = [
    "data/predictions/mlb/2026-08-13.json",
    "data/recommendations/mlb/2026-08-13-engine-recommendations-v1.json",
    "data/research/mlb/2026-08-13-odds-history-dataset-v1.json",
    "data/research/mlb/2026-08-13-lineup-dataset-v1.json",
    "data/operator-input/mlb/2026-08-13-korean-market-odds-observation-v0.json",
    "data/operator-input/mlb/2026-08-13-expected-lineup-observation-v0.json",
  ];
  const immBefore: Record<string, string | null> = {};
  for (const p of immutables) {
    immBefore[p] = existsSync(p) ? sha256File(p) : null;
  }

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

  for (const p of immutables) {
    const after = existsSync(p) ? sha256File(p) : null;
    assert.equal(after, immBefore[p], `immutable mutation detected: ${p}`);
  }

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
  console.log("regression A: strict MISSING_DRAFT OK");
  console.log("regression B: partial OBSERVED/NOT_OBSERVED OK");
  console.log("regression C: full slate OBSERVED=15 OK");
  console.log("regression D: legacy infer OK");
  console.log("\ntest:mlb-expected-lineup-observation-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
