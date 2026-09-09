import { OcrResearchExpansionV1Error } from "./error";
import {
  DISCOVERY2_ANNOTATION_SCHEMA_VERSION,
  DISCOVERY2_COUNT,
  DISCOVERY2_HUMAN_TRUTH_SCHEMA_VERSION,
  DISCOVERY2_PROTO_ROUND_KEY,
  GROUND_TRUTH_SOURCE,
  type Discovery2HumanExportDocumentV1,
  type Discovery2HumanRecordV1,
  type Discovery2HumanStatusCountsV1,
  type Discovery2HumanTruthDocumentV1,
  type Discovery2IdentityJoinV1,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asNullableString(value: unknown, code: string): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw new OcrResearchExpansionV1Error(code);
}

function asStringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new OcrResearchExpansionV1Error(code);
  }
  return value.map((item) => item as string);
}

export function parseDiscovery2HumanRecord(
  raw: unknown,
  index: number,
): Discovery2HumanRecordV1 {
  if (!isRecord(raw)) {
    throw new OcrResearchExpansionV1Error(`HUMAN_RECORD_INVALID:${index + 1}`);
  }
  if (
    typeof raw.sourceImageSha256 !== "string" ||
    raw.sourceImageSha256.length === 0 ||
    !Number.isInteger(raw.visualRowIndex)
  ) {
    throw new OcrResearchExpansionV1Error(`HUMAN_IDENTITY_INVALID:${index + 1}`);
  }
  const status = raw.annotationStatus;
  if (
    status !== "UNANNOTATED" &&
    status !== "COMPLETE" &&
    status !== "UNCERTAIN" &&
    status !== "UNREADABLE"
  ) {
    throw new OcrResearchExpansionV1Error(`HUMAN_STATUS_INVALID:${index + 1}`);
  }
  if (typeof raw.sourceFileName !== "string") {
    throw new OcrResearchExpansionV1Error(`HUMAN_RECORD_INVALID:${index + 1}`);
  }
  return {
    sourceImageSha256: raw.sourceImageSha256,
    visualRowIndex: raw.visualRowIndex,
    sourceFileName: raw.sourceFileName,
    annotationStatus: status,
    screenRowIdentifierRaw: asNullableString(
      raw.screenRowIdentifierRaw,
      `HUMAN_RECORD_INVALID:${index + 1}`,
    ),
    participantLeftRaw: asNullableString(
      raw.participantLeftRaw,
      `HUMAN_RECORD_INVALID:${index + 1}`,
    ),
    participantRightRaw: asNullableString(
      raw.participantRightRaw,
      `HUMAN_RECORD_INVALID:${index + 1}`,
    ),
    numericCellsRaw: asStringArray(
      raw.numericCellsRaw,
      `HUMAN_RECORD_INVALID:${index + 1}`,
    ),
    marketMarkerRaw: asNullableString(
      raw.marketMarkerRaw,
      `HUMAN_RECORD_INVALID:${index + 1}`,
    ),
  };
}

export function parseDiscovery2HumanExportDocument(
  raw: unknown,
): Discovery2HumanExportDocumentV1 {
  if (!isRecord(raw)) {
    throw new OcrResearchExpansionV1Error("HUMAN_EXPORT_INVALID");
  }
  if (raw.schemaVersion !== DISCOVERY2_ANNOTATION_SCHEMA_VERSION) {
    throw new OcrResearchExpansionV1Error("HUMAN_SCHEMA_MISMATCH");
  }
  if (raw.protoRoundKey !== DISCOVERY2_PROTO_ROUND_KEY) {
    throw new OcrResearchExpansionV1Error("HUMAN_PROTO_ROUND_KEY_MISMATCH");
  }
  if (raw.groundTruthSource !== GROUND_TRUTH_SOURCE) {
    throw new OcrResearchExpansionV1Error("HUMAN_GROUND_TRUTH_SOURCE_MISMATCH");
  }
  if (!Array.isArray(raw.records) || raw.records.length !== DISCOVERY2_COUNT) {
    throw new OcrResearchExpansionV1Error("HUMAN_RECORD_COUNT_MISMATCH");
  }
  return {
    schemaVersion: DISCOVERY2_ANNOTATION_SCHEMA_VERSION,
    protoRoundKey: raw.protoRoundKey,
    groundTruthSource: GROUND_TRUTH_SOURCE,
    records: raw.records.map((rec, i) => parseDiscovery2HumanRecord(rec, i)),
  };
}

export function countDiscovery2HumanStatuses(
  records: Discovery2HumanRecordV1[],
): Discovery2HumanStatusCountsV1 {
  const out: Discovery2HumanStatusCountsV1 = {
    records: records.length,
    COMPLETE: 0,
    UNCERTAIN: 0,
    UNREADABLE: 0,
    UNANNOTATED: 0,
  };
  for (const rec of records) {
    if (rec.annotationStatus === "COMPLETE") out.COMPLETE += 1;
    else if (rec.annotationStatus === "UNCERTAIN") out.UNCERTAIN += 1;
    else if (rec.annotationStatus === "UNREADABLE") out.UNREADABLE += 1;
    else out.UNANNOTATED += 1;
  }
  return out;
}

export function assertNoUnannotatedDiscovery2(
  records: Discovery2HumanRecordV1[],
): void {
  if (records.some((r) => r.annotationStatus === "UNANNOTATED")) {
    throw new OcrResearchExpansionV1Error("UNANNOTATED_HUMAN_ROWS");
  }
}

export function copyDiscovery2HumanRecord(
  rec: Discovery2HumanRecordV1,
): Discovery2HumanRecordV1 {
  return {
    sourceImageSha256: rec.sourceImageSha256,
    visualRowIndex: rec.visualRowIndex,
    sourceFileName: rec.sourceFileName,
    annotationStatus: rec.annotationStatus,
    screenRowIdentifierRaw: rec.screenRowIdentifierRaw,
    participantLeftRaw: rec.participantLeftRaw,
    participantRightRaw: rec.participantRightRaw,
    numericCellsRaw: rec.numericCellsRaw.map((cell) => cell),
    marketMarkerRaw: rec.marketMarkerRaw,
  };
}

export function buildDiscovery2HumanTruthDocument(input: {
  sourceExportPath: string;
  exportDoc: Discovery2HumanExportDocumentV1;
  orderedRecords: Discovery2HumanRecordV1[];
  identityJoin: Discovery2IdentityJoinV1;
}): Discovery2HumanTruthDocumentV1 {
  return {
    schemaVersion: DISCOVERY2_HUMAN_TRUTH_SCHEMA_VERSION,
    protoRoundKey: input.exportDoc.protoRoundKey,
    groundTruthSource: GROUND_TRUTH_SOURCE,
    sourceExportPath: input.sourceExportPath,
    identityJoin: input.identityJoin,
    VALIDATION_2_RENDERED: false,
    VALIDATION_2_ANNOTATED: false,
    VALIDATION_2_HUMAN_TRUTH_EXISTS: false,
    VALIDATION_2_USED_FOR_RULE_DESIGN: false,
    PILOT10_MUTATED: false,
    USED_FOR_OCR_RULE_DESIGN: false,
    records: input.orderedRecords.map(copyDiscovery2HumanRecord),
  };
}
