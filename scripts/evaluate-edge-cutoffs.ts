/**
 * EDGE Score |abs| 최소 컷오프별 백테스트 성과 비교
 *
 * 입력: data/backtest/backtest-result.csv
 * 출력:
 *   data/backtest/edge-cutoff-evaluation.json
 *   data/backtest/edge-cutoff-evaluation.csv
 *
 * Engine / weights / UI / Provider 미수정 — 평가만.
 * 컷오프를 Engine에 자동 반영하지 않는다.
 *
 * 실행: npx tsx scripts/evaluate-edge-cutoffs.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CSV_IN = path.join(process.cwd(), "data", "backtest", "backtest-result.csv");
const JSON_OUT = path.join(
  process.cwd(),
  "data",
  "backtest",
  "edge-cutoff-evaluation.json",
);
const CSV_OUT = path.join(
  process.cwd(),
  "data",
  "backtest",
  "edge-cutoff-evaluation.csv",
);

const CUTOFFS = [0, 5, 7.5, 10, 12.5, 15] as const;

/** 현실성 게이트 (표시용 — 자동 채택하지 않음) */
const GATE = {
  minSample: 100,
  minAccuracy: 55,
  minRecommendRate: 10,
} as const;

type Row = {
  league: string;
  edgeScore: number;
  confidence: number;
  hit: boolean | null; // null = draw / PASS 제외 대상이 아님(무승부)
};

type CutoffStats = {
  cutoff: number;
  recommendedGames: number;
  recommendRate: number;
  hits: number;
  misses: number;
  accuracy: number;
  kboAccuracy: number;
  npbAccuracy: number;
  kboSample: number;
  npbSample: number;
  avgConfidence: number;
  avgAbsEdgeScore: number;
  gates: {
    sampleAtLeast100: boolean;
    accuracyAtLeast55: boolean;
    recommendRateAtLeast10: boolean;
    allPassed: boolean;
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return round2((n / d) * 100);
}

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const idx = {
    league: header.indexOf("league"),
    edgeScore: header.indexOf("edgeScore"),
    confidence: header.indexOf("confidence"),
    hit: header.indexOf("hit"),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v < 0) throw new Error(`CSV missing column: ${k}`);
  }

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const hitRaw = (cols[idx.hit] ?? "").trim();
    let hit: boolean | null = null;
    if (hitRaw === "1") hit = true;
    else if (hitRaw === "0") hit = false;
    // hit 빈칸 = 무승부 → 평가 pool에서 제외 (기존 백테스트와 동일)

    rows.push({
      league: cols[idx.league] ?? "",
      edgeScore: Number(cols[idx.edgeScore]),
      confidence: Number(cols[idx.confidence]),
      hit,
    });
  }
  return rows;
}

function evaluateCutoff(
  rows: Row[],
  cutoff: number,
  evaluableTotal: number,
): CutoffStats {
  // 컷오프 미만 = PASS (제외). 무승부도 제외.
  const selected = rows.filter(
    (r) => r.hit !== null && Math.abs(r.edgeScore) >= cutoff,
  ) as Array<Row & { hit: boolean }>;

  const hits = selected.filter((r) => r.hit).length;
  const misses = selected.length - hits;

  const kbo = selected.filter((r) => r.league === "KBO");
  const npb = selected.filter((r) => r.league === "NPB");
  const kboHits = kbo.filter((r) => r.hit).length;
  const npbHits = npb.filter((r) => r.hit).length;

  const avgConfidence =
    selected.length === 0
      ? 0
      : round2(
          selected.reduce((s, r) => s + r.confidence, 0) / selected.length,
        );
  const avgAbsEdgeScore =
    selected.length === 0
      ? 0
      : round2(
          selected.reduce((s, r) => s + Math.abs(r.edgeScore), 0) /
            selected.length,
        );

  const accuracy = pct(hits, selected.length);
  const recommendRate = pct(selected.length, evaluableTotal);

  const sampleAtLeast100 = selected.length >= GATE.minSample;
  const accuracyAtLeast55 = accuracy >= GATE.minAccuracy;
  const recommendRateAtLeast10 = recommendRate >= GATE.minRecommendRate;

  return {
    cutoff,
    recommendedGames: selected.length,
    recommendRate,
    hits,
    misses,
    accuracy,
    kboAccuracy: pct(kboHits, kbo.length),
    npbAccuracy: pct(npbHits, npb.length),
    kboSample: kbo.length,
    npbSample: npb.length,
    avgConfidence,
    avgAbsEdgeScore,
    gates: {
      sampleAtLeast100,
      accuracyAtLeast55,
      recommendRateAtLeast10,
      allPassed:
        sampleAtLeast100 && accuracyAtLeast55 && recommendRateAtLeast10,
    },
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  console.log("=== EDGE Score 컷오프 평가 ===");
  console.log("입력:", CSV_IN);

  const raw = await readFile(CSV_IN, "utf8");
  const rows = parseCsv(raw);
  const evaluable = rows.filter((r) => r.hit !== null);
  const evaluableTotal = evaluable.length;

  if (evaluableTotal === 0) {
    throw new Error("evaluable rows empty");
  }

  const results = CUTOFFS.map((c) => evaluateCutoff(rows, c, evaluableTotal));
  const again = CUTOFFS.map((c) => evaluateCutoff(rows, c, evaluableTotal));

  if (!deepEqual(results, again)) {
    throw new Error("deterministic check failed");
  }

  const passed = results.filter((r) => r.gates.allPassed);

  // 자동 채택하지 않음 — 보고용으로만 "현실적 후보" 휴리스틱 표기
  // 우선순위: allPassed → accuracy 높은 순 → sample 많은 순
  const realisticCandidate =
    [...passed].sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.recommendedGames - a.recommendedGames;
    })[0] ?? null;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "backtest-result.csv",
    evaluableGames: evaluableTotal,
    drawsOrSkipped: rows.length - evaluableTotal,
    gateCriteria: GATE,
    note: "컷오프는 평가만 수행. Engine에 자동 반영하지 않음.",
    cutoffs: results,
    cutoffsPassingAllGates: passed.map((r) => r.cutoff),
    realisticCandidateCutoff: realisticCandidate?.cutoff ?? null,
  };

  await writeFile(JSON_OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const csvHeader = [
    "cutoff",
    "recommendedGames",
    "recommendRate",
    "hits",
    "misses",
    "accuracy",
    "kboAccuracy",
    "npbAccuracy",
    "kboSample",
    "npbSample",
    "avgConfidence",
    "avgAbsEdgeScore",
    "sampleAtLeast100",
    "accuracyAtLeast55",
    "recommendRateAtLeast10",
    "allGatesPassed",
  ];
  const csvBody = results.map((r) =>
    [
      r.cutoff,
      r.recommendedGames,
      r.recommendRate,
      r.hits,
      r.misses,
      r.accuracy,
      r.kboAccuracy,
      r.npbAccuracy,
      r.kboSample,
      r.npbSample,
      r.avgConfidence,
      r.avgAbsEdgeScore,
      r.gates.sampleAtLeast100,
      r.gates.accuracyAtLeast55,
      r.gates.recommendRateAtLeast10,
      r.gates.allPassed,
    ].join(","),
  );
  await writeFile(
    CSV_OUT,
    `${csvHeader.join(",")}\n${csvBody.join("\n")}\n`,
    "utf8",
  );

  console.log(`평가 가능 경기(무 제외): ${evaluableTotal}`);
  console.log(
    "\n컷오프 | 추천수 | 추천비율 | 적중률 | KBO | NPB | avgConf | avg|EDGE| | gates",
  );
  for (const r of results) {
    console.log(
      `${String(r.cutoff).padStart(5)} | ${String(r.recommendedGames).padStart(5)} | ` +
        `${String(r.recommendRate).padStart(6)}% | ${String(r.accuracy).padStart(6)}% | ` +
        `${String(r.kboAccuracy).padStart(6)}% | ${String(r.npbAccuracy).padStart(6)}% | ` +
        `${String(r.avgConfidence).padStart(6)} | ${String(r.avgAbsEdgeScore).padStart(6)} | ` +
        `sample=${r.gates.sampleAtLeast100} acc=${r.gates.accuracyAtLeast55} rate=${r.gates.recommendRateAtLeast10} all=${r.gates.allPassed}`,
    );
  }

  console.log(
    "\n세 조건 모두 만족:",
    passed.length ? passed.map((r) => r.cutoff).join(", ") : "(없음)",
  );
  console.log(
    "현실적 후보(보고용):",
    realisticCandidate
      ? `|EDGE|≥${realisticCandidate.cutoff} (적중 ${realisticCandidate.accuracy}%, 추천 ${realisticCandidate.recommendedGames}경기)`
      : "(없음)",
  );
  console.log("결정성: PASS");
  console.log("JSON:", JSON_OUT);
  console.log("CSV :", CSV_OUT);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
