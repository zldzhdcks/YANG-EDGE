import {
  FROZEN_FRESH_IMAGE_COUNT,
  FROZEN_FRESH_IMAGE_SHA256,
  FROZEN_FRESH_VALIDATION_SEAL_SHA256,
  FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256,
  type FreshRowKeyV0,
} from "./types";

export class FreshValidationBlindTestV0Error extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "FreshValidationBlindTestV0Error";
    this.code = code;
  }
}

export function identityKey(sha: string, visualRowIndex: number): string {
  return `${sha}|${visualRowIndex}`;
}

export function rowKey(row: FreshRowKeyV0): string {
  return identityKey(row.sourceImageSha256, row.visualRowIndex);
}

export function assertExactSha(actual: string, expected: string, code: string): void {
  if (actual !== expected) {
    throw new FreshValidationBlindTestV0Error(code);
  }
}

export function assertFrozenV3ResultSha(actual: string): void {
  assertExactSha(
    actual,
    FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256,
    "PARTICIPANT_OCR_V3_RESULT_MUTATED",
  );
}

export function assertFrozenSealSha(actual: string): void {
  assertExactSha(actual, FROZEN_FRESH_VALIDATION_SEAL_SHA256, "FRESH_VALIDATION_SEAL_MUTATED");
}

export function assertFreshImageIdentities(actual: string[]): void {
  const sorted = [...actual].sort();
  const expected = [...FROZEN_FRESH_IMAGE_SHA256].sort();
  if (sorted.length !== FROZEN_FRESH_IMAGE_COUNT || expected.length !== FROZEN_FRESH_IMAGE_COUNT) {
    throw new FreshValidationBlindTestV0Error("FRESH_IMAGE_COUNT_MISMATCH");
  }
  for (let i = 0; i < expected.length; i++) {
    if (sorted[i] !== expected[i]) {
      throw new FreshValidationBlindTestV0Error("FRESH_IMAGE_SHA_MISMATCH");
    }
  }
}

export function blockedMessage(): "FRESH_VALIDATION_BLIND_TEST_V0_BLOCKED" {
  return "FRESH_VALIDATION_BLIND_TEST_V0_BLOCKED";
}
