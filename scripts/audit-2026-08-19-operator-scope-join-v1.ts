/**
 * Join sealed 2026-08-18/batch-2253 operator observations to
 * 2026-08-19 official schedules. Does not mutate screenshots or the scope lock.
 *
 *   npx tsx scripts/audit-2026-08-19-operator-scope-join-v1.ts
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
} from "./lock-2026-08-19-daily-scope-v1";

export const JOIN_REL = "data/audits/2026-08-19-operator-scope-join-v1.json";
export const MLB_SCHEDULE_REL = `data/research/mlb/${DATE_KST}-schedule-v1.json`;
export const FOOTBALL_SCHEDULE_REL =
  `data/research/football/${DATE_KST}-schedule-v1.json`;

type MlbGame = {
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
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
  for (const g of mlbDoc.games) {
    const k = pairKey(g.homeTeam, g.awayTeam);
    const list = mlbByPair.get(k) ?? [];
    list.push(g);
    mlbByPair.set(k, list);
  }
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

  const footballJoins = obs.nonMlbOddsFixtures.map((row) => {
    const league = row.rawLeagueLabel;
    if (league === "코파리베") {
      return {
        sport: "FOOTBALL" as const,
        fixture: `${row.rawHome} – ${row.rawAway}`,
        rawLeagueLabel: league,
        rawHome: row.rawHome,
        rawAway: row.rawAway,
        rawHomeSecondaryVisible: row.rawHomeSecondaryVisible,
        displayedStartKst: row.displayedStartKst,
        status: "UNREGISTERED_COMPETITION" as const,
        fixtureId: null as string | null,
        kickoffUtc: null as string | null,
        kickoffKst: null as string | null,
        minutesUntilKickoff: null as number | null,
        pregameWindow: null as "PREGAME_WINDOW_OPEN" | "PREGAME_WINDOW_MISSED" | null,
        reason: competitionExactLabelRegistered(league)
          ? "COPA_LABEL_UNEXPECTEDLY_REGISTERED"
          : "SCREENSHOT_LEAGUE_코파리베_NOT_IN_COMPETITION_REGISTRY",
      };
    }
    if (league === "UCL") {
      return {
        sport: "FOOTBALL" as const,
        fixture: `${row.rawHome} – ${row.rawAway}`,
        rawLeagueLabel: league,
        rawHome: row.rawHome,
        rawAway: row.rawAway,
        rawHomeSecondaryVisible: row.rawHomeSecondaryVisible,
        displayedStartKst: row.displayedStartKst,
        status: "IDENTITY_BLOCKED" as const,
        fixtureId: null as string | null,
        kickoffUtc: null as string | null,
        kickoffKst: null as string | null,
        minutesUntilKickoff: null as number | null,
        pregameWindow: null as "PREGAME_WINDOW_OPEN" | "PREGAME_WINDOW_MISSED" | null,
        reason:
          "NO_EXACT_FOOTBALL_TEAM_ALIAS; UCL_ROWS_EXIST_IN_SCHEDULE_BUT_SCREENSHOT_LABELS_NOT_JOINED",
      };
    }
    return {
      sport: "FOOTBALL" as const,
      fixture: `${row.rawHome} – ${row.rawAway}`,
      rawLeagueLabel: league,
      rawHome: row.rawHome,
      rawAway: row.rawAway,
      rawHomeSecondaryVisible: row.rawHomeSecondaryVisible,
      displayedStartKst: row.displayedStartKst,
      status: "NOT_FOUND" as const,
      fixtureId: null as string | null,
      kickoffUtc: null as string | null,
      kickoffKst: null as string | null,
      minutesUntilKickoff: null as number | null,
      pregameWindow: null as "PREGAME_WINDOW_OPEN" | "PREGAME_WINDOW_MISSED" | null,
      reason: "UNKNOWN_SCREENSHOT_LEAGUE_LABEL",
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
  const scheduleStageDone =
    accounted === TOTAL_OBSERVED && unexplainedMissing === 0;

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
      scheduleStageDone,
    },
    mlb: {
      observedExpected: MLB_OBSERVED,
      officialSchedule: mlbDoc.summary.totalGames,
      matched: mlbJoins.filter((r) => r.status === "MATCHED_REGISTERED").length,
      ambiguous: mlbJoins.filter((r) => r.status === "AMBIGUOUS_DOUBLEHEADER")
        .length,
      missing: mlbJoins.filter((r) => r.status === "NOT_FOUND").length,
      uniqueGamePkJoined: uniqueJoined.size,
      doubleheaders,
      joins: mlbJoins,
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
      registeredUclScheduleRows: registeredUcl,
      note: "Screenshot football rows are accounted without fuzzy Korean→English team translation. UCL is registered (league id 2) but format is NOT_SUPPORTED. Copa Libertadores is not in the competition registry.",
    },
    leakage: {
      screenshotArtifactsMutated: false,
      scopeLockedAtRewritten: false,
      predictionCalls: 0,
      engineCalls: 0,
      postgameCalls: 0,
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
      existsSync(path.join(process.cwd(), JOIN_REL)) ? `sealed ${JOIN_REL}` : `wrote ${JOIN_REL}`,
      `mlbMatched=${doc.mlb.matched}/${doc.mlb.observedExpected}`,
      `footballAccounted=${doc.football.joins.length}`,
      `unexplainedMissing=${doc.coverage.unexplainedMissing}`,
      `scheduleStageDone=${doc.coverage.scheduleStageDone}`,
    ].join(" "),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
