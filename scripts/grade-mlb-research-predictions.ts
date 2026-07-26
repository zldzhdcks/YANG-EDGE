/**
 * 2026-07-27 KST MLB 연구용 예측 15경기 채점 + 사후 피드백 리뷰.
 *
 * - 예측 불변 필드는 절대 변경하지 않는다.
 * - 결과 필드만 갱신한다.
 * - 기본 결과 source: API-BASEBALL Pro (날짜 1회 조회 + 캐시)
 * - MLB Stats API는 기본 source로 사용하지 않는다.
 * - EDGE Engine / weights / 가계부 / UI 미수정.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/grade-mlb-research-predictions.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";

const TARGET_DATE_KST = "2026-07-27";
const MLB_LEAGUE_ID = 1;
const MLB_SEASON = 2026;
const FINISHED = new Set(["FT", "AOT", "AP"]);
const CANCELLED = new Set(["CANC", "ABD", "ABAN"]);
const POSTPONED = new Set(["PST", "POST", "SUSP"]);
const MIN_SAMPLE = 5;

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}.json`,
);
const REVIEW_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}-review.json`,
);
const RESULTS_CACHE_DIR = path.join(
  process.cwd(),
  "data",
  "cache",
  "mlb-game-results",
);
/** 동일 세션 재실행 시 API 호출 절약 (분) */
const RESULTS_CACHE_TTL_MS = 5 * 60 * 1000;
const BASELINE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-baseline-analysis.json`,
);
const PITCHER_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-pitcher-review.json`,
);

/** 채점 시 절대 변경 금지 */
const IMMUTABLE_KEYS = [
  "predictionId",
  "gameId",
  "externalId",
  "dateKst",
  "startTimeKst",
  "league",
  "homeTeam",
  "awayTeam",
  "baselinePick",
  "modelProbability",
  "edgeScore",
  "confidence",
  "recommendationGrade",
  "baselineStatus",
  "marketProbability",
  "valueEdge",
  "openingOdds",
  "latestOdds",
  "oddsMovement",
  "pitcherDirection",
  "pitcherReviewAvailable",
  "dataAvailability",
  "usedFactors",
  "missingFactors",
  "purchaseEligible",
  "researchOnly",
  "purchaseReason",
  "predictedAt",
  "sourceSnapshotVersions",
  "snapshotIntegrity",
  "integrityWarnings",
] as const;

type FeedbackClass = "SIGNAL_WORKED" | "SIGNAL_FAILED" | "INCONCLUSIVE";
type ResultStatus =
  | "pending"
  | "graded"
  | "inconclusive"
  | "postponed"
  | "cancelled";

type Prediction = Record<string, unknown> & {
  gameId: string;
  externalId: string | null;
  homeTeam: string;
  awayTeam: string;
  baselinePick: string | null;
  baselineStatus: string;
  modelProbability: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  edgeScore: number | null;
  confidence: number | null;
  pitcherDirection: string | null;
  dataAvailability: number | null;
  usedFactors: string[];
  missingFactors: string[];
  resultStatus: string | null;
  homeScore: number | null;
  awayScore: number | null;
  actualWinner: string | null;
  predictionHit: boolean | null;
  gradedAt: string | null;
  feedbackClassification: string | null;
};

type GameResult = {
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  statusShort: string | null;
  statusLong: string | null;
};

type GradeUpdate = {
  resultStatus: ResultStatus;
  homeScore: number | null;
  awayScore: number | null;
  actualWinner: "home" | "away" | "draw" | null;
  predictionHit: boolean | null;
  gradedAt: string | null;
  feedbackClassification: FeedbackClass | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function immutableHash(item: Record<string, unknown>): string {
  const payload: Record<string, unknown> = {};
  for (const key of IMMUTABLE_KEYS) {
    payload[key] = item[key];
  }
  return JSON.stringify(payload);
}

function assertImmutable(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): void {
  const a = immutableHash(before);
  const b = immutableHash(after);
  if (a !== b) {
    throw new Error(`예측 불변 필드 변경 감지: ${asString(before.gameId)}`);
  }
}

function previousKstDate(dateKst: string): string {
  const ms = Date.parse(`${dateKst}T12:00:00+09:00`) - 24 * 60 * 60 * 1000;
  return instantToKst(new Date(ms))?.date ?? dateKst;
}

function classifyHit(
  pick: string | null,
  homeTeam: string,
  awayTeam: string,
  winner: "home" | "away" | "draw" | null,
): { hit: boolean | null; feedback: FeedbackClass } {
  if (winner == null || winner === "draw" || !pick) {
    return { hit: null, feedback: "INCONCLUSIVE" };
  }
  const actual = winner === "home" ? homeTeam : awayTeam;
  if (pick.trim() === actual.trim()) {
    return { hit: true, feedback: "SIGNAL_WORKED" };
  }
  return { hit: false, feedback: "SIGNAL_FAILED" };
}

function gradeFromResult(
  pred: Prediction,
  result: GameResult | null,
  gradedAt: string,
): GradeUpdate {
  if (!result) {
    return {
      resultStatus: "pending",
      homeScore: null,
      awayScore: null,
      actualWinner: null,
      predictionHit: null,
      gradedAt: null,
      feedbackClassification: null,
    };
  }

  const short = (result.statusShort ?? "").toUpperCase();
  const long = (result.statusLong ?? "").toLowerCase();

  if (
    CANCELLED.has(short) ||
    /cancel|abandon/i.test(long)
  ) {
    return {
      resultStatus: "cancelled",
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      actualWinner: null,
      predictionHit: null,
      gradedAt,
      feedbackClassification: "INCONCLUSIVE",
    };
  }
  if (POSTPONED.has(short) || /postpone|suspend/i.test(long)) {
    return {
      resultStatus: "postponed",
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      actualWinner: null,
      predictionHit: null,
      gradedAt,
      feedbackClassification: "INCONCLUSIVE",
    };
  }

  const finished =
    FINISHED.has(short) || /final|finished|game over/i.test(long);
  if (!finished) {
    return {
      resultStatus: "pending",
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      actualWinner: null,
      predictionHit: null,
      gradedAt: null,
      feedbackClassification: null,
    };
  }

  if (result.homeScore == null || result.awayScore == null) {
    return {
      resultStatus: "inconclusive",
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      actualWinner: null,
      predictionHit: null,
      gradedAt,
      feedbackClassification: "INCONCLUSIVE",
    };
  }

  let winner: "home" | "away" | "draw" | null = null;
  if (result.homeScore > result.awayScore) winner = "home";
  else if (result.homeScore < result.awayScore) winner = "away";
  else winner = "draw";

  const { hit, feedback } = classifyHit(
    pred.baselinePick,
    pred.homeTeam,
    pred.awayTeam,
    winner,
  );

  return {
    resultStatus: winner === "draw" ? "inconclusive" : "graded",
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    actualWinner: winner,
    predictionHit: hit,
    gradedAt,
    feedbackClassification: feedback,
  };
}

function buildHypotheses(pred: Prediction): string[] {
  const out: string[] = [];
  // 저장 데이터에 근거한 가능성만
  if (pred.pitcherDirection === "CONFLICTS_BASELINE") {
    out.push("선발투수 방향과 Baseline 충돌");
  }
  if (pred.pitcherDirection === "MIXED") {
    out.push("선발투수 지표 MIXED");
  }
  if (
    pred.valueEdge != null &&
    pred.valueEdge < 0
  ) {
    out.push("시장과 모델 방향 충돌 (Value Edge < 0)");
  }
  if (pred.confidence != null && pred.confidence < 50) {
    out.push("Confidence 50 미만");
  }
  for (const missing of pred.missingFactors ?? []) {
    if (/선발|라인업|부상|순위/i.test(missing)) {
      out.push(`${missing} 누락`);
    }
  }
  if ((pred.missingFactors ?? []).some((m) => /선발/i.test(m))) {
    if (!out.some((h) => /선발/.test(h))) out.push("선발·라인업·부상·순위 누락");
  }
  out.push("단일 경기 변동성");
  out.push("최근 경기 표본 제한 가능성");
  // 중복 제거
  return [...new Set(out)];
}

function buildReviewNotes(
  feedback: FeedbackClass | null,
  resultStatus: ResultStatus,
): string[] {
  if (feedback === "SIGNAL_WORKED") {
    return [
      "추천 방향과 실제 결과가 일치했습니다.",
      "한 경기로 신호 유효성을 확정할 수 없습니다.",
    ];
  }
  if (feedback === "SIGNAL_FAILED") {
    return [
      "추천 방향과 실제 결과가 일치하지 않았습니다.",
      "실패 원인을 단정하지 않습니다.",
    ];
  }
  if (resultStatus === "pending") {
    return ["경기가 아직 종료되지 않아 채점하지 않았습니다."];
  }
  return ["결과가 확정되지 않아 신호 일치 여부를 판단할 수 없습니다."];
}

function rate(
  hits: number,
  total: number,
): { hitRate: number | null; status: "OK" | "INSUFFICIENT_SAMPLE" } {
  if (total < MIN_SAMPLE) {
    return { hitRate: null, status: "INSUFFICIENT_SAMPLE" };
  }
  return { hitRate: round1((hits / total) * 100), status: "OK" };
}

function bucketRate(
  items: Prediction[],
  label: string,
): {
  label: string;
  n: number;
  hits: number;
  fails: number;
  hitRate: number | null;
  status: "OK" | "INSUFFICIENT_SAMPLE";
} {
  const graded = items.filter((p) => p.resultStatus === "graded");
  const hits = graded.filter((p) => p.predictionHit === true).length;
  const fails = graded.filter((p) => p.predictionHit === false).length;
  const r = rate(hits, graded.length);
  return {
    label,
    n: graded.length,
    hits,
    fails,
    hitRate: r.hitRate,
    status: r.status,
  };
}

type Usage = { calls: number; remaining: number | null; limit: number | null };

type DiskCachePayload = {
  fetchedAt: string;
  dateKst: string;
  results: GameResult[];
};

function parseGameRows(rows: unknown[]): GameResult[] {
  const results: GameResult[] = [];
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    const id = asNumber(row.id);
    const teams = asRecord(row.teams);
    const home = asRecord(teams?.home);
    const away = asRecord(teams?.away);
    const scores = asRecord(row.scores);
    const homeScores = asRecord(scores?.home);
    const awayScores = asRecord(scores?.away);
    const status = asRecord(row.status);
    if (id == null) continue;

    results.push({
      externalId: String(id),
      homeTeam: asString(home?.name) ?? "",
      awayTeam: asString(away?.name) ?? "",
      homeScore: asNumber(homeScores?.total),
      awayScore: asNumber(awayScores?.total),
      statusShort: asString(status?.short),
      statusLong: asString(status?.long),
    });
  }
  return results;
}

async function readDiskCache(dateKst: string): Promise<GameResult[] | null> {
  const file = path.join(RESULTS_CACHE_DIR, `${dateKst}.json`);
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as DiskCachePayload;
    const fetchedAt = Date.parse(raw.fetchedAt);
    if (!Number.isFinite(fetchedAt)) return null;
    if (Date.now() - fetchedAt > RESULTS_CACHE_TTL_MS) return null;
    return Array.isArray(raw.results) ? raw.results : null;
  } catch {
    return null;
  }
}

async function writeDiskCache(
  dateKst: string,
  results: GameResult[],
): Promise<void> {
  await mkdir(RESULTS_CACHE_DIR, { recursive: true });
  const payload: DiskCachePayload = {
    fetchedAt: new Date().toISOString(),
    dateKst,
    results,
  };
  await writeFile(
    path.join(RESULTS_CACHE_DIR, `${dateKst}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

async function fetchGamesForDate(
  dateKst: string,
  usage: Usage,
  memoryCache: Map<string, GameResult[]>,
): Promise<{ rows: GameResult[]; fromCache: boolean }> {
  const cacheKey = `games:${dateKst}`;
  if (memoryCache.has(cacheKey)) {
    return { rows: memoryCache.get(cacheKey)!, fromCache: true };
  }

  const disk = await readDiskCache(dateKst);
  if (disk) {
    memoryCache.set(cacheKey, disk);
    return { rows: disk, fromCache: true };
  }

  const baseUrl = (
    process.env.BASEBALL_API_BASE_URL ?? "https://v1.baseball.api-sports.io"
  ).replace(/\/$/, "");
  const apiKey = (
    process.env.BASEBALL_API_KEY ??
    process.env.FOOTBALL_API_KEY ??
    ""
  ).trim();
  if (!apiKey) {
    throw new Error("BASEBALL_API_KEY/FOOTBALL_API_KEY 미설정");
  }

  const url = new URL(`${baseUrl}/games`);
  url.searchParams.set("league", String(MLB_LEAGUE_ID));
  url.searchParams.set("season", String(MLB_SEASON));
  url.searchParams.set("date", dateKst);
  url.searchParams.set("timezone", "Asia/Seoul");

  usage.calls += 1;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-apisports-key": apiKey,
    },
    cache: "no-store",
  });
  const remaining = response.headers.get("x-ratelimit-requests-remaining");
  const limit = response.headers.get("x-ratelimit-requests-limit");
  if (remaining) {
    const n = Number(remaining);
    if (Number.isFinite(n)) usage.remaining = n;
  }
  if (limit) {
    const n = Number(limit);
    if (Number.isFinite(n)) usage.limit = n;
  }

  const body = (await response.json()) as {
    errors?: unknown;
    response?: unknown[];
  };
  if (!response.ok) {
    throw new Error(`API-BASEBALL HTTP ${response.status}`);
  }
  const err =
    body.errors == null
      ? ""
      : typeof body.errors === "object"
        ? Object.values(body.errors as Record<string, unknown>).join("; ")
        : String(body.errors);
  if (err && /error|invalid/i.test(err)) {
    throw new Error(`API-BASEBALL: ${err}`);
  }

  const results = parseGameRows(
    Array.isArray(body.response) ? body.response : [],
  );
  memoryCache.set(cacheKey, results);
  await writeDiskCache(dateKst, results);
  return { rows: results, fromCache: false };
}

async function loadResultsByExternalId(
  usage: Usage,
  neededExternalIds: string[],
): Promise<{
  map: Map<string, GameResult>;
  datesQueried: string[];
  cacheHits: number;
  warnings: string[];
}> {
  const memoryCache = new Map<string, GameResult[]>();
  const map = new Map<string, GameResult>();
  const datesQueried: string[] = [];
  const warnings: string[] = [];
  let cacheHits = 0;

  // 날짜 전체 1회 우선. 필요 ID가 모두 있으면 전날 조회 생략.
  const primary = await fetchGamesForDate(
    TARGET_DATE_KST,
    usage,
    memoryCache,
  );
  datesQueried.push(TARGET_DATE_KST);
  if (primary.fromCache) cacheHits += 1;
  for (const row of primary.rows) {
    map.set(row.externalId, row);
  }

  const missing = neededExternalIds.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const prev = previousKstDate(TARGET_DATE_KST);
    const secondary = await fetchGamesForDate(prev, usage, memoryCache);
    datesQueried.push(prev);
    if (secondary.fromCache) cacheHits += 1;
    for (const row of secondary.rows) {
      if (!map.has(row.externalId)) map.set(row.externalId, row);
    }
  }

  const stillMissing = neededExternalIds.filter((id) => !map.has(id));
  if (stillMissing.length > 0) {
    warnings.push(
      `API-BASEBALL에서 미조회 externalId ${stillMissing.length}건. MLB Stats API fallback 미사용.`,
    );
  }

  return { map, datesQueried, cacheHits, warnings };
}

function applyGrade(pred: Prediction, grade: GradeUpdate): Prediction {
  return {
    ...pred,
    resultStatus: grade.resultStatus,
    homeScore: grade.homeScore,
    awayScore: grade.awayScore,
    actualWinner: grade.actualWinner,
    predictionHit: grade.predictionHit,
    gradedAt: grade.gradedAt,
    feedbackClassification: grade.feedbackClassification,
  };
}

function gradeEqual(a: Prediction, b: GradeUpdate): boolean {
  return (
    a.resultStatus === b.resultStatus &&
    a.homeScore === b.homeScore &&
    a.awayScore === b.awayScore &&
    a.actualWinner === b.actualWinner &&
    a.predictionHit === b.predictionHit &&
    a.feedbackClassification === b.feedbackClassification
  );
}

async function main() {
  console.log(`=== Grade MLB Research Predictions (${TARGET_DATE_KST} KST) ===`);
  console.log("예측 불변. API-BASEBALL 결과만 기본 source. Stats API 미사용.\n");

  const snapshotRaw = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  // baseline / pitcher는 리뷰 보강용 참조만 (예측 값 덮어쓰기 금지)
  await readFile(BASELINE_PATH, "utf8");
  await readFile(PITCHER_PATH, "utf8");

  const root = asRecord(snapshotRaw);
  const meta = asRecord(root?.meta) ?? {};
  const predictions = (
    Array.isArray(root?.predictions) ? root.predictions : []
  ).map((entry) => {
    const row = asRecord(entry) ?? {};
    return {
      ...row,
      gameId: asString(row.gameId) ?? "",
      externalId: asString(row.externalId),
      homeTeam: asString(row.homeTeam) ?? "",
      awayTeam: asString(row.awayTeam) ?? "",
      baselinePick: asString(row.baselinePick),
      baselineStatus: asString(row.baselineStatus) ?? "",
      modelProbability: asNumber(row.modelProbability),
      marketProbability: asNumber(row.marketProbability),
      valueEdge: asNumber(row.valueEdge),
      edgeScore: asNumber(row.edgeScore),
      confidence: asNumber(row.confidence),
      pitcherDirection: asString(row.pitcherDirection),
      dataAvailability: asNumber(row.dataAvailability),
      usedFactors: asStringArray(row.usedFactors),
      missingFactors: asStringArray(row.missingFactors),
      resultStatus: asString(row.resultStatus),
      homeScore: asNumber(row.homeScore),
      awayScore: asNumber(row.awayScore),
      actualWinner: asString(row.actualWinner),
      predictionHit:
        typeof row.predictionHit === "boolean" ? row.predictionHit : null,
      gradedAt: asString(row.gradedAt),
      feedbackClassification: asString(row.feedbackClassification),
    } satisfies Prediction;
  });

  if (predictions.length === 0) throw new Error("predictions 없음");

  const beforeHashes = new Map(
    predictions.map((p) => [p.gameId, immutableHash(p)]),
  );

  const usage: Usage = { calls: 0, remaining: null, limit: null };
  const neededIds = predictions
    .map((p) => p.externalId)
    .filter((id): id is string => id != null);
  const {
    map: results,
    datesQueried,
    cacheHits,
    warnings: resultWarnings,
  } = await loadResultsByExternalId(usage, neededIds);
  const gradedAt = new Date().toISOString();

  let newlyGraded = 0;
  let unchangedGraded = 0;
  const resultCorrectionWarnings: string[] = [];
  const updated: Prediction[] = [];

  for (const pred of predictions) {
    const before = { ...pred };
    const result =
      pred.externalId != null ? results.get(pred.externalId) ?? null : null;
    const grade = gradeFromResult(pred, result, gradedAt);

    if (
      pred.resultStatus === "graded" &&
      grade.resultStatus === "graded" &&
      !gradeEqual(pred, grade)
    ) {
      resultCorrectionWarnings.push(
        `${pred.gameId}: 결과 정정 감지 (${pred.homeScore}-${pred.awayScore} → ${grade.homeScore}-${grade.awayScore})`,
      );
    }

    if (gradeEqual(pred, grade)) {
      if (pred.resultStatus === "graded") unchangedGraded += 1;
      updated.push(pred);
    } else {
      // pending → graded 등
      if (
        pred.resultStatus !== "graded" &&
        (grade.resultStatus === "graded" ||
          grade.resultStatus === "inconclusive" ||
          grade.resultStatus === "cancelled" ||
          grade.resultStatus === "postponed")
      ) {
        newlyGraded += 1;
      }
      updated.push(applyGrade(pred, grade));
    }

    assertImmutable(before, updated[updated.length - 1]);
    const afterHash = immutableHash(updated[updated.length - 1]);
    if (afterHash !== beforeHashes.get(pred.gameId)) {
      throw new Error(`hash 불일치: ${pred.gameId}`);
    }
  }

  const graded = updated.filter((p) => p.resultStatus === "graded");
  const hits = graded.filter((p) => p.predictionHit === true);
  const fails = graded.filter((p) => p.predictionHit === false);
  const pending = updated.filter(
    (p) => p.resultStatus === "pending" || p.resultStatus == null,
  );
  const inconclusiveCount = updated.filter(
    (p) =>
      p.resultStatus === "inconclusive" ||
      p.resultStatus === "cancelled" ||
      p.resultStatus === "postponed",
  ).length;

  const candidates = updated.filter(
    (p) => p.baselineStatus === "BASELINE_CANDIDATE",
  );
  const pass = updated.filter((p) => p.baselineStatus === "PASS");
  const yankees = updated.find((p) => p.gameId === "mlb-179589");
  const brewers = updated.find((p) => p.gameId === "mlb-179598");
  const holdIds = new Set([
    "mlb-179592",
    "mlb-179597",
    "mlb-179599",
    "mlb-179601",
  ]);
  const holdGames = updated.filter((p) => holdIds.has(p.gameId));

  const byPitcher = [
    bucketRate(
      updated.filter((p) => p.pitcherDirection === "SUPPORTS_BASELINE"),
      "SUPPORTS_BASELINE",
    ),
    bucketRate(
      updated.filter((p) => p.pitcherDirection === "CONFLICTS_BASELINE"),
      "CONFLICTS_BASELINE",
    ),
    bucketRate(
      updated.filter((p) => p.pitcherDirection === "MIXED"),
      "MIXED",
    ),
    bucketRate(
      updated.filter((p) => p.pitcherDirection == null),
      "NONE",
    ),
  ];

  const confBuckets = [
    bucketRate(
      updated.filter((p) => p.confidence != null && p.confidence < 50),
      "confidence<50",
    ),
    bucketRate(
      updated.filter(
        (p) => p.confidence != null && p.confidence >= 50 && p.confidence < 60,
      ),
      "confidence_50_59",
    ),
    bucketRate(
      updated.filter((p) => p.confidence != null && p.confidence >= 60),
      "confidence>=60",
    ),
  ];

  const veBuckets = [
    bucketRate(
      updated.filter((p) => p.valueEdge != null && p.valueEdge <= 0),
      "valueEdge<=0",
    ),
    bucketRate(
      updated.filter(
        (p) => p.valueEdge != null && p.valueEdge > 0 && p.valueEdge < 10,
      ),
      "valueEdge_0_10",
    ),
    bucketRate(
      updated.filter((p) => p.valueEdge != null && p.valueEdge >= 10),
      "valueEdge>=10",
    ),
  ];

  const overallRate = rate(hits.length, graded.length);
  const candidateRate = bucketRate(candidates, "BASELINE_CANDIDATE");
  const passRate = bucketRate(pass, "PASS");
  const holdRate = bucketRate(holdGames, "HOLD_4");

  // pitcher CONFLICT warning role: Yankees CONFLICT + hit?
  const conflictGames = updated.filter(
    (p) => p.pitcherDirection === "CONFLICTS_BASELINE",
  );
  const conflictWarningRole =
    conflictGames.length === 0
      ? "표본 없음"
      : conflictGames.every((p) => p.resultStatus !== "graded")
        ? "채점 미완"
        : conflictGames.some((p) => p.predictionHit === false)
          ? "CONFLICT 경고 후 실제 실패 사례 존재 (단정 금지, 관찰만)"
          : conflictGames.every((p) => p.predictionHit === true)
            ? "CONFLICT였으나 적중 — 경고만으로 실패를 보장하지 않음"
            : "혼재";

  const reviews = updated.map((p) => ({
    gameId: p.gameId,
    match: `${p.awayTeam} @ ${p.homeTeam}`,
    baselinePick: p.baselinePick,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    actualWinner: p.actualWinner,
    predictionHit: p.predictionHit,
    baselineStatus: p.baselineStatus,
    modelProbability: p.modelProbability,
    marketProbability: p.marketProbability,
    valueEdge: p.valueEdge,
    edgeScore: p.edgeScore,
    confidence: p.confidence,
    pitcherDirection: p.pitcherDirection,
    dataAvailability: p.dataAvailability,
    usedFactors: p.usedFactors,
    missingFactors: p.missingFactors,
    feedbackClassification: p.feedbackClassification,
    resultStatus: p.resultStatus,
    reviewNotes: buildReviewNotes(
      p.feedbackClassification as FeedbackClass | null,
      (p.resultStatus as ResultStatus) ?? "pending",
    ),
    hypotheses:
      p.feedbackClassification === "SIGNAL_FAILED" ||
      p.feedbackClassification === "SIGNAL_WORKED"
        ? buildHypotheses(p)
        : [],
  }));

  // 리뷰 중복 방지: gameId unique
  const reviewIds = new Set(reviews.map((r) => r.gameId));
  if (reviewIds.size !== reviews.length) {
    throw new Error("리뷰 gameId 중복");
  }

  const snapshotOut = {
    ...snapshotRaw,
    meta: {
      ...meta,
      resultsFetched: true,
      lastGradedAt: gradedAt,
      resultSource: "api-baseball",
      mlbStatsApiUsed: false,
      gradingVersion: "mlb-research-grade-v1",
    },
    summary: {
      ...(asRecord(root?.summary) ?? {}),
      graded: graded.length,
      hits: hits.length,
      fails: fails.length,
      pending: pending.length,
      inconclusive: inconclusiveCount,
      hitRate: overallRate.hitRate,
      hitRateStatus: overallRate.status,
      newlyGraded,
      unchangedGraded,
      resultCorrectionWarnings,
    },
    predictions: updated,
  };

  // 최종 불변 검증
  for (const p of updated) {
    if (immutableHash(p) !== beforeHashes.get(p.gameId)) {
      throw new Error(`최종 hash 실패: ${p.gameId}`);
    }
  }

  const reviewOut = {
    meta: {
      version: "mlb-research-prediction-review-v1",
      dateKst: TARGET_DATE_KST,
      generatedAt: gradedAt,
      snapshot: path.relative(process.cwd(), SNAPSHOT_PATH).replace(/\\/g, "/"),
      resultSource: "api-baseball",
      mlbStatsApiUsed: false,
      researchOnly: true,
      purchaseEligible: false,
      note:
        "사후 피드백 리뷰. 실패 원인을 단정하지 않는다. 예측 당시 필드는 변경하지 않았다.",
    },
    apiUsage: {
      apiBaseball: {
        calls: usage.calls,
        remaining: usage.remaining,
        limit: usage.limit,
        datesQueried,
        cacheHits,
      },
      mlbStatsApi: { calls: 0, used: false },
      warnings: resultWarnings,
    },
    summary: {
      total: updated.length,
      graded: graded.length,
      hits: hits.length,
      fails: fails.length,
      pending: pending.length,
      inconclusive: inconclusiveCount,
      overallHitRate: overallRate,
      baselineCandidate: candidateRate,
      pass: passRate,
      hold4: holdRate,
      marketConflictBrewers: brewers
        ? {
            gameId: brewers.gameId,
            pick: brewers.baselinePick,
            score: `${brewers.homeScore ?? "?"}-${brewers.awayScore ?? "?"}`,
            winner: brewers.actualWinner,
            hit: brewers.predictionHit,
            feedback: brewers.feedbackClassification,
            resultStatus: brewers.resultStatus,
          }
        : null,
      yankeesDrop: yankees
        ? {
            gameId: yankees.gameId,
            pick: yankees.baselinePick,
            pitcherDirection: yankees.pitcherDirection,
            score: `${yankees.homeScore ?? "?"}-${yankees.awayScore ?? "?"}`,
            winner: yankees.actualWinner,
            hit: yankees.predictionHit,
            feedback: yankees.feedbackClassification,
            resultStatus: yankees.resultStatus,
          }
        : null,
      pitcherConflictWarningRole: conflictWarningRole,
      byPitcherDirection: byPitcher,
      byConfidence: confBuckets,
      byValueEdge: veBuckets,
      researchSnapshotUseful:
        "구매 마감 후 연구용 저장은 결과 축적·사후 비교에 유효하다. 과거 추천을 바꾸지 않는다.",
      resultCorrectionWarnings,
      immutableVerified: true,
    },
    importantComparisons: {
      candidate5HitRate: candidateRate,
      all15HitRate: {
        n: graded.length,
        hits: hits.length,
        fails: fails.length,
        hitRate: overallRate.hitRate,
        status: overallRate.status,
      },
      yankeesDrop: yankees
        ? {
            gameId: yankees.gameId,
            resultStatus: yankees.resultStatus,
            predictionHit: yankees.predictionHit,
            feedbackClassification: yankees.feedbackClassification,
            pitcherDirection: yankees.pitcherDirection,
            homeScore: yankees.homeScore,
            awayScore: yankees.awayScore,
          }
        : null,
      marketConflictBrewers: brewers
        ? {
            gameId: brewers.gameId,
            resultStatus: brewers.resultStatus,
            predictionHit: brewers.predictionHit,
            feedbackClassification: brewers.feedbackClassification,
            homeScore: brewers.homeScore,
            awayScore: brewers.awayScore,
          }
        : null,
      pitcherConflictWarningRole: conflictWarningRole,
      hold4: {
        games: holdGames.map((p) => ({
          gameId: p.gameId,
          resultStatus: p.resultStatus,
          predictionHit: p.predictionHit,
          pitcherDirection: p.pitcherDirection,
        })),
        hitRate: holdRate,
      },
      researchSnapshotValue:
        "구매 마감 후 연구용으로 저장한 판단은 결과 축적·사후 비교에 유효하다. 결과를 이용해 과거 추천을 바꾸지 않는다.",
    },
    games: reviews,
  };

  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(
    SNAPSHOT_PATH,
    `${JSON.stringify(snapshotOut, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    REVIEW_PATH,
    `${JSON.stringify(reviewOut, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `채점 완료 ${graded.length} / pending ${pending.length} / inconclusive ${inconclusiveCount}`,
  );
  console.log(
    `적중 ${hits.length} / 실패 ${fails.length} / 적중률 ${overallRate.hitRate ?? "INSUFFICIENT_SAMPLE"} (${overallRate.status})`,
  );
  console.log(
    `BASELINE_CANDIDATE: ${candidateRate.hits}/${candidateRate.n} (${candidateRate.hitRate ?? "INSUFFICIENT_SAMPLE"})`,
  );
  console.log(
    `PASS: ${passRate.hits}/${passRate.n} (${passRate.hitRate ?? "INSUFFICIENT_SAMPLE"})`,
  );
  if (yankees) {
    console.log(
      `Yankees: ${yankees.predictionHit === true ? "HIT" : yankees.predictionHit === false ? "MISS" : yankees.resultStatus} (${yankees.homeScore}-${yankees.awayScore}) pitcher=${yankees.pitcherDirection}`,
    );
  }
  if (brewers) {
    console.log(
      `Brewers: ${brewers.predictionHit === true ? "HIT" : brewers.predictionHit === false ? "MISS" : brewers.resultStatus} (${brewers.homeScore}-${brewers.awayScore})`,
    );
  }
  console.log(`투수 CONFLICT 경고 역할: ${conflictWarningRole}`);
  console.log(
    `HOLD 4: ${holdRate.hits}/${holdRate.n} (${holdRate.hitRate ?? "INSUFFICIENT_SAMPLE"})`,
  );
  console.log(`예측 불변 검증: 통과`);
  console.log(
    `API-BASEBALL calls=${usage.calls} remaining=${usage.remaining ?? "n/a"}`,
  );
  console.log(`저장: ${path.relative(process.cwd(), SNAPSHOT_PATH)}`);
  console.log(`리뷰: ${path.relative(process.cwd(), REVIEW_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message.replace(/x-apisports-key[^,\s]*/gi, "***"));
  process.exitCode = 1;
});
