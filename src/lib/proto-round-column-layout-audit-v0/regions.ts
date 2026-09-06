import type { LayoutFragmentV0, RawFieldRegionCandidateV0 } from "./types";
import { bandIndexForCenter } from "./geometry";

export function regionsFromRemainder(input: {
  remainder: LayoutFragmentV0[];
  bands: Array<{ left: number; right: number }>;
}): RawFieldRegionCandidateV0[] {
  if (input.remainder.length === 0) return [];
  if (input.bands.length === 0) {
    return [
      {
        regionIndex: 0,
        normalizedLeft: Math.min(...input.remainder.map((f) => f.normalizedLeftX)),
        normalizedRight: Math.max(...input.remainder.map((f) => f.normalizedRightX)),
        fragments: input.remainder,
        joinedRawText: input.remainder.map((f) => f.rawText).join(" "),
        semanticRole: "UNASSIGNED",
        occupiedBandIndex: null,
      },
    ];
  }

  const grouped = new Map<number, LayoutFragmentV0[]>();
  for (const frag of input.remainder) {
    const idx = bandIndexForCenter(frag.normalizedCenterX, input.bands) ?? 0;
    const list = grouped.get(idx) ?? [];
    list.push(frag);
    grouped.set(idx, list);
  }
  const bandIndexes = [...grouped.keys()].sort((a, b) => a - b);
  return bandIndexes.map((bandIndex, regionIndex) => {
    const frags = grouped.get(bandIndex)!;
    return {
      regionIndex,
      normalizedLeft: Math.min(...frags.map((f) => f.normalizedLeftX)),
      normalizedRight: Math.max(...frags.map((f) => f.normalizedRightX)),
      fragments: frags,
      joinedRawText: frags.map((f) => f.rawText).join(" "),
      semanticRole: "UNASSIGNED" as const,
      occupiedBandIndex: bandIndex,
    };
  });
}

export function occupancyKey(bandIndexes: number[]): string {
  if (bandIndexes.length === 0) return "EMPTY";
  return bandIndexes.join("+");
}
