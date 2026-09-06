import { compareVisualReadingOrder, verticalOverlapRatio } from "./geometry";
import { VERTICAL_OVERLAP_THRESHOLD } from "./types";
import type { PlacedOcrLineV0 } from "./types";

export function areVerticallyCompatible(
  a: { y: number; height: number; bottomY: number },
  b: { y: number; height: number; bottomY: number },
): boolean {
  return verticalOverlapRatio(a, b) >= VERTICAL_OVERLAP_THRESHOLD;
}

/**
 * Assign placed lines to visual-row clusters.
 *
 * Scan in geometry reading order (centerY, then x). A line joins the first
 * compatible existing cluster where it meets the 0.50 overlap rule against
 * every current member. Otherwise it starts a new cluster.
 *
 * This rejects A–B–C transitive chaining when A and C are not themselves
 * compatible, even if both overlap B.
 */
export function clusterPlacedLines(
  placed: PlacedOcrLineV0[],
): PlacedOcrLineV0[][] {
  const ordered = [...placed].sort(compareVisualReadingOrder);
  const clusters: PlacedOcrLineV0[][] = [];

  for (const line of ordered) {
    const matching: number[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const members = clusters[i]!;
      if (members.every((m) => areVerticallyCompatible(m, line))) {
        matching.push(i);
      }
    }
    if (matching.length === 0) {
      clusters.push([line]);
      continue;
    }
    let best = matching[0]!;
    let bestDist = clusterCenterY(clusters[best]!) - line.centerY;
    if (bestDist < 0) bestDist = -bestDist;
    for (const idx of matching.slice(1)) {
      let dist = clusterCenterY(clusters[idx]!) - line.centerY;
      if (dist < 0) dist = -dist;
      if (dist < bestDist || (dist === bestDist && idx < best)) {
        best = idx;
        bestDist = dist;
      }
    }
    clusters[best]!.push(line);
  }

  return clusters;
}

export function clusterCenterY(members: PlacedOcrLineV0[]): number {
  let sum = 0;
  for (const m of members) sum += m.centerY;
  return members.length === 0 ? 0 : sum / members.length;
}
