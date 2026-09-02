/**
 * Strict-join sealed 2025 SAFE_A features with sealed 2025 HOME_WIN labels.
 * LOCAL ONLY. Identity-exact. No split. No model. No metrics.
 *
 *   npm run join:mlb-independent-external-replication-2025
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256,
  MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256,
  independentExternalReplication2025FeaturePath,
  independentExternalReplication2025FeatureRel,
  independentExternalReplication2025JoinAuditPath,
  independentExternalReplication2025JoinAuditRel,
  independentExternalReplication2025JoinPath,
  independentExternalReplication2025JoinRel,
  independentExternalReplication2025LabelPath,
  independentExternalReplication2025LabelRel,
  joinExternalReplicationFeatureLabel2025,
  serializeExternalReplicationJson,
} from "../src/lib/mlb/independent-external-replication-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeExternalReplicationJson(value), "utf8");
  await rename(tmp, filePath);
}

function sha256Bytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function main(): Promise<void> {
  console.log("=== Join MLB Independent External Replication 2025 ===");
  const featurePath = independentExternalReplication2025FeaturePath();
  const labelPath = independentExternalReplication2025LabelPath();
  const featureBuf = await readFile(featurePath);
  const labelBuf = await readFile(labelPath);
  const featureSha256 = sha256Bytes(featureBuf);
  const labelSha256 = sha256Bytes(labelBuf);
  if (featureSha256 !== MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256) {
    throw new Error(
      `FEATURE_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256} got ${featureSha256}`,
    );
  }
  if (labelSha256 !== MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256) {
    throw new Error(
      `LABEL_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256} got ${labelSha256}`,
    );
  }

  const features = JSON.parse(featureBuf.toString("utf8"));
  const labels = JSON.parse(labelBuf.toString("utf8"));
  const result = joinExternalReplicationFeatureLabel2025(features, labels, {
    expectedFeatureSha256: featureSha256,
    expectedLabelSha256: labelSha256,
  });

  if (result.audit.joinedRows !== 2430) {
    throw new Error(`JOINED_ROWS ${result.audit.joinedRows} != 2430`);
  }
  if (result.audit.featureOnlyCount !== 0 || result.audit.labelOnlyCount !== 0) {
    throw new Error("FEATURE_LABEL_SET_EQUAL = FAIL");
  }
  if (result.audit.identityMismatchCount !== 0) {
    throw new Error(`IDENTITY_MISMATCH_COUNT ${result.audit.identityMismatchCount}`);
  }

  await writeJsonAtomic(independentExternalReplication2025JoinPath(), result.artifact);
  await writeJsonAtomic(independentExternalReplication2025JoinAuditPath(), result.audit);

  console.log("FEATURE_SHA_PIN_MATCH=PASS");
  console.log("LABEL_SHA_PIN_MATCH=PASS");
  console.log(`featureRows=${result.audit.featureRows}`);
  console.log(`labelRows=${result.audit.labelRows}`);
  console.log(`JOINED_ROWS=${result.audit.joinedRows}`);
  console.log(`featureOnlyCount=${result.audit.featureOnlyCount}`);
  console.log(`labelOnlyCount=${result.audit.labelOnlyCount}`);
  console.log(`identityMismatchCount=${result.audit.identityMismatchCount}`);
  console.log(`featureHashVerifiedCount=${result.audit.featureHashVerifiedCount}`);
  console.log(`joinArtifactSha256=${result.audit.joinArtifactSha256}`);
  console.log(`featureRel=${independentExternalReplication2025FeatureRel()}`);
  console.log(`labelRel=${independentExternalReplication2025LabelRel()}`);
  console.log(`join artifact=${independentExternalReplication2025JoinRel()}`);
  console.log(`audit artifact=${independentExternalReplication2025JoinAuditRel()}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});
