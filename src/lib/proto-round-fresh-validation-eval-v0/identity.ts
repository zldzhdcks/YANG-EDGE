import {
  FROZEN_FRESH_MACHINE_OUTPUT_SHA256,
  FROZEN_FRESH_SELECTION_SHA256,
  FROZEN_FRESH_VALIDATION_SEAL_SHA256,
  FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256,
  type FreshEvalRowKeyV0,
} from "./types";

export class FreshValidationEvalV0Error extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "FreshValidationEvalV0Error";
    this.code = code;
  }
}

export function identityKey(sha: string, visualRowIndex: number): string {
  return `${sha}|${visualRowIndex}`;
}

export function rowIdentityKey(row: FreshEvalRowKeyV0): string {
  return identityKey(row.sourceImageSha256, row.visualRowIndex);
}

export function assertExactSha(actual: string, expected: string, code: string): void {
  if (actual !== expected) {
    throw new FreshValidationEvalV0Error(code);
  }
}

export function assertFrozenMachineEvidence(input: {
  machineSha256: string;
  selectionSha256: string;
  sealSha256: string;
  v3Sha256: string;
}): void {
  assertExactSha(
    input.machineSha256,
    FROZEN_FRESH_MACHINE_OUTPUT_SHA256,
    "FROZEN_FRESH_MACHINE_EVIDENCE_MUTATED",
  );
  assertExactSha(
    input.selectionSha256,
    FROZEN_FRESH_SELECTION_SHA256,
    "FROZEN_FRESH_MACHINE_EVIDENCE_MUTATED",
  );
  assertExactSha(
    input.sealSha256,
    FROZEN_FRESH_VALIDATION_SEAL_SHA256,
    "FROZEN_FRESH_MACHINE_EVIDENCE_MUTATED",
  );
  assertExactSha(
    input.v3Sha256,
    FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256,
    "FROZEN_FRESH_MACHINE_EVIDENCE_MUTATED",
  );
}
