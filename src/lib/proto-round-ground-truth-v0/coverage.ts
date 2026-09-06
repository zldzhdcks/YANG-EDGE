import type { SemanticRegionCandidatesDocumentV0 } from "../proto-round-semantic-region-candidates-v0/types";
import { POST_SELECTION_COVERAGE_AUDIT_ONLY, type DiscoveryCoverageAuditV0, type FrozenRowKeyV0 } from "./types";
import { rowIdentityKey } from "./hash";

/**
 * Descriptive coverage AFTER selection freeze.
 * Must not be used to choose rows.
 */
export function auditDiscoveryCoverage(input: {
  discoveryRowKeys: FrozenRowKeyV0[];
  semanticRegions: SemanticRegionCandidatesDocumentV0 | null;
}): DiscoveryCoverageAuditV0 {
  const screenshots = new Set<string>();
  for (const key of input.discoveryRowKeys) {
    screenshots.add(key.sourceImageSha256);
  }

  if (!input.semanticRegions) {
    return {
      postSelectionCoverageAuditOnly: POST_SELECTION_COVERAGE_AUDIT_ONLY,
      discoverySampleSize: input.discoveryRowKeys.length,
      sourceScreenshotCount: screenshots.size,
      layoutPatternIdCount: 0,
      rowsWithExactSchedule: 0,
      rowsWithRawMarketMarker: 0,
    };
  }

  const wanted = new Set(input.discoveryRowKeys.map(rowIdentityKey));
  const patterns = new Set<string>();
  let rowsWithExactSchedule = 0;
  let rowsWithRawMarketMarker = 0;

  for (const row of input.semanticRegions.rows) {
    const id = `${row.sourceImageSha256}|${row.visualRowIndex}`;
    if (!wanted.has(id)) continue;
    patterns.add(row.layoutPatternId ?? "LAYOUT_PATTERN_NULL");
    if (row.scheduledLocalCandidate != null && row.scheduledLocalCandidate !== "") {
      rowsWithExactSchedule += 1;
    }
    if (
      row.regions.some((region) =>
        region.rawEvidenceTags.includes("EXACT_MARKET_MARKER_RAW"),
      )
    ) {
      rowsWithRawMarketMarker += 1;
    }
  }

  return {
    postSelectionCoverageAuditOnly: POST_SELECTION_COVERAGE_AUDIT_ONLY,
    discoverySampleSize: input.discoveryRowKeys.length,
    sourceScreenshotCount: screenshots.size,
    layoutPatternIdCount: patterns.size,
    rowsWithExactSchedule,
    rowsWithRawMarketMarker,
  };
}
