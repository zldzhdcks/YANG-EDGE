import { GroundTruthError } from "./error";
import { computeSelectionSortKey, rowIdentityKey } from "./hash";
import {
  DISCOVERY_SAMPLE_SIZE,
  HOLDOUT_SAMPLE_SIZE,
  type EligibleVisualRowV0,
  type FrozenRowKeyV0,
} from "./types";

export type FrozenSelectionV0 = {
  discovery: FrozenRowKeyV0[];
  holdout: FrozenRowKeyV0[];
  eligibleRowCount: number;
};

function toFrozenKey(row: Pick<EligibleVisualRowV0, "sourceImageSha256" | "visualRowIndex">): FrozenRowKeyV0 {
  return {
    sourceImageSha256: row.sourceImageSha256,
    visualRowIndex: row.visualRowIndex,
  };
}

/**
 * Deterministic freeze. Inspects only protoRoundKey + SHA + visualRowIndex.
 */
export function selectFrozenSamples(input: {
  protoRoundKey: string;
  eligibleRows: Array<
    Pick<EligibleVisualRowV0, "sourceImageSha256" | "visualRowIndex">
  >;
  discoverySampleSize?: number;
  holdoutSampleSize?: number;
}): FrozenSelectionV0 {
  const discoverySampleSize = input.discoverySampleSize ?? DISCOVERY_SAMPLE_SIZE;
  const holdoutSampleSize = input.holdoutSampleSize ?? HOLDOUT_SAMPLE_SIZE;
  const needed = discoverySampleSize + holdoutSampleSize;

  const seen = new Set<string>();
  const ranked = input.eligibleRows.map((row) => {
    const key = toFrozenKey(row);
    const identity = rowIdentityKey(key);
    if (seen.has(identity)) {
      throw new GroundTruthError("DUPLICATE_ROW_KEY");
    }
    seen.add(identity);
    return {
      key,
      sortKey: computeSelectionSortKey({
        protoRoundKey: input.protoRoundKey,
        sourceImageSha256: row.sourceImageSha256,
        visualRowIndex: row.visualRowIndex,
      }),
    };
  });
  if (ranked.length < needed) {
    throw new GroundTruthError("INSUFFICIENT_ELIGIBLE_ROWS");
  }

  ranked.sort((a, b) => {
    if (a.sortKey < b.sortKey) return -1;
    if (a.sortKey > b.sortKey) return 1;
    if (a.key.sourceImageSha256 < b.key.sourceImageSha256) return -1;
    if (a.key.sourceImageSha256 > b.key.sourceImageSha256) return 1;
    return a.key.visualRowIndex - b.key.visualRowIndex;
  });

  return {
    eligibleRowCount: input.eligibleRows.length,
    discovery: ranked.slice(0, discoverySampleSize).map((r) => r.key),
    holdout: ranked
      .slice(discoverySampleSize, discoverySampleSize + holdoutSampleSize)
      .map((r) => r.key),
  };
}

export function assertDiscoveryHoldoutDisjoint(selection: FrozenSelectionV0): void {
  const discovery = new Set(selection.discovery.map(rowIdentityKey));
  for (const key of selection.holdout) {
    if (discovery.has(rowIdentityKey(key))) {
      throw new GroundTruthError("DISCOVERY_HOLDOUT_OVERLAP");
    }
  }
}
