import { sha256Utf8 } from "./hash";
import { FreshValidationBlindTestV0Error, identityKey } from "./identity";
import {
  FRESH_SELECTION_SALT,
  FRESH_VALIDATION_SAMPLE_SIZE,
  type FreshEligibleRowV0,
} from "./types";

export function freshSelectionSortKey(input: {
  sourceImageSha256: string;
  visualRowIndex: number;
}): string {
  return sha256Utf8(
    `${FRESH_SELECTION_SALT}${input.sourceImageSha256}${input.visualRowIndex}`,
  );
}

export function selectFreshValidationRows(input: {
  eligibleRows: FreshEligibleRowV0[];
  sampleSize?: number;
}): {
  eligibleRowCount: number;
  selectedRows: FreshEligibleRowV0[];
} {
  const sampleSize = input.sampleSize ?? FRESH_VALIDATION_SAMPLE_SIZE;
  const seen = new Set<string>();
  const ranked = input.eligibleRows.map((row) => {
    const id = identityKey(row.sourceImageSha256, row.visualRowIndex);
    if (seen.has(id)) {
      throw new FreshValidationBlindTestV0Error("DUPLICATE_FRESH_ROW_KEY");
    }
    seen.add(id);
    return {
      row,
      sortKey: freshSelectionSortKey({
        sourceImageSha256: row.sourceImageSha256,
        visualRowIndex: row.visualRowIndex,
      }),
    };
  });
  ranked.sort((a, b) => {
    if (a.sortKey < b.sortKey) return -1;
    if (a.sortKey > b.sortKey) return 1;
    if (a.row.sourceImageSha256 < b.row.sourceImageSha256) return -1;
    if (a.row.sourceImageSha256 > b.row.sourceImageSha256) return 1;
    return a.row.visualRowIndex - b.row.visualRowIndex;
  });
  const take = Math.min(sampleSize, ranked.length);
  return {
    eligibleRowCount: ranked.length,
    selectedRows: ranked.slice(0, take).map((item) => item.row),
  };
}
