import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { isResearchSlateSourceFreezeDocument } from "../slate-source-freeze";
import { researchSlateSourceFreezeRel } from "./paths";
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

/**
 * Admit research targets ONLY from a committed research slate source freeze.
 * Raw operator input and legacy betman-full-slate cannot bypass this gate.
 */
export function admitResearchTargetScopeSource(input: {
  dateKst: string;
  cwd?: string;
}): SourceAdmissionOutcome {
  const cwd = input.cwd ?? process.cwd();
  const rel = researchSlateSourceFreezeRel(input.dateKst);
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) return { kind: "MISSING" };

  let rawText: string;
  try {
    rawText = readFileSync(abs, "utf8");
  } catch {
    return { kind: "INVALID", rel, message: "FREEZE_UNREADABLE" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { kind: "INVALID", rel, message: "JSON_PARSE_FAILED" };
  }

  if (!isResearchSlateSourceFreezeDocument(parsed)) {
    return { kind: "INVALID", rel, message: "FREEZE_SCHEMA_INVALID" };
  }
  if (parsed.dateKst !== input.dateKst) {
    return { kind: "INVALID", rel, message: "DATE_MISMATCH" };
  }

  const targets: ResearchTargetGame[] = [];
  const exclusions: ResearchTargetExclusion[] = [];

  for (const game of parsed.games) {
    const sport = normalizeSport(game.sport);
    if (!isSupportedResearchSport(sport)) {
      exclusions.push({
        operatorSlateGameId: game.operatorSlateGameId,
        sport,
        reason: "UNSUPPORTED_SPORT",
        detail: game.sport,
      });
      continue;
    }
    targets.push({
      targetId: game.operatorSlateGameId,
      operatorSlateGameId: game.operatorSlateGameId,
      sport,
      competitionNameRaw: game.competitionNameRaw,
      homeTeamRaw: game.homeTeamRaw,
      awayTeamRaw: game.awayTeamRaw,
      scheduledStartTimeKst: game.scheduledStartTimeKst,
      providerGameId: game.providerGameId,
      providerFixtureId: game.providerFixtureId,
    });
  }

  const deduped = dedupeTargets(targets, exclusions);
  if (!deduped.ok) {
    return { kind: "CONFLICT", rel, message: deduped.message };
  }

  return {
    kind: "OK",
    payload: {
      class: "RESEARCH_SLATE_SOURCE_FREEZE",
      rel,
      sha256: sha256Text(rawText),
      rawText,
      targets: deduped.targets,
      exclusions: deduped.exclusions,
    },
  };
}
