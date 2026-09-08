import { collectSafeReconstructedNumerics } from "../proto-round-ocr-recovery-experiment-v2/reconstruct";
import { isNumericLikeRaw } from "../proto-round-semantic-region-candidates-v0/tags";
import type { FreshIndependentEvidenceV0, FreshSemanticRegionV0 } from "./types";

function isExclusiveTag(tags: string[], tag: string): boolean {
  return tags.length === 1 && tags[0] === tag;
}

export function literalMarketMarkerCandidateRaw(
  regions: FreshSemanticRegionV0[],
): string | null {
  const markers = regions.filter((region) =>
    isExclusiveTag(region.rawEvidenceTags, "EXACT_MARKET_MARKER_RAW"),
  );
  const texts = [...new Set(markers.map((r) => r.joinedRawText).filter((t) => t.length > 0))];
  if (texts.length !== 1) return null;
  return texts[0]!;
}

export function numericRawEvidences(input: {
  regions: FreshSemanticRegionV0[];
  participantEvidence: FreshIndependentEvidenceV0[];
}): string[] {
  const out: string[] = [];
  for (const region of input.regions) {
    if (!isExclusiveTag(region.rawEvidenceTags, "NUMERIC_LIKE_RAW")) continue;
    if (region.joinedRawText.length > 0) out.push(region.joinedRawText);
  }
  for (const part of input.participantEvidence) {
    for (const token of part.text.split(/\s+/u)) {
      if (token.length === 0) continue;
      if (isNumericLikeRaw(token)) out.push(token);
    }
  }
  return out;
}

export function safeReconstructedNumericEvidences(
  participantEvidence: FreshIndependentEvidenceV0[],
): string[] {
  const out: string[] = [];
  for (const part of participantEvidence) {
    out.push(...collectSafeReconstructedNumerics(part.text));
  }
  return out;
}
