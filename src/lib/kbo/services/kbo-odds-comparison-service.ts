import { readFile } from "node:fs/promises";
import path from "node:path";
import { getKboIdentityArtifactPath } from "../kbo-identity-artifact-path";
import { getKboIdentityProvider } from "../kbo-identity-feature-flag";
import { buildKboOddsComparisonDocument } from "../odds-comparison/build-kbo-odds-comparison-v1";
import type { KboOddsComparisonDocument } from "../odds-comparison/kbo-odds-comparison-types";
import type { KboOperatorMarketInputV2 } from "../operator-input-v2/kbo-operator-market-input-types";
import { createTheOddsApiKboProvider } from "../providers/the-odds-api-kbo-provider";
import type { KboScheduleResultIdentityDocument } from "../schedule-result-identity-types";

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function collectKboOddsComparisonV1(params: {
  dateKst: string;
  generatedAt?: string;
  cwd?: string;
}): Promise<{
  document: KboOddsComparisonDocument;
  usage: { rawHit: number; rawMiss: number; networkCalls: number };
}> {
  const cwd = params.cwd ?? process.cwd();
  const identityPath = getKboIdentityArtifactPath(
    params.dateKst,
    getKboIdentityProvider(),
    cwd,
  );
  const operatorInputPath = path.join(
    cwd,
    "data/operator-input/kbo",
    `${params.dateKst}-operator-markets-v2.json`,
  );
  const identity =
    await readJson<KboScheduleResultIdentityDocument>(identityPath);
  const operatorInput =
    await readJson<KboOperatorMarketInputV2>(operatorInputPath);

  const hasManualOverseasForAllGames = identity.rows.every((row) => {
    const game = operatorInput.games.find(
      (item) => item.internalGameId === row.internalGameId,
    );
    return !!game?.markets.find(
      (market) =>
        market.marketType === "OTHER" &&
        market.period === "FULL_GAME" &&
        market.displayLabel === "해외 승패",
    );
  });
  const provider = createTheOddsApiKboProvider({ cwd });
  const overseas = hasManualOverseasForAllGames
    ? { games: [], warnings: [], missing: [] }
    : await provider.fetchMoneylineByDate(params.dateKst);
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const document = buildKboOddsComparisonDocument({
    dateKst: params.dateKst,
    generatedAt,
    identity,
    operatorInput,
    overseasGames: overseas.games.map((game) => ({ ...game, capturedAt: generatedAt })),
    cacheUsage: provider.usage,
    warnings: overseas.warnings,
    missing: overseas.missing,
  });

  return { document, usage: provider.usage };
}
