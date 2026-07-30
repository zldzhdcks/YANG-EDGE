/**
 * Load Research Analysis Viewer v1 payload from existing artifacts only.
 * No Engine run, no recomputation, no guesses.
 */
import "server-only";

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { buildGameId } from "@/lib/game-id";
import {
  mapReviewHypothesesDisplay,
  mapStatusCodeKo,
  predictionMissingStarterMetrics,
} from "@/lib/research/research-analysis-display-map";
import type {
  ActualLineupBatter,
  ActualLineupSide,
  ActualLineupValue,
  FieldAvailability,
  FailureReviewValue,
  LearningSummaryValue,
  ResearchAnalysisView,
  ResearchField,
  StarterMetricsAtPrediction,
  SuccessReviewValue,
} from "@/types/research-analysis-view";

const PREDICTION_IMMUTABLE_KEYS = [
  "predictionId",
  "gameId",
  "externalId",
  "dateKst",
  "startTimeKst",
  "league",
  "homeTeam",
  "awayTeam",
  "baselinePick",
  "modelProbability",
  "edgeScore",
  "confidence",
  "recommendationGrade",
  "baselineStatus",
  "marketProbability",
  "valueEdge",
  "openingOdds",
  "latestOdds",
  "oddsMovement",
  "pitcherDirection",
  "pitcherReviewAvailable",
  "dataAvailability",
  "usedFactors",
  "missingFactors",
  "purchaseEligible",
  "researchOnly",
  "purchaseReason",
  "predictedAt",
  "sourceSnapshotVersions",
  "snapshotIntegrity",
  "integrityWarnings",
] as const;

const SAMPLE_NOTICE =
  "경기 연구 보기 — 읽기 전용입니다. 연구 artifact에 저장된 값만 표시하며, 없는 항목은 미수집 또는 연구 대기 중입니다. 실추천·Engine 재계산이 아닙니다.";

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

function asBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function field<T>(
  availability: FieldAvailability,
  value: T | null,
  label: string,
): ResearchField<T> {
  return { availability, value, label };
}

function collected<T>(value: T, label: string): ResearchField<T> {
  return field("COLLECTED", value, label);
}

function notCollected<T>(label: string): ResearchField<T> {
  return { availability: "NOT_COLLECTED", value: null, label };
}

function awaiting<T>(label: string): ResearchField<T> {
  return { availability: "AWAITING_RESEARCH", value: null, label };
}

function unavailable<T>(
  availability: Exclude<FieldAvailability, "COLLECTED">,
  label: string,
): ResearchField<T> {
  return { availability, value: null, label };
}

function immutablePredictionHash(pred: Record<string, unknown>): string {
  const slice: Record<string, unknown> = {};
  for (const k of PREDICTION_IMMUTABLE_KEYS) slice[k] = pred[k] ?? null;
  return createHash("sha256").update(JSON.stringify(slice)).digest("hex");
}

function matchesGameId(
  row: Record<string, unknown>,
  gameId: string,
): boolean {
  const gid = asString(row.gameId);
  const ext = asString(row.externalId);
  if (gid === gameId) return true;
  if (ext && (gameId === ext || gameId === `mlb-${ext}`)) return true;
  if (gid && gameId === gid.replace(/^mlb-/, "")) return true;

  const home = asString(row.homeTeam);
  const away = asString(row.awayTeam);
  const league = asString(row.league) ?? "MLB";
  if (home && away && buildGameId(league, home, away) === gameId) return true;
  return false;
}

async function listJsonFiles(dirRel: string): Promise<string[]> {
  const abs = path.join(/*turbopackIgnore: true*/ process.cwd(), dirRel);
  try {
    const names = await readdir(abs);
    return names
      .filter((n) => n.endsWith(".json"))
      .map((n) => path.join(dirRel, n).replace(/\\/g, "/"));
  } catch {
    return [];
  }
}

async function readJson(relOrAbs: string): Promise<unknown | null> {
  const abs = path.isAbsolute(relOrAbs)
    ? relOrAbs
    : path.join(/*turbopackIgnore: true*/ process.cwd(), relOrAbs);
  try {
    return JSON.parse(await readFile(abs, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function isDailyPredictionFile(rel: string): boolean {
  const p = rel.replace(/\\/g, "/");
  return (
    /\/\d{4}-\d{2}-\d{2}\.json$/.test(p) &&
    !p.includes("-review") &&
    !p.includes("-flow") &&
    !p.includes("odds-timeline")
  );
}

async function findPrediction(
  gameId: string,
): Promise<{
  pred: Record<string, unknown>;
  meta: Record<string, unknown>;
  pathRel: string;
} | null> {
  const mlbFiles = await listJsonFiles("data/predictions/mlb");
  const candidates = mlbFiles.filter(isDailyPredictionFile);

  for (const rel of candidates.sort().reverse()) {
    const doc = asRecord(await readJson(rel));
    if (!doc) continue;
    const preds = Array.isArray(doc.predictions) ? doc.predictions : [];
    for (const raw of preds) {
      const pred = asRecord(raw);
      if (!pred || !matchesGameId(pred, gameId)) continue;
      return { pred, meta: asRecord(doc.meta) ?? {}, pathRel: rel };
    }
  }

  const rootFiles = await listJsonFiles("data/predictions");
  for (const rel of rootFiles.filter(isDailyPredictionFile).sort().reverse()) {
    const doc = asRecord(await readJson(rel));
    if (!doc) continue;
    const preds = Array.isArray(doc.predictions) ? doc.predictions : [];
    for (const raw of preds) {
      const pred = asRecord(raw);
      if (!pred || !matchesGameId(pred, gameId)) continue;
      return { pred, meta: asRecord(doc.meta) ?? {}, pathRel: rel };
    }
  }

  return null;
}

async function findStarterRows(
  gameId: string,
  dateKst: string | null,
): Promise<{
  rows: Array<Record<string, unknown>>;
  pathRel: string;
} | null> {
  const files = await listJsonFiles("data/research/mlb");
  const starterFiles = files.filter((p) =>
    p.includes("starter-dataset-v1.json"),
  );
  const preferred = dateKst
    ? starterFiles.filter((p) => p.includes(dateKst))
    : starterFiles;

  const ordered = [
    ...preferred,
    ...starterFiles.filter((p) => !preferred.includes(p)),
  ];

  for (const rel of ordered) {
    const doc = asRecord(await readJson(rel));
    if (!doc) continue;
    const rows = Array.isArray(doc.rows) ? doc.rows : [];
    const hit = rows
      .map((r) => asRecord(r))
      .filter((r): r is Record<string, unknown> => !!r && matchesGameId(r, gameId));
    if (hit.length > 0) return { rows: hit, pathRel: rel };
  }
  return null;
}

async function findLineupRows(
  gameId: string,
  dateKst: string | null,
): Promise<{
  rows: Array<Record<string, unknown>>;
  pathRel: string;
} | null> {
  const files = await listJsonFiles("data/research/mlb");
  const lineupFiles = files.filter((p) =>
    p.includes("lineup-dataset-v1.json"),
  );
  const preferred = dateKst
    ? lineupFiles.filter((p) => p.includes(dateKst))
    : lineupFiles;
  const ordered = [
    ...preferred,
    ...lineupFiles.filter((p) => !preferred.includes(p)),
  ];

  for (const rel of ordered) {
    const doc = asRecord(await readJson(rel));
    if (!doc) continue;
    const rows = Array.isArray(doc.rows) ? doc.rows : [];
    const hit = rows
      .map((r) => asRecord(r))
      .filter(
        (r): r is Record<string, unknown> => !!r && matchesGameId(r, gameId),
      );
    if (hit.length > 0) return { rows: hit, pathRel: rel };
  }
  return null;
}

function lineupSideFromRow(
  row: Record<string, unknown> | null,
): ActualLineupSide | null {
  if (!row) return null;
  const batting = Array.isArray(row.battingOrder) ? row.battingOrder : [];
  const batters: ActualLineupBatter[] = [];
  for (const raw of batting) {
    const b = asRecord(raw);
    if (!b) continue;
    const slot = asNumber(b.slot);
    if (slot == null) continue;
    batters.push({
      slot,
      playerName: asString(b.playerName) ?? "—",
      defensivePosition: asString(b.defensivePosition),
      isDh: b.isDh === true,
    });
  }
  batters.sort((a, b) => a.slot - b.slot);
  return {
    teamName: asString(row.teamName),
    lineupStatus: asString(row.lineupStatus),
    batters,
  };
}

function buildActualLineupValue(
  rows: Array<Record<string, unknown>>,
): ActualLineupValue {
  const homeRow =
    rows.find((r) => asString(r.side) === "home") ?? null;
  const awayRow =
    rows.find((r) => asString(r.side) === "away") ?? null;
  const preGame =
    asString(homeRow?.preGameStatus) ??
    asString(awayRow?.preGameStatus) ??
    "NOT_COLLECTED";
  return {
    notice:
      "경기 후 확인된 실제 선발 라인업입니다. 예측 당시 Engine 입력이 아닙니다.",
    preGameStatusLabel:
      preGame === "NOT_COLLECTED"
        ? "경기 전 라인업 미수집"
        : `경기 전 라인업: ${preGame}`,
    home: lineupSideFromRow(homeRow),
    away: lineupSideFromRow(awayRow),
  };
}

async function findBullpenGame(
  gameId: string,
  dateKst: string | null,
): Promise<{
  game: Record<string, unknown>;
  pathRel: string;
} | null> {
  const files = await listJsonFiles("data/research/mlb");
  const bullpenFiles = files.filter(
    (p) =>
      p.includes("bullpen-role-dataset") &&
      p.endsWith(".json") &&
      !p.includes("audit"),
  );
  const preferred = dateKst
    ? bullpenFiles.filter((p) => p.includes(dateKst))
    : bullpenFiles;

  const ordered = [...preferred, ...bullpenFiles]
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .sort((a, b) => {
      const aV11 = a.includes("v1_1") || a.includes("v1.1") ? 1 : 0;
      const bV11 = b.includes("v1_1") || b.includes("v1.1") ? 1 : 0;
      if (aV11 !== bV11) return bV11 - aV11;
      return b.localeCompare(a);
    });

  for (const rel of ordered) {
    const doc = asRecord(await readJson(rel));
    if (!doc) continue;
    const games = Array.isArray(doc.games) ? doc.games : [];
    for (const raw of games) {
      const g = asRecord(raw);
      if (!g || !matchesGameId(g, gameId)) continue;
      return { game: g, pathRel: rel };
    }
  }
  return null;
}

async function findReviewGame(
  gameId: string,
  dateKst: string | null,
): Promise<{
  game: Record<string, unknown>;
  pathRel: string;
} | null> {
  if (!dateKst) return null;
  const rel = `data/predictions/mlb/${dateKst}-review.json`;
  const doc = asRecord(await readJson(rel));
  if (!doc) return null;
  const games = Array.isArray(doc.games) ? doc.games : [];
  for (const raw of games) {
    const g = asRecord(raw);
    if (!g || !matchesGameId(g, gameId)) continue;
    return { game: g, pathRel: rel };
  }
  return null;
}

async function findFlowGame(
  kind: "success" | "failure",
  gameId: string,
  dateKst: string | null,
): Promise<{
  game: Record<string, unknown>;
  pathRel: string;
} | null> {
  if (!dateKst) return null;
  const rel =
    kind === "success"
      ? `data/predictions/mlb/${dateKst}-success-flow-review.json`
      : `data/predictions/mlb/${dateKst}-failure-flow-review.json`;
  const doc = asRecord(await readJson(rel));
  if (!doc) return null;
  const games = Array.isArray(doc.games) ? doc.games : [];
  for (const raw of games) {
    const g = asRecord(raw);
    if (!g || !matchesGameId(g, gameId)) continue;
    return { game: g, pathRel: rel };
  }
  return null;
}

function availabilityText(a: FieldAvailability): string {
  if (a === "COLLECTED") return "Collected";
  if (a === "AWAITING_RESEARCH") return "Awaiting Research";
  return "Not Collected";
}

function isFinishedPrediction(pred: Record<string, unknown>): boolean {
  const status = asString(pred.resultStatus);
  if (status === "graded") return true;
  const feedback = asString(pred.feedbackClassification);
  return feedback === "SIGNAL_WORKED" || feedback === "SIGNAL_FAILED";
}

/**
 * Missing research artifact:
 * - pre-game / pending → Awaiting Research (still expected)
 * - finished → Not Collected (collection window passed without artifact)
 */
function missingExpectedArtifact(
  isFinishedGame: boolean,
): Exclude<FieldAvailability, "COLLECTED"> {
  return isFinishedGame ? "NOT_COLLECTED" : "AWAITING_RESEARCH";
}

function starterMetricsFromPrediction(
  pred: Record<string, unknown> | null,
): { metrics: StarterMetricsAtPrediction; label: string } {
  if (!pred) {
    return { metrics: "UNKNOWN", label: "Not Collected" };
  }
  if (predictionMissingStarterMetrics(pred.missingFactors)) {
    return {
      metrics: "MISSING_DETAIL",
      label: "예측 당시 선발 세부 지표 부족",
    };
  }
  return { metrics: "INCLUDED", label: "예측 당시 선발 지표 반영" };
}

function computeResearchStatus(args: {
  hasPrediction: boolean;
  hasStarter: boolean;
  hasBullpen: boolean;
  isFinishedGame: boolean;
  hasDayReview: boolean;
  hasSuccessFlow: boolean;
  hasFailureFlow: boolean;
  feedback: string | null;
}): {
  status: ResearchAnalysisView["researchStatus"];
  note: string;
} {
  if (!args.hasPrediction) {
    return {
      status: "AWAITING_RESEARCH",
      note: "Prediction snapshot 없음 — 연구 artifact 대기",
    };
  }

  const requiredPresent: string[] = ["prediction"];
  const requiredMissing: string[] = [];

  if (args.hasStarter) requiredPresent.push("starter");
  else requiredMissing.push("starter");

  if (args.hasBullpen) requiredPresent.push("bullpen");
  else requiredMissing.push("bullpen");

  if (args.isFinishedGame) {
    if (args.hasDayReview) requiredPresent.push("review");
    else requiredMissing.push("review");

    if (args.feedback === "SIGNAL_WORKED") {
      if (args.hasSuccessFlow) requiredPresent.push("success-flow");
      else requiredMissing.push("success-flow");
    } else if (args.feedback === "SIGNAL_FAILED") {
      if (args.hasFailureFlow) requiredPresent.push("failure-flow");
      else requiredMissing.push("failure-flow");
    }
  }

  if (requiredMissing.length === 0) {
    return {
      status: "COLLECTED",
      note: args.isFinishedGame
        ? "필수 artifact 전부 존재 (prediction·starter·bullpen·review)"
        : "필수 artifact 전부 존재 (prediction·starter·bullpen)",
    };
  }

  return {
    status: "PARTIAL",
    note: `일부 artifact만 존재 · 있음: ${requiredPresent.join(", ")} · 없음: ${requiredMissing.join(", ")}`,
  };
}

async function findKboOddsForGame(
  gameId: string,
  resolvedInternalId: string | null,
): Promise<{
  domestic: { home: number | null; away: number | null } | null;
  overseas: { home: number | null; away: number | null } | null;
  homeTeam: string | null;
  awayTeam: string | null;
  dateKst: string | null;
  startTimeKst: string | null;
  pathRel: string | null;
} | null> {
  const files = await listJsonFiles("data/research/kbo");
  const oddsFiles = files.filter((p) => p.includes("odds-comparison-v1.json"));
  for (const rel of oddsFiles.sort().reverse()) {
    const doc = asRecord(await readJson(rel));
    if (!doc) continue;
    const rows = Array.isArray(doc.rows) ? doc.rows : [];
    for (const raw of rows) {
      const r = asRecord(raw);
      if (!r) continue;
      const rid = asString(r.gameId) ?? "";
      const home = asString(r.homeTeam);
      const away = asString(r.awayTeam);
      const directMatch = rid === gameId || (resolvedInternalId && rid === resolvedInternalId);
      const slugMatch = home && away && buildGameId("KBO", home, away) === gameId;
      if (directMatch || slugMatch) {
        const dom = asRecord(r.domestic);
        const ovs = asRecord(r.overseas);
        const domSel = dom ? (Array.isArray(dom.selections) ? dom.selections : []) : [];
        const ovsSel = ovs ? (Array.isArray(ovs.selections) ? ovs.selections : []) : [];
        const domHome = domSel.find((s: unknown) => asRecord(s) && asString((asRecord(s) as Record<string, unknown>).selectionCode) === "HOME");
        const domAway = domSel.find((s: unknown) => asRecord(s) && asString((asRecord(s) as Record<string, unknown>).selectionCode) === "AWAY");
        const ovsHome = ovsSel.find((s: unknown) => asRecord(s) && asString((asRecord(s) as Record<string, unknown>).selectionCode) === "HOME");
        const ovsAway = ovsSel.find((s: unknown) => asRecord(s) && asString((asRecord(s) as Record<string, unknown>).selectionCode) === "AWAY");
        return {
          domestic: dom ? {
            home: domHome ? asNumber((asRecord(domHome) as Record<string, unknown>).odds) : null,
            away: domAway ? asNumber((asRecord(domAway) as Record<string, unknown>).odds) : null,
          } : null,
          overseas: ovs ? {
            home: ovsHome ? asNumber((asRecord(ovsHome) as Record<string, unknown>).odds) : null,
            away: ovsAway ? asNumber((asRecord(ovsAway) as Record<string, unknown>).odds) : null,
          } : null,
          homeTeam: asString(r.homeTeam),
          awayTeam: asString(r.awayTeam),
          dateKst: asString(r.dateKst),
          startTimeKst: asString(r.startTimeKst),
          pathRel: rel,
        };
      }
    }
  }
  return null;
}

async function findKboStarterForGame(
  gameId: string,
  resolvedInternalId: string | null,
): Promise<{
  home: { name: string | null; status: string | null };
  away: { name: string | null; status: string | null };
  pathRel: string;
} | null> {
  const files = await listJsonFiles("data/operator-input/kbo");
  const starterFiles = files.filter((p) => p.includes("starter-confirmation-v1.json"));
  for (const rel of starterFiles.sort().reverse()) {
    const doc = asRecord(await readJson(rel));
    if (!doc) continue;
    const games = Array.isArray(doc.games) ? doc.games : [];
    for (const raw of games) {
      const g = asRecord(raw);
      if (!g) continue;
      const iid = asString(g.internalGameId) ?? "";
      const home = asString(g.homeTeam);
      const away = asString(g.awayTeam);
      const directMatch = iid === gameId || (resolvedInternalId && iid === resolvedInternalId);
      const slugMatch = home && away && buildGameId("KBO", home, away) === gameId;
      if (directMatch || slugMatch) {
        const hs = asRecord(g.homeStarter);
        const as_ = asRecord(g.awayStarter);
        return {
          home: { name: hs ? asString(hs.playerName) : null, status: hs ? asString(hs.starterStatus) : null },
          away: { name: as_ ? asString(as_.playerName) : null, status: as_ ? asString(as_.starterStatus) : null },
          pathRel: rel,
        };
      }
    }
  }
  return null;
}

async function findKboLineupForGame(
  resolvedInternalId: string | null,
): Promise<{
  reviewStatus: string | null;
  home: Record<string, unknown> | null;
  away: Record<string, unknown> | null;
  pathRel: string;
} | null> {
  if (!resolvedInternalId) return null;
  const files = await listJsonFiles("data/operator-input/kbo");
  const lineupFiles = files.filter((p) => p.includes("lineup-confirmation-v1.json"));
  for (const rel of lineupFiles.sort().reverse()) {
    const doc = asRecord(await readJson(rel));
    if (!doc) continue;
    const games = Array.isArray(doc.games) ? doc.games : [];
    for (const raw of games) {
      const game = asRecord(raw);
      if (!game) continue;
      if (asString(game.internalGameId) !== resolvedInternalId) continue;
      return {
        reviewStatus: asString(game.reviewStatus),
        home: asRecord(game.homeLineup),
        away: asRecord(game.awayLineup),
        pathRel: rel,
      };
    }
  }
  return null;
}

async function findKboScheduleGameInfo(
  gameId: string,
): Promise<{
  internalGameId: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamKo: string | null;
  awayTeamKo: string | null;
  dateKst: string | null;
  startTimeKst: string | null;
  league: string;
  pathRel: string;
} | null> {
  const files = await listJsonFiles("data/research/kbo");
  const schedFiles = files.filter((p) => p.includes("schedule-result-identity"));
  for (const rel of schedFiles.sort().reverse()) {
    const doc = asRecord(await readJson(rel));
    if (!doc) continue;
    const rows = Array.isArray(doc.rows) ? doc.rows : [];
    for (const raw of rows) {
      const r = asRecord(raw);
      if (!r) continue;
      const iid = asString(r.internalGameId) ?? asString(r.gameId) ?? "";
      const ht = asRecord(r.homeTeam);
      const at = asRecord(r.awayTeam);
      const homeEn = ht ? asString(ht.canonicalNameEn) ?? asString(ht.providerName) : null;
      const awayEn = at ? asString(at.canonicalNameEn) ?? asString(at.providerName) : null;
      const homeKo = ht ? asString(ht.canonicalNameKo) : (typeof r.homeTeam === "string" ? r.homeTeam as string : null);
      const awayKo = at ? asString(at.canonicalNameKo) : (typeof r.awayTeam === "string" ? r.awayTeam as string : null);

      const directMatch = iid === gameId;
      const slugMatch = homeEn && awayEn && buildGameId("KBO", homeEn, awayEn) === gameId;
      const slugMatchKo = homeKo && awayKo && buildGameId("KBO", homeKo, awayKo) === gameId;

      if (directMatch || slugMatch || slugMatchKo) {
        const timeBlock = asRecord(r.time);
        return {
          internalGameId: iid,
          homeTeam: homeEn,
          awayTeam: awayEn,
          homeTeamKo: homeKo,
          awayTeamKo: awayKo,
          dateKst: asString(r.dateKst),
          startTimeKst: timeBlock ? asString(timeBlock.startTimeKst) : asString(r.scheduledStartTimeKst),
          league: "KBO",
          pathRel: rel,
        };
      }
    }
  }
  return null;
}

export async function loadResearchAnalysisView(
  gameId: string,
): Promise<ResearchAnalysisView> {
  const normalized = (gameId ?? "").trim();
  const isKbo = normalized.startsWith("kbo-");
  const found = await findPrediction(normalized);

  const dateKst = found ? asString(found.pred.dateKst) : null;
  const researchGameId =
    (found ? asString(found.pred.gameId) : null) ?? normalized;

  const starter = await findStarterRows(researchGameId, dateKst);
  const bullpen = await findBullpenGame(researchGameId, dateKst);
  const lineup = await findLineupRows(researchGameId, dateKst);
  const dayReview = found
    ? await findReviewGame(researchGameId, dateKst)
    : null;
  const successFlow = found
    ? await findFlowGame("success", researchGameId, dateKst)
    : null;
  const failureFlow = found
    ? await findFlowGame("failure", researchGameId, dateKst)
    : null;

  // KBO-specific artifact lookups — resolve schedule first to get internalGameId
  const kboScheduleInfo = isKbo ? await findKboScheduleGameInfo(normalized) : null;
  const resolvedKboId = kboScheduleInfo?.internalGameId ?? null;
  const kboOdds = isKbo ? await findKboOddsForGame(normalized, resolvedKboId) : null;
  const kboStarter = isKbo ? await findKboStarterForGame(normalized, resolvedKboId) : null;
  const kboLineup = isKbo ? await findKboLineupForGame(resolvedKboId) : null;

  let homeTeam = found ? asString(found.pred.homeTeam) : null;
  let awayTeam = found ? asString(found.pred.awayTeam) : null;
  let league = found ? asString(found.pred.league) : null;
  let startTimeKst = found ? asString(found.pred.startTimeKst) : null;
  let gameDateKst = dateKst;

  // Fill from KBO artifacts if prediction is missing
  if (!found && isKbo) {
    if (kboScheduleInfo) {
      homeTeam = homeTeam ?? kboScheduleInfo.homeTeamKo ?? kboScheduleInfo.homeTeam;
      awayTeam = awayTeam ?? kboScheduleInfo.awayTeamKo ?? kboScheduleInfo.awayTeam;
      gameDateKst = gameDateKst ?? kboScheduleInfo.dateKst;
      startTimeKst = startTimeKst ?? kboScheduleInfo.startTimeKst;
      league = "KBO";
    }
    if (kboOdds) {
      homeTeam = homeTeam ?? kboOdds.homeTeam;
      awayTeam = awayTeam ?? kboOdds.awayTeam;
      gameDateKst = gameDateKst ?? kboOdds.dateKst;
      startTimeKst = startTimeKst ?? kboOdds.startTimeKst;
      league = "KBO";
    }
  }

  const matchLabel =
    homeTeam && awayTeam
      ? `${awayTeam} @ ${homeTeam}`
      : normalized || "Unknown game";

  const hasAnyGameInfo = homeTeam != null || awayTeam != null;

  const gameInfo = found || hasAnyGameInfo
    ? {
        availability: "COLLECTED" as const,
        league,
        homeTeam,
        awayTeam,
        dateKst: gameDateKst,
        startTimeKst,
        matchLabel,
      }
    : {
        availability: "AWAITING_RESEARCH" as const,
        league: null,
        homeTeam: null,
        awayTeam: null,
        dateKst: null,
        startTimeKst: null,
        matchLabel,
      };

  const isFinishedGame = found ? isFinishedPrediction(found.pred) : false;
  const missingAvail = missingExpectedArtifact(isFinishedGame);
  const starterMetrics = starterMetricsFromPrediction(found?.pred ?? null);

  const prediction = found
    ? collected(asString(found.pred.baselinePick) ?? "—", "Prediction")
    : awaiting<string>("Prediction");

  let startingPitchers: ResearchAnalysisView["startingPitchers"];
  if (starter && starter.rows.length > 0) {
    const home = starter.rows.find((r) => asString(r.side) === "home");
    const away = starter.rows.find((r) => asString(r.side) === "away");
    startingPitchers = collected(
      {
        home: {
          name: home ? asString(home.probablePitcherName) : null,
          status: home ? asString(home.probableStatus) : null,
        },
        away: {
          name: away ? asString(away.probablePitcherName) : null,
          status: away ? asString(away.probableStatus) : null,
        },
        identityAvailable: "COLLECTED",
        metricsAtPrediction: starterMetrics.metrics,
        metricsLabel: starterMetrics.label,
      },
      "Starting Pitchers",
    );
  } else if (kboStarter) {
    startingPitchers = collected(
      {
        home: { name: kboStarter.home.name, status: kboStarter.home.status },
        away: { name: kboStarter.away.name, status: kboStarter.away.status },
        identityAvailable: "COLLECTED",
        metricsAtPrediction: "UNKNOWN",
        metricsLabel: "KBO Operator Input",
      },
      "Starting Pitchers",
    );
  } else if (found) {
    startingPitchers = unavailable(missingAvail, "Starting Pitchers");
  } else {
    startingPitchers = notCollected("Starting Pitchers");
  }

  let bullpenStatus: ResearchAnalysisView["bullpenStatus"];
  if (bullpen) {
    const pick = asRecord(bullpen.game.pick);
    const opp = asRecord(bullpen.game.opp);
    bullpenStatus = collected(
      {
        overallRoleComparison: asString(bullpen.game.overallRoleComparison),
        pickTeam: pick ? asString(pick.teamName) : null,
        oppTeam: opp ? asString(opp.teamName) : null,
      },
      "Bullpen Status",
    );
  } else if (found) {
    bullpenStatus = unavailable(missingAvail, "Bullpen Status");
  } else {
    bullpenStatus = notCollected("Bullpen Status");
  }

  const starterDataAvailable: FieldAvailability = starter
    ? "COLLECTED"
    : found
      ? missingAvail
      : "NOT_COLLECTED";
  const bullpenDataAvailable: FieldAvailability = bullpen
    ? "COLLECTED"
    : found
      ? missingAvail
      : "NOT_COLLECTED";
  const starterIdentityAvailable: FieldAvailability = starter
    ? "COLLECTED"
    : starterDataAvailable;

  let starterStatusLabel: string | null = null;
  if (starter && starter.rows.length > 0) {
    const statuses = starter.rows
      .map((r) => {
        const post = asRecord(r.postGameReview);
        return asString(post?.status) ?? asString(r.probableStatus);
      })
      .filter((s): s is string => !!s);
    starterStatusLabel =
      statuses.length > 0 ? [...new Set(statuses)].join(" · ") : null;
  }

  const bullpenStatusLabel = bullpen
    ? asString(bullpen.game.overallRoleComparison)
    : null;

  const researchCompleteness = `Starter identity: ${availabilityText(starterIdentityAvailable)} · Starter metrics@prediction: ${starterMetrics.label} · Bullpen: ${availabilityText(bullpenDataAvailable)}`;

  const pitchingSnapshot =
    found || starter || bullpen
      ? collected(
          {
            starterStatus: starterStatusLabel,
            bullpenStatus: bullpenStatusLabel,
            starterDataAvailable,
            bullpenDataAvailable,
            starterIdentityAvailable,
            starterMetricsAtPrediction: starterMetrics.metrics,
            starterMetricsLabel: starterMetrics.label,
            researchCompleteness,
          },
          "Pitching Snapshot",
        )
      : notCollected<{
          starterStatus: string | null;
          bullpenStatus: string | null;
          starterDataAvailable: FieldAvailability;
          bullpenDataAvailable: FieldAvailability;
          starterIdentityAvailable: FieldAvailability;
          starterMetricsAtPrediction: StarterMetricsAtPrediction;
          starterMetricsLabel: string;
          researchCompleteness: string;
        }>("Pitching Snapshot");

  const probability = found
    ? asNumber(found.pred.modelProbability) != null
      ? collected(asNumber(found.pred.modelProbability)!, "Probability")
      : notCollected<number>("Probability")
    : awaiting<number>("Probability");

  const confidence = found
    ? asNumber(found.pred.confidence) != null
      ? collected(asNumber(found.pred.confidence)!, "Confidence")
      : notCollected<number>("Confidence")
    : awaiting<number>("Confidence");

  const edgeScore = found
    ? asNumber(found.pred.edgeScore) != null
      ? collected(asNumber(found.pred.edgeScore)!, "EDGE Score")
      : notCollected<number>("EDGE Score")
    : awaiting<number>("EDGE Score");

  const valueEdgeNum = found ? asNumber(found.pred.valueEdge) : null;
  const valueEdge = found
    ? valueEdgeNum != null
      ? collected(valueEdgeNum, "Value Edge")
      : notCollected<number>("Value Edge")
    : awaiting<number>("Value Edge");

  let marketOdds: ResearchAnalysisView["marketOdds"];
  if (found) {
    const openingOdds = asNumber(found.pred.openingOdds);
    const latestOdds = asNumber(found.pred.latestOdds);
    const oddsMovement = asString(found.pred.oddsMovement);
    const marketProbability = asNumber(found.pred.marketProbability);
    const any =
      openingOdds != null ||
      latestOdds != null ||
      oddsMovement != null ||
      marketProbability != null;
    marketOdds = any
      ? collected(
          { openingOdds, latestOdds, oddsMovement, marketProbability },
          "Market Odds",
        )
      : notCollected("Market Odds");
  } else if (kboOdds) {
    marketOdds = collected(
      {
        openingOdds: kboOdds.domestic?.home ?? null,
        latestOdds: kboOdds.overseas?.home ?? null,
        oddsMovement: null,
        marketProbability: null,
      },
      "Market Odds",
    );
  } else {
    marketOdds = awaiting("Market Odds");
  }

  const snapshotGeneratedAt = found
    ? collected(
        asString(found.meta.generatedAt) ??
          asString(found.pred.predictedAt) ??
          "—",
        "Snapshot 생성 시각",
      )
    : awaiting<string>("Snapshot 생성 시각");

  /** Display-only integrity hash of immutable prediction fields (does not mutate snapshot). */
  const predictionHash = found
    ? collected(immutablePredictionHash(found.pred), "Prediction Hash")
    : awaiting<string>("Prediction Hash");

  let successReview: ResearchField<SuccessReviewValue> | null = null;
  let failureReview: ResearchField<FailureReviewValue> | null = null;
  let learningSummary: ResearchField<LearningSummaryValue> | null = null;

  if (found && isFinishedGame) {
    const feedback = asString(found.pred.feedbackClassification);

    if (successFlow) {
      const st = asRecord(successFlow.game.successTypes);
      successReview = collected(
        {
          primary: st
            ? asString(st.primary)
            : asString(successFlow.game.primary),
          secondary: st
            ? asStringArray(st.secondary)
            : asStringArray(successFlow.game.secondary),
          note: asString(successFlow.game.note),
          match: asString(successFlow.game.match),
        },
        "Success Review",
      );
    } else if (feedback === "SIGNAL_WORKED") {
      successReview = unavailable(missingAvail, "Success Review");
    } else {
      successReview = null;
    }

    if (failureFlow) {
      /**
       * Failure flow nests causes under failureTypes / starters / bullpen
       * (same pattern as successTypes). Top-level primary is only on
       * importantFailures summaries — games[] uses nested fields.
       */
      const failureTypes = asRecord(failureFlow.game.failureTypes);
      const startersBlock = asRecord(failureFlow.game.starters);
      const bullpenBlock = asRecord(failureFlow.game.bullpen);
      const primary =
        (failureTypes ? asString(failureTypes.primary) : null) ??
        asString(failureFlow.game.primary);
      const secondary = failureTypes
        ? asStringArray(failureTypes.secondary)
        : asStringArray(failureFlow.game.secondary);
      const starterVerdict =
        (startersBlock ? asString(startersBlock.starterVerdict) : null) ??
        asString(failureFlow.game.starterVerdict);
      const bullpenVerdict =
        (bullpenBlock
          ? (asString(bullpenBlock.verdict) ??
            asString(bullpenBlock.bullpenVerdict))
          : null) ?? asString(failureFlow.game.bullpenVerdict);
      const noClassifiedCause =
        primary == null &&
        secondary.length === 0 &&
        starterVerdict == null &&
        bullpenVerdict == null;

      failureReview = collected(
        {
          primary,
          secondary,
          starterVerdict,
          bullpenVerdict,
          match: asString(failureFlow.game.match),
          noClassifiedCause,
        },
        "Failure Review",
      );
    } else if (feedback === "SIGNAL_FAILED") {
      failureReview = unavailable(missingAvail, "Failure Review");
    } else {
      failureReview = null;
    }

    if (dayReview) {
      const rawHypotheses = asStringArray(dayReview.game.hypotheses);
      let hypotheses = mapReviewHypothesesDisplay(rawHypotheses);

      /** Drop learning lines that duplicate Failure Review Korean labels. */
      if (failureReview?.availability === "COLLECTED" && failureReview.value) {
        const dup = new Set<string>();
        const pushDup = (code: string | null) => {
          if (!code) return;
          const ko = mapStatusCodeKo(code);
          if (ko) dup.add(ko);
          dup.add(code);
        };
        pushDup(failureReview.value.primary);
        for (const s of failureReview.value.secondary) pushDup(s);
        pushDup(failureReview.value.starterVerdict);
        pushDup(failureReview.value.bullpenVerdict);
        hypotheses = hypotheses.filter((h) => !dup.has(h));
      }

      learningSummary = collected(
        {
          feedbackClassification: asString(
            dayReview.game.feedbackClassification,
          ),
          predictionHit: asBoolean(dayReview.game.predictionHit),
          reviewNotes: asStringArray(dayReview.game.reviewNotes),
          hypotheses,
          homeScore: asNumber(dayReview.game.homeScore),
          awayScore: asNumber(dayReview.game.awayScore),
          predictionTimeBasisNote: "예측 당시 기준",
        },
        "Learning Summary",
      );
    } else {
      learningSummary = unavailable(missingAvail, "Learning Summary");
    }
  }

  let actualLineup: ResearchField<ActualLineupValue> | null = null;
  if (isFinishedGame) {
    if (lineup) {
      actualLineup = collected(
        buildActualLineupValue(lineup.rows),
        "Actual Starting Lineup",
      );
    } else {
      actualLineup = unavailable(missingAvail, "Actual Starting Lineup");
    }
  }

  let confirmedLineup: ResearchAnalysisView["confirmedLineup"] = null;
  if (kboLineup) {
    const sideFromManual = (
      side: Record<string, unknown> | null,
    ): ActualLineupSide | null => {
      if (!side) return null;
      const rawBatters = Array.isArray(side.batters) ? side.batters : [];
      const batters = rawBatters
        .map((raw) => asRecord(raw))
        .filter((row): row is Record<string, unknown> => !!row)
        .map((row) => ({
          slot: asNumber(row.slot) ?? 0,
          playerName: asString(row.playerName) ?? "—",
          defensivePosition: asString(row.position),
          isDh: false,
        }))
        .filter((row) => row.slot > 0)
        .sort((a, b) => a.slot - b.slot);
      return {
        teamName: asString(side.team),
        lineupStatus: asString(side.status),
        batters,
      };
    };
    confirmedLineup = collected(
      {
        reviewStatus: kboLineup.reviewStatus ?? "UNKNOWN",
        home: sideFromManual(kboLineup.home),
        away: sideFromManual(kboLineup.away),
      },
      "Confirmed Lineup",
    );
  }

  const statusResult = computeResearchStatus({
    hasPrediction: !!found,
    hasStarter: !!starter || !!kboStarter,
    hasBullpen: !!bullpen,
    isFinishedGame,
    hasDayReview: !!dayReview,
    hasSuccessFlow: !!successFlow,
    hasFailureFlow: !!failureFlow,
    feedback: found
      ? asString(found.pred.feedbackClassification)
      : null,
  });

  // ---- Research Score ----
  const scoreItems: { label: string; score: number; max: number; status: "OK" | "MISSING" }[] = [];
  const hasDomesticOdds = kboOdds?.domestic != null || (found && asNumber(found.pred.openingOdds) != null);
  const hasOverseasOdds = kboOdds?.overseas != null || (found && asNumber(found.pred.latestOdds) != null);
  const hasStarterData = !!starter || !!kboStarter;
  const hasLineupData = !!lineup || !!kboLineup;
  const hasPrediction = !!found;

  scoreItems.push({ label: "국내 배당", score: hasDomesticOdds ? 20 : 0, max: 20, status: hasDomesticOdds ? "OK" : "MISSING" });
  scoreItems.push({ label: "해외 배당", score: hasOverseasOdds ? 20 : 0, max: 20, status: hasOverseasOdds ? "OK" : "MISSING" });
  scoreItems.push({ label: "선발", score: hasStarterData ? 20 : 0, max: 20, status: hasStarterData ? "OK" : "MISSING" });
  scoreItems.push({ label: "라인업", score: hasLineupData ? 20 : 0, max: 20, status: hasLineupData ? "OK" : "MISSING" });
  scoreItems.push({ label: "Prediction", score: hasPrediction ? 20 : 0, max: 20, status: hasPrediction ? "OK" : "MISSING" });

  const totalScore = scoreItems.reduce((s, i) => s + i.score, 0);
  const scoreLabel = totalScore === 100 ? "READY" as const
    : totalScore >= 40 ? "PARTIAL" as const
    : totalScore > 0 ? "BLOCKED" as const
    : "UNKNOWN" as const;

  // ---- Odds Comparison ----
  const dh = kboOdds?.domestic?.home ?? (found ? asNumber(found.pred.openingOdds) : null);
  const da = kboOdds?.domestic?.away ?? null;
  const oh = kboOdds?.overseas?.home ?? (found ? asNumber(found.pred.latestOdds) : null);
  const oa = kboOdds?.overseas?.away ?? null;
  const oddsComparison = {
    available: dh != null || oh != null,
    domesticHome: dh,
    domesticAway: da,
    overseasHome: oh,
    overseasAway: oa,
    diffHome: dh != null && oh != null ? Math.round((dh - oh) * 100) / 100 : null,
    diffAway: da != null && oa != null ? Math.round((da - oa) * 100) / 100 : null,
  };

  // ---- Data Freshness ----
  const dataFreshness: { label: string; updatedAt: string | null }[] = [];
  dataFreshness.push({ label: "시장 배당", updatedAt: kboOdds?.pathRel ? null : (found ? asString(found.meta.generatedAt) : null) });
  dataFreshness.push({ label: "선발", updatedAt: starter?.pathRel ? null : (kboStarter?.pathRel ? null : null) });
  dataFreshness.push({ label: "Prediction", updatedAt: found ? (asString(found.meta.generatedAt) ?? asString(found.pred.predictedAt)) : null });

  // Try to get actual file timestamps from artifact paths
  // For now use generatedAt from meta where available

  // ---- Timeline ----
  const timeline: { time: string; event: string }[] = [];
  if (kboOdds?.pathRel) {
    timeline.push({ time: "—", event: "Odds Comparison 생성" });
  }
  if (starter?.pathRel || kboStarter?.pathRel) {
    timeline.push({ time: "—", event: "Starter 생성" });
  }
  if (found) {
    const genAt = asString(found.meta.generatedAt) ?? asString(found.pred.predictedAt);
    timeline.push({ time: genAt ? new Date(genAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—", event: "Prediction 생성" });
  }

  return {
    version: "research-analysis-viewer-v1",
    gameId: found
      ? (asString(found.pred.gameId) ?? normalized)
      : normalized,
    researchStatus: statusResult.status,
    researchStatusNote: statusResult.note,
    sampleNotice: SAMPLE_NOTICE,
    isFinishedGame,
    gameInfo,
    prediction,
    pitchingSnapshot,
    probability,
    confidence,
    edgeScore,
    valueEdge,
    startingPitchers,
    bullpenStatus,
    marketOdds,
    snapshotGeneratedAt,
    predictionHash,
    confirmedLineup,
    successReview,
    failureReview,
    learningSummary,
    actualLineup,
    researchScore: {
      total: totalScore,
      max: 100,
      items: scoreItems,
      overallLabel: scoreLabel,
    },
    oddsComparison,
    dataFreshness,
    timeline,
    sources: {
      predictionPath: found?.pathRel ?? null,
      starterPath: starter?.pathRel ?? kboStarter?.pathRel ?? null,
      bullpenPath: bullpen?.pathRel ?? null,
      lineupPath: kboLineup?.pathRel ?? lineup?.pathRel ?? null,
      reviewPath: dayReview?.pathRel ?? null,
      successFlowPath: successFlow?.pathRel ?? null,
      failureFlowPath: failureFlow?.pathRel ?? null,
      oddsPath: kboOdds?.pathRel ?? null,
      schedulePath: kboScheduleInfo?.pathRel ?? null,
    },
  };
}
