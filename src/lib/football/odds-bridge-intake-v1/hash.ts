import { sha256 } from "@/lib/mlb/mlb-review-hash";
import type { FootballOddsBridgeIntakeArtifactV1 } from "./types";

export function omitVolatileIntakeMeta<
  T extends { generatedAt?: string; artifactHash?: string },
>(meta: T): Omit<T, "generatedAt" | "artifactHash"> {
  const { generatedAt: _generatedAt, artifactHash: _artifactHash, ...rest } =
    meta;
  void _generatedAt;
  void _artifactHash;
  return rest;
}

export function computeFootballOddsBridgeIntakeArtifactHash(
  doc: Omit<FootballOddsBridgeIntakeArtifactV1, "meta"> & {
    meta: Omit<FootballOddsBridgeIntakeArtifactV1["meta"], "artifactHash">;
  },
): string {
  return sha256({ ...doc, meta: omitVolatileIntakeMeta(doc.meta) });
}
