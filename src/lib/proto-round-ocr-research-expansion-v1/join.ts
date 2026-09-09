import { OcrResearchExpansionV1Error } from "./error";
import { hashRowIdentity, identityKey } from "./hash";
import { copyDiscovery2HumanRecord } from "./human";
import {
  DISCOVERY2_COUNT,
  type Discovery2HumanRecordV1,
  type Discovery2IdentityJoinV1,
  type ExpansionRowKeyV1,
} from "./types";

function duplicateCount(rows: ExpansionRowKeyV1[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const id = identityKey(row);
    if (seen.has(id)) duplicates += 1;
    else seen.add(id);
  }
  return duplicates;
}

/**
 * Join Human export records to frozen Discovery-2 identities.
 * Identity is sourceImageSha256 + visualRowIndex only.
 * Filename, geometry, and nearest-row fallbacks are forbidden.
 */
export function joinDiscovery2HumanToFrozenKeys(input: {
  discovery2RowKeys: ExpansionRowKeyV1[];
  humanRecords: Discovery2HumanRecordV1[];
  validation2RowKeyHashes: string[];
}): {
  identityJoin: Discovery2IdentityJoinV1;
  orderedRecords: Discovery2HumanRecordV1[];
} {
  if (input.discovery2RowKeys.length !== DISCOVERY2_COUNT) {
    throw new OcrResearchExpansionV1Error("DISCOVERY2_COUNT_UNEXPECTED");
  }
  if (input.humanRecords.length !== DISCOVERY2_COUNT) {
    throw new OcrResearchExpansionV1Error("HUMAN_RECORD_COUNT_MISMATCH");
  }

  const frozenDup = duplicateCount(input.discovery2RowKeys);
  const humanDup = duplicateCount(input.humanRecords);
  const duplicates = frozenDup + humanDup;
  if (duplicates !== 0) {
    throw new OcrResearchExpansionV1Error("DUPLICATE_IDENTITY");
  }

  const frozenIds = new Set(input.discovery2RowKeys.map(identityKey));
  const humanById = new Map<string, Discovery2HumanRecordV1>();
  for (const rec of input.humanRecords) {
    humanById.set(identityKey(rec), rec);
  }

  let extra = 0;
  for (const rec of input.humanRecords) {
    if (!frozenIds.has(identityKey(rec))) extra += 1;
  }
  let missing = 0;
  for (const key of input.discovery2RowKeys) {
    if (!humanById.has(identityKey(key))) missing += 1;
  }
  if (extra !== 0) {
    throw new OcrResearchExpansionV1Error("EXTRA_HUMAN_IDENTITY");
  }
  if (missing !== 0) {
    throw new OcrResearchExpansionV1Error("MISSING_HUMAN_IDENTITY");
  }

  const validationHashes = new Set(input.validation2RowKeyHashes);
  const orderedRecords: Discovery2HumanRecordV1[] = [];
  for (const key of input.discovery2RowKeys) {
    const human = humanById.get(identityKey(key));
    if (!human) {
      throw new OcrResearchExpansionV1Error("MISSING_HUMAN_IDENTITY");
    }
    if (
      human.sourceImageSha256 !== key.sourceImageSha256 ||
      human.visualRowIndex !== key.visualRowIndex
    ) {
      throw new OcrResearchExpansionV1Error("IDENTITY_MUTATED");
    }
    if (validationHashes.has(hashRowIdentity(human))) {
      throw new OcrResearchExpansionV1Error("VALIDATION2_IDENTITY_USED");
    }
    orderedRecords.push(copyDiscovery2HumanRecord(human));
  }

  return {
    identityJoin: {
      missing: 0,
      extra: 0,
      duplicates: 0,
      identityMutated: "NO",
    },
    orderedRecords,
  };
}
