import { OcrV4DesignV0Error } from "./error";
import {
  FROZEN_DISCOVERY2_HUMAN_TRUTH_SHA256,
  FROZEN_NEW_DAILY_ODDS_INTAKE_SEAL_SHA256,
  FROZEN_OCR_RESEARCH_EXPANSION_SPLIT_SHA256,
  FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256,
  FROZEN_PILOT10_DISCOVERY_ANNOTATION_SHA256,
} from "./types";

export function assertFrozenSplitSha(actual: string): void {
  if (actual !== FROZEN_OCR_RESEARCH_EXPANSION_SPLIT_SHA256) {
    throw new OcrV4DesignV0Error("OCR_RESEARCH_EXPANSION_SPLIT_MUTATED");
  }
}

export function assertFrozenDiscovery2TruthSha(actual: string): void {
  if (actual !== FROZEN_DISCOVERY2_HUMAN_TRUTH_SHA256) {
    throw new OcrV4DesignV0Error("DISCOVERY2_HUMAN_TRUTH_MUTATED");
  }
}

export function assertFrozenPilot10Sha(actual: string): void {
  if (actual !== FROZEN_PILOT10_DISCOVERY_ANNOTATION_SHA256) {
    throw new OcrV4DesignV0Error("PILOT10_MUTATED");
  }
}

export function assertFrozenV3ResultSha(actual: string): void {
  if (actual !== FROZEN_PARTICIPANT_OCR_V3_RESULT_SHA256) {
    throw new OcrV4DesignV0Error("PARTICIPANT_OCR_V3_RESULT_MUTATED");
  }
}

export function assertFrozenDaily106SealSha(actual: string): void {
  if (actual !== FROZEN_NEW_DAILY_ODDS_INTAKE_SEAL_SHA256) {
    throw new OcrV4DesignV0Error("NEW_DAILY_ODDS_INTAKE_SEAL_MUTATED");
  }
}
