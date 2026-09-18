import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getCompetitionProfileById } from "../competition";
import { COMMITTED_SCHEDULE_DIR_REL } from "./constants";
import { fail, FORWARD_READ_MODEL_ERROR } from "./errors";
import { identitiesEqual, mergeCommittedIdentityEvidence } from "./identity-equal";
import { loadCommittedPostgameReviewIdentityIndex } from "./identity-postgame-review";
import type { ResolvedFixtureIdentity } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

const SCHEDULE_FILE_RE = /^\d{4}-\d{2}-\d{2}-schedule-v1\.json$/;

/**
 * SOURCE_PATH_PATTERN=data/research/football/YYYY-MM-DD-schedule-v1.json
 * SCHEMA_VERSION=football-schedule-v1
 * FIXTURE_KEY=providerMatchId
 * HOME_TEAM_FIELD=homeTeamName
 * AWAY_TEAM_FIELD=awayTeamName
 * COMPETITION_FIELD=competitionId → committed competition profile canonicalName
 * SOURCE_STAGE=schedule
 * IDENTITY_ONLY=true
 */
export function parseScheduleIdentities(raw: unknown): ResolvedFixtureIdentity[] {
  if (!isRecord(raw) || !isRecord(raw.meta) || !Array.isArray(raw.rows)) {
    return [];
  }
  if (raw.meta.schemaVersion !== "football-schedule-v1") {
    return [];
  }
  const out: ResolvedFixtureIdentity[] = [];
  for (const row of raw.rows) {
    if (!isRecord(row)) continue;
    const providerMatchId = nonEmptyString(row.providerMatchId);
    const homeTeam = nonEmptyString(row.homeTeamName);
    const awayTeam = nonEmptyString(row.awayTeamName);
    const competitionId = nonEmptyString(row.competitionId);
    if (!providerMatchId || !homeTeam || !awayTeam || !competitionId) continue;
    const fixtureId = Number(providerMatchId);
    if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) continue;
    const profile = getCompetitionProfileById(competitionId);
    const league = profile?.canonicalName ?? null;
    if (!league) continue;
    out.push({ fixtureId, league, homeTeam, awayTeam });
  }
  return out;
}

/**
 * Join fixtureId → league/home/away from committed schedule artifacts only.
 * No Provider calls. Missing names stay unresolved at the event layer.
 */
export function loadCommittedScheduleIdentityIndex(
  rootDir: string,
): Map<number, ResolvedFixtureIdentity> {
  const dir = path.join(rootDir, COMMITTED_SCHEDULE_DIR_REL);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return new Map();
  }
  const index = new Map<number, ResolvedFixtureIdentity>();
  for (const name of names.sort()) {
    if (!SCHEDULE_FILE_RE.test(name)) continue;
    const abs = path.join(dir, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(abs, "utf8"));
    } catch {
      continue;
    }
    for (const identity of parseScheduleIdentities(parsed)) {
      const existing = index.get(identity.fixtureId);
      if (existing && !identitiesEqual(existing, identity)) {
        fail(
          FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_CONFLICT,
          `fixtureId=${identity.fixtureId}`,
        );
      }
      index.set(identity.fixtureId, identity);
    }
  }
  return index;
}

/**
 * Merge committed schedule + Official Forward postgame review identity evidence.
 * Exact fixtureId join only. Conflict fails closed.
 */
export function loadCommittedIdentityIndex(
  rootDir: string,
): Map<number, ResolvedFixtureIdentity> {
  return mergeCommittedIdentityEvidence([
    [...loadCommittedScheduleIdentityIndex(rootDir).values()],
    [...loadCommittedPostgameReviewIdentityIndex(rootDir).values()],
  ]);
}

export {
  identitiesEqual,
  mergeCommittedIdentityEvidence,
} from "./identity-equal";
export {
  loadCommittedPostgameReviewIdentityIndex,
  parseFootballForwardPostgameReviewIdentities,
} from "./identity-postgame-review";
