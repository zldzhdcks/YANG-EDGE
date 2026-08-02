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
  type ResearchGradeResult,
} from "./mlb-prediction-review-types";
import {
  absFromRel,
  mlbGradedPredictionsRel,
  mlbOfficialResultsRel,
  mlbPredictionSnapshotRel,
} from "./mlb-prediction-review-paths";
import { sha256 } from "./mlb-review-hash";
import {
  asNumber,
  asRecord,
  asString,
  computeAccuracy,
  isNoPickStatus,
  resolvePickSide,
} from "./mlb-review-utils";
import {
  detectPredictionContract,
  verifyPredictionHash,
} from "./prediction-contract-v1";
import { brierHome, logLossHomeAway, mean } from "./scorecard-v0/metrics";

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

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
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
    if (row.homeTeam !== homeTeam || row.awayTeam !== awayTeam) {
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

  const teamMatches =
    index.byTeams.get(teamKey(dateKst, homeTeam, awayTeam)) ?? [];
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

function toResearchResult(grade: PredictionGrade): ResearchGradeResult {
  if (grade === "CORRECT") return "CORRECT";
  if (grade === "INCORRECT") return "INCORRECT";
  if (grade === "VOID") return "VOID";
  if (grade === "PENDING") return "PENDING";
  return "NOT_GRADED";
}

function extractResearchSelection(pred: PredictionRow): {
  selection: "HOME" | "AWAY" | null;
  probability: number | null;
  homeP: number | null;
  awayP: number | null;
  marketType: "MONEYLINE_2WAY" | null;
} {
  const mps = asArr(pred.marketPredictions)
    .map((m) => asRecord(m))
    .filter(Boolean) as Record<string, unknown>[];
  const mp =
    mps.find((m) => asString(m.marketType) === "MONEYLINE_2WAY") ?? mps[0];
  if (!mp) {
    const homeTeam = asString(pred.homeTeam) ?? "";
    const awayTeam = asString(pred.awayTeam) ?? "";
    const side = resolvePickSide(asString(pred.baselinePick), homeTeam, awayTeam);
    const modelPct = asNumber(pred.modelProbability);
    const prob =
      modelPct != null ? (modelPct > 1 ? modelPct / 100 : modelPct) : null;
    return {
      selection: side,
      probability: prob,
      homeP: null,
      awayP: null,
      marketType: null,
    };
  }
  const rb = asRecord(mp.researchBaseline);
  const sel = asString(rb?.selection);
  const selection =
    sel === "HOME" || sel === "AWAY"
      ? sel
      : resolvePickSide(
          asString(pred.baselinePick),
          asString(pred.homeTeam) ?? "",
          asString(pred.awayTeam) ?? "",
        );
  const homeP = asNumber(mp.homeProbability);
  const awayP = asNumber(mp.awayProbability);
  const probability =
    asNumber(rb?.probability) ??
    (selection === "HOME" ? homeP : selection === "AWAY" ? awayP : null);
  return {
    selection,
    probability,
    homeP,
    awayP,
    marketType: "MONEYLINE_2WAY",
  };
}

function accuracyOrNa(
  correct: number,
  incorrect: number,
  empty: "NO_GRADED_SAMPLE" | "N/A",
): {
  numerator: number;
  denominator: number;
  percent: number | null;
  status: "OK" | "NO_GRADED_SAMPLE" | "N/A";
} {
  const base = computeAccuracy(correct, incorrect);
  if (base.denominator === 0) {
    return { ...base, status: empty };
  }
  return base;
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
  const contract = detectPredictionContract(prediction);
  const hashVerify = verifyPredictionHash(prediction);
  const predictionHash =
    hashVerify.storedHash ?? hashVerify.recomputedHash ?? "";
  const meta = asRecord(prediction.meta) ?? {};
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

  let researchCandidates = 0;
  let researchGraded = 0;
  let researchCorrect = 0;
  let researchIncorrect = 0;
  const researchBriers: number[] = [];
  const researchLogLosses: number[] = [];

  let officialSampleCount = 0;
  let officialGraded = 0;
  let officialCorrect = 0;
  let officialIncorrect = 0;

  const isV0 = contract === "RESEARCH_BASELINE_V0";

  for (const pred of predictions) {
    const inputStatus = asString(pred.inputStatus) ?? "UNKNOWN";
    const baselineStatus = asString(pred.baselineStatus);
    const baselinePick = asString(pred.baselinePick);
    const officialStatus = (
      asString(pred.officialStatus) ??
      ""
    ).toUpperCase();
    const inputWarnings = Array.isArray(pred.inputWarnings)
      ? pred.inputWarnings.map((w) => String(w))
      : [];
    const homeTeam = asString(pred.homeTeam) ?? "";
    const awayTeam = asString(pred.awayTeam) ?? "";
    const gameId = asString(pred.gameId) ?? "";

    if (inputStatus === "ELIGIBLE") eligiblePredictions += 1;
    if (inputStatus === "LIMITED_INPUT") limitedInputPredictions += 1;
    if (inputStatus === "BLOCKED" || officialStatus === "BLOCKED") blocked += 1;

    const { gamePk, matchStatus, warnings } = resolveGamePk(
      pred,
      input.dateKst,
      index,
    );

    const result = gamePk != null ? resultByPk.get(gamePk) : undefined;
    let actualWinner: "HOME" | "AWAY" | "DRAW" | null = null;
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let effectiveMatchStatus = matchStatus;

    if (result) {
      if (result.status === "FINAL") {
        actualWinner = result.winner;
        homeScore = result.homeScore;
        awayScore = result.awayScore;
      } else {
        effectiveMatchStatus =
          result.status === "POSTPONED" ||
          result.status === "CANCELLED" ||
          result.status === "SUSPENDED"
            ? matchStatus
            : "RESULT_NOT_FINAL";
      }
    } else if (matchStatus === "MATCHED") {
      effectiveMatchStatus = "RESULT_MISSING";
    }

    const research = extractResearchSelection(pred);
    const officialPickRaw =
      asString(pred.officialPick) ??
      asString(
        asRecord(asArr(pred.marketPredictions)[0])?.officialPick,
      );
    const officialPickSide =
      officialPickRaw === "HOME" || officialPickRaw === "AWAY"
        ? officialPickRaw
        : resolvePickSide(officialPickRaw, homeTeam, awayTeam);

    // --- Official track ---
    let officialGradeResult: PredictionGrade = "NO_PICK";
    let officialEligible = inputStatus === "ELIGIBLE" && officialPickSide != null;
    if (officialPickSide != null) {
      officialSampleCount += 1;
      if (matchStatus === "ID_MISMATCH" || matchStatus === "DUPLICATE_MATCH") {
        officialGradeResult = "MATCH_ERROR";
      } else {
        officialGradeResult = gradePick(officialPickSide, result);
      }
      if (
        officialGradeResult === "CORRECT" ||
        officialGradeResult === "INCORRECT"
      ) {
        officialGraded += 1;
        if (officialGradeResult === "CORRECT") officialCorrect += 1;
        else officialIncorrect += 1;
      }
    }

    let grade: PredictionGrade;
    let researchResult: ResearchGradeResult = "NOT_GRADED";
    let blockedCounterfactual: MlbGradedPredictionGame["blockedCounterfactual"];
    let pickSide: "HOME" | "AWAY" | null = null;
    let pickTeam: string | null = baselinePick;
    let predictionProbability: number | null =
      typeof pred.modelProbability === "number"
        ? pred.modelProbability / 100
        : null;
    let gameBrier: number | null = null;
    let gameLogLoss: number | null = null;

    const isBlocked =
      inputStatus === "BLOCKED" || officialStatus === "BLOCKED";

    if (isV0) {
      pickSide = research.selection;
      predictionProbability = research.probability;
      if (pickSide === "HOME") pickTeam = homeTeam;
      else if (pickSide === "AWAY") pickTeam = awayTeam;

      if (isBlocked) {
        grade = "BLOCKED";
        const cf = gradePick(research.selection, result);
        blockedCounterfactual = {
          selection: research.selection,
          probability: research.probability,
          actualWinner,
          result: toResearchResult(cf),
          denominatorIncluded: false,
        };
      } else if (
        (officialStatus === "PASS" ||
          officialStatus === "ELIGIBLE" ||
          inputStatus === "LIMITED_INPUT" ||
          inputStatus === "ELIGIBLE") &&
        research.selection
      ) {
        researchCandidates += 1;
        if (
          matchStatus === "ID_MISMATCH" ||
          matchStatus === "DUPLICATE_MATCH"
        ) {
          grade = "MATCH_ERROR";
          matchErrors += 1;
          researchResult = "NOT_GRADED";
        } else if (!result) {
          effectiveMatchStatus = "RESULT_MISSING";
          grade = "PENDING";
          pending += 1;
          researchResult = "PENDING";
        } else if (result.status !== "FINAL") {
          if (
            result.status === "POSTPONED" ||
            result.status === "CANCELLED" ||
            result.status === "SUSPENDED"
          ) {
            grade = "VOID";
            voidCount += 1;
            researchResult = "VOID";
          } else {
            effectiveMatchStatus = "RESULT_NOT_FINAL";
            grade = "PENDING";
            pending += 1;
            researchResult = "PENDING";
          }
        } else {
          grade = gradePick(research.selection, result);
          researchResult = toResearchResult(grade);
          if (
            (grade === "CORRECT" || grade === "INCORRECT") &&
            research.homeP != null &&
            research.awayP != null &&
            (result.winner === "HOME" || result.winner === "AWAY")
          ) {
            const yHome: 0 | 1 = result.winner === "HOME" ? 1 : 0;
            gameBrier = brierHome(research.homeP, yHome);
            gameLogLoss = logLossHomeAway(
              research.homeP,
              research.awayP,
              result.winner,
            );
            researchBriers.push(gameBrier);
            researchLogLosses.push(gameLogLoss);
          }
          if (grade === "CORRECT") {
            graded += 1;
            correct += 1;
            researchGraded += 1;
            researchCorrect += 1;
            if (inputStatus === "ELIGIBLE") eligibleCorrect += 1;
            if (inputStatus === "LIMITED_INPUT") limitedCorrect += 1;
          } else if (grade === "INCORRECT") {
            graded += 1;
            incorrect += 1;
            researchGraded += 1;
            researchIncorrect += 1;
            if (inputStatus === "ELIGIBLE") eligibleIncorrect += 1;
            if (inputStatus === "LIMITED_INPUT") limitedIncorrect += 1;
          } else if (grade === "PENDING") {
            pending += 1;
          } else if (grade === "VOID") {
            voidCount += 1;
          } else if (grade === "NO_PICK") {
            noPick += 1;
          }
        }
      } else {
        grade = "NO_PICK";
        noPick += 1;
        researchResult = "NOT_GRADED";
      }
    } else {
      // --- LEGACY path (unchanged semantics) ---
      pickSide = resolvePickSide(baselinePick, homeTeam, awayTeam);
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
      } else if (!result) {
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
        if (!pickSide) {
          grade = "MATCH_ERROR";
          matchErrors += 1;
          warnings.push("baselinePick does not resolve to HOME or AWAY");
        } else {
          grade = gradePick(pickSide, result);
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

    const row: MlbGradedPredictionGame = {
      gamePk,
      gameId,
      matchStatus: effectiveMatchStatus,
      inputStatus,
      pick: pickSide,
      pickTeam,
      actualWinner,
      homeScore,
      awayScore,
      grade,
      predictionProbability,
      baselineStatus,
      inputWarnings,
      warnings,
      predictionContract: contract,
      officialGrade: {
        selection: officialPickSide,
        result: officialGradeResult,
        eligible: officialEligible,
        graded:
          officialGradeResult === "CORRECT" ||
          officialGradeResult === "INCORRECT",
      },
      researchGrade: isV0
        ? {
            marketType: research.marketType,
            selection: research.selection,
            probability: research.probability,
            actualWinner,
            result: isBlocked ? "NOT_GRADED" : researchResult,
            observationOnly: true,
            brierScore: gameBrier,
            logLoss: gameLogLoss,
          }
        : undefined,
      blockedCounterfactual,
    };
    games.push(row);
  }

  const accuracy = computeAccuracy(correct, incorrect);
  const eligibleAccuracy = computeAccuracy(eligibleCorrect, eligibleIncorrect);
  const limitedInputAccuracy = computeAccuracy(limitedCorrect, limitedIncorrect);

  const document: MlbGradedPredictionsDocument = {
    schemaVersion: MLB_GRADED_PREDICTIONS_SCHEMA,
    dateKst: input.dateKst,
    generatedAt: new Date().toISOString(),
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
      researchCandidates,
      researchGraded,
      researchCorrect,
      researchIncorrect,
      researchAccuracy: accuracyOrNa(
        researchCorrect,
        researchIncorrect,
        researchCandidates === 0 ? "N/A" : "NO_GRADED_SAMPLE",
      ),
      researchMeanBrier: mean(researchBriers),
      researchMeanLogLoss: mean(researchLogLosses),
      officialSampleCount,
      officialGraded,
      officialCorrect,
      officialIncorrect,
      officialAccuracy: accuracyOrNa(
        officialCorrect,
        officialIncorrect,
        officialSampleCount === 0 ? "N/A" : "NO_GRADED_SAMPLE",
      ),
      predictionContract: contract,
      modelVersion: asString(meta.modelVersion),
      modelStatus: asString(meta.modelStatus),
    },
    games,
  };

  const pathRel = mlbGradedPredictionsRel(input.dateKst);
  await writeJsonAtomic(absFromRel(pathRel, cwd), document);

  return { document, pathRel };
}
