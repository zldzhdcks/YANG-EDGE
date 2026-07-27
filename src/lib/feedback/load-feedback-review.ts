/**
 * EDGE 피드백 센터용 서버 전용 리뷰 로더.
 * 브라우저 번들에 fs 가 포함되지 않도록 server-only 를 사용한다.
 * 파일 없거나 손상 시 빈 상태를 반환한다. 임의 값은 만들지 않는다.
 */
import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  FeedbackCenterData,
  FeedbackDayReview,
  FeedbackReviewItem,
  FeedbackReviewMeta,
  FeedbackResultStatus,
  FeedbackVerdict,
} from "@/types/feedback";

const PREDICTIONS_DIR = path.join(process.cwd(), "data", "predictions");
const REVIEW_SUFFIX = "-review.json";

const VERDICTS: ReadonlySet<string> = new Set([
  "SIGNAL_WORKED",
  "SIGNAL_FAILED",
  "INCONCLUSIVE",
]);

const RESULT_STATUSES: ReadonlySet<string> = new Set([
  "graded",
  "pending",
  "postponed",
  "cancelled",
  "result-not-found",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function parseVerdict(v: unknown): FeedbackVerdict | null {
  if (typeof v !== "string") return null;
  return VERDICTS.has(v) ? (v as FeedbackVerdict) : null;
}

function parseResultStatus(v: unknown): FeedbackResultStatus {
  if (typeof v === "string" && RESULT_STATUSES.has(v)) {
    return v as FeedbackResultStatus;
  }
  return "result-not-found";
}

function parseSide(v: unknown): "home" | "away" | "unknown" {
  if (v === "home" || v === "away") return v;
  return "unknown";
}

function parseWinner(v: unknown): "home" | "away" | "draw" | null {
  if (v === "home" || v === "away" || v === "draw") return v;
  return null;
}

function parseReviewItem(raw: unknown): FeedbackReviewItem | null {
  if (!isRecord(raw)) return null;

  const gameId = asString(raw.gameId);
  const league = asString(raw.league);
  const match = asString(raw.match);
  const recommendedTeam = asString(raw.recommendedTeam);
  if (!gameId || !league || !match || !recommendedTeam) return null;

  const actualRaw = isRecord(raw.actual) ? raw.actual : {};
  const snapshotRaw = isRecord(raw.snapshot) ? raw.snapshot : {};
  const evidenceRaw = isRecord(raw.evidenceAtPrediction)
    ? raw.evidenceAtPrediction
    : {};
  const feedbackRaw = isRecord(raw.feedback) ? raw.feedback : {};

  const verdict = parseVerdict(feedbackRaw.verdict);
  if (!verdict) return null;

  const recentRaw = isRecord(evidenceRaw.recentGameCounts)
    ? evidenceRaw.recentGameCounts
    : null;
  const recentHome = recentRaw ? asNumber(recentRaw.home) : null;
  const recentAway = recentRaw ? asNumber(recentRaw.away) : null;
  const recentMin = recentRaw ? asNumber(recentRaw.minRequired) : null;

  return {
    gameId,
    league,
    match,
    matchDisplay: asString(raw.matchDisplay),
    recommendedTeam,
    recommendedSide: parseSide(raw.recommendedSide),
    actual: {
      homeScore: asNumber(actualRaw.homeScore),
      awayScore: asNumber(actualRaw.awayScore),
      scoreline: asString(actualRaw.scoreline),
      winner: parseWinner(actualRaw.winner),
      winnerTeam: asString(actualRaw.winnerTeam),
      resultStatus: parseResultStatus(actualRaw.resultStatus),
    },
    predictionCorrect: asBoolean(raw.predictionCorrect),
    snapshot: {
      probability: asNumber(snapshotRaw.probability),
      edgeScore: asNumber(snapshotRaw.edgeScore),
      confidence: asNumber(snapshotRaw.confidence),
      recommendationGrade: asString(snapshotRaw.recommendationGrade),
      marketProbability: asNumber(snapshotRaw.marketProbability),
      valueEdge: asNumber(snapshotRaw.valueEdge),
    },
    evidenceAtPrediction: {
      usedData: asStringArray(evidenceRaw.usedData),
      missingData: asStringArray(evidenceRaw.missingData),
      unavailableFactors: asStringArray(evidenceRaw.unavailableFactors),
      dataAvailability: asNumber(evidenceRaw.dataAvailability),
      recentGameCounts:
        recentHome != null && recentAway != null && recentMin != null
          ? { home: recentHome, away: recentAway, minRequired: recentMin }
          : null,
      oddsMatched: asBoolean(evidenceRaw.oddsMatched),
    },
    feedback: {
      verdict,
      hypotheses: asStringArray(feedbackRaw.hypotheses),
      notes: asStringArray(feedbackRaw.notes),
    },
  };
}

function parseMeta(raw: unknown, fallbackDate: string): FeedbackReviewMeta | null {
  if (!isRecord(raw)) return null;
  const dateKst = asString(raw.dateKst) ?? fallbackDate;
  if (!dateKst) return null;

  return {
    version: asString(raw.version) ?? "unknown",
    dateKst,
    generatedAt: asString(raw.generatedAt),
    sourceSnapshot: asString(raw.sourceSnapshot),
    sourceAnalysis: asString(raw.sourceAnalysis),
    totalPredictions: asNumber(raw.totalPredictions) ?? 0,
    gradedGames: asNumber(raw.gradedGames) ?? 0,
    signalWorked: asNumber(raw.signalWorked) ?? 0,
    signalFailed: asNumber(raw.signalFailed) ?? 0,
    inconclusive: asNumber(raw.inconclusive) ?? 0,
    liveAccuracyPercent: asNumber(raw.liveAccuracyPercent),
    limitations: asStringArray(raw.limitations),
  };
}

function parseReviewFile(
  raw: unknown,
  fallbackDate: string,
): FeedbackDayReview | null {
  if (!isRecord(raw)) return null;
  const meta = parseMeta(raw.meta, fallbackDate);
  if (!meta) return null;

  const reviewsRaw = Array.isArray(raw.reviews) ? raw.reviews : [];
  const reviews = reviewsRaw
    .map(parseReviewItem)
    .filter((r): r is FeedbackReviewItem => r != null);

  return { meta, reviews };
}

async function listReviewFiles(): Promise<string[]> {
  try {
    const names = await readdir(PREDICTIONS_DIR);
    return names
      .filter((n) => n.endsWith(REVIEW_SUFFIX))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

async function loadOneReviewFile(
  fileName: string,
): Promise<FeedbackDayReview | null> {
  const dateFromName = fileName.replace(REVIEW_SUFFIX, "");
  try {
    const full = path.join(PREDICTIONS_DIR, fileName);
    const text = await readFile(full, "utf8");
    const json: unknown = JSON.parse(text);
    return parseReviewFile(json, dateFromName);
  } catch {
    return null;
  }
}

function emptyCenter(): FeedbackCenterData {
  return {
    days: [],
    summary: {
      totalPredictions: 0,
      gradedGames: 0,
      signalWorked: 0,
      signalFailed: 0,
      inconclusive: 0,
      liveAccuracyPercent: null,
    },
  };
}

function buildSummary(days: FeedbackDayReview[]): FeedbackCenterData["summary"] {
  let totalPredictions = 0;
  let gradedGames = 0;
  let signalWorked = 0;
  let signalFailed = 0;
  let inconclusive = 0;

  for (const day of days) {
    totalPredictions += day.meta.totalPredictions;
    gradedGames += day.meta.gradedGames;
    signalWorked += day.meta.signalWorked;
    signalFailed += day.meta.signalFailed;
    inconclusive += day.meta.inconclusive;
  }

  const decided = signalWorked + signalFailed;
  const liveAccuracyPercent =
    decided > 0
      ? Math.round((signalWorked / decided) * 10000) / 100
      : null;

  return {
    totalPredictions,
    gradedGames,
    signalWorked,
    signalFailed,
    inconclusive,
    liveAccuracyPercent,
  };
}

/**
 * data/predictions/*-review.json 을 읽어 피드백 센터 데이터를 만든다.
 * - prediction-review-v1 mirror만 포함 (meta.version 또는 유효 reviews)
 * - 날짜는 파일명 하드코딩이 아니라 meta.dateKst 기준 정렬
 * 파일이 없거나 손상되면 빈 days 를 반환한다.
 */
export async function loadFeedbackCenterData(): Promise<FeedbackCenterData> {
  const files = await listReviewFiles();
  if (files.length === 0) return emptyCenter();

  const days: FeedbackDayReview[] = [];
  for (const file of files) {
    const day = await loadOneReviewFile(file);
    if (!day) continue;
    // Skip non site-mirror research dumps that don't parse as prediction-review-v1
    if (
      day.meta.version !== "prediction-review-v1" &&
      day.meta.version !== "unknown"
    ) {
      continue;
    }
    days.push(day);
  }

  days.sort((a, b) => {
    const byDate = b.meta.dateKst.localeCompare(a.meta.dateKst);
    if (byDate !== 0) return byDate;
    return (b.meta.generatedAt ?? "").localeCompare(a.meta.generatedAt ?? "");
  });

  return {
    days,
    summary: buildSummary(days),
  };
}
