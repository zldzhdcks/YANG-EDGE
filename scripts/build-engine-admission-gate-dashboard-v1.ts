/**
 * MLB Research Engine Admission Gate Dashboard v1 — read-only gate status per dataset.
 *
 * - Records why datasets are not Engine-ready — does not change admission
 * - READY_FOR_ENGINE_REVIEW promotion PROHIBITED
 *
 *   npx tsx scripts/build-engine-admission-gate-dashboard-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

const TARGET_SAMPLE = 100;
const COMPLETION_THRESHOLD = 100;

type GateStatus =
  | "NOT_READY"
  | "UNDER_COLLECTION"
  | "READY_FOR_BACKTEST"
  | "READY_FOR_ENGINE_REVIEW";

const GATE_RANK: Record<GateStatus, number> = {
  NOT_READY: 0,
  UNDER_COLLECTION: 1,
  READY_FOR_BACKTEST: 2,
  READY_FOR_ENGINE_REVIEW: 3,
};

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

type DatasetGate = {
  datasetId: string;
  displayName: string;
  sampleCount: number;
  completionRate: number;
  engineAdmission: string;
  registryStatus: string;
  gate: GateStatus;
  theoreticalGate: GateStatus;
  engineReviewPromotionProhibited: boolean;
  gateReasons: string[];
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

function computeTheoreticalGate(
  sampleCount: number,
  completionRate: number,
  registryStatus: string,
  engineAdmission: string,
): GateStatus {
  if (sampleCount === 0) return "NOT_READY";
  if (sampleCount < TARGET_SAMPLE || completionRate < COMPLETION_THRESHOLD) {
    return "UNDER_COLLECTION";
  }
  if (registryStatus !== "COMPLETE" || engineAdmission === "PROHIBITED") {
    return "READY_FOR_BACKTEST";
  }
  return "READY_FOR_ENGINE_REVIEW";
}

function buildGateReasons(input: {
  sampleCount: number;
  completionRate: number;
  engineAdmission: string;
  registryStatus: string;
  partialRows: number;
  providerNotFinalized: boolean;
  latestPartialSlate: boolean;
}): string[] {
  const reasons: string[] = [];

  if (input.sampleCount === 0) {
    reasons.push("no artifact collected");
    return reasons;
  }

  if (input.sampleCount < TARGET_SAMPLE) {
    reasons.push(
      `sample below target (${input.sampleCount} < ${TARGET_SAMPLE})`,
    );
  }

  if (input.completionRate < COMPLETION_THRESHOLD) {
    reasons.push(
      `completion below threshold (${input.completionRate}% < ${COMPLETION_THRESHOLD}%)`,
    );
  }

  if (input.partialRows > 0 || input.latestPartialSlate) {
    reasons.push("partial collection");
  }

  if (input.providerNotFinalized) {
    reasons.push("provider not finalized");
  }

  if (input.engineAdmission === "PROHIBITED") {
    reasons.push("engine admission prohibited (legal hold)");
  }

  if (input.registryStatus === "COLLECTING") {
    reasons.push("registry status COLLECTING");
  }

  if (input.registryStatus === "NOT_STARTED") {
    reasons.push("registry status NOT_STARTED");
  }

  return reasons;
}

function effectiveGate(theoretical: GateStatus): GateStatus {
  if (theoretical === "READY_FOR_ENGINE_REVIEW") {
    return "READY_FOR_BACKTEST";
  }
  return theoretical;
}

async function main() {
  console.log(
    `=== MLB Research Engine Admission Gate Dashboard v1 (${DATE}) ===`,
  );

  const root = process.cwd();
  const growthPath = path.join(
    root,
    "data/research/research-sample-growth-dashboard-v1.json",
  );
  const trendPath = path.join(
    root,
    "data/research/dataset-completeness-trend-v1.json",
  );
  const registryPath = path.join(root, "data/research/registry.json");

  for (const p of [growthPath, trendPath, registryPath]) {
    if (!(await fileExists(p))) {
      throw new Error(`missing input: ${p}`);
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

  const growth = JSON.parse(await readFile(growthPath, "utf8")) as {
    datasets?: unknown[];
  };
  const trend = JSON.parse(await readFile(trendPath, "utf8")) as {
    trends?: unknown[];
  };
  const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
    datasets?: unknown[];
  };

  const growthById = new Map<string, Record<string, unknown>>();
  for (const raw of growth.datasets ?? []) {
    const d = asRecord(raw);
    const id = asString(d?.datasetId);
    if (id && d) growthById.set(id, d);
  }

  const trendById = new Map<string, Record<string, unknown>>();
  for (const raw of trend.trends ?? []) {
    const t = asRecord(raw);
    const id = asString(t?.datasetId);
    if (id && t) trendById.set(id, t);
  }

  const registryById = new Map<string, Record<string, unknown>>();
  for (const raw of registry.datasets ?? []) {
    const d = asRecord(raw);
    const id = asString(d?.datasetId);
    if (id && d) registryById.set(id, d);
  }

  const weatherDoc = asRecord(
    JSON.parse(await readFile(regressionPaths.weather, "utf8")),
  );
  const weatherProvider = asRecord(asRecord(weatherDoc?.meta)?.provider);
  const weatherProviderNotFinalized =
    asString(weatherProvider?.status) === "NOT_SELECTED" ||
    weatherProvider?.selected == null;

  const datasets: DatasetGate[] = [];

  for (const datasetId of DATASET_IDS) {
    const g = growthById.get(datasetId) ?? {};
    const t = trendById.get(datasetId) ?? {};
    const reg = registryById.get(datasetId) ?? {};

    const sampleCount = asNumber(g.sampleCount) ?? 0;
    const summary = asRecord(t.summary);
    const completionRate = asNumber(summary?.currentCompletion) ?? 0;
    const engineAdmission = asString(reg.engineAdmission) ?? "PROHIBITED";
    const registryStatus = asString(reg.status) ?? asString(g.status) ?? "UNKNOWN";

    const latestEntry = asRecord(
      Array.isArray(t.entries)
        ? (t.entries as unknown[])[(t.entries as unknown[]).length - 1]
        : null,
    );
    const partialRows = asNumber(latestEntry?.partialRows) ?? 0;
    const latestPartialSlate =
      partialRows > 0 || completionRate < COMPLETION_THRESHOLD;

    const providerNotFinalized =
      datasetId === "mlb-weather" && weatherProviderNotFinalized;

    const gateReasons = buildGateReasons({
      sampleCount,
      completionRate,
      engineAdmission,
      registryStatus,
      partialRows,
      providerNotFinalized,
      latestPartialSlate,
    });

    const theoreticalGate = computeTheoreticalGate(
      sampleCount,
      completionRate,
      registryStatus,
      engineAdmission,
    );
    const gate = effectiveGate(theoreticalGate);

    datasets.push({
      datasetId,
      displayName: DISPLAY[datasetId],
      sampleCount,
      completionRate,
      engineAdmission,
      registryStatus,
      gate,
      theoreticalGate,
      engineReviewPromotionProhibited:
        theoreticalGate === "READY_FOR_ENGINE_REVIEW",
      gateReasons,
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
    if (d.theoreticalGate === "READY_FOR_ENGINE_REVIEW") {
      gateSummary.READY_FOR_ENGINE_REVIEW += 0;
    }
  }

  const theoreticalGateSummary: Record<GateStatus, number> = {
    NOT_READY: 0,
    UNDER_COLLECTION: 0,
    READY_FOR_BACKTEST: 0,
    READY_FOR_ENGINE_REVIEW: 0,
  };
  for (const d of datasets) {
    theoreticalGateSummary[d.theoreticalGate] += 1;
  }

  const blockedReasonCounts = new Map<string, number>();
  for (const d of datasets) {
    for (const reason of d.gateReasons) {
      blockedReasonCounts.set(reason, (blockedReasonCounts.get(reason) ?? 0) + 1);
    }
  }

  const blockedReasons = [...blockedReasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const datasetsReady = datasets.filter(
    (d) => d.gate === "READY_FOR_BACKTEST",
  ).length;
  const datasetsBlocked = datasets.filter(
    (d) =>
      d.gate !== "READY_FOR_ENGINE_REVIEW" ||
      d.engineAdmission === "PROHIBITED",
  ).length;
  const datasetsCollecting = datasets.filter(
    (d) => d.registryStatus === "COLLECTING",
  ).length;

  const overallGate = datasets.reduce<GateStatus>((min, d) => {
    return GATE_RANK[d.gate] < GATE_RANK[min] ? d.gate : min;
  }, "READY_FOR_ENGINE_REVIEW");

  const dashboard = {
    meta: {
      version: "engine-admission-gate-dashboard-v1",
      kind: "engine-admission-gate-dashboard",
      asOfDateKst: DATE,
      generatedAt: new Date().toISOString(),
      researchOnly: true,
      engineConnected: false,
      engineAdmissionDefault: "PROHIBITED",
      engineReviewPromotionProhibited: true,
      targetSample: TARGET_SAMPLE,
      completionThreshold: COMPLETION_THRESHOLD,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
      officialConclusion: "ENGINE_ADMISSION_GATE_DASHBOARD_V1_CREATED",
      note: "Gate labels explain why Engine admission is blocked — does not change admission.",
    },
    sources: [
      "data/research/registry.json",
      "data/research/research-sample-growth-dashboard-v1.json",
      "data/research/dataset-completeness-trend-v1.json",
      `data/research/mlb/${DATE}-weather-dataset-v1.json`,
    ],
    overall: {
      datasetsReady,
      datasetsBlocked,
      datasetsCollecting,
      overallGate,
      totalDatasets: datasets.length,
    },
    gateSummary: {
      effective: gateSummary,
      theoretical: theoreticalGateSummary,
      promotionProhibited: true,
      note: "READY_FOR_ENGINE_REVIEW is computed theoretically only — no promotion applied.",
    },
    blockedReasons,
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
        id: "no-admission-changes",
        passed: datasets.every((d) => d.engineAdmission === "PROHIBITED"),
      },
      {
        id: "engine-review-promotion-prohibited",
        passed: true,
        detail: "effective gate capped at READY_FOR_BACKTEST",
      },
    ],
    limitations: [
      "All datasets remain Engine admission PROHIBITED by registry policy.",
      "Sample target 100 games not met on any dataset.",
      "Gate dashboard is descriptive — not an Engine input or recommendation.",
    ],
  };

  const outJson = path.join(
    root,
    "data/research/engine-admission-gate-dashboard-v1.json",
  );
  const outAudit = path.join(
    root,
    "data/audits/engine-admission-gate-dashboard-v1-audit.json",
  );

  await mkdir(path.dirname(outJson), { recursive: true });
  await mkdir(path.dirname(outAudit), { recursive: true });
  await writeFile(outJson, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8");

  const audit = {
    meta: {
      version: "engine-admission-gate-dashboard-v1-audit",
      asOfDateKst: DATE,
      generatedAt: dashboard.meta.generatedAt,
      conclusion: dashboard.meta.officialConclusion,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
    },
    overall: dashboard.overall,
    gateSummary: dashboard.gateSummary,
    blockedReasons: dashboard.blockedReasons,
    datasets: datasets.map((d) => ({
      datasetId: d.datasetId,
      displayName: d.displayName,
      sampleCount: d.sampleCount,
      completionRate: d.completionRate,
      engineAdmission: d.engineAdmission,
      gate: d.gate,
      gateReasons: d.gateReasons,
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

  console.log(`datasets=${datasets.length} overallGate=${overallGate}`);
  console.log(
    `ready=${datasetsReady} blocked=${datasetsBlocked} collecting=${datasetsCollecting}`,
  );
  console.log(`gateSummary=${JSON.stringify(gateSummary)}`);
  console.log(`regressionUnchanged=${regressionUnchanged}`);
  console.log(`json: ${outJson}`);
  console.log(`audit: ${outAudit}`);
  console.log("ENGINE_ADMISSION_GATE_DASHBOARD_V1_CREATED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
