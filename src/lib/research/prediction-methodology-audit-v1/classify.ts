/**
 * Read-only historical prediction classifier.
 * Does not write prediction snapshots, weights, or engine logic.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { detectPredictionContract } from "@/lib/mlb/prediction-contract-v1";
import { MLB_PREDICTION_V0_WEIGHTS } from "@/lib/mlb/prediction-v0/config";
import type {
  ExplainabilityRow,
  FeatureUtilizationRow,
  HistoricalPredictionRow,
  MarketDependenceRow,
  MethodologyClass,
  PredictionMethodologyAuditV1,
} from "./types";
import {
  PREDICTION_METHODOLOGY_AUDIT_V1_BUILDER,
  PREDICTION_METHODOLOGY_AUDIT_V1_SCHEMA,
} from "./types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

async function readJson(abs: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(abs, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function emptyCounts(): Record<MethodologyClass, number> {
  return {
    INDEPENDENT_STATISTICAL: 0,
    LEGACY_HEURISTIC: 0,
    MARKET_ASSISTED: 0,
    MARKET_BASELINE: 0,
    INSUFFICIENT_INPUT: 0,
    BLOCKED: 0,
  };
}

function usedFactorList(predictions: Record<string, unknown>[]): string[] {
  const out: string[] = [];
  for (const p of predictions) {
    for (const f of asArr(p.usedFactors)) {
      if (typeof f === "string" && f.trim()) out.push(f.trim());
    }
  }
  return uniqueSorted(out);
}

function anyComponentMarketPrior(predictions: Record<string, unknown>[]): boolean {
  for (const p of predictions) {
    const comps =
      asRecord(p.components) ??
      asRecord(asArr(p.marketPredictions)[0])?.components ??
      null;
    const rec = asRecord(comps);
    const mp = rec ? asNumber(rec.marketPrior) : null;
    if (mp != null && mp !== 0) return true;
  }
  return false;
}

function classifyMlbSnapshot(args: {
  rel: string;
  doc: Record<string, unknown>;
}): HistoricalPredictionRow {
  const meta = asRecord(args.doc.meta) ?? {};
  const predictions = asArr(args.doc.predictions)
    .map((r) => asRecord(r))
    .filter((r): r is Record<string, unknown> => !!r);
  const summary = asRecord(args.doc.summary) ?? {};
  const date =
    asString(meta.dateKst) ??
    path.basename(args.rel).replace(/\.json$/, "");
  const contract = detectPredictionContract(args.doc);
  const usedFactors = usedFactorList(predictions);
  const officialPickCount =
    asNumber(meta.officialPickCount) ??
    predictions.filter((p) => asString(p.officialPick) != null).length;
  const blockedCount = predictions.filter(
    (p) => asString(p.officialStatus) === "BLOCKED",
  ).length;
  const numberOfGames =
    asNumber(summary.totalGames) ??
    asNumber(summary.total) ??
    predictions.length;
  const predictedGames =
    asNumber(summary.predictedGames) ??
    (typeof summary.PASS === "number" ||
    typeof summary.BASELINE_CANDIDATE === "number"
      ? (asNumber(summary.PASS) ?? 0) +
        (asNumber(summary.BASELINE_CANDIDATE) ?? 0)
      : numberOfGames - blockedCount);

  const marketDisplayed = predictions.some(
    (p) => asNumber(p.marketProbability) != null,
  );
  const starterNamed = usedFactors.some(
    (f) =>
      f === "startingPitcher" ||
      f === "선발투수" ||
      f.includes("STARTER") ||
      f.includes("starter"),
  );
  const hasStarterFeature = predictions.some((p) => {
    const features = asRecord(p.features);
    const home = asRecord(features?.homeStarter);
    const away = asRecord(features?.awayStarter);
    return (
      asString(home?.playerName) != null ||
      asString(away?.playerName) != null
    );
  });

  if (contract === "RESEARCH_BASELINE_V0") {
    const useMarketPrior = asBool(meta.useMarketPrior) !== false;
    const marketInFormula =
      useMarketPrior &&
      MLB_PREDICTION_V0_WEIGHTS.marketPrior.status !== "DISABLED" &&
      (anyComponentMarketPrior(predictions) || useMarketPrior);
    const allBlocked =
      numberOfGames > 0 && blockedCount === numberOfGames;
    const classification: MethodologyClass = allBlocked
      ? "BLOCKED"
      : marketInFormula
        ? "MARKET_ASSISTED"
        : "LEGACY_HEURISTIC";
    return {
      sport: "MLB",
      date,
      artifactRel: args.rel,
      artifactKind: "mlb-research-prediction-snapshot-v1",
      modelVersion: asString(meta.modelVersion),
      modelStatus: asString(meta.modelStatus),
      contract,
      numberOfGames,
      predictedGames,
      officialPickCount,
      actualPredictionInputs: uniqueSorted([
        "starter ERA/WHIP/IP",
        "fixed homeAdvantage",
        ...(marketInFormula ? ["marketPrior (de-vig moneyline logit)"] : []),
        "lineup completeness (weight 0)",
        "bullpen (DISABLED weight 0)",
      ]),
      marketPriorUsed: marketInFormula,
      marketProbabilityDisplayed: marketDisplayed || marketInFormula,
      marketInProbabilityFormula: marketInFormula,
      playerLevelDataUsed: hasStarterFeature || starterNamed,
      lineupPlayerStatsUsed: false,
      starterAdvancedStatsUsed: false,
      bullpenDataUsed: false,
      teamAdvancedStatsUsed: false,
      classification,
      classificationReason: allBlocked
        ? "All games officialStatus=BLOCKED; v0 formula not issued as research baseline."
        : marketInFormula
          ? "mlb-baseline-prediction-v0 logit includes marketPrior * 0.25. Market is a probability input, not display-only. Lineup/bullpen weights are 0. Starter uses ERA/WHIP only. Not an independent sports model."
          : "v0 without marketPrior would still be ERA/WHIP + homeAdvantage heuristic, not an independent statistical model.",
    };
  }

  const teamHeuristicFactors = usedFactors.filter((f) =>
    [
      "최근 폼",
      "득점력",
      "실점 억제",
      "홈/원정 성적",
      "리그 순위",
      "맞대결",
      "휴식일",
    ].includes(f),
  );
  const classification: MethodologyClass =
    numberOfGames > 0 && blockedCount === numberOfGames
      ? "BLOCKED"
      : "LEGACY_HEURISTIC";

  return {
    sport: "MLB",
    date,
    artifactRel: args.rel,
    artifactKind: asString(meta.kind) ?? "mlb-legacy-research-prediction",
    modelVersion:
      asString(meta.modelVersion) ??
      asString(asRecord(meta.sourceSnapshotVersions)?.baseline) ??
      "legacy-edge-engine-rule-v1",
    modelStatus: asString(meta.modelStatus) ?? "LEGACY_V1",
    contract: contract === "UNKNOWN" ? "LEGACY_V1" : contract,
    numberOfGames,
    predictedGames,
    officialPickCount,
    actualPredictionInputs: uniqueSorted([
      "edge-engine rule-v1 weighted factors",
      ...usedFactors,
      ...(marketDisplayed ? ["marketProbability display/valueEdge"] : []),
    ]),
    marketPriorUsed: false,
    marketProbabilityDisplayed: marketDisplayed,
    marketInProbabilityFormula: false,
    playerLevelDataUsed: usedFactors.includes("선발투수") || starterNamed,
    lineupPlayerStatsUsed: false,
    starterAdvancedStatsUsed: false,
    bullpenDataUsed: false,
    teamAdvancedStatsUsed: teamHeuristicFactors.length > 0,
    classification,
    classificationReason:
      classification === "BLOCKED"
        ? "Legacy snapshot games are all BLOCKED."
        : teamHeuristicFactors.length > 0
          ? "Legacy Edge Engine (rule-v1). Market probability is stored for display/valueEdge after the engine run and is not in winProbability. Team heuristics may be present in usedFactors; lineup/bullpen/advanced pitcher stats are not Engine-admitted research features."
          : "Legacy Edge Engine (rule-v1) via prediction consumer. AnalysisData fills starter ERA/WHIP when present; recentForm/scoring/defense/standings/H2H/rest are empty NaN placeholders. injuries and streak are marked available even when empty (score 0). Market is display + valueEdge, not a logit prior.",
  };
}

function classifyFootballSnapshot(args: {
  rel: string;
  doc: Record<string, unknown>;
}): HistoricalPredictionRow {
  const meta = asRecord(args.doc.meta) ?? {};
  const matches = asArr(args.doc.matches);
  const date = asString(meta.dateKst) ?? "";
  const frozen = asNumber(meta.frozenGames) ?? 0;
  return {
    sport: "FOOTBALL",
    date,
    artifactRel: args.rel,
    artifactKind: asString(meta.schemaVersion) ?? "football-prediction-snapshot-v0",
    modelVersion: asString(meta.builderVersion),
    modelStatus: asString(meta.prediction) ?? "NONE",
    contract: "FOOTBALL_PREDICTION_SNAPSHOT_V0",
    numberOfGames: asNumber(meta.scheduleGames) ?? matches.length,
    predictedGames: 0,
    officialPickCount: 0,
    actualPredictionInputs: ["schedule freeze", "1x2 odds freeze"],
    marketPriorUsed: false,
    marketProbabilityDisplayed: frozen > 0,
    marketInProbabilityFormula: false,
    playerLevelDataUsed: false,
    lineupPlayerStatsUsed: false,
    starterAdvancedStatsUsed: false,
    bullpenDataUsed: false,
    teamAdvancedStatsUsed: false,
    classification: "INSUFFICIENT_INPUT",
    classificationReason:
      "football-prediction-snapshot-v0 freezes Schedule + Odds only. meta.prediction=NONE and meta.engine=NONE. This is an input snapshot, not an independent or heuristic probability model.",
  };
}

function classifyFootballMarketBaseline(args: {
  rel: string;
  doc: Record<string, unknown>;
}): HistoricalPredictionRow {
  const meta = asRecord(args.doc.meta) ?? {};
  const matches = asArr(args.doc.matches);
  return {
    sport: "FOOTBALL",
    date: asString(meta.dateKst) ?? "",
    artifactRel: args.rel,
    artifactKind:
      asString(meta.schemaVersion) ?? "football-market-baseline-prediction-v0",
    modelVersion: asString(meta.builderVersion),
    modelStatus: asString(meta.predictionClass) ?? "MARKET_BASELINE",
    contract: "FOOTBALL_MARKET_BASELINE_V0",
    numberOfGames: asNumber(meta.snapshotMatches) ?? matches.length,
    predictedGames: asNumber(meta.baselinePredictedGames),
    officialPickCount: asNumber(meta.officialPickCount) ?? 0,
    actualPredictionInputs: [
      "frozen median de-vig 1x2",
      "ARGMAX_NORMALIZED_MARKET_PROBABILITY",
    ],
    marketPriorUsed: true,
    marketProbabilityDisplayed: true,
    marketInProbabilityFormula: true,
    playerLevelDataUsed: false,
    lineupPlayerStatsUsed: false,
    starterAdvancedStatsUsed: false,
    bullpenDataUsed: false,
    teamAdvancedStatsUsed: false,
    classification: "MARKET_BASELINE",
    classificationReason:
      "Explicit MARKET_BASELINE. baselineProbability is renormalized market probability; baselineOutcome is argmax. model=NONE engine=NONE. No player, lineup, or team sports features enter the pick.",
  };
}

function mlbFeatureRows(): FeatureUtilizationRow[] {
  const row = (
    category: string,
    data: string,
    providerOrSource: string,
    collected: boolean | "UNKNOWN",
    stored: boolean | "UNKNOWN",
    feature: boolean,
    prediction: boolean,
    gap: string,
  ): FeatureUtilizationRow => ({
    sport: "MLB",
    category,
    data,
    providerOrSource,
    collected,
    stored,
    feature,
    prediction,
    stage: prediction
      ? "PREDICTION_USED"
      : feature
        ? "PREGAME_FEATURE"
        : stored === true
          ? "DATASET"
          : collected === true
            ? "PROVIDER_OR_REPO"
            : "NONE",
    gap,
  });

  return [
    row("A. STARTING PITCHER", "ERA", "mlb-stats-api gameLog aggregate → starter-dataset-v1", true, true, true, true, "Used in v0 starterScore and legacy pitcherQuality."),
    row("A. STARTING PITCHER", "WHIP", "mlb-stats-api gameLog aggregate → starter-dataset-v1", true, true, true, true, "Used in v0 starterScore and legacy pitcherQuality."),
    row("A. STARTING PITCHER", "IP / sample shrink", "starter-dataset-v1 inningsPitched", true, true, true, true, "v0 uses IP only to shrink ERA/WHIP toward league average. Not an independent innings model."),
    row("A. STARTING PITCHER", "K / BB (counts)", "starter-dataset-v1 seasonStats.strikeOuts/baseOnBalls; copied onto StarterFeature", true, true, true, false, "Present on StarterFeature; starterScoreFromStats ignores K/BB."),
    row("A. STARTING PITCHER", "throws handedness", "starter-dataset-v1 throws", true, true, true, false, "Stored on StarterFeature; unused in logit."),
    row("A. STARTING PITCHER", "recent starts / pitch count", "starter-dataset-v1 recentStarts", true, true, false, false, "Stored on dataset rows; prediction-v0 does not read recentStarts."),
    row("A. STARTING PITCHER", "FIP / xFIP / xERA", "none in repository types", false, false, false, false, "Not in StarterSeasonStats or prediction features."),
    row("A. STARTING PITCHER", "K% / BB% / K-BB% / HR/9 / GB%", "none as rates; HR count stored", false, false, false, false, "HR count stored on dataset; no rate features; unused in prediction."),
    row("A. STARTING PITCHER", "pitch mix / velocity / pitch value / whiff% / CSW%", "none in repository types", false, false, false, false, "No pitch-tracking types or artifacts."),
    row("B. BATTER", "AVG / OBP / SLG / OPS / ISO / wOBA / wRC+", "none in repository types", false, false, false, false, "No batter-stat dataset. Lineup stores identity/slot/position only."),
    row("B. BATTER", "K% / BB% / vs LHP / vs RHP / recent form", "none in repository types", false, false, false, false, "Absent."),
    row("C. CONFIRMED LINEUP", "confirmed 1-9 identity", "mlb-stats-api schedule lineups/boxscore → lineup-dataset-v1", true, true, true, false, "v0 converts confirmed+slot count into completeness. Weight=0. Player identity not scored."),
    row("C. CONFIRMED LINEUP", "handedness / platoon / replacement delta / weighted lineup / matchup vs starter", "none in lineup types", false, false, false, false, "LineupBatterRow has slot, playerId, playerName, defensivePosition only."),
    row("D. BULLPEN", "role / fatigue / closer-setup availability", "mlb-stats-api appearances → bullpen-role-dataset-v1_1 (sample dates)", true, true, false, false, "Dataset exists for some July dates. prediction-v0 always buildDisabledBullpenFeature. Weight=0."),
    row("E. DEFENSE", "team/player defensive metrics", "none as dedicated dataset", false, false, false, false, "Legacy engine 'defense' is concededAvg when AnalysisData is populated; consumer currently fills NaN."),
    row("F. BASERUNNING", "SB / CS / BsR", "none in repository types", false, false, false, false, "Absent."),
    row("G. TEAM FORM", "travel / rest", "travel-rest-dataset-v1 (sample July dates)", true, true, false, false, "Not loaded by prediction-v0. Legacy restDays is NaN in consumer AnalysisData."),
    row("G. TEAM FORM", "recent form / standings / H2H / scoring averages", "legacy AnalysisData / early baseline-analysis artifacts", true, true, true, false, "Early 2026-07-27 baseline-analysis used team heuristics. Current consumer zeros these fields. v0 does not read them."),
    row("H. PARK / WEATHER / CONTEXT", "weather forecast", "weather-dataset-v1 venue only; provider NOT_SELECTED", false, true, false, false, "Forecast fields are NOT_COLLECTED. No park factors."),
    row("H. PARK / WEATHER / CONTEXT", "home advantage", "fixed v0 weight 0.08", false, false, true, true, "Constant prior, not park-specific."),
    row("I. MARKET", "de-vig moneyline implied probability", "the-odds-api → odds-history-dataset-v1", true, true, true, true, "v0: Probability input (marketPrior). Legacy: display + valueEdge only."),
    row("I. MARKET", "run line / totals", "odds-history normalized markets collected", true, true, false, false, "Collected on odds-history rows. MONEYLINE_2WAY only in prediction. TOTALS/RUN_LINE listed NOT_IMPLEMENTED."),
    row("I. MARKET", "odds movement", "odds-history movement field", true, true, false, false, "Copied onto snapshot as oddsMovement. Not in v0 logit."),
  ];
}

function footballFeatureRows(): FeatureUtilizationRow[] {
  const row = (
    category: string,
    data: string,
    providerOrSource: string,
    collected: boolean | "UNKNOWN",
    stored: boolean | "UNKNOWN",
    feature: boolean,
    prediction: boolean,
    gap: string,
  ): FeatureUtilizationRow => ({
    sport: "FOOTBALL",
    category,
    data,
    providerOrSource,
    collected,
    stored,
    feature,
    prediction,
    stage: prediction
      ? "PREDICTION_USED"
      : feature
        ? "PREGAME_FEATURE"
        : stored === true
          ? "DATASET"
          : collected === true
            ? "PROVIDER_OR_REPO"
            : "NONE",
    gap,
  });

  return [
    row("A. Starting XI", "confirmed XI identity", "API-Football getLineups exists; no lineup dataset", true, false, false, false, "Provider method wired. Schedule builder consumes fixtures only. Prediction snapshot does not include lineups."),
    row("A. Starting XI", "position value / replacement quality", "none", false, false, false, false, "Absent."),
    row("B. Player availability", "injuries", "API-Football getInjuries exists", true, false, false, false, "Provider method wired; not stored as a football research dataset; unused in market baseline."),
    row("C. Attack", "goals / xG / npxG / shots / SoT", "API-Football team statistics raw unknown schema", "UNKNOWN", false, false, false, "getTeamStatistics returns raw unknown. Repository does not persist xG. Dummy UI copy in src/constants/analysis.ts is not a prediction input."),
    row("D. Midfield", "key passes / progressive passes / PPDA", "none in football research artifacts", false, false, false, false, "Absent from schedule/odds/prediction artifacts."),
    row("E. Defense", "tackles / interceptions / xGA", "none in football research artifacts", false, false, false, false, "Absent."),
    row("F. Goalkeeper", "save% / PSxG-GA", "none in football research artifacts", false, false, false, false, "Absent."),
    row("G. Team advanced metrics", "xG / xGA / xGD / field tilt / possession", "none stored", false, false, false, false, "No team-metrics dataset."),
    row("H. Tactical / matchup", "formation / style matchup", "lineups raw unused", false, false, false, false, "Absent."),
    row("I. Schedule / rest", "kickoff / venue / competition", "api-football fixtures → schedule-v1", true, true, false, false, "Used to freeze identity and kickoff cutoff, not as a strength feature."),
    row("J. Market", "1x2 median de-vig", "The Odds API → football-1x2-odds-v1 → snapshot → market-baseline", true, true, true, true, "THE prediction. ARGMAX of normalized market probability."),
  ];
}

function marketDependenceRows(): MarketDependenceRow[] {
  return [
    {
      sport: "MLB",
      item: "marketPrior",
      path: "prediction-v0/compute-moneyline.ts logit(marketProbabilityHome)*0.25",
      roles: ["Probability input", "Feature"],
      evidence: "MLB_PREDICTION_V0_WEIGHTS.marketPrior.value=0.25 status=BASELINE_ASSUMPTION. usedFactors includes marketPrior when contribution !== 0.",
    },
    {
      sport: "MLB",
      item: "implied / de-vig probability",
      path: "features-market.ts → buildMarketComparison normalizedProbabilities",
      roles: ["Feature", "Probability input", "Benchmark only"],
      evidence: "Stored as marketHomeProbability and also used as logit prior. Displayed as marketProbability on the snapshot.",
    },
    {
      sport: "MLB",
      item: "valueEdge / modelEdge",
      path: "homeProbability - marketHomeProbability; legacy buildMarketComparison after engine",
      roles: ["Benchmark only", "Recommendation gate"],
      evidence: "v0 official pick (disabled) requires minModelMarketEdge. Legacy betting-line-filter classifies MARKET_CONFLICT when valueEdge<=0. Does not rewrite probability after the fact.",
    },
    {
      sport: "MLB",
      item: "odds movement",
      path: "snapshot oddsMovement field from odds-history",
      roles: ["Display only"],
      evidence: "Copied onto GamePredictionV0.oddsMovement. Not a logit component.",
    },
    {
      sport: "MLB",
      item: "bookmaker consensus",
      path: "odds-history AGGREGATE_BEST / The Odds API h2h",
      roles: ["Feature"],
      evidence: "Best/aggregate moneyline is the source of the de-vig prior. Not a multi-book distribution feature beyond that price.",
    },
    {
      sport: "MLB",
      item: "legacy marketProbability",
      path: "scripts/build-mlb-prediction-snapshot-v1.ts after runEdgeEngine",
      roles: ["Display only", "Benchmark only", "Recommendation gate"],
      evidence: "Engine winProbability is computed from AnalysisData only. Market comparison is attached afterwards.",
    },
    {
      sport: "FOOTBALL",
      item: "market baseline probability",
      path: "market-baseline-prediction-v0 ARGMAX_NORMALIZED_MARKET_PROBABILITY",
      roles: ["Probability input"],
      evidence: "baselineProbability IS the renormalized market probability. No independent sports probability exists to compare against.",
    },
    {
      sport: "FOOTBALL",
      item: "frozen 1x2 odds snapshot",
      path: "prediction-snapshot-v0 selected odds observation",
      roles: ["Feature", "Display only"],
      evidence: "Input freeze only. Snapshot meta.prediction=NONE until market-baseline consumes it.",
    },
  ];
}

function explainabilityRows(): ExplainabilityRow[] {
  return [
    {
      question: "왜 HOME/AWAY를 선택했는가?",
      mlb: "PARTIAL",
      football: "PARTIAL",
      evidence:
        "MLB v0: researchBaseline.selection = homeProbability>=0.5; explanations include HOME_STARTER_EDGE / MARKET_SUPPORTS_*. Does not attribute a player-level lineup cause. Legacy: pickFromEdgeScore sign. Football: argmax market outcome only.",
    },
    {
      question: "왜 Probability가 55%인가?",
      mlb: "PARTIAL",
      football: "SUPPORTED",
      evidence:
        "MLB v0 stores components + shrinkStrength + clamp 0.35–0.65, so the number is reconstructable as a weighted logit, not a calibrated 55%. Football baselineProbability is exactly the normalized market share.",
    },
    {
      question: "어떤 선수 때문에 방향이 변했는가?",
      mlb: "PARTIAL",
      football: "NOT_SUPPORTED",
      evidence:
        "MLB can name probable starters (ERA/WHIP edge) but cannot attribute batter/reliever identity. Lineup players are not scored. Football has no player features.",
    },
    {
      question: "어떤 Matchup이 가장 큰 영향을 줬는가?",
      mlb: "PARTIAL",
      football: "NOT_SUPPORTED",
      evidence:
        "v0 review-detail compares starter vs marketPrior vs homeAdvantage directional association. No batter-vs-pitcher or XI-vs-XI matchup feature.",
    },
    {
      question: "핵심 선수가 빠지면 Probability가 얼마나 변하는가?",
      mlb: "NOT_SUPPORTED",
      football: "NOT_SUPPORTED",
      evidence:
        "No replacement-delta, no counterfactual lineup strength, no player availability shock in either sport's prediction formula.",
    },
    {
      question: "시장과 반대 판단을 했다면 이유가 무엇인가?",
      mlb: "PARTIAL",
      football: "NOT_SUPPORTED",
      evidence:
        "MLB v0 can emit MARKET_DISAGREEMENT and store modelEdge. Because marketPrior is inside the logit, disagreement is residual after a 0.25 market pull — not an independent sports argument. Football cannot disagree: the market is the pick.",
    },
  ];
}

export async function listPrimaryMlbPredictionRels(
  rootDir: string,
): Promise<string[]> {
  const dir = path.join(rootDir, "data", "predictions", "mlb");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort()
    .map((n) => `data/predictions/mlb/${n}`);
}

export async function listFootballPredictionArtifacts(
  rootDir: string,
): Promise<{ snapshots: string[]; baselines: string[] }> {
  const dir = path.join(rootDir, "data", "research", "football");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return { snapshots: [], baselines: [] };
  }
  const snapshots = names
    .filter((n) => /^\d{4}-\d{2}-\d{2}-prediction-snapshot-v0\.json$/.test(n))
    .sort()
    .map((n) => `data/research/football/${n}`);
  const baselines = names
    .filter((n) =>
      /^\d{4}-\d{2}-\d{2}-market-baseline-prediction-v0\.json$/.test(n),
    )
    .sort()
    .map((n) => `data/research/football/${n}`);
  return { snapshots, baselines };
}

export async function classifyHistoricalPredictions(
  rootDir: string,
): Promise<HistoricalPredictionRow[]> {
  const rows: HistoricalPredictionRow[] = [];
  const mlbRels = await listPrimaryMlbPredictionRels(rootDir);
  for (const rel of mlbRels) {
    const doc = asRecord(await readJson(path.join(rootDir, rel)));
    if (!doc) continue;
    rows.push(classifyMlbSnapshot({ rel, doc }));
  }
  const fb = await listFootballPredictionArtifacts(rootDir);
  for (const rel of fb.snapshots) {
    const doc = asRecord(await readJson(path.join(rootDir, rel)));
    if (!doc) continue;
    rows.push(classifyFootballSnapshot({ rel, doc }));
  }
  for (const rel of fb.baselines) {
    const doc = asRecord(await readJson(path.join(rootDir, rel)));
    if (!doc) continue;
    rows.push(classifyFootballMarketBaseline({ rel, doc }));
  }
  rows.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.sport.localeCompare(b.sport) || a.artifactRel.localeCompare(b.artifactRel);
  });
  return rows;
}

export function featureUtilizationMatrix(): {
  mlb: FeatureUtilizationRow[];
  football: FeatureUtilizationRow[];
} {
  return {
    mlb: mlbFeatureRows(),
    football: footballFeatureRows(),
  };
}

export function buildAuditDocument(input: {
  generatedAt: string;
  gitBefore: PredictionMethodologyAuditV1["gitBefore"];
  historical: HistoricalPredictionRow[];
}): PredictionMethodologyAuditV1 {
  const counts = emptyCounts();
  for (const row of input.historical) {
    counts[row.classification] += 1;
  }
  const features = featureUtilizationMatrix();
  const providerGaps = [...features.mlb, ...features.football].filter(
    (r) =>
      (r.collected === true || r.stored === true) && r.prediction === false,
  );

  return {
    schemaVersion: PREDICTION_METHODOLOGY_AUDIT_V1_SCHEMA,
    builderVersion: PREDICTION_METHODOLOGY_AUDIT_V1_BUILDER,
    generatedAt: input.generatedAt,
    researchOnly: true,
    mutation: {
      predictionSnapshotsModified: 0,
      engineWeightsModified: 0,
      predictionLogicModified: 0,
      providerCalls: 0,
    },
    gitBefore: input.gitBefore,
    independentStatisticalModelExists: false,
    independentModelSample: 0,
    currentPredictionReality: {
      mlb: "Two freeze paths coexist: RESEARCH_BASELINE_V0 (starter ERA/WHIP + homeAdvantage + marketPrior) and LEGACY_V1 Edge Engine (rule-v1). Official picks remain 0. Lineup/bullpen weights are 0. Independent statistical model does not exist.",
      football:
        "Football Prediction Snapshot v0 is an input freeze (prediction=NONE). The only issued football 'prediction' is Market Baseline v0 = ARGMAX of normalized 1x2 market probability.",
      independentModel:
        "Independent Sports Research Model sample = 0. No Player→Lineup→Matchup→Team Context probability is computed without market inside the formula.",
    },
    historical: input.historical,
    classificationCounts: counts,
    mlbFeatureUtilization: features.mlb,
    footballFeatureUtilization: features.football,
    providerGaps,
    marketDependence: marketDependenceRows(),
    explainability: explainabilityRows(),
    scorecardRecommendation: {
      doNotRewriteHistoricalScorecards: true,
      separateTracks: [
        "Legacy Heuristic",
        "Market Assisted",
        "Market Baseline",
        "Independent Statistical Model",
      ],
      startIndependentSampleAtZero: true,
      reason:
        "No frozen artifact computes probability from player/lineup/matchup sports features without market in the formula. Starting Independent Model Sample at 0 is required to avoid relabeling market-assisted or market-baseline days as independent research.",
    },
    leakageAudit: {
      resultUsedAsPregameFeature: false,
      predictionV0LoadsResultArtifacts: false,
      notes: [
        "prediction-v0/leakage-guard.ts blocks post-commence odds/lineup/prediction timestamps and starter target-game-in-stats.",
        "load-and-predict.ts comment: result artifacts may exist on disk but are not loaded.",
        "Football official-result-v0 is postgame-only and is not an input to market-baseline-prediction-v0.",
        "Do not treat src/constants/analysis.ts dummy copy as prediction evidence.",
      ],
    },
  };
}
