import { sha256 } from "@/lib/mlb/mlb-review-hash";
import type {
  Football1x2OddsArtifactV1,
  Football1x2OddsObservationV1,
} from "./types";

export function omitVolatileOddsMeta<
  T extends { generatedAt?: string; artifactHash?: string },
>(meta: T): Omit<T, "generatedAt" | "artifactHash"> {
  const { generatedAt: _generatedAt, artifactHash: _artifactHash, ...rest } =
    meta;
  void _generatedAt;
  void _artifactHash;
  return rest;
}

export function computeFootball1x2OddsArtifactHash(
  doc: Omit<Football1x2OddsArtifactV1, "meta"> & {
    meta: Omit<Football1x2OddsArtifactV1["meta"], "artifactHash">;
  },
): string {
  return sha256({ ...doc, meta: omitVolatileOddsMeta(doc.meta) });
}

export function computeFootball1x2OddsObservationHash(
  observation: Football1x2OddsObservationV1,
): string {
  return sha256(observation);
}

export function buildOddsObservationId(
  matchId: string,
  observedAt: string,
): string {
  return `fb-1x2-obs-v1-${matchId}-THE_ODDS_API-${observedAt}`;
}
