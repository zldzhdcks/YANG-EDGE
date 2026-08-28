/**
 * 2026-08-29 B2 pregame input coverage — OWNER-reviewed seal.
 *
 * Replay-only. Inspects already-stored lawful pregame datasets.
 * Does not call Odds API, Result, /predictions, or Engine.
 * Operator odds remain marketBenchmarkOnly.
 *
 *   npx tsx scripts/audit-2026-08-29-pregame-input-coverage-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DATE_KST,
  FROZEN_FORMAL_OBSERVED_AT,
  LOCK_REL,
  sha256File,
} from "./lock-2026-08-29-daily-scope-v1";
import { B1_REL, runB1 } from "./audit-2026-08-29-schedule-identity-reconciliation-v1";

export const B2_REL = "data/audits/2026-08-29-pregame-input-coverage-v1.json";
export const SEALED_B2_HASH =
  "c769e56eeb7fbe7afc895b7253ed0f81585f0a3d86b218dc2abe4c9b5aafd838";

type CoverageState = "COLLECTED" | "PARTIAL" | "NOT_COLLECTED" | "BLOCKED";

type DatasetProbe = {
  dataset: string;
  rel: string;
  state: CoverageState;
  reason: string;
};

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function probe(cwd: string, dataset: string, rel: string, missingReason: string): DatasetProbe {
  const abs = path.join(cwd, rel);
  if (existsSync(abs)) {
    return {
      dataset,
      rel,
      state: "COLLECTED",
      reason: "Stored lawful pregame artifact exists.",
    };
  }
  return {
    dataset,
    rel,
    state: "NOT_COLLECTED",
    reason: missingReason,
  };
}

export async function runB2(cwd = process.cwd()) {
  const b1 = await runB1(cwd);
  const games = b1.document.games as Array<{
    operatorGameId: string;
    sport: string;
    league: string;
    displayedStartKst: string;
    rawHome: string;
    rawAway: string;
    rawMatchup: string;
    status: string;
    scheduledStartAt: string | null;
    gamePk: number | null;
  }>;

  const mlbDatasets: DatasetProbe[] = [
    probe(
      cwd,
      "schedule",
      `data/research/mlb/${DATE_KST}-schedule-v1.json`,
      "MLB schedule artifact missing.",
    ),
    probe(
      cwd,
      "starter",
      `data/research/mlb/${DATE_KST}-starter-dataset-v1.json`,
      "No 2026-08-29 starter-dataset-v1.json. Schedule artifact also has no probablePitcher fields.",
    ),
    probe(
      cwd,
      "bullpen",
      `data/research/mlb/${DATE_KST}-bullpen-role-dataset-v1_1.json`,
      "No 2026-08-29 bullpen-role dataset.",
    ),
    probe(
      cwd,
      "lineup",
      `data/research/mlb/${DATE_KST}-lineup-dataset-v1.json`,
      "No 2026-08-29 lineup-dataset-v1.json. Operator batch had 0 lineup screenshots.",
    ),
    probe(
      cwd,
      "injury",
      `data/research/mlb/${DATE_KST}-injury-dataset-v1.json`,
      "No 2026-08-29 injury dataset.",
    ),
    probe(
      cwd,
      "weather",
      `data/research/mlb/${DATE_KST}-weather-dataset-v1.json`,
      "No 2026-08-29 weather dataset.",
    ),
    probe(
      cwd,
      "travelRest",
      `data/research/mlb/${DATE_KST}-travel-rest-dataset-v1.json`,
      "No 2026-08-29 travel/rest dataset.",
    ),
  ];
  const lineupRefreshRel = `data/research/mlb/lineup-refresh/${DATE_KST}/manifest-v1.json`;
  mlbDatasets.push(
    probe(
      cwd,
      "lineupRefresh",
      lineupRefreshRel,
      "No 2026-08-29 lineup-refresh manifest.",
    ),
  );

  const coverageByDataset: Record<string, { state: CoverageState; gamesCovered: number; reason: string }> = {};
  for (const d of mlbDatasets) {
    coverageByDataset[d.dataset] = {
      state: d.state,
      gamesCovered: d.dataset === "schedule" && d.state === "COLLECTED" ? games.filter((g) => g.sport === "MLB" && g.status === "MATCHED").length : 0,
      reason: d.reason,
    };
  }

  const gameCoverage = games.map((g) => {
    if (g.sport === "FOOTBALL") {
      const blocked =
        g.status === "COMPETITION_REVIEW_REQUIRED"
          ? "PASS_COMPETITION_REVIEW_REQUIRED"
          : "PASS_IDENTITY_REVIEW_REQUIRED";
      return {
        operatorGameId: g.operatorGameId,
        sport: g.sport,
        rawMatchup: g.rawMatchup,
        b1Status: g.status,
        coverageState: "BLOCKED" as const,
        blockReason: blocked,
        datasets: {
          starter: "BLOCKED",
          bullpen: "BLOCKED",
          lineup: "BLOCKED",
          injury: "BLOCKED",
          weather: "BLOCKED",
          travelRest: "BLOCKED",
        },
        marketOddsRole: {
          marketBenchmarkOnly: true,
          predictionInput: false,
          engineInput: false,
          note: "Operator odds are comparison-only. Not a model input.",
        },
      };
    }
    if (g.sport === "BASKETBALL") {
      return {
        operatorGameId: g.operatorGameId,
        sport: g.sport,
        rawMatchup: g.rawMatchup,
        b1Status: g.status,
        coverageState: "BLOCKED" as const,
        blockReason: "PASS_PROVIDER_NOT_SUPPORTED",
        datasets: {
          starter: "BLOCKED",
          bullpen: "BLOCKED",
          lineup: "BLOCKED",
          injury: "BLOCKED",
          weather: "BLOCKED",
          travelRest: "BLOCKED",
        },
        marketOddsRole: {
          marketBenchmarkOnly: true,
          predictionInput: false,
          engineInput: false,
          note: "Operator odds are comparison-only. Not a model input.",
        },
      };
    }
    const datasetStates = Object.fromEntries(
      mlbDatasets
        .filter((d) => d.dataset !== "schedule" && d.dataset !== "lineupRefresh")
        .map((d) => [d.dataset, d.state]),
    );
    const missing = mlbDatasets.filter(
      (d) =>
        d.dataset !== "schedule" &&
        d.dataset !== "lineupRefresh" &&
        d.state !== "COLLECTED",
    );
    return {
      operatorGameId: g.operatorGameId,
      sport: g.sport,
      rawMatchup: g.rawMatchup,
      b1Status: g.status,
      coverageState: missing.length === 0 ? ("COLLECTED" as const) : ("PARTIAL" as const),
      blockReason: null,
      schedule: coverageByDataset.schedule.state,
      datasets: datasetStates,
      missingDatasets: missing.map((d) => d.dataset),
      marketOddsRole: {
        marketBenchmarkOnly: true,
        predictionInput: false,
        engineInput: false,
        note: "Operator odds are comparison-only. Not a model input. No Odds API collection this run.",
      },
    };
  });

  const document = {
    schemaVersion: "yang-edge-pregame-input-coverage-v1",
    dateKst: DATE_KST,
    stage: "B2",
    candidateStatus: "OWNER_REVIEW_CANDIDATE",
    b1Rel: B1_REL,
    b1Sha256: b1.sha256,
    sealedLockRel: LOCK_REL,
    sealedLockSha256: sha256File(path.join(cwd, LOCK_REL)),
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    researchOnly: true,
    marketFirewall: {
      marketBenchmarkOnly: true,
      predictionInput: false,
      engineInput: false,
      marketPriorUsed: false,
      marketImpliedProbabilityUsed: false,
      favoriteStatusUsed: false,
      oddsApiLiveCalls: 0,
      note: "Operator odds remain marketBenchmarkOnly. Market is comparison-only after Prediction. Not collected as model input.",
    },
    resultCalls: 0,
    predictionProviderCalls: 0,
    engineModified: false,
    weightsModified: false,
    coverageByDataset,
    mlbDatasetProbes: mlbDatasets,
    football: {
      official: games.filter((g) => g.sport === "FOOTBALL").length,
      coverageState: "BLOCKED",
      reason: "Identity/competition review required. Existing approved aliases were not sufficient. No new aliases added.",
    },
    basketball: {
      official: games.filter((g) => g.sport === "BASKETBALL").length,
      coverageState: "BLOCKED",
      reason: "PROVIDER_NOT_SUPPORTED. Games retained, not dropped.",
    },
    games: gameCoverage,
    note: "B2 candidate. Replay/inspect only. No live Odds API. No Result. Do not commit until OWNER review.",
  };

  const abs = path.join(cwd, B2_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  const body = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(abs, body, "utf8");
  return { document, rel: B2_REL, sha256: sha256Text(body) };
}

async function main() {
  const result = await runB2();
  console.log(`wrote ${result.rel}`);
  console.log(
    JSON.stringify(
      {
        sha256: result.sha256,
        marketFirewall: result.document.marketFirewall,
        coverageByDataset: result.document.coverageByDataset,
      },
      null,
      2,
    ),
  );
}

const isDirectRun =
  !!process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
