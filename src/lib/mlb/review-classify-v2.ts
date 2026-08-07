/**
 * MLB Research Review v2 — game-level classification (Review Layer only).
 * Does not touch Engine, Prediction formula, weights, or research datasets.
 */

import type { ReviewAssessment } from "./mlb-prediction-review-types";
import { asNumber, asString } from "./mlb-review-utils";

export const MLB_REVIEW_FAILURE_CATEGORIES = [
  "STARTER",
  "BULLPEN",
  "LINEUP",
  "MARKET",
  "ONE_RUN_GAME",
  "BLOWOUT",
  "EXTRA_INNINGS",
] as const;

export type MlbReviewFailureCategory =
  (typeof MLB_REVIEW_FAILURE_CATEGORIES)[number];

export type MlbReviewSuccessCategory =
  | "STARTER"
  | "BULLPEN"
  | "LINEUP"
  | "MARKET"
  | "ONE_RUN_GAME"
  | "BLOWOUT"
  | "MODEL_ALIGNMENT"
  | "INPUT_QUALITY";

export type MlbReviewCause = {
  category: string;
  assessment: ReviewAssessment;
  evidence: string;
};

export type WhyCorrectItem = {
  category: string;
  assessment: ReviewAssessment;
  evidence: string;
};

export type ConfidenceHistogramBucket = {
  label: string;
  minInclusive: number;
  maxExclusive: number;
  count: number;
};

export type PredictionConfidenceHistogram = {
  schemaVersion: "mlb-prediction-confidence-histogram-v1";
  unit: "prediction.confidence_0_100";
  totalSamples: number;
  buckets: ConfidenceHistogramBucket[];
};

type GradedLike = {
  pick: "HOME" | "AWAY" | null;
  homeScore: number | null;
  awayScore: number | null;
  predictionProbability: number | null;
  inputWarnings: string[];
  inputStatus: string;
};

type PredLike = Record<string, unknown> | undefined;

function margin(
  homeScore: number | null,
  awayScore: number | null,
): number | null {
  if (homeScore == null || awayScore == null) return null;
  return Math.abs(homeScore - awayScore);
}

function warningsOf(g: GradedLike, pred: PredLike): string[] {
  const fromPred = Array.isArray(pred?.inputWarnings)
    ? pred!.inputWarnings.map(String)
    : [];
  return [...new Set([...g.inputWarnings, ...fromPred])];
}

function hasWarning(warnings: string[], re: RegExp): boolean {
  return warnings.some((w) => re.test(w));
}

function marketFavoredSide(pred: PredLike): "HOME" | "AWAY" | null {
  const markets = Array.isArray(pred?.marketPredictions)
    ? pred!.marketPredictions
    : [];
  const ml = markets.find((m) => {
    const row = m as Record<string, unknown>;
    return asString(row.marketType) === "MONEYLINE_2WAY";
  }) as Record<string, unknown> | undefined;
  if (!ml) return null;
  const home = asNumber(ml.marketHomeProbability);
  const away = asNumber(ml.marketAwayProbability);
  if (home == null || away == null) return null;
  if (home === away) return null;
  return home > away ? "HOME" : "AWAY";
}

function detectExtraInnings(pred: PredLike, graded: GradedLike): boolean {
  const blobs = [
    asString(pred?.detailedState),
    asString(pred?.statusDetailed),
    asString(pred?.gameStatus),
    ...graded.inputWarnings,
  ]
    .filter(Boolean)
    .join(" ");
  return /EXTRA\s*INN|\/1[0-9]\b|F\/1[0-9]|INNING\s*1[0-9]/i.test(blobs);
}

/**
 * Auto-tag failure categories that apply to this game.
 * Multiple categories allowed; order is priority for messaging.
 */
export function classifyFailureCategories(
  graded: GradedLike,
  pred: PredLike,
): MlbReviewFailureCategory[] {
  const out: MlbReviewFailureCategory[] = [];
  const warnings = warningsOf(graded, pred);
  const m = margin(graded.homeScore, graded.awayScore);
  const pitcherDirection = asString(pred?.pitcherDirection);

  if (
    hasWarning(warnings, /STARTER/i) ||
    (pitcherDirection != null &&
      pitcherDirection !== "NEUTRAL" &&
      pitcherDirection !== "")
  ) {
    out.push("STARTER");
  }

  if (
    hasWarning(warnings, /LINEUP/i) ||
    (Array.isArray(pred?.missingFactors) &&
      pred!.missingFactors.map(String).some((x) => /LINEUP/i.test(x))) ||
    (Array.isArray(pred?.missingInputs) &&
      pred!.missingInputs.map(String).some((x) => /LINEUP/i.test(x)))
  ) {
    out.push("LINEUP");
  }

  const marketSide = marketFavoredSide(pred);
  const oddsMovement = asString(pred?.oddsMovement);
  if (
    (marketSide != null &&
      graded.pick != null &&
      marketSide !== graded.pick) ||
    (oddsMovement != null &&
      oddsMovement !== "UNCHANGED" &&
      oddsMovement !== "FLAT")
  ) {
    out.push("MARKET");
  }

  if (m === 1) out.push("ONE_RUN_GAME");
  if (m != null && m >= 5) out.push("BLOWOUT");

  // Bullpen: close-game leverage proxy, or bullpen warnings beyond the global v0 disable flag
  const bullpenSpecific = warnings.filter(
    (w) => /BULLPEN/i.test(w) && !/^BULLPEN_WEIGHT_DISABLED_V0$/i.test(w),
  );
  if (bullpenSpecific.length > 0 || (m != null && m >= 1 && m <= 2)) {
    out.push("BULLPEN");
  }

  if (detectExtraInnings(pred, graded)) out.push("EXTRA_INNINGS");

  // Ensure every scored miss gets at least one outcome-shape tag when possible
  if (out.length === 0 && m != null) {
    if (m <= 2) out.push("ONE_RUN_GAME");
    else if (m >= 5) out.push("BLOWOUT");
    else out.push("BULLPEN");
  }

  return [...new Set(out)];
}

export function buildFailureCausesV2(
  graded: GradedLike,
  pred: PredLike,
  categories: MlbReviewFailureCategory[],
): MlbReviewCause[] {
  const causes: MlbReviewCause[] = [];
  const warnings = warningsOf(graded, pred);
  const m = margin(graded.homeScore, graded.awayScore);
  const pitcherDirection = asString(pred?.pitcherDirection);
  const marketSide = marketFavoredSide(pred);
  const oddsMovement = asString(pred?.oddsMovement);

  for (const cat of categories) {
    switch (cat) {
      case "STARTER":
        causes.push({
          category: "STARTER",
          assessment: "POSSIBLE",
          evidence:
            pitcherDirection && pitcherDirection !== "NEUTRAL"
              ? `pre-game pitcherDirection=${pitcherDirection}; starter-related warnings=${warnings.filter((w) => /STARTER/i.test(w)).join(", ") || "none"}`
              : `starter-related warnings: ${warnings.filter((w) => /STARTER/i.test(w)).join(", ") || "present via classification"}`,
        });
        break;
      case "LINEUP":
        causes.push({
          category: "LINEUP",
          assessment: "POSSIBLE",
          evidence: `lineup incomplete or unconfirmed (${warnings.filter((w) => /LINEUP/i.test(w)).join(", ") || "missing CONFIRMED_LINEUP"})`,
        });
        break;
      case "MARKET":
        causes.push({
          category: "MARKET",
          assessment: "POSSIBLE",
          evidence: [
            marketSide != null
              ? `market favored ${marketSide} while pick was ${graded.pick}`
              : null,
            oddsMovement ? `oddsMovement=${oddsMovement}` : null,
          ]
            .filter(Boolean)
            .join("; "),
        });
        break;
      case "ONE_RUN_GAME":
        causes.push({
          category: "ONE_RUN_GAME",
          assessment: "CONSISTENT_WITH_HYPOTHESIS",
          evidence: `final margin ${m} run — high variance / sequencing risk`,
        });
        break;
      case "BLOWOUT":
        causes.push({
          category: "BLOWOUT",
          assessment: "POSSIBLE",
          evidence: `final margin ${m} runs — outcome diverged sharply from pick`,
        });
        break;
      case "BULLPEN":
        causes.push({
          category: "BULLPEN",
          assessment: m != null && m <= 2 ? "POSSIBLE" : "WEAK_SUPPORT",
          evidence:
            m != null && m <= 2
              ? `close final (margin ${m}); late-inning leverage may have decided the game`
              : `bullpen-specific signals: ${warnings
                  .filter(
                    (w) =>
                      /BULLPEN/i.test(w) &&
                      !/^BULLPEN_WEIGHT_DISABLED_V0$/i.test(w),
                  )
                  .join(", ") || "bullpen not modeled"}`,
        });
        break;
      case "EXTRA_INNINGS":
        causes.push({
          category: "EXTRA_INNINGS",
          assessment: "POSSIBLE",
          evidence: "game status/signals indicate extra innings",
        });
        break;
    }
  }

  // Additive data-quality note only when non-bullpen data warnings exist
  const dataWarnings = warnings.filter(
    (w) => !/^BULLPEN_WEIGHT_DISABLED/i.test(w),
  );
  if (dataWarnings.length > 0) {
    causes.push({
      category: "DATA_QUALITY",
      assessment: "POSSIBLE",
      evidence: dataWarnings.join("; "),
    });
  }

  if (
    graded.predictionProbability != null &&
    graded.predictionProbability >= 0.6
  ) {
    causes.push({
      category: "MODEL_OVERCONFIDENCE",
      assessment: "POSSIBLE",
      evidence: `model showed ${(graded.predictionProbability * 100).toFixed(1)}% on losing side`,
    });
  }

  return causes;
}

export function classifySuccessCategories(
  graded: GradedLike,
  pred: PredLike,
): MlbReviewSuccessCategory[] {
  const out: MlbReviewSuccessCategory[] = [];
  const warnings = warningsOf(graded, pred);
  const m = margin(graded.homeScore, graded.awayScore);
  const pitcherDirection = asString(pred?.pitcherDirection);
  const marketSide = marketFavoredSide(pred);

  if (
    pitcherDirection &&
    pitcherDirection !== "NEUTRAL" &&
    !hasWarning(warnings, /STARTER_SAMPLE_PARTIAL|STARTER_MISSING/i)
  ) {
    out.push("STARTER");
  }
  if (marketSide != null && graded.pick != null && marketSide === graded.pick) {
    out.push("MARKET");
  }
  if (!hasWarning(warnings, /LINEUP/i) && graded.inputStatus === "ELIGIBLE") {
    out.push("LINEUP");
  }
  if (m === 1) out.push("ONE_RUN_GAME");
  if (m != null && m >= 5) out.push("BLOWOUT");
  if (
    graded.predictionProbability != null &&
    graded.predictionProbability >= 0.55
  ) {
    out.push("MODEL_ALIGNMENT");
  }
  if (warnings.filter((w) => !/^BULLPEN_WEIGHT_DISABLED/i.test(w)).length === 0) {
    out.push("INPUT_QUALITY");
  }
  if (hasWarning(warnings, /BULLPEN/i) && m != null && m <= 2) {
    // Only for close wins — global BULLPEN_WEIGHT_DISABLED alone is not a success tag
    const specific = warnings.some(
      (w) => /BULLPEN/i.test(w) && !/^BULLPEN_WEIGHT_DISABLED_V0$/i.test(w),
    );
    if (specific || m <= 2) out.push("BULLPEN");
  }
  if (out.length === 0) out.push("MODEL_ALIGNMENT");
  return [...new Set(out)];
}

export function buildWhyCorrect(
  graded: GradedLike,
  pred: PredLike,
  categories: MlbReviewSuccessCategory[],
): WhyCorrectItem[] {
  const items: WhyCorrectItem[] = [];
  const m = margin(graded.homeScore, graded.awayScore);
  const pitcherDirection = asString(pred?.pitcherDirection);
  const marketSide = marketFavoredSide(pred);
  const warnings = warningsOf(graded, pred);

  for (const cat of categories) {
    switch (cat) {
      case "STARTER":
        items.push({
          category: "STARTER",
          assessment: "POSSIBLE_SUPPORT",
          evidence: `pitcherDirection=${pitcherDirection ?? "n/a"} aligned with correct side`,
        });
        break;
      case "MARKET":
        items.push({
          category: "MARKET",
          assessment: "POSSIBLE_SUPPORT",
          evidence: `market also favored pick side (${marketSide})`,
        });
        break;
      case "LINEUP":
        items.push({
          category: "LINEUP",
          assessment: "CONSISTENT_WITH_HYPOTHESIS",
          evidence: "lineup inputs were not the primary limited-input flag",
        });
        break;
      case "ONE_RUN_GAME":
        items.push({
          category: "ONE_RUN_GAME",
          assessment: "WEAK_SUPPORT",
          evidence: `won by 1 run (margin ${m}) — correct but high variance`,
        });
        break;
      case "BLOWOUT":
        items.push({
          category: "BLOWOUT",
          assessment: "POSSIBLE_SUPPORT",
          evidence: `comfortable margin ${m} — outcome less likely pure coin-flip`,
        });
        break;
      case "MODEL_ALIGNMENT":
        items.push({
          category: "MODEL_ALIGNMENT",
          assessment:
            graded.predictionProbability != null &&
            graded.predictionProbability >= 0.55
              ? "POSSIBLE_SUPPORT"
              : "INSUFFICIENT_EVIDENCE",
          evidence:
            graded.predictionProbability != null
              ? `pick-side probability ${(graded.predictionProbability * 100).toFixed(1)}%`
              : "probability unavailable",
        });
        break;
      case "INPUT_QUALITY":
        items.push({
          category: "INPUT_QUALITY",
          assessment: "CONSISTENT_WITH_HYPOTHESIS",
          evidence: "no material non-bullpen input warnings on this game",
        });
        break;
      case "BULLPEN":
        items.push({
          category: "BULLPEN",
          assessment: "INSUFFICIENT_EVIDENCE",
          evidence: `bullpen flagged but side still correct (warnings: ${warnings.filter((w) => /BULLPEN/i.test(w)).join(", ")})`,
        });
        break;
    }
  }
  return items;
}

export function countCategories(lists: string[][]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const list of lists) {
    for (const c of list) {
      counts[c] = (counts[c] ?? 0) + 1;
    }
  }
  return counts;
}

const HIST_BOUNDS = [0, 50, 55, 60, 65, 70, 80, 101] as const;

export function buildPredictionConfidenceHistogram(
  confidences: Array<number | null | undefined>,
): PredictionConfidenceHistogram {
  const samples = confidences.filter(
    (c): c is number => typeof c === "number" && Number.isFinite(c),
  );
  const buckets: ConfidenceHistogramBucket[] = [];
  for (let i = 0; i < HIST_BOUNDS.length - 1; i++) {
    const min = HIST_BOUNDS[i]!;
    const max = HIST_BOUNDS[i + 1]!;
    buckets.push({
      label: max >= 101 ? `${min}+` : `${min}–${max - 1}`,
      minInclusive: min,
      maxExclusive: max,
      count: samples.filter((c) => c >= min && c < max).length,
    });
  }
  return {
    schemaVersion: "mlb-prediction-confidence-histogram-v1",
    unit: "prediction.confidence_0_100",
    totalSamples: samples.length,
    buckets,
  };
}

export function scoreDiffText(
  homeScore: number | null,
  awayScore: number | null,
): string {
  if (homeScore == null || awayScore == null) return "final score unavailable";
  return `${awayScore}-${homeScore} (away-home), margin ${Math.abs(homeScore - awayScore)}`;
}

/** Common MLB display abbreviations (review-only labels). */
const TEAM_NAME_TO_ABBREV: Record<string, string> = {
  "arizona diamondbacks": "ARI",
  "atlanta braves": "ATL",
  "baltimore orioles": "BAL",
  "boston red sox": "BOS",
  "chicago cubs": "CHC",
  "chicago white sox": "CWS",
  "cincinnati reds": "CIN",
  "cleveland guardians": "CLE",
  "colorado rockies": "COL",
  "detroit tigers": "DET",
  "houston astros": "HOU",
  "kansas city royals": "KC",
  "los angeles angels": "LAA",
  "los angeles dodgers": "LAD",
  "miami marlins": "MIA",
  "milwaukee brewers": "MIL",
  "minnesota twins": "MIN",
  "new york mets": "NYM",
  "new york yankees": "NYY",
  athletics: "ATH",
  "oakland athletics": "ATH",
  "philadelphia phillies": "PHI",
  "pittsburgh pirates": "PIT",
  "san diego padres": "SD",
  "san francisco giants": "SF",
  "seattle mariners": "SEA",
  "st. louis cardinals": "STL",
  "st louis cardinals": "STL",
  "tampa bay rays": "TB",
  "texas rangers": "TEX",
  "toronto blue jays": "TOR",
  "washington nationals": "WSH",
};

export function abbreviateTeamName(name: string | null | undefined): string {
  if (!name) return "?";
  const key = name.trim().toLowerCase();
  if (TEAM_NAME_TO_ABBREV[key]) return TEAM_NAME_TO_ABBREV[key]!;
  const words = key.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words[words.length - 1]!.slice(0, 3).toUpperCase();
}

/** HOME-AWAY style label, e.g. ARI-SD */
export function shortMatchupLabel(
  homeTeam: string | null | undefined,
  awayTeam: string | null | undefined,
): string {
  return `${abbreviateTeamName(homeTeam)}-${abbreviateTeamName(awayTeam)}`;
}

export type FailureCategoryTableRow = {
  label: string;
  gameId: string;
  gamePk: number | null;
  categories: string[];
  /** Acceptance-style line: `ARI-SD → STARTER + LINEUP + BLOWOUT` */
  line: string;
};

export function buildFailureCategoryTable(
  games: Array<{
    gameId: string;
    gamePk: number | null;
    homeTeam?: string | null;
    awayTeam?: string | null;
    failureCategories: string[];
  }>,
): FailureCategoryTableRow[] {
  return games.map((g) => {
    const label = shortMatchupLabel(g.homeTeam, g.awayTeam);
    const cats = g.failureCategories.map((c) =>
      c === "ONE_RUN_GAME" ? "ONE_RUN" : c,
    );
    const joined = cats.join(" + ");
    return {
      label,
      gameId: g.gameId,
      gamePk: g.gamePk,
      categories: g.failureCategories,
      line: `${label} → ${joined || "(none)"}`,
    };
  });
}

export function formatFailureCategoryTableText(
  rows: FailureCategoryTableRow[],
): string {
  if (rows.length === 0) return "Failure Category by Game\n(none)";
  return ["Failure Category by Game", ...rows.map((r) => r.line)].join("\n");
}
