/**
 * MLB Daily Research Builder v1
 *
 * Orchestrator only — does not reimplement dataset collectors.
 * Calls existing builders in order, then computes Research Ready + Assistant Summary.
 *
 *   Schedule → Starter → Odds → Lineup → Research Ready → Assistant Summary
 *
 * Failed steps do not abort later steps.
 *
 *   npm run research:mlb-daily -- YYYY-MM-DD
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";
import { spawnLocalTsxScript } from "./lib/spawn-local-tsx";

const DATE = process.argv[2]?.trim() || getKstToday();
const SUMMARY_SCHEMA_VERSION = "mlb-daily-research-summary-v1";
const PIPELINE_VERSION = "mlb-daily-research-v1.1";
const ROUNDING_POLICY =
  "Per dataset: READY=weight, PARTIAL=floor(weight/2), FAILED/SKIP=0; percent=score because max=100.";

type StepStatus = "READY" | "PARTIAL" | "FAILED" | "SKIP";
type RunOutcome = "SUCCESS" | "FAIL";

type StepResult = {
  step: string;
  run: RunOutcome | "SKIP";
  status: StepStatus;
  detail: string;
  artifact: string | null;
  exitCode: number | null;
};

const results: StepResult[] = [];

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
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

async function readJson(rel: string): Promise<unknown | null> {
  try {
    return JSON.parse(
      await readFile(path.join(process.cwd(), rel), "utf8"),
    ) as unknown;
  } catch {
    return null;
  }
}

function artifactPaths(dateKst: string) {
  return {
    schedule: `data/research/mlb/${dateKst}-schedule-v1.json`,
    starter: `data/research/mlb/${dateKst}-starter-dataset-v1.json`,
    odds: `data/research/mlb/${dateKst}-odds-history-dataset-v1.json`,
    lineup: `data/research/mlb/${dateKst}-lineup-dataset-v1.json`,
    summary: `data/research/mlb/${dateKst}-daily-research-summary-v1.json`,
  };
}

type BuilderStep = {
  name: string;
  script: string;
  artifactKey: keyof ReturnType<typeof artifactPaths>;
  assess: (doc: unknown | null, artifactRel: string) => {
    status: StepStatus;
    detail: string;
  };
};

function assessSchedule(doc: unknown | null, artifactRel: string) {
  if (!doc) {
    return { status: "FAILED" as const, detail: `Missing ${artifactRel}` };
  }
  const root = asRecord(doc);
  const summary = asRecord(root?.summary);
  const total = asNumber(summary?.totalGames) ?? 0;
  if (total <= 0) {
    return { status: "FAILED" as const, detail: "Schedule has 0 games" };
  }
  return {
    status: "READY" as const,
    detail: `${total} games`,
  };
}

function assessStarter(doc: unknown | null, artifactRel: string) {
  if (!doc) {
    return { status: "FAILED" as const, detail: `Missing ${artifactRel}` };
  }
  const summary = asRecord(asRecord(doc)?.summary);
  const totalGames = asNumber(summary?.totalGames) ?? 0;
  const totalRows = asNumber(summary?.totalRows) ?? 0;
  const probable = asNumber(summary?.probableRows) ?? 0;
  const missing = asNumber(summary?.missingRows) ?? 0;
  if (totalGames <= 0 || totalRows <= 0) {
    return { status: "FAILED" as const, detail: "Starter artifact empty" };
  }
  if (missing === 0 && probable === totalRows) {
    return {
      status: "READY" as const,
      detail: `${totalGames} games / ${probable} probable complete`,
    };
  }
  return {
    status: "PARTIAL" as const,
    detail: `${totalGames} games / probable=${probable} missing=${missing}`,
  };
}

function assessOdds(doc: unknown | null, artifactRel: string) {
  if (!doc) {
    return { status: "FAILED" as const, detail: `Missing ${artifactRel}` };
  }
  const summary = asRecord(asRecord(doc)?.summary);
  const total = asNumber(summary?.totalGames) ?? 0;
  const collected =
    asNumber(summary?.collectedGames) ??
    asNumber(summary?.openingCollected) ??
    0;
  const status = asRecord(summary?.collectionStatus);
  const matched = asNumber(asRecord(summary?.joinQuality)?.MATCHED) ?? collected;
  if (total <= 0) {
    return { status: "FAILED" as const, detail: "Odds artifact empty" };
  }
  if (collected >= total && collected > 0) {
    return {
      status: "READY" as const,
      detail: `${collected}/${total} collected`,
    };
  }
  if (collected > 0 || matched > 0) {
    return {
      status: "PARTIAL" as const,
      detail: `${collected}/${total} collected (MATCHED=${matched})`,
    };
  }
  const notCollected =
    asNumber(status?.NOT_COLLECTED) ??
    asNumber(status?.MATCH_NOT_FOUND) ??
    total;
  return {
    status: "PARTIAL" as const,
    detail: `0/${total} collected (notCollected≈${notCollected})`,
  };
}

function assessLineup(doc: unknown | null, artifactRel: string) {
  if (!doc) {
    return { status: "FAILED" as const, detail: `Missing ${artifactRel}` };
  }
  const summary = asRecord(asRecord(doc)?.summary);
  const total = asNumber(summary?.totalGames) ?? 0;
  const confirmed = asNumber(summary?.confirmedGames) ?? 0;
  const partial = asNumber(summary?.partialGames) ?? 0;
  const notReleased = asNumber(summary?.notReleasedGames) ?? 0;
  if (total <= 0) {
    return { status: "FAILED" as const, detail: "Lineup artifact empty" };
  }
  if (confirmed >= total && confirmed > 0) {
    return {
      status: "READY" as const,
      detail: `${confirmed}/${total} confirmed`,
    };
  }
  if (confirmed > 0 || partial > 0) {
    return {
      status: "PARTIAL" as const,
      detail: `confirmed=${confirmed} partial=${partial} notReleased=${notReleased} / ${total}`,
    };
  }
  if (notReleased >= total) {
    return {
      status: "PARTIAL" as const,
      detail: `${notReleased}/${total} not released (artifact present)`,
    };
  }
  return {
    status: "PARTIAL" as const,
    detail: `confirmed=${confirmed}/${total}`,
  };
}

const STEPS: BuilderStep[] = [
  {
    name: "Schedule",
    script: "scripts/build-mlb-schedule-artifact-v1.ts",
    artifactKey: "schedule",
    assess: assessSchedule,
  },
  {
    name: "Starter",
    script: "scripts/run-mlb-starter-accumulation-with-summary-v1.ts",
    artifactKey: "starter",
    assess: assessStarter,
  },
  {
    name: "Odds",
    script: "scripts/build-mlb-odds-history-dataset-v1.ts",
    artifactKey: "odds",
    assess: assessOdds,
  },
  {
    name: "Lineup",
    script: "scripts/build-mlb-lineup-dataset-v1.ts",
    artifactKey: "lineup",
    assess: assessLineup,
  },
];

async function runStep(step: BuilderStep, dateKst: string): Promise<void> {
  const paths = artifactPaths(dateKst);
  const artifactRel = paths[step.artifactKey];

  console.log(`\n── START: ${step.name} ──`);
  let exitCode: number;
  try {
    exitCode = await spawnLocalTsxScript(step.script, [dateKst]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.log(`── END: ${step.name} FAIL ──`);
    results.push({
      step: step.name,
      run: "FAIL",
      status: "FAILED",
      detail: `spawn error: ${detail}`,
      artifact: artifactRel,
      exitCode: 1,
    });
    return;
  }

  const exists = await fileExists(path.join(process.cwd(), artifactRel));
  const doc = exists ? await readJson(artifactRel) : null;
  const assessed = step.assess(doc, artifactRel);

  // Builder may fail even if a prior artifact remains — prefer run outcome,
  // but still surface artifact quality when the file exists.
  let status = assessed.status;
  let run: RunOutcome = exitCode === 0 ? "SUCCESS" : "FAIL";
  if (exitCode !== 0 && !exists) {
    status = "FAILED";
  } else if (exitCode !== 0 && exists) {
    // Keep assessed quality (READY/PARTIAL) but mark run FAIL.
    if (status === "READY") status = "PARTIAL";
  }

  console.log(
    `── END: ${step.name} ${run} (artifact=${status}) ──`,
  );

  results.push({
    step: step.name,
    run,
    status,
    detail:
      exitCode === 0
        ? assessed.detail
        : `${assessed.detail} [builder exit ${exitCode}]`,
    artifact: exists ? artifactRel : null,
    exitCode,
  });
}

function computeResearchReady(): {
  score: number;
  max: number;
  percent: number;
  missing: string[];
  roundingPolicy: string;
  datasets: Array<{
    dataset: string;
    status: StepStatus;
    detail: string;
    artifact: string | null;
  }>;
  breakdown: Array<{
    dataset: string;
    status: StepStatus;
    weight: number;
    awardedPoints: number;
    maxPoints: number;
    ruleApplied: "FULL" | "HALF_FLOOR" | "ZERO";
    detail: string;
    artifact: string | null;
  }>;
} {
  const weights: Record<string, number> = {
    Schedule: 25,
    Starter: 25,
    Odds: 25,
    Lineup: 25,
  };
  let score = 0;
  const missing: string[] = [];
  const datasets: Array<{
    dataset: string;
    status: StepStatus;
    detail: string;
    artifact: string | null;
  }> = [];
  const breakdown: Array<{
    dataset: string;
    status: StepStatus;
    weight: number;
    awardedPoints: number;
    maxPoints: number;
    ruleApplied: "FULL" | "HALF_FLOOR" | "ZERO";
    detail: string;
    artifact: string | null;
  }> = [];

  for (const step of ["Schedule", "Starter", "Odds", "Lineup"]) {
    const r = results.find((x) => x.step === step);
    const weight = weights[step] ?? 0;
    const status = r?.status ?? "FAILED";
    datasets.push({
      dataset: step,
      status,
      detail: r?.detail ?? "not run",
      artifact: r?.artifact ?? null,
    });
    let awardedPoints = 0;
    let ruleApplied: "FULL" | "HALF_FLOOR" | "ZERO" = "ZERO";
    if (status === "READY") {
      awardedPoints = weight;
      ruleApplied = "FULL";
    } else if (status === "PARTIAL") {
      awardedPoints = Math.floor(weight / 2);
      ruleApplied = "HALF_FLOOR";
      missing.push(step);
    } else {
      missing.push(step);
    }
    score += awardedPoints;
    breakdown.push({
      dataset: step,
      status,
      weight,
      awardedPoints,
      maxPoints: weight,
      ruleApplied,
      detail: r?.detail ?? "not run",
      artifact: r?.artifact ?? null,
    });
  }

  return {
    score,
    max: 100,
    percent: score,
    missing,
    datasets,
    roundingPolicy: ROUNDING_POLICY,
    breakdown,
  };
}

function buildAssistantSummary(input: {
  dateKst: string;
  ready: ReturnType<typeof computeResearchReady>;
  counts: {
    scheduleGames: number | null;
    starterComplete: string | null;
    oddsCollected: string | null;
    lineupConfirmed: string | null;
  };
}): string[] {
  const lines: string[] = [
    `MLB Daily Research Assistant Summary (${input.dateKst})`,
    "",
    `Schedule: ${input.counts.scheduleGames ?? "—"} games`,
    `Starter: ${input.counts.starterComplete ?? "—"}`,
    `Odds: ${input.counts.oddsCollected ?? "—"}`,
    `Lineup: ${input.counts.lineupConfirmed ?? "—"}`,
    "",
    `Research Ready: ${input.ready.percent}%`,
  ];

  for (const d of input.ready.datasets) {
    lines.push(`  - ${d.dataset}: ${d.status} (${d.detail})`);
  }

  if (input.ready.missing.length > 0) {
    lines.push("");
    lines.push("Remaining gaps:");
    for (const m of input.ready.missing) {
      lines.push(`  - ${m}`);
    }
  }

  lines.push("");
  lines.push(
    "This summary describes current data quality only. No predictions.",
  );
  return lines;
}

async function extractCounts(dateKst: string) {
  const paths = artifactPaths(dateKst);
  const schedule = asRecord(await readJson(paths.schedule));
  const starter = asRecord(await readJson(paths.starter));
  const odds = asRecord(await readJson(paths.odds));
  const lineup = asRecord(await readJson(paths.lineup));

  const scheduleGames =
    asNumber(asRecord(schedule?.summary)?.totalGames) ?? null;

  const starterSummary = asRecord(starter?.summary);
  const starterComplete =
    starterSummary == null
      ? null
      : `${asNumber(starterSummary.probableRows) ?? 0}/${asNumber(starterSummary.totalRows) ?? 0} probable`;

  const oddsSummary = asRecord(odds?.summary);
  const oddsCollected =
    oddsSummary == null
      ? null
      : `${asNumber(oddsSummary.collectedGames) ?? asNumber(oddsSummary.openingCollected) ?? 0}/${asNumber(oddsSummary.totalGames) ?? 0} collected`;

  const lineupSummary = asRecord(lineup?.summary);
  const lineupConfirmed =
    lineupSummary == null
      ? null
      : `${asNumber(lineupSummary.confirmedGames) ?? 0}/${asNumber(lineupSummary.totalGames) ?? 0} confirmed`;

  return {
    scheduleGames,
    starterComplete,
    oddsCollected,
    lineupConfirmed,
  };
}

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) {
    console.error("Usage: npm run research:mlb-daily -- YYYY-MM-DD");
    process.exitCode = 1;
    return;
  }

  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  MLB Daily Research Builder v1           ║`);
  console.log(`║  Date: ${DATE}                       ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(
    "\nPipeline: Schedule → Starter → Odds → Lineup → Research Ready → Assistant Summary\n",
  );

  for (const step of STEPS) {
    await runStep(step, DATE);
  }

  const ready = computeResearchReady();
  const counts = await extractCounts(DATE);
  const assistantLines = buildAssistantSummary({
    dateKst: DATE,
    ready,
    counts,
  });

  console.log(`\n── Research Ready ──────────────────────────`);
  console.log(`  Score: ${ready.score} / ${ready.max} (${ready.percent}%)`);
  for (const d of ready.datasets) {
    console.log(`    ${d.dataset.padEnd(12)} ${d.status.padEnd(8)} ${d.detail}`);
  }

  console.log(`\n── Assistant Summary ───────────────────────`);
  for (const line of assistantLines) {
    console.log(`  ${line}`);
  }

  const summaryPath = path.join(
    process.cwd(),
    artifactPaths(DATE).summary,
  );
  const summary = {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    dateKst: DATE,
    generatedAt: new Date().toISOString(),
    pipelineVersion: PIPELINE_VERSION,
    roundingPolicy: ready.roundingPolicy,
    pipeline: ["Schedule", "Starter", "Odds", "Lineup"],
    steps: results.map((r) => ({
      step: r.step,
      run: r.run,
      status: r.status,
      detail: r.detail,
      artifact: r.artifact,
      exitCode: r.exitCode,
    })),
    researchReady: {
      score: ready.score,
      max: ready.max,
      percent: ready.percent,
      missing: ready.missing,
      datasets: ready.datasets,
      breakdown: ready.breakdown,
    },
    sourceArtifacts: results.map((r) => ({
      dataset: r.step,
      status: r.status,
      produced: r.artifact != null,
      artifact: r.artifact,
    })),
    counts,
    assistantSummary: assistantLines.join("\n"),
    notes: [
      "Orchestrator only — dataset builders were invoked, not reimplemented.",
      "Research Ready is based on generated artifacts.",
      "Assistant Summary describes data quality only; no predictions.",
    ],
  };

  await mkdir(path.dirname(summaryPath), { recursive: true });
  await writeFile(
    summaryPath,
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  console.log(`\n  Summary → ${path.relative(process.cwd(), summaryPath)}`);

  const failRuns = results.filter((r) => r.run === "FAIL").length;
  if (failRuns > 0) {
    console.log(`\n⚠ ${failRuns} builder step(s) reported FAIL (pipeline continued).`);
    process.exitCode = 0; // partial success still produces summary
  }
  console.log("\nMLB_DAILY_RESEARCH_BUILDER_V1_COMPLETE\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
