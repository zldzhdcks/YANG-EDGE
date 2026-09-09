import type {
  NumericFailureFamilyV0,
  ParticipantFailureFamilyV0,
} from "./types";

const HANGUL = /[\uAC00-\uD7A3]/;
const LATIN = /[A-Za-z]/;
const TRAILING_PUNCT = /[!?.,;:]+$/;

export function evidenceTokens(evidence: string): string[] {
  return evidence.split(/\s+/u).filter((t) => t.length > 0);
}

function joinedEvidence(parts: string[]): string {
  return parts.join("\n");
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
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

function hasHangulLatinScriptSwap(truth: string, token: string): boolean {
  const truthHangul = HANGUL.test(truth);
  const truthLatin = LATIN.test(truth);
  const tokenHangul = HANGUL.test(token);
  const tokenLatin = LATIN.test(token);
  return (
    (truthHangul && tokenLatin && !tokenHangul) ||
    (truthLatin && tokenHangul && !tokenLatin)
  );
}

/**
 * Earliest observable participant failure. Exact evidence is not a failure.
 */
export function classifyParticipantFailure(input: {
  truth: string | null;
  evidenceParts: string[];
  otherSlotTruth: string | null;
}): ParticipantFailureFamilyV0 | null {
  if (typeof input.truth !== "string" || input.truth.length === 0) return null;
  const evidence = joinedEvidence(input.evidenceParts);
  if (evidence.includes(input.truth)) return null;
  const tokens = evidenceTokens(evidence);
  if (tokens.length === 0 && evidence.trim() === "") return "NO_TEXT_DETECTED";
  if (adjacentConcatEquals(tokens, input.truth)) return "FRAGMENTED_TEXT";
  const nospaceTruth = input.truth.replace(/\s+/g, "");
  if (
    nospaceTruth !== input.truth &&
    (tokens.includes(nospaceTruth) || evidence.includes(nospaceTruth))
  ) {
    return "SPACING_ERROR";
  }
  if (tokens.some((t) => t.replace(/\s+/g, "") === input.truth)) {
    return "SPACING_ERROR";
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
    if (hasHangulLatinScriptSwap(input.truth, sameLen)) return "LATIN_KOREAN_CONFUSION";
    if (diffs === 1) return "WRONG_CHARACTER_SUBSTITUTION";
    if (diffs > 1) return "MULTI_CHARACTER_CORRUPTION";
  }
  if (tokens.some((t) => hasHangulLatinScriptSwap(input.truth!, t))) {
    return "LATIN_KOREAN_CONFUSION";
  }
  const other =
    typeof input.otherSlotTruth === "string" && input.otherSlotTruth.length > 0
      ? input.otherSlotTruth
      : null;
  if (other && evidence.includes(other) && !evidence.includes(input.truth)) {
    return "ROW_CONTEXT_INTERFERENCE";
  }
  if (tokens.length > 0) return "REGION_MISLOCALIZATION";
  return "OTHER";
}

export function classifyNumericFailure(input: {
  truth: string;
  evidenceParts: string[];
}): NumericFailureFamilyV0 | null {
  if (typeof input.truth !== "string" || input.truth.length === 0) return null;
  const evidence = joinedEvidence(input.evidenceParts);
  if (evidence.includes(input.truth)) return null;
  const spaced = input.truth.replace(".", " ");
  const hyphen = input.truth.replace(".", "-");
  const compact = input.truth.replace(".", "");
  const tokens = evidenceTokens(evidence);
  const isDecimal = /^[0-9]+\.[0-9]+$/.test(input.truth);

  if (isDecimal && (evidence.includes(spaced) || tokens.includes(spaced))) {
    if (
      evidence.includes(`${spaced}!`) ||
      tokens.some((t) => t.startsWith(spaced) && TRAILING_PUNCT.test(t))
    ) {
      return "TRAILING_PUNCTUATION";
    }
    return "DECIMAL_TO_SPACE";
  }
  if (isDecimal && (evidence.includes(hyphen) || tokens.includes(hyphen))) {
    return "DECIMAL_TO_HYPHEN";
  }
  if (
    isDecimal &&
    compact !== input.truth &&
    (tokens.includes(compact) || evidence.includes(compact))
  ) {
    return "DECIMAL_DROPPED";
  }
  if (tokens.some((t) => TRAILING_PUNCT.test(t) && t.replace(TRAILING_PUNCT, "") === input.truth)) {
    return "TRAILING_PUNCTUATION";
  }
  const truthDigits = digitsOnly(input.truth);
  if (truthDigits.length > 0) {
    if (
      tokens.some((t) => {
        const d = digitsOnly(t);
        return d.includes(truthDigits) && d.length > truthDigits.length;
      })
    ) {
      return "MERGED_DIGITS";
    }
    if (adjacentConcatEquals(tokens, compact) || adjacentConcatEquals(tokens, input.truth)) {
      return "FRAGMENTED_DIGITS";
    }
    const sameLen = bestSameLengthToken(
      tokens.map((t) => digitsOnly(t)).filter((t) => t.length === truthDigits.length),
      truthDigits,
    );
    if (sameLen && sameLen !== truthDigits) return "DIGIT_SUBSTITUTION";
  }
  if (tokens.some((t) => /[0-9]/.test(t))) return "EXTRA_NUMERIC_NOISE";
  if (tokens.length > 0) return "REGION_MISLOCALIZATION";
  return "OTHER";
}

export function emptyParticipantFamilyCounts(): Record<ParticipantFailureFamilyV0, number> {
  return {
    NO_TEXT_DETECTED: 0,
    WRONG_CHARACTER_SUBSTITUTION: 0,
    MULTI_CHARACTER_CORRUPTION: 0,
    LATIN_KOREAN_CONFUSION: 0,
    PREFIX_LOSS: 0,
    SUFFIX_LOSS: 0,
    SPACING_ERROR: 0,
    FRAGMENTED_TEXT: 0,
    REGION_MISLOCALIZATION: 0,
    ROW_CONTEXT_INTERFERENCE: 0,
    OTHER: 0,
  };
}

export function emptyNumericFamilyCounts(): Record<NumericFailureFamilyV0, number> {
  return {
    DECIMAL_TO_SPACE: 0,
    DECIMAL_TO_HYPHEN: 0,
    DECIMAL_DROPPED: 0,
    DIGIT_SUBSTITUTION: 0,
    TRAILING_PUNCTUATION: 0,
    MERGED_DIGITS: 0,
    FRAGMENTED_DIGITS: 0,
    REGION_MISLOCALIZATION: 0,
    EXTRA_NUMERIC_NOISE: 0,
    OTHER: 0,
  };
}

export function familiesPresent<K extends string>(
  counts: Record<K, number>,
): K[] {
  return (Object.keys(counts) as K[]).filter((k) => counts[k] > 0).sort();
}

export function recurringFamilies<K extends string>(
  a: Record<K, number>,
  b: Record<K, number>,
): K[] {
  return (Object.keys(a) as K[]).filter((k) => a[k] > 0 && b[k] > 0).sort();
}

export function onlyInFirst<K extends string>(
  a: Record<K, number>,
  b: Record<K, number>,
): K[] {
  return (Object.keys(a) as K[]).filter((k) => a[k] > 0 && b[k] === 0).sort();
}
