/**
 * Build / save / load NPB manual starter confirmation documents.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import {
  asFiniteMs,
  loadNpbScheduleGames,
  type NpbScheduleGameRow,
} from "./join-schedule";
import { buildNpbStarterSide } from "./normalize-starter-name";
import {
  npbStarterConfirmationAbs,
  npbStarterConfirmationRel,
} from "./paths";
import type {
  NpbStarterConfirmationV1,
  NpbStarterGameV1,
  NpbStarterIntakeDraftGame,
  NpbStarterResearchOverlay,
  NpbStarterUiStatus,
} from "./types";
import { NPB_STARTER_CONFIRMATION_SCHEMA } from "./types";

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function cutoffFor(input: {
  verifiedAt: string;
  firstPitchAt: string | null;
}): {
  isBeforeFirstPitch: boolean | null;
  cutoffLabel: NpbStarterGameV1["cutoffLabel"];
} {
  const v = asFiniteMs(input.verifiedAt);
  const f = asFiniteMs(input.firstPitchAt);
  if (v == null || f == null) {
    return { isBeforeFirstPitch: null, cutoffLabel: "UNKNOWN" };
  }
  if (v < f) {
    return { isBeforeFirstPitch: true, cutoffLabel: "PRE_GAME_VERIFIED" };
  }
  return { isBeforeFirstPitch: false, cutoffLabel: "LATE_OPERATOR_INPUT" };
}

function uiStatusFor(game: {
  joinStatus: NpbStarterGameV1["joinStatus"];
  awayStarter: unknown;
  homeStarter: unknown;
  cutoffLabel: NpbStarterGameV1["cutoffLabel"];
}): NpbStarterUiStatus {
  if (game.joinStatus !== "MATCHED") return "JOIN_ERROR";
  if (game.cutoffLabel === "LATE_OPERATOR_INPUT") return "LATE";
  if (game.awayStarter && game.homeStarter) return "CONFIRMED";
  return "MISSING";
}

function summarize(games: NpbStarterGameV1[]): NpbStarterConfirmationV1["summary"] {
  let confirmedStarters = 0;
  let missingStarters = 0;
  let lateGames = 0;
  let joinErrors = 0;
  let preGameVerifiedStarters = 0;
  let matchedGames = 0;

  for (const g of games) {
    if (g.joinStatus === "MATCHED") matchedGames++;
    else joinErrors++;
    if (g.uiStatus === "LATE" || g.cutoffLabel === "LATE_OPERATOR_INPUT") {
      lateGames++;
    }
    for (const side of [g.awayStarter, g.homeStarter]) {
      if (side) {
        confirmedStarters++;
        if (g.cutoffLabel === "PRE_GAME_VERIFIED") preGameVerifiedStarters++;
      } else {
        missingStarters++;
      }
    }
  }

  return {
    scheduleGames: games.length,
    matchedGames,
    confirmedStarters,
    missingStarters,
    lateGames,
    joinErrors,
    preGameVerifiedStarters,
  };
}

export function buildEmptyIntakeGamesFromSchedule(
  scheduleGames: NpbScheduleGameRow[],
): NpbStarterGameV1[] {
  return scheduleGames
    .filter((g) => g.joinStatus === "MATCHED")
    .map((g) => ({
      internalGameId: g.internalGameId,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      awayTeamCanonicalId: g.awayTeamCanonicalId,
      homeTeamCanonicalId: g.homeTeamCanonicalId,
      firstPitchAt: g.firstPitchAt,
      joinStatus: "MATCHED" as const,
      awayStarter: null,
      homeStarter: null,
      verifiedAt: null,
      isBeforeFirstPitch: null,
      cutoffLabel: null,
      uiStatus: "MISSING" as const,
    }));
}

export async function loadNpbStarterConfirmation(input: {
  dateKst: string;
  cwd?: string;
}): Promise<NpbStarterConfirmationV1 | null> {
  const abs = npbStarterConfirmationAbs(input.dateKst, input.cwd);
  try {
    const doc = JSON.parse(await readFile(abs, "utf8")) as unknown;
    const rec = asRecord(doc);
    if (
      !rec ||
      asString(rec.schemaVersion) !== NPB_STARTER_CONFIRMATION_SCHEMA
    ) {
      return null;
    }
    return doc as NpbStarterConfirmationV1;
  } catch {
    return null;
  }
}

/**
 * Save operator starters. Rejects NOT_MATCHED / AMBIGUOUS games.
 * Rejects LATE entries from being stored as PRE_GAME_VERIFIED confirmed.
 * Late-only submissions are rejected entirely (차단).
 */
export async function saveNpbStarterConfirmation(input: {
  dateKst: string;
  cwd?: string;
  sourceLabel?: string;
  verifiedAt?: string;
  drafts: NpbStarterIntakeDraftGame[];
  /** When true, allow writing LATE rows marked LATE (default false = block). */
  allowLate?: boolean;
}): Promise<{
  ok: boolean;
  pathRel: string;
  document: NpbStarterConfirmationV1 | null;
  errors: string[];
}> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  const pathRel = npbStarterConfirmationRel(dateKst);
  const errors: string[] = [];

  const schedule = await loadNpbScheduleGames({ dateKst, cwd });
  if (!schedule.exists || schedule.games.length === 0) {
    return {
      ok: false,
      pathRel,
      document: null,
      errors: ["SCHEDULE_MISSING"],
    };
  }

  const matchedById = new Map(
    schedule.games
      .filter((g) => g.joinStatus === "MATCHED")
      .map((g) => [g.internalGameId, g] as const),
  );

  const games: NpbStarterGameV1[] = [];

  for (const draft of input.drafts) {
    const sched = matchedById.get(draft.internalGameId);
    if (!sched) {
      const ambiguous = schedule.games.find(
        (g) =>
          g.internalGameId === draft.internalGameId &&
          g.joinStatus === "AMBIGUOUS",
      );
      errors.push(
        ambiguous
          ? `AMBIGUOUS:${draft.internalGameId}`
          : `NOT_MATCHED:${draft.internalGameId}`,
      );
      continue;
    }

    const cutoff = cutoffFor({
      verifiedAt,
      firstPitchAt: sched.firstPitchAt,
    });

    if (cutoff.cutoffLabel === "LATE_OPERATOR_INPUT" && !input.allowLate) {
      errors.push(`LATE_OPERATOR_INPUT:${draft.internalGameId}`);
      continue;
    }

    const awayStarter = draft.awayStarter
      ? buildNpbStarterSide({
          originalName: draft.awayStarter.originalName,
          displayName: draft.awayStarter.displayName,
          handedness: draft.awayStarter.handedness,
          teamCanonicalId: sched.awayTeamCanonicalId,
          teamName: sched.awayTeam,
        })
      : null;
    const homeStarter = draft.homeStarter
      ? buildNpbStarterSide({
          originalName: draft.homeStarter.originalName,
          displayName: draft.homeStarter.displayName,
          handedness: draft.homeStarter.handedness,
          teamCanonicalId: sched.homeTeamCanonicalId,
          teamName: sched.homeTeam,
        })
      : null;

    if (
      draft.awayStarter?.originalName?.trim() &&
      !awayStarter
    ) {
      errors.push(`INVALID_AWAY_STARTER:${draft.internalGameId}`);
      continue;
    }
    if (
      draft.homeStarter?.originalName?.trim() &&
      !homeStarter
    ) {
      errors.push(`INVALID_HOME_STARTER:${draft.internalGameId}`);
      continue;
    }

    const game: NpbStarterGameV1 = {
      internalGameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      awayTeamCanonicalId: sched.awayTeamCanonicalId,
      homeTeamCanonicalId: sched.homeTeamCanonicalId,
      firstPitchAt: sched.firstPitchAt,
      joinStatus: "MATCHED",
      awayStarter,
      homeStarter,
      verifiedAt,
      isBeforeFirstPitch: cutoff.isBeforeFirstPitch,
      cutoffLabel: cutoff.cutoffLabel,
      uiStatus: "MISSING",
    };
    game.uiStatus = uiStatusFor(game);
    games.push(game);
  }

  if (errors.length > 0 && games.length === 0) {
    return { ok: false, pathRel, document: null, errors };
  }
  if (errors.some((e) => e.startsWith("NOT_MATCHED") || e.startsWith("AMBIGUOUS"))) {
    return { ok: false, pathRel, document: null, errors };
  }
  if (errors.some((e) => e.startsWith("LATE_OPERATOR_INPUT")) && !input.allowLate) {
    return { ok: false, pathRel, document: null, errors };
  }

  // Fill remaining matched schedule games as MISSING so document covers full slate
  const savedIds = new Set(games.map((g) => g.internalGameId));
  for (const sched of matchedById.values()) {
    if (savedIds.has(sched.internalGameId)) continue;
    games.push({
      internalGameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      awayTeamCanonicalId: sched.awayTeamCanonicalId,
      homeTeamCanonicalId: sched.homeTeamCanonicalId,
      firstPitchAt: sched.firstPitchAt,
      joinStatus: "MATCHED",
      awayStarter: null,
      homeStarter: null,
      verifiedAt: null,
      isBeforeFirstPitch: null,
      cutoffLabel: null,
      uiStatus: "MISSING",
    });
  }

  games.sort((a, b) => a.internalGameId.localeCompare(b.internalGameId));

  const document: NpbStarterConfirmationV1 = {
    schemaVersion: NPB_STARTER_CONFIRMATION_SCHEMA,
    dateKst,
    league: "NPB",
    sourceType: "MANUAL_VERIFIED",
    sourceLabel: input.sourceLabel ?? "수동 확인 · MANUAL VERIFIED",
    verifiedAt,
    enteredBy: "OPERATOR",
    games,
    summary: summarize(games),
  };

  const abs = npbStarterConfirmationAbs(dateKst, cwd);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  return { ok: true, pathRel, document, errors };
}

export async function loadNpbStarterIntakeView(input: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  dateKst: string;
  scheduleExists: boolean;
  schedulePath: string | null;
  confirmationPath: string;
  sourceBanner: string;
  games: NpbStarterGameV1[];
  summary: NpbStarterConfirmationV1["summary"] | null;
  existing: NpbStarterConfirmationV1 | null;
}> {
  const schedule = await loadNpbScheduleGames(input);
  const existing = await loadNpbStarterConfirmation(input);
  const byId = new Map(
    (existing?.games ?? []).map((g) => [g.internalGameId, g] as const),
  );

  const games =
    schedule.games.length > 0
      ? schedule.games
          .filter((g) => g.joinStatus === "MATCHED")
          .map((g) => {
            const prev = byId.get(g.internalGameId);
            if (prev) return prev;
            return {
              internalGameId: g.internalGameId,
              awayTeam: g.awayTeam,
              homeTeam: g.homeTeam,
              awayTeamCanonicalId: g.awayTeamCanonicalId,
              homeTeamCanonicalId: g.homeTeamCanonicalId,
              firstPitchAt: g.firstPitchAt,
              joinStatus: "MATCHED" as const,
              awayStarter: null,
              homeStarter: null,
              verifiedAt: null,
              isBeforeFirstPitch: null,
              cutoffLabel: null,
              uiStatus: "MISSING" as const,
            };
          })
      : existing?.games ?? [];

  return {
    dateKst: input.dateKst,
    scheduleExists: schedule.exists,
    schedulePath: schedule.exists ? schedule.pathRel : null,
    confirmationPath: npbStarterConfirmationRel(input.dateKst),
    sourceBanner: "수동 확인 · MANUAL VERIFIED",
    games,
    summary: existing?.summary ?? null,
    existing,
  };
}

/**
 * Research overlay: only PRE_GAME_VERIFIED MANUAL starters count as available.
 * Never mutates provider starter-dataset artifacts.
 */
export async function loadNpbStarterResearchOverlay(input: {
  dateKst: string;
  cwd?: string;
}): Promise<NpbStarterResearchOverlay> {
  const doc = await loadNpbStarterConfirmation(input);
  const games =
    doc?.games.map((g) => {
      const preGameVerified =
        g.cutoffLabel === "PRE_GAME_VERIFIED" &&
        g.joinStatus === "MATCHED" &&
        Boolean(g.awayStarter && g.homeStarter);
      return {
        internalGameId: g.internalGameId,
        homeStarter:
          preGameVerified && g.homeStarter
            ? g.homeStarter.originalName
            : g.cutoffLabel === "PRE_GAME_VERIFIED"
              ? g.homeStarter?.originalName ?? null
              : null,
        awayStarter:
          preGameVerified && g.awayStarter
            ? g.awayStarter.originalName
            : g.cutoffLabel === "PRE_GAME_VERIFIED"
              ? g.awayStarter?.originalName ?? null
              : null,
        status: g.uiStatus,
        preGameVerified,
      };
    }) ?? [];

  let available = 0;
  let total = 0;
  for (const g of doc?.games ?? []) {
    if (g.joinStatus !== "MATCHED") continue;
    total += 2;
    if (g.cutoffLabel === "PRE_GAME_VERIFIED") {
      if (g.awayStarter) available++;
      if (g.homeStarter) available++;
    }
  }

  return {
    dateKst: input.dateKst,
    sourceType: "MANUAL_VERIFIED",
    sourceLabel: "MANUAL VERIFIED",
    availableStarters: available,
    totalStarterSlots: total || 12,
    line: `Starter ${available}/${total || 12} AVAILABLE · MANUAL VERIFIED`,
    games,
  };
}

export function parseExistingGamesArray(raw: unknown): NpbStarterGameV1[] {
  return asArr(raw) as NpbStarterGameV1[];
}
