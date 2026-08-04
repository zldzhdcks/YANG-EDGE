/**
 * Football Match Identity v0.
 * matchId = soccer-{provider}-{fixtureId}
 * Never built from team names / UI slugs / display titles.
 */
import { createHash } from "node:crypto";
import { FOOTBALL_IDENTITY_VERSION } from "./types";
import type {
  FootballMatchIdentity,
  FootballMatchIdentityInput,
  FootballProviderId,
} from "./types";

const KST = "Asia/Seoul";

/** UTC ISO → YYYY-MM-DDTHH:mm:ss+09:00 style kickoffKst (deterministic). */
export function utcToKickoffKst(kickoffUtc: string): string {
  const d = new Date(kickoffUtc);
  if (Number.isNaN(d.getTime())) {
    throw new Error("INVALID_KICKOFF_UTC");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+09:00`;
}

export function buildFootballMatchId(
  provider: FootballProviderId | string,
  fixtureId: string,
): string {
  const fid = String(fixtureId).trim();
  if (!fid) {
    throw new Error("FIXTURE_ID_REQUIRED");
  }
  const p = String(provider).trim();
  if (!p) {
    throw new Error("PROVIDER_REQUIRED");
  }
  return `soccer-${p}-${fid}`;
}

/**
 * Canonical payload for identityHash — provider IDs + kickoff + status only.
 * displayName / aliases / UI slug MUST NOT appear here.
 */
export function buildIdentityHashPayload(
  input: FootballMatchIdentityInput,
): string {
  const rows: [string, string][] = [
    ["awayTeamId", String(input.awayTeamId)],
    ["competitionId", String(input.competitionId)],
    ["fixtureId", String(input.fixtureId)],
    ["homeTeamId", String(input.homeTeamId)],
    ["kickoffUtc", String(input.kickoffUtc)],
    ["neutralVenue", input.neutralVenue ? "1" : "0"],
    ["provider", String(input.provider)],
    ["season", String(input.season)],
    ["status", String(input.status)],
    ["v", FOOTBALL_IDENTITY_VERSION],
  ];
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return rows.map(([k, v]) => `${k}=${v}`).join("|");
}

export function computeFootballIdentityHash(
  input: FootballMatchIdentityInput,
): string {
  const payload = buildIdentityHashPayload(input);
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function buildFootballMatchIdentity(
  input: FootballMatchIdentityInput,
): FootballMatchIdentity {
  const fixtureId = String(input.fixtureId ?? "").trim();
  if (!fixtureId) {
    throw new Error("FIXTURE_ID_REQUIRED");
  }
  const matchId = buildFootballMatchId(input.provider, fixtureId);
  const kickoffKst = utcToKickoffKst(input.kickoffUtc);
  const identityHash = computeFootballIdentityHash(input);

  return {
    matchId,
    fixtureId,
    provider: input.provider,
    competitionId: input.competitionId,
    season: input.season,
    kickoffUtc: input.kickoffUtc,
    kickoffKst,
    homeTeamId: String(input.homeTeamId),
    awayTeamId: String(input.awayTeamId),
    neutralVenue: Boolean(input.neutralVenue),
    status: input.status,
    identityHash,
    identityVersion: FOOTBALL_IDENTITY_VERSION,
  };
}

/** Exported for tests — proves slug/displayName are not hash inputs. */
export function identityHashIgnoresDisplayFields(): string[] {
  return ["displayName", "officialName", "aliases", "uiSlug", "title"];
}
