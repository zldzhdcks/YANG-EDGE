/**
 * Read-only source probes for Operation Memory.
 * Does not call providers or mutate artifacts.
 */
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import type { OperationMemorySource } from "./types";

async function exists(abs: string): Promise<boolean> {
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfPresent(
  cwd: string,
  rel: string,
): Promise<{ present: boolean; path: string; data: Record<string, unknown> | null }> {
  const abs = path.join(cwd, rel);
  if (!(await exists(abs))) {
    return { present: false, path: rel, data: null };
  }
  try {
    const raw = await readFile(abs, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    return { present: true, path: rel, data };
  } catch {
    return { present: true, path: rel, data: null };
  }
}

export type OperationMemorySourcesLoaded = {
  sources: OperationMemorySource[];
  validity: Record<string, unknown> | null;
  validityPath: string | null;
  reviewSummary: Record<string, unknown> | null;
  reviewPath: string | null;
  scorecard: Record<string, unknown> | null;
  scorecardPath: string | null;
  reviewDetail: Record<string, unknown> | null;
  reviewDetailPath: string | null;
  dailyResearch: Record<string, unknown> | null;
  dailyResearchPath: string | null;
  pregameAudit: Record<string, unknown> | null;
  pregameAuditPath: string | null;
  roadmapPresent: boolean;
};

export async function loadOperationMemorySources(input: {
  dateKst: string;
  cwd?: string;
}): Promise<OperationMemorySourcesLoaded> {
  const cwd = input.cwd ?? process.cwd();
  const d = input.dateKst;

  const candidates: { id: string; path: string; role: string }[] = [
    {
      id: "prediction-validity",
      path: `data/research/mlb/${d}-prediction-validity-v0.json`,
      role: "pregame validity / invalid sample exclusion",
    },
    {
      id: "daily-review-summary",
      path: `data/research/mlb/${d}-daily-review-summary-v1.json`,
      role: "graded review summary",
    },
    {
      id: "prediction-scorecard",
      path: `data/research/mlb/${d}-prediction-scorecard-v0.json`,
      role: "observational scorecard",
    },
    {
      id: "prediction-review-detail",
      path: `data/research/mlb/${d}-prediction-review-detail-v0.json`,
      role: "research review detail",
    },
    {
      id: "daily-research-summary",
      path: `data/research/mlb/${d}-daily-research-summary-v1.json`,
      role: "pregame research ready summary",
    },
    {
      id: "pregame-validity-audit",
      path: `data/audits/${d}-mlb-pregame-validity-audit-v1.json`,
      role: "late/integrity audit",
    },
    {
      id: "roadmap",
      path: "ROADMAP.md",
      role: "product stage and goals",
    },
  ];

  // Also probe known sibling dates for week memory (read-only, no fabrication)
  const weekExtras = ["2026-08-02", "2026-08-03"].filter((x) => x !== d);
  for (const wd of weekExtras) {
    candidates.push({
      id: `review-summary-${wd}`,
      path: `data/research/mlb/${wd}-daily-review-summary-v1.json`,
      role: `week memory review ${wd}`,
    });
    candidates.push({
      id: `validity-${wd}`,
      path: `data/research/mlb/${wd}-prediction-validity-v0.json`,
      role: `week memory validity ${wd}`,
    });
  }

  const sources: OperationMemorySource[] = [];
  const loaded = new Map<string, Record<string, unknown> | null>();

  for (const c of candidates) {
    const r = await readJsonIfPresent(cwd, c.path);
    // ROADMAP is markdown
    if (c.id === "roadmap") {
      const present = await exists(path.join(cwd, c.path));
      sources.push({
        id: c.id,
        path: c.path,
        present,
        role: c.role,
      });
      continue;
    }
    sources.push({
      id: c.id,
      path: c.path,
      present: r.present,
      role: c.role,
    });
    if (r.present && r.data) loaded.set(c.id, r.data);
  }

  const roadmapPresent = sources.find((s) => s.id === "roadmap")?.present ?? false;

  return {
    sources,
    validity: loaded.get("prediction-validity") ?? null,
    validityPath: sources.find((s) => s.id === "prediction-validity" && s.present)
      ?.path ?? null,
    reviewSummary: loaded.get("daily-review-summary") ?? null,
    reviewPath: sources.find((s) => s.id === "daily-review-summary" && s.present)
      ?.path ?? null,
    scorecard: loaded.get("prediction-scorecard") ?? null,
    scorecardPath: sources.find((s) => s.id === "prediction-scorecard" && s.present)
      ?.path ?? null,
    reviewDetail: loaded.get("prediction-review-detail") ?? null,
    reviewDetailPath: sources.find(
      (s) => s.id === "prediction-review-detail" && s.present,
    )?.path ?? null,
    dailyResearch: loaded.get("daily-research-summary") ?? null,
    dailyResearchPath: sources.find(
      (s) => s.id === "daily-research-summary" && s.present,
    )?.path ?? null,
    pregameAudit: loaded.get("pregame-validity-audit") ?? null,
    pregameAuditPath: sources.find(
      (s) => s.id === "pregame-validity-audit" && s.present,
    )?.path ?? null,
    roadmapPresent,
  };
}
