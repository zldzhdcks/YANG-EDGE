import { createHash } from "node:crypto";
import { SELECTION_SALT } from "./types";
import type { FrozenRowKeyV0 } from "./types";

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256CanonicalJson(value: unknown): string {
  return sha256Utf8(canonicalJson(value));
}

export function computeSelectionSortKey(input: {
  protoRoundKey: string;
  sourceImageSha256: string;
  visualRowIndex: number;
}): string {
  return sha256Utf8(
    `${SELECTION_SALT}|${input.protoRoundKey}|${input.sourceImageSha256}|${input.visualRowIndex}`,
  );
}

export function rowIdentityKey(key: FrozenRowKeyV0): string {
  return `${key.sourceImageSha256}|${key.visualRowIndex}`;
}

export function hashRowIdentity(key: FrozenRowKeyV0): string {
  return sha256Utf8(rowIdentityKey(key));
}
