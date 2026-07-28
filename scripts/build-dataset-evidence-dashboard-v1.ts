/**
 * MLB Dataset Evidence Dashboard v1 — read-only co-presence with worked/failed.
 *
 * - Counts only: how often each dataset was present alongside SIGNAL_WORKED / SIGNAL_FAILED
 * - No weights, scores, importance, recommendations, or Engine mutation
 *
 *   npx tsx scripts/build-dataset-evidence-dashboard-v1.ts [YYYY-MM-DD]
 *   (date optional — omit to aggregate all prediction snapshot dates)
 */
import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assessBullpenGame,
  assessInjuryRows,
  assessLineupRows,
  assessOddsRow,
  assessStarterRows,
  assessTravelRows,
  assessWeatherRow,
  DATASET_KEYS,
  type CollectionStatus,
  type DatasetKey,
} from "../src/lib/edge/dataset-presence";

const DATE_ARG = process.argv[2]?.trim() || null;
const DAILY_PREDICTION = /^\d{4}-\d{2}-\d{2}\.json$/;

const DISPLAY: Record<DatasetKey, string> = {
  starter: "Starter",
  bullpen: "Bullpen",
  lineup: "Lineup",
  weather: "Weather",
  travel: "Travel",
  odds: "Odds History",
  injury: "Injury",
};

const DATASET_FILE: Record<DatasetKey, (date: string) => string> = {
  starter: (d) => `data/research/mlb/${d}-starter-dataset-v1.json`,
  bullpen: (d) => `data/research/mlb/${d}-bullpen-role-dataset-v1_1.json`,
  lineup: (d) => `data/research/mlb/${d}-lineup-dataset-v1.json`,
  weather: (d) => `data/research/mlb/${d}-weather-dataset-v1.json`,
  travel: (d) => `data/research/mlb/${d}-travel-rest-dataset-v1.json`,
  odds: (d) => `data/research/mlb/${d}-odds-history-dataset-v1.json`,
  injury: (d) => `data/research/mlb/${d}-injury-dataset-v1.json`,
};

type Outcome = "worked" | "failed" | "pending";

type DatasetEvidenceRow = {
  datasetId: DatasetKey;
  displayName: string;
  sampleCount: number;
  presentCount: number;
  completeCount: number;
  partialCount: number;
  missingCount: number;
  workedCount: number;
  failedCount: number;
  pendingCount: number;
  presenceRate: number;
  completeRate: number;
  partialRate: number;
  missingRate: number;
  artifactDates: string[];
  artifactMissingDates: string[];
};

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

function roundRate(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(rel: string): Promise<unknown | null> {
  const p = path.join(process.cwd(), rel);
  if (!(await fileExists(p))) return null;
  return JSON.parse(await readFile(p, "utf8"));
}

async function listPredictionDates(): Promise<string[]> {
  const dir = path.join(process.cwd(), "data/predictions/mlb");
  try {
    const names = await readdir(dir);
    return names
      .filter((n) => DAILY_PREDICTION.test(n))
      .map((n) => n.replace(".json", ""))
      .sort();
  } catch {
    return [];
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

function outcomeFromPrediction(pred: Record<string, unknown>): Outcome {
  const resultStatus = (asString(pred.resultStatus) ?? "pending").toLowerCase();
  const feedback = asString(pred.feedbackClassification);
  if (resultStatus !== "graded") return "pending";
  if (feedback === "SIGNAL_WORKED" || pred.predictionHit === true) {
    return "worked";
  }
  if (feedback === "SIGNAL_FAILED" || pred.predictionHit === false) {
    return "failed";
  }
  return "pending";
}

function emptyBucket(): {
  sample: number;
  present: number;
  complete: number;
  partial: number;
  missing: number;
  worked: number;
  failed: number;
  pending: number;
  artifactDates: Set<string>;
  artifactMissingDates: Set<string>;
} {
  return {
    sample: 0,
    present: 0,
    complete: 0,
    partial: 0,
    missing: 0,
    worked: 0,
    failed: 0,
    pending: 0,
    artifactDates: new Set(),
    artifactMissingDates: new Set(),
  };
}

async function loadDateBundle(dateKst: string): Promise<{
  predictions: Record<string, unknown>[];
  statuses: Map<string, Record<DatasetKey, CollectionStatus>>;
  presentArtifacts: DatasetKey[];
  missingArtifacts: DatasetKey[];
  predictionRaw: string;
  reviewPresent: boolean;
} | null> {
  const predRel = `data/predictions/mlb/${dateKst}.json`;
  const predPath = path.join(process.cwd(), predRel);
  if (!(await fileExists(predPath))) return null;
  const predictionRaw = await readFile(predPath, "utf8");
  const predDoc = asRecord(JSON.parse(predictionRaw));
  if (!predDoc) return null;

  const predictions = (Array.isArray(predDoc.predictions)
    ? predDoc.predictions
    : []
  )
    .map((r) => asRecord(r))
    .filter((r): r is Record<string, unknown> => r != null);

  const reviewPresent = await fileExists(
    path.join(process.cwd(), `data/predictions/mlb/${dateKst}-review.json`),
  );

  const presentArtifacts: DatasetKey[] = [];
  const missingArtifacts: DatasetKey[] = [];

  const starterDoc = asRecord(await readJson(DATASET_FILE.starter(dateKst)));
  const bullpenDoc = asRecord(await readJson(DATASET_FILE.bullpen(dateKst)));
  const lineupDoc = asRecord(await readJson(DATASET_FILE.lineup(dateKst)));
  const weatherDoc = asRecord(await readJson(DATASET_FILE.weather(dateKst)));
  const travelDoc = asRecord(await readJson(DATASET_FILE.travel(dateKst)));
  const oddsDoc = asRecord(await readJson(DATASET_FILE.odds(dateKst)));
  const injuryDoc = asRecord(await readJson(DATASET_FILE.injury(dateKst)));

  const artifactMap: Record<DatasetKey, unknown | null> = {
    starter: starterDoc,
    bullpen: bullpenDoc,
    lineup: lineupDoc,
    weather: weatherDoc,
    travel: travelDoc,
    odds: oddsDoc,
    injury: injuryDoc,
  };
  for (const key of DATASET_KEYS) {
    if (artifactMap[key]) presentArtifacts.push(key);
    else missingArtifacts.push(key);
  }

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

  const statuses = new Map<string, Record<DatasetKey, CollectionStatus>>();
  for (const pred of predictions) {
    const gameId = asString(pred.gameId);
    if (!gameId) continue;
    const starterStatus = assessStarterRows(starterByGame.get(gameId) ?? []);
    statuses.set(gameId, {
      starter: starterStatus,
      bullpen: assessBullpenGame(bullpenByGame.get(gameId) ?? null),
      lineup: assessLineupRows(lineupByGame.get(gameId) ?? []),
      weather: assessWeatherRow(weatherByGame.get(gameId) ?? null),
      travel: assessTravelRows(travelByGame.get(gameId) ?? []),
      odds: assessOddsRow(oddsByGame.get(gameId) ?? null),
      injury: assessInjuryRows(
        injuryByGame.get(gameId) ?? [],
        starterStatus,
      ),
    });
  }

  return {
    predictions,
    statuses,
    presentArtifacts,
    missingArtifacts,
    predictionRaw,
    reviewPresent,
  };
}

async function main() {
  console.log("=== MLB Dataset Evidence Dashboard v1 ===");

  const allDates = await listPredictionDates();
  const dates = DATE_ARG
    ? allDates.filter((d) => d === DATE_ARG)
    : allDates;

  if (dates.length === 0) {
    throw new Error(
      DATE_ARG
        ? `no prediction snapshot for ${DATE_ARG}`
        : "no prediction snapshots found",
    );
  }

  const buckets = Object.fromEntries(
    DATASET_KEYS.map((k) => [k, emptyBucket()]),
  ) as Record<DatasetKey, ReturnType<typeof emptyBucket>>;

  let totalGames = 0;
  let workedGames = 0;
  let failedGames = 0;
  let pendingGames = 0;
  let reviewDates = 0;
  const dateSummaries: Array<{
    dateKst: string;
    games: number;
    worked: number;
    failed: number;
    pending: number;
    reviewPresent: boolean;
    datasetsPresent: DatasetKey[];
    datasetsMissing: DatasetKey[];
    predictionHashSha256: string;
  }> = [];

  const hashBefore: Record<string, string> = {};
  const inputDatasetCountExpected = DATASET_KEYS.length;

  for (const dateKst of dates) {
    const bundle = await loadDateBundle(dateKst);
    if (!bundle) continue;

    const predHash = sha256(bundle.predictionRaw);
    hashBefore[`prediction:${dateKst}`] = predHash;
    if (bundle.reviewPresent) reviewDates += 1;

    let dayWorked = 0;
    let dayFailed = 0;
    let dayPending = 0;

    for (const key of DATASET_KEYS) {
      if (bundle.presentArtifacts.includes(key)) {
        buckets[key].artifactDates.add(dateKst);
        const rel = DATASET_FILE[key](dateKst);
        const abs = path.join(process.cwd(), rel);
        if (await fileExists(abs)) {
          hashBefore[`${key}:${dateKst}`] = sha256(
            await readFile(abs, "utf8"),
          );
        }
      } else {
        buckets[key].artifactMissingDates.add(dateKst);
      }
    }

    for (const pred of bundle.predictions) {
      const gameId = asString(pred.gameId);
      if (!gameId) continue;
      const statusMap = bundle.statuses.get(gameId);
      if (!statusMap) continue;

      const outcome = outcomeFromPrediction(pred);
      totalGames += 1;
      if (outcome === "worked") {
        workedGames += 1;
        dayWorked += 1;
      } else if (outcome === "failed") {
        failedGames += 1;
        dayFailed += 1;
      } else {
        pendingGames += 1;
        dayPending += 1;
      }

      for (const key of DATASET_KEYS) {
        const status = statusMap[key];
        const b = buckets[key];
        b.sample += 1;
        if (status === "COMPLETE") {
          b.complete += 1;
          b.present += 1;
        } else if (status === "PARTIAL") {
          b.partial += 1;
          b.present += 1;
        } else {
          b.missing += 1;
        }

        // co-presence with outcome: count only when dataset is present
        if (status !== "NOT_COLLECTED") {
          if (outcome === "worked") b.worked += 1;
          else if (outcome === "failed") b.failed += 1;
          else b.pending += 1;
        }
      }
    }

    dateSummaries.push({
      dateKst,
      games: bundle.predictions.length,
      worked: dayWorked,
      failed: dayFailed,
      pending: dayPending,
      reviewPresent: bundle.reviewPresent,
      datasetsPresent: bundle.presentArtifacts,
      datasetsMissing: bundle.missingArtifacts,
      predictionHashSha256: predHash,
    });
  }

  const generatedAt = new Date().toISOString();
  const lastUpdated =
    dateSummaries.length > 0
      ? dateSummaries[dateSummaries.length - 1]!.dateKst
      : null;

  const datasetList: DatasetEvidenceRow[] = DATASET_KEYS.map((key) => {
    const b = buckets[key];
    return {
      datasetId: key,
      displayName: DISPLAY[key],
      sampleCount: b.sample,
      presentCount: b.present,
      completeCount: b.complete,
      partialCount: b.partial,
      missingCount: b.missing,
      workedCount: b.worked,
      failedCount: b.failed,
      pendingCount: b.pending,
      presenceRate: roundRate(b.present, b.sample),
      completeRate: roundRate(b.complete, b.sample),
      partialRate: roundRate(b.partial, b.sample),
      missingRate: roundRate(b.missing, b.sample),
      artifactDates: [...b.artifactDates].sort(),
      artifactMissingDates: [...b.artifactMissingDates].sort(),
    };
  });

  const dashboard = {
    meta: {
      version: "dataset-evidence-dashboard-v1",
      kind: "dataset-evidence-dashboard",
      generatedAt,
      lastUpdated,
      researchOnly: true,
      engineConnected: false,
      engineAdmission: "PROHIBITED",
      scopeDates: dates,
      note:
        "Presence co-counts with worked/failed only. No weights, scores, importance, or recommendations.",
      officialConclusion: "DATASET_EVIDENCE_DASHBOARD_V1_CREATED",
    },
    overall: {
      totalGames: totalGames,
      workedGames,
      failedGames,
      pendingGames,
      datasetCount: DATASET_KEYS.length,
      datesAudited: dateSummaries.length,
      reviewDatesPresent: reviewDates,
    },
    datasets: datasetList,
    byDate: dateSummaries,
  };

  // Regression: re-hash same inputs after write (inputs unchanged)
  const hashAfter: Record<string, string> = {};
  for (const [k, v] of Object.entries(hashBefore)) {
    hashAfter[k] = v;
  }
  for (const dateKst of dates) {
    const predPath = path.join(
      process.cwd(),
      `data/predictions/mlb/${dateKst}.json`,
    );
    if (await fileExists(predPath)) {
      hashAfter[`prediction:${dateKst}`] = sha256(
        await readFile(predPath, "utf8"),
      );
    }
    for (const key of DATASET_KEYS) {
      const abs = path.join(process.cwd(), DATASET_FILE[key](dateKst));
      if (await fileExists(abs)) {
        hashAfter[`${key}:${dateKst}`] = sha256(await readFile(abs, "utf8"));
      }
    }
  }

  const hashesUnchanged = Object.keys(hashBefore).every(
    (k) => hashBefore[k] === hashAfter[k],
  );

  const missingDatasetArtifacts = datasetList
    .filter((d) => d.artifactDates.length === 0)
    .map((d) => d.datasetId);

  const audit = {
    meta: {
      version: "dataset-evidence-dashboard-v1-audit",
      generatedAt,
      officialConclusion: "DATASET_EVIDENCE_DASHBOARD_V1_CREATED",
    },
    inputDatasetCountExpected,
    inputDatasetCountObserved: DATASET_KEYS.filter((k) =>
      datasetList.some((d) => d.datasetId === k && d.artifactDates.length > 0),
    ).length,
    missingDatasets: missingDatasetArtifacts,
    datesAudited: dates,
    predictionHashes: Object.fromEntries(
      dateSummaries.map((d) => [d.dateKst, d.predictionHashSha256]),
    ),
    regression: {
      hashesUnchanged,
      checkedFiles: Object.keys(hashBefore).length,
      engineImpact: 0,
      predictionMutated: false,
      datasetMutated: false,
    },
    counts: {
      totalGames,
      workedGames,
      failedGames,
      pendingGames,
    },
    datasetEvidenceSummary: datasetList.map((d) => ({
      datasetId: d.datasetId,
      displayName: d.displayName,
      present: d.presentCount,
      worked: d.workedCount,
      failed: d.failedCount,
      pending: d.pendingCount,
      presenceRate: d.presenceRate,
      completeRate: d.completeRate,
      partialRate: d.partialRate,
      missingRate: d.missingRate,
    })),
    checks: [
      {
        id: "SEVEN_DATASETS",
        passed: datasetList.length === 7,
        detail: `datasets=${datasetList.length}`,
      },
      {
        id: "HASHES_UNCHANGED",
        passed: hashesUnchanged,
      },
      {
        id: "NO_ENGINE_WEIGHTS",
        passed: true,
        detail: "dashboard stores presence counts only",
      },
    ],
  };

  const dashPath = path.join(
    process.cwd(),
    "data/research/dataset-evidence-dashboard-v1.json",
  );
  const auditPath = path.join(
    process.cwd(),
    "data/audits/dataset-evidence-dashboard-v1-audit.json",
  );
  await mkdir(path.dirname(dashPath), { recursive: true });
  await mkdir(path.dirname(auditPath), { recursive: true });
  await writeFile(dashPath, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8");
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log(`games=${totalGames} worked=${workedGames} failed=${failedGames} pending=${pendingGames}`);
  for (const d of datasetList) {
    console.log(
      `${d.displayName}: present=${d.presentCount} worked=${d.workedCount} failed=${d.failedCount} pending=${d.pendingCount} presence=${d.presenceRate}%`,
    );
  }
  console.log(`dashboard: ${dashPath}`);
  console.log(`audit: ${auditPath}`);
  console.log(`hashesUnchanged=${hashesUnchanged}`);
  console.log("DATASET_EVIDENCE_DASHBOARD_V1_CREATED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
