import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadDailyPicksV1 } from "@/lib/mlb/daily-picks-v1";
import { abbreviateTeamName } from "@/lib/mlb/review-classify-v2";
import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import { loadEngineRecommendationRecord } from "@/lib/mlb/recommendation-provenance-v1";
import {
  failureCauseLabel,
  successCauseLabel,
} from "@/lib/mlb/research-ux-v1/category-labels";
import {
  buildWhatWeLearned,
  mapFailureCandidates,
  mapSuccessCandidates,
} from "./build-learning";
import { buildBeforeSignals, buildPreGameRisks } from "./build-signals";
import {
  GOOD_PICK_FEEDBACK_SCHEMA,
  type DailyLearningCard,
  type GoodPickFeedbackView,
  type GoodPickGameFeedback,
} from "./types";

async function readJson(abs: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(abs, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function emptyScoreboard() {
  return {
    goodPickCount: 0,
    correct: 0,
    incorrect: 0,
    pending: 0,
    accuracyPercent: null as number | null,
    rows: [] as GoodPickFeedbackView["goodPickScoreboard"]["rows"],
  };
}

function buildDailyLearning(
  games: GoodPickGameFeedback[],
  scoreboard: GoodPickFeedbackView["goodPickScoreboard"],
): DailyLearningCard {
  const successCounts: Record<string, number> = {};
  const failureCounts: Record<string, number> = {};
  const riskCounts: Record<string, number> = {};

  for (const g of games) {
    for (const c of g.whyCorrect) {
      successCounts[c.code] = (successCounts[c.code] ?? 0) + 1;
    }
    for (const c of g.whyIncorrect) {
      failureCounts[c.code] = (failureCounts[c.code] ?? 0) + 1;
    }
    for (const r of g.preGameRisks) {
      if (r.code === "RESEARCH_ONLY_PASS") continue;
      riskCounts[r.label] = (riskCounts[r.label] ?? 0) + 1;
    }
  }

  const topSuccess = Object.entries(successCounts).sort((a, b) => b[1] - a[1])[0];
  const topFailure = Object.entries(failureCounts).sort((a, b) => b[1] - a[1])[0];
  const commonRisks = Object.entries(riskCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);

  const questions: string[] = [];
  if (commonRisks.some((r) => /Lineup/i.test(r))) {
    questions.push(
      "Lineup 미확정 상태의 Good Pick 성능이 낮아지는가?",
    );
  }
  if (
    games.some((g) =>
      g.beforeSignals.some(
        (s) =>
          s.id === "starter" &&
          s.polarity === "POSITIVE" &&
          g.beforeSignals.some(
            (m) => m.id === "market" && m.polarity === "POSITIVE",
          ),
      ),
    )
  ) {
    questions.push(
      "Starter + Market 동조가 Good Pick 성공률과 관계가 있는가?",
    );
  }
  if (topFailure?.[0] === "BULLPEN" || topFailure?.[0] === "ONE_RUN_GAME") {
    questions.push(
      `${failureCauseLabel(topFailure[0])} 관찰이 Good Pick 실패와 함께 반복되는가?`,
    );
  }
  if (questions.length === 0) {
    questions.push(
      "표본이 쌓이면 Good Pick 사전 신호 조합별 적중률을 관찰할 수 있는가?",
    );
  }

  const acc =
    scoreboard.accuracyPercent != null
      ? `${scoreboard.accuracyPercent}%`
      : "—";

  return {
    title: "Daily Learning",
    goodPickLine: `Good Picks ${scoreboard.goodPickCount} · Correct ${scoreboard.correct} · Incorrect ${scoreboard.incorrect} · Accuracy ${acc}`,
    topSuccessCandidate: topSuccess
      ? `${successCauseLabel(topSuccess[0])} (n=${topSuccess[1]})`
      : null,
    topFailureCandidate: topFailure
      ? `${failureCauseLabel(topFailure[0])} (n=${topFailure[1]})`
      : null,
    commonPreGameRisks: commonRisks,
    researchQuestions: questions,
    plain: [
      `오늘(해당 일자) Good Pick 복기: ${scoreboard.correct}/${scoreboard.goodPickCount || "—"} 적중.`,
      topSuccess
        ? `성공 관찰 후보 최다: ${successCauseLabel(topSuccess[0])}.`
        : "성공 관찰 후보 집계 없음.",
      topFailure
        ? `실패 관찰 후보 최다: ${failureCauseLabel(topFailure[0])}.`
        : "실패 관찰 후보 집계 없음.",
      "표본이 충분하지 않으면 유효한 패턴이라고 결론 내리지 않습니다. Engine 변경이 아니라 Research Question입니다.",
    ].join(" "),
  };
}

/**
 * Load Good Pick human feedback for a prediction date.
 * Read-only over Daily Picks + Prediction + Grade + Reviews.
 */
export async function loadGoodPickFeedbackV1(input: {
  dateKst: string;
  cwd?: string;
}): Promise<GoodPickFeedbackView> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const sourcePaths = [
    `data/predictions/mlb/${dateKst}.json`,
    `data/research/mlb/${dateKst}-graded-predictions-v1.json`,
    `data/research/mlb/${dateKst}-success-review-v1.json`,
    `data/research/mlb/${dateKst}-failure-review-v1.json`,
    `data/research/mlb/${dateKst}-daily-review-summary-v1.json`,
    `data/research/mlb/${dateKst}-official-results-v1.json`,
  ];

  const predPath = path.join(cwd, "data", "predictions", "mlb", `${dateKst}.json`);
  const prediction = await readJson(predPath);

  if (!prediction || !Array.isArray(prediction.predictions)) {
    return {
      schemaVersion: GOOD_PICK_FEEDBACK_SCHEMA,
      dateKst,
      loaded: false,
      error: `NO_PREGAME_SNAPSHOT: data/predictions/mlb/${dateKst}.json`,
      statusCode: "NO_PREGAME_SNAPSHOT",
      predictionHash: null,
      allResearch: null,
      goodPickScoreboard: emptyScoreboard(),
      games: [],
      dailyLearning: null,
      sourcePaths,
    };
  }

  const meta = asRecord(prediction.meta) ?? {};
  const predictionHash = asString(meta.predictionHashSha256);

  const picks = await loadDailyPicksV1({
    dateKst,
    cwd,
    sealDeliveryRecord: false,
  });
  // Immutable Recommendation Record is Source of Truth for official Good Picks.
  const delivery = await loadEngineRecommendationRecord({ dateKst, cwd });
  const sealedGameIds = new Set(
    (delivery?.picks ?? [])
      .filter((p) => p.sourceType === "ENGINE_SNAPSHOT")
      .map((p) => p.gameId),
  );
  // Official recommendation feedback: ENGINE_SNAPSHOT only.
  // Reconstructed historical picks may be shown for research review but not as recommendations.
  const engineCards = [...picks.strongPicks, ...picks.goodPicks].filter(
    (c) =>
      c.provenance.sourceType === "ENGINE_SNAPSHOT" &&
      (sealedGameIds.size === 0 || sealedGameIds.has(c.gameId)),
  );
  // When sealed record exists, only those gameIds enter official Good Pick scoreboard.
  const goodCards =
    sealedGameIds.size > 0
      ? engineCards.filter((c) => sealedGameIds.has(c.gameId))
      : engineCards.length > 0
        ? picks.goodPicks.filter(
            (c) => c.provenance.sourceType === "ENGINE_SNAPSHOT",
          )
        : [];
  const researchReviewCards =
    sealedGameIds.size > 0 || engineCards.length > 0
      ? engineCards.filter((c) => c.tier === "GOOD" || c.tier === "STRONG")
      : picks.reconstructedPicks;

  const graded = await readJson(
    path.join(
      cwd,
      "data",
      "research",
      "mlb",
      `${dateKst}-graded-predictions-v1.json`,
    ),
  );
  const successDoc = await readJson(
    path.join(
      cwd,
      "data",
      "research",
      "mlb",
      `${dateKst}-success-review-v1.json`,
    ),
  );
  const failureDoc = await readJson(
    path.join(
      cwd,
      "data",
      "research",
      "mlb",
      `${dateKst}-failure-review-v1.json`,
    ),
  );
  const dailyReview = await readJson(
    path.join(
      cwd,
      "data",
      "research",
      "mlb",
      `${dateKst}-daily-review-summary-v1.json`,
    ),
  );
  const results = await readJson(
    path.join(
      cwd,
      "data",
      "research",
      "mlb",
      `${dateKst}-official-results-v1.json`,
    ),
  );

  const predByGameId = new Map<string, Record<string, unknown>>();
  for (const raw of prediction.predictions as unknown[]) {
    const row = asRecord(raw);
    const id = asString(row?.gameId);
    if (row && id) predByGameId.set(id, row);
  }

  const gradedGames = Array.isArray(graded?.games)
    ? (graded!.games as unknown[])
    : [];
  const gradedById = new Map<string, Record<string, unknown>>();
  for (const raw of gradedGames) {
    const row = asRecord(raw);
    const id = asString(row?.gameId);
    if (row && id) gradedById.set(id, row);
  }

  const successGames = Array.isArray(successDoc?.games)
    ? (successDoc!.games as unknown[])
    : Array.isArray(successDoc?.reviews)
      ? (successDoc!.reviews as unknown[])
      : [];
  const successById = new Map<string, Record<string, unknown>>();
  for (const raw of successGames) {
    const row = asRecord(raw);
    const id = asString(row?.gameId);
    if (row && id) successById.set(id, row);
  }

  const failureGames = Array.isArray(failureDoc?.games)
    ? (failureDoc!.games as unknown[])
    : Array.isArray(failureDoc?.reviews)
      ? (failureDoc!.reviews as unknown[])
      : [];
  const failureById = new Map<string, Record<string, unknown>>();
  for (const raw of failureGames) {
    const row = asRecord(raw);
    const id = asString(row?.gameId);
    if (row && id) failureById.set(id, row);
  }

  const resultGames = Array.isArray(results?.games)
    ? (results!.games as unknown[])
    : [];
  const resultById = new Map<string, Record<string, unknown>>();
  for (const raw of resultGames) {
    const row = asRecord(raw);
    const id = asString(row?.internalGameId) ?? asString(row?.gameId);
    if (row && id) resultById.set(id, row);
  }

  // All-research scoreboard from graded / daily review (not Good Picks)
  const researchPerf = asRecord(dailyReview?.researchPerformance);
  const gradedSummary = asRecord(graded?.summary) ?? {};
  const gradeCounts = asRecord(dailyReview?.gradeCounts) ?? gradedSummary;
  const allResearch = {
    totalGames:
      asNumber(gradeCounts?.totalGames) ??
      asNumber(gradedSummary.totalGames) ??
      (prediction.predictions as unknown[]).length,
    graded:
      asNumber(researchPerf?.researchGraded) ??
      asNumber(gradeCounts?.graded) ??
      asNumber(gradedSummary.graded) ??
      0,
    correct:
      asNumber(researchPerf?.researchCorrect) ??
      asNumber(gradeCounts?.correct) ??
      asNumber(gradedSummary.correct) ??
      asNumber(gradedSummary.researchCorrect) ??
      0,
    incorrect:
      asNumber(researchPerf?.researchIncorrect) ??
      asNumber(gradeCounts?.incorrect) ??
      asNumber(gradedSummary.incorrect) ??
      asNumber(gradedSummary.researchIncorrect) ??
      0,
    accuracyPercent:
      asNumber(researchPerf?.researchAccuracy) ??
      asNumber(asRecord(gradedSummary.researchAccuracy)?.percent) ??
      asNumber(asRecord(gradedSummary.accuracy)?.percent) ??
      null,
    brier:
      asNumber(researchPerf?.researchBrier) ??
      asNumber(gradedSummary.researchMeanBrier) ??
      null,
    logLoss:
      asNumber(researchPerf?.researchLogLoss) ??
      asNumber(gradedSummary.researchMeanLogLoss) ??
      null,
    leakageStatus: asString(asRecord(dailyReview?.leakageAudit)?.status),
  };

  if (allResearch.accuracyPercent == null && allResearch.graded > 0) {
    allResearch.accuracyPercent =
      Math.round(
        (allResearch.correct / allResearch.graded) * 1000,
      ) / 10;
  }

  const games: GoodPickGameFeedback[] = [];

  for (const card of researchReviewCards) {
    const pred = predByGameId.get(card.gameId) ?? null;
    const g = gradedById.get(card.gameId) ?? null;
    const suc = successById.get(card.gameId) ?? null;
    const fail = failureById.get(card.gameId) ?? null;
    const res = resultById.get(card.gameId) ?? null;

    const homeTeam =
      asString(pred?.homeTeam) ?? asString(g?.homeTeam) ?? "Home";
    const awayTeam =
      asString(pred?.awayTeam) ?? asString(g?.awayTeam) ?? "Away";
    const pickSide = card.pickSide;
    const beforeSignals = pred
      ? buildBeforeSignals(pred, pickSide)
      : [];
    const preGameRisks = pred ? buildPreGameRisks(pred) : [];

    const researchGrade = asRecord(g?.researchGrade);
    const gradeRaw = asString(g?.grade) ?? asString(researchGrade?.result);
    let grade: GoodPickGameFeedback["grade"] = "UNKNOWN";
    if (gradeRaw === "CORRECT") grade = "CORRECT";
    else if (gradeRaw === "INCORRECT") grade = "INCORRECT";
    else if (!g) grade = "PENDING";

    const homeScore =
      asNumber(g?.homeScore) ?? asNumber(res?.homeScore);
    const awayScore =
      asNumber(g?.awayScore) ?? asNumber(res?.awayScore);
    const finalScore =
      homeScore != null && awayScore != null
        ? `${abbreviateTeamName(awayTeam)} ${awayScore} – ${abbreviateTeamName(homeTeam)} ${homeScore}`
        : null;

    const winnerSide =
      asString(g?.actualWinner) ?? asString(res?.winner);
    let winnerTeam: string | null = null;
    if (winnerSide === "HOME") winnerTeam = homeTeam;
    else if (winnerSide === "AWAY") winnerTeam = awayTeam;
    else winnerTeam = asString(g?.actualWinnerTeam) ?? null;

    const successCats = Array.isArray(suc?.successCategories)
      ? (suc!.successCategories as unknown[]).map(String)
      : [];
    const failureCats = Array.isArray(fail?.failureCategories)
      ? (fail!.failureCategories as unknown[]).map(String)
      : [];
    const whyCorrectRaw = Array.isArray(suc?.whyCorrect)
      ? (suc!.whyCorrect as Array<Record<string, unknown>>)
      : [];
    const causesRaw = Array.isArray(fail?.possibleCauses)
      ? (fail!.possibleCauses as Array<Record<string, unknown>>)
      : [];

    const whyCorrect =
      grade === "CORRECT"
        ? mapSuccessCandidates(successCats, whyCorrectRaw)
        : [];
    const whyIncorrect =
      grade === "INCORRECT"
        ? mapFailureCandidates(failureCats, causesRaw)
        : [];

    const primary =
      whyCorrect[0]?.label ?? whyIncorrect[0]?.label ?? null;
    const secondary = [
      ...whyCorrect.slice(1).map((c) => c.label),
      ...whyIncorrect.slice(1).map((c) => c.label),
    ];

    const whatWeLearned = buildWhatWeLearned({
      pickTeam: card.pickTeam,
      grade,
      beforeSignals,
      preGameRiskLabels: preGameRisks.map((r) => r.label),
      whyCorrect,
      whyIncorrect,
    });

    games.push({
      gameId: card.gameId,
      gamePk: card.gamePk,
      matchupLine: card.matchupLine,
      homeTeam,
      awayTeam,
      pickTeam: card.pickTeam,
      pickSide,
      modelProbabilityPercent: card.modelProbabilityPercent,
      confidence: card.confidence,
      pickTier: "GOOD",
      researchOnly: card.researchOnly,
      beforeSignals,
      preGameRisks,
      finalScore,
      homeScore,
      awayScore,
      winnerTeam,
      grade,
      brier:
        asNumber(researchGrade?.brierScore) ?? asNumber(g?.brierScore),
      logLoss: asNumber(researchGrade?.logLoss) ?? asNumber(g?.logLoss),
      whyCorrect,
      whyIncorrect,
      primaryReviewCandidate: primary,
      secondaryReviewCandidates: secondary,
      whatWeLearned,
      detailHref: card.detailHref
        ? `${card.detailHref}${card.detailHref.includes("?") ? "&" : "?"}feedback=1`
        : null,
    });
  }

  const goodPickScoreboard = {
    goodPickCount: goodCards.length,
    correct: goodCards.length
      ? games.filter(
          (g) =>
            goodCards.some((c) => c.gameId === g.gameId) && g.grade === "CORRECT",
        ).length
      : 0,
    incorrect: goodCards.length
      ? games.filter(
          (g) =>
            goodCards.some((c) => c.gameId === g.gameId) &&
            g.grade === "INCORRECT",
        ).length
      : 0,
    pending: goodCards.length
      ? games.filter(
          (g) =>
            goodCards.some((c) => c.gameId === g.gameId) &&
            g.grade !== "CORRECT" &&
            g.grade !== "INCORRECT",
        ).length
      : 0,
    accuracyPercent: null as number | null,
    rows: games
      .filter((g) => goodCards.some((c) => c.gameId === g.gameId))
      .map((g) => ({
        gameId: g.gameId,
        matchupLine: g.matchupLine,
        pickTeam: g.pickTeam,
        modelProbabilityPercent: g.modelProbabilityPercent,
        confidence: g.confidence,
        resultLine: g.finalScore ?? "—",
        grade: g.grade,
        primaryReviewCandidate: g.primaryReviewCandidate,
      })),
  };
  const gGraded = goodPickScoreboard.correct + goodPickScoreboard.incorrect;
  goodPickScoreboard.accuracyPercent =
    gGraded > 0
      ? Math.round((goodPickScoreboard.correct / gGraded) * 1000) / 10
      : null;

  // Daily learning from research review cards (may include reconstructed research notes)
  const dailyLearning =
    games.length > 0 ? buildDailyLearning(games, {
      ...goodPickScoreboard,
      goodPickCount: games.length,
      correct: games.filter((g) => g.grade === "CORRECT").length,
      incorrect: games.filter((g) => g.grade === "INCORRECT").length,
      pending: games.filter(
        (g) => g.grade !== "CORRECT" && g.grade !== "INCORRECT",
      ).length,
      accuracyPercent:
        games.filter((g) => g.grade === "CORRECT" || g.grade === "INCORRECT")
          .length > 0
          ? Math.round(
              (games.filter((g) => g.grade === "CORRECT").length /
                games.filter(
                  (g) => g.grade === "CORRECT" || g.grade === "INCORRECT",
                ).length) *
                1000,
            ) / 10
          : null,
    }) : null;

  return {
    schemaVersion: GOOD_PICK_FEEDBACK_SCHEMA,
    dateKst,
    loaded: true,
    error: null,
    statusCode: "OK",
    predictionHash,
    allResearch,
    goodPickScoreboard,
    games,
    dailyLearning,
    sourcePaths,
  };
}
