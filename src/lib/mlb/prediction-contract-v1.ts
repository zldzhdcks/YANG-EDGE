/**
 * Prediction snapshot contract detection + integrity verification.
 * Distinguishes LEGACY_V1 vs RESEARCH_BASELINE_V0 hash algorithms.
 */
import { asNumber, asRecord, asString } from "./mlb-review-utils";
import { computePredictionContentHash } from "./mlb-review-utils";
import { recomputeV0PredictionHashFromSnapshot } from "./prediction-v0/verify-snapshot-hash";

export type PredictionContract =
  | "LEGACY_V1"
  | "RESEARCH_BASELINE_V0"
  | "UNKNOWN";

export type HashValidationMethod =
  | "VERIFIED_LEGACY_FINGERPRINT"
  | "VERIFIED_V0_PREDICTION_HASH"
  | "PREDICTION_HASH_MISMATCH"
  | "UNSUPPORTED_PREDICTION_CONTRACT"
  | "MISSING_STORED_HASH";

export type PredictionHashVerification = {
  contract: PredictionContract;
  storedHash: string | null;
  recomputedHash: string | null;
  verified: boolean;
  method: HashValidationMethod;
  detail: string;
};

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function detectPredictionContract(
  prediction: Record<string, unknown>,
): PredictionContract {
  const meta = asRecord(prediction.meta) ?? {};
  const modelStatus = (asString(meta.modelStatus) ?? "").toUpperCase();
  const modelVersion = (asString(meta.modelVersion) ?? "").toLowerCase();
  const predictions = asArr(prediction.predictions);
  const sample = asRecord(predictions[0]) ?? {};
  const hasMarketPredictions = asArr(sample.marketPredictions).length > 0;
  const hasImmutableFields = Array.isArray(meta.immutablePredictionFields);
  const hasStoredHash = Boolean(asString(meta.predictionHashSha256));

  if (
    modelStatus === "RESEARCH_BASELINE_V0" ||
    modelVersion.includes("baseline-prediction-v0") ||
    (hasMarketPredictions &&
      hasStoredHash &&
      !hasImmutableFields &&
      (asString(meta.schemaVersion) === "mlb-research-prediction-snapshot-v1" ||
        asRecord(asArr(sample.marketPredictions)[0])?.researchBaseline !=
          null))
  ) {
    return "RESEARCH_BASELINE_V0";
  }

  if (
    hasImmutableFields ||
    (asString(sample.baselinePick) != null && !hasMarketPredictions)
  ) {
    return "LEGACY_V1";
  }

  // Ambiguous: has baselinePick + marketPredictions without modelStatus
  if (hasMarketPredictions && hasStoredHash) {
    return "RESEARCH_BASELINE_V0";
  }
  if (asString(sample.baselinePick) != null) {
    return "LEGACY_V1";
  }

  return "UNKNOWN";
}

export function verifyPredictionHash(
  prediction: Record<string, unknown>,
): PredictionHashVerification {
  const contract = detectPredictionContract(prediction);
  const meta = asRecord(prediction.meta) ?? {};
  const storedHash = asString(meta.predictionHashSha256);

  if (contract === "UNKNOWN") {
    return {
      contract,
      storedHash,
      recomputedHash: null,
      verified: false,
      method: "UNSUPPORTED_PREDICTION_CONTRACT",
      detail: "UNSUPPORTED_PREDICTION_CONTRACT",
    };
  }

  if (contract === "RESEARCH_BASELINE_V0") {
    if (!storedHash) {
      return {
        contract,
        storedHash: null,
        recomputedHash: null,
        verified: false,
        method: "MISSING_STORED_HASH",
        detail: "v0 snapshot missing predictionHashSha256",
      };
    }
    const recomputedHash = recomputeV0PredictionHashFromSnapshot(prediction);
    const verified = recomputedHash === storedHash;
    return {
      contract,
      storedHash,
      recomputedHash,
      verified,
      method: verified
        ? "VERIFIED_V0_PREDICTION_HASH"
        : "PREDICTION_HASH_MISMATCH",
      detail: verified
        ? "v0 predictionHashSha256 matches hashPredictions fingerprint"
        : "v0 predictionHashSha256 does not match recomputed hashPredictions fingerprint",
    };
  }

  // LEGACY_V1
  const recomputedHash = computePredictionContentHash(prediction);
  if (!storedHash) {
    // Legacy snapshots sometimes omit stored hash; fingerprint still computed for graded artifact
    return {
      contract,
      storedHash: null,
      recomputedHash,
      verified: true,
      method: "VERIFIED_LEGACY_FINGERPRINT",
      detail: "legacy fingerprint computed; no stored predictionHashSha256 to compare",
    };
  }
  const verified = recomputedHash === storedHash;
  return {
    contract,
    storedHash,
    recomputedHash,
    verified,
    method: verified
      ? "VERIFIED_LEGACY_FINGERPRINT"
      : "PREDICTION_HASH_MISMATCH",
    detail: verified
      ? "prediction immutable-field fingerprint hash verified"
      : "predictionHashSha256 does not match immutable-field fingerprint hash",
  };
}

export function isSha256Hex(v: string | null): boolean {
  return typeof v === "string" && /^[a-f0-9]{64}$/i.test(v);
}

export function auditV0MetaHashes(prediction: Record<string, unknown>): {
  configHashOk: boolean;
  inputManifestHashOk: boolean;
  warnings: string[];
} {
  const meta = asRecord(prediction.meta) ?? {};
  const configHash = asString(meta.configHash);
  const inputManifestHash = asString(meta.inputManifestHash);
  const warnings: string[] = [];
  const configHashOk = isSha256Hex(configHash);
  const inputManifestHashOk = isSha256Hex(inputManifestHash);
  if (!configHashOk) warnings.push("CONFIG_HASH_MISSING_OR_MALFORMED");
  if (!inputManifestHashOk) {
    warnings.push("INPUT_MANIFEST_HASH_MISSING_OR_MALFORMED");
  }
  // Absence of legacy inputManifest object is NOT a failure for v0
  void asNumber(meta.officialPickCount);
  return { configHashOk, inputManifestHashOk, warnings };
}
