import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  BETMAN_DAILY_SLATE_SCHEMA_VERSION,
  type BetmanDailySlateGameInput,
  type BetmanDailySlateInputV1,
  type BetmanDailySlateReviewStatus,
  type BetmanOperatorInputStatus,
  type BetmanSupportedSport,
} from "./betman-daily-slate-types";

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
      })),
    }),
  );
}

function validateGame(game: BetmanDailySlateGameInput): string[] {
  const blocking: string[] = [];
  if (!game.operatorSlateGameId?.trim()) {
    blocking.push("MISSING_OPERATOR_SLATE_GAME_ID");
  }
  if (!game.homeTeamRaw?.trim() || !game.awayTeamRaw?.trim()) {
    blocking.push("MISSING_TEAM_TEXT");
  }
  if (!game.scheduledStartTimeKst?.trim()) {
    blocking.push("START_TIME_UNKNOWN");
  }
  if (!REVIEW_STATUSES.has(game.reviewStatus)) {
    blocking.push("INVALID_GAME_REVIEW_STATUS");
  }
  return blocking;
}

export async function validateBetmanDailySlateV1(params: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  input: BetmanDailySlateInputV1 | null;
  operatorInputStatus: BetmanOperatorInputStatus;
  stableInputHashSha256: string | null;
  blockingReasons: string[];
  warnings: string[];
  duplicateOperatorGameIds: string[];
  unsupportedSportGames: number;
  supportedSportGames: number;
  sportCounts: Record<string, number>;
}> {
  const cwd = params.cwd ?? process.cwd();
  const inputPath = betmanDailySlateInputPath(params.dateKst, cwd);
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!(await fileExists(inputPath))) {
    return {
      input: null,
      operatorInputStatus: "NOT_ENTERED",
      stableInputHashSha256: null,
      blockingReasons: [],
      warnings: ["OPERATOR_INPUT_NOT_ENTERED"],
      duplicateOperatorGameIds: [],
      unsupportedSportGames: 0,
      supportedSportGames: 0,
      sportCounts: {},
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
  if (!REVIEW_STATUSES.has(input.reviewStatus)) {
    blockingReasons.push("INVALID_TOP_LEVEL_REVIEW_STATUS");
  }
  if (input.reviewStatus === "DRAFT") {
    warnings.push("OPERATOR_INPUT_NOT_VERIFIED");
  }

  const seenIds = new Set<string>();
  const duplicateOperatorGameIds: string[] = [];
  const sportCounts: Record<string, number> = {};
  let unsupportedSportGames = 0;
  let supportedSportGames = 0;

  for (const game of input.games) {
    blockingReasons.push(...validateGame(game));
    if (seenIds.has(game.operatorSlateGameId)) {
      duplicateOperatorGameIds.push(game.operatorSlateGameId);
    }
    seenIds.add(game.operatorSlateGameId);

    const sport = normalizeBetmanSport(game.sport);
    sportCounts[sport] = (sportCounts[sport] ?? 0) + 1;
    if (sport === "TENNIS" || sport === "OTHER") {
      unsupportedSportGames += 1;
      if (sport === "TENNIS") warnings.push("UNSUPPORTED_SPORT:TENNIS");
    } else {
      supportedSportGames += 1;
    }

    if (
      game.marketRuleStatus === "UNVERIFIED" &&
      game.marketSelections.some((s) => s.oddsDecimal != null)
    ) {
      warnings.push("MARKET_RULE_UNVERIFIED");
    }
  }

  if (duplicateOperatorGameIds.length > 0) {
    blockingReasons.push("DUPLICATE_OPERATOR_GAME_ID");
  }

  let operatorInputStatus: BetmanOperatorInputStatus = "DRAFT";
  if (blockingReasons.length > 0) operatorInputStatus = "BLOCKED";
  else if (input.reviewStatus === "VERIFIED") operatorInputStatus = "VERIFIED";
  else if (input.reviewStatus === "REJECTED") operatorInputStatus = "REJECTED";

  return {
    input,
    operatorInputStatus,
    stableInputHashSha256: computeBetmanDailySlateStableInputHash(input),
    blockingReasons: [...new Set(blockingReasons)],
    warnings: [...new Set(warnings)],
    duplicateOperatorGameIds,
    unsupportedSportGames,
    supportedSportGames,
    sportCounts,
  };
}
