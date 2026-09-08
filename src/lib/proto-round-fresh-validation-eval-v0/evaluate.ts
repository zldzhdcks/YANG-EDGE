import {
  exactMarketMatch,
  exactNumericCellCount,
  exactParticipantEvidencePresent,
  isMarketEvaluable,
  isReadableStatus,
} from "./evidence";
import { joinFrozenFreshIdentities } from "./join";
import { assertNoUnannotated, countHumanStatuses } from "./validate";
import {
  FRESH_PROTO_ROUND_KEY,
  FRESH_VALIDATION_EVAL_SCHEMA_VERSION,
  FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256,
  PROTO_SCREENSHOT_AUTOMATION_FUNCTIONAL_MILESTONE,
  type FreshEvalDocumentV0,
  type FreshEvalRowKeyV0,
  type FreshHumanRecordV0,
  type FreshMachineEvalRowV0,
  type FreshRowEvalV0,
} from "./types";

export function scoreJoinedFreshRow(input: {
  human: FreshHumanRecordV0;
  machine: FreshMachineEvalRowV0;
}): FreshRowEvalV0 {
  const readable = isReadableStatus(input.human.annotationStatus);
  const marketEvaluable = isMarketEvaluable({
    annotationStatus: input.human.annotationStatus,
    marketMarkerRaw: input.human.marketMarkerRaw,
  });
  const participantParts = input.machine.participantRawOcrEvidences ?? [];
  const left = readable
    ? exactParticipantEvidencePresent(participantParts, input.human.participantLeftRaw)
    : false;
  const right = readable
    ? exactParticipantEvidencePresent(participantParts, input.human.participantRightRaw)
    : false;
  const pair = left && right;
  const truthCells = Array.isArray(input.human.numericCellsRaw)
    ? input.human.numericCellsRaw
    : [];
  const rawNumeric = readable
    ? exactNumericCellCount({
        truthCells,
        evidenceParts: input.machine.numericRawOcrEvidences ?? [],
      })
    : { exactCount: 0, total: truthCells.length, allExact: false };
  const safeNumeric = readable
    ? exactNumericCellCount({
        truthCells,
        evidenceParts: input.machine.safeReconstructedNumericEvidences ?? [],
      })
    : { exactCount: 0, total: truthCells.length, allExact: false };
  const safeLayer = readable
    ? exactNumericCellCount({
        truthCells,
        evidenceParts: [
          ...(input.machine.numericRawOcrEvidences ?? []),
          ...(input.machine.safeReconstructedNumericEvidences ?? []),
        ],
      })
    : { exactCount: 0, total: truthCells.length, allExact: false };
  const marketExact = marketEvaluable
    ? exactMarketMatch({
        human: input.human.marketMarkerRaw,
        machine: input.machine.marketMarkerCandidateRaw,
      })
    : null;
  return {
    sourceImageSha256: input.human.sourceImageSha256,
    visualRowIndex: input.human.visualRowIndex,
    annotationStatus: input.human.annotationStatus,
    readable,
    marketEvaluable,
    participantLeftExactEvidencePresent: left,
    participantRightExactEvidencePresent: right,
    participantPairExactEvidencePresent: pair,
    numericTruthCellCount: rawNumeric.total,
    numericRawExactCellCount: rawNumeric.exactCount,
    numericRawAllExact: rawNumeric.allExact,
    safeReconstructedExactCellCount: safeNumeric.exactCount,
    safeReconstructedAllExact: safeNumeric.allExact,
    numericSafeLayerAllExact: safeLayer.allExact,
    marketMarkerExact: marketExact,
    participantPairAndNumericRawExact: pair && rawNumeric.allExact,
    participantPairAndNumericSafeExact: pair && safeLayer.allExact,
    participantPairNumericSafeMarketExact:
      marketExact == null ? null : pair && safeLayer.allExact && marketExact,
  };
}

export function evaluateFreshValidationV0(input: {
  selectionKeys: FreshEvalRowKeyV0[];
  humanRecords: FreshHumanRecordV0[];
  machineRows: FreshMachineEvalRowV0[];
  machineSha256: string;
  selectionSha256: string;
  humanTruthSha256: string;
}): FreshEvalDocumentV0 {
  assertNoUnannotated(input.humanRecords);
  const joined = joinFrozenFreshIdentities({
    selectionKeys: input.selectionKeys,
    humanRecords: input.humanRecords,
    machineRows: input.machineRows,
  });
  const rows = joined.map((item) =>
    scoreJoinedFreshRow({ human: item.human, machine: item.machine }),
  );
  const statuses = countHumanStatuses(input.humanRecords);
  const readable = rows.filter((r) => r.readable);
  const totals = {
    records: rows.length,
    completeCount: statuses.completeCount,
    uncertainCount: statuses.uncertainCount,
    unreadableCount: statuses.unreadableCount,
    unannotatedCount: statuses.unannotatedCount,
    participantRowsEvaluable: readable.length,
    participantLeftExactEvidencePresent: readable.filter(
      (r) => r.participantLeftExactEvidencePresent,
    ).length,
    participantRightExactEvidencePresent: readable.filter(
      (r) => r.participantRightExactEvidencePresent,
    ).length,
    participantPairExactEvidencePresent: readable.filter(
      (r) => r.participantPairExactEvidencePresent,
    ).length,
    participantExactSlotCount: readable.reduce(
      (sum, r) =>
        sum +
        (r.participantLeftExactEvidencePresent ? 1 : 0) +
        (r.participantRightExactEvidencePresent ? 1 : 0),
      0,
    ),
    participantEvaluableSlotCount: readable.length * 2,
    numericRowsEvaluable: readable.length,
    numericRawExactCellCount: readable.reduce((s, r) => s + r.numericRawExactCellCount, 0),
    numericTruthCellCount: readable.reduce((s, r) => s + r.numericTruthCellCount, 0),
    numericRawAllExactRowCount: readable.filter((r) => r.numericRawAllExact).length,
    safeReconstructedExactCellCount: readable.reduce(
      (s, r) => s + r.safeReconstructedExactCellCount,
      0,
    ),
    safeReconstructedAllExactRowCount: readable.filter((r) => r.safeReconstructedAllExact)
      .length,
    marketMarkerEvaluableCount: rows.filter((r) => r.marketEvaluable).length,
    marketMarkerExactCount: rows.filter((r) => r.marketMarkerExact === true).length,
    participantPairAndNumericRawExactRowCount: readable.filter(
      (r) => r.participantPairAndNumericRawExact,
    ).length,
    participantPairAndNumericSafeExactRowCount: readable.filter(
      (r) => r.participantPairAndNumericSafeExact,
    ).length,
    participantPairNumericSafeMarketExactEvaluableCount: rows.filter(
      (r) => r.marketEvaluable,
    ).length,
    participantPairNumericSafeMarketExactCount: rows.filter(
      (r) => r.participantPairNumericSafeMarketExact === true,
    ).length,
  };
  return {
    schemaVersion: FRESH_VALIDATION_EVAL_SCHEMA_VERSION,
    protoRoundKey: FRESH_PROTO_ROUND_KEY,
    parserUsed: false,
    holdoutRead: false,
    networkUsed: false,
    machineOutputChangedAfterHumanTruth: false,
    FRESH_MACHINE_OUTPUT_SHA256: input.machineSha256,
    FRESH_SELECTION_SHA256: input.selectionSha256,
    FRESH_HUMAN_TRUTH_SHA256: input.humanTruthSha256,
    PARTICIPANT_OCR_V3_RESULT_SHA256: FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256,
    totals,
    FRESH_PARTICIPANT_GENERALIZATION:
      totals.participantPairExactEvidencePresent >= 1 ? "YES" : "NO",
    FRESH_NUMERIC_RAW_GENERALIZATION:
      totals.numericRawAllExactRowCount >= 1 ? "YES" : "NO",
    FRESH_NUMERIC_SAFE_GENERALIZATION:
      totals.safeReconstructedAllExactRowCount >= 1 ? "YES" : "NO",
    PROTO_SCREENSHOT_AUTOMATION_FUNCTIONAL_MILESTONE,
    rows,
  };
}
