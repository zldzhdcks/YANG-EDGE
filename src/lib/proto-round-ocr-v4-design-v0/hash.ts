import { createHash } from "node:crypto";
import type { OcrV4RowKeyV0 } from "./types";

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function identityKey(row: OcrV4RowKeyV0): string {
  return `${row.sourceImageSha256}|${row.visualRowIndex}`;
}

export function hashRowIdentity(row: OcrV4RowKeyV0): string {
  return sha256Utf8(identityKey(row));
}
