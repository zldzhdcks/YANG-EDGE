import type { IndependentEvidenceV2, RowEvidenceScoreV2 } from "./types";
import { collectSafeReconstructedNumerics } from "./reconstruct";

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

export function rawEvidenceParts(
  items: IndependentEvidenceV2[],
): string[] {
  return items.map((item) => item.text);
}

export function reconstructedEvidenceParts(
  items: IndependentEvidenceV2[],
): string[] {
  return items.map((item) => {
    const extras = collectSafeReconstructedNumerics(item.text);
    if (extras.length === 0) return item.text;
    return [item.text, ...extras].join("\n");
  });
}

export function scoreRowEvidenceV2(input: {
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
  evidence: IndependentEvidenceV2[];
}): RowEvidenceScoreV2 {
  const numericCells = Array.isArray(input.numericCellsRaw)
    ? input.numericCellsRaw
    : [];
  const rawParts = rawEvidenceParts(input.evidence);
  const reconstructedParts = reconstructedEvidenceParts(input.evidence);

  let numericCellExactEvidenceCount = 0;
  let numericReconstructedExactCellCount = 0;
  for (let i = 0; i < numericCells.length; i++) {
    const cell = numericCells[i];
    if (exactEvidencePresentAny(rawParts, cell)) {
      numericCellExactEvidenceCount += 1;
    }
    if (exactEvidencePresentAny(reconstructedParts, cell)) {
      numericReconstructedExactCellCount += 1;
    }
  }
  const left = exactEvidencePresentAny(rawParts, input.participantLeftRaw);
  const right = exactEvidencePresentAny(rawParts, input.participantRightRaw);
  const numericAll = numericCells.length === numericCellExactEvidenceCount;
  const numericAllReconstructed =
    numericCells.length === numericReconstructedExactCellCount;
  return {
    participantLeftExactEvidencePresent: left,
    participantRightExactEvidencePresent: right,
    numericCellExactEvidenceCount,
    numericCellTotalTruthCount: numericCells.length,
    numericCellsAllExactEvidencePresent: numericAll,
    participantPairExactEvidencePresent: left && right,
    allPrimaryEvidencePresent: left && right && numericAll,
    numericReconstructedExactCellCount,
    numericCellsAllExactAfterSafeReconstruction: numericAllReconstructed,
  };
}
