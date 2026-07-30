import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  MLB_DAILY_RESEARCH_SUMMARY_SCHEMA,
  type MlbDailyDatasetStatus,
  type MlbDailyPipelineStatus,
  type MlbDailyResearchSummaryDocument,
  type MlbDailyResearchSummaryLoad,
  type MlbDailyStepRun,
} from "./mlb-daily-research-summary-types";

export function mlbDailyResearchSummaryRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-daily-research-summary-v1.json`;
}

export function mlbDailyResearchSummaryPath(dateKst: string): string {
  return path.join(process.cwd(), mlbDailyResearchSummaryRel(dateKst));
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

function parseRun(v: unknown): MlbDailyStepRun {
  if (v === "SUCCESS" || v === "FAIL" || v === "SKIP") return v;
  return "FAIL";
}

function parseStatus(v: unknown): MlbDailyDatasetStatus {
  if (
    v === "READY" ||
    v === "PARTIAL" ||
    v === "FAILED" ||
    v === "SKIP" ||
    v === "NOT_RELEASED"
  ) {
    return v;
  }
  return "FAILED";
}

function derivePipelineStatus(
  steps: MlbDailyResearchSummaryDocument["steps"],
): MlbDailyPipelineStatus {
  if (steps.length === 0) return "FAILED";
  const runs = steps.map((s) => s.run);
  const fails = runs.filter((r) => r === "FAIL").length;
  const successes = runs.filter((r) => r === "SUCCESS").length;
  if (fails === 0 && successes > 0) return "SUCCESS";
  if (fails === runs.length) return "FAILED";
  if (fails > 0) return "PARTIAL";
  return "PARTIAL";
}

function parseDocument(
  raw: unknown,
):
  | { ok: true; document: MlbDailyResearchSummaryDocument }
  | { ok: false; reason: "unsupported"; schemaVersion: string | null }
  | { ok: false; reason: "invalid" } {
  const root = asRecord(raw);
  if (!root) return { ok: false, reason: "invalid" };

  const schemaVersion = asString(root.schemaVersion);
  if (schemaVersion !== MLB_DAILY_RESEARCH_SUMMARY_SCHEMA) {
    return { ok: false, reason: "unsupported", schemaVersion };
  }

  const dateKst = asString(root.dateKst);
  const generatedAt = asString(root.generatedAt);
  const assistantSummary = asString(root.assistantSummary);
  if (!dateKst || !generatedAt || assistantSummary == null) {
    return { ok: false, reason: "invalid" };
  }

  const readyRoot = asRecord(root.researchReady);
  if (!readyRoot) return { ok: false, reason: "invalid" };

  const percent = asNumber(readyRoot.percent);
  const score = asNumber(readyRoot.score);
  const max = asNumber(readyRoot.max);
  if (percent == null || score == null || max == null) {
    return { ok: false, reason: "invalid" };
  }

  const stepsRaw = Array.isArray(root.steps) ? root.steps : null;
  if (!stepsRaw) return { ok: false, reason: "invalid" };

  const steps = stepsRaw.map((item) => {
    const r = asRecord(item) ?? {};
    return {
      step: asString(r.step) ?? "Unknown",
      run: parseRun(r.run),
      status: parseStatus(r.status),
      detail: asString(r.detail) ?? "",
      artifact: asString(r.artifact),
      exitCode: asNumber(r.exitCode),
    };
  });

  const datasetsRaw = Array.isArray(readyRoot.datasets)
    ? readyRoot.datasets
    : [];
  const datasets = datasetsRaw.map((item) => {
    const r = asRecord(item) ?? {};
    return {
      dataset: asString(r.dataset) ?? "Unknown",
      status: parseStatus(r.status),
      detail: asString(r.detail) ?? "",
      artifact: asString(r.artifact),
    };
  });

  const countsRoot = asRecord(root.counts) ?? {};

  const document: MlbDailyResearchSummaryDocument = {
    schemaVersion,
    dateKst,
    generatedAt,
    pipeline: asStringArray(root.pipeline),
    steps,
    researchReady: {
      score,
      max,
      percent,
      missing: asStringArray(readyRoot.missing),
      datasets,
    },
    counts: {
      scheduleGames: asNumber(countsRoot.scheduleGames),
      starterComplete: asString(countsRoot.starterComplete),
      oddsCollected: asString(countsRoot.oddsCollected),
      lineupConfirmed: asString(countsRoot.lineupConfirmed),
    },
    assistantSummary,
    notes: asStringArray(root.notes),
    pipelineVersion: asString(root.pipelineVersion),
    roundingPolicy: asString(root.roundingPolicy),
  };

  return { ok: true, document };
}

/**
 * Load MLB Daily Research Summary for Research Lab.
 * Does not read Schedule/Starter/Odds/Lineup datasets.
 */
export async function loadMlbDailyResearchSummary(
  dateKst: string,
): Promise<MlbDailyResearchSummaryLoad> {
  const filePath = mlbDailyResearchSummaryPath(dateKst);
  let rawText: string;
  try {
    rawText = await readFile(filePath, "utf8");
  } catch (e) {
    if (
      e instanceof Error &&
      "code" in e &&
      (e as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { kind: "missing" };
    }
    return { kind: "invalid" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return { kind: "invalid" };
  }

  const doc = parseDocument(parsed);
  if (!doc.ok) {
    if (doc.reason === "unsupported") {
      return { kind: "unsupported", schemaVersion: doc.schemaVersion };
    }
    return { kind: "invalid" };
  }

  const pipelineStatus = derivePipelineStatus(doc.document.steps);
  if (pipelineStatus === "FAILED") {
    return { kind: "pipeline_failed", document: doc.document };
  }

  return {
    kind: "ok",
    document: doc.document,
    pipelineStatus,
  };
}
