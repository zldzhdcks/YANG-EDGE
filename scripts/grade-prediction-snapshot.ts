/**
 * 예측 스냅샷 채점 (결과 조회·채점만).
 *
 * 입력/출력: data/predictions/{YYYY-MM-DD}.json
 * - 저장 당시 prediction / probability / edgeScore / confidence /
 *   recommendationGrade / marketProbability / valueEdge 는 절대 수정하지 않는다.
 * - 실제 결과는 TheSportsDB lookupevent.php (externalId) 로 조회.
 *
 * 실행: npx tsx --env-file=.env.local scripts/grade-prediction-snapshot.ts [YYYY-MM-DD]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";
import { getSportsProvider } from "../src/lib/sports";
import type { GameData } from "../src/types/game";

const PREDICTION_IMMUTABLE_KEYS = [
  "gameId",
  "league",
  "home",
  "away",
  "prediction",
  "probability",
  "edgeScore",
  "confidence",
  "recommendationGrade",
  "marketProbability",
  "valueEdge",
  "createdAt",
] as const;

type ResultStatus =
  | "graded"
  | "pending"
  | "postponed"
  | "cancelled"
  | "result-not-found";

type ActualWinner = "home" | "away" | "draw";

type PredictionCore = {
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
};

type GradeFields = {
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  actualWinner: ActualWinner | null;
  predictionCorrect: boolean | null;
  resultStatus: ResultStatus;
  gradedAt: string | null;
  /** 조회용 — 채점 메타 (예측 불변 필드 아님) */
  externalId?: string | null;
};

type PredictionItem = PredictionCore & Partial<GradeFields>;

type SnapshotFile = {
  meta: {
    version?: string;
    dateKst: string;
    generatedAt?: string;
    recommendedGames?: number;
    gradedGames?: number;
    correctPredictions?: number;
    incorrectPredictions?: number;
    pendingGames?: number;
    accuracy?: number | null;
    lastGradedAt?: string | null;
    [key: string]: unknown;
  };
  predictions: PredictionItem[];
};

type TheSportsDbEvent = {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | number | null;
  intAwayScore?: string | number | null;
  strStatus?: string | null;
  strProgress?: string | null;
};

function snapshotPath(date: string): string {
  return path.join(process.cwd(), "data", "predictions", `${date}.json`);
}

function envBase(): { base: string; key: string } {
  const base = (process.env.SPORTS_API_BASE_URL ?? "").replace(/\/$/, "");
  const key = (process.env.SPORTS_API_KEY ?? "").trim();
  if (!base || !key) {
    throw new Error("SPORTS_API_BASE_URL / SPORTS_API_KEY required");
  }
  return { base, key };
}

async function lookupEvent(externalId: string): Promise<TheSportsDbEvent | null> {
  const { base, key } = envBase();
  const cleaned = `lookupevent.php?id=${encodeURIComponent(externalId)}`;
  const url = `${base}/${key}/${cleaned}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`lookupevent ${externalId} failed (${res.status})`);
  }
  const json = (await res.json()) as { events?: TheSportsDbEvent[] | null };
  const events = Array.isArray(json.events) ? json.events : [];
  return events[0] ?? null;
}

function parseScore(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * TheSportsDB strStatus → 채점용 resultStatus
 * (공식 문서·실응답에서 확인된 코드 기준)
 */
function mapStatus(raw: string | null | undefined): ResultStatus {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!s) return "pending";

  // 종료
  if (
    s === "FT" ||
    s === "AOT" ||
    s === "AET" ||
    s === "PEN" ||
    s === "FINISHED" ||
    s === "AFTER OVER TIME"
  ) {
    return "graded";
  }

  // 연기
  if (s === "POST" || s === "PST" || s === "POSTPONED" || s.startsWith("POST")) {
    return "postponed";
  }

  // 취소 / 포기
  if (
    s === "CANC" ||
    s === "CANCELLED" ||
    s === "CANCELED" ||
    s === "ABD" ||
    s === "ABANDONED" ||
    s === "SUSP" ||
    s === "SUSPENDED"
  ) {
    return "cancelled";
  }

  // 예정 / 진행 중 → 미채점
  if (
    s === "NS" ||
    s === "NOT STARTED" ||
    s === "TBD" ||
    s === "TIME" ||
    s === "HT" ||
    s === "LIVE" ||
    s.startsWith("IN") || // IN1…IN9, IN8 등
    s === "BT" ||
    s === "BREAK"
  ) {
    return "pending";
  }

  // 알 수 없으면 안전하게 pending (임의 채점 금지)
  return "pending";
}

function resolveWinner(
  homeScore: number,
  awayScore: number,
): ActualWinner {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

function isPredictionCorrect(
  prediction: string,
  home: string,
  away: string,
  winner: ActualWinner,
): boolean {
  if (winner === "draw") return false;
  const pick = prediction.trim();
  if (winner === "home") return pick === home.trim();
  return pick === away.trim();
}

function pickImmutable(item: PredictionItem): PredictionCore {
  return {
    gameId: item.gameId,
    league: item.league,
    home: item.home,
    away: item.away,
    prediction: item.prediction,
    probability: item.probability,
    edgeScore: item.edgeScore,
    confidence: item.confidence,
    recommendationGrade: item.recommendationGrade,
    marketProbability: item.marketProbability,
    valueEdge: item.valueEdge,
    createdAt: item.createdAt,
  };
}

function gradeSnapshotEqual(
  a: GradeFields,
  b: GradeFields,
): boolean {
  return (
    a.resultStatus === b.resultStatus &&
    a.actualHomeScore === b.actualHomeScore &&
    a.actualAwayScore === b.actualAwayScore &&
    a.actualWinner === b.actualWinner &&
    a.predictionCorrect === b.predictionCorrect
  );
}

function assertNoSecrets(payload: unknown): void {
  const text = JSON.stringify(payload);
  if (/api[_-]?key/i.test(text) && /["']?[a-z0-9]{20,}["']?/i.test(text)) {
    throw new Error("refusing to write: possible API key material in payload");
  }
  if (/Bearer\s+[A-Za-z0-9._-]+/i.test(text)) {
    throw new Error("refusing to write: bearer token in payload");
  }
}

function assertPredictionImmutable(
  before: PredictionItem,
  after: PredictionItem,
): void {
  for (const key of PREDICTION_IMMUTABLE_KEYS) {
    if (before[key] !== after[key]) {
      throw new Error(
        `immutable prediction field changed: ${key} (${String(before[key])} → ${String(after[key])})`,
      );
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildMeta(
  previous: SnapshotFile["meta"],
  predictions: PredictionItem[],
  lastGradedAt: string,
): SnapshotFile["meta"] {
  const graded = predictions.filter((p) => p.resultStatus === "graded");
  const correct = graded.filter((p) => p.predictionCorrect === true).length;
  const incorrect = graded.filter((p) => p.predictionCorrect === false).length;
  const pending = predictions.filter(
    (p) =>
      p.resultStatus == null ||
      p.resultStatus === "pending" ||
      p.resultStatus === "result-not-found" ||
      p.resultStatus === "postponed",
  ).length;

  return {
    ...previous,
    recommendedGames: predictions.length,
    gradedGames: graded.length,
    correctPredictions: correct,
    incorrectPredictions: incorrect,
    pendingGames: pending,
    accuracy: graded.length === 0 ? null : round2((correct / graded.length) * 100),
    lastGradedAt,
  };
}

async function resolveExternalId(
  item: PredictionItem,
  scheduleByGameId: Map<string, GameData>,
): Promise<string | null> {
  if (item.externalId) return item.externalId;
  const game = scheduleByGameId.get(item.gameId);
  return game?.externalId ?? null;
}

async function gradeOne(
  item: PredictionItem,
  scheduleByGameId: Map<string, GameData>,
  gradedAt: string,
): Promise<{ next: PredictionItem; changed: boolean; note: string }> {
  const core = pickImmutable(item);
  const externalId = await resolveExternalId(item, scheduleByGameId);

  if (!externalId) {
    const grade: GradeFields = {
      actualHomeScore: null,
      actualAwayScore: null,
      actualWinner: null,
      predictionCorrect: null,
      resultStatus: "result-not-found",
      gradedAt: null,
      externalId: null,
    };
    const next = { ...core, ...grade };
    const prevGrade: GradeFields = {
      actualHomeScore: item.actualHomeScore ?? null,
      actualAwayScore: item.actualAwayScore ?? null,
      actualWinner: item.actualWinner ?? null,
      predictionCorrect: item.predictionCorrect ?? null,
      resultStatus: item.resultStatus ?? "result-not-found",
      gradedAt: item.gradedAt ?? null,
      externalId: item.externalId ?? null,
    };
    const same =
      item.resultStatus === "result-not-found" &&
      gradeSnapshotEqual(prevGrade, { ...grade, gradedAt: prevGrade.gradedAt });
    return {
      next: same ? item : next,
      changed: !same,
      note: "result-not-found (no externalId)",
    };
  }

  const event = await lookupEvent(externalId);
  if (!event) {
    const grade: GradeFields = {
      actualHomeScore: null,
      actualAwayScore: null,
      actualWinner: null,
      predictionCorrect: null,
      resultStatus: "result-not-found",
      gradedAt: null,
      externalId,
    };
    const next = { ...core, ...grade };
    const unchanged =
      item.resultStatus === "result-not-found" &&
      (item.externalId ?? null) === externalId;
    return {
      next: unchanged ? { ...item, externalId } : next,
      changed: !unchanged,
      note: "result-not-found (lookupevent empty)",
    };
  }

  const status = mapStatus(event.strStatus);
  const homeScore = parseScore(event.intHomeScore);
  const awayScore = parseScore(event.intAwayScore);

  let grade: GradeFields;

  if (status === "graded") {
    if (homeScore == null || awayScore == null) {
      grade = {
        actualHomeScore: null,
        actualAwayScore: null,
        actualWinner: null,
        predictionCorrect: null,
        resultStatus: "pending",
        gradedAt: null,
        externalId,
      };
    } else {
      const winner = resolveWinner(homeScore, awayScore);
      grade = {
        actualHomeScore: homeScore,
        actualAwayScore: awayScore,
        actualWinner: winner,
        predictionCorrect: isPredictionCorrect(
          core.prediction,
          core.home,
          core.away,
          winner,
        ),
        resultStatus: "graded",
        gradedAt,
        externalId,
      };
    }
  } else if (status === "cancelled") {
    grade = {
      actualHomeScore: homeScore,
      actualAwayScore: awayScore,
      actualWinner: null,
      predictionCorrect: null,
      resultStatus: "cancelled",
      gradedAt: null,
      externalId,
    };
  } else if (status === "postponed") {
    grade = {
      actualHomeScore: null,
      actualAwayScore: null,
      actualWinner: null,
      predictionCorrect: null,
      resultStatus: "postponed",
      gradedAt: null,
      externalId,
    };
  } else {
    grade = {
      actualHomeScore: homeScore,
      actualAwayScore: awayScore,
      actualWinner: null,
      predictionCorrect: null,
      resultStatus: "pending",
      gradedAt: null,
      externalId,
    };
  }

  const next: PredictionItem = { ...core, ...grade };
  assertPredictionImmutable(item, next);

  // 이미 graded 이고 결과 동일 → 변경하지 않음 (gradedAt 유지)
  if (
    item.resultStatus === "graded" &&
    grade.resultStatus === "graded" &&
    gradeSnapshotEqual(
      {
        actualHomeScore: item.actualHomeScore ?? null,
        actualAwayScore: item.actualAwayScore ?? null,
        actualWinner: item.actualWinner ?? null,
        predictionCorrect: item.predictionCorrect ?? null,
        resultStatus: "graded",
        gradedAt: item.gradedAt ?? null,
        externalId: item.externalId ?? null,
      },
      { ...grade, gradedAt: item.gradedAt ?? null, externalId: item.externalId ?? externalId },
    )
  ) {
    return {
      next: {
        ...item,
        externalId: item.externalId ?? externalId,
      },
      changed: false,
      note: "unchanged graded",
    };
  }

  const prevStatus = item.resultStatus ?? "(none)";
  const changed =
    item.resultStatus !== grade.resultStatus ||
    item.actualHomeScore !== grade.actualHomeScore ||
    item.actualAwayScore !== grade.actualAwayScore ||
    item.actualWinner !== grade.actualWinner ||
    item.predictionCorrect !== grade.predictionCorrect;

  // 결과 정정 감지 (이미 graded → 다른 graded 결과)
  if (
    item.resultStatus === "graded" &&
    grade.resultStatus === "graded" &&
    changed
  ) {
    console.log("\n!!! RESULT CORRECTION !!!");
    console.log(`  gameId: ${core.gameId}`);
    console.log(
      `  before: ${item.actualHomeScore}-${item.actualAwayScore} winner=${item.actualWinner} correct=${item.predictionCorrect}`,
    );
    console.log(
      `  after : ${grade.actualHomeScore}-${grade.actualAwayScore} winner=${grade.actualWinner} correct=${grade.predictionCorrect}`,
    );
  }

  return {
    next: changed ? next : { ...item, externalId },
    changed,
    note: `${prevStatus} → ${grade.resultStatus} (provider status=${event.strStatus ?? "—"})`,
  };
}

async function main() {
  const dateArg = (process.argv[2] ?? "").trim();
  const date = dateArg || getKstToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`invalid date: ${date}`);
  }

  const file = snapshotPath(date);
  console.log("=== 예측 스냅샷 채점 ===");
  console.log(`file: ${file}`);

  const raw = await readFile(file, "utf8");
  const snapshot = JSON.parse(raw) as SnapshotFile;
  if (!Array.isArray(snapshot.predictions)) {
    throw new Error("invalid snapshot: predictions missing");
  }

  // 일정 Provider → externalId 매핑 (키 로그 금지)
  const provider = getSportsProvider();
  const schedule = await provider.getGames({ date, sport: "baseball" });
  const scheduleByGameId = new Map(schedule.map((g) => [g.id, g]));
  console.log(`schedule games: ${schedule.length} (provider=${provider.kind})`);

  const gradedAt = new Date().toISOString();
  const updated: PredictionItem[] = [];
  let changeCount = 0;

  for (const item of snapshot.predictions) {
    const { next, changed, note } = await gradeOne(
      item,
      scheduleByGameId,
      gradedAt,
    );
    assertPredictionImmutable(item, next);
    updated.push(next);
    if (changed) changeCount += 1;
    console.log(
      `  ${item.gameId}: ${note}` +
        (next.resultStatus === "graded"
          ? ` → ${next.actualHomeScore}-${next.actualAwayScore} (${next.actualWinner}) correct=${next.predictionCorrect}`
          : ""),
    );
    await new Promise((r) => setTimeout(r, 200));
  }

  const meta = buildMeta(snapshot.meta, updated, gradedAt);
  const payload: SnapshotFile = {
    meta,
    predictions: updated,
  };

  assertNoSecrets(payload);

  // 구조 검사
  for (const p of payload.predictions) {
    for (const key of PREDICTION_IMMUTABLE_KEYS) {
      if (!(key in p)) throw new Error(`missing immutable field: ${key}`);
    }
  }

  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const graded = updated.filter((p) => p.resultStatus === "graded");
  const correct = graded.filter((p) => p.predictionCorrect === true).length;
  const incorrect = graded.filter((p) => p.predictionCorrect === false).length;
  const pending = meta.pendingGames ?? 0;

  console.log("\n" + "=".repeat(52));
  console.log(`전체 예측 수 : ${updated.length}`);
  console.log(`채점 완료   : ${graded.length}`);
  console.log(`적중        : ${correct}`);
  console.log(`실패        : ${incorrect}`);
  console.log(`미결        : ${pending}`);
  console.log(
    `현재 적중률 : ${meta.accuracy == null ? "—" : `${meta.accuracy}%`}`,
  );
  console.log(`변경 건수   : ${changeCount}`);
  console.log(`저장        : ${file}`);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
