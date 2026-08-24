import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildPlayerFeatureDataset,
  formatPlayerFeaturesSummary,
  type BuildPlayerFeaturesInput,
} from "./build";
import {
  mlbPlayerFeaturesDatasetAbs,
  mlbPlayerFeaturesDatasetRel,
  mlbPlayerFeaturesManifestAbs,
} from "./paths";
import type {
  PlayerFeatureDatasetDocument,
  PlayerFeatureManifestV1,
} from "./types";

export type RunPlayerFeaturesInput = BuildPlayerFeaturesInput & {
  json?: boolean;
};

export type RunPlayerFeaturesResult = {
  document: PlayerFeatureDatasetDocument | null;
  manifest: PlayerFeatureManifestV1;
  written: boolean;
  skippedExisting: boolean;
  featureFetchAttempts: number;
  networkCalls: number;
};

async function exists(abs: string): Promise<boolean> {
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
}

function manifestFrom(input: {
  dateKst: string;
  generatedAt: string;
  document: PlayerFeatureDatasetDocument | null;
  dryRun: boolean;
  cacheOnly: boolean;
  written: boolean;
  skippedExisting: boolean;
  featureFetchAttempts: number;
  networkCalls: number;
  notes: string[];
}): PlayerFeatureManifestV1 {
  const games = input.document?.games ?? [];
  return {
    schemaVersion: "mlb-pregame-player-feature-manifest-v1",
    dateKst: input.dateKst,
    generatedAt: input.generatedAt,
    datasetRel: mlbPlayerFeaturesDatasetRel(input.dateKst),
    datasetHash: input.document?.datasetHash ?? "",
    writeOnce: true,
    dryRun: input.dryRun,
    cacheOnly: input.cacheOnly,
    games: games.length,
    blockedPostCutoff: games.filter((g) => g.featureStatus === "BLOCKED_POST_CUTOFF")
      .length,
    blockedNoConfirmedLineup: games.filter(
      (g) => g.featureStatus === "BLOCKED_NO_CONFIRMED_LINEUP",
    ).length,
    featureFetchAttempts: input.featureFetchAttempts,
    networkCalls: input.networkCalls,
    written: input.written,
    skippedExisting: input.skippedExisting,
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    independentModelSample: 0,
    notes: input.notes,
  };
}

export async function runPlayerFeatures(
  input: RunPlayerFeaturesInput,
): Promise<RunPlayerFeaturesResult> {
  const cwd = input.cwd ?? process.cwd();
  const dryRun = input.dryRun === true;
  const cacheOnly = input.cacheOnly === true;
  const generatedAt = input.generatedAt ?? new Date(input.nowMs ?? Date.now()).toISOString();
  const datasetAbs = mlbPlayerFeaturesDatasetAbs(input.dateKst, cwd);
  const already = await exists(datasetAbs);

  if (already && !dryRun) {
    const existing = JSON.parse(
      await readFile(datasetAbs, "utf8"),
    ) as PlayerFeatureDatasetDocument;
    const manifest = manifestFrom({
      dateKst: input.dateKst,
      generatedAt,
      document: existing,
      dryRun,
      cacheOnly,
      written: false,
      skippedExisting: true,
      featureFetchAttempts: 0,
      networkCalls: 0,
      notes: [
        "Existing dataset-v1.json is write-once. Refusing destructive replacement.",
      ],
    });
    return {
      document: existing,
      manifest,
      written: false,
      skippedExisting: true,
      featureFetchAttempts: 0,
      networkCalls: 0,
    };
  }

  const built = await buildPlayerFeatureDataset({
    ...input,
    cwd,
    generatedAt,
    dryRun,
    cacheOnly,
  });

  if (dryRun) {
    const manifest = manifestFrom({
      dateKst: input.dateKst,
      generatedAt,
      document: built.document,
      dryRun: true,
      cacheOnly,
      written: false,
      skippedExisting: false,
      featureFetchAttempts: 0,
      networkCalls: 0,
      notes: ["Dry-run: zero provider calls, zero writes."],
    });
    return {
      document: built.document,
      manifest,
      written: false,
      skippedExisting: false,
      featureFetchAttempts: 0,
      networkCalls: 0,
    };
  }

  await mkdir(path.dirname(datasetAbs), { recursive: true });
  await writeFile(
    datasetAbs,
    `${JSON.stringify(built.document, null, 2)}\n`,
    "utf8",
  );
  const manifest = manifestFrom({
    dateKst: input.dateKst,
    generatedAt,
    document: built.document,
    dryRun: false,
    cacheOnly,
    written: true,
    skippedExisting: false,
    featureFetchAttempts: built.featureFetchAttempts,
    networkCalls: built.networkCalls,
    notes: [
      "Research sidecar only. Prediction / recommendation / engine weights untouched.",
      "Bullpen player features deferred. Independent model sample = 0.",
    ],
  });
  await writeFile(
    mlbPlayerFeaturesManifestAbs(input.dateKst, cwd),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return {
    document: built.document,
    manifest,
    written: true,
    skippedExisting: false,
    featureFetchAttempts: built.featureFetchAttempts,
    networkCalls: built.networkCalls,
  };
}

export { formatPlayerFeaturesSummary };
