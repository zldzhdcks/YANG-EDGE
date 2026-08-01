/**
 * Read-only audit of MLB pregame artifacts for a KST date.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
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

export function artifactPaths(dateKst: string) {
  const research = "data/research/mlb";
  return {
    schedule: `${research}/${dateKst}-schedule-v1.json`,
    starter: `${research}/${dateKst}-starter-dataset-v1.json`,
    odds: `${research}/${dateKst}-odds-history-dataset-v1.json`,
    lineup: `${research}/${dateKst}-lineup-dataset-v1.json`,
    summary: `${research}/${dateKst}-daily-research-summary-v1.json`,
    prediction: `data/predictions/mlb/${dateKst}.json`,
    results: `${research}/${dateKst}-official-results-v1.json`,
    domesticMarkets: `data/operator-input/mlb/${dateKst}-domestic-markets-v1.json`,
  };
}

async function readJson(
  rel: string,
  cwd: string,
): Promise<{ ok: true; data: unknown; hash: string; mtime: string | null } | { ok: false }> {
  const abs = path.join(cwd, rel);
  try {
    const raw = await readFile(abs, "utf8");
    const hash = createHash("sha256").update(raw).digest("hex");
    let mtime: string | null = null;
    try {
      mtime = (await stat(abs)).mtime.toISOString();
    } catch {
      /* ignore */
    }
    return { ok: true, data: JSON.parse(raw) as unknown, hash, mtime };
  } catch {
    return { ok: false };
  }
}

export type ScheduleAudit = {
  exists: boolean;
  path: string;
  hash: string | null;
  dateKstMatch: boolean;
  totalGames: number;
  pregameGames: number;
  cancelled: number;
  postponed: number;
  started: number;
  final: number;
  earliestStart: string | null;
  latestStart: string | null;
  duplicateGameIds: string[];
  warnings: string[];
  games: Array<{
    gameId: string;
    gamePk: number | null;
    homeTeam: string;
    awayTeam: string;
    commenceTimeUtc: string | null;
    status: string;
  }>;
};

export async function auditSchedule(
  dateKst: string,
  cwd: string,
): Promise<ScheduleAudit> {
  const rel = artifactPaths(dateKst).schedule;
  const loaded = await readJson(rel, cwd);
  const empty: ScheduleAudit = {
    exists: false,
    path: rel,
    hash: null,
    dateKstMatch: false,
    totalGames: 0,
    pregameGames: 0,
    cancelled: 0,
    postponed: 0,
    started: 0,
    final: 0,
    earliestStart: null,
    latestStart: null,
    duplicateGameIds: [],
    warnings: ["SCHEDULE_ARTIFACT_MISSING"],
    games: [],
  };
  if (!loaded.ok) return empty;

  const doc = asRecord(loaded.data);
  const meta = asRecord(doc?.meta);
  const docDate =
    asString(doc?.dateKst) ??
    asString(doc?.date) ??
    asString(meta?.dateKst);
  const dateKstMatch = docDate === dateKst;
  const warnings: string[] = [];
  if (!dateKstMatch) warnings.push("SCHEDULE_DATE_MISMATCH");

  const rawGames = asArr(doc?.games);
  const seen = new Map<string, number>();
  const duplicateGameIds: string[] = [];
  const games: ScheduleAudit["games"] = [];
  let cancelled = 0;
  let postponed = 0;
  let started = 0;
  let final = 0;
  let pregameGames = 0;
  const starts: string[] = [];

  for (const raw of rawGames) {
    const g = asRecord(raw);
    if (!g) continue;
    const gameId =
      asString(g.internalGameId) ?? asString(g.gameId) ?? "";
    if (!gameId) {
      warnings.push("SCHEDULE_GAME_MISSING_ID");
      continue;
    }
    seen.set(gameId, (seen.get(gameId) ?? 0) + 1);
    const commence = asString(g.commenceTimeUtc);
    if (commence) starts.push(commence);
    const status =
      asString(g.statusDetailed) ??
      asString(g.statusAbstract) ??
      asString(g.status) ??
      "UNKNOWN";
    const st = status.toUpperCase();
    if (st.includes("CANCEL")) cancelled++;
    else if (st.includes("POSTPON")) postponed++;
    else if (st.includes("FINAL") || st === "F") final++;
    else if (
      st.includes("LIVE") ||
      st.includes("IN_PROGRESS") ||
      st === "I"
    ) {
      started++;
    } else {
      pregameGames++;
    }
    games.push({
      gameId,
      gamePk: asNumber(g.gamePk),
      homeTeam: asString(g.homeTeam) ?? "",
      awayTeam: asString(g.awayTeam) ?? "",
      commenceTimeUtc: commence,
      status,
    });
  }
  for (const [id, n] of seen) {
    if (n > 1) duplicateGameIds.push(id);
  }
  if (duplicateGameIds.length) warnings.push("DUPLICATE_GAME_IDS");

  starts.sort();
  return {
    exists: true,
    path: rel,
    hash: loaded.hash,
    dateKstMatch,
    totalGames: games.length,
    pregameGames,
    cancelled,
    postponed,
    started,
    final,
    earliestStart: starts[0] ?? null,
    latestStart: starts[starts.length - 1] ?? null,
    duplicateGameIds,
    warnings,
    games,
  };
}

export type DatasetAudit = {
  exists: boolean;
  path: string;
  hash: string | null;
  rows: number;
  collectedGames: number;
  warnings: string[];
  detail: Record<string, unknown>;
};

export async function auditStarter(
  dateKst: string,
  cwd: string,
  scheduleGameIds: string[],
): Promise<DatasetAudit> {
  const rel = artifactPaths(dateKst).starter;
  const loaded = await readJson(rel, cwd);
  if (!loaded.ok) {
    return {
      exists: false,
      path: rel,
      hash: null,
      rows: 0,
      collectedGames: 0,
      warnings: ["STARTER_ARTIFACT_MISSING"],
      detail: {},
    };
  }
  const doc = asRecord(loaded.data);
  const rows = asArr(doc?.rows);
  const summary = asRecord(doc?.summary);
  const byGame = new Set<string>();
  let bothSides = 0;
  const sides = new Map<string, Set<string>>();
  for (const raw of rows) {
    const r = asRecord(raw);
    const id = asString(r?.gameId);
    const side = asString(r?.side);
    if (!id || !side) continue;
    byGame.add(id);
    const set = sides.get(id) ?? new Set();
    set.add(side);
    sides.set(id, set);
  }
  for (const id of scheduleGameIds) {
    const s = sides.get(id);
    if (s?.has("home") && s?.has("away")) bothSides++;
  }
  const warnings: string[] = [];
  if ((asNumber(summary?.targetGameIncludedInStats) ?? 0) > 0) {
    warnings.push("STARTER_TARGET_GAME_IN_STATS");
  }
  if ((asNumber(summary?.cutoffViolations) ?? 0) > 0) {
    warnings.push("STARTER_CUTOFF_VIOLATIONS");
  }
  return {
    exists: true,
    path: rel,
    hash: loaded.hash,
    rows: rows.length,
    collectedGames: byGame.size,
    warnings,
    detail: {
      bothSidesReady: bothSides,
      scheduleGames: scheduleGameIds.length,
      targetGameIncludedInStats:
        asNumber(summary?.targetGameIncludedInStats) ?? 0,
      cutoffViolations: asNumber(summary?.cutoffViolations) ?? 0,
    },
  };
}

export async function auditOdds(
  dateKst: string,
  cwd: string,
  scheduleGameIds: string[],
): Promise<DatasetAudit> {
  const rel = artifactPaths(dateKst).odds;
  const loaded = await readJson(rel, cwd);
  if (!loaded.ok) {
    return {
      exists: false,
      path: rel,
      hash: null,
      rows: 0,
      collectedGames: 0,
      warnings: ["ODDS_ARTIFACT_MISSING"],
      detail: {},
    };
  }
  const doc = asRecord(loaded.data);
  const rows = asArr(doc?.rows);
  let collected = 0;
  let completeMl = 0;
  let afterCutoff = 0;
  for (const raw of rows) {
    const r = asRecord(raw);
    const id = asString(r?.gameId);
    if (!id || !scheduleGameIds.includes(id)) continue;
    if (asString(r?.collectionStatus) === "COLLECTED") collected++;
    const markets = asArr(r?.markets);
    let home: number | null = null;
    let away: number | null = null;
    for (const m of markets) {
      const mr = asRecord(m);
      if (asString(mr?.marketType) !== "moneyline") continue;
      const sel = asString(mr?.selection);
      const price = asNumber(mr?.priceDecimal);
      if (sel === "home") home = price;
      if (sel === "away") away = price;
    }
    if (home != null && away != null && home > 1 && away > 1) completeMl++;
    const captured = asString(r?.capturedAt);
    const cutoff = asString(r?.cutoffTime);
    if (
      captured &&
      cutoff &&
      Number.isFinite(Date.parse(captured)) &&
      Number.isFinite(Date.parse(cutoff)) &&
      Date.parse(captured) >= Date.parse(cutoff)
    ) {
      afterCutoff++;
    }
  }
  const warnings: string[] = [];
  if (afterCutoff > 0) warnings.push("ODDS_AFTER_CUTOFF_ROWS");
  if (completeMl < scheduleGameIds.length) {
    warnings.push("ODDS_MONEYLINE_INCOMPLETE_SLATE");
  }
  return {
    exists: true,
    path: rel,
    hash: loaded.hash,
    rows: rows.length,
    collectedGames: collected,
    warnings,
    detail: {
      moneylineCompleteGames: completeMl,
      afterCutoffRows: afterCutoff,
      scheduleGames: scheduleGameIds.length,
      oddsFormat: asString(doc?.oddsFormat) ?? "DECIMAL",
    },
  };
}

export async function auditLineup(
  dateKst: string,
  cwd: string,
  scheduleGameIds: string[],
): Promise<DatasetAudit> {
  const rel = artifactPaths(dateKst).lineup;
  const loaded = await readJson(rel, cwd);
  if (!loaded.ok) {
    return {
      exists: false,
      path: rel,
      hash: null,
      rows: 0,
      collectedGames: 0,
      warnings: ["LINEUP_ARTIFACT_MISSING"],
      detail: { confirmedCompleteGames: 0 },
    };
  }
  const doc = asRecord(loaded.data);
  const rows = asArr(doc?.rows);
  const byGame = new Map<string, Record<string, unknown>[]>();
  for (const raw of rows) {
    const r = asRecord(raw);
    const id = asString(r?.gameId);
    if (!r || !id) continue;
    const list = byGame.get(id) ?? [];
    list.push(r);
    byGame.set(id, list);
  }
  let confirmed = 0;
  let notReleased = 0;
  for (const id of scheduleGameIds) {
    const list = byGame.get(id) ?? [];
    if (list.length === 0) {
      notReleased++;
      continue;
    }
    const ok =
      list.length >= 2 &&
      list.every(
        (row) =>
          asString(row.collectionStatus) === "CONFIRMED" &&
          asString(row.lineupStatus) === "COMPLETE",
      );
    if (ok) confirmed++;
    else notReleased++;
  }
  return {
    exists: true,
    path: rel,
    hash: loaded.hash,
    rows: rows.length,
    collectedGames: byGame.size,
    warnings:
      confirmed < scheduleGameIds.length ? ["LINEUP_NOT_FULLY_CONFIRMED"] : [],
    detail: {
      confirmedCompleteGames: confirmed,
      notConfirmedOrMissing: notReleased,
      scheduleGames: scheduleGameIds.length,
    },
  };
}

export async function auditSummary(
  dateKst: string,
  cwd: string,
): Promise<{ exists: boolean; path: string; hash: string | null }> {
  const rel = artifactPaths(dateKst).summary;
  const loaded = await readJson(rel, cwd);
  if (!loaded.ok) return { exists: false, path: rel, hash: null };
  return { exists: true, path: rel, hash: loaded.hash };
}

export type DomesticMarketsAudit = {
  exists: boolean;
  path: string;
  hash: string | null;
  mappedGames: number;
  moneylineAvailable: boolean;
  totalsAvailable: boolean;
  runLineAvailable: boolean;
  unresolvedRows: number;
  namespace: string | null;
  doesNotReplaceOverseasPrior: boolean;
  warnings: string[];
};

export async function auditDomesticMarkets(
  dateKst: string,
  cwd: string,
): Promise<DomesticMarketsAudit> {
  const rel = artifactPaths(dateKst).domesticMarkets;
  const loaded = await readJson(rel, cwd);
  if (!loaded.ok) {
    return {
      exists: false,
      path: rel,
      hash: null,
      mappedGames: 0,
      moneylineAvailable: false,
      totalsAvailable: false,
      runLineAvailable: false,
      unresolvedRows: 0,
      namespace: null,
      doesNotReplaceOverseasPrior: true,
      warnings: ["DOMESTIC_MARKETS_MISSING"],
    };
  }
  const doc = asRecord(loaded.data);
  const meta = asRecord(doc?.meta);
  const summary = asRecord(doc?.summary);
  const moneylineComplete = asNumber(summary?.moneylineComplete) ?? 0;
  const totalsComplete = asNumber(summary?.totalsComplete) ?? 0;
  const runLineComplete = asNumber(summary?.runLineComplete) ?? 0;
  return {
    exists: true,
    path: rel,
    hash: loaded.hash,
    mappedGames: asNumber(summary?.mappedGames) ?? 0,
    moneylineAvailable: moneylineComplete > 0,
    totalsAvailable: totalsComplete > 0,
    runLineAvailable: runLineComplete > 0,
    unresolvedRows: asNumber(meta?.unresolvedRows) ?? 0,
    namespace: asString(meta?.namespace),
    doesNotReplaceOverseasPrior:
      meta?.doesNotReplaceOverseasPrior === true,
    warnings:
      (asNumber(summary?.unmappedScheduleGames) ?? 0) > 0
        ? ["DOMESTIC_SCHEDULE_GAMES_UNMAPPED"]
        : [],
  };
}
