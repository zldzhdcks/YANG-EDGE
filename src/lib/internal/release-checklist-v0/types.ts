/**
 * Read-only view of EDGE 서류/RELEASE_v0.8_CHECKLIST.md
 * Dashboard must never mutate this document or invent write-back.
 */

export const RELEASE_CHECKLIST_SCHEMA =
  "yang-edge-release-checklist-v0" as const;

export const RELEASE_CHECKLIST_RELATIVE_PATH =
  "EDGE 서류/RELEASE_v0.8_CHECKLIST.md" as const;

export type ReleaseItemStatus =
  | "READY"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "NOT_STARTED"
  | "OPEN"
  | "UNKNOWN";

export type ReleaseSectionId =
  | "MLB"
  | "Football"
  | "KBO"
  | "OS"
  | "Provider"
  | "Legal";

export type ReleaseCriticalIssue = {
  id: string;
  title: string;
  status: ReleaseItemStatus | string;
  note: string;
};

export type ReleaseSectionStatus = {
  id: ReleaseSectionId;
  label: string;
  status: ReleaseItemStatus;
  detail: string;
};

export type ReleaseChecklistView = {
  schemaVersion: typeof RELEASE_CHECKLIST_SCHEMA;
  sourcePath: string;
  sourceOfTruth: true;
  readOnly: true;
  loaded: boolean;
  error: string | null;
  currentVersion: string;
  targetRelease: string;
  overallStatus: ReleaseItemStatus;
  overallProgressPercent: number;
  progressBar: string;
  privateBetaMet: number;
  privateBetaTotal: number;
  currentFocus: string[];
  criticalIssues: ReleaseCriticalIssue[];
  sections: ReleaseSectionStatus[];
};
