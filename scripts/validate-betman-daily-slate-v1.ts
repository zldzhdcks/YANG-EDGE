/**
 * Betman Daily Full-Slate Coverage v1.
 *
 *   npm run research:betman-slate -- YYYY-MM-DD
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  betmanFullSlateArtifactPath,
  buildBetmanFullSlateV1,
} from "../src/lib/betman/daily-slate/build-betman-full-slate-v1";
import {
  betmanDailySlateInputPath,
} from "../src/lib/betman/daily-slate/validate-betman-daily-slate-v1";
import { getKstToday } from "../src/lib/datetime/kst";

function targetDate(): string {
  return process.argv[2]?.trim() || getKstToday();
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function readHashIfExists(rel: string): Promise<string | null> {
  try {
    return sha256(await readFile(path.join(process.cwd(), rel), "utf8"));
  } catch {
    return null;
  }
}

function countBy<T extends string>(
  items: T[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[item] = (out[item] ?? 0) + 1;
  return out;
}

async function main() {
  const dateKst = targetDate();
  const cwd = process.cwd();
  const generatedAt = new Date().toISOString();

  const before = {
    kboIdentity: await readHashIfExists(
      `data/research/kbo/${dateKst}-schedule-result-identity-v1-api-baseball.json`,
    ),
    mlbPrediction: await readHashIfExists(
      `data/predictions/mlb/${dateKst}.json`,
    ),
    kboOddsComparison: await readHashIfExists(
      `data/research/kbo/${dateKst}-odds-comparison-v1.json`,
    ),
  };

  const { document, validation } = await buildBetmanFullSlateV1({
    dateKst,
    cwd,
    generatedAt,
  });

  const artifactPath = await betmanFullSlateArtifactPath(dateKst, cwd);
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  const after = {
    kboIdentity: await readHashIfExists(
      `data/research/kbo/${dateKst}-schedule-result-identity-v1-api-baseball.json`,
    ),
    mlbPrediction: await readHashIfExists(
      `data/predictions/mlb/${dateKst}.json`,
    ),
    kboOddsComparison: await readHashIfExists(
      `data/research/kbo/${dateKst}-odds-comparison-v1.json`,
    ),
  };

  const analysisLevelCounts = countBy(
    document.games.map((g) => g.analysisLevel),
  );
  const missingReasonCounts: Record<string, number> = {};
  for (const game of document.games) {
    for (const reason of game.missingReasons) {
      missingReasonCounts[reason] = (missingReasonCounts[reason] ?? 0) + 1;
    }
  }

  const providerGameIds = document.games
    .map((g) => g.providerGameId)
    .filter((id): id is string => id != null);
  const duplicateProviderGameIds = providerGameIds.filter(
    (id, idx) => providerGameIds.indexOf(id) !== idx,
  );

  const audit = {
    targetDateKst: dateKst,
    operatorInputFile: betmanDailySlateInputPath(dateKst, cwd),
    reviewStatus: validation.input?.reviewStatus ?? "NOT_ENTERED",
    totalGames: document.coverageSummary.totalOperatorGames,
    sportCounts: document.sportCounts,
    supportedGames: document.coverageSummary.supportedSportGames,
    unsupportedGames: document.coverageSummary.unsupportedSportGames,
    matchedGames: document.coverageSummary.matchedGames,
    unmatchedGames: document.coverageSummary.unmatchedGames,
    analysisLevelCounts,
    coverageRates: {
      coverageRate: document.coverageSummary.coverageRate,
      analysisCoverageRate: document.coverageSummary.analysisCoverageRate,
      predictionCoverageRate: document.coverageSummary.predictionCoverageRate,
    },
    missingReasonCounts,
    duplicateOperatorGameIds: validation.duplicateOperatorGameIds,
    duplicateProviderGameIds: [...new Set(duplicateProviderGameIds)],
    timeConflicts: document.games
      .filter((g) => g.missingReasons.includes("START_TIME_MISMATCH"))
      .map((g) => g.operatorSlateGameId),
    teamMappingConflicts: document.games
      .filter((g) => g.missingReasons.includes("TEAM_MAPPING_MISSING"))
      .map((g) => g.operatorSlateGameId),
    predictionArtifactsRead: [
      `data/predictions/mlb/${dateKst}.json`,
    ],
    marketArtifactsRead: [
      `data/research/kbo/${dateKst}-odds-comparison-v1.json`,
    ],
    generatedArtifacts: [artifactPath.replace(/\\/g, "/")],
    hashes: {
      inputHashSha256: document.meta.inputHashSha256,
      resultHashSha256: document.meta.resultHashSha256,
    },
    regression: {
      before,
      after,
      unchanged:
        before.kboIdentity === after.kboIdentity &&
        before.mlbPrediction === after.mlbPrediction &&
        before.kboOddsComparison === after.kboOddsComparison,
    },
    generatedAt,
  };

  const auditPath = path.join(
    cwd,
    "data/audits",
    `${dateKst}-betman-full-slate-coverage-v1-audit.json`,
  );
  await mkdir(path.dirname(auditPath), { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const cov = document.coverageSummary;
  const topMissing = Object.entries(missingReasonCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];

  console.log("=== Betman Daily Full-Slate Coverage v1 ===");
  console.log("");
  console.log(`target date KST: ${dateKst}`);
  console.log(`operator input status: ${document.meta.operatorInputStatus}`);
  console.log(`total operator games: ${cov.totalOperatorGames}`);
  console.log(`supported games: ${cov.supportedSportGames}`);
  console.log(`unsupported games: ${cov.unsupportedSportGames}`);
  console.log(`sport counts: ${JSON.stringify(document.sportCounts)}`);
  console.log(`matched games: ${cov.matchedGames}`);
  console.log(`unmatched games: ${cov.unmatchedGames}`);
  console.log(`provider not implemented: ${cov.providerNotImplementedGames}`);
  console.log(`FULL_ANALYSIS: ${cov.fullAnalysisGames}`);
  console.log(`PARTIAL_ANALYSIS: ${cov.partialAnalysisGames}`);
  console.log(`MARKET_BASELINE_ONLY: ${cov.marketBaselineGames}`);
  console.log(`IDENTITY_ONLY: ${cov.identityOnlyGames}`);
  console.log(`BLOCKED: ${cov.blockedGames}`);
  console.log(`coverage rate: ${cov.coverageRate ?? "null"}`);
  console.log(`analysis coverage rate: ${cov.analysisCoverageRate ?? "null"}`);
  console.log(`prediction coverage rate: ${cov.predictionCoverageRate ?? "null"}`);
  console.log(
    `missing reason top: ${topMissing ? `${topMissing[0]} (${topMissing[1]})` : "none"}`,
  );
  console.log(`Artifact: ${artifactPath}`);
  console.log(`Audit: ${auditPath}`);
  console.log("");
  console.log("BETMAN_DAILY_FULL_SLATE_COVERAGE_V1_READY");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
