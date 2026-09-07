import { identityKey, marketTruthPresent, numericExact, stringsEqual } from "./compare";
import {
  HOLDOUT_VISUAL_CONTENT_READ,
  PILOT_COUNT,
  type Pilot10EvalResultV0,
  type PilotMachineRecordV0,
  type PilotSelectionSourceV0,
  type PilotTruthRecordV0,
} from "./types";

export class StructuredExtractionEvalError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "StructuredExtractionEvalError";
    this.code = code;
  }
}

export function evaluatePilot10Discovery(input: {
  selection: PilotSelectionSourceV0;
  truthRecords: PilotTruthRecordV0[];
  machineRecords: PilotMachineRecordV0[];
}): Pilot10EvalResultV0 {
  const pilotKeys = input.selection.discoveryRowKeys.slice(0, PILOT_COUNT);
  if (pilotKeys.length !== PILOT_COUNT) {
    throw new StructuredExtractionEvalError(`PILOT_KEYS_UNEXPECTED:${pilotKeys.length}`);
  }

  const machineById = new Map(
    input.machineRecords.map((r) => [identityKey(r.sourceImageSha256, r.visualRowIndex), r]),
  );
  const truthById = new Map(
    input.truthRecords.map((r) => [identityKey(r.sourceImageSha256, r.visualRowIndex), r]),
  );

  let rowIdentifierExactCount = 0;
  let participantLeftExactCount = 0;
  let participantRightExactCount = 0;
  let numericCellsExactCount = 0;
  let primaryFourExactRowCount = 0;
  let marketMarkerEvaluableCount = 0;
  let marketMarkerExactCount = 0;
  let fullStructureEvaluableCount = 0;
  let fullStructureExactCount = 0;
  const rows = [];

  for (let i = 0; i < PILOT_COUNT; i++) {
    const key = pilotKeys[i]!;
    const id = identityKey(key.sourceImageSha256, key.visualRowIndex);
    const truth = truthById.get(id);
    const pred = machineById.get(id);
    if (!truth) throw new StructuredExtractionEvalError(`PILOT_TRUTH_JOIN_FAILED:${i + 1}`);
    if (!pred) throw new StructuredExtractionEvalError(`PILOT_EXTRACTION_JOIN_FAILED:${i + 1}`);
    if (
      truth.sourceImageSha256 !== pred.sourceImageSha256 ||
      truth.visualRowIndex !== pred.visualRowIndex
    ) {
      throw new StructuredExtractionEvalError(`PILOT_IDENTITY_MISMATCH:${i + 1}`);
    }

    const idExact = stringsEqual(pred.screenRowIdentifierCandidateRaw, truth.screenRowIdentifierRaw);
    const leftExact = stringsEqual(pred.participantLeftCandidateRaw, truth.participantLeftRaw);
    const rightExact = stringsEqual(pred.participantRightCandidateRaw, truth.participantRightRaw);
    const numsExact = numericExact(pred.numericCellsCandidateRaw, truth.numericCellsRaw);
    if (idExact) rowIdentifierExactCount += 1;
    if (leftExact) participantLeftExactCount += 1;
    if (rightExact) participantRightExactCount += 1;
    if (numsExact) numericCellsExactCount += 1;
    const primaryFourExact = idExact && leftExact && rightExact && numsExact;
    if (primaryFourExact) primaryFourExactRowCount += 1;

    const marketEvaluable = marketTruthPresent(truth.marketMarkerRaw);
    let marketExact = false;
    if (marketEvaluable) {
      marketMarkerEvaluableCount += 1;
      fullStructureEvaluableCount += 1;
      marketExact = stringsEqual(pred.marketMarkerCandidateRaw, truth.marketMarkerRaw);
      if (marketExact) marketMarkerExactCount += 1;
      if (leftExact && rightExact && numsExact && marketExact) {
        fullStructureExactCount += 1;
      }
    }

    rows.push({
      pilotIndex: i + 1,
      sourceImageSha256: key.sourceImageSha256,
      visualRowIndex: key.visualRowIndex,
      annotationStatus: truth.annotationStatus ?? null,
      idExact,
      leftExact,
      rightExact,
      numsExact,
      primaryFourExact,
      marketEvaluable,
      marketExact: marketEvaluable ? marketExact : null,
    });
  }

  return {
    holdoutVisualContentRead: HOLDOUT_VISUAL_CONTENT_READ,
    pilotRows: PILOT_COUNT,
    rowIdentifierExactCount,
    participantLeftExactCount,
    participantRightExactCount,
    numericCellsExactCount,
    primaryFourExactRowCount,
    marketMarkerEvaluableCount,
    marketMarkerExactCount,
    fullStructureEvaluableCount,
    fullStructureExactCount,
    rows,
  };
}
