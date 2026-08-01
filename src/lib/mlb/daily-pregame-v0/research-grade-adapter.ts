/**
 * Minimal postgame grading adapter for MLB Prediction v0 snapshots.
 * Distinguishes official vs research-baseline outcomes without UI.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

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
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export type ResearchGradeBucket =
  | "official_result"
  | "official_graded_sample"
  | "research_baseline_result"
  | "market_prediction_result"
  | "pending"
  | "blocked"
  | "cancelled"
  | "pass_no_pick";

export type ResearchGradeRow = {
  gameId: string;
  bucket: ResearchGradeBucket;
  researchPick: "HOME" | "AWAY" | null;
  researchCorrect: boolean | null;
  officialPick: "HOME" | "AWAY" | null;
  officialGradable: boolean;
  homeProbability: number | null;
  awayProbability: number | null;
  actualWinner: "HOME" | "AWAY" | "DRAW" | null;
  brierScore: number | null;
  logLoss: number | null;
  probabilityBucket: string | null;
};

function clampProb(p: number): number {
  return Math.min(1 - 1e-12, Math.max(1e-12, p));
}

function probabilityBucket(p: number): string {
  if (p < 0.4) return "0.35-0.40";
  if (p < 0.45) return "0.40-0.45";
  if (p < 0.5) return "0.45-0.50";
  if (p < 0.55) return "0.50-0.55";
  if (p < 0.6) return "0.55-0.60";
  return "0.60-0.65";
}

/**
 * Read-only scorecard overlay for v0 snapshots + official results.
 * Does not write artifacts. Safe for review:mlb-daily preflight.
 */
export async function buildMlbResearchGradeAdapterV0(input: {
  dateKst: string;
  cwd?: string;
  predictionRel?: string;
  resultsRel?: string;
}): Promise<{
  dateKst: string;
  officialPickCount: number;
  researchCorrect: number;
  researchIncorrect: number;
  researchPending: number;
  researchBlocked: number;
  researchCancelled: number;
  officialAccuracy: number | "N/A";
  meanBrier: number | null;
  meanLogLoss: number | null;
  rows: ResearchGradeRow[];
}> {
  const cwd = input.cwd ?? process.cwd();
  const predRel =
    input.predictionRel ?? `data/predictions/mlb/${input.dateKst}.json`;
  const resultsRel =
    input.resultsRel ??
    `data/research/mlb/${input.dateKst}-official-results-v1.json`;

  const predRaw = await readFile(path.join(cwd, predRel), "utf8");
  const pred = asRecord(JSON.parse(predRaw) as unknown);
  const meta = asRecord(pred?.meta);
  const predictions = asArr(pred?.predictions);

  let resultsByGameId = new Map<
    string,
    { status: string; winner: "HOME" | "AWAY" | "DRAW" | null }
  >();
  try {
    const resRaw = await readFile(path.join(cwd, resultsRel), "utf8");
    const res = asRecord(JSON.parse(resRaw) as unknown);
    for (const raw of asArr(res?.games)) {
      const g = asRecord(raw);
      if (!g) continue;
      const id =
        asString(g.internalGameId) ??
        asString(g.gameId) ??
        (asNumber(g.gamePk) != null ? `mlb-${asNumber(g.gamePk)}` : null);
      if (!id) continue;
      const winnerRaw = asString(g.winner);
      const winner =
        winnerRaw === "HOME" || winnerRaw === "AWAY" || winnerRaw === "DRAW"
          ? winnerRaw
          : null;
      resultsByGameId.set(id, {
        status: (asString(g.status) ?? "UNKNOWN").toUpperCase(),
        winner,
      });
    }
  } catch {
    resultsByGameId = new Map();
  }

  const rows: ResearchGradeRow[] = [];
  let researchCorrect = 0;
  let researchIncorrect = 0;
  let researchPending = 0;
  let researchBlocked = 0;
  let researchCancelled = 0;
  const briers: number[] = [];
  const logLosses: number[] = [];

  for (const raw of predictions) {
    const p = asRecord(raw);
    if (!p) continue;
    const gameId = asString(p.gameId) ?? "";
    const officialStatus = (asString(p.officialStatus) ?? "").toUpperCase();
    const officialPickRaw = asString(p.officialPick);
    const officialPick =
      officialPickRaw === "HOME" || officialPickRaw === "AWAY"
        ? officialPickRaw
        : null;
    const rb = asRecord(p.researchBaseline);
    const researchPickRaw =
      asString(rb?.selection) ??
      asString(rb?.pick) ??
      asString(p.baselinePick);
    const researchPick =
      researchPickRaw === "HOME" || researchPickRaw === "AWAY"
        ? researchPickRaw
        : researchPickRaw?.toUpperCase() === "HOME" ||
            researchPickRaw?.toUpperCase() === "AWAY"
          ? (researchPickRaw.toUpperCase() as "HOME" | "AWAY")
          : null;

    const mps = asArr(p.marketPredictions);
    const mp = asRecord(mps[0]);
    const homeP = asNumber(mp?.homeProbability);
    const awayP = asNumber(mp?.awayProbability);

    const result = resultsByGameId.get(gameId);
    let bucket: ResearchGradeBucket = "pending";
    let researchCorrectFlag: boolean | null = null;
    let actualWinner: "HOME" | "AWAY" | "DRAW" | null = null;
    let brier: number | null = null;
    let logLoss: number | null = null;
    let bucketLabel: string | null = null;

    if (officialStatus === "BLOCKED" || asString(p.inputStatus) === "BLOCKED") {
      bucket = "blocked";
      researchBlocked++;
    } else if (
      result &&
      (result.status.includes("CANCEL") || result.status.includes("POSTPON"))
    ) {
      bucket = "cancelled";
      researchCancelled++;
      actualWinner = result.winner;
    } else if (!result || result.status !== "FINAL") {
      bucket = "pending";
      researchPending++;
    } else {
      actualWinner = result.winner;
      if (!researchPick) {
        bucket = "pass_no_pick";
        researchPending++;
      } else if (result.winner === "HOME" || result.winner === "AWAY") {
        researchCorrectFlag = researchPick === result.winner;
        bucket = "research_baseline_result";
        if (researchCorrectFlag) researchCorrect++;
        else researchIncorrect++;
        if (homeP != null && awayP != null) {
          const pWin = result.winner === "HOME" ? homeP : awayP;
          brier = (1 - pWin) ** 2 + (0 - (1 - pWin)) ** 2;
          // standard 2-way Brier: (p_home - y_home)^2 + (p_away - y_away)^2
          const yHome = result.winner === "HOME" ? 1 : 0;
          const yAway = 1 - yHome;
          brier = (homeP - yHome) ** 2 + (awayP - yAway) ** 2;
          logLoss =
            -(
              yHome * Math.log(clampProb(homeP)) +
              yAway * Math.log(clampProb(awayP))
            );
          briers.push(brier);
          logLosses.push(logLoss);
          bucketLabel = probabilityBucket(
            Math.max(homeP, awayP),
          );
        }
        if (mp) bucket = "market_prediction_result";
        // Keep research_baseline_result as primary label when research pick graded
        bucket = "research_baseline_result";
      } else {
        bucket = "pending";
        researchPending++;
      }
    }

    if (officialPick) {
      // Mark presence of official sample path without grading here
      if (bucket === "research_baseline_result") {
        /* official graded separately by grade:mlb */
      }
    }

    rows.push({
      gameId,
      bucket,
      researchPick,
      researchCorrect: researchCorrectFlag,
      officialPick,
      officialGradable: officialPick != null,
      homeProbability: homeP,
      awayProbability: awayP,
      actualWinner,
      brierScore: brier,
      logLoss,
      probabilityBucket: bucketLabel,
    });
  }

  const officialPickCount = asNumber(meta?.officialPickCount) ?? 0;

  return {
    dateKst: input.dateKst,
    officialPickCount,
    researchCorrect,
    researchIncorrect,
    researchPending,
    researchBlocked,
    researchCancelled,
    officialAccuracy: officialPickCount === 0 ? "N/A" : "N/A",
    meanBrier:
      briers.length > 0
        ? briers.reduce((a, b) => a + b, 0) / briers.length
        : null,
    meanLogLoss:
      logLosses.length > 0
        ? logLosses.reduce((a, b) => a + b, 0) / logLosses.length
        : null,
    rows,
  };
}
