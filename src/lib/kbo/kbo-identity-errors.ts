/**
 * KBO Identity collection error codes.
 * PROVIDER_LIMITED_COVERAGE is a warning, not a hard failure.
 */
export type KboIdentityCollectionErrorCode =
  | "KBO_IDENTITY_COLLECTION_DISABLED"
  | "PROVIDER_REQUEST_FAILED"
  | "PROVIDER_LIMITED_COVERAGE"
  | "NO_PROVIDER_GAMES"
  | "TEAM_MAPPING_PARTIAL"
  | "CACHE_READ_FAILED"
  | "CACHE_WRITE_FAILED";

export class KboIdentityCollectionError extends Error {
  readonly code: KboIdentityCollectionErrorCode;

  constructor(code: KboIdentityCollectionErrorCode, message: string) {
    super(message);
    this.name = "KboIdentityCollectionError";
    this.code = code;
  }
}
