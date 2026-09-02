/**
 * 2025 EXTERNAL REPLICATION TRACK — strict Feature ↔ Label join tests.
 * Identity-exact only. No split. No model. No metrics.
 *
 *   npm run test:mlb-independent-external-replication-join-2025
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
  isProhibitedFeatureKey,
  validateIndependentFeatureArtifactV1,
  validateIndependentLabelArtifactV1,
  type MlbIndependentFeatureArtifactV1,
  type MlbIndependentLabelArtifactV1,
} from "../src/lib/mlb/independent-model-v1";
import { hashIndependentFeatureRowV1 } from "../src/lib/mlb/independent-safe-a-v1/materialize";
import {
  MLB_INDEPENDENT_2025_JOIN_RESUME_GAME_PKS,
  MLB_INDEPENDENT_2025_JOIN_SCHEMA_V1,
  MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  ExternalReplicationJoinError,
  assertExternalReplication2025JoinFeaturePin,
  assertExternalReplication2025JoinLabelPin,
  hashExternalReplicationJoinArtifact2025,
  independentExternalReplication2025FeaturePath,
  independentExternalReplication2025JoinPath,
  independentExternalReplication2025LabelPath,
  independentExternalReplication2025SourcePath,
  joinExternalReplicationFeatureLabel2025,
} from "../src/lib/mlb/independent-external-replication-v1";

const ROOT = process.cwd();
const JOIN_LIB = path.join(
  ROOT,
  "src/lib/mlb/independent-external-replication-v1/join-feature-label-2025.ts",
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
const ORIGINAL_RESUME_DATES: Record<number, string> = {
  777861: "2025-05-19",
  777623: "2025-06-06",
  777294: "2025-07-01",
  776907: "2025-08-02",
};

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

function loadSealed(): {
  features: MlbIndependentFeatureArtifactV1;
  labels: MlbIndependentLabelArtifactV1;
} {
  return {
    features: JSON.parse(
      readFileSync(independentExternalReplication2025FeaturePath(), "utf8"),
    ),
    labels: JSON.parse(
      readFileSync(independentExternalReplication2025LabelPath(), "utf8"),
    ),
  };
}

function pairOfTwo(): {
  features: MlbIndependentFeatureArtifactV1;
  labels: MlbIndependentLabelArtifactV1;
} {
  const sealed = loadSealed();
  const features = clone(sealed.features);
  const labels = clone(sealed.labels);
  features.rows = features.rows.slice(0, 2);
  const pks = new Set(features.rows.map((r) => r.identity.gamePk));
  labels.rows = labels.rows.filter((r) => pks.has(r.identity.gamePk));
  return { features, labels };
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

function main(): void {
  try {
    assertExternalReplication2025JoinFeaturePin("0".repeat(64));
    assert.fail("feature pin mismatch should throw");
  } catch (e) {
    assert.equal((e as ExternalReplicationJoinError).code, "FEATURE_SHA_PIN_MISMATCH");
  }
  assertExternalReplication2025JoinFeaturePin(MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256);
  try {
    assertExternalReplication2025JoinLabelPin("0".repeat(64));
    assert.fail("label pin mismatch should throw");
  } catch (e) {
    assert.equal((e as ExternalReplicationJoinError).code, "LABEL_SHA_PIN_MISMATCH");
  }
  assertExternalReplication2025JoinLabelPin(MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256);
  console.log("FEATURE_SHA_PIN_MISMATCH_BLOCK = PASS");
  console.log("LABEL_SHA_PIN_MISMATCH_BLOCK = PASS");

  const { features, labels } = pairOfTwo();
  const ok = joinExternalReplicationFeatureLabel2025(features, labels);
  assert.equal(ok.artifact.rows.length, 2);
  assert.equal(ok.artifact.schemaVersion, MLB_INDEPENDENT_2025_JOIN_SCHEMA_V1);
  assert.equal(ok.artifact.joinReady, true);
  assert.equal(ok.artifact.datasetReady, false);
  assert.equal(ok.artifact.independentModelSample, 2);
  assert.equal(ok.artifact.researchOnly, true);
  assert.equal(ok.artifact.engineAdmission, "PROHIBITED");
  for (let i = 1; i < ok.artifact.rows.length; i += 1) {
    const prev = ok.artifact.rows[i - 1]!.identity;
    const cur = ok.artifact.rows[i]!.identity;
    const ordered =
      prev.officialDate < cur.officialDate ||
      (prev.officialDate === cur.officialDate &&
        (prev.commenceTimeUtc < cur.commenceTimeUtc ||
          (prev.commenceTimeUtc === cur.commenceTimeUtc && prev.gamePk < cur.gamePk)));
    assert.equal(ordered, true);
  }
  for (const row of ok.artifact.rows) {
    assert.equal(row.feature.identity.gamePk, row.label.identity.gamePk);
    assert.equal(row.featureHash, row.feature.featureHash);
    assert.equal(hashIndependentFeatureRowV1(row.feature), row.featureHash);
    assert.equal("safeResultApplyDate" in row.identity, false);
    assert.equal("winner" in (row.feature as unknown as Record<string, unknown>), false);
    assert.equal("target" in (row.feature as unknown as Record<string, unknown>), false);
    assert.equal("prediction" in row, false);
    assert.equal("probability" in row, false);
    walkKeys(row.feature, (key) => {
      assert.equal(isProhibitedFeatureKey(key), false, key);
    });
  }
  console.log("CANONICAL_FEATURE_VALIDATION = PASS");
  console.log("CANONICAL_LABEL_VALIDATION = PASS");
  console.log("JOIN_ORDER_CANONICAL = PASS");
  console.log("FEATURE_X_MARKET_RESULT_SCAN = PASS");

  const shuffledFeatures = clone(features);
  shuffledFeatures.rows = shuffle(shuffledFeatures.rows);
  const shuffledLabels = clone(labels);
  shuffledLabels.rows = shuffle(shuffledLabels.rows);
  const fromShuffledFeatures = joinExternalReplicationFeatureLabel2025(
    shuffledFeatures,
    labels,
    { generatedAt: "2026-09-03T00:00:00.000Z" },
  );
  const fromShuffledLabels = joinExternalReplicationFeatureLabel2025(features, shuffledLabels, {
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  const fromShuffledBoth = joinExternalReplicationFeatureLabel2025(
    shuffledFeatures,
    shuffledLabels,
    { generatedAt: "2026-09-03T12:00:00.000Z" },
  );
  const baseline = joinExternalReplicationFeatureLabel2025(features, labels, {
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  assert.deepEqual(fromShuffledFeatures.artifact.rows, baseline.artifact.rows);
  assert.deepEqual(fromShuffledLabels.artifact.rows, baseline.artifact.rows);
  assert.deepEqual(fromShuffledBoth.artifact.rows, baseline.artifact.rows);
  assert.equal(
    hashExternalReplicationJoinArtifact2025(fromShuffledBoth.artifact),
    hashExternalReplicationJoinArtifact2025(baseline.artifact),
  );
  console.log("SHUFFLED_FEATURE_ROWS_JOIN_IDENTICAL = PASS");
  console.log("SHUFFLED_LABEL_ROWS_JOIN_IDENTICAL = PASS");
  console.log("SHUFFLED_BOTH_JOIN_IDENTICAL = PASS");

  const missingLabel = clone(labels);
  missingLabel.rows = missingLabel.rows.slice(0, 1);
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(features, missingLabel),
    "FEATURE_LABEL_SET_MISMATCH",
    "feature-only",
  );
  const extraLabel = clone(labels);
  const extra = clone(extraLabel.rows[0]!);
  extra.identity.gamePk = 999999001;
  extraLabel.rows.push(extra);
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(features, extraLabel),
    "FEATURE_LABEL_SET_MISMATCH",
    "label-only",
  );
  const dupFeature = clone(features);
  dupFeature.rows.push(clone(dupFeature.rows[0]!));
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(dupFeature, labels),
    "DUPLICATE_FEATURE_GAMEPK",
    "duplicate feature",
  );
  const dupLabel = clone(labels);
  dupLabel.rows.push(clone(dupLabel.rows[0]!));
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(features, dupLabel),
    "DUPLICATE_LABEL_GAMEPK",
    "duplicate label",
  );
  const dateMismatch = clone(labels);
  dateMismatch.rows[0]!.identity.officialDate = "2023-01-01";
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(features, dateMismatch),
    "IDENTITY_MISMATCH_OFFICIAL_DATE",
    "officialDate",
  );
  const homeMismatch = clone(labels);
  homeMismatch.rows[0]!.identity.homeTeamId = 199;
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(features, homeMismatch),
    "IDENTITY_MISMATCH_HOME_TEAM_ID",
    "homeTeamId",
  );
  const awayMismatch = clone(labels);
  awayMismatch.rows[0]!.identity.awayTeamId = 198;
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(features, awayMismatch),
    "IDENTITY_MISMATCH_AWAY_TEAM_ID",
    "awayTeamId",
  );
  const commenceMismatch = clone(labels);
  commenceMismatch.rows[0]!.identity.commenceTimeUtc = "2025-01-01T00:00:00.000Z";
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(features, commenceMismatch),
    "IDENTITY_MISMATCH_COMMENCE_TIME_UTC",
    "commenceTimeUtc",
  );
  const hashNull = clone(features);
  hashNull.rows[0]!.featureHash = null;
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(hashNull, labels),
    "FEATURE_HASH_NULL",
    "null hash",
  );
  const hashMalformed = clone(features);
  hashMalformed.rows[0]!.featureHash = "not-a-hash";
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(hashMalformed, labels),
    "FEATURE_HASH_MALFORMED",
    "malformed hash",
  );
  const hashMismatch = clone(features);
  hashMismatch.rows[0]!.featureHash = "a".repeat(64);
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(hashMismatch, labels),
    "FEATURE_HASH_MISMATCH",
    "hash recompute",
  );
  const homeTarget0 = clone(labels);
  const homeRow =
    homeTarget0.rows.find((r) => r.winner === "HOME") ?? homeTarget0.rows[0]!;
  homeRow.winner = "HOME";
  homeRow.target = 0;
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(features, homeTarget0),
    "LABEL_TARGET_MISMATCH",
    "HOME target 0",
  );
  const awayTarget1 = clone(labels);
  const awayRow =
    awayTarget1.rows.find((r) => r.winner === "AWAY") ?? awayTarget1.rows[0]!;
  awayRow.winner = "AWAY";
  awayRow.target = 1;
  assertThrowsCode(
    () => joinExternalReplicationFeatureLabel2025(features, awayTarget1),
    "LABEL_TARGET_MISMATCH",
    "AWAY target 1",
  );
  console.log("DUPLICATE_AND_IDENTITY_BLOCKS = PASS");
  console.log("WINNER_TARGET_MISMATCH_BLOCK = PASS");

  const joinText = readFileSync(JOIN_LIB, "utf8");
  assert.equal(joinText.includes("independent-logistic-v1"), false);
  assert.equal(joinText.includes("independent-logistic-v2a"), false);
  assert.equal(joinText.includes("independent-logistic-v2b"), false);
  assert.equal(joinText.includes("independent-logistic-v2c"), false);
  assert.equal(joinText.includes("holdoutGamePks"), false);
  assert.equal(joinText.includes("rocAuc"), false);
  assert.equal(joinText.includes("logLoss"), false);
  assert.equal(joinText.includes("brier"), false);
  assert.equal(joinText.includes("accuracy"), false);
  console.log("NO_MODEL_IMPORTS = PASS");
  console.log("NO_MODEL_PREPROCESSING = PASS");
  console.log("NO_STATISTICS_METRICS = PASS");

  const featurePath = independentExternalReplication2025FeaturePath();
  const labelPath = independentExternalReplication2025LabelPath();
  const sourcePath = independentExternalReplication2025SourcePath();
  assert.equal(sha256File(featurePath), MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256);
  assert.equal(sha256File(labelPath), MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256);
  assert.equal(sha256File(sourcePath), MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256);
  const sealed = loadSealed();
  assert.equal(validateIndependentFeatureArtifactV1(sealed.features).ok, true);
  assert.equal(validateIndependentLabelArtifactV1(sealed.labels).ok, true);
  assert.equal(sealed.features.rows.length, 2430);
  assert.equal(sealed.labels.rows.length, 2430);
  const sealedJoin = joinExternalReplicationFeatureLabel2025(
    sealed.features,
    sealed.labels,
    {
      expectedFeatureSha256: MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
      expectedLabelSha256: MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
      generatedAt: "2026-09-03T00:00:00.000Z",
    },
  );
  assert.equal(sealedJoin.audit.featureRows, 2430);
  assert.equal(sealedJoin.audit.labelRows, 2430);
  assert.equal(sealedJoin.audit.joinedRows, 2430);
  assert.equal(sealedJoin.audit.featureOnlyCount, 0);
  assert.equal(sealedJoin.audit.labelOnlyCount, 0);
  assert.equal(sealedJoin.audit.identityMismatchCount, 0);
  assert.equal(sealedJoin.audit.duplicateFeatureGamePk, 0);
  assert.equal(sealedJoin.audit.duplicateLabelGamePk, 0);
  assert.equal(sealedJoin.audit.featureHashVerifiedCount, 2430);
  assert.equal(sealedJoin.audit.featureHashMismatchCount, 0);
  assert.equal(sealedJoin.audit.winnerTargetMismatchCount, 0);
  assert.equal(sealedJoin.audit.crossDateResumeIdentityMatchCount, 4);
  assert.equal(sealedJoin.audit.crossDateResumeIdentityMismatchCount, 0);
  assert.equal(sealedJoin.artifact.independentModelSample, 2430);
  assert.equal(sealedJoin.artifact.datasetReady, false);
  assert.equal(sealedJoin.audit.splitCreated, false);
  assert.equal(sealedJoin.audit.modelFeatureSelectionPerformed, false);
  assert.equal(sealedJoin.audit.modelPreprocessingPerformed, false);
  assert.equal(sealedJoin.audit.modelProbabilitiesCreated, false);
  assert.equal(sealedJoin.audit.featureLabelStatisticalAnalysisPerformed, false);
  console.log("EXACT_2430_COVERAGE = PASS");
  console.log("FEATURE_LABEL_SET_EQUAL = PASS");
  console.log("FEATURE_HASH_VERIFICATION = PASS");
  console.log("WINNER_TARGET_VERIFICATION = PASS");

  for (const pk of MLB_INDEPENDENT_2025_JOIN_RESUME_GAME_PKS) {
    const row = sealedJoin.artifact.rows.find((r) => r.identity.gamePk === pk);
    assert.ok(row, `missing resume join ${pk}`);
    const expected = ORIGINAL_RESUME_DATES[pk];
    assert.equal(row!.identity.officialDate, expected);
    assert.equal(row!.feature.identity.officialDate, expected);
    assert.equal(row!.label.identity.officialDate, expected);
    assert.equal("safeResultApplyDate" in row!.identity, false);
  }
  console.log("FOUR_RESUME_IDENTITIES = PASS");

  assertThrowsCode(
    () =>
      joinExternalReplicationFeatureLabel2025(sealed.features, sealed.labels, {
        expectedFeatureSha256: "ff".repeat(32),
      }),
    "FEATURE_SHA_PIN_MISMATCH",
    "sealed feature pin",
  );
  assertThrowsCode(
    () =>
      joinExternalReplicationFeatureLabel2025(sealed.features, sealed.labels, {
        expectedLabelSha256: "ff".repeat(32),
      }),
    "LABEL_SHA_PIN_MISMATCH",
    "sealed label pin",
  );

  assert.equal(sha256File(sourcePath), MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256);
  assert.equal(sha256File(featurePath), MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256);
  assert.equal(sha256File(labelPath), MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256);
  console.log("2025_SOURCE_UNCHANGED = PASS");
  console.log("2025_SAFE_A_UNCHANGED = PASS");
  console.log("2025_LABELS_UNCHANGED = PASS");

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

  if (existsSync(independentExternalReplication2025JoinPath())) {
    const persisted = JSON.parse(
      readFileSync(independentExternalReplication2025JoinPath(), "utf8"),
    );
    assert.equal(persisted.rows.length, 2430);
    assert.equal(persisted.datasetReady, false);
    assert.equal(persisted.joinReady, true);
  }

  console.log("test:mlb-independent-external-replication-join-2025 PASS");
}

main();
