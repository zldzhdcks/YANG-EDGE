/**
 * Mission-specific capture: exact prior fixture results for the
 * 2026-09-05 still-pregame frozen matches.
 *
 *   npx tsx --env-file=.env.local scripts/capture-2026-09-05-independent-prior-fixtures-pregame-v0.ts
 *
 * /fixtures?id={PRIOR_ID} only. No standings, odds, predictions, or target results.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { instantToKst } from "../src/lib/datetime/kst";
import { canonicalizeKickoffTimeUtc } from "../src/lib/football/core/kickoff";
import { normalizeFootballScheduleStatus } from "../src/lib/football/core/status";
import { getFootballProvider } from "../src/lib/football";
import type { FixtureRaw } from "../src/lib/football/types";

export const DATE_KST = "2026-09-05";
export const ARTIFACT_REL =
  "data/research/football/2026-09-05-independent-prior-fixtures-pregame-v0.json";
export const SOURCE_SNAPSHOT_REL =
  "data/research/football/2026-09-05-prediction-snapshot-v0.json";
export const SOURCE_SCHEDULE_REL =
  "data/research/football/2026-09-05-schedule-v1.json";
export const SOURCE_SNAPSHOT_HASH =
  "a8577c1342a8031adffa9554923cc8bedda8b2b0abc1a218657449c570a5267a";

const FORBIDDEN_FIXTURE_IDS = new Set([
  1557395, 1550110, 1557391, 1570364, 1556051,
]);

type CompletionClass =
  | "COMPLETED_SAFE"
  | "NOT_COMPLETED"
  | "NOT_FOUND"
  | "PROVIDER_BLOCKED"
  | "IDENTITY_CONFLICT";
type RawAvail = "RAW_AVAILABLE" | "RAW_MISSING";
type Wdl = "WIN" | "DRAW" | "LOSS";

type TargetSpec = {
  fixtureId: number;
  competitionId: string;
  kickoffTimeUtc: string;
  homeProviderTeamId: number;
  awayProviderTeamId: number;
  homeCanonicalTeamId: string;
  awayCanonicalTeamId: string;
  homeName: string;
  awayName: string;
};

type PriorSpec = {
  canonicalTeamId: string;
  providerTeamId: number;
  teamName: string;
  targetFixtureId: number;
  priorFixtureId: number;
};

const PRIOR_SPECS: readonly PriorSpec[] = [
  {
    canonicalTeamId: "fb-team-v1-api-football-34",
    providerTeamId: 34,
    teamName: "Newcastle",
    targetFixtureId: 1557395,
    priorFixtureId: 1557386,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-35",
    providerTeamId: 35,
    teamName: "Bournemouth",
    targetFixtureId: 1557395,
    priorFixtureId: 1557378,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-502",
    providerTeamId: 502,
    teamName: "Fiorentina",
    targetFixtureId: 1550110,
    priorFixtureId: 1550100,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-503",
    providerTeamId: 503,
    teamName: "Torino",
    targetFixtureId: 1550110,
    priorFixtureId: 1550106,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-36",
    providerTeamId: 36,
    teamName: "Fulham",
    targetFixtureId: 1557391,
    priorFixtureId: 1557385,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-52",
    providerTeamId: 52,
    teamName: "Crystal Palace",
    targetFixtureId: 1557391,
    priorFixtureId: 1557381,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-531",
    providerTeamId: 531,
    teamName: "Athletic Club",
    targetFixtureId: 1570364,
    priorFixtureId: 1570335,
  },
  {
    canonicalTeamId: "fb-team-v1-api-football-530",
    providerTeamId: 530,
    teamName: "Atletico Madrid",
    targetFixtureId: 1570364,
    priorFixtureId: 1570362,
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

function assertNotForbidden(fixtureId: number): void {
  if (FORBIDDEN_FIXTURE_IDS.has(fixtureId)) {
    throw new Error(`TARGET_LEAKAGE_DENIED:${fixtureId}`);
  }
}

function loadSnapshotHash(cwd: string): string {
  const snapshotHead = readFileSync(
    path.join(cwd, SOURCE_SNAPSHOT_REL),
    "utf8",
  ).slice(0, 2048);
  const match = /"snapshotHash": "([a-f0-9]{64})"/.exec(snapshotHead);
  const hash = match?.[1] ?? null;
  if (hash !== SOURCE_SNAPSHOT_HASH) {
    throw new Error(
      `SNAPSHOT_HASH_MISMATCH expected=${SOURCE_SNAPSHOT_HASH} actual=${hash ?? "MISSING"}`,
    );
  }
  return hash;
}

function loadScheduleTargets(cwd: string): {
  excludedStarted: TargetSpec[];
  targets: TargetSpec[];
} {
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
  const excludedStarted: TargetSpec[] = [];
  const targets: TargetSpec[] = [];
  const wanted = new Map<number, Omit<PriorSpec, "priorFixtureId" | "teamName">>();
  for (const spec of PRIOR_SPECS) {
    wanted.set(spec.targetFixtureId, spec);
  }

  for (const fixtureId of wanted.keys()) {
    const row = byFixture.get(fixtureId);
    if (!row) throw new Error(`SCHEDULE_ROW_MISSING:${fixtureId}`);
    const kickoffTimeUtc = asString(row.kickoffTimeUtc);
    if (!kickoffTimeUtc) throw new Error(`KICKOFF_MISSING:${fixtureId}`);
    const spec = PRIOR_SPECS.find((p) => p.targetFixtureId === fixtureId);
    if (!spec) throw new Error(`PRIOR_SPEC_MISSING_FOR_TARGET:${fixtureId}`);
    const homeProviderTeamId = asInt(row.homeProviderTeamId);
    const awayProviderTeamId = asInt(row.awayProviderTeamId);
    const homeCanonicalTeamId = asString(row.homeTeamId);
    const awayCanonicalTeamId = asString(row.awayTeamId);
    const home = PRIOR_SPECS.find(
      (p) => p.targetFixtureId === fixtureId && p.providerTeamId === homeProviderTeamId,
    );
    const away = PRIOR_SPECS.find(
      (p) => p.targetFixtureId === fixtureId && p.providerTeamId === awayProviderTeamId,
    );
    if (
      !home ||
      !away ||
      homeCanonicalTeamId !== home.canonicalTeamId ||
      awayCanonicalTeamId !== away.canonicalTeamId
    ) {
      throw new Error(`TARGET_TEAM_IDENTITY_MISMATCH:${fixtureId}`);
    }
    const target: TargetSpec = {
      fixtureId,
      competitionId: asString(row.competitionId) ?? "",
      kickoffTimeUtc,
      homeProviderTeamId: home.providerTeamId,
      awayProviderTeamId: away.providerTeamId,
      homeCanonicalTeamId: home.canonicalTeamId,
      awayCanonicalTeamId: away.canonicalTeamId,
      homeName: asString(row.homeTeamName) ?? home.teamName,
      awayName: asString(row.awayTeamName) ?? away.teamName,
    };
    if (Date.parse(kickoffTimeUtc) <= nowMs) {
      excludedStarted.push(target);
    } else {
      targets.push(target);
    }
  }
  return { excludedStarted, targets };
}

function compactFixture(fixture: FixtureRaw): Record<string, unknown> {
  return {
    fixtureId: fixture.fixture?.id ?? null,
    kickoffTimeUtc: fixture.fixture?.date
      ? canonicalizeKickoffTimeUtc(fixture.fixture.date)
      : null,
    statusShort: fixture.fixture?.status?.short ?? null,
    statusLong: fixture.fixture?.status?.long ?? null,
    leagueId: fixture.league?.id ?? null,
    leagueName: fixture.league?.name ?? null,
    season: fixture.league?.season ?? null,
    homeProviderTeamId: fixture.teams?.home?.id ?? null,
    awayProviderTeamId: fixture.teams?.away?.id ?? null,
    homeTeamName: fixture.teams?.home?.name ?? null,
    awayTeamName: fixture.teams?.away?.name ?? null,
    homeGoals: fixture.goals?.home ?? null,
    awayGoals: fixture.goals?.away ?? null,
  };
}

function classifyPrior(input: {
  spec: PriorSpec;
  capturedAt: string;
  fixture: FixtureRaw | null;
  error: string | null;
}): {
  classification: CompletionClass;
  reasons: string[];
  compact: Record<string, unknown> | null;
  homeOrAway: "HOME" | "AWAY" | null;
  opponentProviderTeamId: number | null;
  opponentName: string | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  result: Wdl | null;
  priorKickoffTimeUtc: string | null;
  scheduleStatus: string | null;
} {
  if (FORBIDDEN_FIXTURE_IDS.has(input.spec.priorFixtureId)) {
    throw new Error(`TARGET_LEAKAGE_DENIED:${input.spec.priorFixtureId}`);
  }
  if (input.error) {
    return {
      classification: "PROVIDER_BLOCKED",
      reasons: ["PROVIDER_ERROR"],
      compact: null,
      homeOrAway: null,
      opponentProviderTeamId: null,
      opponentName: null,
      goalsFor: null,
      goalsAgainst: null,
      result: null,
      priorKickoffTimeUtc: null,
      scheduleStatus: null,
    };
  }
  if (input.fixture == null) {
    return {
      classification: "NOT_FOUND",
      reasons: ["FIXTURE_NULL"],
      compact: null,
      homeOrAway: null,
      opponentProviderTeamId: null,
      opponentName: null,
      goalsFor: null,
      goalsAgainst: null,
      result: null,
      priorKickoffTimeUtc: null,
      scheduleStatus: null,
    };
  }

  const compact = compactFixture(input.fixture);
  const returnedId = asInt(input.fixture.fixture?.id);
  const homeId = asInt(input.fixture.teams?.home?.id);
  const awayId = asInt(input.fixture.teams?.away?.id);
  const reasons: string[] = [];

  if (returnedId !== input.spec.priorFixtureId) {
    reasons.push("RETURNED_FIXTURE_ID_MISMATCH");
  }
  const isHome = homeId === input.spec.providerTeamId;
  const isAway = awayId === input.spec.providerTeamId;
  if (isHome === isAway) {
    return {
      classification: "IDENTITY_CONFLICT",
      reasons: ["EXPECTED_PROVIDER_TEAM_ID_NOT_EXACT_SIDE"],
      compact,
      homeOrAway: null,
      opponentProviderTeamId: null,
      opponentName: null,
      goalsFor: null,
      goalsAgainst: null,
      result: null,
      priorKickoffTimeUtc: asString(compact.kickoffTimeUtc),
      scheduleStatus: normalizeFootballScheduleStatus(
        input.fixture.fixture?.status?.short,
      ),
    };
  }

  const homeOrAway = isHome ? "HOME" : "AWAY";
  const opponentProviderTeamId = isHome ? awayId : homeId;
  const opponentName = isHome
    ? asString(input.fixture.teams?.away?.name)
    : asString(input.fixture.teams?.home?.name);
  const homeGoals = input.fixture.goals?.home;
  const awayGoals = input.fixture.goals?.away;
  const goalsFor = isHome ? homeGoals ?? null : awayGoals ?? null;
  const goalsAgainst = isHome ? awayGoals ?? null : homeGoals ?? null;
  const scheduleStatus = normalizeFootballScheduleStatus(
    input.fixture.fixture?.status?.short,
  );
  const priorKickoffTimeUtc = asString(compact.kickoffTimeUtc);
  const kickoffMs = priorKickoffTimeUtc
    ? Date.parse(priorKickoffTimeUtc)
    : Number.NaN;
  const capturedMs = Date.parse(input.capturedAt);
  const goalsNonNull =
    typeof homeGoals === "number" &&
    typeof awayGoals === "number" &&
    Number.isFinite(homeGoals) &&
    Number.isFinite(awayGoals);

  if (scheduleStatus !== "FINISHED") {
    reasons.push("STATUS_NOT_FINISHED");
  }
  if (!priorKickoffTimeUtc || Number.isNaN(kickoffMs)) {
    reasons.push("PRIOR_KICKOFF_MISSING");
  } else if (!(kickoffMs < capturedMs)) {
    reasons.push("PRIOR_KICKOFF_NOT_BEFORE_CAPTURED_AT");
  }
  if (!goalsNonNull) reasons.push("GOALS_NULL");
  if (FORBIDDEN_FIXTURE_IDS.has(input.spec.priorFixtureId)) {
    reasons.push("TARGET_FIXTURE_ID");
  }

  if (reasons.length > 0) {
    return {
      classification: "NOT_COMPLETED",
      reasons,
      compact,
      homeOrAway,
      opponentProviderTeamId,
      opponentName,
      goalsFor: goalsNonNull ? goalsFor : null,
      goalsAgainst: goalsNonNull ? goalsAgainst : null,
      result: null,
      priorKickoffTimeUtc,
      scheduleStatus,
    };
  }

  let result: Wdl = "DRAW";
  if ((goalsFor as number) > (goalsAgainst as number)) result = "WIN";
  else if ((goalsFor as number) < (goalsAgainst as number)) result = "LOSS";

  return {
    classification: "COMPLETED_SAFE",
    reasons: ["EXACT_PROVIDER_TEAM_ID_MATCH", "PROVIDER_STATUS_FINISHED"],
    compact,
    homeOrAway,
    opponentProviderTeamId,
    opponentName,
    goalsFor,
    goalsAgainst,
    result,
    priorKickoffTimeUtc,
    scheduleStatus,
  };
}

function daysBetween(priorUtc: string | null, targetUtc: string): number | null {
  if (!priorUtc) return null;
  const priorMs = Date.parse(priorUtc);
  const targetMs = Date.parse(targetUtc);
  if (Number.isNaN(priorMs) || Number.isNaN(targetMs)) return null;
  return Number(((targetMs - priorMs) / 86_400_000).toFixed(3));
}

export function validatePriorFixturesArtifact(doc: unknown): string[] {
  const errors: string[] = [];
  const rec = asRecord(doc);
  if (!rec) return ["ARTIFACT_NOT_OBJECT"];
  const meta = asRecord(rec.meta);
  if (meta?.schemaVersion !== "football-independent-prior-fixtures-pregame-v0") {
    errors.push("SCHEMA_VERSION");
  }
  if (meta?.marketDataUsed !== false) errors.push("MARKET_DATA_USED");
  if (meta?.prediction !== "NONE") errors.push("PREDICTION");
  if (meta?.engine !== "NONE") errors.push("ENGINE");
  if (meta?.providerEndpoint !== "/fixtures?id=") errors.push("ENDPOINT");
  if (meta?.sourceSnapshotHash !== SOURCE_SNAPSHOT_HASH) {
    errors.push("SOURCE_SNAPSHOT_HASH");
  }
  if (meta?.RECENT_FORM_READY !== "NO") errors.push("RECENT_FORM_READY");
  if (meta?.targetFixtureFetchCount !== 0) errors.push("TARGET_FIXTURE_FETCH_COUNT");
  const capturedAt = asString(meta?.capturedAt);
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt)) || !capturedAt.endsWith("Z")) {
    errors.push("CAPTURED_AT_INVALID");
  }

  const text = JSON.stringify(doc);
  for (const banned of ["LEAN_HOME", "LEAN_AWAY", "probability", "valueEdge"]) {
    if (text.includes(banned)) errors.push(`BANNED_FIELD:${banned}`);
  }
  for (const id of FORBIDDEN_FIXTURE_IDS) {
    if (text.includes(`getFixtureById(${id})`)) {
      errors.push(`FORBIDDEN_FETCH:${id}`);
    }
  }

  const fetched = Array.isArray(rec.providerCalls)
    ? rec.providerCalls.map((c) => asInt(asRecord(c)?.fixtureId))
    : [];
  for (const id of fetched) {
    if (id != null && FORBIDDEN_FIXTURE_IDS.has(id)) {
      errors.push(`FORBIDDEN_CALL:${id}`);
    }
  }
  if (new Set(fetched.filter((id) => id != null)).size !== fetched.length) {
    errors.push("DUPLICATE_PRIOR_FETCH");
  }
  if (fetched.length > 8) errors.push("TOO_MANY_CALLS");

  const teams = Array.isArray(rec.teams) ? rec.teams : [];
  const teamIds: number[] = [];
  for (const team of teams) {
    const t = asRecord(team);
    const pid = asInt(t?.providerTeamId);
    if (pid != null) teamIds.push(pid);
    if (t?.identityJoin !== "EXACT_PROVIDER_TEAM_ID_MATCH") {
      errors.push("IDENTITY_JOIN");
    }
    if (t?.classification === "COMPLETED_SAFE") {
      if (t.result !== "WIN" && t.result !== "DRAW" && t.result !== "LOSS") {
        errors.push("COMPLETED_SAFE_RESULT_MISSING");
      }
      const priorId = asInt(t.priorFixtureId);
      if (priorId != null && FORBIDDEN_FIXTURE_IDS.has(priorId)) {
        errors.push("COMPLETED_SAFE_TARGET_ID");
      }
    } else if (t?.result != null) {
      errors.push("RESULT_WITHOUT_COMPLETED_SAFE");
    }
  }
  if (new Set(teamIds).size !== teamIds.length) errors.push("DUPLICATE_TARGET_TEAM");
  return errors;
}

export async function captureIndependentPriorFixturesPregameV0(
  cwd = process.cwd(),
) {
  const snapshotHash = loadSnapshotHash(cwd);
  const { excludedStarted, targets } = loadScheduleTargets(cwd);
  const admittedIds = new Set(targets.map((t) => t.fixtureId));
  const priorsToFetch = PRIOR_SPECS.filter((p) =>
    admittedIds.has(p.targetFixtureId),
  );
  for (const spec of priorsToFetch) {
    assertNotForbidden(spec.priorFixtureId);
  }

  const provider = getFootballProvider();
  if (provider.kind !== "api-football") {
    throw new Error(`PROVIDER_KIND:${provider.kind}`);
  }

  const capturedAt = new Date().toISOString();
  const nowMs = Date.now();
  const stillAdmitted = targets.filter(
    (t) => Date.parse(t.kickoffTimeUtc) > nowMs && Date.parse(capturedAt) < Date.parse(t.kickoffTimeUtc),
  );
  const lateExcluded = targets.filter((t) => !stillAdmitted.includes(t));
  const admittedNow = new Set(stillAdmitted.map((t) => t.fixtureId));
  const fetchList = priorsToFetch.filter((p) => admittedNow.has(p.targetFixtureId));

  const providerCalls: Array<{
    fixtureId: number;
    cached: boolean;
    error: string | null;
    found: boolean;
  }> = [];
  const fetched = new Map<
    number,
    { fixture: FixtureRaw | null; error: string | null }
  >();

  let targetFixtureFetchCount = 0;
  for (const spec of fetchList) {
    assertNotForbidden(spec.priorFixtureId);
    if (FORBIDDEN_FIXTURE_IDS.has(spec.priorFixtureId)) {
      targetFixtureFetchCount += 1;
      throw new Error(`TARGET_LEAKAGE_DENIED:${spec.priorFixtureId}`);
    }
    try {
      const result = await provider.getFixtureById(spec.priorFixtureId);
      fetched.set(spec.priorFixtureId, { fixture: result.fixture, error: null });
      providerCalls.push({
        fixtureId: spec.priorFixtureId,
        cached: result.cached,
        error: null,
        found: result.fixture != null,
      });
    } catch (error) {
      fetched.set(spec.priorFixtureId, {
        fixture: null,
        error: error instanceof Error ? error.message : String(error),
      });
      providerCalls.push({
        fixtureId: spec.priorFixtureId,
        cached: false,
        error: error instanceof Error ? error.message : String(error),
        found: false,
      });
    }
  }

  const targetById = new Map(stillAdmitted.map((t) => [t.fixtureId, t]));
  const teamDocs: Array<Record<string, unknown>> = [];
  for (const spec of fetchList) {
    const target = targetById.get(spec.targetFixtureId);
    if (!target) continue;
    const got = fetched.get(spec.priorFixtureId) ?? {
      fixture: null,
      error: "NOT_FETCHED",
    };
    const classified = classifyPrior({
      spec,
      capturedAt,
      fixture: got.fixture,
      error: got.error,
    });
    teamDocs.push({
      canonicalTeamId: spec.canonicalTeamId,
      providerTeamId: spec.providerTeamId,
      teamName: spec.teamName,
      targetFixtureId: spec.targetFixtureId,
      priorFixtureId: spec.priorFixtureId,
      identityJoin: "EXACT_PROVIDER_TEAM_ID_MATCH",
      classification: classified.classification,
      reasons: classified.reasons,
      priorKickoff: classified.priorKickoffTimeUtc,
      priorOpponent: classified.opponentName,
      priorOpponentProviderTeamId: classified.opponentProviderTeamId,
      homeOrAway: classified.homeOrAway,
      status: classified.scheduleStatus,
      providerStatusShort: classified.compact?.statusShort ?? null,
      providerStatusLong: classified.compact?.statusLong ?? null,
      goalsFor: classified.goalsFor,
      goalsAgainst: classified.goalsAgainst,
      result: classified.result,
      daysBetweenPriorKickoffAndTargetKickoff: daysBetween(
        classified.priorKickoffTimeUtc,
        target.kickoffTimeUtc,
      ),
      priorFixture: classified.compact,
    });
  }

  const matchDocs = stillAdmitted.map((target) => {
    const home = teamDocs.find(
      (t) =>
        t.targetFixtureId === target.fixtureId &&
        t.providerTeamId === target.homeProviderTeamId,
    );
    const away = teamDocs.find(
      (t) =>
        t.targetFixtureId === target.fixtureId &&
        t.providerTeamId === target.awayProviderTeamId,
    );
    const homeSafe = home?.classification === "COMPLETED_SAFE";
    const awaySafe = away?.classification === "COMPLETED_SAFE";
    const kst = instantToKst(target.kickoffTimeUtc);
    const bothSafe = homeSafe && awaySafe;
    const bothKickoffs =
      asString(home?.priorKickoff) != null && asString(away?.priorKickoff) != null;
    return {
      fixtureId: target.fixtureId,
      homeCanonicalTeamId: target.homeCanonicalTeamId,
      awayCanonicalTeamId: target.awayCanonicalTeamId,
      competition: target.competitionId,
      kickoffTimeUtc: target.kickoffTimeUtc,
      kickoffKst: kst ? `${kst.date} ${kst.time}` : null,
      admitted: true,
      capturedAtBeforeKickoff: Date.parse(capturedAt) < Date.parse(target.kickoffTimeUtc),
      homePriorClassification: home?.classification ?? "NOT_FOUND",
      awayPriorClassification: away?.classification ?? "NOT_FOUND",
      LAST_MATCH_RESULT: bothSafe ? "RAW_AVAILABLE" : "RAW_MISSING",
      LAST_MATCH_GOAL_DIFFERENCE: bothSafe ? "RAW_AVAILABLE" : "RAW_MISSING",
      REST_DAYS_APPROX: bothKickoffs ? "RAW_AVAILABLE" : "RAW_MISSING",
    } satisfies Record<string, unknown> & {
      LAST_MATCH_RESULT: RawAvail;
      LAST_MATCH_GOAL_DIFFERENCE: RawAvail;
      REST_DAYS_APPROX: RawAvail;
    };
  });

  const completedSafeCount = teamDocs.filter(
    (t) => t.classification === "COMPLETED_SAFE",
  ).length;

  const document = {
    meta: {
      schemaVersion: "football-independent-prior-fixtures-pregame-v0" as const,
      dateKst: DATE_KST,
      capturedAt,
      researchOnly: true as const,
      provider: "api-football" as const,
      providerEndpoint: "/fixtures?id=" as const,
      marketDataUsed: false as const,
      prediction: "NONE" as const,
      engine: "NONE" as const,
      sourceSnapshotRel: SOURCE_SNAPSHOT_REL,
      sourceSnapshotHash: snapshotHash,
      sourceScheduleRel: SOURCE_SCHEDULE_REL,
      backdated: false as const,
      providerPredictionEndpointUsed: false as const,
      oddsUsed: false as const,
      postgameDataUsed: false as const,
      targetResultUsed: false as const,
      started1556051ResultUsed: false as const,
      fuzzyIdentityUsed: false as const,
      nameFirstIdentityUsed: false as const,
      standingsAttempt: "PROVIDER_PLAN_BLOCKED" as const,
      standingsOldSeasonFallbackUsed: false as const,
      targetFixtureFetchCount,
      RECENT_FORM_READY: "NO" as const,
    },
    execution: {
      excludedStarted: [
        ...excludedStarted.map((t) => ({
          fixtureId: t.fixtureId,
          reason: "EXCLUDED_FROM_NEW_PREGAME_EVIDENCE",
          kickoffTimeUtc: t.kickoffTimeUtc,
        })),
        ...lateExcluded.map((t) => ({
          fixtureId: t.fixtureId,
          reason: "EXCLUDED_FROM_NEW_PREGAME_EVIDENCE",
          kickoffTimeUtc: t.kickoffTimeUtc,
        })),
      ],
      providerCallCount: providerCalls.length,
      providerCalls,
      forbiddenFixtureIds: [...FORBIDDEN_FIXTURE_IDS],
    },
    teams: teamDocs,
    matches: matchDocs,
    completedSafeCount,
  };

  const errors = validatePriorFixturesArtifact(document);
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
  const result = await captureIndependentPriorFixturesPregameV0();
  const d = result.document;
  console.log(
    JSON.stringify(
      {
        rel: result.rel,
        sha256: result.sha256,
        capturedAt: d.meta.capturedAt,
        providerCallCount: d.execution.providerCallCount,
        targetFixtureFetchCount: d.meta.targetFixtureFetchCount,
        excludedStarted: d.execution.excludedStarted.map((e) => e.fixtureId),
        completedSafeCount: d.completedSafeCount,
        teams: d.teams.map((t) => ({
          teamName: t.teamName,
          priorFixtureId: t.priorFixtureId,
          classification: t.classification,
          result: t.result,
          goalsFor: t.goalsFor,
          goalsAgainst: t.goalsAgainst,
        })),
        matches: d.matches.map((m) => ({
          fixtureId: m.fixtureId,
          LAST_MATCH_RESULT: m.LAST_MATCH_RESULT,
          LAST_MATCH_GOAL_DIFFERENCE: m.LAST_MATCH_GOAL_DIFFERENCE,
          REST_DAYS_APPROX: m.REST_DAYS_APPROX,
        })),
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
