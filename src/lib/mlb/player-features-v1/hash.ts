import {
  RESEARCH_FRAMEWORK_VERSION,
  buildResearchResultHash,
} from "../../research/hash";
import {
  PLAYER_FEATURES_BUILDER_VERSION,
  PLAYER_FEATURES_DATASET_ID,
  PLAYER_FEATURES_SCHEMA_VERSION,
  type PlayerFeatureDatasetDocument,
} from "./types";

const EXCLUDED_HASH_KEYS = new Set([
  "generatedAt",
  "capturedAt",
  "datasetHash",
  "providerSummary",
]);

export function canonicalDatasetBody(
  document: PlayerFeatureDatasetDocument,
): unknown {
  const { generatedAt: _g, datasetHash: _h, providerSummary: _p, ...rest } =
    document;
  return stripExcluded(rest);
}

function stripExcluded(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripExcluded);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    if (EXCLUDED_HASH_KEYS.has(key)) continue;
    out[key] = stripExcluded(obj[key]);
  }
  return out;
}

export function hashPlayerFeatureDataset(
  document: PlayerFeatureDatasetDocument,
): string {
  return buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: PLAYER_FEATURES_DATASET_ID,
    schemaVersion: PLAYER_FEATURES_SCHEMA_VERSION,
    builderVersion: PLAYER_FEATURES_BUILDER_VERSION,
    body: canonicalDatasetBody(document),
  });
}
