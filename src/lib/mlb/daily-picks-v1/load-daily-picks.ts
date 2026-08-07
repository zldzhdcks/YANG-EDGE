import { readFile } from "node:fs/promises";
import path from "node:path";
import { abbreviateTeamName } from "@/lib/mlb/review-classify-v2";
import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import { failureCauseLabel } from "@/lib/mlb/research-ux-v1/category-labels";
import {
  assessSlateRecommendationProvenance,
  buildEngineRecommendationRecord,
  engineRecommendationRecordRel,
  loadEngineRecommendationRecord,
  sealEngineRecommendationRecordIfAbsent,
  type RecommendationProvenance,
  type SlateProvenanceBanner,
} from "@/lib/mlb/recommendation-provenance-v1";
import {
  passReasonLabel,
  starLabel,
  starsForTier,
  tierFromConfidence,
  tierTitle,
} from "./tiering";
import {
  DAILY_PICKS_SCHEMA,
  type DailyPickCard,
  type DailyPickReasonCode,
  type DailyPickTier,
  type DailyPicksView,
  type TodaysResearchFocus,
} from "./types";

async function readJson<T>(abs: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(abs, "utf8")) as T;
  } catch {
    return null;
  }
}

function collectPassReasons(pred: Record<string, unknown>): DailyPickReasonCode[] {
  const reasons: DailyPickReasonCode[] = [];
  const warnings = Array.isArray(pred.inputWarnings)
    ? pred.inputWarnings.map(String)
    : [];
  const modelProb = asNumber(pred.modelProbability);
  const confidence = asNumber(pred.confidence);
  const edge = asNumber(pred.edgeScore) ?? asNumber(pred.valueEdge);
  const inputStatus = asString(pred.inputStatus);
  const officialStatus = asString(pred.officialStatus);

  if (modelProb != null && Math.abs(modelProb - 50) < 3) {
    reasons.push("COIN_FLIP");
  }
  if (confidence != null && confidence < 50) {
    reasons.push("MODEL_UNCERTAIN");
  }
  if (warnings.some((w) => /LINEUP_NOT_CONFIRMED/i.test(w))) {
    reasons.push("LINEUP_MISSING");
  }
  if (inputStatus === "LIMITED_INPUT" || warnings.some((w) => /INPUT_QUALITY_LIMITED/i.test(w))) {
    reasons.push("INPUT_LIMITED");
  }
  if (edge != null && edge <= -5) {
    reasons.push("MARKET_CONFLICT");
  }
  if (inputStatus === "BLOCKED" || officialStatus === "BLOCKED") {
    reasons.push("BLOCKED");
  }
  if (confidence != null && confidence < 40) {
    reasons.push("LOW_CONFIDENCE");
  }
  if (warnings.some((w) => /STARTER/i.test(w))) {
    reasons.push("STARTER_LIMITED");
  }
  if (
    officialStatus === "PASS" ||
    pred.researchOnly === true ||
    pred.officialPick == null
  ) {
    reasons.push("RESEARCH_ONLY_PASS");
  }

  return [...new Set(reasons)];
}

function reasonChips(pred: Record<string, unknown>, tier: DailyPickTier): string[] {
  const chips: string[] = [];
  const used = Array.isArray(pred.usedFactors)
    ? pred.usedFactors.map(String)
    : [];
  const warnings = Array.isArray(pred.inputWarnings)
    ? pred.inputWarnings.map(String)
    : [];
  const explanations = Array.isArray(pred.explanations)
    ? pred.explanations.map(String)
    : [];

  if (used.includes("startingPitcher") || explanations.some((e) => /STARTER/i.test(e))) {
    chips.push("Starter 신호");
  }
  if (!warnings.some((w) => /LINEUP_NOT_CONFIRMED/i.test(w))) {
    chips.push("Lineup 확인");
  } else if (tier === "STRONG" || tier === "GOOD") {
    chips.push("Lineup 미확정(주의)");
  }
  if (used.includes("marketPrior") || explanations.some((e) => /MARKET/i.test(e))) {
    chips.push("Market 방향");
  }
  if (used.includes("homeAdvantage")) {
    chips.push("Home Advantage");
  }
  if (warnings.some((w) => /BULLPEN_WEIGHT_DISABLED/i.test(w))) {
    chips.push("Bullpen 미연결");
  }
  return chips.slice(0, 4);
}

function buildAiSummary(
  tier: DailyPickTier,
  pred: Record<string, unknown>,
  passReasons: DailyPickReasonCode[],
): string {
  const pick = asString(pred.baselinePick) ?? asString(asRecord(pred.researchBaseline)?.pick);
  const conf = asNumber(pred.confidence);
  if (tier === "STRONG") {
    return `${pick ?? "이 경기"}는 오늘 스냅샷 기준 가장 안정적인 Strong Pick 후보입니다. Confidence ${conf ?? "—"} · 공식 추천이 아닌 연구 표현입니다.`;
  }
  if (tier === "GOOD") {
    return `${pick ?? "이 경기"}는 Good Pick 구간입니다. 추가 확인 후 활용하세요 (RESEARCH_ONLY).`;
  }
  if (tier === "LEAN") {
    return `${pick ?? "이 경기"}는 Lean 수준입니다. 확신이 낮아 공격적 추천 대상이 아닙니다.`;
  }
  if (tier === "AVOID") {
    return `Confidence/입력이 약해 Avoid로 표시합니다. 추천하지 않습니다.`;
  }
  const labels = passReasons.map(passReasonLabel).slice(0, 3).join(", ");
  return `PASS — ${labels || "조건 미충족"}. 무리한 추천을 하지 않습니다.`;
}

function buildResearchFocus(input: {
  failureCategoryCount: Record<string, number> | null;
  warningCounts: Record<string, number>;
  researchMissing: string[];
}): TodaysResearchFocus {
  const fail = input.failureCategoryCount;
  if (fail && Object.keys(fail).length > 0) {
    const top = Object.entries(fail).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const [code] = top;
      const label = failureCauseLabel(code);
      return {
        title: "Today's Research",
        focus: label,
        plain: `오늘 복기·검증 초점은 ${label}입니다. Review 태그 빈도를 기준으로 표시했습니다 (확정 원인 아님).`,
        source: "failure-review / daily-review-summary",
      };
    }
  }

  const warnTop = Object.entries(input.warningCounts).sort((a, b) => b[1] - a[1])[0];
  if (warnTop) {
    const [code] = warnTop;
    if (/BULLPEN/i.test(code)) {
      return {
        title: "Today's Research",
        focus: "Bullpen 영향",
        plain: "Today's Research — Bullpen 영향 집중 확인. 불펜 가중치가 비활성인 경기가 많습니다.",
        source: "prediction.inputWarnings",
      };
    }
    if (/LINEUP/i.test(code)) {
      return {
        title: "Today's Research",
        focus: "Lineup 영향",
        plain: "Today's Research — Lineup 영향 집중 검증. 확정 라인업 공백을 우선 확인하세요.",
        source: "prediction.inputWarnings",
      };
    }
  }

  if (input.researchMissing.includes("Odds")) {
    return {
      title: "Today's Research",
      focus: "Odds Coverage",
      plain: "Research Ready에 Odds 공백이 있습니다. 배당 수집 상태를 먼저 확인하세요.",
      source: "daily-research-summary",
    };
  }

  return {
    title: "Today's Research",
    focus: "Input Quality",
    plain: "오늘은 입력 품질·PASS 사유를 중심으로 운영 점검을 권장합니다.",
    source: "daily-picks-presenter",
  };
}

function buildCtoCommentary(input: {
  strong: number;
  good: number;
  pass: number;
  researchFocus: string;
  researchReady: number | null;
  engineRecommendations: boolean;
  reconstructed: number;
}): string {
  const lines: string[] = [];
  if (!input.engineRecommendations) {
    lines.push(
      "오늘 YANG EDGE 엔진 추천(ENGINE_SNAPSHOT)이 없습니다. 강제 승격으로 픽 수를 채우지 않습니다.",
    );
  } else if (input.strong + input.good === 0) {
    lines.push("오늘 YANG EDGE 추천 없음 — Strong/Good 구간에 해당하는 경기가 없습니다.");
  } else {
    if (input.strong > 0) {
      lines.push(
        `오늘 Strong Pick은 ${input.strong}경기입니다 (ENGINE_SNAPSHOT).`,
      );
    } else {
      lines.push("오늘 Strong Pick(Confidence ≥ 80)은 없습니다. 무리한 최고 등급을 만들지 않았습니다.");
    }
    if (input.good > 0) {
      lines.push(`Good Pick ${input.good}경기는 ENGINE_SNAPSHOT 기반 연구 추천입니다.`);
    }
  }
  if (input.reconstructed > 0) {
    lines.push(
      `RECONSTRUCTED ${input.reconstructed}경기는 당시 전달 기록이 없어 추천·성적에 포함하지 않습니다.`,
    );
  }
  lines.push(
    `PASS ${input.pass}경기는 Coin Flip·Lineup Missing·Input Limited·Market Conflict 등 사유로 추천하지 않습니다.`,
  );
  lines.push(`오늘은 ${input.researchFocus} 여부를 집중적으로 확인합니다.`);
  if (input.researchReady != null) {
    lines.push(`Research Ready ${input.researchReady}%.`);
  }
  return lines.join(" ");
}

function emptyProvenanceBanner(dateKst: string): SlateProvenanceBanner {
  return {
    status: "NO_PREGAME_SNAPSHOT",
    predictionStatusLine: "✗ NO_PREGAME_SNAPSHOT",
    snapshotDate: null,
    generatedLine: "Snapshot 없음",
    predictionHash: null,
    predictionHashShort: null,
    recommendationSourceLine: "NO SNAPSHOT — YANG EDGE 추천 없음",
    hashVerified: false,
    generatedBeforeGame: null,
    allowEngineRecommendations: false,
  };
}

function makeProvenance(input: {
  sourceType: RecommendationProvenance["sourceType"];
  dateKst: string;
  predictionHash: string | null;
  snapshotCreatedAt: string | null;
  generatedBeforeGame: boolean | null;
  predictionContract: string | null;
  pickTier: string | null;
  researchOnly: boolean;
  inputStatus: string | null;
}): RecommendationProvenance {
  const userRecommendationEligible = input.sourceType === "ENGINE_SNAPSHOT";
  const recordEligible =
    input.sourceType === "ENGINE_SNAPSHOT" &&
    input.generatedBeforeGame === true;
  return {
    sourceType: input.sourceType,
    predictionDate: input.dateKst,
    predictionHash: input.predictionHash,
    snapshotCreatedAt: input.snapshotCreatedAt,
    generatedBeforeGame: input.generatedBeforeGame,
    predictionContract: input.predictionContract,
    pickTier: input.pickTier,
    researchOnly: input.researchOnly,
    inputStatus: input.inputStatus,
    userRecommendationEligible,
    recordEligible,
  };
}

/**
 * Daily Picks load. Never mutates Prediction / Engine artifacts.
 * May seal immutable ENGINE recommendation delivery records (separate path).
 */
export async function loadDailyPicksV1(input: {
  dateKst: string;
  cwd?: string;
  /** When false, do not write delivery records (tests). Default true. */
  sealDeliveryRecord?: boolean;
}): Promise<DailyPicksView> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const sealDelivery = input.sealDeliveryRecord !== false;
  const predPath = path.join(cwd, "data", "predictions", "mlb", `${dateKst}.json`);
  const schedulePath = path.join(
    cwd,
    "data",
    "research",
    "mlb",
    `${dateKst}-schedule-v1.json`,
  );
  const researchSummaryPath = path.join(
    cwd,
    "data",
    "research",
    "mlb",
    `${dateKst}-daily-research-summary-v1.json`,
  );
  const reviewSummaryPath = path.join(
    cwd,
    "data",
    "research",
    "mlb",
    `${dateKst}-daily-review-summary-v1.json`,
  );

  const provenanceBanner = await assessSlateRecommendationProvenance({
    dateKst,
    cwd,
  });

  const prediction = await readJson<{
    meta?: Record<string, unknown>;
    summary?: Record<string, unknown>;
    predictions?: Array<Record<string, unknown>>;
  }>(predPath);
  const schedule = await readJson<{
    games?: Array<Record<string, unknown>>;
  }>(schedulePath);
  const researchSummary = await readJson<{
    researchReady?: { percent?: number; missing?: string[] };
  }>(researchSummaryPath);
  const reviewSummary = await readJson<{
    failureCategoryCount?: Record<string, number>;
  }>(reviewSummaryPath);

  const emptyHero = {
    dateKst,
    totalGames: 0,
    recommendCount: 0,
    passCount: 0,
    researchReadyPercent: researchSummary?.researchReady?.percent ?? null,
  };

  const emptyBase = {
    schemaVersion: DAILY_PICKS_SCHEMA,
    dateKst,
    hero: emptyHero,
    provenanceBanner,
    strongPicks: [] as DailyPickCard[],
    goodPicks: [] as DailyPickCard[],
    reconstructedPicks: [] as DailyPickCard[],
    leanPicks: [] as DailyPickCard[],
    passGames: [] as DailyPickCard[],
    avoidGames: [] as DailyPickCard[],
    predictionHash: provenanceBanner.predictionHash,
    engineRecommendationRecordPath: null as string | null,
  };

  // Continuity: never substitute another date's snapshot.
  const metaDate = asString(prediction?.meta?.dateKst);
  if (prediction && metaDate && metaDate !== dateKst) {
    return {
      ...emptyBase,
      loaded: false,
      error: `DATE_MISMATCH: Snapshot meta.dateKst=${metaDate} ≠ requested ${dateKst}. 전날 Snapshot 대체 표시 금지.`,
      todaysResearch: {
        title: "Today's Research",
        focus: "Date Continuity Guard",
        plain: "요청 날짜와 Snapshot 날짜가 다릅니다. 다른 날짜 Artifact로 대체하지 않습니다.",
        source: "daily-picks-continuity",
      },
      ctoCommentary:
        "Daily Picks는 해당 날짜 Snapshot만 읽습니다. 전날 Snapshot 대체 표시는 금지됩니다.",
      sourcePaths: [`data/predictions/mlb/${dateKst}.json`],
    };
  }

  if (!prediction?.predictions?.length) {
    return {
      ...emptyBase,
      provenanceBanner: emptyProvenanceBanner(dateKst),
      loaded: false,
      error: `NO_PREGAME_SNAPSHOT: Prediction Snapshot이 없습니다 (data/predictions/mlb/${dateKst}.json). 전날 Snapshot으로 대체하지 않습니다.`,
      todaysResearch: {
        title: "Today's Research",
        focus: "Waiting for Prediction",
        plain: "오늘 Prediction Snapshot이 아직 없습니다. Pregame 수집 후 Daily Picks를 다시 열어주세요.",
        source: "missing-prediction",
      },
      ctoCommentary:
        "NO_PREGAME_SNAPSHOT — YANG EDGE 추천을 생성하지 않습니다. 사후 재구성 추천도 금지합니다.",
      sourcePaths: [
        `data/predictions/mlb/${dateKst}.json`,
        `data/research/mlb/${dateKst}-daily-research-summary-v1.json`,
      ],
    };
  }

  const meta = asRecord(prediction.meta) ?? {};
  const predictionHash = asString(meta.predictionHashSha256);
  const snapshotCreatedAt = asString(meta.generatedAt);
  const predictionContract =
    asString(meta.modelStatus) ?? "RESEARCH_BASELINE_V0";

  const sourceTypeForTier = (
    tier: DailyPickTier,
  ): RecommendationProvenance["sourceType"] => {
    if (provenanceBanner.status === "NO_PREGAME_SNAPSHOT") {
      return "NO_PREGAME_SNAPSHOT";
    }
    if (
      (tier === "STRONG" || tier === "GOOD") &&
      provenanceBanner.allowEngineRecommendations
    ) {
      return "ENGINE_SNAPSHOT";
    }
    if (tier === "STRONG" || tier === "GOOD") {
      // Snapshot may be valid but delivery epoch / seal not allowed → reconstructed
      return "RECONSTRUCTED";
    }
    return provenanceBanner.allowEngineRecommendations
      ? "ENGINE_SNAPSHOT"
      : "RECONSTRUCTED";
  };

  const gamePkById = new Map<string, number>();
  for (const g of schedule?.games ?? []) {
    const id = asString(g.internalGameId);
    const pk = asNumber(g.gamePk);
    if (id && pk != null) gamePkById.set(id, pk);
  }

  const warningCounts: Record<string, number> = {};
  const drafted: DailyPickCard[] = [];

  for (const pred of prediction.predictions) {
    const gameId = asString(pred.gameId) ?? "";
    const home = asString(pred.homeTeam) ?? "Home";
    const away = asString(pred.awayTeam) ?? "Away";
    const confidence = asNumber(pred.confidence);
    let tier = tierFromConfidence(confidence);
    const passReasons = collectPassReasons(pred);

    // Coin-flip / blocked never stay in Strong/Good recommend buckets
    // Never promote lower tiers to fill a quota of 3.
    if (
      (tier === "STRONG" || tier === "GOOD") &&
      (passReasons.includes("COIN_FLIP") ||
        passReasons.includes("BLOCKED") ||
        passReasons.includes("LOW_CONFIDENCE"))
    ) {
      tier = "PASS";
    }

    const stars = starsForTier(tier);
    const gamePk = gamePkById.get(gameId) ?? null;
    const pickTeam =
      asString(pred.baselinePick) ??
      asString(asRecord(pred.researchBaseline)?.pick);
    const ml = asRecord(
      (Array.isArray(pred.marketPredictions) ? pred.marketPredictions : []).find(
        (m) => asString(asRecord(m)?.marketType) === "MONEYLINE_2WAY",
      ),
    );
    const sel = asString(asRecord(ml?.researchBaseline)?.selection);
    const pickSide = sel === "HOME" || sel === "AWAY" ? sel : null;
    const researchOnly = pred.researchOnly === true || pred.officialPick == null;
    const inputStatus = asString(pred.inputStatus);
    const src = sourceTypeForTier(tier);

    for (const w of Array.isArray(pred.inputWarnings) ? pred.inputWarnings.map(String) : []) {
      warningCounts[w] = (warningCounts[w] ?? 0) + 1;
    }

    drafted.push({
      gameId,
      gamePk,
      detailHref:
        gamePk != null
          ? `/internal/research/mlb/${gamePk}?date=${encodeURIComponent(dateKst)}`
          : null,
      tier,
      stars,
      starLabel: `${starLabel(stars)} ${tierTitle(tier)}`,
      matchupLine: `${abbreviateTeamName(away)} @ ${abbreviateTeamName(home)}`,
      pickTeam,
      pickSide,
      modelProbabilityPercent: asNumber(pred.modelProbability),
      confidence,
      reasonChips: reasonChips(pred, tier),
      passReasons,
      passReasonLabels: passReasons.map(passReasonLabel),
      aiSummary: buildAiSummary(tier, pred, passReasons),
      researchOnly,
      inputStatus,
      provenance: makeProvenance({
        sourceType: src,
        dateKst,
        predictionHash,
        snapshotCreatedAt,
        generatedBeforeGame: provenanceBanner.generatedBeforeGame,
        predictionContract,
        pickTier: tier,
        researchOnly,
        inputStatus,
      }),
    });
  }

  // Cap Strong ≤2, Good ≤3 by confidence then |model-50|
  // Cap is a display max — never promote lower tiers to fill slots.
  const byScore = (a: DailyPickCard, b: DailyPickCard) => {
    const cd = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (cd !== 0) return cd;
    const am = Math.abs((a.modelProbabilityPercent ?? 50) - 50);
    const bm = Math.abs((b.modelProbabilityPercent ?? 50) - 50);
    return bm - am;
  };

  let strongCand = drafted.filter((d) => d.tier === "STRONG").sort(byScore);
  let goodCand = drafted.filter((d) => d.tier === "GOOD").sort(byScore);
  const lean = drafted.filter((d) => d.tier === "LEAN").sort(byScore);
  let pass = drafted.filter((d) => d.tier === "PASS");
  const avoid = drafted.filter((d) => d.tier === "AVOID");

  if (strongCand.length > 2) {
    const overflow = strongCand.slice(2).map((c) => ({
      ...c,
      tier: "GOOD" as const,
      stars: starsForTier("GOOD"),
      starLabel: `${starLabel(starsForTier("GOOD"))} ${tierTitle("GOOD")}`,
    }));
    strongCand = strongCand.slice(0, 2);
    goodCand = [...goodCand, ...overflow].sort(byScore);
  }
  if (goodCand.length > 3) {
    const overflow = goodCand.slice(3).map((c) => ({
      ...c,
      tier: "PASS" as const,
      stars: starsForTier("PASS"),
      starLabel: `${starLabel(starsForTier("PASS"))} ${tierTitle("PASS")}`,
      aiSummary: buildAiSummary("PASS", { baselinePick: c.pickTeam }, c.passReasons),
      provenance: makeProvenance({
        sourceType: "RECONSTRUCTED",
        dateKst,
        predictionHash,
        snapshotCreatedAt,
        generatedBeforeGame: provenanceBanner.generatedBeforeGame,
        predictionContract,
        pickTier: "PASS",
        researchOnly: c.researchOnly,
        inputStatus: c.inputStatus,
      }),
    }));
    goodCand = goodCand.slice(0, 3);
    pass = [...pass, ...overflow];
  }

  // Engine-only guard: only ENGINE_SNAPSHOT enters Strong/Good recommendation areas
  const strongPicks = strongCand.filter(
    (c) => c.provenance.sourceType === "ENGINE_SNAPSHOT",
  );
  const goodPicks = goodCand.filter(
    (c) => c.provenance.sourceType === "ENGINE_SNAPSHOT",
  );
  const reconstructedPicks = [...strongCand, ...goodCand].filter(
    (c) => c.provenance.sourceType === "RECONSTRUCTED",
  );

  let engineRecommendationRecordPath: string | null = null;
  if (
    sealDelivery &&
    provenanceBanner.allowEngineRecommendations &&
    predictionHash &&
    snapshotCreatedAt &&
    provenanceBanner.generatedBeforeGame === true &&
    (strongPicks.length > 0 || goodPicks.length > 0)
  ) {
    const built = buildEngineRecommendationRecord({
      dateKst,
      predictionHash,
      snapshotCreatedAt,
      generatedBeforeGame: true,
      predictionContract,
      strongPicks,
      goodPicks,
    });
    // Enrich inputStatus from cards
    for (const p of built.picks) {
      const card = [...strongPicks, ...goodPicks].find((c) => c.gameId === p.gameId);
      if (card) p.inputStatus = card.inputStatus;
    }
    const sealed = await sealEngineRecommendationRecordIfAbsent({
      dateKst,
      cwd,
      record: built,
    });
    engineRecommendationRecordPath = sealed.pathRel;
  } else {
    const existing = await loadEngineRecommendationRecord({ dateKst, cwd });
    if (existing) {
      engineRecommendationRecordPath = engineRecommendationRecordRel(dateKst);
    }
  }

  const recommendCount = strongPicks.length + goodPicks.length;
  const passCount = pass.length + lean.length + avoid.length;

  const todaysResearch = buildResearchFocus({
    failureCategoryCount: reviewSummary?.failureCategoryCount ?? null,
    warningCounts,
    researchMissing: researchSummary?.researchReady?.missing ?? [],
  });

  const researchReadyPercent =
    researchSummary?.researchReady?.percent ?? null;

  return {
    schemaVersion: DAILY_PICKS_SCHEMA,
    dateKst,
    loaded: true,
    error: null,
    hero: {
      dateKst,
      totalGames: drafted.length,
      recommendCount,
      passCount,
      researchReadyPercent,
    },
    provenanceBanner,
    strongPicks,
    goodPicks,
    reconstructedPicks,
    leanPicks: lean,
    passGames: pass,
    avoidGames: avoid,
    todaysResearch,
    ctoCommentary: buildCtoCommentary({
      strong: strongPicks.length,
      good: goodPicks.length,
      pass: passCount,
      researchFocus: todaysResearch.focus,
      researchReady: researchReadyPercent,
      engineRecommendations: provenanceBanner.allowEngineRecommendations,
      reconstructed: reconstructedPicks.length,
    }),
    predictionHash,
    sourcePaths: [
      `data/predictions/mlb/${dateKst}.json`,
      `data/research/mlb/${dateKst}-schedule-v1.json`,
      `data/research/mlb/${dateKst}-daily-research-summary-v1.json`,
      `data/research/mlb/${dateKst}-daily-review-summary-v1.json`,
    ],
    engineRecommendationRecordPath,
  };
}
