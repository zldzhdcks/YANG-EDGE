/**
 * LAYER 1 exact-image dedupe.
 *
 * Same SHA-256 of raw bytes = same exact image content.
 * First discovered path for a hash remains CANONICAL_IMAGE.
 * Additional paths with that hash are DUPLICATE_EXACT.
 *
 * Does not delete, overwrite, or move files.
 * Layer 2 (row-level / near-image) is NOT implemented.
 */

export type ExactImageCandidate = {
  relativePath: string;
  sha256: string;
  firstSeenAt: string;
};

export function resolveCanonicalPathBySha256(
  images: ExactImageCandidate[],
  previousCanonicalBySha256: ReadonlyMap<string, string>,
): Map<string, string> {
  const byHash = new Map<string, ExactImageCandidate[]>();
  for (const img of images) {
    const list = byHash.get(img.sha256);
    if (list) list.push(img);
    else byHash.set(img.sha256, [img]);
  }

  const canonical = new Map<string, string>();
  for (const [sha256, list] of byHash) {
    const previous = previousCanonicalBySha256.get(sha256);
    if (previous && list.some((item) => item.relativePath === previous)) {
      canonical.set(sha256, previous);
      continue;
    }
    const sorted = [...list].sort((a, b) => {
      if (a.firstSeenAt !== b.firstSeenAt) {
        return a.firstSeenAt < b.firstSeenAt ? -1 : 1;
      }
      return a.relativePath < b.relativePath ? -1 : 1;
    });
    canonical.set(sha256, sorted[0]!.relativePath);
  }
  return canonical;
}
