/**
 * MLB Cross-Dataset Evidence Ledger v2 — read-only combination frequency from Correlation Audit v2.
 *
 * - Records which dataset combinations co-occurred per game
 * - Frequency counts only (worked / failed / pending) — no scores, weights, or recommendations
 * - Engine / Viewer / Prediction mutation PROHIBITED
 *
 *   npx tsx scripts/build-cross-dataset-evidence-ledger-v2.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

const DATASET_KEYS = [
  "starter",
  "bullpen",
  "lineup",
  "weather",
  "travel",
  "odds",
  "injury",
] as const;

type DatasetKey = (typeof DATASET_KEYS)[number];
type CollectionStatus = "NOT_COLLECTED" | "PARTIAL" | "COMPLETE";

const DISPLAY: Record<DatasetKey, string> = {
  starter: "Starter",
  bullpen: "Bullpen",
  lineup: "Lineup",
  weather: "Weather",
  travel: "Travel",
  odds: "Odds History",
  injury: "Injury",
};

type DatasetPresence = {
  status: CollectionStatus;
  present: boolean;
  rowCount: number;
};

type PredictionResult = {
  resultStatus: string | null;
  predictionHit: boolean | null;
  worked: boolean;
  failed: boolean;
  pending: boolean;
};

type CorrelationGame = {
  gameId: string;
  match: string;
  starter: DatasetPresence;
  bullpen: DatasetPresence;
  lineup: DatasetPresence;
  weather: DatasetPresence;
  travel: DatasetPresence;
  odds: DatasetPresence;
  injury: DatasetPresence;
  predictionResult: PredictionResult;
};

type GameEvidence = {
  gameId: string;
  match: string;
  dateKst: string;
  predictionResult: {
    resultStatus: string | null;
    worked: boolean;
    failed: boolean;
    pending: boolean;
  };
  datasetsPresent: DatasetKey[];
  datasetsComplete: DatasetKey[];
  datasetsPartial: DatasetKey[];
  datasetsMissing: DatasetKey[];
  combinations: string[];
};

type CombinationFrequency = {
  combination: string;
  datasets: DatasetKey[];
  gameCount: number;
  worked: number;
  failed: number;
  pending: number;
};

type LedgerRun = {
  dateKst: string;
  auditedGames: number;
  correlationAuditPath: string;
  predictionWorked: number;
  predictionFailed: number;
  predictionPending: number;
  games: GameEvidence[];
};

type LedgerDoc = {
  meta: Record<string, unknown>;
  datasets: DatasetKey[];
  datasetDisplayNames: Record<DatasetKey, string>;
  inputPaths: Record<string, string>;
  regressionHashes: {
    before: Record<string, string>;
    after: Record<string, string>;
    unchanged: boolean;
  };
  runs: LedgerRun[];
  combinationFrequency: CombinationFrequency[];
  checks: Array<{ id: string; passed: boolean; detail?: string }>;
  notes: string[];
};

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function combinationLabel(keys: DatasetKey[]): string {
  return keys.map((k) => DISPLAY[k]).join(" + ");
}

function subsetsOfPresent(present: DatasetKey[]): DatasetKey[][] {
  const out: DatasetKey[][] = [];
  const n = present.length;
  for (let mask = 1; mask < 1 << n; mask += 1) {
    const combo: DatasetKey[] = [];
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) combo.push(present[i]!);
    }
    if (combo.length >= 2) out.push(combo);
  }
  return out;
}

function buildGameEvidence(game: CorrelationGame, dateKst: string): GameEvidence {
  const datasetsPresent: DatasetKey[] = [];
  const datasetsComplete: DatasetKey[] = [];
  const datasetsPartial: DatasetKey[] = [];
  const datasetsMissing: DatasetKey[] = [];

  for (const key of DATASET_KEYS) {
    const p = game[key];
    if (p.status === "NOT_COLLECTED") datasetsMissing.push(key);
    else datasetsPresent.push(key);
    if (p.status === "COMPLETE") datasetsComplete.push(key);
    if (p.status === "PARTIAL") datasetsPartial.push(key);
  }

  const combos = subsetsOfPresent(datasetsPresent)
    .map((keys) => combinationLabel([...keys].sort()))
    .sort();

  return {
    gameId: game.gameId,
    match: game.match,
    dateKst,
    predictionResult: {
      resultStatus: game.predictionResult.resultStatus,
      worked: game.predictionResult.worked,
      failed: game.predictionResult.failed,
      pending: game.predictionResult.pending,
    },
    datasetsPresent,
    datasetsComplete,
    datasetsPartial,
    datasetsMissing,
    combinations: combos,
  };
}

function aggregateCombinationFrequency(runs: LedgerRun[]): CombinationFrequency[] {
  const map = new Map<string, CombinationFrequency>();

  for (const run of runs) {
    for (const game of run.games) {
      const present = [...game.datasetsPresent].sort();
      for (const keys of subsetsOfPresent(present)) {
        const sorted = [...keys].sort();
        const label = combinationLabel(sorted);
        const cell =
          map.get(label) ??
          ({
            combination: label,
            datasets: sorted,
            gameCount: 0,
            worked: 0,
            failed: 0,
            pending: 0,
          } satisfies CombinationFrequency);
        cell.gameCount += 1;
        if (game.predictionResult.worked) cell.worked += 1;
        if (game.predictionResult.failed) cell.failed += 1;
        if (game.predictionResult.pending) cell.pending += 1;
        map.set(label, cell);
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.datasets.length !== b.datasets.length) {
      return a.datasets.length - b.datasets.length;
    }
    return a.combination.localeCompare(b.combination);
  });
}

async function main() {
  console.log(`=== MLB Cross-Dataset Evidence Ledger v2 (${DATE}) ===`);

  const root = process.cwd();
  const correlationPath = path.join(
    root,
    "data/audits",
    `${DATE}-dataset-correlation-v2.json`,
  );
  const paths = {
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
    correlationAudit: correlationPath,
  };

  for (const [name, p] of Object.entries(paths)) {
    if (!(await fileExists(p))) {
      throw new Error(`missing input ${name}: ${p}`);
    }
  }

  const hashBefore = {
    prediction: sha256(await readFile(paths.prediction, "utf8")),
    starter: sha256(await readFile(paths.starter, "utf8")),
    bullpen: sha256(await readFile(paths.bullpen, "utf8")),
    lineup: sha256(await readFile(paths.lineup, "utf8")),
    weather: sha256(await readFile(paths.weather, "utf8")),
    travel: sha256(await readFile(paths.travel, "utf8")),
    odds: sha256(await readFile(paths.odds, "utf8")),
    injury: sha256(await readFile(paths.injury, "utf8")),
  };

  const correlation = JSON.parse(await readFile(correlationPath, "utf8")) as {
    games: CorrelationGame[];
    meta?: { predictionHashSha256?: string };
  };

  const gameEvidence = correlation.games
    .map((g) => buildGameEvidence(g, DATE))
    .sort((a, b) => a.gameId.localeCompare(b.gameId));

  const worked = gameEvidence.filter((g) => g.predictionResult.worked).length;
  const failed = gameEvidence.filter((g) => g.predictionResult.failed).length;
  const pending = gameEvidence.filter((g) => g.predictionResult.pending).length;

  const run: LedgerRun = {
    dateKst: DATE,
    auditedGames: gameEvidence.length,
    correlationAuditPath: paths.correlationAudit,
    predictionWorked: worked,
    predictionFailed: failed,
    predictionPending: pending,
    games: gameEvidence,
  };

  const outPath = path.join(
    root,
    "data/research/cross-dataset-evidence-ledger-v2.json",
  );

  let existingRuns: LedgerRun[] = [];
  if (await fileExists(outPath)) {
    const existing = JSON.parse(await readFile(outPath, "utf8")) as LedgerDoc;
    existingRuns = (existing.runs ?? []).filter((r) => r.dateKst !== DATE);
  }

  const runs = [...existingRuns, run].sort((a, b) =>
    a.dateKst.localeCompare(b.dateKst),
  );
  const combinationFrequency = aggregateCombinationFrequency(runs);

  const hashAfter = {
    prediction: sha256(await readFile(paths.prediction, "utf8")),
    starter: sha256(await readFile(paths.starter, "utf8")),
    bullpen: sha256(await readFile(paths.bullpen, "utf8")),
    lineup: sha256(await readFile(paths.lineup, "utf8")),
    weather: sha256(await readFile(paths.weather, "utf8")),
    travel: sha256(await readFile(paths.travel, "utf8")),
    odds: sha256(await readFile(paths.odds, "utf8")),
    injury: sha256(await readFile(paths.injury, "utf8")),
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

  const uniqueCombinations = new Set(
    gameEvidence.flatMap((g) => g.combinations),
  );

  const ledger: LedgerDoc = {
    meta: {
      version: "cross-dataset-evidence-ledger-v2",
      kind: "cross-dataset-evidence-ledger",
      generatedAt: new Date().toISOString(),
      latestDateKst: DATE,
      totalRuns: runs.length,
      auditedGamesLatest: gameEvidence.length,
      uniqueCombinationsLatest: uniqueCombinations.size,
      totalCombinationEntries: combinationFrequency.length,
      datasets: [...DATASET_KEYS],
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      researchOnly: true,
      combinationPurpose: "frequency-only",
      noScores: true,
      noWeights: true,
      noImportance: true,
      noConfidence: true,
      noRecommendations: true,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
      correlationAuditSource: paths.correlationAudit,
      officialConclusion: "CROSS_DATASET_EVIDENCE_LEDGER_V2_CREATED",
    },
    datasets: [...DATASET_KEYS],
    datasetDisplayNames: DISPLAY,
    inputPaths: paths,
    regressionHashes: {
      before: hashBefore,
      after: hashAfter,
      unchanged: regressionUnchanged,
    },
    runs,
    combinationFrequency,
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
        id: "no-importance-scores",
        passed: true,
        detail: "frequency-only ledger",
      },
      {
        id: "engine-prohibited",
        passed: true,
      },
    ],
    notes: [
      "Combination frequency counts co-present datasets per game — not causal importance.",
      "Only combinations with ≥2 present datasets are recorded.",
      "Worked / Failed / Pending mirror prediction grading from Correlation Audit v2.",
      "Re-running for the same dateKst replaces that run entry.",
    ],
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  const failedChecks = ledger.checks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    throw new Error(
      `ledger checks failed: ${failedChecks.map((c) => c.id).join(", ")}`,
    );
  }

  console.log(`games=${gameEvidence.length} combinations=${uniqueCombinations.size}`);
  console.log(
    `frequencyEntries=${combinationFrequency.length} worked=${worked} failed=${failed} pending=${pending}`,
  );
  console.log(`regressionUnchanged=${regressionUnchanged}`);
  console.log(`저장: ${outPath}`);
  console.log("CROSS_DATASET_EVIDENCE_LEDGER_V2_CREATED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
