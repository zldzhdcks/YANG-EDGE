import type { OddsData } from "@/lib/odds/types";
import { FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES } from "./types";
import type { FootballOddsTeamBridgeEntry } from "./types";
import { getOddsSportKey } from "./sport-keys";
import { getOddsTeamNames, oddsNameMatchesCanonical } from "./team-bridge";
import type { FootballScheduleRowV1 } from "../core/types";

export type OddsEventJoinResult =
  | {
      status: "JOINED";
      event: OddsData;
      kickoffDeltaMinutes: number;
      reasonCodes: string[];
    }
  | {
      status: "NOT_JOINED";
      event: null;
      kickoffDeltaMinutes: null;
      reasonCodes: string[];
    }
  | {
      status: "AMBIGUOUS_EVENT_JOIN";
      event: null;
      kickoffDeltaMinutes: null;
      reasonCodes: string[];
      candidateEventIds: string[];
    }
  | {
      status: "ODDS_EVENT_IDENTITY_REVIEW_REQUIRED";
      event: null;
      kickoffDeltaMinutes: null;
      reasonCodes: string[];
    }
  | {
      status: "ODDS_SPORT_KEY_NOT_MAPPED";
      event: null;
      kickoffDeltaMinutes: null;
      reasonCodes: string[];
    };

function minutesBetween(aIso: string, bIso: string): number | null {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 60_000;
}

export function joinScheduleRowToOddsEvent(input: {
  row: FootballScheduleRowV1;
  events: OddsData[];
  teamBridge: FootballOddsTeamBridgeEntry[];
  kickoffToleranceMinutes?: number;
}): OddsEventJoinResult {
  const tolerance =
    input.kickoffToleranceMinutes ?? FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES;
  const sport = getOddsSportKey(input.row.competitionId);
  if (!sport) {
    return {
      status: "ODDS_SPORT_KEY_NOT_MAPPED",
      event: null,
      kickoffDeltaMinutes: null,
      reasonCodes: [
        `ODDS_SPORT_KEY_NOT_MAPPED:${input.row.competitionId}`,
      ],
    };
  }

  const homeId = input.row.homeTeamId;
  const awayId = input.row.awayTeamId;
  if (!homeId || !awayId) {
    return {
      status: "ODDS_EVENT_IDENTITY_REVIEW_REQUIRED",
      event: null,
      kickoffDeltaMinutes: null,
      reasonCodes: ["CANONICAL_TEAM_ID_MISSING"],
    };
  }

  const homeNames = getOddsTeamNames(homeId, input.teamBridge);
  const awayNames = getOddsTeamNames(awayId, input.teamBridge);
  if (homeNames.length === 0 || awayNames.length === 0) {
    const missing: string[] = [];
    if (homeNames.length === 0) missing.push(homeId);
    if (awayNames.length === 0) missing.push(awayId);
    return {
      status: "ODDS_EVENT_IDENTITY_REVIEW_REQUIRED",
      event: null,
      kickoffDeltaMinutes: null,
      reasonCodes: missing.map((id) => `ODDS_TEAM_UNMAPPED:${id}`),
    };
  }

  const kickoff = input.row.kickoffTimeUtc;
  if (!kickoff) {
    return {
      status: "NOT_JOINED",
      event: null,
      kickoffDeltaMinutes: null,
      reasonCodes: ["SCHEDULE_KICKOFF_MISSING"],
    };
  }

  const candidates: { event: OddsData; delta: number }[] = [];
  for (const event of input.events) {
    if (event.sportKey !== sport.sportKey) continue;
    const homeOk = oddsNameMatchesCanonical(
      event.homeTeam,
      homeId,
      input.teamBridge,
    );
    const awayOk = oddsNameMatchesCanonical(
      event.awayTeam,
      awayId,
      input.teamBridge,
    );
    if (!homeOk || !awayOk) continue;
    const delta = minutesBetween(kickoff, event.commenceTime);
    if (delta == null) continue;
    if (Math.abs(delta) > tolerance) continue;
    candidates.push({ event, delta });
  }

  if (candidates.length === 0) {
    return {
      status: "NOT_JOINED",
      event: null,
      kickoffDeltaMinutes: null,
      reasonCodes: ["ZERO_EVENT_CANDIDATES"],
    };
  }
  if (candidates.length > 1) {
    return {
      status: "AMBIGUOUS_EVENT_JOIN",
      event: null,
      kickoffDeltaMinutes: null,
      reasonCodes: ["AMBIGUOUS_EVENT_JOIN"],
      candidateEventIds: candidates.map((c) => c.event.externalEventId),
    };
  }

  const hit = candidates[0]!;
  return {
    status: "JOINED",
    event: hit.event,
    kickoffDeltaMinutes: hit.delta,
    reasonCodes: [],
  };
}
