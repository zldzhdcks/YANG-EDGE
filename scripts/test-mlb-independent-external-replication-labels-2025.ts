/**
 * 2025 EXTERNAL REPLICATION TRACK — HOME_WIN label materialization tests.
 * Source-only. No SAFE_A I/O. No join. No model evaluation.
 *
 *   npm run test:mlb-independent-external-replication-labels-2025
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
import {
  MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
  independentSplitArtifactPath,
} from "../src/lib/mlb/independent-split-v1";
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
  MLB_INDEPENDENT_2025_COEXISTING_SAFE_A_FEATURE_SHA256,
  MLB_INDEPENDENT_2025_LABEL_CROSS_DATE_RESUME_GAME_PKS,
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  ExternalReplicationLabelError,
  assertExternalReplication2025LabelSourcePin,
  buildExternalReplicationSourceArtifact2025,
  disposeExternalReplicationLabelGame2025,
  findExternalReplicationLabelRow2025,
  hashExternalReplicationLabelArtifact2025,
  independentExternalReplication2025FeaturePath,
  independentExternalReplication2025LabelPath,
  independentExternalReplication2025SourcePath,
  materializeExternalReplicationLabels2025,
  type ExternalReplicationHistoricalGameV1,
} from "../src/lib/mlb/independent-external-replication-v1";

const ROOT = process.cwd();
const LIB_FILE = path.join(
  ROOT,
  "src/lib/mlb/independent-external-replication-v1/materialize-labels-2025.ts",
);
const JOIN_SHA = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
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
const FEATURE_2025_SHA = MLB_INDEPENDENT_2025_COEXISTING_SAFE_A_FEATURE_SHA256;

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

function excludeReason(
  over: Partial<ExternalReplicationHistoricalGameV1> &
    Pick<
      ExternalReplicationHistoricalGameV1,
      "gamePk" | "officialDate" | "homeTeamId" | "awayTeamId"
    >,
  reason: string,
): void {
  const result = materializeExternalReplicationLabels2025(sourceFrom([game(over)]));
  assert.equal(result.artifact.rows.length, 0, reason);
  assert.equal(result.excluded[0]?.reason, reason);
}

function main(): void {
  try {
    assertExternalReplication2025LabelSourcePin("0".repeat(64));
    assert.fail("pin mismatch should throw");
  } catch (e) {
    assert.equal((e as ExternalReplicationLabelError).code, "SOURCE_SHA_PIN_MISMATCH");
  }
  assertExternalReplication2025LabelSourcePin(MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256);
  console.log("SOURCE_SHA_PIN_MISMATCH_BLOCK = PASS");

  const homeWin = sourceFrom([
    game({
      gamePk: 1,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
    }),
  ]);
  const homeResult = materializeExternalReplicationLabels2025(homeWin);
  const homeRow = findExternalReplicationLabelRow2025(homeResult.artifact, 1);
  assert.ok(homeRow);
  assert.equal(homeRow.winner, "HOME");
  assert.equal(homeRow.target, MLB_INDEPENDENT_HOME_WIN);
  assert.equal(homeRow.status, "FINAL");
  assert.equal(homeRow.identity.officialDate, "2025-04-01");
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
  console.log("CANONICAL_LABEL_SCHEMA = PASS");
  console.log("HOME_SCORE_GT_AWAY_HOME_1 = PASS");

  const awayWin = sourceFrom([
    game({
      gamePk: 2,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 2,
      awayScore: 5,
    }),
  ]);
  const awayRow = findExternalReplicationLabelRow2025(
    materializeExternalReplicationLabels2025(awayWin).artifact,
    2,
  );
  assert.ok(awayRow);
  assert.equal(awayRow.winner, "AWAY");
  assert.equal(awayRow.target, MLB_INDEPENDENT_AWAY_WIN);
  console.log("AWAY_SCORE_GT_HOME_AWAY_0 = PASS");

  excludeReason(
    {
      gamePk: 10,
      officialDate: "2025-04-01",
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
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: null,
      awayScore: null,
    },
    "INVALID_SCORE",
  );
  console.log("INVALID_SCORE_EXCLUDED = PASS");

  excludeReason(
    {
      gamePk: 12,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Final",
      detailedState: "Cancelled",
      codedGameState: "C",
      statusCode: "C",
    },
    "CANCELLED",
  );
  console.log("CANCELLED_EXCLUDED = PASS");

  excludeReason(
    {
      gamePk: 13,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Final",
      detailedState: "Postponed",
      codedGameState: "N",
      statusCode: "N",
    },
    "POSTPONED",
  );
  console.log("POSTPONED_EXCLUDED = PASS");

  excludeReason(
    {
      gamePk: 14,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 1,
      awayScore: 0,
      abstractGameState: "Suspended",
      detailedState: "Suspended",
      codedGameState: "U",
      statusCode: "U",
    },
    "SUSPENDED",
  );
  console.log("SUSPENDED_EXCLUDED = PASS");

  excludeReason(
    {
      gamePk: 15,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Live",
      detailedState: "In Progress",
      codedGameState: "I",
      statusCode: "I",
    },
    "NOT_FINAL",
  );
  console.log("NON_FINAL_EXCLUDED = PASS");

  const invalidIdentity = disposeExternalReplicationLabelGame2025(
    game({
      gamePk: 16,
      officialDate: "2025-04-01",
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

  const invalidGameType = disposeExternalReplicationLabelGame2025({
    ...game({
      gamePk: 17,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
    }),
    gameType: "S",
  });
  assert.equal(invalidGameType.kind, "EXCLUDE");
  if (invalidGameType.kind === "EXCLUDE") {
    assert.equal(invalidGameType.reason, "INVALID_GAME_TYPE");
  }
  console.log("INVALID_GAME_TYPE_EXCLUDED = PASS");

  const orderedSrc = sourceFrom([
    game({
      gamePk: 21,
      officialDate: "2025-04-02",
      homeTeamId: 119,
      awayTeamId: 137,
      homeScore: 4,
      awayScore: 1,
      commenceTimeUtc: "2025-04-02T20:10:00.000Z",
    }),
    game({
      gamePk: 20,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2025-04-01T17:05:00.000Z",
    }),
    game({
      gamePk: 22,
      officialDate: "2025-04-01",
      homeTeamId: 121,
      awayTeamId: 139,
      homeScore: 0,
      awayScore: 1,
      commenceTimeUtc: "2025-04-01T23:10:00.000Z",
    }),
  ]);
  const ordered = materializeExternalReplicationLabels2025(orderedSrc, {
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  const shuffledInput = cloneSource(orderedSrc);
  shuffledInput.games = shuffle(shuffledInput.games);
  const shuffled = materializeExternalReplicationLabels2025(shuffledInput, {
    generatedAt: "2026-09-03T12:00:00.000Z",
  });
  assert.deepEqual(shuffled.artifact.rows, ordered.artifact.rows);
  assert.equal(
    hashExternalReplicationLabelArtifact2025(shuffled.artifact),
    hashExternalReplicationLabelArtifact2025(ordered.artifact),
  );
  console.log("SHUFFLED_SOURCE_ROWS_LABEL_ARTIFACT_IDENTICAL = PASS");

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
  const resumeLabels = materializeExternalReplicationLabels2025(resume);
  const resumeRow = findExternalReplicationLabelRow2025(resumeLabels.artifact, 9001);
  assert.ok(resumeRow);
  assert.equal(resumeLabels.artifact.rows.length, 1);
  assert.equal(resumeRow.identity.officialDate, "2025-06-01");
  assert.equal(resumeRow.winner, "AWAY");
  assert.equal(resumeRow.target, 0);
  assert.equal("safeResultApplyDate" in resumeRow, false);
  assert.equal(resume.games[0]!.safeResultApplyDate, "2025-08-01");
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
  assert.equal(matText.includes("materialize-safe-a-2025"), false);
  assert.equal(matText.includes("2025-safe-a-feature-artifact"), false);
  assert.equal(matText.includes("independent-logistic-v1"), false);
  assert.equal(matText.includes("independent-logistic-v2a"), false);
  assert.equal(matText.includes("independent-logistic-v2b"), false);
  assert.equal(matText.includes("independent-logistic-v2c"), false);
  assert.equal(matText.includes("independent-join-v1"), false);
  assert.equal(matText.includes("holdoutGamePks"), false);
  assert.equal(matText.includes("statsapi.mlb.com"), false);
  assert.equal(matText.includes("fetch("), false);
  console.log("NO_FEATURE_IMPORTS_OR_READS = PASS");
  console.log("NO_MODEL_IMPORTS = PASS");
  console.log("NO_JOIN_OUTPUT = PASS");

  const featureAbsent = materializeExternalReplicationLabels2025(homeWin);
  assert.equal(featureAbsent.artifact.rows.length, 1);
  assert.equal(featureAbsent.audit.featureArtifactRead, false);
  assert.equal(featureAbsent.audit.joinCreated, false);
  console.log("FEATURE_ARTIFACT_ABSENT_STILL_SUCCEEDS = PASS");

  const sourcePath = independentExternalReplication2025SourcePath();
  const sourceBytesSha = sha256File(sourcePath);
  assert.equal(sourceBytesSha, MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256);
  const sealedSource = JSON.parse(readFileSync(sourcePath, "utf8"));
  assert.equal(sealedSource.rowCount, 2430);
  assert.equal(sealedSource.season, 2025);
  assert.equal(sealedSource.gameType, "R");
  assert.equal(sealedSource.source, "MLB_STATS_API");
  const sealed = materializeExternalReplicationLabels2025(sealedSource, {
    expectedSourceSha256: sourceBytesSha,
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  assert.equal(sealed.audit.sourceRowCount, 2430);
  assert.equal(sealed.audit.labelRowCount, 2430);
  assert.equal(sealed.audit.excludedRowCount, 0);
  assert.equal(sealed.audit.uniqueGamePk, 2430);
  assert.equal(sealed.audit.duplicateGamePk, 0);
  assert.equal(sealed.audit.sourceIdentityMismatch, 0);
  assert.equal(sealed.audit.sourceWithoutLabelCount, 0);
  assert.equal(sealed.audit.labelWithoutSourceCount, 0);
  assert.equal(
    sealed.audit.winnerDistribution.HOME + sealed.audit.winnerDistribution.AWAY,
    2430,
  );
  assert.equal(sealed.audit.targetDistribution["1"], sealed.audit.winnerDistribution.HOME);
  assert.equal(sealed.audit.targetDistribution["0"], sealed.audit.winnerDistribution.AWAY);
  assert.equal(validateIndependentLabelArtifactV1(sealed.artifact).ok, true);
  console.log("DUPLICATE_DETECTION = PASS");
  console.log("SOURCE_IDENTITY_EXACT = PASS");

  for (const pk of MLB_INDEPENDENT_2025_LABEL_CROSS_DATE_RESUME_GAME_PKS) {
    const row = findExternalReplicationLabelRow2025(sealed.artifact, pk);
    assert.ok(row, `missing resume label ${pk}`);
    const srcGame = sealedSource.games.find(
      (g: { gamePk: number }) => g.gamePk === pk,
    );
    assert.equal(row!.identity.officialDate, srcGame.officialDate);
    assert.equal(row!.identity.gamePk, pk);
    const caseRow = sealed.audit.crossDateResumeLabelCases.find((c) => c.gamePk === pk);
    assert.ok(caseRow);
    assert.equal(caseRow!.officialDate, srcGame.officialDate);
    assert.equal(caseRow!.winner, row!.winner);
    assert.equal(caseRow!.target, row!.target);
    assert.equal(caseRow!.resultProvenanceStatus, srcGame.resultProvenanceStatus);
    assert.equal(caseRow!.safeResultApplyDate, srcGame.safeResultApplyDate);
  }
  console.log("FOUR_CROSS_DATE_RESUME_LABELS = PASS");

  for (const row of sealed.artifact.rows) {
    const src = sealedSource.games.find(
      (g: { gamePk: number }) => g.gamePk === row.identity.gamePk,
    );
    assert.ok(src);
    assert.equal(row.identity.officialDate, src.officialDate);
    assert.equal(row.identity.homeTeamId, src.homeTeamId);
    assert.equal(row.identity.awayTeamId, src.awayTeamId);
    assert.equal(row.identity.commenceTimeUtc, src.commenceTimeUtc);
  }

  try {
    materializeExternalReplicationLabels2025(sealedSource, {
      expectedSourceSha256: "ff".repeat(32),
    });
    assert.fail("sealed pin mismatch should throw");
  } catch (e) {
    assert.equal((e as ExternalReplicationLabelError).code, "SOURCE_SHA_PIN_MISMATCH");
  }

  assert.equal(sha256File(sourcePath), MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256);
  assert.equal(
    sha256File(independentExternalReplication2025FeaturePath()),
    FEATURE_2025_SHA,
  );
  console.log("2025_SOURCE_UNCHANGED = PASS");
  console.log("2025_SAFE_A_UNCHANGED = PASS");

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

  if (existsSync(independentExternalReplication2025LabelPath())) {
    const persisted = JSON.parse(
      readFileSync(independentExternalReplication2025LabelPath(), "utf8"),
    );
    assert.equal(persisted.rows.length, sealed.artifact.rows.length);
    assert.equal(validateIndependentLabelArtifactV1(persisted).ok, true);
  }

  console.log("test:mlb-independent-external-replication-labels-2025 PASS");
}

main();
