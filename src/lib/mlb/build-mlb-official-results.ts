import {
  loadMlbScheduleArtifact,
  writeJsonAtomic,
} from "./build-mlb-schedule-artifact";
import {
  MLB_OFFICIAL_RESULTS_SCHEMA,
  type MlbOfficialResultGame,
  type MlbOfficialResultsDocument,
  type OfficialResultStatus,
} from "./mlb-prediction-review-types";
import {
  absFromRel,
  mlbOfficialResultsRel,
} from "./mlb-prediction-review-paths";
import { sha256 } from "./mlb-review-hash";
import { asNumber, asRecord, asString } from "./mlb-review-utils";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "./research-stats-cache";

function mapAbstractState(state: string | null): OfficialResultStatus {
  const s = (state ?? "").trim();
  if (s === "Final") return "FINAL";
  if (s === "Postponed") return "POSTPONED";
  if (s === "Cancelled" || s === "Canceled") return "CANCELLED";
  if (s === "Suspended") return "SUSPENDED";
  if (s === "Preview" || s === "Live" || s === "Warmup") return "NOT_FINAL";
  if (!s) return "UNKNOWN";
  return "UNKNOWN";
}

type ScheduleGameSnapshot = {
  abstractGameState: string | null;
  detailedState: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

async function getScheduleGameSnapshot(
  gamePk: number,
  usage: CacheUsageStats,
): Promise<ScheduleGameSnapshot> {
  const body = await getRawStatsJson(
    `/api/v1/schedule?sportId=1&gamePk=${gamePk}`,
    usage,
  );
  const root = asRecord(body);
  const dates = Array.isArray(root?.dates) ? root!.dates : [];
  for (const day of dates) {
    const games = Array.isArray(asRecord(day)?.games)
      ? (asRecord(day)!.games as unknown[])
      : [];
    for (const raw of games) {
      const row = asRecord(raw);
      if (asNumber(row?.gamePk) !== gamePk) continue;
      const status = asRecord(row?.status);
      const teams = asRecord(row?.teams);
      const home = asRecord(teams?.home);
      const away = asRecord(teams?.away);
      return {
        abstractGameState: asString(status?.abstractGameState),
        detailedState: asString(status?.detailedState),
        homeScore: asNumber(home?.score),
        awayScore: asNumber(away?.score),
      };
    }
  }
  return {
    abstractGameState: null,
    detailedState: null,
    homeScore: null,
    awayScore: null,
  };
}

function extractScoresFromBoxscore(body: unknown): {
  homeScore: number | null;
  awayScore: number | null;
} {
  const root = asRecord(body);
  const teams = asRecord(root?.teams);
  const home = asRecord(teams?.home);
  const away = asRecord(teams?.away);
  const homeBatting = asRecord(asRecord(home?.teamStats)?.batting);
  const awayBatting = asRecord(asRecord(away?.teamStats)?.batting);
  return {
    homeScore: asNumber(homeBatting?.runs),
    awayScore: asNumber(awayBatting?.runs),
  };
}

function scoresLookEmpty(
  homeScore: number | null,
  awayScore: number | null,
): boolean {
  return (
    homeScore == null ||
    awayScore == null ||
    (homeScore === 0 && awayScore === 0)
  );
}

function resolveWinner(
  homeScore: number | null,
  awayScore: number | null,
): "HOME" | "AWAY" | "DRAW" | null {
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return "HOME";
  if (awayScore > homeScore) return "AWAY";
  return "DRAW";
}

export async function buildMlbOfficialResultsV1(input: {
  dateKst: string;
  cwd?: string;
  usage?: CacheUsageStats;
}): Promise<{
  document: MlbOfficialResultsDocument;
  pathRel: string;
  usage: CacheUsageStats;
}> {
  const cwd = input.cwd ?? process.cwd();
  const usage = input.usage ?? createCacheUsage();
  const schedule = await loadMlbScheduleArtifact(input.dateKst, cwd);
  const scheduleArtifact = `${input.dateKst}-schedule-v1.json`;
  const collectedAt = new Date().toISOString();

  const games: MlbOfficialResultGame[] = [];

  for (const row of schedule.games) {
    const snap = await getScheduleGameSnapshot(row.gamePk, usage);
    const status = mapAbstractState(snap.abstractGameState);

    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let resultTimestamp: string | null = null;

    if (status === "FINAL") {
      // Prefer live schedule scores — boxscore disk cache may be a pre-game empty shell.
      homeScore = snap.homeScore;
      awayScore = snap.awayScore;

      if (scoresLookEmpty(homeScore, awayScore)) {
        const box = await getRawStatsJson(
          `/api/v1/game/${row.gamePk}/boxscore`,
          usage,
        );
        const boxScores = extractScoresFromBoxscore(box);
        if (!scoresLookEmpty(boxScores.homeScore, boxScores.awayScore)) {
          homeScore = boxScores.homeScore;
          awayScore = boxScores.awayScore;
        }
      }

      resultTimestamp = collectedAt;
    }

    games.push({
      gamePk: row.gamePk,
      internalGameId: row.internalGameId,
      status,
      awayTeam: row.awayTeam,
      homeTeam: row.homeTeam,
      awayScore,
      homeScore,
      winner: resolveWinner(homeScore, awayScore),
      resultTimestamp,
    });
  }

  games.sort((a, b) => a.gamePk - b.gamePk);

  const hashBody = {
    schemaVersion: MLB_OFFICIAL_RESULTS_SCHEMA,
    dateKst: input.dateKst,
    provider: "mlb-stats-api" as const,
    scheduleArtifact,
    games,
  };

  const document: MlbOfficialResultsDocument = {
    ...hashBody,
    generatedAt: collectedAt,
    resultHash: sha256(hashBody),
    games,
  };

  const pathRel = mlbOfficialResultsRel(input.dateKst);
  await writeJsonAtomic(absFromRel(pathRel, cwd), document);

  return { document, pathRel, usage };
}
