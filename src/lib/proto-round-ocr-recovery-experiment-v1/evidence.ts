import type { RowEvidenceScoreV1 } from "./types";

export function joinRawEvidence(
  rawText: string | null | undefined,
  rawLines: Array<{ text: string }> | null | undefined,
): string {
  const parts: string[] = [];
  if (typeof rawText === "string" && rawText.length > 0) {
    parts.push(rawText);
  }
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

export function scoreRowEvidence(input: {
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
  evidence: string;
}): RowEvidenceScoreV1 {
  const numericCells = Array.isArray(input.numericCellsRaw)
    ? input.numericCellsRaw
    : [];
  let numericCellExactEvidenceCount = 0;
  for (let i = 0; i < numericCells.length; i++) {
    if (exactEvidencePresent(input.evidence, numericCells[i])) {
      numericCellExactEvidenceCount += 1;
    }
  }
  const left = exactEvidencePresent(input.evidence, input.participantLeftRaw);
  const right = exactEvidencePresent(input.evidence, input.participantRightRaw);
  const numericAll =
    numericCells.length === numericCellExactEvidenceCount;
  return {
    participantLeftExactEvidencePresent: left,
    participantRightExactEvidencePresent: right,
    numericCellExactEvidenceCount,
    numericCellTotalTruthCount: numericCells.length,
    numericCellsAllExactEvidencePresent: numericAll,
    participantPairExactEvidencePresent: left && right,
    allPrimaryEvidencePresent: left && right && numericAll,
  };
}
