/**
 * Feedback Center 리뷰들을 집계해 Learning Dashboard 데이터를 만든다.
 *
 * 입력: data/predictions/*-review.json (prediction-review-v1)
 * 출력: data/learning/dashboard.json
 *
 * - 엔진 재학습/가중치 자동 변경은 하지 않는다.
 * - 표본 부족 구간은 INSUFFICIENT_SAMPLE 표시.
 *
 * 실행:
 *   npx tsx scripts/build-learning-dashboard.ts
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PREDICTIONS_DIR = path.join(process.cwd(), "data", "predictions");
const OUT_PATH = path.join(process.cwd(), "data", "learning", "dashboard.json");
const MIN_SAMPLE = 10;

type Verdict = "SIGNAL_WORKED" | "SIGNAL_FAILED" | "INCONCLUSIVE";

type ReviewItem = {
  gameId: string;
  league: string;
  match: string;
  recommendedTeam: string;
  predictionCorrect: boolean | null;
  snapshot: {
    confidence: number | null;
    recommendationGrade: string | null;
    valueEdge: number | null;
  };
  feedback: { verdict: Verdict };
};

type DayFile = {
  meta: {
    dateKst: string;
    gradedGames: number;
    signalWorked: number;
    signalFailed: number;
    inconclusive: number;
    liveAccuracyPercent: number | null;
    sourceSnapshot?: string | null;
  };
  reviews: ReviewItem[];
};

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
function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rate(hits: number, n: number) {
  if (n < MIN_SAMPLE) {
    return {
      n,
      hits,
      fails: n - hits,
      hitRate: null as number | null,
      status: "INSUFFICIENT_SAMPLE" as const,
    };
  }
  return {
    n,
    hits,
    fails: n - hits,
    hitRate: round1((hits / n) * 100),
    status: "OK" as const,
  };
}

function bucket(
  items: ReviewItem[],
  label: string,
  predicate: (r: ReviewItem) => boolean,
) {
  const graded = items.filter(
    (r) =>
      predicate(r) &&
      (r.feedback.verdict === "SIGNAL_WORKED" ||
        r.feedback.verdict === "SIGNAL_FAILED"),
  );
  const hits = graded.filter((r) => r.feedback.verdict === "SIGNAL_WORKED")
    .length;
  return { label, ...rate(hits, graded.length) };
}

async function listReviewFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const full = path.join(dir, name);
    if (name.endsWith("-review.json")) {
      out.push(full);
      continue;
    }
    // mlb 하위 폴더의 research review는 스키마가 달라 skip — top-level *-mlb-review.json 사용
  }
  // mlb 폴더는 export된 top-level만 사용
  return out.sort().reverse();
}

function parseDay(raw: unknown): DayFile | null {
  const root = asRecord(raw);
  if (!root) return null;
  const metaRaw = asRecord(root.meta);
  if (!metaRaw) return null;
  if (asString(metaRaw.version) !== "prediction-review-v1") return null;
  const dateKst = asString(metaRaw.dateKst);
  if (!dateKst) return null;

  const reviewsRaw = Array.isArray(root.reviews) ? root.reviews : [];
  const reviews: ReviewItem[] = [];
  for (const entry of reviewsRaw) {
    const row = asRecord(entry);
    if (!row) continue;
    const feedback = asRecord(row.feedback);
    const snapshot = asRecord(row.snapshot) ?? {};
    const verdict = asString(feedback?.verdict);
    if (
      verdict !== "SIGNAL_WORKED" &&
      verdict !== "SIGNAL_FAILED" &&
      verdict !== "INCONCLUSIVE"
    ) {
      continue;
    }
    const gameId = asString(row.gameId);
    const league = asString(row.league);
    const match = asString(row.match);
    const recommendedTeam = asString(row.recommendedTeam);
    if (!gameId || !league || !match || !recommendedTeam) continue;
    reviews.push({
      gameId,
      league,
      match,
      recommendedTeam,
      predictionCorrect: asBoolean(row.predictionCorrect),
      snapshot: {
        confidence: asNumber(snapshot.confidence),
        recommendationGrade: asString(snapshot.recommendationGrade),
        valueEdge: asNumber(snapshot.valueEdge),
      },
      feedback: { verdict },
    });
  }

  return {
    meta: {
      dateKst,
      gradedGames: asNumber(metaRaw.gradedGames) ?? 0,
      signalWorked: asNumber(metaRaw.signalWorked) ?? 0,
      signalFailed: asNumber(metaRaw.signalFailed) ?? 0,
      inconclusive: asNumber(metaRaw.inconclusive) ?? 0,
      liveAccuracyPercent: asNumber(metaRaw.liveAccuracyPercent),
      sourceSnapshot: asString(metaRaw.sourceSnapshot),
    },
    reviews,
  };
}

async function main() {
  const files = await listReviewFiles(PREDICTIONS_DIR);
  const days: DayFile[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(file, "utf8"));
      const day = parseDay(raw);
      if (day) days.push(day);
    } catch {
      // skip corrupt
    }
  }

  const allReviews = days.flatMap((d) => d.reviews);
  const graded = allReviews.filter(
    (r) =>
      r.feedback.verdict === "SIGNAL_WORKED" ||
      r.feedback.verdict === "SIGNAL_FAILED",
  );
  const worked = graded.filter((r) => r.feedback.verdict === "SIGNAL_WORKED");
  const failed = graded.filter((r) => r.feedback.verdict === "SIGNAL_FAILED");
  const inconclusive = allReviews.filter(
    (r) => r.feedback.verdict === "INCONCLUSIVE",
  );

  const leagues = [...new Set(allReviews.map((r) => r.league))].sort();
  const byLeague = leagues.map((league) =>
    bucket(allReviews, league, (r) => r.league === league),
  );

  const byConfidence = [
    bucket(
      allReviews,
      "confidence<50",
      (r) => r.snapshot.confidence != null && r.snapshot.confidence < 50,
    ),
    bucket(
      allReviews,
      "confidence_50_59",
      (r) =>
        r.snapshot.confidence != null &&
        r.snapshot.confidence >= 50 &&
        r.snapshot.confidence < 60,
    ),
    bucket(
      allReviews,
      "confidence>=60",
      (r) => r.snapshot.confidence != null && r.snapshot.confidence >= 60,
    ),
  ];

  const grades = [
    ...new Set(
      allReviews
        .map((r) => r.snapshot.recommendationGrade)
        .filter((g): g is string => g != null),
    ),
  ].sort();
  const byGrade = grades.map((grade) =>
    bucket(
      allReviews,
      grade,
      (r) => r.snapshot.recommendationGrade === grade,
    ),
  );

  const byValueEdge = [
    bucket(
      allReviews,
      "valueEdge<=0",
      (r) => r.snapshot.valueEdge != null && r.snapshot.valueEdge <= 0,
    ),
    bucket(
      allReviews,
      "valueEdge_0_10",
      (r) =>
        r.snapshot.valueEdge != null &&
        r.snapshot.valueEdge > 0 &&
        r.snapshot.valueEdge < 10,
    ),
    bucket(
      allReviews,
      "valueEdge>=10",
      (r) => r.snapshot.valueEdge != null && r.snapshot.valueEdge >= 10,
    ),
  ];

  const recentDays = days
    .map((d) => ({
      dateKst: d.meta.dateKst,
      source: d.meta.sourceSnapshot ?? null,
      gradedGames: d.meta.gradedGames,
      signalWorked: d.meta.signalWorked,
      signalFailed: d.meta.signalFailed,
      inconclusive: d.meta.inconclusive,
      liveAccuracyPercent: d.meta.liveAccuracyPercent,
      leagues: [...new Set(d.reviews.map((r) => r.league))],
    }))
    .sort((a, b) => b.dateKst.localeCompare(a.dateKst));

  const overall = rate(worked.length, graded.length);

  const out = {
    meta: {
      version: "learning-dashboard-v1",
      generatedAt: new Date().toISOString(),
      source: "data/predictions/*-review.json (prediction-review-v1)",
      engineRerun: false,
      weightsChanged: false,
      note:
        "사후 피드백 집계 대시보드. 모델 재학습·가중치 자동 반영이 아니다. 표본 부족 구간은 INSUFFICIENT_SAMPLE.",
      minSample: MIN_SAMPLE,
    },
    summary: {
      totalReviews: allReviews.length,
      graded: graded.length,
      signalWorked: worked.length,
      signalFailed: failed.length,
      inconclusive: inconclusive.length,
      overallHitRate: overall,
      dayCount: days.length,
    },
    byLeague,
    byConfidence,
    byRecommendationGrade: byGrade,
    byValueEdge,
    recentDays,
    caveats: [
      "적중/실패만으로 EDGE Engine 성능을 단정하지 않는다.",
      "표본이 작은 구간은 INSUFFICIENT_SAMPLE로 표시한다.",
      "이 대시보드는 학습 데이터 축적용이며 자동 가중치 변경을 수행하지 않는다.",
    ],
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log(
    `Learning: graded=${graded.length} worked=${worked.length} failed=${failed.length} hitRate=${overall.hitRate ?? "INSUFFICIENT_SAMPLE"}`,
  );
  console.log(`저장: ${path.relative(process.cwd(), OUT_PATH)}`);
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
