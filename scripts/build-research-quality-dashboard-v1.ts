/**
 * MLB Research Quality Dashboard v1 — top-level read-only health view.
 *
 * Integrates Coverage, Sample Growth, Completeness Trend, Gate, Correlation Audit.
 * No quality scores, weights, Engine/Viewer wiring, or admission changes.
 *
 *   npx tsx scripts/build-research-quality-dashboard-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

const TARGET_SAMPLE = 100;

type QualityFlag =
  | "LOW_SAMPLE"
  | "PARTIAL_COLLECTION"
  | "PROVIDER_PENDING"
  | "LEGAL_HOLD"
  | "ENGINE_PROHIBITED";

type QualityStatus = "HEALTHY" | "COLLECTING" | "BLOCKED" | "NOT_READY";

type OverallStatus =
  | "NOT_READY"
  | "UNDER_COLLECTION"
  | "COLLECTING_WITH_GAPS"
  | "COLLECTING";

const DATASET_IDS = [
  "mlb-starter",
  "mlb-bullpen-role",
  "mlb-lineup",
  "mlb-weather",
  "mlb-travel",
  "mlb-odds-history",
  "mlb-injury",
] as const;

const DISPLAY: Record<(typeof DATASET_IDS)[number], string> = {
  "mlb-starter": "Starter",
  "mlb-bullpen-role": "Bullpen",
  "mlb-lineup": "Lineup",
  "mlb-weather": "Weather",
  "mlb-travel": "Travel",
  "mlb-odds-history": "Odds History",
  "mlb-injury": "Injury",
};

const CORRELATION_KEY: Record<(typeof DATASET_IDS)[number], string> = {
  "mlb-starter": "starter",
  "mlb-bullpen-role": "bullpen",
  "mlb-lineup": "lineup",
  "mlb-weather": "weather",
  "mlb-travel": "travel",
  "mlb-odds-history": "odds",
  "mlb-injury": "injury",
};

type DatasetQuality = {
  datasetId: string;
  displayName: string;
  sampleCount: number;
  completionRate: number;
  currentGate: string;
  engineAdmission: string;
  qualityStatus: QualityStatus;
  qualityFlags: QualityFlag[];
  correlationOnDate: {
    complete: number;
    partial: number;
    notCollected: number;
  } | null;
  coverageArtifactPresent: boolean | null;
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

function buildQualityFlags(input: {
  sampleCount: number;
  completionRate: number;
  engineAdmission: string;
  gateReasons: string[];
  correlationPartial: number;
  correlationNotCollected: number;
}): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (input.sampleCount < TARGET_SAMPLE) flags.push("LOW_SAMPLE");
  if (
    input.completionRate < 100 ||
    input.correlationPartial > 0 ||
    input.correlationNotCollected > 0
  ) {
    flags.push("PARTIAL_COLLECTION");
  }
  if (
    input.gateReasons.some((r) => r.includes("provider not finalized"))
  ) {
    flags.push("PROVIDER_PENDING");
  }
  if (
    input.gateReasons.some((r) =>
      r.includes("engine admission prohibited (legal hold)"),
    )
  ) {
    flags.push("LEGAL_HOLD");
  }
  if (input.engineAdmission === "PROHIBITED") {
    flags.push("ENGINE_PROHIBITED");
  }

  return [...new Set(flags)];
}

function deriveQualityStatus(
  sampleCount: number,
  completionRate: number,
  flags: QualityFlag[],
  gate: string,
): QualityStatus {
  if (sampleCount === 0 || gate === "NOT_READY") return "NOT_READY";
  if (
    flags.includes("PARTIAL_COLLECTION") ||
    flags.includes("PROVIDER_PENDING")
  ) {
    return "BLOCKED";
  }
  if (
    sampleCount >= TARGET_SAMPLE &&
    completionRate >= 100 &&
    !flags.includes("PROVIDER_PENDING")
  ) {
    return "HEALTHY";
  }
  return "COLLECTING";
}

function deriveOverallStatus(
  datasets: DatasetQuality[],
  overallGate: string,
): OverallStatus {
  if (datasets.every((d) => d.qualityStatus === "NOT_READY")) {
    return "NOT_READY";
  }
  const blocked = datasets.filter((d) => d.qualityStatus === "BLOCKED").length;
  if (blocked > 0) return "COLLECTING_WITH_GAPS";
  if (overallGate === "UNDER_COLLECTION") return "UNDER_COLLECTION";
  return "COLLECTING";
}

async function main() {
  console.log(`=== MLB Research Quality Dashboard v1 (${DATE}) ===`);

  const root = process.cwd();
  const inputPaths = {
    coverage: path.join(root, "data/research/dataset-coverage-dashboard-v1.json"),
    sampleGrowth: path.join(
      root,
      "data/research/research-sample-growth-dashboard-v1.json",
    ),
    completenessTrend: path.join(
      root,
      "data/research/dataset-completeness-trend-v1.json",
    ),
    gateDashboard: path.join(
      root,
      "data/research/engine-admission-gate-dashboard-v1.json",
    ),
    correlationAudit: path.join(
      root,
      "data/audits",
      `${DATE}-dataset-correlation-v2.json`,
    ),
  };

  for (const [name, p] of Object.entries(inputPaths)) {
    if (!(await fileExists(p))) {
      throw new Error(`missing input ${name}: ${p}`);
    }
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

  const coverage = JSON.parse(await readFile(inputPaths.coverage, "utf8")) as {
    datasets?: unknown[];
    coverageSummary?: Record<string, unknown>;
  };
  const sampleGrowth = JSON.parse(
    await readFile(inputPaths.sampleGrowth, "utf8"),
  ) as { datasets?: unknown[]; overall?: Record<string, unknown> };
  const gateDashboard = JSON.parse(
    await readFile(inputPaths.gateDashboard, "utf8"),
  ) as { datasets?: unknown[]; overall?: Record<string, unknown> };
  const correlation = JSON.parse(
    await readFile(inputPaths.correlationAudit, "utf8"),
  ) as {
    meta?: { auditedGames?: number };
    missingSummary?: Record<string, Record<string, number>>;
  };

  const coverageById = new Map<string, Record<string, unknown>>();
  for (const raw of coverage.datasets ?? []) {
    const d = asRecord(raw);
    const id = asString(d?.datasetId);
    if (id && d) coverageById.set(id, d);
  }

  const growthById = new Map<string, Record<string, unknown>>();
  for (const raw of sampleGrowth.datasets ?? []) {
    const d = asRecord(raw);
    const id = asString(d?.datasetId);
    if (id && d) growthById.set(id, d);
  }

  const gateById = new Map<string, Record<string, unknown>>();
  for (const raw of gateDashboard.datasets ?? []) {
    const d = asRecord(raw);
    const id = asString(d?.datasetId);
    if (id && d) gateById.set(id, d);
  }

  const datasets: DatasetQuality[] = [];

  for (const datasetId of DATASET_IDS) {
    const g = gateById.get(datasetId) ?? {};
    const growth = growthById.get(datasetId) ?? {};
    const cov = coverageById.get(datasetId);

    const sampleCount =
      asNumber(growth.sampleCount) ?? asNumber(g.sampleCount) ?? 0;
    const completionRate = asNumber(g.completionRate) ?? 0;
    const currentGate = asString(g.gate) ?? "NOT_READY";
    const engineAdmission = asString(g.engineAdmission) ?? "PROHIBITED";
    const gateReasons = Array.isArray(g.gateReasons)
      ? (g.gateReasons as string[])
      : [];

    const corrKey = CORRELATION_KEY[datasetId];
    const corrCell = correlation.missingSummary?.[corrKey];
    const correlationOnDate = corrCell
      ? {
          complete: corrCell.COMPLETE ?? 0,
          partial: corrCell.PARTIAL ?? 0,
          notCollected: corrCell.NOT_COLLECTED ?? 0,
        }
      : null;

    const qualityFlags = buildQualityFlags({
      sampleCount,
      completionRate,
      engineAdmission,
      gateReasons,
      correlationPartial: correlationOnDate?.partial ?? 0,
      correlationNotCollected: correlationOnDate?.notCollected ?? 0,
    });

    const qualityStatus = deriveQualityStatus(
      sampleCount,
      completionRate,
      qualityFlags,
      currentGate,
    );

    datasets.push({
      datasetId,
      displayName: DISPLAY[datasetId],
      sampleCount,
      completionRate,
      currentGate,
      engineAdmission,
      qualityStatus,
      qualityFlags,
      correlationOnDate,
      coverageArtifactPresent:
        cov != null ? cov.artifactPresent === true : null,
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

  const flagSummary: Record<QualityFlag, number> = {
    LOW_SAMPLE: 0,
    PARTIAL_COLLECTION: 0,
    PROVIDER_PENDING: 0,
    LEGAL_HOLD: 0,
    ENGINE_PROHIBITED: 0,
  };
  for (const d of datasets) {
    for (const flag of d.qualityFlags) {
      flagSummary[flag] += 1;
    }
  }

  const datasetsHealthy = datasets.filter(
    (d) => d.qualityStatus === "HEALTHY",
  ).length;
  const datasetsCollecting = datasets.filter(
    (d) => d.qualityStatus === "COLLECTING",
  ).length;
  const datasetsBlocked = datasets.filter(
    (d) => d.qualityStatus === "BLOCKED" || d.qualityStatus === "NOT_READY",
  ).length;

  const overallGate = asString(gateDashboard.overall?.overallGate) ?? "NOT_READY";
  const overallProgress =
    asNumber(sampleGrowth.overall?.overallProgress) ?? 0;
  const overallStatus = deriveOverallStatus(datasets, overallGate);

  const dashboard = {
    meta: {
      version: "research-quality-dashboard-v1",
      kind: "research-quality-dashboard",
      asOfDateKst: DATE,
      generatedAt: new Date().toISOString(),
      researchOnly: true,
      engineConnected: false,
      engineAdmission: "PROHIBITED",
      noQualityScores: true,
      noWeights: true,
      noRecommendations: true,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
      officialConclusion: "RESEARCH_QUALITY_DASHBOARD_V1_CREATED",
      note: "Top-level read-only health view — integrates existing audits without scoring.",
    },
    sources: Object.entries(inputPaths).map(([key, p]) => ({
      key,
      path: path.relative(root, p).replace(/\\/g, "/"),
    })),
    researchHealth: {
      overallStatus,
      overallGate,
      datasetsHealthy,
      datasetsCollecting,
      datasetsBlocked,
      overallProgress,
      targetSample: TARGET_SAMPLE,
      totalDatasets: datasets.length,
    },
    qualityFlags: {
      summary: flagSummary,
      definitions: {
        LOW_SAMPLE: `sampleCount < ${TARGET_SAMPLE}`,
        PARTIAL_COLLECTION: "completionRate < 100% or correlation PARTIAL/NOT_COLLECTED > 0",
        PROVIDER_PENDING: "weather forecast provider not selected",
        LEGAL_HOLD: "engine admission prohibited by research policy",
        ENGINE_PROHIBITED: "engineAdmission === PROHIBITED in registry",
      },
    },
    upstream: {
      coverageDashboard: {
        version: "dataset-coverage-dashboard-v1",
        collectingDatasets: asNumber(coverage.coverageSummary?.collectingDatasets),
        note: "Legacy coverage dashboard — partial dataset list; superseded by gate/growth for 7 datasets.",
      },
      sampleGrowthDashboard: {
        totalGamesCollected: asNumber(
          asRecord(sampleGrowth.overall)?.totalGamesCollected,
        ),
        overallProgress,
      },
      completenessTrendAudit: {
        path: path
          .relative(root, inputPaths.completenessTrend)
          .replace(/\\/g, "/"),
      },
      engineAdmissionGateDashboard: {
        overallGate,
        datasetsBlocked: asNumber(
          asRecord(gateDashboard.overall)?.datasetsBlocked,
        ),
      },
      correlationAudit: {
        dateKst: DATE,
        auditedGames: correlation.meta?.auditedGames ?? null,
        path: path
          .relative(root, inputPaths.correlationAudit)
          .replace(/\\/g, "/"),
      },
    },
    datasets,
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
        detail: "flags and status labels only",
      },
      {
        id: "no-admission-changes",
        passed: datasets.every((d) => d.engineAdmission === "PROHIBITED"),
      },
      {
        id: "all-upstream-sources-present",
        passed: true,
      },
    ],
    limitations: [
      "Quality flags describe current state — not weighted scores or recommendations.",
      "All datasets remain Engine PROHIBITED by policy.",
      "Coverage dashboard predates 7-dataset expansion — gate/growth are authoritative for sample counts.",
    ],
  };

  const outJson = path.join(
    root,
    "data/research/research-quality-dashboard-v1.json",
  );
  const outAudit = path.join(
    root,
    "data/audits/research-quality-dashboard-v1-audit.json",
  );

  await mkdir(path.dirname(outJson), { recursive: true });
  await mkdir(path.dirname(outAudit), { recursive: true });
  await writeFile(outJson, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8");

  const audit = {
    meta: {
      version: "research-quality-dashboard-v1-audit",
      asOfDateKst: DATE,
      generatedAt: dashboard.meta.generatedAt,
      conclusion: dashboard.meta.officialConclusion,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
    },
    researchHealth: dashboard.researchHealth,
    qualityFlags: dashboard.qualityFlags.summary,
    datasets: datasets.map((d) => ({
      datasetId: d.datasetId,
      displayName: d.displayName,
      sampleCount: d.sampleCount,
      completionRate: d.completionRate,
      currentGate: d.currentGate,
      engineAdmission: d.engineAdmission,
      qualityStatus: d.qualityStatus,
      qualityFlags: d.qualityFlags,
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

  console.log(`datasets=${datasets.length} overallStatus=${overallStatus}`);
  console.log(
    `healthy=${datasetsHealthy} collecting=${datasetsCollecting} blocked=${datasetsBlocked}`,
  );
  console.log(`flags=${JSON.stringify(flagSummary)}`);
  console.log(`regressionUnchanged=${regressionUnchanged}`);
  console.log(`json: ${outJson}`);
  console.log(`audit: ${outAudit}`);
  console.log("RESEARCH_QUALITY_DASHBOARD_V1_CREATED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
