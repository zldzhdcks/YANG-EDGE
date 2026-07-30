import { readFile } from "node:fs/promises";
import { loadMlbScheduleArtifact, writeJsonAtomic } from "./build-mlb-schedule-artifact";
import {
  MLB_GRADED_PREDICTIONS_SCHEMA,
  MLB_GRADING_POLICY_VERSION,
  type MatchStatus,
  type MlbGradedPredictionGame,
  type MlbGradedPredictionsDocument,
  type MlbOfficialResultsDocument,
  type PredictionGrade,
} from "./mlb-prediction-review-types";
import {
  absFromRel,
  mlbGradedPredictionsRel,
  mlbOfficialResultsRel,
  mlbPredictionSnapshotRel,
} from "./mlb-prediction-review-paths";
import { sha256 } from "./mlb-review-hash";
import {
  asRecord,
  asString,
  computeAccuracy,
  computePredictionContentHash,
  isNoPickStatus,
  resolvePickSide,
} from "./mlb-review-utils";

type PredictionRow = Record<string, unknown>;

type ScheduleIndex = {
  byInternalId: Map<string, { gamePk: number; homeTeam: string; awayTeam: string }>;
  duplicateInternalIds: Set<string>;
  byGamePk: Map<number, string>;
  byTeams: Map<string, number[]>;
};

function teamKey(dateKst: string, homeTeam: string, awayTeam: string): string {
  return `${dateKst}|${homeTeam.trim().toLowerCase()}|${awayTeam.trim().toLowerCase()}`;
}

function buildScheduleIndex(
  dateKst: string,
  schedule: Awaited<ReturnType<typeof loadMlbScheduleArtifact>>,
): ScheduleIndex {
  const byInternalId = new Map<
    string,
    { gamePk: number; homeTeam: string; awayTeam: string }
  >();
  const duplicateInternalIds = new Set<string>();
  const byGamePk = new Map<number, string>();
  const byTeams = new Map<string, number[]>();

  for (const g of schedule.games) {
    if (byInternalId.has(g.internalGameId)) {
      duplicateInternalIds.add(g.internalGameId);
    }
    byInternalId.set(g.internalGameId, {
      gamePk: g.gamePk,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
    });
    byGamePk.set(g.gamePk, g.internalGameId);
    const key = teamKey(dateKst, g.homeTeam, g.awayTeam);
    const list = byTeams.get(key) ?? [];
    list.push(g.gamePk);
    byTeams.set(key, list);
  }

  return { byInternalId, duplicateInternalIds, byGamePk, byTeams };
}

function resolveGamePk(
  pred: PredictionRow,
  dateKst: string,
  index: ScheduleIndex,
): { gamePk: number | null; matchStatus: MatchStatus; warnings: string[] } {
  const warnings: string[] = [];
  const gameId = asString(pred.gameId);
  const homeTeam = asString(pred.homeTeam) ?? "";
  const awayTeam = asString(pred.awayTeam) ?? "";

  if (gameId && index.byInternalId.has(gameId)) {
    if (index.duplicateInternalIds.has(gameId)) {
      return {
        gamePk: null,
        matchStatus: "DUPLICATE_MATCH",
        warnings: [
          "schedule artifact contains duplicate internalGameId for this game",
        ],
      };
    }
    const row = index.byInternalId.get(gameId)!;
    if (
      row.homeTeam !== homeTeam ||
      row.awayTeam !== awayTeam
    ) {
      return {
        gamePk: row.gamePk,
        matchStatus: "ID_MISMATCH",
        warnings: [
          "schedule internalGameId matched but home/away team names differ from prediction",
        ],
      };
    }
    return { gamePk: row.gamePk, matchStatus: "MATCHED", warnings };
  }

  const teamMatches = index.byTeams.get(teamKey(dateKst, homeTeam, awayTeam)) ?? [];
  if (teamMatches.length === 1) {
  warnings.push("matched by date+home+away fallback");
    return { gamePk: teamMatches[0]!, matchStatus: "MATCHED", warnings };
  }
  if (teamMatches.length > 1) {
    return {
      gamePk: null,
      matchStatus: "DUPLICATE_MATCH",
      warnings: ["multiple schedule rows for date+home+away"],
    };
  }

  return {
    gamePk: null,
    matchStatus: "RESULT_MISSING",
    warnings: ["no schedule match for prediction gameId or teams"],
  };
}

function gradePick(
  pick: "HOME" | "AWAY" | null,
  result: MlbOfficialResultsDocument["games"][number] | undefined,
): PredictionGrade {
  if (!result) return "PENDING";
  if (result.status === "POSTPONED" || result.status === "CANCELLED") {
    return "VOID";
  }
  if (result.status === "SUSPENDED") return "VOID";
  if (result.status !== "FINAL") return "PENDING";
  if (!pick) return "NO_PICK";
  if (result.winner === "DRAW" || result.winner == null) return "VOID";
  if (pick === result.winner) return "CORRECT";
  return "INCORRECT";
}

export async function gradeMlbPredictionsV1(input: {
  dateKst: string;
  cwd?: string;
  results?: MlbOfficialResultsDocument;
}): Promise<{
  document: MlbGradedPredictionsDocument;
  pathRel: string;
}> {
  const cwd = input.cwd ?? process.cwd();
  const predictionRel = mlbPredictionSnapshotRel(input.dateKst);
  const predictionPath = absFromRel(predictionRel, cwd);
  const predictionRaw = await readFile(predictionPath, "utf8");
  const prediction = JSON.parse(predictionRaw) as Record<string, unknown>;
  const predictionHash = computePredictionContentHash(prediction);
  const predictions = (
    Array.isArray(prediction.predictions) ? prediction.predictions : []
  ) as PredictionRow[];

  const resultRel = mlbOfficialResultsRel(input.dateKst);
  let results = input.results;
  if (!results) {
    const resultRaw = await readFile(absFromRel(resultRel, cwd), "utf8");
    results = JSON.parse(resultRaw) as MlbOfficialResultsDocument;
  }

  if (results.resultHash) {
    const hashBody = {
      schemaVersion: results.schemaVersion,
      dateKst: results.dateKst,
      provider: results.provider,
      scheduleArtifact: results.scheduleArtifact,
      games: results.games,
    };
    const expected = sha256(hashBody);
    if (expected !== results.resultHash) {
      throw new Error(
        `RESULT_HASH_MISMATCH: artifact hash does not match recomputed hash`,
      );
    }
  }

  const schedule = await loadMlbScheduleArtifact(input.dateKst, cwd);
  const index = buildScheduleIndex(input.dateKst, schedule);
  const resultByPk = new Map(results.games.map((g) => [g.gamePk, g]));

  const games: MlbGradedPredictionGame[] = [];
  let eligiblePredictions = 0;
  let limitedInputPredictions = 0;
  let blocked = 0;
  let noPick = 0;
  let graded = 0;
  let correct = 0;
  let incorrect = 0;
  let pending = 0;
  let voidCount = 0;
  let matchErrors = 0;

  let eligibleCorrect = 0;
  let eligibleIncorrect = 0;
  let limitedCorrect = 0;
  let limitedIncorrect = 0;

  for (const pred of predictions) {
    const inputStatus = asString(pred.inputStatus) ?? "UNKNOWN";
    const baselineStatus = asString(pred.baselineStatus);
    const baselinePick = asString(pred.baselinePick);
    const inputWarnings = Array.isArray(pred.inputWarnings)
      ? pred.inputWarnings.map((w) => String(w))
      : [];
    const homeTeam = asString(pred.homeTeam) ?? "";
    const awayTeam = asString(pred.awayTeam) ?? "";
    const gameId = asString(pred.gameId) ?? "";

    if (inputStatus === "ELIGIBLE") eligiblePredictions += 1;
    if (inputStatus === "LIMITED_INPUT") limitedInputPredictions += 1;
    if (inputStatus === "BLOCKED") blocked += 1;

    const { gamePk, matchStatus, warnings } = resolveGamePk(
      pred,
      input.dateKst,
      index,
    );

    let grade: PredictionGrade;
    let actualWinner: "HOME" | "AWAY" | "DRAW" | null = null;
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let effectiveMatchStatus = matchStatus;

    if (inputStatus === "BLOCKED") {
      grade = "BLOCKED";
    } else if (isNoPickStatus(baselineStatus) || !baselinePick) {
      grade = "NO_PICK";
      noPick += 1;
    } else if (
      matchStatus === "ID_MISMATCH" ||
      matchStatus === "DUPLICATE_MATCH"
    ) {
      grade = "MATCH_ERROR";
      matchErrors += 1;
    } else {
      const result = gamePk != null ? resultByPk.get(gamePk) : undefined;
      if (!result) {
        effectiveMatchStatus = "RESULT_MISSING";
        grade = "PENDING";
        pending += 1;
      } else if (result.status !== "FINAL") {
        effectiveMatchStatus = "RESULT_NOT_FINAL";
        grade = "PENDING";
        pending += 1;
      } else {
        actualWinner = result.winner;
        homeScore = result.homeScore;
        awayScore = result.awayScore;
        const pick = resolvePickSide(baselinePick, homeTeam, awayTeam);
        if (!pick) {
          grade = "MATCH_ERROR";
          matchErrors += 1;
          warnings.push("baselinePick does not resolve to HOME or AWAY");
        } else {
          grade = gradePick(pick, result);
          if (grade === "CORRECT") {
            graded += 1;
            correct += 1;
            if (inputStatus === "ELIGIBLE") eligibleCorrect += 1;
            if (inputStatus === "LIMITED_INPUT") limitedCorrect += 1;
          } else if (grade === "INCORRECT") {
            graded += 1;
            incorrect += 1;
            if (inputStatus === "ELIGIBLE") eligibleIncorrect += 1;
            if (inputStatus === "LIMITED_INPUT") limitedIncorrect += 1;
          } else if (grade === "PENDING") {
            pending += 1;
          } else if (grade === "VOID") {
            voidCount += 1;
          }
        }
      }
    }

    const pickSide = resolvePickSide(baselinePick, homeTeam, awayTeam);

    games.push({
      gamePk,
      gameId,
      matchStatus: effectiveMatchStatus,
      inputStatus,
      pick: pickSide,
      pickTeam: baselinePick,
      actualWinner,
      homeScore,
      awayScore,
      grade,
      predictionProbability: typeof pred.modelProbability === "number"
        ? pred.modelProbability / 100
        : null,
      baselineStatus,
      inputWarnings,
      warnings,
    });
  }

  const accuracy = computeAccuracy(correct, incorrect);
  const eligibleAccuracy = computeAccuracy(eligibleCorrect, eligibleIncorrect);
  const limitedInputAccuracy = computeAccuracy(limitedCorrect, limitedIncorrect);

  const hashBody = {
    schemaVersion: MLB_GRADED_PREDICTIONS_SCHEMA,
    dateKst: input.dateKst,
    predictionArtifact: `${input.dateKst}.json`,
    predictionHash,
    resultArtifact: `${input.dateKst}-official-results-v1.json`,
    resultHash: results.resultHash,
    gradingPolicyVersion: MLB_GRADING_POLICY_VERSION,
    summary: {
      totalGames: games.length,
      eligiblePredictions,
      limitedInputPredictions,
      blocked,
      noPick,
      graded,
      correct,
      incorrect,
      pending,
      void: voidCount,
      matchErrors,
      accuracy: {
        ...accuracy,
        exclusionPolicy:
          "correct / (correct + incorrect); excludes PENDING, VOID, BLOCKED, NO_PICK, MATCH_ERROR",
      },
      eligibleAccuracy,
      limitedInputAccuracy,
    },
    games,
  };

  const document: MlbGradedPredictionsDocument = {
    ...hashBody,
    generatedAt: new Date().toISOString(),
    games,
  };

  const pathRel = mlbGradedPredictionsRel(input.dateKst);
  await writeJsonAtomic(absFromRel(pathRel, cwd), document);

  return { document, pathRel };
}
