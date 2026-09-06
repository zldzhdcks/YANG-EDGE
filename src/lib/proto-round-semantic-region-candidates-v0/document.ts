import type { ColumnLayoutAuditDocumentV0 } from "../proto-round-column-layout-audit-v0/types";
import { CROSS_IMAGE_ROW_AUTO_DEDUPE } from "../proto-round-extraction-design-v0/types";
import {
  auditLayoutPatternEvidence,
  auditRawEvidenceTags,
  auditSignatures,
  auditTagCombinations,
  representativePreviews,
  taggedRegionFromSource,
} from "./audits";
import { assertColumnLayoutAuditSource } from "./source";
import { rowRawEvidenceSignature } from "./tags";
import {
  BAND_1_MARKET_CONTRACT,
  BAND_INDEX_SEMANTIC_MEANING,
  BAND_INDEX_USED_AS_SEMANTIC_LABEL,
  EXACT_MARKET_MARKER_RAW_IS_OFFICIAL_MARKET,
  MARKET_SEMANTICS_ASSIGNED,
  NUMERIC_LIKE_RAW_IS_ODDS,
  OCR_CORRECTION,
  OCR_ODDS_REPAIR,
  RAW_EVIDENCE_TAG_COMPOSITION,
  RAW_REGION_TEXT_MODIFIED,
  SEMANTIC_REGION_CANDIDATES_SCHEMA_VERSION,
  SEMANTIC_SCOPE,
  TEXT_BEARING_RAW_IS_LEAGUE,
  TEXT_BEARING_RAW_IS_TEAM,
  type ProtoRoundSemanticRegionCandidateV0,
  type SemanticRegionCandidatesDocumentV0,
} from "./types";

export function buildSemanticRegionCandidatesDocumentV0(
  layout: ColumnLayoutAuditDocumentV0,
): SemanticRegionCandidatesDocumentV0 {
  assertColumnLayoutAuditSource(layout);

  const rows: ProtoRoundSemanticRegionCandidateV0[] = layout.rows.map((row) => {
    const regions = row.regions.map((region) => taggedRegionFromSource(region));
    return {
      sourceImageSha256: row.sourceImageSha256,
      sourceFileName: row.sourceFileName,
      visualRowIndex: row.visualRowIndex,
      rowIdentifierCandidate: row.rowIdentifierCandidate,
      scheduledLocalCandidate: row.scheduledLocalCandidate,
      layoutPatternId: row.layoutPatternId,
      visualJoinedTextCandidate: row.visualJoinedTextCandidate,
      regions,
      rowRawEvidenceSignature: rowRawEvidenceSignature(
        regions.map((r) => ({
          tags: r.rawEvidenceTags,
          geometryStatus: r.geometryStatus,
        })),
      ),
      teamParsingStatus: "NOT_PERFORMED",
      leagueParsingStatus: "NOT_PERFORMED",
      marketParsingStatus: "NOT_PERFORMED",
      oddsParsingStatus: "NOT_PERFORMED",
      gameMatchingStatus: "NOT_PERFORMED",
      acceptedObservationTime: null,
    };
  });

  const allRegions = rows.flatMap((r) => r.regions);
  const tagHas = (tag: "TEXT_BEARING_RAW" | "NUMERIC_LIKE_RAW" | "EXACT_MARKET_MARKER_RAW" | "OTHER_RAW") =>
    allRegions.filter((r) => r.rawEvidenceTags.includes(tag));
  const rowHas = (tag: "TEXT_BEARING_RAW" | "NUMERIC_LIKE_RAW" | "EXACT_MARKET_MARKER_RAW" | "OTHER_RAW") =>
    rows.filter((row) => row.regions.some((r) => r.rawEvidenceTags.includes(tag)));

  return {
    meta: {
      schemaVersion: SEMANTIC_REGION_CANDIDATES_SCHEMA_VERSION,
      protoRoundKey: layout.meta.protoRoundKey,
      year: layout.meta.year,
      round: layout.meta.round,
      sourceColumnLayoutSchema: "proto-round-column-layout-audit-v0",
      sourceImages: layout.meta.sourceImages,
      sourceVisualRows: rows.length,
      semanticScope: SEMANTIC_SCOPE,
      bandIndexSemanticMeaning: BAND_INDEX_SEMANTIC_MEANING,
      bandIndexUsedAsSemanticLabel: BAND_INDEX_USED_AS_SEMANTIC_LABEL,
      band1MarketContract: BAND_1_MARKET_CONTRACT,
      rawEvidenceTagComposition: RAW_EVIDENCE_TAG_COMPOSITION,
      rawRegionTextModified: RAW_REGION_TEXT_MODIFIED,
      textBearingRawIsTeam: TEXT_BEARING_RAW_IS_TEAM,
      textBearingRawIsLeague: TEXT_BEARING_RAW_IS_LEAGUE,
      numericLikeRawIsOdds: NUMERIC_LIKE_RAW_IS_ODDS,
      exactMarketMarkerRawIsOfficialMarket: EXACT_MARKET_MARKER_RAW_IS_OFFICIAL_MARKET,
      marketSemanticsAssigned: MARKET_SEMANTICS_ASSIGNED,
      teamParsing: "NOT_PERFORMED",
      leagueParsing: "NOT_PERFORMED",
      marketParsing: "NOT_PERFORMED",
      oddsParsing: "NOT_PERFORMED",
      ocrCorrection: OCR_CORRECTION,
      oddsRepair: OCR_ODDS_REPAIR,
      officialOddsExtraction: "NOT_PERFORMED",
      gameMatching: "NOT_PERFORMED",
      crossImageDedupe: CROSS_IMAGE_ROW_AUTO_DEDUPE,
      acceptedObservationTimes: "NOT_ASSIGNED",
    },
    coverage: {
      totalRows: rows.length,
      totalRegions: allRegions.length,
      textBearingRawRegions: tagHas("TEXT_BEARING_RAW").length,
      textBearingRawRows: rowHas("TEXT_BEARING_RAW").length,
      numericLikeRawRegions: tagHas("NUMERIC_LIKE_RAW").length,
      numericLikeRawRows: rowHas("NUMERIC_LIKE_RAW").length,
      exactMarketMarkerRawRegions: tagHas("EXACT_MARKET_MARKER_RAW").length,
      exactMarketMarkerRawRows: rowHas("EXACT_MARKET_MARKER_RAW").length,
      otherRawRegions: tagHas("OTHER_RAW").length,
      otherRawRows: rowHas("OTHER_RAW").length,
      invalidNormalizedGeometryRegions: allRegions.filter(
        (r) => r.geometryStatus === "INVALID_NORMALIZED_GEOMETRY",
      ).length,
      invalidNormalizedGeometryRows: rows.filter((row) =>
        row.regions.some((r) => r.geometryStatus === "INVALID_NORMALIZED_GEOMETRY"),
      ).length,
    },
    tagAudit: auditRawEvidenceTags(rows),
    tagCombinationAudit: auditTagCombinations(rows),
    signatureAudit: auditSignatures(rows),
    layoutPatternEvidenceAudit: auditLayoutPatternEvidence(rows),
    representativePreviews: representativePreviews(rows),
    rows,
  };
}
