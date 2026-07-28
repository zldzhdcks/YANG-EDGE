import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectKboOddsComparisonV1 } from "../src/lib/kbo/services/kbo-odds-comparison-service";

const DATE = process.argv[2]?.trim() || "2026-07-28";

function sha256Text(text: string): string {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function readHashIfExists(rel: string): Promise<string | null> {
  try {
    return sha256Text(await readFile(path.join(process.cwd(), rel), "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const observedAt = new Date().toISOString();
  const before = {
    mlbPrediction: await readHashIfExists("data/predictions/mlb/2026-07-27.json"),
    kboIdentity: await readHashIfExists(
      "data/research/kbo/2026-07-28-schedule-result-identity-v1-api-baseball.json",
    ),
    operatorInput: await readHashIfExists(
      "data/operator-input/kbo/2026-07-28-operator-markets-v2.json",
    ),
  };

  const first = await collectKboOddsComparisonV1({
    dateKst: DATE,
    generatedAt: observedAt,
  });
  const second = await collectKboOddsComparisonV1({
    dateKst: DATE,
    generatedAt: observedAt,
  });

  if (
    first.document.meta.resultHashSha256 !== second.document.meta.resultHashSha256
  ) {
    throw new Error("warm rerun resultHash mismatch");
  }
  if (second.usage.networkCalls !== 0) {
    throw new Error(`warm networkCalls must be 0, got ${second.usage.networkCalls}`);
  }

  const outDataset = path.join(
    process.cwd(),
    "data/research/kbo",
    `${DATE}-odds-comparison-v1.json`,
  );
  const outAudit = path.join(
    process.cwd(),
    "data/audits",
    `${DATE}-kbo-odds-comparison-v1-audit.json`,
  );
  await mkdir(path.dirname(outDataset), { recursive: true });
  await writeFile(outDataset, `${JSON.stringify(first.document, null, 2)}\n`, "utf8");

  const after = {
    mlbPrediction: await readHashIfExists("data/predictions/mlb/2026-07-27.json"),
    kboIdentity: await readHashIfExists(
      "data/research/kbo/2026-07-28-schedule-result-identity-v1-api-baseball.json",
    ),
    operatorInput: await readHashIfExists(
      "data/operator-input/kbo/2026-07-28-operator-markets-v2.json",
    ),
  };

  const audit = {
    targetDateKst: DATE,
    identityGames: first.document.summary.identityGames,
    domesticGames: first.document.summary.domesticGames,
    domesticMarkets: first.document.summary.domesticMarkets,
    domesticReviewStatus: first.document.summary.domesticReviewStatus,
    overseasProvider: "THE_ODDS_API",
    overseasGamesFetched: first.document.summary.overseasGamesFetched,
    overseasGamesMatched: first.document.summary.overseasGamesMatched,
    overseasGamesUnmatched: first.document.summary.overseasGamesUnmatched,
    comparableGames: first.document.summary.comparableGames,
    domesticOnlyGames: first.document.summary.domesticOnlyGames,
    overseasOnlyGames: first.document.summary.overseasOnlyGames,
    marketRuleUnverified: first.document.summary.marketRuleUnverified,
    invalidOdds: first.document.summary.invalidOdds,
    networkCalls: {
      firstRun: first.document.cacheUsage.networkCalls,
      secondRunWarm: second.usage.networkCalls,
    },
    cacheUsage: {
      firstRun: first.document.cacheUsage,
      secondRunWarm: second.usage,
    },
    resultHash: first.document.meta.resultHashSha256,
    legalStatus: "INTERNAL_RESEARCH_ONLY",
    predictionImpact: "NONE",
    engineImpact: "NONE",
    regressionHashes: {
      before,
      after,
      unchanged:
        before.mlbPrediction === after.mlbPrediction &&
        before.kboIdentity === after.kboIdentity &&
        before.operatorInput === after.operatorInput,
    },
    warmRerunHashMatched:
      first.document.meta.resultHashSha256 === second.document.meta.resultHashSha256,
  };
  await mkdir(path.dirname(outAudit), { recursive: true });
  await writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log(`games=${first.document.summary.identityGames}`);
  console.log(`domestic=${first.document.summary.domesticGames}`);
  console.log(`overseas=${first.document.summary.overseasGamesMatched}`);
  console.log(`comparable=${first.document.summary.comparableGames}`);
  console.log(`unmatched=${first.document.summary.overseasGamesUnmatched}`);
  console.log(
    `draftDomesticRows=${first.document.rows.filter((row) => row.domestic?.reviewStatus === "DRAFT").length}`,
  );
  console.log(`networkCalls=${first.document.cacheUsage.networkCalls}`);
  console.log(`resultHash=${first.document.meta.resultHashSha256}`);
  console.log(`저장: ${outDataset}`);
  console.log(`감사: ${outAudit}`);
  console.log("KBO_ODDS_COMPARISON_V1_CREATED");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
