import {
  FRESH_ANNOTATION_SCHEMA_VERSION,
  FRESH_PROTO_ROUND_KEY,
  GROUND_TRUTH_SOURCE,
  SELECTED_ROW_COUNT,
  type FreshHumanExportDocumentV0,
  type FreshHumanRecordV0,
} from "./types";
import { FreshValidationEvalV0Error, rowIdentityKey } from "./identity";

export function asHumanRecord(raw: unknown, index: number): FreshHumanRecordV0 {
  const rec = raw as Partial<FreshHumanRecordV0>;
  if (
    typeof rec.sourceImageSha256 !== "string" ||
    rec.sourceImageSha256.length === 0 ||
    !Number.isInteger(rec.visualRowIndex)
  ) {
    throw new FreshValidationEvalV0Error(`HUMAN_IDENTITY_INVALID:${index + 1}`);
  }
  const status = rec.annotationStatus;
  if (
    status !== "UNANNOTATED" &&
    status !== "COMPLETE" &&
    status !== "UNCERTAIN" &&
    status !== "UNREADABLE"
  ) {
    throw new FreshValidationEvalV0Error(`HUMAN_STATUS_INVALID:${index + 1}`);
  }
  return {
    sourceImageSha256: rec.sourceImageSha256,
    visualRowIndex: rec.visualRowIndex,
    sourceFileName: typeof rec.sourceFileName === "string" ? rec.sourceFileName : "",
    annotationStatus: status,
    screenRowIdentifierRaw:
      typeof rec.screenRowIdentifierRaw === "string" ? rec.screenRowIdentifierRaw : null,
    participantLeftRaw:
      typeof rec.participantLeftRaw === "string" ? rec.participantLeftRaw : null,
    participantRightRaw:
      typeof rec.participantRightRaw === "string" ? rec.participantRightRaw : null,
    numericCellsRaw: Array.isArray(rec.numericCellsRaw)
      ? rec.numericCellsRaw.map((cell) => String(cell))
      : [],
    marketMarkerRaw: typeof rec.marketMarkerRaw === "string" ? rec.marketMarkerRaw : null,
  };
}

export function parseHumanExportDocument(raw: unknown): FreshHumanExportDocumentV0 {
  const doc = raw as Partial<FreshHumanExportDocumentV0>;
  if (doc.schemaVersion !== FRESH_ANNOTATION_SCHEMA_VERSION) {
    throw new FreshValidationEvalV0Error("HUMAN_SCHEMA_MISMATCH");
  }
  if (doc.protoRoundKey !== FRESH_PROTO_ROUND_KEY) {
    throw new FreshValidationEvalV0Error("HUMAN_PROTO_ROUND_KEY_MISMATCH");
  }
  if (doc.groundTruthSource !== GROUND_TRUTH_SOURCE) {
    throw new FreshValidationEvalV0Error("HUMAN_GROUND_TRUTH_SOURCE_MISMATCH");
  }
  if (!Array.isArray(doc.records) || doc.records.length !== SELECTED_ROW_COUNT) {
    throw new FreshValidationEvalV0Error("HUMAN_RECORD_COUNT_MISMATCH");
  }
  return {
    schemaVersion: FRESH_ANNOTATION_SCHEMA_VERSION,
    protoRoundKey: doc.protoRoundKey,
    groundTruthSource: GROUND_TRUTH_SOURCE,
    records: doc.records.map((rec, i) => asHumanRecord(rec, i)),
  };
}

export function countHumanStatuses(records: FreshHumanRecordV0[]): {
  completeCount: number;
  uncertainCount: number;
  unreadableCount: number;
  unannotatedCount: number;
} {
  const out = {
    completeCount: 0,
    uncertainCount: 0,
    unreadableCount: 0,
    unannotatedCount: 0,
  };
  for (const rec of records) {
    if (rec.annotationStatus === "COMPLETE") out.completeCount += 1;
    else if (rec.annotationStatus === "UNCERTAIN") out.uncertainCount += 1;
    else if (rec.annotationStatus === "UNREADABLE") out.unreadableCount += 1;
    else out.unannotatedCount += 1;
  }
  return out;
}

export function assertNoUnannotated(records: FreshHumanRecordV0[]): void {
  if (records.some((r) => r.annotationStatus === "UNANNOTATED")) {
    throw new FreshValidationEvalV0Error("UNANNOTATED_HUMAN_ROWS");
  }
}

export function assertNoDuplicateIdentities(rows: Array<{ sourceImageSha256: string; visualRowIndex: number }>): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const id = rowIdentityKey(row);
    if (seen.has(id)) {
      throw new FreshValidationEvalV0Error("DUPLICATE_IDENTITY");
    }
    seen.add(id);
  }
}
