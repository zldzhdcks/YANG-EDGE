import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMlbScheduleArtifact } from "../build-mlb-schedule-artifact";
import { mlbBatterDatasetAbs } from "../batter-dataset-v0/paths";
import {
  captureBatterPregameGameIfEligible,
  batterPregameGameExists,
  type BatterPregameStatLookup,
} from "./capture";
import { classifyBoxscoreBody, resolveRefreshTemporalProvenance, selectAdmissiblePregameSnapshot } from "./select";
import {
  hashLineupPayload,
  listLineupObservations,
  listLineupPayloadHashes,
  observationIdFor,
  writeLineupObservation,
  latestConfirmedPregameObservation,
} from "./store";
import {
  mlbBatterPregameGameRel,
  mlbBatterPregameManifestAbs,
  mlbLineupPayloadRel,
  mlbLineupRefreshManifestAbs,
} from "./paths";
import type {
  BatterPregameGameCaptureV1,
  BatterPregameManifestV1,
  LineupGameRefreshRowV1,
  LineupRawSnapshotV1,
  LineupRefreshManifestV1,
  LineupRefreshSkipReason,
} from "./types";
import {
  LATEST_ADMISSIBLE_PREGAME_SNAPSHOT_RULE,
  LINEUP_CACHE_POLICY,
  LINEUP_OBSERVATION_SCHEMA,
  LINEUP_REFRESH_MANIFEST_SCHEMA,
  LINEUP_REFRESH_MODE,
  BATTER_PREGAME_MANIFEST_SCHEMA,
} from "./types";

const STATS_API_BASE = "https://statsapi.mlb.com";

export type LineupRefreshFetchResult = {
  ok: boolean;
  status: number;
  body: unknown;
  fetchedAt: string;
  sourceTimestamp?: string | null;
};

export type LineupRefreshFetchFn = (input: {
  gamePk: number;
  endpoint: string;
}) => Promise<LineupRefreshFetchResult>;

export async function fetchBoxscoreLive(input: {
  gamePk: number;
  endpoint: string;
}): Promise<LineupRefreshFetchResult> {
  const fetchedAt = new Date().toISOString();
  const res = await fetch(`${STATS_API_BASE}${input.endpoint}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      body: null,
      fetchedAt,
      sourceTimestamp: null,
    };
  }
  const body = await res.json();
  return {
    ok: true,
    status: res.status,
    body,
    fetchedAt,
    sourceTimestamp: null,
  };
}

function boxscoreEndpoint(gamePk: number): string {
  return `/api/v1/game/${gamePk}/boxscore`;
}

async function fileExists(abs: string): Promise<boolean> {
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
}

function buildSnapshot(input: {
  dateKst: string;
  gamePk: number;
  internalGameId: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  cutoffTime: string | null;
  fetched: LineupRefreshFetchResult;
}): LineupRawSnapshotV1 {
  const capturedAt = input.fetched.fetchedAt;
  const sourceTimestamp =
    input.fetched.sourceTimestamp === undefined
      ? null
      : input.fetched.sourceTimestamp;
  const temporal = resolveRefreshTemporalProvenance({
    sourceTimestamp,
    capturedAt,
    cutoffTime: input.cutoffTime,
    admissibleProviderResponse: input.fetched.ok === true,
  });
  const classified = input.fetched.ok
    ? classifyBoxscoreBody(input.fetched.body)
    : {
        collectionStatus: "PROVIDER_ERROR" as const,
        confirmed: false,
        homeComplete: false,
        awayComplete: false,
        homeStarterCount: 0,
        awayStarterCount: 0,
        playerIds: [] as number[],
        warnings: [`HTTP_${input.fetched.status}`],
      };
  const payloadHash = hashLineupPayload(input.fetched.body);
  const capturedCanonical = capturedAt;
  const observationId = observationIdFor({
    gamePk: input.gamePk,
    capturedAt: capturedCanonical,
    payloadHash,
    provider: "mlb-stats-api",
  });
  return {
    schemaVersion: LINEUP_OBSERVATION_SCHEMA,
    observationId,
    dateKst: input.dateKst,
    gamePk: input.gamePk,
    internalGameId: input.internalGameId,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    provider: "mlb-stats-api",
    source: "INTERNAL_RESEARCH_ONLY",
    endpoint: boxscoreEndpoint(input.gamePk),
    lineupSource: "mlb-statsapi-boxscore",
    capturedAt,
    fetchedAt: capturedAt,
    sourceTimestamp,
    temporalProof: temporal.temporalProof,
    payloadHash,
    payloadRel: mlbLineupPayloadRel(input.dateKst, input.gamePk, payloadHash),
    hash: observationId,
    httpStatus: input.fetched.status,
    ok: input.fetched.ok,
    refreshMode: LINEUP_REFRESH_MODE,
    cachePolicy: LINEUP_CACHE_POLICY,
    cutoffTime: input.cutoffTime,
    collectionPhase: temporal.collectionPhase,
    beforeCutoff: temporal.beforeCutoff,
    collectionStatus: classified.collectionStatus,
    confirmed: classified.confirmed,
    homeComplete: classified.homeComplete,
    awayComplete: classified.awayComplete,
    homeStarterCount: classified.homeStarterCount,
    awayStarterCount: classified.awayStarterCount,
    playerIds: classified.playerIds,
    warnings: [...temporal.warnings, ...classified.warnings],
    researchOnly: true,
    engineUseAllowed: false,
    predictionInputAllowed: false,
    engineAdmission: "PROHIBITED",
    marketDataAllowed: false,
    independentModelSample: 0,
    body: input.fetched.body,
  };
}

export type RunMlbLineupRefreshInput = {
  dateKst: string;
  cwd?: string;
  nowMs?: number;
  dryRun?: boolean;
  noProvider?: boolean;
  cacheOnly?: boolean;
  gamePk?: number;
  gameId?: string;
  fetchBoxscore?: LineupRefreshFetchFn;
  statLookup?: BatterPregameStatLookup;
  /** Test/operator override. Default: live fetch path only. */
  allowBatterStatNetwork?: boolean;
};

export type MlbLineupRefreshResult = {
  manifest: LineupRefreshManifestV1;
  batterManifest: BatterPregameManifestV1;
  writtenManifest: boolean;
  providerCalls: number;
  predictionExecuted: false;
};

function matchesGameFilter(
  game: { gamePk: number; internalGameId: string },
  filter: { gamePk?: number; gameId?: string },
): boolean {
  if (filter.gamePk != null) return game.gamePk === filter.gamePk;
  if (filter.gameId) {
    const id = filter.gameId.trim();
    if (/^\d+$/.test(id)) return game.gamePk === Number(id);
    return game.internalGameId === id;
  }
  return true;
}

export async function runMlbLineupRefresh(
  input: RunMlbLineupRefreshInput,
): Promise<MlbLineupRefreshResult> {
  const cwd = input.cwd ?? process.cwd();
  const nowMs = input.nowMs ?? Date.now();
  const dryRun = input.dryRun === true;
  const noProvider = input.noProvider === true || input.cacheOnly === true;
  const cacheOnly = input.cacheOnly === true;
  const fetchFn = input.fetchBoxscore ?? fetchBoxscoreLive;
  const usingLiveFetch = input.fetchBoxscore == null;
  const allowBatterStatNetwork =
    input.allowBatterStatNetwork ??
    (!dryRun && !noProvider && !cacheOnly && usingLiveFetch);
  const generatedAt = new Date(nowMs).toISOString();

  const schedule = await loadMlbScheduleArtifact(input.dateKst, cwd);
  const rows: LineupGameRefreshRowV1[] = [];
  const captures: BatterPregameGameCaptureV1[] = [];
  const skippedSealed: number[] = [];
  let providerCalls = 0;

  for (const game of schedule.games) {
    if (!matchesGameFilter(game, input)) continue;

    const cutoffTime = game.commenceTimeUtc ?? game.scheduledStartTime ?? null;
    const cutoffMs = cutoffTime ? Date.parse(cutoffTime) : NaN;
    const beforeCutoff = Number.isFinite(cutoffMs) && cutoffMs > nowMs;
    let skipReason: LineupRefreshSkipReason | null = null;
    let refreshAttempted = false;
    let providerCalled = false;
    let observationWritten = false;
    let payloadWritten = false;
    let identicalPayload = false;
    let exactDuplicateSkip = false;

    if (!beforeCutoff) {
      skipReason = "POST_CUTOFF_SKIPPED";
    } else if (dryRun) {
      skipReason = "DRY_RUN";
    } else if (noProvider) {
      skipReason = cacheOnly ? "CACHE_ONLY" : "NO_PROVIDER";
    } else {
      refreshAttempted = true;
      const endpoint = boxscoreEndpoint(game.gamePk);
      try {
        providerCalls += 1;
        providerCalled = true;
        const fetched = await fetchFn({ gamePk: game.gamePk, endpoint });
        const snapshot = buildSnapshot({
          dateKst: input.dateKst,
          gamePk: game.gamePk,
          internalGameId: game.internalGameId,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          cutoffTime,
          fetched,
        });
        const stored = await writeLineupObservation(snapshot, cwd);
        observationWritten = stored.observationWritten;
        payloadWritten = stored.payloadWritten;
        identicalPayload = stored.identicalPayload && stored.observationWritten;
        exactDuplicateSkip = stored.exactDuplicate;
        if (stored.exactDuplicate) skipReason = "IDEMPOTENT_EXACT_DUPLICATE";
      } catch (err) {
        skipReason = "FETCH_FAILED";
        const fetchedAt = new Date(nowMs).toISOString();
        const snapshot = buildSnapshot({
          dateKst: input.dateKst,
          gamePk: game.gamePk,
          internalGameId: game.internalGameId,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          cutoffTime,
          fetched: {
            ok: false,
            status: 0,
            body: { error: err instanceof Error ? err.message : String(err) },
            fetchedAt,
            sourceTimestamp: null,
          },
        });
        const stored = await writeLineupObservation(snapshot, cwd);
        observationWritten = stored.observationWritten;
        payloadWritten = stored.payloadWritten;
        identicalPayload = stored.identicalPayload && stored.observationWritten;
      }
    }

    const snapshots = await listLineupObservations({
      dateKst: input.dateKst,
      gamePk: game.gamePk,
      cwd,
    });
    const payloadHashes = await listLineupPayloadHashes({
      dateKst: input.dateKst,
      gamePk: game.gamePk,
      cwd,
    });
    const selected = selectAdmissiblePregameSnapshot(snapshots);
    const confirmedObs = latestConfirmedPregameObservation(snapshots);

    let batterCapture: LineupGameRefreshRowV1["batterCapture"] = "NOT_ELIGIBLE";
    const alreadySealed = await batterPregameGameExists(
      input.dateKst,
      game.gamePk,
      cwd,
    );
    if (alreadySealed) {
      batterCapture = "SKIPPED_SEALED";
      skippedSealed.push(game.gamePk);
    }

    const canCapture =
      !dryRun &&
      beforeCutoff &&
      confirmedObs != null &&
      cutoffTime &&
      !alreadySealed;

    if (dryRun && !alreadySealed && confirmedObs && beforeCutoff) {
      batterCapture = "DRY_RUN";
    }

    if (canCapture && confirmedObs) {
      const snap = snapshots.find(
        (s) => s.observationId === confirmedObs.observationId,
      );
      if (snap && snap.confirmed && snap.homeComplete && snap.awayComplete) {
        const result = await captureBatterPregameGameIfEligible({
          dateKst: input.dateKst,
          gamePk: game.gamePk,
          internalGameId: game.internalGameId,
          cutoffTime,
          officialDate: game.officialDate ?? null,
          snapshot: snap,
          cwd,
          nowMs,
          allowNetwork: allowBatterStatNetwork,
          cacheOnly,
          statLookup: input.statLookup,
        });
        if (result.status === "SKIPPED_SEALED") {
          batterCapture = "SKIPPED_SEALED";
          skippedSealed.push(game.gamePk);
        } else {
          batterCapture = "WRITTEN";
          captures.push(result.capture);
        }
      }
    }

    rows.push({
      gamePk: game.gamePk,
      internalGameId: game.internalGameId,
      cutoffTime,
      beforeCutoffAtRun: beforeCutoff,
      refreshAttempted,
      providerCalled,
      skipReason,
      observationWritten,
      payloadWritten,
      identicalPayload,
      exactDuplicateSkip,
      observationCount: snapshots.length,
      uniquePayloadCount: payloadHashes.length,
      selected,
      batterCapture,
      newSnapshot: observationWritten,
      duplicatePayload: exactDuplicateSkip,
      snapshotCount: snapshots.length,
    });
  }

  const selectedRows = rows.map((r) => r.selected);
  const blockedReasons = rows
    .filter((r) => r.selected.blocker)
    .map((r) => ({ gamePk: r.gamePk, reason: r.selected.blocker as string }));

  const confirmedGames = selectedRows.filter(
    (s) => s.confirmed && s.collectionPhase === "PRE_GAME",
  ).length;
  const gamesWithAdmissible = selectedRows.filter((s) => s.selected).length;
  const gamesWithBatterComplete = rows.filter(
    (r) =>
      r.batterCapture === "WRITTEN" || r.batterCapture === "SKIPPED_SEALED",
  ).length;

  const uniquePayloadCount = rows.reduce(
    (n, r) => n + r.uniquePayloadCount,
    0,
  );
  const observationsWritten = rows.filter((r) => r.observationWritten).length;
  const identicalPayloadObservations = rows.filter(
    (r) => r.identicalPayload,
  ).length;
  const idempotentExactDuplicateSkips = rows.filter(
    (r) => r.exactDuplicateSkip,
  ).length;
  const batterCapturesWritten = rows.filter(
    (r) => r.batterCapture === "WRITTEN",
  ).length;
  const batterCaptureExistingSkips = new Set(skippedSealed).size;

  const summary = {
    scheduleGames: schedule.games.length,
    games: rows.length,
    refreshAttempts: rows.filter((r) => r.refreshAttempted).length,
    providerCalls,
    observationsWritten,
    identicalPayloadObservations,
    uniquePayloadCount,
    idempotentExactDuplicateSkips,
    postCutoffSkips: rows.filter((r) => r.skipReason === "POST_CUTOFF_SKIPPED")
      .length,
    providerDisabledSkips: rows.filter(
      (r) => r.skipReason === "NO_PROVIDER" || r.skipReason === "CACHE_ONLY",
    ).length,
    batterCapturesWritten,
    batterCaptureExistingSkips,
    gamesBeforeCutoff: rows.filter((r) => r.beforeCutoffAtRun).length,
    gamesAfterCutoff: rows.filter((r) => !r.beforeCutoffAtRun).length,
    confirmedGames,
    partialGames: selectedRows.filter((s) => s.collectionStatus === "PARTIAL")
      .length,
    notReleasedGames: selectedRows.filter(
      (s) => s.collectionStatus === "NOT_RELEASED",
    ).length,
    unknownTemporalStates: rows.filter(
      (r) => r.selected.blocker === "TEMPORAL_PROVENANCE_UNPROVEN",
    ).length,
    gamesWithAdmissiblePregameSnapshot: gamesWithAdmissible,
    gamesWithBatterCaptureComplete: gamesWithBatterComplete,
    blockedGames: blockedReasons.length,
    beforeCutoff: rows.filter((r) => r.beforeCutoffAtRun).length,
    refreshAttempted: rows.filter((r) => r.refreshAttempted).length,
    newRawSnapshots: observationsWritten,
    lineupObservationsCaptured: observationsWritten,
    duplicatePayloads: idempotentExactDuplicateSkips,
    providerConfirmed: selectedRows.filter((s) => s.collectionStatus === "CONFIRMED")
      .length,
    pregameAdmissibleConfirmed: confirmedGames,
    partial: selectedRows.filter((s) => s.collectionStatus === "PARTIAL").length,
    unavailable: selectedRows.filter(
      (s) =>
        s.collectionStatus === "NOT_RELEASED" ||
        s.collectionStatus == null ||
        s.blocker === "NO_SNAPSHOT",
    ).length,
    unknownTimestampBlocked: rows.filter(
      (r) => r.selected.blocker === "TEMPORAL_PROVENANCE_UNPROVEN",
    ).length,
    postCutoffSkipped: rows.filter((r) => r.skipReason === "POST_CUTOFF_SKIPPED")
      .length,
    skippedAlreadySealedGames: batterCaptureExistingSkips,
  };

  const manifest: LineupRefreshManifestV1 = {
    schemaVersion: LINEUP_REFRESH_MANIFEST_SCHEMA,
    dateKst: input.dateKst,
    generatedAt,
    refreshMode: LINEUP_REFRESH_MODE,
    cachePolicy: LINEUP_CACHE_POLICY,
    resolverRule: LATEST_ADMISSIBLE_PREGAME_SNAPSHOT_RULE,
    observationIdFormula: "sha256(gamePk + canonicalCapturedAt + payloadHash + provider)",
    researchOnly: true,
    engineUseAllowed: false,
    predictionInputAllowed: false,
    engineAdmission: "PROHIBITED",
    marketDataAllowed: false,
    independentModelSample: 0,
    predictionExecuted: false,
    dryRun,
    noProvider,
    cacheOnly,
    summary,
    blockedReasons,
    games: rows.sort((a, b) => a.gamePk - b.gamePk),
  };

  const dailyAbs = mlbBatterDatasetAbs(input.dateKst, cwd);
  const dailyFrozen = await fileExists(dailyAbs);
  if (!dryRun) {
    const manAbs = mlbLineupRefreshManifestAbs(input.dateKst, cwd);
    await mkdir(path.dirname(manAbs), { recursive: true });
    await writeFile(manAbs, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  const batterManifest: BatterPregameManifestV1 = {
    schemaVersion: BATTER_PREGAME_MANIFEST_SCHEMA,
    dateKst: input.dateKst,
    generatedAt,
    dailyBatterDatasetFrozen: dailyFrozen,
    dailyBatterDatasetRel: `data/research/mlb/${input.dateKst}-batter-dataset-v0.json`,
    captures: [
      ...captures.map((c) => ({
        gamePk: c.gamePk,
        captureId: c.captureId,
        rel: mlbBatterPregameGameRel(c.dateKst, c.gamePk),
        skippedSealed: false,
      })),
      ...[...new Set(skippedSealed)]
        .filter((pk) => !captures.some((c) => c.gamePk === pk))
        .map((pk) => ({
          gamePk: pk,
          captureId: "sealed",
          rel: mlbBatterPregameGameRel(input.dateKst, pk),
          skippedSealed: true,
        })),
    ],
    notes: [
      "Per-game captures are write-once under batter-pregame/{date}/games/{gamePk}.json.",
      "Daily batter-dataset-v0.json is never overwritten by lineup refresh.",
      "Hitting stats use cutoff-filtered gameLog (statsThroughDate = previous day). No season-to-date aggregates.",
      "This capture is research sidecar only. No market. No prediction. Engine admission PROHIBITED.",
      dailyFrozen
        ? "Daily batter-dataset-v0.json already exists and is not overwritten. Captures here are supplemental provenance only."
        : "Daily batter dataset not frozen — confirmed pregame captures may be appended per game.",
    ],
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    predictionInputAllowed: false,
  };

  if (!dryRun) {
    const bAbs = mlbBatterPregameManifestAbs(input.dateKst, cwd);
    await mkdir(path.dirname(bAbs), { recursive: true });
    await writeFile(bAbs, `${JSON.stringify(batterManifest, null, 2)}\n`, "utf8");
  }

  return {
    manifest,
    batterManifest,
    writtenManifest: !dryRun,
    providerCalls,
    predictionExecuted: false,
  };
}

export function formatMlbLineupRefreshSummary(
  manifest: LineupRefreshManifestV1,
): string {
  const s = manifest.summary;
  return [
    `MLB LINEUP REFRESH — ${manifest.dateKst}`,
    "",
    `Schedule games: ${s.scheduleGames}`,
    `Before cutoff: ${s.gamesBeforeCutoff}`,
    `After cutoff: ${s.gamesAfterCutoff}`,
    `Refresh attempted: ${s.refreshAttempts}`,
    `Provider calls: ${s.providerCalls}`,
    `Observations written: ${s.observationsWritten}`,
    `Identical-payload observations: ${s.identicalPayloadObservations}`,
    `Unique payloads: ${s.uniquePayloadCount}`,
    `Exact observation retries skipped: ${s.idempotentExactDuplicateSkips}`,
    `Post-cutoff skips: ${s.postCutoffSkips}`,
    `Provider-disabled skips: ${s.providerDisabledSkips}`,
    `Batter captures written: ${s.batterCapturesWritten}`,
    `Batter capture existing skips: ${s.batterCaptureExistingSkips}`,
    `Confirmed (admissible PRE_GAME): ${s.pregameAdmissibleConfirmed}`,
    `Partial: ${s.partialGames}`,
    `Not released: ${s.notReleasedGames}`,
    `Unknown temporal: ${s.unknownTemporalStates}`,
    `Admissible pregame snapshots: ${s.gamesWithAdmissiblePregameSnapshot}`,
    `Batter capture complete: ${s.gamesWithBatterCaptureComplete}`,
    `Skipped sealed captures: ${s.skippedAlreadySealedGames}`,
    `Blocked: ${s.blockedGames}`,
    `Dry-run: ${manifest.dryRun ? "YES" : "NO"}`,
    `No-provider: ${manifest.noProvider ? "YES" : "NO"}`,
    "",
    "Prediction executed: NO",
    "Market used: NO",
    "Engine admission: PROHIBITED",
    "Independent model sample: 0",
    "",
    `Resolver: ${manifest.resolverRule}`,
    "",
  ].join("\n");
}
