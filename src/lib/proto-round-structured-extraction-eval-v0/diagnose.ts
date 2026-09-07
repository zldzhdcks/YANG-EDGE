import { identityKey } from "./compare";
import {
  PILOT_COUNT,
  type FailureCauseV0,
  type FirstDivergenceStageV0,
  type FrozenIdentityV0,
  type PilotMachineRecordV0,
  type PilotSelectionSourceV0,
  type PilotTruthRecordV0,
} from "./types";
import { StructuredExtractionEvalError } from "./evaluate";

export type DiagnosticRegionV0 = {
  joinedRawText: string;
  rawEvidenceTags: string[];
  normalizedLeft: number;
  normalizedRight: number;
  fragments: Array<{ rawText: string }>;
};

export type DiagnosticSemanticRowV0 = FrozenIdentityV0 & {
  regions: DiagnosticRegionV0[];
};

export type PilotFieldDiagnosisV0 = {
  sourceImageSha256: string;
  visualRowIndex: number;
  humanParticipantLeftRaw: string | null;
  machineParticipantLeftRaw: string | null;
  humanParticipantRightRaw: string | null;
  machineParticipantRightRaw: string | null;
  humanNumericCellsRaw: string[];
  machineNumericCellsRaw: string[];
  machineParticipantParsingStatus: string | null;
  machineNumericCellsParsingStatus: string | null;
  participantLeftCause: FailureCauseV0 | null;
  participantRightCause: FailureCauseV0 | null;
  numericCellsCause: FailureCauseV0 | null;
  semanticRegionJoinedRawTexts: string[];
  semanticRegionTags: string[][];
  ocrFragmentRawTexts: string[];
};

function ocrShape(text: string): string {
  return text.replace(/!/g, "").replace(/[-\s]/g, ".").replace(/\.+/g, ".").toLowerCase();
}

function digitsOnly(text: string): string {
  return text.replace(/[^0-9]/g, "");
}

function fragmentsOf(row: DiagnosticSemanticRowV0 | undefined): string[] {
  if (!row) return [];
  return row.regions.flatMap((r) => r.fragments.map((f) => f.rawText));
}

function exclusiveTextJoined(row: DiagnosticSemanticRowV0 | undefined): string[] {
  if (!row) return [];
  return row.regions
    .filter((r) => r.rawEvidenceTags.length === 1 && r.rawEvidenceTags[0] === "TEXT_BEARING_RAW")
    .map((r) => r.joinedRawText);
}

function allJoined(row: DiagnosticSemanticRowV0 | undefined): string[] {
  if (!row) return [];
  return row.regions.map((r) => r.joinedRawText);
}

function hasExact(values: string[], target: string | null): boolean {
  return target != null && target.length > 0 && values.includes(target);
}

function similarText(a: string, b: string): boolean {
  if (ocrShape(a) === ocrShape(b)) return true;
  const da = digitsOnly(a);
  if (da.length > 0 && da === digitsOnly(b)) return true;
  if (a.length >= 2 && a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diffs += 1;
    }
    return diffs <= Math.max(1, Math.floor(a.length / 3));
  }
  return false;
}

function hasShapeMatch(values: string[], target: string | null): boolean {
  if (target == null || target.length === 0) return false;
  return values.some((v) => similarText(v, target));
}

function adjacentConcatEquals(frags: string[], target: string | null): boolean {
  if (target == null || target.length === 0 || frags.length < 2) return false;
  for (let i = 0; i < frags.length; i++) {
    let acc = "";
    for (let j = i; j < frags.length; j++) {
      acc += frags[j]!;
      if (acc === target) return true;
      if (acc.length > target.length) break;
    }
  }
  return false;
}

function groupedAround(joined: string[], target: string | null): boolean {
  if (target == null || target.length === 0) return false;
  return joined.some((j) => j !== target && j.includes(target));
}

export function classifyParticipantFailure(input: {
  human: string | null;
  machine: string | null;
  otherHuman: string | null;
  semantic: DiagnosticSemanticRowV0 | undefined;
}): FailureCauseV0 {
  const human = input.human;
  const machine = input.machine;
  if (human === machine) {
    return "OTHER";
  }
  const frags = fragmentsOf(input.semantic);
  const exclusive = exclusiveTextJoined(input.semantic);
  const joined = allJoined(input.semantic);

  if (human == null || human.length === 0) return "OTHER";

  if (machine != null && machine === input.otherHuman && exclusive.includes(human)) {
    return "PARSER_ORDERING_ERROR";
  }
  if (!hasExact(frags, human) && !hasExact(joined, human) && !adjacentConcatEquals(frags, human)) {
    if (hasShapeMatch(frags, human) || hasShapeMatch(joined, human)) return "OCR_TEXT_MISMATCH";
    return "MISSING_MACHINE_EVIDENCE";
  }
  if (adjacentConcatEquals(frags, human) && !hasExact(frags, human) && !hasExact(exclusive, human)) {
    return "OCR_FRAGMENTATION";
  }
  if (groupedAround(joined, human) && !hasExact(exclusive, human)) {
    return "REGION_GROUPING_ERROR";
  }
  if (hasExact(exclusive, human) && machine !== human) {
    return "PARSER_REGION_SELECTION_ERROR";
  }
  if (hasExact(frags, human) && machine !== human) {
    return "PARSER_REGION_SELECTION_ERROR";
  }
  return "OCR_TEXT_MISMATCH";
}

export function classifyNumericFailure(input: {
  human: string[];
  machine: string[];
  semantic: DiagnosticSemanticRowV0 | undefined;
}): FailureCauseV0 {
  const human = input.human;
  const machine = input.machine;
  if (human.length === human.filter((v, i) => v === machine[i]).length && human.length === machine.length) {
    return "OTHER";
  }
  const frags = fragmentsOf(input.semantic);

  const exactCellsExist = human.length > 0 && human.every((h) => frags.includes(h));
  const sameLength = human.length === machine.length;
  const orderSwap =
    sameLength &&
    human.length > 1 &&
    [...human].sort().join("\u0000") === [...machine].sort().join("\u0000") &&
    human.some((v, i) => v !== machine[i]);
  if (orderSwap && exactCellsExist) return "PARSER_ORDERING_ERROR";
  if (exactCellsExist) return "PARSER_REGION_SELECTION_ERROR";
  if (human.length > 0 && human.every((h) => hasShapeMatch(frags, h))) {
    return "OCR_TEXT_MISMATCH";
  }
  if (human.some((h) => hasShapeMatch(frags, h))) return "OCR_TEXT_MISMATCH";
  return "MISSING_MACHINE_EVIDENCE";
}

function stageForCause(cause: FailureCauseV0 | null): FirstDivergenceStageV0 | null {
  if (cause == null) return null;
  if (cause === "OCR_TEXT_MISMATCH" || cause === "OCR_FRAGMENTATION" || cause === "MISSING_MACHINE_EVIDENCE") {
    return "RAW_OCR";
  }
  if (cause === "REGION_GROUPING_ERROR") return "SEMANTIC_REGION";
  if (cause === "PARSER_REGION_SELECTION_ERROR" || cause === "PARSER_ORDERING_ERROR") {
    return "STRUCTURED_PARSER";
  }
  return "MIXED";
}

export function earliestDivergenceStage(causes: Array<FailureCauseV0 | null>): FirstDivergenceStageV0 {
  const stages = causes.map(stageForCause).filter((s): s is FirstDivergenceStageV0 => s != null);
  if (stages.includes("RAW_OCR")) return "RAW_OCR";
  if (stages.includes("VISUAL_ROW")) return "VISUAL_ROW";
  if (stages.includes("SEMANTIC_REGION")) return "SEMANTIC_REGION";
  if (stages.includes("STRUCTURED_PARSER")) return "STRUCTURED_PARSER";
  return "MIXED";
}

export function diagnosePilot10Discovery(input: {
  selection: PilotSelectionSourceV0;
  truthRecords: PilotTruthRecordV0[];
  machineRecords: PilotMachineRecordV0[];
  semanticRows: DiagnosticSemanticRowV0[];
}): {
  rows: PilotFieldDiagnosisV0[];
  participantLeftFailuresByCause: Record<FailureCauseV0, number>;
  participantRightFailuresByCause: Record<FailureCauseV0, number>;
  numericCellsFailuresByCause: Record<FailureCauseV0, number>;
  FIRST_DIVERGENCE_STAGE: FirstDivergenceStageV0;
} {
  const emptyCounts = (): Record<FailureCauseV0, number> => ({
    OCR_TEXT_MISMATCH: 0,
    OCR_FRAGMENTATION: 0,
    REGION_GROUPING_ERROR: 0,
    PARSER_REGION_SELECTION_ERROR: 0,
    PARSER_ORDERING_ERROR: 0,
    MISSING_MACHINE_EVIDENCE: 0,
    OTHER: 0,
  });
  const leftCounts = emptyCounts();
  const rightCounts = emptyCounts();
  const numericCounts = emptyCounts();
  const allCauses: Array<FailureCauseV0 | null> = [];
  const pilotKeys = input.selection.discoveryRowKeys.slice(0, PILOT_COUNT);
  if (pilotKeys.length !== PILOT_COUNT) {
    throw new StructuredExtractionEvalError(`PILOT_KEYS_UNEXPECTED:${pilotKeys.length}`);
  }
  const truthById = new Map(
    input.truthRecords.map((r) => [identityKey(r.sourceImageSha256, r.visualRowIndex), r]),
  );
  const machineById = new Map(
    input.machineRecords.map((r) => [identityKey(r.sourceImageSha256, r.visualRowIndex), r]),
  );
  const semanticById = new Map(
    input.semanticRows.map((r) => [identityKey(r.sourceImageSha256, r.visualRowIndex), r]),
  );

  const rows: PilotFieldDiagnosisV0[] = [];
  for (const key of pilotKeys) {
    const id = identityKey(key.sourceImageSha256, key.visualRowIndex);
    const truth = truthById.get(id);
    const pred = machineById.get(id);
    if (!truth) throw new StructuredExtractionEvalError("PILOT_TRUTH_JOIN_FAILED");
    if (!pred) throw new StructuredExtractionEvalError("PILOT_EXTRACTION_JOIN_FAILED");
    const semantic = semanticById.get(id);
    const leftCause =
      truth.participantLeftRaw === pred.participantLeftCandidateRaw
        ? null
        : classifyParticipantFailure({
            human: truth.participantLeftRaw,
            machine: pred.participantLeftCandidateRaw,
            otherHuman: truth.participantRightRaw,
            semantic,
          });
    const rightCause =
      truth.participantRightRaw === pred.participantRightCandidateRaw
        ? null
        : classifyParticipantFailure({
            human: truth.participantRightRaw,
            machine: pred.participantRightCandidateRaw,
            otherHuman: truth.participantLeftRaw,
            semantic,
          });
    const numsCause =
      truth.numericCellsRaw.length === pred.numericCellsCandidateRaw.length &&
      truth.numericCellsRaw.every((v, i) => v === pred.numericCellsCandidateRaw[i])
        ? null
        : classifyNumericFailure({
            human: truth.numericCellsRaw,
            machine: pred.numericCellsCandidateRaw,
            semantic,
          });
    if (leftCause) leftCounts[leftCause] += 1;
    if (rightCause) rightCounts[rightCause] += 1;
    if (numsCause) numericCounts[numsCause] += 1;
    allCauses.push(leftCause, rightCause, numsCause);
    rows.push({
      sourceImageSha256: key.sourceImageSha256,
      visualRowIndex: key.visualRowIndex,
      humanParticipantLeftRaw: truth.participantLeftRaw,
      machineParticipantLeftRaw: pred.participantLeftCandidateRaw,
      humanParticipantRightRaw: truth.participantRightRaw,
      machineParticipantRightRaw: pred.participantRightCandidateRaw,
      humanNumericCellsRaw: truth.numericCellsRaw,
      machineNumericCellsRaw: pred.numericCellsCandidateRaw,
      machineParticipantParsingStatus: pred.participantParsingStatus ?? null,
      machineNumericCellsParsingStatus: pred.numericCellsParsingStatus ?? null,
      participantLeftCause: leftCause,
      participantRightCause: rightCause,
      numericCellsCause: numsCause,
      semanticRegionJoinedRawTexts: allJoined(semantic),
      semanticRegionTags: semantic?.regions.map((r) => r.rawEvidenceTags) ?? [],
      ocrFragmentRawTexts: fragmentsOf(semantic),
    });
  }

  return {
    rows,
    participantLeftFailuresByCause: leftCounts,
    participantRightFailuresByCause: rightCounts,
    numericCellsFailuresByCause: numericCounts,
    FIRST_DIVERGENCE_STAGE: earliestDivergenceStage(allCauses),
  };
}
