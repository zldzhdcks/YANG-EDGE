/**
 * Update KBO Postgame Result Identity v1 (result region only).
 *
 *   npm run research:kbo-postgame-identity -- YYYY-MM-DD
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  KBO_IDENTITY_COLLECTION_DISABLED_CODE,
  isKboIdentityCollectionEnabled,
} from "../src/lib/kbo/kbo-identity-feature-flag";
import { KboIdentityCollectionError } from "../src/lib/kbo/kbo-identity-errors";
import { updateKboPostgameResultIdentityV1 } from "../src/lib/kbo/update-kbo-postgame-result-identity";

const DATE = process.argv[2]?.trim() || "2026-07-28";

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

async function main() {
  console.log(`=== KBO Postgame Result Identity (${DATE}) ===`);
  console.log("");

  if (!isKboIdentityCollectionEnabled()) {
    console.log(KBO_IDENTITY_COLLECTION_DISABLED_CODE);
    return;
  }

  const regressionBefore = {
    theSportsDbIdentity: await readHashIfExists(
      `data/research/kbo/${DATE}-schedule-result-identity-v1.json`,
    ),
    operatorMarketsV2: await readHashIfExists(
      `data/operator-input/kbo/${DATE}-operator-markets-v2.json`,
    ),
    oddsComparison: await readHashIfExists(
      `data/research/kbo/${DATE}-odds-comparison-v1.json`,
    ),
    mlbPrediction: await readHashIfExists(
      `data/predictions/mlb/2026-07-27.json`,
    ),
    mlbStarter: await readHashIfExists(
      `data/research/mlb/2026-07-27-starter-dataset-v1.json`,
    ),
    todayEdgePick: await readHashIfExists(
      `data/research/mlb/2026-07-27-today-edge-pick-v1.json`,
    ),
  };

  let result;
  try {
    result = await updateKboPostgameResultIdentityV1({
      dateKst: DATE,
      forceRefresh: true,
    });
  } catch (error) {
    if (error instanceof KboIdentityCollectionError) {
      console.error(error.code);
      throw error;
    }
    throw error;
  }

  const { stats } = result;
  const identityImmutablePass =
    result.identityImmutableHashBefore === result.identityImmutableHashAfter;

  const audit = {
    meta: {
      version: "kbo-postgame-result-identity-v1",
      generatedAt: new Date().toISOString(),
      conclusion: "KBO_POSTGAME_RESULT_IDENTITY_UPDATED",
    },
    targetDateKst: DATE,
    provider: "API_BASEBALL",
    artifactPath: path
      .relative(process.cwd(), result.artifactPath)
      .split(path.sep)
      .join("/"),
    artifactPolicy: result.artifactPolicy,
    gamesChecked: stats.gamesChecked,
    finalGames: stats.finalGames,
    drawGames: stats.drawGames,
    pendingGames: stats.pendingGames,
    postponedGames: stats.postponedGames,
    cancelledGames: stats.cancelledGames,
    noGameGames: stats.noGameGames,
    suspendedGames: stats.suspendedGames,
    inconclusiveGames: stats.inconclusiveGames,
    scoresResolved: stats.scoresResolved,
    winnersResolved: stats.winnersResolved,
    scheduleChangesDetected: stats.scheduleChangesDetected,
    identityImmutableHashBefore: result.identityImmutableHashBefore,
    identityImmutableHashAfter: result.identityImmutableHashAfter,
    identityImmutable: identityImmutablePass ? "PASS" : "FAIL",
    fullFileHashBefore: result.fullFileHashBefore,
    fullFileHashAfter: result.fullFileHashAfter,
    networkCalls: result.cacheUsage.networkCalls,
    cacheUsage: result.cacheUsage,
    legalStatus: "INTERNAL_RESEARCH_ONLY",
    predictionImpact: "NOT_IMPLEMENTED",
    engineImpact: 0,
    regression: {
      before: regressionBefore,
      after: {
        theSportsDbIdentity: await readHashIfExists(
          `data/research/kbo/${DATE}-schedule-result-identity-v1.json`,
        ),
        operatorMarketsV2: await readHashIfExists(
          `data/operator-input/kbo/${DATE}-operator-markets-v2.json`,
        ),
        oddsComparison: await readHashIfExists(
          `data/research/kbo/${DATE}-odds-comparison-v1.json`,
        ),
        mlbPrediction: await readHashIfExists(
          `data/predictions/mlb/2026-07-27.json`,
        ),
        mlbStarter: await readHashIfExists(
          `data/research/mlb/2026-07-27-starter-dataset-v1.json`,
        ),
        todayEdgePick: await readHashIfExists(
          `data/research/mlb/2026-07-27-today-edge-pick-v1.json`,
        ),
      },
    },
  };

  const auditPath = path.join(
    process.cwd(),
    "data/audits",
    `${DATE}-kbo-postgame-result-identity-v1-audit.json`,
  );
  await mkdir(path.dirname(auditPath), { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log("Games checked:");
  console.log(String(stats.gamesChecked));
  console.log("");
  console.log("Final:");
  console.log(String(stats.finalGames));
  console.log("");
  console.log("Draw:");
  console.log(String(stats.drawGames));
  console.log("");
  console.log("Pending:");
  console.log(String(stats.pendingGames));
  console.log("");
  console.log("Scores resolved:");
  console.log(String(stats.scoresResolved));
  console.log("");
  console.log("Winners resolved:");
  console.log(String(stats.winnersResolved));
  console.log("");
  console.log("Identity immutable:");
  console.log(identityImmutablePass ? "PASS" : "FAIL");
  console.log("");
  console.log("Prediction:");
  console.log("NOT_IMPLEMENTED");
  console.log("");
  console.log("Engine impact:");
  console.log("0");
  console.log("");
  console.log(`Artifact: ${result.artifactPath}`);
  console.log(`Audit: ${auditPath}`);
  console.log("KBO_POSTGAME_RESULT_IDENTITY_UPDATED");

  if (!identityImmutablePass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
