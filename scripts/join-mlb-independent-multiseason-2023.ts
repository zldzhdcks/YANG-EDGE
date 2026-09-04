/**
 * Strict-join sealed 2023 SAFE_A features with sealed 2023 HOME_WIN labels.
 * LOCAL ONLY. Identity-exact. No split. No model. No metrics.
 *
 *   npm run join:mlb-independent-multiseason-2023
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256,
  MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256,
  MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256,
  independentMultiseasonDevelopment2023FeaturePath,
  independentMultiseasonDevelopment2023FeatureRel,
  independentMultiseasonDevelopment2023JoinAuditPath,
  independentMultiseasonDevelopment2023JoinAuditRel,
  independentMultiseasonDevelopment2023JoinPath,
  independentMultiseasonDevelopment2023JoinRel,
  independentMultiseasonDevelopment2023LabelPath,
  independentMultiseasonDevelopment2023LabelRel,
  independentMultiseasonDevelopment2023SourcePath,
  independentMultiseasonDevelopment2023SourceRel,
  joinMultiseasonDevelopmentFeatureLabel2023,
  serializeMultiseasonDevelopmentJson,
} from "../src/lib/mlb/independent-multiseason-development-v1";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, serializeMultiseasonDevelopmentJson(value), "utf8");
  await rename(tmp, filePath);
}

function sha256Bytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function main(): Promise<void> {
  console.log("=== Join MLB Independent Multi-Season Development 2023 ===");
  const sourcePath = independentMultiseasonDevelopment2023SourcePath();
  const featurePath = independentMultiseasonDevelopment2023FeaturePath();
  const labelPath = independentMultiseasonDevelopment2023LabelPath();
  const sourceBuf = await readFile(sourcePath);
  const featureBuf = await readFile(featurePath);
  const labelBuf = await readFile(labelPath);
  const sourceSha256 = sha256Bytes(sourceBuf);
  const featureSha256 = sha256Bytes(featureBuf);
  const labelSha256 = sha256Bytes(labelBuf);
  if (sourceSha256 !== MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256) {
    throw new Error(
      `SOURCE_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256} got ${sourceSha256}`,
    );
  }
  if (featureSha256 !== MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256) {
    throw new Error(
      `FEATURE_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256} got ${featureSha256}`,
    );
  }
  if (labelSha256 !== MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256) {
    throw new Error(
      `LABEL_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256} got ${labelSha256}`,
    );
  }

  const source = JSON.parse(sourceBuf.toString("utf8"));
  const features = JSON.parse(featureBuf.toString("utf8"));
  const labels = JSON.parse(labelBuf.toString("utf8"));
  const result = joinMultiseasonDevelopmentFeatureLabel2023(features, labels, {
    source,
    expectedSourceSha256: sourceSha256,
    expectedFeatureSha256: featureSha256,
    expectedLabelSha256: labelSha256,
    sourcePath: independentMultiseasonDevelopment2023SourceRel(),
    featurePath: independentMultiseasonDevelopment2023FeatureRel(),
    labelPath: independentMultiseasonDevelopment2023LabelRel(),
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
  if (result.audit.crossDateJoinIdentityMismatchCount !== 0) {
    throw new Error("CROSS_DATE_JOIN_IDENTITY_MISMATCH_COUNT != 0");
  }

  await writeJsonAtomic(independentMultiseasonDevelopment2023JoinPath(), result.artifact);
  await writeJsonAtomic(independentMultiseasonDevelopment2023JoinAuditPath(), result.audit);

  const sourceAfter = sha256Bytes(await readFile(sourcePath));
  const featureAfter = sha256Bytes(await readFile(featurePath));
  const labelAfter = sha256Bytes(await readFile(labelPath));
  if (sourceAfter !== MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256) {
    throw new Error("SOURCE_ARTIFACT_UNCHANGED = FAIL");
  }
  if (featureAfter !== MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256) {
    throw new Error("FEATURE_ARTIFACT_UNCHANGED = FAIL");
  }
  if (labelAfter !== MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256) {
    throw new Error("LABEL_ARTIFACT_UNCHANGED = FAIL");
  }

  console.log("SOURCE_SHA_PIN_MATCH=PASS");
  console.log("FEATURE_SHA_PIN_MATCH=PASS");
  console.log("LABEL_SHA_PIN_MATCH=PASS");
  console.log(`sourceRows=${result.audit.sourceRows}`);
  console.log(`featureRows=${result.audit.featureRows}`);
  console.log(`labelRows=${result.audit.labelRows}`);
  console.log(`JOINED_ROWS=${result.audit.joinedRows}`);
  console.log(`featureOnlyCount=${result.audit.featureOnlyCount}`);
  console.log(`labelOnlyCount=${result.audit.labelOnlyCount}`);
  console.log(`identityMismatchCount=${result.audit.identityMismatchCount}`);
  console.log(`featureHashVerifiedCount=${result.audit.featureHashVerifiedCount}`);
  console.log(`winnerTargetMismatchCount=${result.audit.winnerTargetMismatchCount}`);
  console.log(
    `crossDateJoinIdentityMismatchCount=${result.audit.crossDateJoinIdentityMismatchCount}`,
  );
  console.log(`joinArtifactSha256=${result.audit.joinArtifactSha256}`);
  console.log("FEATURE_ARTIFACT_UNCHANGED=PASS");
  console.log("LABEL_ARTIFACT_UNCHANGED=PASS");
  console.log("SOURCE_ARTIFACT_UNCHANGED=PASS");
  console.log("STATISTICAL_ANALYSIS_PERFORMED=NO");
  console.log("NETWORK_USED=NO");
  console.log(`join artifact=${independentMultiseasonDevelopment2023JoinRel()}`);
  console.log(`audit artifact=${independentMultiseasonDevelopment2023JoinAuditRel()}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});
