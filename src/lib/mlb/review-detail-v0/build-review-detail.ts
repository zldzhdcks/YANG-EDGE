/**
 * Build MLB 2026-08-02 Research Baseline — per-game observational review detail v0.
 * Does not mutate prediction snapshots, configs, or weights.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "../mlb-review-hash";
import { asNumber, asRecord, asString } from "../mlb-review-utils";
import { deriveMoneylineEdgeSemantics } from "../prediction-v0/edge-semantics";

export const MLB_REVIEW_DETAIL_V0_SCHEMA =
  "mlb-prediction-review-detail-v0" as const;

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function componentDirection(v: number): "HOME" | "AWAY" | "NEUTRAL" {
  if (Math.abs(v) < 1e-9) return "NEUTRAL";
  return v > 0 ? "HOME" : "AWAY";
}

function aligned(
  direction: "HOME" | "AWAY" | "NEUTRAL",
  winner: "HOME" | "AWAY" | "DRAW" | null,
): boolean | null {
  if (direction === "NEUTRAL" || (winner !== "HOME" && winner !== "AWAY")) {
    return null;
  }
  return direction === winner;
}

function classifySuccess(input: {
  grade: string;
  agree: boolean;
  starterAligned: boolean | null;
  marketAligned: boolean | null;
  homeAdvAligned: boolean | null;
  selectedSideEdge: number | null;
  modelP: number;
}): string {
  if (input.grade !== "CORRECT") return "N/A";
  if (!input.agree) return "MODEL_MARKET_DISAGREEMENT_CORRECT";
  if (input.starterAligned === true && input.marketAligned === true) {
    return "STARTER_AND_MARKET_ALIGNED";
  }
  if (input.starterAligned === true) return "STARTER_EDGE_SUPPORTED_RESULT";
  if (input.marketAligned === true) return "MARKET_PRIOR_SUPPORTED_RESULT";
  if (input.homeAdvAligned === true) return "HOME_ADVANTAGE_SUPPORTED_RESULT";
  if (input.modelP < 0.525) return "LOW_MARGIN_CORRECT";
  return "OTHER_OBSERVATION";
}

function classifyFailure(input: {
  grade: string;
  agree: boolean;
  starterAligned: boolean | null;
  marketAligned: boolean | null;
  homeAdvAligned: boolean | null;
  selectedSideEdge: number | null;
  modelP: number;
}): string {
  if (input.grade !== "INCORRECT") return "N/A";
  if (!input.agree) return "MODEL_DISAGREED_WITH_MARKET_AND_LOST";
  if (input.starterAligned === false) return "STARTER_EDGE_WRONG_DIRECTION";
  if (input.homeAdvAligned === false) return "HOME_ADVANTAGE_WRONG_DIRECTION";
  if (input.modelP < 0.525) return "SMALL_PROBABILITY_MARGIN";
  return "INSUFFICIENT_EVIDENCE";
}

export async function buildMlbPredictionReviewDetailV0(input: {
  dateKst: string;
  cwd?: string;
  dryRun?: boolean;
}): Promise<{ document: Record<string, unknown>; pathRel: string; wrote: boolean }> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const predRel = path.join("data", "predictions", "mlb", `${dateKst}.json`);
  const gradedRel = path.join(
    "data",
    "research",
    "mlb",
    `${dateKst}-graded-predictions-v1.json`,
  );
  const resultsRel = path.join(
    "data",
    "research",
    "mlb",
    `${dateKst}-official-results-v1.json`,
  );
  const scorecardRel = path.join(
    "data",
    "research",
    "mlb",
    `${dateKst}-prediction-scorecard-v0.json`,
  );
  const outRel = path.join(
    "data",
    "research",
    "mlb",
    `${dateKst}-prediction-review-detail-v0.json`,
  );

  const pred = JSON.parse(await readFile(path.join(cwd, predRel), "utf8"));
  const graded = JSON.parse(await readFile(path.join(cwd, gradedRel), "utf8"));
  const results = JSON.parse(await readFile(path.join(cwd, resultsRel), "utf8"));
  const scorecard = JSON.parse(
    await readFile(path.join(cwd, scorecardRel), "utf8"),
  );

  const meta = asRecord(pred.meta) ?? {};
  const gradedById = new Map(
    (graded.games as Array<Record<string, unknown>>).map((g) => [
      asString(g.gameId) ?? "",
      g,
    ]),
  );
  const scById = new Map(
    (scorecard.gameGrades as Array<Record<string, unknown>>).map((g) => [
      asString(g.gameId) ?? "",
      g,
    ]),
  );

  const gameReviews: Array<Record<string, unknown>> = [];

  for (const raw of asArr(pred.predictions)) {
    const p = asRecord(raw)!;
    const gameId = asString(p.gameId) ?? "";
    const homeTeam = asString(p.homeTeam) ?? "";
    const awayTeam = asString(p.awayTeam) ?? "";
    const g = gradedById.get(gameId) ?? {};
    const sg = scById.get(gameId) ?? {};
    const mp =
      asRecord(
        asArr(p.marketPredictions).find(
          (m) => asString(asRecord(m)?.marketType) === "MONEYLINE_2WAY",
        ),
      ) ?? asRecord(asArr(p.marketPredictions)[0]) ?? {};
    const comps = asRecord(mp.components) ?? asRecord(p.components) ?? {};
    const homeP = asNumber(mp.homeProbability) ?? 0;
    const awayP = asNumber(mp.awayProbability) ?? 0;
    const mktH = asNumber(mp.marketHomeProbability);
    const mktA = asNumber(mp.marketAwayProbability);
    const semantics = deriveMoneylineEdgeSemantics({
      homeProbability: homeP,
      awayProbability: awayP,
      marketHomeProbability: mktH,
      marketAwayProbability: mktA,
    });
    const sel = semantics.mostLikelySelection;
    const modelP = semantics.mostLikelyProbability;
    const mktForSel = semantics.marketProbabilityForMostLikely;
    const mktFav: "HOME" | "AWAY" | null =
      mktH == null || mktA == null
        ? null
        : mktH >= mktA
          ? "HOME"
          : "AWAY";
    const sideAgree = mktFav != null ? sel === mktFav : null;
    const winner =
      (asString(g.actualWinner) as "HOME" | "AWAY" | "DRAW" | null) ?? null;
    const grade = asString(g.grade) ?? "UNKNOWN";
    const starterC = asNumber(comps.starter) ?? 0;
    const marketC = asNumber(comps.marketPrior) ?? 0;
    const homeAdvC = asNumber(comps.homeAdvantage) ?? 0;
    const starterDir = componentDirection(starterC);
    const marketDir = componentDirection(marketC);
    const homeAdvDir = componentDirection(homeAdvC);
    const starterAligned = aligned(starterDir, winner);
    const marketAligned = aligned(marketDir, winner);
    const homeAdvAligned = aligned(homeAdvDir, winner);

    const successCategory = classifySuccess({
      grade,
      agree: sideAgree === true,
      starterAligned,
      marketAligned,
      homeAdvAligned,
      selectedSideEdge: semantics.selectedSideEdge,
      modelP,
    });
    const failureCategory = classifyFailure({
      grade,
      agree: sideAgree === true,
      starterAligned,
      marketAligned,
      homeAdvAligned,
      selectedSideEdge: semantics.selectedSideEdge,
      modelP,
    });

    const awayScore = asNumber(g.awayScore);
    const homeScore = asNumber(g.homeScore);
    const finalScore =
      awayScore != null && homeScore != null
        ? `${awayTeam} ${awayScore} @ ${homeTeam} ${homeScore}`
        : null;

    let primaryReviewFinding = "";
    let alternativeHypothesis = "";
    let dataLimitations =
      "Lineup NOT_RELEASED; bullpen weight disabled (v0); observation-only slate.";

    if (grade === "CORRECT") {
      primaryReviewFinding =
        sideAgree === false
          ? "Model disagreed with market favorite and was correct (rare on this slate)."
          : starterAligned === true
            ? "Most-likely selection matched result; starter contribution direction also aligned."
            : "Most-likely selection matched result; component directions mixed or market-led.";
      alternativeHypothesis =
        "Correct outcome may reflect market information already priced in rather than independent starter edge.";
    } else if (grade === "INCORRECT") {
      primaryReviewFinding =
        sideAgree === false
          ? "Model favored opposite side of market favorite and lost; market side won."
          : starterAligned === false
            ? "Model and market agreed on selection; starter contribution pointed wrong way vs winner."
            : "Model/market-aligned selection lost; residual variance or unmodeled factors.";
      alternativeHypothesis =
        "Bullpen leverage, sequencing, or small-sample offense may dominate; not identifiable from v0 features alone.";
      dataLimitations +=
        " Failure cannot be attributed to bullpen/lineup without play-level evidence (weights=0).";
    } else if (grade === "BLOCKED") {
      primaryReviewFinding =
        "Excluded from research accuracy by starter-sample policy; counterfactual recorded only.";
      alternativeHypothesis =
        "Weak starter sample may still produce a pick that looks retrospectively right or wrong by chance.";
    }

    const blocked = asRecord(g.blockedCounterfactual);
    const warnings = asArr(p.inputWarnings).map((w) => String(w));

    gameReviews.push({
      gamePk: asNumber(g.gamePk) ?? asNumber(sg.gamePk),
      gameId,
      matchup: `${awayTeam} @ ${homeTeam}`,
      finalScore,
      actualWinner: winner,
      modelSelection: sel,
      modelProbability: modelP,
      marketProbabilityForSelection: mktForSel,
      marketFavorite: mktFav,
      sideFavoriteAgreement: sideAgree,
      selectedSideEdge: semantics.selectedSideEdge,
      valueSelection: semantics.valueSelection,
      valueEdge: semantics.valueEdge,
      confidence: asNumber(mp.confidence) ?? asNumber(p.confidence),
      officialStatus: asString(p.officialStatus),
      grade,
      starterContribution: starterC,
      marketPriorContribution: marketC,
      homeAdvantageContribution: homeAdvC,
      starterDirection: starterDir,
      marketPriorDirection: marketDir,
      homeAdvantageDirection: homeAdvDir,
      starterAlignedWithWinner: starterAligned,
      marketPriorAlignedWithWinner: marketAligned,
      homeAdvantageAlignedWithWinner: homeAdvAligned,
      marketAgreementClass: asString(sg.marketAgreement),
      successCategory,
      failureCategory,
      primaryReviewFinding,
      alternativeHypothesis,
      dataLimitations,
      inputWarnings: warnings,
      blockedCounterfactual:
        grade === "BLOCKED"
          ? {
              hypotheticalSelection: asString(blocked?.selection) ?? sel,
              hypotheticalProbability:
                asNumber(blocked?.probability) ?? modelP,
              counterfactualGrade: asString(blocked?.result),
              blockedReasons: warnings.filter(
                (w) =>
                  w.includes("STARTER_SAMPLE") ||
                  w.includes("INSUFFICIENT"),
              ),
              denominatorIncluded: false,
            }
          : null,
      modelMoreConservativeThanMarket:
        mktForSel != null ? modelP < mktForSel : null,
    });
  }

  // Focus games
  const pitCin = gameReviews.find((g) =>
    String(g.matchup).includes("Pittsburgh") &&
    String(g.matchup).includes("Cincinnati"),
  );
  const milLaa = gameReviews.find((g) =>
    String(g.matchup).includes("Milwaukee") &&
    String(g.matchup).includes("Angels"),
  );

  const passGames = gameReviews.filter(
    (g) => g.grade === "CORRECT" || g.grade === "INCORRECT",
  );
  const successGames = gameReviews.filter((g) => g.grade === "CORRECT");
  const failureGames = gameReviews.filter((g) => g.grade === "INCORRECT");
  const blockedGames = gameReviews.filter((g) => g.grade === "BLOCKED");

  // Side-favorite disagreement (distinct from scorecard NEAR_EVEN bucket)
  const sideDisagree = passGames.filter((g) => g.sideFavoriteAgreement === false);
  const sideDisagreeCorrect = sideDisagree.filter((g) => g.grade === "CORRECT");
  const sideDisagreeIncorrect = sideDisagree.filter(
    (g) => g.grade === "INCORRECT",
  );

  const patterns = [
    {
      patternId: "MOST_LIKELY_OFTEN_BELOW_MARKET_PROB",
      statement:
        "On this slate, mostLikely selected-side edge was negative for most PASS games (model less confident than market on its pick).",
      supportingGames: passGames
        .filter((g) => (g.selectedSideEdge as number) < 0)
        .map((g) => g.gameId),
      contradictingGames: passGames
        .filter((g) => (g.selectedSideEdge as number) >= 0)
        .map((g) => g.gameId),
      sampleCount: passGames.length,
      currentStatus: "REPEATED_WEAK_SIGNAL",
      nextRequiredSample: 50,
    },
    {
      patternId: "VALUE_SELECTION_UNDERPERFORMED_MOST_LIKELY",
      statement:
        "ValueSelection (positive edge side) went 3/13 while mostLikely went 8/13 on the same slate.",
      supportingGames: failureGames
        .filter((g) => g.valueSelection != null)
        .map((g) => g.gameId),
      contradictingGames: successGames
        .filter((g) => g.valueSelection === g.modelSelection)
        .map((g) => g.gameId),
      sampleCount: 13,
      currentStatus: "OBSERVED_ONCE",
      nextRequiredSample: 40,
    },
    {
      patternId: "SIDE_FAVORITE_DISAGREE_BOTH_LOST",
      statement:
        "Two near-even games where model favorite ≠ market favorite (PIT@CIN, MIL@LAA) both lost for the model; market favorite won.",
      supportingGames: sideDisagreeIncorrect.map((g) => g.gameId),
      contradictingGames: sideDisagreeCorrect.map((g) => g.gameId),
      sampleCount: sideDisagree.length,
      currentStatus: "INVESTIGATE_MORE",
      nextRequiredSample: 30,
    },
    {
      patternId: "STARTER_ALIGNED_WHEN_CORRECT",
      statement:
        "Among CORRECT games, starter contribution direction matched winner more often than not (observational only).",
      supportingGames: successGames
        .filter((g) => g.starterAlignedWithWinner === true)
        .map((g) => g.gameId),
      contradictingGames: successGames
        .filter((g) => g.starterAlignedWithWinner === false)
        .map((g) => g.gameId),
      sampleCount: successGames.length,
      currentStatus: "INSUFFICIENT_SAMPLE",
      nextRequiredSample: 60,
    },
    {
      patternId: "LINEUP_UNCONFIRMED_UNIVERSAL",
      statement:
        "All 15 games lacked confirmed lineups; cannot isolate lineup absence as a failure driver.",
      supportingGames: gameReviews.map((g) => g.gameId),
      contradictingGames: [],
      sampleCount: 15,
      currentStatus: "INSUFFICIENT_SAMPLE",
      nextRequiredSample: 40,
    },
  ].slice(0, 5);

  const hypotheses = [
    {
      hypothesisId: "H1_MARKET_PRIOR_SHRINKS_SELECTED_EDGE_NEGATIVE",
      statement:
        "Market prior may pull mostLikely probabilities toward market while leaving selectedSideEdge negative on the chosen side, reducing independent edge.",
      evidenceFor: passGames.filter((g) => (g.selectedSideEdge as number) < 0)
        .length,
      evidenceAgainst: passGames.filter(
        (g) => (g.selectedSideEdge as number) >= 0,
      ).length,
      requiredData:
        "Multi-date distribution of selectedSideEdge vs raw starter-only probabilities",
      minimumAdditionalSample: 40,
      engineConnection: "PROHIBITED",
      status: "INVESTIGATE_MORE",
    },
    {
      hypothesisId: "H2_SIDE_DISAGREE_NEAR_EVEN_UNRELIABLE",
      statement:
        "When |modelP-0.5| is small and model favorite ≠ market favorite, mostLikely may underperform market favorite on short horizons.",
      evidenceFor: sideDisagreeIncorrect.length,
      evidenceAgainst: sideDisagreeCorrect.length,
      requiredData: "Stratified sample of side-disagree vs agree near-even games",
      minimumAdditionalSample: 30,
      engineConnection: "PROHIBITED",
      status: "INVESTIGATE_MORE",
    },
    {
      hypothesisId: "H3_VALUE_SELECTION_NOT_YET_A_BETTING_SIGNAL",
      statement:
        "Positive model−market edge (valueSelection) did not track winners on this slate (3/13); treat as diagnostic only until prices+ROI rules exist.",
      evidenceFor: 10,
      evidenceAgainst: 3,
      requiredData: "Settled prices and ROI with settlement rules across dates",
      minimumAdditionalSample: 50,
      engineConnection: "PROHIBITED",
      status: "INVESTIGATE_MORE",
    },
  ];

  const blockedPolicyReview = blockedGames.map((g) => {
    const cf = asRecord(g.blockedCounterfactual);
    const cfGrade = asString(cf?.counterfactualGrade);
    return {
      gamePk: g.gamePk,
      matchup: g.matchup,
      blockedReasons: cf?.blockedReasons ?? g.inputWarnings,
      weakStarterSample: true,
      hypotheticalSelection: cf?.hypotheticalSelection ?? g.modelSelection,
      hypotheticalProbability: cf?.hypotheticalProbability ?? g.modelProbability,
      actualWinner: g.actualWinner,
      counterfactualCorrect: cfGrade === "CORRECT",
      counterfactualGrade: cfGrade,
      policyJudgment:
        cfGrade === "INCORRECT"
          ? "BLOCK_POLICY_PROTECTED"
          : cfGrade === "CORRECT"
            ? "BLOCK_POLICY_MISSED_CORRECT_PICK"
            : "INSUFFICIENT_SAMPLE",
      note: "Do not change minInningsForPartial from n=2 counterfactuals.",
    };
  });

  const bothBlockedIncorrect = blockedPolicyReview.every(
    (b) => b.counterfactualCorrect === false,
  );

  const dailyMetrics = {
    finalGames: 15,
    researchCandidates: graded.summary.researchCandidates,
    researchGraded: graded.summary.researchGraded,
    researchCorrect: graded.summary.researchCorrect,
    researchIncorrect: graded.summary.researchIncorrect,
    researchAccuracy: graded.summary.researchAccuracy,
    meanBrier: graded.summary.researchMeanBrier,
    meanLogLoss: graded.summary.researchMeanLogLoss,
    blocked: graded.summary.blocked,
    officialSample: graded.summary.officialSampleCount,
    reviewStatus: "VALID_REVIEW",
    scorecardAligned: {
      researchSample: scorecard.meta.researchSampleCount,
      correct: scorecard.researchBaselinePerformance.correct,
      incorrect: scorecard.researchBaselinePerformance.incorrect,
      meanBrier: scorecard.probabilityMetrics.meanBrierScore,
      meanLogLoss: scorecard.probabilityMetrics.meanLogLoss,
    },
  };

  const bodyWithoutHash = {
    schemaVersion: MLB_REVIEW_DETAIL_V0_SCHEMA,
    dateKst,
    modelVersion: asString(meta.modelVersion),
    modelStatus: asString(meta.modelStatus),
    predictionHashSha256: asString(meta.predictionHashSha256),
    configHash: asString(meta.configHash),
    inputManifestHash: asString(meta.inputManifestHash),
    gradeVersion: graded.gradingPolicyVersion,
    scorecardGradeVersion: scorecard.meta?.gradeVersion ?? null,
    dailyMetrics,
    gameReviews,
    successPatterns: {
      count: successGames.length,
      categories: Object.fromEntries(
        [
          ...new Set(successGames.map((g) => g.successCategory)),
        ].map((c) => [
          c,
          successGames.filter((g) => g.successCategory === c).map((g) => g.gameId),
        ]),
      ),
      notes: [
        "Single-date categories are observational labels only.",
        "Do not treat category frequency as causal feature effects.",
      ],
    },
    failurePatterns: {
      count: failureGames.length,
      categories: Object.fromEntries(
        [
          ...new Set(failureGames.map((g) => g.failureCategory)),
        ].map((c) => [
          c,
          failureGames.filter((g) => g.failureCategory === c).map((g) => g.gameId),
        ]),
      ),
      notes: [
        "Bullpen/lineup are not asserted as causes without play evidence (v0 weights=0).",
      ],
    },
    marketComparison: {
      mostLikely: scorecard.mostLikelyPerformance,
      valueSelection: scorecard.valueSelectionPerformance,
      scorecardMarketAgreement: scorecard.marketAgreement,
      sideFavoriteDisagreement: {
        note: "Model mostLikely vs market favorite side (independent of NEAR_EVEN abs-from-half class).",
        sampleCount: sideDisagree.length,
        correct: sideDisagreeCorrect.length,
        incorrect: sideDisagreeIncorrect.length,
        games: sideDisagree.map((g) => ({
          gameId: g.gameId,
          matchup: g.matchup,
          modelSelection: g.modelSelection,
          marketFavorite: g.marketFavorite,
          actualWinner: g.actualWinner,
          grade: g.grade,
          whoWasRight:
            g.actualWinner === g.modelSelection
              ? "MODEL"
              : g.actualWinner === g.marketFavorite
                ? "MARKET"
                : "NEITHER_OR_DRAW",
        })),
      },
      focusGames: {
        pitAtCin: pitCin
          ? {
              matchup: pitCin.matchup,
              modelSelection: pitCin.modelSelection,
              marketFavorite: pitCin.marketFavorite,
              actualWinner: pitCin.actualWinner,
              grade: pitCin.grade,
              scorecardClass: pitCin.marketAgreementClass,
              verdict:
                "Market favorite (AWAY/PIT) won; model HOME lost. Classified NEAR_EVEN by |p-0.5| policy despite side disagreement.",
            }
          : null,
        milAtLaa: milLaa
          ? {
              matchup: milLaa.matchup,
              modelSelection: milLaa.modelSelection,
              marketFavorite: milLaa.marketFavorite,
              actualWinner: milLaa.actualWinner,
              grade: milLaa.grade,
              scorecardClass: milLaa.marketAgreementClass,
              verdict:
                "Market favorite (AWAY/MIL) won; model HOME lost. Same NEAR_EVEN vs side-disagree nuance.",
            }
          : null,
      },
    },
    blockedPolicyReview: {
      judgment: bothBlockedIncorrect
        ? "BLOCK_POLICY_PROTECTED"
        : "MIXED_EVIDENCE",
      games: blockedPolicyReview,
      note: "n=2; do not change minInningsForPartial=15 from this slate.",
    },
    probabilityInterpretation: {
      meanBrier: dailyMetrics.meanBrier,
      meanLogLoss: dailyMetrics.meanLogLoss,
      meanSelectedProbability:
        scorecard.mostLikelyPerformance.meanSelectedProbability,
      probabilityRangeNote:
        "All research selected probabilities fell in ~0.50–0.55; higher buckets empty.",
      calibrationBuckets: scorecard.calibrationBuckets,
      confidenceBuckets: scorecard.confidenceBuckets,
      interpretation: [
        "Accuracy 61.5% is not a calibrated probability claim.",
        "Brier≈0.244 / LogLoss≈0.680 on a narrow near-even slate is observational only.",
        "Calibration and confidence buckets remain INSUFFICIENT_SAMPLE / OBSERVATION_ONLY.",
      ],
      status: "INSUFFICIENT_SAMPLE",
    },
    hypothesisCandidates: hypotheses,
    repeatedPatterns: patterns,
    limitations: [
      "Single KST date; no weight or threshold changes from this review.",
      "Official sample=0; figures are research observation only — not official performance.",
      "Bullpen/lineup weights are 0; do not assert them as proven failure causes.",
      "ValueSelection has no ROI without settlement rules.",
      "Scorecard MODEL_MARKET_DISAGREE can be EMPTY while side-favorite disagreements exist under NEAR_EVEN.",
    ],
    conclusion: "DATA_ACCUMULATION_CONTINUES",
  };

  const reviewDetailHash = sha256(bodyWithoutHash);
  const document = {
    meta: {
      schemaVersion: MLB_REVIEW_DETAIL_V0_SCHEMA,
      dateKst,
      generatedAt: new Date().toISOString(),
      reviewDetailHash,
      predictionHashSha256: asString(meta.predictionHashSha256),
      dryRun: input.dryRun === true,
      observationOnly: true,
    },
    ...bodyWithoutHash,
  };

  let wrote = false;
  if (!input.dryRun) {
    await writeFile(
      path.join(cwd, outRel),
      JSON.stringify(document, null, 2) + "\n",
      "utf8",
    );
    wrote = true;
  }

  return { document, pathRel: outRel, wrote };
}

export function reviewDetailContentHash(doc: Record<string, unknown>): string {
  const { meta: _m, ...rest } = doc;
  void _m;
  return sha256(rest);
}
