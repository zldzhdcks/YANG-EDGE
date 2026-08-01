/**
 * KBO T45 Personnel Workflow — validate admin input, version/audit, write snapshots.
 * Does not call providers. Does not run Prediction Engine. Does not invent official picks.
 */
import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { resolveKboTeamIdentity } from "../resolve-kbo-team-identity";
import { kboT45Paths } from "./paths";
import type {
  AdminSourceType,
  CommercialUseStatus,
  GameValidationResult,
  KboT45GameInput,
  KboT45PersonnelInputV1,
  T45WorkflowResult,
} from "./types";
import {
  defaultCommercialUse,
  parsePersonnelInputJson,
  summarizeT45Readiness,
  tempPlayerKey,
  validateGame,
} from "./validate-personnel-input";

export type RunT45Options = {
  dateKst: string;
  inputPath: string;
  dryRun?: boolean;
  validateOnly?: boolean;
  gameIds?: string[] | null;
  adminId?: string;
  sourceReference?: string | null;
  cwd?: string;
  now?: Date;
  lockedGameIds?: Set<string>;
  /** Injected for tests — when set, no disk reads of prior snapshots. */
  priorPersonnel?: Record<string, unknown> | null;
  priorProto?: Record<string, unknown> | null;
};

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256(JSON.stringify(value));
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function runIdFromIso(iso: string): string {
  return iso.replace(/[:.]/g, "-");
}

function sourceMeta(input: {
  sourceType: AdminSourceType;
  sourceReference: string;
  commercialUseStatus: CommercialUseStatus;
  observedAt: string;
  enteredAt: string;
  enteredBy: string;
}) {
  return {
    sourceType: input.sourceType,
    confirmationMethod: "ADMIN_VERIFIED" as const,
    sourceReference: input.sourceReference,
    commercialUseStatus: input.commercialUseStatus,
    externalDisplayLabel: "관리자 확인 완료",
    forbiddenExternalLabel: "공식 라인업",
    screenshotObservedAt: input.observedAt,
    enteredAt: input.enteredAt,
    enteredBy: input.enteredBy,
  };
}

function buildStarterSide(
  team: string,
  starter: NonNullable<KboT45GameInput["home"]["starter"]>,
  meta: ReturnType<typeof sourceMeta>,
  playerId: string,
) {
  return {
    pitcherId: playerId,
    playerId,
    name: starter.playerName,
    playerName: starter.playerName,
    throwingHand: starter.throwingHand,
    throws: starter.throwingHand,
    confirmationStatus: "ADMIN_VERIFIED",
    starterStatus: "OPERATOR_VERIFIED",
    status: "CONFIRMED",
    confirmationMethod: "ADMIN_MANUAL",
    sourceType: meta.sourceType,
    source: meta.sourceType,
    enteredBy: meta.enteredBy,
    enteredAt: meta.enteredAt,
    sourceReference: meta.sourceReference,
    notes: null,
    fetchedAt: meta.enteredAt,
    statsAsOf: null,
    artifactGeneratedAt: meta.enteredAt,
    mappingStatus: playerId.startsWith("tmp-") ? "NAME_ONLY" : "ID_MATCHED",
    missingFeatures: [],
    warnings: playerId.startsWith("tmp-") ? ["PLAYER_ID_UNRESOLVED"] : [],
    displayStatusKo: "관리자 확인 완료",
  };
}

function buildLineupSide(
  team: string,
  homeOrAway: "HOME" | "AWAY",
  lineup: NonNullable<KboT45GameInput["home"]["lineup"]>,
  meta: ReturnType<typeof sourceMeta>,
) {
  const batters = lineup.map((b) => {
    const playerId =
      b.playerId?.trim() && !b.playerId.startsWith("tmp-")
        ? b.playerId.trim()
        : b.temporaryPlayerKey?.trim() || tempPlayerKey(team, b.playerName);
    return {
      slot: b.slot,
      playerName: b.playerName,
      playerId,
      position: b.position,
      bats: b.bats ?? null,
      handedness: b.bats ?? null,
      designatedHitter: Boolean(b.designatedHitter) || b.position === "지명타자",
      starter: true,
      mappingStatus: playerId.startsWith("tmp-") ? "NAME_ONLY" : "ID_MATCHED",
      warnings: playerId.startsWith("tmp-") ? ["PLAYER_ID_UNRESOLVED"] : [],
    };
  });
  return {
    side: homeOrAway,
    team,
    status: "CONFIRMED",
    confirmationMethod: "ADMIN_MANUAL",
    confirmationStatus: "ADMIN_VERIFIED",
    confirmed: true,
    operatorVerified: true,
    battingOrder: batters,
    batters,
    positions: batters.map((b) => ({ slot: b.slot, position: b.position })),
    designatedHitter: batters.find((b) => b.designatedHitter) ?? null,
    sourceType: meta.sourceType,
    source: meta.sourceType,
    sourceReference: meta.sourceReference,
    sourceNote: meta.sourceReference,
    enteredBy: meta.enteredBy,
    enteredAt: meta.enteredAt,
    fetchedAt: meta.enteredAt,
    confirmedAt: meta.enteredAt,
    displayStatusKo: "관리자 확인 완료",
    reasons: [],
    warnings: batters.some((b) => b.warnings.includes("PLAYER_ID_UNRESOLVED"))
      ? ["PLAYER_ID_UNRESOLVED_ALL_BATTERS"]
      : [],
  };
}

function changedFields(
  prev: unknown,
  next: unknown,
  prefix = "",
): string[] {
  if (prev === next) return [];
  if (
    prev == null ||
    next == null ||
    typeof prev !== "object" ||
    typeof next !== "object" ||
    Array.isArray(prev) ||
    Array.isArray(next)
  ) {
    return [prefix || "root"];
  }
  const keys = new Set([
    ...Object.keys(prev as object),
    ...Object.keys(next as object),
  ]);
  const out: string[] = [];
  for (const k of keys) {
    const p = (prev as Record<string, unknown>)[k];
    const n = (next as Record<string, unknown>)[k];
    const pathKey = prefix ? `${prefix}.${k}` : k;
    if (JSON.stringify(p) !== JSON.stringify(n)) {
      if (
        p != null &&
        n != null &&
        typeof p === "object" &&
        typeof n === "object" &&
        !Array.isArray(p) &&
        !Array.isArray(n)
      ) {
        out.push(...changedFields(p, n, pathKey));
      } else {
        out.push(pathKey);
      }
    }
  }
  return out;
}

export async function runKboT45PersonnelWorkflow(
  options: RunT45Options,
): Promise<T45WorkflowResult> {
  const cwd = options.cwd ?? process.cwd();
  const paths = kboT45Paths(options.dateKst, cwd);
  const dryRun = Boolean(options.dryRun);
  const validateOnly = Boolean(options.validateOnly);
  const writesSkipped = dryRun || validateOnly;
  const now = options.now ?? new Date();
  const enteredAt = now.toISOString();
  const runId = runIdFromIso(enteredAt);
  const adminId = options.adminId ?? "operator";

  const wouldCreateArtifacts: string[] = [];
  const writtenArtifacts: string[] = [];
  let providerCalls = 0;

  let rawText: string;
  try {
    rawText = await readFile(options.inputPath, "utf8");
  } catch {
    return {
      schemaVersion: "kbo-t45-personnel-workflow-result-v1",
      dryRun,
      validateOnly,
      dateKst: options.dateKst,
      runId,
      priorSnapshotRunId: null,
      globalBlocker: `GLOBAL_BLOCKER: input file missing: ${options.inputPath}`,
      games: [],
      wouldCreateArtifacts: [],
      wouldUpdateT30Inputs: false,
      writesSkipped: true,
      providerCalls: 0,
      writtenArtifacts: [],
      auditPath: null,
      personnelHash: null,
      domesticProtoHash: null,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return {
      schemaVersion: "kbo-t45-personnel-workflow-result-v1",
      dryRun,
      validateOnly,
      dateKst: options.dateKst,
      runId,
      priorSnapshotRunId: null,
      globalBlocker: "GLOBAL_BLOCKER: input JSON parse failed",
      games: [],
      wouldCreateArtifacts: [],
      wouldUpdateT30Inputs: false,
      writesSkipped: true,
      providerCalls: 0,
      writtenArtifacts: [],
      auditPath: null,
      personnelHash: null,
      domesticProtoHash: null,
    };
  }

  const parsed = parsePersonnelInputJson(parsedJson);
  if (!parsed.ok) {
    return {
      schemaVersion: "kbo-t45-personnel-workflow-result-v1",
      dryRun,
      validateOnly,
      dateKst: options.dateKst,
      runId,
      priorSnapshotRunId: null,
      globalBlocker: parsed.globalBlocker,
      games: [],
      wouldCreateArtifacts: [],
      wouldUpdateT30Inputs: false,
      writesSkipped: true,
      providerCalls: 0,
      writtenArtifacts: [],
      auditPath: null,
      personnelHash: null,
      domesticProtoHash: null,
    };
  }

  const input: KboT45PersonnelInputV1 = parsed.input;
  if (input.dateKst !== options.dateKst) {
    return {
      schemaVersion: "kbo-t45-personnel-workflow-result-v1",
      dryRun,
      validateOnly,
      dateKst: options.dateKst,
      runId,
      priorSnapshotRunId: null,
      globalBlocker: `GLOBAL_BLOCKER: date mismatch CLI=${options.dateKst} input=${input.dateKst}`,
      games: [],
      wouldCreateArtifacts: [],
      wouldUpdateT30Inputs: false,
      writesSkipped: true,
      providerCalls: 0,
      writtenArtifacts: [],
      auditPath: null,
      personnelHash: null,
      domesticProtoHash: null,
    };
  }

  const gameFilter = options.gameIds?.length
    ? new Set(options.gameIds)
    : null;

  let priorPersonnel: Record<string, unknown> | null =
    options.priorPersonnel !== undefined
      ? options.priorPersonnel
      : null;
  let priorProto: Record<string, unknown> | null =
    options.priorProto !== undefined ? options.priorProto : null;

  if (options.priorPersonnel === undefined && (await exists(paths.personnelSnapshot))) {
    priorPersonnel = JSON.parse(
      await readFile(paths.personnelSnapshot, "utf8"),
    ) as Record<string, unknown>;
  }
  if (options.priorProto === undefined && (await exists(paths.domesticProtoSnapshot))) {
    priorProto = JSON.parse(
      await readFile(paths.domesticProtoSnapshot, "utf8"),
    ) as Record<string, unknown>;
  }

  const priorSnapshotRunId =
    typeof priorPersonnel?.runId === "string" ? priorPersonnel.runId : null;
  const priorPersonnelHash =
    typeof priorPersonnel?.personnelHash === "string"
      ? priorPersonnel.personnelHash
      : priorPersonnel?.games
        ? sha256Json(priorPersonnel.games)
        : null;
  const priorProtoHash =
    typeof priorProto?.domesticProtoHash === "string"
      ? priorProto.domesticProtoHash
      : priorProto?.games
        ? sha256Json(priorProto.games)
        : null;

  const lockedSet = options.lockedGameIds ?? new Set<string>();
  // Detect T30 lock via prediction file tip when available
  if (await exists(paths.prediction)) {
    try {
      const pred = JSON.parse(await readFile(paths.prediction, "utf8")) as {
        lockPhase?: string;
        games?: { gameId?: string }[];
      };
      if (
        pred.lockPhase === "T30_FINAL_PREGAME_LOCK" ||
        pred.lockPhase === "ADMIN_VERIFIED_PERSONNEL_PROTO_REVISION"
      ) {
        for (const g of pred.games ?? []) {
          if (g.gameId) lockedSet.add(g.gameId);
        }
      }
    } catch {
      /* ignore malformed prediction for cutoff probe */
    }
  }

  const selectedGames = input.games.filter(
    (g) => !gameFilter || gameFilter.has(g.gameId),
  );

  const gameResults: GameValidationResult[] = [];
  const acceptedGames: KboT45GameInput[] = [];

  for (const game of selectedGames) {
    const result = validateGame(game, {
      nowMs: now.getTime(),
      lockedPredictionExists: lockedSet.has(game.gameId),
      cancellationStatus: game.cancellationStatus ?? null,
    });
    gameResults.push(result);
    if (
      result.status === "AFTER_CUTOFF" ||
      result.status === "ALREADY_LOCKED" ||
      result.status === "FAILED" ||
      result.status === "BLOCKED_AFTER_START" ||
      result.status === "NOT_APPLICABLE"
    ) {
      continue;
    }
    // Allow PARTIAL saves (DRAFT) and ADMIN_VERIFIED
    if (result.status === "NOT_AVAILABLE" && result.errors.length) {
      continue;
    }
    acceptedGames.push(game);
  }

  const writable = acceptedGames.filter((g) => {
    const r = gameResults.find((x) => x.gameId === g.gameId);
    return r && r.status !== "FAILED";
  });

  const defaultSourceType =
    (input.sourceType as AdminSourceType) ||
    "ADMIN_MANUAL_SCREENSHOT";
  const defaultSourceRef =
    options.sourceReference ||
    input.sourceReference ||
    "ADMIN_MANUAL_INPUT";
  const commercial = defaultCommercialUse(input.commercialUseStatus);

  const personnelGameRows: Record<string, unknown>[] = [];
  const protoGameRows: Record<string, unknown>[] = [];

  for (const g of writable) {
    const vr = gameResults.find((x) => x.gameId === g.gameId)!;
    const observedAt = g.observedAt;
    const meta = sourceMeta({
      sourceType: (g.sourceType as AdminSourceType) || defaultSourceType,
      sourceReference: g.sourceReference || defaultSourceRef,
      commercialUseStatus: commercial,
      observedAt,
      enteredAt,
      enteredBy: adminId,
    });

    const homeStarterId = g.home.starter
      ? g.home.starter.playerId?.trim() &&
        !g.home.starter.playerId.startsWith("tmp-")
        ? g.home.starter.playerId.trim()
        : tempPlayerKey(g.homeTeam, g.home.starter.playerName)
      : null;
    const awayStarterId = g.away.starter
      ? g.away.starter.playerId?.trim() &&
        !g.away.starter.playerId.startsWith("tmp-")
        ? g.away.starter.playerId.trim()
        : tempPlayerKey(g.awayTeam, g.away.starter.playerName)
      : null;

    const homeStarter =
      g.home.starter && homeStarterId
        ? buildStarterSide(g.homeTeam, g.home.starter, meta, homeStarterId)
        : null;
    const awayStarter =
      g.away.starter && awayStarterId
        ? buildStarterSide(g.awayTeam, g.away.starter, meta, awayStarterId)
        : null;
    const homeLineup =
      g.home.lineup && vr.lineupOk
        ? buildLineupSide(g.homeTeam, "HOME", g.home.lineup, meta)
        : g.home.lineup
          ? {
              ...buildLineupSide(g.homeTeam, "HOME", g.home.lineup, meta),
              status: "PARTIAL",
              confirmationStatus: "PARTIAL",
              confirmed: false,
            }
          : null;
    const awayLineup =
      g.away.lineup && vr.lineupOk
        ? buildLineupSide(g.awayTeam, "AWAY", g.away.lineup, meta)
        : g.away.lineup
          ? {
              ...buildLineupSide(g.awayTeam, "AWAY", g.away.lineup, meta),
              status: "PARTIAL",
              confirmationStatus: "PARTIAL",
              confirmed: false,
            }
          : null;

    const teamHash = sha256Json({
      gameId: g.gameId,
      homeStarter,
      awayStarter,
      homeLineup: (homeLineup as { batters?: unknown } | null)?.batters ?? null,
      awayLineup: (awayLineup as { batters?: unknown } | null)?.batters ?? null,
    });

    personnelGameRows.push({
      gameId: g.gameId,
      matchup: `${g.awayTeam} @ ${g.homeTeam}`,
      scheduledStartTime: g.scheduledStartTime,
      home: { team: g.homeTeam, starter: homeStarter, lineup: homeLineup },
      away: { team: g.awayTeam, starter: awayStarter, lineup: awayLineup },
      personnelHash: teamHash,
      status: vr.status === "ADMIN_VERIFIED" ? "CONFIRMED" : vr.status,
      confirmationMethod: "ADMIN_MANUAL",
      completeness: vr.completeness,
      predictionUsability: vr.predictionUsability,
      displayStatusKo: "관리자 확인 완료",
      warnings: vr.warnings,
    });

    if (g.domesticProto && vr.protoOk) {
      protoGameRows.push({
        gameId: g.gameId,
        matchup: `${g.awayTeam} @ ${g.homeTeam}`,
        marketNamespace: "DOMESTIC_PROTO",
        marketType: "MONEYLINE_2WAY",
        status: "MANUAL_COLLECTED",
        format: "DECIMAL",
        sourceType: meta.sourceType,
        commercialUseStatus: commercial,
        capturedBeforeStart: true,
        capturedAt: observedAt,
        enteredAt,
        home: {
          team: g.homeTeam,
          odds: g.domesticProto.homePrice,
          selectionCode: "HOME",
        },
        away: {
          team: g.awayTeam,
          odds: g.domesticProto.awayPrice,
          selectionCode: "AWAY",
        },
        mapping: {
          homeOk: true,
          awayOk: true,
          homeAwayOrderVerified: true,
          homeCanonicalTeamId: resolveKboTeamIdentity(g.homeTeam).canonicalTeamId,
          awayCanonicalTeamId: resolveKboTeamIdentity(g.awayTeam).canonicalTeamId,
        },
      });
    }
  }

  // Merge with prior snapshot games not in this write set (single-game preservation)
  const writtenIds = new Set(personnelGameRows.map((g) => g.gameId as string));
  const priorGames = Array.isArray(priorPersonnel?.games)
    ? (priorPersonnel!.games as Record<string, unknown>[])
    : [];
  const priorProtoGames = Array.isArray(priorProto?.games)
    ? (priorProto!.games as Record<string, unknown>[])
    : [];

  for (const pg of priorGames) {
    const id = String(pg.gameId ?? "");
    if (id && !writtenIds.has(id) && (!gameFilter || !gameFilter.has(id))) {
      personnelGameRows.push(pg);
    } else if (id && gameFilter && !gameFilter.has(id) && !writtenIds.has(id)) {
      personnelGameRows.push(pg);
    }
  }
  // When filtering to one game, keep other prior games
  if (gameFilter) {
    for (const pg of priorGames) {
      const id = String(pg.gameId ?? "");
      if (id && !gameFilter.has(id) && !personnelGameRows.some((x) => x.gameId === id)) {
        personnelGameRows.push(pg);
      }
    }
    for (const pg of priorProtoGames) {
      const id = String(pg.gameId ?? "");
      if (
        id &&
        !gameFilter.has(id) &&
        !protoGameRows.some((x) => x.gameId === id)
      ) {
        protoGameRows.push(pg);
      }
    }
  } else {
    for (const pg of priorProtoGames) {
      const id = String(pg.gameId ?? "");
      if (id && !writtenIds.has(id) && !protoGameRows.some((x) => x.gameId === id)) {
        // only keep if this run didn't touch any proto for slate overwrite of accepted set
        if (!writable.some((w) => w.gameId === id)) {
          protoGameRows.push(pg);
        }
      }
    }
  }

  const personnelHash = personnelGameRows.length
    ? sha256Json(personnelGameRows)
    : null;
  const domesticProtoHash = protoGameRows.length
    ? sha256Json(protoGameRows)
    : null;

  const metaRoot = sourceMeta({
    sourceType: defaultSourceType,
    sourceReference: defaultSourceRef,
    commercialUseStatus: commercial,
    observedAt:
      writable[0]?.observedAt ?? input.createdAt ?? enteredAt,
    enteredAt,
    enteredBy: adminId,
  });

  const personnelDoc = {
    schemaVersion: "kbo-personnel-snapshot-v1",
    personnelSnapshotId: `kbo-personnel-${options.dateKst}-${runId}`,
    sport: "baseball",
    league: "KBO",
    date: options.dateKst,
    runId,
    priorSnapshotRunId,
    previousHash: priorPersonnelHash,
    nextHash: personnelHash,
    revisionReason: priorSnapshotRunId
      ? "ADMIN_VERIFIED_PERSONNEL_UPDATE"
      : "ADMIN_VERIFIED_PERSONNEL_CREATED",
    version: priorSnapshotRunId ? 2 : 1,
    previousVersionId: priorSnapshotRunId,
    lockedAt: null as string | null,
    scheduledStartTime: writable[0]?.scheduledStartTime ?? null,
    source: metaRoot,
    projectedData: null,
    adminVerifiedData: true,
    providerConfirmedData: false,
    games: personnelGameRows,
    personnelHash,
    validationErrors: gameResults.flatMap((g) => g.errors),
    summary: {
      teamSides: personnelGameRows.length * 2,
      acceptedGames: writable.length,
      failedGames: gameResults.filter((g) => g.status === "FAILED").length,
      cutoffBlocked: gameResults.filter(
        (g) =>
          g.status === "AFTER_CUTOFF" ||
          g.status === "ALREADY_LOCKED" ||
          g.status === "BLOCKED_AFTER_START",
      ).length,
    },
  };

  const protoDoc = {
    schemaVersion: "kbo-domestic-proto-snapshot-v1",
    domesticProtoSnapshotId: `kbo-domestic-proto-${options.dateKst}-${runId}`,
    sport: "baseball",
    league: "KBO",
    date: options.dateKst,
    runId,
    priorSnapshotRunId,
    previousHash: priorProtoHash,
    nextHash: domesticProtoHash,
    revisionReason: priorSnapshotRunId
      ? "ADMIN_VERIFIED_PROTO_UPDATE"
      : "ADMIN_VERIFIED_PROTO_CREATED",
    lockedAt: null as string | null,
    source: metaRoot,
    marketNamespace: "DOMESTIC_PROTO",
    games: protoGameRows,
    domesticProtoHash,
    commercialUseStatus: commercial,
    summary: {
      moneylineGames: protoGameRows.length,
      decimalValidationPass: protoGameRows.every((g) => {
        const h = (g as { home?: { odds?: number } }).home?.odds;
        const a = (g as { away?: { odds?: number } }).away?.odds;
        return typeof h === "number" && typeof a === "number" && h > 1 && a > 1;
      }),
    },
    note: "DOMESTIC_PROTO namespace separate from OVERSEAS_MARKET; not merged into a single odds field",
  };

  // Operator bridge files (compatible with existing T30 file-presence checks)
  const starterOp = {
    schemaVersion: "kbo-starter-confirmation-v1",
    targetDateKst: options.dateKst,
    sourceType: "OPERATOR_VERIFIED",
    reviewStatus: "VERIFIED",
    createdAt: enteredAt,
    updatedAt: enteredAt,
    metadata: metaRoot,
    games: writable
      .filter((g) => g.home.starter && g.away.starter)
      .map((g, i) => {
      const homeId =
        g.home.starter?.playerId?.trim() &&
        !g.home.starter.playerId.startsWith("tmp-")
          ? g.home.starter.playerId.trim()
          : tempPlayerKey(g.homeTeam, g.home.starter!.playerName);
      const awayId =
        g.away.starter?.playerId?.trim() &&
        !g.away.starter.playerId.startsWith("tmp-")
          ? g.away.starter.playerId.trim()
          : tempPlayerKey(g.awayTeam, g.away.starter!.playerName);
      const providerGameId = g.gameId.replace(/^kbo-/i, "");
      return {
        operatorStarterInputId: `KBO-STARTER-${options.dateKst.replace(/-/g, "")}-${String(i + 1).padStart(2, "0")}`,
        internalGameId: g.gameId,
        providerGameId,
        awayTeam: g.awayTeam,
        homeTeam: g.homeTeam,
        scheduledStartTimeKst: g.scheduledStartTime,
        awayStarter: {
          playerId: awayId,
          playerName: g.away.starter!.playerName,
          throwingHand: g.away.starter!.throwingHand,
          starterStatus: "OPERATOR_VERIFIED",
          sourceType: "OPERATOR_CONFIRMED",
          sourceReference: {
            sourceType: "OPERATOR_CONFIRMED",
            sourceName: defaultSourceRef,
            sourceUrl: null,
            sourceTitle: "KBO T45 personnel input",
            capturedBy: adminId,
            capturedAt: g.observedAt,
            notes: `${defaultSourceType}; ${commercial}`,
          },
          announcedAt: null,
          capturedAt: g.observedAt,
          mappingStatus: awayId.startsWith("tmp-") ? "NAME_ONLY" : "ID_MATCHED",
          notes: awayId.startsWith("tmp-")
            ? "PLAYER_ID_UNRESOLVED; 관리자 확인 완료"
            : "관리자 확인 완료",
        },
        homeStarter: {
          playerId: homeId,
          playerName: g.home.starter!.playerName,
          throwingHand: g.home.starter!.throwingHand,
          starterStatus: "OPERATOR_VERIFIED",
          sourceType: "OPERATOR_CONFIRMED",
          sourceReference: {
            sourceType: "OPERATOR_CONFIRMED",
            sourceName: defaultSourceRef,
            sourceUrl: null,
            sourceTitle: "KBO T45 personnel input",
            capturedBy: adminId,
            capturedAt: g.observedAt,
            notes: `${defaultSourceType}; ${commercial}`,
          },
          announcedAt: null,
          capturedAt: g.observedAt,
          mappingStatus: homeId.startsWith("tmp-") ? "NAME_ONLY" : "ID_MATCHED",
          notes: homeId.startsWith("tmp-")
            ? "PLAYER_ID_UNRESOLVED; 관리자 확인 완료"
            : "관리자 확인 완료",
        },
        capturedAt: g.observedAt,
        enteredAt,
        reviewedAt: enteredAt,
        reviewedBy: adminId,
        reviewStatus: "VERIFIED",
        mappingStatus: "MATCHED",
        warnings: ["PLAYER_ID_UNRESOLVED"],
        blockingReasons: [],
      };
    }),
  };

  const lineupOp = {
    schemaVersion: "kbo-lineup-confirmation-v1",
    targetDateKst: options.dateKst,
    sourceType: "OPERATOR_VERIFIED",
    reviewStatus: "CONFIRMED",
    createdAt: enteredAt,
    updatedAt: enteredAt,
    games: writable
      .filter((g) => g.home.lineup && g.away.lineup)
      .map((g) => {
        const meta = sourceMeta({
          sourceType: defaultSourceType,
          sourceReference: defaultSourceRef,
          commercialUseStatus: commercial,
          observedAt: g.observedAt,
          enteredAt,
          enteredBy: adminId,
        });
        return {
          lineupInputId: `${g.gameId}-lineup`,
          internalGameId: g.gameId,
          providerGameId: g.gameId.replace(/^kbo-/i, ""),
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          scheduledStartTimeKst: g.scheduledStartTime,
          reviewStatus: "CONFIRMED",
          enteredAt,
          homeLineup: buildLineupSide(g.homeTeam, "HOME", g.home.lineup!, meta),
          awayLineup: buildLineupSide(g.awayTeam, "AWAY", g.away.lineup!, meta),
        };
      }),
    metadata: { inputMethod: "MANUAL", notes: defaultSourceRef, ...metaRoot },
  };

  const marketsOp = {
    dateKst: options.dateKst,
    round: "",
    capturedAt: enteredAt,
    enteredAt,
    enteredBy: adminId,
    sourceLabel: "ADMIN_MANUAL_SCREENSHOT_PREGAME_PROTO",
    inputMethod: "MANUAL",
    reviewStatus: "VERIFIED",
    games: writable
      .filter((g) => {
        const r = gameResults.find((x) => x.gameId === g.gameId);
        return g.domesticProto && r?.protoOk;
      })
      .map((g) => {
        const homeId = resolveKboTeamIdentity(g.homeTeam);
        const awayId = resolveKboTeamIdentity(g.awayTeam);
        return {
          operatorGameId: `KBO-${options.dateKst.replace(/-/g, "")}-${g.homeTeam}-${g.awayTeam}`,
          internalGameId: g.gameId,
          providerGameId: g.gameId.replace(/^kbo-/i, ""),
          homeTeamText: g.homeTeam,
          awayTeamText: g.awayTeam,
          canonicalHomeTeamId: homeId.canonicalTeamId,
          canonicalAwayTeamId: awayId.canonicalTeamId,
          startTimeKst: g.scheduledStartTime,
          mappingStatus: "MATCHED",
          reviewStatus: "VERIFIED",
          blockingReasons: [],
          markets: [
            {
              operatorMarketId: `${g.gameId}-domestic-proto-moneyline`,
              marketType: "MONEYLINE_2WAY",
              period: "FULL_GAME",
              line: null,
              displayLabel: "국내 프로토 승패",
              marketNamespace: "DOMESTIC_PROTO",
              reviewStatus: "VERIFIED",
              status: "MANUAL_COLLECTED",
              format: "DECIMAL",
              sourceType: defaultSourceType,
              commercialUseStatus: commercial,
              capturedBeforeStart: true,
              selections: [
                {
                  selectionCode: "HOME",
                  selectionLabel: `${g.homeTeam} 홈`,
                  odds: g.domesticProto!.homePrice,
                  reviewStatus: "VERIFIED",
                },
                {
                  selectionCode: "AWAY",
                  selectionLabel: `${g.awayTeam} 원정`,
                  odds: g.domesticProto!.awayPrice,
                  reviewStatus: "VERIFIED",
                },
              ],
              notes: defaultSourceRef,
            },
          ],
          notes: defaultSourceRef,
        };
      }),
    metadata: {
      sourceType: "SCREENSHOT_TRANSCRIPTION",
      screenshotCount: null,
      notes: defaultSourceRef,
      commercialUseStatus: commercial,
      marketNamespace: "DOMESTIC_PROTO",
    },
  };

  const auditRows = [
    {
      action: priorSnapshotRunId ? "UPDATED" : "CREATED",
      actor: adminId,
      occurredAt: enteredAt,
      previousVersionId: priorSnapshotRunId,
      previousHash: priorPersonnelHash,
      nextHash: personnelHash,
      changedFields: priorPersonnel
        ? changedFields(
            { games: priorPersonnel.games },
            { games: personnelGameRows },
          ).slice(0, 50)
        : ["games"],
      reason: personnelDoc.revisionReason,
    },
  ];

  const auditDoc = {
    schemaVersion: "kbo-t45-personnel-workflow-audit-v1",
    dateKst: options.dateKst,
    runId,
    dryRun,
    validateOnly,
    providerCalls: 0,
    games: gameResults,
    audit: auditRows,
    wouldCreateArtifacts: [] as string[],
    writtenArtifacts: [] as string[],
  };

  const artifactPlan = [
    paths.personnelSnapshot,
    paths.domesticProtoSnapshot,
    paths.starterConfirmation,
    paths.lineupConfirmation,
    paths.operatorMarkets,
    paths.workflowAudit,
  ];

  for (const p of artifactPlan) {
    wouldCreateArtifacts.push(path.relative(cwd, p).replace(/\\/g, "/"));
  }
  auditDoc.wouldCreateArtifacts = wouldCreateArtifacts;

  const wouldUpdateT30Inputs =
    personnelGameRows.length > 0 || protoGameRows.length > 0;

  if (!writesSkipped && writable.length > 0) {
    await mkdir(paths.operatorRoot, { recursive: true });
    await mkdir(paths.researchRoot, { recursive: true });
    await mkdir(paths.auditsRoot, { recursive: true });

    if (priorSnapshotRunId && (await exists(paths.personnelSnapshot))) {
      const rev = paths.personnelSnapshot.replace(
        /\.json$/i,
        `.rev-${priorSnapshotRunId}.json`,
      );
      if (!(await exists(rev))) await copyFile(paths.personnelSnapshot, rev);
    }
    if (priorSnapshotRunId && (await exists(paths.domesticProtoSnapshot))) {
      const rev = paths.domesticProtoSnapshot.replace(
        /\.json$/i,
        `.rev-${priorSnapshotRunId}.json`,
      );
      if (!(await exists(rev))) await copyFile(paths.domesticProtoSnapshot, rev);
    }

    const writes: [string, unknown][] = [
      [paths.personnelSnapshot, personnelDoc],
      [paths.domesticProtoSnapshot, protoDoc],
      [paths.starterConfirmation, starterOp],
      [paths.lineupConfirmation, lineupOp],
      [paths.operatorMarkets, marketsOp],
      [paths.workflowAudit, auditDoc],
    ];
    for (const [fp, doc] of writes) {
      await writeFile(fp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
      writtenArtifacts.push(path.relative(cwd, fp).replace(/\\/g, "/"));
    }
    auditDoc.writtenArtifacts = writtenArtifacts;
    await writeFile(
      paths.workflowAudit,
      `${JSON.stringify(auditDoc, null, 2)}\n`,
      "utf8",
    );
  } else if (!writesSkipped && writable.length === 0) {
    // Still write audit for failed-only runs
    await mkdir(paths.auditsRoot, { recursive: true });
    await writeFile(
      paths.workflowAudit,
      `${JSON.stringify({ ...auditDoc, writtenArtifacts: [] }, null, 2)}\n`,
      "utf8",
    );
    writtenArtifacts.push(
      path.relative(cwd, paths.workflowAudit).replace(/\\/g, "/"),
    );
  }

  void providerCalls;

  const readinessSummary = summarizeT45Readiness(gameResults);

  return {
    schemaVersion: "kbo-t45-personnel-workflow-result-v1",
    dryRun,
    validateOnly,
    dateKst: options.dateKst,
    runId,
    priorSnapshotRunId,
    globalBlocker: null,
    games: gameResults,
    wouldCreateArtifacts,
    wouldUpdateT30Inputs,
    writesSkipped,
    providerCalls: 0,
    writtenArtifacts: writesSkipped ? [] : writtenArtifacts,
    auditPath: writesSkipped
      ? null
      : path.relative(cwd, paths.workflowAudit).replace(/\\/g, "/"),
    personnelHash: writesSkipped ? personnelHash : personnelHash,
    domesticProtoHash: writesSkipped ? domesticProtoHash : domesticProtoHash,
    readinessSummary,
  };
}
