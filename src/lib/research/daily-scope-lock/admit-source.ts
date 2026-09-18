import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  betmanFullSlateRel,
  operatorBetmanDailySlateRel,
} from "./paths";
import {
  isSupportedResearchSport,
  normalizeSport,
  sha256Text,
  targetsConflict,
} from "./policy";
import type {
  ResearchTargetExclusion,
  ResearchTargetGame,
  ResearchTargetSourceClass,
} from "./types";

export type AdmittedSourcePayload = {
  class: ResearchTargetSourceClass;
  rel: string;
  sha256: string;
  rawText: string;
  targets: ResearchTargetGame[];
  exclusions: ResearchTargetExclusion[];
};

export type SourceAdmissionOutcome =
  | { kind: "MISSING" }
  | { kind: "INVALID"; rel: string; message: string }
  | { kind: "CONFLICT"; rel: string; message: string }
  | { kind: "OK"; payload: AdmittedSourcePayload };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function readSourceFile(
  cwd: string,
  rel: string,
): { text: string; sha256: string } | null {
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) return null;
  const text = readFileSync(abs, "utf8");
  return { text, sha256: sha256Text(text) };
}

function admitOperatorGame(
  raw: Record<string, unknown>,
  dateKst: string,
):
  | { kind: "ADMIT"; target: ResearchTargetGame }
  | { kind: "EXCLUDE"; exclusion: ResearchTargetExclusion }
  | { kind: "CONFLICT"; message: string } {
  const operatorSlateGameId = asString(raw.operatorSlateGameId);
  const sportRaw = asString(raw.sport);
  const homeTeamRaw = asString(raw.homeTeamRaw);
  const awayTeamRaw = asString(raw.awayTeamRaw);
  const reviewStatus = asString(raw.reviewStatus);

  if (!operatorSlateGameId || !sportRaw || !homeTeamRaw || !awayTeamRaw) {
    return {
      kind: "EXCLUDE",
      exclusion: {
        operatorSlateGameId,
        sport: sportRaw,
        reason: "MISSING_IDENTITY_FIELDS",
      },
    };
  }

  if (reviewStatus === "REJECTED") {
    return {
      kind: "EXCLUDE",
      exclusion: {
        operatorSlateGameId,
        sport: sportRaw,
        reason: "REJECTED_REVIEW",
      },
    };
  }

  const sport = normalizeSport(sportRaw);
  if (!isSupportedResearchSport(sport)) {
    return {
      kind: "EXCLUDE",
      exclusion: {
        operatorSlateGameId,
        sport,
        reason: "UNSUPPORTED_SPORT",
        detail: sportRaw,
      },
    };
  }

  const scheduledStartTimeKst = asString(raw.scheduledStartTimeKst);
  if (
    scheduledStartTimeKst &&
    /^\d{4}-\d{2}-\d{2}/.test(scheduledStartTimeKst) &&
    !scheduledStartTimeKst.startsWith(dateKst)
  ) {
    return {
      kind: "EXCLUDE",
      exclusion: {
        operatorSlateGameId,
        sport,
        reason: "DATE_MISMATCH",
        detail: scheduledStartTimeKst,
      },
    };
  }

  return {
    kind: "ADMIT",
    target: {
      targetId: operatorSlateGameId,
      operatorSlateGameId,
      sport,
      competitionNameRaw: asString(raw.competitionNameRaw),
      homeTeamRaw,
      awayTeamRaw,
      scheduledStartTimeKst,
      providerGameId: asString(raw.providerGameId),
      providerFixtureId: asString(raw.providerFixtureId),
    },
  };
}

function dedupeTargets(
  targets: ResearchTargetGame[],
  exclusions: ResearchTargetExclusion[],
):
  | { ok: true; targets: ResearchTargetGame[]; exclusions: ResearchTargetExclusion[] }
  | { ok: false; message: string } {
  const byId = new Map<string, ResearchTargetGame>();
  for (const target of targets) {
    const existing = byId.get(target.targetId);
    if (!existing) {
      byId.set(target.targetId, target);
      continue;
    }
    if (targetsConflict(existing, target)) {
      return {
        ok: false,
        message: `TARGET_SCOPE_CONFLICT:${target.targetId}`,
      };
    }
    exclusions.push({
      operatorSlateGameId: target.operatorSlateGameId,
      sport: target.sport,
      reason: "DUPLICATE_IDENTICAL",
    });
  }
  return { ok: true, targets: [...byId.values()], exclusions };
}

function admitOperatorBetmanSlate(
  dateKst: string,
  cwd: string,
): SourceAdmissionOutcome {
  const rel = operatorBetmanDailySlateRel(dateKst);
  const file = readSourceFile(cwd, rel);
  if (!file) return { kind: "MISSING" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(file.text);
  } catch {
    return { kind: "INVALID", rel, message: "JSON_PARSE_FAILED" };
  }
  const doc = asRecord(parsed);
  if (!doc) return { kind: "INVALID", rel, message: "NOT_OBJECT" };
  if (doc.schemaVersion !== "betman-daily-slate-v1") {
    return { kind: "INVALID", rel, message: "SCHEMA_MISMATCH" };
  }
  if (asString(doc.targetDateKst) !== dateKst) {
    return { kind: "INVALID", rel, message: "DATE_MISMATCH" };
  }
  if (!Array.isArray(doc.games)) {
    return { kind: "INVALID", rel, message: "GAMES_NOT_ARRAY" };
  }

  const targets: ResearchTargetGame[] = [];
  const exclusions: ResearchTargetExclusion[] = [];
  for (const row of doc.games) {
    const rec = asRecord(row);
    if (!rec) {
      exclusions.push({
        operatorSlateGameId: null,
        sport: null,
        reason: "MISSING_IDENTITY_FIELDS",
        detail: "NON_OBJECT_GAME",
      });
      continue;
    }
    const outcome = admitOperatorGame(rec, dateKst);
    if (outcome.kind === "ADMIT") targets.push(outcome.target);
    else if (outcome.kind === "EXCLUDE") exclusions.push(outcome.exclusion);
    else return { kind: "CONFLICT", rel, message: outcome.message };
  }

  const deduped = dedupeTargets(targets, exclusions);
  if (!deduped.ok) {
    return { kind: "CONFLICT", rel, message: deduped.message };
  }

  return {
    kind: "OK",
    payload: {
      class: "OPERATOR_BETMAN_DAILY_SLATE",
      rel,
      sha256: file.sha256,
      rawText: file.text,
      targets: deduped.targets,
      exclusions: deduped.exclusions,
    },
  };
}

/**
 * Full-slate artifact is admissible only when operator input was entered
 * (not the empty NOT_ENTERED placeholder).
 */
function admitBetmanFullSlate(
  dateKst: string,
  cwd: string,
): SourceAdmissionOutcome {
  const rel = betmanFullSlateRel(dateKst);
  const file = readSourceFile(cwd, rel);
  if (!file) return { kind: "MISSING" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(file.text);
  } catch {
    return { kind: "INVALID", rel, message: "JSON_PARSE_FAILED" };
  }
  const doc = asRecord(parsed);
  const meta = asRecord(doc?.meta);
  if (!doc || !meta) return { kind: "INVALID", rel, message: "NOT_OBJECT" };
  if (meta.schemaVersion !== "betman-full-slate-v1") {
    return { kind: "INVALID", rel, message: "SCHEMA_MISMATCH" };
  }
  if (asString(meta.targetDateKst) !== dateKst) {
    return { kind: "INVALID", rel, message: "DATE_MISMATCH" };
  }
  if (asString(meta.operatorInputStatus) === "NOT_ENTERED") {
    // Committed empty placeholder is not an admitted cohort source.
    return { kind: "MISSING" };
  }
  if (!Array.isArray(doc.games)) {
    return { kind: "INVALID", rel, message: "GAMES_NOT_ARRAY" };
  }

  const targets: ResearchTargetGame[] = [];
  const exclusions: ResearchTargetExclusion[] = [];
  for (const row of doc.games) {
    const rec = asRecord(row);
    if (!rec) {
      exclusions.push({
        operatorSlateGameId: null,
        sport: null,
        reason: "MISSING_IDENTITY_FIELDS",
      });
      continue;
    }
    const operatorSlateGameId = asString(rec.operatorSlateGameId);
    const sportRaw = asString(rec.sport);
    const homeTeamRaw = asString(rec.homeTeam) ?? asString(rec.homeTeamRaw);
    const awayTeamRaw = asString(rec.awayTeam) ?? asString(rec.awayTeamRaw);
    const supportedSport = rec.supportedSport === true;

    if (!operatorSlateGameId || !sportRaw || !homeTeamRaw || !awayTeamRaw) {
      exclusions.push({
        operatorSlateGameId,
        sport: sportRaw,
        reason: "MISSING_IDENTITY_FIELDS",
      });
      continue;
    }
    const sport = normalizeSport(sportRaw);
    if (!supportedSport || !isSupportedResearchSport(sport)) {
      exclusions.push({
        operatorSlateGameId,
        sport,
        reason: "UNSUPPORTED_SPORT",
      });
      continue;
    }
    targets.push({
      targetId: operatorSlateGameId,
      operatorSlateGameId,
      sport,
      competitionNameRaw:
        asString(asRecord(rec.competition)?.nameRaw) ??
        asString(rec.competitionNameRaw),
      homeTeamRaw,
      awayTeamRaw,
      scheduledStartTimeKst:
        asString(rec.startTimeKst) ?? asString(rec.scheduledStartTimeKst),
      providerGameId: asString(rec.providerGameId),
      providerFixtureId: asString(rec.providerFixtureId),
    });
  }

  const deduped = dedupeTargets(targets, exclusions);
  if (!deduped.ok) {
    return { kind: "CONFLICT", rel, message: deduped.message };
  }

  return {
    kind: "OK",
    payload: {
      class: "BETMAN_FULL_SLATE",
      rel,
      sha256: file.sha256,
      rawText: file.text,
      targets: deduped.targets,
      exclusions: deduped.exclusions,
    },
  };
}

/**
 * Admit the first legally usable deterministic slate source.
 * Never uses public listing runtime, Forward operational cache, or live providers.
 */
export function admitResearchTargetScopeSource(input: {
  dateKst: string;
  cwd?: string;
}): SourceAdmissionOutcome {
  const cwd = input.cwd ?? process.cwd();

  const operator = admitOperatorBetmanSlate(input.dateKst, cwd);
  if (operator.kind !== "MISSING") return operator;

  const full = admitBetmanFullSlate(input.dateKst, cwd);
  if (full.kind !== "MISSING") return full;

  return { kind: "MISSING" };
}
