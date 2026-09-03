/**
 * 2023 MULTI-SEASON DEVELOPMENT TRACK — historical source tests.
 * No network. No features, labels, join, training, or model evaluation.
 *
 *   npm run test:mlb-independent-multiseason-source-2023
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
  MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK,
  MLB_INDEPENDENT_MULTISEASON_GAME_TYPE_V1,
  MLB_INDEPENDENT_MULTISEASON_SEASON_2023,
  MLB_INDEPENDENT_MULTISEASON_SOURCE_ORIGIN,
  MLB_INDEPENDENT_MULTISEASON_SOURCE_QUERY_2023,
  MLB_INDEPENDENT_MULTISEASON_SOURCE_SCHEMA_V1,
  MLB_INDEPENDENT_MULTISEASON_SPORT_ID_V1,
  POST_V2C_RESEARCH_DIRECTION_REVIEW_SHA256,
  SafeAHistoricalSourceError,
  buildMultiseasonDevelopmentSourceArtifact2023,
  canonicalMultiseasonDevelopmentGamesFingerprint,
  classifySourceStatus,
  collapseSameGamePkSnapshots,
  hashMultiseasonDevelopmentSourceArtifact2023,
  independentMultiseasonDevelopment2023AuditPath,
  independentMultiseasonDevelopment2023SourcePath,
  listMultiseasonDevelopmentManualReviewGames2023,
  parseMlbScheduleBodyToHistoricalGames,
  summarizeMultiseasonDevelopmentCompleteness2023,
  validateHistoricalSourceIdentity,
  validateHistoricalSourceResultProvenance,
  validateMultiseasonDevelopmentSourceArtifact2023,
  type MultiseasonDevelopmentHistoricalGame2023,
} from "../src/lib/mlb/independent-multiseason-development-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(
  ROOT,
  "src/lib/mlb/independent-multiseason-development-v1",
);
const COLLECT_SCRIPT = path.join(
  ROOT,
  "scripts/collect-mlb-independent-multiseason-source-2023.ts",
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
const SOURCE_2025_PATH = path.join(
  ROOT,
  "data/research/mlb/independent-model-v1/external-replication/2025/historical-source/2025-regular-season-source-v1.json",
);
const JOIN_SHA =
  "6f9e0875d453fe52de8d56fef0a25427270989123df568020c8e1d0fdd417127";
const SPLIT_MANIFEST_SHA =
  "a72b8586971ee81a04e119c7d860f226abb503b5cc2341bb370d49d2fb47e71d";
const SOURCE_2024_SHA =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";
const FEATURE_SHA =
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
const SOURCE_2025_SHA =
  "4388e62e9e8d91d43cfbc3f1dbdd0a38cb6f13006e4444d44ae88f595ce3ea77";
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

function rawScheduleGame(input: {
  gamePk: number;
  officialDate: string;
  gameDate: string;
  homeTeamId: number;
  awayTeamId: number;
  gameType?: string;
  homeScore?: number;
  awayScore?: number;
  abstractGameState?: string;
  detailedState?: string;
  codedGameState?: string;
  resumeDate?: string;
  resumedFrom?: string;
  resumeGameDate?: string;
  resumedFromDate?: string;
}): Record<string, unknown> {
  const row: Record<string, unknown> = {
    gamePk: input.gamePk,
    gameType: input.gameType ?? "R",
    officialDate: input.officialDate,
    gameDate: input.gameDate,
    doubleHeader: "N",
    gameNumber: 1,
    status: {
      abstractGameState: input.abstractGameState ?? "Final",
      detailedState: input.detailedState ?? "Final",
      codedGameState: input.codedGameState ?? "F",
      statusCode: "F",
    },
    teams: {
      home: {
        team: { id: input.homeTeamId },
        score: input.homeScore ?? 3,
      },
      away: {
        team: { id: input.awayTeamId },
        score: input.awayScore ?? 1,
      },
    },
  };
  if (input.resumeDate) row.resumeDate = input.resumeDate;
  if (input.resumedFrom) row.resumedFrom = input.resumedFrom;
  if (input.resumeGameDate) row.resumeGameDate = input.resumeGameDate;
  if (input.resumedFromDate) row.resumedFromDate = input.resumedFromDate;
  return row;
}

function scanForbidden(text: string, filePath: string): void {
  assert.equal(
    text.includes("independent-logistic-v1"),
    false,
    `${filePath} imports v1 logistic`,
  );
  assert.equal(
    text.includes("independent-logistic-v2a"),
    false,
    `${filePath} imports v2-A`,
  );
  assert.equal(
    text.includes("independent-logistic-v2b"),
    false,
    `${filePath} imports v2-B`,
  );
  assert.equal(
    text.includes("independent-logistic-v2c"),
    false,
    `${filePath} imports v2-C`,
  );
  assert.equal(
    text.includes("evaluate-v2c"),
    false,
    `${filePath} imports 2025 evaluation`,
  );
  assert.equal(
    text.includes("independent-external-replication-v1"),
    false,
    `${filePath} imports 2025 external replication`,
  );
  assert.equal(text.includes("materializeIndependentSafeA"), false);
  assert.equal(/odds|implied/i.test(text), false, `${filePath} odds tokens`);
  assert.equal(
    /\bmarket\b/i.test(text.replaceAll("marketUsed", "")),
    false,
    `${filePath} market tokens`,
  );
  assert.equal(text.includes("holdoutGamePks"), false);
  assert.equal(text.includes("2430"), false, `${filePath} hardcodes 2430`);
}

function main(): void {
  assert.equal(
    MLB_INDEPENDENT_MULTISEASON_SOURCE_SCHEMA_V1,
    "mlb-independent-multiseason-development-source-v1",
  );
  assert.equal(MLB_INDEPENDENT_MULTISEASON_SOURCE_ORIGIN, "MLB_STATS_API");
  assert.equal(MLB_INDEPENDENT_MULTISEASON_SEASON_2023, 2023);
  assert.equal(MLB_INDEPENDENT_MULTISEASON_GAME_TYPE_V1, "R");
  assert.equal(MLB_INDEPENDENT_MULTISEASON_SPORT_ID_V1, 1);
  assert.equal(
    MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK,
    "MULTI_SEASON_DEVELOPMENT_TRACK",
  );
  assert.equal(
    MLB_INDEPENDENT_MULTISEASON_SOURCE_QUERY_2023,
    "/api/v1/schedule?sportId=1&startDate=2023-03-01&endDate=2023-11-15&gameType=R",
  );
  console.log("2023_SEASON_CONTRACT = PASS");
  console.log("OFFICIAL_SOURCE_ONLY = PASS");
  console.log("QUERY_EXACT = PASS");
  console.log("REGULAR_SEASON_ONLY_CONTRACT = PASS");
  console.log("TRACK_SEPARATION = PASS");

  const body = {
    dates: [
      {
        games: [
          rawScheduleGame({
            gamePk: 1,
            officialDate: "2023-04-01",
            gameDate: "2023-04-01T17:05:00.000Z",
            homeTeamId: 147,
            awayTeamId: 111,
            gameType: "S",
          }),
          rawScheduleGame({
            gamePk: 2,
            officialDate: "2023-04-01",
            gameDate: "2023-04-01T18:10:00.000Z",
            homeTeamId: 147,
            awayTeamId: 111,
          }),
          rawScheduleGame({
            gamePk: 3,
            officialDate: "2023-04-02",
            gameDate: "2023-04-02T23:10:00.000Z",
            homeTeamId: 119,
            awayTeamId: 137,
            abstractGameState: "Preview",
            detailedState: "Scheduled",
            codedGameState: "S",
            homeScore: 0,
            awayScore: 0,
          }),
        ],
      },
    ],
  };
  const parsed = parseMlbScheduleBodyToHistoricalGames(body);
  assert.equal(parsed.some((g) => g.gameType !== "R"), false);
  assert.equal(parsed.some((g) => g.gamePk === 1), false);
  assert.equal(parsed.map((g) => g.gamePk).sort().join(","), "2,3");
  console.log("REGULAR_SEASON_ONLY = PASS");

  const postponedThenFinal = sourceFrom([
    game({
      gamePk: 8801,
      officialDate: "2023-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      abstractGameState: "Final",
      detailedState: "Postponed",
      codedGameState: "N",
      homeScore: null,
      awayScore: null,
      rescheduleDate: "2023-04-11T17:05:00.000Z",
      rescheduleGameDate: "2023-04-11",
    }),
    game({
      gamePk: 8801,
      officialDate: "2023-04-11",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2023-04-11T17:05:00.000Z",
      rescheduledFrom: "2023-04-10T17:05:00.000Z",
    }),
  ]);
  assert.equal(postponedThenFinal.games.length, 1);
  assert.equal(postponedThenFinal.rawSnapshotCount, 2);
  assert.equal(postponedThenFinal.collapsedSameGamePkCount, 1);
  assert.equal(
    postponedThenFinal.rawSnapshotCount -
      postponedThenFinal.collapsedSameGamePkCount,
    postponedThenFinal.games.length,
  );
  assert.equal(postponedThenFinal.games[0]!.gamePk, 8801);
  assert.equal(postponedThenFinal.games[0]!.officialDate, "2023-04-11");
  assert.equal(postponedThenFinal.games[0]!.resultProvenanceStatus, "STANDARD");
  assert.equal(postponedThenFinal.games[0]!.safeResultApplyDate, "2023-04-11");
  console.log("SAME_GAMEPK_COLLAPSE = PASS");
  console.log("COLLAPSE_RECONCILIATION = PASS");

  assertThrowsCode(
    () =>
      validateHistoricalSourceIdentity([
        game({
          gamePk: 0,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
        }),
      ]),
    "INVALID_IDENTITY",
    "invalid gamePk",
  );
  console.log("INVALID_GAMEPK_REJECTION = PASS");

  assertThrowsCode(
    () =>
      validateHistoricalSourceIdentity([
        game({
          gamePk: 9107,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
        }),
        game({
          gamePk: 9107,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
        }),
      ]),
    "DUPLICATE_GAME_PK",
    "duplicate final gamePk",
  );
  console.log("DUPLICATE_FINAL_GAMEPK_REJECTION = PASS");

  assertThrowsCode(
    () =>
      validateHistoricalSourceIdentity([
        game({
          gamePk: 9109,
          officialDate: "2023-04-01",
          homeTeamId: -5,
          awayTeamId: 111,
        }),
      ]),
    "INVALID_TEAM_ID",
    "invalid team id",
  );
  console.log("INVALID_TEAM_ID_REJECTION = PASS");

  assertThrowsCode(
    () =>
      validateHistoricalSourceIdentity([
        game({
          gamePk: 9110,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 147,
        }),
      ]),
    "HOME_AWAY_TEAM_ID_EQUAL",
    "home equals away",
  );
  console.log("HOME_AWAY_TEAM_ID_EQUAL_REJECTION = PASS");

  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9101,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
        }),
        game({
          gamePk: 9101,
          officialDate: "2023-04-01",
          homeTeamId: 199,
          awayTeamId: 111,
        }),
      ]),
    "TEAM_IDENTITY_MISMATCH",
    "identity mismatch",
  );
  console.log("IDENTITY_MISMATCH_REJECTION = PASS");

  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9108,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
          homeScore: 3,
          awayScore: 1,
        }),
        game({
          gamePk: 9108,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
          homeScore: 0,
          awayScore: 4,
        }),
      ]),
    "DUPLICATE_GAME_PK",
    "conflicting final scores",
  );
  console.log("CONFLICTING_FINAL_SCORE_REJECTION = PASS");

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
  ]);
  assert.equal(resume.games[0]!.resultProvenanceStatus, "CROSS_DATE_RESUME_RESOLVED");
  assert.equal(resume.games[0]!.safeResultApplyDate, "2023-08-01");
  assert.equal(resume.games[0]!.officialDate, "2023-06-01");
  assert.ok(resume.games[0]!.safeResultApplyDate! > resume.games[0]!.officialDate);
  assert.equal(resume.games[0]!.resumeGameDate, "2023-08-01");
  const resumeReview = listMultiseasonDevelopmentManualReviewGames2023(resume.games);
  assert.equal(resumeReview[0]!.reviewNote, "CROSS_DATE_RESUME_RESOLVED");
  assert.equal(resumeReview[0]!.commenceTimeUtc, resume.games[0]!.commenceTimeUtc);
  console.log("RESUME_PROVENANCE_RESOLUTION = PASS");

  const unproven = sourceFrom([
    game({
      gamePk: 9002,
      officialDate: "2023-06-01",
      homeTeamId: 111,
      awayTeamId: 141,
      homeScore: 1,
      awayScore: 4,
      resumeGameDate: "2023-08-01",
    }),
  ]);
  assert.equal(unproven.games[0]!.resultProvenanceStatus, "UNPROVEN_COMPLETION");
  assert.equal(unproven.games[0]!.safeResultApplyDate, null);
  console.log("UNPROVEN_RESUME_CLASSIFICATION = PASS");

  const unsafeApply = [
    game({
      gamePk: 9201,
      officialDate: "2023-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      safeResultApplyDate: "2023-04-09",
      resultProvenanceStatus: "STANDARD",
    }),
  ];
  assertThrowsCode(
    () => validateHistoricalSourceResultProvenance(unsafeApply),
    "RESULT_APPLY_DATE_BEFORE_OFFICIAL_DATE",
    "unsafe cross-date result application",
  );
  console.log("UNSAFE_CROSS_DATE_RESULT_APPLICATION_REJECTION = PASS");

  const cancelledApply = [
    game({
      gamePk: 9202,
      officialDate: "2023-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      abstractGameState: "Final",
      detailedState: "Cancelled",
      codedGameState: "C",
      homeScore: null,
      awayScore: null,
      safeResultApplyDate: "2023-04-10",
      resultProvenanceStatus: "NOT_APPLICABLE",
    }),
  ];
  assertThrowsCode(
    () => validateHistoricalSourceResultProvenance(cancelledApply),
    "UNSAFE_RESULT_APPLY_ON_NON_FINAL",
    "cancelled apply-date",
  );
  console.log("CANCELLED_APPLY_DATE_REJECTION = PASS");

  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9301,
          officialDate: "2023-02-31",
          homeTeamId: 147,
          awayTeamId: 111,
        }),
      ]),
    "MALFORMED_OFFICIAL_DATE",
    "malformed officialDate",
  );
  console.log("MALFORMED_OFFICIAL_DATE_REJECTION = PASS");

  assertThrowsCode(
    () =>
      validateHistoricalSourceIdentity([
        game({
          gamePk: 9302,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
          commenceTimeUtc: "not-an-instant",
        }),
      ]),
    "MALFORMED_COMMENCE_TIME_UTC",
    "malformed commence time",
  );
  console.log("MALFORMED_COMMENCE_TIME_REJECTION = PASS");

  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9303,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
          homeScore: -1,
        }),
      ]),
    "NEGATIVE_SCORE",
    "negative score",
  );
  console.log("NEGATIVE_SCORE_REJECTION = PASS");

  assertThrowsCode(
    () =>
      sourceFrom([
        game({
          gamePk: 9304,
          officialDate: "2023-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
          homeScore: 1.5,
        }),
      ]),
    "NEGATIVE_SCORE",
    "malformed score",
  );
  console.log("MALFORMED_SCORE_REJECTION = PASS");

  const tied = sourceFrom([
    game({
      gamePk: 9305,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 3,
      awayScore: 3,
    }),
  ]);
  assert.equal(tied.games[0]!.resultProvenanceStatus, "NOT_APPLICABLE");
  assert.equal(tied.games[0]!.safeResultApplyDate, null);
  const tiedSummary = summarizeMultiseasonDevelopmentCompleteness2023({
    rawScheduleSnapshotCount: 1,
    artifact: tied,
  });
  assert.equal(tiedSummary.tiedFinalCount, 1);
  assert.equal(tiedSummary.validNonTiedFinalResultCount, 0);
  assert.equal(tiedSummary.unusableFinalResultCount, 1);
  console.log("TIED_FINAL_SOURCE_AUDIT = PASS");

  const counted = sourceFrom([
    game({
      gamePk: 11,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
    }),
    game({
      gamePk: 12,
      officialDate: "2023-04-02",
      homeTeamId: 111,
      awayTeamId: 147,
    }),
  ]);
  assert.equal(counted.rowCount, counted.games.length);
  const badCount = clone(counted);
  badCount.rowCount = counted.games.length + 1;
  assertThrowsCode(
    () => validateMultiseasonDevelopmentSourceArtifact2023(badCount),
    "INVALID_SOURCE_ARTIFACT",
    "rowCount reconciliation",
  );
  const badCollapse = clone(counted);
  badCollapse.collapsedSameGamePkCount = 9;
  assertThrowsCode(
    () => validateMultiseasonDevelopmentSourceArtifact2023(badCollapse),
    "COLLAPSE_COUNT_MISMATCH",
    "collapse mismatch",
  );
  console.log("ROWCOUNT_RECONCILIATION = PASS");

  const rawRows = [
    game({
      gamePk: 8801,
      officialDate: "2023-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      abstractGameState: "Final",
      detailedState: "Postponed",
      codedGameState: "N",
      homeScore: null,
      awayScore: null,
      commenceTimeUtc: "2023-04-10T17:05:00.000Z",
    }),
    game({
      gamePk: 8801,
      officialDate: "2023-04-11",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2023-04-11T17:05:00.000Z",
    }),
    game({
      gamePk: 8802,
      officialDate: "2023-04-12",
      homeTeamId: 119,
      awayTeamId: 137,
      homeScore: 2,
      awayScore: 0,
      commenceTimeUtc: "2023-04-12T20:10:00.000Z",
    }),
  ];
  const collapsedA = collapseSameGamePkSnapshots(rawRows);
  const collapsedB = collapseSameGamePkSnapshots(shuffle(rawRows));
  assert.equal(
    canonicalMultiseasonDevelopmentGamesFingerprint(collapsedA.games),
    canonicalMultiseasonDevelopmentGamesFingerprint(collapsedB.games),
  );
  const builtA = sourceFrom(rawRows);
  const builtB = sourceFrom(shuffle(rawRows));
  assert.equal(
    canonicalMultiseasonDevelopmentGamesFingerprint(builtA.games),
    canonicalMultiseasonDevelopmentGamesFingerprint(builtB.games),
  );
  const laterStamp = buildMultiseasonDevelopmentSourceArtifact2023({
    games: shuffle(rawRows),
    collectedAt: "2026-09-03T12:00:00.000Z",
  });
  assert.equal(
    canonicalMultiseasonDevelopmentGamesFingerprint(laterStamp.games),
    canonicalMultiseasonDevelopmentGamesFingerprint(builtA.games),
  );
  assert.notEqual(laterStamp.collectedAt, builtA.collectedAt);
  assert.equal(builtA.rawSnapshotCount - builtA.collapsedSameGamePkCount, builtA.rowCount);
  console.log("SHUFFLED_RAW_ROWS_CANONICAL_RESULT_IDENTICAL = PASS");

  const directionSha = sha256File(DIRECTION_REVIEW_PATH);
  assert.equal(directionSha, POST_V2C_RESEARCH_DIRECTION_REVIEW_SHA256);
  const directionReview = JSON.parse(readFileSync(DIRECTION_REVIEW_PATH, "utf8")) as {
    v2cCycleStatus: string;
    nextSourceFoundationCandidate: string;
    newModelTrainingAllowedNow: boolean;
  };
  assert.equal(directionReview.v2cCycleStatus, "CLOSED");
  assert.equal(
    directionReview.nextSourceFoundationCandidate,
    "2023_MLB_REGULAR_SEASON",
  );
  assert.equal(directionReview.newModelTrainingAllowedNow, false);
  console.log("RESEARCH_DIRECTION_PIN = PASS");

  const eval2025Sha = sha256File(EVAL_2025_PATH);
  assert.equal(eval2025Sha, EVAL_2025_SHA);
  assert.equal(sha256File(SOURCE_2025_PATH), SOURCE_2025_SHA);
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
  const v1Model = JSON.parse(readFileSync(v1ModelPath, "utf8")) as {
    modelCoreHash: string;
  };
  const v2aModel = JSON.parse(readFileSync(v2aModelPath, "utf8")) as {
    modelCoreHash: string;
  };
  const v2bModel = JSON.parse(readFileSync(v2bModelPath, "utf8")) as {
    modelCoreHash: string;
  };
  const v2cModel = JSON.parse(readFileSync(v2cModelPath, "utf8")) as {
    modelCoreHash: string;
  };
  assert.equal(joinBefore, JOIN_SHA);
  assert.equal(split.splitManifestHash, SPLIT_MANIFEST_SHA);
  assert.equal(split.holdoutGamePks.length, 483);
  assert.equal(source2024Before, SOURCE_2024_SHA);
  assert.equal(featureBefore, FEATURE_SHA);
  assert.equal(labelBefore, LABEL_SHA);
  assert.equal(v1Model.modelCoreHash, V1_CORE);
  assert.equal(v2aModel.modelCoreHash, V2A_CORE);
  assert.equal(v2bModel.modelCoreHash, V2B_CORE);
  assert.equal(v2cModel.modelCoreHash, V2C_CORE);
  console.log("ALL_2024_SEALED_ARTIFACTS_UNCHANGED = PASS");
  console.log("2024_HOLDOUT_MEMBERSHIP_COUNT = 483");

  const v2cFiles = listTsFiles(V2C_DIR);
  assert.ok(v2cFiles.length > 0, "v2-C module missing");
  for (const filePath of v2cFiles) {
    const text = readFileSync(filePath, "utf8");
    assert.equal(
      text.includes("independent-multiseason-development"),
      false,
      `${filePath} imports 2023 source`,
    );
    assert.equal(
      text.includes("2023-regular-season-source-v1"),
      false,
      `${filePath} reads 2023 source artifact`,
    );
  }
  console.log("V2C_READ_2023_SOURCE = NO");

  const src2023Files = [...listTsFiles(LIB_DIR), COLLECT_SCRIPT];
  for (const filePath of src2023Files) {
    scanForbidden(readFileSync(filePath, "utf8"), filePath);
  }
  console.log("NO_MODEL_IMPORTS = PASS");
  console.log("2024_HOLDOUT_PROXY_SEAL = PASS");

  if (existsSync(independentMultiseasonDevelopment2023SourcePath())) {
    const persisted = JSON.parse(
      readFileSync(independentMultiseasonDevelopment2023SourcePath(), "utf8"),
    );
    validateMultiseasonDevelopmentSourceArtifact2023(persisted);
    assert.equal(persisted.season, 2023);
    assert.equal(persisted.source, "MLB_STATS_API");
    assert.equal(persisted.track, "MULTI_SEASON_DEVELOPMENT_TRACK");
    assert.equal(persisted.developmentEvidence, true);
    assert.equal(persisted.externalReplication, false);
    assert.equal(persisted.modelEvaluationAllowed, false);
    assert.equal(persisted.rowCount, persisted.games.length);
    assert.equal(
      persisted.rawSnapshotCount - persisted.collapsedSameGamePkCount,
      persisted.rowCount,
    );
    const fileSha = sha256File(independentMultiseasonDevelopment2023SourcePath());
    assert.equal(fileSha, hashMultiseasonDevelopmentSourceArtifact2023(persisted));
    const completeness = summarizeMultiseasonDevelopmentCompleteness2023({
      rawScheduleSnapshotCount: persisted.rawSnapshotCount,
      artifact: persisted,
    });
    assert.equal(completeness.uniqueFinalGamePkCount, persisted.rowCount);
    const review = listMultiseasonDevelopmentManualReviewGames2023(persisted.games);
    assert.equal(
      review.filter((g) => g.reviewNote === "CANCELLED").length,
      completeness.statusCounts.CANCELLED,
    );
    if (existsSync(independentMultiseasonDevelopment2023AuditPath())) {
      const audit = JSON.parse(
        readFileSync(independentMultiseasonDevelopment2023AuditPath(), "utf8"),
      );
      assert.equal(audit.researchOnly, true);
      assert.equal(audit.track, "MULTI_SEASON_DEVELOPMENT_TRACK");
      assert.equal(audit.stage, "SOURCE");
      assert.equal(audit.season, 2023);
      assert.equal(audit.developmentEvidence, true);
      assert.equal(audit.externalReplication, false);
      assert.equal(audit.modelEvaluated, false);
      assert.equal(audit.modelCandidate, false);
      assert.equal(audit.engineAdmission, "PROHIBITED");
      assert.equal(audit.marketUsed, false);
      assert.equal(audit.featuresCreated, false);
      assert.equal(audit.labelsCreated, false);
      assert.equal(audit.joinCreated, false);
      assert.equal(audit.modelProbabilitiesCreated, false);
      assert.equal(audit.sourceArtifactSha256, fileSha);
      assert.equal(audit.holdoutEvaluated, false);
      assert.equal(audit.holdoutFeatureRowsRead, 0);
      assert.equal(audit.holdoutLabelRowsRead, 0);
      assert.equal(audit["2025RowsInspected"], false);
      assert.equal(audit.officialMlbStatsApiOnly, true);
    }
  }

  const cancelled = sourceFrom([
    game({
      gamePk: 9401,
      officialDate: "2023-04-03",
      homeTeamId: 147,
      awayTeamId: 111,
      abstractGameState: "Final",
      detailedState: "Cancelled",
      codedGameState: "C",
      homeScore: null,
      awayScore: null,
    }),
  ]);
  assert.equal(classifySourceStatus(cancelled.games[0]!), "CANCELLED");
  assert.equal(cancelled.games[0]!.safeResultApplyDate, null);
  assert.equal(cancelled.games[0]!.resultProvenanceStatus, "NOT_APPLICABLE");
  const cancelledReview = listMultiseasonDevelopmentManualReviewGames2023(
    cancelled.games,
  );
  assert.equal(cancelledReview[0]!.reviewNote, "CANCELLED");

  const suspended = sourceFrom([
    game({
      gamePk: 9402,
      officialDate: "2023-04-04",
      homeTeamId: 147,
      awayTeamId: 111,
      abstractGameState: "Suspended",
      detailedState: "Suspended",
      codedGameState: "U",
      homeScore: 2,
      awayScore: 1,
    }),
  ]);
  assert.equal(classifySourceStatus(suspended.games[0]!), "SUSPENDED");
  assert.equal(suspended.games[0]!.resultProvenanceStatus, "UNPROVEN_COMPLETION");
  assert.equal(suspended.games[0]!.safeResultApplyDate, null);

  assert.equal(sha256File(independentJoinArtifactPath()), joinBefore);
  assert.equal(sha256File(independentSplitArtifactPath()), splitBefore);
  assert.equal(
    sha256File(independentSafeAHistoricalSourcePath()),
    source2024Before,
  );
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), featureBefore);
  assert.equal(sha256File(independentLabelArtifactPath()), labelBefore);
  assert.equal(sha256File(v1ModelPath), v1FileBefore);
  assert.equal(sha256File(v2aModelPath), v2aFileBefore);
  assert.equal(sha256File(v2bModelPath), v2bFileBefore);
  assert.equal(sha256File(v2cModelPath), v2cFileBefore);

  console.log("NETWORK_USED = NO");
  console.log("test:mlb-independent-multiseason-source-2023 PASS");
}

main();
