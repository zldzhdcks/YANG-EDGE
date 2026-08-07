import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadDailyPicksV1 } from "@/lib/mlb/daily-picks-v1";
import { loadGoodPickFeedbackV1 } from "@/lib/mlb/good-pick-feedback-v1";
import type { GoodPickGameFeedback } from "@/lib/mlb/good-pick-feedback-v1";
import {
  loadEngineRecommendationRecord,
} from "@/lib/mlb/recommendation-provenance-v1";
import {
  EARLY_SAMPLE_THRESHOLD,
  GOOD_PICK_LEARNING_TRACKER_SCHEMA,
  SMALL_SAMPLE_THRESHOLD,
  type DayTrackerRow,
  type DayTrackerStatus,
  type GoodPickLearningTrackerView,
  type MarginBucket,
  type MarketAlignmentBucket,
  type SampleStats,
  type SignalComboRow,
} from "./types";

function emptyStats(): SampleStats {
  return {
    sample: 0,
    correct: 0,
    incorrect: 0,
    pending: 0,
    accuracyPercent: null,
    smallSample: true,
  };
}

function finalizeStats(s: SampleStats): SampleStats {
  const graded = s.correct + s.incorrect;
  return {
    ...s,
    sample: graded + s.pending,
    accuracyPercent:
      graded > 0 ? Math.round((s.correct / graded) * 1000) / 10 : null,
    smallSample: graded < SMALL_SAMPLE_THRESHOLD,
  };
}

function bump(
  s: SampleStats,
  grade: GoodPickGameFeedback["grade"],
): void {
  if (grade === "CORRECT") s.correct++;
  else if (grade === "INCORRECT") s.incorrect++;
  else s.pending++;
}

export function classifyMarketAlignment(
  game: GoodPickGameFeedback,
): MarketAlignmentBucket {
  if (game.preGameRisks.some((r) => r.code === "MARKET_CONFLICT")) {
    return "MARKET_CONFLICT";
  }
  const market = game.beforeSignals.find((s) => s.id === "market");
  if (!market) return "MARKET_UNKNOWN";
  if (market.polarity === "POSITIVE") return "MARKET_ALIGNED";
  if (market.polarity === "NEGATIVE") return "MARKET_CONFLICT";
  return "MARKET_UNKNOWN";
}

export function classifyMargin(
  game: GoodPickGameFeedback,
): MarginBucket {
  if (game.homeScore == null || game.awayScore == null) return "UNKNOWN";
  const diff = Math.abs(game.homeScore - game.awayScore);
  if (diff <= 1) return "ONE_RUN";
  if (diff <= 3) return "TWO_THREE_RUN";
  return "FOUR_PLUS";
}

function signalPolarity(
  game: GoodPickGameFeedback,
  id: string,
): string | null {
  return game.beforeSignals.find((s) => s.id === id)?.polarity ?? null;
}

type ComboDef = {
  id: string;
  label: string;
  match: (g: GoodPickGameFeedback) => boolean;
};

const COMBO_DEFS: ComboDef[] = [
  {
    id: "starter_pos_market_pos",
    label: "Starter Positive + Market Positive",
    match: (g) =>
      signalPolarity(g, "starter") === "POSITIVE" &&
      signalPolarity(g, "market") === "POSITIVE",
  },
  {
    id: "starter_pos_market_neg",
    label: "Starter Positive + Market Negative",
    match: (g) =>
      signalPolarity(g, "starter") === "POSITIVE" &&
      signalPolarity(g, "market") === "NEGATIVE",
  },
  {
    id: "home_advantage",
    label: "Home Advantage (Positive)",
    match: (g) => signalPolarity(g, "homeAdvantage") === "POSITIVE",
  },
  {
    id: "lineup_limited",
    label: "Lineup Limited",
    match: (g) => signalPolarity(g, "lineup") === "LIMITED",
  },
  {
    id: "bullpen_not_connected",
    label: "Bullpen Not Connected",
    match: (g) => signalPolarity(g, "bullpen") === "NOT_CONNECTED",
  },
];

/**
 * Discover slate dates from schedule artifacts (YYYY-MM-DD-schedule-v1.json).
 */
export async function discoverMlbSlateDates(cwd: string): Promise<string[]> {
  const dir = path.join(cwd, "data", "research", "mlb");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const dates = names
    .map((n) => {
      const m = /^(\d{4}-\d{2}-\d{2})-schedule-v1\.json$/.exec(n);
      return m?.[1] ?? null;
    })
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates;
}

export async function loadGoodPickLearningTrackerV1(input: {
  /** Inclusive end date for discovery filter; defaults to all discovered */
  asOfDateKst?: string;
  /** Explicit dates; if omitted, discover from schedules */
  dates?: string[];
  cwd?: string;
}): Promise<GoodPickLearningTrackerView> {
  const cwd = input.cwd ?? process.cwd();
  const discovered = await discoverMlbSlateDates(cwd);
  let dates = input.dates?.length ? [...input.dates] : [...discovered];
  if (input.asOfDateKst) {
    dates = dates.filter((d) => d <= input.asOfDateKst!);
  }
  dates = [...new Set(dates)].sort();

  const asOfDateKst = input.asOfDateKst ?? dates[dates.length - 1] ?? "";

  const days: DayTrackerRow[] = [];
  const predictionHashes: Record<string, string | null> = {};
  const gradedGames: GoodPickGameFeedback[] = [];
  const awaitingGames: GoodPickGameFeedback[] = [];

  for (const dateKst of dates) {
    const picks = await loadDailyPicksV1({
      dateKst,
      cwd,
      sealDeliveryRecord: true,
    });
    predictionHashes[dateKst] = picks.predictionHash;

    let status: DayTrackerStatus;
    let line: string;
    let countsTowardRecord = false;

    if (
      picks.provenanceBanner.status === "NO_PREGAME_SNAPSHOT" ||
      (!picks.loaded && picks.error?.includes("NO_PREGAME_SNAPSHOT"))
    ) {
      status = "NO_PREGAME_SNAPSHOT";
      line = "NO_PREGAME_SNAPSHOT";
      countsTowardRecord = false;
      days.push({
        dateKst,
        status,
        goodPickCount: 0,
        correct: 0,
        incorrect: 0,
        pending: 0,
        accuracyPercent: null,
        countsTowardRecord,
        line,
        feedbackHref: `/internal/feedback/mlb?date=${encodeURIComponent(dateKst)}`,
      });
      continue;
    }

    const delivery = await loadEngineRecommendationRecord({ dateKst, cwd });
    const engineGameIds = new Set(
      (delivery?.picks ?? [])
        .filter((p) => p.sourceType === "ENGINE_SNAPSHOT")
        .map((p) => p.gameId),
    );

    // Reconstructed historical picks are never ENGINE recommendations
    if (
      !delivery &&
      picks.reconstructedPicks.length > 0 &&
      picks.goodPicks.length === 0 &&
      picks.strongPicks.length === 0
    ) {
      status = "NO_GOOD_PICKS";
      line = `RECONSTRUCTED ${picks.reconstructedPicks.length} · EXCLUDED FROM RECORD`;
      days.push({
        dateKst,
        status,
        goodPickCount: 0,
        correct: 0,
        incorrect: 0,
        pending: 0,
        accuracyPercent: null,
        countsTowardRecord: false,
        line,
        feedbackHref: `/internal/feedback/mlb?date=${encodeURIComponent(dateKst)}`,
      });
      continue;
    }

    const fb = await loadGoodPickFeedbackV1({ dateKst, cwd });
    // Only engine-delivered gameIds enter official record path
    const engineFbGames = fb.games.filter((g) => engineGameIds.has(g.gameId));

    if (engineGameIds.size === 0) {
      status = "NO_GOOD_PICKS";
      line = "NO ENGINE_SNAPSHOT RECOMMENDATIONS";
      days.push({
        dateKst,
        status,
        goodPickCount: 0,
        correct: 0,
        incorrect: 0,
        pending: 0,
        accuracyPercent: null,
        countsTowardRecord: false,
        line,
        feedbackHref: `/internal/feedback/mlb?date=${encodeURIComponent(dateKst)}`,
      });
      continue;
    }

    const correctN = engineFbGames.filter((g) => g.grade === "CORRECT").length;
    const incorrectN = engineFbGames.filter((g) => g.grade === "INCORRECT").length;
    const pendingN = engineFbGames.filter(
      (g) => g.grade !== "CORRECT" && g.grade !== "INCORRECT",
    ).length;
    const gradedN = correctN + incorrectN;
    const acc =
      gradedN > 0 ? Math.round((correctN / gradedN) * 1000) / 10 : null;

    if (gradedN === 0) {
      status = "AWAITING_RESULT";
      line = `AWAITING_RESULT · ${engineGameIds.size} ENGINE Good Pick`;
      countsTowardRecord = false;
      awaitingGames.push(...engineFbGames);
    } else {
      status = "GRADED";
      line = `${correctN}/${gradedN} · ${acc}%`;
      countsTowardRecord = true;
      gradedGames.push(
        ...engineFbGames.filter(
          (g) => g.grade === "CORRECT" || g.grade === "INCORRECT",
        ),
      );
      awaitingGames.push(
        ...engineFbGames.filter(
          (g) => g.grade !== "CORRECT" && g.grade !== "INCORRECT",
        ),
      );
    }

    days.push({
      dateKst,
      status,
      goodPickCount: engineGameIds.size,
      correct: correctN,
      incorrect: incorrectN,
      pending: pendingN,
      accuracyPercent: acc,
      countsTowardRecord,
      line,
      feedbackHref: `/internal/feedback/mlb?date=${encodeURIComponent(dateKst)}`,
    });
  }

  // Cumulative record — graded only; NO_PREGAME_SNAPSHOT & AWAITING excluded from denominator
  let correct = 0;
  let incorrect = 0;
  for (const g of gradedGames) {
    if (g.grade === "CORRECT") correct++;
    else if (g.grade === "INCORRECT") incorrect++;
  }
  const totalGoodPicks = correct + incorrect;
  const accuracyPercent =
    totalGoodPicks > 0
      ? Math.round((correct / totalGoodPicks) * 1000) / 10
      : null;
  const earlySample = totalGoodPicks < EARLY_SAMPLE_THRESHOLD;

  // Signal combos — graded games only for accuracy; pending excluded from accuracy
  const signalCombos: SignalComboRow[] = COMBO_DEFS.map((def) => {
    const stats = emptyStats();
    for (const g of gradedGames) {
      if (def.match(g)) bump(stats, g.grade);
    }
    return { id: def.id, label: def.label, stats: finalizeStats(stats) };
  });

  // Market alignment
  const marketBuckets: MarketAlignmentBucket[] = [
    "MARKET_ALIGNED",
    "MARKET_CONFLICT",
    "MARKET_UNKNOWN",
  ];
  const marketAlignment = marketBuckets.map((bucket) => {
    const stats = emptyStats();
    for (const g of gradedGames) {
      if (classifyMarketAlignment(g) === bucket) bump(stats, g.grade);
    }
    const label =
      bucket === "MARKET_ALIGNED"
        ? "Market Aligned"
        : bucket === "MARKET_CONFLICT"
          ? "Market Conflict"
          : "Market Unknown";
    return { bucket, label, stats: finalizeStats(stats) };
  });

  // Margins — graded with scores
  const marginInit: Record<
    MarginBucket,
    { correct: number; incorrect: number }
  > = {
    ONE_RUN: { correct: 0, incorrect: 0 },
    TWO_THREE_RUN: { correct: 0, incorrect: 0 },
    FOUR_PLUS: { correct: 0, incorrect: 0 },
    UNKNOWN: { correct: 0, incorrect: 0 },
  };
  for (const g of gradedGames) {
    const b = classifyMargin(g);
    if (g.grade === "CORRECT") marginInit[b].correct++;
    else if (g.grade === "INCORRECT") marginInit[b].incorrect++;
  }
  const margins = (
    [
      ["ONE_RUN", "1-run game"],
      ["TWO_THREE_RUN", "2–3 run game"],
      ["FOUR_PLUS", "4+ run game"],
    ] as const
  ).map(([bucket, label]) => {
    const row = marginInit[bucket];
    const total = row.correct + row.incorrect;
    return {
      bucket: bucket as MarginBucket,
      label,
      correct: row.correct,
      incorrect: row.incorrect,
      total,
      plain:
        total === 0
          ? "표본 없음"
          : `Correct ${row.correct} · Incorrect ${row.incorrect} · n=${total}${
              total < SMALL_SAMPLE_THRESHOLD ? " · SMALL_SAMPLE" : ""
            }`,
    };
  });

  return {
    schemaVersion: GOOD_PICK_LEARNING_TRACKER_SCHEMA,
    asOfDateKst,
    loaded: true,
    error: null,
    record: {
      totalGoodPicks,
      correct,
      incorrect,
      pending: awaitingGames.length,
      accuracyPercent,
      earlySample,
      recordLine:
        totalGoodPicks === 0
          ? "아직 채점된 Good Pick이 없습니다"
          : `${correct}-${incorrect} · ${accuracyPercent}% · Sample ${totalGoodPicks}${
              earlySample ? " · EARLY SAMPLE" : ""
            }`,
    },
    days,
    signalCombos,
    marketAlignment,
    margins,
    probabilityVsConfidence: {
      probabilityPlain:
        "Model Win Probability — RESEARCH_BASELINE_V0이 산출한 해당 팀 승률(%)입니다. 클램프 35–65% 구간입니다. 적중 여부와 별개입니다.",
      confidencePlain:
        "Confidence — 입력 품질·선발·배당·라인업 확정·경고 수 등으로부터 계산된 0–100 연구용 신뢰도입니다. 승률이 아닙니다. 기존 Artifact 값을 표시만 하며 재계산하지 않습니다.",
    },
    predictionHashes,
    sourceNote:
      "ENGINE_SNAPSHOT + generatedBeforeGame만 성적 분모 · RECONSTRUCTED/NO_PREGAME_SNAPSHOT 제외 · 사전 신호만 조합 집계",
  };
}
