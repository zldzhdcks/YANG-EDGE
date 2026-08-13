import { sha256 } from "@/lib/mlb/mlb-review-hash";
import type { FootballPredictionSnapshotV0 } from "./types";

export function omitVolatileSnapshotMeta<
  T extends { generatedAt?: string; snapshotHash?: string },
>(meta: T): Omit<T, "generatedAt" | "snapshotHash"> {
  const { generatedAt: _generatedAt, snapshotHash: _snapshotHash, ...rest } =
    meta;
  void _generatedAt;
  void _snapshotHash;
  return rest;
}

export function computeFootballPredictionSnapshotHash(
  doc: Omit<FootballPredictionSnapshotV0, "meta"> & {
    meta: Omit<FootballPredictionSnapshotV0["meta"], "snapshotHash">;
  },
): string {
  return sha256({ ...doc, meta: omitVolatileSnapshotMeta(doc.meta) });
}
