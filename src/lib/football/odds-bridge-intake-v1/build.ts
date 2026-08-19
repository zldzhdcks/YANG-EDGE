/**
 * Football Odds Bridge Candidate Intake v1 builder.
 * Schedule → classify → listEvents(sportKey) once per key → exact-window candidates.
 * Never getOdds(). Never mutate team-bridge. Never auto-approve.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OddsEventListing, OddsProvider } from "@/lib/odds/types";
import { footballScheduleV1Rel } from "../core/paths";
import type {
  FootballScheduleArtifactV1,
  FootballScheduleRowV1,
} from "../core/types";
import { parseFootballScheduleArtifact } from "../odds-1x2-v1/load-schedule";
import { getOddsSportKey } from "../odds-1x2-v1/sport-keys";
import {
  FOOTBALL_ODDS_TEAM_BRIDGE_V1,
  getOddsTeamNames,
} from "../odds-1x2-v1/team-bridge";
import {
  FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
  type FootballOddsTeamBridgeEntry,
} from "../odds-1x2-v1/types";
import { computeFootballOddsBridgeIntakeArtifactHash } from "./hash";
import { footballOddsBridgeCandidateIntakeV1Rel } from "./paths";
import {
  FOOTBALL_ODDS_BRIDGE_INTAKE_V1_BUILDER,
  FOOTBALL_ODDS_BRIDGE_INTAKE_V1_SCHEMA,
  type FootballOddsBridgeCandidateEvent,
  type FootballOddsBridgeCandidateMapping,
  type FootballOddsBridgeCandidateRow,
  type FootballOddsBridgeCandidateStatus,
  type FootballOddsBridgeIntakeArtifactV1,
  type FootballOddsBridgeIntakeCounts,
  type FootballOddsBridgeTimingClass,
} from "./types";

export type FootballOddsBridgeListEvents = (
  sportKey: string,
) => Promise<{ events: OddsEventListing[] }>;

function minutesBetween(aIso: string, bIso: string): number | null {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 60_000;
}

export function assertLiveOddsBridgeIntakeProvider(provider: OddsProvider): void {
  if (provider.kind === "dummy") {
    throw new Error(
      "DUMMY_ODDS_PROVIDER_NOT_RESEARCH: refuse dummy OddsProvider for bridge candidate intake",
    );
  }
  if (typeof provider.listEvents !== "function") {
    throw new Error("ODDS_PROVIDER_LIST_EVENTS_UNSUPPORTED");
  }
}

function emptyCounts(): FootballOddsBridgeIntakeCounts {
  return {
    noCandidateNeeded: 0,
    canonicalIdentityBlocked: 0,
    notSupported: 0,
    candidateIntakeTarget: 0,
    sportKeyNotMapped: 0,
    sportKeyEndpointFailed: 0,
    noEventCandidate: 0,
    ambiguousEventCandidates: 0,
    orientationConflict: 0,
    pendingReviewSingleSideAnchored: 0,
    pendingReviewSingleEventUnanchored: 0,
  };
}

function tallyStatus(
  counts: FootballOddsBridgeIntakeCounts,
  status: FootballOddsBridgeCandidateStatus,
  intakeTarget: boolean,
): void {
  if (intakeTarget) counts.candidateIntakeTarget += 1;
  switch (status) {
    case "NO_CANDIDATE_NEEDED":
      counts.noCandidateNeeded += 1;
      return;
    case "CANONICAL_IDENTITY_BLOCKED":
      counts.canonicalIdentityBlocked += 1;
      return;
    case "NOT_SUPPORTED_FORMAT":
    case "COMPETITION_BLOCKED":
    case "UNKNOWN_ELIGIBILITY":
      counts.notSupported += 1;
      return;
    case "SPORT_KEY_NOT_MAPPED":
      counts.sportKeyNotMapped += 1;
      return;
    case "SPORT_KEY_ENDPOINT_FAILED":
      counts.sportKeyEndpointFailed += 1;
      return;
    case "NO_EVENT_CANDIDATE":
    case "PROVIDER_NOT_CALLED":
      counts.noEventCandidate += 1;
      return;
    case "AMBIGUOUS_EVENT_CANDIDATES":
      counts.ambiguousEventCandidates += 1;
      return;
    case "ORIENTATION_CONFLICT":
      counts.orientationConflict += 1;
      return;
    case "PENDING_REVIEW_SINGLE_SIDE_ANCHORED":
      counts.pendingReviewSingleSideAnchored += 1;
      return;
    case "PENDING_REVIEW_SINGLE_EVENT_UNANCHORED":
      counts.pendingReviewSingleEventUnanchored += 1;
      return;
  }
}

function sideView(
  row: FootballScheduleRowV1,
  side: "home" | "away",
  teamBridge: FootballOddsTeamBridgeEntry[],
) {
  const canonicalTeamId = side === "home" ? row.homeTeamId : row.awayTeamId;
  return {
    providerTeamId:
      side === "home" ? row.homeProviderTeamId : row.awayProviderTeamId,
    canonicalTeamId,
    scheduleDisplayName: side === "home" ? row.homeTeamName : row.awayTeamName,
    existingBridgeNames: canonicalTeamId
      ? getOddsTeamNames(canonicalTeamId, teamBridge)
      : [],
  };
}

function toCandidateEvent(
  event: OddsEventListing,
  kickoffTimeUtc: string | null,
): FootballOddsBridgeCandidateEvent {
  return {
    externalEventId: event.externalEventId,
    sportKey: event.sportKey,
    homeTeamExact: event.homeTeam,
    awayTeamExact: event.awayTeam,
    commenceTime: event.commenceTime,
    kickoffDeltaMinutes: kickoffTimeUtc
      ? minutesBetween(kickoffTimeUtc, event.commenceTime)
      : null,
  };
}

function timingClass(
  observedAt: string,
  kickoffTimeUtc: string | null,
): FootballOddsBridgeTimingClass {
  if (!kickoffTimeUtc) return "NOT_APPLICABLE";
  const observedMs = Date.parse(observedAt);
  const kickoffMs = Date.parse(kickoffTimeUtc);
  if (!Number.isFinite(observedMs) || !Number.isFinite(kickoffMs)) {
    return "NOT_APPLICABLE";
  }
  return observedMs < kickoffMs
    ? "PREGAME_REVIEW_CANDIDATE"
    : "LATE_IDENTITY_EVIDENCE";
}

export function classifyIntakeEligibility(row: FootballScheduleRowV1): {
  status: FootballOddsBridgeCandidateStatus | null;
  intakeTarget: boolean;
  reasonCodes: string[];
} {
  if (row.predictionEligibility === "NOT_SUPPORTED_FORMAT") {
    return {
      status: "NOT_SUPPORTED_FORMAT",
      intakeTarget: false,
      reasonCodes: ["NOT_SUPPORTED_FORMAT"],
    };
  }
  if (row.predictionEligibility === "COMPETITION_BLOCKED") {
    return {
      status: "COMPETITION_BLOCKED",
      intakeTarget: false,
      reasonCodes: ["COMPETITION_BLOCKED"],
    };
  }
  if (row.predictionEligibility === "UNKNOWN") {
    return {
      status: "UNKNOWN_ELIGIBILITY",
      intakeTarget: false,
      reasonCodes: ["UNKNOWN_ELIGIBILITY"],
    };
  }
  if (!row.homeTeamId || !row.awayTeamId) {
    return {
      status: "CANONICAL_IDENTITY_BLOCKED",
      intakeTarget: false,
      reasonCodes: [
        "CANONICAL_IDENTITY_BLOCKED",
        row.predictionEligibility === "IDENTITY_BLOCKED"
          ? "IDENTITY_BLOCKED"
          : "CANONICAL_TEAM_ID_MISSING",
      ],
    };
  }
  if (row.predictionEligibility !== "ELIGIBLE_FORMAT") {
    return {
      status: "CANONICAL_IDENTITY_BLOCKED",
      intakeTarget: false,
      reasonCodes: ["NOT_ELIGIBLE_FORMAT", row.predictionEligibility],
    };
  }
  return { status: null, intakeTarget: false, reasonCodes: [] };
}

function eventsInWindow(input: {
  sportKey: string;
  kickoffTimeUtc: string | null;
  events: OddsEventListing[];
  toleranceMinutes: number;
}): OddsEventListing[] {
  if (!input.kickoffTimeUtc) return [];
  const hits: OddsEventListing[] = [];
  for (const event of input.events) {
    if (event.sportKey !== input.sportKey) continue;
    const delta = minutesBetween(input.kickoffTimeUtc, event.commenceTime);
    if (delta == null) continue;
    if (Math.abs(delta) > input.toleranceMinutes) continue;
    hits.push(event);
  }
  return hits;
}

function orientationConflict(
  window: OddsEventListing[],
  homeNames: string[],
  awayNames: string[],
): boolean {
  for (const event of window) {
    if (homeNames.includes(event.awayTeam)) return true;
    if (awayNames.includes(event.homeTeam)) return true;
  }
  return false;
}

export function matchBridgeIntakeEvents(input: {
  row: FootballScheduleRowV1;
  sportKey: string;
  events: OddsEventListing[];
  teamBridge: FootballOddsTeamBridgeEntry[];
  eventsFetched: boolean;
  endpointFailed: boolean;
  kickoffToleranceMinutes?: number;
}): {
  status: FootballOddsBridgeCandidateStatus;
  candidateEvents: FootballOddsBridgeCandidateEvent[];
  candidateMappings: FootballOddsBridgeCandidateMapping[];
  reasonCodes: string[];
} {
  const tolerance =
    input.kickoffToleranceMinutes ?? FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES;
  if (input.endpointFailed) {
    return {
      status: "SPORT_KEY_ENDPOINT_FAILED",
      candidateEvents: [],
      candidateMappings: [],
      reasonCodes: [`SPORT_KEY_ENDPOINT_FAILED:${input.sportKey}`],
    };
  }
  if (!input.eventsFetched) {
    return {
      status: "PROVIDER_NOT_CALLED",
      candidateEvents: [],
      candidateMappings: [],
      reasonCodes: ["PROVIDER_NOT_CALLED"],
    };
  }

  const homeId = input.row.homeTeamId!;
  const awayId = input.row.awayTeamId!;
  const homeNames = getOddsTeamNames(homeId, input.teamBridge);
  const awayNames = getOddsTeamNames(awayId, input.teamBridge);
  const window = eventsInWindow({
    sportKey: input.sportKey,
    kickoffTimeUtc: input.row.kickoffTimeUtc,
    events: input.events,
    toleranceMinutes: tolerance,
  });
  const listed = window.map((e) =>
    toCandidateEvent(e, input.row.kickoffTimeUtc),
  );

  if (orientationConflict(window, homeNames, awayNames)) {
    return {
      status: "ORIENTATION_CONFLICT",
      candidateEvents: listed,
      candidateMappings: [],
      reasonCodes: ["ORIENTATION_CONFLICT", "HOME_AWAY_AUTO_REVERSE_FORBIDDEN"],
    };
  }

  const homeMissing = homeNames.length === 0;
  const awayMissing = awayNames.length === 0;

  if (!homeMissing && awayMissing) {
    const anchored = window.filter((e) => homeNames.includes(e.homeTeam));
    if (anchored.length === 1) {
      const event = anchored[0]!;
      return {
        status: "PENDING_REVIEW_SINGLE_SIDE_ANCHORED",
        candidateEvents: [toCandidateEvent(event, input.row.kickoffTimeUtc)],
        candidateMappings: [
          {
            canonicalTeamId: awayId,
            side: "away",
            oddsExactName: event.awayTeam,
            anchorType: "EXISTING_BRIDGE_HOME",
            confidenceClass: "HIGH_CONFIDENCE_REVIEW_CANDIDATE",
          },
        ],
        reasonCodes: [
          "SINGLE_SIDE_ANCHORED",
          "AUTO_APPROVE_FORBIDDEN",
        ],
      };
    }
    if (anchored.length > 1) {
      return {
        status: "AMBIGUOUS_EVENT_CANDIDATES",
        candidateEvents: listed,
        candidateMappings: [],
        reasonCodes: ["AMBIGUOUS_EVENT_CANDIDATES", "NON_ACTIONABLE"],
      };
    }
  }

  if (homeMissing && !awayMissing) {
    const anchored = window.filter((e) => awayNames.includes(e.awayTeam));
    if (anchored.length === 1) {
      const event = anchored[0]!;
      return {
        status: "PENDING_REVIEW_SINGLE_SIDE_ANCHORED",
        candidateEvents: [toCandidateEvent(event, input.row.kickoffTimeUtc)],
        candidateMappings: [
          {
            canonicalTeamId: homeId,
            side: "home",
            oddsExactName: event.homeTeam,
            anchorType: "EXISTING_BRIDGE_AWAY",
            confidenceClass: "HIGH_CONFIDENCE_REVIEW_CANDIDATE",
          },
        ],
        reasonCodes: [
          "SINGLE_SIDE_ANCHORED",
          "AUTO_APPROVE_FORBIDDEN",
        ],
      };
    }
    if (anchored.length > 1) {
      return {
        status: "AMBIGUOUS_EVENT_CANDIDATES",
        candidateEvents: listed,
        candidateMappings: [],
        reasonCodes: ["AMBIGUOUS_EVENT_CANDIDATES", "NON_ACTIONABLE"],
      };
    }
  }

  if (homeMissing && awayMissing) {
    if (window.length === 1) {
      const event = window[0]!;
      return {
        status: "PENDING_REVIEW_SINGLE_EVENT_UNANCHORED",
        candidateEvents: [toCandidateEvent(event, input.row.kickoffTimeUtc)],
        candidateMappings: [
          {
            canonicalTeamId: homeId,
            side: "home",
            oddsExactName: event.homeTeam,
            anchorType: "KICKOFF_SPORT_KEY_ONLY",
            confidenceClass: "MANUAL_REVIEW_REQUIRED",
          },
          {
            canonicalTeamId: awayId,
            side: "away",
            oddsExactName: event.awayTeam,
            anchorType: "KICKOFF_SPORT_KEY_ONLY",
            confidenceClass: "MANUAL_REVIEW_REQUIRED",
          },
        ],
        reasonCodes: [
          "BOTH_SIDES_UNBRIDGED_SINGLE_EVENT",
          "AUTO_APPROVE_FORBIDDEN",
        ],
      };
    }
    if (window.length > 1) {
      return {
        status: "AMBIGUOUS_EVENT_CANDIDATES",
        candidateEvents: listed,
        candidateMappings: [],
        reasonCodes: ["AMBIGUOUS_EVENT_CANDIDATES", "NON_ACTIONABLE"],
      };
    }
  }

  if (window.length === 0) {
    return {
      status: "NO_EVENT_CANDIDATE",
      candidateEvents: [],
      candidateMappings: [],
      reasonCodes: ["NO_EVENT_CANDIDATE"],
    };
  }

  return {
    status: "AMBIGUOUS_EVENT_CANDIDATES",
    candidateEvents: listed,
    candidateMappings: [],
    reasonCodes: ["AMBIGUOUS_EVENT_CANDIDATES", "NON_ACTIONABLE"],
  };
}

export function assembleFootballOddsBridgeCandidateIntake(input: {
  schedule: FootballScheduleArtifactV1;
  observedAt: string;
  generatedAt: string;
  teamBridge?: FootballOddsTeamBridgeEntry[];
  eventsBySportKey: Record<string, OddsEventListing[]>;
  uniqueSportKeysRequested: string[];
  providerCalls: number;
  failedSportKeys?: string[];
  eventsFetched: boolean;
}): FootballOddsBridgeIntakeArtifactV1 {
  const teamBridge = input.teamBridge ?? FOOTBALL_ODDS_TEAM_BRIDGE_V1;
  const failed = new Set(input.failedSportKeys ?? []);
  const counts = emptyCounts();
  const rows: FootballOddsBridgeCandidateRow[] = [];

  for (const row of input.schedule.rows) {
    const sport = getOddsSportKey(row.competitionId);
    const home = sideView(row, "home", teamBridge);
    const away = sideView(row, "away", teamBridge);
    const classified = classifyIntakeEligibility(row);
    const timing = timingClass(input.observedAt, row.kickoffTimeUtc);

    if (classified.status) {
      tallyStatus(counts, classified.status, false);
      rows.push({
        matchId: row.matchId,
        competitionId: row.competitionId,
        sportKey: sport?.sportKey ?? null,
        schedule: {
          providerMatchId: row.providerMatchId,
          kickoffTimeUtc: row.kickoffTimeUtc,
        },
        home,
        away,
        candidateEvents: [],
        candidateStatus: classified.status,
        candidateMappings: [],
        reviewStatus: "NOT_APPLICABLE",
        timingClass: timing,
        pregameUsable: false,
        reasonCodes: classified.reasonCodes,
      });
      continue;
    }

    const bothBridged =
      home.existingBridgeNames.length > 0 &&
      away.existingBridgeNames.length > 0;
    if (bothBridged) {
      tallyStatus(counts, "NO_CANDIDATE_NEEDED", false);
      rows.push({
        matchId: row.matchId,
        competitionId: row.competitionId,
        sportKey: sport?.sportKey ?? null,
        schedule: {
          providerMatchId: row.providerMatchId,
          kickoffTimeUtc: row.kickoffTimeUtc,
        },
        home,
        away,
        candidateEvents: [],
        candidateStatus: "NO_CANDIDATE_NEEDED",
        candidateMappings: [],
        reviewStatus: "NOT_APPLICABLE",
        timingClass: timing,
        pregameUsable: false,
        reasonCodes: ["BRIDGE_COMPLETE"],
      });
      continue;
    }

    if (!sport) {
      tallyStatus(counts, "SPORT_KEY_NOT_MAPPED", true);
      rows.push({
        matchId: row.matchId,
        competitionId: row.competitionId,
        sportKey: null,
        schedule: {
          providerMatchId: row.providerMatchId,
          kickoffTimeUtc: row.kickoffTimeUtc,
        },
        home,
        away,
        candidateEvents: [],
        candidateStatus: "SPORT_KEY_NOT_MAPPED",
        candidateMappings: [],
        reviewStatus: "NOT_APPLICABLE",
        timingClass: timing,
        pregameUsable: false,
        reasonCodes: [`SPORT_KEY_NOT_MAPPED:${row.competitionId}`],
      });
      continue;
    }

    const matched = matchBridgeIntakeEvents({
      row,
      sportKey: sport.sportKey,
      events: input.eventsBySportKey[sport.sportKey] ?? [],
      teamBridge,
      eventsFetched: input.eventsFetched && !failed.has(sport.sportKey),
      endpointFailed: failed.has(sport.sportKey),
    });
    const reviewable =
      matched.status === "PENDING_REVIEW_SINGLE_SIDE_ANCHORED" ||
      matched.status === "PENDING_REVIEW_SINGLE_EVENT_UNANCHORED";
    const late = timing === "LATE_IDENTITY_EVIDENCE";
    const reasonCodes = [...matched.reasonCodes];
    if (late) reasonCodes.push("LATE_IDENTITY_EVIDENCE", "NOT_PREGAME");
    tallyStatus(counts, matched.status, true);
    rows.push({
      matchId: row.matchId,
      competitionId: row.competitionId,
      sportKey: sport.sportKey,
      schedule: {
        providerMatchId: row.providerMatchId,
        kickoffTimeUtc: row.kickoffTimeUtc,
      },
      home,
      away,
      candidateEvents: matched.candidateEvents,
      candidateStatus: matched.status,
      candidateMappings: matched.candidateMappings,
      reviewStatus: reviewable ? "PENDING" : "NOT_APPLICABLE",
      timingClass: timing,
      pregameUsable: reviewable && !late,
      reasonCodes,
    });
  }

  const reviewRequired = rows.filter((r) => r.reviewStatus === "PENDING").length;
  const blockedRows = rows.filter((r) =>
    [
      "CANONICAL_IDENTITY_BLOCKED",
      "SPORT_KEY_NOT_MAPPED",
      "SPORT_KEY_ENDPOINT_FAILED",
      "AMBIGUOUS_EVENT_CANDIDATES",
      "ORIENTATION_CONFLICT",
    ].includes(r.candidateStatus),
  ).length;
  const eventsObserved = Object.values(input.eventsBySportKey).reduce(
    (n, list) => n + list.length,
    0,
  );

  const withoutHash = {
    meta: {
      schemaVersion: FOOTBALL_ODDS_BRIDGE_INTAKE_V1_SCHEMA,
      builderVersion: FOOTBALL_ODDS_BRIDGE_INTAKE_V1_BUILDER,
      dateKst: input.schedule.meta.dateKst,
      generatedAt: input.generatedAt,
      observedAt: input.observedAt,
      researchOnly: true as const,
      legalStatus: "NEEDS_LEGAL_REVIEW" as const,
      predictionInput: false as const,
      engineAdmission: "PROHIBITED" as const,
      engineConnected: false as const,
      sourceScheduleRel: footballScheduleV1Rel(input.schedule.meta.dateKst),
      sourceScheduleArtifactHash: input.schedule.meta.artifactHash,
      oddsProvider: "THE_ODDS_API" as const,
      providerMethod: "listEvents" as const,
      providerCalls: input.providerCalls,
      uniqueSportKeysRequested: [...input.uniqueSportKeysRequested].sort(),
      eventsObserved,
      candidateRows: reviewRequired,
      reviewRequired,
      blockedRows,
      kickoffToleranceMinutes: FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES,
      counts,
    },
    rows,
  };
  return {
    ...withoutHash,
    meta: {
      ...withoutHash.meta,
      artifactHash: computeFootballOddsBridgeIntakeArtifactHash(withoutHash),
    },
  };
}

export function sportKeysForIntakeTargets(input: {
  schedule: FootballScheduleArtifactV1;
  teamBridge?: FootballOddsTeamBridgeEntry[];
}): string[] {
  const teamBridge = input.teamBridge ?? FOOTBALL_ODDS_TEAM_BRIDGE_V1;
  const keys = new Set<string>();
  for (const row of input.schedule.rows) {
    const classified = classifyIntakeEligibility(row);
    if (classified.status) continue;
    const homeNames = row.homeTeamId
      ? getOddsTeamNames(row.homeTeamId, teamBridge)
      : [];
    const awayNames = row.awayTeamId
      ? getOddsTeamNames(row.awayTeamId, teamBridge)
      : [];
    if (homeNames.length > 0 && awayNames.length > 0) continue;
    const sport = getOddsSportKey(row.competitionId);
    if (!sport) continue;
    keys.add(sport.sportKey);
  }
  return [...keys].sort();
}

export async function buildFootballOddsBridgeCandidateIntakeV1(input: {
  dateKst: string;
  observedAt: string;
  generatedAt: string;
  cwd?: string;
  dryRun?: boolean;
  teamBridge?: FootballOddsTeamBridgeEntry[];
  listEvents?: FootballOddsBridgeListEvents;
  eventsBySportKey?: Record<string, OddsEventListing[]>;
  writeArtifact?: boolean;
}): Promise<{
  document: FootballOddsBridgeIntakeArtifactV1;
  rel: string;
  wrote: boolean;
  wouldCallProvider: boolean;
  providerCalled: boolean;
}> {
  const cwd = input.cwd ?? process.cwd();
  const rel = footballOddsBridgeCandidateIntakeV1Rel(input.dateKst);
  const scheduleRel = footballScheduleV1Rel(input.dateKst);
  const scheduleAbs = path.join(cwd, scheduleRel);
  let raw: string;
  try {
    raw = await readFile(scheduleAbs, "utf8");
  } catch {
    throw new Error(`SCHEDULE_ARTIFACT_MISSING:${scheduleRel}`);
  }
  const schedule = parseFootballScheduleArtifact(JSON.parse(raw));
  const teamBridge = input.teamBridge ?? FOOTBALL_ODDS_TEAM_BRIDGE_V1;
  const uniqueSportKeys = sportKeysForIntakeTargets({ schedule, teamBridge });
  const wouldCallProvider = uniqueSportKeys.length > 0 && !input.dryRun;

  const eventsBySportKey: Record<string, OddsEventListing[]> = {
    ...(input.eventsBySportKey ?? {}),
  };
  const failedSportKeys: string[] = [];
  let providerCalls = 0;
  let eventsFetched = Boolean(input.eventsBySportKey);

  if (input.eventsBySportKey == null && wouldCallProvider) {
    if (!input.listEvents) {
      throw new Error("ODDS_BRIDGE_INTAKE_LIST_EVENTS_REQUIRED");
    }
    eventsFetched = true;
    for (const sportKey of uniqueSportKeys) {
      try {
        const got = await input.listEvents(sportKey);
        providerCalls += 1;
        eventsBySportKey[sportKey] = got.events;
      } catch (err) {
        providerCalls += 1;
        failedSportKeys.push(sportKey);
        eventsBySportKey[sportKey] = [];
        void err;
      }
    }
  }

  const document = assembleFootballOddsBridgeCandidateIntake({
    schedule,
    observedAt: input.observedAt,
    generatedAt: input.generatedAt,
    teamBridge,
    eventsBySportKey,
    uniqueSportKeysRequested: uniqueSportKeys,
    providerCalls,
    failedSportKeys,
    eventsFetched: eventsFetched && !input.dryRun,
  });

  const shouldWrite = input.writeArtifact === true && !input.dryRun;
  if (shouldWrite) {
    const abs = path.join(cwd, rel);
    const tmp = `${abs}.tmp`;
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(tmp, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    await rename(tmp, abs);
  }

  return {
    document,
    rel,
    wrote: shouldWrite,
    wouldCallProvider,
    providerCalled: providerCalls > 0,
  };
}
