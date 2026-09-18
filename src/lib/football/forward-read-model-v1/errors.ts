export const FORWARD_READ_MODEL_ERROR = {
  FORWARD_EVAL_MISSING: "FORWARD_EVAL_MISSING",
  FORWARD_EVAL_SCHEMA_INVALID: "FORWARD_EVAL_SCHEMA_INVALID",
  FORWARD_MODEL_MISMATCH: "FORWARD_MODEL_MISMATCH",
  FORWARD_MODEL_HASH_MISMATCH: "FORWARD_MODEL_HASH_MISMATCH",
  FORWARD_COUNT_MISMATCH: "FORWARD_COUNT_MISMATCH",
  FORWARD_PROBABILITY_INVALID: "FORWARD_PROBABILITY_INVALID",
  FORWARD_DUPLICATE_FIXTURE: "FORWARD_DUPLICATE_FIXTURE",
  FORWARD_PREGAME_INTEGRITY_FAILED: "FORWARD_PREGAME_INTEGRITY_FAILED",
  FORWARD_FORBIDDEN_INPUT_USED: "FORWARD_FORBIDDEN_INPUT_USED",
  FORWARD_IDENTITY_CONFLICT: "FORWARD_IDENTITY_CONFLICT",
} as const;

export type ForwardReadModelErrorCode =
  (typeof FORWARD_READ_MODEL_ERROR)[keyof typeof FORWARD_READ_MODEL_ERROR];

export class ForwardReadModelError extends Error {
  readonly code: ForwardReadModelErrorCode;

  constructor(code: ForwardReadModelErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ForwardReadModelError";
    this.code = code;
  }
}

export function fail(
  code: ForwardReadModelErrorCode,
  detail?: string,
): never {
  throw new ForwardReadModelError(code, detail);
}
