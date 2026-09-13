import type { OddsFieldV2, OcrPassEvidenceV2 } from "./types";

const EXACT_DECIMAL = /(\d{1,2}\.\d{2})/g;
const SPLIT_DECIMAL = /(?<![0-9])(\d{1,2})[ \-](\d{2})(?![0-9])/g;
const COMPACT_THREE = /(?<![0-9])(\d{3})(?![0-9])/g;

export function extractExactDecimals(text: string): string[] {
  return [...text.matchAll(new RegExp(EXACT_DECIMAL, "g"))].map((m) => m[1]!);
}

export function extractSplitForms(text: string): Array<{ raw: string; digits: string; value: number }> {
  const out: Array<{ raw: string; digits: string; value: number }> = [];
  const re = new RegExp(SPLIT_DECIMAL.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const digits = `${match[1]}${match[2]}`;
    out.push({
      raw: match[0]!,
      digits,
      value: Number(`${match[1]}.${match[2]}`),
    });
  }
  return out;
}

export function extractCompactThreeDigitTokens(text: string): string[] {
  return [...text.matchAll(new RegExp(COMPACT_THREE, "g"))].map((m) => m[1]!);
}

/**
 * "156" never becomes 1.56.
 * A single "1 56" never becomes verified 1.56.
 * Two independent passes with the same split/punctuation digit sequence may verify.
 */
export function verifyOddsFromPasses(passes: OcrPassEvidenceV2[]): OddsFieldV2 {
  const nonempty = passes.filter((p) => p.rawText.trim().length > 0);
  const rawText = nonempty.map((p) => p.rawText.trim()).join(" | ") || null;
  if (nonempty.length === 0) {
    return {
      rawText: null,
      normalizedCandidate: null,
      verificationEvidence: {
        passes,
        agreeingDigitSequence: null,
        splitDetectedInCell: false,
        punctuationEvidence: false,
        independentPassCount: 0,
      },
      verificationStatus: "ODDS_UNREADABLE",
    };
  }

  const splitByPass = nonempty.map((p) => ({
    pass: p.pass,
    splits: extractSplitForms(p.rawText),
    exact: extractExactDecimals(p.rawText),
    compact: extractCompactThreeDigitTokens(p.rawText),
  }));
  const punctuationEvidence = splitByPass.some((p) => p.exact.length > 0);
  const splitDetectedInCell = splitByPass.some((p) => p.splits.length > 0);

  const sequenceVotes = new Map<string, Set<string>>();
  for (const row of splitByPass) {
    const seqs = new Set<string>();
    for (const s of row.splits) seqs.add(s.digits);
    for (const e of row.exact) seqs.add(e.replace(".", ""));
    for (const seq of seqs) {
      const voters = sequenceVotes.get(seq) ?? new Set();
      voters.add(row.pass);
      sequenceVotes.set(seq, voters);
    }
  }

  let best: { digits: string; voters: number } | null = null;
  for (const [digits, voters] of sequenceVotes) {
    if (!best || voters.size > best.voters) best = { digits, voters: voters.size };
  }

  const agreeingDigitSequence = best && best.voters >= 2 ? best.digits : null;
  const independentPassCount = nonempty.length;

  if (
    agreeingDigitSequence &&
    independentPassCount >= 2 &&
    (splitDetectedInCell || punctuationEvidence) &&
    agreeingDigitSequence.length >= 3 &&
    agreeingDigitSequence.length <= 4
  ) {
    const intLen = agreeingDigitSequence.length - 2;
    const value = Number(
      `${agreeingDigitSequence.slice(0, intLen)}.${agreeingDigitSequence.slice(intLen)}`,
    );
    if (Number.isFinite(value) && value >= 1 && value < 100) {
      return {
        rawText,
        normalizedCandidate: value,
        verificationEvidence: {
          passes,
          agreeingDigitSequence,
          splitDetectedInCell,
          punctuationEvidence,
          independentPassCount,
        },
        verificationStatus: "ODDS_VERIFIED",
      };
    }
  }

  if (splitDetectedInCell || punctuationEvidence) {
    return {
      rawText,
      normalizedCandidate: null,
      verificationEvidence: {
        passes,
        agreeingDigitSequence: best?.digits ?? null,
        splitDetectedInCell,
        punctuationEvidence,
        independentPassCount,
      },
      verificationStatus: "ODDS_CANDIDATE_UNVERIFIED",
    };
  }

  return {
    rawText,
    normalizedCandidate: null,
    verificationEvidence: {
      passes,
      agreeingDigitSequence: best?.digits ?? null,
      splitDetectedInCell,
      punctuationEvidence,
      independentPassCount,
    },
    verificationStatus: "ODDS_UNREADABLE",
  };
}

export function verifyOddsListFromPasses(passes: OcrPassEvidenceV2[]): OddsFieldV2[] {
  const field = verifyOddsFromPasses(passes);
  if (field.verificationStatus === "ODDS_VERIFIED" && field.normalizedCandidate != null) {
    const values: number[] = [];
    for (const pass of passes) {
      const exact = extractExactDecimals(pass.rawText).map(Number);
      const splits = extractSplitForms(pass.rawText).map((s) => s.value);
      const combined = exact.length ? exact : splits;
      if (combined.length > values.length) {
        values.splice(0, values.length, ...combined);
      }
    }
    if (values.length <= 1) return [field];
    return values.map((value) => ({
      ...field,
      normalizedCandidate: value,
    }));
  }
  return [field];
}
