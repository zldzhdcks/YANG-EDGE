import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { OcrResearchExpansionV1Error } from "./error";
import {
  DISCOVERY2_ANNOTATION_HTML_FILE_NAME,
  DISCOVERY2_HUMAN_TRUTH_FILE_NAME,
  DISCOVERY2_PROTO_ROUND_KEY,
  FROZEN_OCR_RESEARCH_EXPANSION_SPLIT_SHA256,
  FROZEN_PILOT10_DISCOVERY_ANNOTATION_SHA256,
  SPLIT_SEAL_FILE_NAME,
  type ExpansionSplitSealV1,
} from "./types";

const ALLOWED_EXPANSION_LOCAL_FILES = new Set([
  SPLIT_SEAL_FILE_NAME,
  DISCOVERY2_ANNOTATION_HTML_FILE_NAME,
  DISCOVERY2_HUMAN_TRUTH_FILE_NAME,
]);

export function assertFrozenSplitSealHash(actualSha256: string): void {
  if (actualSha256 !== FROZEN_OCR_RESEARCH_EXPANSION_SPLIT_SHA256) {
    throw new OcrResearchExpansionV1Error("OCR_RESEARCH_EXPANSION_SPLIT_MUTATED");
  }
}

export function assertPilot10Unchanged(actualSha256: string): void {
  if (actualSha256 !== FROZEN_PILOT10_DISCOVERY_ANNOTATION_SHA256) {
    throw new OcrResearchExpansionV1Error("PILOT10_MUTATED");
  }
}

export function assertSplitSealProtection(seal: ExpansionSplitSealV1): void {
  if (seal.protoRoundKey !== DISCOVERY2_PROTO_ROUND_KEY) {
    throw new OcrResearchExpansionV1Error("SPLIT_SEAL_PROTO_ROUND_KEY_MISMATCH");
  }
  if (seal.SPLIT_MUTABLE !== false) {
    throw new OcrResearchExpansionV1Error("SPLIT_MUTABLE");
  }
  if (seal.VALIDATION_2_VISUAL_RENDERED !== false) {
    throw new OcrResearchExpansionV1Error("VALIDATION_2_RENDERED");
  }
  if (seal.VALIDATION_2_HUMAN_ANNOTATED !== false) {
    throw new OcrResearchExpansionV1Error("VALIDATION_2_ANNOTATED");
  }
  if (seal.VALIDATION_2_USED_FOR_RULE_DESIGN !== false) {
    throw new OcrResearchExpansionV1Error("VALIDATION_2_USED_FOR_RULE_DESIGN");
  }
  if (seal.PILOT10_MUTATED !== false) {
    throw new OcrResearchExpansionV1Error("PILOT10_MUTATED");
  }
}

export function assertValidation2LocallyAbsent(expansionDirAbs: string): void {
  if (!existsSync(expansionDirAbs)) {
    throw new OcrResearchExpansionV1Error("EXPANSION_LOCAL_DIR_MISSING");
  }
  for (const name of readdirSync(expansionDirAbs)) {
    if (name.endsWith(".tmp")) continue;
    if (name.toLowerCase().includes("validation2")) {
      throw new OcrResearchExpansionV1Error("VALIDATION_2_HUMAN_TRUTH_EXISTS");
    }
    if (!ALLOWED_EXPANSION_LOCAL_FILES.has(name)) {
      const abs = path.join(expansionDirAbs, name);
      if (existsSync(abs) && name.toLowerCase().includes("validation")) {
        throw new OcrResearchExpansionV1Error("VALIDATION_2_HUMAN_TRUTH_EXISTS");
      }
    }
  }
}
