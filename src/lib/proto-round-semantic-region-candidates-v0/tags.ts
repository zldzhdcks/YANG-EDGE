import {
  classifyNumericRawShape,
  classifyTokenShape,
  isValidNormalizedFragmentGeometry,
} from "../proto-round-column-layout-audit-v0";
import type { LayoutFragmentV0 } from "../proto-round-column-layout-audit-v0/types";
import type {
  RawEvidenceTagV0,
  RegionGeometryStatusV0,
  RowRawEvidenceSignatureLetterV0,
} from "./types";

const HANGUL = /[\uAC00-\uD7A3]/;
const LATIN = /[A-Za-z]/;

/**
 * Per-fragment class is exclusive and deterministic.
 *
 * RAW_EVIDENCE_TAG_COMPOSITION = DETERMINISTIC
 *
 * First match wins:
 *   1. invalid normalized geometry → skip fragment (no tag)
 *   2. exact sealed marker (SUM / U-decimal / O-decimal / H-decimal)
 *      → EXACT_MARKET_MARKER_RAW only
 *   3. numeric-like raw shape → NUMERIC_LIKE_RAW only
 *   4. Hangul or Latin present → TEXT_BEARING_RAW only
 *   5. otherwise no fragment-level class
 *
 * Region tags = sorted union of fragment classes.
 * Exact market markers do not also receive TEXT or NUMERIC tags.
 * If the union is empty and at least one fragment is geometrically valid
 * → OTHER_RAW.
 */
const TAG_ORDER: RawEvidenceTagV0[] = [
  "TEXT_BEARING_RAW",
  "EXACT_MARKET_MARKER_RAW",
  "NUMERIC_LIKE_RAW",
  "OTHER_RAW",
];

export function isExactMarketMarkerRaw(rawText: string): boolean {
  const shape = classifyTokenShape(rawText);
  return (
    shape === "SUM_EXACT" ||
    shape === "U_DECIMAL_EXACT" ||
    shape === "O_DECIMAL_EXACT" ||
    shape === "H_DECIMAL_EXACT"
  );
}

export function isNumericLikeRaw(rawText: string): boolean {
  if (isExactMarketMarkerRaw(rawText)) return false;
  return classifyNumericRawShape(rawText) !== "NON_NUMERIC";
}

export function isTextBearingRaw(rawText: string): boolean {
  if (isExactMarketMarkerRaw(rawText)) return false;
  return HANGUL.test(rawText) || LATIN.test(rawText);
}

export function sortRawEvidenceTags(tags: Iterable<RawEvidenceTagV0>): RawEvidenceTagV0[] {
  const set = new Set(tags);
  return TAG_ORDER.filter((t) => set.has(t));
}

export function assignRawEvidenceTags(fragments: LayoutFragmentV0[]): {
  tags: RawEvidenceTagV0[];
  geometryStatus: RegionGeometryStatusV0;
  validFragmentCount: number;
  invalidFragmentCount: number;
} {
  let validFragmentCount = 0;
  let invalidFragmentCount = 0;
  let text = false;
  let numeric = false;
  let market = false;
  for (const frag of fragments) {
    if (!isValidNormalizedFragmentGeometry(frag)) {
      invalidFragmentCount += 1;
      continue;
    }
    validFragmentCount += 1;
    if (isExactMarketMarkerRaw(frag.rawText)) {
      market = true;
      continue;
    }
    if (isNumericLikeRaw(frag.rawText)) {
      numeric = true;
      continue;
    }
    if (isTextBearingRaw(frag.rawText)) {
      text = true;
    }
  }
  const tags: RawEvidenceTagV0[] = [];
  if (text) tags.push("TEXT_BEARING_RAW");
  if (market) tags.push("EXACT_MARKET_MARKER_RAW");
  if (numeric) tags.push("NUMERIC_LIKE_RAW");
  if (tags.length === 0 && validFragmentCount > 0) {
    tags.push("OTHER_RAW");
  }
  const geometryStatus: RegionGeometryStatusV0 =
    invalidFragmentCount === 0
      ? "VALID"
      : validFragmentCount === 0
        ? "INVALID_NORMALIZED_GEOMETRY"
        : "MIXED";
  return {
    tags: sortRawEvidenceTags(tags),
    geometryStatus,
    validFragmentCount,
    invalidFragmentCount,
  };
}

export function regionSignatureLetter(input: {
  tags: RawEvidenceTagV0[];
  geometryStatus: RegionGeometryStatusV0;
}): RowRawEvidenceSignatureLetterV0 {
  if (input.geometryStatus === "INVALID_NORMALIZED_GEOMETRY") return "I";
  const content = input.tags.filter((t) => t !== "OTHER_RAW");
  if (content.length > 1) return "X";
  if (content[0] === "TEXT_BEARING_RAW") return "T";
  if (content[0] === "EXACT_MARKET_MARKER_RAW") return "M";
  if (content[0] === "NUMERIC_LIKE_RAW") return "N";
  return "O";
}

export function rowRawEvidenceSignature(
  regions: Array<{
    tags: RawEvidenceTagV0[];
    geometryStatus: RegionGeometryStatusV0;
  }>,
): string {
  if (regions.length === 0) return "";
  return regions.map((r) => regionSignatureLetter(r)).join(" | ");
}
