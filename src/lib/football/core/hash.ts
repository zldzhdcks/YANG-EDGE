import { sha256 } from "@/lib/mlb/mlb-review-hash";
import type { FootballScheduleArtifactV1 } from "./types";

/**
 * generatedAt = build provenance (when the artifact was written).
 * artifactHash = deterministic research-content hash.
 */
export function omitVolatileScheduleMeta<
  T extends { generatedAt?: string; artifactHash?: string },
>(meta: T): Omit<T, "generatedAt" | "artifactHash"> {
  const { generatedAt: _generatedAt, artifactHash: _artifactHash, ...rest } =
    meta;
  void _generatedAt;
  void _artifactHash;
  return rest;
}

export function computeFootballScheduleArtifactHash(
  doc: Omit<FootballScheduleArtifactV1, "meta"> & {
    meta: Omit<FootballScheduleArtifactV1["meta"], "artifactHash">;
  },
): string {
  return sha256({ ...doc, meta: omitVolatileScheduleMeta(doc.meta) });
}
