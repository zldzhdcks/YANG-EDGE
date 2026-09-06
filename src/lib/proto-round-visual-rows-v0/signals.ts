/**
 * Descriptive audit counters only.
 * FOUR_DIGIT_TOKEN_SEMANTIC_ROLE = UNASSIGNED
 * MARKET_SIGNAL_SEMANTICS_ASSIGNED = NO
 * These helpers never write gameNumber / kickoff / market fields.
 */
import type { VisualRowCandidateV0 } from "./types";

const FOUR_DIGIT = /^[0-9]{4}$/;

function rowTextParts(row: VisualRowCandidateV0): string[] {
  return row.fragments.map((f) => f.rawText);
}

export function rowHasStandaloneFourDigitToken(row: VisualRowCandidateV0): boolean {
  return rowTextParts(row).some((t) => FOUR_DIGIT.test(t));
}

export function rowHasDecimalPoint(row: VisualRowCandidateV0): boolean {
  return rowTextParts(row).some((t) => t.includes("."));
}

export function rowHasCharH(row: VisualRowCandidateV0): boolean {
  return rowTextParts(row).some((t) => t.includes("H"));
}

export function rowHasCharU(row: VisualRowCandidateV0): boolean {
  return rowTextParts(row).some((t) => t.includes("U"));
}

export function rowHasCharO(row: VisualRowCandidateV0): boolean {
  return rowTextParts(row).some((t) => t.includes("O"));
}

export function rowHasDateTimeLikeSignal(row: VisualRowCandidateV0): boolean {
  const parts = rowTextParts(row);
  const blob = parts.join(" ");
  const hasMarker =
    blob.includes("09") ||
    blob.includes("06") ||
    blob.includes("07") ||
    blob.includes("(일)") ||
    blob.includes("(월)");
  const hasDigit = /[0-9]/.test(blob);
  return hasMarker && hasDigit;
}

export function countSignalRows(
  rows: VisualRowCandidateV0[],
): {
  fourDigitTokenRowCount: number;
  dateTimeLikeRowCount: number;
  dateTimeSunMarkerRowCount: number;
  dateTimeMonMarkerRowCount: number;
  decimalPointRowCount: number;
  charHRowCount: number;
  charURowCount: number;
  charORowCount: number;
} {
  return {
    fourDigitTokenRowCount: rows.filter(rowHasStandaloneFourDigitToken).length,
    dateTimeLikeRowCount: rows.filter(rowHasDateTimeLikeSignal).length,
    dateTimeSunMarkerRowCount: rows.filter((r) =>
      rowTextParts(r).some((t) => t.includes("(일)")),
    ).length,
    dateTimeMonMarkerRowCount: rows.filter((r) =>
      rowTextParts(r).some((t) => t.includes("(월)")),
    ).length,
    decimalPointRowCount: rows.filter(rowHasDecimalPoint).length,
    charHRowCount: rows.filter(rowHasCharH).length,
    charURowCount: rows.filter(rowHasCharU).length,
    charORowCount: rows.filter(rowHasCharO).length,
  };
}

export function fragmentCountDistribution(rows: VisualRowCandidateV0[]): {
  min: number | null;
  median: number | null;
  max: number | null;
} {
  if (rows.length === 0) return { min: null, median: null, max: null };
  const counts = rows.map((r) => r.fragmentCount).sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  const median =
    counts.length % 2 === 1
      ? counts[mid]!
      : (counts[mid - 1]! + counts[mid]!) / 2;
  return {
    min: counts[0]!,
    median,
    max: counts[counts.length - 1]!,
  };
}
