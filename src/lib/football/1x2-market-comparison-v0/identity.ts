import type { OddsData, OddsSportInfo } from "@/lib/odds/types";
import { FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES } from "../odds-1x2-v1/types";
import { getOddsSportKey } from "../odds-1x2-v1/sport-keys";
import type { FootballObservedSlateGameV0 } from "../observed-slate-v0/types";
import type {
  FootballOddsSideAlignment,
  FootballScreenshotSideVsProvider,
} from "./types";

export function normalizeTeamLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function labelsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  const left = normalizeTeamLabel(a);
  const right = normalizeTeamLabel(b);
  return left.length > 0 && left === right;
}

export function labelMatchesAny(
  oddsName: string,
  labels: Array<string | null | undefined>,
): boolean {
  return labels.some((label) => labelsEqual(oddsName, label));
}

export function screenshotSideVsProviderHome(
  game: FootballObservedSlateGameV0,
): FootballScreenshotSideVsProvider {
  const leftIsHome =
    labelsEqual(game.candidateLeftTeam, game.providerHomeTeamName) ||
    labelsEqual(game.rawLeftTeam, game.providerHomeTeamName);
  const leftIsAway =
    labelsEqual(game.candidateLeftTeam, game.providerAwayTeamName) ||
    labelsEqual(game.rawLeftTeam, game.providerAwayTeamName);
  if (leftIsHome && !leftIsAway) return "ALIGNED";
  if (leftIsAway && !leftIsHome) return "REVERSED";
  return "UNCLEAR";
}

export function homeLabels(game: FootballObservedSlateGameV0): Array<string | null> {
  return [game.providerHomeTeamName, game.candidateLeftTeam, game.rawLeftTeam];
}

export function awayLabels(game: FootballObservedSlateGameV0): Array<string | null> {
  return [game.providerAwayTeamName, game.candidateRightTeam, game.rawRightTeam];
}

function kickoffDeltaMinutes(kickoffUtc: string, commenceTime: string): number | null {
  const a = Date.parse(kickoffUtc);
  const b = Date.parse(commenceTime);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 60_000;
}

export function eventInKickoffWindow(input: {
  kickoffUtc: string | null;
  commenceTime: string;
  toleranceMinutes?: number;
}): boolean {
  if (!input.kickoffUtc) return false;
  const delta = kickoffDeltaMinutes(input.kickoffUtc, input.commenceTime);
  if (delta == null) return false;
  const tolerance = input.toleranceMinutes ?? FOOTBALL_ODDS_KICKOFF_TOLERANCE_MINUTES;
  return Math.abs(delta) <= tolerance;
}

export type ResearchSportKeyResolution =
  | {
      status: "MAPPED";
      sportKey: string;
      source: string;
    }
  | {
      status: "NOT_MAPPED";
      sportKey: null;
      source: string;
    };

export function resolveResearchSportKey(input: {
  providerCompetitionId: number;
  sports: OddsSportInfo[];
}): ResearchSportKeyResolution {
  if (input.providerCompetitionId === 140) {
    const mapped = getOddsSportKey("fb-comp-api-football-140");
    if (!mapped) {
      return {
        status: "NOT_MAPPED",
        sportKey: null,
        source: "football-odds-sport-key-map-v1 missing La Liga",
      };
    }
    const live = input.sports.find((s) => s.key === mapped.sportKey);
    if (!live) {
      return {
        status: "NOT_MAPPED",
        sportKey: null,
        source: `mapped key ${mapped.sportKey} not present in live /sports`,
      };
    }
    return {
      status: "MAPPED",
      sportKey: live.key,
      source: `football-odds-sport-key-map-v1 exact key ${live.key}`,
    };
  }

  if (input.providerCompetitionId === 253) {
    const hits = input.sports.filter((s) => {
      if (!s.active) return false;
      const hay = `${s.title} ${s.description} ${s.key}`.toLowerCase();
      return (
        hay.includes("major league soccer") ||
        s.title.toLowerCase() === "mls"
      );
    });
    if (hits.length === 1) {
      return {
        status: "MAPPED",
        sportKey: hits[0]!.key,
        source: `the-odds-api:/sports exact key ${hits[0]!.key} (MLS title/description, research overlay only)`,
      };
    }
    if (hits.length === 0) {
      return {
        status: "NOT_MAPPED",
        sportKey: null,
        source: "MLS not present as unique live /sports title match; sport-key-map-v1 unmapped",
      };
    }
    return {
      status: "NOT_MAPPED",
      sportKey: null,
      source: `MLS /sports match ambiguous: ${hits.map((s) => s.key).join(",")}`,
    };
  }

  return {
    status: "NOT_MAPPED",
    sportKey: null,
    source: `no research sport-key policy for competition ${input.providerCompetitionId}`,
  };
}

export type OddsEventJoinAttempt =
  | {
      status: "JOINED";
      event: OddsData;
      sideAlignment: FootballOddsSideAlignment;
      evidence: string[];
    }
  | {
      status: "ODDS_IDENTITY_UNRESOLVED";
      event: null;
      sideAlignment: "UNRESOLVED";
      evidence: string[];
    }
  | {
      status: "NOT_JOINED";
      event: null;
      sideAlignment: "UNRESOLVED";
      evidence: string[];
    };

export function joinFixtureToOddsEvent(input: {
  game: FootballObservedSlateGameV0;
  events: OddsData[];
  sportKey: string;
}): OddsEventJoinAttempt {
  const inWindow = input.events.filter(
    (event) =>
      event.sportKey === input.sportKey &&
      eventInKickoffWindow({
        kickoffUtc: input.game.providerKickoffUtc,
        commenceTime: event.commenceTime,
      }),
  );

  const home = homeLabels(input.game);
  const away = awayLabels(input.game);
  const aligned = inWindow.filter(
    (event) =>
      labelMatchesAny(event.homeTeam, home) &&
      labelMatchesAny(event.awayTeam, away),
  );
  const reversed = inWindow.filter(
    (event) =>
      labelMatchesAny(event.homeTeam, away) &&
      labelMatchesAny(event.awayTeam, home),
  );

  if (aligned.length === 1 && reversed.length === 0) {
    const event = aligned[0]!;
    return {
      status: "JOINED",
      event,
      sideAlignment: "ALIGNED",
      evidence: [
        `sportKey=${input.sportKey}`,
        `oddsProviderEventId=${event.externalEventId}`,
        `oddsHome=${event.homeTeam}`,
        `oddsAway=${event.awayTeam}`,
        `commenceTime=${event.commenceTime}`,
        `kickoffUtc=${input.game.providerKickoffUtc ?? ""}`,
        "name+commence join; prices not flipped",
      ],
    };
  }

  if (reversed.length === 1 && aligned.length === 0) {
    const event = reversed[0]!;
    return {
      status: "JOINED",
      event,
      sideAlignment: "REVERSED",
      evidence: [
        `sportKey=${input.sportKey}`,
        `oddsProviderEventId=${event.externalEventId}`,
        `oddsHome=${event.homeTeam}`,
        `oddsAway=${event.awayTeam}`,
        "SIDE_REVERSED_NOT_FLIPPED",
      ],
    };
  }

  if (aligned.length + reversed.length > 1) {
    const ids = [...aligned, ...reversed].map((e) => e.externalEventId);
    return {
      status: "ODDS_IDENTITY_UNRESOLVED",
      event: null,
      sideAlignment: "UNRESOLVED",
      evidence: [`AMBIGUOUS_EVENT_JOIN:${ids.join(",")}`],
    };
  }

  if (inWindow.length === 1) {
    const event = inWindow[0]!;
    return {
      status: "JOINED",
      event,
      sideAlignment: "ALIGNED",
      evidence: [
        "UNIQUE_KICKOFF_WINDOW_CANDIDATE",
        `sportKey=${input.sportKey}`,
        `oddsProviderEventId=${event.externalEventId}`,
        `oddsHome=${event.homeTeam}`,
        `oddsAway=${event.awayTeam}`,
        `commenceTime=${event.commenceTime}`,
        `kickoffUtc=${input.game.providerKickoffUtc ?? ""}`,
        "exact API-Football/candidate labels unmatched; live Odds names preserved; not added to team-bridge; prices not flipped",
      ],
    };
  }

  if (inWindow.length > 1) {
    return {
      status: "ODDS_IDENTITY_UNRESOLVED",
      event: null,
      sideAlignment: "UNRESOLVED",
      evidence: [
        `WINDOW_CANDIDATES_NAME_UNMATCHED:${inWindow
          .map((e) => `${e.externalEventId}:${e.homeTeam} vs ${e.awayTeam}`)
          .join("|")}`,
      ],
    };
  }

  return {
    status: "NOT_JOINED",
    event: null,
    sideAlignment: "UNRESOLVED",
    evidence: ["ZERO_EVENT_CANDIDATES"],
  };
}
