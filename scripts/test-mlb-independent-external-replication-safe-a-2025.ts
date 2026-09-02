/**
 * 2025 EXTERNAL REPLICATION TRACK — SAFE_A feature materialization tests.
 * No network. No labels. No model evaluation.
 *
 *   npm run test:mlb-independent-external-replication-safe-a-2025
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
  MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
  MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1,
  isProhibitedFeatureKey,
  previousOfficialDate,
  validateIndependentFeatureArtifactV1,
  validateIndependentFeatureRowV1,
} from "../src/lib/mlb/independent-model-v1";
import {
  MLB_INDEPENDENT_2025_SEALED_CROSS_DATE_RESUME_GAME_PKS,
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  SafeAMaterializationError,
  assertExternalReplication2025SourcePin,
  buildExternalReplicationSourceArtifact2025,
  findExternalReplicationFeatureRow2025,
  hashIndependentFeatureRowV1,
  independentExternalReplication2025FeatureAuditPath,
  independentExternalReplication2025FeaturePath,
  independentExternalReplication2025SourcePath,
  materializeExternalReplicationSafeAFeatures2025,
  verifyFeatureHashes2025,
  type ExternalReplicationHistoricalGameV1,
} from "../src/lib/mlb/independent-external-replication-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-external-replication-v1");
const JOIN_SHA = MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1;
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

function main(): void {
  try {
    assertExternalReplication2025SourcePin("0".repeat(64));
    assert.fail("pin mismatch should throw");
  } catch (e) {
    assert.equal((e as SafeAMaterializationError).code, "SOURCE_SHA_PIN_MISMATCH");
  }
  assertExternalReplication2025SourcePin(MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256);
  console.log("SOURCE_SHA_PIN_MISMATCH_BLOCK = PASS");

  const sameDay = sourceFrom([
    game({
      gamePk: 1,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2025-04-01T17:05:00.000Z",
    }),
    game({
      gamePk: 2,
      officialDate: "2025-04-01",
      homeTeamId: 147,
      awayTeamId: 119,
      homeScore: 1,
      awayScore: 0,
      commenceTimeUtc: "2025-04-01T20:10:00.000Z",
    }),
    game({
      gamePk: 3,
      officialDate: "2025-04-02",
      homeTeamId: 111,
      awayTeamId: 147,
      homeScore: 3,
      awayScore: 4,
      commenceTimeUtc: "2025-04-02T17:05:00.000Z",
    }),
  ]);
  const sameDayResult = materializeExternalReplicationSafeAFeatures2025(sameDay, {
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  const r1 = findExternalReplicationFeatureRow2025(sameDayResult.artifact, 1)!;
  const r2 = findExternalReplicationFeatureRow2025(sameDayResult.artifact, 2)!;
  const r3 = findExternalReplicationFeatureRow2025(sameDayResult.artifact, 3)!;
  assert.equal(r1.home.gamesPlayedBefore, 0);
  assert.equal(r1.home.winRateBefore, null);
  assert.equal(r1.home.last5WinsBefore, null);
  assert.equal(r1.statsThroughDate, previousOfficialDate("2025-04-01"));
  assert.equal(r1.asOf, r1.statsThroughDate);
  assert.equal(r2.home.gamesPlayedBefore, 0);
  assert.equal(r2.home.winsBefore, 0);
  assert.equal(r3.away.gamesPlayedBefore, 2);
  assert.equal(r3.away.winsBefore, 2);
  assert.equal(MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1.every((k) => k in r1.home), true);
  assert.equal(MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1.every((k) => k in r1.away), true);
  assert.equal(typeof r1.headToHeadGamesBefore, "number");
  console.log("ZERO_HISTORY_NULL_SEMANTICS = PASS");
  console.log("D1_STATS_THROUGH_DATE = PASS");
  console.log("35_BASE_SIGNAL_CANONICAL_CONTRACT = PASS");
  console.log("SAME_DAY_FREEZE = PASS");

  const dh = sourceFrom([
    game({
      gamePk: 10,
      officialDate: "2025-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 4,
      awayScore: 1,
      commenceTimeUtc: "2025-04-10T17:05:00.000Z",
      doubleHeader: "Y",
      gameNumber: 1,
    }),
    game({
      gamePk: 11,
      officialDate: "2025-04-10",
      homeTeamId: 147,
      awayTeamId: 111,
      homeScore: 0,
      awayScore: 5,
      commenceTimeUtc: "2025-04-10T21:10:00.000Z",
      doubleHeader: "Y",
      gameNumber: 2,
    }),
    game({
      gamePk: 12,
      officialDate: "2025-04-11",
      homeTeamId: 147,
      awayTeamId: 119,
      homeScore: 2,
      awayScore: 1,
      commenceTimeUtc: "2025-04-11T17:05:00.000Z",
    }),
  ]);
  const dhResult = materializeExternalReplicationSafeAFeatures2025(dh);
  const dh1 = findExternalReplicationFeatureRow2025(dhResult.artifact, 10)!;
  const dh2 = findExternalReplicationFeatureRow2025(dhResult.artifact, 11)!;
  const dh3 = findExternalReplicationFeatureRow2025(dhResult.artifact, 12)!;
  assert.equal(dh1.home.gamesPlayedBefore, dh2.home.gamesPlayedBefore);
  assert.equal(dh1.home.winsBefore, dh2.home.winsBefore);
  assert.equal(dh3.home.gamesPlayedBefore, 2);
  console.log("DOUBLEHEADER_FREEZE = PASS");

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
    game({
      gamePk: 9002,
      officialDate: "2025-06-02",
      homeTeamId: 111,
      awayTeamId: 147,
      homeScore: 5,
      awayScore: 1,
      commenceTimeUtc: "2025-06-02T17:05:00.000Z",
    }),
    game({
      gamePk: 9003,
      officialDate: "2025-08-01",
      homeTeamId: 111,
      awayTeamId: 137,
      homeScore: 2,
      awayScore: 0,
      commenceTimeUtc: "2025-08-01T17:05:00.000Z",
    }),
    game({
      gamePk: 9004,
      officialDate: "2025-08-02",
      homeTeamId: 111,
      awayTeamId: 119,
      homeScore: 3,
      awayScore: 2,
      commenceTimeUtc: "2025-08-02T17:05:00.000Z",
    }),
  ]);
  const resumeMat = materializeExternalReplicationSafeAFeatures2025(resume);
  const orig = findExternalReplicationFeatureRow2025(resumeMat.artifact, 9001)!;
  const nextOrig = findExternalReplicationFeatureRow2025(resumeMat.artifact, 9002)!;
  const applyDay = findExternalReplicationFeatureRow2025(resumeMat.artifact, 9003)!;
  const afterApply = findExternalReplicationFeatureRow2025(resumeMat.artifact, 9004)!;
  assert.equal(orig.home.gamesPlayedBefore, 0);
  assert.equal(nextOrig.home.gamesPlayedBefore, 0);
  assert.equal(applyDay.home.gamesPlayedBefore, 1);
  assert.equal(applyDay.home.winsBefore, 1);
  assert.equal(applyDay.home.lossesBefore, 0);
  assert.equal(afterApply.home.gamesPlayedBefore, 3);
  assert.equal(afterApply.home.winsBefore, 2);
  assert.equal(afterApply.home.lossesBefore, 1);
  console.log("CROSS_DATE_RESUME_ORIGINAL_DATE_BLOCK = PASS");
  console.log("CROSS_DATE_APPLY_DATE_FREEZE = PASS");
  console.log("NEXT_DATE_RESULT_AVAILABILITY = PASS");

  const shuffled = sourceFrom(shuffle(resume.games));
  const shuffledMat = materializeExternalReplicationSafeAFeatures2025(shuffled, {
    generatedAt: "2026-09-03T12:00:00.000Z",
  });
  assert.equal(shuffledMat.artifact.rows.length, resumeMat.artifact.rows.length);
  for (let i = 0; i < resumeMat.artifact.rows.length; i += 1) {
    assert.deepEqual(shuffledMat.artifact.rows[i], resumeMat.artifact.rows[i]);
  }
  console.log("SHUFFLED_SOURCE_ROWS_FEATURE_ARTIFACT_IDENTICAL = PASS");

  for (const row of sameDayResult.artifact.rows) {
    assert.equal(row.identity.gamePk, sameDay.games.find((g) => g.gamePk === row.identity.gamePk)?.gamePk);
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
  console.log("SOURCE_IDENTITY_PRESERVED = PASS");
  console.log("FEATURE_HASH_RECOMPUTATION = PASS");

  const walkKeys = (value: unknown, visit: (key: string) => void): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => walkKeys(item, visit));
      return;
    }
    if (typeof value !== "object" || value === null) return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      visit(key);
      walkKeys(child, visit);
    }
  };
  walkKeys(sameDayResult.artifact, (key) => {
    assert.equal(isProhibitedFeatureKey(key), false, key);
    const token = key.toLowerCase();
    assert.equal(token === "odds" || token === "market" || token === "winner", false, key);
  });
  console.log("MARKET_FIELD_SCAN = PASS");
  console.log("RESULT_LABEL_FIELD_SCAN = PASS");

  const matFiles = listTsFiles(LIB_DIR);
  for (const filePath of matFiles) {
    if (!filePath.endsWith("materialize-safe-a-2025.ts")) continue;
    const text = readFileSync(filePath, "utf8");
    assert.equal(text.includes("independent-logistic-v1"), false);
    assert.equal(text.includes("independent-logistic-v2a"), false);
    assert.equal(text.includes("independent-logistic-v2b"), false);
    assert.equal(text.includes("independent-logistic-v2c"), false);
    assert.equal(text.includes("independent-label-v1"), false);
  }
  console.log("NO_MODEL_IMPORTS = PASS");
  console.log("NO_LABEL_READS = PASS");

  const sourcePath = independentExternalReplication2025SourcePath();
  assert.equal(existsSync(sourcePath), true);
  const sourceBytesSha = sha256File(sourcePath);
  assert.equal(sourceBytesSha, MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256);
  const sealedSource = JSON.parse(readFileSync(sourcePath, "utf8"));
  assert.equal(sealedSource.rowCount, 2430);
  assert.equal(sealedSource.season, 2025);
  assert.equal(sealedSource.gameType, "R");
  assert.equal(sealedSource.source, "MLB_STATS_API");
  const sealed = materializeExternalReplicationSafeAFeatures2025(sealedSource, {
    expectedSourceSha256: sourceBytesSha,
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  assert.equal(sealed.audit.sourceRowCount, 2430);
  assert.equal(sealed.audit.featureRowCount, 2430);
  assert.equal(sealed.audit.excludedTargetCount, 0);
  assert.equal(sealed.audit.uniqueGamePkCount, 2430);
  assert.equal(sealed.audit.finalRollingStateMatchesSource, true);
  assert.equal(sealed.audit.teamRollingMismatchCount, 0);
  assert.equal(sealed.audit.taintedTeamCount, 0);
  assert.equal(sealed.audit.featureHashMismatchCount, 0);
  assert.equal(sealed.audit.featureHashVerificationCount, 2430);
  assert.equal(sealed.audit.resolvedCrossDateResumeCount, 4);
  assert.equal(sealed.audit.leakageChecks.sameDayResultUsed, false);
  assert.equal(sealed.audit.leakageChecks.targetResultUsed, false);
  assert.equal(sealed.audit.leakageChecks.crossDateResultAppliedToOriginalDate, false);
  assert.equal(sealed.audit.leakageChecks.temporalResultApplyViolationCount, 0);
  assert.equal(sealed.audit.leakageChecks.previousSeasonHistoryUsed, false);
  const hashCheck = verifyFeatureHashes2025(sealed.artifact);
  assert.equal(hashCheck.featureHashMismatchCount, 0);
  for (const pk of MLB_INDEPENDENT_2025_SEALED_CROSS_DATE_RESUME_GAME_PKS) {
    const row = findExternalReplicationFeatureRow2025(sealed.artifact, pk);
    assert.ok(row, `missing resume gamePk ${pk}`);
    const srcGame = sealedSource.games.find(
      (g: { gamePk: number }) => g.gamePk === pk,
    );
    assert.equal(row!.identity.officialDate, srcGame.officialDate);
  }
  const first = sealed.artifact.rows[0]!;
  assert.equal(first.identity.officialDate, "2025-03-18");
  assert.equal(sealed.audit.lastOfficialDate, "2025-09-28");
  console.log("SEALED_SOURCE_COUNT_SCHEMA = PASS");
  console.log("FINAL_ROLLING_SOURCE_RECONCILIATION = PASS");
  console.log("FEATURE_HASH_VERIFICATION = PASS");

  if (existsSync(independentExternalReplication2025FeaturePath())) {
    const persisted = JSON.parse(
      readFileSync(independentExternalReplication2025FeaturePath(), "utf8"),
    );
    assert.equal(persisted.rows.length, 2430);
    assert.equal(validateIndependentFeatureArtifactV1(persisted).ok, true);
    assert.equal(persisted.independentModelSample, 0);
    assert.equal(persisted.engineAdmission, "PROHIBITED");
    assert.equal(persisted.datasetReady, false);
  }
  if (existsSync(independentExternalReplication2025FeatureAuditPath())) {
    const persistedAudit = JSON.parse(
      readFileSync(independentExternalReplication2025FeatureAuditPath(), "utf8"),
    );
    assert.equal(persistedAudit.modelEvaluated, false);
    assert.equal(persistedAudit.labelsRead, undefined);
    assert.equal(persistedAudit.leakageChecks.labelsRead, false);
    assert.equal(persistedAudit.leakageChecks.modelRead, false);
    assert.equal(
      persistedAudit.sourceArtifactSha256,
      MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
    );
  }

  assertThrowsCode(
    () =>
      materializeExternalReplicationSafeAFeatures2025(sealedSource, {
        expectedSourceSha256: "ff".repeat(32),
      }),
    "SOURCE_SHA_PIN_MISMATCH",
    "sealed pin mismatch on materialize",
  );

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
  assert.equal(sha256File(independentLabelArtifactPath()), LABEL_SHA);
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
  for (const filePath of listTsFiles(LIB_DIR)) {
    if (!filePath.endsWith("materialize-safe-a-2025.ts")) continue;
    const text = readFileSync(filePath, "utf8");
    assert.equal(text.includes("holdoutGamePks"), false);
  }
  console.log("ALL_2024_SEALED_ARTIFACTS_UNCHANGED = PASS");
  console.log("2024_HOLDOUT_PROXY_SEAL = PASS");
  console.log("test:mlb-independent-external-replication-safe-a-2025 PASS");
}

main();
