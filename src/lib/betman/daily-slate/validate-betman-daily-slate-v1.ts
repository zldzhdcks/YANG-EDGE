import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  BETMAN_DAILY_SLATE_SCHEMA_VERSION,
  type BetmanDailySlateGameInput,
  type BetmanDailySlateInputV1,
  type BetmanDailySlateReviewStatus,
  type BetmanOperatorInputStatus,
  type BetmanScopeCompletenessStatus,
  type BetmanSupportedSport,
} from "./betman-daily-slate-types";
import {
  isValidIsoTimestamp,
  scheduledStartRepresentsDateKst,
} from "./schedule-date-kst";

const REVIEW_STATUSES = new Set<BetmanDailySlateReviewStatus>([
  "DRAFT",
  "VERIFIED",
  "REJECTED",
]);

const SUPPORTED_SPORTS = new Set<BetmanSupportedSport>([
  "BASEBALL",
  "SOCCER",
  "BASKETBALL",
  "VOLLEYBALL",
]);

const COMPLETENESS = new Set<BetmanScopeCompletenessStatus>([
  "UNVERIFIED",
  "INCOMPLETE",
  "COMPLETE",
]);

export type OperatorSlateIntakeStatus =
  | "INPUT_MISSING"
  | "DRAFT_INCOMPLETE"
  | "BLOCKED_INVALID"
  | "READY_FOR_OPERATOR_REVIEW"
  | "FREEZE_READY"
  | "REJECTED";

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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function betmanDailySlateInputPath(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(
    cwd,
    "data/operator-input/betman",
    `${dateKst}-daily-slate-v1.json`,
  );
}

export function normalizeBetmanSport(
  raw: string,
): BetmanSupportedSport | "TENNIS" | "OTHER" {
  const upper = raw.trim().toUpperCase();
  if (upper === "TENNIS") return "TENNIS";
  if (SUPPORTED_SPORTS.has(upper as BetmanSupportedSport)) {
    return upper as BetmanSupportedSport;
  }
  if (upper.includes("BASEBALL") || upper === "야구") return "BASEBALL";
  if (upper.includes("SOCCER") || upper.includes("FOOTBALL") || upper === "축구") {
    return "SOCCER";
  }
  if (upper.includes("BASKETBALL") || upper === "농구") return "BASKETBALL";
  if (upper.includes("VOLLEYBALL") || upper === "배구") return "VOLLEYBALL";
  return "OTHER";
}

export function computeBetmanDailySlateStableInputHash(
  input: BetmanDailySlateInputV1,
): string {
  return sha256(
    stableStringify({
      schemaVersion: input.schemaVersion,
      targetDateKst: input.targetDateKst,
      reviewStatus: input.reviewStatus,
      scopeCompletenessStatus: input.scopeCompletenessStatus ?? "UNVERIFIED",
      games: input.games.map((game) => ({
        operatorSlateGameId: game.operatorSlateGameId,
        sport: game.sport,
        competitionNameRaw: game.competitionNameRaw,
        homeTeamRaw: game.homeTeamRaw,
        awayTeamRaw: game.awayTeamRaw,
        scheduledStartTimeKst: game.scheduledStartTimeKst,
        providerGameId: game.providerGameId,
        providerFixtureId: game.providerFixtureId,
        marketSelections: game.marketSelections,
        reviewStatus: game.reviewStatus,
        operatorHomeAwayStatus: game.operatorHomeAwayStatus,
      })),
    }),
  );
}

function resolveScopeCompleteness(
  input: BetmanDailySlateInputV1,
): BetmanScopeCompletenessStatus {
  const raw = input.scopeCompletenessStatus;
  if (raw && COMPLETENESS.has(raw)) return raw;
  return "UNVERIFIED";
}

type GameIdentityResult = {
  blocking: string[];
  identityReady: boolean;
};

function validateGameIdentity(
  game: BetmanDailySlateGameInput,
  dateKst: string,
): GameIdentityResult {
  const blocking: string[] = [];
  if (!game.operatorSlateGameId?.trim()) {
    blocking.push("MISSING_OPERATOR_SLATE_GAME_ID");
  }
  if (!game.sport?.trim()) {
    blocking.push("MISSING_SPORT");
  }
  if (!game.homeTeamRaw?.trim()) {
    blocking.push("MISSING_HOME");
  }
  if (!game.awayTeamRaw?.trim()) {
    blocking.push("MISSING_AWAY");
  }
  if (!game.scheduledStartTimeKst?.trim()) {
    blocking.push("MISSING_SCHEDULED_START");
  } else if (!isValidIsoTimestamp(game.scheduledStartTimeKst)) {
    blocking.push("INVALID_SCHEDULED_START");
  } else if (
    !scheduledStartRepresentsDateKst(game.scheduledStartTimeKst, dateKst)
  ) {
    blocking.push("CROSS_DATE_GAME");
  }
  if (!REVIEW_STATUSES.has(game.reviewStatus)) {
    blocking.push("INVALID_GAME_REVIEW_STATUS");
  } else if (game.reviewStatus !== "VERIFIED") {
    blocking.push("GAME_REVIEW_NOT_VERIFIED");
  }
  if (game.operatorHomeAwayStatus !== "VERIFIED") {
    blocking.push("HOME_AWAY_NOT_VERIFIED");
  }

  // Legacy structural check preserved for older consumers
  if (!game.homeTeamRaw?.trim() || !game.awayTeamRaw?.trim()) {
    if (!blocking.includes("MISSING_HOME") && !blocking.includes("MISSING_AWAY")) {
      blocking.push("MISSING_TEAM_TEXT");
    }
  }
  if (!game.scheduledStartTimeKst?.trim() && !blocking.includes("MISSING_SCHEDULED_START")) {
    blocking.push("START_TIME_UNKNOWN");
  }

  return {
    blocking,
    identityReady: blocking.length === 0,
  };
}

export type ValidateBetmanDailySlateResult = {
  input: BetmanDailySlateInputV1 | null;
  operatorInputStatus: BetmanOperatorInputStatus;
  intakeStatus: OperatorSlateIntakeStatus;
  stableInputHashSha256: string | null;
  blockingReasons: string[];
  warnings: string[];
  duplicateOperatorGameIds: string[];
  unsupportedSportGames: number;
  supportedSportGames: number;
  sportCounts: Record<string, number>;
  /** Additive freeze-readiness fields */
  scopeCompletenessStatus: BetmanScopeCompletenessStatus | null;
  freezeReady: boolean;
  identityReadyGameCount: number;
  blockedGameCount: number;
  unverifiedGameIds: string[];
  crossDateGameIds: string[];
  totalGames: number | null;
  totalGamesAuthoritative: boolean;
};

function deriveIntakeStatus(input: {
  missing: boolean;
  blocking: string[];
  reviewStatus: BetmanDailySlateReviewStatus | null;
  freezeReady: boolean;
}): OperatorSlateIntakeStatus {
  if (input.missing) return "INPUT_MISSING";
  if (input.reviewStatus === "REJECTED") return "REJECTED";
  if (input.freezeReady) return "FREEZE_READY";
  if (input.blocking.length > 0) return "BLOCKED_INVALID";
  if (input.reviewStatus === "DRAFT") return "DRAFT_INCOMPLETE";
  return "READY_FOR_OPERATOR_REVIEW";
}

export async function validateBetmanDailySlateV1(params: {
  dateKst: string;
  cwd?: string;
}): Promise<ValidateBetmanDailySlateResult> {
  const cwd = params.cwd ?? process.cwd();
  const inputPath = betmanDailySlateInputPath(params.dateKst, cwd);
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!(await fileExists(inputPath))) {
    return {
      input: null,
      operatorInputStatus: "NOT_ENTERED",
      intakeStatus: "INPUT_MISSING",
      stableInputHashSha256: null,
      blockingReasons: [],
      warnings: ["OPERATOR_INPUT_NOT_ENTERED"],
      duplicateOperatorGameIds: [],
      unsupportedSportGames: 0,
      supportedSportGames: 0,
      sportCounts: {},
      scopeCompletenessStatus: null,
      freezeReady: false,
      identityReadyGameCount: 0,
      blockedGameCount: 0,
      unverifiedGameIds: [],
      crossDateGameIds: [],
      totalGames: null,
      totalGamesAuthoritative: false,
    };
  }

  const input = JSON.parse(
    await readFile(inputPath, "utf8"),
  ) as BetmanDailySlateInputV1;

  if (input.schemaVersion !== BETMAN_DAILY_SLATE_SCHEMA_VERSION) {
    blockingReasons.push("INVALID_SCHEMA_VERSION");
  }
  if (input.targetDateKst !== params.dateKst) {
    blockingReasons.push("DATE_MISMATCH");
  }
  if (input.sourceType !== "OPERATOR_MANUAL") {
    blockingReasons.push("SOURCE_TYPE_MUST_BE_OPERATOR_MANUAL");
  }
  if (!REVIEW_STATUSES.has(input.reviewStatus)) {
    blockingReasons.push("INVALID_TOP_LEVEL_REVIEW_STATUS");
  }
  if (input.reviewStatus === "DRAFT") {
    warnings.push("OPERATOR_INPUT_NOT_VERIFIED");
    blockingReasons.push("TOP_LEVEL_REVIEW_NOT_VERIFIED");
  }
  if (input.reviewStatus === "REJECTED") {
    blockingReasons.push("TOP_LEVEL_REJECTED");
  }

  const scopeCompletenessStatus = resolveScopeCompleteness(input);
  if (scopeCompletenessStatus !== "COMPLETE") {
    blockingReasons.push(
      scopeCompletenessStatus === "INCOMPLETE"
        ? "SCOPE_COMPLETENESS_INCOMPLETE"
        : "SCOPE_COMPLETENESS_UNVERIFIED",
    );
  }

  if (input.reviewStatus === "VERIFIED") {
    if (!input.reviewedAt || !isValidIsoTimestamp(input.reviewedAt)) {
      blockingReasons.push("REVIEWED_AT_REQUIRED");
    }
  }

  if (!Array.isArray(input.games)) {
    blockingReasons.push("GAMES_NOT_ARRAY");
  }

  const seenIds = new Set<string>();
  const duplicateOperatorGameIds: string[] = [];
  const sportCounts: Record<string, number> = {};
  const unverifiedGameIds: string[] = [];
  const crossDateGameIds: string[] = [];
  let unsupportedSportGames = 0;
  let supportedSportGames = 0;
  let identityReadyGameCount = 0;
  let blockedGameCount = 0;

  const games = Array.isArray(input.games) ? input.games : [];

  for (const game of games) {
    const identity = validateGameIdentity(game, params.dateKst);
    blockingReasons.push(...identity.blocking);
    if (identity.identityReady) identityReadyGameCount += 1;
    else blockedGameCount += 1;

    if (game.reviewStatus !== "VERIFIED" && game.operatorSlateGameId) {
      unverifiedGameIds.push(game.operatorSlateGameId);
    }
    if (
      game.scheduledStartTimeKst &&
      isValidIsoTimestamp(game.scheduledStartTimeKst) &&
      !scheduledStartRepresentsDateKst(
        game.scheduledStartTimeKst,
        params.dateKst,
      ) &&
      game.operatorSlateGameId
    ) {
      crossDateGameIds.push(game.operatorSlateGameId);
    }

    if (game.operatorSlateGameId && seenIds.has(game.operatorSlateGameId)) {
      duplicateOperatorGameIds.push(game.operatorSlateGameId);
    }
    if (game.operatorSlateGameId) seenIds.add(game.operatorSlateGameId);

    const sport = normalizeBetmanSport(game.sport ?? "");
    sportCounts[sport] = (sportCounts[sport] ?? 0) + 1;
    if (sport === "TENNIS" || sport === "OTHER") {
      unsupportedSportGames += 1;
      if (sport === "TENNIS") {
        warnings.push("RESEARCH_UNSUPPORTED_SPORT:TENNIS");
        warnings.push("UNSUPPORTED_SPORT:TENNIS");
      }
    } else {
      supportedSportGames += 1;
    }

    if (
      game.marketRuleStatus === "UNVERIFIED" &&
      Array.isArray(game.marketSelections) &&
      game.marketSelections.some((s) => s.oddsDecimal != null)
    ) {
      warnings.push("MARKET_RULE_UNVERIFIED");
    }
  }

  if (duplicateOperatorGameIds.length > 0) {
    blockingReasons.push("DUPLICATE_OPERATOR_GAME_ID");
  }

  const uniqueBlocking = [...new Set(blockingReasons)];
  const freezeReady =
    uniqueBlocking.length === 0 &&
    input.schemaVersion === BETMAN_DAILY_SLATE_SCHEMA_VERSION &&
    input.targetDateKst === params.dateKst &&
    input.sourceType === "OPERATOR_MANUAL" &&
    input.reviewStatus === "VERIFIED" &&
    scopeCompletenessStatus === "COMPLETE" &&
    !!input.reviewedAt &&
    isValidIsoTimestamp(input.reviewedAt) &&
    Array.isArray(input.games);

  // Legacy operatorInputStatus: structural schema/date/dup/basic field issues only.
  const legacyBlockers = uniqueBlocking.filter((r) =>
    [
      "INVALID_SCHEMA_VERSION",
      "DATE_MISMATCH",
      "INVALID_TOP_LEVEL_REVIEW_STATUS",
      "GAMES_NOT_ARRAY",
      "DUPLICATE_OPERATOR_GAME_ID",
      "MISSING_OPERATOR_SLATE_GAME_ID",
      "MISSING_TEAM_TEXT",
      "START_TIME_UNKNOWN",
      "INVALID_GAME_REVIEW_STATUS",
    ].includes(r),
  );

  let operatorInputStatus: BetmanOperatorInputStatus = "DRAFT";
  if (legacyBlockers.length > 0) operatorInputStatus = "BLOCKED";
  else if (input.reviewStatus === "VERIFIED") operatorInputStatus = "VERIFIED";
  else if (input.reviewStatus === "REJECTED") operatorInputStatus = "REJECTED";

  const intakeStatus = deriveIntakeStatus({
    missing: false,
    blocking: uniqueBlocking,
    reviewStatus: input.reviewStatus,
    freezeReady,
  });

  return {
    input,
    operatorInputStatus,
    intakeStatus,
    stableInputHashSha256: computeBetmanDailySlateStableInputHash(input),
    blockingReasons: uniqueBlocking,
    warnings: [...new Set(warnings)],
    duplicateOperatorGameIds,
    unsupportedSportGames,
    supportedSportGames,
    sportCounts,
    scopeCompletenessStatus,
    freezeReady,
    identityReadyGameCount,
    blockedGameCount,
    unverifiedGameIds: [...new Set(unverifiedGameIds)],
    crossDateGameIds: [...new Set(crossDateGameIds)],
    totalGames: games.length,
    totalGamesAuthoritative: true,
  };
}
