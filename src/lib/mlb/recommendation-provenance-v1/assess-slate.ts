import { readFile } from "node:fs/promises";
import path from "node:path";
import { artifactPaths, auditSchedule } from "@/lib/mlb/daily-pregame-v0/audit-artifacts";
import {
  detectPredictionContract,
  verifyPredictionHash,
} from "@/lib/mlb/prediction-contract-v1";
import { asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import {
  ENGINE_RECOMMENDATION_RECORD_EPOCH,
  RECOMMENDATION_PROVENANCE_SCHEMA,
  type SlateProvenanceBanner,
  type SnapshotProvenanceStatus,
} from "./types";

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function engineRecommendationRecordRel(dateKst: string): string {
  return `data/recommendations/mlb/${dateKst}-engine-recommendations-v1.json`;
}

export async function assessSlateRecommendationProvenance(input: {
  dateKst: string;
  cwd?: string;
}): Promise<SlateProvenanceBanner> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const predRel = artifactPaths(dateKst).prediction;
  const schedule = await auditSchedule(dateKst, cwd);

  let predDoc: Record<string, unknown> | null = null;
  try {
    predDoc = JSON.parse(
      await readFile(path.join(cwd, predRel), "utf8"),
    ) as Record<string, unknown>;
  } catch {
    predDoc = null;
  }

  if (!predDoc || asArr(predDoc.predictions).length === 0) {
    return {
      status: "NO_PREGAME_SNAPSHOT",
      predictionStatusLine: "✗ NO_PREGAME_SNAPSHOT",
      snapshotDate: null,
      generatedLine: "Snapshot 없음",
      predictionHash: null,
      predictionHashShort: null,
      recommendationSourceLine: "NO SNAPSHOT — YANG EDGE 추천 없음",
      hashVerified: false,
      generatedBeforeGame: null,
      allowEngineRecommendations: false,
    };
  }

  const meta = asRecord(predDoc.meta) ?? {};
  const generatedAt = asString(meta.generatedAt);
  const hash = asString(meta.predictionHashSha256);
  const contract = detectPredictionContract(predDoc);
  const hashVerify = verifyPredictionHash(predDoc);
  const earliest = schedule.earliestStart;
  let generatedBeforeGame: boolean | null = null;
  if (generatedAt && earliest) {
    const g = Date.parse(generatedAt);
    const e = Date.parse(earliest);
    if (Number.isFinite(g) && Number.isFinite(e)) {
      generatedBeforeGame = g < e;
    }
  }

  let status: SnapshotProvenanceStatus;
  if (!hashVerify.verified) {
    status = "HASH_MISMATCH";
  } else if (generatedBeforeGame === false) {
    status = "SNAPSHOT_AFTER_START";
  } else if (generatedBeforeGame === true && hashVerify.verified) {
    status = "PRE_GAME_SNAPSHOT_VERIFIED";
  } else {
    status = "SNAPSHOT_PRESENT_UNVERIFIED";
  }

  const allowEngineRecommendations =
    status === "PRE_GAME_SNAPSHOT_VERIFIED" &&
    dateKst >= ENGINE_RECOMMENDATION_RECORD_EPOCH;

  const hashShort = hash ? `${hash.slice(0, 8)}…` : null;

  let predictionStatusLine: string;
  let recommendationSourceLine: string;
  if (status === "PRE_GAME_SNAPSHOT_VERIFIED") {
    predictionStatusLine = "✓ PRE-GAME SNAPSHOT VERIFIED";
  } else if (status === "HASH_MISMATCH") {
    predictionStatusLine = "✗ SNAPSHOT HASH MISMATCH";
  } else if (status === "SNAPSHOT_AFTER_START") {
    predictionStatusLine = "✗ SNAPSHOT AFTER START (사후 생성)";
  } else {
    predictionStatusLine = "⚠ SNAPSHOT PRESENT — UNVERIFIED";
  }

  if (allowEngineRecommendations) {
    recommendationSourceLine = "YANG EDGE ENGINE SNAPSHOT";
  } else if (dateKst < ENGINE_RECOMMENDATION_RECORD_EPOCH) {
    recommendationSourceLine = "RECONSTRUCTED (전달 기록 없음 · 성적 제외)";
  } else {
    recommendationSourceLine = "ENGINE 추천 비활성";
  }

  return {
    status,
    predictionStatusLine,
    snapshotDate: dateKst,
    generatedLine:
      generatedBeforeGame === true
        ? "경기 시작 전"
        : generatedBeforeGame === false
          ? "경기 시작 후 (엔진 추천 불가)"
          : "생성 시점 미확인",
    predictionHash: hash,
    predictionHashShort: hashShort,
    recommendationSourceLine,
    hashVerified: hashVerify.verified,
    generatedBeforeGame,
    allowEngineRecommendations,
  };
}

export { RECOMMENDATION_PROVENANCE_SCHEMA, detectPredictionContract };
