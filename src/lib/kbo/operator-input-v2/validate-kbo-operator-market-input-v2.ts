import { readFile } from "node:fs/promises";
import path from "node:path";
import { getKboIdentityProvider } from "../kbo-identity-feature-flag";
import { getKboIdentityArtifactPath } from "../kbo-identity-artifact-path";
import { resolveKboTeamIdentity } from "../resolve-kbo-team-identity";
import type {
  KboOperatorGameMarketInput,
  KboOperatorMarketInput,
  KboOperatorMarketInputStatus,
  KboOperatorMarketInputV2,
  KboOperatorMarketReviewStatus,
  KboOperatorMarketType,
  KboSelectionCode,
} from "./kbo-operator-market-input-types";

type IdentityRow = {
  internalGameId: string;
  providerGameId: string;
  homeTeam: { canonicalNameKo: string | null };
  awayTeam: { canonicalNameKo: string | null };
  time: { startTimeKst: string | null };
};

type IdentityDocument = {
  meta: { dateKst: string; resultHashSha256: string };
  rows: IdentityRow[];
};

const REVIEW_STATUSES = new Set<KboOperatorMarketReviewStatus>([
  "DRAFT",
  "VERIFIED",
  "REJECTED",
]);

const REQUIRED_SELECTIONS: Record<KboOperatorMarketType, KboSelectionCode[]> = {
  MONEYLINE_2WAY: ["HOME", "AWAY"],
  MONEYLINE_3WAY: ["HOME", "DRAW", "AWAY"],
  HANDICAP_2WAY: ["HOME_COVER", "AWAY_COVER"],
  TOTAL: ["UNDER", "OVER"],
  SUM_PARITY: ["ODD", "EVEN"],
  FIRST_HALF_MONEYLINE_3WAY: ["HOME", "DRAW", "AWAY"],
  FIRST_HALF_HANDICAP_2WAY: ["HOME_COVER", "AWAY_COVER"],
  FIRST_HALF_TOTAL: ["UNDER", "OVER"],
  OTHER: [],
};

function isLineRequired(marketType: KboOperatorMarketType): boolean {
  return (
    marketType === "HANDICAP_2WAY" ||
    marketType === "TOTAL" ||
    marketType === "FIRST_HALF_HANDICAP_2WAY" ||
    marketType === "FIRST_HALF_TOTAL"
  );
}

function expectedPeriod(marketType: KboOperatorMarketType): "FULL_GAME" | "FIRST_HALF" {
  switch (marketType) {
    case "FIRST_HALF_MONEYLINE_3WAY":
    case "FIRST_HALF_HANDICAP_2WAY":
    case "FIRST_HALF_TOTAL":
      return "FIRST_HALF";
    default:
      return "FULL_GAME";
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function validateIdentityMatch(game: KboOperatorGameMarketInput, identity: IdentityRow): boolean {
  const home = resolveKboTeamIdentity(game.homeTeamText).canonicalNameKo;
  const away = resolveKboTeamIdentity(game.awayTeamText).canonicalNameKo;
  return (
    home != null &&
    away != null &&
    identity.homeTeam.canonicalNameKo === home &&
    identity.awayTeam.canonicalNameKo === away &&
    parseMs(game.startTimeKst) === parseMs(identity.time.startTimeKst)
  );
}

export async function validateKboOperatorMarketInputV2(params: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  input: KboOperatorMarketInputV2;
  identity: IdentityDocument;
  audit: {
    gamesEntered: number;
    gamesMatched: number;
    gamesUnmatched: number;
    marketsEntered: number;
    selectionsEntered: number;
    operatorMarketIds: string[];
    duplicateMarketIds: string[];
    invalidOdds: Array<{ operatorMarketId: string; selectionCode: string; value: unknown }>;
    invalidMarketStructures: string[];
    identityMappings: Array<{
      operatorGameId: string;
      internalGameId: string | null;
      mappingStatus: string;
      blockingReasons: string[];
    }>;
    reviewStatus: string;
    inputStatus: KboOperatorMarketInputStatus;
    blockingReasons: string[];
    generatedAt: string;
  };
}> {
  const cwd = params.cwd ?? process.cwd();
  const inputPath = path.join(
    cwd,
    "data/operator-input/kbo",
    `${params.dateKst}-operator-markets-v2.json`,
  );
  const identityPath = getKboIdentityArtifactPath(
    params.dateKst,
    getKboIdentityProvider(),
    cwd,
  );

  const input = await readJson<KboOperatorMarketInputV2>(inputPath);
  const identity = await readJson<IdentityDocument>(identityPath);
  const identityById = new Map(identity.rows.map((row) => [row.internalGameId, row] as const));

  const blockingReasons: string[] = [];
  const duplicateMarketIds: string[] = [];
  const invalidOdds: Array<{ operatorMarketId: string; selectionCode: string; value: unknown }> = [];
  const invalidMarketStructures: string[] = [];
  const identityMappings: Array<{
    operatorGameId: string;
    internalGameId: string | null;
    mappingStatus: string;
    blockingReasons: string[];
  }> = [];

  if (input.dateKst !== params.dateKst) {
    blockingReasons.push("DATE_MISMATCH");
  }

  let gamesMatched = 0;
  let gamesUnmatched = 0;
  let marketsEntered = 0;
  let selectionsEntered = 0;
  const operatorMarketIds: string[] = [];
  const seenMarketIds = new Set<string>();

  for (const game of input.games) {
    const localBlocking = [...game.blockingReasons];
    if (!REVIEW_STATUSES.has(game.reviewStatus)) {
      localBlocking.push("INVALID_GAME_REVIEW_STATUS");
      blockingReasons.push("INVALID_GAME_REVIEW_STATUS");
    }

    if (game.internalGameId) {
      const row = identityById.get(game.internalGameId);
      if (!row) {
        localBlocking.push("IDENTITY_PROVIDER_GAME_MISSING");
        blockingReasons.push("IDENTITY_PROVIDER_GAME_MISSING");
      } else if (!validateIdentityMatch(game, row)) {
        localBlocking.push("IDENTITY_HOME_AWAY_OR_TIME_MISMATCH");
        blockingReasons.push("IDENTITY_HOME_AWAY_OR_TIME_MISMATCH");
      } else {
        gamesMatched += 1;
      }
    } else {
      gamesUnmatched += 1;
      if (!localBlocking.includes("IDENTITY_PROVIDER_GAME_MISSING")) {
        localBlocking.push("IDENTITY_PROVIDER_GAME_MISSING");
      }
      blockingReasons.push("IDENTITY_PROVIDER_GAME_MISSING");
    }

    for (const market of game.markets) {
      marketsEntered += 1;
      operatorMarketIds.push(market.operatorMarketId);
      if (seenMarketIds.has(market.operatorMarketId)) {
        duplicateMarketIds.push(market.operatorMarketId);
        blockingReasons.push("DUPLICATE_OPERATOR_MARKET_ID");
      }
      seenMarketIds.add(market.operatorMarketId);

      if (!REVIEW_STATUSES.has(market.reviewStatus)) {
        invalidMarketStructures.push(
          `${market.operatorMarketId}:INVALID_MARKET_REVIEW_STATUS`,
        );
      }
      if (market.period !== expectedPeriod(market.marketType)) {
        invalidMarketStructures.push(`${market.operatorMarketId}:INVALID_PERIOD`);
      }
      if (isLineRequired(market.marketType) && market.line == null) {
        invalidMarketStructures.push(`${market.operatorMarketId}:LINE_REQUIRED`);
      }
      if (!isLineRequired(market.marketType) && market.line != null) {
        invalidMarketStructures.push(`${market.operatorMarketId}:LINE_MUST_BE_NULL`);
      }

      const required = REQUIRED_SELECTIONS[market.marketType];
      const seenSelections = new Set<string>();
      const selectionCodes = market.selections.map((selection) => selection.selectionCode);

      for (const code of required) {
        if (!selectionCodes.includes(code)) {
          invalidMarketStructures.push(
            `${market.operatorMarketId}:MISSING_SELECTION:${code}`,
          );
        }
      }

      for (const selection of market.selections) {
        selectionsEntered += 1;
        if (seenSelections.has(selection.selectionCode)) {
          invalidMarketStructures.push(
            `${market.operatorMarketId}:DUPLICATE_SELECTION:${selection.selectionCode}`,
          );
        }
        seenSelections.add(selection.selectionCode);
        if (!REVIEW_STATUSES.has(selection.reviewStatus)) {
          invalidMarketStructures.push(
            `${market.operatorMarketId}:INVALID_SELECTION_REVIEW_STATUS`,
          );
        }
        if (
          !(
            typeof selection.odds === "number" &&
            Number.isFinite(selection.odds) &&
            selection.odds > 0
          )
        ) {
          invalidOdds.push({
            operatorMarketId: market.operatorMarketId,
            selectionCode: selection.selectionCode,
            value: selection.odds,
          });
        }
      }
    }

    identityMappings.push({
      operatorGameId: game.operatorGameId,
      internalGameId: game.internalGameId,
      mappingStatus: game.mappingStatus,
      blockingReasons: [...new Set(localBlocking)],
    });
  }

  if (duplicateMarketIds.length > 0) blockingReasons.push("DUPLICATE_OPERATOR_MARKET_ID");
  if (invalidOdds.length > 0) blockingReasons.push("INVALID_ODDS_VALUE");
  if (invalidMarketStructures.length > 0) blockingReasons.push("INVALID_MARKET_STRUCTURE");

  const allDraft =
    input.reviewStatus === "DRAFT" &&
    input.games.every(
      (game) =>
        game.reviewStatus === "DRAFT" &&
        game.markets.every(
          (market) =>
            market.reviewStatus === "DRAFT" &&
            market.selections.every((selection) => selection.reviewStatus === "DRAFT"),
        ),
    );

  let inputStatus: KboOperatorMarketInputStatus = "DRAFT";
  if (gamesUnmatched > 0) inputStatus = "PARTIALLY_MAPPED";
  if (
    allDraft &&
    gamesUnmatched === 0 &&
    gamesMatched === input.games.length &&
    duplicateMarketIds.length === 0 &&
    invalidOdds.length === 0 &&
    invalidMarketStructures.length === 0 &&
    [...new Set(blockingReasons)].length === 0
  ) {
    inputStatus = "READY_FOR_OPERATOR_REVIEW";
  }
  const allVerified =
    input.reviewStatus === "VERIFIED" &&
    input.games.every(
      (game) =>
        game.reviewStatus === "VERIFIED" &&
        game.mappingStatus === "MATCHED" &&
        game.markets.every(
          (market) =>
            market.reviewStatus === "VERIFIED" &&
            market.selections.every((selection) => selection.reviewStatus === "VERIFIED"),
        ),
    );
  if (
    allVerified &&
    gamesUnmatched === 0 &&
    duplicateMarketIds.length === 0 &&
    invalidOdds.length === 0 &&
    invalidMarketStructures.length === 0
  ) {
    inputStatus = "VERIFIED_FOR_RESEARCH_INPUT";
  }

  return {
    input,
    identity,
    audit: {
      gamesEntered: input.games.length,
      gamesMatched,
      gamesUnmatched,
      marketsEntered,
      selectionsEntered,
      operatorMarketIds,
      duplicateMarketIds,
      invalidOdds,
      invalidMarketStructures,
      identityMappings,
      reviewStatus: input.reviewStatus,
      inputStatus,
      blockingReasons: [...new Set(blockingReasons)],
      generatedAt: new Date().toISOString(),
    },
  };
}
