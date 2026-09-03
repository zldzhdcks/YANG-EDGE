/**
 * Pre-register the frozen 2025 v2-C external replication protocol.
 * LOCAL ONLY. Protocol freeze. No 2025 transform, logits, probabilities, or metrics.
 *
 *   npm run preregister:mlb-independent-external-replication-v2c-2025
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256,
  MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH,
  independentExternalReplication2025JoinPath,
  independentExternalReplication2025JoinRel,
  independentExternalReplication2025V2cProtocolAuditPath,
  independentExternalReplication2025V2cProtocolAuditRel,
  independentExternalReplication2025V2cProtocolPath,
  independentExternalReplication2025V2cProtocolRel,
  independentSealedV2cModelArtifactPath,
  independentSealedV2cModelArtifactRel,
  preregisterV2cExternalReplicationProtocol2025,
  serializeExternalReplicationJson,
  type FrozenV2cModelProtocolView,
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
  console.log("=== Pre-register MLB Independent External Replication v2-C Protocol 2025 ===");
  const joinPath = independentExternalReplication2025JoinPath();
  const modelPath = independentSealedV2cModelArtifactPath();
  const joinBuf = await readFile(joinPath);
  const joinArtifactSha256 = sha256Bytes(joinBuf);
  if (joinArtifactSha256 !== MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256) {
    throw new Error(
      `JOIN_SHA_PIN_MISMATCH expected ${MLB_INDEPENDENT_2025_SEALED_JOIN_SHA256} got ${joinArtifactSha256}`,
    );
  }

  const modelBuf = await readFile(modelPath);
  const modelArtifactSha256 = sha256Bytes(modelBuf);
  const model = JSON.parse(modelBuf.toString("utf8")) as FrozenV2cModelProtocolView;
  const result = preregisterV2cExternalReplicationProtocol2025({
    joinArtifactSha256,
    modelArtifactSha256,
    model,
  });

  await writeJsonAtomic(
    independentExternalReplication2025V2cProtocolPath(),
    result.protocol,
  );
  await writeJsonAtomic(
    independentExternalReplication2025V2cProtocolAuditPath(),
    result.audit,
  );

  console.log("JOIN_SHA_PIN_MATCH=PASS");
  console.log("JOIN_ROWS_NOT_PARSED=YES");
  console.log("MODEL_CORE_HASH_PIN_MATCH=PASS");
  console.log(`v2cModelCoreHash=${MLB_INDEPENDENT_2025_SEALED_V2C_MODEL_CORE_HASH}`);
  console.log(`v2cModelArtifactSha256=${modelArtifactSha256}`);
  console.log(`protocolArtifactSha256=${result.audit.protocolArtifactSha256}`);
  console.log(`joinRel=${independentExternalReplication2025JoinRel()}`);
  console.log(`modelRel=${independentSealedV2cModelArtifactRel()}`);
  console.log(`protocol artifact=${independentExternalReplication2025V2cProtocolRel()}`);
  console.log(`audit artifact=${independentExternalReplication2025V2cProtocolAuditRel()}`);
  console.log("2025_MODEL_UNSEEN=YES");
  console.log("2025_TRANSFORMED_X_CREATED=NO");
  console.log("2025_LOGITS_CREATED=NO");
  console.log("2025_MODEL_PROBABILITIES_CREATED=NO");
  console.log("2025_MODEL_EVALUATED=NO");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exitCode = 1;
});
