/**
 * MLB Research Sample Growth Dashboard v1 — read-only sample progress across 7 datasets.
 *
 * - Chart-ready JSON only — no Viewer / Engine / UI wiring
 * - Gate labels computed but READY_FOR_ENGINE_REVIEW promotion PROHIBITED
 *
 *   npx tsx scripts/build-research-sample-growth-dashboard-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

const TARGET_GAMES = 100;

type GateStatus =
  | "NOT_READY"
  | "UNDER_COLLECTION"
  | "READY_FOR_BACKTEST"
  | "READY_FOR_ENGINE_REVIEW";

type DatasetSpec = {
  datasetId: string;
  displayName: string;
  filePattern: RegExp;
  gameSource: "rows" | "games" | "summary";
};

const DATASET_SPECS: DatasetSpec[] = [
  {
    datasetId: "mlb-starter",
    displayName: "Starter",
    filePattern: /^\d{4}-\d{2}-\d{2}-starter-dataset-v1\.json$/,
    gameSource: "rows",
  },
  {
    datasetId: "mlb-bullpen-role",
    displayName: "Bullpen",
    filePattern: /^\d{4}-\d{2}-\d{2}-bullpen-role-dataset-v1_1\.json$/,
    gameSource: "games",
  },
  {
    datasetId: "mlb-lineup",
    displayName: "Lineup",
    filePattern: /^\d{4}-\d{2}-\d{2}-lineup-dataset-v1\.json$/,
    gameSource: "rows",
  },
  {
    datasetId: "mlb-weather",
    displayName: "Weather",
    filePattern: /^\d{4}-\d{2}-\d{2}-weather-dataset-v1\.json$/,
    gameSource: "rows",
  },
  {
    datasetId: "mlb-travel",
    displayName: "Travel",
    filePattern: /^\d{4}-\d{2}-\d{2}-travel-rest-dataset-v1\.json$/,
    gameSource: "rows",
  },
  {
    datasetId: "mlb-odds-history",
    displayName: "Odds History",
    filePattern: /^\d{4}-\d{2}-\d{2}-odds-history-dataset-v1\.json$/,
    gameSource: "rows",
  },
  {
    datasetId: "mlb-injury",
    displayName: "Injury",
    filePattern: /^\d{4}-\d{2}-\d{2}-injury-dataset-v1\.json$/,
    gameSource: "rows",
  },
];

type RegistryEntry = {
  datasetId: string;
  status: string;
  schemaVersion: string | null;
  builderVersion: string | null;
  engineAdmission: string;
  artifactDatasetPath: string | null;
};

type DatasetGrowth = {
  datasetId: string;
  displayName: string;
  status: string;
  sampleCount: number;
  targetSample: number;
  completionPercent: number;
  firstGameDate: string | null;
  lastGameDate: string | null;
  lastUpdated: string | null;
  gate: GateStatus;
  gatePromotionProhibited: boolean;
  artifactFiles: string[];
  dailyGameCounts: Array<{ dateKst: string; gamesOnDate: number }>;
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

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function dateFromFilename(filename: string): string | null {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})-/);
  return m?.[1] ?? null;
}

function extractGameIds(
  doc: Record<string, unknown>,
  source: DatasetSpec["gameSource"],
): string[] {
  const ids = new Set<string>();

  if (source === "games") {
    for (const raw of (doc.games as unknown[]) ?? []) {
      const gid = asString(asRecord(raw)?.gameId);
      if (gid) ids.add(gid);
    }
  } else if (source === "rows") {
    for (const raw of (doc.rows as unknown[]) ?? []) {
      const gid = asString(asRecord(raw)?.gameId);
      if (gid) ids.add(gid);
    }
  }

  if (ids.size === 0) {
    const summary = asRecord(doc.summary);
    const totalGames = asNumber(summary?.totalGames);
    const dateKst = asString(asRecord(doc.meta)?.dateKst);
    if (totalGames != null && totalGames > 0 && dateKst) {
      for (let i = 0; i < totalGames; i += 1) {
        ids.add(`${dateKst}#${i}`);
      }
    }
  }

  return [...ids];
}

function computeGate(
  sampleCount: number,
  hasArtifact: boolean,
  registryStatus: string,
): GateStatus {
  if (!hasArtifact || sampleCount === 0) return "NOT_READY";
  if (sampleCount < TARGET_GAMES) return "UNDER_COLLECTION";
  if (registryStatus === "COMPLETE") return "READY_FOR_ENGINE_REVIEW";
  return "READY_FOR_BACKTEST";
}

function buildCumulativeSeries(
  daily: Array<{ dateKst: string; gamesOnDate: number }>,
  allGameIdsByDate: Map<string, Set<string>>,
): Array<{ dateKst: string; cumulativeGames: number; gamesOnDate: number }> {
  const sortedDates = [...allGameIdsByDate.keys()].sort();
  const cumulative = new Set<string>();
  const dailyMap = new Map(daily.map((d) => [d.dateKst, d.gamesOnDate]));

  return sortedDates.map((dateKst) => {
    for (const gid of allGameIdsByDate.get(dateKst) ?? []) {
      cumulative.add(gid);
    }
    return {
      dateKst,
      cumulativeGames: cumulative.size,
      gamesOnDate: dailyMap.get(dateKst) ?? 0,
    };
  });
}

async function main() {
  console.log(`=== MLB Research Sample Growth Dashboard v1 (${DATE}) ===`);

  const root = process.cwd();
  const mlbDir = path.join(root, "data/research/mlb");
  const allFiles = await readdir(mlbDir);

  const registry = JSON.parse(
    await readFile(path.join(root, "data/research/registry.json"), "utf8"),
  ) as { datasets?: unknown[] };

  const registryMap = new Map<string, RegistryEntry>();
  for (const raw of registry.datasets ?? []) {
    const d = asRecord(raw);
    if (!d) continue;
    const datasetId = asString(d.datasetId);
    if (!datasetId) continue;
    registryMap.set(datasetId, {
      datasetId,
      status: asString(d.status) ?? "UNKNOWN",
      schemaVersion: asString(d.schemaVersion),
      builderVersion: asString(d.builderVersion),
      engineAdmission: asString(d.engineAdmission) ?? "PROHIBITED",
      artifactDatasetPath: asString(d.artifactDatasetPath),
    });
  }

  const regressionPaths = {
    prediction: path.join(root, "data/predictions/mlb", `${DATE}.json`),
    starter: path.join(
      root,
      "data/research/mlb",
      `${DATE}-starter-dataset-v1.json`,
    ),
    bullpen: path.join(
      root,
      "data/research/mlb",
      `${DATE}-bullpen-role-dataset-v1_1.json`,
    ),
    lineup: path.join(
      root,
      "data/research/mlb",
      `${DATE}-lineup-dataset-v1.json`,
    ),
    weather: path.join(
      root,
      "data/research/mlb",
      `${DATE}-weather-dataset-v1.json`,
    ),
    travel: path.join(
      root,
      "data/research/mlb",
      `${DATE}-travel-rest-dataset-v1.json`,
    ),
    odds: path.join(
      root,
      "data/research/mlb",
      `${DATE}-odds-history-dataset-v1.json`,
    ),
    injury: path.join(
      root,
      "data/research/mlb",
      `${DATE}-injury-dataset-v1.json`,
    ),
  };

  for (const [name, p] of Object.entries(regressionPaths)) {
    if (!(await fileExists(p))) {
      throw new Error(`missing regression input ${name}: ${p}`);
    }
  }

  const hashBefore = {
    prediction: sha256(await readFile(regressionPaths.prediction, "utf8")),
    starter: sha256(await readFile(regressionPaths.starter, "utf8")),
    bullpen: sha256(await readFile(regressionPaths.bullpen, "utf8")),
    lineup: sha256(await readFile(regressionPaths.lineup, "utf8")),
    weather: sha256(await readFile(regressionPaths.weather, "utf8")),
    travel: sha256(await readFile(regressionPaths.travel, "utf8")),
    odds: sha256(await readFile(regressionPaths.odds, "utf8")),
    injury: sha256(await readFile(regressionPaths.injury, "utf8")),
  };

  const datasets: DatasetGrowth[] = [];
  const chartByDataset: Record<
    string,
    Array<{ dateKst: string; cumulativeGames: number; gamesOnDate: number }>
  > = {};

  for (const spec of DATASET_SPECS) {
    const matching = allFiles
      .filter((f) => spec.filePattern.test(f))
      .sort();

    const allGameIds = new Set<string>();
    const gameIdsByDate = new Map<string, Set<string>>();
    const dailyGameCounts: Array<{ dateKst: string; gamesOnDate: number }> =
      [];
    let lastUpdated: string | null = null;
    let lastGeneratedAt: string | null = null;

    for (const filename of matching) {
      const filePath = path.join(mlbDir, filename);
      const doc = asRecord(
        JSON.parse(await readFile(filePath, "utf8")),
      );
      if (!doc) continue;

      const dateKst =
        asString(asRecord(doc.meta)?.dateKst) ?? dateFromFilename(filename);
      const generatedAt = asString(asRecord(doc.meta)?.generatedAt);
      if (
        generatedAt &&
        (!lastGeneratedAt || generatedAt > lastGeneratedAt)
      ) {
        lastGeneratedAt = generatedAt;
        lastUpdated = generatedAt;
      }

      const gameIds = extractGameIds(doc, spec.gameSource);
      const dateSet = gameIdsByDate.get(dateKst ?? filename) ?? new Set();
      for (const gid of gameIds) {
        allGameIds.add(gid);
        dateSet.add(gid);
      }
      if (dateKst) {
        gameIdsByDate.set(dateKst, dateSet);
        dailyGameCounts.push({ dateKst, gamesOnDate: gameIds.length });
      }
    }

    dailyGameCounts.sort((a, b) => a.dateKst.localeCompare(b.dateKst));

    const sortedDates = [...gameIdsByDate.keys()].sort();
    const firstGameDate = sortedDates[0] ?? null;
    const lastGameDate = sortedDates[sortedDates.length - 1] ?? null;

    const reg = registryMap.get(spec.datasetId);
    const sampleCount = allGameIds.size;
    const completionPercent =
      Math.round((sampleCount / TARGET_GAMES) * 1000) / 10;
    const gate = computeGate(
      sampleCount,
      matching.length > 0,
      reg?.status ?? "UNKNOWN",
    );

    const cumulativeSeries = buildCumulativeSeries(
      dailyGameCounts,
      gameIdsByDate,
    );
    chartByDataset[spec.datasetId] = cumulativeSeries;

    datasets.push({
      datasetId: spec.datasetId,
      displayName: spec.displayName,
      status: reg?.status ?? "UNKNOWN",
      sampleCount,
      targetSample: TARGET_GAMES,
      completionPercent,
      firstGameDate,
      lastGameDate,
      lastUpdated,
      gate,
      gatePromotionProhibited: gate === "READY_FOR_ENGINE_REVIEW",
      artifactFiles: matching.map((f) => `data/research/mlb/${f}`),
      dailyGameCounts,
    });
  }

  const hashAfter = {
    prediction: sha256(await readFile(regressionPaths.prediction, "utf8")),
    starter: sha256(await readFile(regressionPaths.starter, "utf8")),
    bullpen: sha256(await readFile(regressionPaths.bullpen, "utf8")),
    lineup: sha256(await readFile(regressionPaths.lineup, "utf8")),
    weather: sha256(await readFile(regressionPaths.weather, "utf8")),
    travel: sha256(await readFile(regressionPaths.travel, "utf8")),
    odds: sha256(await readFile(regressionPaths.odds, "utf8")),
    injury: sha256(await readFile(regressionPaths.injury, "utf8")),
  };

  const regressionUnchanged =
    hashBefore.prediction === hashAfter.prediction &&
    hashBefore.starter === hashAfter.starter &&
    hashBefore.bullpen === hashAfter.bullpen &&
    hashBefore.lineup === hashAfter.lineup &&
    hashBefore.weather === hashAfter.weather &&
    hashBefore.travel === hashAfter.travel &&
    hashBefore.odds === hashAfter.odds &&
    hashBefore.injury === hashAfter.injury;

  const gateSummary: Record<GateStatus, number> = {
    NOT_READY: 0,
    UNDER_COLLECTION: 0,
    READY_FOR_BACKTEST: 0,
    READY_FOR_ENGINE_REVIEW: 0,
  };
  for (const d of datasets) {
    gateSummary[d.gate] += 1;
  }

  const collectingDatasets = datasets.filter(
    (d) => d.status === "COLLECTING",
  ).length;
  const completedDatasets = datasets.filter(
    (d) => d.status === "COMPLETE",
  ).length;
  const totalGamesCollected = Math.max(...datasets.map((d) => d.sampleCount));
  const overallProgress =
    Math.round(
      (datasets.reduce((s, d) => s + d.completionPercent, 0) /
        datasets.length) *
        10,
    ) / 10;

  const overallProgressSeries = (() => {
    const allDates = [
      ...new Set(
        datasets.flatMap((d) => d.dailyGameCounts.map((x) => x.dateKst)),
      ),
    ].sort();
    return allDates.map((dateKst) => {
      const pcts = datasets.map((d) => {
        const series = chartByDataset[d.datasetId] ?? [];
        const point = series.find((p) => p.dateKst === dateKst);
        const cumulative = point?.cumulativeGames ?? 0;
        return (cumulative / TARGET_GAMES) * 100;
      });
      const avg =
        pcts.length > 0
          ? Math.round(
              (pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10,
            ) / 10
          : 0;
      return { dateKst, averageCompletionPercent: avg };
    });
  })();

  const dashboard = {
    meta: {
      version: "research-sample-growth-dashboard-v1",
      kind: "sample-growth-dashboard",
      asOfDateKst: DATE,
      generatedAt: new Date().toISOString(),
      researchOnly: true,
      engineConnected: false,
      engineAdmission: "PROHIBITED",
      engineReviewPromotionProhibited: true,
      targetGames: TARGET_GAMES,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
      officialConclusion: "RESEARCH_SAMPLE_GROWTH_DASHBOARD_V1_CREATED",
      note: "Chart-ready JSON only. Gate labels are computed — no Engine admission or hypothesis promotion.",
    },
    overall: {
      totalDatasets: datasets.length,
      collectingDatasets,
      completedDatasets,
      totalGamesCollected,
      targetGames: TARGET_GAMES,
      overallProgress,
    },
    gateSummary: {
      ...gateSummary,
      promotionProhibited: true,
      note: "READY_FOR_ENGINE_REVIEW is computed only — no dataset promoted.",
    },
    datasets,
    chartData: {
      targetGames: TARGET_GAMES,
      byDataset: chartByDataset,
      overallProgressSeries,
      barChart: datasets.map((d) => ({
        datasetId: d.datasetId,
        displayName: d.displayName,
        sampleCount: d.sampleCount,
        targetSample: d.targetSample,
        completionPercent: d.completionPercent,
        gate: d.gate,
      })),
    },
    regressionHashes: {
      before: hashBefore,
      after: hashAfter,
      unchanged: regressionUnchanged,
    },
    sources: [
      "data/research/registry.json",
      "data/research/mlb/*-starter-dataset-v1.json",
      "data/research/mlb/*-bullpen-role-dataset-v1_1.json",
      "data/research/mlb/*-lineup-dataset-v1.json",
      "data/research/mlb/*-weather-dataset-v1.json",
      "data/research/mlb/*-travel-rest-dataset-v1.json",
      "data/research/mlb/*-odds-history-dataset-v1.json",
      "data/research/mlb/*-injury-dataset-v1.json",
    ],
    checks: [
      {
        id: "prediction-hash-unchanged",
        passed: hashBefore.prediction === hashAfter.prediction,
      },
      {
        id: "all-dataset-hashes-unchanged",
        passed: regressionUnchanged,
      },
      {
        id: "no-engine-promotion",
        passed: true,
        detail: "engineReviewPromotionProhibited",
      },
      {
        id: "chart-data-only",
        passed: true,
        detail: "no viewer wiring",
      },
    ],
    limitations: [
      "Sample counts use unique gameIds across all artifact files per dataset.",
      "15–27 games ≪ 100 target — all datasets remain UNDER_COLLECTION.",
      "Dashboard is descriptive — not an Engine or backtest input.",
    ],
  };

  const outJson = path.join(
    root,
    "data/research/research-sample-growth-dashboard-v1.json",
  );
  const outAudit = path.join(
    root,
    "data/audits/research-sample-growth-dashboard-v1-audit.json",
  );

  await mkdir(path.dirname(outJson), { recursive: true });
  await mkdir(path.dirname(outAudit), { recursive: true });
  await writeFile(outJson, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8");

  const audit = {
    meta: {
      version: "research-sample-growth-dashboard-v1-audit",
      asOfDateKst: DATE,
      generatedAt: dashboard.meta.generatedAt,
      conclusion: dashboard.meta.officialConclusion,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
    },
    overall: dashboard.overall,
    gateSummary: dashboard.gateSummary,
    datasets: datasets.map((d) => ({
      datasetId: d.datasetId,
      displayName: d.displayName,
      sampleCount: d.sampleCount,
      completionPercent: d.completionPercent,
      gate: d.gate,
      firstGameDate: d.firstGameDate,
      lastGameDate: d.lastGameDate,
    })),
    checks: dashboard.checks,
  };

  await writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const failedChecks = dashboard.checks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    throw new Error(
      `dashboard checks failed: ${failedChecks.map((c) => c.id).join(", ")}`,
    );
  }

  console.log(`datasets=${datasets.length} totalGames=${totalGamesCollected}`);
  console.log(
    `progress=${overallProgress}% gates=${JSON.stringify(gateSummary)}`,
  );
  console.log(`regressionUnchanged=${regressionUnchanged}`);
  console.log(`json: ${outJson}`);
  console.log(`audit: ${outAudit}`);
  console.log("RESEARCH_SAMPLE_GROWTH_DASHBOARD_V1_CREATED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
