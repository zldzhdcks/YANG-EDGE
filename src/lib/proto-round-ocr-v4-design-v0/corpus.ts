import { OcrV4DesignV0Error } from "./error";
import { hashRowIdentity, identityKey } from "./hash";
import {
  DATASET_ROLE,
  DEVELOPMENT_CORPUS_COUNT,
  DISCOVERY2_COUNT,
  OCR_V4_DESIGN_SCHEMA_VERSION,
  OCR_V4_PROTO_ROUND_KEY,
  PILOT10_COUNT,
  type DevelopmentCorpusDocumentV0,
  type OcrV4RowKeyV0,
} from "./types";

function copyKey(row: OcrV4RowKeyV0): OcrV4RowKeyV0 {
  return {
    sourceImageSha256: row.sourceImageSha256,
    visualRowIndex: row.visualRowIndex,
  };
}

function duplicateCount(rows: OcrV4RowKeyV0[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const id = identityKey(row);
    if (seen.has(id)) duplicates += 1;
    else seen.add(id);
  }
  return duplicates;
}

export function buildDevelopmentCorpusV0(input: {
  pilot10: OcrV4RowKeyV0[];
  discovery2: OcrV4RowKeyV0[];
  validation2RowKeyHashes: string[];
  holdoutRowKeyHashes: string[];
}): DevelopmentCorpusDocumentV0 {
  if (input.pilot10.length !== PILOT10_COUNT) {
    throw new OcrV4DesignV0Error("PILOT10_COUNT_UNEXPECTED");
  }
  if (input.discovery2.length !== DISCOVERY2_COUNT) {
    throw new OcrV4DesignV0Error("DISCOVERY2_COUNT_UNEXPECTED");
  }
  const combined = [...input.pilot10, ...input.discovery2].map(copyKey);
  if (combined.length !== DEVELOPMENT_CORPUS_COUNT) {
    throw new OcrV4DesignV0Error("DEVELOPMENT_CORPUS_COUNT_UNEXPECTED");
  }
  const duplicates = duplicateCount(combined);
  if (duplicates !== 0) {
    throw new OcrV4DesignV0Error("DEVELOPMENT_CORPUS_DUPLICATE");
  }
  const validation = new Set(input.validation2RowKeyHashes);
  const holdout = new Set(input.holdoutRowKeyHashes);
  let overlapValidation2 = 0;
  let overlapFormalHoldout = 0;
  for (const row of combined) {
    const hashed = hashRowIdentity(row);
    if (validation.has(hashed)) overlapValidation2 += 1;
    if (holdout.has(hashed)) overlapFormalHoldout += 1;
  }
  if (overlapValidation2 !== 0) {
    throw new OcrV4DesignV0Error("VALIDATION2_OVERLAP");
  }
  if (overlapFormalHoldout !== 0) {
    throw new OcrV4DesignV0Error("HOLDOUT_OVERLAP");
  }
  return {
    schemaVersion: OCR_V4_DESIGN_SCHEMA_VERSION,
    protoRoundKey: OCR_V4_PROTO_ROUND_KEY,
    roles: DATASET_ROLE,
    FRESH_VALIDATION_NOT_FOR_V4_RULE_DESIGN: true,
    ROUND_106_USED_FOR_V4_DESIGN: false,
    VALIDATION_2_READ: false,
    FORMAL_HOLDOUT_READ: false,
    pilot10Count: PILOT10_COUNT,
    discovery2Count: DISCOVERY2_COUNT,
    total: DEVELOPMENT_CORPUS_COUNT,
    duplicates: 0,
    missing: 0,
    overlapValidation2: 0,
    overlapFormalHoldout: 0,
    LEFT_RIGHT_HALF_ROW_SPLIT_DETERMINISTIC: true,
    pilot10: input.pilot10.map(copyKey),
    discovery2: input.discovery2.map(copyKey),
  };
}
