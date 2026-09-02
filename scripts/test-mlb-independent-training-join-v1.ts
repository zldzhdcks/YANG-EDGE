/**
 * MLB Independent strict Feature ↔ Label join tests.
 * No network. No split, trainer, model, or engine wiring.
 *
 *   npm run test:mlb-independent-training-join-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  independentJoinArtifactPath,
  independentJoinAuditPath,
  joinIndependentFeatureLabelV1,
} from "../src/lib/mlb/independent-join-v1";
import { independentLabelArtifactPath } from "../src/lib/mlb/independent-label-v1";
import {
  independentSafeAFeatureArtifactPath,
  independentSafeAHistoricalSourcePath,
} from "../src/lib/mlb/independent-safe-a-v1/historical-source";
import type { MlbIndependentFeatureArtifactV1 } from "../src/lib/mlb/independent-model-v1";
import type { MlbIndependentLabelArtifactV1 } from "../src/lib/mlb/independent-model-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-join-v1");
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";

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

function loadSealed(): {
  features: MlbIndependentFeatureArtifactV1;
  labels: MlbIndependentLabelArtifactV1;
} {
  return {
    features: JSON.parse(
      readFileSync(independentSafeAFeatureArtifactPath(), "utf8"),
    ),
    labels: JSON.parse(readFileSync(independentLabelArtifactPath(), "utf8")),
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
  const { features, labels } = pairOfTwo();
  const ok = joinIndependentFeatureLabelV1(features, labels);
  assert.equal(ok.artifact.rows.length, 2);
  assert.equal(ok.artifact.joinReady, true);
  assert.equal(ok.artifact.datasetReady, false);
  assert.equal(ok.artifact.independentModelSample, 2);
  assert.equal(ok.artifact.researchOnly, true);
  assert.equal(ok.artifact.engineAdmission, "PROHIBITED");
  for (const row of ok.artifact.rows) {
    assert.equal(row.feature.identity.gamePk, row.label.identity.gamePk);
    assert.equal(row.featureHash, row.feature.featureHash);
    assert.equal("safeResultApplyDate" in row.identity, false);
    assert.notEqual(row.feature, row.label);
    assert.equal("winner" in (row.feature as unknown as Record<string, unknown>), false);
    assert.equal("target" in (row.feature as unknown as Record<string, unknown>), false);
  }

  const shuffledFeatures = clone(features);
  shuffledFeatures.rows = shuffle(shuffledFeatures.rows);
  const shuffledLabels = clone(labels);
  shuffledLabels.rows = shuffle(shuffledLabels.rows);
  const fromShuffledFeatures = joinIndependentFeatureLabelV1(
    shuffledFeatures,
    labels,
  );
  const fromShuffledLabels = joinIndependentFeatureLabelV1(
    features,
    shuffledLabels,
  );
  assert.deepEqual(
    fromShuffledFeatures.artifact.rows.map((r) => r.identity.gamePk),
    ok.artifact.rows.map((r) => r.identity.gamePk),
  );
  assert.deepEqual(
    fromShuffledLabels.artifact.rows.map((r) => r.identity.gamePk),
    ok.artifact.rows.map((r) => r.identity.gamePk),
  );
  console.log("SHUFFLED_FEATURE_INPUT = PASS");
  console.log("SHUFFLED_LABEL_INPUT = PASS");

  const missingLabel = clone(labels);
  missingLabel.rows = missingLabel.rows.slice(0, 1);
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(features, missingLabel),
    "FEATURE_LABEL_SET_MISMATCH",
    "missing label",
  );

  const extraLabel = clone(labels);
  const extra = clone(extraLabel.rows[0]!);
  extra.identity.gamePk = 999999001;
  extraLabel.rows.push(extra);
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(features, extraLabel),
    "FEATURE_LABEL_SET_MISMATCH",
    "extra label",
  );

  const dupFeature = clone(features);
  dupFeature.rows.push(clone(dupFeature.rows[0]!));
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(dupFeature, labels),
    "DUPLICATE_FEATURE_GAMEPK",
    "duplicate feature",
  );

  const dupLabel = clone(labels);
  dupLabel.rows.push(clone(dupLabel.rows[0]!));
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(features, dupLabel),
    "DUPLICATE_LABEL_GAMEPK",
    "duplicate label",
  );

  const dateMismatch = clone(labels);
  dateMismatch.rows[0]!.identity.officialDate = "2023-01-01";
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(features, dateMismatch),
    "IDENTITY_MISMATCH_OFFICIAL_DATE",
    "officialDate mismatch",
  );

  const homeMismatch = clone(labels);
  homeMismatch.rows[0]!.identity.homeTeamId = 199;
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(features, homeMismatch),
    "IDENTITY_MISMATCH_HOME_TEAM_ID",
    "homeTeamId mismatch",
  );

  const awayMismatch = clone(labels);
  awayMismatch.rows[0]!.identity.awayTeamId = 198;
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(features, awayMismatch),
    "IDENTITY_MISMATCH_AWAY_TEAM_ID",
    "awayTeamId mismatch",
  );

  const commenceMismatch = clone(labels);
  commenceMismatch.rows[0]!.identity.commenceTimeUtc = "2024-01-01T00:00:00.000Z";
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(features, commenceMismatch),
    "IDENTITY_MISMATCH_COMMENCE_TIME_UTC",
    "commenceTimeUtc mismatch",
  );

  const hashNull = clone(features);
  hashNull.rows[0]!.featureHash = null;
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(hashNull, labels),
    "FEATURE_HASH_NULL",
    "featureHash null",
  );

  const hashMalformed = clone(features);
  hashMalformed.rows[0]!.featureHash = "not-a-hash";
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(hashMalformed, labels),
    "FEATURE_HASH_MALFORMED",
    "featureHash malformed",
  );

  const hashMismatch = clone(features);
  hashMismatch.rows[0]!.featureHash = "a".repeat(64);
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(hashMismatch, labels),
    "FEATURE_HASH_MISMATCH",
    "featureHash recomputation mismatch",
  );

  const homeTarget0 = clone(labels);
  const homeRow = homeTarget0.rows.find((r) => r.winner === "HOME") ?? homeTarget0.rows[0]!;
  homeRow.winner = "HOME";
  homeRow.target = 0;
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(features, homeTarget0),
    "LABEL_TARGET_MISMATCH",
    "HOME + target 0",
  );

  const awayTarget1 = clone(labels);
  const awayRow = awayTarget1.rows.find((r) => r.winner === "AWAY") ?? awayTarget1.rows[0]!;
  awayRow.winner = "AWAY";
  awayRow.target = 1;
  assertThrowsCode(
    () => joinIndependentFeatureLabelV1(features, awayTarget1),
    "LABEL_TARGET_MISMATCH",
    "AWAY + target 1",
  );

  const libFiles = ["join.ts", "index.ts"];
  for (const file of libFiles) {
    const text = readFileSync(path.join(LIB_DIR, file), "utf8");
    assert.equal(text.includes("prediction-v0"), false);
    assert.equal(text.includes("statsapi.mlb.com"), false);
    assert.equal(text.includes("fetch("), false);
    assert.equal(text.includes("logistic"), false);
    assert.equal(text.includes("xgboost"), false);
    assert.equal(text.includes("odds"), false);
    assert.equal(text.includes("market"), false);
  }

  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), FEATURE_BEFORE);
  assert.equal(sha256File(independentLabelArtifactPath()), LABEL_BEFORE);
  assert.equal(sha256File(independentSafeAHistoricalSourcePath()), SOURCE_BEFORE);
  console.log("FEATURE_ARTIFACT_CHANGED = NO");
  console.log("LABEL_ARTIFACT_CHANGED = NO");
  console.log("HISTORICAL_SOURCE_CHANGED = NO");

  const joinPath = independentJoinArtifactPath();
  const auditPath = independentJoinAuditPath();
  if (existsSync(joinPath) && existsSync(auditPath)) {
    const sealed = loadSealed();
    const realJoin = JSON.parse(readFileSync(joinPath, "utf8"));
    const realAudit = JSON.parse(readFileSync(auditPath, "utf8"));
    const replay = joinIndependentFeatureLabelV1(sealed.features, sealed.labels, {
      generatedAt: realAudit.generatedAt,
      featureArtifactHash: FEATURE_BEFORE,
      labelArtifactHash: LABEL_BEFORE,
    });
    assert.equal(replay.artifact.rows.length, 2429);
    assert.equal(realJoin.rows.length, 2429);
    assert.equal(replay.artifact.independentModelSample, 2429);
    assert.equal(realJoin.datasetReady, false);
    assert.equal(realJoin.joinReady, true);
    assert.equal(realAudit.featureOnlyCount, 0);
    assert.equal(realAudit.labelOnlyCount, 0);
    assert.equal(realAudit.featureHashVerifiedCount, 2429);
    assert.equal(realAudit.featureHashMismatchCount, 0);
    assert.equal(realAudit.identityMismatchCount, 0);
    assert.equal(realAudit.cancelled.joinCount, 0);
    assert.equal(
      realJoin.rows.some(
        (r: { identity: { gamePk: number } }) => r.identity.gamePk === 746577,
      ),
      false,
    );
    const r745180 = realJoin.rows.find(
      (r: { identity: { gamePk: number } }) => r.identity.gamePk === 745180,
    );
    const r746942 = realJoin.rows.find(
      (r: { identity: { gamePk: number } }) => r.identity.gamePk === 746942,
    );
    const r746755 = realJoin.rows.find(
      (r: { identity: { gamePk: number } }) => r.identity.gamePk === 746755,
    );
    assert.equal(r745180.identity.officialDate, "2024-05-21");
    assert.equal(r745180.feature.identity.officialDate, "2024-05-21");
    assert.equal(r745180.label.identity.officialDate, "2024-05-21");
    assert.equal(r746942.identity.officialDate, "2024-06-26");
    assert.equal(r746942.feature.identity.officialDate, "2024-06-26");
    assert.equal(r746942.label.identity.officialDate, "2024-06-26");
    assert.equal(r746755.identity.officialDate, "2024-08-27");
    assert.equal(r746755.feature.identity.officialDate, "2024-08-27");
    assert.equal(r746755.label.identity.officialDate, "2024-08-27");
    assert.equal(replay.artifact.rows[0]!.identity.gamePk, realJoin.rows[0]!.identity.gamePk);
    console.log(`JOINED_ROWS=${realJoin.rows.length}`);
    console.log(`INDEPENDENT_MODEL_SAMPLE=${realJoin.independentModelSample}`);
    console.log(`FEATURE_ONLY_GAMEPK_COUNT=${realAudit.featureOnlyCount}`);
    console.log(`LABEL_ONLY_GAMEPK_COUNT=${realAudit.labelOnlyCount}`);
  }

  console.log("test:mlb-independent-training-join-v1 PASS");
  console.log("DATASET_READY = false");
}

main();
