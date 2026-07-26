/**
 * 예측 스냅샷 사후 리뷰 (조회·분석만).
 *
 * 입력:
 *   data/predictions/{date}.json                     (채점 완료 스냅샷)
 *   data/daily-tests/{date}-1800-baseball-analysis.json (당시 분석 근거)
 * 출력:
 *   data/predictions/{date}-review.json
 *
 * - 저장 당시 prediction / probability / edgeScore / confidence /
 *   recommendationGrade / marketProbability / valueEdge 는 읽기만 한다.
 * - 실패 원인을 단정하지 않는다. 가능성(hypotheses)으로만 기록.
 * - 같은 입력이면 결과가 동일 (generatedAt 제외 비교 → 중복 생성 없음).
 *
 * 실행: npx tsx scripts/review-prediction-snapshot.ts [YYYY-MM-DD]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";

type ResultStatus =
  | "graded"
  | "pending"
  | "postponed"
  | "cancelled"
  | "result-not-found";

type PredictionItem = {
  gameId: string;
  league: string;
  home: string;
  away: string;
  prediction: string;
  probability: number | null;
  edgeScore: number | null;
  confidence: number | null;
  recommendationGrade: string | null;
  marketProbability: number | null;
  valueEdge: number | null;
  createdAt: string;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
  actualWinner?: "home" | "away" | "draw" | null;
  predictionCorrect?: boolean | null;
  resultStatus?: ResultStatus;
  gradedAt?: string | null;
  externalId?: string | null;
};

type SnapshotFile = {
  meta: Record<string, unknown> & { dateKst: string };
  predictions: PredictionItem[];
};

type AnalysisGame = {
  gameId: string;
  matchDisplay?: string;
  homeTeamDisplay?: string;
  awayTeamDisplay?: string;
  recentGameCounts?: { home: number; away: number; minRequired: number };
  dataAvailability?: number;
  factorAvailability?: Record<string, boolean>;
  usedEvidence?: string[];
  missingData?: string[];
  finalStatus?: string;
  odds?: { matched?: boolean; bestHomeOdds?: number; bestAwayOdds?: number };
};

type AnalysisFile = {
  meta?: Record<string, unknown>;
  games?: AnalysisGame[];
};

/** 결과를 미리 알았던 것처럼 쓰지 않기 위한 3분류 */
type FeedbackVerdict = "SIGNAL_WORKED" | "SIGNAL_FAILED" | "INCONCLUSIVE";

type ReviewItem = {
  gameId: string;
  league: string;
  match: string;
  matchDisplay: string | null;
  recommendedTeam: string;
  recommendedSide: "home" | "away" | "unknown";
  actual: {
    homeScore: number | null;
    awayScore: number | null;
    scoreline: string | null;
    winner: "home" | "away" | "draw" | null;
    winnerTeam: string | null;
    resultStatus: ResultStatus;
  };
  predictionCorrect: boolean | null;
  snapshot: {
    probability: number | null;
    edgeScore: number | null;
    confidence: number | null;
    recommendationGrade: string | null;
    marketProbability: number | null;
    valueEdge: number | null;
  };
  evidenceAtPrediction: {
    usedData: string[];
    missingData: string[];
    unavailableFactors: string[];
    dataAvailability: number | null;
    recentGameCounts: { home: number; away: number; minRequired: number } | null;
    oddsMatched: boolean | null;
  };
  feedback: {
    verdict: FeedbackVerdict;
    /** 단정 아님 — 가능성만 */
    hypotheses: string[];
    notes: string[];
  };
};

type ReviewFile = {
  meta: {
    version: "prediction-review-v1";
    dateKst: string;
    generatedAt: string;
    sourceSnapshot: string;
    sourceAnalysis: string;
    totalPredictions: number;
    gradedGames: number;
    signalWorked: number;
    signalFailed: number;
    inconclusive: number;
    /** 채점된 경기 기준 실전 적중률 (%) */
    liveAccuracyPercent: number | null;
    limitations: string[];
  };
  reviews: ReviewItem[];
};

const LIMITATIONS = [
  "채점 표본이 3경기뿐이라 적중률의 신뢰구간이 매우 넓다.",
  "모든 경기가 같은 날(2026-07-25) 야구 경기로, 종목·리그·일정 다양성이 없다.",
  "선발투수·부상·리그순위 데이터가 전 경기에서 누락된 상태로 산출된 예측이다.",
  "추천 등급이 전부 EDGE PICK 한 종류라 등급별 성능을 비교할 수 없다.",
  "적중/실패가 모델 신호 때문인지 경기 변동성 때문인지 이 표본으로는 분리할 수 없다.",
];

function snapshotPath(date: string): string {
  return path.join(process.cwd(), "data", "predictions", `${date}.json`);
}

function reviewPath(date: string): string {
  return path.join(process.cwd(), "data", "predictions", `${date}-review.json`);
}

function analysisPath(date: string): string {
  return path.join(
    process.cwd(),
    "data",
    "daily-tests",
    `${date}-1800-baseball-analysis.json`,
  );
}

function resolveSide(
  item: PredictionItem,
): "home" | "away" | "unknown" {
  const pick = item.prediction.trim();
  if (pick === item.home.trim()) return "home";
  if (pick === item.away.trim()) return "away";
  return "unknown";
}

function resolveVerdict(item: PredictionItem): FeedbackVerdict {
  if (item.resultStatus !== "graded") return "INCONCLUSIVE";
  if (item.predictionCorrect === true) return "SIGNAL_WORKED";
  if (item.predictionCorrect === false) return "SIGNAL_FAILED";
  return "INCONCLUSIVE";
}

function unavailableFactors(game: AnalysisGame | undefined): string[] {
  const fa = game?.factorAvailability ?? {};
  return Object.entries(fa)
    .filter(([, v]) => !v)
    .map(([k]) => k)
    .sort();
}

/**
 * 실패 경기 가설 — 확정 원인이 아니라 "미반영/한계 가능성" 목록.
 * 저장된 스냅샷 값과 당시 누락 데이터만으로 결정론적으로 생성한다.
 */
function buildHypotheses(
  item: PredictionItem,
  game: AnalysisGame | undefined,
  verdict: FeedbackVerdict,
): string[] {
  if (verdict !== "SIGNAL_FAILED") return [];

  const out: string[] = [];
  const factors = new Set(unavailableFactors(game));
  const missing = game?.missingData ?? [];

  if (factors.has("startingPitcher") || missing.some((m) => m.includes("startingPitcher"))) {
    out.push("선발투수 정보가 예측에 반영되지 않았을 가능성");
  }
  if (missing.some((m) => m.includes("injuries"))) {
    out.push("부상·결장 및 라인업 변동이 반영되지 않았을 가능성");
  }
  if (factors.has("leagueStanding") || missing.some((m) => m.includes("leagueStanding"))) {
    out.push("리그 순위·시즌 누적 성적이 반영되지 않았을 가능성");
  }
  if (missing.some((m) => m.includes("seasonWinRate"))) {
    out.push("시즌 승률 대신 최근 경기 위주 지표에 의존했을 가능성");
  }

  const counts = game?.recentGameCounts;
  if (counts && (counts.home <= 6 || counts.away <= 6)) {
    out.push(
      `최근 경기 표본이 적어(home ${counts.home} / away ${counts.away}) 최근 폼 추정이 불안정했을 가능성`,
    );
  }

  const model = item.probability;
  const market = item.marketProbability;
  if (model != null && market != null && model - market >= 5) {
    out.push(
      `모델 승률(${model}%)이 시장 확률(${market}%)보다 높아 시장과 방향이 어긋났을 가능성`,
    );
  }

  const conf = item.confidence;
  if (conf != null && conf <= 60) {
    out.push(`Confidence ${conf}로 신뢰도가 높지 않은 추천이었을 가능성`);
  }

  out.push("단일 경기 변동성(야구 특유의 분산)으로 설명될 가능성");

  return out;
}

function buildNotes(
  item: PredictionItem,
  game: AnalysisGame | undefined,
  verdict: FeedbackVerdict,
): string[] {
  const notes: string[] = [];

  if (verdict === "SIGNAL_WORKED") {
    notes.push(
      "추천 방향과 실제 결과가 일치했다. 단, 1경기 결과만으로 신호의 유효성을 확정할 수 없다.",
    );
  } else if (verdict === "SIGNAL_FAILED") {
    notes.push(
      "추천 방향과 실제 결과가 불일치했다. 아래 항목은 원인이 아니라 확인이 필요한 가능성이다.",
    );
  } else {
    notes.push("결과가 확정되지 않아 신호 평가를 보류한다.");
  }

  const model = item.probability;
  const market = item.marketProbability;
  if (model != null && market != null) {
    notes.push(
      `저장 당시 모델 ${model}% vs 시장 ${market}% (Value Edge ${item.valueEdge ?? "—"}%p).`,
    );
  }
  if (game?.dataAvailability != null) {
    notes.push(`당시 데이터 가용도 ${game.dataAvailability}.`);
  }

  return notes;
}

function buildReviewItem(
  item: PredictionItem,
  game: AnalysisGame | undefined,
): ReviewItem {
  const verdict = resolveVerdict(item);
  const side = resolveSide(item);
  const homeScore = item.actualHomeScore ?? null;
  const awayScore = item.actualAwayScore ?? null;
  const winner = item.actualWinner ?? null;

  return {
    gameId: item.gameId,
    league: item.league,
    match: `${item.home} vs ${item.away}`,
    matchDisplay: game?.matchDisplay ?? null,
    recommendedTeam: item.prediction,
    recommendedSide: side,
    actual: {
      homeScore,
      awayScore,
      scoreline:
        homeScore != null && awayScore != null
          ? `${homeScore}-${awayScore}`
          : null,
      winner,
      winnerTeam:
        winner === "home"
          ? item.home
          : winner === "away"
            ? item.away
            : null,
      resultStatus: item.resultStatus ?? "pending",
    },
    predictionCorrect: item.predictionCorrect ?? null,
    snapshot: {
      probability: item.probability,
      edgeScore: item.edgeScore,
      confidence: item.confidence,
      recommendationGrade: item.recommendationGrade,
      marketProbability: item.marketProbability,
      valueEdge: item.valueEdge,
    },
    evidenceAtPrediction: {
      usedData: game?.usedEvidence ?? [],
      missingData: game?.missingData ?? [],
      unavailableFactors: unavailableFactors(game),
      dataAvailability: game?.dataAvailability ?? null,
      recentGameCounts: game?.recentGameCounts ?? null,
      oddsMatched: game?.odds?.matched ?? null,
    },
    feedback: {
      verdict,
      hypotheses: buildHypotheses(item, game, verdict),
      notes: buildNotes(item, game, verdict),
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function assertNoSecrets(payload: unknown): void {
  const text = JSON.stringify(payload);
  if (/Bearer\s+[A-Za-z0-9._-]+/i.test(text)) {
    throw new Error("refusing to write: bearer token in payload");
  }
  if (/api[_-]?key["']?\s*[:=]/i.test(text)) {
    throw new Error("refusing to write: possible API key material in payload");
  }
}

/** generatedAt 제외 비교 — 같은 입력이면 재작성하지 않음 */
function sameExceptGeneratedAt(a: ReviewFile, b: ReviewFile): boolean {
  const strip = (f: ReviewFile) =>
    JSON.stringify({
      ...f,
      meta: { ...f.meta, generatedAt: "" },
    });
  return strip(a) === strip(b);
}

async function main() {
  const dateArg = (process.argv[2] ?? "").trim();
  const date = dateArg || getKstToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`invalid date: ${date}`);
  }

  const snapFile = snapshotPath(date);
  const analysisFile = analysisPath(date);
  const outFile = reviewPath(date);

  console.log("=== 예측 사후 리뷰 ===");
  console.log(`snapshot: ${snapFile}`);
  console.log(`analysis: ${analysisFile}`);

  const snapshot = JSON.parse(
    await readFile(snapFile, "utf8"),
  ) as SnapshotFile;
  if (!Array.isArray(snapshot.predictions)) {
    throw new Error("invalid snapshot: predictions missing");
  }

  let analysis: AnalysisFile = {};
  try {
    analysis = JSON.parse(await readFile(analysisFile, "utf8")) as AnalysisFile;
  } catch {
    console.log("  (analysis file not found — 근거 필드는 비워둔다)");
  }
  const analysisByGameId = new Map(
    (analysis.games ?? []).map((g) => [g.gameId, g]),
  );

  const reviews = snapshot.predictions.map((item) =>
    buildReviewItem(item, analysisByGameId.get(item.gameId)),
  );

  const graded = reviews.filter(
    (r) => r.actual.resultStatus === "graded",
  ).length;
  const worked = reviews.filter(
    (r) => r.feedback.verdict === "SIGNAL_WORKED",
  ).length;
  const failed = reviews.filter(
    (r) => r.feedback.verdict === "SIGNAL_FAILED",
  ).length;
  const inconclusive = reviews.filter(
    (r) => r.feedback.verdict === "INCONCLUSIVE",
  ).length;

  const payload: ReviewFile = {
    meta: {
      version: "prediction-review-v1",
      dateKst: date,
      generatedAt: new Date().toISOString(),
      sourceSnapshot: path.relative(process.cwd(), snapFile).replace(/\\/g, "/"),
      sourceAnalysis: path
        .relative(process.cwd(), analysisFile)
        .replace(/\\/g, "/"),
      totalPredictions: reviews.length,
      gradedGames: graded,
      signalWorked: worked,
      signalFailed: failed,
      inconclusive,
      liveAccuracyPercent:
        graded === 0 ? null : round2((worked / graded) * 100),
      limitations: LIMITATIONS,
    },
    reviews,
  };

  assertNoSecrets(payload);

  let wrote = false;
  try {
    const existing = JSON.parse(await readFile(outFile, "utf8")) as ReviewFile;
    if (sameExceptGeneratedAt(existing, payload)) {
      console.log("\n동일한 리뷰가 이미 존재합니다 — 재작성하지 않습니다.");
    } else {
      await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      wrote = true;
    }
  } catch {
    await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    wrote = true;
  }

  console.log("");
  for (const r of reviews) {
    console.log("-".repeat(52));
    console.log(`${r.league} | ${r.matchDisplay ?? r.match}`);
    console.log(`  추천        : ${r.recommendedTeam} (${r.recommendedSide})`);
    console.log(
      `  실제 결과   : ${r.actual.scoreline ?? "—"} / 승자 ${r.actual.winnerTeam ?? "—"} [${r.actual.resultStatus}]`,
    );
    console.log(
      `  적중 여부   : ${
        r.predictionCorrect == null
          ? "미결"
          : r.predictionCorrect
            ? "적중"
            : "실패"
      }`,
    );
    console.log(
      `  EDGE ${r.snapshot.edgeScore ?? "—"} | Conf ${r.snapshot.confidence ?? "—"} | 모델 ${r.snapshot.probability ?? "—"}% | 시장 ${r.snapshot.marketProbability ?? "—"}% | VE ${r.snapshot.valueEdge ?? "—"}%p | ${r.snapshot.recommendationGrade ?? "—"}`,
    );
    console.log(
      `  사용 데이터 : ${r.evidenceAtPrediction.usedData.length}건`,
    );
    console.log(
      `  누락 데이터 : ${r.evidenceAtPrediction.missingData.join(", ") || "—"}`,
    );
    console.log(`  피드백      : ${r.feedback.verdict}`);
    for (const h of r.feedback.hypotheses) {
      console.log(`    - (가능성) ${h}`);
    }
  }

  console.log("\n" + "=".repeat(52));
  console.log(`채점 경기 수   : ${graded}`);
  console.log(`적중(WORKED)   : ${worked}`);
  console.log(`실패(FAILED)   : ${failed}`);
  console.log(`미결(INCONCL.) : ${inconclusive}`);
  console.log(
    `실전 적중률    : ${
      payload.meta.liveAccuracyPercent == null
        ? "—"
        : `${payload.meta.liveAccuracyPercent}%`
    }`,
  );
  console.log(`저장           : ${outFile}${wrote ? "" : " (변경 없음)"}`);
  console.log("\n이번 표본으로 엔진 성능을 판단할 수 없는 이유:");
  for (const l of LIMITATIONS) {
    console.log(`  - ${l}`);
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
