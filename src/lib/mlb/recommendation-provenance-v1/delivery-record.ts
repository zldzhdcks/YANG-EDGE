import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DailyPickCard } from "@/lib/mlb/daily-picks-v1";
import { asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import {
  engineRecommendationRecordRel,
} from "./assess-slate";
import type { EngineRecommendationRecordV1 } from "./types";

export async function loadEngineRecommendationRecord(input: {
  dateKst: string;
  cwd?: string;
}): Promise<EngineRecommendationRecordV1 | null> {
  const cwd = input.cwd ?? process.cwd();
  const rel = engineRecommendationRecordRel(input.dateKst);
  try {
    const raw = JSON.parse(
      await readFile(path.join(cwd, rel), "utf8"),
    ) as unknown;
    const doc = asRecord(raw);
    if (!doc || asString(doc.schemaVersion) !== "yang-edge-engine-recommendation-record-v1") {
      return null;
    }
    return doc as unknown as EngineRecommendationRecordV1;
  } catch {
    return null;
  }
}

/**
 * Build immutable ENGINE delivery record from Strong/Good cards.
 * Does not recompute Prediction — reads presenter cards only.
 */
export function buildEngineRecommendationRecord(input: {
  dateKst: string;
  predictionHash: string;
  snapshotCreatedAt: string;
  generatedBeforeGame: boolean;
  predictionContract: string;
  deliveredAt?: string;
  strongPicks: DailyPickCard[];
  goodPicks: DailyPickCard[];
}): EngineRecommendationRecordV1 {
  const deliveredAt = input.deliveredAt ?? new Date().toISOString();
  const picks = [...input.strongPicks, ...input.goodPicks]
    .filter((c) => c.tier === "STRONG" || c.tier === "GOOD")
    .map((c) => ({
      date: input.dateKst,
      gamePk: c.gamePk,
      gameId: c.gameId,
      pick: c.pickTeam,
      tier: c.tier as "STRONG" | "GOOD",
      // Contract: selected-pick win % (from DailyPickCard.modelProbabilityPercent)
      probability: c.modelProbabilityPercent,
      confidence: c.confidence,
      sourceType: "ENGINE_SNAPSHOT" as const,
      predictionHash: input.predictionHash,
      snapshotCreatedAt: input.snapshotCreatedAt,
      deliveredAt,
      researchOnly: c.researchOnly,
      inputStatus: null as string | null,
      pickSide: c.pickSide,
      matchupLine: c.matchupLine,
    }));

  return {
    schemaVersion: "yang-edge-engine-recommendation-record-v1",
    dateKst: input.dateKst,
    predictionHash: input.predictionHash,
    snapshotCreatedAt: input.snapshotCreatedAt,
    deliveredAt,
    generatedBeforeGame: input.generatedBeforeGame,
    predictionContract: input.predictionContract,
    sourceType: "ENGINE_SNAPSHOT",
    picks,
  };
}

/**
 * Idempotent seal: write once. Never overwrites existing record (immutable).
 * Never mutates Prediction artifacts.
 */
export async function sealEngineRecommendationRecordIfAbsent(input: {
  dateKst: string;
  cwd?: string;
  record: EngineRecommendationRecordV1;
}): Promise<{ wrote: boolean; pathRel: string; record: EngineRecommendationRecordV1 }> {
  const cwd = input.cwd ?? process.cwd();
  const pathRel = engineRecommendationRecordRel(input.dateKst);
  const abs = path.join(cwd, pathRel);
  const existing = await loadEngineRecommendationRecord({
    dateKst: input.dateKst,
    cwd,
  });
  if (existing) {
    return { wrote: false, pathRel, record: existing };
  }
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(input.record, null, 2)}\n`, "utf8");
  return { wrote: true, pathRel, record: input.record };
}
