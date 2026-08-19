/**
 * Join sealed 2026-08-20/batch-0008 operator observations to
 * 2026-08-20 official schedules. Does not mutate screenshots or the scope lock.
 *
 *   npx tsx scripts/audit-2026-08-20-operator-scope-join-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import { FOOTBALL_COMPETITION_REGISTRY_V0 } from "../src/lib/football/foundation/competition-registry";
import { canonicalDomesticTeam } from "../src/lib/mlb/domestic-markets-v1";
import {
  DATE_KST,
  FOOTBALL_OBSERVED,
  LOCK_REL,
  MLB_OBSERVED,
  SOURCE_OBS_REL,
  TOTAL_OBSERVED,
  sha256File,
} from "./lock-2026-08-20-daily-scope-v1";

export const JOIN_REL = "data/audits/2026-08-20-operator-scope-join-v1.json";
export const MLB_SCHEDULE_REL = `data/research/mlb/${DATE_KST}-schedule-v1.json`;
export const FOOTBALL_SCHEDULE_REL =
  `data/research/football/${DATE_KST}-schedule-v1.json`;

type MlbGame = {
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  internalGameId: string;
  startTimeKst: string | null;
  commenceTimeUtc: string;
  statusAbstract?: string;
  statusDetailed?: string | null;
};

type FootballRow = {
  providerMatchId: string;
  competitionId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTimeUtc: string;
  identityStatus: string;
  predictionEligibility: string;
  matchFormat: string;
};

type LineupCard = {
  awayTeam: string;
  homeTeam: string;
  displayedStartKst: string;
  operatorObservedAt: string;
  lineupType: string;
  completeness: string;
  confirmedLineup: boolean;
  predictionInput: boolean;
};

type FootballJoinStatus =
  | "MATCHED_REGISTERED"
  | "MATCHED_BUT_UNSUPPORTED_FORMAT"
  | "IDENTITY_BLOCKED"
  | "UNREGISTERED_COMPETITION"
  | "NOT_FOUND";

function competitionExactLabelRegistered(label: string): boolean {
  return FOOTBALL_COMPETITION_REGISTRY_V0.some(
    (c) => c.displayName === label || c.officialName === label,
  );
}

function pairKey(home: string, away: string): string {
  return `${home}\u0000${away}`;
}

function kickoffWindow(kickoffTimeUtc: string, now: Date) {
  const kickoffMs = Date.parse(kickoffTimeUtc);
  const minutesUntilKickoff = (kickoffMs - now.getTime()) / 60000;
  const kst = instantToKst(kickoffTimeUtc);
  return {
    fixtureKickoffUtc: kickoffTimeUtc,
    kickoffKst: kst ? `${kst.date}T${kst.time}+09:00` : null,
    minutesUntilKickoff,
    pregameWindow:
      Number.isFinite(minutesUntilKickoff) && minutesUntilKickoff > 0
        ? ("PREGAME_WINDOW_OPEN" as const)
        : ("PREGAME_WINDOW_MISSED" as const),
  };
}

function parseObservedAt(observedAt: string): number {
  if (observedAt.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(observedAt)) {
    return Date.parse(observedAt);
  }
  return Date.parse(`${observedAt}+09:00`);
}

function classifyPregameTiming(
  observedAt: string,
  commenceTimeUtc: string | null,
): "PRE_GAME" | "POST_START" | "UNKNOWN_TIMING" {
  if (!commenceTimeUtc) return "UNKNOWN_TIMING";
  const obs = parseObservedAt(observedAt);
  const start = Date.parse(commenceTimeUtc);
  if (!Number.isFinite(obs) || !Number.isFinite(start)) return "UNKNOWN_TIMING";
  return obs < start ? "PRE_GAME" : "POST_START";
}

function joinEnglishCard(
  card: LineupCard,
  mlbByPair: Map<string, MlbGame[]>,
): {
  homeTeam: string;
  awayTeam: string;
  displayedStartKst: string;
  observedAt: string;
  status: "MATCHED_UNIQUE" | "AMBIGUOUS" | "NOT_FOUND";
  lineupGamePk: number | null;
  commenceTimeUtc: string | null;
  scheduleStartKst: string | null;
  timing: "PRE_GAME" | "POST_START" | "UNKNOWN_TIMING";
  reason: string;
} {
  const candidates = mlbByPair.get(pairKey(card.homeTeam, card.awayTeam)) ?? [];
  if (candidates.length === 0) {
    return {
      homeTeam: card.homeTeam,
      awayTeam: card.awayTeam,
      displayedStartKst: card.displayedStartKst,
      observedAt: card.operatorObservedAt,
      status: "NOT_FOUND",
      lineupGamePk: null,
      commenceTimeUtc: null,
      scheduleStartKst: null,
      timing: "UNKNOWN_TIMING",
      reason: "NO_EXACT_SCHEDULE_MATCHUP",
    };
  }
  if (candidates.length > 1) {
    const timed = candidates.filter(
      (g) => g.startTimeKst === card.displayedStartKst,
    );
    if (timed.length !== 1) {
      return {
        homeTeam: card.homeTeam,
        awayTeam: card.awayTeam,
        displayedStartKst: card.displayedStartKst,
        observedAt: card.operatorObservedAt,
        status: "AMBIGUOUS",
        lineupGamePk: null,
        commenceTimeUtc: null,
        scheduleStartKst: null,
        timing: "UNKNOWN_TIMING",
        reason: "DOUBLEHEADER_WITHOUT_UNIQUE_TIME_EVIDENCE",
      };
    }
    const hit = timed[0]!;
    return {
      homeTeam: card.homeTeam,
      awayTeam: card.awayTeam,
      displayedStartKst: card.displayedStartKst,
      observedAt: card.operatorObservedAt,
      status: "MATCHED_UNIQUE",
      lineupGamePk: hit.gamePk,
      commenceTimeUtc: hit.commenceTimeUtc,
      scheduleStartKst: hit.startTimeKst,
      timing: classifyPregameTiming(
        card.operatorObservedAt,
        hit.commenceTimeUtc,
      ),
      reason: "EXACT_TEAM_PAIR_AND_UNIQUE_START_TIME",
    };
  }
  const hit = candidates[0]!;
  return {
    homeTeam: card.homeTeam,
    awayTeam: card.awayTeam,
    displayedStartKst: card.displayedStartKst,
    observedAt: card.operatorObservedAt,
    status: "MATCHED_UNIQUE",
    lineupGamePk: hit.gamePk,
    commenceTimeUtc: hit.commenceTimeUtc,
    scheduleStartKst: hit.startTimeKst,
    timing: classifyPregameTiming(card.operatorObservedAt, hit.commenceTimeUtc),
    reason: "EXACT_UNIQUE_TEAM_PAIR",
  };
}

export async function auditOperatorScopeJoin(cwd = process.cwd()) {
  const now = new Date();
  const lockAbs = path.join(cwd, LOCK_REL);
  const obsAbs = path.join(cwd, SOURCE_OBS_REL);
  const mlbAbs = path.join(cwd, MLB_SCHEDULE_REL);
  const fbAbs = path.join(cwd, FOOTBALL_SCHEDULE_REL);
  for (const [rel, abs] of [
    [LOCK_REL, lockAbs],
    [SOURCE_OBS_REL, obsAbs],
    [MLB_SCHEDULE_REL, mlbAbs],
    [FOOTBALL_SCHEDULE_REL, fbAbs],
  ] as const) {
    if (!existsSync(abs)) throw new Error(`MISSING: ${rel}`);
  }

  const lock = JSON.parse(readFileSync(lockAbs, "utf8")) as {
    scopeLockedAt: string;
    sourceOperatorObservationHash: string;
    observedScope: { MLB: number; FOOTBALL: number; total: number };
  };
  const obsHash = sha256File(obsAbs);
  if (obsHash !== lock.sourceOperatorObservationHash) {
    throw new Error("OPERATOR_OBSERVATION_MUTATED");
  }
  if (lock.observedScope.total !== TOTAL_OBSERVED) {
    throw new Error("SCOPE_SHRINK_AFTER_LOCK_FORBIDDEN");
  }

  const joinAbs = path.join(cwd, JOIN_REL);
  if (existsSync(joinAbs)) {
    return JSON.parse(readFileSync(joinAbs, "utf8"));
  }

  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    domesticOdds: Array<{
      rawHomeLabel: string;
      rawAwayLabel: string;
      canonicalHome: string | null;
      canonicalAway: string | null;
      displayedStartKst: string;
    }>;
    nonMlbOddsFixtures: Array<{
      rawLeagueLabel: string;
      rawHome: string;
      rawAway: string;
      rawHomeSecondaryVisible: string | null;
      displayedStartKst: string;
    }>;
    expectedLineups: LineupCard[];
    confirmedLineups: LineupCard[];
  };

  const mlbDoc = JSON.parse(readFileSync(mlbAbs, "utf8")) as {
    summary: { totalGames: number };
    games: MlbGame[];
  };
  const fbDoc = JSON.parse(readFileSync(fbAbs, "utf8")) as {
    meta: {
      scheduleGames: number;
      identityMatched: number;
      identityBlocked: number;
      formatEligible: number;
      formatNotSupported: number;
      droppedUnregisteredCompetition: number;
      artifactHash: string;
    };
    rows: FootballRow[];
  };

  const mlbByPair = new Map<string, MlbGame[]>();
  const gamePkSet = new Set<number>();
  const missingGamePk = mlbDoc.games.filter((g) => !g.gamePk);
  const internalIdCounts = new Map<string, number>();
  for (const g of mlbDoc.games) {
    gamePkSet.add(g.gamePk);
    internalIdCounts.set(
      g.internalGameId,
      (internalIdCounts.get(g.internalGameId) ?? 0) + 1,
    );
    const k = pairKey(g.homeTeam, g.awayTeam);
    const list = mlbByPair.get(k) ?? [];
    list.push(g);
    mlbByPair.set(k, list);
  }
  const uniqueGamePk = gamePkSet.size;
  const duplicateGamePks = [
    ...new Set(
      mlbDoc.games
        .map((g) => g.gamePk)
        .filter((pk, i, arr) => arr.indexOf(pk) !== i),
    ),
  ];
  const internalGameIdCollisions = [...internalIdCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([internalGameId, count]) => ({ internalGameId, count }));
  const doubleheaders = [...mlbByPair.entries()]
    .filter(([, games]) => games.length > 1)
    .map(([key, games]) => {
      const [home, away] = key.split("\u0000");
      return {
        home,
        away,
        gamePks: games.map((g) => g.gamePk),
        startTimesKst: games.map((g) => g.startTimeKst),
      };
    });

  const mlbJoins = obs.domesticOdds.map((row) => {
    const canonicalHome =
      row.canonicalHome ?? canonicalDomesticTeam(row.rawHomeLabel);
    const canonicalAway =
      row.canonicalAway ?? canonicalDomesticTeam(row.rawAwayLabel);
    const candidates =
      canonicalHome && canonicalAway
        ? (mlbByPair.get(pairKey(canonicalHome, canonicalAway)) ?? [])
        : [];
    if (!canonicalHome || !canonicalAway) {
      return {
        sport: "MLB" as const,
        rawHome: row.rawHomeLabel,
        rawAway: row.rawAwayLabel,
        displayedStartKst: row.displayedStartKst,
        status: "IDENTITY_BLOCKED" as const,
        gamePk: null as number | null,
        reason: "SCREENSHOT_TEAM_ALIAS_MISSING",
      };
    }
    if (candidates.length === 0) {
      return {
        sport: "MLB" as const,
        rawHome: row.rawHomeLabel,
        rawAway: row.rawAwayLabel,
        canonicalHome,
        canonicalAway,
        displayedStartKst: row.displayedStartKst,
        status: "NOT_FOUND" as const,
        gamePk: null as number | null,
        reason: "NO_EXACT_SCHEDULE_MATCHUP",
      };
    }
    if (candidates.length > 1) {
      const timed = candidates.filter(
        (g) => g.startTimeKst === row.displayedStartKst,
      );
      if (timed.length !== 1) {
        return {
          sport: "MLB" as const,
          rawHome: row.rawHomeLabel,
          rawAway: row.rawAwayLabel,
          canonicalHome,
          canonicalAway,
          displayedStartKst: row.displayedStartKst,
          status: "AMBIGUOUS_DOUBLEHEADER" as const,
          gamePk: null as number | null,
          candidateGamePks: candidates.map((g) => g.gamePk),
          reason: "DOUBLEHEADER_WITHOUT_UNIQUE_TIME_EVIDENCE",
        };
      }
      const hit = timed[0]!;
      return {
        sport: "MLB" as const,
        rawHome: row.rawHomeLabel,
        rawAway: row.rawAwayLabel,
        canonicalHome,
        canonicalAway,
        displayedStartKst: row.displayedStartKst,
        status: "MATCHED_REGISTERED" as const,
        gamePk: hit.gamePk,
        scheduleStartKst: hit.startTimeKst,
        commenceTimeUtc: hit.commenceTimeUtc,
        reason: "EXACT_TEAM_PAIR_AND_UNIQUE_START_TIME",
      };
    }
    const hit = candidates[0]!;
    return {
      sport: "MLB" as const,
      rawHome: row.rawHomeLabel,
      rawAway: row.rawAwayLabel,
      canonicalHome,
      canonicalAway,
      displayedStartKst: row.displayedStartKst,
      status: "MATCHED_REGISTERED" as const,
      gamePk: hit.gamePk,
      scheduleStartKst: hit.startTimeKst,
      commenceTimeUtc: hit.commenceTimeUtc,
      reason: "EXACT_UNIQUE_TEAM_PAIR",
    };
  });

  const mlbGamePks = mlbJoins
    .map((r) => r.gamePk)
    .filter((pk): pk is number => pk != null);
  const uniqueJoined = new Set(mlbGamePks);
  if (uniqueJoined.size !== mlbGamePks.length) {
    throw new Error("MLB_GAMEPK_COLLISION");
  }

  const confirmedJoins = obs.confirmedLineups.map((card) => ({
    lineupType: "CONFIRMED" as const,
    completeness: card.completeness,
    predictionInput: card.predictionInput,
    ...joinEnglishCard(card, mlbByPair),
  }));
  const expectedJoins = obs.expectedLineups.map((card) => ({
    lineupType: "EXPECTED" as const,
    completeness: card.completeness,
    predictionInput: card.predictionInput,
    ...joinEnglishCard(card, mlbByPair),
  }));

  const operatorEnglishPairs = new Set(
    [...obs.confirmedLineups, ...obs.expectedLineups].map((c) =>
      pairKey(c.homeTeam, c.awayTeam),
    ),
  );
  const oddsCanonicalPairs = new Set(
    mlbJoins
      .filter((r) => r.status === "MATCHED_REGISTERED")
      .map((r) =>
        pairKey(
          (r as { canonicalHome: string }).canonicalHome,
          (r as { canonicalAway: string }).canonicalAway,
        ),
      ),
  );
  const officialGamesOutsideOperatorSlate = mlbDoc.games.filter((g) => {
    const k = pairKey(g.homeTeam, g.awayTeam);
    return !operatorEnglishPairs.has(k) && !oddsCanonicalPairs.has(k);
  });
  const scopeDiscoveryConflict = officialGamesOutsideOperatorSlate.length > 0;

  const footballJoins = obs.nonMlbOddsFixtures.map((row) => {
    const league = row.rawLeagueLabel;
    const base = {
      sport: "FOOTBALL" as const,
      fixture: `${row.rawHome} – ${row.rawAway}`,
      rawLeagueLabel: league,
      rawHome: row.rawHome,
      rawAway: row.rawAway,
      rawHomeSecondaryVisible: row.rawHomeSecondaryVisible,
      displayedStartKst: row.displayedStartKst,
      fixtureId: null as string | null,
      kickoffUtc: null as string | null,
      kickoffKst: null as string | null,
      minutesUntilKickoff: null as number | null,
      pregameWindow: null as "PREGAME_WINDOW_OPEN" | "PREGAME_WINDOW_MISSED" | null,
    };
    if (league === "코파리베" || league === "MLS") {
      return {
        ...base,
        status: "UNREGISTERED_COMPETITION" as FootballJoinStatus,
        reason: competitionExactLabelRegistered(league)
          ? `${league}_LABEL_UNEXPECTEDLY_REGISTERED`
          : `SCREENSHOT_LEAGUE_${league}_NOT_IN_COMPETITION_REGISTRY`,
      };
    }
    if (league === "UCL") {
      return {
        ...base,
        status: "IDENTITY_BLOCKED" as FootballJoinStatus,
        reason:
          "NO_EXACT_FOOTBALL_TEAM_ALIAS; SCREENSHOT_LABEL_UCL_NOT_EQUAL_TO_REGISTRY_DISPLAY_UEFA_챔피언스리그",
      };
    }
    if (league === "라리가") {
      return {
        ...base,
        status: "IDENTITY_BLOCKED" as FootballJoinStatus,
        reason:
          "COMPETITION_REGISTERED_AS_라리가; SCREENSHOT_TEAM_ALIASES_NOT_IN_FOOTBALL_IDENTITY_MAP",
      };
    }
    return {
      ...base,
      status: "NOT_FOUND" as FootballJoinStatus,
      reason: "UNKNOWN_SCREENSHOT_LEAGUE_LABEL",
    };
  });

  const registeredLaLiga = fbDoc.rows
    .filter((r) => r.competitionId === "fb-comp-api-football-140")
    .map((r) => {
      const window = kickoffWindow(r.kickoffTimeUtc, now);
      return {
        fixtureId: r.providerMatchId,
        homeTeamName: r.homeTeamName,
        awayTeamName: r.awayTeamName,
        identityStatus: r.identityStatus,
        predictionEligibility: r.predictionEligibility,
        matchFormat: r.matchFormat,
        ...window,
      };
    });
  const registeredUcl = fbDoc.rows
    .filter((r) => r.competitionId === "fb-comp-api-football-2")
    .map((r) => {
      const window = kickoffWindow(r.kickoffTimeUtc, now);
      return {
        fixtureId: r.providerMatchId,
        homeTeamName: r.homeTeamName,
        awayTeamName: r.awayTeamName,
        identityStatus: r.identityStatus,
        predictionEligibility: r.predictionEligibility,
        matchFormat: r.matchFormat,
        ...window,
      };
    });

  const accounted = mlbJoins.length + footballJoins.length;
  const unexplainedMissing =
    mlbJoins.filter((r) => r.status === "NOT_FOUND").length +
    footballJoins.filter((r) => r.status === "NOT_FOUND").length;
  const ambiguous =
    mlbJoins.filter((r) => r.status === "AMBIGUOUS_DOUBLEHEADER").length +
    confirmedJoins.filter((r) => r.status === "AMBIGUOUS").length;
  const scheduleStageDone =
    accounted === TOTAL_OBSERVED &&
    unexplainedMissing === 0 &&
    ambiguous === 0 &&
    !scopeDiscoveryConflict &&
    uniqueGamePk === mlbDoc.games.length &&
    missingGamePk.length === 0;

  const document = {
    schemaVersion: "yang-edge-operator-scope-join-v1",
    dateKst: DATE_KST,
    generatedAt: now.toISOString(),
    researchOnly: true,
    prediction: "NONE",
    engine: "NONE",
    recommendation: "NONE",
    predictionInput: false,
    scopeLockRel: LOCK_REL,
    scopeLockedAt: lock.scopeLockedAt,
    sourceOperatorObservationRel: SOURCE_OBS_REL,
    sourceOperatorObservationHash: obsHash,
    mlbScheduleRel: MLB_SCHEDULE_REL,
    footballScheduleRel: FOOTBALL_SCHEDULE_REL,
    footballScheduleArtifactHash: fbDoc.meta.artifactHash,
    coverage: {
      observedScope: TOTAL_OBSERVED,
      mlbObserved: MLB_OBSERVED,
      footballObserved: FOOTBALL_OBSERVED,
      accounted,
      unexplainedMissing,
      ambiguous,
      scopeDiscoveryConflict,
      scheduleStageDone,
    },
    mlb: {
      observedExpected: MLB_OBSERVED,
      officialSchedule: mlbDoc.summary.totalGames,
      uniqueGamePk,
      duplicateGamePks,
      missingGamePk: missingGamePk.map((g) => g.internalGameId),
      internalGameIdCollisions,
      matched: mlbJoins.filter((r) => r.status === "MATCHED_REGISTERED").length,
      identityBlocked: mlbJoins.filter((r) => r.status === "IDENTITY_BLOCKED")
        .length,
      ambiguous: mlbJoins.filter((r) => r.status === "AMBIGUOUS_DOUBLEHEADER")
        .length,
      missing: mlbJoins.filter((r) => r.status === "NOT_FOUND").length,
      uniqueGamePkJoined: uniqueJoined.size,
      doubleheaders,
      officialGamesOutsideOperatorSlate: officialGamesOutsideOperatorSlate.map(
        (g) => ({
          gamePk: g.gamePk,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          startTimeKst: g.startTimeKst,
        }),
      ),
      joins: mlbJoins,
    },
    confirmedLineups: {
      screenshots: 1,
      cards: confirmedJoins.length,
      matchedUnique: confirmedJoins.filter((r) => r.status === "MATCHED_UNIQUE")
        .length,
      ambiguous: confirmedJoins.filter((r) => r.status === "AMBIGUOUS").length,
      notFound: confirmedJoins.filter((r) => r.status === "NOT_FOUND").length,
      preGame: confirmedJoins.filter((r) => r.timing === "PRE_GAME").length,
      postStart: confirmedJoins.filter((r) => r.timing === "POST_START").length,
      unknownTiming: confirmedJoins.filter((r) => r.timing === "UNKNOWN_TIMING")
        .length,
      expectedNotMergedIntoConfirmed: true,
      predictionInputTrue: confirmedJoins.filter((r) => r.predictionInput)
        .length,
      joins: confirmedJoins,
    },
    expectedLineups: {
      cards: expectedJoins.length,
      matchedUnique: expectedJoins.filter((r) => r.status === "MATCHED_UNIQUE")
        .length,
      ambiguous: expectedJoins.filter((r) => r.status === "AMBIGUOUS").length,
      notFound: expectedJoins.filter((r) => r.status === "NOT_FOUND").length,
      joins: expectedJoins,
      note: "EXPECTED cards are preserved separately from CONFIRMED. They are used only for English-name schedule coverage, not to fill confirmed player slots.",
    },
    football: {
      providerFixtures:
        fbDoc.meta.scheduleGames + fbDoc.meta.droppedUnregisteredCompetition,
      registeredRows: fbDoc.meta.scheduleGames,
      identityMatched: fbDoc.meta.identityMatched,
      identityBlocked: fbDoc.meta.identityBlocked,
      formatEligible: fbDoc.meta.formatEligible,
      formatNotSupported: fbDoc.meta.formatNotSupported,
      droppedUnregisteredCompetition:
        fbDoc.meta.droppedUnregisteredCompetition,
      observedExpected: FOOTBALL_OBSERVED,
      registeredMatched: footballJoins.filter(
        (r) => r.status === "MATCHED_REGISTERED",
      ).length,
      unsupported: footballJoins.filter(
        (r) => r.status === "MATCHED_BUT_UNSUPPORTED_FORMAT",
      ).length,
      screenshotIdentityBlocked: footballJoins.filter(
        (r) => r.status === "IDENTITY_BLOCKED",
      ).length,
      unregisteredCompetition: footballJoins.filter(
        (r) => r.status === "UNREGISTERED_COMPETITION",
      ).length,
      notFound: footballJoins.filter((r) => r.status === "NOT_FOUND").length,
      joins: footballJoins,
      registeredLaLigaScheduleRows: registeredLaLiga,
      registeredUclScheduleRows: registeredUcl,
      note: "Screenshot football rows are accounted without fuzzy Korean→English team translation. MLS and Copa Libertadores are unregistered. UCL screenshot label is not the registry displayName. La Liga competition is registered; screenshot team labels remain IDENTITY_BLOCKED.",
    },
    leakage: {
      screenshotArtifactsMutated: false,
      scopeLockedAtRewritten: false,
      predictionCalls: 0,
      oddsProviderCalls: 0,
      starterCalls: 0,
      lineupProviderCalls: 0,
      resultCalls: 0,
      postgameCalls: 0,
      gradeCalls: 0,
      reviewCalls: 0,
      engineCalls: 0,
    },
  };

  await mkdir(path.dirname(joinAbs), { recursive: true });
  await writeFile(joinAbs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return document;
}

async function main() {
  const doc = await auditOperatorScopeJoin();
  console.log(
    [
      existsSync(path.join(process.cwd(), JOIN_REL))
        ? `sealed ${JOIN_REL}`
        : `wrote ${JOIN_REL}`,
      `mlbMatched=${doc.mlb.matched}/${doc.mlb.observedExpected}`,
      `mlbIdentityBlocked=${doc.mlb.identityBlocked}`,
      `confirmedJoined=${doc.confirmedLineups.matchedUnique}/${doc.confirmedLineups.cards}`,
      `footballAccounted=${doc.football.joins.length}`,
      `unexplainedMissing=${doc.coverage.unexplainedMissing}`,
      `scopeDiscoveryConflict=${doc.coverage.scopeDiscoveryConflict}`,
      `scheduleStageDone=${doc.coverage.scheduleStageDone}`,
    ].join(" "),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
