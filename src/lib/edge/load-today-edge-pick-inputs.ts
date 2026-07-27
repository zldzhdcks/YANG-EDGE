import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assessBullpenGame,
  assessInjuryRows,
  assessLineupRows,
  assessOddsRow,
  assessStarterRows,
  assessTravelRows,
  assessWeatherRow,
  type CollectionStatus,
  type DatasetKey,
  hasStarterIdentity,
} from "@/lib/edge/dataset-presence";
import {
  findNextScheduledSnapshotDate,
  resolveUpcomingEdgeSlate,
  type EdgeSlateStatus,
} from "@/lib/edge/resolve-upcoming-edge-slate";
import type { TodayEdgePickCandidateInput } from "@/lib/edge/select-today-edge-picks";

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
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

async function readJson(rel: string): Promise<unknown | null> {
  try {
    return JSON.parse(
      await readFile(
        path.join(/*turbopackIgnore: true*/ process.cwd(), rel),
        "utf8",
      ),
    ) as unknown;
  } catch {
    return null;
  }
}

function groupRowsByGame(rows: unknown[]): Map<string, unknown[]> {
  const map = new Map<string, unknown[]>();
  for (const raw of rows) {
    const gid = asString(asRecord(raw)?.gameId);
    if (!gid) continue;
    const list = map.get(gid) ?? [];
    list.push(raw);
    map.set(gid, list);
  }
  return map;
}

type DatasetBundle = {
  starterByGame: Map<string, unknown[]>;
  bullpenByGame: Map<string, Record<string, unknown>>;
  lineupByGame: Map<string, unknown[]>;
  weatherByGame: Map<string, Record<string, unknown>>;
  travelByGame: Map<string, unknown[]>;
  oddsByGame: Map<string, Record<string, unknown>>;
  injuryByGame: Map<string, unknown[]>;
};

async function loadDatasetBundle(dateKst: string): Promise<DatasetBundle> {
  const starterDoc = asRecord(
    await readJson(`data/research/mlb/${dateKst}-starter-dataset-v1.json`),
  );
  const bullpenDoc = asRecord(
    await readJson(
      `data/research/mlb/${dateKst}-bullpen-role-dataset-v1_1.json`,
    ),
  );
  const lineupDoc = asRecord(
    await readJson(`data/research/mlb/${dateKst}-lineup-dataset-v1.json`),
  );
  const weatherDoc = asRecord(
    await readJson(`data/research/mlb/${dateKst}-weather-dataset-v1.json`),
  );
  const travelDoc = asRecord(
    await readJson(`data/research/mlb/${dateKst}-travel-rest-dataset-v1.json`),
  );
  const oddsDoc = asRecord(
    await readJson(`data/research/mlb/${dateKst}-odds-history-dataset-v1.json`),
  );
  const injuryDoc = asRecord(
    await readJson(`data/research/mlb/${dateKst}-injury-dataset-v1.json`),
  );

  const starterByGame = groupRowsByGame(
    (starterDoc?.rows as unknown[]) ?? [],
  );
  const lineupByGame = groupRowsByGame((lineupDoc?.rows as unknown[]) ?? []);
  const travelByGame = groupRowsByGame((travelDoc?.rows as unknown[]) ?? []);
  const injuryByGame = groupRowsByGame((injuryDoc?.rows as unknown[]) ?? []);

  const bullpenByGame = new Map<string, Record<string, unknown>>();
  for (const raw of (bullpenDoc?.games as unknown[]) ?? []) {
    const g = asRecord(raw);
    const gid = asString(g?.gameId);
    if (gid && g) bullpenByGame.set(gid, g);
  }

  const weatherByGame = new Map<string, Record<string, unknown>>();
  for (const raw of (weatherDoc?.rows as unknown[]) ?? []) {
    const r = asRecord(raw);
    const gid = asString(r?.gameId);
    if (gid && r) weatherByGame.set(gid, r);
  }

  const oddsByGame = new Map<string, Record<string, unknown>>();
  for (const raw of (oddsDoc?.rows as unknown[]) ?? []) {
    const r = asRecord(raw);
    const gid = asString(r?.gameId);
    if (gid && r) oddsByGame.set(gid, r);
  }

  return {
    starterByGame,
    bullpenByGame,
    lineupByGame,
    weatherByGame,
    travelByGame,
    oddsByGame,
    injuryByGame,
  };
}

function assessGameDatasets(
  gameId: string,
  bundle: DatasetBundle,
): Record<DatasetKey, CollectionStatus> {
  const starterRows = bundle.starterByGame.get(gameId) ?? [];
  const starterStatus = assessStarterRows(starterRows);

  return {
    starter: starterStatus,
    bullpen: assessBullpenGame(bundle.bullpenByGame.get(gameId) ?? null),
    lineup: assessLineupRows(bundle.lineupByGame.get(gameId) ?? []),
    weather: assessWeatherRow(bundle.weatherByGame.get(gameId) ?? null),
    travel: assessTravelRows(bundle.travelByGame.get(gameId) ?? []),
    odds: assessOddsRow(bundle.oddsByGame.get(gameId) ?? null),
    injury: assessInjuryRows(
      bundle.injuryByGame.get(gameId) ?? [],
      starterStatus,
    ),
  };
}

export type LoadedTodayEdgePickInputs = {
  dateKst: string;
  candidates: TodayEdgePickCandidateInput[];
  predictionHashSha256: string | null;
  slateStatus: EdgeSlateStatus;
  nextScheduledDateKst: string | null;
  upcomingGameCount: number;
};

export type LoadTodayEdgePickOptions = {
  /** verification script 전용 */
  forceDateKst?: string;
  now?: Date;
};

export async function loadTodayEdgePickInputs(
  options: LoadTodayEdgePickOptions = {},
): Promise<LoadedTodayEdgePickInputs | null> {
  const slate = await resolveUpcomingEdgeSlate({
    now: options.now,
    forceDateKst: options.forceDateKst,
  });

  const resolvedDate =
    options.forceDateKst?.trim() ??
    slate.targetDateKst ??
    null;

  if (!resolvedDate) {
    const nextScheduledDateKst =
      slate.nextScheduledDateKst ??
      (await findNextScheduledSnapshotDate(options.now));
    return {
      dateKst: "",
      candidates: [],
      predictionHashSha256: null,
      slateStatus: "NO_UPCOMING_SNAPSHOT",
      nextScheduledDateKst,
      upcomingGameCount: 0,
    };
  }

  const predictionRel = `data/predictions/mlb/${resolvedDate}.json`;
  let predictionRaw: string;
  try {
    predictionRaw = await readFile(
      path.join(/*turbopackIgnore: true*/ process.cwd(), predictionRel),
      "utf8",
    );
  } catch {
    return null;
  }

  const predictionDoc = asRecord(JSON.parse(predictionRaw));
  if (!predictionDoc) return null;

  const meta = asRecord(predictionDoc.meta);
  const predictions = Array.isArray(predictionDoc.predictions)
    ? predictionDoc.predictions
    : [];
  const bundle = await loadDatasetBundle(resolvedDate);

  const candidates: TodayEdgePickCandidateInput[] = [];

  for (const raw of predictions) {
    const pred = asRecord(raw);
    if (!pred) continue;
    const gameId = asString(pred.gameId);
    if (!gameId) continue;

    candidates.push({
      prediction: {
        gameId,
        dateKst: asString(pred.dateKst) ?? resolvedDate,
        startTimeKst: asString(pred.startTimeKst) ?? "",
        league: asString(pred.league) ?? "MLB",
        homeTeam: asString(pred.homeTeam) ?? "?",
        awayTeam: asString(pred.awayTeam) ?? "?",
        baselinePick: asString(pred.baselinePick) ?? "?",
        confidence: asNumber(pred.confidence) ?? 0,
        modelProbability: asNumber(pred.modelProbability),
        edgeScore: asNumber(pred.edgeScore),
        valueEdge: asNumber(pred.valueEdge),
        dataAvailability: asNumber(pred.dataAvailability),
        baselineStatus: asString(pred.baselineStatus) ?? "PASS",
        snapshotIntegrity: asString(pred.snapshotIntegrity) ?? "UNVERIFIED",
        pitcherDirection: asString(pred.pitcherDirection),
        integrityWarnings: asStringArray(pred.integrityWarnings),
        missingFactors: asStringArray(pred.missingFactors),
        predictedAt: asString(pred.predictedAt) ?? "",
        resultStatus: asString(pred.resultStatus) ?? "pending",
      },
      datasets: assessGameDatasets(gameId, bundle),
      hasStarterIdentity: hasStarterIdentity(
        bundle.starterByGame.get(gameId) ?? [],
      ),
    });
  }

  candidates.sort((a, b) =>
    a.prediction.gameId.localeCompare(b.prediction.gameId),
  );

  const predictionHashSha256 =
    asString(meta?.predictionHashSha256) ??
    createHash("sha256").update(predictionRaw, "utf8").digest("hex");

  return {
    dateKst: resolvedDate,
    candidates,
    predictionHashSha256,
    slateStatus:
      slate.upcomingGameCount > 0 || !options.forceDateKst
        ? slate.slateStatus === "UPCOMING"
          ? "UPCOMING"
          : "NO_UPCOMING_SNAPSHOT"
        : "NO_UPCOMING_SNAPSHOT",
    nextScheduledDateKst: slate.nextScheduledDateKst ?? resolvedDate,
    upcomingGameCount: slate.upcomingGameCount,
  };
}
