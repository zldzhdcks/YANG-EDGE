import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisData, StartingPitcher } from "@/types/engine-analysis";
import { MLB_DAILY_RESEARCH_SUMMARY_SCHEMA } from "./mlb-daily-research-summary-types";

export type PredictionBlockedReason =
  | "DAILY_RESEARCH_SUMMARY_MISSING"
  | "SCHEDULE_NOT_READY"
  | "REQUIRED_INPUT_INVALID";

export type PredictionInputStatus = "ELIGIBLE" | "LIMITED_INPUT" | "BLOCKED";

export type MlbPredictionInputManifest = {
  schemaVersion: "mlb-prediction-input-manifest-v1";
  dateKst: string;
  createdAt: string;
  dailySummary: {
    artifact: string;
    schemaVersion: string;
    pipelineVersion: string | null;
    researchReadyPercent: number;
  };
  inputs: {
    schedule: { artifact: string; status: string };
    starter: { artifact: string; status: string };
    odds: { artifact: string; status: string };
    lineup: { artifact: string; status: string };
  };
  cutoffTime: string | null;
  cutoffPolicy: string;
  inputHash: string;
  warnings: string[];
};

export type MlbPredictionConsumerGameInput = {
  gameId: string;
  externalId: string | null;
  dateKst: string;
  startTimeKst: string;
  commenceTimeUtc: string;
  homeTeam: string;
  awayTeam: string;
  analysisData: AnalysisData;
  inputStatus: PredictionInputStatus;
  inputWarnings: string[];
  openingOdds: number | null;
  latestOdds: number | null;
  oddsMovement: string | null;
  homeOdds: number | null;
  awayOdds: number | null;
};

export type MlbPredictionConsumerLoad =
  | {
      kind: "blocked";
      reason: PredictionBlockedReason;
      message: string;
      warnings: string[];
    }
  | {
      kind: "ready";
      dateKst: string;
      createdAt: string;
      predictedAt: string;
      inputManifest: MlbPredictionInputManifest;
      games: MlbPredictionConsumerGameInput[];
      sourceSnapshotVersions: Record<string, string | null>;
    };

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function basenameOnly(v: string | null): string {
  return v ? path.basename(v) : "";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

async function readJson(relOrAbs: string): Promise<unknown | null> {
  const filePath = path.isAbsolute(relOrAbs)
    ? relOrAbs
    : path.join(process.cwd(), relOrAbs);
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function emptyVenue() {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: Number.NaN,
  };
}

function emptyStanding() {
  return {
    rank: Number.NaN,
    played: Number.NaN,
    wins: Number.NaN,
    draws: Number.NaN,
    losses: Number.NaN,
    winningPercentage: Number.NaN,
    gamesBehind: Number.NaN,
  };
}

function groupRowsByGame(rows: unknown[]): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const raw of rows) {
    const row = asRecord(raw);
    const gameId = asString(row?.gameId);
    if (!row || !gameId) continue;
    const list = map.get(gameId) ?? [];
    list.push(row);
    map.set(gameId, list);
  }
  return map;
}

function starterPitcherFromRow(
  row: Record<string, unknown> | null,
): StartingPitcher {
  if (!row) return null;
  const seasonStats = asRecord(row.seasonStats);
  const name = asString(row.probablePitcherName);
  if (!name) return null;
  return {
    name,
    throws: asString(row.throws) === "L" ? "L" : asString(row.throws) === "R" ? "R" : undefined,
    era: asNumber(seasonStats?.era) ?? undefined,
    whip: asNumber(seasonStats?.whip) ?? undefined,
    wins: asNumber(seasonStats?.wins) ?? undefined,
    losses: asNumber(seasonStats?.losses) ?? undefined,
    inningsPitched: asNumber(seasonStats?.inningsPitched) ?? undefined,
    strikeouts: asNumber(seasonStats?.strikeOuts) ?? undefined,
    note: asString(row.probableStatus) ?? undefined,
  };
}

function getDatasetEntry(
  summary: Record<string, unknown>,
  dataset: string,
): { status: string; artifact: string | null } {
  const ready = asRecord(summary.researchReady);
  const datasets = Array.isArray(ready?.datasets) ? ready?.datasets : [];
  for (const raw of datasets) {
    const row = asRecord(raw);
    if (asString(row?.dataset) === dataset) {
      return {
        status: asString(row?.status) ?? "FAILED",
        artifact: asString(row?.artifact),
      };
    }
  }
  const sourceArtifacts = Array.isArray(summary.sourceArtifacts)
    ? summary.sourceArtifacts
    : [];
  for (const raw of sourceArtifacts) {
    const row = asRecord(raw);
    if (asString(row?.dataset) === dataset) {
      return {
        status: asString(row?.status) ?? "FAILED",
        artifact: asString(row?.artifact),
      };
    }
  }
  return { status: "FAILED", artifact: null };
}

function derivePredictedAt(candidates: Array<string | null>): string {
  const values = candidates
    .map((v) => (v ? Date.parse(v) : Number.NaN))
    .filter((v) => Number.isFinite(v));
  if (values.length === 0) return new Date(0).toISOString();
  return new Date(Math.max(...values)).toISOString();
}

function extractMoneylineOdds(row: Record<string, unknown> | null): {
  homeOdds: number | null;
  awayOdds: number | null;
} {
  if (!row) return { homeOdds: null, awayOdds: null };
  const markets = Array.isArray(row.markets) ? row.markets : [];
  let homeOdds: number | null = null;
  let awayOdds: number | null = null;
  for (const raw of markets) {
    const market = asRecord(raw);
    if (asString(market?.marketType) !== "moneyline") continue;
    const selection = asString(market?.selection);
    const price = asNumber(market?.priceDecimal);
    if (selection === "home" && price != null) homeOdds = price;
    if (selection === "away" && price != null) awayOdds = price;
  }
  return { homeOdds, awayOdds };
}

function buildAnalysisData(game: Record<string, unknown>, starterRows: {
  home: Record<string, unknown> | null;
  away: Record<string, unknown> | null;
}): AnalysisData {
  const homeTeam = asString(game.homeTeam) ?? "";
  const awayTeam = asString(game.awayTeam) ?? "";
  const gameId = asString(game.internalGameId) ?? "";
  const dateKst = asString(game.officialDate) ?? "";
  const startTimeKst = asString(game.startTimeKst) ?? "";
  return {
    gameId,
    sport: "baseball",
    league: asString(game.league) ?? "MLB",
    homeTeam,
    awayTeam,
    date: dateKst,
    startTime: startTimeKst,
    home: {
      teamName: homeTeam,
      recentGames: [],
      homeRecord: emptyVenue(),
      awayRecord: emptyVenue(),
      leagueStanding: emptyStanding(),
      scoringAverages: { scoredAvg: Number.NaN, concededAvg: Number.NaN },
      recentForm: { sequence: "", last5: [] },
      winRate: Number.NaN,
      streak: { type: "none", count: 0 },
      injuries: [],
      restDays: Number.NaN,
      startingPitcher: starterPitcherFromRow(starterRows.home),
    },
    away: {
      teamName: awayTeam,
      recentGames: [],
      homeRecord: emptyVenue(),
      awayRecord: emptyVenue(),
      leagueStanding: emptyStanding(),
      scoringAverages: { scoredAvg: Number.NaN, concededAvg: Number.NaN },
      recentForm: { sequence: "", last5: [] },
      winRate: Number.NaN,
      streak: { type: "none", count: 0 },
      injuries: [],
      restDays: Number.NaN,
      startingPitcher: starterPitcherFromRow(starterRows.away),
    },
    headToHead: {
      played: 0,
      homeTeamWins: 0,
      awayTeamWins: 0,
      draws: 0,
      recentMeetings: [],
    },
  };
}

function compareIsoTimes(left: string | null, right: string | null): number | null {
  if (!left || !right) return null;
  const l = Date.parse(left);
  const r = Date.parse(right);
  if (!Number.isFinite(l) || !Number.isFinite(r)) return null;
  return l - r;
}

function sortAndUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export async function loadMlbPredictionConsumerInput(
  dateKst: string,
): Promise<MlbPredictionConsumerLoad> {
  const summaryRel = `data/research/mlb/${dateKst}-daily-research-summary-v1.json`;
  const createdAt = new Date().toISOString();
  const summaryRaw = await readJson(summaryRel);
  if (!summaryRaw) {
    return {
      kind: "blocked",
      reason: "DAILY_RESEARCH_SUMMARY_MISSING",
      message: `Prediction blocked:\nDaily Research Summary not found.\n\nRun first:\nnpm run research:mlb-daily -- ${dateKst}`,
      warnings: [],
    };
  }

  const summary = asRecord(summaryRaw);
  const schemaVersion = asString(summary?.schemaVersion);
  if (!summary || schemaVersion !== MLB_DAILY_RESEARCH_SUMMARY_SCHEMA) {
    return {
      kind: "blocked",
      reason: "REQUIRED_INPUT_INVALID",
      message: "Prediction blocked:\nDaily Research Summary is invalid or unsupported.",
      warnings: ["DAILY_RESEARCH_SUMMARY_INVALID"],
    };
  }

  const scheduleRef = getDatasetEntry(summary, "Schedule");
  const starterRef = getDatasetEntry(summary, "Starter");
  const oddsRef = getDatasetEntry(summary, "Odds");
  const lineupRef = getDatasetEntry(summary, "Lineup");

  if (scheduleRef.status === "FAILED" || !scheduleRef.artifact) {
    return {
      kind: "blocked",
      reason: "SCHEDULE_NOT_READY",
      message: "Prediction blocked:\nSchedule is not ready in Daily Research Summary.",
      warnings: ["SCHEDULE_NOT_READY"],
    };
  }

  if (!starterRef.artifact || !oddsRef.artifact || !lineupRef.artifact) {
    return {
      kind: "blocked",
      reason: "REQUIRED_INPUT_INVALID",
      message: "Prediction blocked:\nRequired input artifact is missing from Daily Research Summary.",
      warnings: ["REQUIRED_INPUT_MISSING"],
    };
  }

  const [scheduleRaw, starterRaw, oddsRaw, lineupRaw] = await Promise.all([
    readJson(scheduleRef.artifact),
    readJson(starterRef.artifact),
    readJson(oddsRef.artifact),
    readJson(lineupRef.artifact),
  ]);
  const scheduleDoc = asRecord(scheduleRaw);
  const starterDoc = asRecord(starterRaw);
  const oddsDoc = asRecord(oddsRaw);
  const lineupDoc = asRecord(lineupRaw);

  if (!scheduleDoc || !starterDoc || !oddsDoc || !lineupDoc) {
    return {
      kind: "blocked",
      reason: "REQUIRED_INPUT_INVALID",
      message: "Prediction blocked:\nRequired research artifact failed to load or parse.",
      warnings: ["REQUIRED_INPUT_INVALID"],
    };
  }

  const scheduleGames = Array.isArray(scheduleDoc.games) ? scheduleDoc.games : [];
  const starterRows = Array.isArray(starterDoc.rows) ? starterDoc.rows : [];
  const oddsRows = Array.isArray(oddsDoc.rows) ? oddsDoc.rows : [];
  const lineupRows = Array.isArray(lineupDoc.rows) ? lineupDoc.rows : [];
  if (scheduleGames.length === 0) {
    return {
      kind: "blocked",
      reason: "SCHEDULE_NOT_READY",
      message: "Prediction blocked:\nSchedule artifact has no games.",
      warnings: ["SCHEDULE_EMPTY"],
    };
  }

  const starterSummary = asRecord(starterDoc.summary);
  if (
    (asNumber(starterSummary?.targetGameIncludedInStats) ?? 0) > 0 ||
    (asNumber(starterSummary?.cutoffViolations) ?? 0) > 0
  ) {
    return {
      kind: "blocked",
      reason: "REQUIRED_INPUT_INVALID",
      message: "Prediction blocked:\nStarter artifact failed cutoff validation.",
      warnings: ["STARTER_CUTOFF_VALIDATION_FAILED"],
    };
  }

  const starterByGame = groupRowsByGame(starterRows);
  const lineupByGame = groupRowsByGame(lineupRows);
  const oddsByGame = new Map<string, Record<string, unknown>>();
  for (const raw of oddsRows) {
    const row = asRecord(raw);
    const gameId = asString(row?.gameId);
    if (row && gameId) oddsByGame.set(gameId, row);
  }

  const manifestWarnings: string[] = [];
  if (starterRef.status !== "READY") manifestWarnings.push(`STARTER_DATASET_${starterRef.status}`);
  if (oddsRef.status !== "READY") manifestWarnings.push(`ODDS_DATASET_${oddsRef.status}`);
  if (lineupRef.status !== "READY") manifestWarnings.push(`LINEUP_DATASET_${lineupRef.status}`);

  const sourceSnapshotVersions: Record<string, string | null> = {
    dailySummary: schemaVersion,
    schedule: asString(asRecord(scheduleDoc.meta)?.schemaVersion),
    starter: asString(asRecord(starterDoc.meta)?.schemaVersion),
    odds: asString(asRecord(oddsDoc.meta)?.schemaVersion),
    lineup: asString(asRecord(lineupDoc.meta)?.schemaVersion),
  };

  const predictedAt = derivePredictedAt([
    asString(summary.generatedAt),
    asString(asRecord(scheduleDoc.meta)?.generatedAt),
    asString(asRecord(starterDoc.meta)?.generatedAt),
    asString(asRecord(oddsDoc.meta)?.generatedAt),
    asString(asRecord(lineupDoc.meta)?.generatedAt),
  ]);

  const games: MlbPredictionConsumerGameInput[] = [];
  for (const rawGame of scheduleGames) {
    const game = asRecord(rawGame);
    const gameId = asString(game?.internalGameId);
    const commenceTimeUtc = asString(game?.commenceTimeUtc);
    if (!game || !gameId || !commenceTimeUtc) continue;

    const warnings: string[] = [];
    let inputStatus: PredictionInputStatus = "ELIGIBLE";

    const starterGameRows = starterByGame.get(gameId) ?? [];
    const starterHome =
      starterGameRows.find((row) => asString(row.side) === "home") ?? null;
    const starterAway =
      starterGameRows.find((row) => asString(row.side) === "away") ?? null;

    const hasHomeStarterId = asNumber(starterHome?.probablePitcherId) != null;
    const hasAwayStarterId = asNumber(starterAway?.probablePitcherId) != null;
    if (!starterHome && !starterAway) {
      inputStatus = "BLOCKED";
      warnings.push("STARTER_NOT_COLLECTED");
    } else if (!hasHomeStarterId && !hasAwayStarterId) {
      inputStatus = "BLOCKED";
      warnings.push("STARTER_IDENTITY_MISSING_BOTH_SIDES");
    } else if (!hasHomeStarterId || !hasAwayStarterId) {
      inputStatus = "LIMITED_INPUT";
      warnings.push("STARTER_IDENTITY_PARTIAL");
    }

    const lineupGameRows = lineupByGame.get(gameId) ?? [];
    const confirmedLineups =
      lineupGameRows.length >= 2 &&
      lineupGameRows.every(
        (row) =>
          asString(row.collectionStatus) === "CONFIRMED" &&
          asString(row.lineupStatus) === "COMPLETE",
      );
    if (!confirmedLineups) {
      if (inputStatus !== "BLOCKED") inputStatus = "LIMITED_INPUT";
      warnings.push(
        lineupGameRows.length === 0 ? "LINEUP_NOT_COLLECTED" : "LINEUP_NOT_CONFIRMED",
      );
    }
    for (const row of lineupGameRows) {
      const sourceTimestamp = asString(row.sourceTimestamp);
      const cmp = compareIsoTimes(sourceTimestamp, asString(row.cutoffTime));
      if (cmp != null && cmp >= 0) {
        inputStatus = "BLOCKED";
        warnings.push("LINEUP_AFTER_CUTOFF");
        break;
      }
    }

    const oddsRow = oddsByGame.get(gameId) ?? null;
    const { homeOdds, awayOdds } = extractMoneylineOdds(oddsRow);
    const oddsCollected = asString(oddsRow?.collectionStatus) === "COLLECTED";
    if (!oddsCollected || homeOdds == null || awayOdds == null) {
      if (inputStatus !== "BLOCKED") inputStatus = "LIMITED_INPUT";
      warnings.push(!oddsRow ? "ODDS_NOT_COLLECTED" : "MARKET_NOT_AVAILABLE");
    }
    const oddsCapturedAt = asString(oddsRow?.capturedAt);
    const oddsCutoff = asString(oddsRow?.cutoffTime);
    const oddsCmp = compareIsoTimes(oddsCapturedAt, oddsCutoff);
    if (oddsCmp != null && oddsCmp >= 0) {
      inputStatus = "BLOCKED";
      warnings.push("ODDS_AFTER_CUTOFF");
    }

    const analysisData = buildAnalysisData(game, {
      home: starterHome,
      away: starterAway,
    });

    games.push({
      gameId,
      externalId: gameId.replace(/^mlb-/, "") || null,
      dateKst: asString(summary.dateKst) ?? dateKst,
      startTimeKst: asString(game.startTimeKst) ?? "",
      commenceTimeUtc,
      homeTeam: asString(game.homeTeam) ?? "",
      awayTeam: asString(game.awayTeam) ?? "",
      analysisData,
      inputStatus,
      inputWarnings: sortAndUnique(warnings),
      openingOdds: asNumber(oddsRow?.openingOdds),
      latestOdds: asNumber(oddsRow?.latestOdds),
      oddsMovement: asString(oddsRow?.movement),
      homeOdds,
      awayOdds,
    });
  }

  games.sort((a, b) => a.gameId.localeCompare(b.gameId));

  const inputManifestBase = {
    schemaVersion: "mlb-prediction-input-manifest-v1" as const,
    dateKst,
    dailySummary: {
      artifact: basenameOnly(summaryRel),
      schemaVersion,
      pipelineVersion: asString(summary.pipelineVersion),
      researchReadyPercent: asNumber(asRecord(summary.researchReady)?.percent) ?? 0,
    },
    inputs: {
      schedule: {
        artifact: basenameOnly(scheduleRef.artifact),
        status: scheduleRef.status,
      },
      starter: {
        artifact: basenameOnly(starterRef.artifact),
        status: starterRef.status,
      },
      odds: {
        artifact: basenameOnly(oddsRef.artifact),
        status: oddsRef.status,
      },
      lineup: {
        artifact: basenameOnly(lineupRef.artifact),
        status: lineupRef.status,
      },
    },
    cutoffTime: games.reduce<string | null>((max, game) => {
      if (!max) return game.commenceTimeUtc;
      return Date.parse(game.commenceTimeUtc) > Date.parse(max)
        ? game.commenceTimeUtc
        : max;
    }, null),
    cutoffPolicy: "per-game commenceTimeUtc validation across Schedule/Starter/Odds/Lineup artifacts",
    warnings: sortAndUnique(
      manifestWarnings.concat(
        games
          .filter((game) => game.inputStatus !== "ELIGIBLE")
          .map((game) => `${game.gameId}:${game.inputStatus}`),
      ),
    ),
    games: games.map((game) => ({
      gameId: game.gameId,
      commenceTimeUtc: game.commenceTimeUtc,
      inputStatus: game.inputStatus,
      inputWarnings: game.inputWarnings,
      starters: {
        home: game.analysisData.home.startingPitcher,
        away: game.analysisData.away.startingPitcher,
      },
      odds: {
        homeOdds: game.homeOdds,
        awayOdds: game.awayOdds,
        openingOdds: game.openingOdds,
        latestOdds: game.latestOdds,
      },
    })),
  };

  const inputManifest: MlbPredictionInputManifest = {
    schemaVersion: inputManifestBase.schemaVersion,
    dateKst,
    createdAt,
    dailySummary: inputManifestBase.dailySummary,
    inputs: inputManifestBase.inputs,
    cutoffTime: inputManifestBase.cutoffTime,
    cutoffPolicy: inputManifestBase.cutoffPolicy,
    inputHash: sha256(inputManifestBase),
    warnings: inputManifestBase.warnings,
  };

  return {
    kind: "ready",
    dateKst,
    createdAt,
    predictedAt,
    inputManifest,
    games,
    sourceSnapshotVersions,
  };
}
