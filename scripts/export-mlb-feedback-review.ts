/**
 * MLB 연구 채점 결과 → Feedback Center용 prediction-review-v1 변환.
 *
 * 입력:
 *   data/predictions/mlb/{date}.json
 *   data/predictions/mlb/{date}-review.json
 * 출력:
 *   data/predictions/{date}-mlb-review.json
 *
 * 예측 불변 필드는 읽기만 한다. EDGE Engine / weights / UI 로직 미수정.
 *
 * 실행:
 *   npx tsx scripts/export-mlb-feedback-review.ts [YYYY-MM-DD]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dateKst = process.argv[2] ?? "2026-07-27";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${dateKst}.json`,
);
const MLB_REVIEW_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${dateKst}-review.json`,
);
const OUT_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  `${dateKst}-mlb-review.json`,
);

type FeedbackVerdict = "SIGNAL_WORKED" | "SIGNAL_FAILED" | "INCONCLUSIVE";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}
function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function resolveSide(
  pick: string | null,
  home: string,
  away: string,
): "home" | "away" | "unknown" {
  if (!pick) return "unknown";
  if (pick === home) return "home";
  if (pick === away) return "away";
  return "unknown";
}

function mapResultStatus(
  status: string | null,
): "graded" | "pending" | "postponed" | "cancelled" | "result-not-found" {
  if (status === "graded") return "graded";
  if (status === "pending") return "pending";
  if (status === "postponed") return "postponed";
  if (status === "cancelled") return "cancelled";
  if (status === "inconclusive") return "result-not-found";
  return "pending";
}

function mapVerdict(
  classification: string | null,
  hit: boolean | null,
  resultStatus: string | null,
): FeedbackVerdict {
  if (classification === "SIGNAL_WORKED") return "SIGNAL_WORKED";
  if (classification === "SIGNAL_FAILED") return "SIGNAL_FAILED";
  if (classification === "INCONCLUSIVE") return "INCONCLUSIVE";
  if (hit === true) return "SIGNAL_WORKED";
  if (hit === false) return "SIGNAL_FAILED";
  if (resultStatus === "pending") return "INCONCLUSIVE";
  return "INCONCLUSIVE";
}

async function main() {
  let snapshotRaw: string;
  let mlbReviewRaw: string;
  try {
    snapshotRaw = await readFile(SNAPSHOT_PATH, "utf8");
  } catch {
    throw new Error(
      `Feedback export: missing research snapshot ${path.relative(process.cwd(), SNAPSHOT_PATH)}`,
    );
  }
  try {
    mlbReviewRaw = await readFile(MLB_REVIEW_PATH, "utf8");
  } catch {
    throw new Error(
      `Feedback export: missing research review ${path.relative(process.cwd(), MLB_REVIEW_PATH)}`,
    );
  }
  const snapshot = JSON.parse(snapshotRaw);
  const mlbReview = JSON.parse(mlbReviewRaw);

  const snapRoot = asRecord(snapshot);
  const reviewRoot = asRecord(mlbReview);
  const predictions = Array.isArray(snapRoot?.predictions)
    ? snapRoot.predictions
    : [];
  const games = Array.isArray(reviewRoot?.games) ? reviewRoot.games : [];
  const gameById = new Map<string, Record<string, unknown>>();
  for (const entry of games) {
    const row = asRecord(entry);
    const id = asString(row?.gameId);
    if (id && row) gameById.set(id, row);
  }

  const reviews = [];
  for (const entry of predictions) {
    const pred = asRecord(entry);
    if (!pred) continue;
    const gameId = asString(pred.gameId);
    if (!gameId) continue;
    const home = asString(pred.homeTeam) ?? "";
    const away = asString(pred.awayTeam) ?? "";
    const pick = asString(pred.baselinePick);
    const review = gameById.get(gameId) ?? {};
    const homeScore = asNumber(pred.homeScore) ?? asNumber(review.homeScore);
    const awayScore = asNumber(pred.awayScore) ?? asNumber(review.awayScore);
    const winner =
      asString(pred.actualWinner) === "home" ||
      asString(pred.actualWinner) === "away" ||
      asString(pred.actualWinner) === "draw"
        ? (asString(pred.actualWinner) as "home" | "away" | "draw")
        : null;
    const winnerTeam =
      winner === "home" ? home : winner === "away" ? away : null;
    const resultStatus = mapResultStatus(asString(pred.resultStatus));
    const hit =
      asBoolean(pred.predictionHit) ?? asBoolean(review.predictionHit);
    const verdict = mapVerdict(
      asString(pred.feedbackClassification) ??
        asString(review.feedbackClassification),
      hit,
      asString(pred.resultStatus),
    );
    const notes = asStringArray(review.reviewNotes);
    const hypotheses = asStringArray(review.hypotheses);

    reviews.push({
      gameId,
      league: asString(pred.league) ?? "MLB",
      match: `${away} vs ${home}`,
      matchDisplay: `${away} @ ${home}`,
      recommendedTeam: pick ?? "확인되지 않음",
      recommendedSide: resolveSide(pick, home, away),
      actual: {
        homeScore,
        awayScore,
        scoreline:
          homeScore != null && awayScore != null
            ? `${homeScore}-${awayScore}`
            : null,
        winner,
        winnerTeam,
        resultStatus,
      },
      predictionCorrect: hit,
      snapshot: {
        probability: asNumber(pred.modelProbability),
        edgeScore: asNumber(pred.edgeScore),
        confidence: asNumber(pred.confidence),
        recommendationGrade: asString(pred.recommendationGrade),
        marketProbability: asNumber(pred.marketProbability),
        valueEdge: asNumber(pred.valueEdge),
      },
      evidenceAtPrediction: {
        usedData: asStringArray(pred.usedFactors),
        missingData: asStringArray(pred.missingFactors),
        unavailableFactors: asStringArray(pred.missingFactors),
        dataAvailability: asNumber(pred.dataAvailability),
        recentGameCounts: null,
        oddsMatched:
          asNumber(pred.openingOdds) != null ||
          asNumber(pred.latestOdds) != null
            ? true
            : asNumber(pred.marketProbability) != null
              ? true
              : null,
      },
      feedback: {
        verdict,
        hypotheses,
        notes:
          notes.length > 0
            ? notes
            : verdict === "SIGNAL_WORKED"
              ? [
                  "추천 방향과 실제 결과가 일치했습니다.",
                  "한 경기로 신호 유효성을 확정할 수 없습니다.",
                ]
              : verdict === "SIGNAL_FAILED"
                ? [
                    "추천 방향과 실제 결과가 일치하지 않았습니다.",
                    "실패 원인을 단정하지 않습니다.",
                  ]
                : [
                    "결과가 확정되지 않아 신호 일치 여부를 판단할 수 없습니다.",
                  ],
      },
    });
  }

  const signalWorked = reviews.filter(
    (r) => r.feedback.verdict === "SIGNAL_WORKED",
  ).length;
  const signalFailed = reviews.filter(
    (r) => r.feedback.verdict === "SIGNAL_FAILED",
  ).length;
  const inconclusive = reviews.filter(
    (r) => r.feedback.verdict === "INCONCLUSIVE",
  ).length;
  const gradedGames = signalWorked + signalFailed;
  const pendingCount = reviews.filter(
    (r) => r.actual.resultStatus === "pending",
  ).length;
  const liveAccuracyPercent =
    gradedGames > 0
      ? Math.round((signalWorked / gradedGames) * 10000) / 100
      : null;

  const limitations = [
    "MLB 연구용 스냅샷 채점 결과이다. 구매 라인이 아니다.",
    "표본이 작아 적중률로 엔진 성능을 단정하지 않는다.",
    "실패 원인을 단정하지 않으며 hypotheses는 저장 데이터 근거 가능성만 기록한다.",
  ];
  if (pendingCount > 0) {
    limitations.push(
      `pending ${pendingCount}경기는 종료 후 동일 파이프라인으로 추가 채점한다.`,
    );
  }

  const out = {
    meta: {
      version: "prediction-review-v1" as const,
      dateKst,
      generatedAt: new Date().toISOString(),
      sourceSnapshot: path
        .relative(process.cwd(), SNAPSHOT_PATH)
        .replace(/\\/g, "/"),
      sourceAnalysis: path
        .relative(process.cwd(), MLB_REVIEW_PATH)
        .replace(/\\/g, "/"),
      totalPredictions: reviews.length,
      gradedGames,
      signalWorked,
      signalFailed,
      inconclusive,
      pendingCount,
      liveAccuracyPercent,
      limitations,
    },
    reviews,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log(
    `Feedback export: ${dateKst} graded=${gradedGames} worked=${signalWorked} failed=${signalFailed} inconclusive=${inconclusive} pending=${pendingCount}`,
  );
  console.log(`저장: ${path.relative(process.cwd(), OUT_PATH)}`);
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
