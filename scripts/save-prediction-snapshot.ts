/**
 * 예측 스냅샷 저장 (저장 전용 — 결과 비교 없음).
 *
 * 입력: data/daily-tests/{date}-1800-baseball-analysis.json 의 RECOMMENDED 경기
 * 출력: data/predictions/{date}.json
 *
 * - 실제 경기 결과는 저장하지 않는다.
 * - 같은 날짜 파일에 같은 gameId 는 중복 저장하지 않는다 (기존 항목 유지).
 * - Engine / weights / Confidence / Market / Odds / UI 미수정.
 *
 * 실행: npx tsx scripts/save-prediction-snapshot.ts [YYYY-MM-DD]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "../src/lib/datetime/kst";

const SNAPSHOT_VERSION = "prediction-snapshot-v1";

type AnalysisReportGame = {
  gameId?: string;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  pickTeam?: string | null;
  winProbability?: number | null;
  edgeScore?: number | null;
  confidence?: number | null;
  recommendationGrade?: string | null;
  marketProbability?: number | null;
  valueEdge?: number | null;
  finalStatus?: string;
};

type AnalysisReport = {
  meta?: { dateKst?: string };
  games?: AnalysisReportGame[];
};

/** 스냅샷 항목 — 예측값만. 결과 필드 없음. */
type PredictionSnapshotItem = {
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

type PredictionSnapshotFile = {
  meta: {
    version: string;
    dateKst: string;
    generatedAt: string;
    recommendedGames: number;
  };
  predictions: PredictionSnapshotItem[];
};

function analysisFilePath(date: string): string {
  return path.join(
    process.cwd(),
    "data",
    "daily-tests",
    `${date}-1800-baseball-analysis.json`,
  );
}

function snapshotFilePath(date: string): string {
  return path.join(process.cwd(), "data", "predictions", `${date}.json`);
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toSnapshotItem(
  game: AnalysisReportGame,
  createdAt: string,
): PredictionSnapshotItem | null {
  if (!game.gameId || !game.pickTeam) return null;

  return {
    gameId: game.gameId,
    league: game.league ?? "",
    home: game.homeTeam ?? "",
    away: game.awayTeam ?? "",
    prediction: game.pickTeam,
    probability: toNumberOrNull(game.winProbability),
    edgeScore: toNumberOrNull(game.edgeScore),
    confidence: toNumberOrNull(game.confidence),
    recommendationGrade: game.recommendationGrade ?? null,
    marketProbability: toNumberOrNull(game.marketProbability),
    valueEdge: toNumberOrNull(game.valueEdge),
    createdAt,
  };
}

async function readExistingSnapshot(
  file: string,
): Promise<PredictionSnapshotItem[]> {
  try {
    const raw = await readFile(file, "utf8");
    const body = JSON.parse(raw) as PredictionSnapshotFile;
    return Array.isArray(body.predictions) ? body.predictions : [];
  } catch {
    return [];
  }
}

async function main() {
  const date = (process.argv[2] ?? "").trim() || getKstToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`invalid date argument: ${date}`);
  }

  const inFile = analysisFilePath(date);
  const outFile = snapshotFilePath(date);

  console.log("=== 예측 스냅샷 저장 (결과 비교 없음) ===");
  console.log(`dateKst : ${date}`);
  console.log(`input   : ${inFile}`);

  const raw = await readFile(inFile, "utf8");
  const report = JSON.parse(raw) as AnalysisReport;

  const recommended = (report.games ?? []).filter(
    (g) => g.finalStatus === "RECOMMENDED",
  );
  console.log(`추천 경기: ${recommended.length}`);

  const existing = await readExistingSnapshot(outFile);
  const existingIds = new Set(existing.map((p) => p.gameId));
  const createdAt = new Date().toISOString();

  const added: PredictionSnapshotItem[] = [];
  const skipped: string[] = [];

  for (const game of recommended) {
    const item = toSnapshotItem(game, createdAt);
    if (!item) continue;
    if (existingIds.has(item.gameId)) {
      skipped.push(item.gameId);
      continue;
    }
    existingIds.add(item.gameId);
    added.push(item);
  }

  const predictions = [...existing, ...added].sort((a, b) =>
    a.gameId.localeCompare(b.gameId),
  );

  const payload: PredictionSnapshotFile = {
    meta: {
      version: SNAPSHOT_VERSION,
      dateKst: date,
      generatedAt: createdAt,
      recommendedGames: predictions.length,
    },
    predictions,
  };

  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  for (const item of predictions) {
    console.log(
      `  ${item.league} ${item.home} vs ${item.away} → ${item.prediction} ` +
        `(EDGE ${item.edgeScore ?? "—"}, Conf ${item.confidence ?? "—"}, ${item.recommendationGrade ?? "—"})`,
    );
  }

  console.log("\n" + "=".repeat(52));
  console.log(`신규 저장 : ${added.length}`);
  console.log(`중복 스킵 : ${skipped.length}${skipped.length ? ` (${skipped.join(", ")})` : ""}`);
  console.log(`총 보관   : ${predictions.length}`);
  console.log(`저장      : ${outFile}`);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
