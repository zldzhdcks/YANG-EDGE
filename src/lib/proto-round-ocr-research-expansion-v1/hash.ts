import { createHash } from "node:crypto";
import type { ExpansionRowKeyV1 } from "./types";

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function identityKey(row: ExpansionRowKeyV1): string {
  return `${row.sourceImageSha256}|${row.visualRowIndex}`;
}

export function hashRowIdentity(row: ExpansionRowKeyV1): string {
  return sha256Utf8(identityKey(row));
}
