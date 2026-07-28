/**
 * Postgame Result Identity update — result fields only.
 * Pre-game identity fields remain immutable (startTimeKst / teams / ids).
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  assertKboScheduleResultIdentityIntegrity,
  buildKboResultIdentity,
  computeKboIdentityImmutableHash,
  computeKboIdentityResultHash,
} from "./build-schedule-result-identity-dataset";
import { getKboIdentityArtifactPath } from "./kbo-identity-artifact-path";
import { KboIdentityCollectionError } from "./kbo-identity-errors";
import { createApiBaseballKboScheduleProvider } from "./providers/api-baseball-kbo-schedule-provider";
import type {
  KboGameStatus,
  KboScheduleChangeRecord,
  KboScheduleResultIdentityDocument,
  KboScheduleResultIdentityRow,
} from "./schedule-result-identity-types";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function rowCollectionPhase(
  resultStatus: KboScheduleResultIdentityRow["result"]["resultStatus"],
): KboScheduleResultIdentityRow["collectionPhase"] {
  return resultStatus === "PENDING"
    ? "PRE_GAME_SCHEDULE_IDENTITY"
    : "POST_GAME_RESULT_IDENTITY";
}

function documentCollectionPhase(
  rows: KboScheduleResultIdentityRow[],
): KboScheduleResultIdentityDocument["meta"]["collectionPhase"] {
  if (rows.length === 0) return "PRE_GAME_SCHEDULE_IDENTITY";
  const phases = new Set(rows.map((r) => r.collectionPhase));
  if (phases.size === 1) return rows[0]!.collectionPhase;
  return "MIXED";
}

function detectPostgameScheduleChanges(
  previous: KboScheduleResultIdentityRow,
  providerStartTimeKst: string | null,
  providerVenueName: string | null,
  gameStatus: KboGameStatus,
  detectedAt: string,
): KboScheduleChangeRecord[] {
  const changes: KboScheduleChangeRecord[] = [];
  const prevStart = previous.time.startTimeKst;

  if (prevStart && providerStartTimeKst && prevStart !== providerStartTimeKst) {
    changes.push({
      event: "START_TIME_CHANGED",
      previousStartTimeKst: prevStart,
      currentStartTimeKst: providerStartTimeKst,
      previousVenueName: null,
      currentVenueName: null,
      detectedAt,
      reason: "PROVIDER_UPDATE",
    });
  }

  if (
    previous.venueName &&
    providerVenueName &&
    previous.venueName !== providerVenueName
  ) {
    changes.push({
      event: "VENUE_CHANGED",
      previousStartTimeKst: null,
      currentStartTimeKst: null,
      previousVenueName: previous.venueName,
      currentVenueName: providerVenueName,
      detectedAt,
      reason: "PROVIDER_UPDATE",
    });
  }

  if (previous.gameStatus !== gameStatus) {
    let event: KboScheduleChangeRecord["event"] | null = null;
    if (gameStatus === "POSTPONED") event = "POSTPONED";
    else if (gameStatus === "CANCELLED") event = "CANCELLED";
    else if (gameStatus === "NO_GAME") event = "NO_GAME";
    else if (gameStatus === "SUSPENDED") event = "SUSPENDED";

    if (event) {
      changes.push({
        event,
        previousStartTimeKst: prevStart,
        currentStartTimeKst: providerStartTimeKst,
        previousVenueName: previous.venueName,
        currentVenueName: providerVenueName,
        detectedAt,
        reason: "PROVIDER_UPDATE",
      });
    }
  }

  return changes;
}

function recountSummary(rows: KboScheduleResultIdentityRow[]) {
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

  for (const row of rows) {
    switch (row.gameStatus) {
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

  const scheduleChanges = rows.reduce(
    (sum, r) => sum + r.time.scheduleChanges.length,
    0,
  );

  return { ...statusCounts, scheduleChanges };
}

export type KboPostgameUpdateStats = {
  gamesChecked: number;
  finalGames: number;
  drawGames: number;
  pendingGames: number;
  postponedGames: number;
  cancelledGames: number;
  noGameGames: number;
  suspendedGames: number;
  inconclusiveGames: number;
  scoresResolved: number;
  winnersResolved: number;
  scheduleChangesDetected: number;
};

function computeUpdateStats(
  rows: KboScheduleResultIdentityRow[],
): KboPostgameUpdateStats {
  let drawGames = 0;
  let pendingGames = 0;
  let postponedGames = 0;
  let cancelledGames = 0;
  let noGameGames = 0;
  let suspendedGames = 0;
  let inconclusiveGames = 0;
  let scoresResolved = 0;
  let winnersResolved = 0;
  let finalGames = 0;
  let scheduleChangesDetected = 0;

  for (const row of rows) {
    scheduleChangesDetected += row.time.scheduleChanges.length;
    if (row.gameStatus === "FINAL") finalGames += 1;
    if (row.gameStatus === "DRAW" || row.result.resultStatus === "DRAW") {
      drawGames += 1;
    }
    if (row.result.resultStatus === "PENDING") pendingGames += 1;
    if (row.gameStatus === "POSTPONED") postponedGames += 1;
    if (row.gameStatus === "CANCELLED") cancelledGames += 1;
    if (row.gameStatus === "NO_GAME") noGameGames += 1;
    if (row.gameStatus === "SUSPENDED") suspendedGames += 1;
    if (row.result.resultStatus === "INCONCLUSIVE") inconclusiveGames += 1;
    if (row.result.homeScore != null && row.result.awayScore != null) {
      scoresResolved += 1;
    }
    if (
      row.result.winner === "HOME" ||
      row.result.winner === "AWAY" ||
      row.result.winner === "DRAW"
    ) {
      winnersResolved += 1;
    }
  }

  return {
    gamesChecked: rows.length,
    finalGames,
    drawGames,
    pendingGames,
    postponedGames,
    cancelledGames,
    noGameGames,
    suspendedGames,
    inconclusiveGames,
    scoresResolved,
    winnersResolved,
    scheduleChangesDetected,
  };
}

export type UpdateKboPostgameResultIdentityResult = {
  artifactPath: string;
  artifactPolicy: "SAME_FILE_RESULT_REGION_UPDATE";
  document: KboScheduleResultIdentityDocument;
  identityImmutableHashBefore: string;
  identityImmutableHashAfter: string;
  fullFileHashBefore: string;
  fullFileHashAfter: string;
  stats: KboPostgameUpdateStats;
  cacheUsage: {
    rawHit: number;
    rawMiss: number;
    networkCalls: number;
  };
};

export async function updateKboPostgameResultIdentityV1(options: {
  dateKst: string;
  cwd?: string;
  observedAt?: string;
  forceRefresh?: boolean;
}): Promise<UpdateKboPostgameResultIdentityResult> {
  const cwd = options.cwd ?? process.cwd();
  const dateKst = options.dateKst;
  const observedAt = options.observedAt ?? new Date().toISOString();
  const forceRefresh = options.forceRefresh !== false;

  const artifactPath = getKboIdentityArtifactPath(
    dateKst,
    "API_BASEBALL",
    cwd,
  );

  let previousRaw: string;
  try {
    previousRaw = await readFile(artifactPath, "utf8");
  } catch {
    throw new KboIdentityCollectionError(
      "PROVIDER_REQUEST_FAILED",
      `API-BASEBALL identity artifact missing: ${artifactPath}`,
    );
  }

  const previous = JSON.parse(previousRaw) as KboScheduleResultIdentityDocument;
  if (previous.meta.dateKst !== dateKst) {
    throw new KboIdentityCollectionError(
      "PROVIDER_REQUEST_FAILED",
      `Artifact date mismatch: expected ${dateKst}, got ${previous.meta.dateKst}`,
    );
  }

  const fullFileHashBefore = sha256(previousRaw);
  const identityImmutableHashBefore = computeKboIdentityImmutableHash(previous);

  const provider = createApiBaseballKboScheduleProvider({
    cwd,
    forceRefresh,
  });
  const fetched = await provider.fetchGamesByDate(dateKst);
  const byProviderId = new Map(
    fetched.games.map((g) => [g.providerGameId, g] as const),
  );

  const updatedRows: KboScheduleResultIdentityRow[] = [];
  for (const row of previous.rows) {
    const game = byProviderId.get(row.providerGameId);
    if (!game) {
      updatedRows.push({
        ...row,
        time: {
          ...row.time,
          lastObservedAt: observedAt,
        },
        generatedAt: observedAt,
      });
      continue;
    }

    const result = buildKboResultIdentity(
      game.gameStatus,
      game.homeScore,
      game.awayScore,
    );

    const newChanges = detectPostgameScheduleChanges(
      row,
      game.startTimeKst,
      game.venueName,
      game.gameStatus,
      observedAt,
    );

    // Preserve pre-game startTimeKst / cutoffTime / providerStartTime / firstObservedAt.
    updatedRows.push({
      ...row,
      providerStatusRaw: game.providerStatusRaw,
      gameStatus: game.gameStatus,
      collectionPhase: rowCollectionPhase(result.resultStatus),
      time: {
        ...row.time,
        lastObservedAt: observedAt,
        scheduleChanges: [...row.time.scheduleChanges, ...newChanges],
      },
      result,
      generatedAt: observedAt,
    });
  }

  updatedRows.sort((a, b) => a.internalGameId.localeCompare(b.internalGameId));

  const statusRecount = recountSummary(updatedRows);
  const document: KboScheduleResultIdentityDocument = {
    ...previous,
    meta: {
      ...previous.meta,
      collectionPhase: documentCollectionPhase(updatedRows),
      generatedAt: observedAt,
      inputHashSha256: sha256(
        JSON.stringify({
          dateKst,
          provider: "API_BASEBALL",
          payloadHashes: fetched.games
            .map((g) => g.providerPayloadHash)
            .sort(),
        }),
      ),
      resultHashSha256: "",
      sourceCutoff:
        updatedRows.length > 0
          ? (updatedRows[0]?.time.cutoffTime ?? null)
          : null,
      notes: [
        ...previous.meta.notes.filter(
          (n) => !n.startsWith("Postgame result identity updated"),
        ),
        `Postgame result identity updated at ${observedAt} (result region only).`,
      ],
    },
    cacheUsage: {
      rawHit: provider.usage.rawHit,
      rawMiss: provider.usage.rawMiss,
      networkCalls: provider.usage.networkCalls,
    },
    warnings: [...new Set([...previous.warnings, ...fetched.warnings])],
    missing: [...new Set([...previous.missing, ...fetched.missing])],
    summary: {
      ...previous.summary,
      providerGamesFetched: fetched.rawGameCount,
      datasetGamesCreated: updatedRows.length,
      ...statusRecount,
    },
    rows: updatedRows,
  };

  document.meta.resultHashSha256 = computeKboIdentityResultHash(document);

  const integrity = assertKboScheduleResultIdentityIntegrity(document);
  if (integrity.length > 0) {
    throw new KboIdentityCollectionError(
      "PROVIDER_REQUEST_FAILED",
      `Integrity failed: ${integrity.join("; ")}`,
    );
  }

  const identityImmutableHashAfter = computeKboIdentityImmutableHash(document);
  if (identityImmutableHashBefore !== identityImmutableHashAfter) {
    throw new KboIdentityCollectionError(
      "PROVIDER_REQUEST_FAILED",
      "identityImmutableHash changed — pre-game identity fields must remain immutable",
    );
  }

  const serialized = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(artifactPath, serialized, "utf8");
  const fullFileHashAfter = sha256(serialized);

  return {
    artifactPath,
    artifactPolicy: "SAME_FILE_RESULT_REGION_UPDATE",
    document,
    identityImmutableHashBefore,
    identityImmutableHashAfter,
    fullFileHashBefore,
    fullFileHashAfter,
    stats: computeUpdateStats(updatedRows),
    cacheUsage: {
      rawHit: provider.usage.rawHit,
      rawMiss: provider.usage.rawMiss,
      networkCalls: provider.usage.networkCalls,
    },
  };
}
