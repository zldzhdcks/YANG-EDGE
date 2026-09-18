import path from "node:path";
import {
  DAILY_SCOPE_LOCK_SCHEMA_VERSION,
  RESEARCH_TARGET_SCOPE_LOCK_MECHANISM,
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

export function researchTargetScopeLockRel(dateKst: string): string {
  return `data/audits/${dateKst}-daily-scope-lock-v1.json`;
}

export function researchTargetScopeLockAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, researchTargetScopeLockRel(dateKst));
}

export function isResearchTargetScopeLockDocument(
  value: unknown,
): value is {
  schemaVersion: string;
  lockMechanism?: string;
  dateKst: string;
} {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const doc = value as Record<string, unknown>;
  return (
    doc.schemaVersion === DAILY_SCOPE_LOCK_SCHEMA_VERSION &&
    typeof doc.dateKst === "string" &&
    (doc.lockMechanism === undefined ||
      doc.lockMechanism === RESEARCH_TARGET_SCOPE_LOCK_MECHANISM ||
      typeof doc.lockMechanism === "string")
  );
}
