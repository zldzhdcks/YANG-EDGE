import { readFileSync } from "node:fs";
import path from "node:path";
import {
  API_FOOTBALL_LEGAL_EVIDENCE_REL,
  API_FOOTBALL_SCOPE_STATUSES,
} from "./api-football";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function loadApiFootballLegalEvidence(rootDir = process.cwd()): {
  evidenceDate: string;
  source: string;
  termsLastUpdated: string;
  scopeStatuses: Record<string, string>;
  raw: Record<string, unknown>;
} {
  const abs = path.join(rootDir, API_FOOTBALL_LEGAL_EVIDENCE_REL);
  const parsed: unknown = JSON.parse(readFileSync(abs, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error("API_FOOTBALL_LEGAL_EVIDENCE_INVALID");
  }
  if (typeof parsed.evidenceDate !== "string") {
    throw new Error("API_FOOTBALL_LEGAL_EVIDENCE_DATE_MISSING");
  }
  if (typeof parsed.source !== "string") {
    throw new Error("API_FOOTBALL_LEGAL_EVIDENCE_SOURCE_MISSING");
  }
  if (typeof parsed.termsLastUpdated !== "string") {
    throw new Error("API_FOOTBALL_LEGAL_EVIDENCE_TERMS_DATE_MISSING");
  }
  if (!isRecord(parsed.scopeStatuses)) {
    throw new Error("API_FOOTBALL_LEGAL_EVIDENCE_SCOPE_MISSING");
  }
  const scopeStatuses: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.scopeStatuses)) {
    if (typeof value !== "string") {
      throw new Error(`API_FOOTBALL_LEGAL_EVIDENCE_SCOPE_INVALID:${key}`);
    }
    scopeStatuses[key] = value;
  }
  return {
    evidenceDate: parsed.evidenceDate,
    source: parsed.source,
    termsLastUpdated: parsed.termsLastUpdated,
    scopeStatuses,
    raw: parsed,
  };
}

export function assertApiFootballLegalStateMatchesEvidence(
  rootDir = process.cwd(),
): void {
  const evidence = loadApiFootballLegalEvidence(rootDir);
  for (const [key, expected] of Object.entries(API_FOOTBALL_SCOPE_STATUSES)) {
    if (evidence.scopeStatuses[key] !== expected) {
      throw new Error(
        `API_FOOTBALL_LEGAL_EVIDENCE_DRIFT:${key} evidence=${String(evidence.scopeStatuses[key])} registry=${expected}`,
      );
    }
  }
}
