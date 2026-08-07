import { readFile } from "node:fs/promises";
import path from "node:path";
import { artifactPaths, auditSchedule } from "@/lib/mlb/daily-pregame-v0/audit-artifacts";
import { evaluateCutoffGate } from "@/lib/mlb/daily-pregame-v0/pregame-gates";
import {
  DAILY_PREDICTION_SNAPSHOT_MISSING,
  PREDICTION_CONTINUITY_SCHEMA,
  type PredictionContinuityAssessment,
} from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function readJson(
  rel: string,
  cwd: string,
): Promise<Record<string, unknown> | null> {
  try {
    const raw = JSON.parse(await readFile(path.join(cwd, rel), "utf8")) as unknown;
    return asRecord(raw);
  } catch {
    return null;
  }
}

/**
 * Read-only continuity assessment for a KST slate.
 * Never writes Prediction / Engine / Dataset artifacts.
 */
export async function assessMlbPredictionContinuity(input: {
  dateKst: string;
  cwd?: string;
  asOf?: string;
}): Promise<PredictionContinuityAssessment> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const asOf = input.asOf ?? new Date().toISOString();
  const pathRel = artifactPaths(dateKst).prediction;

  const schedule = await auditSchedule(dateKst, cwd);
  const cutoff = evaluateCutoffGate({
    schedule,
    asOfIso: asOf,
  });

  const predDoc = await readJson(pathRel, cwd);
  const meta = asRecord(predDoc?.meta) ?? {};
  const predictions = Array.isArray(predDoc?.predictions)
    ? predDoc!.predictions
    : [];
  const snapshotExists = predDoc != null && predictions.length > 0;
  const generatedAt = asString(meta.generatedAt);
  const predictionHashSha256 = asString(meta.predictionHashSha256);
  const modelStatus = asString(meta.modelStatus);
  const predictedAt =
    asString(asRecord(predictions[0])?.predictedAt) ?? generatedAt;

  const earliestStartUtc = schedule.earliestStart;
  let createdBeforeFirstStart: boolean | null = null;
  if (snapshotExists && generatedAt && earliestStartUtc) {
    const g = Date.parse(generatedAt);
    const e = Date.parse(earliestStartUtc);
    if (Number.isFinite(g) && Number.isFinite(e)) {
      createdBeforeFirstStart = g < e;
    }
  } else if (snapshotExists && predictedAt && earliestStartUtc) {
    const g = Date.parse(predictedAt);
    const e = Date.parse(earliestStartUtc);
    if (Number.isFinite(g) && Number.isFinite(e)) {
      createdBeforeFirstStart = g < e;
    }
  }

  // Continuity required whenever a dated schedule with games exists.
  // After start we cannot create a snapshot, but a missing file is still an ops miss.
  const continuityRequired =
    schedule.exists && schedule.dateKstMatch && schedule.totalGames > 0;

  if (!schedule.exists || !schedule.dateKstMatch || schedule.totalGames === 0) {
    return {
      schemaVersion: PREDICTION_CONTINUITY_SCHEMA,
      dateKst,
      status: "SCHEDULE_MISSING",
      continuityRequired: false,
      snapshotExists,
      generatedAt,
      predictedAt,
      createdBeforeFirstStart,
      predictionHashSha256,
      modelStatus,
      earliestStartUtc,
      asOf,
      pathRel,
      opsFailure: false,
      plainLanguage: "Schedule이 없어 Prediction Continuity 대상이 아닙니다.",
    };
  }

  if (snapshotExists) {
    return {
      schemaVersion: PREDICTION_CONTINUITY_SCHEMA,
      dateKst,
      status: "SNAPSHOT_PRESENT",
      continuityRequired,
      snapshotExists: true,
      generatedAt,
      predictedAt,
      createdBeforeFirstStart,
      predictionHashSha256,
      modelStatus,
      earliestStartUtc,
      asOf,
      pathRel,
      opsFailure: false,
      plainLanguage:
        createdBeforeFirstStart === false
          ? "Snapshot은 있으나 첫 경기 시작 후 생성된 것으로 보입니다. Review에서 유효성을 확인하세요."
          : "오늘 Prediction Snapshot이 존재합니다.",
    };
  }

  if (cutoff.blocked) {
    return {
      schemaVersion: PREDICTION_CONTINUITY_SCHEMA,
      dateKst,
      status: DAILY_PREDICTION_SNAPSHOT_MISSING,
      continuityRequired: true,
      snapshotExists: false,
      generatedAt: null,
      predictedAt: null,
      createdBeforeFirstStart: null,
      predictionHashSha256: null,
      modelStatus: null,
      earliestStartUtc,
      asOf,
      pathRel,
      opsFailure: true,
      plainLanguage:
        "운영 실패: 경기 전 Snapshot이 없이 슬레이트가 종료되었습니다 (DAILY_PREDICTION_SNAPSHOT_MISSING). 사후 Snapshot 생성은 금지됩니다.",
    };
  }

  return {
    schemaVersion: PREDICTION_CONTINUITY_SCHEMA,
    dateKst,
    status: DAILY_PREDICTION_SNAPSHOT_MISSING,
    continuityRequired: true,
    snapshotExists: false,
    generatedAt: null,
    predictedAt: null,
    createdBeforeFirstStart: null,
    predictionHashSha256: null,
    modelStatus: null,
    earliestStartUtc,
    asOf,
    pathRel,
    opsFailure: true,
    plainLanguage:
      "운영 실패: 경기 전 Schedule이 있는데 Prediction Snapshot이 없습니다 (DAILY_PREDICTION_SNAPSHOT_MISSING).",
  };
}
