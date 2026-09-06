import type { RowAnchorScheduleDocumentV0 } from "../proto-round-row-anchor-schedule-v0/types";
import type { VisualRowsDocumentV0 } from "../proto-round-visual-rows-v0/types";
import { CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";
import { auditMarketSignals, auditNumericShapes, taggedRemainder } from "./audits";
import {
  accumulateHistogram,
  bandEdgesFromModeCenters,
  distribution,
  emptyHistogram,
  modesFromHistogram,
} from "./geometry";
import { joinVisualAndAnchorRows, rowKey } from "./lineage";
import { locateRowGeometry } from "./locate";
import { occupancyKey, regionsFromRemainder } from "./regions";
import {
  AUDIT_DISCOVERY_PARAMETERS_ONLY,
  BOUNDARY_DERIVATION_METHOD,
  COLUMN_LAYOUT_AUDIT_SCHEMA_VERSION,
  COLUMN_LAYOUT_AUDIT_SCOPE,
  DISCOVERED_BANDS_ARE_PRODUCTION_CONTRACT,
  GEOMETRY_BASIS,
  FIELD_BOUNDARY_OUTCOME_TUNING,
  LAYOUT_DISCOVERY_BIN_WIDTH,
  LAYOUT_DISCOVERY_MIN_MODE_SHARE,
  REGION_SEMANTIC_ROLE_ASSIGNED,
  ROUND_105_COUNT_SPECIAL_CASE,
  SEMANTIC_REGION_CONTRACT_FROZEN,
  type CandidateXBandV0,
  type ColumnLayoutAuditDocumentV0,
  type LayoutPatternV0,
  type ProtoRoundRawFieldRegionCandidateV0,
} from "./types";

const PATTERN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function patternIdForRank(rank: number): string {
  if (rank < PATTERN_LETTERS.length) return `LAYOUT_PATTERN_${PATTERN_LETTERS[rank]}`;
  return `LAYOUT_PATTERN_${rank + 1}`;
}

export function buildColumnLayoutAuditDocumentV0(input: {
  visual: VisualRowsDocumentV0;
  semantic: RowAnchorScheduleDocumentV0;
}): ColumnLayoutAuditDocumentV0 {
  const joined = joinVisualAndAnchorRows(input);
  const located = joined.map((row) => ({ row, geo: locateRowGeometry(row) }));

  const remainderHist = emptyHistogram();
  const remainderRowSets = remainderHist.map(() => new Set<string>());
  let remainderFragmentTotal = 0;
  const identifierCenters: number[] = [];
  const dateTimeCenters: number[] = [];
  const exactClockCenters: number[] = [];
  const remainderTagged: ReturnType<typeof taggedRemainder> = [];

  for (const { row, geo } of located) {
    const key = rowKey(row.visual.sourceImageSha256, row.visual.visualRowIndex);
    if (geo.identifierFragment) {
      identifierCenters.push(geo.identifierFragment.normalizedCenterX);
    }
    for (const f of geo.dateTimeFragments) {
      dateTimeCenters.push(f.normalizedCenterX);
    }
    if (
      row.semantic.timeParseStatus === "PARSED_EXACT" &&
      geo.dateTimeFragments.length > 0
    ) {
      exactClockCenters.push(
        geo.dateTimeFragments[geo.dateTimeFragments.length - 1]!.normalizedCenterX,
      );
    }
    for (const f of geo.semanticRemainderFragments) {
      remainderFragmentTotal += 1;
      accumulateHistogram(remainderHist, f, remainderRowSets, key);
      remainderTagged.push(
        ...taggedRemainder(row.visual.sourceImageSha256, row.visual.visualRowIndex, [f]),
      );
    }
  }

  const modes = modesFromHistogram(remainderHist, remainderFragmentTotal);
  const edges = bandEdgesFromModeCenters(modes.map((m) => m.center));
  const candidateBands: CandidateXBandV0[] = edges.map((edge, bandIndex) => ({
    bandIndex,
    normalizedLeft: edge.left,
    normalizedRight: edge.right,
    modeCenterX: edge.modeCenter,
    fragmentCount: 0,
    rowCoverage: 0,
    exampleRawTexts: [],
    descriptiveShapeCounts: {},
    semanticRole: "UNASSIGNED",
  }));
  const bandRowSets = candidateBands.map(() => new Set<string>());
  for (const { row, geo } of located) {
    const key = rowKey(row.visual.sourceImageSha256, row.visual.visualRowIndex);
    for (const f of geo.semanticRemainderFragments) {
      const regions = regionsFromRemainder({
        remainder: [f],
        bands: edges,
      });
      const idx = regions[0]?.occupiedBandIndex;
      if (idx == null) continue;
      const band = candidateBands[idx];
      if (!band) continue;
      band.fragmentCount += 1;
      bandRowSets[idx]!.add(key);
      band.rowCoverage = bandRowSets[idx]!.size;
      if (band.exampleRawTexts.length < 8 && !band.exampleRawTexts.includes(f.rawText)) {
        band.exampleRawTexts.push(f.rawText);
      }
      const shape = f.descriptiveShape;
      band.descriptiveShapeCounts[shape] =
        (band.descriptiveShapeCounts[shape] ?? 0) + 1;
    }
  }

  const occupancyCounts = new Map<string, number>();
  const occupancyRows = new Map<string, ProtoRoundRawFieldRegionCandidateV0[]>();

  const rows: ProtoRoundRawFieldRegionCandidateV0[] = located.map(({ row, geo }) => {
    const regions = regionsFromRemainder({
      remainder: geo.semanticRemainderFragments,
      bands: edges,
    });
    const occupied = [
      ...new Set(
        regions
          .map((r) => r.occupiedBandIndex)
          .filter((v): v is number => v != null),
      ),
    ].sort((a, b) => a - b);
    const key = occupancyKey(occupied);
    const out: ProtoRoundRawFieldRegionCandidateV0 = {
      sourceImageSha256: row.visual.sourceImageSha256,
      sourceFileName: row.visual.sourceFileName,
      visualRowIndex: row.visual.visualRowIndex,
      imageWidth: row.imageWidth,
      rowIdentifierCandidate: row.semantic.rowIdentifierCandidate,
      scheduledLocalCandidate: row.semantic.scheduledLocalCandidate,
      layoutStatus: geo.layoutStatus,
      visualJoinedTextCandidate: row.visual.visualJoinedTextCandidate,
      identifierFragment: geo.identifierFragment,
      dateTimeFragments: geo.dateTimeFragments,
      semanticRemainderFragments: geo.semanticRemainderFragments,
      regions,
      layoutPatternId: null,
      acceptedObservationTime: null,
      teamNormalizationStatus: "NOT_PERFORMED",
      leagueNormalizationStatus: "NOT_PERFORMED",
      homeAwaySemanticsAssigned: false,
      marketSemanticsAssigned: false,
      oddsParsingStatus: "NOT_PERFORMED",
      officialOddsStatus: "NOT_EXTRACTED",
      gameMatchingStatus: "NOT_MATCHED",
    };
    occupancyCounts.set(key, (occupancyCounts.get(key) ?? 0) + 1);
    const list = occupancyRows.get(key) ?? [];
    list.push(out);
    occupancyRows.set(key, list);
    return out;
  });

  const rankedKeys = [...occupancyCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const recurring = rankedKeys.filter(([, count]) => count >= 2);
  const singletons = rankedKeys.filter(([, count]) => count === 1);
  const layoutPatterns: LayoutPatternV0[] = recurring.map(([key, rowCount], rank) => {
    const patternId = patternIdForRank(rank);
    const members = occupancyRows.get(key) ?? [];
    for (const m of members) m.layoutPatternId = patternId;
    const occupiedBandIndexes = key === "EMPTY" ? [] : key.split("+").map(Number);
    const regionCounts = members.map((m) => m.regions.length).sort((a, b) => a - b);
    const modeCount =
      regionCounts.length === 0
        ? null
        : regionCounts[Math.floor((regionCounts.length - 1) / 2)]!;
    return {
      patternId,
      occupancyKey: key,
      rowCount,
      occupiedBandIndexes,
      remainderRegionCountMode: modeCount,
      previews: members.slice(0, 10).map((m) => ({
        sourceFileName: m.sourceFileName,
        visualRowIndex: m.visualRowIndex,
        rowIdentifierCandidate: m.rowIdentifierCandidate,
        scheduledLocalCandidate: m.scheduledLocalCandidate,
        visualJoinedTextCandidate: m.visualJoinedTextCandidate,
        regions: m.regions.map((r) => ({
          regionIndex: r.regionIndex,
          joinedRawText: r.joinedRawText,
          normalizedLeft: r.normalizedLeft,
          normalizedRight: r.normalizedRight,
        })),
      })),
    };
  });
  const unclassifiedMembers = singletons.flatMap(([key]) => occupancyRows.get(key) ?? []);
  for (const m of unclassifiedMembers) m.layoutPatternId = "LAYOUT_PATTERN_UNCLASSIFIED";
  if (unclassifiedMembers.length > 0) {
    layoutPatterns.push({
      patternId: "LAYOUT_PATTERN_UNCLASSIFIED",
      occupancyKey: "UNIQUE_OCCUPANCY",
      rowCount: unclassifiedMembers.length,
      occupiedBandIndexes: [],
      remainderRegionCountMode: null,
      previews: unclassifiedMembers.slice(0, 10).map((m) => ({
        sourceFileName: m.sourceFileName,
        visualRowIndex: m.visualRowIndex,
        rowIdentifierCandidate: m.rowIdentifierCandidate,
        scheduledLocalCandidate: m.scheduledLocalCandidate,
        visualJoinedTextCandidate: m.visualJoinedTextCandidate,
        regions: m.regions.map((r) => ({
          regionIndex: r.regionIndex,
          joinedRawText: r.joinedRawText,
          normalizedLeft: r.normalizedLeft,
          normalizedRight: r.normalizedRight,
        })),
      })),
    });
  }

  const usable = rows.filter((r) => r.layoutStatus !== "GEOMETRY_UNAVAILABLE").length;
  const anchorDate = located.filter(
    (x) => x.geo.layoutStatus === "ANCHOR_COMPLETE",
  ).length;
  const anchorDateTime = located.filter(
    (x) =>
      x.geo.layoutStatus === "ANCHOR_COMPLETE" &&
      x.row.semantic.timeParseStatus === "PARSED_EXACT",
  ).length;

  return {
    meta: {
      schemaVersion: COLUMN_LAYOUT_AUDIT_SCHEMA_VERSION,
      protoRoundKey: input.visual.meta.protoRoundKey,
      year: input.visual.meta.year,
      round: input.visual.meta.round,
      sourceVisualRowsSchema: "proto-round-visual-rows-v0",
      sourceAnchorScheduleSchema: "proto-round-row-anchor-schedule-v0",
      sourceImages: input.visual.images.length,
      sourceVisualRows: rows.length,
      geometryBasis: GEOMETRY_BASIS,
      columnLayoutAuditScope: COLUMN_LAYOUT_AUDIT_SCOPE,
      discoveredBandsAreProductionContract: DISCOVERED_BANDS_ARE_PRODUCTION_CONTRACT,
      semanticRegionContractFrozen: SEMANTIC_REGION_CONTRACT_FROZEN,
      auditDiscoveryParametersOnly: AUDIT_DISCOVERY_PARAMETERS_ONLY,
      regionSemanticRoleAssigned: REGION_SEMANTIC_ROLE_ASSIGNED,
      layoutDiscoveryBinWidth: LAYOUT_DISCOVERY_BIN_WIDTH,
      layoutDiscoveryMinModeShare: LAYOUT_DISCOVERY_MIN_MODE_SHARE,
      boundaryDerivationMethod: BOUNDARY_DERIVATION_METHOD,
      round105CountSpecialCase: ROUND_105_COUNT_SPECIAL_CASE,
      fieldBoundaryOutcomeTuning: FIELD_BOUNDARY_OUTCOME_TUNING,
      semanticAssignment: "NOT_PERFORMED",
      ocrRepair: "DISABLED",
      ocrOddsRepair: "DISABLED",
      teamNormalization: "NOT_PERFORMED",
      leagueNormalization: "NOT_PERFORMED",
      homeAwaySemanticsAssigned: false,
      marketSemanticsAssigned: false,
      officialOddsExtraction: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageDedupe: CROSS_IMAGE_ROW_AUTO_DEDUPE,
      acceptedObservationTimes: "NOT_ASSIGNED",
      multiLayoutCandidate: recurring.length > 1,
    },
    coverage: {
      totalRows: rows.length,
      rowsWithUsableNormalizedGeometry: usable,
      rowsWithAnchorAndDateGeometry: anchorDate,
      rowsWithAnchorDateAndExactTimeGeometry: anchorDateTime,
      uniqueLayoutPatternCount: recurring.length,
      unclassifiedLayoutRows: unclassifiedMembers.length,
    },
    anchorGeometry: {
      identifierCenterX: distribution(identifierCenters),
      dateTimeCenterX: distribution(dateTimeCenters),
      exactClockCenterX: distribution(exactClockCenters),
    },
    remainderHistogram: remainderHist.filter((b) => b.fragmentCount > 0),
    candidateBands,
    layoutPatterns,
    marketSignalAudit: auditMarketSignals(remainderTagged),
    numericShapeAudit: auditNumericShapes(remainderTagged),
    rows,
  };
}
