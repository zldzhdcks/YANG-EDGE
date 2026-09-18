import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getCompetitionProfileByProviderId } from "../competition";
import {
  COMMITTED_POSTGAME_REVIEW_DIR_REL,
  FOOTBALL_FORWARD_POSTGAME_REVIEW_FILE_RE,
  FOOTBALL_FORWARD_POSTGAME_REVIEW_SCHEMA_RE,
} from "./constants";
import { fail, FORWARD_READ_MODEL_ERROR } from "./errors";
import { identitiesEqual } from "./identity-equal";
import type { ResolvedFixtureIdentity } from "./types";

/**
 * SOURCE_PATH_PATTERN=data/audits/YYYY-MM-DD-football-forward-postgame-review-v1.json
 * SCHEMA_VERSION=yang-edge-YYYY-MM-DD-football-forward-postgame-review-v1
 * FIXTURE_KEY=fixtureId
 * HOME_TEAM_FIELD=homeTeam
 * AWAY_TEAM_FIELD=awayTeam
 * COMPETITION_FIELD=leagueId → committed competition profile canonicalName,
 *   else explicit league in the same row
 * SOURCE_STAGE=postgame_review
 * IDENTITY_ONLY=true
 *
 * Explicit arrays only: payload.predicted and payload.pass.
 * Does not walk combined-fixture review objects or arbitrary nested JSON.
 * Does not copy score, outcome, grade, probability, or result into identity.
 */

const POSTGAME_CONTRACT = "FOOTBALL_FORWARD_POSTGAME_COLLECTION_V1";
const MODEL_FORWARD_LAYER = "MODEL_FORWARD";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function requirePostgamePayload(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
      "postgame review must be an object",
    );
  }
  const payload = isRecord(raw.payload) ? raw.payload : raw;
  const schemaVersion = nonEmptyString(payload.schemaVersion);
  if (
    !schemaVersion ||
    !FOOTBALL_FORWARD_POSTGAME_REVIEW_SCHEMA_RE.test(schemaVersion)
  ) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
      `schemaVersion=${String(payload.schemaVersion)}`,
    );
  }
  if (payload.postgameContract !== POSTGAME_CONTRACT) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
      `postgameContract=${String(payload.postgameContract)}`,
    );
  }
  if (payload.layer !== MODEL_FORWARD_LAYER) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
      `layer=${String(payload.layer)}`,
    );
  }
  if (!Array.isArray(payload.predicted)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
      "predicted must be an array",
    );
  }
  if (payload.pass !== undefined && !Array.isArray(payload.pass)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
      "pass must be an array when present",
    );
  }
  return payload;
}

function resolveLeague(row: Record<string, unknown>): string | null {
  const leagueId = row.leagueId;
  if (typeof leagueId === "number" && Number.isSafeInteger(leagueId) && leagueId > 0) {
    const profile = getCompetitionProfileByProviderId(
      "api-football",
      String(leagueId),
    );
    if (profile?.canonicalName) {
      return profile.canonicalName;
    }
  }
  return nonEmptyString(row.league);
}

function parseIdentityRow(row: unknown): ResolvedFixtureIdentity | null {
  if (!isRecord(row)) return null;
  const fixtureId = row.fixtureId;
  if (typeof fixtureId !== "number" || !Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
    return null;
  }
  const homeTeam = nonEmptyString(row.homeTeam);
  const awayTeam = nonEmptyString(row.awayTeam);
  const league = resolveLeague(row);
  if (!homeTeam || !awayTeam || !league) return null;
  return { fixtureId, league, homeTeam, awayTeam };
}

/**
 * Identity-only parser for committed Official Forward postgame review artifacts.
 * Incomplete tuples are skipped. Malformed schema fails closed.
 */
export function parseFootballForwardPostgameReviewIdentities(
  raw: unknown,
): ResolvedFixtureIdentity[] {
  const payload = requirePostgamePayload(raw);
  const out: ResolvedFixtureIdentity[] = [];
  const rows: unknown[] = [
    ...(payload.predicted as unknown[]),
    ...(Array.isArray(payload.pass) ? payload.pass : []),
  ];
  for (const row of rows) {
    const identity = parseIdentityRow(row);
    if (identity) out.push(identity);
  }
  return out;
}

export function loadCommittedPostgameReviewIdentityIndex(
  rootDir: string,
): Map<number, ResolvedFixtureIdentity> {
  const dir = path.join(rootDir, COMMITTED_POSTGAME_REVIEW_DIR_REL);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return new Map();
  }
  const index = new Map<number, ResolvedFixtureIdentity>();
  for (const name of names.sort()) {
    if (!FOOTBALL_FORWARD_POSTGAME_REVIEW_FILE_RE.test(name)) continue;
    const abs = path.join(dir, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(abs, "utf8"));
    } catch {
      fail(
        FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_SOURCE_INVALID,
        `unreadable ${name}`,
      );
    }
    for (const identity of parseFootballForwardPostgameReviewIdentities(parsed)) {
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
