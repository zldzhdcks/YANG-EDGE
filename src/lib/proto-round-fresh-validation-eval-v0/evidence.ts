import { exactEvidencePresentAny } from "../proto-round-participant-ocr-experiment-v3/evidence";

export function exactParticipantEvidencePresent(
  evidences: Array<{ text: string }>,
  truth: string | null | undefined,
): boolean {
  return exactEvidencePresentAny(
    evidences.map((item) => item.text),
    truth,
  );
}

export function exactNumericCellCount(input: {
  truthCells: string[];
  evidenceParts: string[];
}): { exactCount: number; total: number; allExact: boolean } {
  const truthCells = Array.isArray(input.truthCells) ? input.truthCells : [];
  let exactCount = 0;
  for (let i = 0; i < truthCells.length; i++) {
    if (exactEvidencePresentAny(input.evidenceParts, truthCells[i])) {
      exactCount += 1;
    }
  }
  return {
    exactCount,
    total: truthCells.length,
    allExact: truthCells.length === exactCount,
  };
}

export function isReadableStatus(status: string): boolean {
  return status === "COMPLETE";
}

export function isMarketEvaluable(input: {
  annotationStatus: string;
  marketMarkerRaw: string | null;
}): boolean {
  return (
    input.annotationStatus === "COMPLETE" &&
    typeof input.marketMarkerRaw === "string" &&
    input.marketMarkerRaw.length > 0
  );
}

export function exactMarketMatch(input: {
  human: string | null;
  machine: string | null;
}): boolean {
  if (typeof input.human !== "string" || input.human.length === 0) return false;
  return input.machine === input.human;
}
