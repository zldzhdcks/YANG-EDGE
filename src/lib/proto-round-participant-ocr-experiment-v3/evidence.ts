import type { IndependentEvidenceV3, RowEvidenceScoreV3 } from "./types";

export function joinRawEvidence(
  rawText: string | null | undefined,
  rawLines: Array<{ text: string }> | null | undefined,
): string {
  const parts: string[] = [];
  if (typeof rawText === "string" && rawText.length > 0) parts.push(rawText);
  for (const line of rawLines ?? []) {
    if (typeof line.text === "string" && line.text.length > 0) {
      parts.push(line.text);
    }
  }
  return parts.join("\n");
}

export function exactEvidencePresent(
  evidence: string,
  truth: string | null | undefined,
): boolean {
  if (typeof truth !== "string" || truth.length === 0) return false;
  return evidence.includes(truth);
}

export function exactEvidencePresentAny(
  evidenceParts: string[],
  truth: string | null | undefined,
): boolean {
  if (typeof truth !== "string" || truth.length === 0) return false;
  for (const part of evidenceParts) {
    if (exactEvidencePresent(part, truth)) return true;
  }
  return false;
}

export function unionIndependentEvidence(
  a: IndependentEvidenceV3[],
  b: IndependentEvidenceV3[],
): IndependentEvidenceV3[] {
  return [...a, ...b];
}

export function scoreRowEvidenceV3(input: {
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
  evidence: IndependentEvidenceV3[];
}): RowEvidenceScoreV3 {
  const numericCells = Array.isArray(input.numericCellsRaw)
    ? input.numericCellsRaw
    : [];
  const parts = input.evidence.map((item) => item.text);
  const left = exactEvidencePresentAny(parts, input.participantLeftRaw);
  const right = exactEvidencePresentAny(parts, input.participantRightRaw);
  let numericCellExactEvidenceCount = 0;
  for (let i = 0; i < numericCells.length; i++) {
    if (exactEvidencePresentAny(parts, numericCells[i])) {
      numericCellExactEvidenceCount += 1;
    }
  }
  return {
    leftExactEvidencePresent: left,
    rightExactEvidencePresent: right,
    participantPairExactEvidencePresent: left && right,
    participantExactSlotCount: (left ? 1 : 0) + (right ? 1 : 0),
    numericCellExactEvidenceCount,
    numericCellTotalTruthCount: numericCells.length,
    numericCellsAllExactEvidencePresent:
      numericCells.length === numericCellExactEvidenceCount,
  };
}
