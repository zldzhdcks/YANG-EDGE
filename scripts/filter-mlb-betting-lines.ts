/**
 * 2026-07-27 KST MLB Baseline 후보 → 단폴 베팅 라인 분류.
 *
 * 조합배당·예측 스냅샷·UI 연결 없음.
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/filter-mlb-betting-lines.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  filterBaselineBettingLines,
  type BettingLineCandidateInput,
  type BettingLineFilterResult,
} from "../src/lib/mlb/betting-line-filter";

const TARGET_DATE_KST = (
  process.env.MLB_TARGET_DATE_KST ?? "2026-07-27"
).trim();
const BASELINE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-baseline-analysis.json`,
);
const COVERAGE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-analysis-coverage.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-betting-line-filter.json`,
);

type BaselineCandidate = {
  gameId: string;
  startTimeKst: string;
  dateKst: string;
  homeTeam: string;
  awayTeam: string;
  pickTeam: string | null;
  pickTeamId: "home" | "away" | null;
  modelWinProbability: number | null;
  edgeScore: number | null;
  confidence: number | null;
  marketProbability: number | null;
  valueEdge: number | null;
  dataAvailability: number | null;
  marketDataQuality: string | null;
  missingFactors?: string[];
  warnings?: string[];
  analysisStatus?: string;
};

type BaselineGame = BaselineCandidate & {
  analysisInput?: {
    home?: { recentGames?: unknown[] };
    away?: { recentGames?: unknown[] };
  };
};

type BaselineFile = {
  candidates?: BaselineCandidate[];
  games?: BaselineGame[];
};

type CoverageGame = {
  game?: { externalId?: string };
  analysisCandidate?: {
    marketOdds?: {
      available?: boolean;
      value?: {
        bestHomeOdds?: number;
        bestAwayOdds?: number;
      } | null;
    };
    home?: { recentGames?: { sampleSize?: number | null } };
    away?: { recentGames?: { sampleSize?: number | null } };
  };
};

type CoverageFile = {
  games?: CoverageGame[];
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function loadOddsAndSamples(coverage: CoverageFile): Map<
  string,
  {
    bestHomeOdds: number | null;
    bestAwayOdds: number | null;
    recentSampleHome: number | null;
    recentSampleAway: number | null;
  }
> {
  const map = new Map<
    string,
    {
      bestHomeOdds: number | null;
      bestAwayOdds: number | null;
      recentSampleHome: number | null;
      recentSampleAway: number | null;
    }
  >();

  for (const row of coverage.games ?? []) {
    const externalId = row.game?.externalId;
    if (!externalId) continue;
    const odds = row.analysisCandidate?.marketOdds;
    const homeOdds = asNumber(odds?.value?.bestHomeOdds);
    const awayOdds = asNumber(odds?.value?.bestAwayOdds);
    map.set(`mlb-${externalId}`, {
      bestHomeOdds:
        odds?.available && homeOdds != null && homeOdds > 1 ? homeOdds : null,
      bestAwayOdds:
        odds?.available && awayOdds != null && awayOdds > 1 ? awayOdds : null,
      recentSampleHome: asNumber(
        row.analysisCandidate?.home?.recentGames?.sampleSize,
      ),
      recentSampleAway: asNumber(
        row.analysisCandidate?.away?.recentGames?.sampleSize,
      ),
    });
  }
  return map;
}

function toInput(
  candidate: BaselineCandidate,
  gamesById: Map<string, BaselineGame>,
  extras: Map<
    string,
    {
      bestHomeOdds: number | null;
      bestAwayOdds: number | null;
      recentSampleHome: number | null;
      recentSampleAway: number | null;
    }
  >,
): BettingLineCandidateInput {
  const game = gamesById.get(candidate.gameId);
  const extra = extras.get(candidate.gameId);
  const recentFromAnalysisHome = game?.analysisInput?.home?.recentGames?.length;
  const recentFromAnalysisAway = game?.analysisInput?.away?.recentGames?.length;

  return {
    gameId: candidate.gameId,
    homeTeam: candidate.homeTeam,
    awayTeam: candidate.awayTeam,
    pickTeam: candidate.pickTeam,
    pickTeamId: candidate.pickTeamId,
    startTimeKst: candidate.startTimeKst,
    dateKst: candidate.dateKst,
    edgeScore: candidate.edgeScore,
    confidence: candidate.confidence,
    modelWinProbability: candidate.modelWinProbability,
    marketProbability: candidate.marketProbability,
    valueEdge: candidate.valueEdge,
    dataAvailability: candidate.dataAvailability,
    marketDataQuality: candidate.marketDataQuality,
    bestHomeOdds: extra?.bestHomeOdds ?? null,
    bestAwayOdds: extra?.bestAwayOdds ?? null,
    recentSampleHome:
      extra?.recentSampleHome ??
      (typeof recentFromAnalysisHome === "number"
        ? recentFromAnalysisHome
        : null),
    recentSampleAway:
      extra?.recentSampleAway ??
      (typeof recentFromAnalysisAway === "number"
        ? recentFromAnalysisAway
        : null),
    missingData: [...(candidate.missingFactors ?? [])],
    baselineWarnings: [...(candidate.warnings ?? [])],
  };
}

function countByClass(rows: BettingLineFilterResult[]) {
  return {
    REVIEW_PRIORITY: rows.filter((r) => r.classification === "REVIEW_PRIORITY")
      .length,
    REVIEW_SECONDARY: rows.filter(
      (r) => r.classification === "REVIEW_SECONDARY",
    ).length,
    MARKET_CONFLICT: rows.filter((r) => r.classification === "MARKET_CONFLICT")
      .length,
    INSUFFICIENT: rows.filter((r) => r.classification === "INSUFFICIENT")
      .length,
  };
}

async function main() {
  console.log(`=== MLB Betting Line Filter (${TARGET_DATE_KST} KST) ===`);
  console.log("입력:", path.relative(process.cwd(), BASELINE_PATH));
  console.log("단폴만 분류. 조합배당 계산 없음.\n");

  const baseline = JSON.parse(
    await readFile(BASELINE_PATH, "utf8"),
  ) as BaselineFile;
  const coverage = JSON.parse(
    await readFile(COVERAGE_PATH, "utf8"),
  ) as CoverageFile;

  const candidates = (baseline.candidates ?? []).filter(
    (row) => row.analysisStatus === "BASELINE_CANDIDATE",
  );
  if (candidates.length === 0) {
    console.log("BASELINE_CANDIDATE 없음 — 빈 필터 결과 저장");
    const emptyOutput = {
      meta: {
        version: "mlb-betting-line-filter-v1",
        generatedAt: new Date().toISOString(),
        targetDateKst: TARGET_DATE_KST,
        inputBaseline: path.relative(process.cwd(), BASELINE_PATH),
        inputCoverage: path.relative(process.cwd(), COVERAGE_PATH),
        singlesOnly: true,
        parlaysBuilt: false,
        predictionSnapshotSaved: false,
        uiConnected: false,
        confidenceAutoReject: false,
        note: "BASELINE_CANDIDATE 없음",
      },
      summary: {
        totalBaselineCandidates: 0,
        counts: {
          REVIEW_PRIORITY: 0,
          REVIEW_SECONDARY: 0,
          MARKET_CONFLICT: 0,
          INSUFFICIENT: 0,
        },
        deterministic: true,
        reviewTargets: [],
        marketConflicts: [],
        topValueEdge: [],
        cannotConfirmBeforePitchers:
          "BASELINE_CANDIDATE가 없어 단폴 관찰 라인을 만들지 않았다.",
      },
      lines: [],
    };
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(
      OUTPUT_PATH,
      `${JSON.stringify(emptyOutput, null, 2)}\n`,
      "utf8",
    );
    console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
    return;
  }

  const gamesById = new Map(
    (baseline.games ?? []).map((game) => [game.gameId, game]),
  );
  const extras = loadOddsAndSamples(coverage);
  const inputs = candidates.map((candidate) =>
    toInput(candidate, gamesById, extras),
  );

  const first = filterBaselineBettingLines(inputs);
  const second = filterBaselineBettingLines(inputs);
  const deterministic =
    stableStringify(first) === stableStringify(second);

  const counts = countByClass(first);
  const reviewTargets = first.filter(
    (row) =>
      row.classification === "REVIEW_PRIORITY" ||
      row.classification === "REVIEW_SECONDARY",
  );
  const conflicts = first.filter(
    (row) => row.classification === "MARKET_CONFLICT",
  );
  const topValue = [...first]
    .filter((row) => row.valueEdge != null)
    .sort(
      (a, b) =>
        (b.valueEdge ?? Number.NEGATIVE_INFINITY) -
        (a.valueEdge ?? Number.NEGATIVE_INFINITY),
    )
    .slice(0, 3);

  const cannotConfirmReason =
    "모든 후보에서 선발투수가 미확보이다. Baseline 결과이므로 선발·부상·라인업 반영 전 확정 추천으로 사용할 수 없다.";

  const output = {
    meta: {
      version: "mlb-betting-line-filter-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      inputBaseline: path.relative(process.cwd(), BASELINE_PATH),
      inputCoverage: path.relative(process.cwd(), COVERAGE_PATH),
      singlesOnly: true,
      parlaysBuilt: false,
      predictionSnapshotSaved: false,
      uiConnected: false,
      confidenceAutoReject: false,
      note: "Confidence는 탈락 기준이 아니며 <50은 warning/경계 분류만 한다.",
    },
    summary: {
      totalBaselineCandidates: first.length,
      counts,
      deterministic,
      reviewTargets: reviewTargets.map((row) => ({
        gameId: row.gameId,
        match: row.match,
        pickTeam: row.pickTeam,
        classification: row.classification,
        valueEdge: row.valueEdge,
        edgeScore: row.edgeScore,
        confidence: row.confidence,
        bestOdds: row.bestOdds,
      })),
      marketConflicts: conflicts.map((row) => ({
        gameId: row.gameId,
        match: row.match,
        pickTeam: row.pickTeam,
        valueEdge: row.valueEdge,
        edgeScore: row.edgeScore,
      })),
      topValueEdge: topValue.map((row) => ({
        gameId: row.gameId,
        match: row.match,
        pickTeam: row.pickTeam,
        valueEdge: row.valueEdge,
        edgeScore: row.edgeScore,
        confidence: row.confidence,
        bestOdds: row.bestOdds,
        classification: row.classification,
      })),
      cannotConfirmBeforePitchers: cannotConfirmReason,
    },
    lines: first,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );

  console.log(`REVIEW_PRIORITY: ${counts.REVIEW_PRIORITY}`);
  console.log(`REVIEW_SECONDARY: ${counts.REVIEW_SECONDARY}`);
  console.log(`MARKET_CONFLICT: ${counts.MARKET_CONFLICT}`);
  console.log(`INSUFFICIENT: ${counts.INSUFFICIENT}`);
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);

  console.log("\nREVIEW_PRIORITY:");
  for (const row of first.filter((r) => r.classification === "REVIEW_PRIORITY")) {
    console.log(
      `  ${row.match} → ${row.pickTeam}` +
        ` | EDGE ${row.edgeScore} | Conf ${row.confidence}` +
        ` | VE ${row.valueEdge} | odds ${row.bestOdds ?? "—"}`,
    );
  }

  console.log("\nREVIEW_SECONDARY:");
  for (const row of first.filter(
    (r) => r.classification === "REVIEW_SECONDARY",
  )) {
    console.log(
      `  ${row.match} → ${row.pickTeam}` +
        ` | EDGE ${row.edgeScore} | Conf ${row.confidence}` +
        ` | VE ${row.valueEdge} | odds ${row.bestOdds ?? "—"}` +
        ` | warnings: ${row.warnings.join(", ")}`,
    );
  }

  console.log("\nMARKET_CONFLICT:");
  for (const row of conflicts) {
    console.log(
      `  ${row.match} → ${row.pickTeam}` +
        ` | EDGE ${row.edgeScore} | Conf ${row.confidence}` +
        ` | VE ${row.valueEdge} | odds ${row.bestOdds ?? "—"}`,
    );
  }

  console.log("\n가장 높은 Value Edge 3:");
  for (const [index, row] of topValue.entries()) {
    console.log(
      `  ${index + 1}. ${row.match} → ${row.pickTeam}` +
        ` (VE ${row.valueEdge}, EDGE ${row.edgeScore}, Conf ${row.confidence}, odds ${row.bestOdds ?? "—"})`,
    );
  }

  console.log(`\n확정 불가 이유: ${cannotConfirmReason}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
