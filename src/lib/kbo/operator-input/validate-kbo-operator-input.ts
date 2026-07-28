import { readFile } from "node:fs/promises";
import path from "node:path";
import { getKboIdentityProvider } from "../kbo-identity-feature-flag";
import { getKboIdentityArtifactPath } from "../kbo-identity-artifact-path";
import { resolveKboTeamIdentity } from "../resolve-kbo-team-identity";
import type {
  KboBetmanScopeGameInput,
  KboBetmanScopeInput,
  KboOperatorGameMapping,
  KboOperatorInputReadyStatus,
  KboOperatorInputValidation,
  KboOperatorMappingStatus,
  KboOperatorReviewStatus,
  KboProtoOddsGameInput,
  KboProtoOddsInput,
} from "./kbo-operator-input-types";

type IdentityRow = {
  internalGameId: string;
  homeTeam: { canonicalNameKo: string | null };
  awayTeam: { canonicalNameKo: string | null };
  time: { startTimeKst: string | null };
};

type IdentityDocument = {
  meta: { dateKst: string; resultHashSha256: string };
  rows: IdentityRow[];
};

const MAPPING_STATUSES = new Set<KboOperatorMappingStatus>([
  "NOT_CHECKED",
  "MATCHED",
  "UNMATCHED",
  "AMBIGUOUS",
]);
const REVIEW_STATUSES = new Set<KboOperatorReviewStatus>([
  "DRAFT",
  "VERIFIED",
  "REJECTED",
]);
const MARKET_TYPES = new Set(["MONEYLINE", "HANDICAP", "TOTAL", "OTHER"]);
const START_TIME_TOLERANCE_MS = 15 * 60 * 1000;

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function withinTolerance(a: string | null, b: string | null): boolean {
  const aMs = parseMs(a);
  const bMs = parseMs(b);
  if (aMs == null || bMs == null) return false;
  return Math.abs(aMs - bMs) <= START_TIME_TOLERANCE_MS;
}

function canonicalCandidates(
  game: KboBetmanScopeGameInput,
  identityRows: IdentityRow[],
): IdentityRow[] {
  const home = resolveKboTeamIdentity(game.homeTeamText).canonicalNameKo;
  const away = resolveKboTeamIdentity(game.awayTeamText).canonicalNameKo;
  if (!home || !away) return [];
  return identityRows.filter(
    (row) =>
      row.homeTeam.canonicalNameKo === home &&
      row.awayTeam.canonicalNameKo === away &&
      withinTolerance(game.startTimeKst, row.time.startTimeKst),
  );
}

function validateScopeGame(
  game: KboBetmanScopeGameInput,
  dateKst: string,
  identityById: Map<string, IdentityRow>,
  identityRows: IdentityRow[],
  blockingReasons: string[],
): KboOperatorGameMapping {
  if (!MAPPING_STATUSES.has(game.mappingStatus)) {
    blockingReasons.push(`INVALID_SCOPE_MAPPING_STATUS:${game.operatorGameId}`);
  }
  if (!REVIEW_STATUSES.has(game.reviewStatus)) {
    blockingReasons.push(`INVALID_SCOPE_REVIEW_STATUS:${game.operatorGameId}`);
  }
  for (const marketType of game.marketTypes) {
    if (!MARKET_TYPES.has(marketType)) {
      blockingReasons.push(`INVALID_SCOPE_MARKET_TYPE:${game.operatorGameId}`);
    }
  }

  if (game.matchedInternalGameId) {
    const identity = identityById.get(game.matchedInternalGameId);
    if (!identity) {
      blockingReasons.push("IDENTITY_PROVIDER_GAME_MISSING");
      return {
        operatorGameId: game.operatorGameId,
        matchedInternalGameId: game.matchedInternalGameId,
        mappingStatus: "UNMATCHED",
        blockingReason: "IDENTITY_PROVIDER_GAME_MISSING",
      };
    }

    const home = resolveKboTeamIdentity(game.homeTeamText).canonicalNameKo;
    const away = resolveKboTeamIdentity(game.awayTeamText).canonicalNameKo;
    const homeMatched = home != null && identity.homeTeam.canonicalNameKo === home;
    const awayMatched = away != null && identity.awayTeam.canonicalNameKo === away;
    const timeMatched = withinTolerance(game.startTimeKst, identity.time.startTimeKst);

    if (homeMatched && awayMatched && timeMatched) {
      return {
        operatorGameId: game.operatorGameId,
        matchedInternalGameId: game.matchedInternalGameId,
        mappingStatus: "MATCHED",
        blockingReason: null,
      };
    }

    blockingReasons.push(`IDENTITY_MISMATCH:${game.operatorGameId}`);
    return {
      operatorGameId: game.operatorGameId,
      matchedInternalGameId: game.matchedInternalGameId,
      mappingStatus: "AMBIGUOUS",
      blockingReason: "IDENTITY_MISMATCH",
    };
  }

  const candidates = canonicalCandidates(game, identityRows);
  if (candidates.length === 1) {
    return {
      operatorGameId: game.operatorGameId,
      matchedInternalGameId: candidates[0].internalGameId,
      mappingStatus: "MATCHED",
      blockingReason: null,
    };
  }
  if (candidates.length > 1) {
    blockingReasons.push(`AMBIGUOUS_SCOPE_MATCH:${game.operatorGameId}`);
    return {
      operatorGameId: game.operatorGameId,
      matchedInternalGameId: null,
      mappingStatus: "AMBIGUOUS",
      blockingReason: "AMBIGUOUS_SCOPE_MATCH",
    };
  }

  blockingReasons.push("IDENTITY_PROVIDER_GAME_MISSING");
  return {
    operatorGameId: game.operatorGameId,
    matchedInternalGameId: null,
    mappingStatus: "UNMATCHED",
    blockingReason: "IDENTITY_PROVIDER_GAME_MISSING",
  };
}

export async function validateKboOperatorInput(params: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  identity: IdentityDocument;
  betmanScope: KboBetmanScopeInput | null;
  protoOdds: KboProtoOddsInput | null;
  validation: KboOperatorInputValidation;
}> {
  const cwd = params.cwd ?? process.cwd();
  const identityPath = getKboIdentityArtifactPath(
    params.dateKst,
    getKboIdentityProvider(),
    cwd,
  );
  const betmanScopePath = path.join(
    cwd,
    "data/operator-input/kbo",
    `${params.dateKst}-betman-scope.json`,
  );
  const protoOddsPath = path.join(
    cwd,
    "data/operator-input/kbo",
    `${params.dateKst}-proto-odds.json`,
  );

  const identity = await readJsonIfExists<IdentityDocument>(identityPath);
  if (!identity) {
    throw new Error(`identity dataset missing: ${identityPath}`);
  }
  if (identity.meta.dateKst !== params.dateKst) {
    throw new Error(`identity date mismatch: ${identity.meta.dateKst}`);
  }

  const betmanScope = await readJsonIfExists<KboBetmanScopeInput>(betmanScopePath);
  const protoOdds = await readJsonIfExists<KboProtoOddsInput>(protoOddsPath);

  const blockingReasons: string[] = [];
  const duplicateRows: string[] = [];
  const invalidOdds: Array<{
    operatorGameId: string;
    marketType: string;
    value: unknown;
  }> = [];

  const identityById = new Map(
    identity.rows.map((row) => [row.internalGameId, row] as const),
  );

  const mappings: KboOperatorGameMapping[] = [];
  const operatorOnlyGames: string[] = [];

  let scopeGamesEntered = 0;
  let scopeGamesVerified = 0;
  let scopeGamesMatched = 0;
  let scopeGamesUnmatched = 0;
  let scopeGamesAmbiguous = 0;

  if (betmanScope) {
    if (betmanScope.dateKst !== params.dateKst) {
      blockingReasons.push("BETMAN_SCOPE_DATE_MISMATCH");
    }
    const seenOperatorGameIds = new Set<string>();
    for (const game of betmanScope.games) {
      scopeGamesEntered += 1;
      if (seenOperatorGameIds.has(game.operatorGameId)) {
        duplicateRows.push(`scope:${game.operatorGameId}`);
        blockingReasons.push("SCOPE_OPERATOR_GAME_DUPLICATE");
      }
      seenOperatorGameIds.add(game.operatorGameId);

      const mapping = validateScopeGame(
        game,
        params.dateKst,
        identityById,
        identity.rows,
        blockingReasons,
      );
      mappings.push(mapping);

      if (game.reviewStatus === "VERIFIED") scopeGamesVerified += 1;
      if (mapping.mappingStatus === "MATCHED") scopeGamesMatched += 1;
      if (mapping.mappingStatus === "UNMATCHED") {
        scopeGamesUnmatched += 1;
        operatorOnlyGames.push(game.operatorGameId);
      }
      if (mapping.mappingStatus === "AMBIGUOUS") scopeGamesAmbiguous += 1;
    }
  }

  let oddsRowsEntered = 0;
  let oddsRowsVerified = 0;
  let oddsRowsRejected = 0;
  let oddsGamesMatched = 0;

  if (protoOdds) {
    if (protoOdds.dateKst !== params.dateKst) {
      blockingReasons.push("PROTO_ODDS_DATE_MISMATCH");
    }
    const seenOddsKeys = new Set<string>();
    for (const row of protoOdds.games) {
      oddsRowsEntered += 1;
      if (!MAPPING_STATUSES.has(row.mappingStatus)) {
        blockingReasons.push(`INVALID_ODDS_MAPPING_STATUS:${row.operatorGameId}`);
      }
      if (!REVIEW_STATUSES.has(row.reviewStatus)) {
        blockingReasons.push(`INVALID_ODDS_REVIEW_STATUS:${row.operatorGameId}`);
      }
      if (!MARKET_TYPES.has(row.marketType)) {
        blockingReasons.push(`INVALID_ODDS_MARKET_TYPE:${row.operatorGameId}`);
      }

      const duplicateKey = `${row.operatorGameId}|${row.marketType}|${row.selection}`;
      if (seenOddsKeys.has(duplicateKey)) {
        duplicateRows.push(`odds:${duplicateKey}`);
        blockingReasons.push("ODDS_DUPLICATE_ROW");
      }
      seenOddsKeys.add(duplicateKey);

      if (!(typeof row.odds === "number" && Number.isFinite(row.odds) && row.odds > 0)) {
        invalidOdds.push({
          operatorGameId: row.operatorGameId,
          marketType: row.marketType,
          value: row.odds,
        });
        blockingReasons.push("INVALID_ODDS_VALUE");
      }

      if (row.reviewStatus === "VERIFIED") oddsRowsVerified += 1;
      if (row.reviewStatus === "REJECTED") oddsRowsRejected += 1;

      if (row.matchedInternalGameId) {
        if (identityById.has(row.matchedInternalGameId)) {
          oddsGamesMatched += 1;
        } else {
          blockingReasons.push("IDENTITY_PROVIDER_GAME_MISSING");
          operatorOnlyGames.push(row.operatorGameId);
        }
      } else if (row.mappingStatus === "MATCHED") {
        blockingReasons.push("ODDS_MATCHED_ID_MISSING");
      }
    }
  }

  let inputReadyStatus: KboOperatorInputReadyStatus = "NOT_ENTERED";
  if (betmanScope || protoOdds) inputReadyStatus = "DRAFT";
  const anyAmbiguousOrUnmatched =
    scopeGamesUnmatched > 0 ||
    scopeGamesAmbiguous > 0 ||
    operatorOnlyGames.length > 0;
  if ((betmanScope || protoOdds) && anyAmbiguousOrUnmatched) {
    inputReadyStatus = "PARTIALLY_MAPPED";
  }
  const anyVerified =
    scopeGamesVerified > 0 || oddsRowsVerified > 0 || protoOdds?.reviewStatus === "VERIFIED";
  if ((betmanScope || protoOdds) && anyVerified && anyAmbiguousOrUnmatched) {
    inputReadyStatus = "READY_FOR_OPERATOR_REVIEW";
  }
  const fullyVerified =
    betmanScope != null &&
    protoOdds != null &&
    betmanScope.games.length > 0 &&
    protoOdds.games.length > 0 &&
    scopeGamesVerified === betmanScope.games.length &&
    oddsRowsVerified === protoOdds.games.length &&
    scopeGamesMatched === betmanScope.games.length &&
    duplicateRows.length === 0 &&
    invalidOdds.length === 0 &&
    blockingReasons.filter((r) => r !== "LEGAL_CLEARANCE_PENDING").length === 0;
  if (fullyVerified) {
    inputReadyStatus = "VERIFIED_FOR_RESEARCH_INPUT";
  }

  const uniqueBlockingReasons = [...new Set(blockingReasons)];

  const validation: KboOperatorInputValidation = {
    targetDateKst: params.dateKst,
    betmanScopeFile: betmanScopePath,
    protoOddsFile: protoOddsPath,
    scopeGamesEntered,
    scopeGamesVerified,
    scopeGamesMatched,
    scopeGamesUnmatched,
    scopeGamesAmbiguous,
    oddsRowsEntered,
    oddsRowsVerified,
    oddsRowsRejected,
    oddsGamesMatched,
    duplicateRows,
    invalidOdds,
    identityGamesAvailable: identity.rows.length,
    operatorOnlyGames: [...new Set(operatorOnlyGames)],
    blockingReasons: uniqueBlockingReasons,
    inputReadyStatus,
    mappings,
    generatedAt: new Date().toISOString(),
  };

  return { identity, betmanScope, protoOdds, validation };
}
