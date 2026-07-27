/**
 * Dataset Coverage Dashboard v1 — read-only research summary.
 * No Engine / Dataset / Framework / hypothesis status changes.
 *
 *   npx tsx scripts/build-dataset-coverage-dashboard-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE = process.argv[2]?.trim() || "2026-07-27";
const TARGET_GAMES = 100;

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

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(rel: string): Promise<unknown | null> {
  const p = path.join(process.cwd(), rel);
  if (!(await exists(p))) return null;
  return JSON.parse(await readFile(p, "utf8"));
}

async function main() {
  const root = process.cwd();
  const predPath = path.join(root, "data/predictions/mlb", `${DATE}.json`);
  const predHash = createHash("sha256")
    .update(await readFile(predPath, "utf8"))
    .digest("hex");

  const registry = asRecord(await readJson("data/research/registry.json"));
  const registryDatasets = Array.isArray(registry?.datasets)
    ? (registry.datasets as unknown[])
    : [];

  const starter = asRecord(
    await readJson(`data/research/mlb/${DATE}-starter-dataset-v1.json`),
  );
  const bullpen = asRecord(
    await readJson(`data/research/mlb/${DATE}-bullpen-role-dataset-v1_1.json`),
  );
  const lineup = asRecord(
    await readJson(`data/research/mlb/${DATE}-lineup-dataset-v1.json`),
  );
  const evidence = asRecord(
    await readJson("data/research/hypothesis-evidence-ledger.json"),
  );
  const contradiction = asRecord(
    await readJson("data/research/contradiction-ledger-v1.json"),
  );
  const severity = asRecord(
    await readJson("data/research/contradiction-severity-audit-v1.json"),
  );

  const starterSummary = asRecord(starter?.summary);
  const bullpenSummary = asRecord(bullpen?.summary);
  const lineupSummary = asRecord(lineup?.summary);
  const bullpenGames = Array.isArray(bullpen?.games) ? bullpen.games.length : 0;

  type DatasetRow = {
    datasetId: string;
    displayName: string;
    status: string;
    schemaVersion: string | null;
    builderVersion: string | null;
    engineAdmission: string;
    inFrameworkRegistry: boolean;
    artifactPresent: boolean;
    artifactPath: string | null;
    games: number | null;
    rows: number | null;
    sampleTarget: number;
    coveragePctOfTarget: number | null;
    notes: string[];
  };

  const datasets: DatasetRow[] = [];

  for (const raw of registryDatasets) {
    const d = asRecord(raw);
    if (!d) continue;
    const datasetId = asString(d.datasetId) ?? "?";
    const artifactPath = asString(d.artifactDatasetPath);
    let games: number | null = null;
    let rows: number | null = null;
    let notes: string[] = [];

    if (datasetId === "mlb-starter" && starter) {
      games = asNumber(starterSummary?.totalGames);
      rows = asNumber(starterSummary?.totalRows);
      notes = [
        `status=${asString(asRecord(starter.meta)?.status) ?? "COLLECTING"}`,
        "pre-game freeze; Engine PROHIBITED",
      ];
    } else if (datasetId === "mlb-bullpen-role" && bullpen) {
      games = bullpenGames;
      rows = asNumber(bullpenSummary?.classifiedPitcherRows);
      notes = [
        "v1.1 classifier",
        `uniquePitchers=${asNumber(bullpenSummary?.uniquePlayerIds) ?? "?"}`,
      ];
    } else if (datasetId === "mlb-lineup" && lineup) {
      games = asNumber(lineupSummary?.totalGames);
      rows = asNumber(lineupSummary?.teamLineups);
      notes = [
        `status=${asString(asRecord(lineup.meta)?.status) ?? "COLLECTING"}`,
        "post-game actual only; pre-game NOT_COLLECTED",
      ];
    } else if (asString(d.status) === "NOT_STARTED") {
      notes = ["no artifact yet"];
    }

    datasets.push({
      datasetId,
      displayName:
        datasetId === "mlb-starter"
          ? "Starter Dataset v1"
          : datasetId === "mlb-bullpen-role"
            ? "Bullpen Role Dataset v1.1"
            : datasetId === "mlb-lineup"
              ? "Lineup Dataset v1"
              : datasetId,
      status: asString(d.status) ?? "UNKNOWN",
      schemaVersion: asString(d.schemaVersion),
      builderVersion: asString(d.builderVersion),
      engineAdmission: asString(d.engineAdmission) ?? "PROHIBITED",
      inFrameworkRegistry: true,
      artifactPresent: artifactPath != null && (await exists(path.join(root, artifactPath))),
      artifactPath,
      games,
      rows,
      sampleTarget: TARGET_GAMES,
      coveragePctOfTarget:
        games != null ? Math.round((games / TARGET_GAMES) * 1000) / 10 : null,
      notes,
    });
  }

  const hypRows = Array.isArray(evidence?.hypotheses)
    ? (evidence.hypotheses as unknown[])
    : [];
  const hypothesisCounts = hypRows.map((raw) => {
    const h = asRecord(raw);
    const supporting = Array.isArray(h?.supportingEvents)
      ? h.supportingEvents.length
      : 0;
    const contradicting = Array.isArray(h?.contradictingEvents)
      ? h.contradictingEvents.length
      : 0;
    const contradictionRefs = Array.isArray(h?.contradictionLedgerRefs)
      ? h.contradictionLedgerRefs.length
      : 0;
    return {
      hypothesisId: asString(h?.hypothesisId) ?? "?",
      dataset: asString(h?.dataset) ?? null,
      currentStatus: asString(h?.currentStatus) ?? null,
      evidenceCount: asNumber(h?.evidenceCount) ?? supporting + contradicting,
      supportingEvents: supporting,
      contradictingEvents: contradicting,
      contradictionLedgerRefs: contradictionRefs,
      engineAdmission: asString(h?.engineAdmission) ?? "PROHIBITED",
    };
  });

  const lineupHypothesesFromMd: Array<Record<string, unknown>> = [];

  const contradictionTotals = asRecord(contradiction?.totals);
  const severityCounts = asRecord(
    asRecord(severity?.meta)?.severityCounts,
  );

  const coverageSummary = {
    collectingDatasets: datasets.filter((d) => d.status === "COLLECTING").length,
    notStartedDatasets: datasets.filter((d) => d.status === "NOT_STARTED").length,
    artifactsPresent: datasets.filter((d) => d.artifactPresent).length,
    registryEntries: registryDatasets.length,
    lineupRegistryGap: !datasets.find((d) => d.datasetId === "mlb-lineup")
      ?.inFrameworkRegistry,
    gradedGamesOnDate: asNumber(starterSummary?.totalGames) ?? 15,
    sampleTargetGames: TARGET_GAMES,
    belowMinimumSample: true,
  };

  const dashboard = {
    meta: {
      version: "dataset-coverage-dashboard-v1",
      kind: "coverage-dashboard",
      dateKst: DATE,
      generatedAt: new Date().toISOString(),
      researchOnly: true,
      engineConnected: false,
      engineCandidate: false,
      engineAdmission: "PROHIBITED",
      predictionHashSha256: predHash,
      predictionUnchanged: true,
      datasetFilesUnchanged: true,
      conclusion: "DATASET_COVERAGE_DASHBOARD_CREATED",
      note: "Read-only coverage summary from existing research artifacts. No scores or Engine admission.",
    },
    sources: [
      "data/research/registry.json",
      "src/lib/research/registry.ts",
      `data/research/mlb/${DATE}-starter-dataset-v1.json`,
      `data/research/mlb/${DATE}-bullpen-role-dataset-v1_1.json`,
      `data/research/mlb/${DATE}-lineup-dataset-v1.json`,
      "data/research/hypothesis-evidence-ledger.json",
      "data/research/contradiction-ledger-v1.json",
      "data/research/contradiction-severity-audit-v1.json",
      "HYPOTHESIS_REGISTRY.md",
      "RESEARCH_LOG.md",
    ],
    coverageSummary,
    datasets,
    hypotheses: {
      fromEvidenceLedger: hypothesisCounts,
      lineupRegistryOnly: lineupHypothesesFromMd,
      ledgerTotals: asRecord(evidence?.totals),
      registryDocCounts: {
        note: "HYPOTHESIS_REGISTRY.md operational counts (includes H-LU)",
        totalActiveApprox: 14,
        bullpen: 7,
        starter: 4,
        lineup: 3,
      },
    },
    contradictions: {
      eventCount: asNumber(contradictionTotals?.contradictionEvents) ?? 0,
      uniqueGames: asNumber(contradictionTotals?.uniqueGames) ?? 0,
      starter: asNumber(contradictionTotals?.starterContradictions) ?? 0,
      bullpen: asNumber(contradictionTotals?.bullpenContradictions) ?? 0,
      lineup: asNumber(contradictionTotals?.lineupContradictions) ?? 0,
      severityCounts: {
        LOW: asNumber(severityCounts?.LOW) ?? 0,
        MEDIUM: asNumber(severityCounts?.MEDIUM) ?? 0,
        HIGH: asNumber(severityCounts?.HIGH) ?? 0,
      },
    },
    limitations: [
      "Sample 15 games ≪ 100 target — do not claim PROMISING",
      "Dashboard is descriptive coverage only — not an Engine input",
    ],
  };

  const outJson = path.join(
    root,
    "data/research/dataset-coverage-dashboard-v1.json",
  );
  const outAudit = path.join(
    root,
    "data/audits",
    `dataset-coverage-dashboard-v1-${DATE}.json`,
  );
  const outMd = path.join(root, "DATASET_COVERAGE_DASHBOARD_V1.md");

  await mkdir(path.dirname(outJson), { recursive: true });
  await writeFile(outJson, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8");
  await writeFile(outAudit, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8");
  await writeFile(outMd, buildMarkdown(dashboard), "utf8");

  console.log(`json: ${outJson}`);
  console.log(`md: ${outMd}`);
  console.log(
    `datasets=${datasets.length} contradictions=${dashboard.contradictions.eventCount}`,
  );
}

function buildMarkdown(dashboard: {
  meta: Record<string, unknown>;
  coverageSummary: Record<string, unknown>;
  datasets: Array<Record<string, unknown>>;
  hypotheses: {
    fromEvidenceLedger: Array<Record<string, unknown>>;
    lineupRegistryOnly: Array<Record<string, unknown>>;
    ledgerTotals: Record<string, unknown> | null;
  };
  contradictions: Record<string, unknown>;
  limitations: string[];
}): string {
  const cs = dashboard.coverageSummary;
  const dsRows = dashboard.datasets
    .map(
      (d) =>
        `| ${d.datasetId} | ${d.status} | ${d.games ?? "—"} | ${d.rows ?? "—"} | ${d.coveragePctOfTarget != null ? `${d.coveragePctOfTarget}%` : "—"} | ${d.inFrameworkRegistry ? "yes" : "no"} | ${d.engineAdmission} |`,
    )
    .join("\n");

  const hypRows = [
    ...dashboard.hypotheses.fromEvidenceLedger,
    ...dashboard.hypotheses.lineupRegistryOnly,
  ]
    .map(
      (h) =>
        `| ${h.hypothesisId} | ${h.dataset ?? "—"} | ${h.currentStatus ?? "—"} | ${h.evidenceCount} | ${h.supportingEvents} | ${h.contradictingEvents} | ${h.contradictionLedgerRefs ?? 0} |`,
    )
    .join("\n");

  const sev = asRecord(dashboard.contradictions.severityCounts) ?? {};

  return `# Dataset Coverage Dashboard v1

연구 진행 현황 요약 (read-only). Engine·Score·Hypothesis 승격 없음.

근거: \`data/research/dataset-coverage-dashboard-v1.json\`

---

## Coverage summary

| 항목 | 값 |
|------|-----|
| dateKst | ${dashboard.meta.dateKst} |
| COLLECTING datasets | ${cs.collectingDatasets} |
| NOT_STARTED datasets | ${cs.notStartedDatasets} |
| artifacts present | ${cs.artifactsPresent} |
| Framework registry entries | ${cs.registryEntries} |
| graded games (asOf slate) | ${cs.gradedGamesOnDate} |
| sample target | ${cs.sampleTargetGames} |
| below minimum sample | ${cs.belowMinimumSample ? "yes" : "no"} |
| lineup registry gap | ${cs.lineupRegistryGap ? "yes (artifact only)" : "no"} |
| Engine candidate | ${dashboard.meta.engineCandidate ? "yes" : "no"} |

**공식 결론:** \`${dashboard.meta.conclusion}\`

---

## Datasets

| datasetId | status | games | rows | % of 100 | in registry | Engine |
|-----------|--------|------:|-----:|---------:|:-----------:|--------|
${dsRows}

---

## Hypotheses (evidence counts)

| ID | dataset | status | evidence | support | contradict | contradiction ledger refs |
|----|---------|--------|---------:|--------:|-----------:|--------------------------:|
${hypRows}

Evidence ledger totals: hypotheses=${dashboard.hypotheses.ledgerTotals?.hypothesisCount ?? "—"} · supporting=${dashboard.hypotheses.ledgerTotals?.supportingEventCount ?? "—"} · contradicting=${dashboard.hypotheses.ledgerTotals?.contradictingEventCount ?? "—"}

---

## Contradictions

| 항목 | 값 |
|------|-----|
| events | ${dashboard.contradictions.eventCount} |
| unique games | ${dashboard.contradictions.uniqueGames} |
| starter | ${dashboard.contradictions.starter} |
| bullpen | ${dashboard.contradictions.bullpen} |
| lineup | ${dashboard.contradictions.lineup} |
| severity HIGH / MEDIUM / LOW | ${sev.HIGH ?? 0} / ${sev.MEDIUM ?? 0} / ${sev.LOW ?? 0} |

---

## Limitations

${dashboard.limitations.map((l) => `- ${l}`).join("\n")}
`;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
