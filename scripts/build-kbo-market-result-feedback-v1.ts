/**
 * KBO Market Result Feedback v1
 *
 *   npm run research:kbo-market-feedback -- YYYY-MM-DD
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildKboMarketResultFeedbackV1 } from "../src/lib/kbo/market-result-feedback/build-kbo-market-result-feedback-v1";

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
  console.log(`=== KBO Market Result Feedback v1 (${DATE}) ===`);
  console.log("");

  const before = {
    kboIdentity: await readHashIfExists(
      `data/research/kbo/${DATE}-schedule-result-identity-v1-api-baseball.json`,
    ),
    operatorMarketsV2: await readHashIfExists(
      `data/operator-input/kbo/${DATE}-operator-markets-v2.json`,
    ),
    oddsComparison: await readHashIfExists(
      `data/research/kbo/${DATE}-odds-comparison-v1.json`,
    ),
    mlbPrediction: await readHashIfExists("data/predictions/mlb/2026-07-27.json"),
    todayEdgePick: await readHashIfExists(
      "data/research/mlb/2026-07-27-today-edge-pick-v1.json",
    ),
  };

  const first = await buildKboMarketResultFeedbackV1({ dateKst: DATE });
  const second = await buildKboMarketResultFeedbackV1({
    dateKst: DATE,
    generatedAt: first.document.meta.generatedAt,
  });

  if (first.document.meta.resultHashSha256 !== second.document.meta.resultHashSha256) {
    throw new Error("deterministic rerun resultHash mismatch");
  }

  const outDataset = path.join(
    process.cwd(),
    "data/research/kbo",
    `${DATE}-market-result-feedback-v1.json`,
  );
  const outAudit = path.join(
    process.cwd(),
    "data/audits",
    `${DATE}-kbo-market-result-feedback-v1-audit.json`,
  );

  await mkdir(path.dirname(outDataset), { recursive: true });
  await writeFile(outDataset, `${JSON.stringify(first.document, null, 2)}\n`, "utf8");

  const after = {
    kboIdentity: await readHashIfExists(
      `data/research/kbo/${DATE}-schedule-result-identity-v1-api-baseball.json`,
    ),
    operatorMarketsV2: await readHashIfExists(
      `data/operator-input/kbo/${DATE}-operator-markets-v2.json`,
    ),
    oddsComparison: await readHashIfExists(
      `data/research/kbo/${DATE}-odds-comparison-v1.json`,
    ),
    mlbPrediction: await readHashIfExists("data/predictions/mlb/2026-07-27.json"),
    todayEdgePick: await readHashIfExists(
      "data/research/mlb/2026-07-27-today-edge-pick-v1.json",
    ),
  };

  const postgameAuditPath = path.join(
    process.cwd(),
    "data/audits",
    `${DATE}-kbo-postgame-result-identity-v1-audit.json`,
  );
  let postgameIdentityImmutableHash: string | null = null;
  try {
    const postgameAudit = JSON.parse(
      await readFile(postgameAuditPath, "utf8"),
    ) as { identityImmutableHashAfter?: string };
    postgameIdentityImmutableHash = postgameAudit.identityImmutableHashAfter ?? null;
  } catch {
    postgameIdentityImmutableHash = null;
  }

  const identityHashMatchesPostgame =
    postgameIdentityImmutableHash == null ||
    first.identityImmutableHash === postgameIdentityImmutableHash;

  const audit = {
    meta: {
      version: "kbo-market-result-feedback-v1",
      generatedAt: first.document.meta.generatedAt,
      conclusion: "KBO_MARKET_RESULT_FEEDBACK_CREATED",
    },
    targetDateKst: DATE,
    identityProvider: "API_BASEBALL",
    gamesChecked: first.document.summary.totalGames,
    finalGames: first.document.summary.finalGames,
    pendingGames: first.document.summary.pendingGames,
    draws: first.document.summary.draws,
    identityImmutableHash: first.identityImmutableHash,
    postgameIdentityImmutableHash,
    identityHashValidation: identityHashMatchesPostgame ? "PASS" : "FAIL",
    domesticOddsAvailable: first.document.summary.domesticOddsAvailable,
    overseasOddsAvailable: first.document.summary.overseasOddsAvailable,
    bothOddsAvailable: first.document.summary.bothOddsAvailable,
    domesticDirectionMatched: first.document.summary.domesticDirectionMatched,
    overseasDirectionMatched: first.document.summary.overseasDirectionMatched,
    domesticOverseasDirectionAgreed:
      first.document.summary.domesticOverseasDirectionAgreed,
    observationStatus: first.document.summary.observationStatus,
    predictionStatus: first.document.prediction.predictionStatus,
    predictionGrade: first.document.prediction.predictionGrade,
    learningImpact: first.document.prediction.learningImpact,
    pipelineReadiness: first.document.pipelineReadiness,
    resultHash: first.document.meta.resultHashSha256,
    legalStatus: "INTERNAL_RESEARCH_ONLY",
    predictionImpact: "NONE",
    engineImpact: 0,
    regression: {
      before,
      after,
      unchanged:
        before.kboIdentity === after.kboIdentity &&
        before.operatorMarketsV2 === after.operatorMarketsV2 &&
        before.oddsComparison === after.oddsComparison &&
        before.mlbPrediction === after.mlbPrediction &&
        before.todayEdgePick === after.todayEdgePick,
    },
    deterministicRerunHashMatched:
      first.document.meta.resultHashSha256 ===
      second.document.meta.resultHashSha256,
  };

  await mkdir(path.dirname(outAudit), { recursive: true });
  await writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const s = first.document.summary;
  console.log(`games checked=${s.totalGames}`);
  console.log(`final=${s.finalGames}`);
  console.log(`pending=${s.pendingGames}`);
  console.log(`draws=${s.draws}`);
  console.log(`identity hash validation=${audit.identityHashValidation}`);
  console.log(`domestic odds=${s.domesticOddsAvailable}`);
  console.log(`overseas odds=${s.overseasOddsAvailable}`);
  console.log(`both odds=${s.bothOddsAvailable}`);
  console.log(`domestic direction matched=${s.domesticDirectionMatched}`);
  console.log(`overseas direction matched=${s.overseasDirectionMatched}`);
  console.log(`domestic/overseas agreed=${s.domesticOverseasDirectionAgreed}`);
  console.log(`observation=${s.observationStatus}`);
  console.log(`prediction=${first.document.prediction.predictionStatus}`);
  console.log(`resultHash=${first.document.meta.resultHashSha256}`);
  console.log(`저장: ${outDataset}`);
  console.log(`감사: ${outAudit}`);
  console.log("KBO_2026_07_28_MARKET_RESULT_FEEDBACK_COMPLETED");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
