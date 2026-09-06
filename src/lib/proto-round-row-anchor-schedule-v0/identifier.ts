export const EXACT_FOUR_DIGIT = /^[0-9]{4}$/;

export function collectExactFourDigitFragments(
  texts: string[],
): { indexes: number[]; values: string[] } {
  const indexes: number[] = [];
  const values: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]!;
    if (EXACT_FOUR_DIGIT.test(t)) {
      indexes.push(i);
      values.push(t);
    }
  }
  return { indexes, values };
}

export function parseRowIdentifierCandidate(texts: string[]): {
  status: "EXACT_ONE" | "NONE" | "MULTIPLE";
  raw: string | null;
  candidate: number | null;
  fragmentIndex: number | null;
} {
  const found = collectExactFourDigitFragments(texts);
  if (found.values.length === 0) {
    return { status: "NONE", raw: null, candidate: null, fragmentIndex: null };
  }
  if (found.values.length > 1) {
    return { status: "MULTIPLE", raw: null, candidate: null, fragmentIndex: null };
  }
  const raw = found.values[0]!;
  return {
    status: "EXACT_ONE",
    raw,
    candidate: Number(raw),
    fragmentIndex: found.indexes[0]!,
  };
}

/**
 * Identifier candidates come only from exact standalone 4-digit fragments
 * positioned BEFORE the selected date anchor. Fragments at/after the date
 * are never inspected, including compact HHMM clocks.
 */
export function parseRowIdentifierBeforeDateAnchor(
  texts: string[],
  dateAnchorStartIndex: number,
): {
  status: "EXACT_ONE" | "NONE" | "MULTIPLE";
  raw: string | null;
  candidate: number | null;
  fragmentIndex: number | null;
} {
  return parseRowIdentifierCandidate(texts.slice(0, dateAnchorStartIndex));
}
