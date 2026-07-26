/**
 * 2026-07-27 KST MLB 관찰 목록 생성.
 *
 * 추천·베팅 지시·예측 스냅샷 저장 없음.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/build-mlb-watchlist.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildMlbWatchlistFile,
  type MlbWatchlistFile,
  type MlbWatchlistLineInput,
} from "../src/lib/mlb/build-mlb-watchlist";

const TARGET_DATE_KST = "2026-07-27";
const FILTER_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-betting-line-filter.json`,
);
const BASELINE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-baseline-analysis.json`,
);
const ENRICHMENT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-enrichment-candidate.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb.json`,
);

type FilterFile = {
  lines?: MlbWatchlistLineInput[];
};

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readExistingWatchlist(): Promise<MlbWatchlistFile | null> {
  try {
    return await readJson<MlbWatchlistFile>(OUTPUT_PATH);
  } catch {
    return null;
  }
}

async function main() {
  console.log(`=== MLB Watchlist (${TARGET_DATE_KST} KST) ===`);
  console.log("관찰 목록만 생성. 추천·스냅샷 저장 없음.\n");

  // 입력 존재 확인 (내용은 filter lines 기준, 나머지는 참조 검증)
  const [filter, baseline, enrichment, existing] = await Promise.all([
    readJson<FilterFile>(FILTER_PATH),
    readJson<unknown>(BASELINE_PATH),
    readJson<{
      meta?: { engineConnected?: boolean; scrambledDetection?: { scrambled?: boolean | null } };
      scrambledDetection?: { scrambled?: boolean | null };
    }>(ENRICHMENT_PATH),
    readExistingWatchlist(),
  ]);

  if (!baseline || !enrichment) {
    throw new Error("baseline/enrichment 입력 누락");
  }
  if (enrichment.meta?.engineConnected === true) {
    throw new Error("enrichment가 Engine에 연결된 것으로 표시됨 — 중단");
  }

  const lines = filter.lines ?? [];
  if (lines.length === 0) {
    throw new Error("betting-line-filter lines 비어 있음");
  }

  const createdAt = new Date().toISOString();
  const { file, unchanged } = buildMlbWatchlistFile({
    targetDateKst: TARGET_DATE_KST,
    lines,
    createdAt,
    existing,
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  if (!unchanged) {
    await writeFile(OUTPUT_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  }

  const high = file.games.filter((g) => g.priority === "HIGH");
  const medium = file.games.filter((g) => g.priority === "MEDIUM");
  const watch = file.games.filter((g) => g.priority === "WATCH");

  console.log(`전체 관찰 경기 수: ${file.summary.total}`);
  console.log(`HIGH: ${file.summary.high}`);
  for (const g of high) {
    console.log(
      `  ${g.baselinePick} | ${g.homeTeam} vs ${g.awayTeam} | VE ${g.valueEdge} | odds ${g.baselineOdds}`,
    );
  }
  console.log(`MEDIUM: ${file.summary.medium}`);
  for (const g of medium) {
    console.log(
      `  ${g.baselinePick} | ${g.homeTeam} vs ${g.awayTeam} | VE ${g.valueEdge} | odds ${g.baselineOdds}`,
    );
  }
  console.log(`WATCH: ${file.summary.watch}`);
  for (const g of watch) {
    console.log(
      `  ${g.baselinePick} | ${g.homeTeam} vs ${g.awayTeam} | VE ${g.valueEdge} | Conf ${g.confidence}`,
    );
  }
  console.log("제외 경기:");
  for (const row of file.summary.excluded) {
    console.log(
      `  ${row.pickTeam ?? "?"} (${row.gameId}) — ${row.classification}: ${row.reason}`,
    );
  }
  console.log(
    `재확인 사유: ${file.summary.commonRecheckReasons.join(", ")}`,
  );
  console.log(`실제 추천이 아닌 이유: ${file.summary.notARecommendationReason}`);
  console.log(`중복 실행: ${unchanged ? "변경 없음 (안전)" : "신규/갱신 저장"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
