/**
 * Football 90-minute 1X2 Research Odds Dataset v1 builder.
 * Schedule artifact → eligible filter → Odds events → join → quotes.
 * Prediction must later consume this artifact. Never Prediction → Provider.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OddsData, OddsUsageMeta } from "@/lib/odds/types";
import type { FootballScheduleArtifactV1 } from "../core/types";
import { footballScheduleV1Rel } from "../core/paths";
import { buildOddsObservationId, computeFootball1x2OddsArtifactHash } from "./hash";
import { joinScheduleRowToOddsEvent } from "./event-join";
import { parseFootballScheduleArtifact } from "./load-schedule";
import {
  isEnoentError,
  parseFootball1x2OddsJsonText,
} from "./load-odds-artifact";
import { assertOddsIsoInstant } from "./instant";
import { football1x2OddsV1Rel } from "./paths";
import { getOddsSportKey } from "./sport-keys";
import {
  FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  assertOddsTeamBridgeIntegrity,
  getOddsTeamNames,
} from "./team-bridge";
import {
  extractEventBookmakerQuotes,
  medianDevigFromQuotes,
  summarizeMarketStatus,
} from "./quotes";
import {
  FOOTBALL_1X2_ODDS_V1_BUILDER,
  FOOTBALL_1X2_ODDS_V1_SCHEMA,
  FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
  FOOTBALL_ODDS_MARKET,
  FOOTBALL_ODDS_SPORT_KEY_MAP_VERSION,
  FOOTBALL_ODDS_TEAM_BRIDGE_VERSION,
  type Football1x2OddsArtifactV1,
  type Football1x2OddsObservationV1,
  type Football1x2OddsSkipCounts,
  type FootballOddsTeamBridgeEntry,
} from "./types";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

function minutesBeforeKickoff(
  observedAt: string,
  kickoffTimeUtc: string | null,
): number | null {
  if (!kickoffTimeUtc) return null;
  const a = Date.parse(observedAt);
  const b = Date.parse(kickoffTimeUtc);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 60_000;
}

export function planOddsFetches(input: {
  schedule: FootballScheduleArtifactV1;
  teamBridge?: FootballOddsTeamBridgeEntry[];
  observedAt?: string;
}): {
  eligible: FootballScheduleArtifactV1["rows"];
  skipped: Football1x2OddsSkipCounts;
  sportKeysToFetch: string[];
  wouldCallProvider: boolean;
} {
  const teamBridge = input.teamBridge ?? FOOTBALL_ODDS_TEAM_BRIDGE_V1;
  const skipped: Football1x2OddsSkipCounts = {
    notSupportedFormat: 0,
    competitionBlocked: 0,
    identityBlocked: 0,
    unknownEligibility: 0,
    sportKeyNotMapped: 0,
    teamBridgeMissing: 0,
    missedPregameWindow: 0,
  };
  const eligible = input.schedule.rows.filter((row) => {
    if (row.predictionEligibility === "ELIGIBLE_FORMAT") return true;
    if (row.predictionEligibility === "NOT_SUPPORTED_FORMAT") {
      skipped.notSupportedFormat += 1;
    } else if (row.predictionEligibility === "COMPETITION_BLOCKED") {
      skipped.competitionBlocked += 1;
    } else if (row.predictionEligibility === "IDENTITY_BLOCKED") {
      skipped.identityBlocked += 1;
    } else {
      skipped.unknownEligibility += 1;
    }
    return false;
  });

  const sportKeys = new Set<string>();
  const observedMs =
    input.observedAt != null ? Date.parse(input.observedAt) : NaN;
  for (const row of eligible) {
    const sport = getOddsSportKey(row.competitionId);
    if (!sport) {
      skipped.sportKeyNotMapped += 1;
      continue;
    }
    const homeNames =
      row.homeTeamId != null
        ? getOddsTeamNames(row.homeTeamId, teamBridge)
        : [];
    const awayNames =
      row.awayTeamId != null
        ? getOddsTeamNames(row.awayTeamId, teamBridge)
        : [];
    if (homeNames.length === 0 || awayNames.length === 0) {
      skipped.teamBridgeMissing += 1;
      continue;
    }
    const kickoffMs = row.kickoffTimeUtc
      ? Date.parse(row.kickoffTimeUtc)
      : NaN;
    if (
      Number.isFinite(observedMs) &&
      Number.isFinite(kickoffMs) &&
      observedMs >= kickoffMs
    ) {
      skipped.missedPregameWindow += 1;
      continue;
    }
    sportKeys.add(sport.sportKey);
  }

  const sportKeysToFetch = [...sportKeys].sort();
  return {
    eligible,
    skipped,
    sportKeysToFetch,
    wouldCallProvider: sportKeysToFetch.length > 0,
  };
}

function emptyObservation(input: {
  row: FootballScheduleArtifactV1["rows"][number];
  observedAt: string;
  sourceScheduleArtifactHash: string;
  joinStatus: Football1x2OddsObservationV1["joinStatus"];
  marketStatus: Football1x2OddsObservationV1["marketStatus"];
  reasonCodes: string[];
  sportKey: string | null;
  pregameUsable: boolean;
}): Football1x2OddsObservationV1 {
  return {
    observationId: buildOddsObservationId(input.row.matchId, input.observedAt),
    matchId: input.row.matchId,
    apiFootballProviderMatchId: input.row.providerMatchId,
    oddsProviderEventId: null,
    oddsProvider: "THE_ODDS_API",
    competitionId: input.row.competitionId,
    homeTeamId: input.row.homeTeamId ?? "",
    awayTeamId: input.row.awayTeamId ?? "",
    sourceScheduleArtifactHash: input.sourceScheduleArtifactHash,
    observedAt: input.observedAt,
    scheduleKickoffTimeUtc: input.row.kickoffTimeUtc ?? "",
    oddsCommenceTimeUtc: null,
    kickoffDeltaMinutes: null,
    minutesBeforeKickoff: minutesBeforeKickoff(
      input.observedAt,
      input.row.kickoffTimeUtc,
    ),
    joinStatus: input.joinStatus,
    marketStatus: input.marketStatus,
    pregameUsable: input.pregameUsable,
    reasonCodes: input.reasonCodes,
    sportKey: input.sportKey,
    oddsHomeTeamName: null,
    oddsAwayTeamName: null,
    bookmakers: [],
    medianDevigHome: null,
    medianDevigDraw: null,
    medianDevigAway: null,
    researchOnly: true,
  };
}

export function assembleFootball1x2OddsArtifact(input: {
  schedule: FootballScheduleArtifactV1;
  observedAt: string;
  generatedAt: string;
  eventsBySportKey: Record<string, OddsData[]>;
  teamBridge?: FootballOddsTeamBridgeEntry[];
  previousObservations?: Football1x2OddsObservationV1[];
  providerCalled: boolean;
  providerSportKeysRequested: string[];
  usage?: OddsUsageMeta | null;
  kickoffToleranceMinutes?: number;
}): Football1x2OddsArtifactV1 {
  const teamBridge = input.teamBridge ?? FOOTBALL_ODDS_TEAM_BRIDGE_V1;
  assertOddsTeamBridgeIntegrity(teamBridge);
  const plan = planOddsFetches({
    schedule: input.schedule,
    teamBridge,
    observedAt: input.observedAt,
  });
  const sourceHash = input.schedule.meta.artifactHash;
  const sourceScheduleRel = footballScheduleV1Rel(input.schedule.meta.dateKst);

  for (const events of Object.values(input.eventsBySportKey)) {
    for (const event of events) {
      if (event.source === "dummy") {
        throw new Error(
          "DUMMY_ODDS_NOT_RESEARCH: dummy OddsProvider events cannot become research evidence",
        );
      }
    }
  }

  const newObservations: Football1x2OddsObservationV1[] = [];
  for (const row of plan.eligible) {
    const sport = getOddsSportKey(row.competitionId);
    const events = sport
      ? (input.eventsBySportKey[sport.sportKey] ?? [])
      : [];
    const joined = joinScheduleRowToOddsEvent({
      row,
      events,
      teamBridge,
      kickoffToleranceMinutes: input.kickoffToleranceMinutes,
    });

    if (joined.status !== "JOINED") {
      let joinStatus: Football1x2OddsObservationV1["joinStatus"] =
        joined.status;
      const reasons = [...joined.reasonCodes];
      if (
        joinStatus === "NOT_JOINED" &&
        !input.providerCalled &&
        sport &&
        plan.sportKeysToFetch.includes(sport.sportKey)
      ) {
        joinStatus = "NOT_COLLECTED";
        reasons.push("PROVIDER_NOT_CALLED");
      }
      if (
        joinStatus === "NOT_JOINED" &&
        !input.providerCalled &&
        !sport
      ) {
        joinStatus = "ODDS_SPORT_KEY_NOT_MAPPED";
      }
      newObservations.push(
        emptyObservation({
          row,
          observedAt: input.observedAt,
          sourceScheduleArtifactHash: sourceHash,
          joinStatus,
          marketStatus: "NOT_COLLECTED",
          reasonCodes: reasons,
          sportKey: sport?.sportKey ?? null,
          pregameUsable: false,
        }),
      );
      continue;
    }

    const event = joined.event;
    if (event.source === "dummy") {
      throw new Error("DUMMY_ODDS_NOT_RESEARCH");
    }
    const quotes = extractEventBookmakerQuotes(event);
    const marketStatus = summarizeMarketStatus(quotes);
    const med = medianDevigFromQuotes(quotes);
    const minutes = minutesBeforeKickoff(
      input.observedAt,
      row.kickoffTimeUtc,
    );
    const kickoffMs = row.kickoffTimeUtc
      ? Date.parse(row.kickoffTimeUtc)
      : NaN;
    const observedMs = Date.parse(input.observedAt);
    const late =
      Number.isFinite(kickoffMs) &&
      Number.isFinite(observedMs) &&
      observedMs >= kickoffMs;
    const reasonCodes = [...joined.reasonCodes];
    if (late) reasonCodes.push("CAPTURED_AFTER_OR_AT_KICKOFF");
    if (marketStatus === "PARTIAL_1X2") reasonCodes.push("PARTIAL_1X2");
    if (marketStatus === "INVALID_MARKET") reasonCodes.push("INVALID_MARKET");
    for (const quote of quotes) {
      for (const code of quote.reasonCodes) {
        if (
          (code === "MISSING_DRAW" ||
            code.startsWith("INVALID_") ||
            code.startsWith("DUPLICATE_")) &&
          !reasonCodes.includes(code)
        ) {
          reasonCodes.push(code);
        }
      }
    }

    const pregameUsable =
      !late &&
      marketStatus === "COMPLETE_1X2" &&
      Number.isFinite(observedMs) &&
      Number.isFinite(kickoffMs) &&
      observedMs < kickoffMs;

    newObservations.push({
      observationId: buildOddsObservationId(row.matchId, input.observedAt),
      matchId: row.matchId,
      apiFootballProviderMatchId: row.providerMatchId,
      oddsProviderEventId: event.externalEventId,
      oddsProvider: "THE_ODDS_API",
      competitionId: row.competitionId,
      homeTeamId: row.homeTeamId ?? "",
      awayTeamId: row.awayTeamId ?? "",
      sourceScheduleArtifactHash: sourceHash,
      observedAt: input.observedAt,
      scheduleKickoffTimeUtc: row.kickoffTimeUtc ?? "",
      oddsCommenceTimeUtc: event.commenceTime,
      kickoffDeltaMinutes: joined.kickoffDeltaMinutes,
      minutesBeforeKickoff: minutes,
      joinStatus: "JOINED",
      marketStatus,
      pregameUsable,
      reasonCodes,
      sportKey: event.sportKey,
      oddsHomeTeamName: event.homeTeam,
      oddsAwayTeamName: event.awayTeam,
      bookmakers: quotes,
      medianDevigHome: med.medianDevigHome,
      medianDevigDraw: med.medianDevigDraw,
      medianDevigAway: med.medianDevigAway,
      researchOnly: true,
    });
  }

  const previous = input.previousObservations ?? [];
  const seen = new Set<string>();
  for (const obs of [...previous, ...newObservations]) {
    if (seen.has(obs.observationId)) {
      throw new Error(`DUPLICATE_ODDS_OBSERVATION: ${obs.observationId}`);
    }
    seen.add(obs.observationId);
  }

  const observations = [...previous, ...newObservations].sort((a, b) =>
    a.observationId.localeCompare(b.observationId),
  );

  let providerEventsFetched = 0;
  for (const key of input.providerSportKeysRequested) {
    providerEventsFetched += input.eventsBySportKey[key]?.length ?? 0;
  }

  const thisRunIds = new Set(newObservations.map((o) => o.observationId));
  const thisRun = observations.filter((o) => thisRunIds.has(o.observationId));

  const withoutHash: Omit<Football1x2OddsArtifactV1, "meta"> & {
    meta: Omit<Football1x2OddsArtifactV1["meta"], "artifactHash">;
  } = {
    meta: {
      schemaVersion: FOOTBALL_1X2_ODDS_V1_SCHEMA,
      builderVersion: FOOTBALL_1X2_ODDS_V1_BUILDER,
      dateKst: input.schedule.meta.dateKst,
      generatedAt: input.generatedAt,
      observedAt: input.observedAt,
      provider: "THE_ODDS_API",
      researchOnly: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      market: FOOTBALL_ODDS_MARKET,
      sourceScheduleRel,
      sourceScheduleArtifactHash: sourceHash,
      teamBridgeVersion: FOOTBALL_ODDS_TEAM_BRIDGE_VERSION,
      sportKeyMapVersion: FOOTBALL_ODDS_SPORT_KEY_MAP_VERSION,
      kickoffToleranceMinutes:
        input.kickoffToleranceMinutes ?? FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
      scheduleEligibleGames: plan.eligible.length,
      providerEventsFetched,
      providerSportKeysRequested: [...input.providerSportKeysRequested].sort(),
      providerCalled: input.providerCalled,
      requestsUsed: input.usage?.requestsUsed ?? null,
      requestsRemaining: input.usage?.requestsRemaining ?? null,
      requestCost: input.usage?.requestsLast ?? null,
      joinedGames: thisRun.filter((o) => o.joinStatus === "JOINED").length,
      notJoinedGames: thisRun.filter(
        (o) =>
          o.joinStatus === "NOT_JOINED" ||
          o.joinStatus === "ODDS_SPORT_KEY_NOT_MAPPED" ||
          o.joinStatus === "ODDS_EVENT_IDENTITY_REVIEW_REQUIRED" ||
          o.joinStatus === "NOT_COLLECTED" ||
          o.joinStatus === "PROVIDER_ERROR",
      ).length,
      ambiguousGames: thisRun.filter(
        (o) => o.joinStatus === "AMBIGUOUS_EVENT_JOIN",
      ).length,
      complete1x2Games: thisRun.filter(
        (o) => o.marketStatus === "COMPLETE_1X2",
      ).length,
      partial1x2Games: thisRun.filter(
        (o) => o.marketStatus === "PARTIAL_1X2",
      ).length,
      pregameUsableGames: thisRun.filter((o) => o.pregameUsable).length,
      lateGames: thisRun.filter((o) =>
        o.reasonCodes.includes("CAPTURED_AFTER_OR_AT_KICKOFF"),
      ).length,
      skipped: plan.skipped,
    },
    observations,
  };

  return {
    ...withoutHash,
    meta: {
      ...withoutHash.meta,
      artifactHash: computeFootball1x2OddsArtifactHash(withoutHash),
    },
  };
}

export async function buildFootball1x2OddsV1(input: {
  dateKst: string;
  observedAt: string;
  generatedAt: string;
  dryRun: boolean;
  fetchOdds?: (sportKey: string) => Promise<{
    events: OddsData[];
    usage: OddsUsageMeta;
  }>;
  teamBridge?: FootballOddsTeamBridgeEntry[];
  rootDir?: string;
}): Promise<{
  document: Football1x2OddsArtifactV1;
  rel: string;
  wrote: boolean;
  wouldCallProvider: boolean;
  providerCalled: boolean;
}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("ODDS_DATE_KST_INVALID");
  }
  assertOddsIsoInstant(input.observedAt, "ODDS_OBSERVED_AT_INVALID");
  assertOddsIsoInstant(input.generatedAt, "ODDS_GENERATED_AT_INVALID");

  const teamBridge = input.teamBridge ?? FOOTBALL_ODDS_TEAM_BRIDGE_V1;
  assertOddsTeamBridgeIntegrity(teamBridge);

  const root = input.rootDir ?? process.cwd();
  const scheduleRel = footballScheduleV1Rel(input.dateKst);
  const schedulePath = path.join(root, scheduleRel);
  let rawText: string;
  try {
    rawText = await readFile(schedulePath, "utf8");
  } catch {
    throw new Error(`SCHEDULE_ARTIFACT_MISSING: ${scheduleRel}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`SCHEDULE_JSON_INVALID: ${scheduleRel}`);
  }
  const schedule = parseFootballScheduleArtifact(parsed);
  if (schedule.meta.dateKst !== input.dateKst) {
    throw new Error(
      `SCHEDULE_DATE_MISMATCH: file=${schedule.meta.dateKst} arg=${input.dateKst}`,
    );
  }

  const oddsRel = football1x2OddsV1Rel(input.dateKst);
  const oddsPath = path.join(root, oddsRel);
  let previousObservations: Football1x2OddsObservationV1[] = [];
  try {
    const existingRaw = await readFile(oddsPath, "utf8");
    const existing = parseFootball1x2OddsJsonText(existingRaw);
    if (
      existing.meta.sourceScheduleArtifactHash !== schedule.meta.artifactHash
    ) {
      throw new Error(
        "SCHEDULE_HASH_CHANGED_VS_EXISTING_ODDS: refuse to mix schedule generations",
      );
    }
    previousObservations = existing.observations;
  } catch (e) {
    if (!isEnoentError(e)) throw e;
  }

  const plan = planOddsFetches({
    schedule,
    teamBridge,
    observedAt: input.observedAt,
  });
  const eventsBySportKey: Record<string, OddsData[]> = {};
  let providerCalled = false;
  let usage: OddsUsageMeta | null = null;
  const requested: string[] = [];

  if (!input.dryRun && plan.wouldCallProvider) {
    if (!input.fetchOdds) {
      throw new Error("ODDS_FETCH_FN_REQUIRED");
    }
    for (const sportKey of plan.sportKeysToFetch) {
      const result = await input.fetchOdds(sportKey);
      eventsBySportKey[sportKey] = result.events;
      usage = result.usage;
      requested.push(sportKey);
      providerCalled = true;
    }
  }

  const document = assembleFootball1x2OddsArtifact({
    schedule,
    observedAt: input.observedAt,
    generatedAt: input.generatedAt,
    eventsBySportKey,
    teamBridge,
    previousObservations,
    providerCalled,
    providerSportKeysRequested: requested,
    usage,
  });

  let wrote = false;
  if (!input.dryRun) {
    await writeJsonAtomic(oddsPath, document);
    wrote = true;
  }

  return {
    document,
    rel: oddsRel,
    wrote,
    wouldCallProvider: plan.wouldCallProvider,
    providerCalled,
  };
}
