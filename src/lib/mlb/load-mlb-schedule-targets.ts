/**
 * MLB schedule-first game targets for research collectors.
 * Prediction snapshot is optional enrichment only.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildGameId } from "../game-id";
import { instantToKst } from "../datetime/kst";
import {
  extractScheduleWithProbables,
  joinPredictionToSchedule,
  type ScheduleProbableGame,
} from "./build-starter-dataset";
import {
  getRawStatsJson,
  type CacheUsageStats,
} from "./research-stats-cache";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
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

function roundOdds(n: number | null): number | null {
  if (n == null) return null;
  return Math.round(n * 1000) / 1000;
}

/** Hash used when no prediction snapshot is present. */
export const EMPTY_PREDICTION_HASH = sha256("");

export type MlbScheduleGameTarget = {
  gameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string | null;
  commenceTimeUtc: string;
  scheduleGame: ScheduleProbableGame;
  predictionMatched: boolean;
};

export type MlbOptionalPredictionEntry = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string | null;
  baselinePick: string | null;
  openingOdds: number | null;
  latestOdds: number | null;
  marketProbability: number | null;
  predictedAt: string | null;
};

export type MlbOptionalPredictionSnapshot = {
  raw: string;
  hash: string;
  predictedAt: string | null;
  entries: MlbOptionalPredictionEntry[];
  byGameId: Map<string, MlbOptionalPredictionEntry>;
};

export function parseOptionalPredictionSnapshot(
  predictionRaw: string,
  dateKst: string,
): MlbOptionalPredictionSnapshot {
  const hash = sha256(predictionRaw);
  const root = JSON.parse(predictionRaw) as {
    meta?: Record<string, unknown>;
    predictions?: unknown[];
  };
  const predictedAt =
    asString(asRecord(root.meta)?.predictedAt) ??
    asString(asRecord(root.meta)?.generatedAt);

  const entries: MlbOptionalPredictionEntry[] = [];
  const byGameId = new Map<string, MlbOptionalPredictionEntry>();

  for (const raw of root.predictions ?? []) {
    const row = asRecord(raw);
    if (!row) continue;
    if (asString(row.dateKst) !== dateKst) continue;
    const gameId = asString(row.gameId);
    if (!gameId) continue;

    const entry: MlbOptionalPredictionEntry = {
      gameId,
      homeTeam: asString(row.homeTeam) ?? "",
      awayTeam: asString(row.awayTeam) ?? "",
      startTimeKst: asString(row.startTimeKst),
      baselinePick: asString(row.baselinePick),
      openingOdds: roundOdds(asNumber(row.openingOdds)),
      latestOdds: roundOdds(asNumber(row.latestOdds)),
      marketProbability: asNumber(row.marketProbability),
      predictedAt: asString(row.predictedAt) ?? predictedAt,
    };
    entries.push(entry);
    byGameId.set(gameId, entry);
  }

  entries.sort((a, b) => a.gameId.localeCompare(b.gameId));

  return {
    raw: predictionRaw,
    hash,
    predictedAt,
    entries,
    byGameId,
  };
}

export async function readOptionalPredictionSnapshot(
  dateKst: string,
): Promise<MlbOptionalPredictionSnapshot | null> {
  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${dateKst}.json`,
  );
  try {
    const raw = await readFile(predPath, "utf8");
    return parseOptionalPredictionSnapshot(raw, dateKst);
  } catch {
    return null;
  }
}

export async function fetchMlbScheduleForDateKst(
  dateKst: string,
  usage: CacheUsageStats,
): Promise<ScheduleProbableGame[]> {
  const prevMs =
    Date.parse(`${dateKst}T12:00:00+09:00`) - 24 * 60 * 60 * 1000;
  const prevDate =
    instantToKst(new Date(prevMs).toISOString())?.date ?? dateKst;
  const hydrate = encodeURIComponent("probablePitcher");
  const scheduleBody = await getRawStatsJson(
    `/api/v1/schedule?sportId=1&startDate=${prevDate}&endDate=${dateKst}&hydrate=${hydrate}`,
    usage,
  );
  return extractScheduleWithProbables(scheduleBody).filter(
    (g) => instantToKst(g.commenceTimeUtc)?.date === dateKst,
  );
}

export function findPredictionForScheduleGame(
  scheduleGame: ScheduleProbableGame,
  dateKst: string,
  entries: MlbOptionalPredictionEntry[],
): MlbOptionalPredictionEntry | null {
  for (const entry of entries) {
    const join = joinPredictionToSchedule({
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      startTimeKst: entry.startTimeKst,
      dateKst,
      schedule: [scheduleGame],
    });
    if (join.quality === "MATCHED") return entry;
  }
  return null;
}

export function buildMlbScheduleGameTargets(
  dateKst: string,
  scheduleAll: ScheduleProbableGame[],
  prediction: MlbOptionalPredictionSnapshot | null,
): MlbScheduleGameTarget[] {
  const targets: MlbScheduleGameTarget[] = [];

  for (const scheduleGame of scheduleAll) {
    const homeTeam = scheduleGame.homeTeam;
    const awayTeam = scheduleGame.awayTeam;
    const kst = instantToKst(scheduleGame.commenceTimeUtc);
    const startTimeKst = kst?.time?.slice(0, 5) ?? null;
    const matched = prediction
      ? findPredictionForScheduleGame(
          scheduleGame,
          dateKst,
          prediction.entries,
        )
      : null;

    targets.push({
      gameId: matched?.gameId ?? buildGameId("MLB", homeTeam, awayTeam),
      gamePk: scheduleGame.gamePk,
      homeTeam,
      awayTeam,
      startTimeKst,
      commenceTimeUtc: scheduleGame.commenceTimeUtc,
      scheduleGame,
      predictionMatched: matched != null,
    });
  }

  return targets.sort((a, b) => a.gameId.localeCompare(b.gameId));
}
