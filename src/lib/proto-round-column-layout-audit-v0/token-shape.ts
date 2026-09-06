import type { DescriptiveShapeClass, NumericRawShapeClass, TokenShapeClass } from "./types";

const HANGUL = /[\uAC00-\uD7A3]/;
const LATIN = /[A-Za-z]/;

export function classifyTokenShape(rawText: string): TokenShapeClass {
  const t = rawText;
  if (/^[0-9]{4}$/.test(t)) return "FOUR_DIGIT_EXACT";
  if (/^[0-9]{2}$/.test(t)) return "TWO_DIGIT";
  if (/^[0-9]+$/.test(t)) return "INTEGER_ASCII";
  if (/^[0-9]+\.[0-9]+$/.test(t)) return "DECIMAL_ASCII";
  if (/^H\s*[+-]?[0-9]+(?:\.[0-9]+)?$/.test(t)) return "H_DECIMAL_EXACT";
  if (/^U[0-9]+(?:\.[0-9]+)?$/.test(t)) return "U_DECIMAL_EXACT";
  if (/^O[0-9]+(?:\.[0-9]+)?$/.test(t)) return "O_DECIMAL_EXACT";
  if (t === "SUM") return "SUM_EXACT";
  const hasHangul = HANGUL.test(t);
  const hasLatin = LATIN.test(t);
  const hasDigit = /[0-9]/.test(t);
  if (hasHangul && !hasLatin && !hasDigit) return "HANGUL_TEXT";
  if (hasLatin && !hasHangul && !hasDigit) return "LATIN_TEXT";
  if ((hasHangul && hasLatin) || (hasHangul && hasDigit) || (hasLatin && hasDigit)) {
    return "MIXED_TEXT";
  }
  if (hasHangul) return "HANGUL_TEXT";
  if (hasLatin) return "LATIN_TEXT";
  return "OTHER";
}

export function classifyDescriptiveShape(rawText: string): DescriptiveShapeClass {
  const t = rawText;
  if (t === "SUM") return "SUM_LITERAL";
  if (/^H(?:$|\s|[+-]|[0-9])/.test(t)) return "H_PREFIX";
  if (/^U[0-9]/.test(t)) return "U_PREFIX";
  if (/^[0-9]+$/.test(t)) return "ALL_DIGITS";
  if (/^[0-9]+[.\-][0-9]+$/.test(t) || /^[0-9]+\.[0-9]+$/.test(t)) return "DECIMAL_LIKE";
  const hasHangul = HANGUL.test(t);
  const hasLatin = LATIN.test(t);
  if (hasHangul && hasLatin) return "MIXED";
  if (hasHangul) return "HANGUL_PRESENT";
  if (hasLatin) return "LATIN_PRESENT";
  if (/[0-9]/.test(t) && /[^0-9]/.test(t)) return "MIXED";
  return "OTHER";
}

export function classifyNumericRawShape(rawText: string): NumericRawShapeClass {
  const t = rawText;
  if (/!$/.test(t) && /[0-9]/.test(t)) return "BANG_SUFFIX";
  if (/^[0-9]+ [0-9]+$/.test(t)) return "SPACED_DIGIT_GROUPS";
  if (/^[0-9]+-[0-9]+$/.test(t)) return "HYPHEN_DIGIT_GROUPS";
  if (/^[0-9]+$/.test(t)) return "INTEGER_ASCII";
  if (/^[0-9]+\.[0-9]+$/.test(t)) return "DECIMAL_ASCII";
  if (/[0-9]/.test(t) && /^[0-9 .\-]+$/.test(t)) return "OTHER_NUMERIC_LIKE";
  return "NON_NUMERIC";
}

export function looksLikeUnrepairedOddsRaw(rawText: string): boolean {
  return (
    classifyNumericRawShape(rawText) === "SPACED_DIGIT_GROUPS" ||
    classifyNumericRawShape(rawText) === "HYPHEN_DIGIT_GROUPS" ||
    classifyNumericRawShape(rawText) === "BANG_SUFFIX"
  );
}
