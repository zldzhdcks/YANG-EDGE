/**
 * Leakage safety for Reporting — read-only consumer.
 * Never claim leakageCount = 0 without audit evidence.
 */
import type { LeakageStatus } from "./types";

export type ReportingWriteAudit = {
  predictionWrite: number;
  snapshotWrite: number;
  resultWrite: number;
  gradeWrite: number;
  reviewWrite: number;
  providerCalls: number;
  engineCalls: number;
  autoApply: false;
};

export const REPORTING_ZERO_WRITES: ReportingWriteAudit = {
  predictionWrite: 0,
  snapshotWrite: 0,
  resultWrite: 0,
  gradeWrite: 0,
  reviewWrite: 0,
  providerCalls: 0,
  engineCalls: 0,
  autoApply: false,
};

export type LeakageEvidence = {
  auditPresent: boolean;
  auditStatus?: "PASS" | "WARN" | "FAIL" | null;
  auditRel?: string | null;
  confirmedCount?: number | null;
  potentialCount?: number | null;
};

export type LeakageSummary = {
  leakageStatus: LeakageStatus;
  leakageCount: number | "NOT_DERIVABLE";
  potentialLeakageCount: number | "NOT_DERIVABLE";
  note: string;
};

export function summarizeLeakage(evidence: LeakageEvidence): LeakageSummary {
  if (!evidence.auditPresent) {
    return {
      leakageStatus: "NOT_DERIVABLE",
      leakageCount: "NOT_DERIVABLE",
      potentialLeakageCount: "NOT_DERIVABLE",
      note: "No leakage audit artifact. Zero is not assumed.",
    };
  }
  const status = evidence.auditStatus ?? null;
  if (status === "FAIL") {
    return {
      leakageStatus: "EVIDENCE_FAIL",
      leakageCount: evidence.confirmedCount ?? "NOT_DERIVABLE",
      potentialLeakageCount: evidence.potentialCount ?? "NOT_DERIVABLE",
      note: "Audit FAIL — counts only if the audit recorded them.",
    };
  }
  if (status === "WARN") {
    return {
      leakageStatus: "EVIDENCE_WARN",
      leakageCount: evidence.confirmedCount ?? "NOT_DERIVABLE",
      potentialLeakageCount: evidence.potentialCount ?? "NOT_DERIVABLE",
      note: "Audit WARN — not a silent zero.",
    };
  }
  if (status === "PASS" && evidence.confirmedCount != null) {
    return {
      leakageStatus: "EVIDENCE_PASS",
      leakageCount: evidence.confirmedCount,
      potentialLeakageCount: evidence.potentialCount ?? 0,
      note: "Count taken from audit evidence only.",
    };
  }
  return {
    leakageStatus: "NOT_DERIVABLE",
    leakageCount: "NOT_DERIVABLE",
    potentialLeakageCount: "NOT_DERIVABLE",
    note: "Audit present but counts not recorded.",
  };
}
