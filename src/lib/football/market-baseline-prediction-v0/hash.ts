import { sha256 } from "@/lib/mlb/mlb-review-hash";
import type { FootballMarketBaselinePredictionV0 } from "./types";

export function omitVolatileMarketBaselineMeta<
  T extends { generatedAt?: string; predictionHash?: string },
>(meta: T): Omit<T, "generatedAt" | "predictionHash"> {
  const { generatedAt: _generatedAt, predictionHash: _predictionHash, ...rest } =
    meta;
  void _generatedAt;
  void _predictionHash;
  return rest;
}

export function computeFootballMarketBaselinePredictionHash(
  doc: Omit<FootballMarketBaselinePredictionV0, "meta"> & {
    meta: Omit<FootballMarketBaselinePredictionV0["meta"], "predictionHash">;
  },
): string {
  return sha256({ ...doc, meta: omitVolatileMarketBaselineMeta(doc.meta) });
}
