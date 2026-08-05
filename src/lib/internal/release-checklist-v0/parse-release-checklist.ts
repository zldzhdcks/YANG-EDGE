import type {
  ReleaseChecklistView,
  ReleaseCriticalIssue,
  ReleaseItemStatus,
  ReleaseSectionId,
  ReleaseSectionStatus,
} from "./types";
import {
  RELEASE_CHECKLIST_RELATIVE_PATH,
  RELEASE_CHECKLIST_SCHEMA,
} from "./types";

const SECTION_ORDER: ReleaseSectionId[] = [
  "MLB",
  "Football",
  "KBO",
  "OS",
  "Provider",
  "Legal",
];

function stripMd(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

function normalizeStatus(raw: string): ReleaseItemStatus {
  const s = stripMd(raw).toUpperCase().replace(/\s+/g, "_");
  if (s.startsWith("READY")) return "READY";
  if (s.includes("IN_PROGRESS") || s === "IN-PROGRESS") return "IN_PROGRESS";
  if (s.startsWith("BLOCKED")) return "BLOCKED";
  if (s.startsWith("NOT_STARTED") || s === "NOT-STARTED") return "NOT_STARTED";
  if (s.startsWith("OPEN")) return "OPEN";
  return "UNKNOWN";
}

function cell(cols: string[], index: number): string {
  return stripMd(cols[index] ?? "");
}

/** Split a markdown table row into cells (no leading/trailing pipes required). */
function tableCells(line: string): string[] | null {
  const t = line.trim();
  if (!t.includes("|")) return null;
  if (/^\|?\s*-{2,}/.test(t)) return null; // separator
  const parts = t.split("|").map((p) => p.trim());
  // drop empty edges from leading/trailing |
  if (parts[0] === "") parts.shift();
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts.length >= 2 ? parts : null;
}

function sectionBetween(
  md: string,
  startHeading: string,
  endHeadings: string[],
): string {
  const start = md.indexOf(startHeading);
  if (start < 0) return "";
  let end = md.length;
  for (const h of endHeadings) {
    const i = md.indexOf(h, start + startHeading.length);
    if (i >= 0 && i < end) end = i;
  }
  return md.slice(start, end);
}

function parseKvTable(
  block: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const cols = tableCells(line);
    if (!cols || cols.length < 2) continue;
    if (cols[0] === "항목" || cols[0] === "#") continue;
    out[cols[0]] = cols[1];
  }
  return out;
}

function parseMajorProgress(block: string): ReleaseSectionStatus[] {
  const byId = new Map<string, ReleaseSectionStatus>();
  for (const line of block.split("\n")) {
    const cols = tableCells(line);
    if (!cols || cols.length < 2) continue;
    if (cols[0] === "영역") continue;
    const label = cell(cols, 0);
    if (!SECTION_ORDER.includes(label as ReleaseSectionId)) continue;
    const id = label as ReleaseSectionId;
    byId.set(id, {
      id,
      label,
      status: normalizeStatus(cols[1] ?? ""),
      detail: cell(cols, 2),
    });
  }
  return SECTION_ORDER.map(
    (id) =>
      byId.get(id) ?? {
        id,
        label: id,
        status: "UNKNOWN" as const,
        detail: "",
      },
  );
}

function parseCriticalIssues(block: string): ReleaseCriticalIssue[] {
  const issues: ReleaseCriticalIssue[] = [];
  for (const line of block.split("\n")) {
    const cols = tableCells(line);
    if (!cols || cols.length < 3) continue;
    if (cols[0] === "#" || cols[0] === "이슈") continue;
    if (!/^\d+$/.test(cols[0])) continue;
    issues.push({
      id: `critical-${cols[0]}`,
      title: cell(cols, 1),
      status: stripMd(cols[2] ?? ""),
      note: cell(cols, 3),
    });
  }
  return issues;
}

function parsePrivateBetaProgress(block: string): {
  met: number;
  total: number;
} {
  let met = 0;
  let total = 0;
  for (const line of block.split("\n")) {
    const cols = tableCells(line);
    if (!cols || cols.length < 4) continue;
    if (cols[0] === "#" || cols[0] === "조건") continue;
    if (!/^\d+$/.test(cols[0])) continue;
    total += 1;
    const check = cols[3] ?? "";
    if (/\[x\]/i.test(check) || /\[X\]/.test(check)) met += 1;
  }
  return { met, total };
}

function parseCurrentFocus(block: string): string[] {
  const items: string[] = [];
  for (const line of block.split("\n")) {
    const m = line.match(/^\d+\.\s+(.+)/);
    if (!m) continue;
    const text = stripMd(m[1] ?? "");
    if (!text) continue;
    if (text.startsWith("하지 않음") || text.includes("**하지 않음**")) continue;
    if (/^하지 않음/.test(text)) continue;
    // Drop the "하지 않음: ..." action line
    if (text.includes("하지 않음:")) continue;
    items.push(text);
  }
  return items.slice(0, 6);
}

export function buildProgressBar(percent: number, width = 10): string {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((p / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

/**
 * Pure parse — no I/O. Does not mutate source markdown.
 */
export function parseReleaseChecklistMarkdown(
  markdown: string,
  sourcePath: string = RELEASE_CHECKLIST_RELATIVE_PATH,
): ReleaseChecklistView {
  const statusBlock = sectionBetween(mdSafe(markdown), "# Release Status", [
    "# Major Progress",
  ]);
  const majorBlock = sectionBetween(mdSafe(markdown), "# Major Progress", [
    "# MLB",
  ]);
  const criticalBlock = sectionBetween(mdSafe(markdown), "# Critical Issues", [
    "# Private Beta 조건",
  ]);
  const betaBlock = sectionBetween(mdSafe(markdown), "# Private Beta 조건", [
    "# v1.0 조건",
  ]);
  const focusBlock = sectionBetween(mdSafe(markdown), "# 다음 액션 (요약)", [
    "# END",
  ]);

  const kv = parseKvTable(statusBlock);
  const { met, total } = parsePrivateBetaProgress(betaBlock);
  const percent =
    total > 0 ? Math.round((met / total) * 100) : 0;

  return {
    schemaVersion: RELEASE_CHECKLIST_SCHEMA,
    sourcePath,
    sourceOfTruth: true,
    readOnly: true,
    loaded: true,
    error: null,
    currentVersion: stripMd(kv["Current Version"] ?? "—"),
    targetRelease: stripMd(kv["Target"] ?? "—"),
    overallStatus: normalizeStatus(kv["Status"] ?? "UNKNOWN"),
    overallProgressPercent: percent,
    progressBar: buildProgressBar(percent),
    privateBetaMet: met,
    privateBetaTotal: total,
    currentFocus: parseCurrentFocus(focusBlock),
    criticalIssues: parseCriticalIssues(criticalBlock),
    sections: parseMajorProgress(majorBlock),
  };
}

function mdSafe(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n");
}

export function emptyReleaseChecklistView(
  error: string,
  sourcePath: string = RELEASE_CHECKLIST_RELATIVE_PATH,
): ReleaseChecklistView {
  return {
    schemaVersion: RELEASE_CHECKLIST_SCHEMA,
    sourcePath,
    sourceOfTruth: true,
    readOnly: true,
    loaded: false,
    error,
    currentVersion: "—",
    targetRelease: "—",
    overallStatus: "UNKNOWN",
    overallProgressPercent: 0,
    progressBar: buildProgressBar(0),
    privateBetaMet: 0,
    privateBetaTotal: 0,
    currentFocus: [],
    criticalIssues: [],
    sections: SECTION_ORDER.map((id) => ({
      id,
      label: id,
      status: "UNKNOWN",
      detail: "",
    })),
  };
}
