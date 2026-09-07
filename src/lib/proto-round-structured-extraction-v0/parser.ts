/**
 * Fail-closed first-shot parser.
 *
 * Uses region tags + left-to-right geometry only.
 * Does not repair OCR. Does not invent missing text.
 * Does not assign HOME/AWAY or official market types.
 */
import type {
  ProtoRoundSemanticRegionCandidateV0,
  SemanticRegionCandidateRegionV0,
} from "../proto-round-semantic-region-candidates-v0/types";
import type { FieldParseStatusV0, StructuredExtractionRowV0 } from "./types";

const EXACT_FOUR_DIGIT = /^[0-9]{4}$/;
const STATUS_CHROME = /경기전|김기전|결과|결가/;
const LEAGUE_CHROME = /리그/;

function exclusiveTag(
  region: SemanticRegionCandidateRegionV0,
  tag: SemanticRegionCandidateRegionV0["rawEvidenceTags"][number],
): boolean {
  return (
    region.geometryStatus === "VALID" &&
    region.rawEvidenceTags.length === 1 &&
    region.rawEvidenceTags[0] === tag
  );
}

function byNormalizedLeft(
  a: SemanticRegionCandidateRegionV0,
  b: SemanticRegionCandidateRegionV0,
): number {
  if (a.normalizedLeft !== b.normalizedLeft) return a.normalizedLeft - b.normalizedLeft;
  return a.regionIndex - b.regionIndex;
}

function parseIdentifier(row: ProtoRoundSemanticRegionCandidateV0): {
  value: string | null;
  status: FieldParseStatusV0;
} {
  const n = row.rowIdentifierCandidate;
  if (n == null || !Number.isInteger(n)) {
    return { value: null, status: "INSUFFICIENT_EVIDENCE" };
  }
  const raw = String(n);
  if (!EXACT_FOUR_DIGIT.test(raw)) {
    return { value: null, status: "INSUFFICIENT_EVIDENCE" };
  }
  return { value: raw, status: "PARSED" };
}

function parseMarket(row: ProtoRoundSemanticRegionCandidateV0): {
  value: string | null;
  status: FieldParseStatusV0;
  regions: SemanticRegionCandidateRegionV0[];
} {
  const mixed = row.regions.filter(
    (r) =>
      r.rawEvidenceTags.includes("EXACT_MARKET_MARKER_RAW") &&
      r.rawEvidenceTags.length > 1,
  );
  if (mixed.length > 0) {
    return { value: null, status: "AMBIGUOUS", regions: [] };
  }
  const regions = row.regions
    .filter((r) => exclusiveTag(r, "EXACT_MARKET_MARKER_RAW"))
    .sort(byNormalizedLeft);
  if (regions.length === 0) {
    return { value: null, status: "INSUFFICIENT_EVIDENCE", regions: [] };
  }
  const texts = [...new Set(regions.map((r) => r.joinedRawText))];
  if (texts.length !== 1) {
    return { value: null, status: "AMBIGUOUS", regions: [] };
  }
  const value = texts[0]!;
  if (value.length === 0) {
    return { value: null, status: "INSUFFICIENT_EVIDENCE", regions: [] };
  }
  return { value, status: "PARSED", regions };
}

function parseNumeric(row: ProtoRoundSemanticRegionCandidateV0): {
  values: string[];
  status: FieldParseStatusV0;
} {
  const mixedNumeric = row.regions.some(
    (r) =>
      r.rawEvidenceTags.includes("NUMERIC_LIKE_RAW") &&
      r.rawEvidenceTags.length > 1,
  );
  const regions = row.regions
    .filter((r) => exclusiveTag(r, "NUMERIC_LIKE_RAW"))
    .sort(byNormalizedLeft);
  if (regions.length === 0) {
    return {
      values: [],
      status: mixedNumeric ? "AMBIGUOUS" : "INSUFFICIENT_EVIDENCE",
    };
  }
  const fragments = regions.flatMap((r) => r.fragments).slice();
  fragments.sort((a, b) => {
    if (a.normalizedLeftX !== b.normalizedLeftX) return a.normalizedLeftX - b.normalizedLeftX;
    return a.rawLineIndex - b.rawLineIndex;
  });
  const values = fragments.map((f) => f.rawText).filter((t) => t.length > 0);
  if (values.length === 0) {
    return { values: [], status: "INSUFFICIENT_EVIDENCE" };
  }
  return { values, status: "PARSED" };
}

function isStatusChrome(text: string): boolean {
  return STATUS_CHROME.test(text);
}

function isLeagueChrome(text: string): boolean {
  return LEAGUE_CHROME.test(text);
}

function parseParticipants(
  row: ProtoRoundSemanticRegionCandidateV0,
  marketRegions: SemanticRegionCandidateRegionV0[],
): {
  left: string | null;
  right: string | null;
  status: FieldParseStatusV0;
} {
  const mixedText = row.regions.some(
    (r) =>
      r.rawEvidenceTags.includes("TEXT_BEARING_RAW") &&
      r.rawEvidenceTags.length > 1,
  );
  const textRegions = row.regions
    .filter((r) => exclusiveTag(r, "TEXT_BEARING_RAW"))
    .sort(byNormalizedLeft);
  const withoutStatus = textRegions.filter((r) => !isStatusChrome(r.joinedRawText));
  const marketCut =
    marketRegions.length === 1 ? marketRegions[0]!.normalizedLeft : null;
  const remaining = withoutStatus.filter((r) => {
    if (isLeagueChrome(r.joinedRawText)) return false;
    if (marketCut != null && r.normalizedRight <= marketCut) return false;
    return r.joinedRawText.length > 0;
  });

  if (remaining.length === 2) {
    return {
      left: remaining[0]!.joinedRawText,
      right: remaining[1]!.joinedRawText,
      status: "PARSED",
    };
  }

  const numericRegions = row.regions
    .filter((r) => exclusiveTag(r, "NUMERIC_LIKE_RAW"))
    .sort(byNormalizedLeft);
  if (remaining.length >= 2 && numericRegions.length > 0) {
    const firstNumLeft = numericRegions[0]!.normalizedLeft;
    const lastNumRight = numericRegions[numericRegions.length - 1]!.normalizedRight;
    const leftCands = remaining.filter((r) => r.normalizedRight <= firstNumLeft);
    const midCands = remaining.filter(
      (r) => r.normalizedLeft >= firstNumLeft && r.normalizedRight <= lastNumRight,
    );
    const rightCands = remaining.filter((r) => r.normalizedLeft >= lastNumRight);
    const pair =
      leftCands.length === 1 && rightCands.length === 1 && midCands.length === 0
        ? ([leftCands[0]!, rightCands[0]!] as const)
        : leftCands.length === 1 && midCands.length === 1 && rightCands.length === 0
          ? ([leftCands[0]!, midCands[0]!] as const)
          : null;
    if (pair) {
      return { left: pair[0].joinedRawText, right: pair[1].joinedRawText, status: "PARSED" };
    }
  }

  if (remaining.length > 2) {
    return { left: null, right: null, status: "AMBIGUOUS" };
  }
  if (mixedText && remaining.length < 2) {
    return { left: null, right: null, status: "AMBIGUOUS" };
  }
  return { left: null, right: null, status: "INSUFFICIENT_EVIDENCE" };
}

function combineRowStatus(fields: FieldParseStatusV0[]): FieldParseStatusV0 {
  if (fields.some((s) => s === "AMBIGUOUS")) return "AMBIGUOUS";
  if (fields.some((s) => s === "PARSED")) {
    return "PARSED";
  }
  return "INSUFFICIENT_EVIDENCE";
}

export function parseStructuredRowV0(
  row: ProtoRoundSemanticRegionCandidateV0,
): StructuredExtractionRowV0 {
  const identifier = parseIdentifier(row);
  const market = parseMarket(row);
  const numeric = parseNumeric(row);
  const participants = parseParticipants(row, market.regions);
  const rowParsingStatus = combineRowStatus([
    identifier.status,
    participants.status,
    market.status,
    numeric.status,
  ]);
  return {
    sourceImageSha256: row.sourceImageSha256,
    sourceFileName: row.sourceFileName,
    visualRowIndex: row.visualRowIndex,
    screenRowIdentifierCandidateRaw: identifier.value,
    participantLeftCandidateRaw: participants.left,
    participantRightCandidateRaw: participants.right,
    marketMarkerCandidateRaw: market.value,
    numericCellsCandidateRaw: numeric.values,
    rowIdentifierParsingStatus: identifier.status,
    participantParsingStatus: participants.status,
    marketMarkerParsingStatus: market.status,
    numericCellsParsingStatus: numeric.status,
    rowParsingStatus,
    homeAwayAssigned: false,
    marketSemanticsAssigned: false,
    officialOddsRecordCreated: false,
    acceptedObservationTime: null,
  };
}
