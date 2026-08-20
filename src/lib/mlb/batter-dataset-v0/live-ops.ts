/**
 * MLB Batter Dataset v0 — daily pregame research sidecar.
 *
 * Not a Daily Pregame stage. Prediction does not read this output.
 * Independent model sample stays 0.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertBatterDatasetIntegrity,
  buildBatterDatasetV0,
  loadBatterDatasetSources,
  resolveSideSlots,
  type BatterDatasetSources,
  type BuildBatterDatasetInput,
  type ScheduleGame,
} from "./build";
import {
  BATTER_FETCH_GATE_POLICY,
  evaluateFullSlateFetchGate,
  type BatterFetchGate,
} from "./cutoff";
import { mlbBatterDatasetAbs } from "./paths";
import type {
  BatterDatasetDocument,
  BatterReconstructionSafety,
} from "./types";

export const BATTER_LIVE_OPS_VERSION = "mlb-batter-pregame-ops-v0";

export type BatterLiveOpsStatus =
  | "PREGAME_SAFE"
  | "PREGAME_PARTIAL"
  | "NOT_READY"
  | "CUTOFF_CLOSED"
  | "NOT_BACKFILLABLE_V0";

export type BatterLineupReadinessCounts = {
  confirmedPreGame: number;
  expectedPreGame: number;
  unavailable: number;
};

export type BatterLeakageCounts = {
  sameDayExcluded: number;
  targetGameExcluded: number;
  postgameLineupExcluded: number;
};

export type BatterPregameOpsSummary = {
  schemaVersion: typeof BATTER_LIVE_OPS_VERSION;
  dateKst: string;
  games: number;
  fetchGate: BatterFetchGate;
  lineup: BatterLineupReadinessCounts;
  lineupArtifactExists: boolean;
  expectedLineupArtifactExists: boolean;
  batterSlots: number;
  playerIds: number;
  uniquePlayerIds: number;
  batsResolved: number;
  statsReady: number;
  partial: number;
  blocked: number;
  providerUniquePlayers: number;
  providerCalls: number;
  expectedProviderCallsIfLive: number;
  cacheHits: number;
  failures: number;
  leakage: BatterLeakageCounts;
  datasetStatus: BatterLiveOpsStatus;
  datasetHash: string | null;
  reconstructionSafety: BatterReconstructionSafety | null;
  independentModelSample: 0;
  predictionExecuted: false;
  marketUsed: false;
  dryRun: boolean;
  written: boolean;
  skippedImmutable: boolean;
  canBuild: boolean;
  canFetch: boolean;
  readyRequiresOfficialPregamePlayerId: true;
  notes: string[];
};

export type RunBatterPregameOpsInput = {
  dateKst: string;
  cwd?: string;
  nowMs?: number;
  generatedAt?: string;
  dryRun?: boolean;
  sources?: BatterDatasetSources;
  statLookup?: BuildBatterDatasetInput["statLookup"];
};

async function exists(abs: string): Promise<boolean> {
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
}

async function readExistingDocument(
  abs: string,
): Promise<BatterDatasetDocument | null> {
  try {
    const raw = await readFile(abs, "utf8");
    return JSON.parse(raw) as BatterDatasetDocument;
  } catch {
    return null;
  }
}

function countLineupStatuses(
  games: ScheduleGame[],
  sources: BatterDatasetSources,
): {
  lineup: BatterLineupReadinessCounts;
  uniquePlayerIds: Set<number>;
  slotPlayerIds: number;
  postgameExcludedSides: number;
} {
  const lineup: BatterLineupReadinessCounts = {
    confirmedPreGame: 0,
    expectedPreGame: 0,
    unavailable: 0,
  };
  const uniquePlayerIds = new Set<number>();
  let slotPlayerIds = 0;
  let postgameExcludedSides = 0;
  const rows = sources.lineupDoc?.rows ?? [];
  for (const game of games) {
    for (const side of ["home", "away"] as const) {
      const resolved = resolveSideSlots({
        lineupRows: rows,
        expected: sources.expectedObs,
        gamePk: game.gamePk,
        side,
      });
      if (resolved.status === "CONFIRMED") lineup.confirmedPreGame += 1;
      else if (resolved.status === "EXPECTED") lineup.expectedPreGame += 1;
      else lineup.unavailable += 1;
      if (resolved.warnings.includes("POSTGAME_LINEUP_EXCLUDED")) {
        postgameExcludedSides += 1;
      }
      for (const slot of resolved.slots) {
        if (typeof slot.playerId === "number") {
          uniquePlayerIds.add(slot.playerId);
          slotPlayerIds += 1;
        }
      }
    }
  }
  return { lineup, uniquePlayerIds, slotPlayerIds, postgameExcludedSides };
}

function lineupFromDocument(
  doc: BatterDatasetDocument,
): BatterLineupReadinessCounts {
  const lineup: BatterLineupReadinessCounts = {
    confirmedPreGame: 0,
    expectedPreGame: 0,
    unavailable: 0,
  };
  for (const game of doc.games) {
    for (const side of [game.home, game.away]) {
      if (side.lineupStatus === "CONFIRMED") lineup.confirmedPreGame += 1;
      else if (side.lineupStatus === "EXPECTED") lineup.expectedPreGame += 1;
      else lineup.unavailable += 1;
    }
  }
  return lineup;
}

function leakageFromDocument(doc: BatterDatasetDocument): BatterLeakageCounts {
  let sameDayExcluded = 0;
  let targetGameExcluded = 0;
  let postgameLineupExcluded = 0;
  for (const game of doc.games) {
    if (game.warnings.includes("POSTGAME_LINEUP_EXCLUDED")) {
      postgameLineupExcluded += 1;
    }
    for (const slot of [...game.home.batters, ...game.away.batters]) {
      if (slot.warnings.includes("SAME_DAY_OR_LATER_EXCLUDED")) {
        sameDayExcluded += 1;
      }
      if (slot.warnings.includes("TARGET_GAME_EXCLUDED_FROM_STATS")) {
        targetGameExcluded += 1;
      }
    }
  }
  return { sameDayExcluded, targetGameExcluded, postgameLineupExcluded };
}

function confirmedPlayerIdStats(doc: BatterDatasetDocument): {
  slots: number;
  readyOrPartial: number;
  blocked: number;
  missingStats: number;
} {
  let slots = 0;
  let readyOrPartial = 0;
  let blocked = 0;
  let missingStats = 0;
  for (const game of doc.games) {
    for (const side of [game.home, game.away]) {
      if (side.lineupStatus !== "CONFIRMED") continue;
      for (const slot of side.batters) {
        if (slot.playerId == null) continue;
        slots += 1;
        if (slot.rowStatus === "READY" || slot.rowStatus === "PARTIAL") {
          readyOrPartial += 1;
        } else if (
          slot.rowStatus === "CUTOFF_UNSAFE" ||
          slot.rowStatus === "PROVIDER_ERROR"
        ) {
          blocked += 1;
        } else if (slot.rowStatus === "STATS_MISSING") {
          missingStats += 1;
        }
      }
    }
  }
  return { slots, readyOrPartial, blocked, missingStats };
}

export function deriveBatterLiveOpsStatus(input: {
  fetchWindow: BatterFetchGate["window"];
  scheduleExists: boolean;
  gameCount: number;
  reconstructionSafety: BatterReconstructionSafety | null;
  uniquePlayerIds: number;
  confirmedPreGame: number;
  integrityPass: boolean;
  confirmedPlayerIdSlots: number;
  confirmedReadyOrPartial: number;
  confirmedBlocked: number;
  confirmedMissingStats: number;
  cutoffUnsafe: number;
}): BatterLiveOpsStatus {
  if (
    input.reconstructionSafety === "NOT_BACKFILLABLE_V0" ||
    input.reconstructionSafety === "HISTORICAL_RECONSTRUCTION_UNSAFE"
  ) {
    return "NOT_BACKFILLABLE_V0";
  }
  if (input.reconstructionSafety === "PREGAME_SAFE") {
    if (input.cutoffUnsafe > 0 || input.confirmedBlocked > 0) {
      return "PREGAME_PARTIAL";
    }
    if (input.confirmedMissingStats > 0) return "PREGAME_PARTIAL";
    if (
      input.confirmedPlayerIdSlots > 0 &&
      input.confirmedReadyOrPartial === 0
    ) {
      return "PREGAME_PARTIAL";
    }
    if (input.uniquePlayerIds === 0 || input.confirmedPreGame === 0) {
      return "PREGAME_PARTIAL";
    }
    return "PREGAME_SAFE";
  }
  if (input.fetchWindow === "CLOSED") {
    return "CUTOFF_CLOSED";
  }
  if (!input.scheduleExists || input.gameCount <= 0) return "NOT_READY";
  if (!input.integrityPass) return "NOT_READY";
  if (input.uniquePlayerIds === 0 || input.confirmedPreGame === 0) {
    return "NOT_READY";
  }
  if (input.cutoffUnsafe > 0 || input.confirmedBlocked > 0) {
    return "PREGAME_PARTIAL";
  }
  if (
    input.confirmedPlayerIdSlots > 0 &&
    input.confirmedMissingStats > 0
  ) {
    return "PREGAME_PARTIAL";
  }
  if (
    input.confirmedPlayerIdSlots > 0 &&
    input.confirmedReadyOrPartial === 0
  ) {
    return "PREGAME_PARTIAL";
  }
  return "PREGAME_SAFE";
}

function emptySummary(input: {
  dateKst: string;
  dryRun: boolean;
}): BatterPregameOpsSummary {
  return {
    schemaVersion: BATTER_LIVE_OPS_VERSION,
    dateKst: input.dateKst,
    games: 0,
    fetchGate: {
      policy: BATTER_FETCH_GATE_POLICY,
      window: "CLOSED",
      firstCommenceUtc: null,
      commencedCount: 0,
      remainingCount: 0,
      slateFullyPregame: false,
    },
    lineup: {
      confirmedPreGame: 0,
      expectedPreGame: 0,
      unavailable: 0,
    },
    lineupArtifactExists: false,
    expectedLineupArtifactExists: false,
    batterSlots: 0,
    playerIds: 0,
    uniquePlayerIds: 0,
    batsResolved: 0,
    statsReady: 0,
    partial: 0,
    blocked: 0,
    providerUniquePlayers: 0,
    providerCalls: 0,
    expectedProviderCallsIfLive: 0,
    cacheHits: 0,
    failures: 0,
    leakage: {
      sameDayExcluded: 0,
      targetGameExcluded: 0,
      postgameLineupExcluded: 0,
    },
    datasetStatus: "NOT_READY",
    datasetHash: null,
    reconstructionSafety: null,
    independentModelSample: 0,
    predictionExecuted: false,
    marketUsed: false,
    dryRun: input.dryRun,
    written: false,
    skippedImmutable: false,
    canBuild: false,
    canFetch: false,
    readyRequiresOfficialPregamePlayerId: true,
    notes: [],
  };
}

function summaryFromDocument(input: {
  dateKst: string;
  dryRun: boolean;
  fetchGate: BatterFetchGate;
  doc: BatterDatasetDocument;
  lineupArtifactExists: boolean;
  expectedLineupArtifactExists: boolean;
  scheduleExists: boolean;
  skippedImmutable: boolean;
  written: boolean;
  uniquePlayerIdsFromPlan?: number;
}): BatterPregameOpsSummary {
  const integrity = assertBatterDatasetIntegrity(input.doc);
  const confirmed = confirmedPlayerIdStats(input.doc);
  const status = deriveBatterLiveOpsStatus({
    fetchWindow: input.fetchGate.window,
    scheduleExists: input.scheduleExists,
    gameCount: input.doc.summary.totalGames,
    reconstructionSafety: input.doc.meta.reconstructionSafety,
    uniquePlayerIds: input.doc.meta.uniquePlayerIds,
    confirmedPreGame: lineupFromDocument(input.doc).confirmedPreGame,
    integrityPass: integrity.length === 0,
    confirmedPlayerIdSlots: confirmed.slots,
    confirmedReadyOrPartial: confirmed.readyOrPartial,
    confirmedBlocked: confirmed.blocked,
    confirmedMissingStats: confirmed.missingStats,
    cutoffUnsafe: input.doc.summary.cutoffUnsafe,
  });
  const unique =
    input.uniquePlayerIdsFromPlan ?? input.doc.meta.uniquePlayerIds;
  return {
    schemaVersion: BATTER_LIVE_OPS_VERSION,
    dateKst: input.dateKst,
    games: input.doc.summary.totalGames,
    fetchGate: input.fetchGate,
    lineup: lineupFromDocument(input.doc),
    lineupArtifactExists: input.lineupArtifactExists,
    expectedLineupArtifactExists: input.expectedLineupArtifactExists,
    batterSlots: input.doc.summary.totalBatterSlots,
    playerIds: input.doc.summary.joinedPlayerIds,
    uniquePlayerIds: input.doc.meta.uniquePlayerIds,
    batsResolved: input.doc.summary.batsResolved,
    statsReady: input.doc.summary.statsReady,
    partial: input.doc.summary.partial,
    blocked: input.doc.summary.blocked,
    providerUniquePlayers: input.doc.meta.uniquePlayerIds,
    providerCalls: input.doc.cacheUsage.networkCalls,
    expectedProviderCallsIfLive: unique * 2,
    cacheHits: input.doc.cacheUsage.rawHit,
    failures: input.doc.summary.providerError,
    leakage: leakageFromDocument(input.doc),
    datasetStatus: status,
    datasetHash: input.doc.meta.datasetHashSha256,
    reconstructionSafety: input.doc.meta.reconstructionSafety,
    independentModelSample: 0,
    predictionExecuted: false,
    marketUsed: false,
    dryRun: input.dryRun,
    written: input.written,
    skippedImmutable: input.skippedImmutable,
    canBuild: input.scheduleExists && input.doc.summary.totalGames > 0,
    canFetch:
      input.fetchGate.window === "OPEN" &&
      unique > 0 &&
      !input.skippedImmutable,
    readyRequiresOfficialPregamePlayerId: true,
    notes: liveOpsNotes(status),
  };
}

function liveOpsNotes(status: BatterLiveOpsStatus): string[] {
  return [
    "Research sidecar. Prediction does not read this dataset.",
    "READY stats require official PRE_GAME confirmed lineup (or a legally allowed stable playerId). Expected name+bats is never auto-joined.",
    `Fetch policy ${BATTER_FETCH_GATE_POLICY}.`,
    `Live status ${status}.`,
    "Independent model sample = 0. Market unused.",
  ];
}

export function formatBatterPregameOpsSummary(
  summary: BatterPregameOpsSummary,
): string {
  const hash = summary.datasetHash ? summary.datasetHash.slice(0, 16) : "(none)";
  return [
    "MLB BATTER PREGAME v0",
    "",
    `Date: ${summary.dateKst}`,
    `Games: ${summary.games}`,
    `Before-first-pitch gate: ${summary.fetchGate.window} (${summary.fetchGate.policy})`,
    `First commence: ${summary.fetchGate.firstCommenceUtc ?? "(none)"}`,
    `Schedule: ${summary.canBuild ? "YES" : "NO"}`,
    `Lineup artifact: ${summary.lineupArtifactExists ? "YES" : "NO"}`,
    `Expected lineup artifact: ${summary.expectedLineupArtifactExists ? "YES" : "NO"}`,
    `PlayerId available: ${summary.uniquePlayerIds > 0 ? "YES" : "NO"}`,
    `Expected provider calls if live: ${summary.expectedProviderCallsIfLive}`,
    `canBuild: ${summary.canBuild ? "YES" : "NO"}`,
    `canFetch: ${summary.canFetch ? "YES" : "NO"}`,
    "Lineup:",
    `- CONFIRMED_PRE_GAME: ${summary.lineup.confirmedPreGame}`,
    `- EXPECTED_PRE_GAME: ${summary.lineup.expectedPreGame}`,
    `- UNAVAILABLE: ${summary.lineup.unavailable}`,
    "",
    `Batter slots: ${summary.batterSlots}`,
    `Player IDs: ${summary.playerIds} (unique ${summary.uniquePlayerIds})`,
    `Bats resolved: ${summary.batsResolved}`,
    `Stats READY: ${summary.statsReady}`,
    `PARTIAL: ${summary.partial}`,
    `BLOCKED: ${summary.blocked}`,
    "",
    `Provider unique players: ${summary.providerUniquePlayers}`,
    `Provider calls: ${summary.providerCalls}`,
    `Cache hits: ${summary.cacheHits}`,
    `Failures: ${summary.failures}`,
    "",
    "Leakage:",
    `- SAME_DAY_EXCLUDED: ${summary.leakage.sameDayExcluded}`,
    `- TARGET_GAME_EXCLUDED: ${summary.leakage.targetGameExcluded}`,
    `- POSTGAME_LINEUP_EXCLUDED: ${summary.leakage.postgameLineupExcluded}`,
    "",
    "Dataset:",
    `Status: ${summary.datasetStatus}`,
    `Hash: ${hash}`,
    `Written: ${summary.written ? "YES" : "NO"}${summary.skippedImmutable ? " (immutable skip)" : ""}`,
    `Dry-run: ${summary.dryRun ? "YES" : "NO"}`,
    "",
    "READY requires official PRE_GAME confirmed lineup or a stable playerId.",
    "Expected name+bats is not READY and is not fuzzy-matched.",
    "",
    "Independent model sample: 0",
    "Prediction executed: NO",
    "Market used: NO",
    "",
  ].join("\n");
}

function isSealedReconstruction(
  safety: BatterReconstructionSafety | null | undefined,
): boolean {
  return (
    safety === "PREGAME_SAFE" ||
    safety === "NOT_BACKFILLABLE_V0" ||
    safety === "HISTORICAL_RECONSTRUCTION_UNSAFE"
  );
}

export async function runBatterPregameOps(
  input: RunBatterPregameOpsInput,
): Promise<BatterPregameOpsSummary> {
  const cwd = input.cwd ?? process.cwd();
  const dryRun = input.dryRun === true;
  const nowMs = input.nowMs ?? Date.now();
  const outAbs = mlbBatterDatasetAbs(input.dateKst, cwd);
  const existing = (await exists(outAbs))
    ? await readExistingDocument(outAbs)
    : null;

  const sources =
    input.sources ??
    (await loadBatterDatasetSources({ dateKst: input.dateKst, cwd }));
  const scheduleExists = sources.scheduleGames.length > 0;
  const fetchGate = evaluateFullSlateFetchGate(
    sources.scheduleGames.map((g) => g.commenceTimeUtc),
    nowMs,
  );
  const plan = countLineupStatuses(sources.scheduleGames, sources);
  const expectedCalls = plan.uniquePlayerIds.size * 2;
  const canBuild = scheduleExists;
  const canFetch =
    !dryRun &&
    fetchGate.window === "OPEN" &&
    plan.uniquePlayerIds.size > 0 &&
    existing == null;

  const lineupArtifactExists = Boolean(sources.lineupDoc);
  const expectedLineupArtifactExists = Boolean(sources.expectedObs);

  if (existing) {
    const summary = summaryFromDocument({
      dateKst: input.dateKst,
      dryRun,
      fetchGate,
      doc: existing,
      lineupArtifactExists,
      expectedLineupArtifactExists,
      scheduleExists,
      skippedImmutable: isSealedReconstruction(existing.meta.reconstructionSafety),
      written: false,
      uniquePlayerIdsFromPlan: plan.uniquePlayerIds.size,
    });
    summary.canBuild = canBuild;
    summary.canFetch = false;
    summary.notes.push(
      "Existing batter dataset is write-once. Live ops will not overwrite it with later season stats.",
    );
    return summary;
  }

  if (dryRun) {
    const status: BatterLiveOpsStatus =
      fetchGate.window === "CLOSED"
        ? "CUTOFF_CLOSED"
        : "NOT_READY";
    const summary = emptySummary({ dateKst: input.dateKst, dryRun: true });
    summary.games = sources.scheduleGames.length;
    summary.fetchGate = fetchGate;
    summary.lineup = plan.lineup;
    summary.lineupArtifactExists = lineupArtifactExists;
    summary.expectedLineupArtifactExists = expectedLineupArtifactExists;
    summary.batterSlots = sources.scheduleGames.length * 18;
    summary.playerIds = plan.slotPlayerIds;
    summary.uniquePlayerIds = plan.uniquePlayerIds.size;
    summary.providerUniquePlayers = plan.uniquePlayerIds.size;
    summary.providerCalls = 0;
    summary.expectedProviderCallsIfLive = expectedCalls;
    summary.cacheHits = 0;
    summary.leakage.postgameLineupExcluded = plan.postgameExcludedSides;
    summary.datasetStatus = status;
    summary.canBuild = canBuild;
    summary.canFetch = fetchGate.window === "OPEN" && plan.uniquePlayerIds.size > 0;
    summary.notes = liveOpsNotes(status);
    return summary;
  }

  if (fetchGate.window === "CLOSED") {
    const summary = emptySummary({ dateKst: input.dateKst, dryRun: false });
    summary.games = sources.scheduleGames.length;
    summary.fetchGate = fetchGate;
    summary.lineup = plan.lineup;
    summary.lineupArtifactExists = lineupArtifactExists;
    summary.expectedLineupArtifactExists = expectedLineupArtifactExists;
    summary.batterSlots = sources.scheduleGames.length * 18;
    summary.playerIds = plan.slotPlayerIds;
    summary.uniquePlayerIds = plan.uniquePlayerIds.size;
    summary.providerUniquePlayers = plan.uniquePlayerIds.size;
    summary.expectedProviderCallsIfLive = expectedCalls;
    summary.leakage.postgameLineupExcluded = plan.postgameExcludedSides;
    summary.datasetStatus = "CUTOFF_CLOSED";
    summary.canBuild = canBuild;
    summary.canFetch = false;
    summary.notes = liveOpsNotes("CUTOFF_CLOSED");
    summary.notes.push(
      "Live provider fetch refused. v0 does not backfill a commenced slate from current season aggregates.",
    );
    return summary;
  }

  if (plan.uniquePlayerIds.size === 0) {
    const summary = emptySummary({ dateKst: input.dateKst, dryRun: false });
    summary.games = sources.scheduleGames.length;
    summary.fetchGate = fetchGate;
    summary.lineup = plan.lineup;
    summary.lineupArtifactExists = lineupArtifactExists;
    summary.expectedLineupArtifactExists = expectedLineupArtifactExists;
    summary.batterSlots = sources.scheduleGames.length * 18;
    summary.datasetStatus = "NOT_READY";
    summary.canBuild = canBuild;
    summary.canFetch = false;
    summary.expectedProviderCallsIfLive = 0;
    summary.leakage.postgameLineupExcluded = plan.postgameExcludedSides;
    summary.notes = liveOpsNotes("NOT_READY");
    summary.notes.push(
      "No playerId on pregame-safe lineup rows. Not written, so a later confirmed PRE_GAME lineup can still be frozen before first pitch.",
    );
    return summary;
  }

  const generatedAt = input.generatedAt || new Date().toISOString();
  const { document } = await buildBatterDatasetV0({
    dateKst: input.dateKst,
    cwd,
    generatedAt,
    nowMs,
    allowNetwork: canFetch && input.statLookup == null,
    sources,
    statLookup: input.statLookup,
  });
  const errors = assertBatterDatasetIntegrity(document);
  if (errors.length > 0) {
    throw new Error(`batter dataset integrity: ${errors.join("; ")}`);
  }

  await mkdir(path.dirname(outAbs), { recursive: true });
  await writeFile(outAbs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  return summaryFromDocument({
    dateKst: input.dateKst,
    dryRun: false,
    fetchGate,
    doc: document,
    lineupArtifactExists,
    expectedLineupArtifactExists,
    scheduleExists,
    skippedImmutable: false,
    written: true,
    uniquePlayerIdsFromPlan: plan.uniquePlayerIds.size,
  });
}
