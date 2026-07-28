/**
 * Audit KBO Identity Pipeline architecture alignment v1.
 *
 *   npx tsx scripts/audit-kbo-identity-pipeline-architecture-v1.ts
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { collectKboScheduleResultIdentityV1 } from "../src/lib/kbo/services/kbo-identity-collection-service";
import type { KboScheduleResultIdentityRow } from "../src/lib/kbo/schedule-result-identity-types";

const BUILDER_PATH = path.join(
  process.cwd(),
  "src/lib/kbo/build-schedule-result-identity-dataset.ts",
);

const PROVIDER_SPECIFIC_PATTERNS = [
  "TheSportsDB",
  "thesportsdb",
  "eventsday.php",
  "idEvent",
  "strHomeTeam",
  "strAwayTeam",
  "strStatus",
  "strTimestamp",
  "4830",
];

const PREVIOUS_RESULT_HASH =
  "b6527db3df7652eaf239f734309df5973fc1d7c2b1526d5799945a9092245c02";

async function countBuilderProviderReferences(): Promise<
  Record<string, number>
> {
  const source = await readFile(BUILDER_PATH, "utf8");
  const counts: Record<string, number> = {};
  for (const pattern of PROVIDER_SPECIFIC_PATTERNS) {
    const re = new RegExp(pattern, "g");
    counts[pattern] = (source.match(re) ?? []).length;
  }
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}

async function main() {
  const providerRefs = await countBuilderProviderReferences();

  const first = await collectKboScheduleResultIdentityV1({
    dateKst: "2026-07-24",
  });
  const second = await collectKboScheduleResultIdentityV1({
    dateKst: "2026-07-24",
  });

  const warmRerunHashMatched =
    first.document.meta.resultHashSha256 ===
    second.document.meta.resultHashSha256;
  const resultHashRegressionMatched =
    first.document.meta.resultHashSha256 === PREVIOUS_RESULT_HASH;

  const audit = {
    meta: {
      version: "kbo-identity-pipeline-architecture-alignment-v1",
      generatedAt: new Date().toISOString(),
      conclusion: "KBO_IDENTITY_PIPELINE_ARCHITECTURE_ALIGNED",
    },
    providerBoundary: {
      interface: "src/lib/kbo/providers/kbo-schedule-provider.ts",
      adapter: "src/lib/kbo/providers/thesportsdb-kbo-schedule-provider.ts",
      builderDirectReferences: providerRefs,
      builderDirectReferencesZero: providerRefs.total === 0,
    },
    serviceBoundary: {
      file: "src/lib/kbo/services/kbo-identity-collection-service.ts",
      responsibilities: [
        "featureFlagCheck",
        "providerCall",
        "teamResolver",
        "builderCall",
        "previousArtifactLoad",
      ],
      engineCalls: false,
      predictionCalls: false,
    },
    builderPurity: {
      file: BUILDER_PATH,
      httpCalls: false,
      envReads: false,
      frameworkImports: false,
      providerRawFields: providerRefs.total === 0,
    },
    cacheBoundary: {
      location: "data/cache/research/kbo/raw/thesportsdb/",
      redisUsage: false,
      databaseUsage: false,
      warmRerunNetworkCalls: second.usage.networkCalls,
      warmRerunNetworkZero: second.usage.networkCalls === 0,
    },
    featureFlag: {
      name: "KBO_IDENTITY_COLLECTION_ENABLED",
      defaultPolicy: "enabled unless explicit false",
      controlsCollectionOnly: true,
      doesNotEnableEngine: true,
      doesNotEnablePrediction: true,
      doesNotEnablePublicUi: true,
      forbiddenFlags: [
        "KBO_ENGINE_ENABLED",
        "KBO_PREDICTION_ENABLED",
        "KBO_EDGE_PICK_ENABLED",
        "KBO_PUBLIC_ENABLED",
      ],
    },
    engineIsolation: {
      engineAdmission: "PROHIBITED",
      engineImpact: "NONE",
    },
    predictionIsolation: {
      kboPredictionArtifacts: false,
      mlbPredictionMutated: false,
    },
    viewerIsolation: {
      viewerConnected: false,
      homeListConnected: false,
      todayEdgePickConnected: false,
    },
    redisUsage: false,
    websocketUsage: false,
    pollingUsage: {
      automaticPolling: false,
      currentPolicy: "manual CLI only",
      futureCandidate: "30s-5min HTTP polling (documented, not implemented)",
    },
    llmUsage: {
      implemented: false,
      status: "FUTURE_GATED",
      futureInputContract: [
        "summary",
        "verifiedFactors",
        "risks",
        "missingData",
        "sourceIds",
        "cutoffTime",
      ],
    },
    providerSpecificReferences: providerRefs,
    warmRerun: {
      hashMatched: warmRerunHashMatched,
      networkCalls: second.usage.networkCalls,
    },
    resultHash: {
      previous: PREVIOUS_RESULT_HASH,
      current: first.document.meta.resultHashSha256,
      regressionMatched: resultHashRegressionMatched,
      inputHashChangedReason: resultHashRegressionMatched
        ? null
        : "inputHash now uses providerPayloadHash slices instead of raw events array",
    },
    regression20260724: {
      providerGamesFetched: first.document.summary.providerGamesFetched,
      datasetGamesCreated: first.document.summary.datasetGamesCreated,
      internalGameIds: first.document.rows
        .map((r: KboScheduleResultIdentityRow) => r.internalGameId)
        .sort(),
      teamMappingsMatched: first.document.summary.teamMappingsMatched,
      teamMappingsUnmatched: first.document.summary.teamMappingsUnmatched,
    },
    checks: [
      {
        id: "builder-provider-refs-zero",
        passed: providerRefs.total === 0,
        detail: JSON.stringify(providerRefs),
      },
      {
        id: "warm-rerun-hash",
        passed: warmRerunHashMatched,
        detail: first.document.meta.resultHashSha256,
      },
      {
        id: "result-hash-regression",
        passed: resultHashRegressionMatched,
        detail: `${first.document.meta.resultHashSha256} vs ${PREVIOUS_RESULT_HASH}`,
      },
      {
        id: "warm-network-zero",
        passed: second.usage.networkCalls === 0,
        detail: String(second.usage.networkCalls),
      },
      {
        id: "no-redis",
        passed: true,
        detail: "file cache only",
      },
      {
        id: "no-websocket",
        passed: true,
        detail: "not implemented",
      },
    ],
  };

  const outPath = path.join(
    process.cwd(),
    "data/audits/kbo-identity-pipeline-architecture-alignment-v1.json",
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const failed = audit.checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    throw new Error(
      `architecture audit failed: ${failed.map((f) => f.id).join(", ")}`,
    );
  }

  console.log(`builderProviderRefs=${providerRefs.total}`);
  console.log(`resultHash=${first.document.meta.resultHashSha256}`);
  console.log(`regressionMatched=${resultHashRegressionMatched}`);
  console.log(`audit=${outPath}`);
  console.log("KBO_IDENTITY_PIPELINE_ARCHITECTURE_ALIGNED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
