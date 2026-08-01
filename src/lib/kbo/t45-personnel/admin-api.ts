/**
 * KBO T45 Admin UI/API — load / validate / save / run.
 * Reuses t45-personnel validators & workflow. No Engine / Provider / T30 auto-run.
 */
import "server-only";

import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "@/lib/datetime/kst";
import { kboT45Paths } from "./paths";
import {
  runKboT45PersonnelWorkflow,
  type RunT45Options,
} from "./run-t45-personnel-workflow";
import type {
  KboT45GameInput,
  KboT45PersonnelInputV1,
} from "./types";
import type {
  KboT45AdminLoadResult,
  KboT45GameAdminView,
  KboT45RunApiResult,
  KboT45SaveApiResult,
  KboT45ValidateApiResult,
} from "./admin-view-types";
import {
  parsePersonnelInputJson,
  validateGame,
} from "./validate-personnel-input";

export type {
  KboT45AdminLoadResult,
  KboT45GameAdminView,
  KboT45RunApiResult,
  KboT45SaveApiResult,
  KboT45ValidateApiResult,
  ValidationView,
} from "./admin-view-types";


async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, filePath);
}

function sha256Json(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function windowLabel(
  secondsUntilStart: number | null,
  locked: boolean,
  afterCutoff: boolean,
): KboT45GameAdminView["windowLabel"] {
  if (locked) return "ALREADY_LOCKED";
  if (afterCutoff || (secondsUntilStart != null && secondsUntilStart <= 0)) {
    return "AFTER_CUTOFF";
  }
  if (secondsUntilStart == null) return "OPEN";
  const mins = secondsUntilStart / 60;
  if (mins <= 10) return "LOCK_WINDOW";
  if (mins <= 35) return "T30_WINDOW";
  if (mins <= 50) return "T45_WINDOW";
  return "OPEN";
}

function emptyLineup() {
  return Array.from({ length: 9 }, (_, i) => ({
    slot: i + 1,
    playerName: "",
    position: "",
    bats: null as "L" | "R" | "S" | null,
    designatedHitter: false,
  }));
}

function emptyGameDraft(
  gameId: string,
  homeTeam: string,
  awayTeam: string,
  scheduledStartTime: string,
): KboT45GameInput {
  const observedAt = new Date().toISOString();
  return {
    gameId,
    homeTeam,
    awayTeam,
    scheduledStartTime,
    observedAt,
    sourceType: "ADMIN_MANUAL_SCREENSHOT",
    sourceReference: "",
    home: {
      starter: { playerName: "", throwingHand: null },
      lineup: emptyLineup(),
    },
    away: {
      starter: { playerName: "", throwingHand: null },
      lineup: emptyLineup(),
    },
    domesticProto: { homePrice: 0, awayPrice: 0, format: "DECIMAL" },
  };
}

async function loadLockedGameIds(
  paths: ReturnType<typeof kboT45Paths>,
): Promise<Set<string>> {
  const locked = new Set<string>();
  if (!(await exists(paths.prediction))) return locked;
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
        if (g.gameId) locked.add(g.gameId);
      }
    }
  } catch {
    /* ignore */
  }
  return locked;
}

export async function loadKboT45AdminView(options: {
  dateKst: string;
  cwd?: string;
  now?: Date;
}): Promise<KboT45AdminLoadResult> {
  const cwd = options.cwd ?? process.cwd();
  const dateKst = options.dateKst;
  const now = options.now ?? new Date();
  const paths = kboT45Paths(dateKst, cwd);
  const inputPathRel = path
    .relative(cwd, paths.personnelInput)
    .replace(/\\/g, "/");

  const legalNotice = [
    "관리자 확인 데이터는 공식 리그 데이터 또는 공식 Provider 데이터와 동일하지 않습니다.",
    "INTERNAL_ONLY 데이터는 외부 공개·재배포 대상으로 자동 승격되지 않습니다.",
    "표시 라벨: 관리자 확인 완료 / 예상 구성 — 금지: 공식 라인업·선발·배당.",
    "인증 체계 미구현: 내부 전용. production에서는 INTERNAL_ADMIN_TOKEN 필수.",
  ];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    return {
      ok: false,
      dateKst,
      nowIso: now.toISOString(),
      nowKstHint: getKstToday(),
      scheduleExists: false,
      inputExists: false,
      inputPathRel,
      personnelHash: null,
      domesticProtoHash: null,
      snapshotVersion: null,
      predictionLocked: false,
      historicalReadOnly: true,
      authNote: "INTERNAL_ONLY",
      legalNotice,
      games: [],
      existingInput: null,
      errorCode: "INVALID_DATE_KST",
      message: "date must be YYYY-MM-DD",
    };
  }

  const scheduleExists = await exists(paths.schedule);
  const inputExists = await exists(paths.personnelInput);
  const lockedIds = await loadLockedGameIds(paths);
  const predictionLocked = lockedIds.size > 0;

  let existingInput: KboT45PersonnelInputV1 | null = null;
  if (inputExists) {
    try {
      const parsed = parsePersonnelInputJson(
        JSON.parse(await readFile(paths.personnelInput, "utf8")),
      );
      if (parsed.ok) existingInput = parsed.input;
    } catch {
      existingInput = null;
    }
  }

  let personnelHash: string | null = null;
  let domesticProtoHash: string | null = null;
  let snapshotVersion: number | null = null;
  if (await exists(paths.personnelSnapshot)) {
    try {
      const snap = JSON.parse(
        await readFile(paths.personnelSnapshot, "utf8"),
      ) as { personnelHash?: string; version?: number };
      personnelHash =
        typeof snap.personnelHash === "string" ? snap.personnelHash : null;
      snapshotVersion =
        typeof snap.version === "number" ? snap.version : null;
    } catch {
      /* ignore */
    }
  }
  if (await exists(paths.domesticProtoSnapshot)) {
    try {
      const snap = JSON.parse(
        await readFile(paths.domesticProtoSnapshot, "utf8"),
      ) as { domesticProtoHash?: string };
      domesticProtoHash =
        typeof snap.domesticProtoHash === "string"
          ? snap.domesticProtoHash
          : null;
    } catch {
      /* ignore */
    }
  }

  // Historical locked dates are always read-only in admin UI
  const historicalReadOnly =
    predictionLocked || dateKst === "2026-07-31";

  type SchedGame = {
    gameId?: string;
    home?: string;
    away?: string;
    scheduledStartTime?: string;
    statusAbstract?: string | null;
    statusDetailed?: string | null;
    codedGameState?: string | null;
    clockState?: string | null;
    cancellationStatus?: string | null;
  };
  let scheduleGames: SchedGame[] = [];
  if (scheduleExists) {
    try {
      const doc = JSON.parse(await readFile(paths.schedule, "utf8")) as {
        games?: SchedGame[];
      };
      scheduleGames = Array.isArray(doc.games) ? doc.games : [];
    } catch {
      scheduleGames = [];
    }
  }

  const byId = new Map(
    (existingInput?.games ?? []).map((g) => [g.gameId, g]),
  );

  const games: KboT45GameAdminView[] = scheduleGames
    .filter((g) => g.gameId && g.home && g.away && g.scheduledStartTime)
    .map((g) => {
      const gameId = String(g.gameId);
      const homeTeam = String(g.home);
      const awayTeam = String(g.away);
      const scheduledStartTime = String(g.scheduledStartTime);
      const startMs = Date.parse(scheduledStartTime);
      const secondsUntilStart = Number.isFinite(startMs)
        ? Math.round((startMs - now.getTime()) / 1000)
        : null;
      const locked = lockedIds.has(gameId) || historicalReadOnly;
      const afterCutoff =
        Number.isFinite(startMs) && now.getTime() >= startMs;
      const draft =
        byId.get(gameId) ??
        emptyGameDraft(gameId, homeTeam, awayTeam, scheduledStartTime);

      const vr = validateGame(draft, {
        nowMs: now.getTime(),
        lockedPredictionExists: locked,
        statusAbstract: g.statusAbstract ?? null,
        statusDetailed: g.statusDetailed ?? null,
        codedGameState: g.codedGameState ?? null,
        clockState: g.clockState ?? null,
        cancellationStatus:
          g.cancellationStatus ?? draft.cancellationStatus ?? null,
      });

      const starterErrors = vr.errors.filter((e) =>
        e.includes("STARTER"),
      );
      const lineupErrors = vr.errors.filter(
        (e) =>
          e.includes("LINEUP") ||
          e.includes("BATTING") ||
          e.includes("DUPLICATE") ||
          e.includes("POSITION") ||
          e.includes("BATTER"),
      );
      const protoErrors = vr.errors.filter(
        (e) =>
          e.includes("PROTO") ||
          e.includes("PRICE") ||
          e.includes("TEAM_MAPPING") ||
          e.includes("DOMESTIC"),
      );

      let currentStatus: string = "NOT_ENTERED";
      if (vr.status === "NOT_APPLICABLE") currentStatus = "NOT_APPLICABLE";
      else if (locked) currentStatus = "ALREADY_LOCKED";
      else if (afterCutoff) currentStatus = "AFTER_CUTOFF";
      else if (vr.status === "FAILED") currentStatus = "VALIDATION_FAILED";
      else if (vr.status === "ADMIN_VERIFIED") currentStatus = "ADMIN_VERIFIED";
      else if (vr.completeness === "PARTIAL") currentStatus = "PARTIAL";
      else if (byId.has(gameId)) currentStatus = "DRAFT";
      else currentStatus = "NOT_ENTERED";

      return {
        gameId,
        scheduledStartTime,
        homeTeam,
        awayTeam,
        currentStatus,
        completeness:
          vr.status === "NOT_APPLICABLE"
            ? ("NOT_APPLICABLE" as const)
            : byId.has(gameId)
              ? vr.completeness
              : ("NOT_ENTERED" as const),
        predictionUsability: vr.predictionUsability,
        locked,
        afterCutoff,
        readOnly:
          locked ||
          afterCutoff ||
          historicalReadOnly ||
          vr.status === "NOT_APPLICABLE",
        secondsUntilStart,
        windowLabel: windowLabel(secondsUntilStart, locked, afterCutoff),
        starterValidation: {
          ok: vr.status === "NOT_APPLICABLE" ? true : vr.starterOk,
          errors: starterErrors,
          warnings: vr.warnings.filter((w) => w.includes("PLAYER_ID")),
        },
        lineupValidation: {
          ok: vr.status === "NOT_APPLICABLE" ? true : vr.lineupOk,
          errors: lineupErrors,
          warnings: [],
        },
        protoValidation: {
          ok: vr.status === "NOT_APPLICABLE" ? true : vr.protoOk,
          errors: protoErrors,
          warnings: [],
        },
        version: snapshotVersion,
        warnings: vr.warnings,
        errors: vr.errors,
        draft,
      };
    });

  return {
    ok: true,
    dateKst,
    nowIso: now.toISOString(),
    nowKstHint: getKstToday(),
    scheduleExists,
    inputExists,
    inputPathRel,
    personnelHash,
    domesticProtoHash,
    snapshotVersion,
    predictionLocked,
    historicalReadOnly,
    authNote:
      "INTERNAL_ONLY — auth not fully implemented; token or non-production required",
    legalNotice,
    games,
    existingInput,
  };
}

export function validateKboT45AdminPayload(options: {
  payload: unknown;
  now?: Date;
  lockedGameIds?: Set<string>;
  cwd?: string;
}): KboT45ValidateApiResult {
  const now = options.now ?? new Date();
  const parsed = parsePersonnelInputJson(options.payload);
  if (!parsed.ok) {
    return {
      status: "INVALID",
      dateKst: "",
      globalErrors: [parsed.globalBlocker],
      games: [],
      wouldCreateArtifacts: [],
      mutationPerformed: false,
      personnelHashPreview: null,
    };
  }

  const input = parsed.input;
  const locked = options.lockedGameIds ?? new Set<string>();
  const games = input.games.map((g) =>
    validateGame(g, {
      nowMs: now.getTime(),
      lockedPredictionExists: locked.has(g.gameId),
      cancellationStatus: g.cancellationStatus ?? null,
    }),
  );

  const required = games.filter((g) => g.requirementsApplicable !== false);
  const blocked = required.some(
    (g) =>
      g.status === "AFTER_CUTOFF" ||
      g.status === "ALREADY_LOCKED" ||
      g.status === "BLOCKED_AFTER_START",
  );
  const failed = required.some((g) => g.status === "FAILED");
  const allVerified =
    required.length > 0 &&
    required.every(
      (g) => g.status === "ADMIN_VERIFIED" && g.completeness === "COMPLETE",
    );
  const anyPartial = required.some(
    (g) => g.completeness === "PARTIAL" || g.status === "DRAFT",
  );

  let status: KboT45ValidateApiResult["status"] = "INVALID";
  if (blocked) status = "BLOCKED";
  else if (failed) status = "INVALID";
  else if (allVerified) status = "VALID";
  else if (anyPartial || required.some((g) => g.protoOk || g.starterOk || g.lineupOk))
    status = "PARTIAL";
  else if (required.length === 0 && games.length > 0) status = "VALID";
  else status = "INVALID";

  const cwd = options.cwd ?? process.cwd();
  const paths = kboT45Paths(input.dateKst, cwd);
  const wouldCreateArtifacts = [
    paths.personnelInput,
    paths.personnelSnapshot,
    paths.domesticProtoSnapshot,
    paths.workflowAudit,
  ].map((p) => path.relative(cwd, p).replace(/\\/g, "/"));

  return {
    status,
    dateKst: input.dateKst,
    globalErrors: [],
    games,
    wouldCreateArtifacts,
    mutationPerformed: false,
    personnelHashPreview: sha256Json(input.games),
  };
}

export async function saveKboT45AdminInput(options: {
  payload: unknown;
  cwd?: string;
  now?: Date;
  adminId?: string;
}): Promise<KboT45SaveApiResult> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const parsed = parsePersonnelInputJson(options.payload);
  if (!parsed.ok) {
    return {
      ok: false,
      dateKst: "",
      pathRel: null,
      previousHash: null,
      nextHash: null,
      version: 0,
      validation: {
        status: "INVALID",
        dateKst: "",
        globalErrors: [parsed.globalBlocker],
        games: [],
        wouldCreateArtifacts: [],
        mutationPerformed: false,
        personnelHashPreview: null,
      },
      message: parsed.globalBlocker,
      errorCode: "GLOBAL_BLOCKER",
      mutationPerformed: false,
    };
  }

  const input = parsed.input;
  const paths = kboT45Paths(input.dateKst, cwd);
  const locked = await loadLockedGameIds(paths);

  // Reject historical locked slate saves entirely
  if (input.dateKst === "2026-07-31" || locked.size > 0) {
    const validation = validateKboT45AdminPayload({
      payload: input,
      now,
      lockedGameIds: locked.size ? locked : new Set(input.games.map((g) => g.gameId)),
      cwd,
    });
    return {
      ok: false,
      dateKst: input.dateKst,
      pathRel: null,
      previousHash: null,
      nextHash: null,
      version: 0,
      validation,
      message: "ALREADY_LOCKED or historical read-only — save blocked",
      errorCode: "ALREADY_LOCKED",
      mutationPerformed: false,
    };
  }

  // Server revalidation
  const validation = validateKboT45AdminPayload({
    payload: input,
    now,
    lockedGameIds: locked,
    cwd,
  });

  if (validation.status === "BLOCKED" || validation.status === "INVALID") {
    return {
      ok: false,
      dateKst: input.dateKst,
      pathRel: null,
      previousHash: null,
      nextHash: null,
      version: 0,
      validation,
      message: `Save blocked: validation status ${validation.status}`,
      errorCode: validation.status,
      mutationPerformed: false,
    };
  }

  // gameId must match schedule when schedule exists
  if (await exists(paths.schedule)) {
    const sched = JSON.parse(await readFile(paths.schedule, "utf8")) as {
      games?: { gameId?: string }[];
    };
    const allow = new Set(
      (sched.games ?? []).map((g) => String(g.gameId ?? "")),
    );
    for (const g of input.games) {
      if (!allow.has(g.gameId)) {
        return {
          ok: false,
          dateKst: input.dateKst,
          pathRel: null,
          previousHash: null,
          nextHash: null,
          version: 0,
          validation,
          message: `UNKNOWN_GAME_ID: ${g.gameId}`,
          errorCode: "UNKNOWN_GAME_ID",
          mutationPerformed: false,
        };
      }
    }
  }

  let previousHash: string | null = null;
  let version = 1;
  if (await exists(paths.personnelInput)) {
    const prevRaw = await readFile(paths.personnelInput, "utf8");
    previousHash = createHash("sha256").update(prevRaw, "utf8").digest("hex");
    version = 2;
    const rev = paths.personnelInput.replace(
      /\.json$/i,
      `.rev-${now.toISOString().replace(/[:.]/g, "-")}.json`,
    );
    if (!(await exists(rev))) await copyFile(paths.personnelInput, rev);
  }

  const toSave: KboT45PersonnelInputV1 = {
    ...input,
    createdAt: input.createdAt || now.toISOString(),
    createdBy: options.adminId || input.createdBy || "admin-ui",
    commercialUseStatus: input.commercialUseStatus ?? "INTERNAL_ONLY",
  };

  await writeJsonAtomic(paths.personnelInput, toSave);
  const nextRaw = `${JSON.stringify(toSave, null, 2)}\n`;
  const nextHash = createHash("sha256").update(nextRaw, "utf8").digest("hex");

  const saveAudit = {
    schemaVersion: "kbo-t45-admin-save-audit-v1",
    dateKst: input.dateKst,
    action: previousHash ? "UPDATED" : "CREATED",
    actor: options.adminId || "admin-ui",
    occurredAt: now.toISOString(),
    previousHash,
    nextHash,
    path: path.relative(cwd, paths.personnelInput).replace(/\\/g, "/"),
    validationStatus: validation.status,
    note: "Operator input only — T45 workflow snapshots require /run",
  };
  await writeJsonAtomic(
    path.join(paths.auditsRoot, `${input.dateKst}-kbo-t45-admin-save-v1.json`),
    saveAudit,
  );

  return {
    ok: true,
    dateKst: input.dateKst,
    pathRel: path.relative(cwd, paths.personnelInput).replace(/\\/g, "/"),
    previousHash,
    nextHash,
    version,
    validation,
    message: "Operator input saved (workflow not run)",
    mutationPerformed: true,
  };
}

export async function runKboT45AdminWorkflow(options: {
  dateKst: string;
  dryRun?: boolean;
  gameId?: string | null;
  cwd?: string;
  now?: Date;
  adminId?: string;
}): Promise<KboT45RunApiResult> {
  const cwd = options.cwd ?? process.cwd();
  const dateKst = options.dateKst;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    return {
      ok: false,
      dryRun: Boolean(options.dryRun),
      dateKst,
      result: null,
      message: "INVALID_DATE_KST",
      errorCode: "INVALID_DATE_KST",
      t30AutoRun: false,
    };
  }

  if (dateKst === "2026-07-31") {
    return {
      ok: false,
      dryRun: Boolean(options.dryRun),
      dateKst,
      result: null,
      message: "Historical 2026-07-31 is read-only — run blocked",
      errorCode: "HISTORICAL_READ_ONLY",
      t30AutoRun: false,
    };
  }

  const paths = kboT45Paths(dateKst, cwd);
  if (!(await exists(paths.personnelInput))) {
    return {
      ok: false,
      dryRun: Boolean(options.dryRun),
      dateKst,
      result: null,
      message: "Personnel input file missing — save first",
      errorCode: "INPUT_MISSING",
      t30AutoRun: false,
    };
  }

  const runOpts: RunT45Options = {
    dateKst,
    inputPath: paths.personnelInput,
    dryRun: Boolean(options.dryRun),
    gameIds: options.gameId ? [options.gameId] : null,
    adminId: options.adminId ?? "admin-ui",
    cwd,
    now: options.now,
  };

  const result = await runKboT45PersonnelWorkflow(runOpts);
  const ok = !result.globalBlocker;
  return {
    ok,
    dryRun: Boolean(options.dryRun),
    dateKst,
    result,
    message: ok
      ? options.dryRun
        ? "Dry-run complete (mutation 0)"
        : "T45 workflow executed"
      : result.globalBlocker ?? "FAILED",
    errorCode: result.globalBlocker ? "GLOBAL_BLOCKER" : undefined,
    t30AutoRun: false,
  };
}
