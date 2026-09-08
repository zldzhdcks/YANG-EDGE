import { OcrResearchExpansionV1Error } from "./error";
import { identityKey } from "./hash";
import {
  DISCOVERY_TOTAL,
  PILOT10_COUNT,
  SOURCE_POOL_COUNT,
  type ExpansionRowKeyV1,
} from "./types";

export function assertPilot10Excluded(
  pool: ExpansionRowKeyV1[],
  pilot10: ExpansionRowKeyV1[],
): void {
  const forbidden = new Set(pilot10.map(identityKey));
  for (const row of pool) {
    if (forbidden.has(identityKey(row))) {
      throw new OcrResearchExpansionV1Error("PILOT10_INCLUDED_IN_SOURCE_POOL");
    }
  }
}

export function assertHoldoutExcluded(
  pool: ExpansionRowKeyV1[],
  holdout: ExpansionRowKeyV1[],
): void {
  const forbidden = new Set(holdout.map(identityKey));
  for (const row of pool) {
    if (forbidden.has(identityKey(row))) {
      throw new OcrResearchExpansionV1Error("HOLDOUT_INCLUDED_IN_SOURCE_POOL");
    }
  }
}

export function sourcePoolFromDiscoveryKeys(
  discoveryRowKeys: ExpansionRowKeyV1[],
): {
  pilot10: ExpansionRowKeyV1[];
  sourcePool: ExpansionRowKeyV1[];
} {
  if (discoveryRowKeys.length !== DISCOVERY_TOTAL) {
    throw new OcrResearchExpansionV1Error("DISCOVERY_TOTAL_UNEXPECTED");
  }
  const pilot10 = discoveryRowKeys.slice(0, PILOT10_COUNT).map((k) => ({
    sourceImageSha256: k.sourceImageSha256,
    visualRowIndex: k.visualRowIndex,
  }));
  const sourcePool = discoveryRowKeys.slice(PILOT10_COUNT).map((k) => ({
    sourceImageSha256: k.sourceImageSha256,
    visualRowIndex: k.visualRowIndex,
  }));
  if (sourcePool.length !== SOURCE_POOL_COUNT) {
    throw new OcrResearchExpansionV1Error("SOURCE_POOL_COUNT_UNEXPECTED");
  }
  assertPilot10Excluded(sourcePool, pilot10);
  return { pilot10, sourcePool };
}
