/**
 * 2023 MULTI-SEASON DEVELOPMENT TRACK — HOME_WIN label tests.
 * Source-only. No SAFE_A row I/O. No join. No model evaluation.
 *
 *   npm run test:mlb-independent-multiseason-labels-2023
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
  MLB_INDEPENDENT_AWAY_WIN,
  MLB_INDEPENDENT_HOME_WIN,
  MLB_INDEPENDENT_LABEL_BUILDER_VERSION,
  MLB_INDEPENDENT_LABEL_SCHEMA_V1,
  MLB_INDEPENDENT_LABEL_SOURCE_V1,
  MLB_INDEPENDENT_TARGET_V1,
  validateIndependentLabelArtifactV1,
  validateIndependentLabelRowV1,
} from "../src/lib/mlb/independent-model-v1";
import {
  MLB_INDEPENDENT_2023_COEXISTING_SAFE_A_FEATURE_SHA256,
  MLB_INDEPENDENT_2023_LABEL_CROSS_DATE_RESUME_GAME_PKS,
  MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256,
  POST_V2C_RESEARCH_DIRECTION_REVIEW_SHA256,
  assertMultiseasonDevelopment2023LabelSourcePin,
  buildMultiseasonDevelopmentSourceArtifact2023,
  disposeMultiseasonDevelopmentLabelGame2023,
  findMultiseasonDevelopmentLabelRow2023,
  hashMultiseasonDevelopmentLabelArtifact2023,
  independentMultiseasonDevelopment2023LabelPath,
  independentMultiseasonDevelopment2023SourcePath,
  materializeMultiseasonDevelopmentLabels2023,
  type MultiseasonDevelopmentHistoricalGame2023,
} from "../src/lib/mlb/independent-multiseason-development-v1";

const ROOT = process.cwd();
const LIB_FILE = path.join(
  ROOT,
  "src/lib/mlb/independent-multiseason-development-v1/materialize-labels-2023.ts",
);
const MAT_SCRIPT = path.join(
  ROOT,
  "scripts/materialize-mlb-independent-multiseason-labels-2023.ts",
);
const FEATURE_2023_PATH = path.join(
  ROOT,
  "data/research/mlb/independent-model-v1/multi-season-development/2023/features/2023-safe-a-feature-artifact-v1.json",
);
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
const LABEL_2024_SHA =
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
const EXPECTED_SEALED_SOURCE_ROWS = 2430;

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
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

function cloneSource<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function excludeReason(
  over: Partial<MultiseasonDevelopmentHistoricalGame2023> &
    Pick<
      MultiseasonDevelopmentHistoricalGame2023,
      "gamePk" | "officialDate" | "homeTeamId" | "awayTeamId"
    >,
  reason: string,
): void {
  const result = materializeMultiseasonDevelopmentLabels2023(sourceFrom([game(over)]));
  assert.equal(result.artifact.rows.length, 0, reason);
  assert.equal(result.excluded[0]?.reason, reason);
}

function main(): void {
  assertThrowsCode(
    () => assertMultiseasonDevelopment2023LabelSourcePin("0".repeat(64)),
    "SOURCE_SHA_PIN_MISMATCH",
    "source sha mismatch",
  );
  assertMultiseasonDevelopment2023LabelSourcePin(
    MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256,
  );
  console.log("SOURCE_SHA_PIN_MISMATCH_BLOCK = PASS");

  const base = sourceFrom([
    game({
      gamePk: 1,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
    }),
  ]);
  const wrongTrack = cloneSource(base) as { track: string };
  wrongTrack.track = "2025_EXTERNAL_REPLICATION_TRACK";
  assertThrowsCode(
    () => materializeMultiseasonDevelopmentLabels2023(wrongTrack as typeof base),
    "WRONG_TRACK",
    "wrong track",
  );
  console.log("WRONG_TRACK_BLOCK = PASS");

  const wrongSeason = cloneSource(base) as { season: number };
  wrongSeason.season = 2024;
  assertThrowsCode(
    () => materializeMultiseasonDevelopmentLabels2023(wrongSeason as typeof base),
    "WRONG_SEASON",
    "wrong season",
  );
  console.log("WRONG_SEASON_BLOCK = PASS");

  const homeWin = sourceFrom([
    game({
      gamePk: 1,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
    }),
  ]);
  const homeResult = materializeMultiseasonDevelopmentLabels2023(homeWin);
  const homeRow = findMultiseasonDevelopmentLabelRow2023(homeResult.artifact, 1);
  assert.ok(homeRow);
  assert.equal(homeRow.winner, "HOME");
  assert.equal(homeRow.target, MLB_INDEPENDENT_HOME_WIN);
  assert.equal(homeRow.status, "FINAL");
  assert.equal(homeRow.identity.officialDate, "2023-04-01");
  assert.equal(homeRow.identity.homeTeamId, 147);
  assert.equal(homeRow.identity.awayTeamId, 111);
  assert.equal(validateIndependentLabelRowV1(homeRow).ok, true);
  assert.equal(homeResult.artifact.schemaVersion, MLB_INDEPENDENT_LABEL_SCHEMA_V1);
  assert.equal(homeResult.artifact.builderVersion, MLB_INDEPENDENT_LABEL_BUILDER_VERSION);
  assert.equal(homeResult.artifact.target, MLB_INDEPENDENT_TARGET_V1);
  assert.equal(homeResult.artifact.labelSource, MLB_INDEPENDENT_LABEL_SOURCE_V1);
  assert.equal(homeResult.artifact.researchOnly, true);
  assert.equal(homeResult.artifact.independentModelSample, 0);
  assert.equal(homeResult.artifact.engineAdmission, "PROHIBITED");
  assert.equal(homeResult.artifact.datasetReady, false);
  assert.equal(homeResult.audit.track, "MULTI_SEASON_DEVELOPMENT_TRACK");
  assert.equal(homeResult.audit.stage, "LABELS");
  assert.equal(homeResult.audit.season, 2023);
  assert.equal(homeResult.audit.developmentEvidence, true);
  assert.equal(homeResult.audit.externalReplication, false);
  assert.equal(homeResult.audit.modelEvaluationAllowed, false);
  assert.equal(homeResult.audit.featureArtifactRead, false);
  assert.equal(homeResult.audit.featureRowsRead, 0);
  assert.equal(homeResult.audit.joinCreated, false);
  console.log("CANONICAL_LABEL_SCHEMA = PASS");
  console.log("HOME_SCORE_GT_AWAY_HOME_1 = PASS");

  const awayWin = sourceFrom([
    game({
      gamePk: 2,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 2,
      awayScore: 5,
    }),
  ]);
  const awayRow = findMultiseasonDevelopmentLabelRow2023(
    materializeMultiseasonDevelopmentLabels2023(awayWin).artifact,
    2,
  );
  assert.ok(awayRow);
  assert.equal(awayRow.winner, "AWAY");
  assert.equal(awayRow.target, MLB_INDEPENDENT_AWAY_WIN);
  console.log("AWAY_SCORE_GT_HOME_AWAY_0 = PASS");

  excludeReason(
    {
      gamePk: 10,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 3,
      awayScore: 3,
    },
    "TIED_FINAL",
  );
  console.log("TIED_FINAL_EXCLUDED = PASS");

  excludeReason(
    {
      gamePk: 11,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: null,
      awayScore: null,
    },
    "INVALID_SCORE",
  );
  console.log("INVALID_SCORE_EXCLUDED = PASS");

  const orderedSrc = sourceFrom([
    game({
      gamePk: 21,
      officialDate: "2023-04-02",
      homeTeamId: 119,
      awayTeamId: 137,
      homeScore: 4,
      awayScore: 1,
      commenceTimeUtc: "2023-04-02T20:10:00.000Z",
    }),
    game({
      gamePk: 20,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2023-04-01T17:05:00.000Z",
    }),
    game({
      gamePk: 22,
      officialDate: "2023-04-01",
      homeTeamId: 121,
      awayTeamId: 139,
      homeScore: 0,
      awayScore: 1,
      commenceTimeUtc: "2023-04-01T23:10:00.000Z",
    }),
  ]);
  const ordered = materializeMultiseasonDevelopmentLabels2023(orderedSrc, {
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  const shuffledInput = cloneSource(orderedSrc);
  shuffledInput.games = shuffle(shuffledInput.games);
  const shuffled = materializeMultiseasonDevelopmentLabels2023(shuffledInput, {
    generatedAt: "2026-09-03T12:00:00.000Z",
  });
  assert.deepEqual(shuffled.artifact.rows, ordered.artifact.rows);
  assert.equal(
    hashMultiseasonDevelopmentLabelArtifact2023(shuffled.artifact),
    hashMultiseasonDevelopmentLabelArtifact2023(ordered.artifact),
  );
  console.log("SHUFFLED_SOURCE_ROWS_LABEL_RESULT_IDENTICAL = PASS");

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
  const resumeLabels = materializeMultiseasonDevelopmentLabels2023(resume);
  const resumeRow = findMultiseasonDevelopmentLabelRow2023(resumeLabels.artifact, 9001);
  assert.ok(resumeRow);
  assert.equal(resumeLabels.artifact.rows.length, 1);
  assert.equal(resumeRow.identity.officialDate, "2023-06-01");
  assert.equal(resumeRow.winner, "AWAY");
  assert.equal(resumeRow.target, 0);
  assert.equal("safeResultApplyDate" in resumeRow, false);
  assert.equal(resume.games[0]!.safeResultApplyDate, "2023-08-01");
  console.log("CROSS_DATE_RESUME_ORIGINAL_OFFICIAL_DATE = PASS");

  walkKeys(ordered.artifact, (key) => {
    const token = key.toLowerCase();
    assert.equal(token.includes("od" + "ds"), false, key);
    assert.equal(token.includes("m" + "arket"), false, key);
    assert.equal(token.includes("impl" + "ied"), false, key);
    assert.equal(token === "edge", false, key);
    assert.equal(token === "grade", false, key);
    assert.equal(token === "postgame", false, key);
  });
  console.log("MARKET_FIELD_SCAN = PASS");

  const matText = readFileSync(LIB_FILE, "utf8");
  assert.equal(matText.includes("materialize-safe-a-2023"), false);
  assert.equal(matText.includes("2023-safe-a-feature-artifact"), false);
  assert.equal(matText.includes("independent-logistic-v1"), false);
  assert.equal(matText.includes("independent-logistic-v2a"), false);
  assert.equal(matText.includes("independent-logistic-v2b"), false);
  assert.equal(matText.includes("independent-logistic-v2c"), false);
  assert.equal(matText.includes("independent-join-v1"), false);
  assert.equal(matText.includes("holdoutGamePks"), false);
  assert.equal(matText.includes("getRawStatsJson"), false);
  assert.equal(matText.includes("statsapi.mlb.com"), false);
  assert.equal(matText.includes("fetch("), false);
  assert.equal(matText.includes("independent-external-replication-v1"), false);
  const scriptText = readFileSync(MAT_SCRIPT, "utf8");
  assert.equal(scriptText.includes("independent-logistic-v1"), false);
  assert.equal(scriptText.includes("independent-join-v1"), false);
  assert.equal(scriptText.includes("getRawStatsJson"), false);
  console.log("NO_FEATURE_IMPORTS_OR_READS = PASS");
  console.log("NO_MODEL_IMPORTS = PASS");
  console.log("NO_JOIN_OUTPUT = PASS");
  console.log("NETWORK_USED = NO");

  const featureAbsent = materializeMultiseasonDevelopmentLabels2023(homeWin);
  assert.equal(featureAbsent.artifact.rows.length, 1);
  assert.equal(featureAbsent.audit.featureArtifactRead, false);
  assert.equal(featureAbsent.audit.featureShaUsedForLabelDerivation, false);
  assert.equal(featureAbsent.audit.joinCreated, false);
  assert.equal(featureAbsent.audit.modelUsed, false);
  console.log("FEATURE_ARTIFACT_ABSENT_STILL_SUCCEEDS = PASS");

  const sourcePath = independentMultiseasonDevelopment2023SourcePath();
  const sourceBytesSha = sha256File(sourcePath);
  assert.equal(sourceBytesSha, MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256);
  const sealedSource = JSON.parse(readFileSync(sourcePath, "utf8"));
  assert.equal(sealedSource.rowCount, EXPECTED_SEALED_SOURCE_ROWS);
  assert.equal(sealedSource.season, 2023);
  assert.equal(sealedSource.gameType, "R");
  assert.equal(sealedSource.source, "MLB_STATS_API");
  assert.equal(sealedSource.sportId, 1);
  assert.equal(sealedSource.track, "MULTI_SEASON_DEVELOPMENT_TRACK");

  const tiedPinned = cloneSource(sealedSource);
  tiedPinned.games[0]!.homeScore = tiedPinned.games[0]!.awayScore;
  assertThrowsCode(
    () =>
      materializeMultiseasonDevelopmentLabels2023(tiedPinned, {
        expectedSourceSha256: sourceBytesSha,
      }),
    "APPLYABLE_RESULT_NOT_FINAL",
    "tied score on pinned source",
  );
  console.log("INVALID_TIED_SCORE_BLOCK = PASS");

  const dupPinned = cloneSource(sealedSource);
  dupPinned.games[1]!.gamePk = dupPinned.games[0]!.gamePk;
  assertThrowsCode(
    () => materializeMultiseasonDevelopmentLabels2023(dupPinned),
    "DUPLICATE_GAME_PK",
    "duplicate gamePk",
  );
  console.log("DUPLICATE_GAME_PK_BLOCK = PASS");

  const sealed = materializeMultiseasonDevelopmentLabels2023(sealedSource, {
    expectedSourceSha256: sourceBytesSha,
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  assert.equal(sealed.audit.sourceRowCount, EXPECTED_SEALED_SOURCE_ROWS);
  assert.equal(sealed.audit.labelRowCount, EXPECTED_SEALED_SOURCE_ROWS);
  assert.equal(sealed.audit.excludedRowCount, 0);
  assert.equal(sealed.audit.uniqueGamePk, EXPECTED_SEALED_SOURCE_ROWS);
  assert.equal(sealed.audit.duplicateLabelGamePkCount, 0);
  assert.equal(sealed.audit.identityMismatchCount, 0);
  assert.equal(sealed.audit.winnerTargetMismatchCount, 0);
  assert.equal(sealed.audit.sourceScoreLabelMismatchCount, 0);
  assert.equal(sealed.audit.sourceRows, EXPECTED_SEALED_SOURCE_ROWS);
  assert.equal(sealed.audit.labelRows, EXPECTED_SEALED_SOURCE_ROWS);
  assert.equal(sealed.audit.excludedRows, 0);
  assert.equal(
    sealed.audit.winnerDistribution.HOME + sealed.audit.winnerDistribution.AWAY,
    EXPECTED_SEALED_SOURCE_ROWS,
  );
  assert.equal(sealed.audit.targetDistribution["1"], sealed.audit.winnerDistribution.HOME);
  assert.equal(sealed.audit.targetDistribution["0"], sealed.audit.winnerDistribution.AWAY);
  assert.equal(sealed.audit.homeWinLabelCount, sealed.audit.winnerDistribution.HOME);
  assert.equal(sealed.audit.awayWinLabelCount, sealed.audit.winnerDistribution.AWAY);
  assert.equal(validateIndependentLabelArtifactV1(sealed.artifact).ok, true);
  console.log("COVERAGE_2430 = PASS");
  console.log("DUPLICATE_DETECTION = PASS");
  console.log("SOURCE_IDENTITY_EXACT = PASS");

  let identityMismatch = 0;
  let winnerTargetMismatch = 0;
  for (const row of sealed.artifact.rows) {
    const src = sealedSource.games.find(
      (g: { gamePk: number }) => g.gamePk === row.identity.gamePk,
    );
    assert.ok(src);
    if (
      row.identity.officialDate !== src.officialDate ||
      row.identity.homeTeamId !== src.homeTeamId ||
      row.identity.awayTeamId !== src.awayTeamId ||
      row.identity.commenceTimeUtc !== src.commenceTimeUtc
    ) {
      identityMismatch += 1;
    }
    const expectedWinner = src.homeScore > src.awayScore ? "HOME" : "AWAY";
    const expectedTarget = expectedWinner === "HOME" ? 1 : 0;
    if (row.winner !== expectedWinner || row.target !== expectedTarget) {
      winnerTargetMismatch += 1;
    }
    assert.equal(src.homeScore === src.awayScore, false);
  }
  assert.equal(identityMismatch, 0);
  assert.equal(winnerTargetMismatch, 0);
  console.log("IDENTITY_MISMATCH_BLOCK = PASS");
  console.log("WINNER_TARGET_MISMATCH_BLOCK = PASS");

  for (const pk of MLB_INDEPENDENT_2023_LABEL_CROSS_DATE_RESUME_GAME_PKS) {
    const row = findMultiseasonDevelopmentLabelRow2023(sealed.artifact, pk);
    assert.ok(row, `missing resume label ${pk}`);
    const srcGame = sealedSource.games.find(
      (g: { gamePk: number }) => g.gamePk === pk,
    );
    assert.equal(row!.identity.officialDate, srcGame.officialDate);
    assert.equal(row!.identity.gamePk, pk);
    assert.equal(row!.identity.homeTeamId, srcGame.homeTeamId);
    assert.equal(row!.identity.awayTeamId, srcGame.awayTeamId);
    const caseRow = sealed.audit.crossDateResumeLabelCases.find((c) => c.gamePk === pk);
    assert.ok(caseRow);
    assert.equal(caseRow!.officialDate, srcGame.officialDate);
    assert.equal(caseRow!.winner, row!.winner);
    assert.equal(caseRow!.target, row!.target);
    assert.equal(caseRow!.resultProvenanceStatus, srcGame.resultProvenanceStatus);
    assert.equal(caseRow!.safeResultApplyDate, srcGame.safeResultApplyDate);
    assert.notEqual(caseRow!.officialDate, srcGame.safeResultApplyDate);
  }
  console.log("CROSS_DATE_LABEL_IDENTITY_PRESERVED = PASS");

  assertThrowsCode(
    () =>
      materializeMultiseasonDevelopmentLabels2023(sealedSource, {
        expectedSourceSha256: "ff".repeat(32),
      }),
    "SOURCE_SHA_PIN_MISMATCH",
    "sealed pin mismatch",
  );

  assert.equal(sha256File(sourcePath), MLB_INDEPENDENT_2023_LABEL_SOURCE_SHA256);
  assert.equal(
    sha256File(FEATURE_2023_PATH),
    MLB_INDEPENDENT_2023_COEXISTING_SAFE_A_FEATURE_SHA256,
  );
  console.log("2023_SOURCE_UNCHANGED = PASS");
  console.log("2023_SAFE_A_UNCHANGED = PASS");
  console.log("FEATURE_ARTIFACT_READ = NO");

  const directionBytes = sha256File(DIRECTION_REVIEW_PATH);
  assert.equal(directionBytes, POST_V2C_RESEARCH_DIRECTION_REVIEW_SHA256);
  const directionReview = JSON.parse(readFileSync(DIRECTION_REVIEW_PATH, "utf8")) as {
    v2cCycleStatus: string;
    newModelTrainingAllowedNow: boolean;
  };
  assert.equal(directionReview.v2cCycleStatus, "CLOSED");
  assert.equal(directionReview.newModelTrainingAllowedNow, false);
  console.log("RESEARCH_DIRECTION_PIN = PASS");

  assert.equal(sha256File(EVAL_2025_PATH), EVAL_2025_SHA);
  console.log("2025_EXTERNAL_REPLICATION_STATE = EXTERNAL_REPLICATION_EXPOSED");
  console.log("2025_ROWS_INSPECTED = NO");

  const joinBefore = sha256File(independentJoinArtifactPath());
  const split = JSON.parse(readFileSync(independentSplitArtifactPath(), "utf8")) as {
    holdoutGamePks: number[];
    splitManifestHash: string;
  };
  assert.equal(joinBefore, JOIN_SHA);
  assert.equal(split.splitManifestHash, SPLIT_MANIFEST_SHA);
  assert.equal(split.holdoutGamePks.length, 483);
  assert.equal(sha256File(independentSafeAHistoricalSourcePath()), SOURCE_2024_SHA);
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), FEATURE_2024_SHA);
  assert.equal(sha256File(independentLabelArtifactPath()), LABEL_2024_SHA);
  const v1 = JSON.parse(readFileSync(independentLogisticModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  const v2a = JSON.parse(readFileSync(independentLogisticV2aModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  const v2b = JSON.parse(readFileSync(independentLogisticV2bModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  const v2c = JSON.parse(readFileSync(independentLogisticV2cModelPath(), "utf8")) as {
    modelCoreHash: string;
  };
  assert.equal(v1.modelCoreHash, V1_CORE);
  assert.equal(v2a.modelCoreHash, V2A_CORE);
  assert.equal(v2b.modelCoreHash, V2B_CORE);
  assert.equal(v2c.modelCoreHash, V2C_CORE);
  console.log("ALL_2024_SEALED_ARTIFACTS_UNCHANGED = PASS");
  console.log("2024_HOLDOUT_PROXY_SEAL = PASS");
  console.log("2024_HOLDOUT_MEMBERSHIP_COUNT = 483");

  if (existsSync(independentMultiseasonDevelopment2023LabelPath())) {
    const persisted = JSON.parse(
      readFileSync(independentMultiseasonDevelopment2023LabelPath(), "utf8"),
    );
    assert.equal(persisted.rows.length, sealed.artifact.rows.length);
    assert.equal(validateIndependentLabelArtifactV1(persisted).ok, true);
    assert.equal(
      hashMultiseasonDevelopmentLabelArtifact2023(persisted),
      hashMultiseasonDevelopmentLabelArtifact2023(sealed.artifact),
    );
  }

  const invalidIdentity = disposeMultiseasonDevelopmentLabelGame2023(
    game({
      gamePk: 16,
      officialDate: "2023-04-01",
      homeTeamId: 147,
      awayTeamId: 147,
      homeScore: 4,
      awayScore: 1,
    }),
  );
  assert.equal(invalidIdentity.kind, "EXCLUDE");
  if (invalidIdentity.kind === "EXCLUDE") {
    assert.equal(invalidIdentity.reason, "INVALID_IDENTITY");
  }
  console.log("INVALID_IDENTITY_EXCLUDED = PASS");
  console.log("test:mlb-independent-multiseason-labels-2023 PASS");
}

main();
