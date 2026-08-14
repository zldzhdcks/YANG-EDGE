import { sha256 } from "@/lib/mlb/mlb-review-hash";
import type { FootballOfficialResultArtifactV0 } from "./types";

export function omitVolatileOfficialResultMeta<
  T extends {
    generatedAt?: string;
    resultObservedAt?: string;
    resultArtifactHash?: string;
  },
>(
  meta: T,
): Omit<T, "generatedAt" | "resultObservedAt" | "resultArtifactHash"> {
  const {
    generatedAt: _generatedAt,
    resultObservedAt: _resultObservedAt,
    resultArtifactHash: _resultArtifactHash,
    ...rest
  } = meta;
  void _generatedAt;
  void _resultObservedAt;
  void _resultArtifactHash;
  return rest;
}

function omitVolatileMatch(match: FootballOfficialResultArtifactV0["matches"][number]) {
  const { resultObservedAt: _obs, ...rest } = match;
  void _obs;
  return rest;
}

export function computeFootballOfficialResultArtifactHash(
  doc: Omit<FootballOfficialResultArtifactV0, "meta"> & {
    meta: Omit<FootballOfficialResultArtifactV0["meta"], "resultArtifactHash">;
  },
): string {
  return sha256({
    meta: omitVolatileOfficialResultMeta(doc.meta),
    matches: doc.matches.map(omitVolatileMatch),
  });
}
