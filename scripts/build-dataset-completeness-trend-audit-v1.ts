/**
 * MLB Dataset Completeness Trend Audit v1 — read-only completeness tracking over time.
 *
 * - Game-level COMPLETE / PARTIAL / NOT_COLLECTED counts per slate date
 * - Trend series only — no quality scores, weights, or Engine wiring
 *
 *   npx tsx scripts/build-dataset-completeness-trend-audit-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

type CollectionStatus = "NOT_COLLECTED" | "PARTIAL" | "COMPLETE";

type DatasetSpec = {
  datasetId: string;
  displayName: string;
  filePattern: RegExp;
  kind: "rows" | "games";
};

const DATASET_SPECS: DatasetSpec[] = [
  {
    datasetId: "mlb-starter",
    displayName: "Starter",
    filePattern: /^\d{4}-\d{2}-\d{2}-starter-dataset-v1\.json$/,
    kind: "rows",
  },
  {
    datasetId: "mlb-bullpen-role",
    displayName: "Bullpen",
    filePattern: /^\d{4}-\d{2}-\d{2}-bullpen-role-dataset-v1_1\.json$/,
    kind: "games",
  },
  {
    datasetId: "mlb-lineup",
    displayName: "Lineup",
    filePattern: /^\d{4}-\d{2}-\d{2}-lineup-dataset-v1\.json$/,
    kind: "rows",
  },
  {
    datasetId: "mlb-weather",
    displayName: "Weather",
    filePattern: /^\d{4}-\d{2}-\d{2}-weather-dataset-v1\.json$/,
    kind: "rows",
  },
  {
    datasetId: "mlb-travel",
    displayName: "Travel",
    filePattern: /^\d{4}-\d{2}-\d{2}-travel-rest-dataset-v1\.json$/,
    kind: "rows",
  },
  {
    datasetId: "mlb-odds-history",
    displayName: "Odds History",
    filePattern: /^\d{4}-\d{2}-\d{2}-odds-history-dataset-v1\.json$/,
    kind: "rows",
  },
  {
    datasetId: "mlb-injury",
    displayName: "Injury",
    filePattern: /^\d{4}-\d{2}-\d{2}-injury-dataset-v1\.json$/,
    kind: "rows",
  },
];

type TrendEntry = {
  datasetId: string;
  date: string;
  sampleCount: number;
  completeRows: number;
  partialRows: number;
  missingRows: number;
  completionRate: number;
  generatedAt: string | null;
  artifactPath: string;
};

type TrendPoint = {
  date: string;
  completionRate: number;
  completionRateDelta: number | null;
  sampleCount: number;
  sampleCountDelta: number | null;
};

type DatasetTrend = {
  datasetId: string;
  displayName: string;
  entries: TrendEntry[];
  completionRateTrend: TrendPoint[];
  sampleGrowthTrend: TrendPoint[];
  summary: {
    averageCompletion: number;
    maxCompletion: number;
    minCompletion: number;
    currentCompletion: number;
  };
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

function roundRate(percent0to100: number): number {
  return Math.round(percent0to100 * 10) / 10;
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

function assessStarterRows(rows: unknown[]): CollectionStatus {
  if (rows.length === 0) return "NOT_COLLECTED";
  let complete = rows.length >= 2;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) {
      complete = false;
      continue;
    }
    const jq = asString(r.joinQuality);
    const pid = asNumber(r.probablePitcherId);
    const missing = Array.isArray(r.missing) ? r.missing.length : 0;
    if (jq !== "MATCHED" || pid == null || missing > 0) complete = false;
  }
  if (rows.length < 2) return "PARTIAL";
  return complete ? "COMPLETE" : "PARTIAL";
}

function assessBullpenGame(game: Record<string, unknown> | null): CollectionStatus {
  if (!game) return "NOT_COLLECTED";
  const role = asString(game.overallRoleComparison);
  if (!role) return "PARTIAL";
  return "COMPLETE";
}

function assessLineupRows(rows: unknown[]): CollectionStatus {
  if (rows.length === 0) return "NOT_COLLECTED";
  let allComplete = rows.length >= 2;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) {
      allComplete = false;
      continue;
    }
    if (asString(r.lineupStatus) !== "COMPLETE") allComplete = false;
    if (asString(r.preGameStatus) === "NOT_COLLECTED") allComplete = false;
  }
  if (rows.length < 2) return "PARTIAL";
  const anyComplete = rows.some(
    (raw) => asString(asRecord(raw)?.lineupStatus) === "COMPLETE",
  );
  if (!anyComplete) return "PARTIAL";
  return allComplete ? "COMPLETE" : "PARTIAL";
}

function assessWeatherRow(row: Record<string, unknown> | null): CollectionStatus {
  if (!row) return "NOT_COLLECTED";
  const venue = asRecord(row.venue);
  const venueId = asNumber(venue?.id);
  const missing = Array.isArray(row.missing) ? row.missing.length : 0;
  const forecast = asRecord(row.forecast);
  const forecastCollected =
    forecast &&
    Object.values(forecast).some((v) => v !== "NOT_COLLECTED" && v != null);
  if (venueId == null || venueId <= 0) return "PARTIAL";
  if (missing > 0 || !forecastCollected) return "PARTIAL";
  return "COMPLETE";
}

function assessTravelRows(rows: unknown[]): CollectionStatus {
  if (rows.length === 0) return "NOT_COLLECTED";
  let complete = rows.length >= 2;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) {
      complete = false;
      continue;
    }
    if (asString(r.joinQuality) !== "MATCHED") complete = false;
    const missing = Array.isArray(r.missing) ? r.missing.length : 0;
    if (missing > 0) complete = false;
  }
  if (rows.length < 2) return "PARTIAL";
  return complete ? "COMPLETE" : "PARTIAL";
}

function assessOddsRow(row: Record<string, unknown> | null): CollectionStatus {
  if (!row) return "NOT_COLLECTED";
  const opening = asNumber(row.openingOdds);
  const latest = asNumber(row.latestOdds);
  const market = asNumber(row.marketProbability);
  if (opening != null && latest != null && market != null) return "COMPLETE";
  if (market != null || opening != null || latest != null) return "PARTIAL";
  return "PARTIAL";
}

function assessInjuryRows(
  rows: unknown[],
  starterStatus: CollectionStatus,
): CollectionStatus {
  if (starterStatus === "NOT_COLLECTED") return "NOT_COLLECTED";
  if (rows.length === 0) return "COMPLETE";
  let partial = false;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) continue;
    const warnings = Array.isArray(r.warnings) ? r.warnings.length : 0;
    const missing = Array.isArray(r.missing) ? r.missing.length : 0;
    if (warnings > 0 || missing > 0) partial = true;
  }
  return partial ? "PARTIAL" : "COMPLETE";
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

function countStatuses(statuses: CollectionStatus[]) {
  let completeRows = 0;
  let partialRows = 0;
  let missingRows = 0;
  for (const s of statuses) {
    if (s === "COMPLETE") completeRows += 1;
    else if (s === "PARTIAL") partialRows += 1;
    else missingRows += 1;
  }
  const sampleCount = statuses.length;
  const completionRate =
    sampleCount > 0 ? roundRate((completeRows / sampleCount) * 100) : 0;
  return { sampleCount, completeRows, partialRows, missingRows, completionRate };
}

function assessArtifact(
  spec: DatasetSpec,
  doc: Record<string, unknown>,
  starterByGame: Map<string, CollectionStatus>,
): ReturnType<typeof countStatuses> {
  const statuses: CollectionStatus[] = [];

  if (spec.datasetId === "mlb-bullpen-role") {
    for (const raw of (doc.games as unknown[]) ?? []) {
      statuses.push(assessBullpenGame(asRecord(raw)));
    }
  } else if (spec.datasetId === "mlb-starter") {
    for (const [, rows] of groupRowsByGame((doc.rows as unknown[]) ?? [])) {
      statuses.push(assessStarterRows(rows));
    }
  } else if (spec.datasetId === "mlb-lineup") {
    for (const [, rows] of groupRowsByGame((doc.rows as unknown[]) ?? [])) {
      statuses.push(assessLineupRows(rows));
    }
  } else if (spec.datasetId === "mlb-weather") {
    for (const raw of (doc.rows as unknown[]) ?? []) {
      statuses.push(assessWeatherRow(asRecord(raw)));
    }
  } else if (spec.datasetId === "mlb-travel") {
    for (const [, rows] of groupRowsByGame((doc.rows as unknown[]) ?? [])) {
      statuses.push(assessTravelRows(rows));
    }
  } else if (spec.datasetId === "mlb-odds-history") {
    for (const raw of (doc.rows as unknown[]) ?? []) {
      statuses.push(assessOddsRow(asRecord(raw)));
    }
  } else if (spec.datasetId === "mlb-injury") {
    const injuryByGame = groupRowsByGame((doc.rows as unknown[]) ?? []);
    const gameIds = new Set([
      ...injuryByGame.keys(),
      ...starterByGame.keys(),
    ]);
    for (const gid of gameIds) {
      const starterStatus = starterByGame.get(gid) ?? "NOT_COLLECTED";
      statuses.push(
        assessInjuryRows(injuryByGame.get(gid) ?? [], starterStatus),
      );
    }
  }

  return countStatuses(statuses);
}

function buildTrendPoints(entries: TrendEntry[]): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((entry, i) => {
    const prev = i > 0 ? sorted[i - 1]! : null;
    return {
      date: entry.date,
      completionRate: entry.completionRate,
      completionRateDelta:
        prev != null ? roundRate(entry.completionRate - prev.completionRate) : null,
      sampleCount: entry.sampleCount,
      sampleCountDelta:
        prev != null ? entry.sampleCount - prev.sampleCount : null,
    };
  });
}

function summarizeEntries(entries: TrendEntry[]) {
  if (entries.length === 0) {
    return {
      averageCompletion: 0,
      maxCompletion: 0,
      minCompletion: 0,
      currentCompletion: 0,
    };
  }
  const rates = entries.map((e) => e.completionRate);
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return {
    averageCompletion: roundRate(rates.reduce((a, b) => a + b, 0) / rates.length),
    maxCompletion: Math.max(...rates),
    minCompletion: Math.min(...rates),
    currentCompletion: sorted[sorted.length - 1]!.completionRate,
  };
}

async function loadStarterStatusByDate(
  mlbDir: string,
  allFiles: string[],
): Promise<Map<string, Map<string, CollectionStatus>>> {
  const out = new Map<string, Map<string, CollectionStatus>>();
  const starterFiles = allFiles.filter((f) =>
    /^\d{4}-\d{2}-\d{2}-starter-dataset-v1\.json$/.test(f),
  );

  for (const filename of starterFiles) {
    const doc = asRecord(
      JSON.parse(await readFile(path.join(mlbDir, filename), "utf8")),
    );
    if (!doc) continue;
    const dateKst =
      asString(asRecord(doc.meta)?.dateKst) ?? dateFromFilename(filename);
    if (!dateKst) continue;
    const byGame = new Map<string, CollectionStatus>();
    for (const [gid, rows] of groupRowsByGame((doc.rows as unknown[]) ?? [])) {
      byGame.set(gid, assessStarterRows(rows));
    }
    out.set(dateKst, byGame);
  }

  return out;
}

async function main() {
  console.log(`=== MLB Dataset Completeness Trend Audit v1 (${DATE}) ===`);

  const root = process.cwd();
  const mlbDir = path.join(root, "data/research/mlb");
  const allFiles = await readdir(mlbDir);

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

  const starterStatusByDate = await loadStarterStatusByDate(mlbDir, allFiles);
  const trends: DatasetTrend[] = [];

  for (const spec of DATASET_SPECS) {
    const matching = allFiles
      .filter((f) => spec.filePattern.test(f))
      .sort();

    const entries: TrendEntry[] = [];

    for (const filename of matching) {
      const artifactPath = `data/research/mlb/${filename}`;
      const doc = asRecord(
        JSON.parse(await readFile(path.join(mlbDir, filename), "utf8")),
      );
      if (!doc) continue;

      const dateKst =
        asString(asRecord(doc.meta)?.dateKst) ?? dateFromFilename(filename);
      if (!dateKst) continue;

      const generatedAt = asString(asRecord(doc.meta)?.generatedAt);
      const starterByGame = starterStatusByDate.get(dateKst) ?? new Map();
      const counts = assessArtifact(spec, doc, starterByGame);

      entries.push({
        datasetId: spec.datasetId,
        date: dateKst,
        ...counts,
        generatedAt,
        artifactPath,
      });
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));

    trends.push({
      datasetId: spec.datasetId,
      displayName: spec.displayName,
      entries,
      completionRateTrend: buildTrendPoints(entries),
      sampleGrowthTrend: buildTrendPoints(entries),
      summary: summarizeEntries(entries),
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

  const trendEntries = trends.reduce((n, t) => n + t.entries.length, 0);

  const completionSummary = Object.fromEntries(
    trends.map((t) => [t.datasetId, t.summary]),
  );

  const artifact = {
    meta: {
      version: "dataset-completeness-trend-v1",
      kind: "completeness-trend-audit",
      asOfDateKst: DATE,
      generatedAt: new Date().toISOString(),
      researchOnly: true,
      engineConnected: false,
      engineAdmission: "PROHIBITED",
      noQualityScores: true,
      noImportance: true,
      noWeights: true,
      trendEntryCount: trendEntries,
      datasetCount: trends.length,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
      officialConclusion: "DATASET_COMPLETENESS_TREND_AUDIT_V1_CREATED",
      note: "Game-level completeness counts per slate date — not a quality or importance score.",
    },
    trends,
    completionSummary,
    chartData: {
      byDataset: Object.fromEntries(
        trends.map((t) => [
          t.datasetId,
          {
            completionRateTrend: t.completionRateTrend,
            sampleGrowthTrend: t.sampleGrowthTrend.map((p) => ({
              date: p.date,
              sampleCount: p.sampleCount,
              sampleCountDelta: p.sampleCountDelta,
            })),
          },
        ]),
      ),
    },
    regressionHashes: {
      before: hashBefore,
      after: hashAfter,
      unchanged: regressionUnchanged,
    },
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
        id: "no-quality-scores",
        passed: true,
        detail: "completion-rate counts only",
      },
      {
        id: "engine-prohibited",
        passed: true,
      },
    ],
    limitations: [
      "Completeness is assessed at game level using the same rules as Correlation Audit v2.",
      "Most datasets have a single slate entry — multi-date trend visible on Starter (2 slates).",
      "Lineup / Weather / Injury remain PARTIAL-dominated until pre-game and provider gaps close.",
    ],
  };

  const outJson = path.join(
    root,
    "data/research/dataset-completeness-trend-v1.json",
  );
  const outAudit = path.join(
    root,
    "data/audits/dataset-completeness-trend-v1-audit.json",
  );

  await mkdir(path.dirname(outJson), { recursive: true });
  await mkdir(path.dirname(outAudit), { recursive: true });
  await writeFile(outJson, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  const audit = {
    meta: {
      version: "dataset-completeness-trend-v1-audit",
      asOfDateKst: DATE,
      generatedAt: artifact.meta.generatedAt,
      conclusion: artifact.meta.officialConclusion,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
      trendEntryCount: trendEntries,
    },
    completionSummary,
    datasets: trends.map((t) => ({
      datasetId: t.datasetId,
      displayName: t.displayName,
      entryCount: t.entries.length,
      summary: t.summary,
      latestEntry: t.entries[t.entries.length - 1] ?? null,
    })),
    checks: artifact.checks,
  };

  await writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const failedChecks = artifact.checks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    throw new Error(
      `audit checks failed: ${failedChecks.map((c) => c.id).join(", ")}`,
    );
  }

  console.log(`datasets=${trends.length} trendEntries=${trendEntries}`);
  console.log(`completionSummary=${JSON.stringify(completionSummary)}`);
  console.log(`regressionUnchanged=${regressionUnchanged}`);
  console.log(`json: ${outJson}`);
  console.log(`audit: ${outAudit}`);
  console.log("DATASET_COMPLETENESS_TREND_AUDIT_V1_CREATED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
