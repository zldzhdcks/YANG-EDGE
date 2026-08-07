import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  abbreviateTeamName,
  shortMatchupLabel,
} from "@/lib/mlb/review-classify-v2";
import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import {
  buildDailyResearchCommentary,
  buildFailureAiSummary,
  buildSuccessAiSummary,
} from "./build-ai-summary";
import {
  failureCauseLabel,
  podiumMedal,
  successCauseLabel,
} from "./category-labels";
import {
  MLB_RESEARCH_UX_SCHEMA,
  type DailyResearchDashboardModel,
  type MlbResearchUxView,
  type ResearchReviewCardModel,
  type ResearchTimelinePoint,
  type TopFailureReason,
  type VersionIdentityModel,
} from "./types";

async function readJson<T>(abs: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(abs, "utf8")) as T;
  } catch {
    return null;
  }
}

function winnerTeam(
  side: "HOME" | "AWAY" | "DRAW" | null | undefined,
  home: string | null,
  away: string | null,
): string | null {
  if (side === "HOME") return home;
  if (side === "AWAY") return away;
  if (side === "DRAW") return "DRAW";
  return null;
}

function confidenceFromPred(pred: Record<string, unknown> | null): number | null {
  if (!pred) return null;
  const c = asNumber(pred.confidence);
  if (c != null) return Math.round(c);
  const markets = Array.isArray(pred.marketPredictions)
    ? pred.marketPredictions
    : [];
  const ml = markets.find((m) => asString(asRecord(m)?.marketType) === "MONEYLINE_2WAY");
  const mc = asNumber(asRecord(ml)?.confidence);
  return mc != null ? Math.round(mc) : null;
}

function buildTopFailureReasons(
  counts: Record<string, number>,
): TopFailureReason[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([code, count], i) => {
      const rank = (i + 1) as 1 | 2 | 3;
      return {
        rank,
        medal: podiumMedal(rank),
        code,
        label: failureCauseLabel(code),
        count,
      };
    });
}

async function loadTimeline(
  cwd: string,
  activeDate: string,
): Promise<ResearchTimelinePoint[]> {
  const dir = path.join(cwd, "data", "research", "mlb");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const dates = names
    .map((n) => {
      const m = n.match(/^(\d{4}-\d{2}-\d{2})-daily-review-summary-v1\.json$/);
      return m?.[1] ?? null;
    })
    .filter((d): d is string => Boolean(d))
    .sort();

  const recent = dates.slice(-7);
  const points: ResearchTimelinePoint[] = [];
  for (const dateKst of recent) {
    const doc = await readJson<{
      gradeCounts?: {
        correct?: number;
        incorrect?: number;
        graded?: number;
        accuracy?: { percent?: number | null };
        researchAccuracy?: { percent?: number | null };
      };
    }>(path.join(dir, `${dateKst}-daily-review-summary-v1.json`));
    const gc = doc?.gradeCounts;
    const percent =
      gc?.researchAccuracy?.percent ?? gc?.accuracy?.percent ?? null;
    points.push({
      dateKst,
      accuracyPercent: percent,
      correct: gc?.correct ?? 0,
      incorrect: gc?.incorrect ?? 0,
      graded: gc?.graded ?? 0,
      href: `/internal/research/mlb?date=${encodeURIComponent(dateKst)}`,
    });
  }
  // Ensure active date is included even if summary missing
  if (!points.some((p) => p.dateKst === activeDate) && activeDate) {
    points.push({
      dateKst: activeDate,
      accuracyPercent: null,
      correct: 0,
      incorrect: 0,
      graded: 0,
      href: `/internal/research/mlb?date=${encodeURIComponent(activeDate)}`,
    });
    points.sort((a, b) => a.dateKst.localeCompare(b.dateKst));
  }
  return points;
}

/**
 * Read-only Research UX view for operators.
 * Never writes Prediction / Engine / Dataset artifacts.
 */
export async function loadMlbResearchUxV1(input: {
  dateKst: string;
  cwd?: string;
}): Promise<MlbResearchUxView> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const researchDir = path.join(cwd, "data", "research", "mlb");
  const dailyPath = path.join(
    researchDir,
    `${dateKst}-daily-review-summary-v1.json`,
  );
  const successPath = path.join(researchDir, `${dateKst}-success-review-v1.json`);
  const failurePath = path.join(researchDir, `${dateKst}-failure-review-v1.json`);
  const predictionPath = path.join(
    cwd,
    "data",
    "predictions",
    "mlb",
    `${dateKst}.json`,
  );

  const emptyVersions: VersionIdentityModel = {
    predictionHash: null,
    researchVersion: null,
    reviewVersion: null,
    engineVersion: null,
  };

  const daily = await readJson<{
    hashes?: { predictionHash?: string };
    gradeCounts?: Record<string, unknown>;
    failureCategoryCount?: Record<string, number>;
    successCategoryCount?: Record<string, number>;
    reviewLayerVersion?: string;
    researchPerformance?: { modelVersion?: string | null };
  }>(dailyPath);

  const success = await readJson<{
    games?: Array<Record<string, unknown>>;
    reviewLayerVersion?: string;
  }>(successPath);
  const failure = await readJson<{
    games?: Array<Record<string, unknown>>;
    reviewLayerVersion?: string;
  }>(failurePath);
  const prediction = await readJson<{
    meta?: Record<string, unknown>;
    predictions?: Array<Record<string, unknown>>;
  }>(predictionPath);

  const timeline = await loadTimeline(cwd, dateKst);

  if (!daily && !success && !failure) {
    return {
      schemaVersion: MLB_RESEARCH_UX_SCHEMA,
      dateKst,
      loaded: false,
      error: "REVIEW_ARTIFACTS_MISSING",
      dashboard: null,
      aiCommentary:
        "No MLB review artifacts for this date. Run grade:mlb and review:mlb first.",
      cards: [],
      timeline,
      versions: emptyVersions,
      sourcePaths: {
        daily: null,
        success: null,
        failure: null,
        prediction: prediction ? `data/predictions/mlb/${dateKst}.json` : null,
      },
    };
  }

  const predById = new Map<string, Record<string, unknown>>();
  for (const row of prediction?.predictions ?? []) {
    const id = asString(row.gameId);
    if (id) predById.set(id, row);
  }

  const gc = daily?.gradeCounts ?? {};
  const correct = asNumber(gc.correct) ?? 0;
  const incorrect = asNumber(gc.incorrect) ?? 0;
  const totalGames = asNumber(gc.totalGames) ?? correct + incorrect;
  const accuracyPercent =
    asNumber(asRecord(gc.researchAccuracy)?.percent) ??
    asNumber(asRecord(gc.accuracy)?.percent) ??
    null;

  const failureCategoryCount = daily?.failureCategoryCount ?? {};
  const successCategoryCount = daily?.successCategoryCount ?? {};

  const dashboard: DailyResearchDashboardModel = {
    dateKst,
    totalGames,
    correct,
    incorrect,
    accuracyPercent,
    topFailureReasons: buildTopFailureReasons(failureCategoryCount),
  };

  const cards: ResearchReviewCardModel[] = [];

  for (const g of failure?.games ?? []) {
    const gameId = asString(g.gameId) ?? "";
    const pred = predById.get(gameId) ?? null;
    const home = asString(pred?.homeTeam);
    const away = asString(pred?.awayTeam);
    const cats = Array.isArray(g.failureCategories)
      ? g.failureCategories.map(String)
      : [];
    const causes = Array.isArray(g.possibleCauses)
      ? (g.possibleCauses as Array<Record<string, unknown>>)
      : [];
    const evidenceFor = (code: string) =>
      asString(causes.find((c) => asString(c.category) === code)?.evidence);

    const primaryCode = cats[0] ?? null;
    const secondaryCodes = cats.slice(1);

    cards.push({
      gameId,
      gamePk: asNumber(g.gamePk),
      matchupLabel: shortMatchupLabel(home, away),
      matchupLine: `${abbreviateTeamName(away)} @ ${abbreviateTeamName(home)}`,
      predictionSide: asString(g.pickSide) ?? "?",
      predictionTeam: asString(g.pick),
      actualSide: asString(g.actualWinner) ?? "?",
      actualTeam: winnerTeam(
        asString(g.actualWinner) as "HOME" | "AWAY" | "DRAW" | null,
        home,
        away,
      ),
      accuracy: "INCORRECT",
      confidencePercent: confidenceFromPred(pred),
      primary: primaryCode
        ? {
            code: primaryCode,
            label: failureCauseLabel(primaryCode),
            evidence: evidenceFor(primaryCode),
          }
        : null,
      secondary: secondaryCodes.map((code) => ({
        code,
        label: failureCauseLabel(code),
        evidence: evidenceFor(code),
      })),
      aiSummary: buildFailureAiSummary({
        failureCategories: cats,
        unexpectedOutcome: asString(g.unexpectedOutcome) ?? "",
        alternativeHypothesis: asString(g.alternativeHypothesis) ?? "",
        volatilityRisk: asString(g.volatilityRisk) ?? "",
        pickTeam: asString(g.pick),
        actualSide: asString(g.actualWinner),
      }),
      kind: "failure",
    });
  }

  for (const g of success?.games ?? []) {
    const gameId = asString(g.gameId) ?? "";
    const pred = predById.get(gameId) ?? null;
    const home = asString(pred?.homeTeam);
    const away = asString(pred?.awayTeam);
    const cats = Array.isArray(g.successCategories)
      ? g.successCategories.map(String)
      : [];
    const why = Array.isArray(g.whyCorrect)
      ? (g.whyCorrect as Array<Record<string, unknown>>)
      : [];
    const evidenceFor = (code: string) =>
      asString(why.find((c) => asString(c.category) === code)?.evidence);

    const primaryCode = cats[0] ?? null;
    const secondaryCodes = cats.slice(1);

    cards.push({
      gameId,
      gamePk: asNumber(g.gamePk),
      matchupLabel: shortMatchupLabel(home, away),
      matchupLine: `${abbreviateTeamName(away)} @ ${abbreviateTeamName(home)}`,
      predictionSide: asString(g.pickSide) ?? "?",
      predictionTeam: asString(g.pick),
      actualSide: asString(g.actualWinner) ?? "?",
      actualTeam: winnerTeam(
        asString(g.actualWinner) as "HOME" | "AWAY" | "DRAW" | null,
        home,
        away,
      ),
      accuracy: "CORRECT",
      confidencePercent: confidenceFromPred(pred),
      primary: primaryCode
        ? {
            code: primaryCode,
            label: successCauseLabel(primaryCode),
            evidence: evidenceFor(primaryCode),
          }
        : null,
      secondary: secondaryCodes.map((code) => ({
        code,
        label: successCauseLabel(code),
        evidence: evidenceFor(code),
      })),
      aiSummary: buildSuccessAiSummary({
        successCategories: cats,
        whyCorrect: why.map((w) => ({
          category: asString(w.category) ?? "",
          evidence: asString(w.evidence) ?? "",
        })),
        pickTeam: asString(g.pick),
      }),
      kind: "success",
    });
  }

  // Failures first, then successes — operators scan misses first
  cards.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "failure" ? -1 : 1;
    return a.matchupLine.localeCompare(b.matchupLine);
  });

  const meta = asRecord(prediction?.meta);
  const versions: VersionIdentityModel = {
    predictionHash:
      asString(daily?.hashes?.predictionHash) ??
      asString(meta?.predictionHashSha256),
    researchVersion:
      asString(daily?.researchPerformance?.modelVersion) ??
      asString(gc.modelVersion as string | undefined) ??
      asString(meta?.modelVersion),
    reviewVersion:
      asString(daily?.reviewLayerVersion) ??
      asString(failure?.reviewLayerVersion) ??
      asString(success?.reviewLayerVersion) ??
      "mlb-research-review-v2",
    engineVersion:
      asString(gc.modelStatus as string | undefined) ??
      asString(meta?.modelStatus) ??
      "RESEARCH_ONLY",
  };

  return {
    schemaVersion: MLB_RESEARCH_UX_SCHEMA,
    dateKst,
    loaded: true,
    error: null,
    dashboard,
    aiCommentary: buildDailyResearchCommentary({
      failureCategoryCount,
      successCategoryCount,
      incorrect,
      correct,
    }),
    cards,
    timeline,
    versions,
    sourcePaths: {
      daily: `data/research/mlb/${dateKst}-daily-review-summary-v1.json`,
      success: `data/research/mlb/${dateKst}-success-review-v1.json`,
      failure: `data/research/mlb/${dateKst}-failure-review-v1.json`,
      prediction: `data/predictions/mlb/${dateKst}.json`,
    },
  };
}
