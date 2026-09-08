/**
 * Safe numeric reconstruction — experiment diagnostic only.
 *
 * Applies only inside one independent OCR extract (one crop / one language).
 * Does not reorder cells, delete isolated 0s, or repair contiguous 3-digit tokens.
 *
 * Unambiguous token shape:
 *   ^[0-9][ -][0-9]{2}[!.,]?$
 *
 * Examples:
 *   "2 95"  -> "2.95"
 *   "1-91"  -> "1.91"
 *   "7 80!" -> "7.80"
 *
 * Forbidden:
 *   "264" remains "264"
 */

export const SAFE_NUMERIC_TOKEN_PATTERN = /^[0-9][ -][0-9]{2}[!.,]?$/;

const SAFE_NUMERIC_SEARCH_PATTERN = /(?<![0-9])([0-9])([ -])([0-9]{2})[!.,]?(?![0-9])/g;

export function safeReconstructNumericToken(token: string): string | null {
  const m = token.match(/^([0-9])([ -])([0-9]{2})[!.,]?$/);
  if (!m) return null;
  return `${m[1]}.${m[3]}`;
}

export function collectSafeReconstructedNumerics(regionText: string): string[] {
  if (typeof regionText !== "string" || regionText.length === 0) return [];
  const out: string[] = [];
  const re = new RegExp(SAFE_NUMERIC_SEARCH_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(regionText)) !== null) {
    out.push(`${match[1]}.${match[3]}`);
  }
  return out;
}
