import { readFile } from "node:fs/promises";
import path from "node:path";
import { abbreviateTeamName } from "@/lib/mlb/review-classify-v2";
import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import {
  failureCauseLabel,
  successCauseLabel,
} from "@/lib/mlb/research-ux-v1/category-labels";
import {
  loadMlbExpectedLineupGameDetailPanel,
  readProviderLineupCollectionStatus,
} from "@/lib/mlb/expected-lineup-observation-v0";
import {
  loadMlbKoreanMarketPanelForGame,
  readProviderMarketPanelFromOddsHistory,
} from "@/lib/mlb/korean-market-odds-observation-v0";
import {
  plainWarning,
  reviewCandidatePlain,
  toneLabel,
} from "./plain-labels";
import {
  MLB_GAME_DETAIL_UX_SCHEMA,
  type FactorRow,
  type FactorTone,
  type MlbGameDetailView,
  type QualityCheck,
  type ReviewCandidate,
  type SideProbRow,
} from "./types";

async function readJson<T>(abs: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(abs, "utf8")) as T;
  } catch {
    return null;
  }
}

function pct(n: number | null | undefined, digits = 3): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const v = n <= 1 ? n * 100 : n;
  return Number(v.toFixed(digits));
}

function diffPp(
  model: number | null,
  market: number | null,
): number | null {
  if (model == null || market == null) return null;
  return Number((model - market).toFixed(3));
}

function factor(
  id: string,
  label: string,
  tone: FactorTone,
  summary: string,
  detailLines: string[],
): FactorRow {
  return {
    id,
    label,
    tone,
    toneLabel: toneLabel(tone),
    summary,
    detailLines,
  };
}

function buildFactors(pred: Record<string, unknown> | null): FactorRow[] {
  if (!pred) {
    return [
      "Starter",
      "Bullpen",
      "Lineup",
      "Market",
      "Home Advantage",
      "Input Quality",
    ].map((label) =>
      factor(
        label.toLowerCase().replace(/\s+/g, "_"),
        label,
        "NOT_AVAILABLE",
        "Prediction artifact에서 해당 경기를 찾지 못했습니다.",
        [],
      ),
    );
  }

  const warnings = Array.isArray(pred.inputWarnings)
    ? pred.inputWarnings.map(String)
    : [];
  const missing = Array.isArray(pred.missingFactors)
    ? pred.missingFactors.map(String)
    : [];
  const used = Array.isArray(pred.usedFactors)
    ? pred.usedFactors.map(String)
    : [];
  const explanations = Array.isArray(pred.explanations)
    ? pred.explanations.map(String)
    : [];

  const markets = Array.isArray(pred.marketPredictions)
    ? pred.marketPredictions
    : [];
  const ml = asRecord(
    markets.find(
      (m) => asString(asRecord(m)?.marketType) === "MONEYLINE_2WAY",
    ),
  );
  const components = asRecord(ml?.components);

  const starterComp = asNumber(components?.starter);
  const bullpenComp = asNumber(components?.bullpen);
  const lineupComp = asNumber(components?.lineup);
  const homeComp = asNumber(components?.homeAdvantage);
  const pitcherDirection = asString(pred.pitcherDirection);
  const pitcherReview = pred.pitcherReviewAvailable === true;

  // Starter
  let starter: FactorRow;
  if (warnings.some((w) => /STARTER_SAMPLE_PARTIAL|STARTER_MISSING/i.test(w))) {
    starter = factor(
      "starter",
      "Starter",
      "HOLD",
      "선발 데이터가 부분적이거나 제한적입니다.",
      warnings.filter((w) => /STARTER/i.test(w)).map(plainWarning),
    );
  } else if (starterComp != null && Math.abs(starterComp) >= 0.02) {
    starter = factor(
      "starter",
      "Starter",
      starterComp > 0 ? "ADVANTAGE" : "DISADVANTAGE",
      starterComp > 0
        ? "모델 구성요소상 홈 쪽 선발 신호가 있었습니다 (연구용)."
        : "모델 구성요소상 원정 쪽 선발 신호가 있었습니다 (연구용).",
      [
        `component.starter=${starterComp}`,
        pitcherDirection
          ? `pitcherDirection=${pitcherDirection}`
          : "pitcherDirection=null",
        ...explanations.filter((e) => /STARTER/i.test(e)).map(plainWarning),
      ],
    );
  } else if (used.includes("startingPitcher") || pitcherReview) {
    starter = factor(
      "starter",
      "Starter",
      "NEUTRAL",
      "선발이 사용 요인에 포함됐으나 강한 방향 신호는 Artifact에 없습니다.",
      [
        pitcherDirection
          ? `pitcherDirection=${pitcherDirection}`
          : "pitcherDirection=null",
      ],
    );
  } else {
    starter = factor(
      "starter",
      "Starter",
      "NOT_AVAILABLE",
      "선발 세부 평가를 표시할 Artifact 근거가 부족합니다.",
      [],
    );
  }

  // Bullpen
  let bullpen: FactorRow;
  if (warnings.some((w) => /^BULLPEN_WEIGHT_DISABLED/i.test(w))) {
    bullpen = factor(
      "bullpen",
      "Bullpen",
      "RESEARCH_NOT_CONNECTED",
      "불펜 가중치는 현재 연구 베이스라인에서 연결되어 있지 않습니다.",
      [plainWarning("BULLPEN_WEIGHT_DISABLED_V0")],
    );
  } else if (bullpenComp != null && bullpenComp !== 0) {
    bullpen = factor(
      "bullpen",
      "Bullpen",
      bullpenComp > 0 ? "ADVANTAGE" : "DISADVANTAGE",
      "불펜 구성요소 신호가 Artifact에 있습니다 (연구용).",
      [`component.bullpen=${bullpenComp}`],
    );
  } else {
    bullpen = factor(
      "bullpen",
      "Bullpen",
      "NOT_AVAILABLE",
      "불펜 세부 평가 데이터가 없습니다.",
      [],
    );
  }

  // Lineup
  let lineup: FactorRow;
  if (
    missing.some((m) => /LINEUP/i.test(m)) ||
    warnings.some((w) => /LINEUP_NOT_CONFIRMED/i.test(w))
  ) {
    lineup = factor(
      "lineup",
      "Lineup",
      "HOLD",
      "확정 라인업이 없어 라인업 근거는 보류입니다.",
      [plainWarning("LINEUP_NOT_CONFIRMED")],
    );
  } else if (lineupComp != null && lineupComp !== 0) {
    lineup = factor(
      "lineup",
      "Lineup",
      lineupComp > 0 ? "ADVANTAGE" : "DISADVANTAGE",
      "라인업 구성요소 신호가 Artifact에 있습니다.",
      [`component.lineup=${lineupComp}`],
    );
  } else {
    lineup = factor(
      "lineup",
      "Lineup",
      "NOT_AVAILABLE",
      "라인업 세부 평가를 표시할 근거가 없습니다.",
      [],
    );
  }

  // Market
  const marketHome = pct(asNumber(ml?.marketHomeProbability));
  const modelHome = pct(asNumber(ml?.homeProbability));
  const pickSide =
    asString(asRecord(ml?.researchBaseline)?.selection) === "AWAY"
      ? "AWAY"
      : asString(asRecord(ml?.researchBaseline)?.selection) === "HOME"
        ? "HOME"
        : null;
  let market: FactorRow;
  if (marketHome == null || modelHome == null) {
    market = factor(
      "market",
      "Market",
      "NOT_AVAILABLE",
      "시장 확률 Artifact가 없습니다.",
      [],
    );
  } else {
    const marketFavorsHome = marketHome >= 50;
    const aligned =
      (pickSide === "HOME" && marketFavorsHome) ||
      (pickSide === "AWAY" && !marketFavorsHome);
    market = factor(
      "market",
      "Market",
      aligned ? "ADVANTAGE" : "DISADVANTAGE",
      aligned
        ? "시장 방향과 연구 예측 방향이 일치합니다."
        : "시장 방향과 연구 예측 방향이 어긋나거나 가격 매력이 제한적입니다.",
      [
        `marketHome=${marketHome}%`,
        `modelHome=${modelHome}%`,
        asString(pred.oddsMovement)
          ? `oddsMovement=${asString(pred.oddsMovement)}`
          : "oddsMovement=UNKNOWN",
        ...explanations.filter((e) => /MARKET/i.test(e)).map(plainWarning),
      ],
    );
  }

  // Home advantage
  let homeAdv: FactorRow;
  if (homeComp != null && homeComp > 0) {
    homeAdv = factor(
      "home_advantage",
      "Home Advantage",
      "ADVANTAGE",
      "홈 어드밴티지 구성요소가 모델에 포함돼 있습니다 (연구용 상수/신호).",
      [`component.homeAdvantage=${homeComp}`],
    );
  } else if (used.includes("homeAdvantage")) {
    homeAdv = factor(
      "home_advantage",
      "Home Advantage",
      "NEUTRAL",
      "홈 어드밴티지가 사용 요인에 포함돼 있습니다.",
      [],
    );
  } else {
    homeAdv = factor(
      "home_advantage",
      "Home Advantage",
      "NOT_AVAILABLE",
      "홈 어드밴티지 세부 값이 Artifact에 없습니다.",
      [],
    );
  }

  // Input quality
  const inputStatus = asString(pred.inputStatus) ?? "UNKNOWN";
  let inputQ: FactorRow;
  if (inputStatus === "ELIGIBLE" || inputStatus === "FULL_INPUT") {
    inputQ = factor(
      "input_quality",
      "Input Quality",
      "ADVANTAGE",
      "입력 상태가 충분합니다.",
      [inputStatus],
    );
  } else if (inputStatus === "LIMITED_INPUT") {
    inputQ = factor(
      "input_quality",
      "Input Quality",
      "HOLD",
      "입력 품질이 제한적입니다 (LIMITED_INPUT).",
      warnings.map(plainWarning),
    );
  } else if (inputStatus === "BLOCKED") {
    inputQ = factor(
      "input_quality",
      "Input Quality",
      "DISADVANTAGE",
      "입력이 BLOCKED 상태입니다.",
      warnings.map(plainWarning),
    );
  } else {
    inputQ = factor(
      "input_quality",
      "Input Quality",
      "UNKNOWN" as FactorTone,
      "입력 품질 상태를 확인할 수 없습니다.",
      [inputStatus],
    );
  }
  // Fix UNKNOWN tone - use NOT_AVAILABLE
  if ((inputQ.tone as string) === "UNKNOWN") {
    inputQ = { ...inputQ, tone: "NOT_AVAILABLE", toneLabel: toneLabel("NOT_AVAILABLE") };
  }

  return [starter, bullpen, lineup, market, homeAdv, inputQ];
}

function buildQualityChecks(
  pred: Record<string, unknown> | null,
  scheduleGame: Record<string, unknown> | null,
  hasOdds: boolean,
): { overall: MlbGameDetailView["dataQuality"]["overall"]; checks: QualityCheck[]; codes: string[] } {
  const warnings = pred && Array.isArray(pred.inputWarnings)
    ? pred.inputWarnings.map(String)
    : [];
  const codes = [...warnings];
  const inputStatus = asString(pred?.inputStatus) ?? "UNKNOWN";

  const checks: QualityCheck[] = [];

  if (scheduleGame) {
    checks.push({
      id: "schedule",
      label: "Schedule",
      state: "ok",
      plain: "Schedule verified",
      code: null,
    });
  } else {
    checks.push({
      id: "schedule",
      label: "Schedule",
      state: "missing",
      plain: "Schedule row not found for gamePk",
      code: "SCHEDULE_MISSING",
    });
    codes.push("SCHEDULE_MISSING");
  }

  const starterWarn = warnings.filter((w) => /STARTER/i.test(w));
  if (!pred) {
    checks.push({
      id: "starter",
      label: "Starter",
      state: "missing",
      plain: "Starter status unknown",
      code: "STARTER_UNKNOWN",
    });
  } else if (starterWarn.length > 0) {
    checks.push({
      id: "starter",
      label: "Starter",
      state: "warn",
      plain: starterWarn.map(plainWarning).join("; "),
      code: starterWarn[0] ?? null,
    });
  } else {
    checks.push({
      id: "starter",
      label: "Starter",
      state: "ok",
      plain: "Starter available",
      code: null,
    });
  }

  if (hasOdds) {
    checks.push({
      id: "odds",
      label: "Odds",
      state: "ok",
      plain: "Odds collected",
      code: null,
    });
  } else {
    checks.push({
      id: "odds",
      label: "Odds",
      state: "warn",
      plain: "Odds not clearly present on prediction row",
      code: "ODDS_UNCLEAR",
    });
    codes.push("ODDS_UNCLEAR");
  }

  if (warnings.some((w) => /LINEUP_NOT_CONFIRMED/i.test(w))) {
    checks.push({
      id: "lineup",
      label: "Lineup",
      state: "warn",
      plain: "Lineup not confirmed",
      code: "LINEUP_NOT_CONFIRMED",
    });
  } else {
    checks.push({
      id: "lineup",
      label: "Lineup",
      state: "ok",
      plain: "Lineup confirmed (or no warning)",
      code: null,
    });
  }

  if (warnings.some((w) => /BULLPEN_WEIGHT_DISABLED/i.test(w))) {
    checks.push({
      id: "bullpen",
      label: "Bullpen",
      state: "warn",
      plain: "Bullpen weight disabled",
      code: "BULLPEN_WEIGHT_DISABLED_V0",
    });
  } else {
    checks.push({
      id: "bullpen",
      label: "Bullpen",
      state: "ok",
      plain: "Bullpen not flagged disabled",
      code: null,
    });
  }

  let overall: MlbGameDetailView["dataQuality"]["overall"] = "UNKNOWN";
  if (inputStatus === "BLOCKED") overall = "BLOCKED";
  else if (inputStatus === "LIMITED_INPUT") overall = "LIMITED_INPUT";
  else if (inputStatus === "ELIGIBLE" || inputStatus === "FULL_INPUT")
    overall = "FULL_INPUT";

  return { overall, checks, codes: [...new Set(codes)] };
}

function buildModelMarketNarrative(input: {
  homeTeam: string;
  awayTeam: string;
  pickSide: "HOME" | "AWAY" | null;
  pickTeam: string | null;
  modelHome: number | null;
  marketHome: number | null;
  edgeScore: number | null;
}): string {
  const { pickSide, pickTeam, homeTeam, modelHome, marketHome, edgeScore } =
    input;
  if (!pickSide || modelHome == null || marketHome == null) {
    return "모델·시장 비교에 필요한 확률이 Artifact에 충분하지 않습니다.";
  }
  const team = pickTeam ?? (pickSide === "HOME" ? homeTeam : input.awayTeam);
  const modelPick =
    pickSide === "HOME" ? modelHome : Number((100 - modelHome).toFixed(3));
  const marketPick =
    pickSide === "HOME" ? marketHome : Number((100 - marketHome).toFixed(3));
  const delta = Number((modelPick - marketPick).toFixed(3));
  const absEdge =
    edgeScore != null ? Math.abs(edgeScore) : Math.abs(delta);

  if (delta < -0.5) {
    return `YANG EDGE는 ${team} 승 가능성을 더 높게 보지만, 시장보다 ${absEdge}% 낮게 평가해 가격 매력은 부족하다고 판단했습니다. (기존 edge 의미 변경 없음 · 연구 해석)`;
  }
  if (delta > 0.5) {
    return `YANG EDGE는 ${team} 쪽에 시장보다 ${absEdge}% 높은 확률을 부여했습니다. 연구용 비교이며 공식 추천이 아닙니다.`;
  }
  return `YANG EDGE와 시장의 ${team} 평가가 비슷합니다 (차이 ${delta}pp). 연구용 비교입니다.`;
}

function emptyView(
  dateKst: string,
  gamePk: number,
  error: string,
): MlbGameDetailView {
  return {
    schemaVersion: MLB_GAME_DETAIL_UX_SCHEMA,
    dateKst,
    gamePk,
    loaded: false,
    error,
    headline: {
      matchupLine: "—",
      awayTeam: "—",
      homeTeam: "—",
      startTimeKst: null,
      commenceTimeUtc: null,
      gameStatus: "UNKNOWN",
      researchPredictionTeam: null,
      researchPredictionSide: null,
      modelProbabilityPercent: null,
      marketProbabilityPercent: null,
      officialStatus: "UNKNOWN",
      officialStatusPlain: "경기 Artifact를 불러오지 못했습니다.",
      oneLiner: error,
    },
    modelVsMarket: {
      rows: [],
      pickSide: null,
      edgeScore: null,
      narrative: "데이터 없음",
    },
    factors: [],
    dataQuality: {
      overall: "UNKNOWN",
      overallPlain: "UNKNOWN",
      checks: [],
      advancedCodes: [],
    },
    postgame: null,
    expectedLineup: null,
    marketPanels: {
      model: {
        available: false,
        awayTeam: "—",
        homeTeam: "—",
        awayModelProbability: null,
        homeModelProbability: null,
        sourceLabel: "MODEL",
      },
      provider: {
        available: false,
        sourceLabel: "Provider Market",
        awayTeam: "—",
        homeTeam: "—",
        awayOdds: null,
        homeOdds: null,
        awayImpliedProbability: null,
        homeImpliedProbability: null,
      },
      korean: {
        available: false,
        sourceLabel: "Korean Market",
        marketContext: "KOREAN_MARKET",
        observationStatus: null,
        awayTeam: "—",
        homeTeam: "—",
        awayOdds: null,
        homeOdds: null,
        awayImpliedProbability: null,
        homeImpliedProbability: null,
      },
    },
    advanced: {
      gameId: null,
      gamePk,
      predictionHash: null,
      gradedHash: null,
      reviewHash: null,
      schemaHints: [],
      artifactPaths: [],
      rawWarningCodes: [],
    },
  };
}

/**
 * Read-only game detail join. Never writes artifacts / prediction / engine.
 */
export async function loadMlbGameDetailUxV1(input: {
  dateKst: string;
  gamePk: number;
  cwd?: string;
}): Promise<MlbGameDetailView> {
  const cwd = input.cwd ?? process.cwd();
  const { dateKst, gamePk } = input;
  if (!Number.isFinite(gamePk) || gamePk <= 0) {
    return emptyView(dateKst, gamePk, "잘못된 gamePk입니다.");
  }

  const researchDir = path.join(cwd, "data", "research", "mlb");
  const predPath = path.join(cwd, "data", "predictions", "mlb", `${dateKst}.json`);
  const schedulePath = path.join(researchDir, `${dateKst}-schedule-v1.json`);
  const gradedPath = path.join(
    researchDir,
    `${dateKst}-graded-predictions-v1.json`,
  );
  const successPath = path.join(researchDir, `${dateKst}-success-review-v1.json`);
  const failurePath = path.join(researchDir, `${dateKst}-failure-review-v1.json`);
  const dailyPath = path.join(
    researchDir,
    `${dateKst}-daily-review-summary-v1.json`,
  );
  const resultsPath = path.join(
    researchDir,
    `${dateKst}-official-results-v1.json`,
  );

  const predictionDoc = await readJson<{
    meta?: Record<string, unknown>;
    predictions?: Array<Record<string, unknown>>;
  }>(predPath);
  const scheduleDoc = await readJson<{
    games?: Array<Record<string, unknown>>;
  }>(schedulePath);
  const gradedDoc = await readJson<{
    predictionHash?: string;
    games?: Array<Record<string, unknown>>;
  }>(gradedPath);
  const successDoc = await readJson<{
    reviewHash?: string;
    games?: Array<Record<string, unknown>>;
  }>(successPath);
  const failureDoc = await readJson<{
    reviewHash?: string;
    games?: Array<Record<string, unknown>>;
  }>(failurePath);
  const dailyDoc = await readJson<{
    hashes?: { predictionHash?: string; gradedHash?: string };
  }>(dailyPath);
  const resultsDoc = await readJson<{
    games?: Array<Record<string, unknown>>;
  }>(resultsPath);

  const scheduleGame =
    scheduleDoc?.games?.find((g) => asNumber(g.gamePk) === gamePk) ?? null;
  const gradedGame =
    gradedDoc?.games?.find((g) => asNumber(g.gamePk) === gamePk) ?? null;
  const resultGame =
    resultsDoc?.games?.find((g) => asNumber(g.gamePk) === gamePk) ?? null;

  const gameId =
    asString(gradedGame?.gameId) ??
    asString(scheduleGame?.internalGameId) ??
    null;

  const pred =
    (gameId &&
      predictionDoc?.predictions?.find((p) => asString(p.gameId) === gameId)) ||
    predictionDoc?.predictions?.find((p) => {
      const home = asString(p.homeTeam);
      const away = asString(p.awayTeam);
      return (
        home === asString(scheduleGame?.homeTeam) &&
        away === asString(scheduleGame?.awayTeam)
      );
    }) ||
    null;

  if (!scheduleGame && !pred && !gradedGame) {
    return emptyView(
      dateKst,
      gamePk,
      `gamePk ${gamePk}에 대한 Schedule/Prediction/Graded Artifact를 찾지 못했습니다.`,
    );
  }

  const homeTeam =
    asString(pred?.homeTeam) ??
    asString(scheduleGame?.homeTeam) ??
    "Home";
  const awayTeam =
    asString(pred?.awayTeam) ??
    asString(scheduleGame?.awayTeam) ??
    "Away";

  const markets = Array.isArray(pred?.marketPredictions)
    ? pred!.marketPredictions
    : [];
  const ml = asRecord(
    markets.find(
      (m) => asString(asRecord(m)?.marketType) === "MONEYLINE_2WAY",
    ),
  );

  const modelHome = pct(asNumber(ml?.homeProbability), 3);
  const modelAway = pct(asNumber(ml?.awayProbability), 3);
  const marketHome = pct(asNumber(ml?.marketHomeProbability), 3);
  const marketAway = pct(asNumber(ml?.marketAwayProbability), 3);

  const pickSideRaw =
    asString(gradedGame?.pick) ??
    asString(asRecord(ml?.researchBaseline)?.selection) ??
    null;
  const pickSide =
    pickSideRaw === "HOME" || pickSideRaw === "AWAY" ? pickSideRaw : null;
  const pickTeam =
    asString(gradedGame?.pickTeam) ??
    asString(pred?.baselinePick) ??
    asString(asRecord(pred?.researchBaseline)?.pick) ??
    null;

  const modelPickPct =
    pickSide === "HOME"
      ? modelHome
      : pickSide === "AWAY"
        ? modelAway
        : modelHome;
  const marketPickPct =
    pickSide === "HOME"
      ? marketHome
      : pickSide === "AWAY"
        ? marketAway
        : marketHome;

  const edgeScore = asNumber(pred?.edgeScore) ?? asNumber(pred?.valueEdge);

  let officialStatus: MlbGameDetailView["headline"]["officialStatus"] =
    "UNKNOWN";
  const officialPick = pred?.officialPick;
  const officialStatusRaw = asString(pred?.officialStatus);
  if (officialPick != null && officialPick !== "") officialStatus = "PICK";
  else if (officialStatusRaw === "BLOCKED" || asString(pred?.inputStatus) === "BLOCKED")
    officialStatus = "BLOCKED";
  else if (pred?.researchOnly === true || asString(pred?.purchaseReason))
    officialStatus = "RESEARCH_ONLY";
  else if (officialStatusRaw === "PASS") officialStatus = "PASS";
  else if (officialStatusRaw) officialStatus = "PASS";

  const officialStatusPlain =
    officialStatus === "RESEARCH_ONLY"
      ? "공식 Pick 없음 · RESEARCH_ONLY (연구 예측이며 공식 추천이 아닙니다)"
      : officialStatus === "PASS"
        ? "공식 상태 PASS · 공식 추천 Pick이 아닙니다"
        : officialStatus === "BLOCKED"
          ? "공식 상태 BLOCKED"
          : officialStatus === "PICK"
            ? "공식 Pick 있음"
            : "공식 상태 UNKNOWN";

  const statusAbstract =
    asString(scheduleGame?.statusAbstract) ??
    asString(resultGame?.status) ??
    "UNKNOWN";
  const startTimeKst = asString(pred?.startTimeKst) ?? asString(scheduleGame?.startTimeKst);
  const commenceTimeUtc =
    asString(scheduleGame?.commenceTimeUtc) ??
    asString(scheduleGame?.scheduledStartTime);

  const oneLiner =
    pickTeam && modelPickPct != null
      ? `연구 예측은 ${pickTeam} 방향(${modelPickPct}%)입니다. ${officialStatusPlain}`
      : `연구 예측 정보를 일부만 확인했습니다. ${officialStatusPlain}`;

  const rows: SideProbRow[] = [
    {
      side: "HOME",
      team: homeTeam,
      modelProbability: modelHome,
      marketProbability: marketHome,
      difference: diffPp(modelHome, marketHome),
    },
    {
      side: "AWAY",
      team: awayTeam,
      modelProbability: modelAway,
      marketProbability: marketAway,
      difference: diffPp(modelAway, marketAway),
    },
  ];

  const hasOdds =
    marketHome != null ||
    asNumber(pred?.latestOdds) != null ||
    asNumber(pred?.marketProbability) != null;

  const quality = buildQualityChecks(pred, scheduleGame, hasOdds);
  const overallPlain =
    quality.overall === "LIMITED_INPUT"
      ? "종합 입력 상태: LIMITED_INPUT — 연구용으로만 해석하세요."
      : quality.overall === "FULL_INPUT"
        ? "종합 입력 상태: FULL_INPUT"
        : quality.overall === "BLOCKED"
          ? "종합 입력 상태: BLOCKED"
          : "종합 입력 상태: UNKNOWN";

  // Postgame / review
  const failureGame =
    (gameId &&
      failureDoc?.games?.find((g) => asString(g.gameId) === gameId)) ||
    failureDoc?.games?.find((g) => asNumber(g.gamePk) === gamePk) ||
    null;
  const successGame =
    (gameId &&
      successDoc?.games?.find((g) => asString(g.gameId) === gameId)) ||
    successDoc?.games?.find((g) => asNumber(g.gamePk) === gamePk) ||
    null;

  const homeScore =
    asNumber(gradedGame?.homeScore) ?? asNumber(resultGame?.homeScore);
  const awayScore =
    asNumber(gradedGame?.awayScore) ?? asNumber(resultGame?.awayScore);
  const actualSide = asString(gradedGame?.actualWinner) ?? asString(resultGame?.winner);
  const grade =
    asString(gradedGame?.grade) ??
    asString(asRecord(gradedGame?.researchGrade)?.result) ??
    null;
  const researchGrade = asRecord(gradedGame?.researchGrade);

  let postgame: MlbGameDetailView["postgame"] = null;
  if (grade === "CORRECT" || grade === "INCORRECT" || (homeScore != null && awayScore != null)) {
    const reviewRow = failureGame ?? successGame;
    const cats = Array.isArray(reviewRow?.failureCategories)
      ? (reviewRow!.failureCategories as string[])
      : Array.isArray(reviewRow?.successCategories)
        ? (reviewRow!.successCategories as string[])
        : [];
    const causes = Array.isArray(reviewRow?.possibleCauses)
      ? (reviewRow!.possibleCauses as Array<Record<string, unknown>>)
      : Array.isArray(reviewRow?.whyCorrect)
        ? (reviewRow!.whyCorrect as Array<Record<string, unknown>>)
        : [];

    const toCandidate = (
      code: string,
      role: "primary" | "secondary",
    ): ReviewCandidate => {
      const evidence =
        asString(causes.find((c) => asString(c.category) === code)?.evidence) ??
        null;
      const label =
        failureGame != null ? failureCauseLabel(code) : successCauseLabel(code);
      return {
        code,
        label,
        role,
        evidence,
        plain: reviewCandidatePlain(code, role),
      };
    };

    const primaryCandidates =
      cats[0] != null ? [toCandidate(cats[0], "primary")] : [];
    const secondaryCandidates = cats
      .slice(1)
      .map((c) => toCandidate(c, "secondary"));

    const winnerTeam =
      actualSide === "HOME"
        ? homeTeam
        : actualSide === "AWAY"
          ? awayTeam
          : null;

    const scoreLine =
      homeScore != null && awayScore != null
        ? `${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}`
        : "최종 점수 없음";

    // Prefer readable score for acceptance: "Toronto 5, Houston 4"
    const scoreLineTeams =
      homeScore != null && awayScore != null
        ? actualSide === "AWAY"
          ? `${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}`
          : `${homeTeam} ${homeScore}, ${awayTeam} ${awayScore}`
        : scoreLine;

    postgame = {
      available: true,
      homeScore,
      awayScore,
      scoreLine: scoreLineTeams,
      actualWinnerTeam: winnerTeam,
      actualWinnerSide: actualSide,
      researchGrade: grade ?? asString(researchGrade?.result) ?? "UNKNOWN",
      brierScore: asNumber(researchGrade?.brierScore),
      logLoss: asNumber(researchGrade?.logLoss),
      primaryCandidates,
      secondaryCandidates,
      reviewSummary:
        asString(reviewRow?.unexpectedOutcome) ??
        asString(reviewRow?.counterInterpretation) ??
        (grade === "CORRECT"
          ? "연구 예측 방향이 실제 승자와 일치했습니다. 인과 증명으로 해석하지 마세요."
          : "연구 예측 방향이 실제 승자와 달랐습니다. 아래는 확정 원인이 아닌 복기 후보입니다."),
      reviewConclusion:
        asString(reviewRow?.conclusion) === "INVESTIGATE_MORE"
          ? "결론: INVESTIGATE_MORE — 추가 조사 권장 (확정 원인 단정 금지)"
          : asString(reviewRow?.conclusion)
            ? `결론: ${asString(reviewRow?.conclusion)} (연구 복기 · 확정 원인 아님)`
            : grade === "CORRECT"
              ? "결론: 성공 케이스 관찰 (observation · Engine 변경 근거 아님)"
              : "결론: 복기 후보만 기록 (POSSIBLE / observationOnly 가능)",
      observationOnly: researchGrade?.observationOnly === true,
      conclusionCode: asString(reviewRow?.conclusion),
    };
  }

  const lineupPath = path.join(researchDir, `${dateKst}-lineup-dataset-v1.json`);
  const lineupDoc = await readJson<unknown>(lineupPath);
  const providerStatus = readProviderLineupCollectionStatus(lineupDoc, gamePk);
  const expectedLineup = await loadMlbExpectedLineupGameDetailPanel({
    dateKst,
    gamePk,
    cwd,
    providerCollectionStatus: providerStatus,
  });

  const oddsHistoryPath = path.join(
    researchDir,
    `${dateKst}-odds-history-dataset-v1.json`,
  );
  const oddsHistoryDoc = await readJson<unknown>(oddsHistoryPath);
  const providerMarket = readProviderMarketPanelFromOddsHistory(
    oddsHistoryDoc,
    gamePk,
    awayTeam,
    homeTeam,
    gameId,
  );
  const koreanMarket = await loadMlbKoreanMarketPanelForGame({
    dateKst,
    gamePk,
    cwd,
  });
  const marketPanels: MlbGameDetailView["marketPanels"] = {
    model: {
      available: modelHome != null || modelAway != null,
      awayTeam,
      homeTeam,
      awayModelProbability: modelAway,
      homeModelProbability: modelHome,
      sourceLabel: "MODEL · prediction snapshot",
    },
    provider: providerMarket,
    korean: koreanMarket,
  };

  return {
    schemaVersion: MLB_GAME_DETAIL_UX_SCHEMA,
    dateKst,
    gamePk,
    loaded: true,
    error: null,
    headline: {
      matchupLine: `${abbreviateTeamName(awayTeam)} @ ${abbreviateTeamName(homeTeam)}`,
      awayTeam,
      homeTeam,
      startTimeKst,
      commenceTimeUtc,
      gameStatus: statusAbstract,
      researchPredictionTeam: pickTeam,
      researchPredictionSide: pickSide,
      modelProbabilityPercent: modelPickPct,
      marketProbabilityPercent: marketPickPct,
      officialStatus,
      officialStatusPlain,
      oneLiner,
    },
    modelVsMarket: {
      rows,
      pickSide,
      edgeScore,
      narrative: buildModelMarketNarrative({
        homeTeam,
        awayTeam,
        pickSide,
        pickTeam,
        modelHome,
        marketHome,
        edgeScore,
      }),
    },
    factors: buildFactors(pred),
    dataQuality: {
      overall: quality.overall,
      overallPlain,
      checks: quality.checks,
      advancedCodes: quality.codes,
    },
    postgame,
    expectedLineup,
    marketPanels,
    advanced: {
      gameId,
      gamePk,
      predictionHash:
        asString(dailyDoc?.hashes?.predictionHash) ??
        asString(gradedDoc?.predictionHash) ??
        asString(asRecord(predictionDoc?.meta)?.predictionHashSha256),
      gradedHash: asString(dailyDoc?.hashes?.gradedHash) ?? null,
      reviewHash:
        asString(failureDoc?.reviewHash) ??
        asString(successDoc?.reviewHash) ??
        null,
      schemaHints: [
        asString(asRecord(predictionDoc?.meta)?.schemaVersion) ?? "",
        asString(asRecord(predictionDoc?.meta)?.modelVersion) ?? "",
        "mlb-game-detail-ux-v1",
      ].filter(Boolean),
      artifactPaths: [
        `data/predictions/mlb/${dateKst}.json`,
        `data/research/mlb/${dateKst}-schedule-v1.json`,
        `data/research/mlb/${dateKst}-odds-history-dataset-v1.json`,
        `data/research/mlb/${dateKst}-graded-predictions-v1.json`,
        `data/research/mlb/${dateKst}-success-review-v1.json`,
        `data/research/mlb/${dateKst}-failure-review-v1.json`,
        `data/research/mlb/${dateKst}-daily-review-summary-v1.json`,
        `data/operator-input/mlb/${dateKst}-expected-lineup-observation-v0.json`,
        `data/operator-input/mlb/${dateKst}-korean-market-odds-observation-v0.json`,
      ],
      rawWarningCodes: quality.codes,
    },
  };
}
