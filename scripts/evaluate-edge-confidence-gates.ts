/**
 * |EDGE| × Confidence 복합 추천 게이트 백테스트 평가
 *
 * 입력: data/backtest/backtest-result.csv
 * 출력:
 *   data/backtest/edge-confidence-gate-evaluation.json
 *   data/backtest/edge-confidence-gate-evaluation.csv
 *
 * Engine / weights / Confidence 계산 / UI / Provider 미수정 — 평가만.
 * 어떤 조합도 Engine에 자동 채택하지 않는다.
 *
 * 실행: npx tsx scripts/evaluate-edge-confidence-gates.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CSV_IN = path.join(process.cwd(), "data", "backtest", "backtest-result.csv");
const JSON_OUT = path.join(
  process.cwd(),
  "data",
  "backtest",
  "edge-confidence-gate-evaluation.json",
);
const CSV_OUT = path.join(
  process.cwd(),
  "data",
  "backtest",
  "edge-confidence-gate-evaluation.csv",
);

const EDGE_MINS = [7.5, 10, 12.5, 15] as const;
const CONF_MINS = [0, 50, 52, 55, 60] as const;

/** 현실성 게이트 (표시용 — 자동 채택하지 않음) */
const GATE = {
  minSample: 100,
  minAccuracy: 57,
  minRecommendRate: 5,
} as const;

type Row = {
  league: string;
  edgeScore: number;
  confidence: number;
  hit: boolean | null;
};

type ComboStats = {
  edgeMin: number;
  confidenceMin: number;
  recommendedGames: number;
  recommendRate: number;
  hits: number;
  misses: number;
  accuracy: number;
  kboAccuracy: number;
  npbAccuracy: number;
  kboSample: number;
  npbSample: number;
  avgAbsEdgeScore: number;
  avgConfidence: number;
  gates: {
    sampleAtLeast100: boolean;
    accuracyAtLeast57: boolean;
    recommendRateAtLeast5: boolean;
    allPassed: boolean;
  };
};

type BandStats = {
  label: string;
  edgeMin: number;
  confidenceMinInclusive: number;
  confidenceMaxExclusive: number;
  sample: number;
  hits: number;
  misses: number;
  accuracy: number;
  kboAccuracy: number;
  npbAccuracy: number;
  kboSample: number;
  npbSample: number;
  avgAbsEdgeScore: number;
  avgConfidence: number;
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

    rows.push({
      league: cols[idx.league] ?? "",
      edgeScore: Number(cols[idx.edgeScore]),
      confidence: Number(cols[idx.confidence]),
      hit,
    });
  }
  return rows;
}

function selectRows(
  rows: Row[],
  pred: (r: Row & { hit: boolean }) => boolean,
): Array<Row & { hit: boolean }> {
  return rows.filter(
    (r): r is Row & { hit: boolean } => r.hit !== null && pred(r as Row & { hit: boolean }),
  );
}

function summarizeSelected(
  selected: Array<Row & { hit: boolean }>,
  evaluableTotal: number,
): Omit<ComboStats, "edgeMin" | "confidenceMin" | "gates"> {
  const hits = selected.filter((r) => r.hit).length;
  const misses = selected.length - hits;
  const kbo = selected.filter((r) => r.league === "KBO");
  const npb = selected.filter((r) => r.league === "NPB");

  return {
    recommendedGames: selected.length,
    recommendRate: pct(selected.length, evaluableTotal),
    hits,
    misses,
    accuracy: pct(hits, selected.length),
    kboAccuracy: pct(kbo.filter((r) => r.hit).length, kbo.length),
    npbAccuracy: pct(npb.filter((r) => r.hit).length, npb.length),
    kboSample: kbo.length,
    npbSample: npb.length,
    avgAbsEdgeScore:
      selected.length === 0
        ? 0
        : round2(
            selected.reduce((s, r) => s + Math.abs(r.edgeScore), 0) /
              selected.length,
          ),
    avgConfidence:
      selected.length === 0
        ? 0
        : round2(
            selected.reduce((s, r) => s + r.confidence, 0) / selected.length,
          ),
  };
}

function evaluateCombo(
  rows: Row[],
  edgeMin: number,
  confidenceMin: number,
  evaluableTotal: number,
): ComboStats {
  // 컷 미달 = PASS 제외 (오답 아님). 무승부도 제외.
  const selected = selectRows(
    rows,
    (r) =>
      Math.abs(r.edgeScore) >= edgeMin && r.confidence >= confidenceMin,
  );
  const base = summarizeSelected(selected, evaluableTotal);

  const sampleAtLeast100 = base.recommendedGames >= GATE.minSample;
  const accuracyAtLeast57 = base.accuracy >= GATE.minAccuracy;
  const recommendRateAtLeast5 = base.recommendRate >= GATE.minRecommendRate;

  return {
    edgeMin,
    confidenceMin,
    ...base,
    gates: {
      sampleAtLeast100,
      accuracyAtLeast57,
      recommendRateAtLeast5,
      allPassed:
        sampleAtLeast100 && accuracyAtLeast57 && recommendRateAtLeast5,
    },
  };
}

/** 오늘 추천과 동일 구간: |EDGE|≥10, Confidence ∈ [52, 55) */
function evaluateTodayLikeBand(
  rows: Row[],
  evaluableTotal: number,
): BandStats {
  const selected = selectRows(
    rows,
    (r) =>
      Math.abs(r.edgeScore) >= 10 &&
      r.confidence >= 52 &&
      r.confidence < 55,
  );
  const base = summarizeSelected(selected, evaluableTotal);
  return {
    label: "|EDGE|>=10 && Confidence in [52,55)",
    edgeMin: 10,
    confidenceMinInclusive: 52,
    confidenceMaxExclusive: 55,
    sample: base.recommendedGames,
    hits: base.hits,
    misses: base.misses,
    accuracy: base.accuracy,
    kboAccuracy: base.kboAccuracy,
    npbAccuracy: base.npbAccuracy,
    kboSample: base.kboSample,
    npbSample: base.npbSample,
    avgAbsEdgeScore: base.avgAbsEdgeScore,
    avgConfidence: base.avgConfidence,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  console.log("=== |EDGE| × Confidence 복합 게이트 평가 ===");
  console.log("입력:", CSV_IN);

  const raw = await readFile(CSV_IN, "utf8");
  const rows = parseCsv(raw);
  const evaluableTotal = rows.filter((r) => r.hit !== null).length;
  if (evaluableTotal === 0) throw new Error("evaluable rows empty");

  const combos: ComboStats[] = [];
  for (const edgeMin of EDGE_MINS) {
    for (const confidenceMin of CONF_MINS) {
      combos.push(evaluateCombo(rows, edgeMin, confidenceMin, evaluableTotal));
    }
  }

  const again: ComboStats[] = [];
  for (const edgeMin of EDGE_MINS) {
    for (const confidenceMin of CONF_MINS) {
      again.push(evaluateCombo(rows, edgeMin, confidenceMin, evaluableTotal));
    }
  }
  if (!deepEqual(combos, again)) {
    throw new Error("deterministic check failed");
  }

  const todayLikeBand = evaluateTodayLikeBand(rows, evaluableTotal);
  const todayLikeAgain = evaluateTodayLikeBand(rows, evaluableTotal);
  if (!deepEqual(todayLikeBand, todayLikeAgain)) {
    throw new Error("deterministic check failed (today-like band)");
  }

  const passed = combos.filter((c) => c.gates.allPassed);

  // 자동 채택하지 않음 — 보고용 휴리스틱만
  // 우선: allPassed → accuracy ↓ → sample ↓ → recommendRate ↓
  const realisticCandidate =
    [...passed].sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (b.recommendedGames !== a.recommendedGames) {
        return b.recommendedGames - a.recommendedGames;
      }
      return b.recommendRate - a.recommendRate;
    })[0] ?? null;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "backtest-result.csv",
    evaluableGames: evaluableTotal,
    drawsOrSkipped: rows.length - evaluableTotal,
    gateCriteria: GATE,
    note: "복합 게이트는 평가만. Engine·weights·UI에 자동 반영하지 않음.",
    combos,
    combosPassingAllGates: passed.map((c) => ({
      edgeMin: c.edgeMin,
      confidenceMin: c.confidenceMin,
      accuracy: c.accuracy,
      recommendedGames: c.recommendedGames,
      recommendRate: c.recommendRate,
    })),
    todayLikeBand,
    realisticCandidate: realisticCandidate
      ? {
          edgeMin: realisticCandidate.edgeMin,
          confidenceMin: realisticCandidate.confidenceMin,
          accuracy: realisticCandidate.accuracy,
          recommendedGames: realisticCandidate.recommendedGames,
          recommendRate: realisticCandidate.recommendRate,
        }
      : null,
  };

  await writeFile(JSON_OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const csvHeader = [
    "edgeMin",
    "confidenceMin",
    "recommendedGames",
    "recommendRate",
    "hits",
    "misses",
    "accuracy",
    "kboAccuracy",
    "npbAccuracy",
    "kboSample",
    "npbSample",
    "avgAbsEdgeScore",
    "avgConfidence",
    "sampleAtLeast100",
    "accuracyAtLeast57",
    "recommendRateAtLeast5",
    "allGatesPassed",
  ];
  const csvBody = combos.map((c) =>
    [
      c.edgeMin,
      c.confidenceMin,
      c.recommendedGames,
      c.recommendRate,
      c.hits,
      c.misses,
      c.accuracy,
      c.kboAccuracy,
      c.npbAccuracy,
      c.kboSample,
      c.npbSample,
      c.avgAbsEdgeScore,
      c.avgConfidence,
      c.gates.sampleAtLeast100,
      c.gates.accuracyAtLeast57,
      c.gates.recommendRateAtLeast5,
      c.gates.allPassed,
    ].join(","),
  );
  await writeFile(
    CSV_OUT,
    `${csvHeader.join(",")}\n${csvBody.join("\n")}\n`,
    "utf8",
  );

  console.log(`평가 가능 경기(무 제외): ${evaluableTotal}`);
  console.log(
    "\n|EDGE|≥ | Conf≥ | 추천수 | 비율% | 적중률 | KBO | NPB | avg|E| | avgC | ALL",
  );
  for (const c of combos) {
    console.log(
      `${String(c.edgeMin).padStart(6)} | ${String(c.confidenceMin).padStart(5)} | ` +
        `${String(c.recommendedGames).padStart(5)} | ${String(c.recommendRate).padStart(5)} | ` +
        `${String(c.accuracy).padStart(6)} | ${String(c.kboAccuracy).padStart(5)} | ` +
        `${String(c.npbAccuracy).padStart(5)} | ${String(c.avgAbsEdgeScore).padStart(5)} | ` +
        `${String(c.avgConfidence).padStart(5)} | ${c.gates.allPassed}`,
    );
  }

  console.log("\n세 조건 모두 만족:");
  if (passed.length === 0) console.log("  (없음)");
  else {
    for (const c of passed) {
      console.log(
        `  |EDGE|≥${c.edgeMin} + Conf≥${c.confidenceMin} → ` +
          `n=${c.recommendedGames}, acc=${c.accuracy}%, rate=${c.recommendRate}%`,
      );
    }
  }

  console.log("\n오늘과 동일 구간 (|EDGE|≥10, Conf 52~54):");
  console.log(
    `  n=${todayLikeBand.sample}, acc=${todayLikeBand.accuracy}% ` +
      `(KBO ${todayLikeBand.kboAccuracy}% / NPB ${todayLikeBand.npbAccuracy}%)`,
  );

  console.log(
    "\n현실적 후보(보고용, 자동채택 아님):",
    realisticCandidate
      ? `|EDGE|≥${realisticCandidate.edgeMin} + Conf≥${realisticCandidate.confidenceMin} ` +
          `(적중 ${realisticCandidate.accuracy}%, n=${realisticCandidate.recommendedGames})`
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
