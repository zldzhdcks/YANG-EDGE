/**
 * MLB Independent SAFE_A historical materialization tests.
 * No network. No labels, trainer, or engine wiring.
 *
 *   npm run test:mlb-independent-safe-a-materialization-v1
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  isProhibitedFeatureKey,
  validateIndependentFeatureArtifactV1,
  validateIndependentFeatureRowV1,
} from "../src/lib/mlb/independent-model-v1";
import {
  SafeAHistoricalSourceError,
  SafeAMaterializationError,
  buildHistoricalSourceArtifact,
  findFeatureRow,
  hashIndependentFeatureRowV1,
  independentSafeAAuditArtifactPath,
  independentSafeAFeatureArtifactPath,
  independentSafeAHistoricalSourcePath,
  isSafeCompletedResult,
  materializeIndependentSafeAFeaturesV1,
  validateHistoricalSourceArtifact,
  type MlbIndependentSafeAHistoricalGameV1,
  type MlbIndependentSafeAHistoricalSourceV1,
} from "../src/lib/mlb/independent-safe-a-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-safe-a-v1");

function game(
  over: Partial<MlbIndependentSafeAHistoricalGameV1> &
    Pick<
      MlbIndependentSafeAHistoricalGameV1,
      "gamePk" | "officialDate" | "homeTeamId" | "awayTeamId" | "homeScore" | "awayScore"
    >,
): MlbIndependentSafeAHistoricalGameV1 {
  const hour = 17 + (over.gamePk % 6);
  return {
    commenceTimeUtc: `${over.officialDate}T${String(hour).padStart(2, "0")}:05:00.000Z`,
    gameType: "R",
    abstractGameState: "Final",
    detailedState: "Final",
    codedGameState: "F",
    statusCode: "F",
    doubleHeader: "N",
    gameNumber: 1,
    ifNecessary: "N",
    safeResultApplyDate: null,
    resultProvenanceStatus: "NOT_APPLICABLE",
    ...over,
  };
}

function sourceFrom(
  games: MlbIndependentSafeAHistoricalGameV1[],
): MlbIndependentSafeAHistoricalSourceV1 {
  return buildHistoricalSourceArtifact({
    games,
    collectedAt: "2026-09-02T00:00:00.000Z",
  });
}

function cloneSource(
  src: MlbIndependentSafeAHistoricalSourceV1,
): MlbIndependentSafeAHistoricalSourceV1 {
  return JSON.parse(JSON.stringify(src)) as MlbIndependentSafeAHistoricalSourceV1;
}

function patchGame(
  src: MlbIndependentSafeAHistoricalSourceV1,
  gamePk: number,
  over: Partial<MlbIndependentSafeAHistoricalGameV1>,
): MlbIndependentSafeAHistoricalSourceV1 {
  const copy = cloneSource(src);
  const row = copy.games.find((g) => g.gamePk === gamePk);
  assert.ok(row, `missing gamePk ${gamePk}`);
  Object.assign(row!, over);
  return copy;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = (i * 7 + 3) % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function assertThrowsCode(fn: () => unknown, code: string, label: string): void {
  try {
    fn();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    assert.equal(err.code, code, `${label}: expected ${code}, got ${err.code} (${err.message})`);
    return;
  }
  assert.fail(`${label}: expected throw ${code}`);
}

function walkKeys(value: unknown, visit: (key: string) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walkKeys(item, visit));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    visit(key);
    walkKeys(child, visit);
  }
}

function fixtureGames(): MlbIndependentSafeAHistoricalGameV1[] {
  return [
    game({
      gamePk: 1,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2024-04-01T17:05:00.000Z",
    }),
    game({
      gamePk: 2,
      officialDate: "2024-04-01",
      homeTeamId: 103,
      awayTeamId: 104,
      homeScore: 4,
      awayScore: 1,
      commenceTimeUtc: "2024-04-01T18:10:00.000Z",
    }),
    game({
      gamePk: 3,
      officialDate: "2024-04-02",
      homeTeamId: 102,
      awayTeamId: 101,
      homeScore: 1,
      awayScore: 6,
      commenceTimeUtc: "2024-04-02T17:05:00.000Z",
    }),
    game({
      gamePk: 4,
      officialDate: "2024-04-02",
      homeTeamId: 104,
      awayTeamId: 103,
      homeScore: 2,
      awayScore: 0,
      commenceTimeUtc: "2024-04-02T20:10:00.000Z",
    }),
    game({
      gamePk: 90,
      officialDate: "2024-04-02",
      homeTeamId: 201,
      awayTeamId: 202,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Final",
      detailedState: "Postponed",
      codedGameState: "N",
      statusCode: "N",
    }),
    game({
      gamePk: 5,
      officialDate: "2024-04-03",
      homeTeamId: 101,
      awayTeamId: 103,
      homeScore: 2,
      awayScore: 1,
      commenceTimeUtc: "2024-04-03T17:05:00.000Z",
    }),
    game({
      gamePk: 6,
      officialDate: "2024-04-03",
      homeTeamId: 102,
      awayTeamId: 104,
      homeScore: 8,
      awayScore: 3,
      commenceTimeUtc: "2024-04-03T20:10:00.000Z",
    }),
    game({
      gamePk: 91,
      officialDate: "2024-04-03",
      homeTeamId: 301,
      awayTeamId: 302,
      homeScore: 7,
      awayScore: 2,
      resumedFrom: "2024-04-02T17:00:00.000Z",
      resumedFromDate: "2024-04-02",
    }),
    game({
      gamePk: 7,
      officialDate: "2024-04-04",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 3,
      awayScore: 2,
      commenceTimeUtc: "2024-04-04T17:05:00.000Z",
      doubleHeader: "Y",
      gameNumber: 1,
    }),
    game({
      gamePk: 8,
      officialDate: "2024-04-04",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 0,
      awayScore: 5,
      commenceTimeUtc: "2024-04-04T21:10:00.000Z",
      doubleHeader: "Y",
      gameNumber: 2,
    }),
    game({
      gamePk: 9,
      officialDate: "2024-04-05",
      homeTeamId: 101,
      awayTeamId: 104,
      homeScore: 7,
      awayScore: 4,
      commenceTimeUtc: "2024-04-05T17:05:00.000Z",
    }),
    game({
      gamePk: 10,
      officialDate: "2024-04-05",
      homeTeamId: 102,
      awayTeamId: 103,
      homeScore: 1,
      awayScore: 0,
      commenceTimeUtc: "2024-04-05T20:10:00.000Z",
    }),
    game({
      gamePk: 92,
      officialDate: "2024-04-05",
      homeTeamId: 301,
      awayTeamId: 302,
      homeScore: 3,
      awayScore: 1,
    }),
    game({
      gamePk: 11,
      officialDate: "2024-04-08",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 4,
      awayScore: 3,
      commenceTimeUtc: "2024-04-08T17:05:00.000Z",
    }),
  ];
}

function main(): void {
  const src = sourceFrom(fixtureGames());
  const result = materializeIndependentSafeAFeaturesV1(src, {
    sourcePath: "fixture",
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  const { artifact, audit, excluded } = result;

  assert.equal(validateIndependentFeatureArtifactV1(artifact).ok, true);
  for (const row of artifact.rows) {
    assert.equal(
      validateIndependentFeatureRowV1(row).ok,
      true,
      `row ${row.identity.gamePk} invalid`,
    );
    assert.equal(row.featureHash?.length, 64);
    assert.equal(row.cutoffTime, null);
    assert.equal(row.temporalPolicy, "HISTORICAL_RECONSTRUCTION_D1");
    assert.equal(row.temporalPhase, "HISTORICAL_RECONSTRUCTION");
    assert.equal(row.independentModelSample, undefined);
  }
  assert.equal(artifact.independentModelSample, 0);
  assert.equal(artifact.datasetReady, false);
  assert.equal(artifact.engineAdmission, "PROHIBITED");
  assert.equal(artifact.researchOnly, true);

  const byPk = new Map(artifact.rows.map((r) => [r.identity.gamePk, r]));
  assert.ok(byPk.has(1) && byPk.has(7) && byPk.has(8) && byPk.has(11));
  assert.equal(byPk.has(90), false);
  assert.equal(byPk.has(91), false);
  assert.equal(byPk.has(92), false);

  const excludedReasons = Object.fromEntries(
    excluded.map((e) => [e.gamePk, e.reason]),
  );
  assert.equal(excludedReasons[90], "POSTPONED");
  assert.equal(excludedReasons[91], "UNPROVEN_COMPLETION_PROVENANCE");
  assert.equal(
    excludedReasons[92],
    "TEAM_HISTORY_TAINTED_BY_UNPROVEN_COMPLETION",
  );

  // --- season first game zero/null ---
  const g1 = byPk.get(1)!;
  assert.equal(g1.statsThroughDate, "2024-03-31");
  assert.equal(g1.asOf, "2024-03-31");
  assert.equal(g1.home.gamesPlayedBefore, 0);
  assert.equal(g1.home.winsBefore, 0);
  assert.equal(g1.home.lossesBefore, 0);
  assert.equal(g1.home.winRateBefore, null);
  assert.equal(g1.home.last5WinsBefore, null);
  assert.equal(g1.home.last5LossesBefore, null);
  assert.equal(g1.home.last5WinRateBefore, null);
  assert.equal(g1.home.runsScoredAverageBefore, null);
  assert.equal(g1.home.runsAllowedAverageBefore, null);
  assert.equal(g1.home.last5RunsScoredAverageBefore, null);
  assert.equal(g1.home.last5RunsAllowedAverageBefore, null);
  assert.equal(g1.home.homeWinRateBefore, null);
  assert.equal(g1.home.awayWinRateBefore, null);
  assert.equal(g1.home.currentWinStreakBefore, 0);
  assert.equal(g1.home.currentLossStreakBefore, 0);
  assert.equal(g1.home.restDaysBefore, null);
  assert.equal(g1.headToHeadGamesBefore, 0);

  // --- games 1 last5 / season W/L / rest 0 / H2H ---
  const g3 = byPk.get(3)!;
  assert.equal(g3.away.gamesPlayedBefore, 1);
  assert.equal(g3.away.winsBefore, 1);
  assert.equal(g3.away.lossesBefore, 0);
  assert.equal(g3.away.winRateBefore, 1);
  assert.equal(g3.away.last5WinsBefore, 1);
  assert.equal(g3.away.last5LossesBefore, 0);
  assert.equal(g3.away.last5WinsBefore! + g3.away.last5LossesBefore!, 1);
  assert.equal(g3.away.runsScoredAverageBefore, 5);
  assert.equal(g3.away.runsAllowedAverageBefore, 2);
  assert.equal(g3.away.last5RunsScoredAverageBefore, 5);
  assert.equal(g3.away.last5RunsAllowedAverageBefore, 2);
  assert.equal(g3.away.homeWinRateBefore, 1);
  assert.equal(g3.away.awayWinRateBefore, null);
  assert.equal(g3.away.currentWinStreakBefore, 1);
  assert.equal(g3.away.currentLossStreakBefore, 0);
  assert.equal(g3.away.restDaysBefore, 0);
  assert.equal(g3.home.gamesPlayedBefore, 1);
  assert.equal(g3.home.winsBefore, 0);
  assert.equal(g3.home.awayWinRateBefore, 0);
  assert.equal(g3.home.homeWinRateBefore, null);
  assert.equal(g3.headToHeadGamesBefore, 1);
  assert.equal(g3.headToHeadHomeWinsBefore, 0);
  assert.equal(g3.headToHeadAwayWinsBefore, 1);

  // --- games 1~4 last5 (101 third game = pk 5) ---
  const g5 = byPk.get(5)!;
  assert.equal(g5.home.gamesPlayedBefore, 2);
  assert.equal(g5.home.last5WinsBefore! + g5.home.last5LossesBefore!, 2);
  assert.equal(g5.home.last5WinsBefore, 2);
  assert.equal(g5.home.winsBefore, 2);
  assert.equal(g5.home.runsScoredAverageBefore, (5 + 6) / 2);
  assert.equal(g5.home.homeWinRateBefore, 1);
  assert.equal(g5.home.awayWinRateBefore, 1);

  // --- DH date-batch: same D-1 state ---
  const g7 = byPk.get(7)!;
  const g8 = byPk.get(8)!;
  assert.equal(g7.home.gamesPlayedBefore, 3);
  assert.equal(g8.home.gamesPlayedBefore, 3);
  assert.deepEqual(g7.home, g8.home);
  assert.deepEqual(g7.away, g8.away);
  assert.equal(g7.headToHeadGamesBefore, g8.headToHeadGamesBefore);
  assert.equal(g7.home.last5WinsBefore! + g7.home.last5LossesBefore!, 3);
  assert.equal(g7.home.winsBefore, 3);
  assert.equal(g7.home.currentWinStreakBefore, 3);
  assert.equal(g7.home.restDaysBefore, 0);
  assert.equal(g7.statsThroughDate, "2024-04-03");

  // --- games >=5 last5, run averages, home/away rate, streak ---
  const g9 = byPk.get(9)!;
  assert.equal(g9.home.gamesPlayedBefore, 5);
  assert.equal(g9.home.winsBefore, 4);
  assert.equal(g9.home.lossesBefore, 1);
  assert.equal(g9.home.winRateBefore, 0.8);
  assert.equal(g9.home.last5WinsBefore, 4);
  assert.equal(g9.home.last5LossesBefore, 1);
  assert.equal(g9.home.last5WinsBefore! + g9.home.last5LossesBefore!, 5);
  assert.equal(g9.home.runsScoredAverageBefore, 16 / 5);
  assert.equal(g9.home.runsAllowedAverageBefore, 11 / 5);
  assert.equal(g9.home.last5RunsScoredAverageBefore, 16 / 5);
  assert.equal(g9.home.last5RunsAllowedAverageBefore, 11 / 5);
  assert.equal(g9.home.homeWinRateBefore, 0.75);
  assert.equal(g9.home.awayWinRateBefore, 1);
  assert.equal(g9.home.currentWinStreakBefore, 0);
  assert.equal(g9.home.currentLossStreakBefore, 1);
  assert.equal(g9.headToHeadGamesBefore, 0);

  // --- rest + H2H after DH ordering ---
  const g11 = byPk.get(11)!;
  assert.equal(g11.home.gamesPlayedBefore, 6);
  assert.equal(g11.home.restDaysBefore, 2);
  assert.equal(g11.home.currentWinStreakBefore, 1);
  assert.equal(g11.home.currentLossStreakBefore, 0);
  assert.equal(g11.home.last5WinsBefore, 4);
  assert.equal(g11.home.last5LossesBefore, 1);
  assert.equal(g11.headToHeadGamesBefore, 4);
  assert.equal(g11.headToHeadHomeWinsBefore, 3);
  assert.equal(g11.headToHeadAwayWinsBefore, 1);
  assert.equal(
    g11.headToHeadHomeWinsBefore + g11.headToHeadAwayWinsBefore,
    g11.headToHeadGamesBefore,
  );

  // --- hashes ---
  for (const row of artifact.rows) {
    assert.equal(hashIndependentFeatureRowV1({ ...row, featureHash: null }), row.featureHash);
    assert.equal(hashIndependentFeatureRowV1(row), row.featureHash);
  }
  const hashes = artifact.rows.map((r) => r.featureHash!);
  assert.equal(new Set(hashes).size, hashes.length);

  // TEST 1 — TARGET RESULT IMMUTABILITY
  const mutatedTarget = patchGame(src, 9, { homeScore: 0, awayScore: 10 });
  const mutatedTargetResult = materializeIndependentSafeAFeaturesV1(mutatedTarget);
  const g9b = findFeatureRow(mutatedTargetResult.artifact, 9)!;
  assert.deepEqual(g9b, g9);
  assert.equal(g9b.featureHash, g9.featureHash);
  console.log("TARGET_RESULT_MUTATION = PASS");

  // TEST 2 — SAME-DATE GAME ISOLATION
  const mutatedSameDay = patchGame(src, 7, { homeScore: 20, awayScore: 0 });
  const mutatedSameDayResult = materializeIndependentSafeAFeaturesV1(mutatedSameDay);
  const g8b = findFeatureRow(mutatedSameDayResult.artifact, 8)!;
  assert.deepEqual(g8b, g8);
  assert.equal(g8b.featureHash, g8.featureHash);
  console.log("SAME_DAY_MUTATION = PASS");

  // TEST 3 — PRIOR-DATE EFFECT
  const mutatedPrior = patchGame(src, 5, { homeScore: 0, awayScore: 4 });
  const mutatedPriorResult = materializeIndependentSafeAFeaturesV1(mutatedPrior);
  const g7c = findFeatureRow(mutatedPriorResult.artifact, 7)!;
  assert.notEqual(g7c.featureHash, g7.featureHash);
  assert.notEqual(g7c.home.winsBefore, g7.home.winsBefore);
  assert.equal(g7c.home.winsBefore, 2);
  assert.equal(g7c.home.lossesBefore, 1);
  console.log("PRIOR_DATE_MUTATION = PASS");

  // TEST 4 — SHUFFLED INPUT
  const shuffled = cloneSource(src);
  shuffled.games = shuffle(shuffled.games);
  const shuffledResult = materializeIndependentSafeAFeaturesV1(shuffled);
  assert.equal(shuffledResult.artifact.rows.length, artifact.rows.length);
  for (let i = 0; i < artifact.rows.length; i += 1) {
    assert.deepEqual(shuffledResult.artifact.rows[i], artifact.rows[i]);
    assert.equal(
      shuffledResult.artifact.rows[i]!.featureHash,
      artifact.rows[i]!.featureHash,
    );
  }
  console.log("SHUFFLED_SOURCE = PASS");

  // TEST 5 — DATE BATCH already proven by DH identical sides
  const sameDateRows = artifact.rows.filter((r) => r.identity.officialDate === "2024-04-04");
  assert.equal(sameDateRows.length, 2);
  assert.equal(sameDateRows[0]!.home.gamesPlayedBefore, sameDateRows[1]!.home.gamesPlayedBefore);
  assert.equal(sameDateRows[0]!.away.gamesPlayedBefore, sameDateRows[1]!.away.gamesPlayedBefore);
  console.log("DATE_BATCH_FREEZE = PASS");

  // --- failure tests ---
  const dup = cloneSource(src);
  dup.games.push(cloneSource(src).games[0]!);
  dup.rowCount = dup.games.length;
  assertThrowsCode(
    () => materializeIndependentSafeAFeaturesV1(dup),
    "DUPLICATE_GAME_PK",
    "duplicate gamePk",
  );

  const badDate = patchGame(src, 1, { officialDate: "2024-02-31" });
  assertThrowsCode(
    () => materializeIndependentSafeAFeaturesV1(badDate),
    "MALFORMED_OFFICIAL_DATE",
    "malformed officialDate",
  );

  const badHome = patchGame(src, 1, { homeTeamId: 0 });
  assertThrowsCode(
    () => materializeIndependentSafeAFeaturesV1(badHome),
    "INVALID_TEAM_ID",
    "invalid homeTeamId",
  );

  const equalTeams = patchGame(src, 1, { awayTeamId: 101 });
  assertThrowsCode(
    () => materializeIndependentSafeAFeaturesV1(equalTeams),
    "HOME_AWAY_TEAM_ID_EQUAL",
    "homeTeamId === awayTeamId",
  );

  const badCommence = patchGame(src, 1, { commenceTimeUtc: "not-an-instant" });
  assertThrowsCode(
    () => materializeIndependentSafeAFeaturesV1(badCommence),
    "MALFORMED_COMMENCE_TIME_UTC",
    "malformed commenceTimeUtc",
  );

  const neg = patchGame(src, 1, { homeScore: -1 });
  assertThrowsCode(
    () => materializeIndependentSafeAFeaturesV1(neg),
    "NEGATIVE_SCORE",
    "negative score",
  );

  const malformedFinal = sourceFrom([
    game({
      gamePk: 501,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: null,
      awayScore: null,
    }),
  ]);
  const malformedResult = materializeIndependentSafeAFeaturesV1(malformedFinal);
  assert.equal(malformedResult.artifact.rows.length, 0);
  assert.equal(malformedResult.excluded[0]?.reason, "INVALID_SCORE");

  const tied = sourceFrom([
    game({
      gamePk: 502,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 3,
      awayScore: 3,
    }),
    game({
      gamePk: 503,
      officialDate: "2024-04-02",
      homeTeamId: 101,
      awayTeamId: 103,
      homeScore: 4,
      awayScore: 1,
    }),
  ]);
  const tiedResult = materializeIndependentSafeAFeaturesV1(tied);
  assert.equal(findFeatureRow(tiedResult.artifact, 502), undefined);
  assert.equal(
    tiedResult.excluded.find((e) => e.gamePk === 502)?.reason,
    "TIED_FINAL",
  );
  assert.equal(findFeatureRow(tiedResult.artifact, 503), undefined);
  assert.equal(
    tiedResult.excluded.find((e) => e.gamePk === 503)?.reason,
    "TEAM_HISTORY_TAINTED_BY_UNPROVEN_COMPLETION",
  );

  const unknown = sourceFrom([
    game({
      gamePk: 504,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 2,
      awayScore: 1,
      abstractGameState: "Mystery",
      detailedState: "Mystery",
      codedGameState: "X",
    }),
  ]);
  const unknownResult = materializeIndependentSafeAFeaturesV1(unknown);
  assert.equal(unknownResult.artifact.rows.length, 0);
  assert.equal(unknownResult.excluded[0]?.reason, "NON_FINAL");

  const sameDayResume = sourceFrom([
    game({
      gamePk: 505,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 4,
      awayScore: 2,
      resumedFrom: "2024-04-01T23:45:00.000Z",
      resumedFromDate: "2024-04-01",
    }),
    game({
      gamePk: 506,
      officialDate: "2024-04-02",
      homeTeamId: 101,
      awayTeamId: 103,
      homeScore: 1,
      awayScore: 0,
    }),
  ]);
  const sameDayResumeResult = materializeIndependentSafeAFeaturesV1(sameDayResume);
  assert.ok(findFeatureRow(sameDayResumeResult.artifact, 505), "same-day resume is a feature target");
  assert.equal(
    findFeatureRow(sameDayResumeResult.artifact, 506)?.home.gamesPlayedBefore,
    1,
    "same-day resume result applies after freeze",
  );

  // Asymmetric snapshots: resumeGameDate lives only on the non-selected listing.
  const asymmetric = sourceFrom([
    game({
      gamePk: 9001,
      officialDate: "2024-06-01",
      homeTeamId: 111,
      awayTeamId: 141,
      homeScore: 1,
      awayScore: 4,
      commenceTimeUtc: "2024-06-01T23:10:00.000Z",
      resumeDate: "2024-08-01T18:05:00.000Z",
      resumeGameDate: "2024-08-01",
    }),
    game({
      gamePk: 9001,
      officialDate: "2024-06-01",
      homeTeamId: 111,
      awayTeamId: 141,
      homeScore: 1,
      awayScore: 4,
      commenceTimeUtc: "2024-08-01T18:05:00.000Z",
      resumedFrom: "2024-06-01T23:10:00.000Z",
      resumedFromDate: "2024-06-01",
    }),
    game({
      gamePk: 9002,
      officialDate: "2024-06-02",
      homeTeamId: 111,
      awayTeamId: 103,
      homeScore: 5,
      awayScore: 1,
      commenceTimeUtc: "2024-06-02T17:05:00.000Z",
    }),
    game({
      gamePk: 9003,
      officialDate: "2024-08-02",
      homeTeamId: 111,
      awayTeamId: 104,
      homeScore: 3,
      awayScore: 2,
      commenceTimeUtc: "2024-08-02T17:05:00.000Z",
    }),
  ]);
  const asymmetricRow = asymmetric.games.find((g) => g.gamePk === 9001)!;
  assert.equal(asymmetricRow.officialDate, "2024-06-01");
  assert.equal(asymmetricRow.safeResultApplyDate, "2024-08-01");
  assert.equal(asymmetricRow.resultProvenanceStatus, "CROSS_DATE_RESUME_RESOLVED");
  assert.equal(asymmetricRow.resumeGameDate, "2024-08-01");
  const asymmetricMat = materializeIndependentSafeAFeaturesV1(asymmetric);
  assert.ok(findFeatureRow(asymmetricMat.artifact, 9001));
  assert.equal(
    findFeatureRow(asymmetricMat.artifact, 9002)?.home.gamesPlayedBefore,
    0,
    "cross-date resume must not apply on original officialDate",
  );
  const feat9003 = findFeatureRow(asymmetricMat.artifact, 9003);
  assert.equal(
    feat9003?.home.gamesPlayedBefore,
    2,
    "cross-date resume visible the day after safeResultApplyDate (June 2 game + Aug 1 apply)",
  );
  assert.equal(feat9003?.home.winsBefore, 1);
  assert.equal(feat9003?.home.lossesBefore, 1);
  console.log("CROSS_DATE_RESUME = PASS");

  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9101,
          officialDate: "2024-04-01",
          homeTeamId: 101,
          awayTeamId: 102,
          homeScore: 1,
          awayScore: 0,
        }),
        game({
          gamePk: 9101,
          officialDate: "2024-04-01",
          homeTeamId: 199,
          awayTeamId: 102,
          homeScore: 1,
          awayScore: 0,
        }),
      ]),
    "TEAM_IDENTITY_MISMATCH",
    "same gamePk different homeTeamId",
  );
  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9102,
          officialDate: "2024-04-01",
          homeTeamId: 101,
          awayTeamId: 102,
          homeScore: 1,
          awayScore: 0,
        }),
        game({
          gamePk: 9102,
          officialDate: "2024-04-01",
          homeTeamId: 101,
          awayTeamId: 198,
          homeScore: 1,
          awayScore: 0,
        }),
      ]),
    "TEAM_IDENTITY_MISMATCH",
    "same gamePk different awayTeamId",
  );
  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9103,
          officialDate: "2024-04-01",
          homeTeamId: 101,
          awayTeamId: 102,
          homeScore: 1,
          awayScore: 0,
          resumeGameDate: "2024-04-10",
          resumeDate: "2024-04-10T18:00:00.000Z",
        }),
        game({
          gamePk: 9103,
          officialDate: "2024-04-01",
          homeTeamId: 101,
          awayTeamId: 102,
          homeScore: 1,
          awayScore: 0,
          resumedFromDate: "2024-04-01",
          resumeGameDate: "2024-05-01",
        }),
      ]),
    "CONFLICTING_RESUME_GAME_DATE",
    "conflicting resumeGameDate",
  );
  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9104,
          officialDate: "2024-04-10",
          homeTeamId: 101,
          awayTeamId: 102,
          homeScore: 1,
          awayScore: 0,
          resumeGameDate: "2024-04-01",
        }),
      ]),
    "RESUME_DATE_BEFORE_OFFICIAL_DATE",
    "resumeGameDate before officialDate",
  );
  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9105,
          officialDate: "2024-04-01",
          homeTeamId: 101,
          awayTeamId: 102,
          homeScore: 1,
          awayScore: 0,
          resumeGameDate: "not-a-date",
        }),
      ]),
    "MALFORMED_RESUME_GAME_DATE",
    "malformed resumeGameDate",
  );
  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9106,
          officialDate: "2024-04-01",
          homeTeamId: 101,
          awayTeamId: 102,
          homeScore: 1,
          awayScore: 0,
          resumeGameDate: "2024-04-10",
          resumeDate: "2024-04-10T18:00:00.000Z",
          resumedFromDate: "2024-03-01",
        }),
      ]),
    "RESUME_PROVENANCE_CONFLICT",
    "resumedFromDate does not match officialDate",
  );
  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9107,
          officialDate: "2024-04-01",
          homeTeamId: 101,
          awayTeamId: 102,
          homeScore: 3,
          awayScore: 1,
        }),
        game({
          gamePk: 9107,
          officialDate: "2024-04-01",
          homeTeamId: 101,
          awayTeamId: 102,
          homeScore: 0,
          awayScore: 4,
        }),
      ]),
    "DUPLICATE_GAME_PK",
    "conflicting FINAL scores",
  );

  const standardOk = sourceFrom([
    game({
      gamePk: 9200,
      officialDate: "2024-06-10",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 3,
      awayScore: 1,
    }),
  ]);
  validateHistoricalSourceArtifact(standardOk);
  assert.equal(standardOk.games[0]!.safeResultApplyDate, "2024-06-10");
  assert.equal(standardOk.games[0]!.resultProvenanceStatus, "STANDARD");
  materializeIndependentSafeAFeaturesV1(standardOk);

  const earlierApply = patchGame(standardOk, 9200, {
    safeResultApplyDate: "2024-06-09",
  });
  assertThrowsCode(
    () => validateHistoricalSourceArtifact(earlierApply),
    "RESULT_APPLY_DATE_BEFORE_OFFICIAL_DATE",
    "STANDARD earlier apply date",
  );
  assertThrowsCode(
    () => materializeIndependentSafeAFeaturesV1(earlierApply),
    "RESULT_APPLY_DATE_BEFORE_OFFICIAL_DATE",
    "materializer blocks STANDARD earlier apply",
  );
  assertThrowsCode(
    () => isSafeCompletedResult(earlierApply.games[0]!),
    "RESULT_APPLY_DATE_BEFORE_OFFICIAL_DATE",
    "isSafeCompletedResult defense-in-depth",
  );

  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(standardOk, 9200, { safeResultApplyDate: "2024-06-11" }),
      ),
    "STANDARD_APPLY_DATE_MISMATCH",
    "STANDARD future apply date",
  );
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(standardOk, 9200, { safeResultApplyDate: null }),
      ),
    "STANDARD_NULL_APPLY_DATE",
    "STANDARD FINAL null apply date",
  );

  const crossOk = sourceFrom([
    game({
      gamePk: 9300,
      officialDate: "2024-06-01",
      homeTeamId: 111,
      awayTeamId: 141,
      homeScore: 1,
      awayScore: 4,
      commenceTimeUtc: "2024-08-01T18:05:00.000Z",
      resumeDate: "2024-08-01T18:05:00.000Z",
      resumeGameDate: "2024-08-01",
      resumedFrom: "2024-06-01T23:10:00.000Z",
      resumedFromDate: "2024-06-01",
      safeResultApplyDate: "2024-08-01",
      resultProvenanceStatus: "CROSS_DATE_RESUME_RESOLVED",
    }),
  ]);
  validateHistoricalSourceArtifact(crossOk);
  assert.equal(crossOk.games[0]!.resultProvenanceStatus, "CROSS_DATE_RESUME_RESOLVED");
  assert.equal(crossOk.games[0]!.safeResultApplyDate, "2024-08-01");

  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(crossOk, 9300, { safeResultApplyDate: "2024-08-02" }),
      ),
    "CROSS_DATE_RESUME_APPLY_DATE_MISMATCH",
    "cross-date apply != resumeGameDate",
  );
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(crossOk, 9300, { safeResultApplyDate: "2024-06-01" }),
      ),
    "CROSS_DATE_RESUME_APPLY_DATE_INVALID",
    "cross-date apply == officialDate",
  );
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(crossOk, 9300, { safeResultApplyDate: "2024-05-31" }),
      ),
    "RESULT_APPLY_DATE_BEFORE_OFFICIAL_DATE",
    "cross-date apply before officialDate",
  );
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(crossOk, 9300, { resumedFromDate: "2024-05-01" }),
      ),
    "RESUME_PROVENANCE_CONFLICT",
    "resumedFromDate != officialDate",
  );
  const missingResume = cloneSource(crossOk);
  delete missingResume.games[0]!.resumeGameDate;
  assertThrowsCode(
    () => validateHistoricalSourceArtifact(missingResume),
    "CROSS_DATE_RESUME_PROVENANCE_INCOMPLETE",
    "missing resumeGameDate",
  );

  const unprovenApply = sourceFrom([
    game({
      gamePk: 9400,
      officialDate: "2024-04-03",
      homeTeamId: 301,
      awayTeamId: 302,
      homeScore: 7,
      awayScore: 2,
      resumedFrom: "2024-04-02T17:00:00.000Z",
      resumedFromDate: "2024-04-02",
    }),
  ]);
  assert.equal(unprovenApply.games[0]!.resultProvenanceStatus, "UNPROVEN_COMPLETION");
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(unprovenApply, 9400, { safeResultApplyDate: "2024-04-03" }),
      ),
    "UNPROVEN_APPLY_DATE_PRESENT",
    "UNPROVEN_COMPLETION + apply date",
  );
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(standardOk, 9200, {
          resultProvenanceStatus: "UNPROVEN_COMPLETION",
        }),
      ),
    "UNPROVEN_APPLY_DATE_PRESENT",
    "UNPROVEN_COMPLETION on completed FINAL with apply date",
  );
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(standardOk, 9200, {
          resultProvenanceStatus: "NOT_APPLICABLE",
        }),
      ),
    "NOT_APPLICABLE_APPLY_DATE_PRESENT",
    "NOT_APPLICABLE + apply date",
  );

  const cancelledSrc = sourceFrom([
    game({
      gamePk: 9401,
      officialDate: "2024-09-29",
      homeTeamId: 114,
      awayTeamId: 117,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Final",
      detailedState: "Cancelled",
      codedGameState: "C",
      statusCode: "C",
    }),
  ]);
  assert.equal(cancelledSrc.games[0]!.resultProvenanceStatus, "NOT_APPLICABLE");
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(cancelledSrc, 9401, { safeResultApplyDate: "2024-09-29" }),
      ),
    "UNSAFE_RESULT_APPLY_ON_NON_FINAL",
    "CANCELLED + apply date",
  );
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(cancelledSrc, 9401, {
          resultProvenanceStatus: "NOT_APPLICABLE",
          safeResultApplyDate: "2024-09-29",
        }),
      ),
    "UNSAFE_RESULT_APPLY_ON_NON_FINAL",
    "NOT_APPLICABLE + apply date on cancelled",
  );

  const postponedSrc = sourceFrom([
    game({
      gamePk: 9402,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Final",
      detailedState: "Postponed",
      codedGameState: "N",
      statusCode: "N",
    }),
  ]);
  assert.equal(postponedSrc.games[0]!.resultProvenanceStatus, "NOT_APPLICABLE");
  assertThrowsCode(
    () =>
      validateHistoricalSourceArtifact(
        patchGame(postponedSrc, 9402, { safeResultApplyDate: "2024-04-01" }),
      ),
    "UNSAFE_RESULT_APPLY_ON_NON_FINAL",
    "POSTPONED + apply date",
  );

  const makeup = sourceFrom([
    game({
      gamePk: 8001,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Final",
      detailedState: "Postponed",
      codedGameState: "N",
      statusCode: "N",
    }),
    game({
      gamePk: 8001,
      officialDate: "2024-04-10",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 4,
      awayScore: 2,
      commenceTimeUtc: "2024-04-10T17:05:00.000Z",
      rescheduledFrom: "2024-04-01T17:05:00.000Z",
    }),
  ]);
  assert.equal(makeup.games.length, 1);
  assert.equal(makeup.games[0]!.officialDate, "2024-04-10");
  assert.equal(makeup.games[0]!.safeResultApplyDate, "2024-04-10");
  const makeupMat = materializeIndependentSafeAFeaturesV1(makeup);
  assert.equal(findFeatureRow(makeupMat.artifact, 8001)?.identity.officialDate, "2024-04-10");
  assert.equal(makeupMat.artifact.rows.length, 1);

  function appliedBefore(
    sourceGames: MlbIndependentSafeAHistoricalGameV1[],
    teamId: number,
    beforeDate: string,
  ): number {
    return sourceGames.filter((g) => {
      if (g.safeResultApplyDate == null || g.safeResultApplyDate >= beforeDate) {
        return false;
      }
      if (
        g.resultProvenanceStatus !== "STANDARD" &&
        g.resultProvenanceStatus !== "CROSS_DATE_RESUME_RESOLVED"
      ) {
        return false;
      }
      if (g.homeTeamId !== teamId && g.awayTeamId !== teamId) return false;
      if (g.homeScore == null || g.awayScore == null) return false;
      if (g.homeScore === g.awayScore) return false;
      return true;
    }).length;
  }
  let temporalViolations = 0;
  for (const row of artifact.rows) {
    const homeExpected = appliedBefore(
      src.games,
      row.identity.homeTeamId,
      row.identity.officialDate,
    );
    const awayExpected = appliedBefore(
      src.games,
      row.identity.awayTeamId,
      row.identity.officialDate,
    );
    if (row.home.gamesPlayedBefore !== homeExpected) temporalViolations += 1;
    if (row.away.gamesPlayedBefore !== awayExpected) temporalViolations += 1;
  }
  assert.equal(temporalViolations, 0, "TEMPORAL_RESULT_APPLY_VIOLATIONS");

  walkKeys(artifact, (key) => {
    assert.equal(
      isProhibitedFeatureKey(key),
      false,
      `prohibited key leaked into features: ${key}`,
    );
  });
  for (const row of artifact.rows) {
    const rec = row as unknown as Record<string, unknown>;
    assert.equal("homeScore" in rec, false);
    assert.equal("awayScore" in rec, false);
    assert.equal("winner" in rec, false);
    assert.equal("actualWinner" in rec, false);
    assert.equal("grade" in rec, false);
    assert.equal("market" in rec, false);
    assert.equal("odds" in rec, false);
  }
  assert.equal(audit.leakageChecks.marketFieldsPresent, false);
  assert.equal(audit.leakageChecks.targetResultUsed, false);
  assert.equal(audit.leakageChecks.sameDayResultUsed, false);
  assert.equal(audit.leakageChecks.crossDateResultAppliedToOriginalDate, false);
  assert.equal(audit.leakageChecks.temporalResultApplyViolationCount, 0);
  assert.equal(audit.unusualProvenance.finalRollingStateMatchesSource, true);
  assert.equal(audit.contractChecks.allFeatureRowsValid, true);
  assert.equal(audit.contractChecks.featureArtifactValid, true);
  assert.equal(audit.researchState.DATASET_READY, false);
  assert.equal(audit.researchState.INDEPENDENT_MODEL_SAMPLE, 0);

  const injected = {
    ...g1,
    homeScore: 10,
    winner: "HOME",
    market: { odds: -120 },
  };
  const injectedCheck = validateIndependentFeatureRowV1(injected);
  assert.equal(injectedCheck.ok, false);
  assert.ok(injectedCheck.errors.some((e) => e.includes("FEATURE_PROHIBITED_KEY")));

  const libFiles = ["historical-source.ts", "materialize.ts", "index.ts"];
  for (const file of libFiles) {
    const text = readFileSync(path.join(LIB_DIR, file), "utf8");
    assert.equal(text.includes("prediction-v0"), false, `${file} imported prediction-v0`);
    assert.equal(text.includes("build-mlb-official-results"), false, `${file} imported official results`);
    assert.equal(text.includes("logistic"), false, `${file} mentions logistic`);
    assert.equal(text.includes("xgboost"), false, `${file} mentions xgboost`);
  }
  const materializeSrc = readFileSync(path.join(LIB_DIR, "materialize.ts"), "utf8");
  assert.equal(materializeSrc.includes("fetch("), false);
  assert.equal(materializeSrc.includes("statsapi.mlb.com"), false);

  const realSourcePath = independentSafeAHistoricalSourcePath();
  const realFeaturePath = independentSafeAFeatureArtifactPath();
  const realAuditPath = independentSafeAAuditArtifactPath();
  if (existsSync(realSourcePath) && existsSync(realFeaturePath) && existsSync(realAuditPath)) {
    const realSource = JSON.parse(readFileSync(realSourcePath, "utf8"));
    const realFeatures = JSON.parse(readFileSync(realFeaturePath, "utf8"));
    const realAudit = JSON.parse(readFileSync(realAuditPath, "utf8"));
    const replay = materializeIndependentSafeAFeaturesV1(realSource, {
      sourcePath: "data/research/mlb/independent-model-v1/historical-source/2024-regular-season-v1.json",
      generatedAt: realAudit.generatedAt,
    });
    assert.equal(validateIndependentFeatureArtifactV1(realFeatures).ok, true);
    assert.ok(realFeatures.rows.length > 0, "FEATURE_ROWS_CREATED must be > 0");
    assert.equal(realFeatures.independentModelSample, 0);
    assert.equal(realFeatures.datasetReady, false);
    assert.equal(replay.artifact.rows.length, realFeatures.rows.length);
    assert.equal(replay.artifact.rows[0]!.featureHash, realFeatures.rows[0]!.featureHash);
    assert.equal(
      replay.artifact.rows[replay.artifact.rows.length - 1]!.featureHash,
      realFeatures.rows[realFeatures.rows.length - 1]!.featureHash,
    );

    const src746942 = realSource.games.find((g: { gamePk: number }) => g.gamePk === 746942);
    assert.equal(src746942.officialDate, "2024-06-26");
    assert.equal(src746942.safeResultApplyDate, "2024-08-26");
    assert.equal(src746942.resultProvenanceStatus, "CROSS_DATE_RESUME_RESOLVED");
    const feat746942 = realFeatures.rows.find(
      (r: { identity: { gamePk: number } }) => r.identity.gamePk === 746942,
    );
    assert.ok(feat746942);
    assert.equal(feat746942.identity.officialDate, "2024-06-26");

    const src745180 = realSource.games.find((g: { gamePk: number }) => g.gamePk === 745180);
    assert.equal(src745180.officialDate, "2024-05-21");
    assert.equal(src745180.safeResultApplyDate, "2024-05-22");
    assert.equal(src745180.resultProvenanceStatus, "CROSS_DATE_RESUME_RESOLVED");
    const src746755 = realSource.games.find((g: { gamePk: number }) => g.gamePk === 746755);
    assert.equal(src746755.officialDate, "2024-08-27");
    assert.equal(src746755.safeResultApplyDate, "2024-08-28");
    assert.equal(src746755.resultProvenanceStatus, "CROSS_DATE_RESUME_RESOLVED");

    function sideFor(
      row: {
        identity: { homeTeamId: number; awayTeamId: number };
        home: { gamesPlayedBefore: number; winsBefore: number; lossesBefore: number };
        away: { gamesPlayedBefore: number; winsBefore: number; lossesBefore: number };
      },
      teamId: number,
    ) {
      return row.identity.homeTeamId === teamId ? row.home : row.away;
    }
    function recordBefore(
      sourceGames: Array<{
        officialDate: string;
        safeResultApplyDate: string | null;
        homeTeamId: number;
        awayTeamId: number;
        homeScore: number | null;
        awayScore: number | null;
        resultProvenanceStatus: string;
      }>,
      teamId: number,
      beforeDate: string,
      dateField: "safeResultApplyDate" | "officialDate",
    ): { games: number; wins: number; losses: number } {
      let gamesPlayed = 0;
      let wins = 0;
      let losses = 0;
      for (const g of sourceGames) {
        const day = dateField === "officialDate" ? g.officialDate : g.safeResultApplyDate;
        if (day == null || day >= beforeDate) continue;
        if (
          g.resultProvenanceStatus !== "STANDARD" &&
          g.resultProvenanceStatus !== "CROSS_DATE_RESUME_RESOLVED"
        ) {
          continue;
        }
        if (g.homeTeamId !== teamId && g.awayTeamId !== teamId) continue;
        if (g.homeScore == null || g.awayScore == null || g.homeScore === g.awayScore) continue;
        const won =
          g.homeTeamId === teamId ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
        gamesPlayed += 1;
        if (won) wins += 1;
        else losses += 1;
      }
      return { games: gamesPlayed, wins, losses };
    }
    function assertResumeIsolation(
      featureRow: {
        identity: { officialDate: string; homeTeamId: number; awayTeamId: number };
        home: { gamesPlayedBefore: number; winsBefore: number; lossesBefore: number };
        away: { gamesPlayedBefore: number; winsBefore: number; lossesBefore: number };
      },
      teamId: number,
      leakedGamePk: number,
      label: string,
    ): void {
      const side = sideFor(featureRow, teamId);
      const safe = recordBefore(
        realSource.games,
        teamId,
        featureRow.identity.officialDate,
        "safeResultApplyDate",
      );
      const leaked = recordBefore(
        realSource.games,
        teamId,
        featureRow.identity.officialDate,
        "officialDate",
      );
      assert.equal(side.gamesPlayedBefore, safe.games, `${label} gamesPlayedBefore`);
      assert.equal(side.winsBefore, safe.wins, `${label} winsBefore`);
      assert.equal(side.lossesBefore, safe.losses, `${label} lossesBefore`);
      const leakedGame = realSource.games.find((g: { gamePk: number }) => g.gamePk === leakedGamePk);
      const leakWouldApply =
        leakedGame.officialDate < featureRow.identity.officialDate &&
        leakedGame.safeResultApplyDate >= featureRow.identity.officialDate;
      if (leakWouldApply) {
        assert.equal(
          leaked.games,
          safe.games + 1,
          `${label}: old officialDate apply must differ by the resume result`,
        );
      }
    }

    const bosJune28 = realFeatures.rows.find(
      (r: { identity: { officialDate: string; homeTeamId: number; awayTeamId: number } }) =>
        r.identity.officialDate === "2024-06-28" &&
        (r.identity.homeTeamId === 111 || r.identity.awayTeamId === 111),
    );
    const torJune28 = realFeatures.rows.find(
      (r: { identity: { officialDate: string; homeTeamId: number; awayTeamId: number } }) =>
        r.identity.officialDate === "2024-06-28" &&
        (r.identity.homeTeamId === 141 || r.identity.awayTeamId === 141),
    );
    assert.ok(bosJune28, "BOS 2024-06-28 feature");
    assert.ok(torJune28, "TOR 2024-06-28 feature");
    assertResumeIsolation(bosJune28, 111, 746942, "BOS 2024-06-28");
    assertResumeIsolation(torJune28, 141, 746942, "TOR 2024-06-28");

    const bosAug26 = realFeatures.rows.find(
      (r: { identity: { officialDate: string; homeTeamId: number; awayTeamId: number } }) =>
        r.identity.officialDate === "2024-08-26" &&
        (r.identity.homeTeamId === 111 || r.identity.awayTeamId === 111),
    );
    assert.ok(bosAug26, "BOS 2024-08-26 same-day freeze");
    assertResumeIsolation(bosAug26, 111, 746942, "BOS 2024-08-26");

    const bosAug27 = realFeatures.rows.find(
      (r: { identity: { officialDate: string; homeTeamId: number; awayTeamId: number } }) =>
        r.identity.officialDate === "2024-08-27" &&
        (r.identity.homeTeamId === 111 || r.identity.awayTeamId === 111),
    );
    assert.ok(bosAug27);
    const bosAug27Side = sideFor(bosAug27, 111);
    const bosAug27Safe = recordBefore(
      realSource.games,
      111,
      "2024-08-27",
      "safeResultApplyDate",
    );
    assert.equal(bosAug27Side.gamesPlayedBefore, bosAug27Safe.games);
    assert.equal(bosAug27Side.winsBefore, bosAug27Safe.wins);
    assert.equal(bosAug27Side.lossesBefore, bosAug27Safe.losses);
    assert.equal(
      bosAug27Safe.games,
      sideFor(bosAug26, 111).gamesPlayedBefore +
        realSource.games.filter(
          (g: {
            safeResultApplyDate: string | null;
            homeTeamId: number;
            awayTeamId: number;
            resultProvenanceStatus: string;
          }) =>
            g.safeResultApplyDate === "2024-08-26" &&
            (g.homeTeamId === 111 || g.awayTeamId === 111) &&
            (g.resultProvenanceStatus === "STANDARD" ||
              g.resultProvenanceStatus === "CROSS_DATE_RESUME_RESOLVED"),
        ).length,
    );
    assert.ok(
      realSource.games.some(
        (g: { gamePk: number; safeResultApplyDate: string | null }) =>
          g.gamePk === 746942 && g.safeResultApplyDate === "2024-08-26",
      ),
    );

    const stlMay22 = realFeatures.rows.find(
      (r: { identity: { officialDate: string; homeTeamId: number; awayTeamId: number } }) =>
        r.identity.officialDate === "2024-05-22" &&
        (r.identity.homeTeamId === 138 || r.identity.awayTeamId === 138),
    );
    const feat745180 = realFeatures.rows.find(
      (r: { identity: { gamePk: number } }) => r.identity.gamePk === 745180,
    );
    assert.ok(feat745180 && stlMay22);
    assert.equal(feat745180.identity.officialDate, "2024-05-21");
    assertResumeIsolation(stlMay22, 138, 745180, "STL 2024-05-22");
    const after745180 = realFeatures.rows.find(
      (r: { identity: { officialDate: string; homeTeamId: number; awayTeamId: number } }) =>
        r.identity.officialDate >= "2024-05-23" &&
        (r.identity.homeTeamId === 138 ||
          r.identity.awayTeamId === 138 ||
          r.identity.homeTeamId === 110 ||
          r.identity.awayTeamId === 110),
    );
    assert.ok(after745180);
    const after745180Team =
      after745180.identity.homeTeamId === 138 || after745180.identity.awayTeamId === 138
        ? 138
        : 110;
    const after745180Safe = recordBefore(
      realSource.games,
      after745180Team,
      after745180.identity.officialDate,
      "safeResultApplyDate",
    );
    assert.equal(
      sideFor(after745180, after745180Team).gamesPlayedBefore,
      after745180Safe.games,
    );
    assert.ok(
      after745180Safe.games >
        recordBefore(
          realSource.games,
          after745180Team,
          "2024-05-22",
          "safeResultApplyDate",
        ).games,
      "745180 result visible from 2024-05-23",
    );

    const chwAug28 = realFeatures.rows.find(
      (r: { identity: { officialDate: string; homeTeamId: number; awayTeamId: number } }) =>
        r.identity.officialDate === "2024-08-28" &&
        (r.identity.homeTeamId === 145 || r.identity.awayTeamId === 145),
    );
    const feat746755 = realFeatures.rows.find(
      (r: { identity: { gamePk: number } }) => r.identity.gamePk === 746755,
    );
    assert.ok(feat746755 && chwAug28);
    assert.equal(feat746755.identity.officialDate, "2024-08-27");
    assertResumeIsolation(chwAug28, 145, 746755, "CWS 2024-08-28");
    const chwAug29 = realFeatures.rows.find(
      (r: { identity: { officialDate: string; homeTeamId: number; awayTeamId: number } }) =>
        r.identity.officialDate === "2024-08-29" &&
        (r.identity.homeTeamId === 145 || r.identity.awayTeamId === 145),
    );
    assert.ok(chwAug29);
    assert.equal(
      sideFor(chwAug29, 145).gamesPlayedBefore,
      recordBefore(realSource.games, 145, "2024-08-29", "safeResultApplyDate").games,
    );

    const sourcePks = new Set(
      realSource.games.map((g: { gamePk: number }) => g.gamePk),
    );
    const featurePks = new Set(
      realFeatures.rows.map((r: { identity: { gamePk: number } }) => r.identity.gamePk),
    );
    const sourceMinusFeature = [...sourcePks].filter((pk) => !featurePks.has(pk));
    assert.equal(sourceMinusFeature.includes(746577), true);
    assert.equal(
      realFeatures.rows.some(
        (r: { identity: { gamePk: number } }) => r.identity.gamePk === 746577,
      ),
      false,
    );

    assert.equal(realAudit.unusualProvenance.resultApplyDatePolicy, "SAFE_RESULT_APPLY_DATE_V1");
    assert.equal(realAudit.unusualProvenance.resolvedCrossDateResumeCount, 3);
    assert.equal(realAudit.unusualProvenance.unprovenCrossDateResumeCount, 0);
    assert.equal(realAudit.leakageChecks.crossDateResultAppliedToOriginalDate, false);
    assert.equal(realAudit.leakageChecks.sameDayResultUsed, false);
    assert.equal(realAudit.leakageChecks.targetResultUsed, false);
    assert.equal(realAudit.leakageChecks.marketFieldsPresent, false);
    assert.equal(realAudit.leakageChecks.temporalResultApplyViolationCount, 0);
    assert.equal(replay.audit.leakageChecks.temporalResultApplyViolationCount, 0);
    assert.equal(replay.audit.leakageChecks.sameDayResultUsed, false);
    assert.equal(replay.audit.leakageChecks.targetResultUsed, false);
    assert.equal(replay.audit.leakageChecks.crossDateResultAppliedToOriginalDate, false);
    assert.equal(replay.audit.leakageChecks.marketFieldsPresent, false);
    assert.equal(realAudit.unusualProvenance.finalRollingStateMatchesSource, true);
    const resumeByPk = new Map(
      realAudit.unusualProvenance.resumeCases.map(
        (c: {
          gamePk: number;
          officialDate: string;
          safeResultApplyDate: string | null;
          provenanceStatus: string;
        }) => [c.gamePk, c],
      ),
    );
    assert.equal(resumeByPk.get(745180)?.officialDate, "2024-05-21");
    assert.equal(resumeByPk.get(745180)?.safeResultApplyDate, "2024-05-22");
    assert.equal(resumeByPk.get(746942)?.officialDate, "2024-06-26");
    assert.equal(resumeByPk.get(746942)?.safeResultApplyDate, "2024-08-26");
    assert.equal(resumeByPk.get(746755)?.officialDate, "2024-08-27");
    assert.equal(resumeByPk.get(746755)?.safeResultApplyDate, "2024-08-28");

    let realTemporal = 0;
    for (const row of realFeatures.rows) {
      const homeExpected = appliedBefore(
        realSource.games,
        row.identity.homeTeamId,
        row.identity.officialDate,
      );
      const awayExpected = appliedBefore(
        realSource.games,
        row.identity.awayTeamId,
        row.identity.officialDate,
      );
      if (row.home.gamesPlayedBefore !== homeExpected) realTemporal += 1;
      if (row.away.gamesPlayedBefore !== awayExpected) realTemporal += 1;
    }
    assert.equal(realTemporal, 0, "TEMPORAL_RESULT_APPLY_VIOLATIONS real 2024");
    console.log(`TEMPORAL_RESULT_APPLY_VIOLATIONS=${realTemporal}`);
    console.log(
      `AUDIT_TEMPORAL_RESULT_APPLY_VIOLATION_COUNT=${realAudit.leakageChecks.temporalResultApplyViolationCount}`,
    );
    console.log(`REAL_2024_FEATURE_ROWS=${realFeatures.rows.length}`);
    console.log(`SOURCE_MINUS_FEATURE=${sourceMinusFeature.join(",")}`);
    console.log(
      `FINAL_ROLLING_STATE_MATCHES_SOURCE=${realAudit.unusualProvenance.finalRollingStateMatchesSource ? "YES" : "NO"}`,
    );
    console.log(`MARKET_FIELDS_PRESENT=${realAudit.leakageChecks.marketFieldsPresent}`);
    console.log(`RESULT_FIELDS_PRESENT_IN_FEATURES=false`);
  }

  console.log("test:mlb-independent-safe-a-materialization-v1 PASS");
  console.log(`FIXTURE_FEATURE_ROWS=${artifact.rows.length}`);
  console.log("DATASET_READY = false");
  console.log("INDEPENDENT_MODEL_SAMPLE = 0");
}

main();
