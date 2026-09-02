/**
 * 2025 EXTERNAL REPLICATION TRACK — historical source tests.
 * No network. No features, labels, join, training, or model evaluation.
 *
 *   npm run test:mlb-independent-external-replication-source-2025
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
import {
  MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
  independentSplitArtifactPath,
} from "../src/lib/mlb/independent-split-v1";
import { independentLogisticModelPath } from "../src/lib/mlb/independent-logistic-v1";
import { independentLogisticV2aModelPath } from "../src/lib/mlb/independent-logistic-v2a";
import { independentLogisticV2bModelPath } from "../src/lib/mlb/independent-logistic-v2b";
import { independentLogisticV2cModelPath } from "../src/lib/mlb/independent-logistic-v2c";
import {
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_GAME_TYPE_V1,
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_SEASON_2025,
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ORIGIN,
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_QUERY_2025,
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_SCHEMA_V1,
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_SPORT_ID_V1,
  SafeAHistoricalSourceError,
  buildExternalReplicationSourceArtifact2025,
  canonicalExternalReplicationGamesFingerprint,
  classifySourceStatus,
  collapseSameGamePkSnapshots,
  hashExternalReplicationSourceArtifact2025,
  independentExternalReplication2025AuditPath,
  independentExternalReplication2025SourcePath,
  listExternalReplicationManualReviewGames2025,
  parseMlbScheduleBodyToHistoricalGames,
  summarizeExternalReplicationCompleteness2025,
  validateExternalReplicationSourceArtifact2025,
  validateHistoricalSourceIdentity,
  validateHistoricalSourceResultProvenance,
  type ExternalReplicationHistoricalGameV1,
} from "../src/lib/mlb/independent-external-replication-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-external-replication-v1");
const V2C_DIR = path.join(ROOT, "src/lib/mlb/independent-logistic-v2c");
const JOIN_SHA = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
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
  over: Partial<ExternalReplicationHistoricalGameV1> &
    Pick<
      ExternalReplicationHistoricalGameV1,
      "gamePk" | "officialDate" | "homeTeamId" | "awayTeamId"
    >,
): ExternalReplicationHistoricalGameV1 {
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

function sourceFrom(games: ExternalReplicationHistoricalGameV1[]) {
  return buildExternalReplicationSourceArtifact2025({
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

function main(): void {
  assert.equal(
    MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_SCHEMA_V1,
    "mlb-independent-external-replication-source-v1",
  );
  assert.equal(MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_ORIGIN, "MLB_STATS_API");
  assert.equal(MLB_INDEPENDENT_EXTERNAL_REPLICATION_SEASON_2025, 2025);
  assert.equal(MLB_INDEPENDENT_EXTERNAL_REPLICATION_GAME_TYPE_V1, "R");
  assert.equal(MLB_INDEPENDENT_EXTERNAL_REPLICATION_SPORT_ID_V1, 1);
  assert.equal(
    MLB_INDEPENDENT_EXTERNAL_REPLICATION_SOURCE_QUERY_2025,
    "/api/v1/schedule?sportId=1&startDate=2025-03-01&endDate=2025-11-15&gameType=R",
  );
  console.log("2025_SEASON_CONTRACT = PASS");
  console.log("OFFICIAL_SOURCE_ONLY = PASS");
  console.log("QUERY_EXACT = PASS");
  console.log("REGULAR_SEASON_ONLY_CONTRACT = PASS");

  const body = {
    dates: [
      {
        games: [
          rawScheduleGame({
            gamePk: 1,
            officialDate: "2025-04-01",
            gameDate: "2025-04-01T17:05:00.000Z",
            homeTeamId: 147,
            awayTeamId: 111,
            gameType: "S",
          }),
          rawScheduleGame({
            gamePk: 2,
            officialDate: "2025-04-01",
            gameDate: "2025-04-01T18:10:00.000Z",
            homeTeamId: 147,
            awayTeamId: 111,
          }),
          rawScheduleGame({
            gamePk: 3,
            officialDate: "2025-04-02",
            gameDate: "2025-04-02T23:10:00.000Z",
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
      officialDate: "2025-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      abstractGameState: "Final",
      detailedState: "Postponed",
      codedGameState: "N",
      homeScore: null,
      awayScore: null,
      rescheduleDate: "2025-04-11T17:05:00.000Z",
      rescheduleGameDate: "2025-04-11",
    }),
    game({
      gamePk: 8801,
      officialDate: "2025-04-11",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2025-04-11T17:05:00.000Z",
      rescheduledFrom: "2025-04-10T17:05:00.000Z",
    }),
  ]);
  assert.equal(postponedThenFinal.games.length, 1);
  assert.equal(postponedThenFinal.collapsedSameGamePkCount, 1);
  assert.equal(postponedThenFinal.games[0]!.gamePk, 8801);
  assert.equal(postponedThenFinal.games[0]!.officialDate, "2025-04-11");
  assert.equal(postponedThenFinal.games[0]!.resultProvenanceStatus, "STANDARD");
  assert.equal(postponedThenFinal.games[0]!.safeResultApplyDate, "2025-04-11");
  console.log("SAME_GAMEPK_COLLAPSE = PASS");

  assertThrowsCode(
    () =>
      validateHistoricalSourceIdentity([
        game({
          gamePk: 9107,
          officialDate: "2025-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
        }),
        game({
          gamePk: 9107,
          officialDate: "2025-04-01",
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
      sourceFrom([
        game({
          gamePk: 9101,
          officialDate: "2025-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
        }),
        game({
          gamePk: 9101,
          officialDate: "2025-04-01",
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
          officialDate: "2025-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
          homeScore: 3,
          awayScore: 1,
        }),
        game({
          gamePk: 9108,
          officialDate: "2025-04-01",
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
      officialDate: "2025-06-01",
      homeTeamId: 111,
      awayTeamId: 141,
      homeScore: 1,
      awayScore: 4,
      commenceTimeUtc: "2025-06-01T23:10:00.000Z",
      resumeDate: "2025-08-01T18:05:00.000Z",
      resumeGameDate: "2025-08-01",
    }),
    game({
      gamePk: 9001,
      officialDate: "2025-06-01",
      homeTeamId: 111,
      awayTeamId: 141,
      homeScore: 1,
      awayScore: 4,
      commenceTimeUtc: "2025-08-01T18:05:00.000Z",
      resumedFrom: "2025-06-01T23:10:00.000Z",
      resumedFromDate: "2025-06-01",
    }),
  ]);
  assert.equal(resume.games[0]!.resultProvenanceStatus, "CROSS_DATE_RESUME_RESOLVED");
  assert.equal(resume.games[0]!.safeResultApplyDate, "2025-08-01");
  assert.equal(resume.games[0]!.resumeGameDate, "2025-08-01");
  console.log("RESUME_PROVENANCE_RESOLUTION = PASS");

  const unsafeApply = [
    game({
      gamePk: 9201,
      officialDate: "2025-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      safeResultApplyDate: "2025-04-09",
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
      officialDate: "2025-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      abstractGameState: "Final",
      detailedState: "Cancelled",
      codedGameState: "C",
      homeScore: null,
      awayScore: null,
      safeResultApplyDate: "2025-04-10",
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
          officialDate: "2025-02-31",
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
          officialDate: "2025-04-01",
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
          officialDate: "2025-04-01",
          homeTeamId: 147,
          awayTeamId: 111,
          homeScore: -1,
        }),
      ]),
    "NEGATIVE_SCORE",
    "negative score",
  );
  console.log("NEGATIVE_SCORE_REJECTION = PASS");

  const counted = sourceFrom([
    game({
      gamePk: 11,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
    }),
    game({
      gamePk: 12,
      officialDate: "2025-04-02",
      homeTeamId: 111,
      awayTeamId: 147,
    }),
  ]);
  assert.equal(counted.rowCount, counted.games.length);
  const badCount = clone(counted);
  badCount.rowCount = counted.games.length + 1;
  assertThrowsCode(
    () => validateExternalReplicationSourceArtifact2025(badCount),
    "INVALID_SOURCE_ARTIFACT",
    "rowCount reconciliation",
  );
  console.log("ROWCOUNT_RECONCILIATION = PASS");

  const rawRows = [
    game({
      gamePk: 8801,
      officialDate: "2025-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      abstractGameState: "Final",
      detailedState: "Postponed",
      codedGameState: "N",
      homeScore: null,
      awayScore: null,
      commenceTimeUtc: "2025-04-10T17:05:00.000Z",
    }),
    game({
      gamePk: 8801,
      officialDate: "2025-04-11",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2025-04-11T17:05:00.000Z",
    }),
    game({
      gamePk: 8802,
      officialDate: "2025-04-12",
      homeTeamId: 119,
      awayTeamId: 137,
      homeScore: 2,
      awayScore: 0,
      commenceTimeUtc: "2025-04-12T20:10:00.000Z",
    }),
  ];
  const collapsedA = collapseSameGamePkSnapshots(rawRows);
  const collapsedB = collapseSameGamePkSnapshots(shuffle(rawRows));
  assert.equal(
    canonicalExternalReplicationGamesFingerprint(collapsedA.games),
    canonicalExternalReplicationGamesFingerprint(collapsedB.games),
  );
  const builtA = sourceFrom(rawRows);
  const builtB = sourceFrom(shuffle(rawRows));
  assert.equal(
    canonicalExternalReplicationGamesFingerprint(builtA.games),
    canonicalExternalReplicationGamesFingerprint(builtB.games),
  );
  const laterStamp = buildExternalReplicationSourceArtifact2025({
    games: shuffle(rawRows),
    collectedAt: "2026-09-03T12:00:00.000Z",
  });
  assert.equal(
    canonicalExternalReplicationGamesFingerprint(laterStamp.games),
    canonicalExternalReplicationGamesFingerprint(builtA.games),
  );
  assert.notEqual(laterStamp.collectedAt, builtA.collectedAt);
  console.log("SHUFFLED_RAW_ROWS_CANONICAL_RESULT_IDENTICAL = PASS");

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

  const v2cFiles = listTsFiles(V2C_DIR);
  assert.ok(v2cFiles.length > 0, "v2-C module missing");
  for (const filePath of v2cFiles) {
    const text = readFileSync(filePath, "utf8");
    assert.equal(
      text.includes("independent-external-replication"),
      false,
      `${filePath} imports 2025 source`,
    );
    assert.equal(
      text.includes("2025-regular-season-source-v1"),
      false,
      `${filePath} reads 2025 source artifact`,
    );
    assert.equal(
      text.includes("external-replication/2025"),
      false,
      `${filePath} reads 2025 replication path`,
    );
  }
  const src2025Files = listTsFiles(LIB_DIR);
  for (const filePath of src2025Files) {
    const text = readFileSync(filePath, "utf8");
    assert.equal(
      text.includes("independent-logistic-v2c"),
      false,
      `${filePath} imports v2-C`,
    );
    assert.equal(text.includes("materializeIndependentSafeA"), false);
    assert.equal(/odds|implied/i.test(text), false, `${filePath} odds tokens`);
    assert.equal(
      /\bmarket\b/i.test(text.replaceAll("marketUsed", "")),
      false,
      `${filePath} market tokens`,
    );
  }
  console.log("V2C_READ_2025_SOURCE = NO");

  assert.equal(split.holdoutGamePks.length, 483);
  const holdoutProxyFiles = listTsFiles(LIB_DIR);
  for (const filePath of holdoutProxyFiles) {
    const text = readFileSync(filePath, "utf8");
    assert.equal(text.includes("holdoutGamePks"), false);
    assert.equal(text.includes("independent-join-v1"), false);
    assert.equal(text.includes("independent-label-v1"), false);
  }
  console.log("2024_HOLDOUT_PROXY_SEAL = PASS");

  if (existsSync(independentExternalReplication2025SourcePath())) {
    const persisted = JSON.parse(
      readFileSync(independentExternalReplication2025SourcePath(), "utf8"),
    );
    validateExternalReplicationSourceArtifact2025(persisted);
    assert.equal(persisted.season, 2025);
    assert.equal(persisted.source, "MLB_STATS_API");
    assert.equal(persisted.rowCount, persisted.games.length);
    const fileSha = sha256File(independentExternalReplication2025SourcePath());
    assert.equal(fileSha, hashExternalReplicationSourceArtifact2025(persisted));
    const completeness = summarizeExternalReplicationCompleteness2025({
      rawScheduleSnapshotCount:
        persisted.rowCount + persisted.collapsedSameGamePkCount,
      artifact: persisted,
    });
    assert.equal(completeness.uniqueFinalGamePkCount, persisted.rowCount);
    const review = listExternalReplicationManualReviewGames2025(persisted.games);
    assert.equal(
      review.filter((g) => g.reviewReason === "CANCELLED").length,
      completeness.statusCounts.CANCELLED,
    );
    if (existsSync(independentExternalReplication2025AuditPath())) {
      const audit = JSON.parse(
        readFileSync(independentExternalReplication2025AuditPath(), "utf8"),
      );
      assert.equal(audit.modelEvaluated, false);
      assert.equal(audit.modelCandidate, false);
      assert.equal(audit.engineAdmission, "PROHIBITED");
      assert.equal(audit.featuresCreated, false);
      assert.equal(audit.labelsCreated, false);
      assert.equal(audit.modelProbabilitiesCreated, false);
      assert.equal(audit.sourceArtifactSha256, fileSha);
      assert.equal(audit.holdoutEvaluated, false);
      assert.equal(audit.stage, "SOURCE");
      assert.equal(audit.marketUsed, false);
      assert.equal(audit.engineChanged, false);
    }
  }

  const cancelled = sourceFrom([
    game({
      gamePk: 9401,
      officialDate: "2025-04-03",
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

  console.log("test:mlb-independent-external-replication-source-2025 PASS");
}

main();
