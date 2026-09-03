/**
 * 2023 MULTI-SEASON DEVELOPMENT TRACK — SAFE_A feature tests.
 * No network. No labels. No join. No model evaluation.
 *
 *   npm run test:mlb-independent-multiseason-safe-a-2023
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import { independentLabelArtifactPath } from "../src/lib/mlb/independent-label-v1";
import {
  independentSafeAFeatureArtifactPath,
  independentSafeAHistoricalSourcePath,
} from "../src/lib/mlb/independent-safe-a-v1/historical-source";
import { independentSplitArtifactPath } from "../src/lib/mlb/independent-split-v1";
import { independentLogisticModelPath } from "../src/lib/mlb/independent-logistic-v1";
import { independentLogisticV2aModelPath } from "../src/lib/mlb/independent-logistic-v2a";
import { independentLogisticV2bModelPath } from "../src/lib/mlb/independent-logistic-v2b";
import { independentLogisticV2cModelPath } from "../src/lib/mlb/independent-logistic-v2c";
import {
  MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
  MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1,
  isProhibitedFeatureKey,
  previousOfficialDate,
  validateIndependentFeatureArtifactV1,
  validateIndependentFeatureRowV1,
} from "../src/lib/mlb/independent-model-v1";
import {
  MLB_INDEPENDENT_2023_SEALED_CROSS_DATE_RESUME_CASES,
  MLB_INDEPENDENT_2023_SEALED_SOURCE_SHA256,
  POST_V2C_RESEARCH_DIRECTION_REVIEW_SHA256,
  SafeAMaterializationError,
  assertFeatureSourceIdentity2023,
  assertMultiseasonDevelopment2023SourcePin,
  buildMultiseasonDevelopmentSourceArtifact2023,
  findMultiseasonDevelopmentFeatureRow2023,
  hashIndependentFeatureRowV1,
  hashMultiseasonDevelopmentFeatureArtifact2023,
  independentMultiseasonDevelopment2023FeatureAuditPath,
  independentMultiseasonDevelopment2023FeaturePath,
  independentMultiseasonDevelopment2023SourcePath,
  materializeMultiseasonDevelopmentSafeAFeatures2023,
  validateHistoricalSourceIdentity,
  verifyFeatureHashes2023,
  type MultiseasonDevelopmentHistoricalGame2023,
} from "../src/lib/mlb/independent-multiseason-development-v1";

const ROOT = process.cwd();
const MAT_FILE = path.join(
  ROOT,
  "src/lib/mlb/independent-multiseason-development-v1/materialize-safe-a-2023.ts",
);
const MAT_SCRIPT = path.join(
  ROOT,
  "scripts/materialize-mlb-independent-multiseason-safe-a-2023.ts",
);
const V2C_DIR = path.join(ROOT, "src/lib/mlb/independent-logistic-v2c");
const DIRECTION_REVIEW_PATH = path.join(
  ROOT,
  "data/research/mlb/independent-model-v1/reviews/post-v2c-research-direction-review-v1.json",
);
const EVAL_2025_PATH = path.join(
  ROOT,
  "data/research/mlb/independent-model-v1/external-replication/2025/evaluations/2025-v2c-external-replication-evaluation-v1.json",
);
const JOIN_SHA =
  "6f9e0875d453fe52de8d56fef0a25427270989123df568020c8e1d0fdd417127";
const SPLIT_MANIFEST_SHA =
  "a72b8586971ee81a04e119c7d860f226abb503b5cc2341bb370d49d2fb47e71d";
const SOURCE_2024_SHA =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const FEATURE_2024_SHA =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_SHA =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const V1_CORE =
  "7cb5253c824de514c25b1715e6f339b0f35c6942fa25c178423a415ec820430e";
const V2A_CORE =
  "bef2104957768a40cbfecbeb3ff99946dce80a7155ab93a29248cc6fab576c9b";
const V2B_CORE =
  "f601594dcac1ae266424cf1a1503ecc1228099c2b1e090c634d54868f379c24e";
const V2C_CORE =
  "5412b6bae88e5d7fad53f8962950e4c9846470b14433e73edd9cbfe96631d126";
const EVAL_2025_SHA =
  "c361045407fde88688859e1e127f0c19c2f520b36fdec438862b208326fd55ee";

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function game(
  over: Partial<MultiseasonDevelopmentHistoricalGame2023> &
    Pick<
      MultiseasonDevelopmentHistoricalGame2023,
      "gamePk" | "officialDate" | "homeTeamId" | "awayTeamId"
    >,
): MultiseasonDevelopmentHistoricalGame2023 {
  const hour = 17 + (over.gamePk % 6);
  return {
    commenceTimeUtc: `${over.officialDate}T${String(hour).padStart(2, "0")}:05:00.000Z`,
    gameType: "R",
    abstractGameState: "Final",
    detailedState: "Final",
    codedGameState: "F",
    statusCode: "F",
    homeScore: 4,
    awayScore: 1,
    doubleHeader: "N",
    gameNumber: 1,
    ifNecessary: "N",
    safeResultApplyDate: null,
    resultProvenanceStatus: "NOT_APPLICABLE",
    ...over,
  };
}

function sourceFrom(games: MultiseasonDevelopmentHistoricalGame2023[]) {
  return buildMultiseasonDevelopmentSourceArtifact2023({
    games,
    collectedAt: "2026-09-03T00:00:00.000Z",
  });
}

function assertThrowsCode(fn: () => unknown, code: string, label: string): void {
  try {
    fn();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    assert.equal(
      err.code,
      code,
      `${label}: expected ${code}, got ${err.code} (${err.message})`,
    );
    return;
  }
  assert.fail(`${label}: expected throw ${code}`);
}

function listTsFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listTsFiles(full, acc);
    else if (entry.name.endsWith(".ts")) acc.push(full);
  }
  return acc;
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

function main(): void {
  assertThrowsCode(
    () => assertMultiseasonDevelopment2023SourcePin("0".repeat(64)),
    "SOURCE_SHA_PIN_MISMATCH",
    "source sha mismatch",
  );
  assertMultiseasonDevelopment2023SourcePin(MLB_INDEPENDENT_2023_SEALED_SOURCE_SHA256);
  console.log("SOURCE_SHA_PIN_MISMATCH_BLOCK = PASS");

  const base = sourceFrom([
    game({
      gamePk: 1,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
    }),
  ]);
  const wrongTrack = clone(base) as { track: string };
  wrongTrack.track = "2025_EXTERNAL_REPLICATION_TRACK";
  assertThrowsCode(
    () => materializeMultiseasonDevelopmentSafeAFeatures2023(wrongTrack as typeof base),
    "WRONG_TRACK",
    "wrong track",
  );
  console.log("WRONG_TRACK_BLOCK = PASS");

  const wrongSeason = clone(base) as { season: number };
  wrongSeason.season = 2024;
  assertThrowsCode(
    () => materializeMultiseasonDevelopmentSafeAFeatures2023(wrongSeason as typeof base),
    "WRONG_SEASON",
    "wrong season",
  );
  console.log("WRONG_SEASON_BLOCK = PASS");

  assertThrowsCode(
    () =>
      validateHistoricalSourceIdentity([
        game({
          gamePk: 9,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
        }),
        game({
          gamePk: 9,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
        }),
      ]),
    "DUPLICATE_GAME_PK",
    "duplicate gamePk",
  );
  console.log("DUPLICATE_GAMEPK_BLOCK = PASS");

  const sameDay = sourceFrom([
    game({
      gamePk: 1,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2023-04-01T17:05:00.000Z",
    }),
    game({
      gamePk: 2,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 119,
      homeScore: 1,
      awayScore: 0,
      commenceTimeUtc: "2023-04-01T20:10:00.000Z",
    }),
    game({
      gamePk: 3,
      officialDate: "2023-04-02",
      homeTeamId: 111,
      awayTeamId: 147,
      homeScore: 3,
      awayScore: 4,
      commenceTimeUtc: "2023-04-02T17:05:00.000Z",
    }),
  ]);
  const sameDayResult = materializeMultiseasonDevelopmentSafeAFeatures2023(sameDay, {
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  const r1 = findMultiseasonDevelopmentFeatureRow2023(sameDayResult.artifact, 1)!;
  const r2 = findMultiseasonDevelopmentFeatureRow2023(sameDayResult.artifact, 2)!;
  const r3 = findMultiseasonDevelopmentFeatureRow2023(sameDayResult.artifact, 3)!;
  assert.equal(r1.home.gamesPlayedBefore, 0);
  assert.equal(r1.home.winRateBefore, null);
  assert.equal(r1.home.last5WinsBefore, null);
  assert.equal(r1.home.restDaysBefore, null);
  assert.equal(r1.statsThroughDate, previousOfficialDate("2023-04-01"));
  assert.equal(r1.asOf, r1.statsThroughDate);
  assert.equal(r2.home.gamesPlayedBefore, 0);
  assert.equal(r2.home.winsBefore, 0);
  assert.equal(r2.headToHeadGamesBefore, 0);
  assert.equal(r3.away.gamesPlayedBefore, 2);
  assert.equal(r3.away.winsBefore, 2);
  assert.equal(MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1.every((k) => k in r1.home), true);
  assert.equal(MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1.every((k) => k in r1.away), true);
  assert.equal(MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1.length, 16);
  assert.equal(typeof r1.headToHeadGamesBefore, "number");
  assert.equal(sameDayResult.artifact.rows.length, 3);
  assert.equal(sameDayResult.excluded.length, 0);
  console.log("ZERO_HISTORY_NULL_SEMANTICS = PASS");
  console.log("D1_STATS_THROUGH_DATE = PASS");
  console.log("35_BASE_SIGNAL_CANONICAL_CONTRACT = PASS");
  console.log("SAME_DAY_FREEZE = PASS");
  console.log("SAME_DAY_LEAKAGE_BLOCK = PASS");

  const dh = sourceFrom([
    game({
      gamePk: 10,
      officialDate: "2023-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 4,
      awayScore: 1,
      commenceTimeUtc: "2023-04-10T17:05:00.000Z",
      doubleHeader: "Y",
      gameNumber: 1,
    }),
    game({
      gamePk: 11,
      officialDate: "2023-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 0,
      awayScore: 5,
      commenceTimeUtc: "2023-04-10T21:10:00.000Z",
      doubleHeader: "Y",
      gameNumber: 2,
    }),
    game({
      gamePk: 12,
      officialDate: "2023-04-11",
      homeTeamId: 147,
      awayTeamId: 119,
      homeScore: 2,
      awayScore: 1,
      commenceTimeUtc: "2023-04-11T17:05:00.000Z",
    }),
  ]);
  const dhResult = materializeMultiseasonDevelopmentSafeAFeatures2023(dh);
  const dh1 = findMultiseasonDevelopmentFeatureRow2023(dhResult.artifact, 10)!;
  const dh2 = findMultiseasonDevelopmentFeatureRow2023(dhResult.artifact, 11)!;
  const dh3 = findMultiseasonDevelopmentFeatureRow2023(dhResult.artifact, 12)!;
  assert.equal(dh1.home.gamesPlayedBefore, dh2.home.gamesPlayedBefore);
  assert.equal(dh1.home.winsBefore, dh2.home.winsBefore);
  assert.equal(dh1.headToHeadGamesBefore, dh2.headToHeadGamesBefore);
  assert.equal(dh3.home.gamesPlayedBefore, 2);
  assert.equal(dhResult.audit.doubleHeaderGameCount, 2);
  console.log("DOUBLEHEADER_FREEZE = PASS");
  console.log("SAME_DAY_DOUBLEHEADER_RESULT_USED = NO");

  const resume = sourceFrom([
    game({
      gamePk: 9001,
      officialDate: "2023-06-01",
      homeTeamId: 111,
      awayTeamId: 141,
      homeScore: 1,
      awayScore: 4,
      commenceTimeUtc: "2023-06-01T23:10:00.000Z",
      resumeDate: "2023-08-01T18:05:00.000Z",
      resumeGameDate: "2023-08-01",
    }),
    game({
      gamePk: 9001,
      officialDate: "2023-06-01",
      homeTeamId: 111,
      awayTeamId: 141,
      homeScore: 1,
      awayScore: 4,
      commenceTimeUtc: "2023-08-01T18:05:00.000Z",
      resumedFrom: "2023-06-01T23:10:00.000Z",
      resumedFromDate: "2023-06-01",
    }),
    game({
      gamePk: 9002,
      officialDate: "2023-06-02",
      homeTeamId: 111,
      awayTeamId: 147,
      homeScore: 5,
      awayScore: 1,
      commenceTimeUtc: "2023-06-02T17:05:00.000Z",
    }),
    game({
      gamePk: 9003,
      officialDate: "2023-08-01",
      homeTeamId: 111,
      awayTeamId: 137,
      homeScore: 2,
      awayScore: 0,
      commenceTimeUtc: "2023-08-01T17:05:00.000Z",
    }),
    game({
      gamePk: 9004,
      officialDate: "2023-08-02",
      homeTeamId: 111,
      awayTeamId: 119,
      homeScore: 3,
      awayScore: 2,
      commenceTimeUtc: "2023-08-02T17:05:00.000Z",
    }),
  ]);
  const resumeMat = materializeMultiseasonDevelopmentSafeAFeatures2023(resume);
  const orig = findMultiseasonDevelopmentFeatureRow2023(resumeMat.artifact, 9001)!;
  const nextOrig = findMultiseasonDevelopmentFeatureRow2023(resumeMat.artifact, 9002)!;
  const applyDay = findMultiseasonDevelopmentFeatureRow2023(resumeMat.artifact, 9003)!;
  const afterApply = findMultiseasonDevelopmentFeatureRow2023(resumeMat.artifact, 9004)!;
  assert.equal(orig.identity.officialDate, "2023-06-01");
  assert.equal(orig.home.gamesPlayedBefore, 0);
  assert.equal(nextOrig.home.gamesPlayedBefore, 0);
  assert.equal(applyDay.home.gamesPlayedBefore, 1);
  assert.equal(applyDay.home.winsBefore, 1);
  assert.equal(applyDay.home.lossesBefore, 0);
  assert.equal(afterApply.home.gamesPlayedBefore, 3);
  assert.equal(afterApply.home.winsBefore, 2);
  assert.equal(afterApply.home.lossesBefore, 1);
  console.log("CROSS_DATE_ORIGINAL_DATE_RESULT_APPLY = NO");
  console.log("CROSS_DATE_APPLY_DATE_FREEZE = PASS");
  console.log("NEXT_DATE_RESULT_AVAILABILITY = PASS");

  const lateResume = sourceFrom([
    game({
      gamePk: 50,
      officialDate: "2023-09-27",
      homeTeamId: 121,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 1,
      commenceTimeUtc: "2023-09-27T17:10:00.000Z",
    }),
    game({
      gamePk: 716404,
      officialDate: "2023-09-28",
      homeTeamId: 121,
      awayTeamId: 146,
      homeScore: 1,
      awayScore: 0,
      commenceTimeUtc: "2023-09-28T23:10:00.000Z",
      resumeDate: "2023-10-02T17:10:00.000Z",
      resumeGameDate: "2023-10-02",
    }),
    game({
      gamePk: 716404,
      officialDate: "2023-09-28",
      homeTeamId: 121,
      awayTeamId: 146,
      homeScore: 1,
      awayScore: 0,
      commenceTimeUtc: "2023-10-02T17:10:00.000Z",
      resumedFrom: "2023-09-28T23:10:00.000Z",
      resumedFromDate: "2023-09-28",
    }),
    game({
      gamePk: 51,
      officialDate: "2023-09-29",
      homeTeamId: 121,
      awayTeamId: 111,
      homeScore: 2,
      awayScore: 1,
      commenceTimeUtc: "2023-09-29T17:10:00.000Z",
    }),
    game({
      gamePk: 52,
      officialDate: "2023-09-30",
      homeTeamId: 121,
      awayTeamId: 111,
      homeScore: 3,
      awayScore: 1,
      commenceTimeUtc: "2023-09-30T17:10:00.000Z",
    }),
    game({
      gamePk: 53,
      officialDate: "2023-10-01",
      homeTeamId: 121,
      awayTeamId: 111,
      homeScore: 4,
      awayScore: 1,
      commenceTimeUtc: "2023-10-01T17:10:00.000Z",
    }),
    game({
      gamePk: 54,
      officialDate: "2023-10-02",
      homeTeamId: 121,
      awayTeamId: 111,
      homeScore: 6,
      awayScore: 1,
      commenceTimeUtc: "2023-10-02T20:10:00.000Z",
    }),
    game({
      gamePk: 55,
      officialDate: "2023-10-03",
      homeTeamId: 121,
      awayTeamId: 111,
      homeScore: 7,
      awayScore: 1,
      commenceTimeUtc: "2023-10-03T17:10:00.000Z",
    }),
  ]);
  const lateMat = materializeMultiseasonDevelopmentSafeAFeatures2023(lateResume);
  const late404 = findMultiseasonDevelopmentFeatureRow2023(lateMat.artifact, 716404)!;
  assert.equal(late404.identity.officialDate, "2023-09-28");
  assert.equal(late404.identity.homeTeamId, 121);
  assert.equal(late404.identity.awayTeamId, 146);
  assert.equal(
    findMultiseasonDevelopmentFeatureRow2023(lateMat.artifact, 51)!.home.gamesPlayedBefore,
    1,
  );
  assert.equal(
    findMultiseasonDevelopmentFeatureRow2023(lateMat.artifact, 52)!.home.gamesPlayedBefore,
    2,
  );
  assert.equal(
    findMultiseasonDevelopmentFeatureRow2023(lateMat.artifact, 53)!.home.gamesPlayedBefore,
    3,
  );
  assert.equal(
    findMultiseasonDevelopmentFeatureRow2023(lateMat.artifact, 54)!.home.gamesPlayedBefore,
    4,
  );
  assert.equal(
    findMultiseasonDevelopmentFeatureRow2023(lateMat.artifact, 55)!.home.gamesPlayedBefore,
    6,
  );
  console.log("716404_CANNOT_APPLY_BEFORE_2023_10_02 = PASS");

  const shuffled = sourceFrom(shuffle(resume.games));
  const shuffledMat = materializeMultiseasonDevelopmentSafeAFeatures2023(shuffled, {
    generatedAt: "2026-09-03T12:00:00.000Z",
  });
  assert.equal(shuffledMat.artifact.rows.length, resumeMat.artifact.rows.length);
  for (let i = 0; i < resumeMat.artifact.rows.length; i += 1) {
    assert.deepEqual(shuffledMat.artifact.rows[i], resumeMat.artifact.rows[i]);
  }
  console.log("SHUFFLED_SOURCE_ROWS_FEATURE_RESULT_IDENTICAL = PASS");

  for (const row of sameDayResult.artifact.rows) {
    const srcRow = sameDay.games.find((g) => g.gamePk === row.identity.gamePk)!;
    assert.equal(row.identity.officialDate, srcRow.officialDate);
    assert.equal(row.identity.homeTeamId, srcRow.homeTeamId);
    assert.equal(row.identity.awayTeamId, srcRow.awayTeamId);
    assert.equal(row.identity.commenceTimeUtc, srcRow.commenceTimeUtc);
    assert.equal(hashIndependentFeatureRowV1(row), row.featureHash);
    assert.equal(validateIndependentFeatureRowV1(row).ok, true);
  }
  assert.equal(validateIndependentFeatureArtifactV1(sameDayResult.artifact).ok, true);
  assert.equal(sameDayResult.artifact.schemaVersion, MLB_INDEPENDENT_FEATURE_SCHEMA_V1);
  assert.equal(assertFeatureSourceIdentity2023(sameDay, sameDayResult.artifact), 0);
  console.log("SOURCE_IDENTITY_PRESERVED = PASS");
  console.log("FEATURE_HASH_RECOMPUTATION = PASS");

  const tamperedIdentity = clone(sameDayResult.artifact);
  tamperedIdentity.rows[0]!.identity.officialDate = "1999-01-01";
  assertThrowsCode(
    () => assertFeatureSourceIdentity2023(sameDay, tamperedIdentity),
    "IDENTITY_MISMATCH",
    "identity mismatch",
  );
  console.log("IDENTITY_MISMATCH_BLOCK = PASS");

  const tamperedHash = clone(sameDayResult.artifact);
  tamperedHash.rows[0]!.featureHash = "0".repeat(64);
  assert.equal(verifyFeatureHashes2023(tamperedHash).featureHashMismatchCount, 1);
  console.log("FEATURE_HASH_MISMATCH_BLOCK = PASS");

  walkKeys(sameDayResult.artifact, (key) => {
    assert.equal(isProhibitedFeatureKey(key), false, key);
    const token = key.toLowerCase();
    assert.equal(
      token === "odds" ||
        token === "market" ||
        token === "winner" ||
        token === "result" ||
        token === "homescore" ||
        token === "awayscore",
      false,
      key,
    );
  });
  console.log("MARKET_RESULT_FIELD_LEAKAGE_BLOCK = PASS");

  assert.equal(sameDayResult.audit.finalRollingStateMatchesSource, true);
  assert.equal(sameDayResult.audit.teamRollingMismatchCount, 0);
  console.log("ROLLING_TEAM_RECONCILIATION = PASS");

  const directionSha = sha256File(DIRECTION_REVIEW_PATH);
  assert.equal(directionSha, POST_V2C_RESEARCH_DIRECTION_REVIEW_SHA256);
  const directionReview = JSON.parse(readFileSync(DIRECTION_REVIEW_PATH, "utf8")) as {
    v2cCycleStatus: string;
    recommendedStrategy: string;
    nextSourceFoundationCandidate: string;
    newModelTrainingAllowedNow: boolean;
  };
  assert.equal(directionReview.v2cCycleStatus, "CLOSED");
  assert.equal(
    directionReview.recommendedStrategy,
    "MULTI_SEASON_EVIDENCE_PLUS_PREGAME_SAFE_FEATURE_EXPANSION",
  );
  assert.equal(directionReview.nextSourceFoundationCandidate, "2023_MLB_REGULAR_SEASON");
  assert.equal(directionReview.newModelTrainingAllowedNow, false);
  console.log("RESEARCH_DIRECTION_PIN = PASS");

  assert.equal(sha256File(EVAL_2025_PATH), EVAL_2025_SHA);
  console.log("2025_EXTERNAL_REPLICATION_STATE = EXTERNAL_REPLICATION_EXPOSED");
  console.log("2025_ROWS_INSPECTED = NO");

  const split = JSON.parse(readFileSync(independentSplitArtifactPath(), "utf8")) as {
    holdoutGamePks: number[];
    splitManifestHash: string;
  };
  const joinBefore = sha256File(independentJoinArtifactPath());
  const splitBefore = sha256File(independentSplitArtifactPath());
  const source2024Before = sha256File(independentSafeAHistoricalSourcePath());
  const featureBefore = sha256File(independentSafeAFeatureArtifactPath());
  const labelBefore = sha256File(independentLabelArtifactPath());
  const v1ModelPath = independentLogisticModelPath();
  const v2aModelPath = independentLogisticV2aModelPath();
  const v2bModelPath = independentLogisticV2bModelPath();
  const v2cModelPath = independentLogisticV2cModelPath();
  const v1FileBefore = sha256File(v1ModelPath);
  const v2aFileBefore = sha256File(v2aModelPath);
  const v2bFileBefore = sha256File(v2bModelPath);
  const v2cFileBefore = sha256File(v2cModelPath);
  const v1Model = JSON.parse(readFileSync(v1ModelPath, "utf8")) as { modelCoreHash: string };
  const v2aModel = JSON.parse(readFileSync(v2aModelPath, "utf8")) as { modelCoreHash: string };
  const v2bModel = JSON.parse(readFileSync(v2bModelPath, "utf8")) as { modelCoreHash: string };
  const v2cModel = JSON.parse(readFileSync(v2cModelPath, "utf8")) as { modelCoreHash: string };
  assert.equal(joinBefore, JOIN_SHA);
  assert.equal(split.splitManifestHash, SPLIT_MANIFEST_SHA);
  assert.equal(split.holdoutGamePks.length, 483);
  assert.equal(source2024Before, SOURCE_2024_SHA);
  assert.equal(featureBefore, FEATURE_2024_SHA);
  assert.equal(labelBefore, LABEL_SHA);
  assert.equal(v1Model.modelCoreHash, V1_CORE);
  assert.equal(v2aModel.modelCoreHash, V2A_CORE);
  assert.equal(v2bModel.modelCoreHash, V2B_CORE);
  assert.equal(v2cModel.modelCoreHash, V2C_CORE);
  console.log("ALL_SEALED_INPUTS_UNCHANGED = PASS");
  console.log("2024_HOLDOUT_MEMBERSHIP_COUNT = 483");

  for (const filePath of listTsFiles(V2C_DIR)) {
    const text = readFileSync(filePath, "utf8");
    assert.equal(text.includes("independent-multiseason-development"), false);
    assert.equal(text.includes("2023-safe-a-feature-artifact-v1"), false);
  }
  console.log("V2C_READ_2023_SOURCE = NO");

  for (const filePath of [MAT_FILE, MAT_SCRIPT]) {
    const text = readFileSync(filePath, "utf8");
    assert.equal(text.includes("independent-logistic-v1"), false);
    assert.equal(text.includes("independent-logistic-v2a"), false);
    assert.equal(text.includes("independent-logistic-v2b"), false);
    assert.equal(text.includes("independent-logistic-v2c"), false);
    assert.equal(text.includes("independent-label-v1"), false);
    assert.equal(text.includes("independent-join-v1"), false);
    assert.equal(text.includes("getRawStatsJson"), false);
    assert.equal(text.includes("statsapi.mlb.com"), false);
    assert.equal(text.includes("holdoutGamePks"), false);
    assert.equal(text.includes("independent-external-replication-v1"), false);
  }
  console.log("NO_MODEL_IMPORTS = PASS");
  console.log("NO_LABELS = PASS");
  console.log("NO_JOIN = PASS");
  console.log("NETWORK_USED = NO");

  if (existsSync(independentMultiseasonDevelopment2023FeaturePath())) {
    const persisted = JSON.parse(
      readFileSync(independentMultiseasonDevelopment2023FeaturePath(), "utf8"),
    );
    const source = JSON.parse(
      readFileSync(independentMultiseasonDevelopment2023SourcePath(), "utf8"),
    );
    assert.equal(validateIndependentFeatureArtifactV1(persisted).ok, true);
    assert.equal(persisted.rows.length, source.rowCount);
    assert.equal(source.rowCount, 2430);
    assert.equal(verifyFeatureHashes2023(persisted).featureHashMismatchCount, 0);
    assert.equal(assertFeatureSourceIdentity2023(source, persisted), 0);
    const fileSha = sha256File(independentMultiseasonDevelopment2023FeaturePath());
    assert.equal(fileSha, hashMultiseasonDevelopmentFeatureArtifact2023(persisted));
    for (const sealed of MLB_INDEPENDENT_2023_SEALED_CROSS_DATE_RESUME_CASES) {
      const row = findMultiseasonDevelopmentFeatureRow2023(persisted, sealed.gamePk);
      assert.ok(row, `missing sealed resume ${sealed.gamePk}`);
      assert.equal(row!.identity.officialDate, sealed.officialDate);
    }
    if (existsSync(independentMultiseasonDevelopment2023FeatureAuditPath())) {
      const audit = JSON.parse(
        readFileSync(independentMultiseasonDevelopment2023FeatureAuditPath(), "utf8"),
      );
      assert.equal(audit.track, "MULTI_SEASON_DEVELOPMENT_TRACK");
      assert.equal(audit.stage, "SAFE_A_FEATURES");
      assert.equal(audit.season, 2023);
      assert.equal(audit.developmentEvidence, true);
      assert.equal(audit.externalReplication, false);
      assert.equal(audit.sourceShaVerified, true);
      assert.equal(audit.sourceRows, 2430);
      assert.equal(audit.featureRows, 2430);
      assert.equal(audit.excludedRows, 0);
      assert.equal(audit.sameDayResultUsed, false);
      assert.equal(audit.targetResultUsed, false);
      assert.equal(audit.futureResultUsed, false);
      assert.equal(audit.crossDateOriginalDateResultUsed, false);
      assert.equal(audit.temporalViolationCount, 0);
      assert.equal(audit.featureHashVerifiedCount, 2430);
      assert.equal(audit.featureHashMismatchCount, 0);
      assert.equal(audit.identityMismatchCount, 0);
      assert.equal(audit.marketFieldsPresent, false);
      assert.equal(audit.resultFieldsPresentInX, false);
      assert.equal(audit.previousSeasonHistoryUsed, false);
      assert.equal(audit.modelRead, false);
      assert.equal(audit.labelsCreated, false);
      assert.equal(audit.joinCreated, false);
      assert.equal(audit.holdoutEvaluated, false);
      assert.equal(audit.engineAdmission, "PROHIBITED");
      assert.equal(audit.sourceArtifactSha256, MLB_INDEPENDENT_2023_SEALED_SOURCE_SHA256);
      assert.equal(audit.featureArtifactSha256, fileSha);
      assert.equal(audit.networkUsed, false);
      assert.equal(audit["2025RowsInspected"], false);
    }
  }

  assert.equal(sha256File(independentJoinArtifactPath()), joinBefore);
  assert.equal(sha256File(independentSplitArtifactPath()), splitBefore);
  assert.equal(sha256File(independentSafeAHistoricalSourcePath()), source2024Before);
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), featureBefore);
  assert.equal(sha256File(independentLabelArtifactPath()), labelBefore);
  assert.equal(sha256File(v1ModelPath), v1FileBefore);
  assert.equal(sha256File(v2aModelPath), v2aFileBefore);
  assert.equal(sha256File(v2bModelPath), v2bFileBefore);
  assert.equal(sha256File(v2cModelPath), v2cFileBefore);

  console.log("test:mlb-independent-multiseason-safe-a-2023 PASS");
}

main();
