/**
 * KBO Schedule / Result Identity Dataset v1 — pure builder.
 *
 * Accepts normalized Provider games only.
 * No HTTP, env vars, raw provider fields, Engine, or Framework imports.
 */
import { createHash } from "node:crypto";
import type { KboCacheUsageStats } from "./kbo-cache-types";
import type { KboNormalizedScheduleGame, KboScheduleProviderMetadata } from "./providers/kbo-schedule-provider";
import type { KboTeamIdentity } from "./schedule-result-identity-types";
import {
  KBO_SCHEDULE_RESULT_IDENTITY_BUILDER_VERSION,
  KBO_SCHEDULE_RESULT_IDENTITY_DATASET_ID,
  KBO_SCHEDULE_RESULT_IDENTITY_SCHEMA_VERSION,
  type BuildKboScheduleResultIdentityResult,
  type KboGameStatus,
  type KboIdentityCollectionPhase,
  type KboResultIdentity,
  type KboResultStatus,
  type KboScheduleChangeRecord,
  type KboProviderCrosswalkRef,
  type KboScheduleResultIdentityDocument,
  type KboScheduleResultIdentityRow,
} from "./schedule-result-identity-types";

export type KboEnrichedScheduleGame = KboNormalizedScheduleGame & {
  homeTeam: KboTeamIdentity;
  awayTeam: KboTeamIdentity;
};

export type BuildKboScheduleResultIdentityInput = {
  dateKst: string;
  observedAt?: string;
  enrichedGames: KboEnrichedScheduleGame[];
  providerMetadata: KboScheduleProviderMetadata;
  cacheUsage: KboCacheUsageStats;
  providerWarnings?: string[];
  providerMissing?: string[];
  rawGameCount: number;
  previousRows?: Map<string, KboScheduleResultIdentityRow>;
  providerRefsByInternalGameId?: Map<string, KboProviderCrosswalkRef[]>;
};

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key]);
  }
  return out;
}

export function buildKboResultIdentity(
  gameStatus: KboGameStatus,
  homeScore: number | null,
  awayScore: number | null,
): KboResultIdentity {
  if (
    gameStatus === "POSTPONED" ||
    gameStatus === "CANCELLED" ||
    gameStatus === "NO_GAME"
  ) {
    return {
      resultStatus: "VOID",
      homeScore: null,
      awayScore: null,
      winner: "NONE",
    };
  }

  if (
    gameStatus === "SUSPENDED" ||
    gameStatus === "INCONCLUSIVE" ||
    gameStatus === "UNKNOWN"
  ) {
    return {
      resultStatus: "INCONCLUSIVE",
      homeScore,
      awayScore,
      winner: "NONE",
    };
  }

  if (gameStatus === "SCHEDULED" || gameStatus === "LIVE") {
    return {
      resultStatus: "PENDING",
      homeScore: null,
      awayScore: null,
      winner: null,
    };
  }

  if (homeScore == null || awayScore == null) {
    return {
      resultStatus: "INCONCLUSIVE",
      homeScore,
      awayScore,
      winner: "NONE",
    };
  }

  if (homeScore === awayScore || gameStatus === "DRAW") {
    return {
      resultStatus: "DRAW",
      homeScore,
      awayScore,
      winner: "DRAW",
    };
  }

  return {
    resultStatus: "GRADED",
    homeScore,
    awayScore,
    winner: homeScore > awayScore ? "HOME" : "AWAY",
  };
}

function buildResultIdentity(
  gameStatus: KboGameStatus,
  homeScore: number | null,
  awayScore: number | null,
): KboResultIdentity {
  return buildKboResultIdentity(gameStatus, homeScore, awayScore);
}

function rowCollectionPhase(
  resultStatus: KboResultStatus,
): KboIdentityCollectionPhase {
  return resultStatus === "PENDING"
    ? "PRE_GAME_SCHEDULE_IDENTITY"
    : "POST_GAME_RESULT_IDENTITY";
}

function documentCollectionPhase(
  rows: KboScheduleResultIdentityRow[],
): KboIdentityCollectionPhase | "MIXED" {
  if (rows.length === 0) return "PRE_GAME_SCHEDULE_IDENTITY";
  const phases = new Set(rows.map((r) => r.collectionPhase));
  if (phases.size === 1) return rows[0]!.collectionPhase;
  return "MIXED";
}

function hashableRow(row: KboScheduleResultIdentityRow): Record<string, unknown> {
  const { generatedAt: _g, ...rest } = row;
  const time = { ...rest.time };
  delete (time as { firstObservedAt?: string }).firstObservedAt;
  delete (time as { lastObservedAt?: string }).lastObservedAt;
  return { ...rest, time };
}

export function computeKboIdentityImmutableHash(
  document: KboScheduleResultIdentityDocument,
): string {
  const rows = [...document.rows]
    .map((row) => ({
      internalGameId: row.internalGameId,
      providerGameId: row.providerGameId,
      primaryProvider: row.primaryProvider ?? null,
      season: row.season,
      dateKst: row.dateKst,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      provider: {
        id: row.provider.id,
        leagueId: row.provider.leagueId,
      },
      time: {
        providerStartTime: row.time.providerStartTime,
        startTimeKst: row.time.startTimeKst,
        cutoffTime: row.time.cutoffTime,
        firstObservedAt: row.time.firstObservedAt,
      },
    }))
    .sort((a, b) => a.internalGameId.localeCompare(b.internalGameId));

  return sha256(
    stableStringify({
      datasetId: document.meta.datasetId,
      schemaVersion: document.meta.schemaVersion,
      dateKst: document.meta.dateKst,
      rows,
    }),
  );
}

export function computeKboIdentityResultHash(
  document: Pick<KboScheduleResultIdentityDocument, "meta" | "rows">,
): string {
  return sha256(
    stableStringify({
      datasetId: document.meta.datasetId,
      schemaVersion: document.meta.schemaVersion,
      builderVersion: document.meta.builderVersion,
      body: {
        dateKst: document.meta.dateKst,
        rows: document.rows.map(hashableRow),
      },
    }),
  );
}

function detectScheduleChanges(
  previous: KboScheduleResultIdentityRow | undefined,
  current: {
    startTimeKst: string | null;
    venueName: string | null;
    gameStatus: KboGameStatus;
  },
  detectedAt: string,
): KboScheduleChangeRecord[] {
  if (!previous) return [];

  const changes: KboScheduleChangeRecord[] = [];
  const prevStart = previous.time.startTimeKst;
  const currStart = current.startTimeKst;

  if (prevStart && currStart && prevStart !== currStart) {
    changes.push({
      event: "START_TIME_CHANGED",
      previousStartTimeKst: prevStart,
      currentStartTimeKst: currStart,
      previousVenueName: null,
      currentVenueName: null,
      detectedAt,
      reason: "PROVIDER_UPDATE",
    });
  }

  if (
    previous.venueName &&
    current.venueName &&
    previous.venueName !== current.venueName
  ) {
    changes.push({
      event: "VENUE_CHANGED",
      previousStartTimeKst: null,
      currentStartTimeKst: null,
      previousVenueName: previous.venueName,
      currentVenueName: current.venueName,
      detectedAt,
      reason: "PROVIDER_UPDATE",
    });
  }

  if (previous.gameStatus !== current.gameStatus) {
    const status = current.gameStatus;
    let event: KboScheduleChangeRecord["event"] = "UNKNOWN_CHANGE";
    if (status === "POSTPONED") event = "POSTPONED";
    else if (status === "CANCELLED") event = "CANCELLED";
    else if (status === "NO_GAME") event = "NO_GAME";
    else if (status === "SUSPENDED") event = "SUSPENDED";

    if (event !== "UNKNOWN_CHANGE" || previous.gameStatus !== status) {
      changes.push({
        event,
        previousStartTimeKst: prevStart,
        currentStartTimeKst: currStart,
        previousVenueName: previous.venueName,
        currentVenueName: current.venueName,
        detectedAt,
        reason: "PROVIDER_UPDATE",
      });
    }
  }

  return changes;
}

export function buildKboScheduleResultIdentityDocument(
  input: BuildKboScheduleResultIdentityInput,
): BuildKboScheduleResultIdentityResult {
  const {
    dateKst,
    enrichedGames,
    providerMetadata,
    cacheUsage,
    rawGameCount,
  } = input;
  const observedAt = input.observedAt ?? new Date().toISOString();
  const previousRows = input.previousRows ?? new Map();
  const providerRefsByInternalGameId = input.providerRefsByInternalGameId ?? new Map();
  const warnings = [...(input.providerWarnings ?? [])];
  const missing = [...(input.providerMissing ?? [])];

  const rows: KboScheduleResultIdentityRow[] = [];
  let missingProviderGameId = missing.filter((m) =>
    m.includes("PROVIDER_GAME_ID_MISSING"),
  ).length;

  let teamMappingsMatched = 0;
  let teamMappingsUnmatched = 0;

  const statusCounts = {
    scheduled: 0,
    live: 0,
    final: 0,
    draw: 0,
    postponed: 0,
    cancelled: 0,
    noGame: 0,
    suspended: 0,
    unknown: 0,
  };

  for (const game of enrichedGames) {
    if (game.homeTeam.mappingStatus === "MATCHED") teamMappingsMatched += 1;
    else teamMappingsUnmatched += 1;
    if (game.awayTeam.mappingStatus === "MATCHED") teamMappingsMatched += 1;
    else teamMappingsUnmatched += 1;

    const result = buildResultIdentity(
      game.gameStatus,
      game.homeScore,
      game.awayScore,
    );
    const internalGameId = `kbo-${game.providerGameId}`;
    const previous = previousRows.get(internalGameId);

    const scheduleChanges = detectScheduleChanges(
      previous,
      {
        startTimeKst: game.startTimeKst,
        venueName: game.venueName,
        gameStatus: game.gameStatus,
      },
      observedAt,
    );

    const firstObservedAt = previous?.time.firstObservedAt ?? observedAt;

    const row: KboScheduleResultIdentityRow = {
      internalGameId,
      primaryProvider: providerMetadata.id,
      sport: "baseball",
      league: "KBO",
      season: game.season,
      dateKst,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeTeamId: game.homeTeamProviderId,
      awayTeamId: game.awayTeamProviderId,
      venueName: game.venueName,
      provider: {
        id: providerMetadata.id,
        leagueId: providerMetadata.leagueId,
        legalStatus: providerMetadata.legalStatus,
        publicDisplay: providerMetadata.publicDisplay,
        commercialUse: providerMetadata.commercialUse,
      },
      providerGameId: game.providerGameId,
      providerStatusRaw: game.providerStatusRaw,
      gameStatus: game.gameStatus,
      betmanScopeReference: "NOT_CHECKED",
      providerRefs: providerRefsByInternalGameId.get(internalGameId),
      collectionPhase: rowCollectionPhase(result.resultStatus),
      time: {
        providerStartTime: game.providerStartTime,
        startTimeKst: game.startTimeKst,
        firstObservedAt,
        lastObservedAt: observedAt,
        cutoffTime: game.startTimeKst,
        scheduleChanges,
      },
      result,
      generatedAt: observedAt,
    };

    rows.push(row);

    switch (game.gameStatus) {
      case "SCHEDULED":
        statusCounts.scheduled += 1;
        break;
      case "LIVE":
        statusCounts.live += 1;
        break;
      case "FINAL":
        statusCounts.final += 1;
        break;
      case "DRAW":
        statusCounts.draw += 1;
        break;
      case "POSTPONED":
        statusCounts.postponed += 1;
        break;
      case "CANCELLED":
        statusCounts.cancelled += 1;
        break;
      case "NO_GAME":
        statusCounts.noGame += 1;
        break;
      case "SUSPENDED":
        statusCounts.suspended += 1;
        break;
      default:
        statusCounts.unknown += 1;
    }
  }

  if (teamMappingsUnmatched > 0) {
    warnings.push(
      `TEAM_MAPPING_PARTIAL: ${teamMappingsUnmatched} team slot(s) unmatched`,
    );
  }

  rows.sort((a, b) => a.internalGameId.localeCompare(b.internalGameId));

  const inputHashSha256 = sha256(
    stableStringify({
      dateKst,
      provider: providerMetadata.id,
      leagueId: providerMetadata.leagueId,
      payloadHashes: enrichedGames.map((g) => g.providerPayloadHash).sort(),
    }),
  );

  const hashBody = {
    dateKst,
    rows: rows.map(hashableRow),
  };

  const resultHashSha256 = sha256(
    stableStringify({
      datasetId: KBO_SCHEDULE_RESULT_IDENTITY_DATASET_ID,
      schemaVersion: KBO_SCHEDULE_RESULT_IDENTITY_SCHEMA_VERSION,
      builderVersion: KBO_SCHEDULE_RESULT_IDENTITY_BUILDER_VERSION,
      body: hashBody,
    }),
  );

  const scheduleChangeCount = rows.reduce(
    (sum, r) => sum + r.time.scheduleChanges.length,
    0,
  );

  const document: KboScheduleResultIdentityDocument = {
    meta: {
      datasetId: KBO_SCHEDULE_RESULT_IDENTITY_DATASET_ID,
      schemaVersion: KBO_SCHEDULE_RESULT_IDENTITY_SCHEMA_VERSION,
      builderVersion: KBO_SCHEDULE_RESULT_IDENTITY_BUILDER_VERSION,
      status: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      researchOnly: true,
      dateKst,
      collectionPhase: documentCollectionPhase(rows),
      generatedAt: observedAt,
      inputHashSha256,
      resultHashSha256,
      legalStatus: "INTERNAL_RESEARCH_ONLY",
      publicDisplay: "UNCONFIRMED",
      commercialUse: "UNCONFIRMED",
      sourceCutoff: rows.length > 0 ? (rows[0]?.time.cutoffTime ?? null) : null,
      notes: [
        "KBO Schedule/Result Identity v1 — provider-agnostic identity only.",
        "Betman scope reference NOT_CHECKED in v1.",
        "No Prediction / Engine / Grade pipeline.",
      ],
    },
    cacheUsage: {
      rawHit: cacheUsage.rawHit,
      rawMiss: cacheUsage.rawMiss,
      networkCalls: cacheUsage.networkCalls,
    },
    warnings,
    missing,
    summary: {
      providerGamesFetched: rawGameCount,
      datasetGamesCreated: rows.length,
      missingProviderGameId,
      teamMappingsMatched,
      teamMappingsUnmatched,
      ...statusCounts,
      scheduleChanges: scheduleChangeCount,
    },
    rows,
  };

  return { document, usage: cacheUsage };
}

export function assertKboScheduleResultIdentityIntegrity(
  document: KboScheduleResultIdentityDocument,
): string[] {
  const issues: string[] = [];

  if (document.meta.engineAdmission !== "PROHIBITED") {
    issues.push("engineAdmission must be PROHIBITED");
  }

  for (const row of document.rows) {
    if (!row.internalGameId.startsWith("kbo-")) {
      issues.push(`invalid internalGameId: ${row.internalGameId}`);
    }
    if (row.internalGameId !== `kbo-${row.providerGameId}`) {
      issues.push(`gameId/provider mismatch: ${row.internalGameId}`);
    }
    if (row.betmanScopeReference !== "NOT_CHECKED") {
      issues.push(`unexpected betmanScopeReference: ${row.internalGameId}`);
    }
  }

  return issues;
}

export type { KboCacheUsageStats } from "./kbo-cache-types";
