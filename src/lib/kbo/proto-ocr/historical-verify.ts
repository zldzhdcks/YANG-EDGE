/**
 * Historical guard for Proto OCR — must not mutate 2026-07-31 hashes.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const EXPECTED = {
  personnelHash:
    "987702440e2e635ac2dd8876a1b412d74c34550a9d36d5e9e682e4b72259cd3f",
  domesticProtoHash:
    "0dc11530014d520ed11915ac7e426c80e44467bdb56b5fa5dbb02ebd41b7deb0",
  predictionHashSha256:
    "60436b1e70af4978c56a2f631f325d5680cdb0ece19dd327a3756cca380acb13",
};

function sha256File(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function verifyProtoOcrHistorical0731(cwd = process.cwd()) {
  const pred = JSON.parse(
    await readFile(
      path.join(cwd, "data/predictions/kbo/2026-07-31.json"),
      "utf8",
    ),
  ) as {
    personnelHash?: string;
    domesticProtoHash?: string;
    predictionHashSha256?: string;
  };
  const personnelSnap = await readFile(
    path.join(cwd, "data/research/kbo/2026-07-31-personnel-snapshot-v1.json"),
  );
  const protoSnap = await readFile(
    path.join(
      cwd,
      "data/research/kbo/2026-07-31-domestic-proto-snapshot-v1.json",
    ),
  );
  const checks = [
    {
      name: "personnelHash_field",
      pass: pred.personnelHash === EXPECTED.personnelHash,
    },
    {
      name: "domesticProtoHash_field",
      pass: pred.domesticProtoHash === EXPECTED.domesticProtoHash,
    },
    {
      name: "predictionHashSha256_field",
      pass: pred.predictionHashSha256 === EXPECTED.predictionHashSha256,
    },
    {
      name: "personnel_snapshot_readable",
      pass: sha256File(personnelSnap).length === 64,
    },
    {
      name: "proto_snapshot_readable",
      pass: sha256File(protoSnap).length === 64,
    },
  ];
  return {
    ok: checks.every((c) => c.pass),
    checks,
    expected: EXPECTED,
  };
}
