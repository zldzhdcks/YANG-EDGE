/**
 * Football Official Result v0 builder.
 * Schedule artifact + API-Football fixture-by-id → sealed official result.
 * Does not read or write Snapshot / Odds / Market Baseline. No Grade. No Engine.
 */
import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getFootballProvider, resolveFootballProviderKind } from "../get-football-provider";
import { buildFootballMatchIdentity } from "../foundation/match-identity";
import type { FootballMatchIdentity, FootballMatchStatus } from "../foundation/types";
import type { FootballScheduleRowV1 } from "../core/types";
import { isOddsIsoInstant } from "../odds-1x2-v1/instant";
import {
  isFinalStatus,
  type FootballOfficialResultV0,
  type FootballResultInputV0,
  type FootballResultStatus,
  type FootballScorePair,
  resolveFootballResultUsability,
} from "../result-foundation-v0";
import type { FixtureRaw } from "../types";
import {
  extractApiFootballProviderAdvancementWinner,
  extractApiFootballResultScores,
  scorePairOrNull,
  scorePairsEqual,
} from "./extract-scores";
import { computeFootballOfficialResultArtifactHash } from "./hash";
import { joinProviderFixtureToScheduleRow } from "./join-schedule";
import { loadFootballScheduleArtifactForOfficialResult } from "./load-schedule";
import {
  isNonFinalTerminalStatus,
  isWaitingFinalStatus,
  mapApiFootballShortStatusToResultStatus,
} from "./map-provider-status";
import { footballOfficialResultV0Rel } from "./paths";
import {
  FOOTBALL_OFFICIAL_RESULT_MARKET_SETTLEMENT,
  FOOTBALL_OFFICIAL_RESULT_PROVIDER,
  FOOTBALL_OFFICIAL_RESULT_V0_BUILDER,
  FOOTBALL_OFFICIAL_RESULT_V0_SCHEMA,
  type FootballOfficialResultArtifactV0,
  type FootballOfficialResultFixtureFetcher,
  type FootballOfficialResultMatchV0,
  type FootballOfficialResultRunV0,
} from "./types";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

function mapScheduleStatusToIdentityStatus(
  status: FootballScheduleRowV1["status"],
): FootballMatchStatus {
  if (status === "SUSPENDED") return "UNKNOWN";
  return status;
}

export function identityFromScheduleRow(
  row: FootballScheduleRowV1,
): FootballMatchIdentity {
  if (!row.homeTeamId || !row.awayTeamId) {
    throw new Error(
      `FOOTBALL_OFFICIAL_RESULT_SCHEDULE_TEAM_ID_MISSING: ${row.matchId}`,
    );
  }
  if (!row.seasonId) {
    throw new Error(
      `FOOTBALL_OFFICIAL_RESULT_SCHEDULE_SEASON_MISSING: ${row.matchId}`,
    );
  }
  if (!row.kickoffTimeUtc) {
    throw new Error(
      `FOOTBALL_OFFICIAL_RESULT_SCHEDULE_KICKOFF_MISSING: ${row.matchId}`,
    );
  }
  return buildFootballMatchIdentity({
    provider: "api-football",
    fixtureId: row.providerMatchId,
    competitionId: row.competitionId,
    season: row.seasonId,
    kickoffUtc: row.kickoffTimeUtc,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    neutralVenue: false,
    status: mapScheduleStatusToIdentityStatus(row.status),
  });
}

export function selectOfficialResultTargetRows(
  rows: FootballScheduleRowV1[],
): FootballScheduleRowV1[] {
  return rows
    .filter((row) => row.predictionEligibility === "ELIGIBLE_FORMAT")
    .slice()
    .sort((a, b) => a.matchId.localeCompare(b.matchId));
}

function marketOneXTwo(
  outcome: FootballOfficialResultV0["oneXTwoOutcome"] | undefined,
): "HOME" | "DRAW" | "AWAY" | null {
  if (outcome === "HOME" || outcome === "DRAW" || outcome === "AWAY") {
    return outcome;
  }
  return null;
}

function marketAdvancement(
  winner: FootballOfficialResultV0["advancementWinner"] | undefined,
): "HOME" | "AWAY" | null {
  if (winner === "HOME" || winner === "AWAY") return winner;
  return null;
}

function leagueUnexpectedReasonCodes(input: {
  matchFormat: FootballScheduleRowV1["matchFormat"];
  resultStatus: FootballResultStatus;
  extraTime: FootballScorePair;
  penalties: FootballScorePair;
}): string[] {
  if (input.matchFormat !== "LEAGUE_MATCH") return [];
  const codes: string[] = [];
  if (input.resultStatus === "FINAL_AFTER_EXTRA_TIME") {
    codes.push("LEAGUE_UNEXPECTED_AET");
  }
  if (input.resultStatus === "FINAL_AFTER_PENALTIES") {
    codes.push("LEAGUE_UNEXPECTED_PEN");
  }
  if (scorePairOrNull(input.extraTime) != null) {
    codes.push("LEAGUE_UNEXPECTED_EXTRA_TIME");
  }
  if (scorePairOrNull(input.penalties) != null) {
    codes.push("LEAGUE_UNEXPECTED_PENALTIES");
  }
  return codes;
}

export function buildFootballResultInputFromProvider(input: {
  row: FootballScheduleRowV1;
  identity: FootballMatchIdentity;
  fixture: FixtureRaw;
  resultObservedAt: string;
}): {
  resultInput: FootballResultInputV0;
  providerStatusRaw: string | null;
  resultStatus: FootballResultStatus;
  reasonCodes: string[];
} {
  const providerStatusRaw =
    input.fixture.fixture?.status?.short != null
      ? String(input.fixture.fixture.status.short)
      : null;
  const resultStatus = mapApiFootballShortStatusToResultStatus(providerStatusRaw);
  const scores = extractApiFootballResultScores(input.fixture);
  const winner = extractApiFootballProviderAdvancementWinner(input.fixture);
  const reasonCodes = [
    ...scores.reasonCodes,
    ...winner.reasonCodes,
    ...leagueUnexpectedReasonCodes({
      matchFormat: input.row.matchFormat,
      resultStatus,
      extraTime: scores.extraTime,
      penalties: scores.penalties,
    }),
  ];

  if (
    resultStatus === "FINAL" &&
    scores.regularTime.home != null &&
    scores.regularTime.away != null &&
    scores.finalScore.home != null &&
    scores.finalScore.away != null &&
    !scorePairsEqual(scores.regularTime, scores.finalScore)
  ) {
    reasonCodes.push("GOALS_FULLTIME_MISMATCH");
  }

  const resultInput: FootballResultInputV0 = {
    matchId: input.identity.matchId,
    identityHash: input.identity.identityHash,
    provider: input.identity.provider,
    fixtureId: input.identity.fixtureId,
    competitionId: input.identity.competitionId,
    season: input.identity.season,
    homeTeamId: input.identity.homeTeamId,
    awayTeamId: input.identity.awayTeamId,
    status: resultStatus,
    regularTime: scores.regularTime,
    extraTime: scores.extraTime,
    penalties: scores.penalties,
    finalScore: scores.finalScore,
    resultObservedAt: input.resultObservedAt,
    sourceStatusRaw: providerStatusRaw,
    providerAdvancementWinner: winner.winner,
  };

  return { resultInput, providerStatusRaw, resultStatus, reasonCodes };
}

export function resolveOfficialResultMatch(input: {
  row: FootballScheduleRowV1;
  fixture: FixtureRaw;
  resultObservedAt: string;
}): {
  match: FootballOfficialResultMatchV0;
  joinOk: boolean;
  orientation: "MATCHED" | "REVERSED_SUSPECTED" | "MISMATCH";
  resultStatus: FootballResultStatus;
  providerStatusRaw: string | null;
} {
  const identity = identityFromScheduleRow(input.row);
  const join = joinProviderFixtureToScheduleRow(input.fixture, input.row);
  const built = buildFootballResultInputFromProvider({
    row: input.row,
    identity,
    fixture: input.fixture,
    resultObservedAt: input.resultObservedAt,
  });

  const identitiesByMatchId = new Map([[identity.matchId, identity]]);
  const resolved = resolveFootballResultUsability({
    rows: [built.resultInput],
    identitiesByMatchId,
  });
  const rowResolved = resolved.resolved[0]!;
  const reasonCodes = [
    ...join.reasonCodes,
    ...built.reasonCodes,
    ...rowResolved.reasonCodes,
  ].filter((code, i, arr) => arr.indexOf(code) === i);

  const gradingAllowed =
    join.ok &&
    rowResolved.gradingAllowed &&
    !built.reasonCodes.some((c) => c.startsWith("LEAGUE_UNEXPECTED_")) &&
    !built.reasonCodes.includes("GOALS_FULLTIME_MISMATCH") &&
    !built.reasonCodes.includes("PROVIDER_WINNER_AMBIGUOUS");

  const usability = join.ok
    ? gradingAllowed
      ? rowResolved.usability
      : built.reasonCodes.some((c) => c.startsWith("LEAGUE_UNEXPECTED_")) ||
          built.reasonCodes.includes("GOALS_FULLTIME_MISMATCH") ||
          built.reasonCodes.includes("PROVIDER_WINNER_AMBIGUOUS")
        ? "RESULT_CONFLICT"
        : rowResolved.usability
    : join.orientation === "REVERSED_SUSPECTED"
      ? "REVERSED_RESULT_SUSPECTED"
      : "IDENTITY_UNRESOLVED";

  const official = rowResolved.result;
  const match: FootballOfficialResultMatchV0 = {
    matchId: input.row.matchId,
    fixtureId: input.row.providerMatchId,
    competitionId: input.row.competitionId,
    homeTeamId: input.row.homeTeamId ?? identity.homeTeamId,
    awayTeamId: input.row.awayTeamId ?? identity.awayTeamId,
    homeTeamName: input.row.homeTeamName,
    awayTeamName: input.row.awayTeamName,
    kickoffTimeUtc: input.row.kickoffTimeUtc,
    providerStatusRaw: built.providerStatusRaw,
    resultStatus: built.resultStatus,
    resultObservedAt: input.resultObservedAt,
    regularTime: official?.regularTime ?? built.resultInput.regularTime,
    extraTime: scorePairOrNull(official?.extraTime ?? built.resultInput.extraTime),
    penalties: scorePairOrNull(official?.penalties ?? built.resultInput.penalties),
    finalScore: official?.finalScore ?? built.resultInput.finalScore,
    oneXTwoOutcome: marketOneXTwo(official?.oneXTwoOutcome),
    advancementWinner: marketAdvancement(official?.advancementWinner),
    usability,
    gradingAllowed,
    reasonCodes,
    resultHash: official?.resultHash ?? null,
    researchOnly: true,
  };

  return {
    match,
    joinOk: join.ok,
    orientation: join.orientation,
    resultStatus: built.resultStatus,
    providerStatusRaw: built.providerStatusRaw,
  };
}

function assembleArtifact(input: {
  dateKst: string;
  generatedAt: string;
  resultObservedAt: string;
  sourceScheduleRel: string;
  sourceScheduleHash: string;
  scheduleMatches: number;
  providerRequestedGames: number;
  matches: FootballOfficialResultMatchV0[];
}): FootballOfficialResultArtifactV0 {
  const withoutHash: Omit<FootballOfficialResultArtifactV0, "meta"> & {
    meta: Omit<FootballOfficialResultArtifactV0["meta"], "resultArtifactHash">;
  } = {
    meta: {
      schemaVersion: FOOTBALL_OFFICIAL_RESULT_V0_SCHEMA,
      builderVersion: FOOTBALL_OFFICIAL_RESULT_V0_BUILDER,
      dateKst: input.dateKst,
      generatedAt: input.generatedAt,
      resultObservedAt: input.resultObservedAt,
      researchOnly: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      provider: FOOTBALL_OFFICIAL_RESULT_PROVIDER,
      marketSettlement: FOOTBALL_OFFICIAL_RESULT_MARKET_SETTLEMENT,
      sourceScheduleRel: input.sourceScheduleRel,
      sourceScheduleHash: input.sourceScheduleHash,
      scheduleMatches: input.scheduleMatches,
      providerRequestedGames: input.providerRequestedGames,
      finalUsableGames: input.matches.filter((m) => m.gradingAllowed).length,
      notFinalGames: input.matches.filter((m) => !isFinalStatus(m.resultStatus))
        .length,
      blockedGames: input.matches.filter(
        (m) => isFinalStatus(m.resultStatus) && !m.gradingAllowed,
      ).length,
      prediction: "NONE",
      engine: "NONE",
      recommendation: "NONE",
    },
    matches: input.matches
      .slice()
      .sort((a, b) => a.matchId.localeCompare(b.matchId)),
  };
  return {
    ...withoutHash,
    meta: {
      ...withoutHash.meta,
      resultArtifactHash: computeFootballOfficialResultArtifactHash(withoutHash),
    },
  };
}

export async function createDefaultOfficialResultFetcher(): Promise<FootballOfficialResultFixtureFetcher> {
  const kind = resolveFootballProviderKind();
  if (kind === "dummy") {
    throw new Error(
      "DUMMY_PROVIDER_NOT_RESEARCH: DummyFootballProvider cannot produce official results",
    );
  }
  const provider = getFootballProvider();
  return {
    async getFixtureById(fixtureId: number) {
      const r = await provider.getFixtureById(fixtureId);
      return { fixture: r.fixture, cached: r.cached };
    },
  };
}

function failIdentity(resolved: ReturnType<typeof resolveOfficialResultMatch>): never {
  if (resolved.orientation === "REVERSED_SUSPECTED") {
    throw new Error(
      `FOOTBALL_OFFICIAL_RESULT_REVERSED_HOME_AWAY: ${resolved.match.matchId}`,
    );
  }
  throw new Error(
    `FOOTBALL_OFFICIAL_RESULT_IDENTITY_UNRESOLVED: ${resolved.match.matchId} ${resolved.match.reasonCodes.join(",")}`,
  );
}

function failBlockedFinal(match: FootballOfficialResultMatchV0): never {
  if (match.reasonCodes.some((c) => c.startsWith("LEAGUE_UNEXPECTED_"))) {
    throw new Error(
      `FOOTBALL_OFFICIAL_RESULT_LEAGUE_UNEXPECTED_PERIOD: ${match.matchId} ${match.reasonCodes.join(",")}`,
    );
  }
  if (match.reasonCodes.includes("RESULT_CONFLICT") || match.usability === "RESULT_CONFLICT") {
    throw new Error(
      `FOOTBALL_OFFICIAL_RESULT_CONFLICT: ${match.matchId} ${match.reasonCodes.join(",")}`,
    );
  }
  throw new Error(
    `FOOTBALL_OFFICIAL_RESULT_INVALID_SCORE: ${match.matchId} ${match.reasonCodes.join(",")}`,
  );
}

export async function buildFootballOfficialResultV0(input: {
  dateKst: string;
  generatedAt: string;
  resultObservedAt: string;
  dryRun: boolean;
  rootDir?: string;
  fetcher?: FootballOfficialResultFixtureFetcher;
}): Promise<FootballOfficialResultRunV0> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("FOOTBALL_OFFICIAL_RESULT_DATE_KST_INVALID");
  }
  if (!isOddsIsoInstant(input.generatedAt)) {
    throw new Error("FOOTBALL_OFFICIAL_RESULT_GENERATED_AT_INVALID");
  }
  if (!isOddsIsoInstant(input.resultObservedAt)) {
    throw new Error("FOOTBALL_OFFICIAL_RESULT_OBSERVED_AT_INVALID");
  }

  const root = input.rootDir ?? process.cwd();
  const rel = footballOfficialResultV0Rel(input.dateKst);
  const abs = path.join(root, rel);
  if (existsSync(abs)) {
    throw new Error(`FOOTBALL_OFFICIAL_RESULT_ALREADY_EXISTS: ${rel}`);
  }

  const schedule = await loadFootballScheduleArtifactForOfficialResult({
    dateKst: input.dateKst,
    rootDir: root,
  });
  const targets = selectOfficialResultTargetRows(schedule.document.rows);
  if (targets.length === 0) {
    throw new Error("FOOTBALL_OFFICIAL_RESULT_NO_ELIGIBLE_MATCHES");
  }

  const fetcher =
    input.fetcher ?? (await createDefaultOfficialResultFetcher());

  let providerRequestCount = 0;
  let providerCachedCount = 0;
  const resolvedMatches: ReturnType<typeof resolveOfficialResultMatch>[] = [];

  for (const row of targets) {
    const fixtureId = Number(row.providerMatchId);
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
      throw new Error(
        `FOOTBALL_OFFICIAL_RESULT_FIXTURE_ID_INVALID: ${row.providerMatchId}`,
      );
    }
    const fetched = await fetcher.getFixtureById(fixtureId);
    providerRequestCount += 1;
    if (fetched.cached) providerCachedCount += 1;
    if (fetched.fixture == null) {
      throw new Error(
        `FOOTBALL_OFFICIAL_RESULT_PROVIDER_FIXTURE_MISSING: ${row.providerMatchId}`,
      );
    }
    resolvedMatches.push(
      resolveOfficialResultMatch({
        row,
        fixture: fetched.fixture,
        resultObservedAt: input.resultObservedAt,
      }),
    );
  }

  const first = resolvedMatches[0]!;
  const reasonCodes = resolvedMatches.flatMap((r) => r.match.reasonCodes);
  const baseRun = {
    rel,
    providerRequestCount,
    providerCachedCount,
    providerStatusRaw: first.providerStatusRaw,
    resultStatus: first.resultStatus,
    reasonCodes,
    matchSummaries: resolvedMatches.map((r) => r.match),
  };

  for (const resolved of resolvedMatches) {
    if (!resolved.joinOk) failIdentity(resolved);
  }

  const anyWaiting = resolvedMatches.some((r) =>
    isWaitingFinalStatus(r.resultStatus),
  );
  const anyNonFinalTerminal = resolvedMatches.some((r) =>
    isNonFinalTerminalStatus(r.resultStatus),
  );
  const allFinal = resolvedMatches.every((r) => isFinalStatus(r.resultStatus));

  if (!allFinal) {
    return {
      ...baseRun,
      outcome: anyWaiting && !anyNonFinalTerminal ? "WAITING_FINAL" : "RESULT_NOT_FINAL",
      wrote: false,
      document: null,
      terminalFinal: false,
    };
  }

  for (const resolved of resolvedMatches) {
    if (!resolved.match.gradingAllowed) failBlockedFinal(resolved.match);
  }

  const document = assembleArtifact({
    dateKst: input.dateKst,
    generatedAt: input.generatedAt,
    resultObservedAt: input.resultObservedAt,
    sourceScheduleRel: schedule.rel,
    sourceScheduleHash: schedule.document.meta.artifactHash,
    scheduleMatches: schedule.document.rows.length,
    providerRequestedGames: providerRequestCount,
    matches: resolvedMatches.map((r) => r.match),
  });

  let wrote = false;
  if (!input.dryRun) {
    await writeJsonAtomic(abs, document);
    wrote = true;
  }

  return {
    ...baseRun,
    outcome: "SEALED",
    wrote,
    document,
    terminalFinal: true,
  };
}
