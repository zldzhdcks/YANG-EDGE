import { distribution } from "../proto-round-column-layout-audit-v0/geometry";
import type { LayoutFragmentV0 } from "../proto-round-column-layout-audit-v0/types";
import {
  assignRawEvidenceTags,
  regionSignatureLetter,
} from "./tags";
import type {
  LayoutPatternEvidenceAuditV0,
  ProtoRoundSemanticRegionCandidateV0,
  RawEvidenceSignatureAuditV0,
  RawEvidenceTagAuditV0,
  RawEvidenceTagCombinationAuditV0,
  RawEvidenceTagV0,
  SemanticRegionCandidatePreviewV0,
  SemanticRegionCandidateRegionV0,
} from "./types";

const TAGS: RawEvidenceTagV0[] = [
  "TEXT_BEARING_RAW",
  "NUMERIC_LIKE_RAW",
  "EXACT_MARKET_MARKER_RAW",
  "OTHER_RAW",
];

function exampleTexts(texts: string[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    if (out.length >= 8) break;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

function combinationKey(tags: RawEvidenceTagV0[]): string {
  return tags.join("+");
}

export function auditRawEvidenceTags(
  rows: ProtoRoundSemanticRegionCandidateV0[],
): RawEvidenceTagAuditV0[] {
  return TAGS.map((tag) => {
    const regions = rows.flatMap((row) =>
      row.regions.filter((r) => r.rawEvidenceTags.includes(tag)),
    );
    const rowCoverage = rows.filter((row) =>
      row.regions.some((r) => r.rawEvidenceTags.includes(tag)),
    ).length;
    const bandCounts: Record<string, number> = {};
    const centers: number[] = [];
    const texts: string[] = [];
    for (const region of regions) {
      const key = region.occupiedBandIndex == null ? "null" : String(region.occupiedBandIndex);
      bandCounts[key] = (bandCounts[key] ?? 0) + 1;
      for (const frag of region.fragments) {
        centers.push((frag.normalizedLeftX + frag.normalizedRightX) / 2);
        texts.push(frag.rawText);
      }
    }
    return {
      tag,
      regionCount: regions.length,
      rowCoverage,
      occupiedBandIndexCounts: bandCounts,
      normalizedCenterX: distribution(centers),
      exampleRawTexts: exampleTexts(texts),
    };
  });
}

export function auditTagCombinations(
  rows: ProtoRoundSemanticRegionCandidateV0[],
): RawEvidenceTagCombinationAuditV0[] {
  const counts = new Map<string, { tags: RawEvidenceTagV0[]; regionCount: number; rows: Set<string> }>();
  for (const row of rows) {
    const rowKey = `${row.sourceImageSha256}::${row.visualRowIndex}`;
    for (const region of row.regions) {
      const key = combinationKey(region.rawEvidenceTags);
      const cur = counts.get(key) ?? { tags: region.rawEvidenceTags, regionCount: 0, rows: new Set() };
      cur.regionCount += 1;
      cur.rows.add(rowKey);
      counts.set(key, cur);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1].regionCount !== a[1].regionCount) return b[1].regionCount - a[1].regionCount;
      return a[0].localeCompare(b[0]);
    })
    .map(([combinationKey, v]) => ({
      combinationKey,
      tags: v.tags,
      regionCount: v.regionCount,
      rowCoverage: v.rows.size,
    }));
}

export function auditSignatures(
  rows: ProtoRoundSemanticRegionCandidateV0[],
): RawEvidenceSignatureAuditV0[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.rowRawEvidenceSignature, (counts.get(row.rowRawEvidenceSignature) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([signature, rowCount]) => ({ signature, rowCount }));
}

export function auditLayoutPatternEvidence(
  rows: ProtoRoundSemanticRegionCandidateV0[],
): LayoutPatternEvidenceAuditV0[] {
  const byPattern = new Map<string, ProtoRoundSemanticRegionCandidateV0[]>();
  for (const row of rows) {
    const id = row.layoutPatternId ?? "LAYOUT_PATTERN_NULL";
    const list = byPattern.get(id) ?? [];
    list.push(row);
    byPattern.set(id, list);
  }
  const audits: LayoutPatternEvidenceAuditV0[] = [];
  for (const [layoutPatternId, members] of byPattern) {
    const sigs = auditSignatures(members);
    const top = sigs[0] ?? null;
    audits.push({
      layoutPatternId,
      rowCount: members.length,
      mostCommonRawEvidenceSignature: top?.signature ?? null,
      mostCommonSignatureCount: top?.rowCount ?? 0,
      otherSignatureCount: members.length - (top?.rowCount ?? 0),
      signatureCounts: sigs,
    });
  }
  return audits.sort((a, b) => {
    if (b.rowCount !== a.rowCount) return b.rowCount - a.rowCount;
    return a.layoutPatternId.localeCompare(b.layoutPatternId);
  });
}

export function representativePreviews(
  rows: ProtoRoundSemanticRegionCandidateV0[],
): SemanticRegionCandidatePreviewV0[] {
  const pick = (
    previewClass: SemanticRegionCandidatePreviewV0["previewClass"],
    pred: (row: ProtoRoundSemanticRegionCandidateV0) => boolean,
  ): SemanticRegionCandidatePreviewV0 | null => {
    const row = rows.find(pred);
    if (!row) return null;
    return {
      previewClass,
      sourceFileName: row.sourceFileName,
      visualRowIndex: row.visualRowIndex,
      rowIdentifierCandidate: row.rowIdentifierCandidate,
      scheduledLocalCandidate: row.scheduledLocalCandidate,
      layoutPatternId: row.layoutPatternId,
      visualJoinedTextCandidate: row.visualJoinedTextCandidate,
      rowRawEvidenceSignature: row.rowRawEvidenceSignature,
      regions: row.regions.map((r) => ({
        regionIndex: r.regionIndex,
        rawEvidenceTags: r.rawEvidenceTags,
        joinedRawText: r.joinedRawText,
      })),
    };
  };
  return [
    pick("EXACT_MARKET_MARKER_RAW_PRESENT", (row) =>
      row.regions.some((r) => r.rawEvidenceTags.includes("EXACT_MARKET_MARKER_RAW")),
    ),
    pick(
      "MULTIPLE_TEXT_BEARING_RAW_REGIONS",
      (row) => row.regions.filter((r) => r.rawEvidenceTags.includes("TEXT_BEARING_RAW")).length >= 2,
    ),
    pick(
      "MULTIPLE_NUMERIC_LIKE_RAW_REGIONS",
      (row) => row.regions.filter((r) => r.rawEvidenceTags.includes("NUMERIC_LIKE_RAW")).length >= 2,
    ),
    pick("MIXED_TAG_REGION", (row) =>
      row.regions.some(
        (r) =>
          regionSignatureLetter({
            tags: r.rawEvidenceTags,
            geometryStatus: r.geometryStatus,
          }) === "X",
      ),
    ),
    pick("OTHER_RAW", (row) =>
      row.regions.some((r) => r.rawEvidenceTags.includes("OTHER_RAW")),
    ),
  ].filter((p): p is SemanticRegionCandidatePreviewV0 => p != null);
}

export function copyFragments(fragments: LayoutFragmentV0[]): LayoutFragmentV0[] {
  return fragments.map((f) => ({ ...f }));
}

export function taggedRegionFromSource(region: {
  regionIndex: number;
  occupiedBandIndex: number | null;
  normalizedLeft: number;
  normalizedRight: number;
  joinedRawText: string;
  fragments: LayoutFragmentV0[];
  semanticRole: "UNASSIGNED";
}): SemanticRegionCandidateRegionV0 {
  const assigned = assignRawEvidenceTags(region.fragments);
  return {
    regionIndex: region.regionIndex,
    occupiedBandIndex: region.occupiedBandIndex,
    normalizedLeft: region.normalizedLeft,
    normalizedRight: region.normalizedRight,
    joinedRawText: region.joinedRawText,
    fragments: copyFragments(region.fragments),
    semanticRole: "UNASSIGNED",
    rawEvidenceTags: assigned.tags,
    geometryStatus: assigned.geometryStatus,
  };
}
