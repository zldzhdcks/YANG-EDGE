import { createHash } from "node:crypto";
import type { KboCacheUsageStats } from "../kbo-cache-types";
import type {
  KboOperatorGameMarketInput,
  KboOperatorMarketInputV2,
  KboOperatorSelectionInput,
} from "../operator-input-v2/kbo-operator-market-input-types";
import type { KboScheduleResultIdentityDocument } from "../schedule-result-identity-types";
import type { KboNormalizedOverseasOddsGame } from "../providers/kbo-overseas-odds-provider";
import {
  KBO_ODDS_COMPARISON_BUILDER_VERSION,
  KBO_ODDS_COMPARISON_DATASET_ID,
  KBO_ODDS_COMPARISON_SCHEMA_VERSION,
  type KboDomesticOddsSource,
  type KboOddsComparisonDocument,
  type KboOddsComparisonRow,
  type KboOverseasOddsSource,
} from "./kbo-odds-comparison-types";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
  return out;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function formatSelection(selection: KboOperatorSelectionInput) {
  return {
    selectionCode: selection.selectionCode,
    selectionLabel: selection.selectionLabel,
    odds: selection.odds,
  };
}

function pickDomesticMarket(
  game: KboOperatorGameMarketInput | undefined,
  capturedAt: string,
): KboDomesticOddsSource | null {
  if (!game) return null;
  const market = game.markets.find(
    (item) => item.marketType === "MONEYLINE_2WAY" && item.period === "FULL_GAME",
  );
  if (!market) return null;
  return {
    sourceType: "DOMESTIC_PROTO_OPERATOR_INPUT",
    sourceLabel: "KOREAN_PROTO",
    capturedAt,
    reviewStatus: market.reviewStatus,
    operatorMarketId: market.operatorMarketId,
    selections: market.selections
      .filter((selection) => selection.selectionCode === "HOME" || selection.selectionCode === "AWAY")
      .map(formatSelection),
  };
}

function pickOverseasMarket(game: KboNormalizedOverseasOddsGame | undefined): KboOverseasOddsSource | null {
  if (!game) return null;
  return {
    provider: "THE_ODDS_API",
    sportKey: game.sportKey,
    capturedAt: game.capturedAt,
    bookmakerPolicy: game.bookmakerPolicy,
    marketKey: game.marketKey,
    selections: game.selections,
    legalStatus: game.legalStatus,
  };
}

function pickManualOverseasMarket(
  game: KboOperatorGameMarketInput | undefined,
  capturedAt: string,
): KboOverseasOddsSource | null {
  if (!game) return null;
  const market = game.markets.find(
    (item) =>
      item.marketType === "OTHER" &&
      item.period === "FULL_GAME" &&
      item.displayLabel === "해외 승패",
  );
  if (!market) return null;
  return {
    provider: "OPERATOR_MANUAL",
    sportKey: null,
    capturedAt,
    bookmakerPolicy: "MANUAL_INPUT",
    marketKey: "manual_h2h",
    selections: market.selections
      .filter((selection) => selection.selectionCode === "HOME" || selection.selectionCode === "AWAY")
      .map(formatSelection),
    legalStatus: "OPERATOR_CONFIRMED",
  };
}

function getOdds(source: { selections: Array<{ selectionCode: string; odds: number }> } | null, code: "HOME" | "AWAY"): number | null {
  return source?.selections.find((selection) => selection.selectionCode === code)?.odds ?? null;
}

export function buildKboOddsComparisonDocument(input: {
  dateKst: string;
  generatedAt?: string;
  identity: KboScheduleResultIdentityDocument;
  operatorInput: KboOperatorMarketInputV2;
  overseasGames: KboNormalizedOverseasOddsGame[];
  cacheUsage: KboCacheUsageStats;
  warnings?: string[];
  missing?: string[];
}): KboOddsComparisonDocument {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const warnings = [...(input.warnings ?? [])];
  const missing = [...(input.missing ?? [])];
  const operatorByGameId = new Map(
    input.operatorInput.games
      .filter((game) => game.internalGameId)
      .map((game) => [game.internalGameId!, game] as const),
  );
  const overseasByGameKey = new Map(
    input.overseasGames.map((game) => [
      `${game.homeCanonicalTeamId}|${game.awayCanonicalTeamId}|${game.startTimeKst}`,
      game,
    ] as const),
  );

  const rows: KboOddsComparisonRow[] = input.identity.rows.map((identityRow) => {
    const operatorGame = operatorByGameId.get(identityRow.internalGameId);
    const overseasGame =
      overseasByGameKey.get(
        `${identityRow.homeTeam.canonicalTeamId}|${identityRow.awayTeam.canonicalTeamId}|${identityRow.time.startTimeKst}`,
      ) ?? undefined;

    const domestic = pickDomesticMarket(operatorGame, input.operatorInput.capturedAt);
    const manualOverseas = pickManualOverseasMarket(
      operatorGame,
      input.operatorInput.capturedAt,
    );
    const overseas = manualOverseas ?? pickOverseasMarket(overseasGame);
    const rowWarnings: string[] = [];
    const rowMissing: string[] = [];

    let status: KboOddsComparisonRow["comparison"]["status"] = "COMPARABLE";
    if (!domestic) {
      status = "DOMESTIC_MISSING";
      rowMissing.push("DOMESTIC_MONEYLINE_2WAY_MISSING");
    } else if (!overseas) {
      status = "OVERSEAS_MISSING";
      rowMissing.push("OVERSEAS_H2H_MISSING");
    } else if (
      domestic.selections.length !== 2 ||
      overseas.selections.length !== 2 ||
      getOdds(domestic, "HOME") == null ||
      getOdds(domestic, "AWAY") == null ||
      getOdds(overseas, "HOME") == null ||
      getOdds(overseas, "AWAY") == null
    ) {
      status = "SELECTION_MISMATCH";
      rowWarnings.push("SELECTION_MISMATCH");
    } else if (
      overseas.provider === "THE_ODDS_API" &&
      overseasGame &&
      !overseasGame.ruleVerified
    ) {
      status = "MARKET_RULE_UNVERIFIED";
      rowWarnings.push("MARKET_RULE_UNVERIFIED");
    } else if (domestic.reviewStatus === "DRAFT") {
      status = "DRAFT_DOMESTIC_INPUT";
    }

    const domesticHome = getOdds(domestic, "HOME");
    const domesticAway = getOdds(domestic, "AWAY");
    const overseasHome = getOdds(overseas, "HOME");
    const overseasAway = getOdds(overseas, "AWAY");
    const canCompare = status === "COMPARABLE";
    const homeDifference =
      canCompare && domesticHome != null && overseasHome != null
        ? Number((overseasHome - domesticHome).toFixed(2))
        : null;
    const awayDifference =
      canCompare && domesticAway != null && overseasAway != null
        ? Number((overseasAway - domesticAway).toFixed(2))
        : null;

    return {
      gameId: identityRow.internalGameId,
      dateKst: input.dateKst,
      startTimeKst: identityRow.time.startTimeKst ?? "",
      homeTeam: identityRow.homeTeam.canonicalNameKo ?? identityRow.homeTeam.providerName,
      awayTeam: identityRow.awayTeam.canonicalNameKo ?? identityRow.awayTeam.providerName,
      marketType: "MONEYLINE_2WAY",
      period: "FULL_GAME",
      line: null,
      domestic,
      overseas,
      comparison: {
        status,
        homeDifference,
        awayDifference,
        higherHomeSource:
          !canCompare || domesticHome == null || overseasHome == null
            ? "NONE"
            : overseasHome > domesticHome
              ? "OVERSEAS"
              : overseasHome < domesticHome
                ? "DOMESTIC"
                : "EQUAL",
        higherAwaySource:
          !canCompare || domesticAway == null || overseasAway == null
            ? "NONE"
            : overseasAway > domesticAway
              ? "OVERSEAS"
              : overseasAway < domesticAway
                ? "DOMESTIC"
                : "EQUAL",
      },
      generatedAt,
      warnings: rowWarnings,
      missing: rowMissing,
    };
  });

  const inputHashSha256 = sha256(
    stableStringify({
      identityResultHash: input.identity.meta.resultHashSha256,
      operatorInput: input.operatorInput,
      overseasGames: input.overseasGames,
    }),
  );
  const resultHashSha256 = sha256(
    stableStringify(
      rows.map((row) => {
        const { generatedAt: _generatedAt, ...rest } = row;
        return rest;
      }),
    ),
  );

  return {
    meta: {
      datasetId: KBO_ODDS_COMPARISON_DATASET_ID,
      schemaVersion: KBO_ODDS_COMPARISON_SCHEMA_VERSION,
      builderVersion: KBO_ODDS_COMPARISON_BUILDER_VERSION,
      dateKst: input.dateKst,
      generatedAt,
      researchOnly: true,
      legalStatus: "INTERNAL_RESEARCH_ONLY",
      engineAdmission: "PROHIBITED",
      inputHashSha256,
      resultHashSha256,
      notes: [
        "Domestic proto odds and overseas provider odds are shown as raw decimal values only.",
        "No implied probability, margin removal, value edge, prediction, or betting recommendation.",
        "MONEYLINE_2WAY only in v1.",
      ],
    },
    cacheUsage: input.cacheUsage,
    warnings,
    missing,
    summary: {
      identityGames: input.identity.rows.length,
      domesticGames: rows.filter((row) => row.domestic != null).length,
      domesticMarkets: rows.filter((row) => row.domestic != null).length,
      domesticReviewStatus: input.operatorInput.reviewStatus,
      overseasGamesFetched: input.overseasGames.length,
      overseasGamesMatched: rows.filter((row) => row.overseas != null).length,
      overseasGamesUnmatched: Math.max(
        0,
        input.overseasGames.length - rows.filter((row) => row.overseas != null).length,
      ),
      comparableGames: rows.filter((row) => row.comparison.status === "COMPARABLE").length,
      marketRuleUnverified: rows.filter(
        (row) => row.comparison.status === "MARKET_RULE_UNVERIFIED",
      ).length,
      domesticOnlyGames: rows.filter(
        (row) => row.domestic != null && row.overseas == null,
      ).length,
      overseasOnlyGames: input.overseasGames.filter((overseasGame) => {
        const key = `${overseasGame.homeCanonicalTeamId}|${overseasGame.awayCanonicalTeamId}|${overseasGame.startTimeKst}`;
        return !input.identity.rows.some(
          (identityRow) =>
            `${identityRow.homeTeam.canonicalTeamId}|${identityRow.awayTeam.canonicalTeamId}|${identityRow.time.startTimeKst}` ===
            key,
        );
      }).length,
      invalidOdds: rows.filter(
        (row) =>
          row.domestic?.selections.some((selection) => !(selection.odds > 1)) ||
          row.overseas?.selections.some((selection) => !(selection.odds > 1)),
      ).length,
    },
    rows,
  };
}
