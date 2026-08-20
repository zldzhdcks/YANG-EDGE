/**
 * Save / load MLB Expected Lineup Observation v0.
 * Never touches prediction / recommendation / lineup-dataset.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMlbScheduleArtifact } from "@/lib/mlb/build-mlb-schedule-artifact";
import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import { mlbExpectedLineupObservationRel } from "./paths";
import { inferExpectedLineupGameObservationStatus, normalizeExpectedLineupObservation } from "./normalize-game";
import { validateNineSlotLineup } from "./parse-paste";
import type {
  MlbExpectedBatterV0,
  MlbExpectedLineupCutoffLabel,
  MlbExpectedLineupDraftGame,
  MlbExpectedLineupGameDetailPanel,
  MlbExpectedLineupGameV0,
  MlbExpectedLineupObservationV0,
} from "./types";
import { MLB_EXPECTED_LINEUP_OBSERVATION_SCHEMA } from "./types";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asFiniteMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function toBatter(b: {
  battingOrder: number;
  displayName: string;
  position?: string | null;
  bats?: string | null;
}): MlbExpectedBatterV0 {
  return {
    battingOrder: b.battingOrder,
    displayName: b.displayName.trim(),
    position: b.position?.trim() ? b.position.trim().toUpperCase() : null,
    bats: b.bats?.trim() ? b.bats.trim().toUpperCase() : null,
    providerPlayerId: null,
  };
}

function cutoffFor(input: {
  observedAt: string;
  firstPitchAt: string | null;
}): {
  isBeforeFirstPitch: boolean | null;
  cutoffLabel: MlbExpectedLineupCutoffLabel;
} {
  const o = asFiniteMs(input.observedAt);
  const f = asFiniteMs(input.firstPitchAt);
  if (o == null || f == null) {
    return { isBeforeFirstPitch: null, cutoffLabel: "UNKNOWN" };
  }
  if (o < f) {
    return { isBeforeFirstPitch: true, cutoffLabel: "PRE_GAME_OBSERVATION" };
  }
  return { isBeforeFirstPitch: false, cutoffLabel: "LATE_OBSERVATION" };
}

function summarize(
  games: MlbExpectedLineupGameV0[],
  scheduleGames: number,
): MlbExpectedLineupObservationV0["summary"] {
  let matchedGames = 0;
  let teamLineups = 0;
  let expectedBattingSlots = 0;
  let expectedGames = 0;
  let missingGames = 0;
  let preGameObservations = 0;
  let lateObservations = 0;
  let joinErrors = 0;

  for (const g of games) {
    if (g.joinStatus === "MATCHED") matchedGames++;
    else joinErrors++;

    const observationStatus = inferExpectedLineupGameObservationStatus(g);
    if (observationStatus === "OBSERVED") {
      expectedGames++;
      if (g.cutoffLabel === "PRE_GAME_OBSERVATION") preGameObservations++;
      if (g.cutoffLabel === "LATE_OBSERVATION") lateObservations++;
      if (g.awayLineup.length === 9) {
        teamLineups++;
        expectedBattingSlots += 9;
      }
      if (g.homeLineup.length === 9) {
        teamLineups++;
        expectedBattingSlots += 9;
      }
    } else {
      missingGames++;
    }
  }

  return {
    scheduleGames,
    matchedGames,
    teamLineups,
    expectedBattingSlots,
    expectedGames,
    confirmedGames: 0,
    missingGames,
    preGameObservations,
    lateObservations,
    joinErrors,
  };
}

export function computeExpectedLineupHash(
  games: MlbExpectedLineupGameV0[],
): string {
  return sha256(
    JSON.stringify(
      games.map((g) => ({
        gamePk: g.gamePk,
        lineupStatus: g.lineupStatus,
        observationStatus: g.observationStatus ?? inferExpectedLineupGameObservationStatus(g),
        awayLineup: g.awayLineup,
        homeLineup: g.homeLineup,
      })),
    ),
  );
}

export async function loadMlbExpectedLineupObservation(input: {
  dateKst: string;
  cwd?: string;
}): Promise<MlbExpectedLineupObservationV0 | null> {
  const cwd = input.cwd ?? process.cwd();
  const abs = path.join(cwd, mlbExpectedLineupObservationRel(input.dateKst));
  try {
    const raw = JSON.parse(await readFile(abs, "utf8")) as unknown;
    const rec = asRecord(raw);
    if (
      !rec ||
      asString(rec.schemaVersion) !== MLB_EXPECTED_LINEUP_OBSERVATION_SCHEMA
    ) {
      return null;
    }
    return normalizeExpectedLineupObservation(raw as MlbExpectedLineupObservationV0);
  } catch {
    return null;
  }
}

export async function loadMlbExpectedLineupForGame(input: {
  dateKst: string;
  gamePk: number;
  cwd?: string;
}): Promise<MlbExpectedLineupGameV0 | null> {
  const doc = await loadMlbExpectedLineupObservation(input);
  if (!doc) return null;
  return doc.games.find((g) => g.gamePk === input.gamePk) ?? null;
}

export async function loadMlbExpectedLineupGameDetailPanel(input: {
  dateKst: string;
  gamePk: number;
  cwd?: string;
  providerCollectionStatus?: string | null;
}): Promise<MlbExpectedLineupGameDetailPanel> {
  const game = await loadMlbExpectedLineupForGame(input);
  const provider =
    input.providerCollectionStatus?.trim() || "NOT RELEASED";
  if (!game) {
    return {
      available: false,
      lineupStatus: "NOT_AVAILABLE",
      providerLineupStatus: `Provider Lineup: ${provider}`,
      operatorObservationStatus: "Operator Observation: NOT AVAILABLE",
      disclaimer: "예상 라인업 — 확정 아님",
      observedAt: null,
      isBeforeFirstPitch: null,
      cutoffLabel: null,
      awayTeam: "",
      homeTeam: "",
      awayLineup: [],
      homeLineup: [],
    };
  }

  const observationStatus = inferExpectedLineupGameObservationStatus(game);
  if (observationStatus === "NOT_OBSERVED") {
    return {
      available: false,
      lineupStatus: "NOT_AVAILABLE",
      providerLineupStatus: `Provider Lineup: ${provider}`,
      operatorObservationStatus: "Operator Observation: NOT OBSERVED",
      disclaimer: "예상 라인업 — 확정 아님",
      observedAt: null,
      isBeforeFirstPitch: null,
      cutoffLabel: null,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      awayLineup: [],
      homeLineup: [],
    };
  }

  return {
    available: true,
    lineupStatus: "EXPECTED",
    providerLineupStatus: `Provider Lineup: ${provider}`,
    operatorObservationStatus: "Operator Observation: EXPECTED LINEUP AVAILABLE",
    disclaimer: "예상 라인업 — 확정 아님",
    observedAt: game.observedAt,
    isBeforeFirstPitch: game.isBeforeFirstPitch,
    cutoffLabel: game.cutoffLabel,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    awayLineup: game.awayLineup,
    homeLineup: game.homeLineup,
  };
}

/**
 * Save expected lineup observation. Rejects CONFIRMED promotion.
 * Late observations are stored only when allowLate=true (marked LATE).
 */
export async function saveMlbExpectedLineupObservation(input: {
  dateKst: string;
  cwd?: string;
  sourceLabel?: string;
  observedAt?: string;
  drafts: MlbExpectedLineupDraftGame[];
  allowLate?: boolean;
  /** When true, schedule games without drafts are stored as NOT_OBSERVED (empty lineups). */
  allowMissingDrafts?: boolean;
  note?: string;
}): Promise<{
  ok: boolean;
  pathRel: string;
  document: MlbExpectedLineupObservationV0 | null;
  errors: string[];
}> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const observedAt = input.observedAt ?? new Date().toISOString();
  const pathRel = mlbExpectedLineupObservationRel(dateKst);
  const errors: string[] = [];

  if (input.drafts.length === 0) {
    return {
      ok: false,
      pathRel,
      document: null,
      errors: ["NO_OBSERVATIONS_TO_SAVE"],
    };
  }

  let schedule;
  try {
    schedule = await loadMlbScheduleArtifact(dateKst, cwd);
  } catch (e) {
    return {
      ok: false,
      pathRel,
      document: null,
      errors: [`SCHEDULE_MISSING:${String(e)}`],
    };
  }

  const byPk = new Map(
    schedule.games.map((g) => [g.gamePk, g] as const),
  );
  const draftByPk = new Map(input.drafts.map((d) => [d.gamePk, d] as const));
  const games: MlbExpectedLineupGameV0[] = [];

  for (const sched of schedule.games) {
    const draft = draftByPk.get(sched.gamePk);
    const firstPitchAt =
      sched.commenceTimeUtc ?? sched.scheduledStartTime ?? null;
    if (!draft) {
      if (input.allowMissingDrafts) {
        games.push({
          gamePk: sched.gamePk,
          internalGameId: sched.internalGameId,
          awayTeam: sched.awayTeam,
          homeTeam: sched.homeTeam,
          firstPitchAt,
          joinStatus: "MATCHED",
          lineupStatus: "EXPECTED",
          observationStatus: "NOT_OBSERVED",
          awayLineup: [],
          homeLineup: [],
          observedAt: null,
          isBeforeFirstPitch: null,
          cutoffLabel: null,
        });
        continue;
      }
      errors.push(`MISSING_DRAFT:${sched.gamePk}`);
      continue;
    }

    const awayErrors = validateNineSlotLineup(
      draft.awayLineup,
      `AWAY:${sched.gamePk}`,
    );
    const homeErrors = validateNineSlotLineup(
      draft.homeLineup,
      `HOME:${sched.gamePk}`,
    );
    errors.push(...awayErrors, ...homeErrors);

    const cutoff = cutoffFor({ observedAt, firstPitchAt });
    if (cutoff.cutoffLabel === "LATE_OBSERVATION" && !input.allowLate) {
      errors.push(`LATE_OBSERVATION_BLOCKED:${sched.gamePk}`);
      continue;
    }

    games.push({
      gamePk: sched.gamePk,
      internalGameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      firstPitchAt,
      joinStatus: "MATCHED",
      lineupStatus: "EXPECTED",
      observationStatus: "OBSERVED",
      awayLineup: draft.awayLineup
        .slice()
        .sort((a, b) => a.battingOrder - b.battingOrder)
        .map(toBatter),
      homeLineup: draft.homeLineup
        .slice()
        .sort((a, b) => a.battingOrder - b.battingOrder)
        .map(toBatter),
      observedAt,
      isBeforeFirstPitch: cutoff.isBeforeFirstPitch,
      cutoffLabel: cutoff.cutoffLabel,
    });
  }

  for (const draft of input.drafts) {
    if (!byPk.has(draft.gamePk)) {
      errors.push(`NOT_MATCHED:${draft.gamePk}`);
    }
  }

  if (errors.length) {
    return { ok: false, pathRel, document: null, errors };
  }

  games.sort((a, b) => a.gamePk - b.gamePk);
  const expectedLineupHash = computeExpectedLineupHash(games);
  const document: MlbExpectedLineupObservationV0 = {
    schemaVersion: MLB_EXPECTED_LINEUP_OBSERVATION_SCHEMA,
    dateKst,
    league: "MLB",
    observationType: "EXPECTED_LINEUP",
    sourceType: "MANUAL_OBSERVATION",
    sourceLabel:
      input.sourceLabel ?? "수동 관찰 · EXPECTED LINEUP · MANUAL_OBSERVATION",
    lineupStatus: "EXPECTED",
    observedAt,
    enteredBy: "OPERATOR",
    note:
      input.note ??
      "PREGAME EXPECTED LINEUP OBSERVATION — not CONFIRMED lineup. Does not mutate Prediction / Recommendation / lineup-dataset-v1.",
    expectedLineupHash,
    games,
    summary: summarize(games, schedule.games.length),
  };

  const abs = path.join(cwd, pathRel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  return { ok: true, pathRel, document, errors: [] };
}

/** Presentation helper for intake pages. */
export async function loadMlbExpectedLineupIntakeView(input: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  dateKst: string;
  scheduleExists: boolean;
  observationPath: string;
  sourceBanner: string;
  games: Array<{
    gamePk: number;
    awayTeam: string;
    homeTeam: string;
    firstPitchAt: string | null;
    joinStatus: string;
    observationStatus: "OBSERVED" | "NOT_OBSERVED";
    awayLineup: MlbExpectedBatterV0[];
    homeLineup: MlbExpectedBatterV0[];
    cutoffLabel: string | null;
    isBeforeFirstPitch: boolean | null;
  }>;
  summary: MlbExpectedLineupObservationV0["summary"] | null;
}> {
  const cwd = input.cwd ?? process.cwd();
  const observationPath = mlbExpectedLineupObservationRel(input.dateKst);
  let scheduleExists = true;
  let scheduleGames: Array<{
    gamePk: number;
    awayTeam: string;
    homeTeam: string;
    firstPitchAt: string | null;
  }> = [];
  try {
    const schedule = await loadMlbScheduleArtifact(input.dateKst, cwd);
    scheduleGames = schedule.games.map((g) => ({
      gamePk: g.gamePk,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      firstPitchAt: g.commenceTimeUtc ?? g.scheduledStartTime ?? null,
    }));
  } catch {
    scheduleExists = false;
  }

  const existing = await loadMlbExpectedLineupObservation(input);
  const byPk = new Map(
    (existing?.games ?? []).map((g) => [g.gamePk, g] as const),
  );

  return {
    dateKst: input.dateKst,
    scheduleExists,
    observationPath,
    sourceBanner: "MANUAL_OBSERVATION · EXPECTED (확정 아님)",
    games: scheduleGames.map((g) => {
      const row = byPk.get(g.gamePk);
      return {
        gamePk: g.gamePk,
        awayTeam: g.awayTeam,
        homeTeam: g.homeTeam,
        firstPitchAt: g.firstPitchAt,
        joinStatus: row?.joinStatus ?? "MATCHED",
        observationStatus: row
          ? inferExpectedLineupGameObservationStatus(row)
          : "NOT_OBSERVED",
        awayLineup: row?.awayLineup ?? [],
        homeLineup: row?.homeLineup ?? [],
        cutoffLabel: row?.cutoffLabel ?? null,
        isBeforeFirstPitch: row?.isBeforeFirstPitch ?? null,
      };
    }),
    summary: existing?.summary ?? null,
  };
}

export function readProviderLineupCollectionStatus(
  lineupDatasetRaw: unknown,
  gamePk: number,
): string {
  const doc = asRecord(lineupDatasetRaw);
  const rows = Array.isArray(doc?.rows) ? doc!.rows : [];
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    if (asNumber(row.gamePk) !== gamePk) continue;
    const status = asString(row.collectionStatus);
    if (status) return status.replace(/_/g, " ");
  }
  return "NOT RELEASED";
}
