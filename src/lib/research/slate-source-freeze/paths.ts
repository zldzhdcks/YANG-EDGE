import path from "node:path";
import { scheduledStartRepresentsDateKst } from "../../betman/daily-slate/schedule-date-kst";
import {
  RESEARCH_SLATE_SOURCE_FREEZE_MECHANISM,
  RESEARCH_SLATE_SOURCE_FREEZE_SCHEMA_VERSION,
  type FrozenSlateGame,
  type ResearchSlateSourceFreezeDocument,
} from "./types";

export function assertExplicitDateKst(dateKst: string): string {
  if (typeof dateKst !== "string" || dateKst.trim() === "") {
    throw new Error("EXPLICIT_DATE_KST_REQUIRED");
  }
  const trimmed = dateKst.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`INVALID_DATE_KST:${trimmed}`);
  }
  const [y, m, d] = trimmed.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error(`INVALID_DATE_KST:${trimmed}`);
  }
  return trimmed;
}

export function operatorBetmanDailySlateRel(dateKst: string): string {
  return `data/operator-input/betman/${dateKst}-daily-slate-v1.json`;
}

export function researchSlateSourceFreezeRel(dateKst: string): string {
  return `data/research/daily-slates/${dateKst}-research-slate-source-freeze-v1.json`;
}

export function researchSlateSourceFreezeAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, researchSlateSourceFreezeRel(dateKst));
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function isFrozenGame(v: unknown): v is FrozenSlateGame {
  const g = asRecord(v);
  if (!g) return false;
  return (
    typeof g.operatorSlateGameId === "string" &&
    g.operatorSlateGameId.trim() !== "" &&
    typeof g.sport === "string" &&
    g.sport.trim() !== "" &&
    typeof g.homeTeamRaw === "string" &&
    g.homeTeamRaw.trim() !== "" &&
    typeof g.awayTeamRaw === "string" &&
    g.awayTeamRaw.trim() !== "" &&
    typeof g.scheduledStartTimeKst === "string" &&
    g.scheduledStartTimeKst.trim() !== ""
  );
}

/**
 * Strict runtime guard — no TypeScript casting as validation.
 */
export function isResearchSlateSourceFreezeDocument(
  value: unknown,
): value is ResearchSlateSourceFreezeDocument {
  const doc = asRecord(value);
  if (!doc) return false;
  if (doc.schemaVersion !== RESEARCH_SLATE_SOURCE_FREEZE_SCHEMA_VERSION) {
    return false;
  }
  if (doc.freezeMechanism !== RESEARCH_SLATE_SOURCE_FREEZE_MECHANISM) {
    return false;
  }
  if (typeof doc.dateKst !== "string") return false;
  if (typeof doc.frozenAt !== "string") return false;
  if (doc.researchOnly !== true) return false;
  if (doc.marketDataIncluded !== false) return false;
  if (doc.providerCalls !== 0) return false;
  if (doc.networkCalls !== 0) return false;
  if (doc.fuzzyMatchingUsed !== false) return false;
  if (
    doc.invariant !==
    "FROZEN_SOURCE_REPRESENTS_COMPLETE_MANUALLY_VERIFIED_OPERATOR_SLATE"
  ) {
    return false;
  }
  if (
    typeof doc.sourceGameCount !== "number" ||
    !Number.isFinite(doc.sourceGameCount)
  ) {
    return false;
  }
  if (!Array.isArray(doc.games)) return false;
  if (doc.sourceGameCount !== doc.games.length) return false;

  const source = asRecord(doc.source);
  if (!source) return false;
  if (source.class !== "OPERATOR_BETMAN_DAILY_SLATE") return false;
  if (typeof source.rel !== "string") return false;
  if (typeof source.sha256 !== "string" || source.sha256.length < 16) {
    return false;
  }
  if (source.sourceType !== "OPERATOR_MANUAL") return false;
  if (source.reviewStatus !== "VERIFIED") return false;
  if (source.scopeCompletenessStatus !== "COMPLETE") return false;
  if (typeof source.reviewedAt !== "string") return false;

  for (const game of doc.games) {
    if (!isFrozenGame(game)) return false;
  }
  return true;
}

export function isValidIsoTimestamp(value: string): boolean {
  if (!Number.isFinite(Date.parse(value))) return false;
  return true;
}

export function gameRepresentsDateKst(
  scheduledStartTimeKst: string,
  dateKst: string,
): boolean {
  return scheduledStartRepresentsDateKst(scheduledStartTimeKst, dateKst);
}
