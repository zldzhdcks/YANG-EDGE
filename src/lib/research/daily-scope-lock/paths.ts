import path from "node:path";
import {
  LEGACY_DAILY_SCOPE_LOCK_SCHEMA_VERSION,
  RESEARCH_TARGET_SCOPE_LOCK_MECHANISM,
  RESEARCH_TARGET_SCOPE_LOCK_POLICY_VERSION,
  RESEARCH_TARGET_SCOPE_LOCK_SCHEMA_VERSION,
  type ResearchTargetScopeLockDocument,
  type ResearchTargetScopeSourceRef,
} from "./types";

export function assertExplicitDateKst(dateKst: string): string {
  if (typeof dateKst !== "string" || dateKst.trim() === "") {
    throw new Error("EXPLICIT_DATE_KST_REQUIRED");
  }
  const trimmed = dateKst.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`INVALID_DATE_KST:${trimmed}`);
  }
  const [y, m, d] = trimmed.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error(`INVALID_DATE_KST:${trimmed}`);
  }
  return trimmed;
}

export function operatorBetmanDailySlateRel(dateKst: string): string {
  return `data/operator-input/betman/${dateKst}-daily-slate-v1.json`;
}

export function betmanFullSlateRel(dateKst: string): string {
  return `data/research/daily-slates/${dateKst}-betman-full-slate-v1.json`;
}

export function researchSlateSourceFreezeRel(dateKst: string): string {
  return `data/research/daily-slates/${dateKst}-research-slate-source-freeze-v1.json`;
}

/** Legacy Daily C Stage A path — do not write target-level locks here. */
export function legacyDailyScopeLockRel(dateKst: string): string {
  return `data/audits/${dateKst}-daily-scope-lock-v1.json`;
}

/** New research-target cohort path — distinct from legacy Daily C. */
export function researchTargetScopeLockRel(dateKst: string): string {
  return `data/audits/${dateKst}-research-target-scope-lock-v1.json`;
}

export function researchTargetScopeLockAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, researchTargetScopeLockRel(dateKst));
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function isSourceRef(v: unknown): v is ResearchTargetScopeSourceRef {
  const rec = asRecord(v);
  if (!rec) return false;
  return (
    rec.class === "RESEARCH_SLATE_SOURCE_FREEZE" &&
    typeof rec.rel === "string" &&
    typeof rec.sha256 === "string"
  );
}

/**
 * Strict type guard for the new target-level research scope lock.
 * Legacy Daily C documents always fail.
 */
export function isResearchTargetScopeLockDocument(
  value: unknown,
): value is ResearchTargetScopeLockDocument {
  const doc = asRecord(value);
  if (!doc) return false;
  if (doc.schemaVersion !== RESEARCH_TARGET_SCOPE_LOCK_SCHEMA_VERSION) {
    return false;
  }
  if (doc.lockMechanism !== RESEARCH_TARGET_SCOPE_LOCK_MECHANISM) {
    return false;
  }
  if (doc.policyVersion !== RESEARCH_TARGET_SCOPE_LOCK_POLICY_VERSION) {
    return false;
  }
  if (typeof doc.dateKst !== "string") return false;
  if (typeof doc.targetCount !== "number" || !Number.isFinite(doc.targetCount)) {
    return false;
  }
  if (!Array.isArray(doc.targets)) return false;
  if (!isSourceRef(doc.source)) return false;
  return true;
}

export type LegacyDailyScopeClassification =
  | "LEGACY_DAILY_SCOPE_LOCK"
  | "RESEARCH_TARGET_SCOPE_LOCK"
  | "UNKNOWN";

/**
 * Classify a parsed audit JSON without casting.
 * Legacy schema without the new mechanism is LEGACY_DAILY_SCOPE_LOCK.
 */
export function classifyScopeLockDocument(
  value: unknown,
): LegacyDailyScopeClassification {
  if (isResearchTargetScopeLockDocument(value)) {
    return "RESEARCH_TARGET_SCOPE_LOCK";
  }
  const doc = asRecord(value);
  if (!doc) return "UNKNOWN";
  if (
    doc.schemaVersion === LEGACY_DAILY_SCOPE_LOCK_SCHEMA_VERSION &&
    typeof doc.dateKst === "string" &&
    doc.lockMechanism !== RESEARCH_TARGET_SCOPE_LOCK_MECHANISM
  ) {
    return "LEGACY_DAILY_SCOPE_LOCK";
  }
  return "UNKNOWN";
}

export function isLegacyDailyScopeLockDocument(value: unknown): boolean {
  return classifyScopeLockDocument(value) === "LEGACY_DAILY_SCOPE_LOCK";
}
