/**
 * Deterministic reproducibility for reports.
 * Reuses Research Framework hash — generatedAt is not part of metrics hash.
 */
import {
  RESEARCH_FRAMEWORK_VERSION,
  buildResearchResultHash,
} from "@/lib/research/hash";
import {
  REPORTING_BUILDER_VERSION,
  REPORTING_FRAMEWORK_VERSION,
  REPORTING_SCHEMA_VERSION,
  type SourceArtifactRef,
} from "./types";

const VOLATILE_KEYS = new Set([
  "generatedAt",
  "reportGeneratedAt",
  "gitCommit",
  "resultObservedAt",
  "comparedAt",
  "collectedAt",
]);

export type DeterministicMetricsBody = {
  sourceManifest: SourceArtifactRef[];
  metrics: Record<string, unknown>;
  sampleClassifications: unknown;
  pipelineClassifications: unknown;
};

export function stripVolatileMetadata(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripVolatileMetadata);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (VOLATILE_KEYS.has(k)) continue;
    out[k] = stripVolatileMetadata(v);
  }
  return out;
}

export function buildDeterministicMetricsHash(
  body: DeterministicMetricsBody,
): string {
  return buildResearchResultHash({
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    datasetId: REPORTING_FRAMEWORK_VERSION,
    schemaVersion: REPORTING_SCHEMA_VERSION,
    builderVersion: REPORTING_BUILDER_VERSION,
    body: stripVolatileMetadata({
      sourceManifest: body.sourceManifest.map((s) => ({
        path: s.path,
        hash: s.hash,
        kind: s.kind,
        sport: s.sport,
        schemaVersion: s.schemaVersion,
      })),
      metrics: body.metrics,
      sampleClassifications: body.sampleClassifications,
      pipelineClassifications: body.pipelineClassifications,
    }),
  });
}
