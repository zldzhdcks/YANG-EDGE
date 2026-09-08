import { OcrResearchExpansionV1Error } from "./error";
import { identityKey, sha256Utf8 } from "./hash";
import {
  DISCOVERY2_COUNT,
  SOURCE_POOL_COUNT,
  SPLIT_SALT,
  VALIDATION2_COUNT,
  type ExpansionRowKeyV1,
  type ExpansionSplitV1,
} from "./types";

export function expansionSplitSortKey(row: ExpansionRowKeyV1): string {
  return sha256Utf8(
    `${SPLIT_SALT}${row.sourceImageSha256}|${row.visualRowIndex}`,
  );
}

export function splitDiscovery2Validation2(
  sourcePool: ExpansionRowKeyV1[],
): ExpansionSplitV1 {
  if (sourcePool.length !== SOURCE_POOL_COUNT) {
    throw new OcrResearchExpansionV1Error("SOURCE_POOL_COUNT_UNEXPECTED");
  }
  const seen = new Set<string>();
  const ranked = sourcePool.map((row) => {
    const id = identityKey(row);
    if (seen.has(id)) {
      throw new OcrResearchExpansionV1Error("DUPLICATE_SOURCE_POOL_KEY");
    }
    seen.add(id);
    return {
      key: {
        sourceImageSha256: row.sourceImageSha256,
        visualRowIndex: row.visualRowIndex,
      },
      sortKey: expansionSplitSortKey(row),
    };
  });
  ranked.sort((a, b) => {
    if (a.sortKey < b.sortKey) return -1;
    if (a.sortKey > b.sortKey) return 1;
    if (a.key.sourceImageSha256 < b.key.sourceImageSha256) return -1;
    if (a.key.sourceImageSha256 > b.key.sourceImageSha256) return 1;
    return a.key.visualRowIndex - b.key.visualRowIndex;
  });
  const discovery2RowKeys = ranked.slice(0, DISCOVERY2_COUNT).map((r) => r.key);
  const validation2RowKeys = ranked
    .slice(DISCOVERY2_COUNT, DISCOVERY2_COUNT + VALIDATION2_COUNT)
    .map((r) => r.key);
  const discoveryIds = new Set(discovery2RowKeys.map(identityKey));
  for (const key of validation2RowKeys) {
    if (discoveryIds.has(identityKey(key))) {
      throw new OcrResearchExpansionV1Error("DISCOVERY2_VALIDATION2_OVERLAP");
    }
  }
  return {
    sourcePoolCount: SOURCE_POOL_COUNT,
    discovery2Count: DISCOVERY2_COUNT,
    validation2Count: VALIDATION2_COUNT,
    discovery2RowKeys,
    validation2RowKeys,
  };
}
