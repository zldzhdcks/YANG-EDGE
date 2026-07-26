/**
 * 선발투수 지표가 적중률에 기여하는지 백테스트.
 *
 * 목적:
 *   기존 MLB Baseline 추천 결과 + 경기 전(cutoff 이전) 선발투수 성적을 결합해,
 *   ERA/WHIP/최근등판/이닝을 단계적으로 추가했을 때 적중률이 개선되는지 측정한다.
 *
 * 절대 수정/변경 금지:
 *   - EDGE Engine / weights / 추천 결과 / Confidence / Market 계산
 *   - MLB Runtime / Feedback / Learning
 *   이 스크립트는 순수 분석 전용이며 위 모듈을 import 하지 않는다.
 *   Weight는 "제안"만 출력한다. 자동 변경 없음.
 *
 * 데이터:
 *   - Baseline:  data/daily-tests/2026-07-27-mlb-baseline-analysis.json
 *   - Pitcher :  data/daily-tests/2026-07-27-mlb-pitcher-stat-coverage.json (READY_FOR_BACKTEST만 사용)
 *   - 실제 결과: MLB Stats API schedule (gamePk, status=Final 인 경기만 채점)
 *
 * 표본 부족 시 적중률/향상률은 INSUFFICIENT_SAMPLE 로 표기한다.
 *
 * 실행:
 *   npx tsx scripts/backtest-pitcher-impact.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TARGET_DATE_KST = "2026-07-27";
const STATS_API_BASE = "https://statsapi.mlb.com";

/** 적중률/향상률을 신뢰할 최소 채점 표본 수. 미만이면 INSUFFICIENT_SAMPLE. */
const MIN_SAMPLE = 20;

/** 지표별 "의미 있는 차이"로 인정할 최소 격차 (노이즈로 인한 flip 방지). */
const ERA_GAP = 0.15;
const WHIP_GAP = 0.03;
const RECENT_ERA_GAP = 0.5;
const IP_GAP = 8.0;

const BASELINE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-baseline-analysis.json`,
);
const PITCHER_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-pitcher-stat-coverage.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "backtest",
  "pitcher-impact.json",
);

type Side = "home" | "away";
type Factor = "ERA" | "WHIP" | "RECENT" | "INNINGS";

const COMBOS: { key: string; label: string; factors: Factor[] }[] = [
  { key: "BASELINE", label: "Baseline", factors: [] },
  { key: "BASELINE_ERA", label: "Baseline + ERA", factors: ["ERA"] },
  {
    key: "BASELINE_ERA_WHIP",
    label: "Baseline + ERA + WHIP",
    factors: ["ERA", "WHIP"],
  },
  {
    key: "BASELINE_ERA_WHIP_RECENT",
    label: "Baseline + ERA + WHIP + 최근등판",
    factors: ["ERA", "WHIP", "RECENT"],
  },
  {
    key: "BASELINE_ERA_WHIP_RECENT_INNINGS",
    label: "Baseline + ERA + WHIP + 최근등판 + 이닝",
    factors: ["ERA", "WHIP", "RECENT", "INNINGS"],
  },
];

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
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// 입력 로딩
// ---------------------------------------------------------------------------

type BaselineGame = {
  gameId: string;
  homeTeam: string | null;
  awayTeam: string | null;
  pickTeamId: Side | null;
  edgeScore: number | null;
  confidence: number | null;
  analysisStatus: string | null;
  commenceTimeUtc: string | null;
  startTimeKst: string | null;
};

function loadBaseline(raw: unknown): BaselineGame[] {
  const root = asRecord(raw);
  // `games`에는 15경기 전체(PASS 포함, baseline pick 존재)가 있고
  // `candidates`에는 BASELINE_CANDIDATE만 있다. 표본 확보를 위해 games 우선.
  const source = Array.isArray(root?.games)
    ? root.games
    : Array.isArray(root?.candidates)
      ? root.candidates
      : [];
  return source
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) return null;
      const gameId = asString(row.gameId);
      if (!gameId) return null;
      const pickTeamId = asString(row.pickTeamId);
      return {
        gameId,
        homeTeam: asString(row.homeTeam),
        awayTeam: asString(row.awayTeam),
        pickTeamId:
          pickTeamId === "home" || pickTeamId === "away"
            ? (pickTeamId as Side)
            : null,
        edgeScore: asNumber(row.edgeScore),
        confidence: asNumber(row.confidence),
        analysisStatus: asString(row.analysisStatus),
        commenceTimeUtc: asString(row.commenceTimeUtc),
        startTimeKst: asString(row.startTimeKst),
      } satisfies BaselineGame;
    })
    .filter((g): g is BaselineGame => g != null);
}

type PitcherMetrics = {
  era: number | null;
  whip: number | null;
  ip: number | null;
  recentEra: number | null; // 최근 등판 평균 자책 (자책/이닝*9)
};

type PitcherGame = {
  baselineGameId: string | null;
  gamePk: number | null;
  status: string | null;
  home: PitcherMetrics;
  away: PitcherMetrics;
};

function recentEraFromOutings(outings: unknown): number | null {
  const list = Array.isArray(outings) ? outings : [];
  let er = 0;
  let ip = 0;
  for (const outing of list) {
    const row = asRecord(outing);
    const earned = asNumber(row?.earnedRuns);
    const innings = asNumber(row?.inningsPitched);
    if (earned == null || innings == null) continue;
    er += earned;
    ip += innings;
  }
  if (ip <= 0) return null;
  return (er / ip) * 9;
}

function sideMetrics(detailSide: unknown): PitcherMetrics {
  const row = asRecord(detailSide);
  return {
    era: asNumber(row?.seasonEra),
    whip: asNumber(row?.seasonWhip),
    ip: asNumber(row?.inningsPitched),
    recentEra: recentEraFromOutings(row?.recentOutings),
  };
}

function loadPitcher(raw: unknown): PitcherGame[] {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  return games
    .map((entry) => {
      const row = asRecord(entry);
      if (!row) return null;
      const detail = asRecord(row.detail);
      return {
        baselineGameId: asString(row.baselineGameId),
        gamePk: asNumber(row.gamePk),
        status: asString(row.status),
        home: sideMetrics(detail?.home),
        away: sideMetrics(detail?.away),
      } satisfies PitcherGame;
    })
    .filter((g): g is PitcherGame => g != null);
}

// ---------------------------------------------------------------------------
// 지표별 우세 방향 (home / away / none)
// ---------------------------------------------------------------------------

function leanLowerBetter(
  homeVal: number | null,
  awayVal: number | null,
  gap: number,
): Side | null {
  if (homeVal == null || awayVal == null) return null;
  const diff = awayVal - homeVal; // 홈이 더 낮으면(=우세) 양수
  if (Math.abs(diff) < gap) return null;
  return diff > 0 ? "home" : "away";
}

function leanHigherBetter(
  homeVal: number | null,
  awayVal: number | null,
  gap: number,
): Side | null {
  if (homeVal == null || awayVal == null) return null;
  const diff = homeVal - awayVal; // 홈이 더 높으면(=우세) 양수
  if (Math.abs(diff) < gap) return null;
  return diff > 0 ? "home" : "away";
}

function factorLean(factor: Factor, g: PitcherGame): Side | null {
  switch (factor) {
    case "ERA":
      return leanLowerBetter(g.home.era, g.away.era, ERA_GAP);
    case "WHIP":
      return leanLowerBetter(g.home.whip, g.away.whip, WHIP_GAP);
    case "RECENT":
      return leanLowerBetter(g.home.recentEra, g.away.recentEra, RECENT_ERA_GAP);
    case "INNINGS":
      // 이닝은 durability 지표 — 많을수록 우세로 간주
      return leanHigherBetter(g.home.ip, g.away.ip, IP_GAP);
  }
}

// ---------------------------------------------------------------------------
// 조합별 pick 계산
// ---------------------------------------------------------------------------

type JoinedGame = {
  gameId: string;
  gamePk: number | null;
  match: string;
  startTimeKst: string | null;
  baselinePick: Side;
  baselineCandidate: boolean;
  pitcher: PitcherGame;
};

/**
 * 조합의 pick.
 * baseline pick을 기준으로, 포함된 투수 지표가 baseline 반대편을 순-지지하면 flip.
 * (동률/무우세는 baseline 유지.) 결정적(deterministic).
 */
function comboPick(game: JoinedGame, factors: Factor[]): Side {
  const baseline = game.baselinePick;
  if (factors.length === 0) return baseline;
  const opposite: Side = baseline === "home" ? "away" : "home";
  let net = 0; // + baseline 지지, - baseline 반대
  for (const factor of factors) {
    const lean = factorLean(factor, game.pitcher);
    if (lean == null) continue;
    net += lean === baseline ? 1 : -1;
  }
  return net < 0 ? opposite : baseline;
}

// ---------------------------------------------------------------------------
// 실제 결과 (MLB Stats API) — Final 경기만 채점
// ---------------------------------------------------------------------------

type GameResult = {
  final: boolean;
  winner: Side | null;
  detailedState: string | null;
};

async function fetchResult(gamePk: number): Promise<GameResult> {
  const url = `${STATS_API_BASE}/api/v1/schedule?sportId=1&gamePk=${gamePk}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for schedule gamePk=${gamePk}`);
  }
  const data = asRecord(await response.json());
  const dates = Array.isArray(data?.dates) ? data.dates : [];
  const firstDate = asRecord(dates[0]);
  const games = Array.isArray(firstDate?.games) ? firstDate.games : [];
  const game = asRecord(games[0]);
  const status = asRecord(game?.status);
  const abstract = asString(status?.abstractGameState);
  const detailedState = asString(status?.detailedState);
  const teams = asRecord(game?.teams);
  const home = asRecord(teams?.home);
  const away = asRecord(teams?.away);

  const final = abstract === "Final";
  let winner: Side | null = null;
  if (final) {
    if (home?.isWinner === true) winner = "home";
    else if (away?.isWinner === true) winner = "away";
    else {
      const hs = asNumber(home?.score);
      const as = asNumber(away?.score);
      if (hs != null && as != null && hs !== as) {
        winner = hs > as ? "home" : "away";
      }
    }
  }
  return { final, winner, detailedState };
}

// ---------------------------------------------------------------------------
// 집계
// ---------------------------------------------------------------------------

type ComboReport = {
  key: string;
  label: string;
  factors: Factor[];
  readyGames: number;
  recommendedGames: number;
  recommendationRatioPercent: number;
  flipsFromBaseline: number;
  gradedSample: number;
  hits: number | null;
  hitRatePercent: number | null;
  improvementVsBaselinePoints: number | null;
  status: "OK" | "INSUFFICIENT_SAMPLE";
};

function buildComboReport(
  combo: { key: string; label: string; factors: Factor[] },
  games: JoinedGame[],
  results: Map<string, GameResult>,
  baselineHitRate: number | null,
): ComboReport {
  const readyGames = games.length;
  let recommended = 0;
  let flips = 0;
  let graded = 0;
  let hits = 0;

  for (const game of games) {
    const pick = comboPick(game, combo.factors);
    if (pick !== game.baselinePick) flips += 1;
    // 추천 비율: baseline gate(BASELINE_CANDIDATE)는 weight 변경 금지 원칙상 유지.
    if (game.baselineCandidate) recommended += 1;

    const result = game.gamePk != null ? results.get(String(game.gamePk)) : null;
    if (result?.final && result.winner) {
      graded += 1;
      if (pick === result.winner) hits += 1;
    }
  }

  const sufficient = graded >= MIN_SAMPLE;
  const hitRate = sufficient ? round1((hits / graded) * 100) : null;
  const improvement =
    sufficient && baselineHitRate != null && hitRate != null
      ? round1(hitRate - baselineHitRate)
      : null;

  return {
    key: combo.key,
    label: combo.label,
    factors: combo.factors,
    readyGames,
    recommendedGames: recommended,
    recommendationRatioPercent:
      readyGames > 0 ? round1((recommended / readyGames) * 100) : 0,
    flipsFromBaseline: flips,
    gradedSample: graded,
    hits: sufficient ? hits : null,
    hitRatePercent: hitRate,
    improvementVsBaselinePoints: combo.key === "BASELINE" ? 0 : improvement,
    status: sufficient ? "OK" : "INSUFFICIENT_SAMPLE",
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`=== Pitcher Impact Backtest (${TARGET_DATE_KST} KST) ===`);
  console.log("EDGE Engine/weights/추천/Market 미수정. Weight는 제안만.\n");

  const baselineRaw = JSON.parse(await readFile(BASELINE_PATH, "utf8"));
  const pitcherRaw = JSON.parse(await readFile(PITCHER_PATH, "utf8"));

  const baselineGames = loadBaseline(baselineRaw);
  const pitcherGames = loadPitcher(pitcherRaw);
  const pitcherById = new Map<string, PitcherGame>();
  for (const g of pitcherGames) {
    if (g.baselineGameId) pitcherById.set(g.baselineGameId, g);
  }

  // READY_FOR_BACKTEST 경기만 사용 + baseline 매칭 성공 + pick 방향 존재
  const joined: JoinedGame[] = [];
  const skipped: { gameId: string; reason: string }[] = [];
  for (const b of baselineGames) {
    const p = pitcherById.get(b.gameId);
    if (!p) {
      skipped.push({ gameId: b.gameId, reason: "pitcher coverage 없음" });
      continue;
    }
    if (p.status !== "READY_FOR_BACKTEST") {
      skipped.push({
        gameId: b.gameId,
        reason: `pitcher status ${p.status ?? "null"}`,
      });
      continue;
    }
    if (!b.pickTeamId) {
      skipped.push({ gameId: b.gameId, reason: "baseline pick 방향 없음" });
      continue;
    }
    joined.push({
      gameId: b.gameId,
      gamePk: p.gamePk,
      match: `${b.awayTeam ?? "?"} @ ${b.homeTeam ?? "?"}`,
      startTimeKst: b.startTimeKst,
      baselinePick: b.pickTeamId,
      baselineCandidate: b.analysisStatus === "BASELINE_CANDIDATE",
      pitcher: p,
    });
  }
  joined.sort((a, b) => a.gameId.localeCompare(b.gameId));

  // 실제 결과 조회 (Final 경기만 채점)
  const results = new Map<string, GameResult>();
  let resultErrors = 0;
  for (const game of joined) {
    if (game.gamePk == null) continue;
    try {
      results.set(String(game.gamePk), await fetchResult(game.gamePk));
    } catch {
      resultErrors += 1;
    }
  }
  const gradableGames = [...results.values()].filter(
    (r) => r.final && r.winner,
  ).length;

  // baseline 적중률 먼저 계산 (향상률 기준)
  const baselineReport = buildComboReport(
    COMBOS[0],
    joined,
    results,
    null,
  );
  const baselineHitRate = baselineReport.hitRatePercent;

  const comboReports: ComboReport[] = [
    baselineReport,
    ...COMBOS.slice(1).map((combo) =>
      buildComboReport(combo, joined, results, baselineHitRate),
    ),
  ];

  // 결정성 검증: 동일 입력 → 동일 pick 분포
  const pickFingerprint = () =>
    JSON.stringify(
      COMBOS.map((c) =>
        joined.map((g) => `${g.gameId}:${comboPick(g, c.factors)}`),
      ),
    );
  const deterministic = pickFingerprint() === pickFingerprint();

  // 결론
  const insufficient = gradableGames < MIN_SAMPLE;
  let conclusion: string;
  let bestCombo: string | null = null;
  if (insufficient) {
    conclusion =
      `INSUFFICIENT_SAMPLE: 채점 가능한(Final) 경기 ${gradableGames}개 < 최소 표본 ${MIN_SAMPLE}개. ` +
      `대상 ${TARGET_DATE_KST} 경기는 아직 종료되지 않아 적중률/향상률을 신뢰 구간 내에서 산출할 수 없다. ` +
      `조합별 pick·flip·추천 비율은 결정적으로 계산되었으나, 어떤 조합이 유의미한 개선인지 판단하려면 ` +
      `여러 날짜의 종료 경기를 누적해 표본을 확보해야 한다.`;
  } else {
    // 유의미한 개선 = baseline 대비 향상, 동률이면 더 단순한 조합 우선
    const improved = comboReports
      .filter((r) => r.status === "OK" && (r.improvementVsBaselinePoints ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.improvementVsBaselinePoints ?? 0) -
          (a.improvementVsBaselinePoints ?? 0),
      );
    if (improved.length > 0) {
      bestCombo = improved[0].key;
      conclusion =
        `${improved[0].label} 조합이 baseline 대비 ${improved[0].improvementVsBaselinePoints}p 개선으로 ` +
        `가장 의미 있는 향상을 보였다 (표본 ${improved[0].gradedSample}).`;
    } else {
      conclusion =
        `표본 ${gradableGames} 기준, 선발투수 지표를 추가해도 baseline 대비 적중률 개선이 확인되지 않았다.`;
    }
  }

  // Weight 제안 (제안 전용 — 자동 변경 없음)
  const weightProposal = {
    autoApply: false,
    note:
      "아래는 제안일 뿐 자동 적용하지 않는다. 충분한 종료-경기 표본으로 개선이 확인된 지표에 한해, " +
      "EDGE Engine weight 조정을 사람이 검토 후 반영할 것.",
    suggestedOrderIfValidated: [
      "ERA (선발 실점 억제 핵심 지표)",
      "WHIP (주자 허용/제구)",
      "최근등판 (직전 폼)",
      "이닝 (durability, 보조 지표)",
    ],
    status: insufficient ? "PROPOSAL_PENDING_SAMPLE" : "PROPOSAL_REVIEW",
  };

  const output = {
    meta: {
      version: "pitcher-impact-backtest-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      inputs: {
        baseline: path.relative(process.cwd(), BASELINE_PATH),
        pitcherCoverage: path.relative(process.cwd(), PITCHER_PATH),
        actualResults:
          "mlb-statsapi /api/v1/schedule?sportId=1&gamePk={gamePk} (Final 경기만 채점)",
      },
      minSample: MIN_SAMPLE,
      gaps: { ERA_GAP, WHIP_GAP, RECENT_ERA_GAP, IP_GAP },
      untouched: [
        "EDGE Engine",
        "weights",
        "추천 결과",
        "Confidence",
        "Market 계산",
        "MLB Runtime",
        "Feedback",
        "Learning",
      ],
      deterministic,
      note:
        "선발투수 지표를 Engine 투입 전에 사전 검증하는 순수 백테스트. Weight 자동 변경 없음.",
    },
    sample: {
      baselineGamesTotal: baselineGames.length,
      readyForBacktest: joined.length,
      skipped,
      resultsFetched: results.size,
      resultFetchErrors: resultErrors,
      gradableGames,
      sufficientForHitRate: !insufficient,
    },
    combos: comboReports,
    conclusion: {
      status: insufficient ? "INSUFFICIENT_SAMPLE" : "OK",
      bestCombo,
      message: conclusion,
    },
    weightProposal,
    games: joined.map((g) => {
      const result = g.gamePk != null ? results.get(String(g.gamePk)) : null;
      return {
        gameId: g.gameId,
        gamePk: g.gamePk,
        match: g.match,
        startTimeKst: g.startTimeKst,
        baselinePick: g.baselinePick,
        baselineCandidate: g.baselineCandidate,
        picks: Object.fromEntries(
          COMBOS.map((c) => [c.key, comboPick(g, c.factors)]),
        ),
        leans: {
          ERA: factorLean("ERA", g.pitcher),
          WHIP: factorLean("WHIP", g.pitcher),
          RECENT: factorLean("RECENT", g.pitcher),
          INNINGS: factorLean("INNINGS", g.pitcher),
        },
        result: result
          ? {
              final: result.final,
              detailedState: result.detailedState,
              winner: result.winner,
            }
          : null,
      };
    }),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  // 콘솔 요약
  console.log(`Baseline 경기: ${baselineGames.length}`);
  console.log(`READY_FOR_BACKTEST 사용: ${joined.length}`);
  console.log(`채점 가능(Final): ${gradableGames} (최소 ${MIN_SAMPLE})`);
  console.log("");
  console.log("조합\t표본\t적중률\t추천비율\tflip\t향상률");
  for (const r of comboReports) {
    const hit =
      r.hitRatePercent == null ? "INSUFFICIENT" : `${r.hitRatePercent}%`;
    const imp =
      r.improvementVsBaselinePoints == null
        ? "INSUFFICIENT"
        : `${r.improvementVsBaselinePoints}p`;
    console.log(
      `${r.label}\t${r.gradedSample}\t${hit}\t${r.recommendationRatioPercent}%\t${r.flipsFromBaseline}\t${imp}`,
    );
  }
  console.log("");
  console.log(`결론: ${output.conclusion.status}`);
  console.log(conclusion);
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
