/**
 * 2026-08-26 daily scope lock COMPLETE/LOCKED tests.
 * Run: npm run test:2026-08-26-daily-scope-lock-v1
 *
 * No provider/network calls. Does not shrink the denominator.
 * Numeric market-id continuity is not required.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  BASEBALL_OBSERVED,
  FOOTBALL_OBSERVED,
  INBOX_PATH,
  KBO_OBSERVED,
  MANIFEST_REL,
  NPB_OBSERVED,
  OVERLAP_GAMES_REMOVED,
  RAW_REL,
  SCREENSHOTS,
  STRUCTURED_REL,
  TOTAL_OBSERVED,
  VOLLEYBALL_OBSERVED,
  sha256Abs,
} from "./intake-2026-08-26-batch-1047-operator-pregame-observations";
import {
  DATE_KST,
  FROZEN_OBS_HASH,
  FROZEN_SCOPE_LOCKED_AT,
  LOCK_REL,
  LOCK_STATUS,
  SCOPE_LOCK_STATUS,
  SOURCE_OBS_REL,
  lockDailyScope,
  sha256File,
} from "./lock-2026-08-26-daily-scope-v1";

const ISOLATION_PATHS = [
  "src/lib/engine",
  "src/lib/football/prediction-snapshot-v0",
  "src/lib/football/market-baseline-prediction-v0",
] as const;

function gameKey(row: {
  displayedDateKst?: string;
  displayedStartKst: string;
  rawLeagueLabel?: string;
  rawHome?: string;
  rawAway?: string;
  rawHomeLabel?: string;
  rawAwayLabel?: string;
  sport?: string;
}) {
  const home = row.rawHome ?? row.rawHomeLabel ?? "";
  const away = row.rawAway ?? row.rawAwayLabel ?? "";
  return [
    row.displayedDateKst ?? "",
    row.displayedStartKst,
    row.rawLeagueLabel ?? row.sport ?? "",
    home,
    away,
  ].join("|");
}

async function main() {
  const cwd = process.cwd();
  const lockAbs = path.join(cwd, LOCK_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);
  const manifestAbs = path.join(cwd, MANIFEST_REL);

  assert.equal(existsSync(lockAbs), true);
  assert.equal(existsSync(obsAbs), true);
  assert.equal(existsSync(manifestAbs), true);

  const lock = JSON.parse(readFileSync(lockAbs, "utf8")) as {
    schemaVersion: string;
    dateKst: string;
    lockStatus: string;
    scopeLockStatus: string;
    scopeLockedAt: string;
    ownerSealedAt: string;
    sourceOperatorObservationRel: string;
    sourceOperatorObservationHash: string;
    sports: string[];
    observedScope: {
      VOLLEYBALL: number;
      BASEBALL: number;
      FOOTBALL: number;
      baseballByLeague: Record<string, number>;
      footballByLeague: Record<string, number>;
      MLB: number;
      total: number;
    };
    officialDenominator: number;
    nextCalendarDateVisibleExcludedFromDenominator: number;
    marketIdGap6647_6655: {
      status: string;
      numericContinuityRequired: boolean;
      gamesInferredFromGap: number;
      additionalVisibleOperatingGamesInferred: number;
      ownerClarification: string;
    };
    scopeShrinkAfterLockForbidden: boolean;
    researchOnly: boolean;
    prediction: string;
    engine: string;
    recommendation: string;
    predictionInput: boolean;
    engineAdmission: string;
    note: string;
  };

  assert.equal(lock.schemaVersion, "yang-edge-daily-scope-lock-v1");
  assert.equal(lock.dateKst, DATE_KST);
  assert.equal(lock.lockStatus, LOCK_STATUS);
  assert.equal(lock.scopeLockStatus, SCOPE_LOCK_STATUS);
  assert.equal(lock.lockStatus, "LOCKED");
  assert.equal(lock.scopeLockStatus, "COMPLETE");
  assert.equal(lock.scopeLockedAt, FROZEN_SCOPE_LOCKED_AT);
  assert.equal(typeof lock.ownerSealedAt, "string");
  assert.ok(lock.ownerSealedAt > lock.scopeLockedAt);
  assert.equal(lock.sourceOperatorObservationRel, SOURCE_OBS_REL);
  assert.equal(lock.scopeShrinkAfterLockForbidden, true);
  assert.equal(lock.researchOnly, true);
  assert.equal(lock.prediction, "NONE");
  assert.equal(lock.engine, "NONE");
  assert.equal(lock.recommendation, "NONE");
  assert.equal(lock.predictionInput, false);
  assert.equal(lock.engineAdmission, "PROHIBITED");
  assert.deepEqual(lock.sports, ["VOLLEYBALL", "BASEBALL", "FOOTBALL"]);
  assert.equal(lock.observedScope.VOLLEYBALL, 1);
  assert.equal(lock.observedScope.BASEBALL, 11);
  assert.equal(lock.observedScope.FOOTBALL, 14);
  assert.equal(lock.observedScope.MLB, 0);
  assert.equal(lock.observedScope.total, 26);
  assert.equal(lock.officialDenominator, 26);
  assert.equal(lock.observedScope.baseballByLeague.NPB, 6);
  assert.equal(lock.observedScope.baseballByLeague.KBO, 5);
  assert.equal(lock.observedScope.footballByLeague["리그스컵"], 1);
  assert.equal(lock.observedScope.footballByLeague["호주FA컵"], 1);
  assert.equal(lock.observedScope.footballByLeague["일본FA컵"], 8);
  assert.equal(lock.observedScope.footballByLeague["K리그1"], 3);
  assert.equal(lock.observedScope.footballByLeague["축ASEA챔"], 1);
  const footballLeagueSum = Object.values(
    lock.observedScope.footballByLeague,
  ).reduce((sum, n) => sum + n, 0);
  assert.equal(footballLeagueSum, 14);
  assert.equal(lock.nextCalendarDateVisibleExcludedFromDenominator, 9);
  assert.equal(
    lock.marketIdGap6647_6655.status,
    "RESOLVED_BY_OWNER_CLARIFICATION",
  );
  assert.equal(lock.marketIdGap6647_6655.numericContinuityRequired, false);
  assert.equal(lock.marketIdGap6647_6655.gamesInferredFromGap, 0);
  assert.equal(
    lock.marketIdGap6647_6655.additionalVisibleOperatingGamesInferred,
    0,
  );
  assert.ok(
    lock.marketIdGap6647_6655.ownerClarification.includes(
      "TBD/undecided items not displayed on Batman",
    ),
  );
  assert.ok(lock.note.includes("must not shrink"));
  assert.ok(lock.note.includes("No additional visible 2026-08-26 operating game"));

  const obsHash = sha256File(obsAbs);
  assert.equal(obsHash, lock.sourceOperatorObservationHash);
  assert.equal(obsHash, FROZEN_OBS_HASH);

  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    schemaVersion: string;
    slateDateKst: string;
    source: string;
    sourceType: string;
    researchOnly: boolean;
    predictionInput: boolean;
    engineConnected: boolean;
    observationPhase: string;
    summary: {
      screenshots: number;
      volleyballOddsFixtures: number;
      npbOddsGames: number;
      kboOddsGames: number;
      footballOddsFixtures: number;
      nextCalendarDateFootballFixtures: number;
      overlapGamesDeduped: number;
      mlbOddsMatchups: number;
      predictionInputTrue: number;
      unreadableGameRows: number;
    };
    screenshots: Array<{ sha256: string; file: string }>;
    volleyballOddsFixtures: Array<{
      displayedDateKst?: string;
      displayedStartKst: string;
      rawLeagueLabel?: string;
      rawHomeLabel?: string;
      rawAwayLabel?: string;
      sport?: string;
      markets: Array<{ rowIds: number[] }>;
    }>;
    npbOddsGames: Array<{
      displayedDateKst?: string;
      displayedStartKst: string;
      rawLeagueLabel?: string;
      rawHomeLabel?: string;
      rawAwayLabel?: string;
      sport?: string;
      markets: Array<{ rowIds: number[] }>;
    }>;
    kboOddsGames: Array<{
      displayedDateKst?: string;
      displayedStartKst: string;
      rawLeagueLabel?: string;
      rawHomeLabel?: string;
      rawAwayLabel?: string;
      sport?: string;
      markets: Array<{ rowIds: number[] }>;
    }>;
    nonMlbOddsFixtures: Array<{
      displayedDateKst: string;
      displayedStartKst: string;
      rawLeagueLabel: string;
      rawHome: string;
      rawAway: string;
      predictionInput: boolean;
      markets: Array<{ rowIds: number[] }>;
    }>;
    nextCalendarDateVisibleFixtures: Array<{
      displayedDateKst: string;
      displayedStartKst: string;
      rawLeagueLabel: string;
      rawHome: string;
      rawAway: string;
      markets: Array<{ rowIds: number[] }>;
    }>;
    overlapDedup: { duplicateGameIdentitiesRemoved: number };
    reviewRequired: Array<{ gamesInventedFromGap: number }>;
    expectedLineups: unknown[];
    confirmedLineups: unknown[];
    domesticOdds: unknown[];
  };

  assert.equal(obs.schemaVersion, "yang-edge-next-pregame-observation-v0");
  assert.equal(obs.slateDateKst, DATE_KST);
  assert.equal(obs.source, "MANUAL_SCREENSHOT");
  assert.equal(obs.sourceType, "MANUAL_OPERATOR_OBSERVATION");
  assert.equal(obs.researchOnly, true);
  assert.equal(obs.predictionInput, false);
  assert.equal(obs.engineConnected, false);
  assert.equal(obs.observationPhase, "PRE_GAME");
  assert.equal(obs.summary.screenshots, 7);
  assert.equal(obs.summary.volleyballOddsFixtures, VOLLEYBALL_OBSERVED);
  assert.equal(obs.summary.npbOddsGames, NPB_OBSERVED);
  assert.equal(obs.summary.kboOddsGames, KBO_OBSERVED);
  assert.equal(obs.summary.footballOddsFixtures, FOOTBALL_OBSERVED);
  assert.equal(obs.summary.nextCalendarDateFootballFixtures, 9);
  assert.equal(obs.summary.overlapGamesDeduped, OVERLAP_GAMES_REMOVED);
  assert.equal(obs.summary.mlbOddsMatchups, 0);
  assert.equal(obs.summary.predictionInputTrue, 0);
  assert.equal(obs.summary.unreadableGameRows, 0);
  assert.equal(obs.volleyballOddsFixtures.length, VOLLEYBALL_OBSERVED);
  assert.equal(obs.npbOddsGames.length, NPB_OBSERVED);
  assert.equal(obs.kboOddsGames.length, KBO_OBSERVED);
  assert.equal(obs.nonMlbOddsFixtures.length, FOOTBALL_OBSERVED);
  assert.equal(obs.nextCalendarDateVisibleFixtures.length, 9);
  assert.equal(obs.expectedLineups.length, 0);
  assert.equal(obs.confirmedLineups.length, 0);
  assert.equal(obs.domesticOdds.length, 0);
  assert.equal(
    obs.overlapDedup.duplicateGameIdentitiesRemoved,
    OVERLAP_GAMES_REMOVED,
  );
  assert.equal(obs.reviewRequired[0]?.gamesInventedFromGap, 0);
  assert.ok(obs.nonMlbOddsFixtures.every((r) => r.displayedDateKst === DATE_KST));
  assert.ok(
    obs.nextCalendarDateVisibleFixtures.every(
      (r) => r.displayedDateKst === "2026-08-27",
    ),
  );
  assert.ok(obs.nonMlbOddsFixtures.every((r) => r.predictionInput === false));

  const identityRows = [
    ...obs.volleyballOddsFixtures,
    ...obs.npbOddsGames,
    ...obs.kboOddsGames,
    ...obs.nonMlbOddsFixtures,
  ];
  const keys = identityRows.map((r) => gameKey(r));
  assert.equal(keys.length, TOTAL_OBSERVED);
  assert.equal(keys.length, 26);
  assert.equal(new Set(keys).size, TOTAL_OBSERVED);

  const nextKeys = obs.nextCalendarDateVisibleFixtures.map((r) => gameKey(r));
  assert.equal(new Set(nextKeys).size, 9);
  for (const k of nextKeys) {
    assert.equal(keys.includes(k), false);
  }

  const rowIds = [
    ...identityRows.flatMap((r) => r.markets.flatMap((m) => m.rowIds)),
    ...obs.nextCalendarDateVisibleFixtures.flatMap((r) =>
      r.markets.flatMap((m) => m.rowIds),
    ),
  ];
  const gapIds = [6647, 6648, 6649, 6650, 6651, 6652, 6653, 6654, 6655];
  for (const id of gapIds) {
    assert.equal(rowIds.includes(id), false);
  }
  assert.equal(
    identityRows.length + obs.nextCalendarDateVisibleFixtures.length,
    35,
  );
  assert.equal(
    lock.marketIdGap6647_6655.numericContinuityRequired,
    false,
    "numeric market-id continuity is not required",
  );

  const manifest = JSON.parse(readFileSync(manifestAbs, "utf8")) as {
    source: string;
    predictionInput: boolean;
    researchOnly: boolean;
    files: Array<{
      file: string;
      originalInboxName: string;
      sha256: string;
      copiedSha256: string;
      copyIntegrity: string;
      predictionInput: boolean;
      duplicateSource: boolean;
    }>;
  };
  assert.equal(manifest.source, "MANUAL_SCREENSHOT");
  assert.equal(manifest.predictionInput, false);
  assert.equal(manifest.researchOnly, true);
  assert.equal(manifest.files.length, 7);

  for (const shot of SCREENSHOTS) {
    const copiedAbs = path.join(cwd, RAW_REL, shot.file);
    const inboxAbs = path.join(INBOX_PATH, shot.originalInboxName);
    assert.equal(existsSync(copiedAbs), true, `missing copy ${shot.file}`);
    assert.equal(existsSync(inboxAbs), true, `missing inbox ${shot.originalInboxName}`);
    const copiedSha = sha256Abs(copiedAbs);
    const inboxSha = sha256Abs(inboxAbs);
    assert.equal(copiedSha, shot.sha256);
    assert.equal(inboxSha, shot.sha256);
    assert.equal(copiedSha, inboxSha);
    const file = manifest.files.find((f) => f.file === shot.file);
    assert.ok(file);
    assert.equal(file.sha256, shot.sha256);
    assert.equal(file.copiedSha256, shot.sha256);
    assert.equal(file.copyIntegrity, "PASS");
    assert.equal(file.predictionInput, false);
    assert.equal(file.duplicateSource, false);
  }

  assert.equal(
    existsSync(path.join(cwd, "data/predictions/mlb/2026-08-26.json")),
    false,
  );
  assert.equal(
    existsSync(path.join(cwd, "data/research/mlb/2026-08-26-schedule-v1.json")),
    false,
  );
  assert.equal(
    existsSync(
      path.join(cwd, "data/research/football/2026-08-26-schedule-v1.json"),
    ),
    false,
  );

  const isolationDiff = execSync(
    `git diff --name-only -- ${ISOLATION_PATHS.join(" ")}`,
    { cwd, encoding: "utf8" },
  ).trim();
  assert.equal(isolationDiff, "");

  const relock = await lockDailyScope(cwd);
  assert.equal(relock.wrote, false);
  assert.equal(relock.lock.scopeLockedAt, lock.scopeLockedAt);
  const afterObs = sha256File(obsAbs);
  assert.equal(afterObs, obsHash);
  console.log("PASS 2026-08-26 daily scope lock COMPLETE/LOCKED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
