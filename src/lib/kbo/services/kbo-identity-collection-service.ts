/**
 * KBO Identity Collection Service.
 *
 * Orchestrates: Feature Flag → Provider → Team Resolver → Builder.
 * Does NOT call Engine, Prediction, or Viewer.
 */
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  KBO_IDENTITY_COLLECTION_DISABLED_CODE,
  getKboIdentityProvider,
  isKboIdentityCollectionEnabled,
} from "../kbo-identity-feature-flag";
import { KboIdentityCollectionError } from "../kbo-identity-errors";
import {
  buildKboScheduleResultIdentityDocument,
} from "../build-schedule-result-identity-dataset";
import type { BuildKboScheduleResultIdentityResult } from "../schedule-result-identity-types";
import { getKboIdentityArtifactPath } from "../kbo-identity-artifact-path";
import { buildKboProviderCrosswalk } from "../kbo-provider-crosswalk";
import { createApiBaseballKboScheduleProvider } from "../providers/api-baseball-kbo-schedule-provider";
import { createTheSportsDbKboScheduleProvider } from "../providers/thesportsdb-kbo-schedule-provider";
import { resolveKboTeamIdentity } from "../resolve-kbo-team-identity";
import type {
  KboScheduleResultIdentityDocument,
  KboScheduleResultIdentityRow,
} from "../schedule-result-identity-types";

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadPreviousRows(
  dateKst: string,
  provider: "API_BASEBALL" | "THESPORTSDB",
  cwd = process.cwd(),
): Promise<Map<string, KboScheduleResultIdentityRow>> {
  const datasetPath = getKboIdentityArtifactPath(dateKst, provider, cwd);
  const map = new Map<string, KboScheduleResultIdentityRow>();
  if (!(await fileExists(datasetPath))) return map;

  try {
    const doc = JSON.parse(await readFile(datasetPath, "utf8")) as {
      rows?: KboScheduleResultIdentityRow[];
    };
    for (const row of doc.rows ?? []) {
      if (row.internalGameId) map.set(row.internalGameId, row);
    }
  } catch {
    // ignore corrupt previous artifact
  }
  return map;
}

async function loadIdentityDocumentIfExists(
  dateKst: string,
  provider: "API_BASEBALL" | "THESPORTSDB",
  cwd = process.cwd(),
): Promise<KboScheduleResultIdentityDocument | null> {
  const datasetPath = getKboIdentityArtifactPath(dateKst, provider, cwd);
  if (!(await fileExists(datasetPath))) return null;
  try {
    return JSON.parse(await readFile(datasetPath, "utf8")) as KboScheduleResultIdentityDocument;
  } catch {
    return null;
  }
}

export type CollectKboScheduleResultIdentityInput = {
  dateKst: string;
  observedAt?: string;
  cwd?: string;
};

export type CollectKboScheduleResultIdentityResult =
  BuildKboScheduleResultIdentityResult;

/**
 * Collect KBO Schedule/Result Identity for a KST date.
 *
 * KBO_IDENTITY_COLLECTION_ENABLED=false → throws KBO_IDENTITY_COLLECTION_DISABLED
 */
export async function collectKboScheduleResultIdentityV1(
  input: CollectKboScheduleResultIdentityInput,
): Promise<CollectKboScheduleResultIdentityResult> {
  if (!isKboIdentityCollectionEnabled()) {
    throw new KboIdentityCollectionError(
      KBO_IDENTITY_COLLECTION_DISABLED_CODE,
      "KBO Identity collection is disabled (KBO_IDENTITY_COLLECTION_ENABLED=false)",
    );
  }

  const providerId = getKboIdentityProvider();
  const provider =
    providerId === "API_BASEBALL"
      ? createApiBaseballKboScheduleProvider({ cwd: input.cwd })
      : createTheSportsDbKboScheduleProvider({ cwd: input.cwd });
  const fetchResult = await provider.fetchGamesByDate(input.dateKst);

  if (fetchResult.rawGameCount === 0 && fetchResult.games.length === 0) {
    throw new KboIdentityCollectionError(
      "NO_PROVIDER_GAMES",
      `No provider games returned for ${input.dateKst}`,
    );
  }

  const enrichedGames = fetchResult.games.map((game) => ({
    ...game,
    homeTeam: resolveKboTeamIdentity(game.homeTeamProviderName),
    awayTeam: resolveKboTeamIdentity(game.awayTeamProviderName),
  }));

  const previousRows = await loadPreviousRows(input.dateKst, providerId, input.cwd);
  const secondaryDocument =
    providerId === "API_BASEBALL"
      ? await loadIdentityDocumentIfExists(input.dateKst, "THESPORTSDB", input.cwd)
      : null;
  const observedAt = input.observedAt ?? new Date().toISOString();
  const providerRefsByInternalGameId =
    providerId === "API_BASEBALL"
      ? buildKboProviderCrosswalk({
          observedAt,
          primaryProviderId: "API_BASEBALL",
          primaryGames: enrichedGames,
          secondaryDocument,
        })
      : new Map();

  return buildKboScheduleResultIdentityDocument({
    dateKst: input.dateKst,
    observedAt,
    enrichedGames,
    providerMetadata: fetchResult.metadata,
    cacheUsage: provider.usage,
    providerWarnings: fetchResult.warnings,
    providerMissing: fetchResult.missing,
    rawGameCount: fetchResult.rawGameCount,
    previousRows,
    providerRefsByInternalGameId,
  });
}
