import { readFileSync } from "node:fs";
import path from "node:path";
import {
  API_FOOTBALL_DERIVED_LINEUP_INJURY_LEGAL_EVIDENCE_REL,
  API_FOOTBALL_LEGAL_EVIDENCE_REL,
  API_FOOTBALL_SCOPE_STATUSES,
} from "./api-football";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function parseEvidenceScopeStatuses(
  parsed: Record<string, unknown>,
  label: string,
): Record<string, string> {
  if (!isRecord(parsed.scopeStatuses) && !isRecord(parsed.legalStatuses)) {
    throw new Error(`${label}_SCOPE_MISSING`);
  }
  const rawScopes = isRecord(parsed.scopeStatuses)
    ? parsed.scopeStatuses
    : (parsed.legalStatuses as Record<string, unknown>);
  const scopeStatuses: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawScopes)) {
    if (typeof value !== "string") {
      throw new Error(`${label}_SCOPE_INVALID:${key}`);
    }
    scopeStatuses[key] = value;
  }
  return scopeStatuses;
}

function loadEvidenceJson(
  rel: string,
  rootDir: string,
): Record<string, unknown> {
  const abs = path.join(rootDir, rel);
  const parsed: unknown = JSON.parse(readFileSync(abs, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error("API_FOOTBALL_LEGAL_EVIDENCE_INVALID");
  }
  return parsed;
}

export function loadApiFootballLegalEvidence(rootDir = process.cwd()): {
  evidenceDate: string;
  source: string;
  termsLastUpdated: string;
  scopeStatuses: Record<string, string>;
  raw: Record<string, unknown>;
} {
  const parsed = loadEvidenceJson(API_FOOTBALL_LEGAL_EVIDENCE_REL, rootDir);
  if (typeof parsed.evidenceDate !== "string") {
    throw new Error("API_FOOTBALL_LEGAL_EVIDENCE_DATE_MISSING");
  }
  if (typeof parsed.source !== "string") {
    throw new Error("API_FOOTBALL_LEGAL_EVIDENCE_SOURCE_MISSING");
  }
  if (typeof parsed.termsLastUpdated !== "string") {
    throw new Error("API_FOOTBALL_LEGAL_EVIDENCE_TERMS_DATE_MISSING");
  }
  return {
    evidenceDate: parsed.evidenceDate,
    source: parsed.source,
    termsLastUpdated: parsed.termsLastUpdated,
    scopeStatuses: parseEvidenceScopeStatuses(
      parsed,
      "API_FOOTBALL_LEGAL_EVIDENCE",
    ),
    raw: parsed,
  };
}

export function loadApiFootballDerivedLineupInjuryLegalEvidence(
  rootDir = process.cwd(),
): {
  decisionDate: string;
  provider: string;
  scopeStatuses: Record<string, string>;
  raw: Record<string, unknown>;
} {
  const parsed = loadEvidenceJson(
    API_FOOTBALL_DERIVED_LINEUP_INJURY_LEGAL_EVIDENCE_REL,
    rootDir,
  );
  if (typeof parsed.decisionDate !== "string" && typeof parsed.evidenceDate !== "string") {
    throw new Error("API_FOOTBALL_DERIVED_LEGAL_EVIDENCE_DATE_MISSING");
  }
  if (typeof parsed.provider !== "string") {
    throw new Error("API_FOOTBALL_DERIVED_LEGAL_EVIDENCE_PROVIDER_MISSING");
  }
  return {
    decisionDate:
      typeof parsed.decisionDate === "string"
        ? parsed.decisionDate
        : String(parsed.evidenceDate),
    provider: parsed.provider,
    scopeStatuses: parseEvidenceScopeStatuses(
      parsed,
      "API_FOOTBALL_DERIVED_LEGAL_EVIDENCE",
    ),
    raw: parsed,
  };
}

/**
 * Registry must match committed evidence.
 * Base scopes live in the primary evidence artifact; granular player-data
 * scopes live in the derived lineup/injury evidence artifact.
 */
export function assertApiFootballLegalStateMatchesEvidence(
  rootDir = process.cwd(),
): void {
  const primary = loadApiFootballLegalEvidence(rootDir);
  const derived = loadApiFootballDerivedLineupInjuryLegalEvidence(rootDir);
  const merged: Record<string, string> = {
    ...primary.scopeStatuses,
    ...derived.scopeStatuses,
  };
  for (const [key, expected] of Object.entries(API_FOOTBALL_SCOPE_STATUSES)) {
    if (merged[key] !== expected) {
      throw new Error(
        `API_FOOTBALL_LEGAL_EVIDENCE_DRIFT:${key} evidence=${String(merged[key])} registry=${expected}`,
      );
    }
  }
}
