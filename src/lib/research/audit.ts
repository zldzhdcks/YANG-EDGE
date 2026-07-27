/**
 * Research Framework v1 — 공통 Audit 인터페이스.
 * 도메인별 audit JSON이 이 형태를 확장한다.
 */
import type { ResearchDatasetStatus, ResearchLegalMeta } from "./types";
import { RESEARCH_FRAMEWORK_VERSION } from "./hash";

export type ResearchAuditCacheStats = {
  rawHit: number;
  rawMiss: number;
  derivedHit: number;
  derivedMiss: number;
  networkCalls: number;
};

export type ResearchAuditTotals = {
  totalRows: number | null;
  uniqueEntities: number | null;
  classificationOrStatusCounts?: Record<string, number>;
  confirmedUnderMinSample?: number;
  secondarySignalCount?: number;
  resultHash: string | null;
  rerunHashMatched: boolean | null;
  cache?: ResearchAuditCacheStats;
};

export type ResearchAuditReport = {
  meta: {
    frameworkVersion: string;
    datasetId: string;
    auditVersion: string;
    generatedAt: string;
    datasetStatus: ResearchDatasetStatus;
    legal: ResearchLegalMeta;
    engineConnected: false;
    predictionSnapshotsUntouched: true;
  };
  totals: ResearchAuditTotals;
  checks: Array<{
    id: string;
    passed: boolean;
    detail: string;
  }>;
  notes?: string[];
};

export function createResearchAuditShell(args: {
  datasetId: string;
  auditVersion: string;
  datasetStatus: ResearchDatasetStatus;
  legal: ResearchLegalMeta;
  totals: ResearchAuditTotals;
  checks?: ResearchAuditReport["checks"];
  notes?: string[];
}): ResearchAuditReport {
  return {
    meta: {
      frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
      datasetId: args.datasetId,
      auditVersion: args.auditVersion,
      generatedAt: new Date().toISOString(),
      datasetStatus: args.datasetStatus,
      legal: args.legal,
      engineConnected: false,
      predictionSnapshotsUntouched: true,
    },
    totals: args.totals,
    checks: args.checks ?? [],
    notes: args.notes,
  };
}
