/**
 * Read-only audit of MLB pregame artifacts for a KST date.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  groupMlbDatasetRowsByEventId,
  mlbEventIdForDatasetRow,
  mlbIdentityFromScheduleGame,
  type MlbScheduleIdentityGame,
} from "../event-identity";

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
  duplicateMatchupIds: string[];
  warnings: string[];
  games: Array<{
    /** Operational event id (`mlb-game-${gamePk}`). */
    gameId: string;
    eventId: string;
    matchupId: string;
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
    duplicateMatchupIds: [],
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
  const seenEvent = new Map<string, number>();
  const seenMatchup = new Map<string, number>();
  const duplicateGameIds: string[] = [];
  const duplicateMatchupIds: string[] = [];
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
    const identity = mlbIdentityFromScheduleGame(g);
    if (!identity) {
      warnings.push("SCHEDULE_GAME_MISSING_ID");
      continue;
    }
    seenEvent.set(identity.eventId, (seenEvent.get(identity.eventId) ?? 0) + 1);
    if (identity.matchupId) {
      seenMatchup.set(
        identity.matchupId,
        (seenMatchup.get(identity.matchupId) ?? 0) + 1,
      );
    }
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
      gameId: identity.eventId,
      eventId: identity.eventId,
      matchupId: identity.matchupId,
      gamePk: identity.gamePk,
      homeTeam: asString(g.homeTeam) ?? "",
      awayTeam: asString(g.awayTeam) ?? "",
      commenceTimeUtc: commence,
      status,
    });
  }
  for (const [id, n] of seenEvent) {
    if (n > 1) duplicateGameIds.push(id);
  }
  for (const [id, n] of seenMatchup) {
    if (n > 1) duplicateMatchupIds.push(id);
  }
  if (duplicateGameIds.length) warnings.push("DUPLICATE_GAME_IDS");
  if (duplicateMatchupIds.length) warnings.push("DUPLICATE_MATCHUP_IDS");

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
    duplicateMatchupIds,
    warnings,
    games,
  };
}

function identityFromAuditGames(
  scheduleGames: Array<{
    eventId?: string;
    gameId: string;
    gamePk: number | null;
    matchupId?: string;
  }>,
): MlbScheduleIdentityGame[] {
  return scheduleGames.map((g) => ({
    eventId: g.eventId ?? g.gameId,
    gamePk: g.gamePk,
    matchupId: g.matchupId ?? "",
  }));
}

export type LineupSlateClass =
  | "NOT_COLLECTED"
  | "NOT_RELEASED"
  | "PARTIAL"
  | "CONFIRMED_COMPLETE";

export type DatasetAudit = {
  exists: boolean;
  path: string;
  hash: string | null;
  rows: number;
  collectedGames: number;
  generatedAt: string | null;
  observedAt: string | null;
  warnings: string[];
  detail: Record<string, unknown>;
};

function betterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function metaGeneratedAt(doc: Record<string, unknown> | null): string | null {
  const meta = asRecord(doc?.meta);
  return asString(meta?.generatedAt) ?? asString(doc?.generatedAt);
}

export async function auditStarter(
  dateKst: string,
  cwd: string,
  scheduleGameIds: string[],
  scheduleGames: Array<{
    eventId?: string;
    gameId: string;
    gamePk: number | null;
    matchupId?: string;
  }> = [],
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
      generatedAt: null,
      observedAt: null,
      warnings: ["STARTER_ARTIFACT_MISSING"],
      detail: {},
    };
  }
  const doc = asRecord(loaded.data);
  const generatedAt = metaGeneratedAt(doc) ?? loaded.mtime;
  const rows = asArr(doc?.rows);
  const summary = asRecord(doc?.summary);
  const identity = identityFromAuditGames(
    scheduleGames.length
      ? scheduleGames
      : scheduleGameIds.map((id) => ({
          eventId: id,
          gameId: id,
          gamePk: null,
          matchupId: "",
        })),
  );
  const { byEventId, ambiguousRows } = groupMlbDatasetRowsByEventId(
    rows,
    identity,
  );
  let bothSides = 0;
  for (const id of scheduleGameIds) {
    const list = byEventId.get(id) ?? [];
    const sides = new Set(
      list.map((r) => asString(r.side)).filter((s): s is string => Boolean(s)),
    );
    if (sides.has("home") && sides.has("away")) bothSides++;
  }
  const warnings: string[] = [];
  if ((asNumber(summary?.targetGameIncludedInStats) ?? 0) > 0) {
    warnings.push("STARTER_TARGET_GAME_IN_STATS");
  }
  if ((asNumber(summary?.cutoffViolations) ?? 0) > 0) {
    warnings.push("STARTER_CUTOFF_VIOLATIONS");
  }
  if (ambiguousRows > 0) warnings.push("IDENTITY_AMBIGUOUS");
  return {
    exists: true,
    path: rel,
    hash: loaded.hash,
    rows: rows.length,
    collectedGames: byEventId.size,
    generatedAt,
    observedAt: generatedAt,
    warnings,
    detail: {
      bothSidesReady: bothSides,
      scheduleGames: scheduleGameIds.length,
      identityAmbiguousRows: ambiguousRows,
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
  scheduleGames: Array<{
    eventId?: string;
    gameId: string;
    gamePk: number | null;
    matchupId?: string;
  }> = [],
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
      generatedAt: null,
      observedAt: null,
      warnings: ["ODDS_ARTIFACT_MISSING"],
      detail: {},
    };
  }
  const doc = asRecord(loaded.data);
  const generatedAt = metaGeneratedAt(doc) ?? loaded.mtime;
  const rows = asArr(doc?.rows);
  const identity = identityFromAuditGames(
    scheduleGames.length
      ? scheduleGames
      : scheduleGameIds.map((id) => ({
          eventId: id,
          gameId: id,
          gamePk: null,
          matchupId: "",
        })),
  );
  const want = new Set(scheduleGameIds);
  let collected = 0;
  let completeMl = 0;
  let afterCutoff = 0;
  let identityAmbiguousRows = 0;
  let observedAt: string | null = generatedAt;
  const collectedEvents = new Set<string>();
  const completeMlEvents = new Set<string>();
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) continue;
    const resolved = mlbEventIdForDatasetRow(r, identity);
    if (resolved.ambiguous) {
      identityAmbiguousRows += 1;
      continue;
    }
    const id = resolved.eventId;
    if (!id || !want.has(id)) continue;
    if (asString(r?.collectionStatus) === "COLLECTED") {
      collectedEvents.add(id);
    }
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
    if (home != null && away != null && home > 1 && away > 1) {
      completeMlEvents.add(id);
    }
    const captured = asString(r?.capturedAt);
    const cutoff = asString(r?.cutoffTime);
    observedAt = betterIso(
      observedAt,
      captured ?? asString(r?.fetchedAt) ?? asString(r?.artifactGeneratedAt),
    );
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
  collected = collectedEvents.size;
  completeMl = completeMlEvents.size;
  const warnings: string[] = [];
  if (afterCutoff > 0) warnings.push("ODDS_AFTER_CUTOFF_ROWS");
  if (completeMl < scheduleGameIds.length) {
    warnings.push("ODDS_MONEYLINE_INCOMPLETE_SLATE");
  }
  if (identityAmbiguousRows > 0) warnings.push("IDENTITY_AMBIGUOUS");
  return {
    exists: true,
    path: rel,
    hash: loaded.hash,
    rows: rows.length,
    collectedGames: collected,
    generatedAt,
    observedAt,
    warnings,
    detail: {
      moneylineCompleteGames: completeMl,
      afterCutoffRows: afterCutoff,
      scheduleGames: scheduleGameIds.length,
      identityAmbiguousRows,
      oddsFormat: asString(doc?.oddsFormat) ?? "DECIMAL",
    },
  };
}

export function classifyLineupGameRows(
  rows: Record<string, unknown>[],
): LineupSlateClass {
  if (rows.length === 0) return "NOT_COLLECTED";
  const confirmedComplete =
    rows.length >= 2 &&
    rows.every(
      (row) =>
        asString(row.collectionStatus) === "CONFIRMED" &&
        asString(row.lineupStatus) === "COMPLETE",
    );
  if (confirmedComplete) return "CONFIRMED_COMPLETE";
  const statuses = rows.map((row) => asString(row.collectionStatus));
  const lineupStatuses = rows.map((row) => asString(row.lineupStatus));
  if (statuses.some((s) => s === "NOT_RELEASED") || statuses.every((s) => !s)) {
    return "NOT_RELEASED";
  }
  if (
    statuses.some((s) => s === "PARTIAL") ||
    lineupStatuses.some((s) => s === "INCOMPLETE")
  ) {
    return "PARTIAL";
  }
  return "PARTIAL";
}

export function classifyLineupSlate(input: {
  confirmedCompleteGames: number;
  partialGames: number;
  notReleasedGames: number;
  notCollectedGames: number;
  scheduleGames: number;
}): LineupSlateClass {
  if (input.scheduleGames === 0 && input.confirmedCompleteGames === 0) {
    return "NOT_COLLECTED";
  }
  if (input.partialGames > 0) return "PARTIAL";
  if (input.notReleasedGames > 0 || input.notCollectedGames > 0) {
    return "NOT_RELEASED";
  }
  if (
    input.confirmedCompleteGames > 0 &&
    input.confirmedCompleteGames >= input.scheduleGames
  ) {
    return "CONFIRMED_COMPLETE";
  }
  return "NOT_COLLECTED";
}

export async function auditLineup(
  dateKst: string,
  cwd: string,
  scheduleGameIds: string[],
  scheduleGames: Array<{
    eventId?: string;
    gameId: string;
    gamePk: number | null;
    matchupId?: string;
  }> = [],
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
      generatedAt: null,
      observedAt: null,
      warnings: ["LINEUP_ARTIFACT_MISSING"],
      detail: {
        confirmedCompleteGames: 0,
        partialGames: 0,
        notReleasedGames: 0,
        notCollectedGames: scheduleGameIds.length,
        notConfirmedOrMissing: scheduleGameIds.length,
        slateClass: "NOT_COLLECTED" satisfies LineupSlateClass,
        scheduleGames: scheduleGameIds.length,
        identityAmbiguousRows: 0,
      },
    };
  }
  const doc = asRecord(loaded.data);
  const generatedAt = metaGeneratedAt(doc) ?? loaded.mtime;
  const rows = asArr(doc?.rows);
  const identity = identityFromAuditGames(
    scheduleGames.length
      ? scheduleGames
      : scheduleGameIds.map((id) => ({
          eventId: id,
          gameId: id,
          gamePk: null,
          matchupId: "",
        })),
  );
  const { byEventId, ambiguousRows } = groupMlbDatasetRowsByEventId(
    rows,
    identity,
  );
  let observedAt: string | null = generatedAt;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) continue;
    observedAt = betterIso(
      observedAt,
      asString(r?.generatedAt) ??
        asString(r?.sourceTimestamp) ??
        asString(r?.fetchedAt) ??
        asString(r?.artifactGeneratedAt) ??
        asString(r?.lineupConfirmedAt),
    );
  }
  let confirmed = 0;
  let partial = 0;
  let notReleased = 0;
  let notCollected = 0;
  for (const id of scheduleGameIds) {
    const klass = classifyLineupGameRows(byEventId.get(id) ?? []);
    if (klass === "CONFIRMED_COMPLETE") confirmed++;
    else if (klass === "PARTIAL") partial++;
    else if (klass === "NOT_RELEASED") notReleased++;
    else notCollected++;
  }
  const slateClass = classifyLineupSlate({
    confirmedCompleteGames: confirmed,
    partialGames: partial,
    notReleasedGames: notReleased,
    notCollectedGames: notCollected,
    scheduleGames: scheduleGameIds.length,
  });
  const notConfirmedOrMissing = scheduleGameIds.length - confirmed;
  const warnings: string[] = [];
  if (confirmed < scheduleGameIds.length) warnings.push("LINEUP_NOT_FULLY_CONFIRMED");
  if (ambiguousRows > 0) warnings.push("IDENTITY_AMBIGUOUS");
  return {
    exists: true,
    path: rel,
    hash: loaded.hash,
    rows: rows.length,
    collectedGames: byEventId.size,
    generatedAt,
    observedAt,
    warnings,
    detail: {
      confirmedCompleteGames: confirmed,
      partialGames: partial,
      notReleasedGames: notReleased,
      notCollectedGames: notCollected,
      notConfirmedOrMissing,
      slateClass,
      scheduleGames: scheduleGameIds.length,
      identityAmbiguousRows: ambiguousRows,
    },
  };
}

export async function auditPredictionSnapshot(
  dateKst: string,
  cwd: string,
): Promise<{
  exists: boolean;
  path: string;
  generatedAt: string | null;
  hash: string | null;
}> {
  const rel = artifactPaths(dateKst).prediction;
  const loaded = await readJson(rel, cwd);
  if (!loaded.ok) {
    return { exists: false, path: rel, generatedAt: null, hash: null };
  }
  const doc = asRecord(loaded.data);
  const predictions = asArr(doc?.predictions);
  return {
    exists: predictions.length > 0,
    path: rel,
    generatedAt: metaGeneratedAt(doc),
    hash: loaded.hash,
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
