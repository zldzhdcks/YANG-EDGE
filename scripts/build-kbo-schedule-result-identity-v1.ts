/**
 * Build KBO Schedule / Result Identity Dataset v1 for a KST date.
 *
 *   npm run research:kbo-identity -- YYYY-MM-DD
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertKboScheduleResultIdentityIntegrity } from "../src/lib/kbo/build-schedule-result-identity-dataset";
import {
  KBO_IDENTITY_COLLECTION_DISABLED_CODE,
  getKboIdentityProvider,
  isKboIdentityCollectionEnabled,
} from "../src/lib/kbo/kbo-identity-feature-flag";
import { getKboIdentityArtifactPath } from "../src/lib/kbo/kbo-identity-artifact-path";
import { KboIdentityCollectionError } from "../src/lib/kbo/kbo-identity-errors";
import { collectKboScheduleResultIdentityV1 } from "../src/lib/kbo/services/kbo-identity-collection-service";
import type { KboScheduleResultIdentityRow } from "../src/lib/kbo/schedule-result-identity-types";

const DATE = process.argv[2]?.trim() || "2026-07-24";
const PREVIOUS_RESULT_HASH =
  "b6527db3df7652eaf239f734309df5973fc1d7c2b1526d5799945a9092245c02";
const HASH_REGRESSION_BASELINE_DATE = "2026-07-24";

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
  console.log(`=== Build KBO Schedule/Result Identity v1 (${DATE}) ===`);

  if (!isKboIdentityCollectionEnabled()) {
    console.log(KBO_IDENTITY_COLLECTION_DISABLED_CODE);
    return;
  }

  const providerId = getKboIdentityProvider();

  const regressionBefore = {
    mlbPrediction: await readHashIfExists(
      `data/predictions/mlb/2026-07-27.json`,
    ),
    mlbStarter: await readHashIfExists(
      `data/research/mlb/2026-07-27-starter-dataset-v1.json`,
    ),
    mlbBullpen: await readHashIfExists(
      `data/research/mlb/2026-07-27-bullpen-role-dataset-v1_1.json`,
    ),
    mlbLineup: await readHashIfExists(
      `data/research/mlb/2026-07-27-lineup-dataset-v1.json`,
    ),
    mlbWeather: await readHashIfExists(
      `data/research/mlb/2026-07-27-weather-dataset-v1.json`,
    ),
  };

  let first;
  let second;
  const observedAt = new Date().toISOString();
  try {
    first = await collectKboScheduleResultIdentityV1({ dateKst: DATE, observedAt });
    second = await collectKboScheduleResultIdentityV1({ dateKst: DATE, observedAt });
  } catch (error) {
    if (error instanceof KboIdentityCollectionError) {
      console.error(error.code);
      throw error;
    }
    throw error;
  }

  const integrity = assertKboScheduleResultIdentityIntegrity(first.document);
  if (integrity.length > 0) {
    throw new Error(`integrity failed:\n- ${integrity.join("\n- ")}`);
  }

  const hashMatched =
    first.document.meta.resultHashSha256 ===
    second.document.meta.resultHashSha256;

  if (!hashMatched) {
    throw new Error(
      `resultHash mismatch: ${first.document.meta.resultHashSha256} != ${second.document.meta.resultHashSha256}`,
    );
  }

  if (second.usage.networkCalls !== 0) {
    throw new Error(
      `warm networkCalls must be 0, got ${second.usage.networkCalls}`,
    );
  }

  const outDataset = path.join(
    getKboIdentityArtifactPath(DATE, providerId),
  );
  const outAudit = path.join(
    process.cwd(),
    "data/audits",
    providerId === "API_BASEBALL"
      ? `${DATE}-kbo-api-baseball-full-slate-identity-v1-audit.json`
      : `${DATE}-kbo-schedule-result-identity-v1-audit.json`,
  );

  await mkdir(path.dirname(outDataset), { recursive: true });
  await writeFile(
    outDataset,
    `${JSON.stringify(first.document, null, 2)}\n`,
    "utf8",
  );

  const regressionAfter = {
    mlbPrediction: await readHashIfExists(
      `data/predictions/mlb/2026-07-27.json`,
    ),
    mlbStarter: await readHashIfExists(
      `data/research/mlb/2026-07-27-starter-dataset-v1.json`,
    ),
    mlbBullpen: await readHashIfExists(
      `data/research/mlb/2026-07-27-bullpen-role-dataset-v1_1.json`,
    ),
    mlbLineup: await readHashIfExists(
      `data/research/mlb/2026-07-27-lineup-dataset-v1.json`,
    ),
    mlbWeather: await readHashIfExists(
      `data/research/mlb/2026-07-27-weather-dataset-v1.json`,
    ),
  };

  const regressionUnchanged =
    regressionBefore.mlbPrediction === regressionAfter.mlbPrediction &&
    regressionBefore.mlbStarter === regressionAfter.mlbStarter &&
    regressionBefore.mlbBullpen === regressionAfter.mlbBullpen &&
    regressionBefore.mlbLineup === regressionAfter.mlbLineup &&
    regressionBefore.mlbWeather === regressionAfter.mlbWeather;

  const shouldCheckResultHashRegression =
    DATE === HASH_REGRESSION_BASELINE_DATE;
  const resultHashRegressionMatched = shouldCheckResultHashRegression
    ? first.document.meta.resultHashSha256 === PREVIOUS_RESULT_HASH
    : true;

  const audit = {
    meta: {
      version: "kbo-schedule-result-identity-v1-audit",
      kind: "kbo-schedule-result-identity-v1-build-audit",
      datasetId: "kbo-schedule-result-identity",
      schemaVersion: first.document.meta.schemaVersion,
      builderVersion: first.document.meta.builderVersion,
      targetDate: DATE,
      primaryProvider: providerId,
      generatedAt: new Date().toISOString(),
      datasetStatus: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      researchOnly: true,
      inputHashSha256: first.document.meta.inputHashSha256,
      resultHashSha256: first.document.meta.resultHashSha256,
      previousResultHash: shouldCheckResultHashRegression
        ? PREVIOUS_RESULT_HASH
        : null,
      resultHashRegressionMatched,
      firstResultHash: first.document.meta.resultHashSha256,
      secondResultHash: second.document.meta.resultHashSha256,
      hashMatched,
      warmRerunHashMatched: hashMatched,
      architectureLayer: "service",
    },
    provider: {
      id: first.document.rows[0]?.provider.id ?? providerId,
      leagueId: first.document.rows[0]?.provider.leagueId ?? "",
      legalStatus: first.document.rows[0]?.provider.legalStatus ?? "INTERNAL_RESEARCH_ONLY",
      publicDisplay: "UNCONFIRMED",
      commercialUse: "UNCONFIRMED",
    },
    providerGamesFetched: first.document.summary.providerGamesFetched,
    datasetGamesCreated: first.document.summary.datasetGamesCreated,
    missingProviderGameId: first.document.summary.missingProviderGameId,
    teamMappingsMatched: first.document.summary.teamMappingsMatched,
    teamMappingsUnmatched: first.document.summary.teamMappingsUnmatched,
    scheduled: first.document.summary.scheduled,
    live: first.document.summary.live,
    final: first.document.summary.final,
    draw: first.document.summary.draw,
    postponed: first.document.summary.postponed,
    cancelled: first.document.summary.cancelled,
    noGame: first.document.summary.noGame,
    suspended: first.document.summary.suspended,
    unknown: first.document.summary.unknown,
    scheduleChanges: first.document.summary.scheduleChanges,
    cacheUsage: {
      firstRun: first.document.cacheUsage,
      secondRunWarm: second.document.cacheUsage,
    },
    networkCalls: {
      firstRun: first.document.cacheUsage.networkCalls,
      secondRunWarm: second.usage.networkCalls,
    },
    registryStatus: "REGISTERED",
    engineImpact: "NONE",
    regressionHashes: {
      before: regressionBefore,
      after: regressionAfter,
      unchanged: regressionUnchanged,
    },
    warnings: first.document.warnings,
    missing: first.document.missing,
    checks: [
      {
        id: "result-hash-matched",
        passed: hashMatched,
        detail: `${first.document.meta.resultHashSha256} == ${second.document.meta.resultHashSha256}`,
      },
      {
        id: "result-hash-regression",
        passed: resultHashRegressionMatched,
        detail: shouldCheckResultHashRegression
          ? `${first.document.meta.resultHashSha256} == ${PREVIOUS_RESULT_HASH}`
          : "skipped for non-baseline date",
      },
      {
        id: "warm-network-zero",
        passed: second.usage.networkCalls === 0,
        detail: String(second.usage.networkCalls),
      },
      {
        id: "internal-game-id-format",
        passed: first.document.rows.every(
          (r: KboScheduleResultIdentityRow) =>
            r.internalGameId === `kbo-${r.providerGameId}`,
        ),
        detail: "kbo-{providerGameId}",
      },
      {
        id: "betman-not-checked",
        passed: first.document.rows.every(
          (r: KboScheduleResultIdentityRow) =>
            r.betmanScopeReference === "NOT_CHECKED",
        ),
        detail: "NOT_CHECKED",
      },
      {
        id: "engine-prohibited",
        passed: first.document.meta.engineAdmission === "PROHIBITED",
        detail: "PROHIBITED",
      },
      {
        id: "mlb-regression-unchanged",
        passed: regressionUnchanged,
        detail: "MLB prediction/datasets unchanged",
      },
    ],
    notes: first.document.meta.notes,
  };

  await mkdir(path.dirname(outAudit), { recursive: true });
  await writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const failed = audit.checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    throw new Error(
      `audit checks failed: ${failed.map((f) => f.id).join(", ")}`,
    );
  }

  console.log(
    `providerGames=${first.document.summary.providerGamesFetched} datasetGames=${first.document.summary.datasetGamesCreated}`,
  );
  console.log(
    `teamMatched=${first.document.summary.teamMappingsMatched} teamUnmatched=${first.document.summary.teamMappingsUnmatched}`,
  );
  console.log(
    `final=${first.document.summary.final} scheduled=${first.document.summary.scheduled} postponed=${first.document.summary.postponed}`,
  );
  console.log(
    `rawHit/miss=${first.document.cacheUsage.rawHit}/${first.document.cacheUsage.rawMiss} warmNet=${second.usage.networkCalls}`,
  );
  console.log(`resultHash=${first.document.meta.resultHashSha256}`);
  console.log(`저장: ${outDataset}`);
  console.log(`감사: ${outAudit}`);
  console.log("KBO_SCHEDULE_RESULT_IDENTITY_V1_CREATED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
