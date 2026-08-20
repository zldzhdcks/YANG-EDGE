/**
 * Partial-slate MLB expected lineup save.
 * Blank games must be NOT_OBSERVED, not validation failures.
 *
 *   npm run test:mlb-expected-lineup-partial-save-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MLB_PREDICTION_V0_WEIGHTS } from "../src/lib/mlb/prediction-v0/config";
import {
  mlbExpectedLineupObservationRel,
  saveMlbExpectedLineupObservation,
  selectExpectedLineupDraftsFromPastes,
} from "../src/lib/mlb/expected-lineup-observation-v0";

const ROOT = process.cwd();
const DATE = "2026-08-22";
const FIRST_PITCH = "2026-08-21T16:40:00.000Z";
const PRE_OBS = "2026-08-21T12:00:00.000Z";
const LATE_OBS = "2026-08-21T18:00:00.000Z";

function sha256File(rel: string): string {
  return createHash("sha256").update(readFileSync(path.join(ROOT, rel))).digest("hex");
}

function ninePaste(prefix: string): string {
  return Array.from({ length: 9 }, (_, i) => {
    const pos = ["CF", "SS", "1B", "DH", "RF", "3B", "LF", "2B", "C"][i]!;
    return `${i + 1}. ${prefix} ${i + 1} ${pos} R`;
  }).join("\n");
}

function eightPaste(prefix: string): string {
  return Array.from({ length: 8 }, (_, i) => `${i + 1}. ${prefix} ${i + 1} RF R`).join(
    "\n",
  );
}

function writeNineGameSchedule(cwd: string): number[] {
  const gamePks = [
    900001, 900002, 900003, 900004, 900005, 900006, 900007, 900008, 900009,
  ];
  const rel = `data/research/mlb/${DATE}-schedule-v1.json`;
  mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true });
  writeFileSync(
    path.join(cwd, rel),
    `${JSON.stringify(
      {
        meta: {
          datasetId: "mlb-schedule",
          schemaVersion: "mlb-schedule-v1",
          builderVersion: "schedule-artifact-builder-v1",
          dateKst: DATE,
          generatedAt: PRE_OBS,
          source: "mlb-stats-api",
          researchOnly: true,
          engineAdmission: "PROHIBITED",
          engineConnected: false,
        },
        summary: { totalGames: 9 },
        games: gamePks.map((gamePk, i) => ({
          internalGameId: `mlb-test-${gamePk}`,
          gamePk,
          homeTeam: `Home ${i + 1}`,
          awayTeam: `Away ${i + 1}`,
          homeTeamId: 100 + i,
          awayTeamId: 200 + i,
          startTimeKst: "01:40",
          commenceTimeUtc: FIRST_PITCH,
          scheduledStartTime: FIRST_PITCH,
          officialDate: "2026-08-21",
          statusAbstract: "Preview",
          statusDetailed: "Scheduled",
          codedGameState: "S",
          collectedAt: PRE_OBS,
          source: "mlb-stats-api",
          league: "MLB",
        })),
      },
      null,
      2,
    )}\n`,
  );
  return gamePks;
}

function pastesForGames(
  gamePks: number[],
  entered: Set<number>,
): Array<{ gamePk: number; awayPaste: string; homePaste: string }> {
  return gamePks.map((gamePk) =>
    entered.has(gamePk)
      ? {
          gamePk,
          awayPaste: ninePaste(`A${gamePk}`),
          homePaste: ninePaste(`H${gamePk}`),
        }
      : { gamePk, awayPaste: "", homePaste: "" },
  );
}

async function withTmp<T>(fn: (cwd: string, gamePks: number[]) => Promise<T>): Promise<T> {
  const cwd = mkdtempSync(path.join(tmpdir(), "mlb-expected-partial-"));
  try {
    const gamePks = writeNineGameSchedule(cwd);
    return await fn(cwd, gamePks);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

async function main() {
  const batterBefore = sha256File("data/research/mlb/2026-08-21-batter-dataset-v0.json");
  const predBefore = sha256File("data/predictions/mlb/2026-07-30.json");

  await withTmp(async (cwd, gamePks) => {
    const one = new Set([gamePks[0]!]);
    const selected = selectExpectedLineupDraftsFromPastes(
      pastesForGames(gamePks, one),
    );
    assert.deepEqual(selected.errors, []);
    assert.equal(selected.drafts.length, 1);
    assert.equal(selected.drafts[0]!.gamePk, gamePks[0]);

    const saved = await saveMlbExpectedLineupObservation({
      dateKst: DATE,
      cwd,
      observedAt: PRE_OBS,
      drafts: selected.drafts,
      allowMissingDrafts: true,
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.document!.summary.expectedGames, 1);
    assert.equal(saved.document!.summary.missingGames, 8);
    assert.equal(
      saved.document!.games.filter((g) => g.observationStatus === "OBSERVED").length,
      1,
    );
    assert.equal(
      saved.document!.games.filter((g) => g.observationStatus === "NOT_OBSERVED")
        .length,
      8,
    );
    assert.equal(saved.document!.lineupStatus, "EXPECTED");
    assert.equal(saved.document!.sourceType, "MANUAL_OBSERVATION");
    assert.equal(saved.document!.summary.confirmedGames, 0);
    assert.equal(saved.document!.games[0]!.awayLineup[0]!.providerPlayerId, null);
    assert.equal(
      saved.document!.games.find((g) => g.gamePk === gamePks[0])!.cutoffLabel,
      "PRE_GAME_OBSERVATION",
    );
    assert.equal(
      JSON.stringify(saved.document).includes('"lineupStatus":"CONFIRMED"'),
      false,
    );
    console.log("PASS A: 1 entered / 8 blank => 1 OBSERVED, 8 NOT_OBSERVED");
  });

  await withTmp(async (cwd, gamePks) => {
    const two = new Set([gamePks[0]!, gamePks[3]!]);
    const selected = selectExpectedLineupDraftsFromPastes(
      pastesForGames(gamePks, two),
    );
    assert.equal(selected.drafts.length, 2);
    const saved = await saveMlbExpectedLineupObservation({
      dateKst: DATE,
      cwd,
      observedAt: PRE_OBS,
      drafts: selected.drafts,
      allowMissingDrafts: true,
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.document!.summary.expectedGames, 2);
    assert.equal(saved.document!.summary.missingGames, 7);
    const observedPks = saved
      .document!.games.filter((g) => g.observationStatus === "OBSERVED")
      .map((g) => g.gamePk)
      .sort();
    assert.deepEqual(observedPks, [...two].sort());
    console.log("PASS B: 2 entered / remaining blank => only entered OBSERVED");
  });

  const awayOnly = selectExpectedLineupDraftsFromPastes([
    { gamePk: 900001, awayPaste: ninePaste("A"), homePaste: "" },
  ]);
  assert.equal(awayOnly.drafts.length, 0);
  assert.ok(awayOnly.errors.includes("INCOMPLETE_GAME_DRAFT:900001:HOME_MISSING"));
  console.log("PASS C: away entered / home blank => INCOMPLETE HOME_MISSING");

  const homeOnly = selectExpectedLineupDraftsFromPastes([
    { gamePk: 900001, awayPaste: "  ", homePaste: ninePaste("H") },
  ]);
  assert.equal(homeOnly.drafts.length, 0);
  assert.ok(homeOnly.errors.includes("INCOMPLETE_GAME_DRAFT:900001:AWAY_MISSING"));
  console.log("PASS D: home entered / away blank => INCOMPLETE AWAY_MISSING");

  await withTmp(async (cwd, gamePks) => {
    const selected = selectExpectedLineupDraftsFromPastes([
      {
        gamePk: gamePks[0]!,
        awayPaste: eightPaste("A"),
        homePaste: ninePaste("H"),
      },
    ]);
    assert.equal(selected.errors.length, 0);
    assert.equal(selected.drafts[0]!.awayLineup.length, 8);
    const saved = await saveMlbExpectedLineupObservation({
      dateKst: DATE,
      cwd,
      observedAt: PRE_OBS,
      drafts: selected.drafts,
      allowMissingDrafts: true,
    });
    assert.equal(saved.ok, false);
    assert.ok(saved.errors.some((e) => /EXPECTED_9_GOT_8|MISSING_ORDER/.test(e)));
    assert.equal(
      existsSync(path.join(cwd, mlbExpectedLineupObservationRel(DATE))),
      false,
    );
    console.log("PASS E: submitted side !=9 slots => SAVE FAIL, no file");
  });

  const blankSlate = selectExpectedLineupDraftsFromPastes(
    Array.from({ length: 9 }, (_, i) => ({
      gamePk: 900001 + i,
      awayPaste: "",
      homePaste: "",
    })),
  );
  assert.deepEqual(blankSlate.drafts, []);
  assert.deepEqual(blankSlate.errors, ["NO_OBSERVATIONS_TO_SAVE"]);
  await withTmp(async (cwd) => {
    const saved = await saveMlbExpectedLineupObservation({
      dateKst: DATE,
      cwd,
      observedAt: PRE_OBS,
      drafts: [],
      allowMissingDrafts: true,
    });
    assert.equal(saved.ok, false);
    assert.deepEqual(saved.errors, ["NO_OBSERVATIONS_TO_SAVE"]);
    assert.equal(
      existsSync(path.join(cwd, mlbExpectedLineupObservationRel(DATE))),
      false,
    );
  });
  console.log("PASS F: blank slate => NO_OBSERVATIONS_TO_SAVE, no file");

  await withTmp(async (cwd, gamePks) => {
    const selected = selectExpectedLineupDraftsFromPastes(
      pastesForGames(gamePks, new Set([gamePks[0]!])),
    );
    const saved = await saveMlbExpectedLineupObservation({
      dateKst: DATE,
      cwd,
      observedAt: PRE_OBS,
      drafts: selected.drafts,
      allowMissingDrafts: true,
    });
    assert.equal(saved.ok, true);
    assert.equal(
      saved.document!.games.find((g) => g.observationStatus === "OBSERVED")!
        .cutoffLabel,
      "PRE_GAME_OBSERVATION",
    );
    console.log("PASS G: pre-first-pitch => PRE_GAME_OBSERVATION");
  });

  await withTmp(async (cwd, gamePks) => {
    const selected = selectExpectedLineupDraftsFromPastes(
      pastesForGames(gamePks, new Set([gamePks[0]!])),
    );
    const saved = await saveMlbExpectedLineupObservation({
      dateKst: DATE,
      cwd,
      observedAt: LATE_OBS,
      drafts: selected.drafts,
      allowMissingDrafts: true,
    });
    assert.equal(saved.ok, false);
    assert.ok(
      saved.errors.some((e) => e.startsWith("LATE_OBSERVATION_BLOCKED")),
    );
    assert.equal(
      existsSync(path.join(cwd, mlbExpectedLineupObservationRel(DATE))),
      false,
    );
    console.log("PASS H: post-first-pitch normal save => LATE_OBSERVATION_BLOCKED");
  });

  const batterAfter = sha256File("data/research/mlb/2026-08-21-batter-dataset-v0.json");
  const predAfter = sha256File("data/predictions/mlb/2026-07-30.json");
  assert.equal(batterAfter, batterBefore);
  assert.equal(predAfter, predBefore);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.marketPrior.value, 0.25);
  assert.equal(MLB_PREDICTION_V0_WEIGHTS.lineup.value, 0);
  assert.equal(
    existsSync(path.join(ROOT, "data/operator-input/mlb/2026-08-21-expected-lineup-observation-v0.json")),
    false,
  );
  console.log("PASS I/J: no CONFIRMED promotion; frozen batter/prediction unchanged; no invented 08-21 expected file");
  process.stdout.write("test:mlb-expected-lineup-partial-save-v1 PASS\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
