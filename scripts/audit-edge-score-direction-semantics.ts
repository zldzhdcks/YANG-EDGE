/**
 * Audit EDGE Score direction & display semantics (read-only).
 *   npx tsx scripts/audit-edge-score-direction-semantics.ts
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  edgeScoreAlignsWithPick,
  edgeScoreSemanticsCode,
  predictedSideEdgeScore,
  EDGE_SCORE_REFERENCE_SIDE,
} from "../src/lib/edge/edge-score-semantics";
import { pickFromEdgeScore } from "../src/lib/edge/calculate-edge";
import { selectTodayEdgePicks } from "../src/lib/edge/select-today-edge-picks";
import { loadTodayEdgePickInputs } from "../src/lib/edge/load-today-edge-pick-inputs";
import { kstMs } from "../src/lib/betting/purchase-window";

const DAILY_PREDICTION = /^\d{4}-\d{2}-\d{2}\.json$/;
const SIM_NOW = new Date(kstMs("2026-07-27", "22:40"));

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

type GameAudit = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  baselinePick: string;
  homeSideEdgeScore: number;
  predictedSideEdge: number | null;
  alignsWithPick: boolean;
  semanticsCode: string;
  signBindingIssue: boolean;
};

async function listPredictionDates(): Promise<string[]> {
  const dir = path.join(process.cwd(), "data/predictions/mlb");
  const names = await readdir(dir);
  return names
    .filter((n) => DAILY_PREDICTION.test(n))
    .map((n) => n.replace(".json", ""))
    .sort();
}

async function auditDate(dateKst: string): Promise<GameAudit[]> {
  const raw = await readFile(
    path.join(process.cwd(), `data/predictions/mlb/${dateKst}.json`),
    "utf8",
  );
  const doc = asRecord(JSON.parse(raw));
  const rows = Array.isArray(doc?.predictions) ? doc.predictions : [];
  const out: GameAudit[] = [];

  for (const row of rows) {
    const pred = asRecord(row);
    if (!pred) continue;
    const gameId = asString(pred.gameId);
    const homeTeam = asString(pred.homeTeam);
    const awayTeam = asString(pred.awayTeam);
    const baselinePick = asString(pred.baselinePick);
    const edgeScore = asNumber(pred.edgeScore);
    if (!gameId || !homeTeam || !awayTeam || !baselinePick || edgeScore == null) {
      continue;
    }

    const expected = pickFromEdgeScore(edgeScore, homeTeam, awayTeam);
    const aligns =
      edgeScoreAlignsWithPick(edgeScore, baselinePick, homeTeam, awayTeam) &&
      expected.pickTeamName === baselinePick;

    out.push({
      gameId,
      homeTeam,
      awayTeam,
      baselinePick,
      homeSideEdgeScore: edgeScore,
      predictedSideEdge: predictedSideEdgeScore(
        edgeScore,
        baselinePick,
        homeTeam,
        awayTeam,
      ),
      alignsWithPick: aligns,
      semanticsCode: edgeScoreSemanticsCode({
        homeSideEdgeScore: edgeScore,
        baselinePick,
        homeTeam,
        awayTeam,
        baselineStatus: asString(pred.baselineStatus),
      }),
      signBindingIssue: !aligns,
    });
  }

  return out;
}

async function main() {
  const dates = await listPredictionDates();
  const allGames: GameAudit[] = [];
  for (const date of dates) {
    allGames.push(...(await auditDate(date)));
  }

  let positive = 0;
  let zero = 0;
  let negative = 0;
  let signIssues = 0;

  for (const g of allGames) {
    const p = g.predictedSideEdge;
    if (p == null || p === 0) zero += 1;
    else if (p > 0) positive += 1;
    else negative += 1;
    if (g.signBindingIssue) signIssues += 1;
  }

  const texas = allGames.find((g) => g.gameId === "mlb-179605");
  const arizona = allGames.find((g) => g.gameId === "mlb-179608");

  const loaded = await loadTodayEdgePickInputs({ now: SIM_NOW });
  const selection = loaded
    ? selectTodayEdgePicks(loaded.candidates, new Date().toISOString(), 3, SIM_NOW.getTime())
    : null;

  const negativeInStrictPicks =
    selection?.picks.filter((p) => p.pickTier === "EDGE_PICK").filter((p) => {
      const c = loaded?.candidates.find((x) => x.prediction.gameId === p.gameId);
      if (!c?.prediction.edgeScore) return false;
      const side = predictedSideEdgeScore(
        c.prediction.edgeScore,
        c.prediction.baselinePick,
        c.prediction.homeTeam,
        c.prediction.awayTeam,
      );
      return side == null || side <= 0;
    }).length ?? 0;

  const audit = {
    generatedAt: new Date().toISOString(),
    formulaMeaning:
      "Home-side weighted factor sum × 30. Positive = home advantage, negative = away advantage.",
    scoreReferenceSide: EDGE_SCORE_REFERENCE_SIDE,
    predictedTeamField: "baselinePick",
    distribution: {
      totalGames: allGames.length,
      predictedSidePositive: positive,
      predictedSideZero: zero,
      predictedSideNegative: negative,
      homeSideRawPositive: allGames.filter((g) => g.homeSideEdgeScore > 0).length,
      homeSideRawNegative: allGames.filter((g) => g.homeSideEdgeScore < 0).length,
      homeSideRawZero: allGames.filter((g) => g.homeSideEdgeScore === 0).length,
    },
    signBindingIssues: signIssues,
    texasRangersValidation: texas ?? null,
    arizonaValidation: arizona ?? null,
    negativeInStrictEdgePicks: negativeInStrictPicks,
    mathAbsDisplayUsages: [
      "src/lib/edge/to-analysis-view.ts — removed display Math.abs (v1.2 audit fix)",
      "src/lib/home/build-home-feed.ts — dummy engine selection only (not research snapshot)",
      "src/lib/edge/recommendation-grade.ts — grade magnitude only (Engine unchanged)",
    ],
  };

  const outDir = path.join(process.cwd(), "data/audits");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "edge-score-direction-semantics-audit.json");
  await writeFile(outPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  console.log("=== EDGE Score Direction Semantics Audit ===");
  console.log(JSON.stringify(audit, null, 2));
  console.log(`\nWrote ${outPath}`);

  if (signIssues > 0) {
    console.error(`FAIL: ${signIssues} sign binding issue(s)`);
    process.exitCode = 1;
  }
  if (negativeInStrictPicks > 0) {
    console.error(`FAIL: ${negativeInStrictPicks} negative EDGE in strict picks`);
    process.exitCode = 1;
  }
  if (!texas?.alignsWithPick || texas.homeSideEdgeScore !== 8.7) {
    console.error("FAIL: Texas Rangers +8.7 validation");
    process.exitCode = 1;
  }
  if (!arizona?.alignsWithPick || arizona.homeSideEdgeScore !== -2.8) {
    console.error("FAIL: Arizona -2.8 validation");
    process.exitCode = 1;
  }
  if (arizona && (arizona.predictedSideEdge ?? 0) <= 0) {
    console.error("FAIL: Arizona predicted-side edge should be positive (+2.8)");
    process.exitCode = 1;
  }

  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
