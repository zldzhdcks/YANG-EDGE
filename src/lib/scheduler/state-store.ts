/**
 * Scheduler state artifact — append-safe merge + atomic rename.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  GameSchedulerState,
  SchedulerLeague,
  SchedulerStateArtifact,
  StageStateRecord,
} from "./types";

export function schedulerStatePath(
  league: SchedulerLeague,
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(
    cwd,
    "data",
    "scheduler",
    league.toLowerCase(),
    dateKst,
    "scheduler-state-v1.json",
  );
}

export function schedulerAuditPath(
  league: SchedulerLeague | "ALL",
  dateKst: string,
  cwd = process.cwd(),
): string {
  const leaguePart = league === "ALL" ? "all" : league.toLowerCase();
  return path.join(
    cwd,
    "data",
    "audits",
    `${dateKst}-${leaguePart}-pregame-scheduler-v1-audit.json`,
  );
}

async function writeAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

export async function loadSchedulerState(
  league: SchedulerLeague,
  dateKst: string,
  cwd = process.cwd(),
): Promise<SchedulerStateArtifact | null> {
  const filePath = schedulerStatePath(league, dateKst, cwd);
  try {
    const raw = await readFile(filePath, "utf8");
    const doc = JSON.parse(raw) as SchedulerStateArtifact;
    if (doc.schemaVersion !== "pregame-scheduler-state-v1") {
      throw new Error("MALFORMED_STATE");
    }
    return doc;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (e instanceof Error && e.message === "MALFORMED_STATE") throw e;
    return null;
  }
}

export function upsertGameStage(
  state: SchedulerStateArtifact,
  gameId: string,
  scheduledStartTime: string,
  stageRecord: StageStateRecord,
): SchedulerStateArtifact {
  const games = [...state.games];
  let idx = games.findIndex((g) => g.gameId === gameId);
  if (idx < 0) {
    games.push({
      gameId,
      scheduledStartTime,
      latestStage: stageRecord.stage,
      overallStatus: stageRecord.status,
      stages: [stageRecord],
    });
  } else {
    const g = { ...games[idx]! };
    const stages = [...g.stages];
    const sIdx = stages.findIndex(
      (s) =>
        s.stage === stageRecord.stage &&
        s.schedulerRunId === stageRecord.schedulerRunId,
    );
    if (sIdx >= 0) stages[sIdx] = stageRecord;
    else stages.push(stageRecord);
    g.stages = stages;
    g.latestStage = stageRecord.stage;
    g.overallStatus = deriveOverall(stages);
    g.scheduledStartTime = scheduledStartTime;
    games[idx] = g;
  }
  return {
    ...state,
    generatedAt: new Date().toISOString(),
    games,
  };
}

function deriveOverall(
  stages: StageStateRecord[],
): GameSchedulerState["overallStatus"] {
  const statuses = stages.map((s) => s.status);
  if (statuses.some((s) => s === "FAILED")) {
    if (statuses.some((s) => s === "SUCCESS" || s === "PASS")) {
      return "PARTIAL_SUCCESS";
    }
    return "FAILED";
  }
  if (statuses.every((s) => s === "SUCCESS" || s === "PASS" || s === "SKIPPED")) {
    return statuses.some((s) => s === "SUCCESS" || s === "PASS")
      ? "SUCCESS"
      : "SKIPPED";
  }
  if (
    statuses.some(
      (s) =>
        s === "BLOCKED" ||
        s === "NOT_IMPLEMENTED" ||
        s === "MANUAL_REQUIRED" ||
        s === "INPUT_VALIDATION_FAILED",
    )
  ) {
    return statuses.some((s) => s === "SUCCESS" || s === "PASS")
      ? "PARTIAL_SUCCESS"
      : statuses.find((s) => s === "BLOCKED") ?? "PENDING";
  }
  return statuses[statuses.length - 1] ?? "PENDING";
}

export async function saveSchedulerState(
  state: SchedulerStateArtifact,
  cwd = process.cwd(),
): Promise<string> {
  const filePath = schedulerStatePath(state.league, state.dateKst, cwd);
  await writeAtomic(filePath, state);
  return filePath;
}

export async function saveSchedulerAudit(
  audit: unknown,
  league: SchedulerLeague | "ALL",
  dateKst: string,
  cwd = process.cwd(),
): Promise<string> {
  const filePath = schedulerAuditPath(league, dateKst, cwd);
  await writeAtomic(filePath, audit);
  return filePath;
}

export function emptyState(
  league: SchedulerLeague,
  dateKst: string,
): SchedulerStateArtifact {
  return {
    schemaVersion: "pregame-scheduler-state-v1",
    dateKst,
    league,
    generatedAt: new Date().toISOString(),
    games: [],
  };
}
