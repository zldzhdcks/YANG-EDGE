import { createHash } from "node:crypto";
import type {
  ResearchTargetExclusion,
  ResearchTargetGame,
} from "./types";

const SUPPORTED_SPORTS = new Set([
  "BASEBALL",
  "SOCCER",
  "BASKETBALL",
  "VOLLEYBALL",
]);

/** Normalize sport labels used in operator slate intake. */
export function normalizeSport(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper === "FOOTBALL" || upper === "SOCCER") return "SOCCER";
  if (upper === "MLB" || upper === "KBO" || upper === "NPB") return "BASEBALL";
  return upper;
}

export function isSupportedResearchSport(sport: string): boolean {
  return SUPPORTED_SPORTS.has(normalizeSport(sport));
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function compareTargetId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortTargetsDeterministic(
  targets: ResearchTargetGame[],
): ResearchTargetGame[] {
  return [...targets].sort((a, b) => {
    const sport = a.sport.localeCompare(b.sport);
    if (sport !== 0) return sport;
    const id = compareTargetId(a.targetId, b.targetId);
    if (id !== 0) return id;
    const kick = (a.scheduledStartTimeKst ?? "").localeCompare(
      b.scheduledStartTimeKst ?? "",
    );
    if (kick !== 0) return kick;
    const home = a.homeTeamRaw.localeCompare(b.homeTeamRaw);
    if (home !== 0) return home;
    return a.awayTeamRaw.localeCompare(b.awayTeamRaw);
  });
}

export function sortExclusionsDeterministic(
  exclusions: ResearchTargetExclusion[],
): ResearchTargetExclusion[] {
  return [...exclusions].sort((a, b) => {
    const reason = a.reason.localeCompare(b.reason);
    if (reason !== 0) return reason;
    const id = (a.operatorSlateGameId ?? "").localeCompare(
      b.operatorSlateGameId ?? "",
    );
    if (id !== 0) return id;
    return (a.detail ?? "").localeCompare(b.detail ?? "");
  });
}

export function semanticLockFingerprint(input: {
  dateKst: string;
  sourceSha256: string;
  sourceRel: string;
  targets: ResearchTargetGame[];
  exclusions: ResearchTargetExclusion[];
  status: string;
}): string {
  const payload = {
    dateKst: input.dateKst,
    sourceRel: input.sourceRel,
    sourceSha256: input.sourceSha256,
    status: input.status,
    targets: sortTargetsDeterministic(input.targets),
    exclusions: sortExclusionsDeterministic(input.exclusions),
  };
  return sha256Text(JSON.stringify(payload));
}

export function targetsConflict(
  a: ResearchTargetGame,
  b: ResearchTargetGame,
): boolean {
  return (
    a.sport !== b.sport ||
    a.homeTeamRaw !== b.homeTeamRaw ||
    a.awayTeamRaw !== b.awayTeamRaw ||
    a.scheduledStartTimeKst !== b.scheduledStartTimeKst ||
    a.competitionNameRaw !== b.competitionNameRaw ||
    a.providerGameId !== b.providerGameId ||
    a.providerFixtureId !== b.providerFixtureId
  );
}
