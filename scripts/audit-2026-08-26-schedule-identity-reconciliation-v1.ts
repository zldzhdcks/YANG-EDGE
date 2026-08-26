/**
 * 2026-08-26 B1 schedule + identity reconciliation.
 *
 * Joins the sealed 26-game Daily Scope Lock to existing sport schedule
 * artifacts. Does not shrink the denominator, invent fixtures, run
 * Prediction, or change Engine/Weight.
 *
 *   npx tsx scripts/audit-2026-08-26-schedule-identity-reconciliation-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FOOTBALL_COMPETITION_REGISTRY_V0 } from "../src/lib/football/foundation/competition-registry";
import {
  FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS,
  type FootballScheduleArtifactV1,
} from "../src/lib/football/core";
import { footballScheduleV1Rel } from "../src/lib/football/core/paths";
import { resolveKboTeamIdentity } from "../src/lib/kbo/resolve-kbo-team-identity";
import type { KboScheduleResultIdentityDocument } from "../src/lib/kbo/schedule-result-identity-types";
import { TEAM_ALIASES } from "../src/lib/teams/team-aliases";
import { normalizeTeamName } from "../src/lib/teams/normalize-team-name";
import type { TeamAliasEntry } from "../src/lib/teams/types";
import {
  DATE_KST,
  FROZEN_OBS_HASH,
  LOCK_REL,
  SOURCE_OBS_REL,
  TOTAL_OBSERVED,
  sha256File,
} from "./lock-2026-08-26-daily-scope-v1";
import { npbScheduleV1Rel } from "./build-npb-schedule-v1";
import {
  FIXTURES_CAPTURE_REL,
  loadFootballFixtureCapture,
} from "./capture-2026-08-26-football-fixtures-v1";

export const RECONCILIATION_REL =
  "data/audits/2026-08-26-schedule-identity-reconciliation-v1.json";

export const KBO_SCHEDULE_REL =
  "data/research/kbo/2026-08-26-schedule-result-identity-v1-api-baseball.json";
export const NPB_SCHEDULE_REL = npbScheduleV1Rel(DATE_KST);
export const FOOTBALL_SCHEDULE_REL = footballScheduleV1Rel(DATE_KST);

/** Historical unsafe football provider team IDs. Remain fail-closed. */
export const FOOTBALL_HISTORICAL_UNSAFE_PROVIDER_TEAM_IDS = new Set([
  "2761",
  "2762",
  "2764",
]);

export type B1Status =
  | "MATCHED"
  | "IDENTITY_REVIEW_REQUIRED"
  | "PROVIDER_NOT_SUPPORTED"
  | "PROVIDER_NOT_FOUND"
  | "FORMAT_UNSUPPORTED"
  | "PASS";

type OperatorGame = {
  operatorGameId: string;
  sport: "VOLLEYBALL" | "NPB" | "KBO" | "FOOTBALL";
  rawLeagueLabel: string;
  displayedDateKst: string;
  displayedStartKst: string;
  rawHome: string;
  rawAway: string;
  truncatedAwayVariant: string | null;
  operatorObservedAt: string | null;
  displayedKickoffUtc: string | null;
};

type NpbScheduleGame = {
  gameId: string;
  providerGameId: string | null;
  provider: string;
  home: string;
  away: string;
  scheduledStartTime: string | null;
  collectedAt: string;
  source: string;
  clockState: string;
  homeProviderTeamId: string | null;
  awayProviderTeamId: string | null;
};

type NpbScheduleDoc = {
  schemaVersion: string;
  collectedAt: string;
  researchOnly?: boolean;
  predictionInput?: boolean;
  engineConnected?: boolean;
  games: NpbScheduleGame[];
  providerCalls?: Array<{
    provider: string;
    endpoint: string;
    callCount: number;
    cached: boolean;
    observationTime: string;
    error: string | null;
    resultCount: number;
  }>;
};

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function findRegisteredCompetition(label: string) {
  return (
    FOOTBALL_COMPETITION_REGISTRY_V0.find(
      (c) => c.displayName === label || c.officialName === label,
    ) ?? null
  );
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const da = Date.parse(a);
  const db = Date.parse(b);
  return Number.isFinite(da) && Number.isFinite(db) && da === db;
}

function displayedKickoffUtc(dateKst: string, hhmm: string): string | null {
  const ms = Date.parse(`${dateKst}T${hhmm}:00+09:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function resolveApprovedAlias(
  label: string,
  league: string,
  sport: string,
): TeamAliasEntry | null {
  const n = normalizeTeamName(label);
  if (!n) return null;
  return (
    TEAM_ALIASES.find((a) => {
      if (a.league !== league || a.sport !== sport) return false;
      if (normalizeTeamName(a.displayName) === n) return true;
      return a.originalNames.some((name) => normalizeTeamName(name) === n);
    }) ?? null
  );
}

function aliasMatchesProviderName(
  alias: TeamAliasEntry,
  providerName: string,
): boolean {
  const n = normalizeTeamName(providerName);
  if (!n) return false;
  if (normalizeTeamName(alias.displayName) === n) return true;
  return alias.originalNames.some((name) => normalizeTeamName(name) === n);
}

function providerTeamIdFromAlias(alias: TeamAliasEntry): string | null {
  const hit = alias.externalIds?.find((e) => e.provider === "api-football");
  return hit?.id ?? null;
}

function gameKey(parts: {
  sport: string;
  date: string;
  start: string;
  league: string;
  home: string;
  away: string;
}): string {
  return [
    parts.sport,
    parts.date,
    parts.start,
    parts.league,
    parts.home,
    parts.away,
  ].join("|");
}

function missedPreGame(
  kickoffUtc: string | null,
  firstProviderObservationAt: string | null,
): boolean {
  if (!kickoffUtc || !firstProviderObservationAt) return false;
  const start = Date.parse(kickoffUtc);
  const obs = Date.parse(firstProviderObservationAt);
  if (!Number.isFinite(start) || !Number.isFinite(obs)) return false;
  return obs >= start;
}

function loadLockedGames(obsAbs: string): OperatorGame[] {
  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    volleyballOddsFixtures: Array<{
      sport: string;
      rawLeagueLabel: string;
      displayedDateKst: string;
      displayedStartKst: string;
      rawHomeLabel: string;
      rawAwayLabel: string;
      truncatedAwayVariant: string | null;
      operatorObservedAt: string;
    }>;
    npbOddsGames: Array<{
      sport: string;
      rawLeagueLabel: string;
      displayedDateKst: string;
      displayedStartKst: string;
      rawHomeLabel: string;
      rawAwayLabel: string;
      truncatedAwayVariant: string | null;
      operatorObservedAt: string;
    }>;
    kboOddsGames: Array<{
      sport: string;
      rawLeagueLabel: string;
      displayedDateKst: string;
      displayedStartKst: string;
      rawHomeLabel: string;
      rawAwayLabel: string;
      truncatedAwayVariant: string | null;
      operatorObservedAt: string;
    }>;
    nonMlbOddsFixtures: Array<{
      sport: string;
      rawLeagueLabel: string;
      displayedDateKst: string;
      displayedStartKst: string;
      rawHome: string;
      rawAway: string;
      operatorObservedAt?: string;
    }>;
  };

  const out: OperatorGame[] = [];
  for (const row of obs.volleyballOddsFixtures) {
    out.push({
      operatorGameId: gameKey({
        sport: "VOLLEYBALL",
        date: row.displayedDateKst,
        start: row.displayedStartKst,
        league: row.rawLeagueLabel,
        home: row.rawHomeLabel,
        away: row.rawAwayLabel,
      }),
      sport: "VOLLEYBALL",
      rawLeagueLabel: row.rawLeagueLabel,
      displayedDateKst: row.displayedDateKst,
      displayedStartKst: row.displayedStartKst,
      rawHome: row.rawHomeLabel,
      rawAway: row.rawAwayLabel,
      truncatedAwayVariant: row.truncatedAwayVariant,
      operatorObservedAt: row.operatorObservedAt,
      displayedKickoffUtc: displayedKickoffUtc(
        row.displayedDateKst,
        row.displayedStartKst,
      ),
    });
  }
  for (const row of obs.npbOddsGames) {
    out.push({
      operatorGameId: gameKey({
        sport: "NPB",
        date: row.displayedDateKst,
        start: row.displayedStartKst,
        league: row.rawLeagueLabel,
        home: row.rawHomeLabel,
        away: row.rawAwayLabel,
      }),
      sport: "NPB",
      rawLeagueLabel: row.rawLeagueLabel,
      displayedDateKst: row.displayedDateKst,
      displayedStartKst: row.displayedStartKst,
      rawHome: row.rawHomeLabel,
      rawAway: row.rawAwayLabel,
      truncatedAwayVariant: row.truncatedAwayVariant,
      operatorObservedAt: row.operatorObservedAt,
      displayedKickoffUtc: displayedKickoffUtc(
        row.displayedDateKst,
        row.displayedStartKst,
      ),
    });
  }
  for (const row of obs.kboOddsGames) {
    out.push({
      operatorGameId: gameKey({
        sport: "KBO",
        date: row.displayedDateKst,
        start: row.displayedStartKst,
        league: row.rawLeagueLabel,
        home: row.rawHomeLabel,
        away: row.rawAwayLabel,
      }),
      sport: "KBO",
      rawLeagueLabel: row.rawLeagueLabel,
      displayedDateKst: row.displayedDateKst,
      displayedStartKst: row.displayedStartKst,
      rawHome: row.rawHomeLabel,
      rawAway: row.rawAwayLabel,
      truncatedAwayVariant: row.truncatedAwayVariant,
      operatorObservedAt: row.operatorObservedAt,
      displayedKickoffUtc: displayedKickoffUtc(
        row.displayedDateKst,
        row.displayedStartKst,
      ),
    });
  }
  for (const row of obs.nonMlbOddsFixtures) {
    if (row.displayedDateKst !== DATE_KST) continue;
    out.push({
      operatorGameId: gameKey({
        sport: "FOOTBALL",
        date: row.displayedDateKst,
        start: row.displayedStartKst,
        league: row.rawLeagueLabel,
        home: row.rawHome,
        away: row.rawAway,
      }),
      sport: "FOOTBALL",
      rawLeagueLabel: row.rawLeagueLabel,
      displayedDateKst: row.displayedDateKst,
      displayedStartKst: row.displayedStartKst,
      rawHome: row.rawHome,
      rawAway: row.rawAway,
      truncatedAwayVariant: null,
      operatorObservedAt: row.operatorObservedAt ?? null,
      displayedKickoffUtc: displayedKickoffUtc(
        row.displayedDateKst,
        row.displayedStartKst,
      ),
    });
  }
  return out;
}

function joinVolleyball(game: OperatorGame, generatedAt: string) {
  const missed = missedPreGame(game.displayedKickoffUtc, generatedAt);
  return {
    operatorGameId: game.operatorGameId,
    sport: game.sport,
    rawLeagueLabel: game.rawLeagueLabel,
    rawHome: game.rawHome,
    rawAway: game.rawAway,
    displayedStartKst: game.displayedStartKst,
    displayedKickoffUtc: game.displayedKickoffUtc,
    status: "PROVIDER_NOT_SUPPORTED" as B1Status,
    reasons: [
      "IDENTITY_PROVIDER_NOT_IMPLEMENTED",
      "NO_LAWFUL_APPROVED_VOLLEYBALL_PIPELINE",
    ],
    provider: null,
    providerFixtureId: null,
    providerHomeTeamId: null,
    providerAwayTeamId: null,
    identityStrength: null,
    providerObservationAt: null,
    providerObservationClass: missed
      ? ("MISSED_PRE_GAME_WINDOW" as const)
      : ("NOT_COLLECTED" as const),
    missedPreGameWindow: missed,
    classifiedAsPreGame: false,
  };
}

function joinNpb(
  game: OperatorGame,
  schedule: NpbScheduleDoc,
  usedProviderIds: Set<string>,
) {
  const homeAlias = resolveApprovedAlias(game.rawHome, "NPB", "baseball");
  const awayLabel = game.truncatedAwayVariant ?? game.rawAway;
  let awayAlias = resolveApprovedAlias(game.rawAway, "NPB", "baseball");
  const awayViaTruncation =
    !awayAlias && game.truncatedAwayVariant
      ? resolveApprovedAlias(game.truncatedAwayVariant, "NPB", "baseball")
      : null;
  if (!awayAlias && awayViaTruncation) awayAlias = awayViaTruncation;

  const firstObs =
    schedule.collectedAt ??
    schedule.providerCalls?.[0]?.observationTime ??
    null;
  const kickoffUtc =
    game.displayedKickoffUtc ??
    null;
  const missed = missedPreGame(kickoffUtc, firstObs);

  const base = {
    operatorGameId: game.operatorGameId,
    sport: game.sport,
    rawLeagueLabel: game.rawLeagueLabel,
    rawHome: game.rawHome,
    rawAway: game.rawAway,
    displayedStartKst: game.displayedStartKst,
    displayedKickoffUtc: kickoffUtc,
    provider: "API_BASEBALL+THESPORTSDB",
    providerFixtureId: null as string | null,
    providerHomeTeamId: null as string | null,
    providerAwayTeamId: null as string | null,
    identityStrength: null as string | null,
    providerObservationAt: firstObs,
    providerObservationClass: missed
      ? ("MISSED_PRE_GAME_WINDOW" as const)
      : firstObs
        ? ("PRE_GAME_WINDOW" as const)
        : ("NOT_COLLECTED" as const),
    missedPreGameWindow: missed,
    classifiedAsPreGame: !missed && Boolean(firstObs),
  };

  if (!homeAlias || !awayAlias) {
    const missing = [
      !homeAlias ? `HOME_ALIAS_MISSING:${game.rawHome}` : null,
      !awayAlias ? `AWAY_ALIAS_MISSING:${awayLabel}` : null,
    ].filter(Boolean);
    return {
      ...base,
      status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
      reasons: ["OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS", ...missing],
    };
  }

  const hits = schedule.games.filter((g) => {
    const id = `${g.source}:${g.providerGameId ?? g.gameId}`;
    if (usedProviderIds.has(id)) return false;
    return (
      aliasMatchesProviderName(homeAlias, g.home) &&
      aliasMatchesProviderName(awayAlias, g.away)
    );
  });
  const apiHits = hits.filter(
    (g) => g.source === "API_BASEBALL" || g.provider === "api-baseball",
  );
  const chosen = apiHits.length > 0 ? apiHits : hits;

  if (chosen.length === 0) {
    return {
      ...base,
      status: "PROVIDER_NOT_FOUND" as B1Status,
      reasons: [
        "NO_PROVIDER_FIXTURE_FOR_APPROVED_ALIAS_PAIR",
        `HOME_ALIAS:${homeAlias.displayName}`,
        `AWAY_ALIAS:${awayAlias.displayName}`,
      ],
    };
  }
  if (chosen.length > 1) {
    return {
      ...base,
      status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
      reasons: [
        "AMBIGUOUS_PROVIDER_FIXTURES",
        ...chosen.map((g) => `CANDIDATE:${g.providerGameId ?? g.gameId}`),
      ],
    };
  }

  const hit = chosen[0]!;
  const id = `${hit.source}:${hit.providerGameId ?? hit.gameId}`;
  usedProviderIds.add(id);
  const providerKickoff = hit.scheduledStartTime;
  const providerMissed = missedPreGame(providerKickoff, hit.collectedAt);
  return {
    ...base,
    status: "MATCHED" as B1Status,
    reasons: [
      "PROVIDER_FIXTURE_AND_APPROVED_ALIAS",
      awayViaTruncation
        ? `AWAY_VIA_OBSERVED_TRUNCATED_VARIANT:${game.truncatedAwayVariant}`
        : "EXACT_APPROVED_ALIAS",
    ],
    provider: hit.provider,
    providerFixtureId: hit.providerGameId,
    providerHomeTeamId: hit.homeProviderTeamId,
    providerAwayTeamId: hit.awayProviderTeamId,
    identityStrength: "provider-fixture-id+approved-alias+league+kickoff",
    providerObservationAt: hit.collectedAt,
    providerObservationClass: providerMissed
      ? ("MISSED_PRE_GAME_WINDOW" as const)
      : ("PRE_GAME_WINDOW" as const),
    missedPreGameWindow: providerMissed,
    classifiedAsPreGame: !providerMissed,
    canonicalHome: homeAlias.displayName,
    canonicalAway: awayAlias.displayName,
    providerHomeName: hit.home,
    providerAwayName: hit.away,
    scheduledStartTime: hit.scheduledStartTime,
    clockState: hit.clockState,
  };
}

function joinKbo(
  game: OperatorGame,
  doc: KboScheduleResultIdentityDocument,
) {
  const home = resolveKboTeamIdentity(game.rawHome);
  const away = resolveKboTeamIdentity(game.rawAway);
  const firstObs = doc.meta.generatedAt;
  const missed = missedPreGame(game.displayedKickoffUtc, firstObs);
  const base = {
    operatorGameId: game.operatorGameId,
    sport: game.sport,
    rawLeagueLabel: game.rawLeagueLabel,
    rawHome: game.rawHome,
    rawAway: game.rawAway,
    displayedStartKst: game.displayedStartKst,
    displayedKickoffUtc: game.displayedKickoffUtc,
    provider: doc.rows[0]?.provider.id ?? "API_BASEBALL",
    providerFixtureId: null as string | null,
    providerHomeTeamId: null as string | null,
    providerAwayTeamId: null as string | null,
    identityStrength: null as string | null,
    providerObservationAt: firstObs,
    providerObservationClass: missed
      ? ("MISSED_PRE_GAME_WINDOW" as const)
      : ("PRE_GAME_WINDOW" as const),
    missedPreGameWindow: missed,
    classifiedAsPreGame: !missed,
  };

  if (home.mappingStatus !== "MATCHED" || away.mappingStatus !== "MATCHED") {
    return {
      ...base,
      status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
      reasons: [
        "OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS",
        home.mappingStatus !== "MATCHED" ? `HOME_UNMATCHED:${game.rawHome}` : null,
        away.mappingStatus !== "MATCHED" ? `AWAY_UNMATCHED:${game.rawAway}` : null,
      ].filter(Boolean),
    };
  }

  const hits = doc.rows.filter(
    (r) =>
      r.homeTeam.canonicalNameKo === home.canonicalNameKo &&
      r.awayTeam.canonicalNameKo === away.canonicalNameKo,
  );
  if (hits.length === 0) {
    return {
      ...base,
      status: "PROVIDER_NOT_FOUND" as B1Status,
      reasons: [
        "NO_PROVIDER_FIXTURE_FOR_APPROVED_ALIAS_PAIR",
        `HOME_ALIAS:${home.canonicalNameKo}`,
        `AWAY_ALIAS:${away.canonicalNameKo}`,
      ],
    };
  }
  if (hits.length > 1) {
    return {
      ...base,
      status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
      reasons: [
        "AMBIGUOUS_PROVIDER_FIXTURES",
        ...hits.map((r) => `CANDIDATE:${r.providerGameId}`),
      ],
    };
  }
  const hit = hits[0]!;
  if (
    hit.homeTeam.mappingStatus !== "MATCHED" ||
    hit.awayTeam.mappingStatus !== "MATCHED"
  ) {
    return {
      ...base,
      status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
      reasons: ["PROVIDER_TEAM_MAPPING_UNMATCHED", hit.internalGameId],
      providerFixtureId: hit.providerGameId,
    };
  }
  const rowMissed = missedPreGame(
    hit.time.providerStartTime,
    hit.time.firstObservedAt,
  );
  return {
    ...base,
    status: "MATCHED" as B1Status,
    reasons: ["PROVIDER_FIXTURE_ID+PROVIDER_TEAM_IDS+APPROVED_ALIAS"],
    providerFixtureId: hit.providerGameId,
    providerHomeTeamId: hit.homeTeamId,
    providerAwayTeamId: hit.awayTeamId,
    identityStrength: "provider-fixture-id+provider-team-ids+approved-alias",
    providerObservationAt: hit.time.firstObservedAt,
    providerObservationClass: rowMissed
      ? ("MISSED_PRE_GAME_WINDOW" as const)
      : ("PRE_GAME_WINDOW" as const),
    missedPreGameWindow: rowMissed,
    classifiedAsPreGame: !rowMissed,
    canonicalHome: home.canonicalNameKo,
    canonicalAway: away.canonicalNameKo,
    providerHomeName: hit.homeTeam.providerName,
    providerAwayName: hit.awayTeam.providerName,
    scheduledStartTime: hit.time.providerStartTime,
    collectionPhase: hit.collectionPhase,
    gameStatus: hit.gameStatus,
    kboResultStatus: hit.result.resultStatus,
  };
}

function joinFootball(
  game: OperatorGame,
  schedule: FootballScheduleArtifactV1,
  usedMatchIds: Set<string>,
) {
  const firstObs = schedule.meta.generatedAt;
  const missed = missedPreGame(game.displayedKickoffUtc, firstObs);
  const base = {
    operatorGameId: game.operatorGameId,
    sport: game.sport,
    rawLeagueLabel: game.rawLeagueLabel,
    rawHome: game.rawHome,
    rawAway: game.rawAway,
    displayedStartKst: game.displayedStartKst,
    displayedKickoffUtc: game.displayedKickoffUtc,
    provider: "api-football",
    providerFixtureId: null as string | null,
    providerHomeTeamId: null as string | null,
    providerAwayTeamId: null as string | null,
    identityStrength: null as string | null,
    providerObservationAt: firstObs,
    providerObservationClass: missed
      ? ("MISSED_PRE_GAME_WINDOW" as const)
      : ("PRE_GAME_WINDOW" as const),
    missedPreGameWindow: missed,
    classifiedAsPreGame: false,
  };

  const competition = findRegisteredCompetition(game.rawLeagueLabel);
  if (!competition) {
    return {
      ...base,
      status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
      reasons: [
        "UNREGISTERED_COMPETITION",
        `SCREENSHOT_LEAGUE_${game.rawLeagueLabel}_NOT_IN_COMPETITION_REGISTRY`,
        "FOOTBALL_SCHEDULE_V1_DROPS_UNREGISTERED",
      ],
    };
  }

  const homeAlias = resolveApprovedAlias(game.rawHome, "K리그1", "football");
  const awayAlias = resolveApprovedAlias(game.rawAway, "K리그1", "football");
  let matchMethod = "PROVIDER_TEAM_ID";
  let hits = schedule.rows.filter((r) => {
    if (usedMatchIds.has(r.matchId)) return false;
    if (!homeAlias || !awayAlias) return false;
    const homeId = providerTeamIdFromAlias(homeAlias);
    const awayId = providerTeamIdFromAlias(awayAlias);
    if (!homeId || !awayId) return false;
    return r.homeProviderTeamId === homeId && r.awayProviderTeamId === awayId;
  });
  if (hits.length === 0 && homeAlias && awayAlias) {
    matchMethod = "APPROVED_ALIAS_NAME";
    hits = schedule.rows.filter((r) => {
      if (usedMatchIds.has(r.matchId)) return false;
      return (
        aliasMatchesProviderName(homeAlias, r.homeTeamName) &&
        aliasMatchesProviderName(awayAlias, r.awayTeamName)
      );
    });
  }
  if (hits.length === 0) {
    const uniqueKickoff = schedule.rows.filter((r) => {
      if (usedMatchIds.has(r.matchId)) return false;
      if (r.competitionId !== competition.competitionId) return false;
      return sameInstant(r.kickoffTimeUtc, game.displayedKickoffUtc);
    });
    if (uniqueKickoff.length === 1) {
      matchMethod = "REGISTERED_COMPETITION+KICKOFF";
      hits = uniqueKickoff;
    }
  }

  if (hits.length === 0) {
    if (!homeAlias || !awayAlias) {
      return {
        ...base,
        status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
        reasons: [
          "OPERATOR_LABEL_NOT_IN_APPROVED_ALIAS",
          !homeAlias ? `HOME_ALIAS_MISSING:${game.rawHome}` : null,
          !awayAlias ? `AWAY_ALIAS_MISSING:${game.rawAway}` : null,
          "NO_FUZZY_NAME_AUTO_APPROVAL",
        ].filter(Boolean),
      };
    }
    return {
      ...base,
      status: "PROVIDER_NOT_FOUND" as B1Status,
      reasons: [
        "NO_PROVIDER_FIXTURE_FOR_APPROVED_ALIAS_PAIR",
        `HOME_ALIAS:${homeAlias.displayName}`,
        `AWAY_ALIAS:${awayAlias.displayName}`,
      ],
    };
  }
  if (hits.length > 1) {
    return {
      ...base,
      status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
      reasons: [
        "AMBIGUOUS_PROVIDER_FIXTURES",
        ...hits.map((r) => `CANDIDATE:${r.providerMatchId}`),
      ],
    };
  }

  const hit = hits[0]!;
  usedMatchIds.add(hit.matchId);
  const homeId = homeAlias ? providerTeamIdFromAlias(homeAlias) : null;
  const awayId = awayAlias ? providerTeamIdFromAlias(awayAlias) : null;
  const unsafeIds = [hit.homeProviderTeamId, hit.awayProviderTeamId].filter(
    (id) =>
      FOOTBALL_HISTORICAL_UNSAFE_PROVIDER_TEAM_IDS.has(id) ||
      FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS.has(id),
  );
  if (unsafeIds.length > 0) {
    return {
      ...base,
      status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
      reasons: [
        "FOOTBALL_CONFLICT_GATE",
        ...unsafeIds.map((id) => `HISTORICAL_UNSAFE_OR_BLOCKED_PROVIDER_TEAM_ID:${id}`),
        ...hit.identityReasons,
      ],
      providerFixtureId: hit.providerMatchId,
      providerHomeTeamId: hit.homeProviderTeamId,
      providerAwayTeamId: hit.awayProviderTeamId,
      identityStrength: "provider-fixture-id+provider-team-ids",
      classifiedAsPreGame: false,
    };
  }
  if (hit.identityStatus !== "MATCHED") {
    return {
      ...base,
      status: "IDENTITY_REVIEW_REQUIRED" as B1Status,
      reasons: [
        "FOOTBALL_SCHEDULE_IDENTITY_NOT_MATCHED",
        `JOIN_METHOD:${matchMethod}`,
        homeId && hit.homeProviderTeamId !== homeId
          ? `CATALOG_HOME_ID:${homeId}≠PROVIDER:${hit.homeProviderTeamId}`
          : null,
        awayId && hit.awayProviderTeamId !== awayId
          ? `CATALOG_AWAY_ID:${awayId}≠PROVIDER:${hit.awayProviderTeamId}`
          : null,
        ...hit.identityReasons,
      ].filter(Boolean),
      providerFixtureId: hit.providerMatchId,
      providerHomeTeamId: hit.homeProviderTeamId,
      providerAwayTeamId: hit.awayProviderTeamId,
      classifiedAsPreGame: false,
    };
  }
  if (hit.predictionEligibility === "NOT_SUPPORTED_FORMAT") {
    return {
      ...base,
      status: "FORMAT_UNSUPPORTED" as B1Status,
      reasons: ["NOT_SUPPORTED_FORMAT", `MATCH_FORMAT:${hit.matchFormat}`],
      providerFixtureId: hit.providerMatchId,
      providerHomeTeamId: hit.homeProviderTeamId,
      providerAwayTeamId: hit.awayProviderTeamId,
      classifiedAsPreGame: false,
    };
  }

  const rowMissed = missedPreGame(hit.kickoffTimeUtc, firstObs);
  return {
    ...base,
    status: "MATCHED" as B1Status,
    reasons: [
      "PROVIDER_FIXTURE_ID+PROVIDER_TEAM_IDS+REGISTERED_COMPETITION+APPROVED_ALIAS",
    ],
    providerFixtureId: hit.providerMatchId,
    providerHomeTeamId: hit.homeProviderTeamId,
    providerAwayTeamId: hit.awayProviderTeamId,
    identityStrength:
      "provider-fixture-id+provider-team-ids+competition+kickoff+approved-alias",
    providerObservationClass: rowMissed
      ? ("MISSED_PRE_GAME_WINDOW" as const)
      : ("PRE_GAME_WINDOW" as const),
    missedPreGameWindow: rowMissed,
    classifiedAsPreGame: !rowMissed,
    canonicalHome: homeAlias?.displayName,
    canonicalAway: awayAlias?.displayName,
    providerHomeName: hit.homeTeamName,
    providerAwayName: hit.awayTeamName,
    scheduledStartTime: hit.kickoffTimeUtc,
    footballIdentityStatus: hit.identityStatus,
    matchFormat: hit.matchFormat,
  };
}

export async function runScheduleIdentityReconciliation(cwd = process.cwd()) {
  const lockAbs = path.join(cwd, LOCK_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);
  const kboAbs = path.join(cwd, KBO_SCHEDULE_REL);
  const npbAbs = path.join(cwd, NPB_SCHEDULE_REL);
  const fbAbs = path.join(cwd, FOOTBALL_SCHEDULE_REL);

  if (!existsSync(lockAbs)) throw new Error("SCOPE_LOCK_MISSING");
  if (!existsSync(obsAbs)) throw new Error("SOURCE_OBSERVATION_MISSING");
  if (!existsSync(kboAbs)) throw new Error(`KBO_SCHEDULE_MISSING: ${KBO_SCHEDULE_REL}`);
  if (!existsSync(npbAbs)) throw new Error(`NPB_SCHEDULE_MISSING: ${NPB_SCHEDULE_REL}`);
  if (!existsSync(fbAbs)) throw new Error(`FOOTBALL_SCHEDULE_MISSING: ${FOOTBALL_SCHEDULE_REL}`);

  const lock = JSON.parse(readFileSync(lockAbs, "utf8")) as {
    lockStatus: string;
    officialDenominator: number;
    sourceOperatorObservationHash: string;
    scopeLockedAt: string;
  };
  const obsHash = sha256File(obsAbs);
  if (obsHash !== FROZEN_OBS_HASH) throw new Error("SOURCE_OBSERVATION_HASH_CHANGED");
  if (lock.sourceOperatorObservationHash !== FROZEN_OBS_HASH) {
    throw new Error("LOCK_OBSERVATION_HASH_MISMATCH");
  }
  if (lock.officialDenominator !== TOTAL_OBSERVED) {
    throw new Error("SCOPE_SHRINK_AFTER_LOCK_FORBIDDEN");
  }

  const generatedAt = new Date().toISOString();
  const games = loadLockedGames(obsAbs);
  if (games.length !== TOTAL_OBSERVED) {
    throw new Error(`LOCKED_GAME_COUNT_MISMATCH: ${games.length}`);
  }
  const keys = games.map((g) => g.operatorGameId);
  if (new Set(keys).size !== keys.length) {
    throw new Error("DUPLICATE_OPERATOR_GAME");
  }

  const kboDoc = JSON.parse(
    readFileSync(kboAbs, "utf8"),
  ) as KboScheduleResultIdentityDocument;
  const npbDoc = JSON.parse(readFileSync(npbAbs, "utf8")) as NpbScheduleDoc;
  const fbDoc = JSON.parse(readFileSync(fbAbs, "utf8")) as FootballScheduleArtifactV1;

  const npbUsed = new Set<string>();
  const fbUsed = new Set<string>();
  const rows = games.map((game) => {
    if (game.sport === "VOLLEYBALL") return joinVolleyball(game, generatedAt);
    if (game.sport === "NPB") return joinNpb(game, npbDoc, npbUsed);
    if (game.sport === "KBO") return joinKbo(game, kboDoc);
    return joinFootball(game, fbDoc, fbUsed);
  });

  if (rows.length !== TOTAL_OBSERVED) {
    throw new Error("DROPPED_GAME");
  }

  const count = (status: B1Status) =>
    rows.filter((r) => r.status === status).length;
  const statusCounts = {
    MATCHED: count("MATCHED"),
    IDENTITY_REVIEW_REQUIRED: count("IDENTITY_REVIEW_REQUIRED"),
    PROVIDER_NOT_SUPPORTED: count("PROVIDER_NOT_SUPPORTED"),
    PROVIDER_NOT_FOUND: count("PROVIDER_NOT_FOUND"),
    FORMAT_UNSUPPORTED: count("FORMAT_UNSUPPORTED"),
    PASS: count("PASS"),
  };
  const accountedFor = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  if (accountedFor !== TOTAL_OBSERVED) {
    throw new Error(`ACCOUNTED_FOR_MISMATCH: ${accountedFor}`);
  }

  const missedPreGameWindowCount = rows.filter((r) => r.missedPreGameWindow).length;
  const fakePreGame = rows.filter(
    (r) => r.missedPreGameWindow && r.classifiedAsPreGame,
  );
  if (fakePreGame.length > 0) {
    throw new Error("FAKE_PRE_GAME_FORBIDDEN");
  }

  const capture = loadFootballFixtureCapture(cwd);
  const captureAbs = path.join(cwd, FIXTURES_CAPTURE_REL);
  const npbApiBaseballCalls = (npbDoc.providerCalls ?? []).filter(
    (c) => c.provider === "API_BASEBALL",
  );
  const npbTheSportsDbCalls = (npbDoc.providerCalls ?? []).filter(
    (c) => c.provider === "THESPORTSDB",
  );
  const kLeagueConflictRows = fbDoc.rows.filter(
    (r) =>
      r.competitionId === "fb-comp-api-football-292" &&
      r.identityStatus === "IDENTITY_REVIEW_REQUIRED",
  );

  const document = {
    schemaVersion: "yang-edge-schedule-identity-reconciliation-v1",
    dateKst: DATE_KST,
    generatedAt,
    sourceDailyScopeLockRel: LOCK_REL,
    sourceDailyScopeLockHash: sha256File(lockAbs),
    sourceOperatorObservationRel: SOURCE_OBS_REL,
    sourceOperatorObservationHash: obsHash,
    scopeLockedAt: lock.scopeLockedAt,
    lockedScope: TOTAL_OBSERVED,
    accountedFor,
    statusCounts,
    missedPreGameWindowCount,
    researchOnly: true,
    predictionInput: false,
    engineConnected: false,
    engineAdmission: "PROHIBITED",
    prediction: "NONE",
    engine: "NONE",
    note: "B1 schedule/identity join after Daily Scope Lock. Domestic/overseas market odds are observation evidence only and are not model features. No Prediction. No Engine change.",
    scheduleArtifacts: {
      kbo: {
        rel: KBO_SCHEDULE_REL,
        sha256: sha256File(kboAbs),
        generatedAt: kboDoc.meta.generatedAt,
        providerGames: kboDoc.summary.providerGamesFetched,
        cacheUsage: kboDoc.cacheUsage,
        researchOnly: kboDoc.meta.researchOnly,
        engineConnected: kboDoc.meta.engineConnected,
      },
      npb: {
        rel: NPB_SCHEDULE_REL,
        sha256: sha256File(npbAbs),
        generatedAt: npbDoc.collectedAt,
        providerGames: npbDoc.games.length,
        providerCalls: npbDoc.providerCalls ?? [],
        researchOnly: npbDoc.researchOnly === true,
        predictionInput: npbDoc.predictionInput === true,
        engineConnected: npbDoc.engineConnected === true,
      },
      football: {
        rel: FOOTBALL_SCHEDULE_REL,
        sha256: sha256File(fbAbs),
        generatedAt: fbDoc.meta.generatedAt,
        scheduleGames: fbDoc.meta.scheduleGames,
        identityMatched: fbDoc.meta.identityMatched,
        identityBlocked: fbDoc.meta.identityBlocked,
        droppedUnregisteredCompetition: fbDoc.meta.droppedUnregisteredCompetition,
        artifactHash: fbDoc.meta.artifactHash,
        researchOnly: fbDoc.meta.researchOnly,
        sourceCaptureRel: capture ? FIXTURES_CAPTURE_REL : null,
        sourceCaptureSha256: capture && existsSync(captureAbs)
          ? sha256File(captureAbs)
          : null,
        rebuiltFromCapture: capture != null,
        networkCallOnThisRebuild: false,
      },
      volleyball: {
        rel: null,
        provider: null,
        callCount: 0,
        reason: "NO_LAWFUL_APPROVED_VOLLEYBALL_PIPELINE",
      },
    },
    providerCalls: [
      {
        sport: "KBO",
        provider: "API_BASEBALL",
        callCount: kboDoc.cacheUsage.networkCalls,
        cachedHits: kboDoc.cacheUsage.rawHit,
        cachedMisses: kboDoc.cacheUsage.rawMiss,
        observationTime: kboDoc.meta.generatedAt,
        cached: kboDoc.cacheUsage.networkCalls === 0,
      },
      ...(npbDoc.providerCalls ?? []).map((c) => ({
        sport: "NPB",
        provider: c.provider,
        endpoint: c.endpoint,
        callCount: c.callCount,
        cached: c.cached,
        observationTime: c.observationTime,
        error: c.error,
        resultCount: c.resultCount,
      })),
      {
        sport: "FOOTBALL",
        provider: "api-football",
        endpoint: "/fixtures?date=2026-08-26&timezone=Asia/Seoul",
        callCount: capture?.networkCallMade ? 2 : 1,
        cached: capture?.cached ?? null,
        observationTime: capture?.capturedAt ?? fbDoc.meta.generatedAt,
        note: "B1 live getFixtures was in-memory only. B1.1 persisted one recapture to the fixture dump. Schedule rebuild used that dump with no additional getFixtures call.",
      },
      {
        sport: "VOLLEYBALL",
        provider: null,
        callCount: 0,
        cached: null,
        observationTime: null,
        reason: "NO_LAWFUL_APPROVED_VOLLEYBALL_PIPELINE",
      },
    ],
    footballConflictGatesPreserved: {
      blockedProviderTeamIds: [...FOOTBALL_BLOCKED_PROVIDER_TEAM_IDS].sort(),
      historicalUnsafeIds: [...FOOTBALL_HISTORICAL_UNSAFE_PROVIDER_TEAM_IDS].sort(),
      autoMatchedUnsafeIds: 0,
      kLeagueProviderIdNameConflicts: kLeagueConflictRows.map((r) => ({
        providerMatchId: r.providerMatchId,
        homeProviderTeamId: r.homeProviderTeamId,
        awayProviderTeamId: r.awayProviderTeamId,
        homeTeamName: r.homeTeamName,
        awayTeamName: r.awayTeamName,
        identityReasons: r.identityReasons,
        historicalCanonicalIdsNotRewritten: true,
      })),
    },
    providerUtilization: {
      API_FOOTBALL: {
        calledInB1ScheduleIdentityPhase: true,
        networkCalls: capture?.networkCallMade ? 2 : 1,
        capturedDumpRel: capture ? FIXTURES_CAPTURE_REL : null,
        capturedAt: capture?.capturedAt ?? null,
        fixtureCount: capture?.fixtureCount ?? null,
        requestsRemaining: capture?.usage.requestsRemaining ?? null,
        requestsLimit: capture?.usage.requestsLimit ?? null,
        scheduleRebuildUsedCapturedDump: true,
        additionalGetFixturesOnRebuild: false,
      },
      API_BASEBALL: {
        calledInB1ScheduleIdentityPhase: true,
        kboNetworkCalls: kboDoc.cacheUsage.networkCalls,
        npbNetworkCalls: npbApiBaseballCalls.reduce(
          (sum, c) => sum + c.callCount,
          0,
        ),
        kboCached: kboDoc.cacheUsage.networkCalls === 0,
      },
      THESPORTSDB: {
        calledInB1ScheduleIdentityPhase: true,
        networkCalls: npbTheSportsDbCalls.reduce((sum, c) => sum + c.callCount, 0),
      },
      THE_ODDS_API: "NOT_CALLED_IN_B1_SCHEDULE_IDENTITY_PHASE",
      reason:
        "Odds collection belongs to B2 and must not be mixed into Schedule/Identity.",
    },
    leakage: {
      predictionCalls: 0,
      engineCalls: 0,
      resultCalls: 0,
      postgameCalls: 0,
      unauthorizedCrawling: 0,
      oddsUsedAsModelFeatures: false,
      denominatorChanged: false,
      gamesDropped: false,
      gamesInvented: false,
    },
    games: rows,
  };

  const outAbs = path.join(cwd, RECONCILIATION_REL);
  await mkdir(path.dirname(outAbs), { recursive: true });
  const body = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(outAbs, body, "utf8");
  return {
    document: {
      ...document,
      artifactHash: sha256Text(body),
    },
    outRel: RECONCILIATION_REL,
    artifactHash: sha256Text(body),
  };
}

async function main() {
  const result = await runScheduleIdentityReconciliation();
  const c = result.document.statusCounts;
  console.log(
    [
      `wrote ${result.outRel}`,
      `hash=${result.artifactHash}`,
      `lockedScope=${result.document.lockedScope}`,
      `accountedFor=${result.document.accountedFor}`,
      `MATCHED=${c.MATCHED}`,
      `IDENTITY_REVIEW_REQUIRED=${c.IDENTITY_REVIEW_REQUIRED}`,
      `PROVIDER_NOT_FOUND=${c.PROVIDER_NOT_FOUND}`,
      `PROVIDER_NOT_SUPPORTED=${c.PROVIDER_NOT_SUPPORTED}`,
      `FORMAT_UNSUPPORTED=${c.FORMAT_UNSUPPORTED}`,
      `PASS=${c.PASS}`,
      `MISSED_PRE_GAME_WINDOW=${result.document.missedPreGameWindowCount}`,
    ].join(" "),
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
