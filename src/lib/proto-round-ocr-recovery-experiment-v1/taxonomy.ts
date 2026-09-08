import type {
  NumericOcrPatternV1,
  ParticipantOcrPatternV1,
  TaxonomyCounts,
} from "./types";

const HANGUL = /[\uAC00-\uD7A3]/;
const LATIN = /[A-Za-z]/;
const TRAILING_PUNCT = /[!?.,;:]+$/;

export function emptyNumericTaxonomy(): TaxonomyCounts<NumericOcrPatternV1> {
  return {
    DIGIT_SPACE_DIGIT: 0,
    DIGIT_HYPHEN_DIGIT: 0,
    MISSING_DECIMAL: 0,
    TRAILING_PUNCTUATION: 0,
    EXTRA_NUMERIC_FRAGMENT: 0,
    OTHER: 0,
  };
}

export function emptyParticipantTaxonomy(): TaxonomyCounts<ParticipantOcrPatternV1> {
  return {
    ONE_CHARACTER_SUBSTITUTION: 0,
    MULTI_CHARACTER_SUBSTITUTION: 0,
    PREFIX_LOSS: 0,
    SUFFIX_LOSS: 0,
    LATIN_KOREAN_CONFUSION: 0,
    MISSING_TEXT: 0,
    FRAGMENTATION: 0,
    OTHER: 0,
  };
}

export function evidenceTokens(evidence: string): string[] {
  return evidence.split(/\s+/u).filter((t) => t.length > 0);
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function decimalDotToSpace(value: string): string {
  return value.replace(".", " ");
}

function decimalDotToHyphen(value: string): string {
  return value.replace(".", "-");
}

function isAsciiDecimal(value: string): boolean {
  return /^[0-9]+\.[0-9]+$/.test(value);
}

export function classifyNumericOcrPattern(input: {
  truth: string;
  evidence: string;
}): NumericOcrPatternV1 | null {
  if (typeof input.truth !== "string" || input.truth.length === 0) return null;
  if (input.evidence.includes(input.truth)) return null;

  const spaced = isAsciiDecimal(input.truth)
    ? decimalDotToSpace(input.truth)
    : null;
  const hyphen = isAsciiDecimal(input.truth)
    ? decimalDotToHyphen(input.truth)
    : null;
  const compact = isAsciiDecimal(input.truth)
    ? input.truth.replace(".", "")
    : digitsOnly(input.truth);

  if (spaced && input.evidence.includes(spaced)) {
    const bang = `${spaced}!`;
    if (input.evidence.includes(bang) || TRAILING_PUNCT.test(spaced)) {
      return "TRAILING_PUNCTUATION";
    }
    const tokens = evidenceTokens(input.evidence);
    if (
      tokens.some(
        (t) => t === `${spaced}!` || (TRAILING_PUNCT.test(t) && t.startsWith(spaced)),
      )
    ) {
      return "TRAILING_PUNCTUATION";
    }
    return "DIGIT_SPACE_DIGIT";
  }
  if (
    spaced &&
    evidenceTokens(input.evidence).some(
      (t) => t.startsWith(spaced) && TRAILING_PUNCT.test(t),
    )
  ) {
    return "TRAILING_PUNCTUATION";
  }
  if (hyphen && input.evidence.includes(hyphen)) {
    return "DIGIT_HYPHEN_DIGIT";
  }
  const truthDigits = digitsOnly(input.truth);
  const compactTokens = evidenceTokens(input.evidence);
  if (truthDigits.length > 0) {
    if (
      compactTokens.some((t) => {
        const d = digitsOnly(t);
        return d.includes(truthDigits) && d.length > truthDigits.length;
      })
    ) {
      return "EXTRA_NUMERIC_FRAGMENT";
    }
  }
  if (
    compact.length > 0 &&
    compact !== input.truth &&
    (compactTokens.includes(compact) || input.evidence.includes(compact))
  ) {
    if (isAsciiDecimal(input.truth) && compact === input.truth.replace(".", "")) {
      return "MISSING_DECIMAL";
    }
  }
  return "OTHER";
}

function charDiffCount(a: string, b: string): number {
  const n = Math.max(a.length, b.length);
  let diffs = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) diffs += 1;
  }
  return diffs;
}

function adjacentConcatEquals(tokens: string[], truth: string): boolean {
  if (tokens.length < 2) return false;
  for (let i = 0; i < tokens.length; i++) {
    let acc = "";
    for (let j = i; j < tokens.length; j++) {
      acc += tokens[j]!;
      if (acc === truth) return true;
      if (acc.length > truth.length) break;
    }
  }
  return false;
}

function bestSameLengthToken(tokens: string[], truth: string): string | null {
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const t of tokens) {
    if (t.length !== truth.length) continue;
    const d = charDiffCount(t, truth);
    if (d < bestDiff) {
      bestDiff = d;
      best = t;
    }
  }
  return best;
}

export function classifyParticipantOcrPattern(input: {
  truth: string | null;
  evidence: string;
}): ParticipantOcrPatternV1 | null {
  if (typeof input.truth !== "string" || input.truth.length === 0) return null;
  if (input.evidence.includes(input.truth)) return null;

  const tokens = evidenceTokens(input.evidence);
  if (tokens.length === 0 && input.evidence.trim() === "") {
    return "MISSING_TEXT";
  }
  if (adjacentConcatEquals(tokens, input.truth)) {
    return "FRAGMENTATION";
  }
  if (tokens.some((t) => t.length > 0 && input.truth!.startsWith(t) && t !== input.truth)) {
    return "PREFIX_LOSS";
  }
  if (tokens.some((t) => t.length > 0 && input.truth!.endsWith(t) && t !== input.truth)) {
    return "SUFFIX_LOSS";
  }
  const sameLen = bestSameLengthToken(tokens, input.truth);
  if (sameLen) {
    const diffs = charDiffCount(sameLen, input.truth);
    if (diffs === 1) return "ONE_CHARACTER_SUBSTITUTION";
    if (diffs > 1) {
      const truthHangul = HANGUL.test(input.truth);
      const truthLatin = LATIN.test(input.truth);
      const tokenHangul = HANGUL.test(sameLen);
      const tokenLatin = LATIN.test(sameLen);
      if ((truthHangul && tokenLatin && !tokenHangul) || (truthLatin && tokenHangul && !tokenLatin)) {
        return "LATIN_KOREAN_CONFUSION";
      }
      return "MULTI_CHARACTER_SUBSTITUTION";
    }
  }
  const truthHangul = HANGUL.test(input.truth);
  const truthLatin = LATIN.test(input.truth);
  if (
    tokens.some((t) => {
      const tokenHangul = HANGUL.test(t);
      const tokenLatin = LATIN.test(t);
      return (
        (truthHangul && tokenLatin && !tokenHangul) ||
        (truthLatin && tokenHangul && !tokenLatin)
      );
    })
  ) {
    return "LATIN_KOREAN_CONFUSION";
  }
  if (tokens.length === 0) return "MISSING_TEXT";
  return "OTHER";
}

export function accumulateNumericTaxonomy(
  counts: TaxonomyCounts<NumericOcrPatternV1>,
  truthCells: string[],
  evidence: string,
): void {
  for (let i = 0; i < truthCells.length; i++) {
    const pattern = classifyNumericOcrPattern({
      truth: truthCells[i]!,
      evidence,
    });
    if (pattern) counts[pattern] += 1;
  }
}

export function accumulateParticipantTaxonomy(
  counts: TaxonomyCounts<ParticipantOcrPatternV1>,
  left: string | null,
  right: string | null,
  evidence: string,
): void {
  const leftPattern = classifyParticipantOcrPattern({ truth: left, evidence });
  if (leftPattern) counts[leftPattern] += 1;
  const rightPattern = classifyParticipantOcrPattern({
    truth: right,
    evidence,
  });
  if (rightPattern) counts[rightPattern] += 1;
}
