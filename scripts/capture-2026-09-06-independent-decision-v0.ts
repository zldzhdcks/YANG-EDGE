/**
 * Capture independent API-Football team statistics for 2026-09-06
 * MLS 11:30 targets, then apply the already-frozen dominance contract.
 *
 * Scoring contract must already exist and must not be rewritten.
 *
 *   npx tsx --env-file=.env.local scripts/capture-2026-09-06-independent-decision-v0.ts
 *
 * No Odds. No /predictions. No standings. No results.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getFootballProvider } from "../src/lib/football";
import { scoreContextDominance } from "../src/lib/football/independent-context-dominance-v0";
import { sha256 } from "../src/lib/mlb/mlb-review-hash";

const DATE_KST = "2026-09-06";
const KICKOFF_UTC = "2026-09-06T02:30:00.000Z";
const LEAGUE_ID = 253;
const SEASON = 2026;
const CONTRACT_REL =
  "data/research/football/2026-09-06-independent-scoring-contract-v0.json";
const EVIDENCE_REL =
  "data/research/football/2026-09-06-independent-team-statistics-pregame-v0.json";
const DECISION_REL =
  "data/research/football/2026-09-06-independent-decision-v0.json";
const CONTRACT_FILE_SHA256 =
  "77637bdc721f0e5f87276e4a5bb1794d8194a03ad56203ecb78fe98b81e64068";

const TEAMS = [
  { providerTeamId: 1603, role: "1490449-home", scheduleName: "Vancouver Whitecaps" },
  { providerTeamId: 20787, role: "1490449-away", scheduleName: "St. Louis City" },
  { providerTeamId: 1617, role: "1490450-home", scheduleName: "Portland Timbers" },
  { providerTeamId: 1612, role: "1490450-away", scheduleName: "Minnesota United FC" },
] as const;

function fileSha256(abs: string): string {
  return createHash("sha256").update(readFileSync(abs), "utf8").digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pathNumber(root: unknown, dotted: string): number | null {
  let cur: unknown = root;
  for (const key of dotted.split(".")) {
    const rec = asRecord(cur);
    if (!rec) return null;
    cur = rec[key];
  }
  if (typeof cur === "number" && Number.isFinite(cur)) return cur;
  return null;
}

function pathString(root: unknown, dotted: string): string | null {
  let cur: unknown = root;
  for (const key of dotted.split(".")) {
    const rec = asRecord(cur);
    if (!rec) return null;
    cur = rec[key];
  }
  return typeof cur === "string" && cur.trim() ? cur.trim() : null;
}

function extractCounts(raw: unknown, side: "home" | "away") {
  return {
    fixturesPlayed: pathNumber(raw, `fixtures.played.${side}`),
    wins: pathNumber(raw, `fixtures.wins.${side}`),
    goalsFor: pathNumber(raw, `goals.for.total.${side}`),
    goalsAgainst: pathNumber(raw, `goals.against.total.${side}`),
  };
}

async function main() {
  const cwd = process.cwd();
  const contractAbs = path.join(cwd, CONTRACT_REL);
  const hashBefore = fileSha256(contractAbs);
  if (hashBefore !== CONTRACT_FILE_SHA256) {
    throw new Error(
      `CONTRACT_HASH_MISMATCH_BEFORE_CAPTURE: ${hashBefore} != ${CONTRACT_FILE_SHA256}`,
    );
  }

  const kickoffMs = Date.parse(KICKOFF_UTC);
  const providerCaptureStartedAt = new Date().toISOString();
  if (Date.parse(providerCaptureStartedAt) >= kickoffMs) {
    throw new Error(
      `PROVIDER_CAPTURE_AFTER_KICKOFF: started=${providerCaptureStartedAt}`,
    );
  }

  const provider = getFootballProvider();
  if (provider.kind === "dummy") {
    throw new Error("DUMMY_PROVIDER_NOT_RESEARCH");
  }

  const calls: Array<Record<string, unknown>> = [];
  for (const team of TEAMS) {
    const capturedAt = new Date().toISOString();
    const pregameUsable = Date.parse(capturedAt) < kickoffMs;
    let raw: unknown = null;
    let error: string | null = null;
    let cached = false;
    let usage: unknown = null;
    try {
      const got = await provider.getTeamStatistics({
        leagueId: LEAGUE_ID,
        season: SEASON,
        teamId: team.providerTeamId,
      });
      raw = got.raw;
      cached = got.cached;
      usage = got.usage;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const finishedAt = new Date().toISOString();
    const stillPregame = Date.parse(finishedAt) < kickoffMs && pregameUsable;
    calls.push({
      providerTeamId: team.providerTeamId,
      scheduleName: team.scheduleName,
      role: team.role,
      leagueId: LEAGUE_ID,
      season: SEASON,
      endpoint: "/teams/statistics",
      capturedAt,
      finishedAt,
      cached,
      usage,
      error,
      pregameUsable: stillPregame && error == null,
      lateCall: Date.parse(finishedAt) >= kickoffMs,
      teamName: pathString(raw, "team.name"),
      leagueName: pathString(raw, "league.name"),
      leagueSeason: pathNumber(raw, "league.season"),
      fixturesPlayedHome: pathNumber(raw, "fixtures.played.home"),
      fixturesPlayedAway: pathNumber(raw, "fixtures.played.away"),
      winsHome: pathNumber(raw, "fixtures.wins.home"),
      winsAway: pathNumber(raw, "fixtures.wins.away"),
      goalsForHome: pathNumber(raw, "goals.for.total.home"),
      goalsForAway: pathNumber(raw, "goals.for.total.away"),
      goalsAgainstHome: pathNumber(raw, "goals.against.total.home"),
      goalsAgainstAway: pathNumber(raw, "goals.against.total.away"),
      raw,
    });
  }

  const capturedAtEnd = new Date().toISOString();
  const evidenceWithoutHash = {
    meta: {
      schemaVersion: "football-independent-team-statistics-pregame-v0",
      dateKst: DATE_KST,
      capturedAtStart: providerCaptureStartedAt,
      capturedAtEnd,
      researchOnly: true,
      provider: "api-football",
      providerEndpoint: "/teams/statistics",
      leagueId: LEAGUE_ID,
      season: SEASON,
      kickoffTimeUtc: KICKOFF_UTC,
      providerCallCount: calls.length,
      marketDataUsed: false,
      oddsUsed: false,
      resultDataUsed: false,
      postgameDataUsed: false,
      providerPredictionEndpointUsed: false,
      standingsUsed: false,
      contractRel: CONTRACT_REL,
      contractHash: hashBefore,
    },
    teams: calls,
  };
  const evidence = {
    ...evidenceWithoutHash,
    meta: {
      ...evidenceWithoutHash.meta,
      artifactHash: sha256(evidenceWithoutHash),
    },
  };
  await writeFile(
    path.join(cwd, EVIDENCE_REL),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );

  const byId = new Map(
    calls.map((c) => [c.providerTeamId as number, c] as const),
  );

  function sideCounts(
    teamId: number,
    side: "home" | "away",
  ): {
    fixturesPlayed: number | null;
    wins: number | null;
    goalsFor: number | null;
    goalsAgainst: number | null;
    pregameUsable: boolean;
    error: string | null;
  } {
    const row = byId.get(teamId);
    if (!row) {
      return {
        fixturesPlayed: null,
        wins: null,
        goalsFor: null,
        goalsAgainst: null,
        pregameUsable: false,
        error: "TEAM_ROW_MISSING",
      };
    }
    if (!row.pregameUsable) {
      return {
        fixturesPlayed: null,
        wins: null,
        goalsFor: null,
        goalsAgainst: null,
        pregameUsable: false,
        error: (row.error as string | null) ?? "NOT_PREGAME_USABLE",
      };
    }
    return {
      fixturesPlayed:
        side === "home"
          ? (row.fixturesPlayedHome as number | null)
          : (row.fixturesPlayedAway as number | null),
      wins:
        side === "home"
          ? (row.winsHome as number | null)
          : (row.winsAway as number | null),
      goalsFor:
        side === "home"
          ? (row.goalsForHome as number | null)
          : (row.goalsForAway as number | null),
      goalsAgainst:
        side === "home"
          ? (row.goalsAgainstHome as number | null)
          : (row.goalsAgainstAway as number | null),
      pregameUsable: true,
      error: null,
    };
  }

  const fixtures = [
    {
      fixtureId: "1490449",
      homeName: "Vancouver Whitecaps",
      awayName: "St. Louis City",
      homeTeamId: 1603,
      awayTeamId: 20787,
      home: sideCounts(1603, "home"),
      away: sideCounts(20787, "away"),
    },
    {
      fixtureId: "1490450",
      homeName: "Portland Timbers",
      awayName: "Minnesota United FC",
      homeTeamId: 1617,
      awayTeamId: 1612,
      home: sideCounts(1617, "home"),
      away: sideCounts(1612, "away"),
    },
  ] as const;

  const rows = fixtures.map((fx) => {
    const scored = scoreContextDominance({
      home: {
        fixturesPlayed: fx.home.fixturesPlayed,
        wins: fx.home.wins,
        goalsFor: fx.home.goalsFor,
        goalsAgainst: fx.home.goalsAgainst,
      },
      away: {
        fixturesPlayed: fx.away.fixturesPlayed,
        wins: fx.away.wins,
        goalsFor: fx.away.goalsFor,
        goalsAgainst: fx.away.goalsAgainst,
      },
    });
    const reasonCodes = [...scored.reasonCodes];
    if (!fx.home.pregameUsable || !fx.away.pregameUsable) {
      if (!reasonCodes.includes("INSUFFICIENT_INDEPENDENT_DATA")) {
        reasonCodes.unshift("INSUFFICIENT_INDEPENDENT_DATA");
      }
    }
    return {
      fixtureId: fx.fixtureId,
      homeName: fx.homeName,
      awayName: fx.awayName,
      homeProviderTeamId: String(fx.homeTeamId),
      awayProviderTeamId: String(fx.awayTeamId),
      homeContext: {
        fixturesPlayed: scored.home.contextWinRatePlayed,
        wins: scored.home.contextWinRateWins,
        goalsFor: scored.home.contextGoalDifferenceGoalsFor,
        goalsAgainst: scored.home.contextGoalDifferenceGoalsAgainst,
        contextWinRate: scored.home.contextWinRate,
        contextGoalDifferencePerGame: scored.home.contextGoalDifferencePerGame,
        captureError: fx.home.error,
      },
      awayContext: {
        fixturesPlayed: scored.away.contextWinRatePlayed,
        wins: scored.away.contextWinRateWins,
        goalsFor: scored.away.contextGoalDifferenceGoalsFor,
        goalsAgainst: scored.away.contextGoalDifferenceGoalsAgainst,
        contextWinRate: scored.away.contextWinRate,
        contextGoalDifferencePerGame: scored.away.contextGoalDifferencePerGame,
        captureError: fx.away.error,
      },
      metric1Winner: scored.metric1Winner,
      metric2Winner: scored.metric2Winner,
      decision: scored.decision,
      reasonCodes,
      researchPrototype: true,
      publicRecommendation: false,
    };
  });

  const hashAfter = fileSha256(contractAbs);
  if (hashAfter !== hashBefore) {
    throw new Error(
      `CONTRACT_CHANGED_AFTER_DATA: before=${hashBefore} after=${hashAfter}`,
    );
  }

  const decisionWithoutHash = {
    meta: {
      schemaVersion: "football-independent-decision-v0",
      dateKst: DATE_KST,
      generatedAt: new Date().toISOString(),
      researchOnly: true,
      validatedModel: false,
      publicRecommendation: false,
      engine: "NONE",
      weightModel: "NONE",
      contractRel: CONTRACT_REL,
      contractHash: hashBefore,
      evidenceRel: EVIDENCE_REL,
      evidenceHash: evidence.meta.artifactHash,
      marketDataRead: false,
      oddsInputUsed: false,
      resultDataUsed: false,
      postgameDataUsed: false,
      providerPredictionEndpointUsed: false,
      standingsUsed: false,
      scoringContractCreatedBeforeProviderCall: true,
      scoringContractChangedAfterData: false,
    },
    rows,
  };
  const decision = {
    ...decisionWithoutHash,
    meta: {
      ...decisionWithoutHash.meta,
      artifactHash: sha256(decisionWithoutHash),
    },
  };
  await writeFile(
    path.join(cwd, DECISION_REL),
    `${JSON.stringify(decision, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        providerCaptureStartedAt,
        capturedAtEnd,
        contractHashBefore: hashBefore,
        contractHashAfter: hashAfter,
        evidenceHash: evidence.meta.artifactHash,
        decisionHash: decision.meta.artifactHash,
        allCallsBeforeKickoff: calls.every((c) => c.lateCall === false),
        decisions: rows.map((r) => ({
          fixtureId: r.fixtureId,
          decision: r.decision,
          reasonCodes: r.reasonCodes,
        })),
      },
      null,
      2,
    ),
  );
}

const isDirect = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;
if (isDirect) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
