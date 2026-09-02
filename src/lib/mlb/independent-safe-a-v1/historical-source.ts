/**
 * MLB Independent Model v1 — SAFE_A historical source collector.
 *
 * Official MLB Stats API only. Network is allowed here.
 * This module does not build labels, join datasets, or train.
 */
import path from "node:path";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "../research-stats-cache";
import { isRealCalendarDate } from "../independent-model-v1";

export const MLB_INDEPENDENT_SAFE_A_SOURCE_SCHEMA_V1 =
  "mlb-independent-safe-a-historical-source-v1" as const;
export const MLB_INDEPENDENT_SAFE_A_SOURCE_ORIGIN = "MLB_STATS_API" as const;
export const MLB_INDEPENDENT_SAFE_A_SEASON_V1 = 2024 as const;
export const MLB_INDEPENDENT_SAFE_A_GAME_TYPE_V1 = "R" as const;
export const MLB_INDEPENDENT_SAFE_A_SPORT_ID_V1 = 1 as const;

export const MLB_INDEPENDENT_SAFE_A_SOURCE_QUERY_V1 =
  "/api/v1/schedule?sportId=1&startDate=2024-03-01&endDate=2024-11-15&gameType=R";

export const MLB_INDEPENDENT_SAFE_A_SOURCE_ENDPOINT_DESCRIPTION_V1 =
  "Official MLB Stats API schedule for sportId=1 (MLB), season window 2024-03-01..2024-11-15, gameType=R (Regular Season).";

export function independentSafeAHistoricalSourceRel(): string {
  return "data/research/mlb/independent-model-v1/historical-source/2024-regular-season-v1.json";
}

export function independentSafeAHistoricalSourcePath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentSafeAHistoricalSourceRel());
}

export function independentSafeAFeatureArtifactRel(): string {
  return "data/research/mlb/independent-model-v1/features/2024-safe-a-feature-artifact-v1.json";
}

export function independentSafeAFeatureArtifactPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentSafeAFeatureArtifactRel());
}

export function independentSafeAAuditArtifactRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-safe-a-materialization-audit-v1.json";
}

export function independentSafeAAuditArtifactPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentSafeAAuditArtifactRel());
}

export type MlbIndependentSafeAHistoricalGameV1 = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
  homeTeamId: number;
  awayTeamId: number;
  gameType: "R";
  abstractGameState: string | null;
  detailedState: string | null;
  codedGameState: string | null;
  statusCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  doubleHeader: string | null;
  gameNumber: number | null;
  ifNecessary: string | null;
  rescheduleDate?: string;
  rescheduledFrom?: string;
  rescheduleGameDate?: string;
  resumeDate?: string;
  resumedFrom?: string;
  resumeGameDate?: string;
  resumedFromDate?: string;
  description?: string;
  statusReason?: string;
  /**
   * Source-only. Date whose DATE-BATCH may apply this result AFTER freeze.
   * Not a feature field. Null = do not apply (unproven / not completed).
   */
  safeResultApplyDate: string | null;
  resultProvenanceStatus:
    | "STANDARD"
    | "CROSS_DATE_RESUME_RESOLVED"
    | "UNPROVEN_COMPLETION"
    | "NOT_APPLICABLE";
};

export type MlbIndependentSafeAHistoricalSourceV1 = {
  schemaVersion: typeof MLB_INDEPENDENT_SAFE_A_SOURCE_SCHEMA_V1;
  source: typeof MLB_INDEPENDENT_SAFE_A_SOURCE_ORIGIN;
  season: typeof MLB_INDEPENDENT_SAFE_A_SEASON_V1;
  gameType: typeof MLB_INDEPENDENT_SAFE_A_GAME_TYPE_V1;
  sportId: typeof MLB_INDEPENDENT_SAFE_A_SPORT_ID_V1;
  collectedAt: string;
  endpoint: string;
  query: string;
  rowCount: number;
  collapsedSameGamePkCount: number;
  games: MlbIndependentSafeAHistoricalGameV1[];
};

export type SafeASourceStatusClass =
  | "FINAL_STANDARD"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED"
  | "UNKNOWN"
  | "OTHER";

export type SafeAResultProvenanceStatus =
  | "STANDARD"
  | "CROSS_DATE_RESUME_RESOLVED"
  | "UNPROVEN_COMPLETION"
  | "NOT_APPLICABLE";

export class SafeAHistoricalSourceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "SafeAHistoricalSourceError";
    this.code = code;
  }
}

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function optionalPresentString(
  raw: Record<string, unknown>,
  key: string,
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(raw, key)) return undefined;
  const value = raw[key];
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return undefined;
}

export function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

export function normalizeCommenceTimeUtc(value: string): string {
  return new Date(Date.parse(value)).toISOString();
}

export function isNonNegativeIntScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function compareHistoricalGames(
  a: MlbIndependentSafeAHistoricalGameV1,
  b: MlbIndependentSafeAHistoricalGameV1,
): number {
  if (a.officialDate !== b.officialDate) {
    return a.officialDate < b.officialDate ? -1 : 1;
  }
  if (a.commenceTimeUtc !== b.commenceTimeUtc) {
    return a.commenceTimeUtc < b.commenceTimeUtc ? -1 : 1;
  }
  return a.gamePk - b.gamePk;
}

export const SAFE_A_RESULT_PROVENANCE_STATUSES_V1 = [
  "STANDARD",
  "CROSS_DATE_RESUME_RESOLVED",
  "UNPROVEN_COMPLETION",
  "NOT_APPLICABLE",
] as const;

function officialDateToken(value: string | undefined | null): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function isApplyableCompletedFinal(
  game: MlbIndependentSafeAHistoricalGameV1,
): boolean {
  if (classifySourceStatus(game) !== "FINAL_STANDARD") return false;
  if (
    !isNonNegativeIntScore(game.homeScore) ||
    !isNonNegativeIntScore(game.awayScore)
  ) {
    return false;
  }
  return game.homeScore !== game.awayScore;
}

function throwProvenance(
  code: string,
  gamePk: number,
  detail: string,
): never {
  throw new SafeAHistoricalSourceError(
    code,
    `gamePk ${gamePk} ${detail}`,
  );
}

/**
 * Persisted source-row temporal integrity. Does not reconstruct snapshot
 * groups. Blocks unsafe apply dates even if a collector never emitted them.
 */
export function validateHistoricalSourceResultProvenance(
  games: MlbIndependentSafeAHistoricalGameV1[],
): void {
  for (const game of games) {
    const status = game.resultProvenanceStatus;
    if (
      status !== "STANDARD" &&
      status !== "CROSS_DATE_RESUME_RESOLVED" &&
      status !== "UNPROVEN_COMPLETION" &&
      status !== "NOT_APPLICABLE"
    ) {
      throwProvenance(
        "INVALID_RESULT_PROVENANCE_STATUS",
        game.gamePk,
        `resultProvenanceStatus invalid: ${String(status)}`,
      );
    }

    const apply = game.safeResultApplyDate;
    if (apply != null) {
      if (typeof apply !== "string" || !isRealCalendarDate(apply)) {
        throwProvenance(
          "MALFORMED_SAFE_RESULT_APPLY_DATE",
          game.gamePk,
          "safeResultApplyDate is not a real YYYY-MM-DD",
        );
      }
      if (apply < game.officialDate) {
        throwProvenance(
          "RESULT_APPLY_DATE_BEFORE_OFFICIAL_DATE",
          game.gamePk,
          `safeResultApplyDate ${apply} is before officialDate ${game.officialDate}`,
        );
      }
    }

    const classStatus = classifySourceStatus(game);
    if (
      apply != null &&
      (classStatus === "CANCELLED" ||
        classStatus === "POSTPONED" ||
        classStatus === "SUSPENDED" ||
        classStatus === "UNKNOWN" ||
        classStatus === "OTHER")
    ) {
      throwProvenance(
        "UNSAFE_RESULT_APPLY_ON_NON_FINAL",
        game.gamePk,
        `${classStatus} row must not have safeResultApplyDate`,
      );
    }

    if (status === "STANDARD") {
      if (!isApplyableCompletedFinal(game)) {
        throwProvenance(
          "APPLYABLE_RESULT_NOT_FINAL",
          game.gamePk,
          "STANDARD requires FINAL_STANDARD with valid non-tied scores",
        );
      }
      if (apply == null) {
        throwProvenance(
          "STANDARD_NULL_APPLY_DATE",
          game.gamePk,
          "STANDARD completed FINAL must have safeResultApplyDate",
        );
      }
      if (apply !== game.officialDate) {
        throwProvenance(
          "STANDARD_APPLY_DATE_MISMATCH",
          game.gamePk,
          `STANDARD safeResultApplyDate ${apply} must equal officialDate ${game.officialDate}`,
        );
      }
      continue;
    }

    if (status === "CROSS_DATE_RESUME_RESOLVED") {
      if (!isApplyableCompletedFinal(game)) {
        throwProvenance(
          "APPLYABLE_RESULT_NOT_FINAL",
          game.gamePk,
          "CROSS_DATE_RESUME_RESOLVED requires FINAL_STANDARD with valid non-tied scores",
        );
      }
      if (apply == null) {
        throwProvenance(
          "CROSS_DATE_RESUME_PROVENANCE_INCOMPLETE",
          game.gamePk,
          "CROSS_DATE_RESUME_RESOLVED requires safeResultApplyDate",
        );
      }
      if (apply <= game.officialDate) {
        throwProvenance(
          "CROSS_DATE_RESUME_APPLY_DATE_INVALID",
          game.gamePk,
          `CROSS_DATE_RESUME_RESOLVED safeResultApplyDate ${apply} must be after officialDate ${game.officialDate}`,
        );
      }
      const resumeGameDate = officialDateToken(game.resumeGameDate);
      if (!game.resumeGameDate || resumeGameDate == null) {
        throwProvenance(
          "CROSS_DATE_RESUME_PROVENANCE_INCOMPLETE",
          game.gamePk,
          "missing resumeGameDate",
        );
      }
      if (resumeGameDate !== apply) {
        throwProvenance(
          "CROSS_DATE_RESUME_APPLY_DATE_MISMATCH",
          game.gamePk,
          `safeResultApplyDate ${apply} != resumeGameDate ${resumeGameDate}`,
        );
      }
      const resumedFromDate = officialDateToken(game.resumedFromDate);
      if (!game.resumedFromDate || resumedFromDate == null) {
        throwProvenance(
          "CROSS_DATE_RESUME_PROVENANCE_INCOMPLETE",
          game.gamePk,
          "missing resumedFromDate",
        );
      }
      if (resumedFromDate !== game.officialDate) {
        throwProvenance(
          "RESUME_PROVENANCE_CONFLICT",
          game.gamePk,
          `resumedFromDate ${resumedFromDate} != officialDate ${game.officialDate}`,
        );
      }
      const resumeDay = officialDateToken(game.resumeDate);
      const commenceDay = officialDateToken(game.commenceTimeUtc);
      if (resumeDay !== apply && commenceDay !== apply) {
        throwProvenance(
          "CROSS_DATE_RESUME_TIMING_EVIDENCE_MISSING",
          game.gamePk,
          "resumeDate/commenceTimeUtc do not evidence safeResultApplyDate",
        );
      }
      continue;
    }

    if (status === "UNPROVEN_COMPLETION") {
      if (apply != null) {
        throwProvenance(
          "UNPROVEN_APPLY_DATE_PRESENT",
          game.gamePk,
          "UNPROVEN_COMPLETION must have null safeResultApplyDate",
        );
      }
      continue;
    }

    if (apply != null) {
      throwProvenance(
        "NOT_APPLICABLE_APPLY_DATE_PRESENT",
        game.gamePk,
        "NOT_APPLICABLE must have null safeResultApplyDate",
      );
    }
  }
}

export function hasResumeProvenance(
  game: MlbIndependentSafeAHistoricalGameV1,
): boolean {
  if (game.resumeDate || game.resumedFrom || game.resumeGameDate || game.resumedFromDate) {
    return true;
  }
  const detailed = (game.detailedState ?? "").toLowerCase();
  if (detailed.includes("suspend") || detailed.includes("resumed")) return true;
  const coded = (game.codedGameState ?? "").toUpperCase();
  if (coded === "U") return true;
  const abstract = (game.abstractGameState ?? "").toLowerCase();
  return abstract === "suspended";
}

/**
 * Cross-date resume/suspend only after group provenance is resolved.
 * Proven CROSS_DATE_RESUME_RESOLVED is not unproven.
 */
export function hasUnprovenCompletionProvenance(
  game: MlbIndependentSafeAHistoricalGameV1,
): boolean {
  if (game.resultProvenanceStatus === "CROSS_DATE_RESUME_RESOLVED") return false;
  if (game.resultProvenanceStatus === "STANDARD") return false;
  if (game.resultProvenanceStatus === "UNPROVEN_COMPLETION") return true;

  const detailed = (game.detailedState ?? "").toLowerCase();
  if (detailed.includes("suspend")) return true;
  const coded = (game.codedGameState ?? "").toUpperCase();
  if (coded === "U") return true;
  const abstract = (game.abstractGameState ?? "").toLowerCase();
  if (abstract === "suspended") return true;

  const namedDates = [
    officialDateToken(game.resumedFromDate),
    officialDateToken(game.resumeDate),
    officialDateToken(game.resumeGameDate),
  ].filter((d): d is string => d != null);

  if (namedDates.some((d) => d !== game.officialDate)) return true;

  if (game.resumedFrom && namedDates.length === 0) {
    const fromDay = officialDateToken(game.resumedFrom);
    if (fromDay == null || fromDay !== game.officialDate) return true;
  }

  return false;
}

function normalizeStatusToken(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function classifySourceStatus(
  game: MlbIndependentSafeAHistoricalGameV1,
): SafeASourceStatusClass {
  const abstract = normalizeStatusToken(game.abstractGameState);
  const detailed = normalizeStatusToken(game.detailedState);
  const coded = (game.codedGameState ?? "").trim().toUpperCase();

  if (
    abstract === "postponed" ||
    detailed === "postponed" ||
    detailed.includes("postponed") ||
    coded === "N"
  ) {
    return "POSTPONED";
  }
  if (
    abstract === "cancelled" ||
    abstract === "canceled" ||
    detailed === "cancelled" ||
    detailed === "canceled" ||
    detailed.includes("cancelled") ||
    detailed.includes("canceled") ||
    coded === "C"
  ) {
    return "CANCELLED";
  }
  if (
    abstract === "suspended" ||
    detailed.includes("suspend") ||
    coded === "U"
  ) {
    return "SUSPENDED";
  }
  if (
    abstract === "final" &&
    (coded === "F" || coded === "O" || coded === "") &&
    (detailed === "final" ||
      detailed === "game over" ||
      detailed.startsWith("completed early") ||
      detailed === "")
  ) {
    return "FINAL_STANDARD";
  }
  if (abstract === "" && detailed === "" && coded === "") return "UNKNOWN";
  if (abstract === "final") return "OTHER";
  if (abstract === "preview" || abstract === "live") return "OTHER";
  return "UNKNOWN";
}

function collapseRank(game: MlbIndependentSafeAHistoricalGameV1): number {
  const status = classifySourceStatus(game);
  if (status === "FINAL_STANDARD") return 50;
  if (status === "SUSPENDED") return 40;
  if (status === "OTHER") return 20;
  if (status === "POSTPONED" || status === "CANCELLED") return 10;
  return 0;
}

function scoresEqual(
  a: MlbIndependentSafeAHistoricalGameV1,
  b: MlbIndependentSafeAHistoricalGameV1,
): boolean {
  return a.homeScore === b.homeScore && a.awayScore === b.awayScore;
}

function uniqueNonNull(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === "string" && v !== ""))];
}

function firstPresent(
  games: MlbIndependentSafeAHistoricalGameV1[],
  key: keyof MlbIndependentSafeAHistoricalGameV1,
): string | undefined {
  for (const game of games) {
    const value = game[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

function selectCanonicalTargetSnapshot(
  list: MlbIndependentSafeAHistoricalGameV1[],
): MlbIndependentSafeAHistoricalGameV1 {
  const officialDates = [...new Set(list.map((g) => g.officialDate))];
  if (officialDates.length > 1) {
    const ranked = [...list].sort((a, b) => {
      const rankDiff = collapseRank(b) - collapseRank(a);
      if (rankDiff !== 0) return rankDiff;
      if (a.officialDate !== b.officialDate) {
        return a.officialDate < b.officialDate ? 1 : -1;
      }
      if (a.commenceTimeUtc !== b.commenceTimeUtc) {
        return a.commenceTimeUtc < b.commenceTimeUtc ? 1 : -1;
      }
      return (b.gameNumber ?? 0) - (a.gameNumber ?? 0);
    });
    return ranked[0]!;
  }
  const finals = list.filter((g) => classifySourceStatus(g) === "FINAL_STANDARD");
  const pool = finals.length > 0 ? finals : list;
  // Later commence is the completed/resumed listing. Group merge must still
  // keep resumeGameDate from the non-selected original snapshot.
  return [...pool].sort((a, b) => {
    if (a.commenceTimeUtc !== b.commenceTimeUtc) {
      return a.commenceTimeUtc < b.commenceTimeUtc ? 1 : -1;
    }
    return a.gamePk - b.gamePk;
  })[0]!;
}

function mergeSnapshotProvenance(
  chosen: MlbIndependentSafeAHistoricalGameV1,
  group: MlbIndependentSafeAHistoricalGameV1[],
): MlbIndependentSafeAHistoricalGameV1 {
  const merged: MlbIndependentSafeAHistoricalGameV1 = { ...chosen };
  const resumeDate = firstPresent(group, "resumeDate");
  const resumedFrom = firstPresent(group, "resumedFrom");
  const resumeGameDate = firstPresent(group, "resumeGameDate");
  const resumedFromDate = firstPresent(group, "resumedFromDate");
  if (resumeDate) merged.resumeDate = resumeDate;
  if (resumedFrom) merged.resumedFrom = resumedFrom;
  if (resumeGameDate) merged.resumeGameDate = resumeGameDate;
  if (resumedFromDate) merged.resumedFromDate = resumedFromDate;
  const scored = group.find(
    (g) =>
      classifySourceStatus(g) === "FINAL_STANDARD" &&
      isNonNegativeIntScore(g.homeScore) &&
      isNonNegativeIntScore(g.awayScore),
  );
  if (
    scored &&
    (!isNonNegativeIntScore(merged.homeScore) ||
      !isNonNegativeIntScore(merged.awayScore))
  ) {
    merged.homeScore = scored.homeScore;
    merged.awayScore = scored.awayScore;
  }
  return merged;
}

function assertGroupIdentity(
  gamePk: number,
  list: MlbIndependentSafeAHistoricalGameV1[],
): void {
  const homes = [...new Set(list.map((g) => g.homeTeamId))];
  const aways = [...new Set(list.map((g) => g.awayTeamId))];
  if (homes.length > 1) {
    throw new SafeAHistoricalSourceError(
      "TEAM_IDENTITY_MISMATCH",
      `gamePk ${gamePk} snapshots have different homeTeamId`,
    );
  }
  if (aways.length > 1) {
    throw new SafeAHistoricalSourceError(
      "TEAM_IDENTITY_MISMATCH",
      `gamePk ${gamePk} snapshots have different awayTeamId`,
    );
  }
  const finals = list.filter((g) => classifySourceStatus(g) === "FINAL_STANDARD");
  for (let i = 1; i < finals.length; i += 1) {
    if (!scoresEqual(finals[0]!, finals[i]!)) {
      throw new SafeAHistoricalSourceError(
        "DUPLICATE_GAME_PK",
        `gamePk ${gamePk} has conflicting FINAL snapshots`,
      );
    }
  }
}

function assertResumeProvenance(
  gamePk: number,
  officialDate: string,
  group: MlbIndependentSafeAHistoricalGameV1[],
): void {
  const resumeGameDates = uniqueNonNull(
    group.map((g) => officialDateToken(g.resumeGameDate) ?? undefined),
  );
  for (const raw of group) {
    if (raw.resumeGameDate) {
      const token = officialDateToken(raw.resumeGameDate);
      if (token == null) {
        throw new SafeAHistoricalSourceError(
          "MALFORMED_RESUME_GAME_DATE",
          `gamePk ${gamePk} resumeGameDate invalid`,
        );
      }
    }
  }
  if (resumeGameDates.length > 1) {
    throw new SafeAHistoricalSourceError(
      "CONFLICTING_RESUME_GAME_DATE",
      `gamePk ${gamePk} has conflicting resumeGameDate values`,
    );
  }
  if (resumeGameDates.length === 1 && resumeGameDates[0]! < officialDate) {
    throw new SafeAHistoricalSourceError(
      "RESUME_DATE_BEFORE_OFFICIAL_DATE",
      `gamePk ${gamePk} resumeGameDate ${resumeGameDates[0]} is before officialDate ${officialDate}`,
    );
  }
  const resumedFromDates = uniqueNonNull(
    group.map((g) => officialDateToken(g.resumedFromDate) ?? undefined),
  );
  if (resumedFromDates.length > 1) {
    throw new SafeAHistoricalSourceError(
      "RESUME_PROVENANCE_CONFLICT",
      `gamePk ${gamePk} has conflicting resumedFromDate values`,
    );
  }
  if (
    resumeGameDates.length === 1 &&
    resumedFromDates.length === 1 &&
    resumedFromDates[0] !== officialDate
  ) {
    throw new SafeAHistoricalSourceError(
      "RESUME_PROVENANCE_CONFLICT",
      `gamePk ${gamePk} resumedFromDate does not match officialDate`,
    );
  }
}

function proveCrossDateResume(
  officialDate: string,
  resumeGameDate: string,
  group: MlbIndependentSafeAHistoricalGameV1[],
): boolean {
  const original = group.some(
    (g) => officialDateToken(g.resumeGameDate) === resumeGameDate || officialDateToken(g.resumeDate) === resumeGameDate,
  );
  const resumed = group.some(
    (g) => officialDateToken(g.resumedFromDate) === officialDate,
  );
  const timing = group.some((g) => {
    const resumeInstantDay = officialDateToken(g.resumeDate);
    const commenceDay = officialDateToken(g.commenceTimeUtc);
    return (
      resumeInstantDay === resumeGameDate ||
      (officialDateToken(g.resumedFromDate) === officialDate &&
        commenceDay === resumeGameDate)
    );
  });
  return original && resumed && timing;
}

function resolveResultProvenance(
  merged: MlbIndependentSafeAHistoricalGameV1,
  group: MlbIndependentSafeAHistoricalGameV1[],
): MlbIndependentSafeAHistoricalGameV1 {
  const status = classifySourceStatus(merged);
  if (
    status === "POSTPONED" ||
    status === "CANCELLED" ||
    status === "UNKNOWN" ||
    status === "OTHER" ||
    status === "SUSPENDED"
  ) {
    if (status === "SUSPENDED") {
      return {
        ...merged,
        safeResultApplyDate: null,
        resultProvenanceStatus: "UNPROVEN_COMPLETION",
      };
    }
    return {
      ...merged,
      safeResultApplyDate: null,
      resultProvenanceStatus: "NOT_APPLICABLE",
    };
  }

  if (!isApplyableCompletedFinal(merged)) {
    return {
      ...merged,
      safeResultApplyDate: null,
      resultProvenanceStatus: "NOT_APPLICABLE",
    };
  }

  const resumeGameDate = officialDateToken(merged.resumeGameDate);
  const hasResumeEvidence = Boolean(
    merged.resumeDate ||
      merged.resumedFrom ||
      merged.resumeGameDate ||
      merged.resumedFromDate,
  );

  if (!hasResumeEvidence) {
    return {
      ...merged,
      safeResultApplyDate: merged.officialDate,
      resultProvenanceStatus: "STANDARD",
    };
  }

  if (resumeGameDate == null || resumeGameDate === merged.officialDate) {
    const fromDates = uniqueNonNull(
      group.map((g) => officialDateToken(g.resumedFromDate) ?? undefined),
    );
    if (fromDates.every((d) => d === merged.officialDate)) {
      return {
        ...merged,
        safeResultApplyDate: merged.officialDate,
        resultProvenanceStatus: "STANDARD",
      };
    }
    return {
      ...merged,
      safeResultApplyDate: null,
      resultProvenanceStatus: "UNPROVEN_COMPLETION",
    };
  }

  if (
    proveCrossDateResume(merged.officialDate, resumeGameDate, group)
  ) {
    return {
      ...merged,
      safeResultApplyDate: resumeGameDate,
      resultProvenanceStatus: "CROSS_DATE_RESUME_RESOLVED",
    };
  }

  return {
    ...merged,
    safeResultApplyDate: null,
    resultProvenanceStatus: "UNPROVEN_COMPLETION",
  };
}

export function canonicalizeHistoricalGameGroup(
  list: MlbIndependentSafeAHistoricalGameV1[],
): MlbIndependentSafeAHistoricalGameV1 {
  const gamePk = list[0]!.gamePk;
  assertGroupIdentity(gamePk, list);
  const chosen = selectCanonicalTargetSnapshot(list);
  assertResumeProvenance(gamePk, chosen.officialDate, list);
  const merged = mergeSnapshotProvenance(chosen, list);
  return resolveResultProvenance(merged, list);
}

/**
 * Same gamePk can appear on a postponed date and again on the makeup date,
 * or as original + resumed snapshots. Inspect the whole group before selecting.
 */
export function collapseSameGamePkSnapshots(
  games: MlbIndependentSafeAHistoricalGameV1[],
): {
  games: MlbIndependentSafeAHistoricalGameV1[];
  collapsedSameGamePkCount: number;
} {
  const groups = new Map<number, MlbIndependentSafeAHistoricalGameV1[]>();
  for (const game of games) {
    const list = groups.get(game.gamePk) ?? [];
    list.push(game);
    groups.set(game.gamePk, list);
  }

  const out: MlbIndependentSafeAHistoricalGameV1[] = [];
  let collapsedSameGamePkCount = 0;

  for (const [, list] of groups) {
    if (list.length > 1) collapsedSameGamePkCount += list.length - 1;
    out.push(canonicalizeHistoricalGameGroup(list));
  }

  out.sort(compareHistoricalGames);
  return { games: out, collapsedSameGamePkCount };
}

export function parseMlbScheduleBodyToHistoricalGames(
  body: unknown,
): MlbIndependentSafeAHistoricalGameV1[] {
  const root = asRecord(body);
  const dates = Array.isArray(root?.dates) ? root!.dates : [];
  const games: MlbIndependentSafeAHistoricalGameV1[] = [];

  for (const day of dates) {
    const dayRec = asRecord(day);
    const rawGames = Array.isArray(dayRec?.games) ? dayRec!.games : [];
    for (const raw of rawGames) {
      const parsed = parseScheduleGame(raw);
      if (parsed) games.push(parsed);
    }
  }

  return games;
}

function parseScheduleGame(
  raw: unknown,
): MlbIndependentSafeAHistoricalGameV1 | null {
  const g = asRecord(raw);
  if (!g) return null;

  const gameType = asString(g.gameType);
  if (gameType !== "R") return null;

  const gamePk = asFiniteNumber(g.gamePk);
  const officialDate = asString(g.officialDate);
  const gameDate = asString(g.gameDate);
  const status = asRecord(g.status);
  const teams = asRecord(g.teams);
  const home = asRecord(teams?.home);
  const away = asRecord(teams?.away);
  const homeTeamId = asFiniteNumber(asRecord(home?.team)?.id);
  const awayTeamId = asFiniteNumber(asRecord(away?.team)?.id);

  if (
    gamePk == null ||
    officialDate == null ||
    gameDate == null ||
    homeTeamId == null ||
    awayTeamId == null
  ) {
    return null;
  }

  const game: MlbIndependentSafeAHistoricalGameV1 = {
    gamePk,
    officialDate,
    commenceTimeUtc: gameDate,
    homeTeamId,
    awayTeamId,
    gameType: "R",
    abstractGameState: asString(status?.abstractGameState),
    detailedState: asString(status?.detailedState),
    codedGameState: asString(status?.codedGameState),
    statusCode: asString(status?.statusCode),
    homeScore: asFiniteNumber(home?.score),
    awayScore: asFiniteNumber(away?.score),
    doubleHeader: asString(g.doubleHeader),
    gameNumber: asFiniteNumber(g.gameNumber),
    ifNecessary: asString(g.ifNecessary),
    safeResultApplyDate: null,
    resultProvenanceStatus: "NOT_APPLICABLE",
  };

  const rescheduleDate = optionalPresentString(g, "rescheduleDate");
  const rescheduledFrom = optionalPresentString(g, "rescheduledFrom");
  const rescheduleGameDate = optionalPresentString(g, "rescheduleGameDate");
  const resumeDate = optionalPresentString(g, "resumeDate");
  const resumedFrom = optionalPresentString(g, "resumedFrom");
  const resumeGameDate = optionalPresentString(g, "resumeGameDate");
  const resumedFromDate = optionalPresentString(g, "resumedFromDate");
  const description = optionalPresentString(g, "description");
  const statusReason = optionalPresentString(status ?? {}, "reason");

  if (rescheduleDate) game.rescheduleDate = rescheduleDate;
  if (rescheduledFrom) game.rescheduledFrom = rescheduledFrom;
  if (rescheduleGameDate) game.rescheduleGameDate = rescheduleGameDate;
  if (resumeDate) game.resumeDate = resumeDate;
  if (resumedFrom) game.resumedFrom = resumedFrom;
  if (resumeGameDate) game.resumeGameDate = resumeGameDate;
  if (resumedFromDate) game.resumedFromDate = resumedFromDate;
  if (description) game.description = description;
  if (statusReason) game.statusReason = statusReason;

  return game;
}

export function validateHistoricalSourceIdentity(
  games: MlbIndependentSafeAHistoricalGameV1[],
): void {
  const seen = new Set<number>();
  for (const game of games) {
    if (!Number.isInteger(game.gamePk) || game.gamePk <= 0) {
      throw new SafeAHistoricalSourceError(
        "INVALID_IDENTITY",
        `gamePk must be a positive integer, got ${String(game.gamePk)}`,
      );
    }
    if (seen.has(game.gamePk)) {
      throw new SafeAHistoricalSourceError(
        "DUPLICATE_GAME_PK",
        `duplicate gamePk ${game.gamePk}`,
      );
    }
    seen.add(game.gamePk);

    if (!Number.isInteger(game.homeTeamId) || game.homeTeamId <= 0) {
      throw new SafeAHistoricalSourceError(
        "INVALID_TEAM_ID",
        `gamePk ${game.gamePk} homeTeamId invalid`,
      );
    }
    if (!Number.isInteger(game.awayTeamId) || game.awayTeamId <= 0) {
      throw new SafeAHistoricalSourceError(
        "INVALID_TEAM_ID",
        `gamePk ${game.gamePk} awayTeamId invalid`,
      );
    }
    if (game.homeTeamId === game.awayTeamId) {
      throw new SafeAHistoricalSourceError(
        "HOME_AWAY_TEAM_ID_EQUAL",
        `gamePk ${game.gamePk} homeTeamId === awayTeamId`,
      );
    }
    if (
      typeof game.officialDate !== "string" ||
      !isRealCalendarDate(game.officialDate)
    ) {
      throw new SafeAHistoricalSourceError(
        "MALFORMED_OFFICIAL_DATE",
        `gamePk ${game.gamePk} officialDate invalid`,
      );
    }
    if (!isIsoInstant(game.commenceTimeUtc)) {
      throw new SafeAHistoricalSourceError(
        "MALFORMED_COMMENCE_TIME_UTC",
        `gamePk ${game.gamePk} commenceTimeUtc invalid`,
      );
    }
    if (game.homeScore != null && !isNonNegativeIntScore(game.homeScore)) {
      throw new SafeAHistoricalSourceError(
        "NEGATIVE_SCORE",
        `gamePk ${game.gamePk} homeScore invalid`,
      );
    }
    if (game.awayScore != null && !isNonNegativeIntScore(game.awayScore)) {
      throw new SafeAHistoricalSourceError(
        "NEGATIVE_SCORE",
        `gamePk ${game.gamePk} awayScore invalid`,
      );
    }
    if (game.gameType !== "R") {
      throw new SafeAHistoricalSourceError(
        "INVALID_GAME_TYPE",
        `gamePk ${game.gamePk} gameType is not R`,
      );
    }
  }
}

export function normalizeHistoricalSourceGames(
  games: MlbIndependentSafeAHistoricalGameV1[],
): MlbIndependentSafeAHistoricalGameV1[] {
  return games.map((game) => ({
    ...game,
    commenceTimeUtc: normalizeCommenceTimeUtc(game.commenceTimeUtc),
  }));
}

export function buildHistoricalSourceArtifact(input: {
  games: MlbIndependentSafeAHistoricalGameV1[];
  collectedAt: string;
  collapsedSameGamePkCount?: number;
  query?: string;
  endpoint?: string;
}): MlbIndependentSafeAHistoricalSourceV1 {
  const normalized = normalizeHistoricalSourceGames(input.games);
  const collapsed = collapseSameGamePkSnapshots(normalized);
  validateHistoricalSourceIdentity(collapsed.games);
  validateHistoricalSourceResultProvenance(collapsed.games);
  return {
    schemaVersion: MLB_INDEPENDENT_SAFE_A_SOURCE_SCHEMA_V1,
    source: MLB_INDEPENDENT_SAFE_A_SOURCE_ORIGIN,
    season: MLB_INDEPENDENT_SAFE_A_SEASON_V1,
    gameType: MLB_INDEPENDENT_SAFE_A_GAME_TYPE_V1,
    sportId: MLB_INDEPENDENT_SAFE_A_SPORT_ID_V1,
    collectedAt: input.collectedAt,
    endpoint: input.endpoint ?? MLB_INDEPENDENT_SAFE_A_SOURCE_ENDPOINT_DESCRIPTION_V1,
    query: input.query ?? MLB_INDEPENDENT_SAFE_A_SOURCE_QUERY_V1,
    rowCount: collapsed.games.length,
    collapsedSameGamePkCount:
      input.collapsedSameGamePkCount ?? collapsed.collapsedSameGamePkCount,
    games: collapsed.games,
  };
}

export function validateHistoricalSourceArtifact(
  value: unknown,
): asserts value is MlbIndependentSafeAHistoricalSourceV1 {
  const rec = asRecord(value);
  if (!rec) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "source artifact is not an object",
    );
  }
  if (rec.schemaVersion !== MLB_INDEPENDENT_SAFE_A_SOURCE_SCHEMA_V1) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "schemaVersion mismatch",
    );
  }
  if (rec.source !== MLB_INDEPENDENT_SAFE_A_SOURCE_ORIGIN) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "source must be MLB_STATS_API",
    );
  }
  if (rec.season !== MLB_INDEPENDENT_SAFE_A_SEASON_V1) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "season must be 2024",
    );
  }
  if (rec.gameType !== MLB_INDEPENDENT_SAFE_A_GAME_TYPE_V1) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "gameType must be R",
    );
  }
  if (!Array.isArray(rec.games)) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "games must be an array",
    );
  }
  if (rec.rowCount !== rec.games.length) {
    throw new SafeAHistoricalSourceError(
      "INVALID_SOURCE_ARTIFACT",
      "rowCount does not match games.length",
    );
  }
  validateHistoricalSourceIdentity(
    rec.games as MlbIndependentSafeAHistoricalGameV1[],
  );
  validateHistoricalSourceResultProvenance(
    rec.games as MlbIndependentSafeAHistoricalGameV1[],
  );
}

export async function collectMlbIndependentSafeAHistoricalSourceV1(input?: {
  cwd?: string;
  usage?: CacheUsageStats;
}): Promise<{
  artifact: MlbIndependentSafeAHistoricalSourceV1;
  usage: CacheUsageStats;
}> {
  const usage = input?.usage ?? createCacheUsage();
  const body = await getRawStatsJson(
    MLB_INDEPENDENT_SAFE_A_SOURCE_QUERY_V1,
    usage,
    { cwd: input?.cwd },
  );
  const parsed = parseMlbScheduleBodyToHistoricalGames(body);
  const artifact = buildHistoricalSourceArtifact({
    games: parsed,
    collectedAt: new Date().toISOString(),
  });
  return { artifact, usage };
}
