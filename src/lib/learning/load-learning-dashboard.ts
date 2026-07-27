/**
 * Learning Dashboard 서버 로더.
 * data/learning/dashboard.json 을 읽는다. 없으면 빈 상태.
 */
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type LearningBucket = {
  label: string;
  n: number;
  hits: number;
  fails: number;
  hitRate: number | null;
  status: "OK" | "INSUFFICIENT_SAMPLE";
};

export type LearningDashboardData = {
  meta: {
    version: string;
    generatedAt: string | null;
    note: string | null;
    minSample: number;
    engineRerun: boolean;
    weightsChanged: boolean;
  };
  summary: {
    totalReviews: number;
    graded: number;
    signalWorked: number;
    signalFailed: number;
    inconclusive: number;
    overallHitRate: LearningBucket | null;
    dayCount: number;
  };
  byLeague: LearningBucket[];
  byConfidence: LearningBucket[];
  byRecommendationGrade: LearningBucket[];
  byValueEdge: LearningBucket[];
  recentDays: Array<{
    dateKst: string;
    gradedGames: number;
    signalWorked: number;
    signalFailed: number;
    inconclusive: number;
    liveAccuracyPercent: number | null;
    leagues: string[];
  }>;
  caveats: string[];
  loaded: boolean;
};

const DASHBOARD_PATH = path.join(
  process.cwd(),
  "data",
  "learning",
  "dashboard.json",
);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asBoolean(value: unknown): boolean {
  return value === true;
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}

function parseBucket(raw: unknown): LearningBucket | null {
  const row = asRecord(raw);
  if (!row) return null;
  const label = asString(row.label);
  if (!label) return null;
  const status =
    asString(row.status) === "OK" ? "OK" : "INSUFFICIENT_SAMPLE";
  return {
    label,
    n: asNumber(row.n) ?? 0,
    hits: asNumber(row.hits) ?? 0,
    fails: asNumber(row.fails) ?? 0,
    hitRate: asNumber(row.hitRate),
    status,
  };
}

function emptyDashboard(): LearningDashboardData {
  return {
    meta: {
      version: "learning-dashboard-v1",
      generatedAt: null,
      note: null,
      minSample: 10,
      engineRerun: false,
      weightsChanged: false,
    },
    summary: {
      totalReviews: 0,
      graded: 0,
      signalWorked: 0,
      signalFailed: 0,
      inconclusive: 0,
      overallHitRate: null,
      dayCount: 0,
    },
    byLeague: [],
    byConfidence: [],
    byRecommendationGrade: [],
    byValueEdge: [],
    recentDays: [],
    caveats: [],
    loaded: false,
  };
}

export async function loadLearningDashboard(): Promise<LearningDashboardData> {
  try {
    const text = await readFile(DASHBOARD_PATH, "utf8");
    const raw = JSON.parse(text) as unknown;
    const root = asRecord(raw);
    if (!root) return emptyDashboard();
    const meta = asRecord(root.meta) ?? {};
    const summary = asRecord(root.summary) ?? {};
    const overallRaw = asRecord(summary.overallHitRate);

    return {
      meta: {
        version: asString(meta.version) ?? "learning-dashboard-v1",
        generatedAt: asString(meta.generatedAt),
        note: asString(meta.note),
        minSample: asNumber(meta.minSample) ?? 10,
        engineRerun: asBoolean(meta.engineRerun),
        weightsChanged: asBoolean(meta.weightsChanged),
      },
      summary: {
        totalReviews: asNumber(summary.totalReviews) ?? 0,
        graded: asNumber(summary.graded) ?? 0,
        signalWorked: asNumber(summary.signalWorked) ?? 0,
        signalFailed: asNumber(summary.signalFailed) ?? 0,
        inconclusive: asNumber(summary.inconclusive) ?? 0,
        overallHitRate: overallRaw
          ? {
              label: "overall",
              n: asNumber(overallRaw.n) ?? 0,
              hits: asNumber(overallRaw.hits) ?? 0,
              fails: asNumber(overallRaw.fails) ?? 0,
              hitRate: asNumber(overallRaw.hitRate),
              status:
                asString(overallRaw.status) === "OK"
                  ? "OK"
                  : "INSUFFICIENT_SAMPLE",
            }
          : null,
        dayCount: asNumber(summary.dayCount) ?? 0,
      },
      byLeague: (Array.isArray(root.byLeague) ? root.byLeague : [])
        .map(parseBucket)
        .filter((b): b is LearningBucket => b != null),
      byConfidence: (Array.isArray(root.byConfidence) ? root.byConfidence : [])
        .map(parseBucket)
        .filter((b): b is LearningBucket => b != null),
      byRecommendationGrade: (
        Array.isArray(root.byRecommendationGrade)
          ? root.byRecommendationGrade
          : []
      )
        .map(parseBucket)
        .filter((b): b is LearningBucket => b != null),
      byValueEdge: (Array.isArray(root.byValueEdge) ? root.byValueEdge : [])
        .map(parseBucket)
        .filter((b): b is LearningBucket => b != null),
      recentDays: (Array.isArray(root.recentDays) ? root.recentDays : [])
        .map((entry) => {
          const row = asRecord(entry);
          if (!row) return null;
          const dateKst = asString(row.dateKst);
          if (!dateKst) return null;
          return {
            dateKst,
            gradedGames: asNumber(row.gradedGames) ?? 0,
            signalWorked: asNumber(row.signalWorked) ?? 0,
            signalFailed: asNumber(row.signalFailed) ?? 0,
            inconclusive: asNumber(row.inconclusive) ?? 0,
            liveAccuracyPercent: asNumber(row.liveAccuracyPercent),
            leagues: asStringArray(row.leagues),
          };
        })
        .filter(
          (
            d,
          ): d is LearningDashboardData["recentDays"][number] => d != null,
        ),
      caveats: asStringArray(root.caveats),
      loaded: true,
    };
  } catch {
    return emptyDashboard();
  }
}
