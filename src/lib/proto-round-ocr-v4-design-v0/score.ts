import { collectSafeReconstructedNumerics } from "../proto-round-ocr-recovery-experiment-v2/reconstruct";
import {
  exactEvidencePresentAny,
  scoreRowEvidenceV3,
  type IndependentEvidenceV3,
} from "../proto-round-participant-ocr-experiment-v3";
import type { DevelopmentSubsetMetricsV0 } from "./types";

export type DevelopmentTruthRowV0 = {
  sourceImageSha256: string;
  visualRowIndex: number;
  annotationStatus: string;
  participantLeftRaw: string | null;
  participantRightRaw: string | null;
  numericCellsRaw: string[];
};

export type DevelopmentRowScoreV0 = {
  sourceImageSha256: string;
  visualRowIndex: number;
  leftExact: boolean;
  rightExact: boolean;
  pairExact: boolean;
  slotExactCount: number;
  numericRawExactCells: number;
  numericRawTruthCells: number;
  numericRawAllExact: boolean;
  numericSafeExactCells: number;
  numericSafeAllExact: boolean;
  evidenceParts: string[];
};

export function safeNumericEvidenceParts(evidenceParts: string[]): string[] {
  const out = [...evidenceParts];
  for (const part of evidenceParts) {
    out.push(...collectSafeReconstructedNumerics(part));
  }
  return out;
}

export function scoreDevelopmentRowV0(input: {
  truth: DevelopmentTruthRowV0;
  evidence: IndependentEvidenceV3[];
}): DevelopmentRowScoreV0 {
  const raw = scoreRowEvidenceV3({
    participantLeftRaw: input.truth.participantLeftRaw,
    participantRightRaw: input.truth.participantRightRaw,
    numericCellsRaw: input.truth.numericCellsRaw,
    evidence: input.evidence,
  });
  const parts = input.evidence.map((item) => item.text);
  const safeParts = safeNumericEvidenceParts(parts);
  const truthCells = Array.isArray(input.truth.numericCellsRaw)
    ? input.truth.numericCellsRaw
    : [];
  let numericSafeExactCells = 0;
  for (const cell of truthCells) {
    if (exactEvidencePresentAny(safeParts, cell)) numericSafeExactCells += 1;
  }
  return {
    sourceImageSha256: input.truth.sourceImageSha256,
    visualRowIndex: input.truth.visualRowIndex,
    leftExact: raw.leftExactEvidencePresent,
    rightExact: raw.rightExactEvidencePresent,
    pairExact: raw.participantPairExactEvidencePresent,
    slotExactCount: raw.participantExactSlotCount,
    numericRawExactCells: raw.numericCellExactEvidenceCount,
    numericRawTruthCells: raw.numericCellTotalTruthCount,
    numericRawAllExact: raw.numericCellsAllExactEvidencePresent,
    numericSafeExactCells,
    numericSafeAllExact: truthCells.length === numericSafeExactCells,
    evidenceParts: parts,
  };
}

export function emptySubsetMetrics(rows: number): DevelopmentSubsetMetricsV0 {
  return {
    rows,
    participantLeftExact: 0,
    participantRightExact: 0,
    participantPairExact: 0,
    participantSlotsExact: 0,
    participantSlotTotal: rows * 2,
    numericRawExactCells: 0,
    numericRawTruthCells: 0,
    numericRawAllExactRows: 0,
    numericSafeExactCells: 0,
    numericSafeAllExactRows: 0,
  };
}

export function accumulateSubsetMetrics(
  metrics: DevelopmentSubsetMetricsV0,
  row: DevelopmentRowScoreV0,
): void {
  if (row.leftExact) metrics.participantLeftExact += 1;
  if (row.rightExact) metrics.participantRightExact += 1;
  if (row.pairExact) metrics.participantPairExact += 1;
  metrics.participantSlotsExact += row.slotExactCount;
  metrics.numericRawExactCells += row.numericRawExactCells;
  metrics.numericRawTruthCells += row.numericRawTruthCells;
  if (row.numericRawAllExact) metrics.numericRawAllExactRows += 1;
  metrics.numericSafeExactCells += row.numericSafeExactCells;
  if (row.numericSafeAllExact) metrics.numericSafeAllExactRows += 1;
}

export function combineSubsetMetrics(
  a: DevelopmentSubsetMetricsV0,
  b: DevelopmentSubsetMetricsV0,
): DevelopmentSubsetMetricsV0 {
  return {
    rows: a.rows + b.rows,
    participantLeftExact: a.participantLeftExact + b.participantLeftExact,
    participantRightExact: a.participantRightExact + b.participantRightExact,
    participantPairExact: a.participantPairExact + b.participantPairExact,
    participantSlotsExact: a.participantSlotsExact + b.participantSlotsExact,
    participantSlotTotal: a.participantSlotTotal + b.participantSlotTotal,
    numericRawExactCells: a.numericRawExactCells + b.numericRawExactCells,
    numericRawTruthCells: a.numericRawTruthCells + b.numericRawTruthCells,
    numericRawAllExactRows: a.numericRawAllExactRows + b.numericRawAllExactRows,
    numericSafeExactCells: a.numericSafeExactCells + b.numericSafeExactCells,
    numericSafeAllExactRows: a.numericSafeAllExactRows + b.numericSafeAllExactRows,
  };
}
