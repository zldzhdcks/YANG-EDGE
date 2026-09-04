/**
 * 2023 MULTI-SEASON DEVELOPMENT TRACK — strict Feature ↔ Label join tests.
 * Identity-exact only. No split. No model. No metrics.
 *
 *   npm run test:mlb-independent-multiseason-join-2023
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
  MLB_INDEPENDENT_2023_JOIN_CROSS_DATE_RESUME_CASES,
  MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256,
  MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256,
  MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256,
  MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK,
  MLB_INDEPENDENT_MULTISEASON_STAGE_STRICT_JOIN,
  POST_V2C_RESEARCH_DIRECTION_REVIEW_SHA256,
  MultiseasonDevelopmentJoinError,
  assertMultiseasonDevelopment2023JoinFeaturePin,
  assertMultiseasonDevelopment2023JoinLabelPin,
  assertMultiseasonDevelopment2023JoinSourcePin,
  findMultiseasonDevelopmentJoinRow2023,
  hashMultiseasonDevelopmentJoinArtifact2023,
  independentMultiseasonDevelopment2023FeaturePath,
  independentMultiseasonDevelopment2023JoinPath,
  independentMultiseasonDevelopment2023LabelPath,
  independentMultiseasonDevelopment2023SourcePath,
  joinMultiseasonDevelopmentFeatureLabel2023,
  type MultiseasonDevelopmentSourceArtifact2023,
} from "../src/lib/mlb/independent-multiseason-development-v1";

const ROOT = process.cwd();
const JOIN_LIB = path.join(
  ROOT,
  "src/lib/mlb/independent-multiseason-development-v1/join-feature-label-2023.ts",
);
const JOIN_SCRIPT = path.join(
  ROOT,
  "scripts/join-mlb-independent-multiseason-2023.ts",
);
const DIRECTION_REVIEW_PATH = path.join(
  ROOT,
  "data/research/mlb/independent-model-v1/reviews/post-v2c-research-direction-review-v1.json",
);
const EVAL_2025_PATH = path.join(
  ROOT,
  "data/research/mlb/independent-model-v1/external-replication/2025/evaluations/2025-v2c-external-replication-evaluation-v1.json",
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
  source: MultiseasonDevelopmentSourceArtifact2023;
  features: MlbIndependentFeatureArtifactV1;
  labels: MlbIndependentLabelArtifactV1;
} {
  return {
    source: JSON.parse(
      readFileSync(independentMultiseasonDevelopment2023SourcePath(), "utf8"),
    ),
    features: JSON.parse(
      readFileSync(independentMultiseasonDevelopment2023FeaturePath(), "utf8"),
    ),
    labels: JSON.parse(
      readFileSync(independentMultiseasonDevelopment2023LabelPath(), "utf8"),
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
    assertMultiseasonDevelopment2023JoinSourcePin("0".repeat(64));
    assert.fail("source pin mismatch should throw");
  } catch (e) {
    assert.equal((e as MultiseasonDevelopmentJoinError).code, "SOURCE_SHA_PIN_MISMATCH");
  }
  assertMultiseasonDevelopment2023JoinSourcePin(MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256);
  try {
    assertMultiseasonDevelopment2023JoinFeaturePin("0".repeat(64));
    assert.fail("feature pin mismatch should throw");
  } catch (e) {
    assert.equal((e as MultiseasonDevelopmentJoinError).code, "FEATURE_SHA_PIN_MISMATCH");
  }
  assertMultiseasonDevelopment2023JoinFeaturePin(MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256);
  try {
    assertMultiseasonDevelopment2023JoinLabelPin("0".repeat(64));
    assert.fail("label pin mismatch should throw");
  } catch (e) {
    assert.equal((e as MultiseasonDevelopmentJoinError).code, "LABEL_SHA_PIN_MISMATCH");
  }
  assertMultiseasonDevelopment2023JoinLabelPin(MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256);
  console.log("SOURCE_SHA_PIN_MISMATCH_BLOCK = PASS");
  console.log("FEATURE_SHA_PIN_MISMATCH_BLOCK = PASS");
  console.log("LABEL_SHA_PIN_MISMATCH_BLOCK = PASS");

  const { features, labels } = pairOfTwo();
  const ok = joinMultiseasonDevelopmentFeatureLabel2023(features, labels);
  assert.equal(ok.artifact.rows.length, 2);
  assert.equal(ok.artifact.schemaVersion, "mlb-independent-feature-label-join-v1");
  assert.equal(ok.artifact.joinReady, true);
  assert.equal(ok.artifact.datasetReady, false);
  assert.equal(ok.artifact.independentModelSample, 2);
  assert.equal(ok.artifact.researchOnly, true);
  assert.equal(ok.artifact.engineAdmission, "PROHIBITED");
  assert.equal(ok.audit.track, MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK);
  assert.equal(ok.audit.stage, MLB_INDEPENDENT_MULTISEASON_STAGE_STRICT_JOIN);
  assert.equal(ok.audit.season, 2023);
  assert.equal(ok.audit.developmentEvidence, true);
  assert.equal(ok.audit.externalReplication, false);
  assert.equal(ok.audit.modelEvaluationAllowed, false);
  assert.equal(ok.audit.splitCreated, false);
  assert.equal(ok.audit.modelRead, false);
  assert.equal(ok.audit.statisticalAnalysisPerformed, false);
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
    assert.equal(row.schemaVersion, "mlb-independent-feature-label-join-row-v1");
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
      const token = key.toLowerCase();
      assert.equal(token.includes("od" + "ds"), false, key);
      assert.equal(token.includes("m" + "arket"), false, key);
      assert.equal(token.includes("impl" + "ied"), false, key);
    });
  }
  console.log("CANONICAL_JOIN_ROW_CONTRACT = PASS");
  console.log("JOIN_SORT_ORDER = PASS");
  console.log("MARKET_FIELDS_IN_JOIN_FEATURE_X = NO");

  const shuffledFeatures = clone(features);
  shuffledFeatures.rows = shuffle(shuffledFeatures.rows);
  const shuffledLabels = clone(labels);
  shuffledLabels.rows = shuffle(shuffledLabels.rows);
  const fromShuffledFeatures = joinMultiseasonDevelopmentFeatureLabel2023(
    shuffledFeatures,
    labels,
    { generatedAt: "2026-09-03T00:00:00.000Z" },
  );
  const fromShuffledLabels = joinMultiseasonDevelopmentFeatureLabel2023(
    features,
    shuffledLabels,
    { generatedAt: "2026-09-03T00:00:00.000Z" },
  );
  const fromShuffledBoth = joinMultiseasonDevelopmentFeatureLabel2023(
    shuffledFeatures,
    shuffledLabels,
    { generatedAt: "2026-09-03T12:00:00.000Z" },
  );
  const baseline = joinMultiseasonDevelopmentFeatureLabel2023(features, labels, {
    generatedAt: "2026-09-03T00:00:00.000Z",
  });
  assert.deepEqual(fromShuffledFeatures.artifact.rows, baseline.artifact.rows);
  assert.deepEqual(fromShuffledLabels.artifact.rows, baseline.artifact.rows);
  assert.deepEqual(fromShuffledBoth.artifact.rows, baseline.artifact.rows);
  assert.equal(
    hashMultiseasonDevelopmentJoinArtifact2023(fromShuffledBoth.artifact),
    hashMultiseasonDevelopmentJoinArtifact2023(baseline.artifact),
  );
  console.log("SHUFFLED_INPUT_ROWS_JOIN_RESULT_IDENTICAL = PASS");

  const missingLabel = clone(labels);
  missingLabel.rows = missingLabel.rows.slice(0, 1);
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(features, missingLabel),
    "FEATURE_LABEL_SET_MISMATCH",
    "feature-only",
  );
  const extraLabel = clone(labels);
  const extra = clone(extraLabel.rows[0]!);
  extra.identity.gamePk = 999999001;
  extraLabel.rows.push(extra);
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(features, extraLabel),
    "FEATURE_LABEL_SET_MISMATCH",
    "label-only",
  );
  const dupFeature = clone(features);
  dupFeature.rows.push(clone(dupFeature.rows[0]!));
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(dupFeature, labels),
    "DUPLICATE_FEATURE_GAMEPK",
    "duplicate feature",
  );
  const dupLabel = clone(labels);
  dupLabel.rows.push(clone(dupLabel.rows[0]!));
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(features, dupLabel),
    "DUPLICATE_LABEL_GAMEPK",
    "duplicate label",
  );
  const dateMismatch = clone(labels);
  dateMismatch.rows[0]!.identity.officialDate = "2023-01-01";
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(features, dateMismatch),
    "IDENTITY_MISMATCH_OFFICIAL_DATE",
    "officialDate",
  );
  const homeMismatch = clone(labels);
  homeMismatch.rows[0]!.identity.homeTeamId = 199;
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(features, homeMismatch),
    "IDENTITY_MISMATCH_HOME_TEAM_ID",
    "homeTeamId",
  );
  const awayMismatch = clone(labels);
  awayMismatch.rows[0]!.identity.awayTeamId = 198;
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(features, awayMismatch),
    "IDENTITY_MISMATCH_AWAY_TEAM_ID",
    "awayTeamId",
  );
  const commenceMismatch = clone(labels);
  commenceMismatch.rows[0]!.identity.commenceTimeUtc = "2023-01-01T00:00:00.000Z";
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(features, commenceMismatch),
    "IDENTITY_MISMATCH_COMMENCE_TIME_UTC",
    "commenceTimeUtc",
  );
  const hashNull = clone(features);
  hashNull.rows[0]!.featureHash = null;
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(hashNull, labels),
    "FEATURE_HASH_NULL",
    "null hash",
  );
  const hashMalformed = clone(features);
  hashMalformed.rows[0]!.featureHash = "not-a-hash";
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(hashMalformed, labels),
    "FEATURE_HASH_MALFORMED",
    "malformed hash",
  );
  const hashMismatch = clone(features);
  hashMismatch.rows[0]!.featureHash = "a".repeat(64);
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(hashMismatch, labels),
    "FEATURE_HASH_MISMATCH",
    "hash recompute",
  );
  const homeTarget0 = clone(labels);
  const homeRow =
    homeTarget0.rows.find((r) => r.winner === "HOME") ?? homeTarget0.rows[0]!;
  homeRow.winner = "HOME";
  homeRow.target = 0;
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(features, homeTarget0),
    "LABEL_TARGET_MISMATCH",
    "HOME target 0",
  );
  const awayTarget1 = clone(labels);
  const awayRow =
    awayTarget1.rows.find((r) => r.winner === "AWAY") ?? awayTarget1.rows[0]!;
  awayRow.winner = "AWAY";
  awayRow.target = 1;
  assertThrowsCode(
    () => joinMultiseasonDevelopmentFeatureLabel2023(features, awayTarget1),
    "LABEL_TARGET_MISMATCH",
    "AWAY target 1",
  );
  console.log("DUPLICATE_AND_IDENTITY_BLOCKS = PASS");
  console.log("WINNER_TARGET_MISMATCH_BLOCK = PASS");

  const joinText = readFileSync(JOIN_LIB, "utf8");
  const scriptText = readFileSync(JOIN_SCRIPT, "utf8");
  for (const text of [joinText, scriptText]) {
    assert.equal(text.includes("independent-logistic-v1"), false);
    assert.equal(text.includes("independent-logistic-v2a"), false);
    assert.equal(text.includes("independent-logistic-v2b"), false);
    assert.equal(text.includes("independent-logistic-v2c"), false);
    assert.equal(text.includes("holdoutGamePks"), false);
    assert.equal(text.includes("rocAuc"), false);
    assert.equal(text.includes("logLoss"), false);
    assert.equal(text.includes("brier"), false);
    assert.equal(text.includes("accuracy"), false);
    assert.equal(text.includes("getRawStatsJson"), false);
    assert.equal(text.includes("statsapi.mlb.com"), false);
    assert.equal(text.includes("fetch("), false);
    assert.equal(text.includes("independent-split-v1"), false);
    assert.equal(text.includes("independent-external-replication-v1"), false);
  }
  console.log("NO_MODEL_IMPORTS = PASS");
  console.log("NO_SPLIT = PASS");
  console.log("NO_STATISTICS_METRICS = PASS");
  console.log("NETWORK_USED = NO");

  const sourcePath = independentMultiseasonDevelopment2023SourcePath();
  const featurePath = independentMultiseasonDevelopment2023FeaturePath();
  const labelPath = independentMultiseasonDevelopment2023LabelPath();
  assert.equal(sha256File(sourcePath), MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256);
  assert.equal(sha256File(featurePath), MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256);
  assert.equal(sha256File(labelPath), MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256);
  const sealed = loadSealed();
  assert.equal(validateIndependentFeatureArtifactV1(sealed.features).ok, true);
  assert.equal(validateIndependentLabelArtifactV1(sealed.labels).ok, true);
  assert.equal(sealed.source.rowCount, 2430);
  assert.equal(sealed.features.rows.length, 2430);
  assert.equal(sealed.labels.rows.length, 2430);
  const sealedJoin = joinMultiseasonDevelopmentFeatureLabel2023(
    sealed.features,
    sealed.labels,
    {
      source: sealed.source,
      expectedSourceSha256: MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256,
      expectedFeatureSha256: MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256,
      expectedLabelSha256: MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256,
      generatedAt: "2026-09-03T00:00:00.000Z",
    },
  );
  assert.equal(sealedJoin.audit.sourceRows, 2430);
  assert.equal(sealedJoin.audit.featureRows, 2430);
  assert.equal(sealedJoin.audit.labelRows, 2430);
  assert.equal(sealedJoin.audit.joinedRows, 2430);
  assert.equal(sealedJoin.audit.featureUniqueGamePk, 2430);
  assert.equal(sealedJoin.audit.labelUniqueGamePk, 2430);
  assert.equal(sealedJoin.audit.featureOnlyCount, 0);
  assert.equal(sealedJoin.audit.labelOnlyCount, 0);
  assert.equal(sealedJoin.audit.identityMismatchCount, 0);
  assert.equal(sealedJoin.audit.officialDateMismatchCount, 0);
  assert.equal(sealedJoin.audit.commenceTimeUtcMismatchCount, 0);
  assert.equal(sealedJoin.audit.homeTeamIdMismatchCount, 0);
  assert.equal(sealedJoin.audit.awayTeamIdMismatchCount, 0);
  assert.equal(sealedJoin.audit.sourceFeatureIdentityMismatchCount, 0);
  assert.equal(sealedJoin.audit.sourceLabelIdentityMismatchCount, 0);
  assert.equal(sealedJoin.audit.featureLabelIdentityMismatchCount, 0);
  assert.equal(sealedJoin.audit.duplicateFeatureGamePk, 0);
  assert.equal(sealedJoin.audit.duplicateLabelGamePk, 0);
  assert.equal(sealedJoin.audit.featureHashVerifiedCount, 2430);
  assert.equal(sealedJoin.audit.featureHashMismatchCount, 0);
  assert.equal(sealedJoin.audit.winnerTargetMismatchCount, 0);
  assert.equal(sealedJoin.audit.crossDateJoinIdentityMismatchCount, 0);
  assert.equal(sealedJoin.artifact.independentModelSample, 2430);
  assert.equal(sealedJoin.artifact.datasetReady, false);
  assert.equal(sealedJoin.audit.splitCreated, false);
  assert.equal(sealedJoin.audit.modelProbabilitiesCreated, false);
  assert.equal(sealedJoin.audit.statisticalAnalysisPerformed, false);
  console.log("EXACT_2430_COVERAGE = PASS");
  console.log("FEATURE_LABEL_SET_EQUAL = PASS");
  console.log("FEATURE_HASH_VERIFICATION = PASS");
  console.log("WINNER_TARGET_VERIFICATION = PASS");
  console.log("SOURCE_LINEAGE_IDENTITY = PASS");

  for (const resume of MLB_INDEPENDENT_2023_JOIN_CROSS_DATE_RESUME_CASES) {
    const row = findMultiseasonDevelopmentJoinRow2023(
      sealedJoin.artifact,
      resume.gamePk,
    );
    assert.ok(row, `missing resume join ${resume.gamePk}`);
    assert.equal(row!.identity.officialDate, resume.officialDate);
    assert.equal(row!.feature.identity.officialDate, resume.officialDate);
    assert.equal(row!.label.identity.officialDate, resume.officialDate);
    assert.notEqual(row!.identity.officialDate, resume.applyDate);
    assert.equal("safeResultApplyDate" in row!.identity, false);
  }
  const resume716404 = findMultiseasonDevelopmentJoinRow2023(
    sealedJoin.artifact,
    716404,
  );
  assert.ok(resume716404);
  assert.equal(resume716404.identity.officialDate, "2023-09-28");
  assert.notEqual(resume716404.identity.officialDate, "2023-10-02");
  console.log("CROSS_DATE_JOIN_IDENTITY_PRESERVED = PASS");
  console.log("716404_JOINS_ON_2023_09_28 = PASS");

  assertThrowsCode(
    () =>
      joinMultiseasonDevelopmentFeatureLabel2023(sealed.features, sealed.labels, {
        expectedSourceSha256: "ff".repeat(32),
      }),
    "SOURCE_SHA_PIN_MISMATCH",
    "sealed source pin",
  );
  assertThrowsCode(
    () =>
      joinMultiseasonDevelopmentFeatureLabel2023(sealed.features, sealed.labels, {
        expectedFeatureSha256: "ff".repeat(32),
      }),
    "FEATURE_SHA_PIN_MISMATCH",
    "sealed feature pin",
  );
  assertThrowsCode(
    () =>
      joinMultiseasonDevelopmentFeatureLabel2023(sealed.features, sealed.labels, {
        expectedLabelSha256: "ff".repeat(32),
      }),
    "LABEL_SHA_PIN_MISMATCH",
    "sealed label pin",
  );

  assert.equal(sha256File(sourcePath), MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256);
  assert.equal(sha256File(featurePath), MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256);
  assert.equal(sha256File(labelPath), MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256);
  console.log("2023_SOURCE_UNCHANGED = PASS");
  console.log("FEATURE_ARTIFACT_UNCHANGED = PASS");
  console.log("LABEL_ARTIFACT_UNCHANGED = PASS");

  const directionBytes = sha256File(DIRECTION_REVIEW_PATH);
  assert.equal(directionBytes, POST_V2C_RESEARCH_DIRECTION_REVIEW_SHA256);
  const directionReview = JSON.parse(readFileSync(DIRECTION_REVIEW_PATH, "utf8")) as {
    v2cCycleStatus: string;
    newModelTrainingAllowedNow: boolean;
    "2025ExternalState": string;
    postExposureDiagnosticPerformed: boolean;
  };
  assert.equal(directionReview.v2cCycleStatus, "CLOSED");
  assert.equal(directionReview.newModelTrainingAllowedNow, false);
  assert.equal(directionReview["2025ExternalState"], "EXTERNAL_REPLICATION_EXPOSED");
  assert.equal(directionReview.postExposureDiagnosticPerformed, false);
  console.log("RESEARCH_DIRECTION_PIN = PASS");
  console.log("NEW_MODEL_TRAINING_ALLOWED_NOW = NO");

  assert.equal(sha256File(EVAL_2025_PATH), EVAL_2025_SHA);
  console.log("2025_EXTERNAL_REPLICATION_STATE = EXTERNAL_REPLICATION_EXPOSED");
  console.log("2025_ROWS_INSPECTED = NO");
  console.log("2025_POST_EXPOSURE_DIAGNOSTIC_PERFORMED = NO");

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
  console.log("2024_HOLDOUT_MEMBERSHIP_COUNT = 483");
  console.log("2024_HOLDOUT_FEATURE_ROWS_READ = 0");
  console.log("2024_HOLDOUT_LABEL_ROWS_READ = 0");
  console.log("2024_HOLDOUT_EVALUATED = NO");

  if (existsSync(independentMultiseasonDevelopment2023JoinPath())) {
    const persisted = JSON.parse(
      readFileSync(independentMultiseasonDevelopment2023JoinPath(), "utf8"),
    );
    assert.equal(persisted.rows.length, 2430);
    assert.equal(persisted.datasetReady, false);
    assert.equal(persisted.joinReady, true);
    assert.equal(
      hashMultiseasonDevelopmentJoinArtifact2023(persisted),
      hashMultiseasonDevelopmentJoinArtifact2023(sealedJoin.artifact),
    );
  }

  console.log("test:mlb-independent-multiseason-join-2023 PASS");
}

main();
