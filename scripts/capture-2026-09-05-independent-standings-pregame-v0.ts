/**
 * Mission-specific capture: independent API-Football standings for the
 * 2026-09-05 still-pregame frozen matches.
 *
 *   npx tsx --env-file=.env.local scripts/capture-2026-09-05-independent-standings-pregame-v0.ts
 *
 * Standings only. No odds, no predictions, no results, no scorer.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { instantToKst } from "../src/lib/datetime/kst";
import { getFootballProvider } from "../src/lib/football";

export const DATE_KST = "2026-09-05";
export const ARTIFACT_REL =
  "data/research/football/2026-09-05-independent-standings-pregame-v0.json";
export const SOURCE_SNAPSHOT_REL =
  "data/research/football/2026-09-05-prediction-snapshot-v0.json";
export const SOURCE_SCHEDULE_REL =
  "data/research/football/2026-09-05-schedule-v1.json";
export const SOURCE_SNAPSHOT_HASH =
  "a8577c1342a8031adffa9554923cc8bedda8b2b0abc1a218657449c570a5267a";

const ORIGINAL_FROZEN_FIXTURE_IDS = [
  1556051, 1557395, 1550110, 1557391, 1570364,
] as const;

type IdentityClass = "FOUND_EXACT" | "MISSING" | "CONFLICT";
type Ready = "YES" | "PARTIAL" | "NO";
type RawAvail = "RAW_AVAILABLE" | "RAW_MISSING";

type TargetSpec = {
  fixtureId: number;
  canonicalHomeTeamId: string;
  canonicalAwayTeamId: string;
  providerHomeTeamId: number;
  providerAwayTeamId: number;
  homeName: string;
  awayName: string;
  competitionId: string;
  seasonId: string;
  kickoffTimeUtc: string;
};

const CANONICAL_TARGETS: readonly {
  fixtureId: number;
  homeCanonical: string;
  awayCanonical: string;
  homeProviderId: number;
  awayProviderId: number;
}[] = [
  {
    fixtureId: 1557395,
    homeCanonical: "fb-team-v1-api-football-34",
    awayCanonical: "fb-team-v1-api-football-35",
    homeProviderId: 34,
    awayProviderId: 35,
  },
  {
    fixtureId: 1550110,
    homeCanonical: "fb-team-v1-api-football-502",
    awayCanonical: "fb-team-v1-api-football-503",
    homeProviderId: 502,
    awayProviderId: 503,
  },
  {
    fixtureId: 1557391,
    homeCanonical: "fb-team-v1-api-football-36",
    awayCanonical: "fb-team-v1-api-football-52",
    homeProviderId: 36,
    awayProviderId: 52,
  },
  {
    fixtureId: 1570364,
    homeCanonical: "fb-team-v1-api-football-531",
    awayCanonical: "fb-team-v1-api-football-530",
    homeProviderId: 531,
    awayProviderId: 530,
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function leagueIdFromCompetitionId(competitionId: string): number {
  const m = /^fb-comp-api-football-(\d+)$/.exec(competitionId);
  if (!m) {
    throw new Error(`UNPARSEABLE_COMPETITION_ID:${competitionId}`);
  }
  return Number(m[1]);
}

function loadScheduleTargets(cwd: string): {
  snapshotHash: string;
  excludedStarted: Array<{
    fixtureId: number;
    reason: string;
    kickoffTimeUtc: string;
    homeTeamName: string;
    awayTeamName: string;
  }>;
  targets: TargetSpec[];
} {
  const snapshotHead = readFileSync(
    path.join(cwd, SOURCE_SNAPSHOT_REL),
    "utf8",
  ).slice(0, 2048);
  const snapshotHashMatch = /"snapshotHash": "([a-f0-9]{64})"/.exec(
    snapshotHead,
  );
  const snapshotHash = snapshotHashMatch?.[1] ?? null;
  if (snapshotHash !== SOURCE_SNAPSHOT_HASH) {
    throw new Error(
      `SNAPSHOT_HASH_MISMATCH expected=${SOURCE_SNAPSHOT_HASH} actual=${snapshotHash ?? "MISSING"}`,
    );
  }

  const schedule = JSON.parse(
    readFileSync(path.join(cwd, SOURCE_SCHEDULE_REL), "utf8"),
  ) as { rows?: unknown };
  const rows = Array.isArray(schedule.rows) ? schedule.rows : [];
  const byFixture = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    const rec = asRecord(row);
    const id = asInt(rec?.providerMatchId);
    if (id == null || !rec) continue;
    byFixture.set(id, rec);
  }

  const nowMs = Date.now();
  const excludedStarted: Array<{
    fixtureId: number;
    reason: string;
    kickoffTimeUtc: string;
    homeTeamName: string;
    awayTeamName: string;
  }> = [];
  const targets: TargetSpec[] = [];

  for (const fixtureId of ORIGINAL_FROZEN_FIXTURE_IDS) {
    const row = byFixture.get(fixtureId);
    if (!row) {
      throw new Error(`SCHEDULE_ROW_MISSING:${fixtureId}`);
    }
    const kickoffTimeUtc = asString(row.kickoffTimeUtc);
    if (!kickoffTimeUtc) {
      throw new Error(`KICKOFF_MISSING:${fixtureId}`);
    }
    const kickoffMs = Date.parse(kickoffTimeUtc);
    if (Number.isNaN(kickoffMs)) {
      throw new Error(`KICKOFF_INVALID:${fixtureId}:${kickoffTimeUtc}`);
    }
    const homeTeamName = asString(row.homeTeamName) ?? "";
    const awayTeamName = asString(row.awayTeamName) ?? "";
    if (kickoffMs <= nowMs) {
      excludedStarted.push({
        fixtureId,
        reason: "EXCLUDED_FROM_NEW_PREGAME_EVIDENCE",
        kickoffTimeUtc,
        homeTeamName,
        awayTeamName,
      });
      continue;
    }
    const spec = CANONICAL_TARGETS.find((t) => t.fixtureId === fixtureId);
    if (!spec) {
      throw new Error(`NO_CANONICAL_SPEC_FOR_STILL_PREGAME:${fixtureId}`);
    }
    const homeTeamId = asString(row.homeTeamId);
    const awayTeamId = asString(row.awayTeamId);
    const homeProviderTeamId = asInt(row.homeProviderTeamId);
    const awayProviderTeamId = asInt(row.awayProviderTeamId);
    if (
      homeTeamId !== spec.homeCanonical ||
      awayTeamId !== spec.awayCanonical ||
      homeProviderTeamId !== spec.homeProviderId ||
      awayProviderTeamId !== spec.awayProviderId
    ) {
      throw new Error(`TEAM_IDENTITY_MISMATCH:${fixtureId}`);
    }
    targets.push({
      fixtureId,
      canonicalHomeTeamId: spec.homeCanonical,
      canonicalAwayTeamId: spec.awayCanonical,
      providerHomeTeamId: spec.homeProviderId,
      providerAwayTeamId: spec.awayProviderId,
      homeName: homeTeamName,
      awayName: awayTeamName,
      competitionId: asString(row.competitionId) ?? "",
      seasonId: asString(row.seasonId) ?? "",
      kickoffTimeUtc,
    });
  }

  return { snapshotHash, excludedStarted, targets };
}

function standingRowsFromRaw(raw: unknown): {
  leagueId: number | null;
  leagueName: string | null;
  season: number | null;
  rows: Record<string, unknown>[];
} {
  const blocks = Array.isArray(raw) ? raw : [];
  const rows: Record<string, unknown>[] = [];
  let leagueId: number | null = null;
  let leagueName: string | null = null;
  let season: number | null = null;
  for (const block of blocks) {
    const league = asRecord(asRecord(block)?.league);
    if (!league) continue;
    if (leagueId == null) leagueId = asInt(league.id);
    if (leagueName == null) leagueName = asString(league.name);
    if (season == null) season = asInt(league.season);
    const standings = league.standings;
    const groups = Array.isArray(standings) ? standings : [];
    for (const group of groups) {
      const groupRows = Array.isArray(group) ? group : [group];
      for (const row of groupRows) {
        const rec = asRecord(row);
        if (rec) rows.push(rec);
      }
    }
  }
  return { leagueId, leagueName, season, rows };
}

function providerTeamId(row: Record<string, unknown>): number | null {
  return asInt(asRecord(row.team)?.id);
}

function pickPresent<T extends Record<string, unknown>>(
  row: T,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

function preserveStandingFields(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out = pickPresent(row, [
    "rank",
    "points",
    "goalsDiff",
    "form",
    "status",
    "description",
    "group",
    "update",
  ]);
  const team = asRecord(row.team);
  if (team) {
    const preservedTeam = pickPresent(team, ["id", "name"]);
    if (Object.keys(preservedTeam).length > 0) out.team = preservedTeam;
  }
  const all = asRecord(row.all);
  if (all) {
    const preservedAll = pickPresent(all, ["played", "win", "draw", "lose"]);
    const goals = asRecord(all.goals);
    if (goals) {
      const preservedGoals = pickPresent(goals, ["for", "against"]);
      if (Object.keys(preservedGoals).length > 0) {
        preservedAll.goals = preservedGoals;
      }
    }
    if (Object.keys(preservedAll).length > 0) out.all = preservedAll;
  }
  return out;
}

function classifyTeam(
  rows: Record<string, unknown>[],
  providerTeamIdValue: number,
): {
  identity: IdentityClass;
  standing: Record<string, unknown> | null;
} {
  const matches = rows.filter(
    (row) => providerTeamId(row) === providerTeamIdValue,
  );
  if (matches.length === 0) return { identity: "MISSING", standing: null };
  if (matches.length > 1) return { identity: "CONFLICT", standing: null };
  return {
    identity: "FOUND_EXACT",
    standing: preserveStandingFields(matches[0]),
  };
}

function playedFromStanding(standing: Record<string, unknown> | null): number | null {
  return asInt(asRecord(standing?.all)?.played);
}

function familyStatus(
  teams: Array<{ identity: IdentityClass; standing: Record<string, unknown> | null }>,
  present: (standing: Record<string, unknown>) => boolean,
): RawAvail {
  const found = teams.filter((t) => t.identity === "FOUND_EXACT");
  if (found.length === 0) return "RAW_MISSING";
  return found.every((t) => t.standing != null && present(t.standing))
    ? "RAW_AVAILABLE"
    : "RAW_MISSING";
}

export function validateIndependentStandingsArtifact(doc: unknown): string[] {
  const errors: string[] = [];
  const rec = asRecord(doc);
  if (!rec) return ["ARTIFACT_NOT_OBJECT"];
  const meta = asRecord(rec.meta);
  if (!meta) errors.push("META_MISSING");
  if (meta?.schemaVersion !== "football-independent-standings-pregame-v0") {
    errors.push("SCHEMA_VERSION");
  }
  if (meta?.dateKst !== DATE_KST) errors.push("DATE_KST");
  if (meta?.researchOnly !== true) errors.push("RESEARCH_ONLY");
  if (meta?.provider !== "api-football") errors.push("PROVIDER");
  if (meta?.providerEndpoint !== "standings") errors.push("ENDPOINT");
  if (meta?.marketDataUsed !== false) errors.push("MARKET_DATA_USED");
  if (meta?.prediction !== "NONE") errors.push("PREDICTION");
  if (meta?.engine !== "NONE") errors.push("ENGINE");
  if (meta?.sourceSnapshotHash !== SOURCE_SNAPSHOT_HASH) {
    errors.push("SOURCE_SNAPSHOT_HASH");
  }
  const capturedAt = asString(meta?.capturedAt);
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) {
    errors.push("CAPTURED_AT_INVALID");
  }
  if (capturedAt && !capturedAt.endsWith("Z")) errors.push("CAPTURED_AT_NOT_UTC");

  const text = JSON.stringify(doc);
  for (const banned of [
    "LEAN_HOME",
    "LEAN_AWAY",
    "probability",
    "valueEdge",
    "targetResult",
    "officialResult",
    "homeScore",
    "awayScore",
  ]) {
    if (text.includes(banned)) errors.push(`BANNED_FIELD:${banned}`);
  }

  const teams = Array.isArray(rec.teams) ? rec.teams : [];
  const teamIds: number[] = [];
  for (const team of teams) {
    const t = asRecord(team);
    const pid = asInt(t?.providerTeamId);
    if (pid == null) errors.push("TEAM_PROVIDER_ID_MISSING");
    else teamIds.push(pid);
    if (t?.identityJoin !== "PROVIDER_TEAM_ID_EXACT") {
      errors.push("IDENTITY_JOIN_NOT_EXACT");
    }
  }
  if (new Set(teamIds).size !== teamIds.length) errors.push("DUPLICATE_TARGET_TEAM");

  const matches = Array.isArray(rec.matches) ? rec.matches : [];
  for (const match of matches) {
    const m = asRecord(match);
    if (!m) continue;
    if (m.admitted !== true) continue;
    const kickoff = asString(m.kickoffTimeUtc);
    if (!capturedAt || !kickoff || Date.parse(capturedAt) >= Date.parse(kickoff)) {
      errors.push(`TEMPORAL_GUARD:${String(m.fixtureId)}`);
    }
  }
  return errors;
}

export async function captureIndependentStandingsPregameV0(
  cwd = process.cwd(),
) {
  const { snapshotHash, excludedStarted, targets } = loadScheduleTargets(cwd);
  if (targets.length === 0) {
    throw new Error("NO_STILL_PREGAME_TARGETS");
  }

  const needed = new Map<string, { leagueId: number; season: number }>();
  for (const t of targets) {
    const leagueId = leagueIdFromCompetitionId(t.competitionId);
    const season = asInt(t.seasonId);
    if (season == null) throw new Error(`SEASON_INVALID:${t.fixtureId}`);
    needed.set(`${leagueId}|${season}`, { leagueId, season });
  }

  const provider = getFootballProvider();
  if (provider.kind !== "api-football") {
    throw new Error(`PROVIDER_KIND:${provider.kind}`);
  }

  const capturedAt = new Date().toISOString();
  const providerCalls: Array<{
    leagueId: number;
    season: number;
    cached: boolean;
    standingRowCount: number;
    leagueName: string | null;
    error: string | null;
  }> = [];
  const tables = new Map<
    string,
    {
      leagueId: number;
      season: number;
      leagueName: string | null;
      rows: Record<string, unknown>[];
    }
  >();

  for (const { leagueId, season } of needed.values()) {
    const key = `${leagueId}|${season}`;
    try {
      const result = await provider.getStandings({ leagueId, season });
      const parsed = standingRowsFromRaw(result.raw);
      tables.set(key, {
        leagueId,
        season,
        leagueName: parsed.leagueName,
        rows: parsed.rows,
      });
      providerCalls.push({
        leagueId,
        season,
        cached: result.cached,
        standingRowCount: parsed.rows.length,
        leagueName: parsed.leagueName,
        error: null,
      });
    } catch (error) {
      tables.set(key, {
        leagueId,
        season,
        leagueName: null,
        rows: [],
      });
      providerCalls.push({
        leagueId,
        season,
        cached: false,
        standingRowCount: 0,
        leagueName: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const nowMs = Date.now();
  const teamDocs: Array<{
    fixtureId: number;
    side: "home" | "away";
    canonicalTeamId: string;
    providerTeamId: number;
    scheduleTeamName: string;
    identity: IdentityClass;
    identityJoin: "PROVIDER_TEAM_ID_EXACT";
    standing: Record<string, unknown> | null;
  }> = [];
  const matchDocs: Array<Record<string, unknown>> = [];

  for (const t of targets) {
    const kickoffMs = Date.parse(t.kickoffTimeUtc);
    const stillPregame =
      Date.parse(capturedAt) < kickoffMs && nowMs < kickoffMs;
    if (!stillPregame) {
      excludedStarted.push({
        fixtureId: t.fixtureId,
        reason: "EXCLUDED_FROM_NEW_PREGAME_EVIDENCE",
        kickoffTimeUtc: t.kickoffTimeUtc,
        homeTeamName: t.homeName,
        awayTeamName: t.awayName,
      });
      continue;
    }

    const leagueId = leagueIdFromCompetitionId(t.competitionId);
    const season = asInt(t.seasonId);
    const table = tables.get(`${leagueId}|${season}`);
    if (!table) throw new Error(`STANDINGS_TABLE_MISSING:${leagueId}|${season}`);

    const home = classifyTeam(table.rows, t.providerHomeTeamId);
    const away = classifyTeam(table.rows, t.providerAwayTeamId);
    const kst = instantToKst(t.kickoffTimeUtc);
    const homeFound = home.identity === "FOUND_EXACT";
    const awayFound = away.identity === "FOUND_EXACT";
    const independentStandingsReady: Ready =
      homeFound && awayFound ? "YES" : homeFound || awayFound ? "PARTIAL" : "NO";

    teamDocs.push({
      fixtureId: t.fixtureId,
      side: "home",
      canonicalTeamId: t.canonicalHomeTeamId,
      providerTeamId: t.providerHomeTeamId,
      scheduleTeamName: t.homeName,
      identity: home.identity,
      identityJoin: "PROVIDER_TEAM_ID_EXACT",
      standing: home.standing,
    });
    teamDocs.push({
      fixtureId: t.fixtureId,
      side: "away",
      canonicalTeamId: t.canonicalAwayTeamId,
      providerTeamId: t.providerAwayTeamId,
      scheduleTeamName: t.awayName,
      identity: away.identity,
      identityJoin: "PROVIDER_TEAM_ID_EXACT",
      standing: away.standing,
    });

    matchDocs.push({
      fixtureId: t.fixtureId,
      homeCanonicalTeamId: t.canonicalHomeTeamId,
      awayCanonicalTeamId: t.canonicalAwayTeamId,
      competition: t.competitionId,
      competitionName: table.leagueName,
      leagueId,
      season,
      kickoffTimeUtc: t.kickoffTimeUtc,
      kickoffKst: kst ? `${kst.date} ${kst.time}` : null,
      admitted: true,
      capturedAtBeforeKickoff: true,
      homeStandingsExactFound: homeFound ? "YES" : "NO",
      awayStandingsExactFound: awayFound ? "YES" : "NO",
      homeIdentity: home.identity,
      awayIdentity: away.identity,
      INDEPENDENT_STANDINGS_READY: independentStandingsReady,
    });
  }

  const foundTeams = teamDocs.filter((t) => t.identity === "FOUND_EXACT");
  const featureFamilyRawAvailability = {
    STANDINGS_RANK: familyStatus(foundTeams, (s) => asInt(s.rank) != null),
    POINTS_PER_GAME: familyStatus(
      foundTeams,
      (s) => asInt(s.points) != null && playedFromStanding(s) != null,
    ),
    GOAL_DIFFERENCE_PER_GAME: familyStatus(foundTeams, (s) => {
      const played = playedFromStanding(s);
      if (played == null) return false;
      if (asInt(s.goalsDiff) != null) return true;
      const goals = asRecord(asRecord(s.all)?.goals);
      return asInt(goals?.for) != null && asInt(goals?.against) != null;
    }),
    PROVIDER_FORM: familyStatus(
      foundTeams,
      (s) => typeof s.form === "string" && s.form.length > 0,
    ),
  };

  const document = {
    meta: {
      schemaVersion: "football-independent-standings-pregame-v0" as const,
      dateKst: DATE_KST,
      capturedAt,
      researchOnly: true as const,
      provider: "api-football" as const,
      providerEndpoint: "standings" as const,
      marketDataUsed: false as const,
      prediction: "NONE" as const,
      engine: "NONE" as const,
      sourceSnapshotRel: SOURCE_SNAPSHOT_REL,
      sourceSnapshotHash: snapshotHash,
      sourceScheduleRel: SOURCE_SCHEDULE_REL,
      backdated: false as const,
      providerPredictionEndpointUsed: false as const,
      oddsUsed: false as const,
      resultDataUsed: false as const,
      postgameDataUsed: false as const,
      fuzzyIdentityUsed: false as const,
      nameFirstIdentityUsed: false as const,
    },
    execution: {
      excludedStarted,
      providerCallCount: providerCalls.length,
      providerCalls,
    },
    teams: teamDocs,
    matches: matchDocs,
    featureFamilyRawAvailability,
  };

  const errors = validateIndependentStandingsArtifact(document);
  if (errors.length > 0) {
    throw new Error(`VALIDATION_FAILED:${errors.join(",")}`);
  }

  const abs = path.join(cwd, ARTIFACT_REL);
  const body = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(abs, body, "utf8");
  const sha256 = createHash("sha256").update(body).digest("hex");
  return { document, rel: ARTIFACT_REL, sha256 };
}

async function main() {
  const result = await captureIndependentStandingsPregameV0();
  const d = result.document;
  const matchReady = d.matches.map(
    (m) =>
      `${m.fixtureId}:${String(m.INDEPENDENT_STANDINGS_READY)}`,
  );
  console.log(
    JSON.stringify(
      {
        rel: result.rel,
        sha256: result.sha256,
        capturedAt: d.meta.capturedAt,
        providerCallCount: d.execution.providerCallCount,
        providerCalls: d.execution.providerCalls,
        excludedStarted: d.execution.excludedStarted.map((e) => e.fixtureId),
        teams: d.teams.map((t) => ({
          providerTeamId: t.providerTeamId,
          identity: t.identity,
        })),
        matchReady,
        featureFamilyRawAvailability: d.featureFamilyRawAvailability,
      },
      null,
      2,
    ),
  );
}

const isDirectRun =
  !!process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
